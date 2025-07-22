// models/DKPRecord.js
const mongoose = require('mongoose');

const dkpRecordSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    amount: {
        type: Number,
        required: true, // 正數表示增加，負數表示減少
    },
    type: {
        type: String,
        enum: ['participation', 'supplement', 'pickup', 'deduction', 'reclaim'],
        required: true, // 類型：參與、補單、撿取、扣除（分鑽單取消）、收回（管理員操作）
    },
    description: {
        type: String,
        required: true, // 描述，例如 "參與討伐聖物獵人凱爾"
    },
    bossKillId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'BossKill',
        default: null, // 關聯的擊殺記錄（如果適用）
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
});

module.exports = mongoose.model('DKPRecord', dkpRecordSchema);