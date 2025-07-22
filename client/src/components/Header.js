import React, { useState, useEffect } from 'react';
import { Badge, Avatar, Popover, message } from 'antd';
import { BellOutlined } from '@ant-design/icons';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import moment from 'moment';
import logger from '../utils/logger'; // 引入前端日誌工具


const BASE_URL = process.env.REACT_APP_API_URL || '';

const Header = () => {
    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const token = localStorage.getItem('token');
    const navigate = useNavigate();

    useEffect(() => {
        fetchNotifications();
    }, [token]);

    const fetchNotifications = async () => {
        try {
            const res = await axios.get(`${BASE_URL}/api/notifications`, {
                headers: { 'x-auth-token': token },
            });
            const enrichedNotifications = await Promise.all(res.data.notifications.map(async (notification) => {
                let imageUrl = 'wp1.jpg';
                if (notification.auctionId) {
                    const auctionRes = await axios.get(`${BASE_URL}/api/auctions/${notification.auctionId}`, {
                        headers: { 'x-auth-token': token },
                    });
                    const auction = auctionRes.data;
                    if (auction && auction.itemId) {
                        const bossKillRes = await axios.get(`${BASE_URL}/api/boss-kills/${auction.itemId}`, {
                            headers: { 'x-auth-token': token },
                        });
                        const bossKill = bossKillRes.data;
                        if (bossKill && bossKill.dropped_items?.length) {
                            imageUrl = bossKill.dropped_items[0].imageUrl || 'wp1.jpg';
                        }
                    }
                }
                return { ...notification, imageUrl };
            }));
            setNotifications(enrichedNotifications);
            setUnreadCount(res.data.unreadCount);
        } catch (err) {
            console.error('Fetch notifications error:', err);
            message.error('無法獲取通知，請重新登錄');
            navigate('/login');
        }
    };

    const notificationContent = (
        <div style={{ maxHeight: '300px', overflowY: 'auto', width: '300px' }}>
            {notifications.length > 0 ? (
                notifications.map((notification) => (
                    <div
                        key={notification._id}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            padding: '8px',
                            cursor: 'pointer',
                            borderBottom: '1px solid #f0f0f0',
                        }}
                        onClick={() => {
                            if (notification.auctionId) navigate(`/auction/${notification.auctionId}`);
                        }}
                    >
                        <Avatar src={notification.imageUrl} size={40} style={{ marginRight: '10px' }} />
                        <div>
                            <p style={{ margin: 0 }}>{notification.message}</p>
                            <p style={{ margin: 0, color: '#888', fontSize: '12px' }}>
                                {moment(notification.createdAt).fromNow()}
                            </p>
                        </div>
                    </div>
                ))
            ) : (
                <p style={{ padding: '8px', textAlign: 'center' }}>暫無通知</p>
            )}
            <div style={{ textAlign: 'center', padding: '8px 0' }}>
                <a onClick={() => navigate('/notifications')}>查看所有通知</a>
            </div>
        </div>
    );

    return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', padding: '10px' }}>
            <Popover content={notificationContent} trigger="click" placement="bottomRight">
                <Badge count={unreadCount > 9 ? '9+' : unreadCount}>
                    <BellOutlined style={{ fontSize: '24px', cursor: 'pointer' }} />
                </Badge>
            </Popover>
        </div>
    );
};

export default Header;