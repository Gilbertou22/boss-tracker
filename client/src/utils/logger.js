import axios from 'axios';

const BASE_URL = process.env.REACT_APP_API_URL || '';

const logToBackend = async (level, message, metadata = {}) => {
    try {
        const token = localStorage.getItem('token');
        if (!token) {
            console.warn('No token found, logging as anonymous');
            metadata.userId = 'anonymous';
        }
        const response = await axios.post(
            `${BASE_URL}/api/logs`,
            {
                level,
                message,
                metadata: {
                    ...metadata,
                    timestamp: new Date().toISOString(),
                    userAgent: navigator.userAgent,
                },
            },
            {
                headers: { 'x-auth-token': token || '' },
            }
        );
       
    } catch (err) {
        console.error('Failed to log to backend:', err.message);
    }
};

const logger = {
    info: (message, metadata = {}) => {
    
        logToBackend('info', message, metadata);
    },
    error: (message, metadata = {}) => {
    
        logToBackend('error', message, metadata);
    },
    warn: (message, metadata = {}) => {
    
        logToBackend('warn', message, metadata);
    },
    log: (message, metadata = {}) => {
    
        logger.info(message, metadata);
    },
    debug: (message, metadata = {}) => {
    
        logToBackend('debug', message, metadata);
    },
};

export default logger;