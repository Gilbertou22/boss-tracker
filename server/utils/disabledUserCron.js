const cron = require('node-cron');
const User = require('../models/User');
const mongoose = require('mongoose');



const disabledUserCron = () => {
// 每天凌晨檢查用戶狀態
cron.schedule('0 0 * * *', async () => {
    try {
        const now = new Date();
        const thresholdDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000); // 90 天前

        // 檢查已退團或太久未登入的用戶
        await User.updateMany(
            {
                $or: [
                    { guildId: null, status: { $ne: 'disabled' } }, // 已退團
                    { lastLogin: { $lt: thresholdDate }, status: { $ne: 'disabled' } }, // 太久未登入
                ],
                roles: { $nin: ['admin', 'guild'] }, // 排除 admin 和 guild 角色
            },
            { $set: { status: 'disabled' } }
        );
        logger.info('自動檢查並設為 DISABLED 完成');
    } catch (err) {
        logger.error('自動檢查用戶狀態失敗:', err.message);
    }
});

};

module.exports = disabledUserCron;