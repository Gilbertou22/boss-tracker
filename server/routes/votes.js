const express = require('express');
const router = express.Router();
const Vote = require('../models/Vote');
const User = require('../models/User');
const Notification = require('../models/Notification'); // 確保導入
const { auth, adminOnly } = require('../middleware/auth');
const logger = require('../logger');
const moment = require('moment-timezone'); // 修正為 moment-timezone

router.post('/create', auth, adminOnly, async (req, res) => {
    try {
        const { title, options, startTime, endTime, multipleChoice, participantIds } = req.body;

        if (!title || !options || !Array.isArray(options) || options.length < 2) {
            return res.status(400).json({ msg: '請提供有效的投票主題和至少兩個選項' });
        }

        if (!moment(startTime).isValid() || !moment(endTime).isValid() || moment(startTime).isAfter(endTime)) {
            return res.status(400).json({ msg: '請提供有效的開始和結束時間' });
        }

        const participants = [];
        if (participantIds && Array.isArray(participantIds)) {
            for (const id of participantIds) {
                const user = await User.findById(id);
                if (user) participants.push(user._id);
            }
        } else {
            const guildMembers = await User.find({ guildId: (await User.findById(req.user.id)).guildId });
            participants.push(...guildMembers.map(member => member._id));
        }

        const vote = new Vote({
            title,
            options: options.map(option => ({ text: option, votes: 0 })),
            startTime: moment.tz(startTime, 'Asia/Taipei').toDate(),
            endTime: moment.tz(endTime, 'Asia/Taipei').toDate(),
            createdBy: req.user.id,
            participants,
            multipleChoice,
        });

        await vote.save();
        logger.info('Vote created successfully', { voteId: vote._id, userId: req.user.id });

        // 發送公告給參與者，使用 voteId
        const sender = await User.findById(req.user.id).lean();
        const senderName = sender?.character_name || '管理員';
        const message = `${senderName} 發起了一項新投票 "${title}"！\n開始時間: ${moment.tz(startTime, 'Asia/Taipei').format('YYYY-MM-DD HH:mm')}\n結束時間: ${moment.tz(endTime, 'Asia/Taipei').format('YYYY-MM-DD HH:mm')}\n請訪問 /vote 頁面參與投票。`;
        const notifications = participants.map(userId => ({
            userId,
            message,
            voteId: vote._id, // 使用 voteId
            read: false,
        }));
        await Notification.insertMany(notifications);
        logger.info('Notifications sent for vote', { voteId: vote._id, count: notifications.length });

        res.status(201).json({ msg: '投票創建成功', voteId: vote._id });
    } catch (err) {
        logger.error('Create vote error', { userId: req.user.id, error: err.message, stack: err.stack });
        res.status(500).json({ msg: '創建投票失敗', error: err.message });
    }
});

router.get('/', auth, async (req, res) => {
    try {
        const votes = await Vote.find({
            $or: [
                { participants: req.user.id, status: 'active', endTime: { $gt: new Date() } },
                { 'votes.userId': req.user.id } // 允許查看自己參與過的投票
            ]
        }).lean();
        res.json(votes);
    } catch (err) {
        logger.error('Fetch votes error', { userId: req.user.id, error: err.message, stack: err.stack });
        res.status(500).json({ msg: '獲取投票列表失敗', error: err.message });
    }
});

router.get('/all', auth, adminOnly, async (req, res) => {
    try {
        const votes = await Vote.find().lean();
        res.json(votes);
    } catch (err) {
        logger.error('Fetch all votes error', { userId: req.user.id, error: err.message, stack: err.stack });
        res.status(500).json({ msg: '獲取所有投票列表失敗', error: err.message });
    }
});

router.post('/:voteId/vote', auth, async (req, res) => {
    try {
        const { voteId } = req.params;
        const { optionIndexes } = req.body;

        const vote = await Vote.findById(voteId);
        if (!vote) return res.status(404).json({ msg: '投票不存在' });

        if (vote.status !== 'active' || moment().isAfter(vote.endTime)) {
            return res.status(400).json({ msg: '投票已結束' });
        }

        if (!vote.participants.includes(req.user.id)) {
            return res.status(403).json({ msg: '您無權參與此投票' });
        }

        if (vote.votes.some(v => v.userId.toString() === req.user.id.toString())) {
            return res.status(400).json({ msg: '您已投票' });
        }

        if (!vote.multipleChoice && (!Array.isArray(optionIndexes) || optionIndexes.length !== 1)) {
            return res.status(400).json({ msg: '請選擇一個選項' });
        }

        if (vote.multipleChoice && (!Array.isArray(optionIndexes) || optionIndexes.some(i => i < 0 || i >= vote.options.length))) {
            return res.status(400).json({ msg: '無效的選項索引' });
        }

        optionIndexes.forEach(index => {
            vote.options[index].votes += 1;
        });
        vote.votes.push({ userId: req.user.id, optionIndex: optionIndexes[0] });
        await vote.save();

        logger.info('Vote submitted successfully', { voteId, userId: req.user.id, optionIndexes });
        res.json({ msg: '投票成功' });
    } catch (err) {
        logger.error('Vote submission error', { voteId, userId: req.user.id, error: err.message, stack: err.stack });
        res.status(500).json({ msg: '提交投票失敗', error: err.message });
    }
});

