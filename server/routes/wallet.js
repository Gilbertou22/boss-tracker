const express = require('express');
const router = express.Router();
const WalletTransaction = require('../models/WalletTransaction');
const DKPRecord = require('../models/DKPRecord');
const { auth } = require('../middleware/auth');
const moment = require('moment');

router.get('/transactions', auth, async (req, res) => {
    try {
        const { page = 1, pageSize = 10, type, source, startDate, endDate, sortBy = 'timestamp', sortOrder = 'desc' } = req.query;

        // 查詢條件
        const walletQuery = { userId: req.user.id };
        const dkpQuery = { userId: req.user.id };

        if (type) {
            walletQuery.type = type;
            dkpQuery.type = type;
        }
        if (source) {
            walletQuery.source = source;
            if (source !== 'dkp') {
                dkpQuery.type = null; // 如果來源不是 DKP，則不查詢 DKP 記錄
            }
        }
        if (startDate || endDate) {
            walletQuery.timestamp = {};
            dkpQuery.createdAt = {};
            if (startDate) {
                walletQuery.timestamp.$gte = new Date(startDate);
                dkpQuery.createdAt.$gte = new Date(startDate);
            }
            if (endDate) {
                walletQuery.timestamp.$lte = new Date(endDate);
                dkpQuery.createdAt.$lte = new Date(endDate);
            }
        }

        // 查詢 WalletTransaction 和 DKPRecord
        const walletTransactions = await WalletTransaction.find(walletQuery)
            .sort({ [sortBy]: sortOrder === 'desc' ? -1 : 1 })
            .lean();

        const dkpRecords = source && source !== 'dkp' ? [] : await DKPRecord.find(dkpQuery)
            .sort({ [sortBy]: sortOrder === 'desc' ? -1 : 1 })
            .lean();

        // 將 DKP 記錄轉換為錢包交易格式，並統一描述
        const dkpTransactions = dkpRecords.map(record => ({
            _id: record._id,
            userId: record.userId,
            amount: record.amount,
            type: record.amount > 0 ? 'income' : 'expense',
            source: 'dkp',
            description: record.description.replace(/^DKP 點數變動：/, ''), // 移除 "DKP 點數變動：" 前綴
            timestamp: record.createdAt,
        }));

        // 合併交易記錄並去重（根據時間戳、金額、描述和來源）
        const transactionMap = new Map();
        const allTransactions = [...walletTransactions, ...dkpTransactions]
            .forEach(transaction => {
                const key = `${transaction.timestamp}_${transaction.amount}_${transaction.description}_${transaction.source}`;
                if (!transactionMap.has(key)) {
                    transactionMap.set(key, transaction);
                }
            });

        const uniqueTransactions = Array.from(transactionMap.values())
            .sort((a, b) => {
                const dateA = new Date(a.timestamp);
                const dateB = new Date(b.timestamp);
                return sortOrder === 'desc' ? dateB - dateA : dateA - dateB;
            });

        // 計算總記錄數
        const total = uniqueTransactions.length;

        // 分頁處理
        const paginatedTransactions = uniqueTransactions.slice((page - 1) * pageSize, page * pageSize);

        res.json({
            transactions: paginatedTransactions,
            pagination: {
                current: parseInt(page),
                pageSize: parseInt(pageSize),
                total,
            },
        });
    } catch (err) {
        console.error('Error fetching wallet transactions:', err);
        res.status(500).json({
            code: 500,
            msg: '無法獲取錢包記錄',
            detail: err.message || '伺服器處理錯誤',
            suggestion: '請稍後重試或聯繫管理員。',
        });
    }
});

router.get('/transactions/export', auth, async (req, res) => {
    try {
        const { type, source, startDate, endDate } = req.query;

        const walletQuery = { userId: req.user.id };
        const dkpQuery = { userId: req.user.id };

        if (type) {
            walletQuery.type = type;
            dkpQuery.type = type;
        }
        if (source) {
            walletQuery.source = source;
            if (source !== 'dkp') {
                dkpQuery.type = null;
            }
        }
        if (startDate || endDate) {
            walletQuery.timestamp = {};
            dkpQuery.createdAt = {};
            if (startDate) {
                walletQuery.timestamp.$gte = new Date(startDate);
                dkpQuery.createdAt.$gte = new Date(startDate);
            }
            if (endDate) {
                walletQuery.timestamp.$lte = new Date(endDate);
                dkpQuery.createdAt.$lte = new Date(endDate);
            }
        }

        const walletTransactions = await WalletTransaction.find(walletQuery).lean();
        const dkpRecords = source && source !== 'dkp' ? [] : await DKPRecord.find(dkpQuery).lean();

        const dkpTransactions = dkpRecords.map(record => ({
            _id: record._id,
            userId: record.userId,
            amount: record.amount,
            type: record.amount > 0 ? 'income' : 'expense',
            source: 'dkp',
            description: record.description.replace(/^DKP 點數變動：/, ''), // 移除 "DKP 點數變動：" 前綴
            timestamp: record.createdAt,
        }));

        // 合併並去重
        const transactionMap = new Map();
        const allTransactions = [...walletTransactions, ...dkpTransactions]
            .forEach(transaction => {
                const key = `${transaction.timestamp}_${transaction.amount}_${transaction.description}_${transaction.source}`;
                if (!transactionMap.has(key)) {
                    transactionMap.set(key, transaction);
                }
            });

        const uniqueTransactions = Array.from(transactionMap.values())
            .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        res.json({ transactions: uniqueTransactions });
    } catch (err) {
        console.error('Error exporting wallet transactions:', err);
        res.status(500).json({
            code: 500,
            msg: '導出錢包記錄失敗',
            detail: err.message || '伺服器處理錯誤',
            suggestion: '請稍後重試或聯繫管理員。',
        });
    }
});

module.exports = router;