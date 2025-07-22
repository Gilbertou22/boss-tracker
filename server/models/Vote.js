// models/Vote.js
const mongoose = require('mongoose');

const VoteSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
    },
    options: [{
        text: { type: String, required: true },
        votes: { type: Number, default: 0 },
    }],
    startTime: {
        type: Date,
        required: true,
        default: Date.now,
    },
    endTime: {
        type: Date,
        required: true,
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    participants: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
    }],
    votes: [{
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        optionIndex: { type: Number, required: true },
        timestamp: { type: Date, default: Date.now },
    }],
    status: {
        type: String,
        enum: ['active', 'closed'],
        default: 'active',
    },
    multipleChoice: {
        type: Boolean,
        default: false, // 是否允許多選
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
});

module.exports = mongoose.model('Vote', VoteSchema);