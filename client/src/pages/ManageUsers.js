import React, { useState, useEffect, useCallback } from 'react';
import { Table, Button, Modal, Form, Input, message, Select, Row, Col, Spin, Alert, Popconfirm, Pagination, Space, Card, Descriptions, Tag, Checkbox, Tabs, Typography } from 'antd';
import { SearchOutlined, StopOutlined, EditOutlined, InfoCircleOutlined, SyncOutlined } from '@ant-design/icons';
import axios from 'axios';
import formatNumber from '../utils/formatNumber';
import moment from 'moment';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { icons } from '../assets/icons';
import { useNavigate } from 'react-router-dom';
import axiosInstance from '../utils/axiosInstance';

const { Option } = Select;
const { TabPane } = Tabs;
const { Title, Text } = Typography;

const BASE_URL = process.env.REACT_APP_API_URL || '';

const ManageUsers = () => {
    const navigate = useNavigate();
    const [users, setUsers] = useState([]);
    const [filteredUsers, setFilteredUsers] = useState([]);
    const [loading, setLoading] = useState(false);
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [isBroadcastModalVisible, setIsBroadcastModalVisible] = useState(false);
    const [isDetailModalVisible, setIsDetailModalVisible] = useState(false);
    const [editingUser, setEditingUser] = useState(null);
    const [selectedUser, setSelectedUser] = useState(null);
    const [form] = Form.useForm();
    const [broadcastForm] = Form.useForm();
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const [filters, setFilters] = useState({ search: '', status: 'all' });
    const [selectedRowKeys, setSelectedRowKeys] = useState([]);
    const [stats, setStats] = useState({ totalUsers: 0, activeUsers: 0 });
    const [growthData, setGrowthData] = useState([]);
    const [guilds, setGuilds] = useState([]);
    const [professions, setProfessions] = useState([]);
    const [rolesList, setRolesList] = useState([]);
    const [useGuildPassword, setUseGuildPassword] = useState(false);
    const token = localStorage.getItem('token');
    const [online, setOnline] = useState(navigator.onLine);
    const [deferredPrompt, setDeferredPrompt] = useState(null);
    const [suspiciousLogins, setSuspiciousLogins] = useState([]);
    const [suspiciousLoading, setSuspiciousLoading] = useState(false);
    const [userRole, setUserRole] = useState(null);
    const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 });
    const [sort, setSort] = useState({ field: 'createdAt', order: 'desc' });

    useEffect(() => {
        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            setDeferredPrompt(e);
        });

        window.addEventListener('online', () => setOnline(true));
        window.addEventListener('offline', () => setOnline(false));
    }, []);

    useEffect(() => {
        if (!token) {
            message.error('請先登入！');
            navigate('/login');
            return;
        }
        fetchUserInfo();
        fetchGuilds();
        fetchProfessions();
        fetchRoles();
        fetchSuspiciousLogins();
    }, [token, navigate]);

    const fetchUserInfo = async () => {
        try {
            const res = await axiosInstance.get(`${BASE_URL}/api/users/me`, {
                headers: { 'x-auth-token': token },
            });
            setUserRole(res.data.roles);
        } catch (err) {
            message.error('無法載入用戶信息，請重新登入');
            navigate('/login');
        }
    };

    const fetchGuilds = async () => {
        try {
            const res = await axiosInstance.get(`${BASE_URL}/api/guilds`, {
                headers: { 'x-auth-token': token },
            });
            setGuilds(res.data);
        } catch (err) {
            console.error('Fetch guilds error:', err);
            message.error('載入旅團列表失敗');
        }
    };

    const fetchProfessions = async () => {
        try {
            const res = await axiosInstance.get(`${BASE_URL}/api/professions`, {
                headers: { 'x-auth-token': token },
            });
            setProfessions(res.data);
        } catch (err) {
            console.error('Fetch professions error:', err);
            message.error('載入職業列表失敗');
        }
    };

    const fetchRoles = async () => {
        try {
            const res = await axiosInstance.get(`${BASE_URL}/api/roles`, {
                headers: { 'x-auth-token': token },
            });
            setRolesList(res.data);
        } catch (err) {
            console.error('Fetch roles error:', err);
            message.error('載入角色列表失敗');
        }
    };

    const fetchSuspiciousLogins = async () => {
        setSuspiciousLoading(true);
        try {
            const res = await axiosInstance.get(`${BASE_URL}/api/auth/suspicious-logins`, {
                headers: { 'x-auth-token': token },
            });
            setSuspiciousLogins(res.data);
        } catch (err) {
            console.error('Fetch suspicious logins error:', err);
            message.error('載入可疑登入記錄失敗');
        } finally {
            setSuspiciousLoading(false);
        }
    };

    const handleInstallPWA = () => {
        if (deferredPrompt) {
            deferredPrompt.prompt();
            deferredPrompt.userChoice.then((choiceResult) => {
                if (choiceResult.outcome === 'accepted') {
                    // 用戶接受了安裝
                } else {
                    // 用戶拒絕了安裝
                }
                setDeferredPrompt(null);
            });
        }
    };

    const fetchUsers = useCallback(async (page = 1, size = 10) => {
        if (!online) {
            message.warning('目前處於離線模式，使用上次數據');
            return;
        }
        setLoading(true);
        try {
            const res = await axiosInstance.get(`${BASE_URL}/api/users`, {
                headers: { 'x-auth-token': token },
                params: {
                    keyword: filters.search || undefined,
                    status: filters.status === 'all' ? undefined : filters.status,
                    page,
                    pageSize: size,
                    sortBy: sort.field,
                    sortOrder: sort.order,
                },
            });
            if (res.data && Array.isArray(res.data.data)) {
                setUsers(res.data.data);
                setFilteredUsers(res.data.data);
                setPagination(res.data.pagination || { current: page, pageSize: size, total: res.data.data.length });
            } else {
                setUsers([]);
                setFilteredUsers([]);
                setPagination({ current: 1, pageSize: 10, total: 0 });
                message.warning('API 返回數據格式不正確');
            }
        } catch (err) {
            console.error('Fetch users error:', {
                status: err.response?.status,
                data: err.response?.data,
                message: err.message,
            });
            if (err.response?.status === 401 || err.response?.status === 403) {
                message.error(err.response?.data?.msg || '無權限訪問，請檢查 Token 或權限');
                navigate('/login');
            } else {
                message.error(`載入盟友列表失敗: ${err.response?.data?.msg || err.message}`);
            }
            setUsers([]);
            setFilteredUsers([]);
            setPagination({ current: 1, pageSize: 10, total: 0 });
        } finally {
            setLoading(false);
        }
    }, [token, filters, online, navigate, sort]);

    const handleFilterChange = (field, value) => {
        setFilters(prev => ({ ...prev, [field]: value }));
        setPagination(prev => ({ ...prev, current: 1 }));
    };

    const handleTableChange = (pagination, _, sorter) => {
        setPagination(pagination);
        if (sorter.field && sorter.order) {
            setSort({
                field: sorter.field,
                order: sorter.order === 'ascend' ? 'asc' : 'desc',
            });
        }
        fetchUsers(pagination.current, pagination.pageSize);
    };

    const handleSortChange = (value) => {
        const [field, order] = value.split('_');
        setSort({ field, order });
        setPagination(prev => ({ ...prev, current: 1 }));
    };

    const fetchStats = useCallback(async () => {
        if (!online) return;
        try {
            const res = await axiosInstance.get(`${BASE_URL}/api/users/stats`, {
                headers: { 'x-auth-token': token },
            });
            setStats(res.data);
        } catch (err) {
            console.error('Fetch stats error:', err);
            message.error(`獲取統計數據失敗: ${err.response?.data?.msg || err.message}`);
        }
    }, [token, online]);

    const fetchGrowthData = useCallback(async () => {
        if (!online) return;
        try {
            const res = await axiosInstance.get(`${BASE_URL}/api/users/growth`, {
                headers: { 'x-auth-token': token },
            });
            setGrowthData(res.data);
        } catch (err) {
            console.error('Fetch growth data error:', err);
            message.error(`獲取增長趨勢失敗: ${err.response?.data?.msg || err.message}`);
        }
    }, [token, online]);

    useEffect(() => {
        fetchUsers(pagination.current, pagination.pageSize);
        fetchStats();
        fetchGrowthData();
        const interval = setInterval(() => {
            fetchUsers(pagination.current, pagination.pageSize);
            fetchStats();
            fetchGrowthData();
        }, 60000);
        return () => clearInterval(interval);
    }, [fetchUsers, fetchStats, fetchGrowthData, pagination.current, pagination.pageSize]);

    const showModal = (user = null) => {
        if (!token) {
            message.error('請先登入以管理盟友！');
            return;
        }
        setEditingUser(user);
        setUseGuildPassword(false);
        form.resetFields();
        form.setFieldsValue({
            world_name: user?.world_name || '',
            character_name: user?.character_name || '',
            discord_id: user?.discord_id || '',
            raid_level: user?.raid_level || 0,
            diamonds: user?.diamonds || 0,
            status: user?.status || 'pending',
            screenshot: user?.screenshot || '',
            roles: user?.roles.map(role => role._id) || [],
            guildId: user?.guildId?._id || null,
            mustChangePassword: user?.mustChangePassword || false,
            profession: user?.profession?._id || null,
            password: '',
            confirm_password: '',
            useGuildPassword: false,
            combatPower: user?.combatPower || 0,
        });
        setIsModalVisible(true);
    };

    const showDetailModal = (user) => {
        setSelectedUser(user);
        setIsDetailModalVisible(true);
    };

    const handleOk = async () => {
        try {
            if (!token) {
                message.error('請先登入以管理盟友！');
                return;
            }
            const values = await form.validateFields();
            if (values.password && values.confirm_password && values.password !== values.confirm_password) {
                message.error('兩次輸入的密碼不一致！');
                return;
            }

            const { confirm_password, ...filteredValues } = values;

            if (filteredValues.raid_level !== undefined && filteredValues.raid_level !== null && filteredValues.raid_level !== '') {
                filteredValues.raid_level = parseInt(filteredValues.raid_level, 10);
            } else {
                filteredValues.raid_level = 0;
            }

            if (filteredValues.diamonds) {
                filteredValues.diamonds = parseInt(filteredValues.diamonds, 10);
            }

            if (!editingUser && (!filteredValues.character_name || !filteredValues.guildId)) {
                message.error('請確保角色名稱和旅團已填寫！');
                return;
            }

            const formData = new FormData();
            Object.keys(filteredValues).forEach(key => {
                if (key === 'roles') {
                    formData.append(key, JSON.stringify(filteredValues[key]));
                } else {
                    formData.append(key, filteredValues[key] !== undefined && filteredValues[key] !== null ? filteredValues[key] : '');
                }
            });

            const formDataEntries = {};
            for (let [key, value] of formData.entries()) {
                formDataEntries[key] = value;
            }

            const url = editingUser ? `/api/users/${editingUser._id}` : '/api/users/create-member';
            const method = editingUser ? 'put' : 'post';

            setLoading(true);
            const res = await axios[method](`${BASE_URL}${url}`, formData, {
                headers: { 'x-auth-token': token, 'Content-Type': 'multipart/form-data' },
            });
            message.success(`盟友${editingUser ? '更新' : '創建'}成功`);
            setIsModalVisible(false);
            fetchUsers(pagination.current, pagination.pageSize);
        } catch (err) {
            if (err.response) {
                message.error(`盟友${editingUser ? '更新' : '創建'}失敗: ${err.response.data?.msg || err.message}`);
            } else if (err.request) {
                message.error(`網絡請求失敗: 請檢查服務器連線`);
            } else {
                message.error(`請求配置錯誤: ${err.message}`);
            }
        } finally {
            setLoading(false);
        }
    };

    const handleDisable = async (id) => {
        const user = users.find(u => u._id === id);
        if (user && (user.roles.some(role => ['admin', 'guild'].includes(role.name)))) {
            message.error(`無法禁用角色為 admin 或 guild 的帳號！`);
            return;
        }

        try {
            if (!token) {
                message.error('請先登入以管理盟友！');
                return;
            }
            setLoading(true);
            const res = await axiosInstance.put(`${BASE_URL}/api/users/${id}/disable`, {}, {
                headers: { 'x-auth-token': token },
            });
            message.success('盟友已設為 DISABLED 狀態');
            fetchUsers(pagination.current, pagination.pageSize);
        } catch (err) {
            console.error('Disable user error:', {
                status: err.response?.status,
                data: err.response?.data,
                message: err.message,
                code: err.code,
            });
            message.error('設為 DISABLED 失敗: ' + err.response?.data?.msg || err.message || '網絡錯誤');
        } finally {
            setLoading(false);
        }
    };

    const handleBatchDisable = async () => {
        if (!token || selectedRowKeys.length === 0) {
            message.warning('請先登入並選擇至少一個盟友進行操作');
            return;
        }

        const selectedUsers = users.filter(user => selectedRowKeys.includes(user._id));
        const protectedUsers = selectedUsers.filter(user => user.roles.some(role => ['admin', 'guild'].includes(role.name)));
        if (protectedUsers.length > 0) {
            const protectedRoles = [...new Set(protectedUsers.map(user => user.roles.map(role => role.name)).flat())].join(', ');
            message.error(`無法禁用角色為 ${protectedRoles} 的帳號！`);
            return;
        }

        setLoading(true);
        try {
            await axiosInstance.put(`${BASE_URL}/api/users/batch-disable`, { ids: selectedRowKeys }, {
                headers: { 'x-auth-token': token },
            });
            message.success('批量設為 DISABLED 成功');
            fetchUsers(pagination.current, pagination.pageSize);
            setSelectedRowKeys([]);
        } catch (err) {
            console.error('Batch disable error:', err);
            message.error(`批量設為 DISABLED 失敗: ${err.response?.data?.msg || err.message}`);
        } finally {
            setLoading(false);
        }
    };

    const handleBroadcast = async () => {
        try {
            const values = await broadcastForm.validateFields();
            if (!values.message.trim()) {
                message.error('請輸入通知內容！');
                return;
            }
            setLoading(true);
            const res = await axiosInstance.post(
                `${BASE_URL}/api/notifications/broadcast`,
                { message: values.message, auctionId: values.auctionId || null },
                { headers: { 'x-auth-token': token } }
            );
            message.success(res.data.msg);
            setIsBroadcastModalVisible(false);
            broadcastForm.resetFields();
        } catch (err) {
            console.error('Broadcast error:', err.response?.data || err);
            message.error(`發送通知失敗: ${err.response?.data?.msg || err.message}`);
        } finally {
            setLoading(false);
        }
    };

    const handleGuildChange = (guildId) => {
        if (useGuildPassword) {
            const selectedGuild = guilds.find(g => g._id === guildId);
            if (selectedGuild && selectedGuild.password) {
                form.setFieldsValue({
                    password: selectedGuild.password,
                    confirm_password: selectedGuild.password,
                    mustChangePassword: true,
                });
            } else {
                form.setFieldsValue({
                    password: '',
                    confirm_password: '',
                    mustChangePassword: false,
                });
            }
        }
    };

    const handleUseGuildPasswordChange = (checked) => {
        setUseGuildPassword(checked);
        if (checked) {
            const guildId = form.getFieldValue('guildId');
            handleGuildChange(guildId);
        } else {
            form.setFieldsValue({
                password: '',
                confirm_password: '',
                mustChangePassword: false,
            });
        }
    };

    const validateConfirmPassword = (_, value) => {
        const password = form.getFieldValue('password');
        return new Promise((resolve, reject) => {
            if (!value || !editingUser) {
                resolve();
            } else if (password === value) {
                resolve();
            } else {
                reject(new Error('兩次輸入的密碼不一致！'));
            }
        });
    };

    const rowSelection = {
        selectedRowKeys,
        onChange: (selectedKeys) => setSelectedRowKeys(selectedKeys),
        getCheckboxProps: (record) => ({
            disabled: record.roles.some(role => ['admin', 'guild'].includes(role.name)),
        }),
    };

    const userColumns = [
        { title: '角色名稱', dataIndex: 'character_name', key: 'character_name', width: 150 },
        { title: '討伐等級', dataIndex: 'raid_level', key: 'raid_level', width: 120 },
        { title: '戰力', dataIndex: 'combatPower', key: 'combatPower', width: 120 },
        { title: '鑽石數', dataIndex: 'diamonds', key: 'diamonds', render: (text) => formatNumber(text), width: 120 },
        {
            title: '職業',
            dataIndex: 'profession',
            key: 'profession',
            width: 150,
            render: (profession) => (
                profession ? (
                    <Space>
                        <img src={icons[profession.icon]} alt={profession.name} style={{ width: 24, height: 24 }} />
                        <span>{profession.name}</span>
                    </Space>
                ) : '無'
            ),
        },
        {
            title: '狀態',
            dataIndex: 'status',
            key: 'status',
            width: 120,
            render: (status) => (
                <Tag color={status === 'active' ? 'green' : status === 'pending' ? 'gold' : 'red'}>
                    {status === 'active' ? '活躍' : status === 'pending' ? '待審核' : '已禁用'}
                </Tag>
            ),
        },
        {
            title: '角色',
            dataIndex: 'roles',
            key: 'roles',
            width: 120,
            render: (roles) => roles.map(role => role.name).join(', '),
        },
        {
            title: '操作',
            key: 'action',
            width: 200,
            render: (_, record) => (
                <Space size={8}>
                    <Button
                        type="primary"
                        shape="round"
                        size="small"
                        icon={<EditOutlined />}
                        onClick={() => showModal(record)}
                        disabled={loading}
                        style={{ background: '#1890ff', color: '#fff', borderColor: '#1890ff' }}
                        onMouseEnter={(e) => (e.target.style.background = '#40a9ff')}
                        onMouseLeave={(e) => (e.target.style.background = '#1890ff')}
                    >
                        編輯
                    </Button>
                    <Button
                        type="default"
                        shape="round"
                        size="small"
                        icon={<InfoCircleOutlined />}
                        onClick={() => showDetailModal(record)}
                        disabled={loading}
                        style={{ borderColor: '#d9d9d9', color: '#1890ff' }}
                        onMouseEnter={(e) => (e.target.style.background = '#e6f7ff')}
                        onMouseLeave={(e) => (e.target.style.background = 'transparent')}
                    >
                        詳情
                    </Button>
                    {record.status !== 'disabled' && (
                        <Popconfirm
                            title="確認將此盟友設為 DISABLED 狀態？"
                            onConfirm={() => handleDisable(record._id)}
                            okText="是"
                            cancelText="否"
                            disabled={loading || record.roles.some(role => ['admin', 'guild'].includes(role.name))}
                        >
                            <Button
                                type="danger"
                                shape="round"
                                size="small"
                                icon={<StopOutlined />}
                                disabled={loading || record.roles.some(role => ['admin', 'guild'].includes(role.name))}
                                style={{ background: '#ff4d4f', color: '#fff', borderColor: '#ff4d4f' }}
                                onMouseEnter={(e) => (e.target.style.background = '#ff7875')}
                                onMouseLeave={(e) => (e.target.style.background = '#ff4d4f')}
                            >
                                設為 DISABLED
                            </Button>
                        </Popconfirm>
                    )}
                </Space>
            ),
        },
    ];

    const suspiciousColumns = [
        {
            title: 'IP 地址',
            dataIndex: 'ipAddress',
            key: 'ipAddress',
            width: 150,
        },
        {
            title: '帳號數量',
            dataIndex: 'userCount',
            key: 'userCount',
            width: 100,
        },
        {
            title: '角色名稱',
            dataIndex: 'characterNames',
            key: 'characterNames',
            width: 200,
            render: (names) => names.join(', '),
        },
        {
            title: '登入記錄',
            dataIndex: 'loginRecords',
            key: 'loginRecords',
            render: (records) => (
                <ul>
                    {records.map((record, index) => (
                        <li key={index}>
                            {record.characterName} - {moment(record.loginTime).format('YYYY-MM-DD HH:mm:ss')}
                            <br />
                            <Text type="secondary">User-Agent: {record.userAgent || '未知'}</Text>
                        </li>
                    ))}
                </ul>
            ),
        },
    ];

    const handlePaginationChange = (page, size) => {
        setPagination(prev => ({ ...prev, current: page, pageSize: size }));
        fetchUsers(page, size);
    };

    return (
        <div style={{ padding: '20px', backgroundColor: '#f0f2f5', minHeight: '100vh' }}>
            <Card
                title={
                    <Row justify="space-between" align="middle">
                        <h2 style={{ margin: 0, fontSize: '24px', color: '#1890ff' }}>管理盟友</h2>
                        {deferredPrompt && (
                            <Button type="link" onClick={handleInstallPWA}>
                                安裝應用
                            </Button>
                        )}
                    </Row>
                }
                bordered={false}
                style={{ boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)', borderRadius: '8px', marginBottom: '16px' }}
            >
                <Row gutter={[16, 16]} style={{ marginBottom: '16px' }}>
                    <Col xs={24} sm={12} md={8}>
                        <Card title="總盟友數" bordered={false}>
                            <h3>{stats.totalUsers}</h3>
                        </Card>
                    </Col>
                    <Col xs={24} sm={12} md={8}>
                        <Card title="活躍盟友數" bordered={false}>
                            <h3>{stats.activeUsers}</h3>
                        </Card>
                    </Col>
                </Row>
                <Card title="盟友增長趨勢（過去 30 天）" bordered={false} style={{ marginBottom: '16px' }}>
                    <ResponsiveContainer width="100%" height={300}>
                        <LineChart data={growthData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="_id" />
                            <YAxis />
                            <Tooltip />
                            <Legend />
                            <Line type="monotone" dataKey="count" stroke="#1890ff" name="新增盟友數" />
                        </LineChart>
                    </ResponsiveContainer>
                </Card>
            </Card>

            <Tabs defaultActiveKey="1">
                <TabPane tab="盟友列表" key="1">
                    <Card
                        bordered={false}
                        style={{ boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)', borderRadius: '8px' }}
                    >
                        <div style={{ marginBottom: '16px', display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
                            <Input.Search
                                placeholder="搜索角色名稱或世界名稱"
                                value={filters.search}
                                onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                                onSearch={() => fetchUsers(pagination.current, pagination.pageSize)}
                                style={{ width: 200 }}
                                enterButton={<SearchOutlined />}
                            />
                            <Select
                                value={filters.status}
                                onChange={(value) => setFilters(prev => ({ ...prev, status: value }))}
                                style={{ width: 200 }}
                                onSelect={() => fetchUsers(pagination.current, pagination.pageSize)}
                            >
                                <Option value="all">全部狀態</Option>
                                <Option value="pending">待審核</Option>
                                <Option value="active">活躍</Option>
                                <Option value="disabled">已禁用</Option>
                            </Select>
                            {userRole?.includes('admin') && (
                                <>
                                    <Button type="primary" onClick={() => showModal()} style={{ marginRight: 16 }} disabled={loading || !token}>
                                        添加盟友
                                    </Button>
                                    <Button type="primary" onClick={() => navigate('/manage-roles')} style={{ marginRight: 16 }}>
                                        管理角色
                                    </Button>
                                    <Button type="primary" onClick={() => setIsBroadcastModalVisible(true)} disabled={loading || !token}>
                                        發送廣播通知
                                    </Button>
                                    <Popconfirm
                                        title="確認將選中盟友設為 DISABLED 狀態？"
                                        onConfirm={handleBatchDisable}
                                        okText="是"
                                        cancelText="否"
                                        disabled={loading || selectedRowKeys.length === 0 || !token}
                                    >
                                      
                                    </Popconfirm>
                                </>
                            )}
                            <Button
                                type="default"
                                icon={<SyncOutlined />}
                                onClick={() => {
                                    fetchUsers(pagination.current, pagination.pageSize);
                                    fetchStats();
                                    fetchGrowthData();
                                }}
                                disabled={loading || !online}
                                style={{ marginLeft: 'auto' }}
                            >
                                刷新
                            </Button>
                        </div>
                        <Spin spinning={loading} size="large">
                            {filteredUsers.length === 0 && !loading ? (
                                <Alert
                                    message="無盟友數據"
                                    description="目前沒有符合條件的盟友記錄。"
                                    type="info"
                                    showIcon
                                    style={{ marginBottom: '16px' }}
                                />
                            ) : (
                                <>
                                    <Table
                                        rowSelection={userRole?.includes('admin') ? rowSelection : undefined}
                                        dataSource={filteredUsers}
                                        columns={userColumns}
                                        rowKey="_id"
                                        bordered
                                        pagination={false}
                                        scroll={{ x: 'max-content' }}
                                        onChange={handleTableChange}
                                    />
                                    <Pagination
                                        current={pagination.current}
                                        pageSize={pagination.pageSize}
                                        total={pagination.total}
                                        onChange={handlePaginationChange}
                                        onShowSizeChange={handlePaginationChange}
                                        style={{ marginTop: '16px', textAlign: 'right' }}
                                        showSizeChanger
                                        pageSizeOptions={['10', '20', '50']}
                                    />
                                </>
                            )}
                        </Spin>
                    </Card>
                </TabPane>
                <TabPane tab="可疑登入" key="2">
                    <Card
                        bordered={false}
                        style={{ boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)', borderRadius: '8px' }}
                    >
                        <Title level={4} style={{ color: '#ff4d4f', marginBottom: '16px' }}>
                            可疑登入警示
                        </Title>
                        <Alert
                            message="注意"
                            description="以下列表顯示過去 45 天內從同一 IP 登入不同帳號的記錄，這只是一個警示，請勿將被列出的盟友都定義成蹭鑽（雖然他可能偷領一份，而且還吃掉你一個系統名額）。資料僅保留 45 天。"
                            type="warning"
                            showIcon
                            style={{ marginBottom: '16px' }}
                        />
                        <Spin spinning={suspiciousLoading} size="large">
                            {suspiciousLogins.length === 0 && !suspiciousLoading ? (
                                <Alert
                                    message="無可疑登入記錄"
                                    description="過去 45 天內未發現從同一 IP 登入不同帳號的行為。"
                                    type="info"
                                    showIcon
                                    style={{ marginBottom: '16px' }}
                                />
                            ) : (
                                <Table
                                    dataSource={suspiciousLogins}
                                    columns={suspiciousColumns}
                                    rowKey="ipAddress"
                                    bordered
                                    pagination={false}
                                    scroll={{ x: 'max-content' }}
                                />
                            )}
                        </Spin>
                    </Card>
                </TabPane>
            </Tabs>

            <Modal
                title={editingUser ? '編輯盟友' : '添加盟友'}
                visible={isModalVisible}
                onOk={handleOk}
                onCancel={() => setIsModalVisible(false)}
                width={600}
                confirmLoading={loading}
            >
                <Form form={form} layout="vertical" style={{ maxWidth: '100%' }}>
                    <Tabs defaultActiveKey="1" centered>
                        <TabPane tab="基本信息" key="1">
                            <Row gutter={[16, 8]}>
                                <Col xs={24} sm={12}>
                                    <Form.Item
                                        name="world_name"
                                        label="世界名稱"
                                        rules={[{ required: true, message: '請輸入世界名稱！' }]}
                                    >
                                        <Input />
                                    </Form.Item>
                                </Col>
                                <Col xs={24} sm={12}>
                                    <Form.Item
                                        name="character_name"
                                        label="角色名稱"
                                        rules={[{ required: true, message: '請輸入角色名稱！' }]}
                                        hasFeedback
                                    >
                                        <Input disabled={!!editingUser} />
                                    </Form.Item>
                                </Col>
                                <Col xs={24} sm={12}>
                                    <Form.Item
                                        name="guildId"
                                        label="旅團"
                                        rules={[{ required: true, message: '請選擇旅團！' }]}
                                    >
                                        <Select
                                            placeholder="選擇旅團"
                                            onChange={handleGuildChange}
                                        >
                                            {guilds.map(guild => (
                                                <Option key={guild._id} value={guild._id}>
                                                    {guild.name}
                                                </Option>
                                            ))}
                                        </Select>
                                    </Form.Item>
                                </Col>
                                <Col xs={24} sm={12}>
                                    <Form.Item
                                        name="profession"
                                        label="職業"
                                    >
                                        <Select placeholder="選擇職業" allowClear>
                                            {professions.map(prof => (
                                                <Option key={prof._id} value={prof._id}>
                                                    <Space>
                                                        <img src={icons[prof.icon]} alt={prof.name} style={{ width: 24, height: 24 }} />
                                                        <span>{prof.name}</span>
                                                    </Space>
                                                </Option>
                                            ))}
                                        </Select>
                                    </Form.Item>
                                </Col>
                                <Col xs={24} sm={12}>
                                    <Form.Item
                                        name="raid_level"
                                        label="討伐等級"
                                        rules={[
                                            {
                                                validator: (_, value) => {
                                                    if (value === undefined || value === null || value === '') {
                                                        return Promise.reject(new Error('請輸入討伐等級！'));
                                                    }
                                                    const numValue = parseInt(value, 10);
                                                    if (isNaN(numValue) || numValue < 0) {
                                                        return Promise.reject(new Error('討伐等級必須為非負數！'));
                                                    }
                                                    return Promise.resolve();
                                                },
                                            },
                                        ]}
                                    >
                                        <Input type="number" min={0} />
                                    </Form.Item>
                                </Col>
                                <Col xs={24} sm={12}>
                                    <Form.Item
                                        name="combatPower"
                                        label="戰力"
                                        rules={[
                                            {
                                                validator: (_, value) => {
                                                    if (value === undefined || value === null || value === '') {
                                                        return Promise.reject(new Error('請輸入戰力！'));
                                                    }
                                                    const numValue = parseInt(value, 10);
                                                    if (isNaN(numValue) || numValue < 0) {
                                                        return Promise.reject(new Error('戰力必須為非負數！'));
                                                    }
                                                    return Promise.resolve();
                                                },
                                            },
                                        ]}
                                    >
                                        <Input type="number" min={0} />
                                    </Form.Item>
                                </Col>
                                <Col xs={24} sm={12}>
                                    <Form.Item
                                        name="diamonds"
                                        label="鑽石數💎"
                                        rules={[{ type: 'number', min: 0, message: '鑽石數必須為非負數！' }]}
                                    >
                                        <Input type="number" min={0} disabled={true} />
                                    </Form.Item>
                                </Col>
                            </Row>
                        </TabPane>
                        <TabPane tab="帳號設定" key="2">
                            <Row gutter={[16, 8]}>
                                <Col xs={24} sm={12}>
                                    <Form.Item
                                        name="discord_id"
                                        label="Discord ID"
                                        rules={[{ pattern: /^\d{19}$/, message: '請輸入有效的 Discord ID！' }]}
                                    >
                                        <Input />
                                    </Form.Item>
                                </Col>
                                <Col xs={24} sm={12}>
                                    <Form.Item
                                        name="status"
                                        label="狀態"
                                        rules={[{ required: true, message: '請選擇狀態！' }]}
                                    >
                                        <Select>
                                            <Option value="pending">待審核</Option>
                                            <Option value="active">活躍</Option>
                                            <Option value="disabled">已禁用</Option>
                                        </Select>
                                    </Form.Item>
                                </Col>
                                <Col xs={24} sm={12}>
                                    <Form.Item
                                        name="screenshot"
                                        label="截圖"
                                        rules={[{ type: 'url', message: '請輸入有效的 URL 地址！' }]}
                                    >
                                        <Input placeholder="輸入截圖 URL" />
                                    </Form.Item>
                                </Col>
                                <Col xs={24} sm={12}>
                                    <Form.Item
                                        name="roles"
                                        label="角色"
                                        rules={[{ required: true, message: '請選擇至少一個角色！' }]}
                                    >
                                        <Select mode="multiple" placeholder="選擇角色">
                                            {rolesList.map(role => (
                                                <Option key={role._id} value={role._id}>
                                                    {role.name}
                                                </Option>
                                            ))}
                                        </Select>
                                    </Form.Item>
                                </Col>
                            </Row>
                        </TabPane>
                        {!editingUser && (
                            <TabPane tab="密碼設定" key="3">
                                <Row gutter={[16, 8]}>
                                    <Col xs={24}>
                                        <Form.Item
                                            name="useGuildPassword"
                                            label="使用旅團密碼"
                                            valuePropName="checked"
                                        >
                                            <Checkbox onChange={(e) => handleUseGuildPasswordChange(e.target.checked)}>
                                                使用旅團密碼（盟友首次登入需更改）
                                            </Checkbox>
                                        </Form.Item>
                                    </Col>
                                    <Col xs={24} sm={12}>
                                        <Form.Item
                                            name="password"
                                            label="初始密碼"
                                            rules={[{ required: !useGuildPassword, message: '請輸入初始密碼！' }]}
                                        >
                                            <Input.Password placeholder="輸入初始密碼" disabled={useGuildPassword} />
                                        </Form.Item>
                                    </Col>
                                    <Col xs={24} sm={12}>
                                        <Form.Item
                                            name="confirm_password"
                                            label="確認密碼"
                                            dependencies={['password']}
                                            rules={[
                                                { required: !useGuildPassword, message: '請確認密碼！' },
                                                { validator: validateConfirmPassword },
                                            ]}
                                            validateTrigger={['onChange', 'onBlur']}
                                        >
                                            <Input.Password placeholder="請再次輸入初始密碼" disabled={useGuildPassword} />
                                        </Form.Item>
                                    </Col>
                                    <Col xs={24}>
                                        <Form.Item
                                            name="mustChangePassword"
                                            label="是否需更改密碼"
                                            valuePropName="checked"
                                            hidden
                                        >
                                            <Checkbox />
                                        </Form.Item>
                                    </Col>
                                </Row>
                            </TabPane>
                        )}
                    </Tabs>
                </Form>
            </Modal>
            <Modal
                title="盟友詳情"
                visible={isDetailModalVisible}
                onOk={() => setIsDetailModalVisible(false)}
                onCancel={() => setIsDetailModalVisible(false)}
                footer={null}
            >
                {selectedUser && (
                    <Descriptions bordered column={1}>
                        <Descriptions.Item label="世界名稱">{selectedUser.world_name}</Descriptions.Item>
                        <Descriptions.Item label="角色名稱">{selectedUser.character_name}</Descriptions.Item>
                        <Descriptions.Item label="Discord ID">{selectedUser.discord_id || '無'}</Descriptions.Item>
                        <Descriptions.Item label="討伐等級">{selectedUser.raid_level}</Descriptions.Item>
                        <Descriptions.Item label="戰力">{selectedUser.combatPower}</Descriptions.Item>
                        <Descriptions.Item label="鑽石數">{formatNumber(selectedUser.diamonds)}💎</Descriptions.Item>
                        <Descriptions.Item label="職業">
                            {selectedUser.profession ? (
                                <Space>
                                    <img src={icons[selectedUser.profession.icon]} alt={selectedUser.profession.name} style={{ width: 24, height: 24 }} />
                                    <span>{selectedUser.profession.name}</span>
                                </Space>
                            ) : '無'}
                        </Descriptions.Item>
                        <Descriptions.Item label="狀態">
                            {selectedUser.status === 'active' ? '活躍' : selectedUser.status === 'pending' ? '待審核' : '已禁用'}
                        </Descriptions.Item>
                        <Descriptions.Item label="截圖">
                            {selectedUser.screenshot ? (
                                <a href={selectedUser.screenshot} target="_blank" rel="noopener noreferrer">查看</a>
                            ) : '無'}
                        </Descriptions.Item>
                        <Descriptions.Item label="角色">
                            {selectedUser.roles.map(role => role.name).join(', ')}
                        </Descriptions.Item>
                        <Descriptions.Item label="旅團">{selectedUser.guildId?.name || '無'}</Descriptions.Item>
                        <Descriptions.Item label="是否需更改密碼">{selectedUser.mustChangePassword ? '是' : '否'}</Descriptions.Item>
                        <Descriptions.Item label="創建時間">{moment(selectedUser.createdAt).format('YYYY-MM-DD HH:mm:ss')}</Descriptions.Item>
                        <Descriptions.Item label="更新時間">{moment(selectedUser.updatedAt).format('YYYY-MM-DD HH:mm:ss')}</Descriptions.Item>
                    </Descriptions>
                )}
            </Modal>
            <Modal
                title="發送廣播通知"
                visible={isBroadcastModalVisible}
                onOk={handleBroadcast}
                onCancel={() => setIsBroadcastModalVisible(false)}
                okText="發送"
                cancelText="取消"
                confirmLoading={loading}
            >
                <Form form={broadcastForm} layout="vertical">
                    <Form.Item
                        name="message"
                        label="通知內容"
                        rules={[{ required: true, message: '請輸入通知內容！' }, { max: 500, message: '通知內容不得超過 500 字！' }]}
                    >
                        <Input.TextArea rows={4} placeholder="輸入通知內容" />
                    </Form.Item>
                    <Form.Item name="auctionId" label="拍賣 ID (可選)">
                        <Input placeholder="輸入拍賣 ID (留空則不關聯)" />
                    </Form.Item>
                    <p>注意：通知將發送給所有盟友。</p>
                </Form>
            </Modal>
            {!online && (
                <Alert
                    message="離線模式"
                    description="目前處於離線模式，數據可能不是最新。請檢查網絡後刷新。"
                    type="warning"
                    showIcon
                    style={{ marginTop: '16px' }}
                />
            )}
        </div>
    );
};

export default ManageUsers;