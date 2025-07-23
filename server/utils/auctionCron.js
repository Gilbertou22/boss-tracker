const cron = require('node-cron');
const Auction = require('../models/Auction');
const User = require('../models/User');

const startAuctionCron = () => {
    cron.schedule('*/1 * * * *', async () => { // 每分鐘檢查
        const now = new Date();
        const auctions = await Auction.find({ status: 'active', endTime: { $lt: now } });
        for (const auction of auctions) {
            if (auction.highestBidder) {
                const winner = await User.findById(auction.highestBidder);
                // 這裡可添加通知邏輯
                //console.log(`Auction ${auction._id} ended, winner: ${winner.character_name}`);
            }
            auction.status = 'completed';
            await auction.save();
        }
    });
};

module.exports = startAuctionCron;