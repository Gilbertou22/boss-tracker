const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Guild = require('../models/Guild');
const Role = require('../models/Role');
const BossKill = require('../models/BossKill');
const Auction = require('../models/Auction');
const Bid = require('../models/Bid');
const Profession = require('../models/Profession');
const multer = require('multer');
const bcrypt = require('bcryptjs');
const path = require('path');
const jsonwebtoken = require('jsonwebtoken');
const { auth, adminOnly } = require('../middleware/auth');
const logger = require('../logger');

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, '../uploads');
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        cb(null, `${Date.now()}-${file.originalname}`);
    },
});
const upload = multer({
    storage,
    limits: { fileSize: 600 * 1024 },
    fileFilter: (req, file, cb) => {
        const filetypes = /jpeg|jpg|png/;
        const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = filetypes.test(file.mimetype);
        if (extname && mimetype) {
            return cb(null, true);
        }
        cb(new Error('僅支援 JPEG/PNG 圖片！'));
    },
});

router.use((req, res, next) => {
    logger.info(`Incoming request: ${req.method} ${req.originalUrl}`);
    next();
});

// 獲取用戶統計數據（總用戶數和活躍用戶數，管理員專用）
router.get('/stats', auth, async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ code: 401, msg: '未授權，缺少用戶信息' });
        }
        if (!req.user.roles.includes('admin')) {
            return res.status(403).json({ code: 403, msg: '無權限訪問' });
        }
        const totalUsers = await User.countDocuments();
        const activeUsers = await User.countDocuments({ status: { $in: ['active', 'pending'] } });
        res.json({ totalUsers, activeUsers });
    } catch (err) {
        logger.error('Error fetching user stats:', err.message);
        res.status(500).json({ code: 500, msg: '獲取用戶統計失敗' });
    }
});

// 獲取用戶個人統計數據（參與擊殺次數和拍賣成功次數）
router.get('/personal-stats', auth, async (req, res) => {
    try {
        const user = req.user;
        if (!user || !user.character_name) {
            return res.status(401).json({
                code: 401,
                msg: '無法識別用戶身份',
                detail: '請確保已正確登錄並提供有效的 Token。',
            });
        }

        const participationCount = await BossKill.countDocuments({
            attendees: { $regex: `^${user.character_name}$`, $options: 'i' },
        });

        const auctionSuccessCount = await Auction.countDocuments({
            highestBidder: user.id,
            status: 'closed',
        });

        res.json({
            participationCount,
            auctionSuccessCount,
        });
    } catch (err) {
        logger.error('Error fetching personal stats:', {
            userId: req.user?.id,
            error: err.message,
            stack: err.stack,
        });
        res.status(500).json({
            code: 500,
            msg: '獲取個人統計數據失敗',
            detail: err.message || '伺服器處理錯誤',
            suggestion: '請稍後重試或聯繫管理員。',
        });
    }
});

