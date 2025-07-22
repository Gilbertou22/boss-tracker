// routes/boss-dkp-settings.js
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const BossDKPSetting = require('../models/BossDKPSetting');
const Boss = require('../models/Boss');
const BossKill = require('../models/BossKill');
const DKPRecord = require('../models/DKPRecord');
const User = require('../models/User');
const WalletTransaction = require('../models/WalletTransaction');
const { auth, adminOnly } = require('../middleware/auth');

// 更具體的路由放在前面
router.get('/stats', auth, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ msg: '用戶不存在' });
        }
        res.json({ dkpPoints: user.dkpPoints || 0 });
    } catch (err) {
        console.error('Error fetching DKP stats:', err);
        res.status(500).json({
            code: 500,
            msg: '獲取 DKP 統計失敗',
            detail: err.message || '伺服器處理錯誤',
            suggestion: '請稍後重試或聯繫管理員。',
        });
    }
});

router.get('/records', auth, async (req, res) => {
    try {
        const records = await DKPRecord.find({ userId: req.user.id })
            .populate({
                path: 'bossKillId',
                populate: { path: 'bossId' },
            })
            .lean();

        res.json(records);
    } catch (err) {
        console.error('Error fetching DKP records:', err);
        res.status(500).json({
            code: 500,
            msg: '獲取 DKP 記錄失敗',
            detail: err.message || '伺服器處理錯誤',
            suggestion: '請稍後重試或聯繫管理員。',
        });
    }
});

// 獲取所有 DKP 設定（包含 Boss 信息）
router.get('/', auth, async (req, res) => {
    try {
        const settings = await BossDKPSetting.find()
            .populate('bossId', 'name description difficulty')
            .lean();

        res.json(settings);
    } catch (err) {
        console.error('Error fetching DKP settings:', err);
        res.status(500).json({
            code: 500,
            msg: '獲取 DKP 設定失敗',
            detail: err.message || '伺服器處理錯誤',
            suggestion: '請稍後重試或聯繫管理員。',
        });
    }
});

router.post('/bulk', auth, adminOnly, async (req, res) => {
    const settings = req.body;
    try {
        const results = await Promise.all(settings.map(async ({ bossId, dkpPoints }) => {
            const boss = await Boss.findById(bossId);
            if (!boss) throw new Error(`Boss ${bossId} not found`);
            let setting = await BossDKPSetting.findOne({ bossId });
            if (setting) {
                setting.dkpPoints = dkpPoints;
                setting.updatedAt = Date.now();
            } else {
                setting = new BossDKPSetting({ bossId, dkpPoints });
            }
            await setting.save();
            return setting;
        }));
        res.status(201).json({ msg: '批量保存 DKP 設定成功', results });
    } catch (err) {
        res.status(500).json({ msg: '批量保存 DKP 設定失敗', error: err.message });
    }
});

// 獲取單個 DKP 設定（根據 bossId）
router.get('/:bossId', auth, async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.bossId)) {
            return res.status(400).json({
                code: 400,
                msg: '無效的 bossId',
                detail: `bossId "${req.params.bossId}" 不是有效的 ObjectId`,
                suggestion: '請提供有效的 bossId',
            });
        }

        const setting = await BossDKPSetting.findOne({ bossId: req.params.bossId })
            .populate('bossId', 'name description difficulty')
            .lean();

        if (!setting) {
            return res.status(404).json({
                code: 404,
                msg: 'DKP 設定不存在',
                suggestion: '請檢查 bossId 或聯繫管理員',
            });
        }

        res.json(setting);
    } catch (err) {
        console.error('Error fetching DKP setting:', err);
        res.status(500).json({
            code: 500,
            msg: '獲取 DKP 設定失敗',
            detail: err.message || '伺服器處理錯誤',
            suggestion: '請稍後重試或聯繫管理員。',
        });
    }
});

router.post('/', auth, adminOnly, async (req, res) => {
    const { bossId, dkpPoints } = req.body;

    try {
        if (!mongoose.Types.ObjectId.isValid(bossId)) {
            return res.status(400).json({
                code: 400,
                msg: '無效的 bossId',
                detail: `bossId "${bossId}" 不是有效的 ObjectId`,
                suggestion: '請提供有效的 bossId',
            });
        }

        if (typeof dkpPoints !== 'number' || dkpPoints < 0) {
            return res.status(400).json({
                code: 400,
                msg: '請提供有效的 dkpPoints（非負數）',
                suggestion: '檢查輸入數據格式',
            });
        }

        const boss = await Boss.findById(bossId);
        if (!boss) {
            return res.status(404).json({
                code: 404,
                msg: 'Boss 不存在',
                suggestion: '請檢查 bossId 是否正確',
            });
        }

        let setting = await BossDKPSetting.findOne({ bossId });
        if (setting) {
            setting.dkpPoints = dkpPoints;
            setting.updatedAt = Date.now();
        } else {
            setting = new BossDKPSetting({ bossId, dkpPoints });
        }

        await setting.save();
        const populatedSetting = await BossDKPSetting.findById(setting._id)
            .populate('bossId', 'name description difficulty')
            .lean();

        res.status(201).json({
            msg: setting.isNew ? 'DKP 設定創建成功' : 'DKP 設定更新成功',
            setting: populatedSetting,
        });
    } catch (err) {
        console.error('Error saving DKP setting:', err);
        res.status(500).json({
            code: 500,
            msg: '保存 DKP 設定失敗',
            detail: err.message || '伺服器處理錯誤',
            suggestion: '請稍後重試或聯繫管理員。',
        });
    }
});

