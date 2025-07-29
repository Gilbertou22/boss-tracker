const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Guild = require('../models/Guild');
const MenuItem = require('../models/MenuItem');
const LoginRecord = require('../models/LoginRecord');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const logger = require('../logger');
const { auth, adminOnly } = require('../middleware/auth');
require('dotenv').config();

// 獲取客戶端 IP 地址
router.get('/client-ip', (req, res) => {
    try {
        const clientIp = req.headers['x-forwarded-for'] || req.ip || '未知 IP';
        res.status(200).json({ ip: clientIp });
    } catch (err) {
        res.status(500).json({ msg: '無法獲取 IP 地址', detail: err.message });
    }
});

// 註冊路由
router.post('/register', async (req, res) => {
    const { world_name, character_name, password, guildPassword, discord_id, raid_level, profession } = req.body;

    try {
        // 驗證必填字段
        if (!world_name || !character_name || !password || !guildPassword || !profession) {
            return res.status(400).json({
                code: 400,
                msg: '缺少必填字段',
                detail: '請提供 world_name、character_name、password、guildPassword、profession',
            });
        }

        let user = await User.findOne({ character_name });
        if (user) {
            return res.status(400).json({
                code: 400,
                msg: '用戶名已存在',
                detail: '請選擇其他用戶名',
            });
        }

        const guild = await Guild.findOne({ password: guildPassword });
        if (!guild) {
            return res.status(400).json({
                code: 400,
                msg: '無效的團隊密碼',
                detail: '請確認輸入的團隊密碼是否正確',
            });
        }

        const userRole = await Role.findOne({ name: 'user' });
        if (!userRole) {
            return res.status(500).json({
                code: 500,
                msg: '伺服器錯誤',
                detail: '無法找到 user 角色',
            });
        }

        user = new User({
            world_name,
            character_name,
            password,
            roles: [userRole._id],
            discord_id: discord_id || null,
            raid_level: raid_level ? parseInt(raid_level) : 0,
            diamonds: 0,
            guildId: guild._id,
            mustChangePassword: false,
            profession,
        });

        await user.save();

        const payload = {
            user: {
                id: user._id,
                roles: [userRole.name],
            },
        };

        jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: 36000 }, (err, token) => {
            if (err) throw err;
            res.json({
                token,
                user: {
                    id: user._id,
                    character_name: user.character_name,
                    roles: [userRole.name],
                    mustChangePassword: user.mustChangePassword,
                },
                msg: '註冊成功！',
            });
        });
    } catch (err) {
        console.error('Register error:', err.message);
        res.status(500).json({
            code: 500,
            msg: '伺服器錯誤',
            detail: err.message,
        });
    }
});

// 獲取當前用戶信息
router.get('/user', auth, async (req, res) => {
    const user = await User.findById(req.user.id)
        .populate('roles', 'name');
    res.json({
        user: {
            id: user._id,
            character_name: user.character_name,
            roles: user.roles.map(role => role.name),
            mustChangePassword: user.mustChangePassword,
        },
    });
});

