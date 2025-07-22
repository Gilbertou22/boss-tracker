const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const Auction = require('../models/Auction');
const Bid = require('../models/Bid');
const Guild = require('../models/Guild');
const User = require('../models/User');
const BossKill = require('../models/BossKill');
const Item = require('../models/Item');
const Notification = require('../models/Notification');
const WalletTransaction = require('../models/WalletTransaction');
const DKPRecord = require('../models/DKPRecord');
const { auth, adminOnly } = require('../middleware/auth');
const logger = require('../logger');
const moment = require('moment');
const schedule = require('node-schedule');
const crypto = require('crypto');

// 定義旅團帳戶名稱
const GUILD_ACCOUNT_NAME = '旅團帳戶';

// 定時任務：檢查過期拍賣並執行抽籤
const scheduleAuctionStatusUpdate = () => {
    schedule.scheduleJob('*/5 * * * *', async () => {
        try {
            const now = moment();
            logger.info('Running auction status update task', { currentTime: now.toISOString() });
            const expiredAuctions = await Auction.find({
                status: 'active',
                endTime: { $lt: now.toDate() },
            }).populate('itemId');

            logger.info('Found expired auctions', { count: expiredAuctions.length });
            for (const auction of expiredAuctions) {                
                if (auction.auctionType === 'lottery') {
                    // 抽籤拍賣：執行抽籤邏輯
                    logger.info('Processing lottery auction', { auctionType: auction.auctionType, endTime: auction.endTime });
                    const bids = await Bid.find({ auctionId: auction._id })
                        .populate('userId', 'character_name dkpPoints');
                    if (bids.length === 0) {
                        auction.status = 'cancelled';
                        auction.highestBidder = null;
                        await auction.save();
                        logger.info('Lottery auction settled with no participants', { auctionId: auction._id, endTime: auction.endTime });
                        continue;
                    }

                    // 使用 crypto 模塊生成更安全的隨機數
                    const randomIndex = crypto.randomInt(0, bids.length);
                    const winnerBid = bids[randomIndex];
                    const winner = winnerBid.userId;
                    const finalPrice = auction.startingPrice;

                    auction.highestBidder = winner._id;
                    auction.currentPrice = finalPrice;
                    auction.status = 'pending';
                    await auction.save();

                    // 記錄抽籤過程
                    const drawLog = {
                        auctionId: auction._id,
                        participants: bids.map(bid => bid.userId.character_name),
                        winner: winner.character_name,
                        timestamp: new Date(),
                    };
                    logger.info('Lottery draw completed', drawLog);

                    // 通知所有參與者
                    const itemName = auction.itemName || '未知物品';
                    const notifications = bids.map(bid => {
                        const isWinner = bid.userId._id.toString() === winner._id.toString();
                        return new Notification({
                            userId: bid.userId._id,
                            message: isWinner
                                ? `您已中標抽籤拍賣 ${itemName} (ID: ${auction._id})，得標金額為 ${finalPrice} 鑽石。請等待管理員核實。`
                                : `抽籤拍賣 ${itemName} (ID: ${auction._id}) 已結束，得標者為 ${winner.character_name}。`,
                            auctionId: auction._id,
                        });
                    });
                    await Notification.insertMany(notifications);
                    logger.info('Notifications sent for lottery auction', { auctionId: auction._id, winner: winner.character_name });
                } else {
                    // 其他類型的拍賣：僅更新狀態為 pending
                    auction.status = 'pending';
                    await auction.save();
                    logger.info('Auction status updated to pending', { auctionId: auction._id, endTime: auction.endTime });
                }
            }
        } catch (err) {
            logger.error('Error updating auction statuses', { error: err.message, stack: err.stack });
        }
    });
};
scheduleAuctionStatusUpdate();

// 新增路由：查看抽籤記錄（可選）
router.get('/:id/draw-log', auth, async (req, res) => {
    const { id } = req.params;
    try {
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                code: 400,
                msg: '無效的拍賣 ID',
                detail: `提供的 auctionId (${id}) 不是有效的 MongoDB ObjectId。`,
            });
        }
        const auction = await Auction.findById(id).populate('highestBidder', 'character_name');
        if (!auction) {
            return res.status(404).json({
                code: 404,
                msg: '拍賣不存在',
                detail: `無法找到 ID 為 ${id} 的拍賣。`,
            });
        }
        if (auction.auctionType !== 'lottery') {
            return res.status(400).json({
                code: 400,
                msg: '拍賣類型無效',
                detail: `拍賣 ${id} 不是抽籤類型。`,
            });
        }
        const bids = await Bid.find({ auctionId: id }).populate('userId', 'character_name');
        const drawLog = {
            auctionId: id,
            participants: bids.map(bid => bid.userId.character_name),
            winner: auction.highestBidder ? auction.highestBidder.character_name : '尚未抽籤',
            timestamp: auction.updatedAt,
        };
        logger.info('Fetched lottery draw log', { auctionId: id, userId: req.user.id });
        res.json(drawLog);
    } catch (err) {
        logger.error('Error fetching lottery draw log', { auctionId: id, userId: req.user.id, error: err.message, stack: err.stack });
        res.status(500).json({
            code: 500,
            msg: '獲取抽籤記錄失敗',
            detail: err.message || '伺服器處理錯誤',
        });
    }
});

// 監控拍賣（管理員專用）
router.get('/monitor', auth, async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ code: 403, msg: '無權限訪問' });
        }
        const now = new Date();
        const soonEndingCount = await Auction.countDocuments({
            status: 'active',
            endTime: { $lt: new Date(now.getTime() + 24 * 60 * 60 * 1000) },
        });
        const alertAuctions = await Auction.find({
            status: 'active',
            $or: [
                { currentPrice: { $gt: 0 }, highestBidder: { $exists: false } },
                { endTime: { $lt: now } },
            ],
        }).lean();
        logger.info('Fetched auction monitor data', { userId: req.user.id, soonEndingCount, alertAuctionsCount: alertAuctions.length });
        res.json({ soonEndingCount, alertAuctions });
    } catch (err) {
        logger.error('Error fetching auction monitor', { userId: req.user.id, error: err.message, stack: err.stack });
        res.status(500).json({ code: 500, msg: '獲取拍賣監測失敗' });
    }
});

// 獲取拍賣成交趨勢（管理員專用）
router.get('/trend', auth, async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ code: 403, msg: '無權限訪問' });
        }
        const now = new Date();
        const startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        const trendData = await Auction.aggregate([
            {
                $match: {
                    status: 'settled',
                    updatedAt: { $gte: startDate, $lte: now },
                },
            },
            {
                $group: {
                    _id: {
                        $dateToString: { format: '%Y-%m-%d', date: '$updatedAt' },
                    },
                    count: { $sum: 1 },
                    totalPrice: { $sum: '$currentPrice' },
                },
            },
            { $sort: { _id: 1 } },
        ]);
        logger.info('Fetched auction trend data', { userId: req.user.id, trendDataCount: trendData.length });
        res.json(trendData);
    } catch (err) {
        logger.error('Error fetching auction trend', { userId: req.user.id, error: err.message, stack: err.stack });
        res.status(500).json({ code: 500, msg: '獲取拍賣成交趨勢失敗' });
    }
});