// 註冊新用戶
router.post('/register', upload.single('screenshot'), async (req, res) => {
    let { world_name, character_name, discord_id, raid_level, password, guildId, profession, roles, combatPower } = req.body;

    try {
        // 驗證必填字段
        if (!world_name || !character_name || !password || !profession) {
            return res.status(400).json({
                code: 400,
                msg: '缺少必填字段',
                detail: `請提供所有必填字段：world_name=${world_name}, character_name=${character_name}, password=${password}, profession=${profession}`,
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

        // 驗證 profession 是否存在
        const professionExists = await Profession.findById(profession);
        if (!professionExists) {
            return res.status(400).json({
                msg: '無效的職業',
                detail: `無法找到 ID 為 ${profession} 的職業`,
            });
        }

        // 處理 roles 字段
        if (roles) {
            try {
                roles = JSON.parse(roles);
                if (!Array.isArray(roles)) {
                    return res.status(400).json({
                        code: 400,
                        msg: '角色格式錯誤',
                        detail: 'roles 必須是一個陣列',
                    });
                }

                for (const roleId of roles) {
                    const roleExists = await Role.findById(roleId);
                    if (!roleExists) {
                        return res.status(400).json({
                            code: 400,
                            msg: '無效的角色',
                            detail: `無法找到 ID 為 ${roleId} 的角色`,
                        });
                    }
                }
            } catch (err) {
                return res.status(400).json({
                    code: 400,
                    msg: '角色格式錯誤',
                    detail: '無法解析 roles 字段',
                });
            }
        } else {
            const userRole = await Role.findOne({ name: 'user' });
            if (!userRole) {
                return res.status(500).json({
                    code: 500,
                    msg: '伺服器錯誤',
                    detail: '無法找到 user 角色',
                });
            }
            roles = [userRole._id];
        }

        const screenshot = req.file ? req.file.path : null;

        user = new User({
            world_name,
            character_name,
            discord_id: discord_id || null,
            raid_level: raid_level ? parseInt(raid_level) : 0,
            password,
            screenshot,
            status: 'pending',
            guildId: guildId || null,
            mustChangePassword: false,
            roles,
            profession: profession || null,
            combatPower: combatPower ? parseInt(combatPower) : 0,
        });

        await user.save();

        const payload = {
            user: {
                id: user._id,
                roles: user.roles,
            },
        };

        jsonwebtoken.sign(payload, process.env.JWT_SECRET, { expiresIn: 3600 }, (err, token) => {
            if (err) throw err;
            res.json({
                token,
                user: {
                    id: user._id,
                    character_name: user.character_name,
                    roles: user.roles,
                    mustChangePassword: user.mustChangePassword,
                },
                msg: '註冊成功！',
            });
        });
    } catch (err) {
        logger.error('Register error:', err.message);
        res.status(500).json({ msg: '伺服器錯誤: ' + err.message });
    }
});

// 獲取所有用戶列表（允許同旅團成員訪問）
router.get('/', auth, async (req, res) => {
    try {
        const currentUser = req.user;
        const currentUserData = await User.findById(currentUser.id).populate('guildId');
        let query = currentUser.roles.includes('admin') ? {} : { guildId: currentUserData.guildId };

        // 支持 hasDiscordId 過濾
        if (req.query.hasDiscordId === 'true') {
            query.discord_id = { $exists: true, $ne: null };
        }

        if (req.query.guildId) {
            if (currentUser.roles.includes('admin') || req.query.guildId === currentUserData.guildId?.toString()) {
                query.guildId = req.query.guildId;
            } else {
                return res.status(403).json({ msg: '無權訪問其他旅團用戶' });
            }
        }

        // 支持 keyword 搜索（character_name 或 discord_id）
        if (req.query.keyword) {
            query.$or = [
                { character_name: { $regex: req.query.keyword, $options: 'i' } },
                { discord_id: { $regex: req.query.keyword, $options: 'i' } }
            ];
        }

        // 支持 status 過濾
        if (req.query.status) {
            query.status = req.query.status;
        }

        // 分頁
        const page = parseInt(req.query.page) || 1;
        const pageSize = parseInt(req.query.pageSize) || 10;
        const skip = (page - 1) * pageSize;

        // 排序
        let sortObj = {};
        if (req.query.sortBy) {
            sortObj[req.query.sortBy] = req.query.sortOrder === 'desc' ? -1 : 1;
        } else {
            sortObj.createdAt = -1; // 預設降序
        }

        const total = await User.countDocuments(query);

        const users = await User.find(query)
            .populate('guildId', 'name')
            .populate('profession', 'name icon')
            .populate('roles', 'name')
            .select('world_name character_name discord_id raid_level diamonds status screenshot roles guildId mustChangePassword profession createdAt updatedAt combatPower')
            .sort(sortObj)
            .skip(skip)
            .limit(pageSize);

        res.json({
            data: users,
            pagination: {
                current: page,
                pageSize,
                total
            }
        });
    } catch (err) {
        logger.error('Error fetching users:', err.message);
        res.status(500).json({ msg: '獲取用戶列表失敗', error: err.message });
    }
});

// 獲取用戶個人資料
router.get('/profile', auth, async (req, res) => {
    try {
        if (!req.user || !req.user.id) {
            return res.status(401).json({ msg: '無效的用戶身份' });
        }
        const user = await User.findById(req.user.id)
            .populate('profession', 'name icon')
            .populate('roles', 'name')
            .select('character_name world_name discord_id raid_level diamonds status screenshot roles guildId mustChangePassword profession combatPower');
        if (!user) {
            return res.status(404).json({ msg: '用戶不存在' });
        }
        res.json(user);
    } catch (err) {
        logger.error('Error fetching user:', err.message);
        res.status(500).json({ msg: '伺服器錯誤，請稍後重試' });
    }
});

// 更新用戶個人資料
router.put('/profile', auth, async (req, res) => {
    const { world_name, discord_id, raid_level, guildId, profession, combatPower } = req.body;
    try {
        if (!req.user || !req.user.id) {
            return res.status(401).json({ msg: '無效的用戶身份' });
        }
        const user = await User.findById(req.user.id);
        if (!user) return res.status(404).json({ msg: '用戶未找到' });

        user.world_name = world_name || user.world_name;
        user.discord_id = discord_id || user.discord_id;
        user.raid_level = raid_level !== undefined ? parseInt(raid_level) : user.raid_level;
        user.guildId = guildId || user.guildId;
        user.profession = profession !== undefined ? profession : user.profession;
        user.combatPower = combatPower !== undefined ? parseInt(combatPower) : user.combatPower;

        await user.save();
        res.json({ msg: '用戶資料更新成功' });
    } catch (err) {
        logger.error('Update error:', err.message);
        res.status(500).json({ msg: '更新失敗', error: err.message });
    }
});

// 將用戶設為 DISABLED 狀態（管理員專用）
router.put('/:id/disable', auth, adminOnly, async (req, res) => {
    logger.info(`PUT /api/users/:id/disable called with id: ${req.params.id}, user: ${req.user?.id}`);
    try {
        const user = await User.findById(req.params.id);
        if (!user) {
            logger.warn(`User not found for ID: ${req.params.id}`);
            return res.status(404).json({ msg: '用戶不存在', detail: `ID ${req.params.id} 未找到` });
        }
        if (user.roles.includes('admin') || user.roles.includes('guild')) {
            return res.status(403).json({ msg: `無法禁用角色為 admin 或 guild 的帳號` });
        }
        user.status = 'disabled';
        await user.save();
        logger.info(`User disabled successfully: ${req.params.id}`);
        res.json({ msg: '用戶已設為 DISABLED 狀態' });
    } catch (err) {
        logger.error('Disable user error:', err.message);
        res.status(500).json({ msg: '設為 DISABLED 失敗', error: err.message });
    }
});

// 批量將用戶設為 DISABLED 狀態（管理員專用）
router.put('/batch-disable', auth, adminOnly, async (req, res) => {
    const { ids } = req.body;
    logger.info(`PUT /api/users/batch-disable called with ids: ${ids}, user: ${req.user?.id}`);
    try {
        if (!Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ msg: '請提供有效的用戶 ID 列表' });
        }
        const users = await User.find({ _id: { $in: ids } });
        const protectedUsers = users.filter(user => user.roles.includes('admin') || user.roles.includes('guild'));
        if (protectedUsers.length > 0) {
            const protectedRoles = [...new Set(protectedUsers.map(user => user.roles).flat())].join(', ');
            return res.status(403).json({ msg: `無法禁用角色為 ${protectedRoles} 的帳號` });
        }
        await User.updateMany({ _id: { $in: ids } }, { $set: { status: 'disabled' } });
        logger.info(`Users batch disabled successfully: ${ids}`);
        res.json({ msg: '批量設為 DISABLED 成功' });
    } catch (err) {
        logger.error('Batch disable error:', err.message);
        res.status(500).json({ msg: '批量設為 DISABLED 失敗', error: err.message });
    }
});

// 更新用戶（管理員專用）
router.put('/:id', auth, adminOnly, upload.single('screenshot'), async (req, res) => {
    let { world_name, character_name, discord_id, raid_level, diamonds, status, roles, password, guildId, mustChangePassword, profession, combatPower } = req.body;

    try {
        const user = await User.findById(req.params.id);
        if (!user) {
            logger.warn(`User not found for ID: ${req.params.id}`);
            return res.status(404).json({ msg: '用戶不存在', detail: `ID ${req.params.id} 未找到` });
        }

        if (character_name && character_name !== user.character_name) {
            const existingUser = await User.findOne({ character_name });
            if (existingUser) return res.status(400).json({ msg: '角色名稱已存在' });
        }

        if (roles) {
            try {
                roles = JSON.parse(roles);
                if (!Array.isArray(roles)) {
                    return res.status(400).json({
                        code: 400,
                        msg: '角色格式錯誤',
                        detail: 'roles 必須是一個陣列',
                    });
                }

                for (const roleId of roles) {
                    const roleExists = await Role.findById(roleId);
                    if (!roleExists) {
                        return res.status(400).json({
                            code: 400,
                            msg: '無效的角色',
                            detail: `無法找到 ID 為 ${roleId} 的角色`,
                        });
                    }
                }
            } catch (err) {
                return res.status(400).json({
                    code: 400,
                    msg: '角色格式錯誤',
                    detail: '無法解析 roles 字段',
                });
            }
        }

        user.world_name = world_name || user.world_name;
        user.character_name = character_name || user.character_name;
        user.discord_id = discord_id || user.discord_id;
        user.raid_level = raid_level !== undefined ? parseInt(raid_level) : user.raid_level;
        user.diamonds = diamonds !== undefined ? parseInt(diamonds) : user.diamonds;
        user.status = status || user.status;
        user.screenshot = req.file ? req.file.path : user.screenshot;
        user.roles = roles || user.roles;
        user.guildId = guildId || user.guildId;
        user.profession = profession !== undefined ? profession : user.profession;
        user.combatPower = combatPower !== undefined ? parseInt(combatPower) : user.combatPower;
        if (password) {
            const salt = await bcrypt.genSalt(10);
            user.password = await bcrypt.hash(password, salt);
        }
        user.mustChangePassword = mustChangePassword !== undefined ? mustChangePassword : user.mustChangePassword;
        await user.save();
        logger.info(`User updated successfully: ${req.params.id}`);
        res.json({ msg: '用戶更新成功', user });
    } catch (err) {
        logger.error('Update user error:', err.message);
        res.status(500).json({ msg: '更新用戶失敗', error: err.message });
    }
});

// 獲取當前用戶信息
router.get('/me', auth, async (req, res) => {
    try {
        if (!req.user || !req.user.id) {
            return res.status(401).json({ msg: '無效的用戶身份' });
        }
        const user = await User.findById(req.user.id)
            .populate('profession', 'name icon')
            .populate('roles', 'name')
            .select('character_name world_name discord_id raid_level diamonds status screenshot roles _id guildId mustChangePassword profession combatPower');
        if (!user) {
            return res.status(404).json({ msg: '用戶不存在' });
        }
        if (user.status === 'disabled') {
            return res.status(403).json({ msg: '帳號已被禁用，請聯繫管理員' });
        }
        res.json({
            id: user._id.toString(),
            character_name: user.character_name,
            roles: user.roles.map(role => role.name),
            world_name: user.world_name,
            discord_id: user.discord_id,
            raid_level: user.raid_level,
            diamonds: user.diamonds,
            status: user.status,
            screenshot: user.screenshot ? `${req.protocol}://${req.get('host')}/${user.screenshot.replace('./', '')}` : null,
            guildId: user.guildId,
            mustChangePassword: user.mustChangePassword,
            profession: user.profession,
            combatPower: user.combatPower,
        });
    } catch (err) {
        logger.error('Error fetching user:', err.message);
        res.status(500).json({ msg: '伺服器錯誤，請稍後重試', error: err.message });
    }
});

// 獲取用戶增長趨勢（管理員專用）
router.get('/growth', auth, async (req, res) => {
    try {
        if (!req.user.roles.includes('admin')) {
            return res.status(403).json({ code: 403, msg: '無權限訪問' });
        }
        const { range = 30 } = req.query;
        const now = new Date();
        const startDate = new Date(now.getTime() - range * 24 * 60 * 60 * 1000);
        const growthData = await User.aggregate([
            {
                $match: {
                    createdAt: { $gte: startDate, $lte: now },
                    status: { $in: ['active', 'pending'] },
                },
            },
            {
                $group: {
                    _id: {
                        $dateToString: { format: '%Y-%m-%d', date: '$createdAt' },
                    },
                    count: { $sum: 1 },
                },
            },
            { $sort: { _id: 1 } },
        ]);
        res.json(growthData);
    } catch (err) {
        logger.error('Error fetching user growth:', err.message);
        res.status(500).json({ code: 500, msg: '獲取用戶增長數據失敗' });
    }
});

// 創建新成員（管理員專用）
router.post('/create-member', auth, adminOnly, upload.none(), async (req, res) => {
    let { character_name, password, guildId, useGuildPassword, world_name, profession, roles, combatPower } = req.body;

    try {
        if (!character_name || !guildId) {
            return res.status(400).json({
                code: 400,
                msg: '缺少必填字段',
                detail: `請提供 character_name 和 guildId，當前值: character_name=${character_name}, guildId=${guildId}`,
            });
        }

        if (!world_name) {
            return res.status(400).json({
                code: 400,
                msg: '缺少必填字段',
                detail: '請提供 world_name',
            });
        }

        const guild = await Guild.findById(guildId);
        if (!guild) {
            return res.status(400).json({
                code: 400,
                msg: '團隊不存在',
                detail: `無法找到 ID 為 ${guildId} 的團隊`,
            });
        }

        const existingUser = await User.findOne({ character_name });
        if (existingUser) {
            return res.status(400).json({
                code: 400,
                msg: '用戶名已存在',
                detail: '請選擇其他用戶名',
            });
        }

        let finalPassword = password;
        const useGuildPasswordValue = Array.isArray(useGuildPassword) ? useGuildPassword[0] : useGuildPassword;
        if (useGuildPasswordValue === 'true') {
            if (!guild.password) {
                return res.status(400).json({
                    code: 400,
                    msg: '旅團密碼不可用',
                    detail: '選中的旅團未設置密碼',
                });
            }
            finalPassword = guild.password;
        } else if (!password) {
            return res.status(400).json({
                code: 400,
                msg: '缺少密碼',
                detail: '請提供密碼或選擇使用旅團密碼',
            });
        }

        if (roles) {
            try {
                roles = JSON.parse(roles);
                if (!Array.isArray(roles)) {
                    return res.status(400).json({
                        code: 400,
                        msg: '角色格式錯誤',
                        detail: 'roles 必須是一個陣列',
                    });
                }

                for (const roleId of roles) {
                    const roleExists = await Role.findById(roleId);
                    if (!roleExists) {
                        return res.status(400).json({
                            code: 400,
                            msg: '無效的角色',
                            detail: `無法找到 ID 為 ${roleId} 的角色`,
                        });
                    }
                }
            } catch (err) {
                return res.status(400).json({
                    code: 400,
                    msg: '角色格式錯誤',
                    detail: '無法解析 roles 字段',
                });
            }
        } else {
            const userRole = await Role.findOne({ name: 'user' });
            if (!userRole) {
                return res.status(500).json({
                    code: 500,
                    msg: '伺服器錯誤',
                    detail: '無法找到 user 角色',
                });
            }
            roles = [userRole._id];
        }

        logger.info('Final password:', finalPassword);

        const user = new User({
            world_name,
            character_name,
            password: finalPassword,
            roles,
            guildId,
            mustChangePassword: true,
            status: 'pending',
            profession: profession || null,
            combatPower: combatPower ? parseInt(combatPower) : 0,
        });

        await user.save();

        res.status(201).json({
            code: 201,
            msg: '成員創建成功',
            user: {
                character_name: user.character_name,
                guildId: user.guildId,
                mustChangePassword: user.mustChangePassword,
                profession: user.profession,
                roles: user.roles,
            },
        });
    } catch (err) {
        logger.error('Create member error:', err.message);
        res.status(500).json({
            code: 500,
            msg: '創建成員失敗',
            detail: err.message,
        });
    }
});

// 更改密碼
router.post('/change-password', auth, async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user.id;

    try {
        if (!newPassword) {
            return res.status(400).json({
                code: 400,
                msg: '缺少必填字段',
                detail: '請提供新密碼',
            });
        }

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({
                code: 404,
                msg: '用戶不存在',
                detail: '請檢查用戶是否有效',
            });
        }

        if (!user.mustChangePassword) {
            if (!currentPassword) {
                return res.status(400).json({
                    code: 400,
                    msg: '缺少當前密碼',
                    detail: '請提供當前密碼',
                });
            }
            const isMatch = await bcrypt.compare(currentPassword, user.password);
            if (!isMatch) {
                return res.status(400).json({
                    code: 400,
                    msg: '當前密碼錯誤',
                    detail: '請檢查輸入的當前密碼',
                });
            }
        }

        user.password = newPassword;
        user.mustChangePassword = false;
        await user.save();

        res.json({
            code: 200,
            msg: '密碼更改成功',
            detail: '您已成功更改密碼，請使用新密碼登入',
        });
    } catch (err) {
        logger.error('Change password error:', err.message);
        res.status(500).json({
            code: 500,
            msg: '更改密碼失敗',
            detail: err.message,
        });
    }
});