router.post('/login', async (req, res) => {
    const { character_name, password, captcha_input } = req.body;

    try {
        const isBot = req.headers['x-bot-auth'] === process.env.BOT_SECRET;
        console.log('isBot:', isBot);
        // 驗證必填字段
        if (!character_name) {
            return res.status(400).json({
                code: 400,
                msg: '缺少必填字段',
                detail: '請提供 character_name',
            });
        }

        if (!isBot && !password) {
            return res.status(400).json({
                code: 400,
                msg: '缺少必填字段',
                detail: '請提供 password',
            });
        }

        if (!isBot) {
            // 正常用戶請求，檢查 CAPTCHA
            if (!captcha_input) {
                return res.status(400).json({
                    code: 400,
                    msg: '驗證碼缺失',
                    detail: '請輸入驗證碼',
                });
            }
        }

        const user = await User.findOne({ character_name })
            .populate('roles', 'name');
        if (!user) {
            return res.status(400).json({
                code: 400,
                msg: '用戶不存在',
                detail: '請檢查用戶名或註冊新賬號',
            });
        }

        let isMatch = true;
        if (!isBot) {
            isMatch = await bcrypt.compare(password, user.password);
        }
        if (!isMatch) {
            return res.status(400).json({
                code: 400,
                msg: '密碼錯誤',
                detail: '請檢查密碼是否正確',
            });
        }

        if (user.status === 'disabled') {
            return res.status(403).json({
                code: 403,
                msg: '帳號已被禁用',
                detail: '請聯繫管理員',
            });
        }

        const ipAddress = req.headers['x-forwarded-for'] || req.ip || 'unknown';
        const loginRecord = new LoginRecord({
            userId: user._id,
            characterName: user.character_name,
            ipAddress,
            userAgent: req.headers['user-agent'] || '',
        });
        await loginRecord.save();

        user.lastLogin = new Date();
        await user.save();

        if (user.mustChangePassword) {
            const tempPayload = {
                user: {
                    id: user._id,
                    roles: user.roles.map(role => role.name),
                    temporary: true,
                },
            };
            const tempToken = jwt.sign(tempPayload, process.env.JWT_SECRET, { expiresIn: '5m' });
            return res.status(200).json({
                code: 200,
                msg: '需要更改密碼',
                mustChangePassword: true,
                tempToken,
                user: {
                    id: user._id,
                    character_name: user.character_name,
                    roles: user.roles.map(role => role.name),
                    mustChangePassword: user.mustChangePassword,
                },
            });
        }

        const menuItems = await MenuItem.find()
            .populate({
                path: 'children',
                populate: { path: 'children' },
            })
            .sort({ order: 1 });

        const filterMenuItems = (items, userRoles) => {
            return items
                .filter(item => {
                    let roles;
                    try {
                        roles = Array.isArray(item.roles) ? item.roles : JSON.parse(item.roles || '[]');
                        while (typeof roles === 'string') {
                            roles = JSON.parse(roles);
                        }
                        const hasPermission = roles.some(role => userRoles.includes(role));
                        if (hasPermission) {
                            logger.info(`Role match found for menu item: ${item.label}`, { roles: item.roles, userRoles });
                        }
                        return hasPermission;
                    } catch (err) {
                        logger.warn('Failed to parse roles', { roles: item.roles, error: err.message });
                        return false;
                    }
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
                        _id: item._id.toString(),
                    };
                    if (item.children && item.children.length > 0) {
                        filteredItem.children = filterMenuItems(item.children, userRoles);
                    }
                    return filteredItem;
                })
                .filter(item => item.children ? item.children.length > 0 : true);
        };

        const userRoles = user.roles.map(role => role.name);
        const filteredMenuItems = filterMenuItems(menuItems, userRoles);
        req.session.menuItems = filteredMenuItems;

        const payload = {
            user: {
                id: user._id,
                roles: userRoles,
            },
        };

        const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '5h' });

        res.json({
            code: 200,
            msg: '登入成功',
            token,
            user: {
                id: user._id,
                character_name: user.character_name,
                roles: userRoles,
                mustChangePassword: user.mustChangePassword,
            },
        });
    } catch (err) {
        logger.error('Login error:', err);
        res.status(500).json({
            code: 500,
            msg: '登入失敗，請稍後再試',
            detail: err.message,
        });
    }
});

// 查詢可疑登入記錄（管理員專用）
router.get('/suspicious-logins', auth, adminOnly, async (req, res) => {
    try {
        const fortyFiveDaysAgo = new Date(Date.now() - 45 * 24 * 60 * 60 * 1000);

        const suspiciousLogins = await LoginRecord.aggregate([
            {
                $match: {
                    loginTime: { $gte: fortyFiveDaysAgo },
                },
            },
            {
                $lookup: {
                    from: 'users',
                    localField: 'userId',
                    foreignField: '_id',
                    as: 'user',
                },
            },
            {
                $unwind: '$user',
            },
            {
                $match: {
                    'user.status': { $ne: 'disabled' },
                },
            },
            {
                $group: {
                    _id: '$ipAddress',
                    userIds: { $addToSet: '$userId' },
                    characterNames: { $addToSet: '$characterName' },
                    loginRecords: {
                        $push: {
                            characterName: '$characterName',
                            loginTime: '$loginTime',
                            userAgent: '$userAgent',
                        },
                    },
                },
            },
            {
                $match: {
                    $expr: { $gt: [{ $size: '$userIds' }, 1] },
                },
            },
            {
                $project: {
                    ipAddress: '$_id',
                    userCount: { $size: '$userIds' },
                    characterNames: 1,
                    loginRecords: 1,
                    _id: 0,
                },
            },
            {
                $sort: { userCount: -1 },
            },
        ]);

        res.json(suspiciousLogins);
    } catch (err) {
        logger.error('Error fetching suspicious logins:', err.message);
        res.status(500).json({
            code: 500,
            msg: '獲取可疑登入記錄失敗',
            detail: err.message,
        });
    }
});

// 登出路由
router.post('/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            console.error('Session destroy error:', err);
            return res.status(500).json({ msg: '登出失敗' });
        }
        res.clearCookie('connect.sid');
        res.json({ msg: '登出成功' });
    });
});

module.exports = router;