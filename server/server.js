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
    allowedHeaders: ['Content-Type', 'x-auth-token'],
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
const { Client, GatewayIntentBits } = require('discord.js');
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
const fs = require('fs');
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