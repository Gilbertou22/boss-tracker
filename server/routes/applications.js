const express = require('express');
const router = express.Router();
const Application = require('../models/Application');
const BossKill = require('../models/BossKill');
const Notification = require('../models/Notification');
const User = require('../models/User');
const { auth, adminOnly } = require('../middleware/auth');
const moment = require('moment');
require('dotenv').config();

// 獲取待審核申請數量
router.get('/pending-count', auth, async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ code: 403, msg: '無權限訪問' });
        }
        const pendingCount = await Application.countDocuments({ status: 'pending' });
        res.json({ pendingCount });
    } catch (err) {
        console.error('Error fetching pending applications:', {
            userId: req.user.id,
            error: err.message,
            stack: err.stack,
        });
        res.status(500).json({ code: 500, msg: '獲取待審核申請失敗' });
    }
});

// 提交申請
router.post('/', auth, async (req, res) => {
    const { kill_id, item_id, item_name } = req.body;
    const user = req.user;

    try {
        if (!user || !user.character_name) {
            return res.status(401).json({
                code: 401,
                msg: '無法識別用戶身份',
                detail: '請確保已正確登錄並提供有效的 Token。',
                suggestion: '請重新登錄或聯繫管理員。',
            });
        }

        if (!kill_id || !item_id || !item_name) {
            return res.status(400).json({
                code: 400,
                msg: '缺少必填字段',
                detail: `Missing required fields: ${!kill_id ? 'kill_id' : ''} ${!item_id ? 'item_id' : ''} ${!item_name ? 'item_name' : ''}`,
                suggestion: '請提供所有必填字段後重試。',
            });
        }

        const kill = await BossKill.findById(kill_id).populate('bossId', 'name');
        if (!kill) {
            return res.status(404).json({
                code: 404,
                msg: '擊殺記錄不存在',
                detail: `無法找到 ID 為 ${kill_id} 的擊殺記錄。`,
                suggestion: '請檢查擊殺記錄 ID 或聯繫管理員。',
            });
        }

        const droppedItem = kill.dropped_items.find(item => item._id.toString() === item_id);
        if (!droppedItem) {
            return res.status(400).json({
                code: 400,
                msg: '該物品未在此次擊殺中掉落或 item_id 無效',
                detail: `${item_name} 的 item_id (${item_id}) 不在 ${kill.bossId?.name || '未知首領'} 的掉落列表中。`,
                suggestion: '請選擇正確的掉落物品或檢查數據。',
            });
        }

        // 檢查物品狀態
        const itemStatus = droppedItem.status ? droppedItem.status.toLowerCase() : 'pending';
        if (itemStatus === 'expired') {
            return res.status(400).json({
                code: 400,
                msg: '物品已過期',
                detail: `此物品 (${item_name}) 已過期，無法申請。`,
                suggestion: '請選擇其他未過期的物品。',
            });
        }
        if (itemStatus === 'assigned') {
            return res.status(400).json({
                code: 400,
                msg: '物品已被分配',
                detail: `此物品 (${item_name}) 已分配，無法申請。`,
                suggestion: '請選擇其他未分配的物品。',
            });
        }

        // 添加出席檢查
        if (!kill.attendees.includes(user.character_name)) {
            return res.status(403).json({
                code: 403,
                msg: '無權申請',
                detail: `用戶 ${user.character_name} 不在 ${kill.bossId?.name || '未知首領'} 的參與者列表中，無法申請物品。`,
                suggestion: '請確認是否參與了該擊殺，或聯繫管理員補登。',
            });
        }

        const existingApprovedApplication = await Application.findOne({
            kill_id,
            item_id,
            status: 'approved',
        });
        if (existingApprovedApplication) {
            return res.status(400).json({
                code: 400,
                msg: '物品已被分配',
                detail: `此物品 (${item_name}) 已於 ${moment(existingApprovedApplication.updatedAt).format('YYYY-MM-DD HH:mm')} 分配給 ${existingApprovedApplication.user_id.character_name}，無法再次申請。`,
                suggestion: '請選擇其他未分配的物品。',
            });
        }

        const existingApplication = await Application.findOne({
            user_id: user.id,
            kill_id,
            item_id,
            status: { $in: ['pending', 'approved'] },
        });
        if (existingApplication) {
            return res.status(400).json({
                code: 400,
                msg: '重複申請',
                detail: `您已為 ${item_name} 提交申請，狀態為 ${existingApplication.status}，無法再次申請。`,
                suggestion: '請等待審核結果或聯繫管理員。',
            });
        }

        const application = new Application({
            user_id: user.id,
            kill_id,
            item_id: droppedItem._id,
            item_name,
            status: 'pending',
        });
        await application.save();

        res.status(201).json({
            code: 201,
            msg: '申請提交成功，等待審核',
            detail: `申請 ID: ${application._id} 已創建。`,
            application_id: application._id,
        });
    } catch (err) {
        console.error('Application error:', {
            userId: user?.id,
            killId: kill_id,
            itemId: item_id,
            error: err.message,
            stack: err.stack,
        });
        if (err.name === 'ValidationError') {
            return res.status(400).json({
                code: 400,
                msg: '驗證失敗',
                detail: err.message,
                suggestion: '請檢查請求數據並重試。',
            });
        }
        res.status(500).json({
            code: 500,
            msg: '申請失敗，請稍後再試',
            detail: err.message || '伺服器處理錯誤',
            suggestion: '請稍後重試或聯繫管理員。',
        });
    }
});