// 獲取待處理競標數量
router.get('/pending-count', auth, async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({
                code: 403,
                msg: '無權訪問',
                detail: '只有管理員可以查看待處理競標數量。',
            });
        }

        const pendingCount = await Auction.countDocuments({ status: 'pending' });
        logger.info('Fetched pending auctions count', { userId: req.user.id, pendingCount });
        res.json({ count: pendingCount });
    } catch (err) {
        logger.error('Error fetching pending auctions count', { userId: req.user.id, error: err.message, stack: err.stack });
        res.status(500).json({
            code: 500,
            msg: '獲取待處理競標數量失敗',
            detail: err.message || '伺服器處理錯誤',
            suggestion: '請稍後重試或聯繫管理員。',
        });
    }
});

// 獲取當前用戶得標或持有的拍賣列表
router.get('/won', auth, async (req, res) => {
    try {
        const userId = req.user.id;
        const characterName = req.user.character_name;
        const userRole = req.user.role;

        let query;
        if (userRole === 'admin') {
            query = {
                status: { $in: ['pending', 'completed', 'settled'] },
            };
        } else {
            query = {
                $or: [
                    { highestBidder: userId },
                    { itemHolder: characterName },
                ],
                status: { $in: ['pending', 'completed', 'settled'] },
            };
        }

        const wonAuctions = await Auction.find(query)
            .lean()
            .populate('highestBidder', 'character_name')
            .populate('createdBy', 'character_name lineId discordId')
            .populate('itemId');

        if (!wonAuctions.length) {
            logger.info('No won or held auctions found for user', { userId, characterName, userRole });
            return res.json([]);
        }

        logger.info('Fetched won or held auctions', { userId, characterName, userRole, count: wonAuctions.length });

        const enrichedAuctions = await Promise.all(wonAuctions.map(async (auction) => {
            let itemName = '未知物品';
            let imageUrl = null;
            let level = null;
            let itemHolder = auction.itemHolder;

            if (auction.itemId && auction.itemId.itemHolder) {
                itemHolder = auction.itemId.itemHolder;
            } else {
                itemHolder = auction.createdBy.character_name;
                logger.warn(`itemHolder not set in BossKill for itemId ${auction.itemId?._id}, using createdBy.character_name`, { auctionId: auction._id, createdBy: auction.createdBy.character_name });
            }

            if (auction.itemId && mongoose.Types.ObjectId.isValid(auction.itemId?._id)) {
                const bossKill = auction.itemId;
                if (bossKill && bossKill.dropped_items?.length) {
                    const droppedItem = bossKill.dropped_items[0]; // 假設使用第一個 dropped_items
                    if (droppedItem) {
                        itemName = droppedItem.name || '未知物品';
                        if (bossKill.screenshots?.length > 0) {
                            const rawImageUrl = bossKill.screenshots[0];
                            imageUrl = `${req.protocol}://${req.get('host')}/${rawImageUrl.replace(/\\/g, '/')}`;
                        }
                        const item = await Item.findOne({ name: itemName }).populate('level', 'level color').lean();
                        if (item) {
                            level = item.level || null;
                        }
                    }
                }
            } else {
                logger.warn(`Invalid itemId for auction ${auction._id}`, { itemId: auction.itemId });
                return null; // 跳過該拍賣
            }

            return {
                ...auction,
                itemName,
                imageUrl,
                level,
                createdAt: auction.createdAt,
                endTime: auction.endTime,
                currentPrice: auction.auctionType === 'blind' ? null : auction.currentPrice,
                highestBidder: auction.auctionType === 'blind' ? null : auction.highestBidder,
                startingPrice: auction.startingPrice,
                buyoutPrice: auction.buyoutPrice,
                status: auction.status || 'active',
                itemHolder,
                auctionType: auction.auctionType || 'open',
            };
        }));

        // 過濾掉 null 值
        const filteredAuctions = enrichedAuctions.filter(auction => auction !== null);
        res.json(filteredAuctions);
    } catch (err) {
        logger.error('Error fetching won or held auctions', { userId: req.user.id, error: err.message, stack: err.stack });
        res.status(500).json({ msg: '獲取得標或持有拍賣列表失敗', error: err.message });
    }
});

router.post('/:kill_id/start', auth, async (req, res) => {
    const { kill_id } = req.params;
    const { startingPrice, buyoutPrice, duration, auctionType = 'open', restrictions = {}, itemIndex = 0 } = req.body;
    const user = req.user;

    try {
        // 驗證 kill_id 是否為有效的 MongoDB ObjectId
        if (!mongoose.Types.ObjectId.isValid(kill_id)) {
            logger.warn('Invalid kill_id provided', { kill_id, userId: user.id });
            return res.status(400).json({
                code: 400,
                msg: '無效的擊殺記錄 ID',
                detail: `提供的 kill_id (${kill_id}) 不是有效的 MongoDB ObjectId。`,
                suggestion: '請檢查擊殺記錄 ID 或聯繫管理員。',
            });
        }

        // 查詢 BossKill 記錄
        const bossKill = await BossKill.findById(kill_id).populate('dropped_items.level');
        if (!bossKill) {
            logger.warn('BossKill record not found', { kill_id, userId: user.id });
            return res.status(404).json({
                code: 404,
                msg: '擊殺記錄不存在',
                detail: `無法找到 ID 為 ${kill_id} 的擊殺記錄。`,
                suggestion: '請檢查擊殺記錄是否存在或聯繫管理員。',
            });
        }

        // 確保 dropped_items 存在且 itemIndex 有效
        if (!bossKill.dropped_items || bossKill.dropped_items.length <= itemIndex) {
            logger.warn('Dropped items not found or invalid itemIndex', { kill_id, itemIndex, droppedItems: bossKill.dropped_items, userId: user.id });
            return res.status(400).json({
                code: 400,
                msg: '物品不存在',
                detail: `擊殺記錄 ${kill_id} 中不存在索引為 ${itemIndex} 的物品。`,
                suggestion: '請檢查物品索引或聯繫管理員。',
            });
        }

        // 獲取物品信息
        const droppedItem = bossKill.dropped_items[itemIndex];

        // 獲取物品持有人
        let itemHolder = bossKill.itemHolder || user.character_name; // 如果 bossKill 中未指定 itemHolder，則使用創建者的 character_name
        if (!itemHolder) {
            logger.warn('Item holder not set, using default', { kill_id, userId: user.id, defaultHolder: user.character_name });
        }

        // 創建拍賣記錄
        const auction = new Auction({
            itemId: kill_id,
            auctionType,
            startingPrice: parseInt(startingPrice),
            currentPrice: parseInt(startingPrice),
            buyoutPrice: buyoutPrice ? parseInt(buyoutPrice) : null,
            endTime: moment().add(duration, 'hours').toDate(),
            createdBy: user.id,
            itemHolder: itemHolder,
            status: 'active',
            restrictions: {
                sameWorld: restrictions.sameWorld || false,
                hasAttended: restrictions.hasAttended || false,
                dkpThreshold: restrictions.dkpThreshold || 0,
                sameGuild: restrictions.sameGuild || false,
            },
            itemName: droppedItem?.name || '未知物品', // 確保 itemName 始終有值
            imageUrl: droppedItem?.image_url || '',
        });

        await auction.save();
        logger.info('Auction created successfully', { auctionId: auction._id, kill_id, userId: user.id });

        res.status(201).json({
            code: 201,
            msg: '競標創建成功',
            auction: {
                id: auction._id,
                itemName: auction.itemName,
                startingPrice: auction.startingPrice,
                endTime: auction.endTime,
            },
        });
    } catch (err) {
        logger.error('Start auction error', { kill_id, userId: user.id, error: err.message, stack: err.stack });
        res.status(500).json({
            code: 500,
            msg: '開始競標失敗',
            detail: err.message || '伺服器處理錯誤',
            suggestion: '請稍後重試或聯繫管理員。',
        });
    }
});

