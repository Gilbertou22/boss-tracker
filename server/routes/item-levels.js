// routes/item-levels.js
const express = require('express');
const router = express.Router();
const ItemLevel = require('../models/ItemLevel');
const { auth } = require('../middleware/auth');

// 獲取所有 ItemLevel 記錄
router.get('/', auth, async (req, res) => {
    try {
        const itemLevels = await ItemLevel.find().lean();
        res.json(itemLevels);
    } catch (err) {
        console.error('Error fetching item levels:', err);
        res.status(500).json({
            code: 500,
            msg: '獲取物品等級失敗',
            detail: err.message || '伺服器處理錯誤',
            suggestion: '請稍後重試或聯繫管理員。',
        });
    }
});

module.exports = router;