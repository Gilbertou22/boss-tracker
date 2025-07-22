const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Boss = require('../models/Boss');
const BossDKPSetting = require('../models/BossDKPSetting');
const BossKill = require('../models/BossKill');
const { auth, adminOnly } = require('../middleware/auth');

// 獲取所有首領（支持搜索和過濾）
router.get('/', async (req, res) => {
    try {
        const { search, difficulty } = req.query;
        let query = {};
        if (search) {
            query.$or = [
                { name: { $regex: search, $options: 'i' } },
                { description: { $regex: search, $options: 'i' } },
            ];
        }
        if (difficulty && difficulty !== 'all') query.difficulty = difficulty;
        const bosses = await Boss.find(query).lean();
        res.json(bosses);
    } catch (err) {
        res.status(500).json({ msg: err.message });
    }
});

// 創建首領（管理員）
router.post('/', auth, adminOnly, async (req, res) => {
    const { name, description, difficulty, dkpPoints } = req.body;
    try {
        // 驗證首領名稱是否已存在
        const existingBoss = await Boss.findOne({ name });
        if (existingBoss) {
            return res.status(400).json({ msg: '首領名稱已存在，請使用其他名稱' });
        }

        // 驗證 DKP 點數
        if (dkpPoints === undefined || dkpPoints === null) {
            return res.status(400).json({
                code: 400,
                msg: 'DKP 點數是必填字段',
                suggestion: '請提供 DKP 點數',
            });
        }
        if (typeof dkpPoints !== 'number' || dkpPoints < 0) {
            return res.status(400).json({
                code: 400,
                msg: 'DKP 點數必須是非負數',
                suggestion: '請提供有效的 DKP 點數',
            });
        }

        // 創建首領
        const boss = new Boss({ name, description, difficulty });
        await boss.save();

        // 創建 DKP 設定
        const dkpSetting = new BossDKPSetting({ bossId: boss._id, dkpPoints });
        await dkpSetting.save();

        // 返回創建的首領數據
        const createdBoss = await Boss.findById(boss._id).lean();
        res.status(201).json(createdBoss);
    } catch (err) {
        res.status(400).json({ msg: err.message });
    }
});

// 更新首領（管理員）
router.put('/:id', auth, adminOnly, async (req, res) => {
    const { name, description, difficulty, dkpPoints } = req.body;
    try {
        // 驗證首領名稱是否已存在（排除當前首領）
        const existingBoss = await Boss.findOne({ name, _id: { $ne: req.params.id } });
        if (existingBoss) {
            return res.status(400).json({ msg: '首領名稱已存在，請使用其他名稱' });
        }

        // 驗證 DKP 點數
        if (dkpPoints === undefined || dkpPoints === null) {
            return res.status(400).json({
                code: 400,
                msg: 'DKP 點數是必填字段',
                suggestion: '請提供 DKP 點數',
            });
        }
        if (typeof dkpPoints !== 'number' || dkpPoints < 0) {
            return res.status(400).json({
                code: 400,
                msg: 'DKP 點數必須是非負數',
                suggestion: '請提供有效的 DKP 點數',
            });
        }

        // 更新首領
        const boss = await Boss.findByIdAndUpdate(
            req.params.id,
            { name, description, difficulty },
            { new: true, runValidators: true }
        );
        if (!boss) return res.status(404).json({ msg: '首領不存在' });

        // 更新或創建 DKP 設定
        let dkpSetting = await BossDKPSetting.findOne({ bossId: boss._id });
        if (dkpSetting) {
            dkpSetting.dkpPoints = dkpPoints;
            dkpSetting.updatedAt = Date.now();
        } else {
            dkpSetting = new BossDKPSetting({ bossId: boss._id, dkpPoints });
        }
        await dkpSetting.save();

        res.json(boss);
    } catch (err) {
        res.status(400).json({ msg: err.message });
    }
});

// 刪除首領（管理員）
router.delete('/:id', auth, adminOnly, async (req, res) => {
    try {
        const boss = await Boss.findById(req.params.id);
        if (!boss) return res.status(404).json({ msg: '首領不存在' });

        // 將 req.params.id 轉換為 ObjectId
        const bossId = new mongoose.Types.ObjectId(req.params.id);

        // 檢查是否在 BossKill 表中存在相關記錄
        const bossKillRecords = await BossKill.find({ bossId: bossId });
        if (bossKillRecords.length > 0) {
            return res.status(400).json({
                code: 400,
                msg: '無法刪除首領，因為存在相關的擊殺記錄',
                suggestion: '請先刪除相關的擊殺記錄，或聯繫管理員',
                relatedRecords: bossKillRecords.length,
            });
        }

        // 刪除首領
        await Boss.findByIdAndDelete(req.params.id);

        // 同時刪除相關的 DKP 設定
        await BossDKPSetting.deleteOne({ bossId: req.params.id });

        res.json({ msg: '首領已刪除' });
    } catch (err) {
        res.status(500).json({ msg: err.message });
    }
});

// 批量刪除首領（管理員）
router.delete('/batch-delete', auth, adminOnly, async (req, res) => {
    const { ids } = req.body;
    try {
        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ msg: '請提供有效的首領 ID 列表' });
        }

        // 將 ids 轉換為 ObjectId 陣列
        const objectIds = ids.map(id => new mongoose.Types.ObjectId(id));

        // 檢查是否存在相關的 BossKill 記錄
        const bossKillRecords = await BossKill.find({ bossId: { $in: objectIds } });
        if (bossKillRecords.length > 0) {
            return res.status(400).json({
                code: 400,
                msg: '無法刪除部分首領，因為存在相關的擊殺記錄',
                suggestion: '請先刪除相關的擊殺記錄，或聯繫管理員',
                relatedRecords: bossKillRecords.length,
            });
        }

        const result = await Boss.deleteMany({ _id: { $in: objectIds } });
        if (result.deletedCount === 0) {
            return res.status(404).json({ msg: '沒有找到任何首領進行刪除' });
        }

        // 同時刪除相關的 DKP 設定
        await BossDKPSetting.deleteMany({ bossId: { $in: objectIds } });

        res.json({ msg: `成功刪除 ${result.deletedCount} 個首領` });
    } catch (err) {
        res.status(500).json({ msg: '批量刪除失敗', error: err.message });
    }
});

module.exports = router;