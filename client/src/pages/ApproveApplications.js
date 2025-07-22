import React, { useState, useEffect } from 'react';
import { Table, Button, message, Popconfirm, Card, Spin, Alert, Tag, Input, Select } from 'antd';
import { SearchOutlined, CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';
import axios from 'axios';
import moment from 'moment';
import logger from '../utils/logger';

const { Search } = Input;
const { Option } = Select;

const BASE_URL = process.env.REACT_APP_API_URL || '';

const ApproveApplications = () => {
    const [applications, setApplications] = useState([]);
    const [loading, setLoading] = useState(false);
    const token = localStorage.getItem('token');
    const [filters, setFilters] = useState({ search: '', status: 'pending' });
    const [role, setRole] = useState(null);

    useEffect(() => {
        if (!token) {
            message.error('請先登入以查看申請列表！');
            window.location.href = '/login'; // 重定向到登入頁面
            return;
        }
        fetchUserInfo();
    }, [token]);

    useEffect(() => {
        if (role === 'admin') {
            fetchApplications();
        }
    }, [role, filters]);

    const fetchUserInfo = async () => {
        try {
            setLoading(true);
            const res = await axios.get(`${BASE_URL}/api/users/me`, {
                headers: { 'x-auth-token': token },
            });
            // 修正角色檢查：檢查 roles 字段是否包含 'admin'
            const userRoles = res.data.roles || [];
            const isAdmin = userRoles.includes('admin');
            setRole(isAdmin ? 'admin' : null);
            if (!isAdmin) {
                message.error('您無權訪問此頁面，僅限管理員使用');
                window.location.href = '/'; // 重定向到首頁
            }
        } catch (err) {
            console.error('Fetch user info error:', err);
            message.error('載入用戶信息失敗: ' + (err.response?.data?.msg || err.message));
            window.location.href = '/login'; // 重定向到登入頁面
        } finally {
            setLoading(false);
        }
    };

    const fetchApplications = async () => {
        try {
            setLoading(true);
            const params = {
                status: filters.status === 'all' ? undefined : filters.status,
                search: filters.search || undefined,
            };

            const res = await axios.get(`${BASE_URL}/api/applications`, {
                headers: { 'x-auth-token': token },
                params,
            });

            setApplications(res.data);
        } catch (err) {
            console.error('Fetch applications error:', err.response?.data || err);
            message.error('載入申請列表失敗: ' + (err.response?.data?.msg || err.message));
        } finally {
            setLoading(false);
        }
    };

    const handleApprove = async (id) => {
        try {
            setLoading(true);
            const res = await axios.post( // 改為 POST 方法
                `${BASE_URL}/api/applications/${id}/approve`,
                {},
                { headers: { 'x-auth-token': token } }
            );
            message.success(res.data.msg || '申請已批准');
            fetchApplications();
        } catch (err) {
            console.error('Approve application error:', err.response?.data || err);
            message.error(`批准申請失敗: ${err.response?.data?.msg || err.message}`);
        } finally {
            setLoading(false);
        }
    };

    const handleReject = async (id) => {
        try {
            setLoading(true);
            const res = await axios.put( // 保持 PUT 方法，因為後端定義為 PUT
                `${BASE_URL}/api/applications/${id}/reject`,
                {},
                { headers: { 'x-auth-token': token } }
            );
            message.success(res.data.msg || '申請已拒絕');
            fetchApplications();
        } catch (err) {
            console.error('Reject application error:', err.response?.data || err);
            message.error(`拒絕申請失敗: ${err.response?.data?.msg || err.message}`);
        } finally {
            setLoading(false);
        }
    };

    const getStatusTag = (status) => {
        switch (status) {
            case 'pending':
                return <Tag color="gold">待分配</Tag>;
            case 'approved':
                return <Tag color="green">已審批</Tag>;
            case 'rejected':
                return <Tag color="red">已拒絕</Tag>;
            default:
                return <Tag>{status}</Tag>;
        }
    };

    const columns = [
        {
            title: '申請ID',
            dataIndex: '_id',
            key: '_id',
            width: 150,
        },
        {
            title: '申請人',
            dataIndex: 'user_id',
            key: 'user_id',
            render: (user) => user?.character_name || '未知',
            width: 150,
        },
        {
            title: '擊殺記錄',
            dataIndex: 'kill_id',
            key: 'kill_id',
            render: (kill) => `${kill?.bossId?.name || '未知'} - ${moment(kill?.kill_time).format('YYYY-MM-DD HH:mm') || '無時間'}`,
            width: 200,
        },
        {
            title: '物品名稱',
            dataIndex: 'item_name',
            key: 'item_name',
            width: 150,
        },
        {
            title: '申請時間',
            dataIndex: 'created_at',
            key: 'created_at',
            render: (text) => moment(text).format('YYYY-MM-DD HH:mm'),
            width: 150,
        },
        {
            title: '狀態',
            dataIndex: 'status',
            key: 'status',
            render: getStatusTag,
            width: 120,
        },
        {
            title: '操作',
            key: 'actions',
            render: (text, record) => (
                record.status === 'pending' ? (
                    <>
                        <Popconfirm
                            title="確認批准此申請？"
                            onConfirm={() => handleApprove(record._id)}
                            okText="是"
                            cancelText="否"
                        >
                            <Button
                                type="primary"
                                icon={<CheckCircleOutlined />}
                                style={{ marginRight: 8 }}
                                loading={loading}
                                disabled={loading}
                            >
                                批准
                            </Button>
                        </Popconfirm>
                        <Popconfirm
                            title="確認拒絕此申請？"
                            onConfirm={() => handleReject(record._id)}
                            okText="是"
                            cancelText="否"
                        >
                            <Button
                                type="danger"
                                icon={<CloseCircleOutlined />}
                                loading={loading}
                                disabled={loading}
                            >
                                拒絕
                            </Button>
                        </Popconfirm>
                    </>
                ) : (
                    <Tag color="default">已處理</Tag>
                )
            ),
            width: 200,
        },
    ];

    if (!role) {
        return (
            <div style={{ textAlign: 'center', padding: '50px' }}>
                <Spin size="large" tip="正在載入權限信息..." />
            </div>
        );
    }

    if (role !== 'admin') {
        return (
            <div style={{ textAlign: 'center', padding: '50px' }}>
                <Alert
                    message="權限不足"
                    description="只有管理員可以訪問此頁面。"
                    type="error"
                    showIcon
                />
            </div>
        );
    }

    return (
        <div style={{ padding: '20px', backgroundColor: '#f0f2f5', minHeight: '100vh' }}>
            <Card
                title={<h2 style={{ margin: 0, fontSize: '24px', color: '#1890ff' }}>批准申請物品</h2>}
                bordered={false}
                style={{ boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)', borderRadius: '8px' }}
            >
                <div style={{ marginBottom: '16px', display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                    <Search
                        placeholder="搜索申請人或物品名稱"
                        onSearch={fetchApplications}
                        onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                        style={{ width: 200 }}
                        enterButton={<SearchOutlined />}
                    />
                    <Select
                        value={filters.status}
                        onChange={(value) => setFilters(prev => ({ ...prev, status: value }))}
                        style={{ width: 200 }}
                        onSelect={fetchApplications}
                    >
                        <Option value="pending">待處理</Option>
                        <Option value="all">全部</Option>
                    </Select>
                </div>
                <Spin spinning={loading} size="large">
                    {applications.length === 0 && !loading ? (
                        <Alert
                            message="無待審核申請"
                            description="目前沒有符合條件的申請記錄。"
                            type="info"
                            showIcon
                            style={{ marginBottom: '16px' }}
                        />
                    ) : (
                        <Table
                            dataSource={applications}
                            columns={columns}
                            rowKey="_id"
                            bordered
                            pagination={{ pageSize: 10, showSizeChanger: true, pageSizeOptions: ['10', '20', '50'] }}
                            scroll={{ x: 'max-content' }}
                        />
                    )}
                </Spin>
            </Card>
        </div>
    );
};

export default ApproveApplications;