const express = require('express');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const mongoose = require('mongoose');
const MongoStore = require('connect-mongo');
const connectDB = require('./config/db');
const path = require('path');
const startAuctionCron = require('./utils/auctionCron');
const startItemExpirationCron = require('./utils/itemExpirationCron'); // 新增
const startDisabledUserCron = require('./utils/disabledUserCron'); // 新增
const checkVoteStatus = require('./utils/voteCron');
const axios = require('axios');
const fs = require('fs');
const cors = require('cors');
const csurf = require('csurf');
const multer = require('multer');
const app = express();

process.env.TZ = 'Asia/Taipei';

connectDB();

// CORS 配置
const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',')
    : ['http://localhost:3000', 'https://103.195.4.189', 'https://www.gnmr.net'];

app.use(cors({
    origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'x-auth-token', 'Authorization'],
    credentials: true,
}));


app.use('/api/upload', require('./routes/upload'));
console.log('Upload route loaded');

// 配置 csurf 中間件
const csrfProtection = csurf({ cookie: true });

// 提供 CSRF Token 的端點
app.get('/csrf-token', csrfProtection, (req, res) => {
    res.json({ csrfToken: req.csrfToken() });
});

// 在檔案開頭添加依賴
const { Client, GatewayIntentBits, Collection, Events, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, InteractionResponseFlags } = require('discord.js');  // 添加 InteractionResponseFlags

require('dotenv').config();

// 在 connectDB() 之後初始化 Discord BOT
const discordClient = new Client({
    intents: [
        GatewayIntentBits.Guilds,        // 處理伺服器事件
        GatewayIntentBits.GuildMessages, // 處理伺服器訊息事件
        GatewayIntentBits.MessageContent // 讀取訊息內容 (需啟用 privileged intent)
    ],
});

// BOT 登入
discordClient.once('ready', () => {
    console.log(`Discord BOT logged in as ${discordClient.user.tag}`);
});

// 將 discordClient 傳遞給路由
app.set('discordClient', discordClient); // 使 discordClient 可在路由中訪問

// 新增：載入斜線命令
discordClient.commands = new Collection();

const commandFiles = fs.readdirSync('./commands').filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
    const command = require(`./commands/${file}`);
    discordClient.commands.set(command.data.name, command);
}

