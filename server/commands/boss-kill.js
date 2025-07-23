// commands/user-info.js
const { SlashCommandBuilder } = require('discord.js');
const User = require('../models/User');
const Profession = require('../models/Profession');
const Role = require('../models/Role');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('user-info')
        .setDescription('獲取指定角色的資料。')
        .addStringOption(option =>
            option.setName('character_name')
                .setDescription('角色名稱')
                .setRequired(true)),
    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });  // 延遲回應，避免超時

        const characterName = interaction.options.getString('character_name');
        try {
            const user = await User.findOne({ character_name: characterName })
                .populate('profession', 'name icon')
                .populate('roles', 'name')
                .select('world_name character_name discord_id raid_level diamonds status screenshot roles guildId profession combatPower');

            if (!user) {
                throw new Error(`未找到角色 ${characterName}`);
            }

            // 格式化回覆，避免敏感資訊
            const info = `
**角色名稱:** ${user.character_name}
**世界名稱:** ${user.world_name}
**Discord ID:** ${user.discord_id || '無'}
**突擊等級:** ${user.raid_level}
**鑽石:** ${user.diamonds}
**狀態:** ${user.status}
**職業:** ${user.profession?.name || '無'}
**角色:** ${user.roles.map(role => role.name).join(', ') || '無'}
**戰力:** ${user.combatPower}
**團隊 ID:** ${user.guildId || '無'}
**截圖:** ${user.screenshot ? '有' : '無'}
            `;

            await interaction.editReply(info);
        } catch (error) {
            await interaction.editReply(`錯誤：${error.message}`);
        }
    },
};