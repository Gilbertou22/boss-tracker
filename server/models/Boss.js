const mongoose = require('mongoose');

const BossSchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true },
    description: String,
    difficulty: { type: String, enum: ['easy', 'medium', 'hard'], default: 'medium' },
    createdAt: { type: Date, default: Date.now },
});

BossSchema.pre('remove', async function (next) {
    await BossDKPSetting.deleteMany({ bossId: this._id });
    next();
});

module.exports = mongoose.model('Boss', BossSchema);