// 新增：處理交互事件（斜線命令和按鈕/模態）
discordClient.on(Events.InteractionCreate, async interaction => {
    if (interaction.isChatInputCommand()) {
        const command = discordClient.commands.get(interaction.commandName);
        if (!command) {
            console.error(`No command matching ${interaction.commandName} was found.`);
            return;
        }
        try {
            await command.execute(interaction);
        } catch (error) {
            console.error(error);
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp({ content: '執行命令時發生錯誤！', flags: [64] });
            } else {
                await interaction.reply({ content: '執行命令時發生錯誤！', flags: [64] });
            }
        }
    } else if (interaction.isButton()) {
        try {
            // 處理按鈕點擊
            const parts = interaction.customId.split('_');
            if (parts.length < 3) {
                return interaction.reply({ content: '無效的按鈕 ID', flags: [64] });
            }
            const action = parts[0] + '_' + parts[1];
            const killId = parts[2];
            const itemId = parts[3];

            console.log(`Button clicked: ${interaction.customId}, action: ${action}, killId: ${killId}, itemId: ${itemId}`);

            if (action === 'apply_item' && itemId) {
                console.log(`Applying item: ${itemId} for kill: ${killId}`);
                // 彈出模態讓用戶確認申請特定物品
                const modal = new ModalBuilder()
                    .setCustomId(`apply_modal_${killId}_${itemId}`)
                    .setTitle('申請物品確認');

                const reasonInput = new TextInputBuilder()
                    .setCustomId('reason')
                    .setLabel('輸入申請理由（可選）')
                    .setStyle(TextInputStyle.Paragraph)
                    .setRequired(false);

                const captchaInput = new TextInputBuilder()
                    .setCustomId('captcha')
                    .setLabel('輸入驗證碼（請檢查網站或頻道公告）')
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true);

                const row1 = new ActionRowBuilder().addComponents(reasonInput);
                const row2 = new ActionRowBuilder().addComponents(captchaInput);
                modal.addComponents(row1, row2);

                await interaction.showModal(modal);
            } else if (action === 'add_attendee' && killId) {
                // 彈出模態讓用戶補登申請
                const modal = new ModalBuilder()
                    .setCustomId(`add_attendee_modal_${killId}`)
                    .setTitle('補登申請');

                const reasonInput = new TextInputBuilder()
                    .setCustomId('reason')
                    .setLabel('輸入補登理由和證明')
                    .setStyle(TextInputStyle.Paragraph)
                    .setRequired(true);

                const row = new ActionRowBuilder().addComponents(reasonInput);
                modal.addComponents(row);

                await interaction.showModal(modal);
            } else {
                await interaction.reply({ content: '無效的按鈕動作', flags: [64] });
            }
        } catch (err) {
            console.error('Button interaction error:', err);
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({ content: '處理按鈕點擊失敗，請重試。', flags: [64] });
            } else if (interaction.deferred) {
                await interaction.editReply({ content: '處理按鈕點擊失敗，請重試。' });
            }
        }
    } else if (interaction.isModalSubmit()) {
        try {
            await interaction.deferReply({ flags: [64] });
            // 處理模態提交
            const parts = interaction.customId.split('_');
            if (parts.length < 3) {
                return interaction.editReply({ content: '無效的模態 ID' });
            }
            const modalType = parts[0];
            const modalSubType = parts[1];
            const killId = parts[2];
            const itemId = parts[3];

            if (modalType === 'apply' && modalSubType === 'modal' && killId && itemId) {
                const reason = interaction.fields.getTextInputValue('reason') || '';
                const captcha = interaction.fields.getTextInputValue('captcha');

                // 驗證用戶 Discord ID
                const userDiscordId = interaction.user.id;
                const User = require('./models/User');
                const user = await User.findOne({ discord_id: userDiscordId });
                if (!user) {
                    return interaction.editReply({ content: '未找到綁定帳號，請先綁定 Discord ID' });
                }

                // 驗證擊殺記錄和物品
                const BossKill = require('./models/BossKill');
                const kill = await BossKill.findById(killId);
                if (!kill) {
                    return interaction.editReply({ content: '無效擊殺記錄' });
                }
                const item = kill.dropped_items.find(i => i._id.toString() === itemId);
                if (!item) {
                    return interaction.editReply({ content: '無效物品' });
                }

                // 模擬用戶登錄以獲取 JWT token（假設 /api/auth/login 存在）
                const apiUrl = process.env.API_URL || 'http://localhost:5000';
                
                const loginRes = await axios.post(`${apiUrl}/api/auth/login`, {
                    character_name: user.character_name,
                    password: captcha // 需要配置安全的默認密碼或改進
                }, {
                    headers: {
                            'x-bot-auth': process.env.BOT_SECRET || '2281' 
                    }
                });
                const userToken = loginRes.data.token;

                // 提交申請
                const res = await axios.post(`${apiUrl}/api/applications`, {
                    kill_id: killId,
                    item_id: itemId,
                    item_name: item.name,
                    reason: reason,
                    captcha: captcha // 包含驗證碼
                }, {
                    headers: {
                        'x-auth-token': userToken,
                        'x-bot-auth': 'true' // 添加 bot 標識
                    }
                });

                await interaction.editReply({ content: '申請提交成功！' });
            } else if (modalType === 'add' && modalSubType === 'attendee' && killId) {
                const reason = interaction.fields.getTextInputValue('reason');

                // 驗證用戶 Discord ID
                const userDiscordId = interaction.user.id;
                const User = require('./models/User');
                const user = await User.findOne({ discord_id: userDiscordId });
                if (!user) {
                    return interaction.editReply({ content: '未找到綁定帳號，請先綁定 Discord ID' });
                }

                // 提交補登申請
                const apiUrl = process.env.API_URL || 'http://localhost:5000';
                const res = await axios.post(`${apiUrl}/api/attendees/add-request`, {
                    kill_id: killId,
                    reason,
                    discord_id: userDiscordId,
                    character_name: user.character_name
                }, { headers: { 'x-auth-token': process.env.BOT_TOKEN } });

                await interaction.editReply({ content: '補登申請提交成功，等待審核！' });
            } else {
                await interaction.editReply({ content: '無效的模態提交' });
            }
        } catch (err) {
            console.error('Modal submit error:', err);
            await interaction.editReply({ content: `操作失敗: ${err.message}` });
        }
    }
});
// 啟動 BOT
discordClient.login(process.env.DISCORD_BOT_TOKEN).catch(err => {
    console.error('Discord BOT login error:', err);
});

// 啟動 BOT
discordClient.login(process.env.DISCORD_BOT_TOKEN).catch(err => {
    console.error('Discord BOT login error:', err);
});

// 配置 multer 存儲
const storage = multer.diskStorage({
    destination: './uploads/icons/',
    filename: (req, file, cb) => {
        cb(null, `${Date.now()}-${file.originalname}`);
    },
});
const upload = multer({
    storage,
    limits: { fileSize: 1024 * 1024 }, // 限制 1MB
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('僅支持圖片文件！'), false);
        }
    },
});




// 確保 uploads/icons 目錄存在

