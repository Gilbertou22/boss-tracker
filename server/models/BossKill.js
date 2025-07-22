// models/BossKill.js
const mongoose = require('mongoose');

const BossKillSchema = new mongoose.Schema({
    bossId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Boss',
        required: true,
    },
    kill_time: {
        type: Date,
        required: true,
    },
    dropped_items: [
        {
            _id: { type: mongoose.Schema.Types.ObjectId, default: () => new mongoose.Types.ObjectId() },
            name: { type: String, required: true },
            type: { type: String, enum: ['equipment', 'skill'], required: true },
            apply_deadline: { type: Date, required: true },
            level: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'ItemLevel',
            },
            final_recipient: {
                type: String,
                default: null,
            },
            status: {
                type: String,
                enum: ['pending', 'assigned', 'expired'],
                default: 'pending',
            },
        },
    ],
    attendees: {
        type: [String],
        required: true,
        validate: {
            validator: function (v) {
                return Array.isArray(v) && v.every(item => typeof item === 'string');
            },
            message: props => `${props.value} 必須是字符串陣列！`,
        },
    },
    screenshots: [{ type: String }],
    final_recipient: { type: String, default: null },
    status: { type: String, enum: ['pending', 'assigned', 'expired'], default: 'pending' },
    auction_status: { // 新增 auction_status 字段
        type: String,
        enum: ['pending', 'active', 'completed'],
        default: 'pending',
    },
    created_at: { type: Date, default: Date.now },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    itemHolder: { type: String },
    dkpDistributed: {
        type: Boolean,
        default: false,
    },
}, {
    strictPopulate: false,
});

BossKillSchema.pre('save', function (next) {
    if (this.attendees && typeof this.attendees === 'string') {
        try {
            const parsed = JSON.parse(this.attendees);
            if (Array.isArray(parsed) && parsed.every(item => typeof item === 'string')) {
                this.attendees = parsed;
            } else {
                throw new Error('無法解析 attendees 為有效陣列');
            }
        } catch (e) {
            return next(new Error('attendees 格式錯誤: ' + e.message));
        }
    }
    if (this.dropped_items && Array.isArray(this.dropped_items)) {
        this.dropped_items = this.dropped_items.map(item => ({
            ...item,
            _id: item._id || new mongoose.Types.ObjectId(),
        }));
    }
    if (this.isNew && !this.userId) {
        return next(new Error('userId 是必填字段'));
    }
    next();
});

module.exports = mongoose.model('BossKill', BossKillSchema);