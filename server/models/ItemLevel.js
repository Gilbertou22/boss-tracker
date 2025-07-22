const mongoose = require('mongoose');

const itemLevelSchema = new mongoose.Schema({
    level: {
        type: String,
        enum: ['一般', '高級', '稀有', '英雄', '傳說', '神話'],
        required: true
    },
    color: {
        type: String,
        enum: ['白色', '綠色', '藍色', '紅色', '紫色', '金色'],
        required: true
    },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('ItemLevel', itemLevelSchema);