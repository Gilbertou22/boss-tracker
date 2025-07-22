const mongoose = require('mongoose');

const loginRecordSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    characterName: {
        type: String,
        required: true,
    },
    ipAddress: {
        type: String,
        required: true,
    },
    loginTime: {
        type: Date,
        default: Date.now,
    },
    userAgent: {
        type: String,
        default: '',
    },
});

// 設置索引以便快速查詢和自動過期
loginRecordSchema.index({ loginTime: 1 }, { expireAfterSeconds: 45 * 24 * 60 * 60 }); // 45 天後自動刪除

module.exports = mongoose.model('LoginRecord', loginRecordSchema);