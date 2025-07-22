// routes/notifications.js
const express = require('express');
const router = express.Router();
const Notification = require('../models/Notification');
const User = require('../models/User');
const { auth } = require('../middleware/auth');
const mongoose = require('mongoose');
const logger = require('../logger'); // 引入 logger

// 獲取用戶的通知
router.get('/', auth, async (req, res) => {
    try {
        // 確認 req.user 是否存在
        if (!req.user || !req.user.id) {
            logger.error('User not authenticated', { user: req.user });
            return res.status(401).json({
                code: 401,
                msg: '未授權',
                detail: '用戶未通過身份驗證',
            });
        }

        const userId = req.user.id;
        logger.info('Fetching notifications for user', { userId });

        // 確認 Notification 模型是否可用
        if (!Notification || typeof Notification.find !== 'function') {
            logger.error('Notification model is not properly defined');
            throw new Error('Notification model is not properly defined');
        }

        // 獲取用戶的所有通知
        const notifications = await Notification.find({ userId })
            .sort({ createdAt: -1 })
            .lean();

        // 計算未讀通知數量
        const unreadCount = await Notification.countDocuments({ userId, read: false });

        logger.info('Fetched notifications', { userId, count: notifications.length, unreadCount });

        res.json({ notifications, unreadCount });
    } catch (err) {
        logger.error('Error fetching notifications', { userId: req.user?.id, error: err.message, stack: err.stack });
        res.status(500).json({
            code: 500,
            msg: '獲取通知失敗',
            detail: err.message || '伺服器處理錯誤',
            suggestion: '請稍後重試或聯繫管理員。',
        });
    }
});

// 標記通知為已讀
router.put('/:id/read', auth, async (req, res) => {
    const { id } = req.params;
    try {
        if (!mongoose.Types.ObjectId.isValid(id)) {
            logger.warn('Invalid notification ID', { id });
            return res.status(400).json({
                code: 400,
                msg: '無效的通知 ID',
                detail: `提供的 ID (${id}) 不是有效的 MongoDB ObjectId。`,
            });
        }

        const notification = await Notification.findOneAndUpdate(
            { _id: id, userId: req.user.id },
            { read: true },
            { new: true, lean: true }
        );
        if (!notification) {
            logger.warn('Notification not found', { id, userId: req.user.id });
            return res.status(404).json({
                code: 404,
                msg: '通知不存在',
                detail: `無法找到 ID 為 ${id} 的通知。`,
            });
        }

        logger.info('Marked notification as read', { id, userId: req.user.id });
        res.json({ code: 200, msg: '標記為已讀成功', notification });
    } catch (err) {
        logger.error('Error marking notification as read', { id, userId: req.user?.id, error: err.message, stack: err.stack });
        res.status(500).json({
            code: 500,
            msg: '標記為已讀失敗',
            detail: err.message || '伺服器處理錯誤',
            suggestion: '請稍後重試或聯繫管理員。',
        });
    }
});

// 發送廣播通知
router.post('/broadcast', auth, async (req, res) => {
    try {
        if (req.user.role !== 'admin' && req.user.role !== 'moderator') {
            logger.warn('Unauthorized broadcast attempt', { userId: req.user.id, role: req.user.role });
            return res.status(403).json({
                code: 403,
                msg: '無權操作',
                detail: '只有管理員或審核員可以發送廣播通知。',
            });
        }

        const { message, auctionId } = req.body;
        if (!message || typeof message !== 'string') {
            logger.warn('Invalid broadcast message', { message });
            return res.status(400).json({
                code: 400,
                msg: '無效的請求',
                detail: '消息內容為必填字段且必須為字符串。',
            });
        }

        const auctionIdValidation = auctionId ? mongoose.Types.ObjectId.isValid(auctionId) : true;
        if (auctionId && !auctionIdValidation) {
            logger.warn('Invalid auction ID in broadcast', { auctionId });
            return res.status(400).json({
                code: 400,
                msg: '無效的拍賣 ID',
                detail: `提供的 auctionId (${auctionId}) 不是有效的 MongoDB ObjectId。`,
            });
        }

        const users = await User.find({}, '_id');
        if (!users || users.length === 0) {
            logger.warn('No users found for broadcast');
            return res.status(404).json({
                code: 404,
                msg: '無可用用戶',
                detail: '系統中無用戶可接收通知。',
            });
        }

        const sender = await User.findById(req.user.id).lean();
        const senderName = sender?.character_name || '未知用戶';
        const formattedMessage = `${senderName}：${message}`;

        const notifications = users.map(user => new Notification({
            userId: user._id,
            message: formattedMessage,
            auctionId: auctionId || null,
            read: false,
        }));

        await Notification.insertMany(notifications);

        logger.info('Broadcast notification sent', { userId: req.user.id, userCount: users.length });
        res.status(201).json({
            code: 201,
            msg: '廣播通知發送成功',
            detail: `已向 ${users.length} 個用戶發送通知。`,
        });
    } catch (err) {
        logger.error('Error broadcasting notification', { userId: req.user?.id, error: err.message, stack: err.stack });
        res.status(500).json({
            code: 500,
            msg: '發送廣播通知失敗',
            detail: err.message || '伺服器處理錯誤',
            suggestion: '請稍後重試或聯繫管理員。',
        });
    }
});

