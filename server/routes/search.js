const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const BossKill = require('../models/BossKill');
const User = require('../models/User');
const Boss = require('../models/Boss');
const Item = require('../models/Item');
const ItemLevel = require('../models/ItemLevel');
const Role = require('../models/Role');
const { auth } = require('../middleware/auth');
const logger = require('../logger');

// 自動補全 API (支援空查詢以返回所有記錄)
router.get('/autocomplete', auth, async (req, res) => {
    try {
        const { type, query } = req.query;
        if (!type) {
            return res.status(400).json({ msg: '缺少 type 參數' });
        }

        let results = [];
        if (type === 'member') {
            const adminRole = await Role.findOne({ name: 'admin' });
            if (!adminRole) {
                logger.error('Autocomplete: Admin role not found');
                return res.status(500).json({ msg: '伺服器錯誤：無法找到 admin 角色' });
            }
            const match = {
                roles: { $ne: adminRole._id }, // 排除 admin 角色
                status: { $ne: 'disabled' }, // 排除 disabled 用戶
            };
           
            if (query) {
                match.character_name = { $regex: query, $options: 'i' };
            }
            results = await User.find(match)
                .select('character_name guildId status roles')
                .lean()
                .then(users => {
                    logger.info(`Autocomplete: Found ${users.length} non-admin, non-disabled users: ${JSON.stringify(users.map(u => ({ character_name: u.character_name, guildId: u.guildId, status: u.status, roles: u.roles })))}`);
                    return users.map(user => user.character_name);
                });
        } else if (type === 'boss') {
            const match = {};
            if (query) {
                match.name = { $regex: query, $options: 'i' };
            }
            results = await Boss.find(match)
                .select('name')
                .lean()
                .then(bosses => {
                    logger.info(`Autocomplete: Found ${bosses.length} bosses: ${JSON.stringify(bosses.map(b => b.name))}`);
                    return bosses.map(boss => boss.name);
                });
        } else if (type === 'item') {
            const match = {};
            if (query) {
                match.name = { $regex: query, $options: 'i' };
            }
            results = await Item.find(match)
                .select('name')
                .lean()
                .then(items => {
                    logger.info(`Autocomplete: Found ${items.length} items: ${JSON.stringify(items.map(i => i.name))}`);
                    return items.map(item => item.name);
                });
        } else {
            return res.status(400).json({ msg: '無效的 type 參數' });
        }

        res.json({ type, results });
    } catch (err) {
        logger.error('Autocomplete error:', err.message);
        res.status(500).json({ msg: '獲取自動補全建議失敗', error: err.message });
    }
});