// 獲取競標列表
router.get('/', auth, async (req, res) => {
    const { status } = req.query;
    try {
        const query = status ? { status } : {};
        const auctions = await Auction.find(query)
            .lean()
            .populate('highestBidder', 'character_name')
            .populate('createdBy', 'character_name')
            .populate('itemId');
        if (!auctions.length) {
            logger.info('No auctions found', { userId: req.user.id, query });
            return res.json([]);
        }

        logger.info('Fetched auctions', { userId: req.user.id, count: auctions.length });

        const enrichedAuctions = await Promise.all(auctions.map(async (auction) => {
            let itemName = '未知物品';
            let imageUrl = null;
            let level = null;
            let itemHolder = auction.itemHolder;

            if (auction.itemId && auction.itemId.itemHolder) {
                itemHolder = auction.itemId.itemHolder;
            }

            if (auction.itemId && mongoose.Types.ObjectId.isValid(auction.itemId?._id)) {
                const bossKill = auction.itemId;
                if (bossKill && bossKill.dropped_items?.length) {
                    const droppedItem = bossKill.dropped_items[0]; // 假設使用第一個 dropped_items
                    if (droppedItem) {
                        itemName = droppedItem.name || '未知物品';
                        if (bossKill.screenshots?.length > 0) {
                            const rawImageUrl = bossKill.screenshots[0];
                            imageUrl = `${req.protocol}://${req.get('host')}/${rawImageUrl.replace(/\\/g, '/')}`;
                        }
                        const item = await Item.findOne({ name: itemName }).populate('level');
                        if (item) {
                            level = item.level || null;
                        }
                    }
                }
            } else {
                logger.warn(`Invalid itemId for auction ${auction._id}`, { itemId: auction.itemId });
                return null; // 跳過該拍賣
            }

            return {
                ...auction,
                itemId: auction.itemId?._id ? auction.itemId._id.toString() : auction.itemId,
                itemName,
                imageUrl,
                level,
                createdAt: auction.createdAt,
                endTime: auction.endTime,
                currentPrice: auction.auctionType === 'blind' ? null : auction.currentPrice,
                highestBidder: auction.auctionType === 'blind' ? null : auction.highestBidder,
                startingPrice: auction.startingPrice,
                buyoutPrice: auction.buyoutPrice,
                status: auction.status || 'active',
                itemHolder,
                auctionType: auction.auctionType || 'open',
            };
        }));

        // 過濾掉 null 值
        const filteredAuctions = enrichedAuctions.filter(auction => auction !== null);
        res.json(filteredAuctions);
    } catch (err) {
        logger.error('Error fetching auctions', { userId: req.user.id, error: err.message, stack: err.stack });
        res.status(500).json({ msg: '獲取競標列表失敗', error: err.message });
    }
});

// 獲取單個拍賣詳情
router.get('/:id', auth, async (req, res) => {
    const { id } = req.params;
    try {
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                code: 400,
                msg: '無效的拍賣 ID',
                detail: `提供的 auctionId (${id}) 不是有效的 MongoDB ObjectId。`,
                suggestion: '請檢查拍賣 ID 或聯繫管理員。',
            });
        }
        const auction = await Auction.findById(id)
            .lean()
            .populate('highestBidder', 'character_name')
            .populate('createdBy', 'character_name')
            .populate('itemId');
        if (!auction) {
            return res.status(404).json({
                code: 404,
                msg: '拍賣不存在',
                detail: `無法找到 ID 為 ${id} 的拍賣。`,
                suggestion: '請刷新頁面後重試或聯繫管理員檢查數據庫。',
            });
        }
        if (!auction.itemId) {
            logger.warn(`Invalid itemId for auction ${auction._id}`, { itemId: auction.itemId });
            return res.status(400).json({
                code: 400,
                msg: '無效的物品 ID',
                detail: `拍賣 ${id} 的 itemId 為 null。`,
                suggestion: '請聯繫管理員檢查數據庫。',
            });
        }
        let itemName = '未知物品';
        let imageUrl = null;
        let level = null;
        let itemHolder = auction.itemHolder;

        if (auction.itemId && auction.itemId.itemHolder) {
            itemHolder = auction.itemId.itemHolder;
        }

        if (mongoose.Types.ObjectId.isValid(auction.itemId?._id)) {
            const bossKill = auction.itemId;
            if (bossKill && bossKill.dropped_items?.length) {
                const droppedItem = bossKill.dropped_items[0]; // 假設使用第一個 dropped_items
                if (droppedItem) {
                    itemName = droppedItem.name || '未知物品';
                    if (bossKill.screenshots?.length > 0) {
                        const rawImageUrl = bossKill.screenshots[0];
                        imageUrl = `${req.protocol}://${req.get('host')}/${rawImageUrl.replace(/\\/g, '/')}`;
                    }
                    const item = await Item.findOne({ name: itemName }).populate('level');
                    if (item) {
                        level = item.level || null;
                    }
                }
            } else {
                logger.warn(`No dropped items found for auction ${auction._id}`, { itemId: auction.itemId._id });
            }
        } else {
            logger.warn(`Invalid itemId for auction ${auction._id}`, { itemId: auction.itemId });
        }

        const enrichedAuction = {
            ...auction,
            itemId: auction.itemId?._id ? auction.itemId._id.toString() : auction.itemId,
            itemName,
            imageUrl,
            level,
            createdAt: auction.createdAt,
            endTime: auction.endTime,
            currentPrice: auction.auctionType === 'blind' && req.user.role !== 'admin' ? null : auction.currentPrice,
            highestBidder: auction.auctionType === 'blind' && req.user.role !== 'admin' ? null : auction.highestBidder,
            startingPrice: auction.startingPrice,
            buyoutPrice: auction.buyoutPrice,
            status: auction.status || 'active',
            itemHolder,
            auctionType: auction.auctionType || 'open',
        };
        logger.info('Fetched auction details', { userId: req.user.id, auctionId: id });
        res.json(enrichedAuction);
    } catch (err) {
        logger.error('Error fetching auction by ID', { userId: req.user.id, auctionId: id, error: err.message, stack: err.stack });
        res.status(500).json({
            code: 500,
            msg: '獲取拍賣詳情失敗',
            detail: err.message || '伺服器處理錯誤',
            suggestion: '請稍後重試或聯繫管理員。',
        });
    }
});

