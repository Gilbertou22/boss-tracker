// models/Profession.js
const mongoose = require('mongoose');

const professionSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        unique: true,
        trim: true,
    },
    icon: {
        type: String,
        required: true, // 存儲圖標路徑，例如 './svg/icon_class_1.svg'
    },
    description: {
        type: String,
        default: '',
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

// 在保存時自動更新 updatedAt 字段
professionSchema.pre('save', function (next) {
    this.updatedAt = Date.now();
    next();
});

module.exports = mongoose.model('Profession', professionSchema);