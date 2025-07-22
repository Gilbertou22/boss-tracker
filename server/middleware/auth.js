const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Role = require('../models/Role');
require('dotenv').config();

const auth = async (req, res, next) => {
    const token = req.header('x-auth-token');

    if (!token) {
        return res.status(401).json({ msg: '無權限，缺少 Token' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const userId = decoded.user ? decoded.user.id : decoded.id;
        if (!userId) {
            throw new Error('Decoded token missing user.id or id');
        }

        req.user = decoded.user ? decoded.user : { id: decoded.id };

        // 獲取用戶並填充 roles 字段
        const user = await User.findById(userId)
            .select('character_name roles mustChangePassword')
            .populate('roles'); // 填充 roles 字段，獲取 Role 文檔
        if (!user) {
            return res.status(401).json({ msg: '用戶不存在' });
        }

        // 將 roles 從 _id 陣列轉為角色名稱陣列
        const roleNames = user.roles.map(role => role.name);

        req.user = {
            id: user._id.toString(),
            character_name: user.character_name,
            roles: roleNames, // 將 roles 設為名稱陣列
            mustChangePassword: user.mustChangePassword,
        };

        // 檢查是否為臨時 token
        if (decoded.user && decoded.user.temporary) {
            const allowedPaths = ['/api/users/me', '/api/users/change-password'];
            const fullPath = (req.baseUrl || '') + req.path;
            if (!allowedPaths.includes(fullPath)) {
                return res.status(403).json({
                    code: 403,
                    msg: '臨時 Token 僅允許更改密碼',
                    detail: '請更改密碼後重新登入',
                });
            }
        }

        // 確保 req.session 存在
        if (req.session) {
            if (req.session.userId && req.session.userId !== req.user.id.toString()) {
                req.session.destroy(err => {
                    if (err) console.error('Session destroy error:', err);
                });
            } else {
                req.session.userId = req.user.id;
            }
        } else {
            console.warn('Session middleware not initialized, req.session is undefined');
        }

        next();
    } catch (err) {
        console.error('Token verification error:', {
            message: err.message,
            name: err.name,
            expiredAt: err.expiredAt,
            token: token ? token.substring(0, 20) + '...' : 'No token',
        });

        if (err.name === 'TokenExpiredError' && req.session) {
            req.session.destroy(err => {
                if (err) console.error('Session destroy error:', err);
            });
        }

        res.status(401).json({ msg: 'Token 無效或已過期', detail: err.message });
    }
};

const adminOnly = (req, res, next) => {
    if (!req.user || !req.user.roles.includes('admin')) {
        return res.status(403).json({ msg: '僅管理員可訪問' });
    }
    next();
};

module.exports = { auth, adminOnly };