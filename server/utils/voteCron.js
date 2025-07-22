// utils/voteCron.js
const schedule = require('node-schedule');
const Vote = require('../models/Vote');
const moment = require('moment-timezone'); // 導入 moment-timezone

const checkVoteStatus = () => {
    schedule.scheduleJob('*/20 * * * *', async () => {
        const now = moment.tz('Asia/Taipei');
        const expiredVotes = await Vote.find({ status: 'active', endTime: { $lt: now } });
        for (const vote of expiredVotes) {
            vote.status = 'closed';
            await vote.save();
            logger.info('Vote closed due to expiration', { voteId: vote._id });
        }
    });
};

module.exports = checkVoteStatus;