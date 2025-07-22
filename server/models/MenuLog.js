// models/MenuLog.js
const mongoose = require('mongoose');

const menuLogSchema = new mongoose.Schema({
    action: { type: String, required: true, enum: ['create', 'update', 'delete'] }, // 操作類型
    menuItemId: { type: mongoose.Schema.Types.ObjectId, ref: 'MenuItem' }, // 關聯的菜單項 ID
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // 操作用戶
    details: { type: Object }, // 操作詳情（例如更新的字段）
    createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('MenuLog', menuLogSchema);