// 新增：發送單用戶通知
router.post('/', auth, async (req, res) => {
    try {
        const { userId, message, type } = req.body;
        if (!userId || !message) {
            logger.warn('Missing required fields for single notification', { userId, message });
            return res.status(400).json({
                code: 400,
                msg: '缺少必填字段',
                detail: `Missing required fields: ${!userId ? 'userId' : ''} ${!message ? 'message' : ''}`,
                suggestion: '請提供所有必填字段後重試。',
            });
        }

        if (!mongoose.Types.ObjectId.isValid(userId)) {
            logger.warn('Invalid user ID for single notification', { userId });
            return res.status(400).json({
                code: 400,
                msg: '無效的用戶 ID',
                detail: `提供的 userId (${userId}) 不是有效的 MongoDB ObjectId。`,
            });
        }

        const user = await User.findById(userId);
        if (!user) {
            logger.warn('User not found for single notification', { userId });
            return res.status(404).json({
                code: 404,
                msg: '用戶不存在',
                detail: `無法找到 ID 為 ${userId} 的用戶。`,
            });
        }

        const notification = new Notification({
            userId,
            message,
            type: type || 'system',
        });
        await notification.save();

        logger.info('Single notification sent', { userId, message, type: type || 'system' });
        res.status(201).json({
            code: 201,
            msg: '通知發送成功',
            notification,
        });
    } catch (err) {
        logger.error('Error sending single notification', { userId: req.body?.userId, error: err.message, stack: err.stack });
        res.status(500).json({
            code: 500,
            msg: '發送通知失敗',
            detail: err.message || '伺服器處理錯誤',
            suggestion: '請稍後重試或聯繫管理員。',
        });
    }
});

// 發送 Discord 通知到 channel
router.post('/send-discord', async (req, res) => {
    const { channelId, userIds, message, sendToAllGuildMembers = false } = req.body;
    const discordClient = req.app.get('discordClient');

    if (!channelId || !message) {
        return res.status(400).json({ error: 'Channel ID and message are required' });
    }

    try {
        const channel = discordClient.channels.cache.get(channelId);
        if (!channel) {
            return res.status(404).json({ error: 'Channel not found or bot lacks access' });
        }

        let formattedMessage = message;

        if (sendToAllGuildMembers) {
            // 查詢所有旅團成員的 Discord ID 並 @mention
            const guildMembers = await User.find({ roles: 'guild' }).select('discordId');
            const mentions = guildMembers
                .filter(user => user.discordId)
                .map(user => `<@${user.discordId}>`)
                .join(' ');
            formattedMessage = `${mentions} ${message}`;
        } else if (userIds && userIds.length > 0) {
            // @mention 特定用戶
            const mentions = userIds.map(id => `<@${id}>`).join(' ');
            formattedMessage = `${mentions} ${message}`;
        }

        // 發送到 channel
        await channel.send(formattedMessage);
        console.log(`Message sent to channel ${channelId}`);

        res.status(200).json({ success: true, message: 'Notification sent to channel' });
    } catch (error) {
        console.error('Error sending to channel:', error);
        if (error.code === 50007) {
            res.status(403).json({ error: 'Cannot send to channel: Check bot permissions or user settings' });
        } else {
            res.status(500).json({ error: 'Failed to send notification' });
        }
    }
});

module.exports = router;