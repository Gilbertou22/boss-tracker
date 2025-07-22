// routes/roles.js
const express = require('express');
const router = express.Router();
const Role = require('../models/Role');
const { auth, adminOnly } = require('../middleware/auth');
const logger = require('../logger');

// 獲取所有角色列表
router.get('/', auth, async (req, res) => {
    try {
        const roles = await Role.find().sort({ createdAt: -1 });
        res.json(roles);
    } catch (err) {
        logger.error('Error fetching roles:', err.message);
        res.status(500).json({
            code: 500,
            msg: '獲取角色列表失敗',
            detail: err.message,
        });
    }
});

// 獲取單個角色詳情
router.get('/:id', auth, async (req, res) => {
    try {
        const role = await Role.findById(req.params.id);
        if (!role) {
            return res.status(404).json({
                code: 404,
                msg: '角色不存在',
                detail: `無法找到 ID 為 ${req.params.id} 的角色`,
            });
        }
        res.json(role);
    } catch (err) {
        logger.error('Error fetching role by ID:', err.message);
        res.status(500).json({
            code: 500,
            msg: '獲取角色詳情失敗',
            detail: err.message,
        });
    }
});

// 新增角色（管理員專用）
router.post('/', auth, adminOnly, async (req, res) => {
    const { name, description } = req.body;

    try {
        if (!name) {
            return res.status(400).json({
                code: 400,
                msg: '缺少必填字段',
                detail: '請提供角色名稱 (name)',
            });
        }

        const existingRole = await Role.findOne({ name });
        if (existingRole) {
            return res.status(400).json({
                code: 400,
                msg: '角色名稱已存在',
                detail: '請選擇其他名稱',
            });
        }

        const role = new Role({
            name,
            description: description || '',
        });

        await role.save();

        res.status(201).json({
            code: 201,
            msg: '角色創建成功',
            role,
        });
    } catch (err) {
        logger.error('Create role error:', err.message);
        res.status(500).json({
            code: 500,
            msg: '創建角色失敗',
            detail: err.message,
        });
    }
});

// 更新角色（管理員專用）
router.put('/:id', auth, adminOnly, async (req, res) => {
    const { name, description } = req.body;

    try {
        const role = await Role.findById(req.params.id);
        if (!role) {
            return res.status(404).json({
                code: 404,
                msg: '角色不存在',
                detail: `無法找到 ID 為 ${req.params.id} 的角色`,
            });
        }

        if (name && name !== role.name) {
            const existingRole = await Role.findOne({ name });
            if (existingRole) {
                return res.status(400).json({
                    code: 400,
                    msg: '角色名稱已存在',
                    detail: '請選擇其他名稱',
                });
            }
        }

        role.name = name || role.name;
        role.description = description !== undefined ? description : role.description;

        await role.save();

        res.json({
            code: 200,
            msg: '角色更新成功',
            role,
        });
    } catch (err) {
        logger.error('Update role error:', err.message);
        res.status(500).json({
            code: 500,
            msg: '更新角色失敗',
            detail: err.message,
        });
    }
});

// 刪除角色（管理員專用）
router.delete('/:id', auth, adminOnly, async (req, res) => {
    try {
        const role = await Role.findById(req.params.id);
        if (!role) {
            return res.status(404).json({
                code: 404,
                msg: '角色不存在',
                detail: `無法找到 ID 為 ${req.params.id} 的角色`,
            });
        }

        // 檢查是否有用戶正在使用該角色
        const usersWithRole = await User.find({ roles: req.params.id });
        if (usersWithRole.length > 0) {
            return res.status(400).json({
                code: 400,
                msg: '無法刪除角色',
                detail: `有 ${usersWithRole.length} 個用戶正在使用該角色，請先移除這些用戶的該角色`,
            });
        }

        await role.deleteOne();

        res.json({
            code: 200,
            msg: '角色刪除成功',
        });
    } catch (err) {
        logger.error('Delete role error:', err.message);
        res.status(500).json({
            code: 500,
            msg: '刪除角色失敗',
            detail: err.message,
        });
    }
});

// 批量刪除角色（管理員專用）
router.delete('/batch-delete', auth, adminOnly, async (req, res) => {
    const { ids } = req.body;

    try {
        if (!Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({
                code: 400,
                msg: '請提供有效的角色 ID 列表',
            });
        }

        // 檢查是否有用戶正在使用這些角色
        const usersWithRoles = await User.find({ roles: { $in: ids } });
        if (usersWithRoles.length > 0) {
            return res.status(400).json({
                code: 400,
                msg: '無法刪除角色',
                detail: `有 ${usersWithRoles.length} 個用戶正在使用這些角色，請先移除這些用戶的角色`,
            });
        }

        await Role.deleteMany({ _id: { $in: ids } });

        res.json({
            code: 200,
            msg: '批量刪除成功',
        });
    } catch (err) {
        logger.error('Batch delete roles error:', err.message);
        res.status(500).json({
            code: 500,
            msg: '批量刪除失敗',
            detail: err.message,
        });
    }
});

module.exports = router;