const mongoose = require('mongoose');

const ApplicationSchema = new mongoose.Schema({
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    kill_id: { type: mongoose.Schema.Types.ObjectId, ref: 'BossKill', required: true },
    item_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Item', required: true }, // 新增 item_id
    item_name: { type: String, required: true }, // 保留 item_name 作為備用
    status: { type: String, enum: ['pending', 'approved', 'rejected', 'assigned'], default: 'pending' },
    created_at: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Application', ApplicationSchema);