router.get('/:voteId/results', auth, async (req, res) => {
    try {
        const { voteId } = req.params;
        const vote = await Vote.findById(voteId).lean();
        if (!vote) return res.status(404).json({ msg: '投票不存在' });

        // 允許創建者、管理員或參與過投票的用戶查看結果
        if (vote.status !== 'closed' && vote.createdBy.toString() !== req.user.id && req.user.role !== 'admin' && !vote.votes.some(v => v.userId.toString() === req.user.id.toString())) {
            return res.status(403).json({ msg: '投票尚未結束，僅限創建者、管理員或參與者查看結果' });
        }

        res.json({
            title: vote.title,
            options: vote.options,
            totalVotes: vote.votes.length,
            status: vote.status,
        });
    } catch (err) {
        logger.error('Fetch vote results error', { voteId, userId: req.user.id, error: err.message, stack: err.stack });
        res.status(500).json({ msg: '獲取投票結果失敗', error: err.message });
    }
});

router.put('/:voteId', auth, adminOnly, async (req, res) => {
    try {
        const { voteId } = req.params;
        const { title, options, startTime, endTime, multipleChoice, participantIds } = req.body;

        const vote = await Vote.findById(voteId);
        if (!vote) return res.status(404).json({ msg: '投票不存在' });

        // 檢查是否有成員投票或已過期
        const now = moment.tz('Asia/Taipei');
        if (vote.votes.length > 0 || now.isAfter(vote.endTime) || vote.status === 'closed') {
            return res.status(403).json({ msg: '已有成員投票或投票已過期，無法修改' });
        }

        if (title) vote.title = title;
        if (options && Array.isArray(options) && options.length >= 2) {
            vote.options = options.map((text, index) => ({
                text,
                votes: vote.options[index] ? vote.options[index].votes : 0,
            }));
        }
        if (startTime && moment(startTime).isValid()) vote.startTime = moment.tz(startTime, 'Asia/Taipei').toDate();
        if (endTime && moment(endTime).isValid()) vote.endTime = moment.tz(endTime, 'Asia/Taipei').toDate();
        if (multipleChoice !== undefined) vote.multipleChoice = multipleChoice;

        if (participantIds && Array.isArray(participantIds)) {
            const participants = [];
            for (const id of participantIds) {
                const user = await User.findById(id);
                if (user) participants.push(user._id);
            }
            vote.participants = participants;
        }

        await vote.save();
        logger.info('Vote updated successfully', { voteId, userId: req.user.id });
        res.json({ msg: '投票更新成功' });
    } catch (err) {
        logger.error('Update vote error', { voteId, userId: req.user.id, error: err.message, stack: err.stack });
        res.status(500).json({ msg: '更新投票失敗', error: err.message });
    }
});

router.delete('/:voteId', auth, adminOnly, async (req, res) => {
    try {
        const { voteId } = req.params;
        const vote = await Vote.findById(voteId);
        if (!vote) return res.status(404).json({ msg: '投票不存在' });

        // 檢查是否有成員投票或已過期
        const now = moment.tz('Asia/Taipei');
        if (vote.votes.length > 0 || now.isAfter(vote.endTime) || vote.status === 'closed') {
            return res.status(403).json({ msg: '已有成員投票或投票已過期，無法刪除' });
        }

        await Vote.deleteOne({ _id: voteId });
        logger.info('Vote deleted successfully', { voteId, userId: req.user.id });
        res.json({ msg: '投票刪除成功' });
    } catch (err) {
        logger.error('Delete vote error', { voteId, userId: req.user.id, error: err.message, stack: err.stack });
        res.status(500).json({ msg: '刪除投票失敗', error: err.message });
    }
});

module.exports = router;