// models/MenuItem.js
const mongoose = require('mongoose');

const menuItemSchema = new mongoose.Schema({
    key: { type: String, required: true }, // 路徑，例如 "/"
    label: { type: String, required: true }, // 顯示名稱，例如 "首頁"
    icon: { type: String }, // 圖標名稱，例如 "HomeOutlined"
    roles: [{ type: String }], // 可見角色，例如 ["user", "admin"]
    parentId: { type: mongoose.Schema.Types.ObjectId, ref: 'MenuItem', default: null }, // 父節點的 _id
    children: [{ type: mongoose.Schema.Types.ObjectId, ref: 'MenuItem' }], // 子菜單
    order: { type: Number, default: 0 }, // 排序順序
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('MenuItem', menuItemSchema);