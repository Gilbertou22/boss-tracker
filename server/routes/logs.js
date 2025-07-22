const express = require('express');
const router = express.Router();
const { auth, adminOnly } = require('../middleware/auth');
const logger = require('../logger');
const mongoose = require('mongoose');

const Log = mongoose.model('Log', new mongoose.Schema({}, { strict: false }), 'logs');

router.post('/', auth, async (req, res) => {
    try {
        const { level, message, metadata } = req.body;
       
        res.status(200).json({ msg: 'Log received' });
    } catch (err) {
        logger.error('Error saving frontend log', {
            error: err.message,
            stack: err.stack,
            userId: req.user?.id || 'anonymous',
        });
        res.status(500).json({ msg: 'Failed to save log' });
    }
});

// 查詢日誌（僅限管理員）
router.get('/query', auth, adminOnly, async (req, res) => {
    try {
        const { level, userId, startTime, endTime, page = 1, limit = 10 } = req.query;
        let query = {};

        if (level) query.level = level;
        if (userId) query['metadata.userId'] = userId;
        if (startTime || endTime) {
            query['metadata.timestamp'] = {};
            if (startTime) query['metadata.timestamp'].$gte = new Date(startTime);
            if (endTime) query['metadata.timestamp'].$lte = new Date(endTime);
        }

  

        const skip = (page - 1) * limit;
        const logs = await Log.find(query)
            .sort({ 'metadata.timestamp': -1 })
            .skip(skip)
            .limit(parseInt(limit))
            .lean();

        const total = await Log.countDocuments(query);

     

        res.json({
            data: logs,
            total,
            page: parseInt(page),
            limit: parseInt(limit),
        });
    } catch (err) {
        logger.error('Error querying logs', {
            error: err.message,
            stack: err.stack,
            userId: req.user?.id || 'anonymous',
        });
        res.status(500).json({ msg: 'Failed to query logs' });
    }
});

module.exports = router;