router.get('/:character_name/records', auth, async (req, res) => {
    try {
        const character_name = decodeURIComponent(req.params.character_name);
        logger.info(`Fetching records for user: ${character_name}`);

        const user = await User.findOne({ character_name });
        if (!user) {
            logger.warn(`User not found: ${character_name}`);
            return res.status(404).json({ msg: '用戶不存在' });
        }

        const currentUserRoles = req.user.roles || [];
        if (!currentUserRoles.includes('admin') && req.user.character_name !== character_name) {
            logger.warn(`Unauthorized access attempt by user ${req.user.character_name} to records of ${character_name}`);
            return res.status(403).json({ msg: '無權查詢其他用戶的記錄' });
        }

        const { tab = '1', page = 1, pageSize = 10, itemName, guildMember, startTime, endTime } = req.query;
        const skip = (parseInt(page) - 1) * parseInt(pageSize);
        const limit = parseInt(pageSize);

        let killRecords = [];
        let acquiredItems = [];
        let biddingHistory = [];
        let wonAuctions = [];
        const pagination = {
            killRecords: { current: parseInt(page), pageSize: limit, total: 0 },
            acquiredItems: { current: parseInt(page), pageSize: limit, total: 0 },
            biddingHistory: { current: parseInt(page), pageSize: limit, total: 0 },
            wonAuctions: { current: parseInt(page), pageSize: limit, total: 0 },
        };

        const targetCharacter = guildMember || character_name;

        const targetUser = await User.findOne({ character_name: targetCharacter });
        if (!targetUser) {
            logger.warn(`Target user not found: ${targetCharacter}`);
            return res.status(404).json({ msg: `目標用戶 ${targetCharacter} 不存在` });
        }

        const query = { attendees: targetCharacter };
        if (itemName) {
            query['dropped_items.name'] = itemName;
        }
        if (startTime) {
            query.kill_time = { $gte: new Date(startTime) };
        }
        if (endTime) {
            query.kill_time = { ...query.kill_time, $lte: new Date(endTime) };
        }

        if (tab === '1' || tab === 'all') {
            const totalKillRecords = await BossKill.countDocuments(query);
            killRecords = await BossKill.find(query)
                .populate('bossId', 'name')
                .populate('dropped_items.level')
                .skip(skip)
                .limit(limit)
                .lean();

            pagination.killRecords.total = totalKillRecords;
        }

        if (tab === '2' || tab === 'all') {
            let allKillRecords = await BossKill.find(query)
                .populate('bossId', 'name')
                .populate('dropped_items.level')
                .lean();

            acquiredItems = [];
            allKillRecords.forEach(record => {
                record.dropped_items.forEach(item => {
                    if (item.final_recipient === targetCharacter) {
                        acquiredItems.push({
                            itemName: item.name,
                            acquiredAt: record.kill_time,
                            bossName: record.bossId?.name || '未知首領',
                            recipient: item.final_recipient,
                        });
                    }
                });
            });

            pagination.acquiredItems.total = acquiredItems.length;
            acquiredItems = acquiredItems.slice(skip, skip + limit);
        }

        if (tab === '3' || tab === 'all') {
            const auctionQuery = {
                $or: [
                    { highestBidder: targetUser._id },
                    { highestBidder: { $exists: false } },
                ],
                ...(itemName ? { itemName } : {}),
            };
            if (startTime) {
                auctionQuery.updatedAt = { $gte: new Date(startTime) };
            }
            if (endTime) {
                auctionQuery.updatedAt = { ...auctionQuery.updatedAt, $lte: new Date(endTime) };
            }

            const totalAuctions = await Auction.countDocuments(auctionQuery);

            const auctionRecords = await Auction.find(auctionQuery)
                .skip(skip)
                .limit(limit)
                .populate('itemId', 'name')
                .lean();

            biddingHistory = await Promise.all(auctionRecords.map(async auction => {
                const bids = await Bid.find({ auctionId: auction._id, userId: targetUser._id }).lean();
                return {
                    itemName: auction.itemId?.name || '未知物品',
                    highestBid: auction.currentPrice || 0,
                    userBids: bids.map(bid => ({
                        amount: bid.amount,
                        time: bid.timestamp,
                    })),
                    status: auction.status || 'unknown',
                    won: auction.highestBidder?.toString() === targetUser._id.toString(),
                    endTime: auction.endTime,
                };
            }));

            pagination.biddingHistory.total = totalAuctions;
        }

        if (tab === '4' || tab === 'all') {
            const auctionQuery = {
                highestBidder: targetUser._id,
                status: 'settled',
            };
            if (itemName) {
                auctionQuery.itemName = itemName;
            }
            if (startTime) {
                auctionQuery.updatedAt = { $gte: new Date(startTime) };
            }
            if (endTime) {
                auctionQuery.updatedAt = { ...auctionQuery.updatedAt, $lte: new Date(endTime) };
            }

            const totalWonAuctions = await Auction.countDocuments(auctionQuery);
            wonAuctions = await Auction.find(auctionQuery)
                .populate('itemId', 'name')
                .skip(skip)
                .limit(limit)
                .lean()
                .then(auctions => auctions.map(auction => ({
                    itemName: auction.itemId?.name || '未知物品',
                    wonAt: auction.updatedAt,
                    finalPrice: auction.currentPrice,
                })));

            pagination.wonAuctions.total = totalWonAuctions;
        }

        res.json({
            killRecords,
            acquiredItems,
            biddingHistory,
            wonAuctions,
            pagination,
        });
    } catch (err) {
        logger.error('Error fetching user records:', err.message);
        res.status(500).json({ msg: '伺服器錯誤', error: err.message });
    }
});

