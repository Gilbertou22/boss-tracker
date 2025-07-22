const winston = require('winston');
const { MongoDB } = require('winston-mongodb');

const logFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.json()
);

const logger = winston.createLogger({
    level: 'info',
    format: logFormat,
    transports: [
        new winston.transports.Console(),
        new winston.transports.File({
            filename: 'logs/error.log',
            level: 'error',
        }),
        new winston.transports.File({
            filename: 'logs/combined.log',
        }),
        new MongoDB({
            level: 'info',
            db: 'mongodb://localhost:27017/boss_tracker',
            collection: 'logs',
            options: { useUnifiedTopology: true },
        }),
    ],
});

module.exports = logger;