// 出價/報名路由
router.post('/:id/bid', auth, async (req, res) => {
    const { id } = req.params;
    const { amount } = req.body;
    const user = req.user;

    try {
        const auction = await Auction.findById(id).populate('itemId').populate('createdBy');
        if (!auction) {
            return res.status(404).json({
                code: 404,
                msg: '拍賣不存在',
                detail: `無法找到 ID 為 ${id} 的拍賣。`,
            });
        }

        if (auction.status !== 'active') {
            return res.status(400).json({
                code: 400,
                msg: '拍賣已結束',
                detail: `當前拍賣狀態為 ${auction.status}，無法投標。`,
            });
        }

        const bossKill = auction.itemId;
        if (!bossKill) {
            return res.status(404).json({
                code: 404,
                msg: '擊殺記錄不存在',
                detail: `無法找到與拍賣 ${id} 相關聯的擊殺記錄。`,
            });
        }

        const userData = await User.findById(user.id).populate('guildId');
        if (!userData) {
            return res.status(404).json({
                code: 404,
                msg: '用戶不存在',
                detail: `無法找到 ID 為 ${user.id} 的用戶。`,
            });
        }

        // 檢查競標限制
        const { restrictions } = auction;

        // 1. 同世界限制
        if (restrictions.sameWorld) {
            const auctionCreator = await User.findById(auction.createdBy);
            if (auctionCreator.world_name !== userData.world_name) {
                return res.status(403).json({
                    code: 403,
                    msg: '您無法投標此拍賣',
                    detail: `此拍賣僅限同世界用戶投標，您的伺服器 (${userData.world_name}) 與拍賣創建者的伺服器 (${auctionCreator.world_name}) 不同。`,
                });
            }
        }

        // 2. 有出席限制
        if (restrictions.hasAttended) {
            const attendees = bossKill.attendees || [];
            if (!attendees.includes(userData.character_name)) {
                return res.status(403).json({
                    code: 403,
                    msg: '您無法投標此拍賣',
                    detail: '此拍賣僅限參加該場戰役的成員投標，您未參加此戰役。',
                });
            }
        }

        // 3. DKP 限制
        if (restrictions.dkpThreshold > 0) {
            if (userData.dkpPoints < restrictions.dkpThreshold) {
                return res.status(403).json({
                    code: 403,
                    msg: '您無法投標此拍賣',
                    detail: `此拍賣要求 DKP 大於 ${restrictions.dkpThreshold}，您的 DKP 為 ${userData.dkpPoints}。`,
                });
            }
        }

        // 4. 同旅團名限制
        if (restrictions.sameGuild) {
            const auctionCreator = await User.findById(auction.createdBy).populate('guildId');
            if (!auctionCreator.guildId || !userData.guildId || auctionCreator.guildId.name !== userData.guildId.name) {
                return res.status(403).json({
                    code: 403,
                    msg: '您無法投標此拍賣',
                    detail: `此拍賣僅限同旅團用戶投標，您的旅團 (${userData.guildId?.name || '無旅團'}) 與拍賣創建者的旅團 (${auctionCreator.guildId?.name || '無旅團'}) 不同。`,
                });
            }
        }

        // 檢查投標金額
        if (auction.auctionType !== 'lottery') {
            if (!amount || amount <= 0) {
                return res.status(400).json({
                    code: 400,
                    msg: '無效的投標金額',
                    detail: '投標金額必須大於 0。',
                });
            }

            if (auction.auctionType === 'open' && amount <= auction.currentPrice) {
                return res.status(400).json({
                    code: 400,
                    msg: '投標金額過低',
                    detail: `投標金額必須大於當前價格 ${auction.currentPrice}。`,
                });
            }
        }

        // 檢查用戶是否已投標
        const existingBid = await Bid.findOne({ auctionId: id, userId: user.id });
        if (existingBid) {
            return res.status(400).json({
                code: 400,
                msg: '您已參與此拍賣',
                detail: '您已經投標過此拍賣，無法再次投標。',
            });
        }

        // 創建投標記錄
        const bid = new Bid({
            auctionId: id,
            userId: user.id,
            amount: auction.auctionType === 'lottery' ? 0 : amount,
            timestamp: new Date(),
        });
        await bid.save();

        // 更新拍賣信息
        if (auction.auctionType !== 'lottery') {
            auction.currentPrice = amount;
            auction.highestBidder = user.id;

            if (auction.buyoutPrice && amount >= auction.buyoutPrice) {
                auction.status = 'completed';
                auction.currentPrice = auction.buyoutPrice;
            }
        }

        await auction.save();

        res.status(200).json({
            code: 200,
            msg: auction.auctionType === 'lottery' ? '報名成功' : auction.status === 'completed' ? '投標成功，已直接得標！' : '投標成功',
            finalPrice: auction.currentPrice,
        });
    } catch (err) {
        console.error('Bid error:', err);
        res.status(500).json({
            code: 500,
            msg: '投標失敗',
            detail: err.message || '伺服器處理錯誤',
        });
    }
});

