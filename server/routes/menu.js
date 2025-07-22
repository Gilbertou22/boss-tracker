const express = require('express');
const router = express.Router();
const MenuItem = require('../models/MenuItem');
const MenuLog = require('../models/MenuLog');
const { auth, adminOnly } = require('../middleware/auth');
const logger = require('../logger');
const mongoose = require('mongoose');

// 刷新 session 中的菜單數據
const refreshSessionMenu = async (req) => {
    try {
        const menuItems = await MenuItem.find()
            .populate({
                path: 'children',
                populate: { path: 'children' },
            })
            .sort({ order: 1 });

        const filterMenuItems = (items, userRole) => {
            return items
                .filter(item => {
                    let roles;
                    try {
                        roles = Array.isArray(item.roles) ? item.roles : JSON.parse(item.roles || '[]');
                        while (typeof roles === 'string') {
                            roles = JSON.parse(roles);
                        }
                    } catch (err) {
                        logger.warn('Failed to parse roles', { roles: item.roles, error: err.message });
                        roles = [];
                    }
                    return roles.includes(userRole);
                })
                .map(item => {
                    const filteredItem = {
                        key: item.key,
                        label: item.label,
                        icon: item.icon,
                        customIcon: item.customIcon,
                        roles: item.roles,
                        parentId: item.parentId,
                        order: item.order,
                        _id: item._id, // 保留原始 _id 格式
                    };
                    if (item.children && item.children.length > 0) {
                        filteredItem.children = filterMenuItems(item.children, userRole);
                    }
                    return filteredItem;
                })
                .filter(item => item.children ? item.children.length > 0 : true);
        };

        const filteredMenuItems = filterMenuItems(menuItems, req.user.role);
        req.session.menuItems = filteredMenuItems;
        logger.info('Session menu updated', { userId: req.user.id, menuItems: filteredMenuItems });
    } catch (err) {
        logger.error('Refresh session menu error', { error: err.message });
    }
};

// 獲取所有菜單項
router.get('/', auth, async (req, res) => {
    try {
        const menuItems = await MenuItem.find()
            .populate('children')
            .sort({ order: 1 });
        res.json(menuItems);
    } catch (err) {
        logger.error('Get menu items error', { error: err.message });
        res.status(500).json({ msg: '服務器錯誤', detail: err.message });
    }
});

// 創建新菜單項（管理員專用）
router.post('/', auth, adminOnly, async (req, res) => {
    const { key, label, icon, roles, children, order, parentId } = req.body;
    try {
        let parsedRoles = [];
        if (roles) {
            parsedRoles = Array.isArray(roles) ? roles : JSON.parse(roles);
        }

        let parsedChildren = [];
        if (children) {
            parsedChildren = Array.isArray(children) ? children : JSON.parse(children);
            parsedChildren = parsedChildren
                .map(child => {
                    if (typeof child !== 'string') {
                        logger.warn('Invalid child type, expected string', { child });
                        return null;
                    }
                    if (!mongoose.Types.ObjectId.isValid(child)) {
                        throw new Error(`Invalid ObjectId: ${child}`);
                    }
                    return new mongoose.Types.ObjectId(child);
                })
                .filter(child => child); // 過濾掉無效值
        }

        const menuItem = new MenuItem({
            key,
            label,
            icon,
            roles: parsedRoles,
            children: parsedChildren,
            order,
            customIcon: req.file ? `/uploads/icons/${req.file.filename}` : undefined,
            parentId: parentId || null,
        });
        await menuItem.save();

        await MenuLog.create({
            action: 'create',
            menuItemId: menuItem._id,
            userId: req.user.id,
            details: { ...req.body, customIcon: menuItem.customIcon },
        });

        // 刷新 session 中的菜單數據
        await refreshSessionMenu(req);

        res.status(201).json({ msg: '菜單項創建成功', menuItem });
    } catch (err) {
        logger.error('Create menu item error', { error: err.message });
        res.status(500).json({ msg: '創建失敗', detail: err.message });
    }
});

router.put('/reorder', auth, adminOnly, async (req, res) => {
    const { treeData } = req.body;
    
    try {


        // 檢查 treeData 是否有效
        if (!Array.isArray(treeData)) {
            return res.status(400).json({ msg: 'treeData 必須是一個陣列' });
        }

        // 遍歷 treeData，驗證每個節點的 _id
        const validateNode = (node) => {
            
            if (!node._id || !mongoose.Types.ObjectId.isValid(node._id)) {
                throw new Error('ID 必須是有效的 ObjectId.');
            }
            if (node.parentId && !mongoose.Types.ObjectId.isValid(node.parentId)) {
                throw new Error('parentId 必須是有效的 ObjectId.');
            }
            if (node.children && Array.isArray(node.children)) {
                node.children.forEach(child => validateNode(child));
            }
        };

        treeData.forEach(node => validateNode(node));

        // 更新排序邏輯
        const updateNodeOrder = async (node, parentId = null, order = 0) => {
            const parentIdObj = parentId && mongoose.Types.ObjectId.isValid(parentId)
                ? new mongoose.Types.ObjectId(parentId)
                : null;

            
            try {
                await MenuItem.updateOne(
                    { _id: new mongoose.Types.ObjectId(node._id) },
                    { order, parentId: parentIdObj }
                );
            } catch (updateErr) {
                console.error('Update failed for node:', node, updateErr);
                throw updateErr;
            }
            if (node.children && Array.isArray(node.children)) {
                for (let i = 0; i < node.children.length; i++) {
                    await updateNodeOrder(node.children[i], node._id, i);
                }
            }
        };

        for (let i = 0; i < treeData.length; i++) {
            await updateNodeOrder(treeData[i], null, i);
        }

        // 刷新 session 中的菜單數據
        await refreshSessionMenu(req);

        res.json({ msg: '菜單順序已保存' });
    } catch (err) {
        logger.error('Reorder menu items error', { error: err.message });
        res.status(400).json({ msg: '無效的菜單項 ID.', detail: err.message });
    }
});