// 批准申請
router.post('/:id/approve', auth, adminOnly, async (req, res) => {
    const { id } = req.params;
    console.log('Approving application with ID:', id);
    console.log('User:', req.user);
    try {
        // 查找申請記錄
        const application = await Application.findById(id)
            .populate('user_id', 'character_name discord_id')
            .populate({
                path: 'kill_id',
                populate: { path: 'bossId', select: 'name' },
            });
        if (!application) {
            return res.status(404).json({
                code: 404,
                msg: '申請不存在',
                detail: `無法找到 ID 為 ${id} 的申請。`,
                suggestion: '請檢查申請 ID 或聯繫管理員。',
            });
        }
        if (application.status !== 'pending') {
            return res.status(400).json({
                code: 400,
                msg: '僅能審批待處理的申請',
                detail: `申請 ID: ${id} 狀態為 ${application.status}，無法審批。`,
                suggestion: '請檢查申請狀態。',
            });
        }

        // 更新申請狀態
        application.status = 'approved';
        await application.save();

        // 查找對應的 BossKill 記錄
        const bossKill = await BossKill.findById(application.kill_id);
        if (!bossKill) {
            return res.status(404).json({
                code: 404,
                msg: '擊殺記錄不存在',
                detail: `無法找到 ID 為 ${application.kill_id} 的擊殺記錄。`,
                suggestion: '請檢查擊殺記錄 ID 或聯繫管理員。',
            });
        }

        // 找到 dropped_items 中對應的物品
        const itemIndex = bossKill.dropped_items.findIndex(i => (i._id || i.id).toString() === application.item_id.toString());
        if (itemIndex === -1) {
            return res.status(404).json({
                code: 404,
                msg: '物品不存在於擊殺記錄中',
                detail: `item_id (${application.item_id}) 不在擊殺記錄 ${application.kill_id} 的掉落列表中。`,
                suggestion: '請檢查 item_id 或聯繫管理員。',
            });
        }

        // 更新頂層字段
        bossKill.final_recipient = application.user_id.character_name;
        bossKill.status = 'assigned';

        // 更新 dropped_items 中的對應物品
        bossKill.dropped_items[itemIndex].final_recipient = application.user_id.character_name;
        bossKill.dropped_items[itemIndex].status = 'assigned';

        // 標記 dropped_items 已修改
        bossKill.markModified('dropped_items');
        await bossKill.save();

        // 創建通知
        await Notification.create({
            userId: application.user_id._id,
            message: `您的申請已通過，您獲得了 ${application.item_name}！`,
            type: 'system',
        });

        // 發送 Discord 訊息到特定 channel
        const discordClient = req.app.get('discordClient');
        const channelId = '1359700987539099799'; // 你的特定 channel ID
        const userDiscordId = application.user_id.discord_id;

        if (discordClient && channelId && userDiscordId) {
            try {
                const channel = await discordClient.channels.fetch(channelId);
                if (channel) {
                    const formattedMessage = `<@${userDiscordId}> 恭喜獲得 ${application.item_name}！`;
                    await channel.send(formattedMessage);
                    console.log(`Discord message sent to channel ${channelId} for user ${userDiscordId}`);
                } else {
                    console.error(`Channel ${channelId} not found.`);
                }
            } catch (discordErr) {
                console.error('Error sending Discord message:', discordErr);
                // 繼續響應，不要中斷 API
            }
        } else {
            console.warn('Discord client, channelId, or user Discord ID missing; skipping Discord notification.');
        }

        res.json({
            code: 200,
            msg: '申請已審批',
            detail: `申請 ID: ${id} 已審批，分配給 ${application.user_id.character_name}。`,
        });
    } catch (err) {
        console.error('Approve application error:', {
            applicationId: id,
            user: req.user,
            error: err.message,
            stack: err.stack,
        });
        res.status(500).json({
            code: 500,
            msg: '審批申請失敗',
            detail: err.message || '伺服器處理錯誤',
            suggestion: '請稍後重試或聯繫管理員。',
        });
    }
});