// 結算路由（管理員核實交易）
router.put('/:id/settle', auth, async (req, res) => {
    const { id } = req.params;
    try {
        logger.info('Attempting to settle auction', { auctionId: id, userId: req.user.id });
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                code: 400,
                msg: '無效的拍賣 ID',
                detail: `提供的 auctionId (${id}) 不是有效的 MongoDB ObjectId。`,
                suggestion: '請刷新頁面並重試，或聯繫管理員。',
            });
        }
        // 檢查 roles 陣列中是否包含 'admin'
        if (!req.user.roles || !req.user.roles.includes('admin')) {
            return res.status(403).json({
                code: 403,
                msg: '無權操作',
                detail: '只有管理員可以結算拍賣。',
            });
        }
        const auction = await Auction.findById(id)
            .populate('highestBidder', 'character_name dkpPoints')
            .populate('createdBy', 'character_name')
            .populate('itemId');
        if (!auction) {
            return res.status(404).json({
                code: 404,
                msg: '拍賣不存在',
                detail: `無法找到 ID 為 ${id} 的拍賣。`,
                suggestion: '請刷新頁面後重試或聯繫管理員檢查數據庫。',
            });
        }
        if (auction.status !== 'pending') {
            return res.status(400).json({
                code: 400,
                msg: '拍賣狀態無效',
                detail: `拍賣 ${id} 狀態為 ${auction.status}，必須為 pending 才能結算。`,
                suggestion: '請確保拍賣處於待處理狀態。',
            });
        }

        let highestBidder = auction.highestBidder;
        let finalPrice = auction.currentPrice;

        const auctionType = auction.auctionType || 'open';
        if (auctionType === 'blind') {
            // 暗標：選擇最高出價者
            const bids = await Bid.find({ auctionId: id })
                .populate('userId', 'character_name dkpPoints')
                .sort({ amount: -1 });
            if (bids.length === 0) {
                await Auction.findByIdAndUpdate(id, { status: 'cancelled', highestBidder: null });
                logger.info('Auction settled with no bidder', { auctionId: id, userId: req.user.id });
                return res.status(200).json({
                    code: 200,
                    msg: '拍賣結算完成，無中標者',
                    detail: `拍賣 ${id} 無有效出價，已標記為取消。`,
                });
            }
            const highestBid = bids[0];
            highestBidder = highestBid.userId;
            finalPrice = highestBid.amount;
            auction.highestBidder = highestBidder._id;
            auction.currentPrice = finalPrice;
            await auction.save();
        } else if (auctionType === 'lottery') {
            // 抽籤：隨機選擇得標者
            const bids = await Bid.find({ auctionId: id })
                .populate('userId', 'character_name dkpPoints');
            if (bids.length === 0) {
                await Auction.findByIdAndUpdate(id, { status: 'cancelled', highestBidder: null });
                logger.info('Auction settled with no participants', { auctionId: id, userId: req.user.id });
                return res.status(200).json({
                    code: 200,
                    msg: '拍賣結算完成，無參與者',
                    detail: `拍賣 ${id} 無參與者，已標記為取消。`,
                });
            }
            const randomIndex = Math.floor(Math.random() * bids.length);
            const winnerBid = bids[randomIndex];
            highestBidder = winnerBid.userId;
            finalPrice = auction.startingPrice; // 抽籤使用起始價格
            auction.highestBidder = highestBidder._id;
            auction.currentPrice = finalPrice;
            await auction.save();
        }

        if (!highestBidder) {
            await Auction.findByIdAndUpdate(id, { status: 'cancelled', highestBidder: null });
            logger.info('Auction settled with no bidder', { auctionId: id, userId: req.user.id });
            return res.status(200).json({
                code: 200,
                msg: '拍賣結算完成，無中標者',
                detail: `拍賣 ${id} 無有效出價，已標記為取消。`,
            });
        }

        // 檢查得標者的 DKP 點數是否足夠
        if (highestBidder.dkpPoints < finalPrice) {
            let itemName = '未知物品';
            if (mongoose.Types.ObjectId.isValid(auction.itemId._id)) {
                const bossKill = auction.itemId;
                if (bossKill && bossKill.dropped_items?.length) {
                    const droppedItem = bossKill.dropped_items[0];
                    if (droppedItem) {
                        itemName = droppedItem.name || '未知物品';
                    }
                }
            }
            const formattedMessage = `系統：您的拍賣 ${itemName} (ID: ${id}) 結算時 DKP 點數不足（DKP: ${highestBidder.dkpPoints}，需: ${finalPrice}）。請聯繫管理員。`;
            const notification = new Notification({
                userId: highestBidder._id,
                message: formattedMessage,
                auctionId: id,
            });
            await notification.save();
            logger.warn('Highest bidder has insufficient DKP points', { auctionId: id, userId: highestBidder._id, dkpPoints: highestBidder.dkpPoints, finalPrice });
            return res.status(400).json({
                code: 400,
                msg: '中標者 DKP 點數不足',
                detail: `用戶 ${highestBidder.character_name} DKP 點數 (${highestBidder.dkpPoints}) 不足以支付 ${finalPrice}。`,
                suggestion: '請為用戶增加 DKP 點數、取消拍賣或重新分配。',
            });
        }

        // 扣除得標者的 DKP 點數
        const dkpDeduction = -finalPrice;
        const user = await User.findById(highestBidder._id);
        if (!user) {
            return res.status(404).json({
                code: 404,
                msg: '得標者不存在',
                detail: `無法找到 ID 為 ${highestBidder._id} 的用戶。`,
                suggestion: '請重新登錄或聯繫管理員。',
            });
        }

        user.dkpPoints = (user.dkpPoints || 0) + dkpDeduction;
        if (user.dkpPoints < 0) {
            user.dkpPoints = 0;
        }
        await user.save();

        // 記錄 DKP 變動
        const dkpRecord = new DKPRecord({
            userId: highestBidder._id,
            amount: dkpDeduction,
            type: 'deduction',
            description: `競標物品 ${auction.itemName || '未知物品'} 扣除 DKP`,
        });
        await dkpRecord.save();

        // 更新 BossKill 中的 dropped_items
        const bossKill = await BossKill.findById(auction.itemId);
        if (bossKill) {
            const itemIndex = 0; // 假設使用第一個 dropped_items
            if (bossKill.dropped_items[itemIndex]) {
                bossKill.dropped_items[itemIndex].final_recipient = highestBidder.character_name;
                bossKill.dropped_items[itemIndex].status = 'assigned';
                bossKill.markModified('dropped_items');
                await bossKill.save();
            }
        }

        // 管理員核實通過，拍賣進入 completed 狀態
        await Auction.findByIdAndUpdate(id, { status: 'completed' });
        logger.info('Auction status updated to completed', { auctionId: id });

        // 獲取 BossKill 記錄中的出席成員
        let attendees = [];
        if (mongoose.Types.ObjectId.isValid(auction.itemId._id)) {
            const bossKill = auction.itemId;
            if (bossKill && bossKill.attendees && Array.isArray(bossKill.attendees)) {
                attendees = bossKill.attendees;
            } else {
                logger.warn('No attendees found in BossKill record', { auctionId: id, bossKillId: auction.itemId._id });
            }
        } else {
            logger.warn('Invalid itemId for auction', { auctionId: id, itemId: auction.itemId });
        }

        // 分配收益給出席成員
        if (attendees.length > 0) {
            const sharePerMember = Math.floor(finalPrice / attendees.length);
            const totalDistributed = sharePerMember * attendees.length;
            const remainder = finalPrice - totalDistributed;

            logger.info('Distributing profits to attendees', { auctionId: id, finalPrice, attendeesCount: attendees.length, sharePerMember, remainder });

            const distributionPromises = attendees.map(async (attendeeId) => {
                try {
                    if (!mongoose.Types.ObjectId.isValid(attendeeId)) {
                        const user = await User.findOne({ character_name: attendeeId });
                        if (!user) {
                            logger.warn('Attendee not found by character_name', { attendeeId, auctionId: id });
                            return;
                        }
                        attendeeId = user._id;
                    }

                    const attendee = await User.findById(attendeeId);
                    if (!attendee) {
                        logger.warn('Attendee not found by ID', { attendeeId, auctionId: id });
                        return;
                    }
                    const updateResult = await User.findByIdAndUpdate(
                        attendee._id,
                        { $inc: { diamonds: sharePerMember } },
                        { new: true }
                    );
                    if (!updateResult) {
                        logger.error('Failed to add diamonds to attendee', { attendeeId: attendee._id, auctionId: id });
                        throw new Error(`Failed to add diamonds to attendee ${attendee._id}`);
                    }
                    logger.info('Diamonds added to attendee', { attendeeId: attendee._id, newDiamonds: updateResult.diamonds, share: sharePerMember });

                    const attendeeTransaction = new WalletTransaction({
                        userId: attendee._id,
                        amount: sharePerMember,
                        type: 'income',
                        source: 'auction',
                        description: `拍賣收益分配 (ID: ${id})`,
                        auctionId: id,
                    });
                    await attendeeTransaction.save();
                    logger.info('Attendee transaction recorded', { attendeeId: attendee._id, auctionId: id });
                } catch (err) {
                    logger.error('Error distributing to attendee', { attendeeId, auctionId: id, error: err.message, stack: err.stack });
                }
            });

            await Promise.all(distributionPromises);

            if (remainder > 0) {
                const guildAccount = await User.findOne({ character_name: GUILD_ACCOUNT_NAME });
                if (guildAccount) {
                    const guildUpdateResult = await User.findByIdAndUpdate(
                        guildAccount._id,
                        { $inc: { diamonds: remainder } },
                        { new: true }
                    );
                    if (!guildUpdateResult) {
                        logger.error('Failed to add remainder to guild account', { guildAccountId: guildAccount._id, auctionId: id });
                        throw new Error('Failed to add remainder to guild account');
                    }
                    logger.info('Remainder added to guild account', { guildAccountId: guildAccount._id, newDiamonds: guildUpdateResult.diamonds, remainder });
                    const guildTransaction = new WalletTransaction({
                        userId: guildAccount._id,
                        amount: remainder,
                        type: 'income',
                        source: 'auction',
                        description: `拍賣收益剩餘分配 (ID: ${id})`,
                        auctionId: id,
                    });
                    await guildTransaction.save();
                    logger.info('Guild remainder transaction recorded', { guildAccountId: guildAccount._id, auctionId: id });
                } else {
                    logger.warn('Guild account not found, remainder not distributed', { guildAccountName: GUILD_ACCOUNT_NAME, remainder });
                }
            }
        } else {
            logger.warn('No attendees to distribute profits, distributing to guild account', { auctionId: id });
            const guildAccount = await User.findOne({ character_name: GUILD_ACCOUNT_NAME });
            if (guildAccount) {
                const guildUpdateResult = await User.findByIdAndUpdate(
                    guildAccount._id,
                    { $inc: { diamonds: finalPrice } },
                    { new: true }
                );
                if (!guildUpdateResult) {
                    logger.error('Failed to add diamonds to guild account', { guildAccountId: guildAccount._id, auctionId: id });
                    throw new Error('Failed to add diamonds to guild account');
                }
                logger.info('Diamonds added to guild account', { guildAccountId: guildAccount._id, newDiamonds: guildUpdateResult.diamonds, amount: finalPrice });
                const guildTransaction = new WalletTransaction({
                    userId: guildAccount._id,
                    amount: finalPrice,
                    type: 'income',
                    source: 'auction',
                    description: `拍賣收益 (ID: ${id})`,
                    auctionId: id,
                });
                await guildTransaction.save();
                logger.info('Guild transaction recorded', { guildAccountId: guildAccount._id, auctionId: id });
            } else {
                logger.warn('Guild account not found, profits not distributed', { guildAccountName: GUILD_ACCOUNT_NAME });
            }
        }

        let itemName = '未知物品';
        if (mongoose.Types.ObjectId.isValid(auction.itemId._id)) {
            const bossKill = auction.itemId;
            if (bossKill && bossKill.dropped_items?.length) {
                const droppedItem = bossKill.dropped_items[0];
                if (droppedItem) {
                    itemName = droppedItem.name || '未知物品';
                }
            }
        }
        const itemHolderUser = await User.findOne({ character_name: auction.itemHolder });
        if (itemHolderUser) {
            const notification = new Notification({
                userId: itemHolderUser._id,
                message: `拍賣 ${itemName} (ID: ${id}) 已由管理員核實完成，請在得標頁回報交易完成。`,
                auctionId: id,
            });
            await notification.save();
            logger.info('Notification sent to item holder', { auctionId: id, itemHolder: auction.itemHolder, userId: itemHolderUser._id });
        } else {
            logger.warn('Item holder user not found for notification', { auctionId: id, itemHolder: auction.itemHolder });
        }

        logger.info('Auction settled successfully', { auctionId: id, userId: req.user.id, finalPrice, highestBidder: highestBidder._id });
        res.status(200).json({
            code: 200,
            msg: '拍賣核實成功',
            detail: `拍賣 ${id} 已核實，收益已分配給出席成員，等待物品持有人確認交易完成。`,
        });
    } catch (err) {
        logger.error('Error settling auction', { auctionId: id, userId: req.user.id, error: err.message, stack: err.stack });
        res.status(500).json({
            code: 500,
            msg: '拍賣結算失敗',
            detail: err.message || '伺服器處理錯誤',
            suggestion: '請稍後重試或聯繫管理員。',
        });
    }
});

