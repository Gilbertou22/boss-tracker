const express = require('express');
const router = express.Router();
const BossKill = require('../models/BossKill');
const Application = require('../models/Application');
const Auction = require('../models/Auction');
const { auth } = require('../middleware/auth');
const logger = require('../logger');

router.get('/summary', auth, async (req, res) => {
    try {
        const { page = 1, pageSize = 10, character_name, min_applications, min_auctions } = req.query;

        const bossKills = await BossKill.find().populate('bossId', 'name').lean();
        const applications = await Application.find().populate('user_id', 'character_name').lean();
        const auctions = await Auction.find().populate('highestBidder', 'character_name').lean();

        const totalBossKills = bossKills.length;
        const totalApplications = applications.length;
        const totalAuctions = auctions.length;

        // Calculate items assigned and pending based on BossKill status
        const itemsAssigned = bossKills.reduce((sum, kill) => {
            return sum + (kill.status === 'assigned' ? 1 : 0);
        }, 0);
        const itemsPending = bossKills.reduce((sum, kill) => {
            return sum + (kill.status === 'pending' ? 1 : 0);
        }, 0);

        // Aggregate boss stats by bossId
        const bossStats = await BossKill.aggregate([
            {
                $group: {
                    _id: '$bossId',
                    count: { $sum: 1 }
                }
            },
            {
                $lookup: {
                    from: 'bosses',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'boss'
                }
            },
            {
                $unwind: '$boss'
            },
            {
                $project: {
                    _id: 0,
                    bossId: '$_id',
                    bossName: '$boss.name',
                    count: 1
                }
            },
            {
                $sort: { count: -1 }
            }
        ]);

        // Aggregate user stats
        const userStats = await Application.aggregate([
            {
                $group: {
                    _id: '$user_id',
                    applicationCount: { $sum: 1 }
                }
            },
            {
                $lookup: {
                    from: 'users',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'user'
                }
            },
            {
                $unwind: '$user'
            },
            {
                $lookup: {
                    from: 'auctions',
                    let: { userId: '$_id' },
                    pipeline: [
                        {
                            $match: {
                                $expr: { $eq: ['$highestBidder', '$$userId'] }
                            }
                        },
                        {
                            $count: 'auctionCount'
                        }
                    ],
                    as: 'auctions'
                }
            },
            {
                $lookup: {
                    from: 'bosskills',
                    let: { characterName: '$user.character_name' },
                    pipeline: [
                        {
                            $match: {
                                $expr: {
                                    $and: [
                                        { $eq: ['$status', 'assigned'] },
                                        { $eq: [{ $arrayElemAt: ['$dropped_items.final_recipient', 0] }, '$$characterName'] }
                                    ]
                                }
                            }
                        },
                        {
                            $count: 'itemReceived'
                        }
                    ],
                    as: 'itemsReceived'
                }
            },
            {
                $project: {
                    _id: 1,
                    character_name: '$user.character_name',
                    applicationCount: 1,
                    auctionCount: { $ifNull: [{ $arrayElemAt: ['$auctions.auctionCount', 0] }, 0] },
                    itemReceived: { $ifNull: [{ $arrayElemAt: ['$itemsReceived.itemReceived', 0] }, 0] }
                }
            },
            {
                $match: {
                    ...(character_name ? { character_name } : {}),
                    ...(min_applications ? { applicationCount: { $gte: parseInt(min_applications) } } : {}),
                    ...(min_auctions ? { auctionCount: { $gte: parseInt(min_auctions) } } : {})
                }
            },
            {
                $skip: (parseInt(page) - 1) * parseInt(pageSize)
            },
            {
                $limit: parseInt(pageSize)
            }
        ]);

        // Calculate total user stats count for pagination
        const totalUserStats = await Application.aggregate([
            {
                $group: {
                    _id: '$user_id',
                    applicationCount: { $sum: 1 }
                }
            },
            {
                $lookup: {
                    from: 'users',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'user'
                }
            },
            {
                $unwind: '$user'
            },
            {
                $lookup: {
                    from: 'auctions',
                    let: { userId: '$_id' },
                    pipeline: [
                        {
                            $match: {
                                $expr: { $eq: ['$highestBidder', '$$userId'] }
                            }
                        },
                        {
                            $count: 'auctionCount'
                        }
                    ],
                    as: 'auctions'
                }
            },
            {
                $project: {
                    _id: 1,
                    character_name: '$user.character_name',
                    applicationCount: 1,
                    auctionCount: { $ifNull: [{ $arrayElemAt: ['$auctions.auctionCount', 0] }, 0] }
                }
            },
            {
                $match: {
                    ...(character_name ? { character_name } : {}),
                    ...(min_applications ? { applicationCount: { $gte: parseInt(min_applications) } } : {}),
                    ...(min_auctions ? { auctionCount: { $gte: parseInt(min_auctions) } } : {})
                }
            },
            {
                $count: 'total'
            }
        ]);

        const stats = {
            totalBossKills,
            totalAuctions,
            totalApplications,
            totalDiamonds: 0, // Placeholder; implement actual logic if needed
            applicationSuccessRate: totalApplications > 0 ? (applications.filter(a => a.status === 'approved').length / totalApplications * 100) : 0,
            auctionSuccessRate: totalAuctions > 0 ? (auctions.filter(a => a.status === 'completed').length / totalAuctions * 100) : 0,
            itemsAssigned,
            itemsPending,
            bossStats,
            userStats,
            pagination: {
                total: totalUserStats[0]?.total || 0,
                page: parseInt(page),
                pageSize: parseInt(pageSize)
            }
        };

        logger.info('Stats summary generated', { stats });
        res.json(stats);
    } catch (err) {
        logger.error('Error generating stats summary:', { error: err.message, stack: err.stack });
        res.status(500).json({ msg: err.message || '伺服器處理錯誤' });
    }
});

module.exports = router;