// 拒絕申請
router.put('/:id/reject', auth, adminOnly, async (req, res) => {
    const { id } = req.params;
    console.log('Rejecting application with ID:', id);
    console.log('User:', req.user);
    try {
        const application = await Application.findById(id);
        if (!application) {
            return res.status(404).json({
                code: 404,
                msg: '申請不存在',
                detail: `無法找到 ID 為 ${id} 的申請。`,
                suggestion: '請檢查申請 ID 或聯繫管理員。',
            });
        }
        if (application.status !== 'pending') {
            return res.status(400).json({
                code: 400,
                msg: '僅能拒絕待處理的申請',
                detail: `申請 ID: ${id} 狀態為 ${application.status}，無法拒絕。`,
                suggestion: '請檢查申請狀態。',
            });
        }
        application.status = 'rejected';
        await application.save();

        res.json({
            code: 200,
            msg: '申請已拒絕',
            detail: `申請 ID: ${id} 已拒絕。`,
        });
    } catch (err) {
        console.error('Reject application error:', {
            applicationId: id,
            user: req.user,
            error: err.message,
            stack: err.stack,
        });
        res.status(500).json({
            code: 500,
            msg: '拒絕申請失敗',
            detail: err.message || '伺服器處理錯誤',
            suggestion: '請稍後重試或聯繫管理員。',
        });
    }
});

// 獲取所有申請（管理員）
router.get('/', auth, adminOnly, async (req, res) => {
    try {
        const { status, search } = req.query;
        let query = {};
        if (status && status !== 'all') query.status = status;
        if (search) {
            query.$or = [
                { 'user_id.character_name': { $regex: search, $options: 'i' } },
                { item_name: { $regex: search, $options: 'i' } },
            ];
        }
        const applications = await Application.find(query)
            .populate('user_id', 'character_name')
            .populate({
                path: 'kill_id',
                populate: { path: 'bossId', select: 'name' },
                select: 'bossId kill_time',
            });
        res.json(applications);
    } catch (err) {
        console.error('Fetch applications error:', {
            userId: req.user.id,
            query,
            error: err.message,
            stack: err.stack,
        });
        res.status(500).json({
            code: 500,
            msg: '獲取申請列表失敗',
            detail: err.message || '伺服器處理錯誤',
            suggestion: '請稍後重試或聯繫管理員。',
        });
    }
});