// 取消拍賣路由
router.put('/:id/cancel', auth, async (req, res) => {
    const { id } = req.params;
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({
                code: 403,
                msg: '無權操作',
                detail: '只有管理員可以取消拍賣。',
            });
        }
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                code: 400,
                msg: '無效的拍賣 ID',
                detail: `提供的 auctionId (${id}) 不是有效的 MongoDB ObjectId。`,
                suggestion: '請刷新頁面並重試，或聯繫管理員。',
            });
        }
        const auction = await Auction.findById(id)
            .lean()
            .populate('highestBidder', 'character_name');
        if (!auction) {
            return res.status(404).json({
                code: 404,
                msg: '拍賣不存在',
                detail: `無法找到 ID 為 ${id} 的拍賣。`,
                suggestion: '請刷新頁面後重試或聯繫管理員檢查數據庫。',
            });
        }
        if (auction.status !== 'active' && auction.status !== 'pending') {
            return res.status(400).json({
                code: 400,
                msg: '拍賣狀態無效',
                detail: `拍賣 ${id} 狀態為 ${auction.status}，無法取消。`,
                suggestion: '只有活躍或待處理狀態的拍賣可以被取消。',
            });
        }
        let itemName = '未知物品';
        if (mongoose.Types.ObjectId.isValid(auction.itemId)) {
            const bossKill = await BossKill.findById(auction.itemId).populate('dropped_items');
            if (bossKill && bossKill.dropped_items?.length) {
                const droppedItem = bossKill.dropped_items[0];
                if (droppedItem) {
                    itemName = droppedItem.name || '未知物品';
                }
            }
        }
        const bids = await Bid.find({ auctionId: id }).populate('userId', 'character_name');
        const bidders = bids.map(bid => bid.userId);
        const notifications = bidders.map(bidder => new Notification({
            userId: bidder._id,
            message: `拍賣 ${itemName} (ID: ${id}) 已被管理員取消。`,
            auctionId: id,
        }));
        if (notifications.length > 0) {
            await Notification.insertMany(notifications);
        }
        await Auction.findByIdAndUpdate(id, { status: 'cancelled', highestBidder: null });
        logger.info('Auction cancelled successfully', { auctionId: id, userId: req.user.id });
        res.status(200).json({
            code: 200,
            msg: '拍賣已取消',
            detail: `拍賣 ${id} 已成功取消，所有出價者已收到通知。`,
        });
    } catch (err) {
        logger.error('Error cancelling auction', { auctionId: id, userId: req.user.id, error: err.message, stack: err.stack });
        res.status(500).json({
            code: 500,
            msg: '取消拍賣失敗',
            detail: err.message || '伺服器處理錯誤',
            suggestion: '請稍後重試或聯繫管理員。',
        });
    }
});

