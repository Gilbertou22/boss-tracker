import React, { useState, useEffect } from 'react';
import { Row, Col, Button, message, Card, Spin, Alert, Input, Select, Table, Space, Tooltip, Popconfirm } from 'antd';
import { SendOutlined, UserOutlined, DownloadOutlined } from '@ant-design/icons';
import axios from 'axios';

const { Option } = Select;
const { TextArea } = Input;
const BASE_URL = process.env.REACT_APP_API_URL || '';

const DiscordMessageSender = () => {
    const [members, setMembers] = useState([]);
    const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 });
    const [filters, setFilters] = useState({ keyword: '' });
    const [role, setRole] = useState(null);
    const [loading, setLoading] = useState(false);
    const [sending, setSending] = useState(false);
    const [messageContent, setMessageContent] = useState('');
    const [selectedMemberIds, setSelectedMemberIds] = useState([]);
    const [selectedRowKeys, setSelectedRowKeys] = useState([]);
    const token = localStorage.getItem('token');

    // 在狀態中添加 channelId
    const [channelId, setChannelId] = useState('1359700987539099799'); // 你的 channel ID

    useEffect(() => {
        if (!token) {
            message.error('請先登入以發送 Discord 訊息！');
            return;
        }
        fetchUserInfo();
        fetchMembers(pagination.current, pagination.pageSize);
    }, [token, filters, pagination.current, pagination.pageSize]);

    const fetchUserInfo = async () => {
        try {
            setLoading(true);
            const res = await axios.get(`${BASE_URL}/api/users/me`, {
                headers: { 'x-auth-token': token },
            });
            setRole(res.data.roles && res.data.roles.length > 0 ? res.data.roles[0] : null);
        } catch (err) {
            message.error('載入用戶信息失敗: ' + (err.response?.data?.msg || err.message));
        } finally {
            setLoading(false);
        }
    };

    const fetchMembers = async (page = 1, pageSize = 10) => {
        try {
            setLoading(true);
            const params = {
                keyword: filters.keyword || undefined,
                hasDiscordId: true, // 假設後端支持過濾有 Discord ID 的成員
                page,
                pageSize,
            };
            const res = await axios.get(`${BASE_URL}/api/users`, { // 假設有 /api/users 端點返回成員列表
                headers: { 'x-auth-token': token },
                params,
            });
            setMembers(res.data.data || []);
            setPagination({
                current: res.data.pagination.current,
                pageSize: res.data.pagination.pageSize,
                total: res.data.pagination.total,
            });
        } catch (err) {
            message.error(`載入成員列表失敗: ${err.response?.data?.msg || err.message} `);
        } finally {
            setLoading(false);
        }
    };

    const handleFilterChange = (field, value) => {
        setFilters(prev => ({ ...prev, [field]: value }));
        setPagination(prev => ({ ...prev, current: 1 }));
    };

    const handleTableChange = (pagination) => {
        setPagination(pagination);
        fetchMembers(pagination.current, pagination.pageSize);
    };

    const handleSendMessage = async () => {
        if (!messageContent) {
            message.warning('請輸入訊息內容！');
            return;
        }
        if (selectedMemberIds.length === 0) {
            message.warning('請選擇接收者！');
            return;
        }
        if (role !== 'admin' && role !== 'guild') {
            message.error('無權限發送訊息！');
            return;
        }
        setSending(true);
        try {
            const res = await axios.post(
                `${BASE_URL}/api/notifications/send-discord`,
                {
                    channelId, // 傳遞 channel ID
                    userIds: selectedMemberIds,
                    message: messageContent,
                },
                { headers: { 'x-auth-token': token } }
            );
            message.success(res.data.message || '訊息發送成功！');
            setMessageContent('');
            setSelectedMemberIds([]);
        } catch (err) {
            message.error(`發送失敗: ${err.response?.data?.msg || err.message}`);
        } finally {
            setSending(false);
        }
    };

    const handleBatchSend = () => {
        // 可以擴展為批量發送邏輯，如果需要
        handleSendMessage();
    };

    const columns = [
        {
            title: '成員名稱',
            dataIndex: 'character_name',
            key: 'character_name',
            render: (name) => name || '未知成員',
        },
        {
            title: 'Discord ID',
            dataIndex: 'discord_id',
            key: 'discord_id',
            render: (id) => id || '無',
        },
        {
            title: '角色',
            dataIndex: 'roles',
            key: 'roles',
            render: (roles) => roles?.[0]?.name || 'user',
        },
        {
            title: '操作',
            key: 'actions',
            render: (_, record) => (
                <Space size="small">
                    <Tooltip title="發送訊息">
                        <Popconfirm
                            title="確認發送到此成員？"
                            onConfirm={() => {
                                setSelectedMemberIds([record.discord_id]);
                                handleSendMessage();
                            }}
                            okText="是"
                            cancelText="否"
                        >
                            <Button
                                type="link"
                                icon={<SendOutlined />}
                                loading={sending}
                                disabled={sending || !record.discord_id}
                            />
                        </Popconfirm>
                    </Tooltip>
                </Space>
            ),
        },
    ];

    return (
        <div style={{ padding: '20px', backgroundColor: '#f0f2f5' }}>
            <Card
                title={<h2 style={{ margin: 0, fontSize: '24px', color: '#1890ff' }}>發送 Discord 訊息</h2>}
                bordered={false}
                style={{ boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)', borderRadius: '8px' }}
                extra={
                    <Space wrap>
                        <Button
                            type="primary"
                            icon={<SendOutlined />}
                            onClick={handleBatchSend}
                            disabled={selectedMemberIds.length === 0 || sending}
                            loading={sending}
                        >
                            批量發送
                        </Button>
                    </Space>
                }
            >
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: '16px', gap: '16px', flexWrap: 'wrap' }}>
                    <Input.Search
                        placeholder="搜索成員名稱或 Discord ID"
                        value={filters.keyword}
                        onChange={(e) => handleFilterChange('keyword', e.target.value)}
                        onSearch={() => fetchMembers(pagination.current, pagination.pageSize)}
                        style={{ width: 300 }}
                    />
                    
                    <Input
                        placeholder="Channel ID"
                        value={channelId}
                        onChange={(e) => setChannelId(e.target.value)}
                        style={{ width: 200 }}
                    />
                    <TextArea
                        placeholder="輸入訊息內容"
                        value={messageContent}
                        onChange={(e) => setMessageContent(e.target.value)}
                        rows={4}
                        style={{ width: '100%' }}
                    />
                </div>
                <Spin spinning={loading || sending} size="large">
                    {members.length === 0 && !loading ? (
                        <Alert
                            message="無數據"
                            description="目前沒有符合條件的成員。請檢查過濾條件或確保有相關數據。"
                            type="info"
                            showIcon
                            style={{ marginBottom: '16px' }}
                        />
                    ) : (
                        <Table
                            rowSelection={{
                                selectedRowKeys,
                                onChange: (keys, selectedRows) => {
                                    setSelectedRowKeys(keys);
                                    setSelectedMemberIds(selectedRows.map(row => row.discord_id).filter(id => id));
                                },
                            }}
                            columns={columns}
                            dataSource={members}
                            rowKey="_id"
                            pagination={{
                                current: pagination.current,
                                pageSize: pagination.pageSize,
                                total: pagination.total,
                                showSizeChanger: true,
                                pageSizeOptions: ['10', '20', '50'],
                                showTotal: (total) => `共 ${total} 條記錄`,
                            }}
                            onChange={handleTableChange}
                        />
                    )}
                </Spin>
            </Card>

            <style jsx global>{`
                .ant-card-actions {
                    display: flex;
                    justify-content: center;
                    gap: 8px;
                }
                .ant-card-actions > li {
                    margin: 0 !important;
                    width: auto !important;
                    text-align: center;
                }
                @media (max-width: 768px) {
                    .ant-card-actions > li {
                        padding: 0 4px !important;
                    }
                    .ant-btn-link {
                        padding: 0 6px !important;
                    }
                    .ant-card-head {
                        display: flex;
                        flex-direction: column;
                        align-items: flex-start;
                        padding: 16px;
                    }
                    .ant-card-head-title {
                        flex: none;
                        padding: 0 0 8px 0;
                        width: 100%;
                        white-space: normal;
                        overflow: visible;
                    }
                    .ant-card-extra {
                        flex: none;
                        width: 100%;
                        display: flex;
                        justify-content: flex-end;
                        margin-top: 8px;
                    }
                    .ant-space {
                        flex-wrap: wrap;
                        gap: 8px;
                    }
                }
            `}</style>
        </div>
    );
};

export default DiscordMessageSender;