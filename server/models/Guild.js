const mongoose = require('mongoose');

const guildSchema = new mongoose.Schema({
    name: { type: String, required: true },
    password: { type: String, required: true }, // 團隊密碼
    announcement: { type: String, default: '' }, // 公告（Markdown 格式）
    settings: {
        applyDeadlineHours: { type: Number, default: 48 }, // 補單期限（小時）
        editDeadlineHours: { type: Number, default: 24 }, // 編輯期限（小時）
        deleteDeadlineHours: { type: Number, default: 24 }, // 刪除期限（小時）
        publicFundRate: { type: Number, default: 0.1 }, // 公基金比例（0-1）
        creatorExtraShare: { type: Boolean, default: false }, // 開單者多領一份
        leaderExtraShare: { type: Boolean, default: false }, // 帶團者多領一份
        restrictBilling: { type: Boolean, default: false }, // 限制開單
        withdrawMinAmount: { type: Number, default: 100 }, // 提領限制（最小金額）
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Guild', guildSchema);