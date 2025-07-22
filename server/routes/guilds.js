const express = require('express');
const router = express.Router();
const Guild = require('../models/Guild');
const User = require('../models/User');
const { auth } = require('../middleware/auth');
const crypto = require('crypto');

// 生成隨機團隊密碼
const generateGuildPassword = () => {
    return crypto.randomBytes(8).toString('hex');
};

// 預設旅團設定
const defaultGuildSettings = {
    settings: {
        applyDeadlineHours: 48,
        editDeadlineHours: 24,
        deleteDeadlineHours: 24,
        publicFundRate: 0.1,
        creatorExtraShare: false,
        leaderExtraShare: false,
        restrictBilling: false,
        withdrawMinAmount: 100,
    },
};

router.get('/me', auth, async (req, res) => {
    try {
        const guild = await Guild.findOne({ createdBy: req.user.id }).lean();
        if (!guild) {
            return res.status(404).json({
                code: 404,
                msg: '您尚未創建旅團',
                detail: '請先創建旅團',
            });
        }
        res.json(guild);
    } catch (err) {
        res.status(500).json({
            code: 500,
            msg: '獲取旅團資訊失敗',
            detail: err.message,
        });
    }
});

router.get('/', auth, async (req, res) => {
    try {
        const guilds = await Guild.find().select('name _id').lean();
        res.json(guilds);
    } catch (err) {
        res.status(500).json({
            code: 500,
            msg: '獲取旅團列表失敗',
            detail: err.message,
        });
    }
});

// 創建團隊
router.post('/', auth, async (req, res) => {
    const { name } = req.body;
    try {
        const existingGuild = await Guild.findOne({ name });
        if (existingGuild) {
            return res.status(400).json({
                code: 400,
                msg: '團隊名稱已存在',
            });
        }
        const guild = new Guild({
            name,
            password: generateGuildPassword(),
            createdBy: req.user.id,
        });
        await guild.save();
        res.status(201).json({
            code: 201,
            msg: '團隊創建成功',
            guild,
        });
    } catch (err) {
        res.status(500).json({
            code: 500,
            msg: '創建團隊失敗',
            detail: err.message,
        });
    }
});

// 獲取團隊設定
router.get('/:id', auth, async (req, res) => {
    try {
        const guild = await Guild.findById(req.params.id);
        if (!guild) {
            return res.status(404).json({
                code: 404,
                msg: '團隊不存在',
                detail: `無法找到 ID 為 ${req.params.id} 的旅團`,
            });
        }
        // 檢查權限：僅創建者或管理員可訪問
        const user = await User.findById(req.user.id);
        if (user.role !== 'admin' && guild.createdBy.toString() !== req.user.id) {
            return res.status(403).json({
                code: 403,
                msg: '無權限訪問',
                detail: '僅旅團創建者或管理員可查看此旅團信息',
            });
        }
        res.json(guild);
    } catch (err) {
        res.status(500).json({
            code: 500,
            msg: '獲取團隊設定失敗',
            detail: err.message,
        });
    }
});

// 更新團隊設定
router.put('/:id', auth, async (req, res) => {
    const { password, announcement, settings } = req.body;
    try {
        const guild = await Guild.findById(req.params.id);
        if (!guild) {
            return res.status(404).json({
                code: 404,
                msg: '團隊不存在',
                detail: `無法找到 ID 為 ${req.params.id} 的旅團`,
            });
        }
        // 檢查權限：僅創建者或管理員可修改
        const user = await User.findById(req.user.id);
        if (user.role !== 'admin' && guild.createdBy.toString() !== req.user.id) {
            return res.status(403).json({
                code: 403,
                msg: '無權限修改',
                detail: '僅旅團創建者或管理員可修改此旅團設定',
            });
        }
        // 更新字段
        if (password) guild.password = password;
        if (announcement !== undefined) guild.announcement = announcement;
        if (settings) {
            guild.settings.applyDeadlineHours = settings.applyDeadlineHours || guild.settings.applyDeadlineHours;
            guild.settings.editDeadlineHours = settings.editDeadlineHours || guild.settings.editDeadlineHours;
            guild.settings.deleteDeadlineHours = settings.deleteDeadlineHours || guild.settings.deleteDeadlineHours;
            guild.settings.publicFundRate = settings.publicFundRate || guild.settings.publicFundRate;
            guild.settings.creatorExtraShare = settings.creatorExtraShare !== undefined ? settings.creatorExtraShare : guild.settings.creatorExtraShare;
            guild.settings.leaderExtraShare = settings.leaderExtraShare !== undefined ? settings.leaderExtraShare : guild.settings.leaderExtraShare;
            guild.settings.restrictBilling = settings.restrictBilling !== undefined ? settings.restrictBilling : guild.settings.restrictBilling;
            guild.settings.withdrawMinAmount = settings.withdrawMinAmount || guild.settings.withdrawMinAmount;
        }
        guild.updatedAt = new Date();
        await guild.save();
        res.json({
            code: 200,
            msg: '團隊設定更新成功',
            detail: `旅團 ${guild.name} 的設定已更新`,
        });
    } catch (err) {
        console.error('Update guild error:', err);
        res.status(500).json({
            code: 500,
            msg: '更新團隊設定失敗',
            detail: err.message,
        });
    }
});

module.exports = router;