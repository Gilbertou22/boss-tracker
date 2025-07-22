const cron = require('node-cron');
const BossKill = require('../models/BossKill');
const mongoose = require('mongoose');

const startItemExpirationCron = () => {
    try {
       
        if (!cron) {
            console.error('node-cron is not available');
            return false;
        }

        // 每小時檢查一次（可根據需求調整）
        const task = cron.schedule('0 * * * *', async () => {
            try {
           

                // 查找所有未分配且過期的 BossKill 記錄
                const now = new Date();
                const expiredKills = await BossKill.find({
                    status: 'pending',
                    'dropped_items.apply_deadline': { $lt: now },
                    final_recipient: null,
                });

                if (expiredKills.length === 0) {
                    console.log('No expired items found.');
                    return;
                }

                console.log(`Found ${expiredKills.length} expired kills to process.`);

                for (const kill of expiredKills) {
                    // 檢查是否有任何 dropped_items 過期
                    const hasExpiredItems = kill.dropped_items.some(item => new Date(item.apply_deadline) < now);
                    if (hasExpiredItems) {
                        kill.status = 'expired';
                        await kill.save();
                        console.log(`Marked BossKill ${kill._id} as expired.`);
                    }
                }
            } catch (err) {
                console.error('Error in item expiration cron:', err);
            }
        }, {
            scheduled: true,
            timezone: 'Asia/Taipei',
        });

        if (task) {
            console.log('Item expiration cron job started successfully.');
            return true;
        } else {
            console.warn('Failed to schedule item expiration cron.');
            return false;
        }
    } catch (err) {
        console.error('Failed to start item expiration cron:', err);
        return false;
    }
};

module.exports = startItemExpirationCron;