const mongoose = require('mongoose');

const attendeeRequestSchema = new mongoose.Schema({
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    kill_id: { type: mongoose.Schema.Types.ObjectId, ref: 'BossKill', required: true },
    character_name: { type: String, required: true },
    proof_image: { type: String }, // 在場證明圖片路徑
    reason: { type: String }, // 補單原因
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
    created_at: { type: Date, default: Date.now },
});

module.exports = mongoose.model('AttendeeRequest', attendeeRequestSchema);