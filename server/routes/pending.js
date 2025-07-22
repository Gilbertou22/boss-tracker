const express = require('express');
const router = express.Router();
const BossKill = require('../models/BossKill');
const { auth } = require('../middleware/auth');

// 獲取待處理數量（例如未批准的 BossKill）
router.get('/pending-count', auth, async (req, res) => {
    
    try {
        const pendingCount = await BossKill.countDocuments({
            status: 'pending',
            final_recipient: null,
        });
     
        res.json({ count: pendingCount });
    } catch (err) {
        console.error('Error fetching pending count:', err);
        res.status(500).json({ msg: '獲取待處理數量失敗', error: err.message });
    }
});

module.exports = router;