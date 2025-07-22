const mongoose = require('mongoose');

const walletTransactionSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    amount: {
        type: Number,
        required: true, // 正數表示收入，負數表示支出
    },
    type: {
        type: String,
        enum: ['income', 'expense'], // 收入或支出
        required: true,
    },
    source: {
        type: String,
        required: true, // 來源，例如 "auction", "recharge", "system"
    },
    description: {
        type: String, // 描述，例如 "拍賣得標扣款 (ID: xxx)", "充值 1000 鑽石"
    },
    auctionId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Auction', // 如果與拍賣相關，記錄拍賣ID
        default: null,
    },
    timestamp: {
        type: Date,
        default: Date.now,
    },
});

module.exports =  mongoose.model('WalletTransaction', walletTransactionSchema);