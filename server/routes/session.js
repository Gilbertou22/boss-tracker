const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const MenuItem = require('../models/MenuItem');
const logger = require('../logger');

router.get('/menu', auth, async (req, res) => {
    try {
        // 確認 req.user 和 req.user.roles 存在
        if (!req.user || !req.user.roles) {
            logger.error('User roles not found in request', { user: req.user });
            return res.status(401).json({ msg: '無效的用戶身份，缺少角色信息' });
        }

        // 如果 req.user.roles 為空，給予默認角色（例如 "user"）
        const userRoles = req.user.roles.length > 0 ? req.user.roles : ['user'];
        logger.debug('User roles for menu filtering:', { userId: req.user.id, roles: userRoles });

        // 從 session 中獲取 menuItems，如果不存在則重新查詢
        let menuItems = req.session && req.session.menuItems ? req.session.menuItems : [];
        if (menuItems.length === 0) {
            // 查詢所有菜單項，並填充子菜單
            menuItems = await MenuItem.find()
                .populate({
                    path: 'children',
                    populate: { path: 'children' },
                })
                .sort({ order: 1 });

            // 如果查詢結果為空，記錄警告並返回空陣列
            if (!menuItems || menuItems.length === 0) {
                logger.warn('No menu items found in database');
                return res.json([]);
            }

            const filterMenuItems = (items, userRoles) => {
                return items
                    .filter(item => {
                        let roles = [];
                        try {
                            // 處理 roles 字段，確保其為陣列
                            if (Array.isArray(item.roles)) {
                                roles = item.roles;
                            } else if (typeof item.roles === 'string') {
                                roles = JSON.parse(item.roles || '[]');
                                while (typeof roles === 'string') {
                                    roles = JSON.parse(roles);
                                }
                            } else {
                                roles = [];
                            }

                            // 如果 roles 為空，假設該菜單項對所有角色可見
                            if (roles.length === 0) {
                                logger.debug(`Menu item has no roles, visible to all: ${item.label}`);
                                return true;
                            }

                            // 檢查用戶的 roles 陣列中是否至少有一個角色符合菜單項的 roles 要求
                            const hasAccess = roles.some(role => userRoles.includes(role));
                            if (!hasAccess) {
                                logger.debug(`Menu item filtered out: ${item.label}, required roles: ${roles}, user roles: ${userRoles}`);
                            }
                            return hasAccess;
                        } catch (err) {
                            logger.warn(`Failed to parse roles for menu item: ${item.label}`, { roles: item.roles, error: err.message });
                            return false; // 解析失敗時，默認不顯示該菜單項
                        }
                    })
                    .map(item => {
                        const filteredItem = {
                            key: item.key,
                            label: item.label,
                            icon: item.icon,
                            customIcon: item.customIcon,
                            roles: item.roles,
                            parentId: item.parentId ? item.parentId.toString() : null,
                            order: item.order,
                            _id: item._id.toString(),
                            children: item.children && item.children.length > 0 ? filterMenuItems(item.children, userRoles) : [],
                        };
                        return filteredItem;
                    })
                    .filter(item => (item.children && item.children.length > 0) || (item.key && item.label)); // 確保有 key 和 label
            };

            menuItems = filterMenuItems(menuItems, userRoles);

            // 確保 menuItems 不包含無效項
            menuItems = menuItems.filter(item => item.key && item.label);

            // Only set req.session.menuItems if req.session exists
            if (req.session) {
                req.session.menuItems = menuItems;
                logger.info(`Menu items cached in session for user: ${req.user.id}`, { menuItemsCount: menuItems.length });
            } else {
                logger.warn('Session middleware not initialized, req.session is undefined');
            }
        }

        res.json(menuItems);
    } catch (err) {
        logger.error('Get session menu error', { error: err.message, userId: req.user?.id });
        res.status(500).json({ msg: '服務器錯誤', detail: err.message });
    }
});

module.exports = router;