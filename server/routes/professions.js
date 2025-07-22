// routes/professions.js
const express = require('express');
const router = express.Router();
const Profession = require('../models/Profession');
const { auth, adminOnly } = require('../middleware/auth');
const logger = require('../logger');

// 獲取所有職業列表
router.get('/',  async (req, res) => {
    try {
        const professions = await Profession.find().sort({ createdAt: -1 });
        res.json(professions);
    } catch (err) {
        logger.error('Error fetching professions:', err.message);
        res.status(500).json({
            code: 500,
            msg: '獲取職業列表失敗',
            detail: err.message,
        });
    }
});

// 獲取單個職業詳情
router.get('/:id', auth, async (req, res) => {
    try {
        const profession = await Profession.findById(req.params.id);
        if (!profession) {
            return res.status(404).json({
                code: 404,
                msg: '職業不存在',
                detail: `無法找到 ID 為 ${req.params.id} 的職業`,
            });
        }
        res.json(profession);
    } catch (err) {
        logger.error('Error fetching profession by ID:', err.message);
        res.status(500).json({
            code: 500,
            msg: '獲取職業詳情失敗',
            detail: err.message,
        });
    }
});

// 新增職業（管理員專用）
router.post('/', auth, adminOnly, async (req, res) => {
    const { name, icon, description } = req.body;

    try {
        if (!name || !icon) {
            return res.status(400).json({
                code: 400,
                msg: '缺少必填字段',
                detail: `請提供 name 和 icon，當前值: name=${name}, icon=${icon}`,
            });
        }

        const existingProfession = await Profession.findOne({ name });
        if (existingProfession) {
            return res.status(400).json({
                code: 400,
                msg: '職業名稱已存在',
                detail: '請選擇其他名稱',
            });
        }

        const profession = new Profession({
            name,
            icon,
            description: description || '',
        });

        await profession.save();

        res.status(201).json({
            code: 201,
            msg: '職業創建成功',
            profession,
        });
    } catch (err) {
        logger.error('Create profession error:', err.message);
        res.status(500).json({
            code: 500,
            msg: '創建職業失敗',
            detail: err.message,
        });
    }
});

// 更新職業（管理員專用）
router.put('/:id', auth, adminOnly, async (req, res) => {
    const { name, icon, description } = req.body;

    try {
        const profession = await Profession.findById(req.params.id);
        if (!profession) {
            return res.status(404).json({
                code: 404,
                msg: '職業不存在',
                detail: `無法找到 ID 為 ${req.params.id} 的職業`,
            });
        }

        if (name && name !== profession.name) {
            const existingProfession = await Profession.findOne({ name });
            if (existingProfession) {
                return res.status(400).json({
                    code: 400,
                    msg: '職業名稱已存在',
                    detail: '請選擇其他名稱',
                });
            }
        }

        profession.name = name || profession.name;
        profession.icon = icon || profession.icon;
        profession.description = description !== undefined ? description : profession.description;

        await profession.save();

        res.json({
            code: 200,
            msg: '職業更新成功',
            profession,
        });
    } catch (err) {
        logger.error('Update profession error:', err.message);
        res.status(500).json({
            code: 500,
            msg: '更新職業失敗',
            detail: err.message,
        });
    }
});

// 刪除職業（管理員專用）
router.delete('/:id', auth, adminOnly, async (req, res) => {
    try {
        const profession = await Profession.findById(req.params.id);
        if (!profession) {
            return res.status(404).json({
                code: 404,
                msg: '職業不存在',
                detail: `無法找到 ID 為 ${req.params.id} 的職業`,
            });
        }

        await profession.deleteOne();

        res.json({
            code: 200,
            msg: '職業刪除成功',
        });
    } catch (err) {
        logger.error('Delete profession error:', err.message);
        res.status(500).json({
            code: 500,
            msg: '刪除職業失敗',
            detail: err.message,
        });
    }
});

// 批量刪除職業（管理員專用）
router.delete('/batch-delete', auth, adminOnly, async (req, res) => {
    const { ids } = req.body;

    try {
        if (!Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({
                code: 400,
                msg: '請提供有效的職業 ID 列表',
            });
        }

        await Profession.deleteMany({ _id: { $in: ids } });

        res.json({
            code: 200,
            msg: '批量刪除成功',
        });
    } catch (err) {
        logger.error('Batch delete professions error:', err.message);
        res.status(500).json({
            code: 500,
            msg: '批量刪除失敗',
            detail: err.message,
        });
    }
});

module.exports = router;