// 更新菜單項（管理員專用）
router.put('/:id', auth, adminOnly, async (req, res) => {
    const { key, label, icon, roles, children, order } = req.body;
    try {
        const { id } = req.params;
        if (!id || id === 'undefined' || !mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ msg: '無效的菜單項 ID.', detail: 'ID 必須是有效的 ObjectId' });
        }

        const menuItem = await MenuItem.findById(id);
        if (!menuItem) {
            return res.status(404).json({ msg: '菜單項不存在' });
        }

        let parsedRoles = [];
        if (roles) {
            parsedRoles = Array.isArray(roles) ? roles : JSON.parse(roles);
        }

        let parsedChildren = [];
        if (children) {
            parsedChildren = Array.isArray(children) ? children : JSON.parse(children);
            parsedChildren = parsedChildren
                .map(child => {
                    if (typeof child !== 'string') {
                        logger.warn('Invalid child type, expected string', { child });
                        return null;
                    }
                    if (!mongoose.Types.ObjectId.isValid(child)) {
                        throw new Error(`Invalid ObjectId: ${child}`);
                    }
                    return new mongoose.Types.ObjectId(child);
                })
                .filter(child => child); // 過濾掉無效值
        }

        menuItem.key = key || menuItem.key;
        menuItem.label = label || menuItem.label;
        menuItem.icon = icon || menuItem.icon;
        menuItem.roles = parsedRoles || menuItem.roles;
        menuItem.children = parsedChildren || menuItem.children;
        menuItem.order = order !== undefined ? order : menuItem.order;
        menuItem.customIcon = req.file ? `/uploads/icons/${req.file.filename}` : (icon ? undefined : menuItem.customIcon);
        menuItem.updatedAt = Date.now();
        await menuItem.save();

        await MenuLog.create({
            action: 'update',
            menuItemId: menuItem._id,
            userId: req.user.id,
            details: { ...req.body, customIcon: menuItem.customIcon },
        });

        // 刷新 session 中的菜單數據
        await refreshSessionMenu(req);

        res.json({ msg: '菜單項更新成功', menuItem });
    } catch (err) {
        logger.error('Update menu item error', { error: err.message });
        res.status(500).json({ msg: '更新失敗', detail: err.message });
    }
});

// 刪除菜單項（管理員專用）
router.delete('/:id', auth, adminOnly, async (req, res) => {
    try {
        const { id } = req.params;
        if (!id || id === 'undefined' || !mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ msg: '無效的菜單項 ID', detail: 'ID 必須是有效的 ObjectId' });
        }

        const menuItem = await MenuItem.findById(id);
        if (!menuItem) {
            return res.status(404).json({ msg: '菜單項不存在' });
        }

        await MenuLog.create({
            action: 'delete',
            menuItemId: menuItem._id,
            userId: req.user.id,
            details: menuItem.toObject(),
        });

        await MenuItem.deleteOne({ _id: id });
        // 清理所有引用該項的 children 字段
        await MenuItem.updateMany(
            { children: id },
            { $pull: { children: id } }
        );

        // 刷新 session 中的菜單數據
        await refreshSessionMenu(req);

        res.json({ msg: '菜單項刪除成功' });
    } catch (err) {
        logger.error('Delete menu item error', { error: err.message });
        res.status(500).json({ msg: '刪除失敗', detail: err.message });
    }
});

// 批量刪除（管理員專用）
router.delete('/batch', auth, adminOnly, async (req, res) => {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ msg: '請提供有效的菜單項 ID 陣列' });
    }
    try {
        // 檢查所有 ID 是否有效
        const invalidIds = ids.filter(id => !mongoose.Types.ObjectId.isValid(id));
        if (invalidIds.length > 0) {
            return res.status(400).json({ msg: '無效的菜單項 ID', detail: `以下 ID 無效: ${invalidIds.join(', ')}` });
        }

        const menuItems = await MenuItem.find({ _id: { $in: ids } });
        await Promise.all(menuItems.map(item =>
            MenuLog.create({
                action: 'delete',
                menuItemId: item._id,
                userId: req.user.id,
                details: item.toObject(),
            })
        ));

        await MenuItem.deleteMany({ _id: { $in: ids } });
        await MenuItem.updateMany(
            { children: { $in: ids } },
            { $pull: { children: { $in: ids } } }
        );

        // 刷新 session 中的菜單數據
        await refreshSessionMenu(req);

        res.json({ msg: '批量刪除成功', deletedCount: ids.length });
    } catch (err) {
        logger.error('Batch delete menu items error', { error: err.message });
        res.status(500).json({ msg: '批量刪除失敗', detail: err.message });
    }
});


module.exports = router;