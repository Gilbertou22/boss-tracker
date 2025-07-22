const mongoose = require('mongoose');

const bidSchema = new mongoose.Schema({
    auctionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Auction', required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    amount: { type: Number, required: true },
    timestamp: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Bid', bidSchema);