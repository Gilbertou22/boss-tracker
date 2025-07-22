const express = require('express');
const router = express.Router();
const Auction = require('../models/Auction');
const { auth } = require('../middleware/auth');

router.get('/', auth, async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ code: 403, msg: '無權限訪問' });
        }
        const alerts = await Auction.find({
            status: 'active',
            $or: [
                { highestBidder: { $exists: true }, diamonds: { $lt: '$currentPrice' } }, // 餘額不足
                { endTime: { $lt: new Date() } }, // 超時
            ],
        }).lean();
        res.json({ alerts });
    } catch (err) {
        console.error('Error fetching alerts:', err);
        res.status(500).json({ code: 500, msg: '獲取警報失敗' });
    }
});

module.exports = router;