// 重新分配拍賣路由
router.put('/:id/reassign', auth, async (req, res) => {
    const { id } = req.params;
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({
                code: 403,
                msg: '無權操作',
                detail: '只有管理員可以重新分配拍賣。',
            });
        }
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                code: 400,
                msg: '無效的拍賣 ID',
                detail: `提供的 auctionId (${id}) 不是有效的 MongoDB ObjectId。`,
                suggestion: '請刷新頁面並重試，或聯繫管理員。',
            });
        }
        const auction = await Auction.findById(id)
            .populate('highestBidder', 'character_name');
        if (!auction) {
            return res.status(404).json({
                code: 404,
                msg: '拍賣不存在',
                detail: `無法找到 ID 為 ${id} 的拍賣。`,
                suggestion: '請刷新頁面後重試或聯繫管理員檢查數據庫。',
            });
        }
        if (auction.status !== 'pending') {
            return res.status(400).json({
                code: 400,
                msg: '拍賣狀態無效',
                detail: `拍賣 ${id} 狀態為 ${auction.status}，無法重新分配。`,
                suggestion: '只有待處理狀態的拍賣可以被重新分配。',
            });
        }
        let itemName = '未知物品';
        if (mongoose.Types.ObjectId.isValid(auction.itemId)) {
            const bossKill = await BossKill.findById(auction.itemId).populate('dropped_items');
            if (bossKill && bossKill.dropped_items?.length) {
                const droppedItem = bossKill.dropped_items[0];
                if (droppedItem) {
                    itemName = droppedItem.name || '未知物品';
                }
            }
        }
        const bids = await Bid.find({ auctionId: id })
            .populate('userId', 'character_name diamonds')
            .sort({ amount: -1 });
        if (!bids.length) {
            await Auction.findByIdAndUpdate(id, { status: 'cancelled', highestBidder: null });
            logger.info('Auction ended with no bidders after reassignment', { auctionId: id, userId: req.user.id });
            return res.status(200).json({
                code: 200,
                msg: '拍賣已結束，無中標者',
                detail: `拍賣 ${id} 無有效出價，已標記為取消。`,
            });
        }
        const currentHighestBidderId = auction.highestBidder ? auction.highestBidder._id.toString() : null;
        const nextHighestBid = bids.find(bid => bid.userId._id.toString() !== currentHighestBidderId);
        if (!nextHighestBid) {
            const notification = new Notification({
                userId: currentHighestBidderId,
                message: `您的拍賣 ${itemName} (ID: ${id}) 因無其他出價者已被結束。`,
            });
            await notification.save();
            await Auction.findByIdAndUpdate(id, { status: 'cancelled', highestBidder: null });
            logger.info('Auction ended with no other bidders after reassignment', { auctionId: id, userId: req.user.id });
            return res.status(200).json({
                code: 200,
                msg: '拍賣已結束，無其他出價者',
                detail: `拍賣 ${id} 無其他出價者，已標記為取消。`,
            });
        }
        const nextHighestBidder = nextHighestBid.userId;
        if (nextHighestBidder.diamonds < nextHighestBid.amount) {
            const notification = new Notification({
                userId: nextHighestBidder._id,
                message: `您的拍賣 ${itemName} (ID: ${id}) 已被重新分配給您，但您的餘額不足（餘額: ${nextHighestBidder.diamonds}，需: ${nextHighestBid.amount} 鑽石）。請充值後聯繫管理員。`,
            });
            await notification.save();
            await Auction.findByIdAndUpdate(id, {
                highestBidder: nextHighestBidder._id,
                currentPrice: nextHighestBid.amount,
                status: 'pending',
            });
            logger.warn('Next highest bidder has insufficient diamonds after reassignment', { auctionId: id, userId: nextHighestBidder._id, diamonds: nextHighestBidder.diamonds, amount: nextHighestBid.amount });
            return res.status(400).json({
                code: 400,
                msg: '次高出價者餘額不足',
                detail: `用戶 ${nextHighestBidder.character_name} 鑽石餘額 (${nextHighestBidder.diamonds}) 不足以支付 ${nextHighestBid.amount} 鑽石。`,
                suggestion: '請為用戶充值或再次重新分配。',
            });
        }
        if (currentHighestBidderId) {
            const notification = new Notification({
                userId: currentHighestBidderId,
                message: `您的拍賣 ${itemName} (ID: ${id}) 因餘額不足已被重新分配給其他出價者。`,
                auctionId: id,
            });
            await notification.save();
        }
        const notification = new Notification({
            userId: nextHighestBidder._id,
            message: `拍賣 ${itemName} (ID: ${id}) 已被重新分配給您，您的出價為 ${nextHighestBid.amount} 鑽石。請確保結算前餘額足夠。`,
            auctionId: id,
        });
        await notification.save();
        await Auction.findByIdAndUpdate(id, {
            highestBidder: nextHighestBidder._id,
            currentPrice: nextHighestBid.amount,
            status: 'completed',
        });

        const bidderTransaction = new WalletTransaction({
            userId: nextHighestBidder._id,
            amount: -nextHighestBid.amount,
            type: 'expense',
            source: 'auction',
            description: `拍賣重新分配得標扣款 (ID: ${id})`,
            auctionId: id,
        });
        await bidderTransaction.save();

        const guildAccount = await User.findOne({ character_name: GUILD_ACCOUNT_NAME });
        if (guildAccount) {
            const guildTransaction = new WalletTransaction({
                userId: guildAccount._id,
                amount: nextHighestBid.amount,
                type: 'income',
                source: 'auction',
                description: `拍賣重新分配收益 (ID: ${id})`,
                auctionId: id,
            });
            await guildTransaction.save();
        } else {
            logger.warn('Guild account not found during auction reassignment', { guildAccountName: GUILD_ACCOUNT_NAME });
        }

        logger.info('Auction reassigned successfully', { auctionId: id, userId: req.user.id, newHighestBidder: nextHighestBidder._id, amount: nextHighestBid.amount });
        res.status(200).json({
            code: 200,
            msg: '拍賣重新分配成功',
            detail: `拍賣 ${id} 已重新分配給用戶 ${nextHighestBidder.character_name}，出價為 ${nextHighestBid.amount} 鑽石。`,
        });
    } catch (err) {
        logger.error('Error reassigning auction', { auctionId: id, userId: req.user.id, error: err.message, stack: err.stack });
        res.status(500).json({
            code: 500,
            msg: '重新分配拍賣失敗',
            detail: err.message || '伺服器處理錯誤',
            suggestion: '請稍後重試或聯繫管理員。',
        });
    }
});

// 獲取出價歷史記錄
router.get('/:id/bids', auth, async (req, res) => {
    const auctionId = req.params.id;
    try {
        logger.info('Fetching bids for auction', { auctionId, userId: req.user.id });
        if (!mongoose.Types.ObjectId.isValid(auctionId)) {
            return res.status(400).json({
                code: 400,
                msg: '無效的競標 ID',
                detail: '請提供有效的競標 ID。',
            });
        }
        const auction = await Auction.findById(auctionId);
        if (!auction) {
            return res.status(404).json({
                code: 404,
                msg: '競標不存在',
                detail: `無法找到 ID 為 ${auctionId} 的競標。`,
            });
        }
        const bids = await Bid.find({ auctionId })
            .populate('userId', 'character_name')
            .sort({ created_at: -1 });
        const auctionType = auction.auctionType || 'open';
        if (auctionType === 'blind' && req.user.role !== 'admin') {
            // 暗標：非管理員只能看到自己的出價
            const userBids = bids.filter(bid => bid.userId._id.toString() === req.user.id);
            logger.info('Fetched user bids for blind auction', { auctionId, userId: req.user.id, count: userBids.length });
            res.json(userBids);
        } else {
            logger.info('Fetched bids', { auctionId, userId: req.user.id, count: bids.length });
            res.json(bids);
        }
    } catch (err) {
        logger.error('Error fetching bids', { auctionId, userId: req.user.id, error: err.message, stack: err.stack });
        res.status(500).json({
            code: 500,
            msg: '獲取出價歷史失敗',
            detail: err.message || '伺服器處理錯誤',
            suggestion: '請稍後重試或聯繫管理員。',
        });
    }
});

