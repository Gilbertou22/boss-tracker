// models/Auction.js
const mongoose = require('mongoose');

const AuctionSchema = new mongoose.Schema({
    itemId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: 'BossKill',
    },
    auctionType: {
        type: String,
        enum: ['open', 'blind', 'lottery'],
        default: 'open',
    },
    startingPrice: {
        type: Number,
        required: true,
    },
    currentPrice: {
        type: Number,
        required: true,
    },
    buyoutPrice: {
        type: Number,
    },
    endTime: {
        type: Date,
        required: true,
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    itemHolder: {
        type: String,
        required: true,
    },
    status: {
        type: String,
        enum: ['active', 'pending', 'completed', 'cancelled', 'settled'],
        default: 'active',
    },
    highestBidder: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
    },
    restrictions: {
        sameWorld: {
            type: Boolean,
            default: false,
        },
        hasAttended: {
            type: Boolean,
            default: false,
        },
        dkpThreshold: {
            type: Number,
            default: 0,
        },
        sameGuild: {
            type: Boolean,
            default: false,
        },
    },
    itemName: {
        type: String,
        required: true, // 保存所選物品的名稱
    },
    imageUrl: {
        type: String,
        default: '', // 保存所選物品的圖片 URL（如果有）
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
});

module.exports = mongoose.model('Auction', AuctionSchema);