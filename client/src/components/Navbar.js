import React, { useState, useEffect, useCallback, useContext } from 'react';
import { Menu, Layout, Dropdown, Avatar, Badge, Button, Popover, Drawer, Spin, message, Divider, Typography } from 'antd';
import {
    LoginOutlined,
    UserAddOutlined,
    LogoutOutlined,
    HomeOutlined,
    BellOutlined,
    MenuOutlined,
    EditOutlined,
} from '@ant-design/icons';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import moment from 'moment';
import UserProfile from '../pages/UserProfile';
import { useNotification } from './NotificationContext';
import logger from '../utils/logger';
import { getIconMapping } from '../components/IconMapping';
import { AuthContext } from '../AuthProvider';

const { Header } = Layout;
const { SubMenu } = Menu;
const { Text } = Typography;

const BASE_URL = process.env.REACT_APP_API_URL || '';

const Navbar = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { user, token, logout, loading } = useContext(AuthContext);
    const { unreadCount, setUnreadCount, notifications, setNotifications } = useNotification();
    const [profileVisible, setProfileVisible] = useState(false);
    const [pendingCount, setPendingCount] = useState(0);
    const [navbarLoading, setNavbarLoading] = useState(false);
    const [drawerVisible, setDrawerVisible] = useState(false);
    const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
    const [deferredPrompt, setDeferredPrompt] = useState(null);
    const [menuItems, setMenuItems] = useState([]);
    const [openKeys, setOpenKeys] = useState([]);

    useEffect(() => {
        const handleResize = () => {
            setIsMobile(window.innerWidth <= 768);
        };

        window.addEventListener('resize', handleResize);
        handleResize();

        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            setDeferredPrompt(e);
        });

        return () => {
            window.removeEventListener('resize', handleResize);
        };
    }, []);

    const fetchNotifications = useCallback(async () => {
        if (!token) return;
        try {
            setNavbarLoading(true);
            const res = await axios.get(`${BASE_URL}/api/notifications`, {
                headers: { 'x-auth-token': token },
                cache: 'no-store',
            });

            const enrichedNotifications = await Promise.all(
                res.data.notifications.slice(0, 5).map(async (notification) => {
                    let imageUrl = 'wp1.jpg';
                    let isValidAuction = true;
                    if (notification.auctionId) {
                        try {
                            const auctionRes = await axios.get(`${BASE_URL}/api/auctions/${notification.auctionId}`, {
                                headers: { 'x-auth-token': token },
                                cache: 'no-store',
                            });

                            const auction = auctionRes.data;
                            if (auction && auction.itemId) {
                                const itemId = typeof auction.itemId === 'object' && auction.itemId._id
                                    ? auction.itemId._id
                                    : auction.itemId;
                                if (typeof itemId !== 'string') {
                                    logger.warn('Invalid itemId in auction', { auctionId: notification.auctionId, itemId });
                                    return { ...notification, imageUrl, isValidAuction };
                                }

                                const bossKillRes = await axios.get(`${BASE_URL}/api/boss-kills/${itemId}`, {
                                    headers: { 'x-auth-token': token },
                                    cache: 'no-store',
                                });

                                const bossKill = bossKillRes.data;
                                if (bossKill && bossKill.screenshots?.length > 0) {
                                    imageUrl = bossKill.screenshots[0].startsWith('http')
                                        ? bossKill.screenshots[0]
                                        : `${BASE_URL}/${bossKill.screenshots[0].replace(/\\/g, '/')}`;
                                }
                            }
                        } catch (err) {
                            if (err.response?.status === 404) {
                                logger.warn('Auction not found for notification', {
                                    notificationId: notification._id,
                                    auctionId: notification.auctionId,
                                    error: err.response?.data || err.message,
                                });
                                isValidAuction = false;
                            } else {
                                logger.warn('Error fetching auction or boss kill for notification', {
                                    notificationId: notification._id,
                                    error: err.response?.data || err.message,
                                });
                            }
                        }
                    }
                    return { ...notification, imageUrl, isValidAuction };
                })
            );
            const validNotifications = enrichedNotifications.filter(notification => {
                if (notification.auctionId) {
                    return notification.isValidAuction;
                }
                return true;
            });
            setNotifications(validNotifications);
            setUnreadCount(res.data.unreadCount);
            logger.info('Fetched notifications', { unreadCount: res.data.unreadCount, notificationCount: validNotifications.length });
        } catch (err) {
            logger.error('Fetch notifications error', { error: err.response?.data || err.message });
            message.error('無法獲取通知');
        } finally {
            setNavbarLoading(false);
        }
    }, [token, setNotifications, setUnreadCount]);

    const fetchMenuItems = useCallback(async () => {
        if (!token) return;
        try {
            const res = await axios.get(`${BASE_URL}/api/session/menu`, {
                headers: { 'x-auth-token': token },
                withCredentials: true,
                cache: 'no-store',
            });

            // 檢查返回的數據是否為陣列
            if (!Array.isArray(res.data)) {
                logger.error('Menu items response is not an array', { response: res.data });
                throw new Error('菜單項數據格式錯誤');
            }

            // 過濾掉無效數據並構建樹形結構
            const seenIds = new Set();
            const allItems = res.data
                .filter(item => {
                    if (!item._id || !item.key || !item.label) {
                        logger.warn('Invalid menu item', { item });
                        return false;
                    }
                    if (seenIds.has(item._id)) {
                        logger.warn('Duplicate _id found:', item._id);
                        return false;
                    }
                    seenIds.add(item._id);
                    return true;
                })
                .map(item => ({
                    key: item.key,
                    label: item.label,
                    icon: item.customIcon ? <Avatar src={item.customIcon} size={20} /> : (getIconMapping()[item.icon] || null),
                    roles: item.roles,
                    parentId: item.parentId,
                    order: item.order,
                    _id: item._id,
                    children: item.children || [],
                }));

            // 構建樹形結構
            const treeDataMap = {};
            const treeData = [];

            allItems.forEach(item => {
                treeDataMap[item._id] = { ...item, children: [] };
            });

            allItems.forEach(item => {
                if (item.parentId && treeDataMap[item.parentId]) {
                    treeDataMap[item.parentId].children.push(treeDataMap[item._id]);
                } else {
                    treeData.push(treeDataMap[item._id]);
                }
            });

            // 過濾重複的頂級菜單項
            const topLevelIds = new Set(treeData.map(item => item._id));
            const finalTreeData = treeData.filter(item => {
                let isChild = false;
                for (const topItem of treeData) {
                    if (topItem._id === item._id) continue;
                    const hasChild = (node) => {
                        if (node.children.some(child => child._id === item._id)) {
                            return true;
                        }
                        return node.children.some(child => hasChild(child));
                    };
                    if (hasChild(topItem)) {
                        isChild = true;
                        break;
                    }
                }
                return !isChild;
            });

            // 根據 pendingCount 更新競標相關菜單項的標籤
            const menuItems = finalTreeData.map(item => ({
                ...item,
                label: item.label.includes('競標') && user?.roles && (user.roles.includes('admin') || user.roles.includes('moderator'))
                    ? `${item.label} (${pendingCount})`
                    : item.label,
            }));

            // 如果菜單項為空，設置默認首頁
            if (menuItems.length === 0) {
                setMenuItems([{ key: '/', label: '首頁', icon: <HomeOutlined /> }]);
            } else {
                setMenuItems(menuItems);
            }
            logger.info('Fetched menu items from session', { menuItems });
        } catch (err) {
            logger.error('Fetch session menu items error', { error: err.response?.data || err.message });
            message.error('無法獲取菜單項');
            setMenuItems([{ key: '/', label: '首頁', icon: <HomeOutlined /> }]);
        }
    }, [token, user, pendingCount]);

    const fetchPendingCount = useCallback(async () => {
        if (!token) return;
        try {
            setNavbarLoading(true);
            const res = await axios.get(`${BASE_URL}/api/auctions/pending-count`, {
                headers: { 'x-auth-token': token },
                cache: 'no-store',
            });
            setPendingCount(res.data.count);
            logger.info('Fetched pending auctions count', { count: res.data.count });
        } catch (err) {
            logger.error('Fetch pending count error', { error: err.response?.data || err.message });
            message.warning('無法獲取待處理拍賣數量');
        } finally {
            setNavbarLoading(false);
        }
    }, [token]);

    useEffect(() => {
        if (!token) {
            setMenuItems([{ key: '/', label: '首頁', icon: <HomeOutlined /> }]);
            setNotifications([]);
            setUnreadCount(0);
        } else {
            fetchMenuItems();
            if (user) {
                fetchNotifications();
            }
        }
    }, [token, user, fetchNotifications, fetchMenuItems]);

    useEffect(() => {
        if (user && user.roles && (user.roles.includes('admin') || user.roles.includes('moderator'))) {
            fetchPendingCount();
        }
    }, [user, fetchPendingCount]);

    const handleInstallPWA = () => {
        if (deferredPrompt) {
            deferredPrompt.prompt();
            deferredPrompt.userChoice.then((choiceResult) => {
                if (choiceResult.outcome === 'accepted') {
                    logger.info('User accepted the install prompt');
                } else {
                    logger.info('User dismissed the install prompt');
                }
                setDeferredPrompt(null);
            });
        }
    };

    const markAsRead = async (notificationId) => {
        try {
            setNavbarLoading(true);
            await axios.put(
                `${BASE_URL}/api/notifications/${notificationId}/read`,
                {},
                { headers: { 'x-auth-token': token }, cache: 'no-store' }
            );
            message.success('通知已標記為已讀');
            setNotifications(notifications.map(n => n._id === notificationId ? { ...n, read: true } : n));
            await fetchNotifications();
        } catch (err) {
            logger.error('Mark as read error', { notificationId, error: err.response?.data || err.message });
            message.error('標記為已讀失敗');
        } finally {
            setNavbarLoading(false);
        }
    };

    const handleLogout = () => {
        logout();
        setNotifications([]);
        setUnreadCount(0);
        setMenuItems([{ key: '/', label: '首頁', icon: <HomeOutlined /> }]);
        message.success('已登出');
    };

    const getFirstCharacter = (name) => {
        if (!name) return 'U';
        const firstChar = name.match(/./u)?.[0];
        return firstChar || 'U';
    };

    const handleMenuClick = ({ key }) => {
        logger.info('Menu item clicked', { key });
        const menuItem = menuItems.find(item => item.key === key) ||
            menuItems.flatMap(item => item.children || []).find(child => child.key === key);
        const hasChildren = menuItem && menuItem.children && menuItem.children.length > 0;

        if (key === 'profile') {
            setProfileVisible(true);
        } else if (key === 'logout') {
            handleLogout();
        } else if (key && typeof key === 'string' && key.startsWith('/')) {
            if (!hasChildren) {
                logger.info('Navigating to', { key });
                navigate(key);
                if (isMobile) {
                    setDrawerVisible(false);
                }
            }
        } else {
            logger.warn('Invalid menu item key', { key });
            message.warning('無效的路徑');
        }
    };

    const onOpenChange = (keys) => {
        logger.info('Menu open keys changed', { keys });
        setOpenKeys(keys);
    };

    const renderMenuItems = (items) => {
        return items.map(item => {
            if (item.children && item.children.length > 0) {
                return (
                    <SubMenu
                        key={item.key}
                        title={item.label}
                        icon={item.icon}
                    >
                        {renderMenuItems(item.children)}
                    </SubMenu>
                );
            }
            return (
                <Menu.Item key={item.key} icon={item.icon}>
                    {item.label}
                </Menu.Item>
            );
        });
    };

    const userMenu = (
        <div style={{
            width: '200px',
            padding: '8px',
            backgroundColor: '#fff',
            borderRadius: '8px',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
        }}>
            <div style={{ textAlign: 'center', marginBottom: '8px' }}>
                <Avatar
                    size={48}
                    style={{
                        backgroundColor: '#87d068',
                        fontSize: '20px',
                        fontWeight: 'bold',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginBottom: '8px',
                    }}
                >
                    {getFirstCharacter(user?.character_name)}
                </Avatar>
                <Text strong>{user?.character_name || '未知用戶'}</Text>
                <br />
                <Text type="secondary">
                    {user?.roles?.length > 0 ? user.roles.map(role => role.charAt(0).toUpperCase() + role.slice(1)).join(', ') : '未知角色'}
                </Text>
            </div>
            <Divider style={{ margin: '8px 0' }} />
            <Menu onClick={handleMenuClick} selectable={false}>
                <Menu.Item key="profile" icon={<EditOutlined />}>
                    修改資料
                </Menu.Item>
                <Menu.Item key="logout" icon={<LogoutOutlined />}>
                    登出
                </Menu.Item>
            </Menu>
        </div>
    );

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
                            backgroundColor: notification.read ? '#fff' : '#f5f5f5',
                        }}
                        onClick={() => {
                            markAsRead(notification._id);
                            if (notification.auctionId && notification.isValidAuction) {
                                navigate(`/auction/${notification.auctionId}`);
                            } else if (notification.auctionId) {
                                message.warning('該拍賣已不存在');
                            }
                        }}
                    >
                        <Avatar
                            src={notification.imageUrl}
                            size={40}
                            style={{ marginRight: '10px' }}
                            onError={() => {
                                logger.warn('Failed to load notification image', { notificationId: notification._id, imageUrl: notification.imageUrl });
                                return true;
                            }}
                        />
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

    if (loading) {
        return (
            <Header
                style={{
                    background: '#001529',
                    padding: '0 20px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    height: '64px',
                    position: 'fixed',
                    top: 0,
                    width: '100%',
                    zIndex: 1000,
                }}
            >
                <Spin />
            </Header>
        );
    }

    return (
        <Header
            style={{
                background: '#001529',
                padding: '0 20px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                height: '64px',
                position: 'fixed',
                top: 0,
                width: '100%',
                zIndex: 1000,
            }}
        >
            {isMobile ? (
                <>
                    <Button
                        type="link"
                        icon={<MenuOutlined />}
                        onClick={() => setDrawerVisible(true)}
                        style={{ color: '#fff', fontSize: '20px', marginRight: '10px' }}
                    />
                    <Drawer
                        title="導航"
                        placement="left"
                        onClose={() => setDrawerVisible(false)}
                        open={drawerVisible}
                        bodyStyle={{ padding: 0 }}
                        width={250}
                    >
                        <Menu
                            theme="light"
                            mode="inline"
                            selectedKeys={[location.pathname]}
                            openKeys={openKeys}
                            onOpenChange={onOpenChange}
                            onClick={handleMenuClick}
                        >
                            {renderMenuItems(menuItems)}
                        </Menu>
                    </Drawer>
                </>
            ) : (
                <Menu
                    theme="dark"
                    mode="horizontal"
                    selectedKeys={[location.pathname]}
                    openKeys={openKeys}
                    onOpenChange={onOpenChange}
                    onClick={handleMenuClick}
                    style={{ flex: 1, lineHeight: '64px', borderBottom: 'none', background: 'transparent' }}
                >
                    {renderMenuItems(menuItems)}
                </Menu>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '8px' : '20px' }}>
                {deferredPrompt && (
                    <Button type="link" onClick={handleInstallPWA} style={{ color: '#fff', padding: '0 10px' }}>
                        安裝應用
                    </Button>
                )}
                {token && user ? (
                    <Spin spinning={navbarLoading}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '8px' : '20px' }}>
                            <Popover content={notificationContent} trigger="click" placement="bottomRight">
                                <Badge
                                    count={unreadCount > 9 ? '9+' : unreadCount}
                                    offset={[0, 0]}
                                    style={{ backgroundColor: '#ff4d4f', boxShadow: '0 0 5px rgba(0, 0, 0, 0.3)' }}
                                >
                                    <BellOutlined style={{ fontSize: '20px', color: '#fff', cursor: 'pointer' }} />
                                </Badge>
                            </Popover>
                            <Dropdown overlay={userMenu} trigger={['click']} placement="bottomRight">
                                <Avatar
                                    size={32}
                                    style={{
                                        cursor: 'pointer',
                                        backgroundColor: '#87d068',
                                        fontSize: '16px',
                                        fontWeight: 'bold',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        transition: 'all 0.3s ease',
                                    }}
                                    className="user-avatar"
                                >
                                    {getFirstCharacter(user.character_name)}
                                </Avatar>
                            </Dropdown>
                        </div>
                    </Spin>
                ) : (
                    <>
                        <Button
                            type="link"
                            icon={<LoginOutlined />}
                            onClick={() => navigate('/login')}
                            style={{ color: '#fff', padding: '0 10px', fontSize: '16px' }}
                        >
                            登錄
                        </Button>
                        <Button
                            type="link"
                            icon={<UserAddOutlined />}
                            onClick={() => navigate('/register')}
                            style={{ color: '#fff', padding: '0 10px', fontSize: '16px' }}
                        >
                            註冊
                        </Button>
                    </>
                )}
            </div>
            <style jsx="true">{`
                @media (max-width: 768px) {
                    .ant-btn {
                        padding: 4px 8px !important;
                    }
                    .ant-avatar {
                        width: 32px !important;
                        height: 32px !important;
                    }
                    .ant-badge {
                        margin-right: 0 !important;
                    }
                }
                .user-avatar:hover {
                    transform: scale(1.1);
                    background-color: #5cb85c !important;
                }
                .ant-dropdown-menu {
                    padding: 0 !important;
                    background-color: transparent !important;
                }
                .ant-dropdown-menu-item {
                    padding: 8px 16px !important;
                    transition: background-color 0.3s ease !important;
                }
                .ant-dropdown-menu-item:hover {
                    background-color: #f0f0f0 !important;
                }
            `}</style>
            <UserProfile visible={profileVisible} onCancel={() => setProfileVisible(false)} />
        </Header>
    );
};

export default Navbar;