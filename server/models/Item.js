const mongoose = require('mongoose');

const itemSchema = new mongoose.Schema({
    name: { type: String, required: true },
    type: { type: String, enum: ['equipment', 'skill'], required: true },
    description: { type: String },
    imageUrl: { type: String },
    level: { type: mongoose.Schema.Types.ObjectId, ref: 'ItemLevel', default: null }, // 新增 level 欄位，引用 ItemLevel
    status: { type: String, enum: ['pending', 'approved', 'expired'], default: 'pending' },
    applicant: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    endTime: { type: Date },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Item', itemSchema);