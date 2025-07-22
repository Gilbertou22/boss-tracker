const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UserSchema = new mongoose.Schema({
    world_name: { type: String, required: true },
    character_name: { type: String, required: true, unique: true },
    discord_id: { type: String, default: null },
    raid_level: { type: Number, default: 0 },
    diamonds: { type: Number, default: 0 },
    status: { type: String, enum: ['pending', 'active', 'disabled'], default: 'pending' }, // 添加 disabled 狀態
    screenshot: { type: String, default: null },
    roles: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Role', default: [] }],
    password: { type: String, required: true },
    guildId: { type: mongoose.Schema.Types.ObjectId, ref: 'Guild', default: null },
    mustChangePassword: { type: Boolean, default: false },
    dkpPoints: { type: Number, default: 0 },
    profession: { type: mongoose.Schema.Types.ObjectId, ref: 'Profession', default: null },
    lastLogin: { type: Date }, // 新增字段記錄最後登入時間
    combatPower: { type: Number, default: 0 }, // 新增戰力欄位
});

// 在保存用戶前哈希密碼
UserSchema.pre('save', async function (next) {
    try {
        if (this.isModified('password')) {
            const salt = await bcrypt.genSalt(10);
            this.password = await bcrypt.hash(this.password, salt);
        }
        next();
    } catch (err) {
        console.error('Error in pre-save hook:', err);
        next(err);
    }
});

module.exports = mongoose.model('User', UserSchema);