// 新路由：查詢某個物品的獲得者記錄
router.get('/:character_name/item-recipients', auth, async (req, res) => {
    try {
        const character_name = decodeURIComponent(req.params.character_name);
        const { itemName, page = 1, pageSize = 10, startTime, endTime } = req.query;

        if (!itemName) {
            return res.status(400).json({ msg: '請提供物品名稱' });
        }

        logger.info(`Fetching item recipients for item: ${itemName}`);

        const user = await User.findOne({ character_name });
        if (!user) {
            logger.warn(`User not found: ${character_name}`);
            return res.status(404).json({ msg: '用戶不存在' });
        }

        const currentUserRoles = req.user.roles || [];
        if (!currentUserRoles.includes('admin') && req.user.character_name !== character_name) {
            logger.warn(`Unauthorized access attempt by user ${req.user.character_name} to records of ${character_name}`);
            return res.status(403).json({ msg: '無權查詢其他用戶的記錄' });
        }

        const skip = (parseInt(page) - 1) * parseInt(pageSize);
        const limit = parseInt(pageSize);

        const query = {
            'dropped_items.name': itemName,
            'dropped_items.final_recipient': { $ne: null },
        };
        if (startTime) {
            query.kill_time = { $gte: new Date(startTime) };
        }
        if (endTime) {
            query.kill_time = { ...query.kill_time, $lte: new Date(endTime) };
        }

        const totalRecipients = await BossKill.countDocuments(query);
        const killRecords = await BossKill.find(query)
            .populate('bossId', 'name')
            .populate('dropped_items.level')
            .skip(skip)
            .limit(limit)
            .lean();

        const itemRecipients = [];
        killRecords.forEach(record => {
            record.dropped_items.forEach(item => {
                if (item.name === itemName && item.final_recipient) {
                    itemRecipients.push({
                        itemName: item.name,
                        acquiredAt: record.kill_time,
                        bossName: record.bossId?.name || '未知首領',
                        recipient: item.final_recipient,
                    });
                }
            });
        });

        res.json({
            itemRecipients,
            pagination: {
                current: parseInt(page),
                pageSize: limit,
                total: totalRecipients,
            },
        });
    } catch (err) {
        logger.error('Error fetching item recipients:', err.message);
        res.status(500).json({ msg: '伺服器錯誤', error: err.message });
    }
});

module.exports = router;