// 通用查詢 API
router.get('/', auth, async (req, res) => {
    try {
        const { type, query, itemLevel, startTime, endTime, page = 1, pageSize = 10 } = req.query;
        const skip = (page - 1) * pageSize;
        let match = {};
        let data = [];
        let total = 0;

        if (type === 'member') {
            const user = await User.findOne({ character_name: query });
            if (!user) {
                return res.status(404).json({ msg: '用戶不存在' });
            }
            match = {
                $or: [
                    { attendees: query },
                    { 'dropped_items.final_recipient': query }
                ]
            };
            if (itemLevel) match['dropped_items.level'] = (await ItemLevel.findOne({ level: itemLevel }))._id;
            if (startTime) match.kill_time = { $gte: new Date(startTime) };
            if (endTime) match.kill_time = { ...match.kill_time, $lte: new Date(endTime) };

            const killRecords = await BossKill.find(match)
                .populate('bossId', 'name')
                .populate('dropped_items.level', 'level')
                .skip(skip)
                .limit(parseInt(pageSize))
                .lean();

            total = await BossKill.countDocuments(match);
            data = killRecords.flatMap(record =>
                record.dropped_items.map(item => ({
                    _id: `${record._id}_${item._id}`,
                    character_name: query, // Always use queried member
                    is_final_recipient: item.final_recipient === query, // Indicate if member was final_recipient
                    boss_name: record.bossId?.name || '未知首領',
                    item_name: item.name,
                    item_level: item.level?.level || '一般',
                    item_type: item.type,
                    kill_time: record.kill_time,
                    application_status: item.status || 'pending',
                    final_recipient: item.final_recipient || '-' // Show actual final_recipient
                }))
            );
            logger.info(`Search: Found ${data.length} items for member ${query} in ${killRecords.length} BossKill records`);
        } else if (type === 'boss') {
            const boss = await Boss.findOne({ name: query });
            if (!boss) {
                return res.status(404).json({ msg: '首領不存在' });
            }
            match = { bossId: boss._id };
            if (itemLevel) match['dropped_items.level'] = (await ItemLevel.findOne({ level: itemLevel }))._id;
            if (startTime) match.kill_time = { $gte: new Date(startTime) };
            if (endTime) match.kill_time = { ...match.kill_time, $lte: new Date(endTime) };

            const killRecords = await BossKill.find(match)
                .populate('bossId', 'name')
                .populate('dropped_items.level', 'level')
                .skip(skip)
                .limit(parseInt(pageSize))
                .lean();

            total = await BossKill.countDocuments(match);
            data = killRecords.flatMap(record =>
                record.dropped_items.map(item => ({
                    _id: `${record._id}_${item._id}`,
                    character_name: item.final_recipient || '-',
                    is_final_recipient: !!item.final_recipient,
                    boss_name: record.bossId?.name || '未知首領',
                    item_name: item.name,
                    item_level: item.level?.level || '一般',
                    item_type: item.type,
                    kill_time: record.kill_time,
                    application_status: item.status || 'pending',
                    final_recipient: item.final_recipient || '-'
                }))
            );
        } else if (type === 'item') {
            match = { 'dropped_items.name': query };
            if (itemLevel) match['dropped_items.level'] = (await ItemLevel.findOne({ level: itemLevel }))._id;
            if (startTime) match.kill_time = { $gte: new Date(startTime) };
            if (endTime) match.kill_time = { ...match.kill_time, $lte: new Date(endTime) };

            const aggregation = await BossKill.aggregate([
                { $match: match }, // Fixed: Use { $match: match }
                { $unwind: '$dropped_items' },
                { $match: { 'dropped_items.name': query } },
                {
                    $lookup: {
                        from: 'bosses',
                        localField: 'bossId',
                        foreignField: '_id',
                        as: 'bossId',
                    },
                },
                { $unwind: { path: '$bossId', preserveNullAndEmptyArrays: true } },
                {
                    $lookup: {
                        from: 'itemlevels',
                        localField: 'dropped_items.level',
                        foreignField: '_id',
                        as: 'dropped_items.level',
                    },
                },
                { $unwind: { path: '$dropped_items.level', preserveNullAndEmptyArrays: true } },
                {
                    $group: {
                        _id: {
                            item_name: '$dropped_items.name',
                            boss_name: '$bossId.name',
                            item_level: '$dropped_items.level.level',
                        },
                        drop_count: { $sum: 1 },
                        records: {
                            $push: {
                                character_name: '$dropped_items.final_recipient',
                                kill_time: '$kill_time',
                                application_status: '$dropped_items.status',
                                item_type: '$dropped_items.type',
                            },
                        },
                    },
                },
                {
                    $project: {
                        _id: 0,
                        item_name: '$_id.item_name',
                        boss_name: '$_id.boss_name',
                        item_level: '$_id.item_level',
                        drop_count: 1,
                        records: 1,
                    },
                },
                { $unwind: '$records' },
                { $skip: skip },
                { $limit: parseInt(pageSize) },
            ]);

            total = (await BossKill.aggregate([
                { $match: match }, // Fixed: Use { $match: match }
                { $unwind: '$dropped_items' },
                { $match: { 'dropped_items.name': query } },
                { $group: { _id: '$dropped_items.name', count: { $sum: 1 } } },
            ]))[0]?.count || 0;

            data = aggregation.map(item => ({
                _id: `${item.item_name}_${item.boss_name}`,
                character_name: item.records.character_name || '-',
                is_final_recipient: !!item.records.character_name,
                boss_name: item.boss_name || '未知首領',
                item_name: item.item_name,
                item_level: item.item_level || '一般',
                item_type: item.records.item_type,
                kill_time: item.records.kill_time,
                application_status: item.records.application_status || 'pending',
                final_recipient: item.records.character_name || '-',
                drop_count: item.drop_count,
            }));
        } else {
            return res.status(400).json({ msg: '無效的 type 參數' });
        }

        res.json({ data, pagination: { current: parseInt(page), pageSize: parseInt(pageSize), total } });
    } catch (err) {
        logger.error('Search error:', err.message);
        res.status(500).json({ msg: '查詢失敗', error: err.message });
    }
});

module.exports = router;