const express = require('express');
const router = express.Router();
const BossKill = require('../models/BossKill');
const Application = require('../models/Application');
const Auction = require('../models/Auction'); // 確保定義，若無則移除
const { auth } = require('../middleware/auth');

router.get('/summary', auth, async (req, res) => {
    try {
        const { page = 1, pageSize = 10, character_name, min_applications, min_auctions } = req.query;

        const bossKills = await BossKill.find();
        const applications = await Application.find().populate('user_id', 'character_name');
        const auctions = await Auction.find().populate('user_id', 'character_name');

        const stats = {
            totalBossKills: bossKills.length,
            totalAuctions: auctions.length,
            totalApplications: applications.length,
            totalDiamonds: 0, // 需根據業務邏輯計算
            applicationSuccessRate: (applications.filter(a => a.status === 'assigned').length / applications.length * 100) || 0,
            auctionSuccessRate: (auctions.filter(a => a.status === 'completed').length / auctions.length * 100) || 0,
            bossStats: await BossKill.aggregate([{ $group: { _id: '$boss_name', count: { $sum: 1 } } }]),
            userStats: await Application.aggregate([
                { $group: { _id: '$user_id', applicationCount: { $sum: 1 } } },
                { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'user' } },
                { $unwind: '$user' },
                {
                    $project: {
                        _id: 1,
                        character_name: '$user.character_name',
                        applicationCount: 1,
                        auctionCount: { $size: { $ifNull: [{ $filter: { input: auctions, cond: { $eq: ['$$this.user_id', '$_id'] } } }, []] } },
                        itemReceived: {
                            $size: {
                                $ifNull: [{
                                    $filter: {
                                        input: bossKills, cond: {
                                            $and: [
                                                { $eq: ['$$this.status', 'assigned'] },
                                                { $eq: ['$user.character_name', '$$this.final_recipient'] }
                                            ]
                                        }
                                    }
                                }, []]
                            }
                        }
                    }
                },
            ]).skip((page - 1) * pageSize).limit(pageSize),
            itemsAssigned: bossKills.reduce((sum, kill) => sum + (kill.status === 'assigned' ? kill.dropped_items.length : 0), 0),
            itemsPending: bossKills.reduce((sum, kill) => sum + (kill.status === 'pending' ? kill.dropped_items.length : 0), 0),
            pagination: { total: await Application.countDocuments(), page, pageSize },
        };

        // 應用篩選
        let filteredUserStats = stats.userStats;
        if (character_name) {
            filteredUserStats = filteredUserStats.filter(stat => stat.character_name === character_name);
        }
        if (min_applications) {
            filteredUserStats = filteredUserStats.filter(stat => stat.applicationCount >= min_applications);
        }
        if (min_auctions) {
            filteredUserStats = filteredUserStats.filter(stat => stat.auctionCount >= min_auctions);
        }
        stats.userStats = filteredUserStats;
        stats.pagination.total = filteredUserStats.length;

        res.json(stats);
    } catch (err) {
        res.status(500).json({ msg: err.message });
    }
});

module.exports = router;