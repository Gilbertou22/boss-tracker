// models/Notification.js
const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    message: { type: String, required: true },
    auctionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Auction', default: null },
    voteId: { type: mongoose.Schema.Types.ObjectId, ref: 'Vote', default: null }, // 新增 voteId
    read: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Notification', notificationSchema);