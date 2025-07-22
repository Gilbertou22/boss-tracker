// scripts/initMenu.js
const mongoose = require('mongoose');
const MenuItem = require('./models/MenuItem');

mongoose.connect('mongodb://localhost:27017/boss_tracker', { useNewUrlParser: true, useUnifiedTopology: true });

const initMenu = async () => {
    try {
        await MenuItem.deleteMany({}); // 清空現有數據

        const baseItems = [
            { key: '/', label: '首頁', icon: 'HomeOutlined', roles: ['user', 'admin', 'moderator'], order: 0 },
            { key: '/wallet', label: '個人錢包', icon: 'SketchOutlined', roles: ['user', 'admin', 'moderator'], order: 1 },
            { key: '/apply-item', label: '申請物品', icon: 'FileDoneOutlined', roles: ['user', 'admin', 'moderator'], order: 2 },
            { key: '/kill-history', label: '擊殺歷史記錄', icon: 'FileDoneOutlined', roles: ['user', 'admin', 'moderator'], order: 3 },
            { key: '/coming-soon', label: '競標', icon: 'ShoppingOutlined', roles: ['user'], order: 4 },
        ];

        const adminItems = [
            { key: '/approve-applications', label: '批准申請', icon: 'CheckCircleOutlined', roles: ['admin', 'moderator'], order: 0 },
            { key: '/coming-soon', label: '發起競標', icon: 'DollarOutlined', roles: ['admin', 'moderator'], order: 1 },
            {
                key: 'management',
                label: '管理',
                icon: 'TeamOutlined',
                roles: ['admin'],
                order: 2,
                children: [],
            },
        ];

        const managementChildren = [
            { key: '/boss-kill', label: '記錄擊殺', icon: 'FileDoneOutlined', roles: ['admin'], order: 0 },
            { key: '/manage-bosses', label: '管理首領', icon: 'TeamOutlined', roles: ['admin'], order: 1 },
            { key: '/manage-items', label: '管理物品', icon: 'GiftOutlined', roles: ['admin'], order: 2 },
            { key: '/manage-users', label: '管理盟友', icon: 'UserOutlined', roles: ['admin'], order: 3 },
            { key: '/manage-items-level', label: '管理物品等級', icon: 'GiftOutlined', roles: ['admin'], order: 4 },
            { key: '/stats', label: '統計報表', icon: 'BarChartOutlined', roles: ['admin'], order: 5 },
            { key: '/approve-attend-request', label: '管理補登申請', icon: 'CloudUploadOutlined', roles: ['admin'], order: 6 },
        ];

        // 插入基礎菜單項
        const insertedBaseItems = await MenuItem.insertMany(baseItems);

        // 插入管理員菜單項
        const insertedAdminItems = await MenuItem.insertMany(adminItems);

        // 插入子菜單項
        const insertedChildren = await MenuItem.insertMany(managementChildren);

        // 更新 management 菜單項的 children
        const managementItem = insertedAdminItems.find(item => item.key === 'management');
        managementItem.children = insertedChildren.map(child => child._id);
        await managementItem.save();

      
        mongoose.connection.close();
    } catch (err) {
        console.error('Error initializing menu:', err);
        mongoose.connection.close();
    }
};

initMenu();