router.put('/:id', auth, adminOnly, async (req, res) => {
    const { dkpPoints } = req.body;

    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({
                code: 400,
                msg: '無效的設定 ID',
                detail: `設定 ID "${req.params.id}" 不是有效的 ObjectId`,
                suggestion: '請提供有效的設定 ID',
            });
        }

        if (typeof dkpPoints !== 'number' || dkpPoints < 0) {
            return res.status(400).json({
                code: 400,
                msg: '請提供有效的 dkpPoints（非負數）',
                suggestion: '檢查輸入數據格式',
            });
        }

        const setting = await BossDKPSetting.findById(req.params.id);
        if (!setting) {
            return res.status(404).json({
                code: 404,
                msg: 'DKP 設定不存在',
                suggestion: '請檢查 ID 或聯繫管理員',
            });
        }

        setting.dkpPoints = dkpPoints;
        setting.updatedAt = Date.now();
        await setting.save();

        const populatedSetting = await BossDKPSetting.findById(setting._id)
            .populate('bossId', 'name description difficulty')
            .lean();

        res.json({
            msg: 'DKP 設定更新成功',
            setting: populatedSetting,
        });
    } catch (err) {
        console.error('Error updating DKP setting:', err);
        res.status(500).json({
            code: 500,
            msg: '更新 DKP 設定失敗',
            detail: err.message || '伺服器處理錯誤',
            suggestion: '請稍後重試或聯繫管理員。',
        });
    }
});

router.delete('/:id', auth, adminOnly, async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({
                code: 400,
                msg: '無效的設定 ID',
                detail: `設定 ID "${req.params.id}" 不是有效的 ObjectId`,
                suggestion: '請提供有效的設定 ID',
            });
        }

        const setting = await BossDKPSetting.findById(req.params.id);
        if (!setting) {
            return res.status(404).json({
                code: 404,
                msg: 'DKP 設定不存在',
                suggestion: '請檢查 ID 或聯繫管理員',
            });
        }

        await setting.remove();
        res.json({ msg: 'DKP 設定刪除成功' });
    } catch (err) {
        console.error('Error deleting DKP setting:', err);
        res.status(500).json({
            code: 500,
            msg: '刪除 DKP 設定失敗',
            detail: err.message || '伺服器處理錯誤',
            suggestion: '請稍後重試或聯繫管理員。',
        });
    }
});

router.post('/distribute/:killId', auth, adminOnly, async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.killId)) {
            return res.status(400).json({
                code: 400,
                msg: '無效的擊殺記錄 ID',
                detail: `擊殺記錄 ID "${req.params.killId}" 不是有效的 ObjectId`,
                suggestion: '請提供有效的擊殺記錄 ID',
            });
        }

        const bossKill = await BossKill.findById(req.params.killId).populate('bossId');
        if (!bossKill) {
            return res.status(404).json({ msg: '擊殺記錄不存在' });
        }

        if (bossKill.dkpDistributed) {
            return res.status(400).json({ msg: '該擊殺記錄已分配 DKP 點數' });
        }

        const setting = await BossDKPSetting.findOne({ bossId: bossKill.bossId._id });
        if (!setting) {
            return res.status(404).json({ msg: `未找到 ${bossKill.bossId.name} 的 DKP 設定` });
        }

        const dkpPoints = setting.dkpPoints;
        const attendees = bossKill.attendees;

        const dkpRecords = await Promise.all(attendees.map(async attendee => {
            const user = await User.findOne({ character_name: attendee });
            if (!user) {
                console.warn(`User ${attendee} not found for DKP distribution. Skipping.`);
                return null;
            }

            // 檢查是否已存在相同的 DKP 記錄
            const existingRecord = await DKPRecord.findOne({
                userId: user._id,
                bossKillId: bossKill._id,
                description: `參與討伐 ${bossKill.bossId.name}`
            });

            if (existingRecord) {
                console.warn(`Duplicate DKP record found for user ${attendee} and bossKill ${bossKill._id}. Skipping.`);
                return null;
            }

            user.dkpPoints = (user.dkpPoints || 0) + dkpPoints;
            await user.save();

            const dkpRecord = new DKPRecord({
                userId: user._id,
                amount: dkpPoints,
                type: 'participation',
                description: `參與討伐 ${bossKill.bossId.name}`,
                bossKillId: bossKill._id,
            });
            await dkpRecord.save();

            return dkpRecord;
        }));

        bossKill.dkpDistributed = true;
        await bossKill.save();

        res.json({ msg: 'DKP 點數分配成功', dkpRecords: dkpRecords.filter(record => record !== null) });
    } catch (err) {
        console.error('Error distributing DKP:', err);
        res.status(500).json({ msg: 'DKP 點數分配失敗', error: err.message });
    }
});

module.exports = router;