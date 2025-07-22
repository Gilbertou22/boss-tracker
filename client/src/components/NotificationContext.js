import React, { createContext, useState, useContext } from 'react';
import logger from '../utils/logger'; // 引入前端日誌工具

const NotificationContext = createContext();

export const NotificationProvider = ({ children }) => {
    const [unreadCount, setUnreadCount] = useState(0);
    const [notifications, setNotifications] = useState([]);

    return (
        <NotificationContext.Provider value={{ unreadCount, setUnreadCount, notifications, setNotifications }}>
            {children}
        </NotificationContext.Provider>
    );
};

export const useNotification = () => useContext(NotificationContext);