if (!fs.existsSync('./uploads/icons')) {
    fs.mkdirSync('./uploads/icons', { recursive: true });
}

// 配置靜態文件服務
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

//app.use(cors({ origin: 'http://localhost:3000', methods: ['GET', 'POST', 'PUT', 'DELETE'], allowedHeaders: ['Content-Type', 'x-auth-token'] }));


app.use(cookieParser());
// Initialize session middleware
app.use(
    session({
        secret: process.env.SESSION_SECRET || 'bfksfysa7e32kdhayu292sz',
        resave: false,
        saveUninitialized: true,
        /*
        store: MongoStore.create({
            mongoUrl: process.env.MONGO_URI,
            collectionName: 'sessions',
            ttl: 24 * 60 * 60, // 24 hours in seconds
        }).on('error', (err) => {
            console.error('MongoStore error:', err);
        }),
        */
        cookie: {
            secure: process.env.NODE_ENV === 'production',
            maxAge: 24 * 60 * 60 * 1000, // 24 hours
            httpOnly: true,
        },
    })
);



// 檢查 session 中間件
app.use((req, res, next) => {
    next();
});

mongoose.connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
}).then(() => {
    console.log('Connected to MongoDB');
}).catch(err => {
    console.error('MongoDB connection error:', err);
});

// 處理 OPTIONS 預檢請求
app.options('*', cors());

app.use(express.json());

console.log('Loading routes...');
app.use('/api/users', require('./routes/users'));
console.log('Users route loaded');
app.use('/api/boss-kills', require('./routes/bossKills'));
console.log('BossKills route loaded');
app.use('/api/auth', require('./routes/auth'));
console.log('Auth route loaded');
app.use('/api/applications', require('./routes/applications'));
console.log('Applications route loaded');
app.use('/api/auctions', require('./routes/auctions'));
console.log('Auctions route loaded');
app.use('/api/stats', require('./routes/stats'));
console.log('Stats route loaded');
app.use('/api/bosses', require('./routes/bosses'));
console.log('Bosses route loaded');
app.use('/api/items', require('./routes/items'));
console.log('Items route loaded');
app.use('/api/pending', require('./routes/pending')); // 新增路由
console.log('Pending route loaded');
app.use('/api/notifications', require('./routes/notifications')); // 新增路由
console.log('notifications route loaded');
app.use('/api/alerts', require('./routes/alerts')); // 新增路由
console.log('Alerts route loaded');
app.use('/api/guilds', require('./routes/guilds')); // 新增路由
console.log('Guilds route loaded');
app.use('/api/attendee-requests', require('./routes/attendeerequests'));
console.log('AttendeeRequests route loaded');
app.use('/api/logs', require('./routes/logs'));
console.log('Logs route loaded');
app.use('/api/wallet', require('./routes/wallet'));
console.log('Wallet route loaded');
app.use('/api/dkp', require('./routes/dkp'));
console.log('DKP route loaded');
app.use('/api/item-levels', require('./routes/item-levels'));
console.log('ItemLevels route loaded');
const menuRoutes = require('./routes/menu');
app.use('/api/menu', upload.single('customIcon'), menuRoutes); // 添加 upload 中間件
console.log('Menu route loaded');
app.use('/api/session', require('./routes/session'));
console.log('Session route loaded');
app.use('/api/professions', require('./routes/professions'));
console.log('Professions route loaded');
app.use('/api/roles', require('./routes/roles'));
console.log('Roles route loaded');
app.use('/api/votes', require('./routes/votes'));
console.log('Votes route loaded');
app.use('/api/search', require('./routes/search'));
console.log('Search route loaded');

try {
    startAuctionCron();
    console.log('Auction cron started');
    startItemExpirationCron();
    console.log('Item expiration cron started');
    startDisabledUserCron();
    console.log('Disabled user cron started');
    checkVoteStatus();
    console.log('Vote status check cron started');
} catch (err) {
    console.error('Error starting cron jobs:', err);
}


const Role = require('./models/Role');

async function initializeRoles() {
    const defaultRoles = [
        { name: 'user', description: '普通用戶，具有基本權限' },
        { name: 'moderator', description: '版主，可以管理部分內容' },
        { name: 'admin', description: '系統管理員，擁有所有權限' },
        { name: 'guild', description: '旅團代表，負責旅團相關事務' },
    ];

    try {
        for (const role of defaultRoles) {
            const existingRole = await Role.findOne({ name: role.name });
            if (!existingRole) {
                await new Role(role).save();
                console.log(`Role ${role.name} created successfully`);
            }
        }
    } catch (err) {
        console.error('Error initializing roles:', err);
    }
}

// 在服務器啟動時調用
initializeRoles();

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT} at ${new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' })}`));