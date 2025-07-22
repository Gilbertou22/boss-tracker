const express = require('express');
const router = express.Router();
const AttendeeRequest = require('../models/AttendeeRequest');
const BossKill = require('../models/BossKill');
const { auth, adminOnly } = require('../middleware/auth');

// 獲取補登申請列表（管理員）
router.get('/', auth, adminOnly, async (req, res) => {
    try {
        const { status } = req.query;
        let query = {};

        if (status && status !== 'all') {
            query.status = status;
        }

        const requests = await AttendeeRequest.find(query)
            .populate({
                path: 'kill_id',
                select: 'kill_time bossId',
                populate: {
                    path: 'bossId',
                    select: 'name'
                }
            })
            .populate('user_id', 'character_name')
            .lean();

        // Transform the response to include boss_name
        const transformedRequests = requests.map(request => ({
            ...request,
            kill_id: request.kill_id ? {
                ...request.kill_id,
                boss_name: request.kill_id.bossId?.name || '未知'
            } : null
        }));

        res.json(transformedRequests);
    } catch (err) {
        console.error('Fetch attendee requests error:', err);
        res.status(500).json({ msg: '獲取補登申請失敗', error: err.message });
    }
});

// 提交補單申請
router.post('/', auth, async (req, res) => {
    const { kill_id, proof_image, reason } = req.body;
    const user = req.user;

    try {
        if (!kill_id) {
            return res.status(400).json({ msg: '缺少擊殺記錄 ID' });
        }

        const kill = await BossKill.findById(kill_id);
        if (!kill) {
            return res.status(404).json({ msg: '擊殺記錄不存在' });
        }

        if (kill.status !== 'pending') {
            return res.status(400).json({ msg: '該擊殺記錄已過補單期限' });
        }

        if (kill.attendees.includes(user.character_name)) {
            return res.status(400).json({ msg: '您已在參與者列表中，無需補單' });
        }

        const request = new AttendeeRequest({
            user_id: user.id,
            kill_id,
            character_name: user.character_name,
            proof_image: proof_image || null,
            reason: reason || '',
            status: 'pending',
        });

        await request.save();
        res.status(201).json({ msg: '補單申請提交成功，等待管理員審核', request });
    } catch (err) {
        console.error('Submit attendee request error:', err);
        res.status(500).json({ msg: '提交補單申請失敗', error: err.message });
    }
});

// 批准或拒絕補登申請（管理員）
router.put('/:id', auth, adminOnly, async (req, res) => {
    const { status, comment } = req.body;

    try {
        const request = await AttendeeRequest.findById(req.params.id);
        if (!request) {
            return res.status(404).json({ msg: '補登申請不存在' });
        }

        if (request.status !== 'pending') {
            return res.status(400).json({ msg: '該補登申請已處理，無法再次操作' });
        }

        if (status !== 'approved' && status !== 'rejected') {
            return res.status(400).json({ msg: '無效的狀態值，必須為 approved 或 rejected' });
        }

        if (status === 'rejected' && !comment) {
            return res.status(400).json({ msg: '拒絕申請時必須提供原因' });
        }

        request.status = status;
        request.comment = comment || '';
        request.updated_at = new Date();

        if (status === 'approved') {
            const kill = await BossKill.findById(request.kill_id);
            if (!kill) {
                return res.status(404).json({ msg: '擊殺記錄不存在' });
            }
            if (!kill.attendees.includes(request.character_name)) {
                kill.attendees.push(request.character_name);
                await kill.save();
            }
        }

        await request.save();
        res.json({ msg: `補登申請已${status === 'approved' ? '批准' : '拒絕'}`, request });
    } catch (err) {
        console.error('Update attendee request error:', err);
        res.status(500).json({ msg: '更新補登申請失敗', error: err.message });
    }
});

module.exports = router;