// 回報交易完成並觸發結算
router.put('/:id/complete-transaction', auth, async (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;
    try {
        logger.info('User attempting to complete transaction', { auctionId: id, userId });
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                code: 400,
                msg: '無效的拍賣 ID',
                detail: `提供的 auctionId (${id}) 不是有效的 MongoDB ObjectId。`,
                suggestion: '請刷新頁面並重試，或聯繫管理員。',
            });
        }
        const auction = await Auction.findById(id)
            .populate('highestBidder', 'character_name')
            .populate('createdBy', 'character_name')
            .populate('itemId');
        if (!auction) {
            return res.status(404).json({
                code: 404,
                msg: '拍賣不存在',
                detail: `無法找到 ID 為 ${id} 的拍賣。`,
                suggestion: '請刷新頁面後重試或聯繫管理員檢查數據庫。',
            });
        }
        let itemHolder = auction.itemHolder;
        if (auction.itemId && auction.itemId.itemHolder) {
            itemHolder = auction.itemId.itemHolder;
        }
        if (itemHolder !== req.user.character_name) {
            return res.status(403).json({
                code: 403,
                msg: '無權操作',
                detail: '只有物品持有人可以回報交易完成。',
            });
        }
        if (auction.status !== 'completed') {
            return res.status(400).json({
                code: 400,
                msg: '拍賣狀態無效',
                detail: `拍賣 ${id} 狀態為 ${auction.status}，必須為 completed 才能回報交易完成。`,
                suggestion: '請確保拍賣已進入 completed 狀態。',
            });
        }
        const highestBidder = auction.highestBidder;
        if (!highestBidder) {
            return res.status(400).json({
                code: 400,
                msg: '無中標者',
                detail: `拍賣 ${id} 無中標者，無法結算。`,
            });
        }
        let finalPrice = auction.currentPrice;
        if (auction.buyoutPrice && auction.currentPrice > auction.buyoutPrice) {
            finalPrice = auction.buyoutPrice;
        }
        const existingTransaction = await WalletTransaction.findOne({
            userId: highestBidder._id,
            auctionId: id,
            type: 'expense',
            source: 'auction',
        });
        let guildAccount = null;
        let hasDeducted = false;

        if (!existingTransaction) {
            logger.info('No existing transaction found, deducting diamonds', { userId: highestBidder._id, auctionId: id, amount: finalPrice });
            const updateResult = await User.findByIdAndUpdate(
                highestBidder._id,
                { $inc: { diamonds: -finalPrice } },
                { new: true }
            );
            if (!updateResult) {
                logger.error('Failed to deduct diamonds from bidder', { userId: highestBidder._id, auctionId: id });
                throw new Error('Failed to deduct diamonds from bidder');
            }
            logger.info('Diamonds deducted successfully', { userId: highestBidder._id, newDiamonds: updateResult.diamonds });

            const bidderTransaction = new WalletTransaction({
                userId: highestBidder._id,
                amount: -finalPrice,
                type: 'expense',
                source: 'auction',
                description: `拍賣交易完成扣款 (ID: ${id})`,
                auctionId: id,
            });
            await bidderTransaction.save();
            logger.info('Bidder transaction recorded', { userId: highestBidder._id, auctionId: id });

            try {
                guildAccount = await User.findOne({ character_name: GUILD_ACCOUNT_NAME });
                if (guildAccount) {
                    const guildUpdateResult = await User.findByIdAndUpdate(
                        guildAccount._id,
                        { $inc: { diamonds: finalPrice } },
                        { new: true }
                    );
                    if (!guildUpdateResult) {
                        logger.error('Failed to add diamonds to guild account', { guildAccountId: guildAccount._id, auctionId: id });
                        throw new Error('Failed to add diamonds to guild account');
                    }
                    logger.info('Guild account diamonds updated', { guildAccountId: guildAccount._id, newDiamonds: guildUpdateResult.diamonds });
                    const guildTransaction = new WalletTransaction({
                        userId: guildAccount._id,
                        amount: finalPrice,
                        type: 'income',
                        source: 'auction',
                        description: `拍賣交易完成收益 (ID: ${id})`,
                        auctionId: id,
                    });
                    await guildTransaction.save();
                    logger.info('Guild transaction recorded', { guildAccountId: guildAccount._id, auctionId: id });
                } else {
                    logger.warn('Guild account not found, proceeding without guild account allocation', { guildAccountName: GUILD_ACCOUNT_NAME });
                }
            } catch (err) {
                logger.error('Error handling guild account', { error: err.message, stack: err.stack });
                guildAccount = null;
            }
            hasDeducted = true;
        } else {
            logger.info('Complete transaction already exists, checking actual deduction', { userId: highestBidder._id, auctionId: id });
            const bidderBefore = await User.findById(highestBidder._id);
            const expectedDiamonds = bidderBefore.diamonds + existingTransaction.amount;
            if (bidderBefore.diamonds >= expectedDiamonds) {
                logger.warn('Diamonds not deducted despite existing transaction', { userId: highestBidder._id, auctionId: id, currentDiamonds: bidderBefore.diamonds, expectedDiamonds });
                const updateResult = await User.findByIdAndUpdate(
                    highestBidder._id,
                    { $inc: { diamonds: -finalPrice } },
                    { new: true }
                );
                if (!updateResult) {
                    logger.error('Failed to deduct diamonds from bidder during correction', { userId: highestBidder._id, auctionId: id });
                    throw new Error('Failed to deduct diamonds from bidder during correction');
                }
                logger.info('Diamonds deducted during correction', { userId: highestBidder._id, newDiamonds: updateResult.diamonds });
                hasDeducted = true;
            } else {
                logger.info('Diamonds already deducted', { userId: highestBidder._id, auctionId: id });
                hasDeducted = true;
            }
            try {
                guildAccount = await User.findOne({ character_name: GUILD_ACCOUNT_NAME });
                if (!guildAccount) {
                    logger.warn('Guild account not found during notification', { guildAccountName: GUILD_ACCOUNT_NAME });
                }
            } catch (err) {
                logger.error('Error fetching guild account for notification', { error: err.message, stack: err.stack });
                guildAccount = null;
            }
        }

        let itemName = '未知物品';
        if (mongoose.Types.ObjectId.isValid(auction.itemId._id)) {
            const bossKill = auction.itemId;
            if (bossKill && bossKill.dropped_items?.length) {
                const droppedItem = bossKill.dropped_items[0];
                if (droppedItem) {
                    itemName = droppedItem.name || '未知物品';
                }
            }
        }
        const bidderNotification = new Notification({
            userId: highestBidder._id,
            message: `拍賣 ${itemName} (ID: ${id}) 交易已完成，${hasDeducted ? `您已支付 ${finalPrice} 鑽石。` : '但未成功扣款，請聯繫管理員。'}`,
            auctionId: id,
        });
        const itemHolderNotification = new Notification({
            userId: userId,
            message: `拍賣 ${itemName} (ID: ${id}) 交易已完成，${guildAccount ? `旅團帳戶已收到 ${finalPrice} 鑽石。` : '旅團帳戶未設置，收益未分配。'}請在遊戲內或其他方式將物品交付給得標者。`,
            auctionId: id,
        });
        await Notification.insertMany([bidderNotification, itemHolderNotification]);

        await Auction.findByIdAndUpdate(id, { status: 'settled' });

        logger.info('Transaction completed and settled successfully', {
            auctionId: id,
            userId: req.user.id,
            highestBidder: highestBidder._id,
            itemHolder,
            finalPrice,
            guildAccountId: guildAccount ? guildAccount._id : 'not found',
            hasDeducted,
        });
        res.status(200).json({
            code: 200,
            msg: '交易完成，結算成功',
            detail: `用戶 ${highestBidder.character_name} 支付 ${finalPrice} 鑽石，${guildAccount ? `旅團帳戶收到 ${finalPrice} 鑽石。` : '旅團帳戶未設置，收益未分配。'}${!hasDeducted ? ' 但未成功扣款，請聯繫管理員。' : ''}`,
        });
    } catch (err) {
        logger.error('Error completing transaction', { auctionId: id, userId: req.user.id, error: err.message, stack: err.stack });
        res.status(500).json({
            code: 500,
            msg: '交易完成回報失敗',
            detail: err.message || '伺服器處理錯誤',
            suggestion: '請稍後重試或聯繫管理員。',
        });
    }
});

module.exports = router;