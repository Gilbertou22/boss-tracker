// models/BossDKPSetting.js
const mongoose = require('mongoose');

const bossDKPSettingSchema = new mongoose.Schema({
    bossId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Boss', // 參考 Boss 表
        required: true,
        unique: true, // 每隻 Boss 只能有一個 DKP 設定
    },
    dkpPoints: {
        type: Number,
        required: true, // 參與該 Boss 討伐可獲得的 DKP 點數
        min: 0, // 確保點數不為負數
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
    updatedAt: {
        type: Date,
        default: Date.now,
    },
});

// 在保存前更新 updatedAt 字段
bossDKPSettingSchema.pre('save', function (next) {
    this.updatedAt = Date.now();
    next();
});

module.exports = mongoose.model('BossDKPSetting', bossDKPSettingSchema);