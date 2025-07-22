// 腳本：為現有 BossKill 記錄添加 auction_status 字段
const mongoose = require('mongoose');
const User = require('./models/User');
const Role = require('./models/Role');

mongoose.connect('mongodb://localhost:27017/boss_tracker', {
    useNewUrlParser: true,
    useUnifiedTopology: true,
});


async function migrateUserRoles() {
    try {
        // 獲取所有角色
        const roles = await Role.find();
        const roleMap = {};
        roles.forEach(role => {
            roleMap[role.name] = role._id;
        });

        // 獲取所有用戶
        const users = await User.find();
        for (const user of users) {
            // 將字符串角色轉為 Role 的 _id 陣列
            const newRoles = user.roles
                .map(roleName => roleMap[roleName])
                .filter(roleId => roleId); // 過濾掉無效的角色

            // 如果用戶沒有角色，默認給予 user 角色
            if (newRoles.length === 0 && roleMap['user']) {
                newRoles.push(roleMap['user']);
            }

            // 更新用戶的 roles 字段
            await User.updateOne(
                { _id: user._id },
                { $set: { roles: newRoles } }
            );
        }

        console.log('User roles migration completed successfully');
    } catch (err) {
        console.error('User roles migration error:', err);
    } finally {
        mongoose.connection.close();
    }
}

migrateUserRoles();