// 獲取用戶的申請記錄
router.get('/user', auth, async (req, res) => {
    try {
        const applications = await Application.find({ user_id: req.user.id })
            .select('user_id kill_id item_id item_name status created_at')
            .populate('user_id', 'character_name')
            .populate({
                path: 'kill_id',
                populate: { path: 'bossId', select: 'name' },
                select: 'bossId kill_time',
            });

        if (!applications || applications.length === 0) {
            console.warn('No applications found for user:', req.user.id);
            return res.json([]);
        }
        res.json(applications);
    } catch (err) {
        console.error('Fetch user applications error:', {
            userId: req.user.id,
            error: err.message,
            stack: err.stack,
        });
        res.status(500).json({
            code: 500,
            msg: '獲取申請記錄失敗',
            error: err.message,
        });
    }
});

// 獲取與某個 kill_id 相關的所有申請
router.get('/by-kill/:killId', auth, async (req, res) => {
    try {
        console.log('Fetching applications for killId:', req.params.killId);
        console.log('User:', req.user);
        const applications = await Application.find({ kill_id: req.params.killId })
            .populate('user_id', 'character_name')
            .lean();
        console.log('Found applications:', applications);
        res.json(applications);
    } catch (err) {
        console.error('Fetch applications by killId error:', {
            killId: req.params.killId,
            user: req.user,
            error: err.message,
            stack: err.stack,
        });
        res.status(500).json({
            code: 500,
            msg: '獲取申請記錄失敗',
            detail: err.message,
            suggestion: '請稍後重試或聯繫管理員',
        });
    }
});

// 獲取與某個 kill_id 和 item_id 相關的申請（管理員）
router.get('/by-kill-and-item', auth, adminOnly, async (req, res) => {
    const { kill_id, item_id } = req.query;

    try {
        console.log('Fetching applications for kill_id:', kill_id, 'item_id:', item_id);
        console.log('User:', req.user);
        if (!kill_id || !item_id) {
            return res.status(400).json({
                code: 400,
                msg: '缺少必填字段',
                detail: `Missing required fields: ${!kill_id ? 'kill_id' : ''} ${!item_id ? 'item_id' : ''}`,
                suggestion: '請提供所有必填字段後重試。',
            });
        }

        const applications = await Application.find({
            kill_id,
            item_id,
        })
            .select('user_id status created_at')
            .populate('user_id', 'character_name');

        console.log('Found applications by kill and item:', applications);
        res.json(applications);
    } catch (err) {
        console.error('Fetch applications by kill and item error:', {
            killId: kill_id,
            itemId: item_id,
            user: req.user,
            error: err.message,
            stack: err.stack,
        });
        res.status(500).json({
            code: 500,
            msg: '獲取申請記錄失敗',
            error: err.message,
        });
    }
});

// 獲取與某個 item_id 相關的申請（管理員）
router.get('/by-item/:itemId', auth, adminOnly, async (req, res) => {
    try {
        console.log('Fetching applications for itemId:', req.params.itemId);
        console.log('User:', req.user);
        const applications = await Application.find({ item_id: req.params.itemId })
            .populate('user_id', 'character_name')
            .lean();
        console.log('Found applications by item:', applications);
        res.json(applications);
    } catch (err) {
        console.error('Fetch applications by itemId error:', {
            itemId: req.params.itemId,
            user: req.user,
            error: err.message,
            stack: err.stack,
        });
        res.status(500).json({
            code: 500,
            msg: '獲取申請記錄失敗',
            detail: err.message,
            suggestion: '請稍後重試或聯繫管理員',
        });
    }
});

// 獲取申請趨勢（管理員）
router.get('/trend', auth, async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ code: 403, msg: '無權限訪問' });
        }
        const { range = 30 } = req.query;
        const now = new Date();
        const startDate = new Date(now.getTime() - range * 24 * 60 * 60 * 1000);
        const trendData = await Application.aggregate([
            {
                $match: {
                    createdAt: { $gte: startDate, $lte: now },
                    status: { $ne: 'approved' },
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
        res.json(trendData);
    } catch (err) {
        console.error('Error fetching application trend:', {
            userId: req.user.id,
            range,
            error: err.message,
            stack: err.stack,
        });
        res.status(500).json({ code: 500, msg: '獲取申請趨勢失敗' });
    }
});

module.exports = router;