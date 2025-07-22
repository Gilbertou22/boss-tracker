import React, { useState, useEffect } from 'react';
import { Table, Button, Input, Select, DatePicker, Pagination, Card, Spin, Alert, Modal, Descriptions, message, Tag } from 'antd';
import { SearchOutlined, EyeOutlined } from '@ant-design/icons';
import axios from 'axios';
import moment from 'moment';
import logger from '../utils/logger';

const { Option } = Select;
const { RangePicker } = DatePicker;

const BASE_URL = process.env.REACT_APP_API_URL || '';

const LogViewer = () => {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const [total, setTotal] = useState(0);
    const [filters, setFilters] = useState({
        level: 'all',
        userId: '',
        startTime: null,
        endTime: null,
    });
    const [expandedRows, setExpandedRows] = useState([]); // 記錄展開的行
    const [detailModalVisible, setDetailModalVisible] = useState(false);
    const [selectedLog, setSelectedLog] = useState(null);
    const token = localStorage.getItem('token');

    const fetchLogs = async () => {
        setLoading(true);
        try {
            logger.info('Fetching logs', { filters });
            const res = await axios.get(`${BASE_URL}/api/logs/query`, {
                headers: { 'x-auth-token': token },
                params: {
                    level: filters.level === 'all' ? undefined : filters.level,
                    userId: filters.userId || undefined,
                    startTime: filters.startTime ? filters.startTime.toISOString() : undefined,
                    endTime: filters.endTime ? filters.endTime.toISOString() : undefined,
                    page: currentPage,
                    limit: pageSize,
                },
            });
            setLogs(res.data.data);
            setTotal(res.data.total);
            logger.info('Logs fetched successfully', { count: res.data.data.length, total: res.data.total });
        } catch (err) {
            logger.error('Fetch logs error', { error: err.message, stack: err.stack });
            message.error(`載入日誌失敗: ${err.response?.data?.msg || err.message}`);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchLogs();
    }, [currentPage, pageSize, filters]);

    const handleFilterChange = (field, value) => {
        setFilters(prev => ({ ...prev, [field]: value }));
        setCurrentPage(1);
    };

    const handleExpand = (record) => {
        const key = record._id;
        if (expandedRows.includes(key)) {
            setExpandedRows(expandedRows.filter(k => k !== key));
        } else {
            setExpandedRows([...expandedRows, key]);
        }
    };

    const handleViewDetails = (record) => {
        setSelectedLog(record);
        setDetailModalVisible(true);
    };

    const columns = [
        {
            title: '時間',
            dataIndex: ['metadata', 'timestamp'],
            key: 'timestamp',
            width: 200,
            render: (text) => moment(text).format('YYYY-MM-DD HH:mm:ss'),
        },
        {
            title: '級別',
            dataIndex: 'level',
            key: 'level',
            width: 100,
            render: (level) => (
                <Tag color={level === 'error' ? 'red' : level === 'warn' ? 'orange' : 'green'}>{level}</Tag>
            ),
        },
        {
            title: '用戶 ID',
            dataIndex: ['metadata', 'userId'],
            key: 'userId',
            width: 150,
            render: (text) => text || 'N/A',
        },
        {
            title: '消息',
            dataIndex: 'message',
            key: 'message',
            width: 200,
        },
        {
            title: '詳情',
            dataIndex: 'metadata',
            key: 'metadata',
            width: 300,
            render: (metadata, record) => {
                const key = record._id;
                const isExpanded = expandedRows.includes(key);
                const summary = JSON.stringify(metadata, null, 2).substring(0, 50) + (JSON.stringify(metadata).length > 50 ? '...' : '');
                return (
                    <div>
                        <div style={{ whiteSpace: 'pre-wrap', maxHeight: isExpanded ? 'none' : '100px', overflow: 'hidden' }}>
                            {isExpanded ? JSON.stringify(metadata, null, 2) : summary}
                        </div>
                        <Button
                            type="link"
                            onClick={() => handleExpand(record)}
                            style={{ padding: 0 }}
                        >
                            {isExpanded ? '收起' : '展開'}
                        </Button>
                        <Button
                            type="link"
                            icon={<EyeOutlined />}
                            onClick={() => handleViewDetails(record)}
                            style={{ padding: 0, marginLeft: 8 }}
                        >
                            查看詳情
                        </Button>
                    </div>
                );
            },
        },
    ];

    return (
        <div style={{ padding: '20px', backgroundColor: '#f0f2f5', minHeight: '100vh' }}>
            <Card
                title={<h2 style={{ margin: 0, fontSize: '24px', color: '#1890ff' }}>日誌查看</h2>}
                bordered={false}
                style={{ boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)', borderRadius: '8px' }}
            >
                <div style={{ marginBottom: '16px', display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
                    <Select
                        value={filters.level}
                        onChange={(value) => handleFilterChange('level', value)}
                        style={{ width: 200 }}
                    >
                        <Option value="all">全部級別</Option>
                        <Option value="info">Info</Option>
                        <Option value="warn">Warn</Option>
                        <Option value="error">Error</Option>
                    </Select>
                    <Input
                        placeholder="輸入用戶 ID"
                        value={filters.userId}
                        onChange={(e) => handleFilterChange('userId', e.target.value)}
                        style={{ width: 200 }}
                    />
                    <RangePicker
                        value={[filters.startTime, filters.endTime]}
                        onChange={(dates) => {
                            handleFilterChange('startTime', dates ? dates[0] : null);
                            handleFilterChange('endTime', dates ? dates[1] : null);
                        }}
                        style={{ marginRight: 0 }}
                    />
                    <Button type="primary" icon={<SearchOutlined />} onClick={fetchLogs}>
                        搜索
                    </Button>
                </div>
                <Spin spinning={loading} size="large">
                    {logs.length === 0 && !loading ? (
                        <Alert
                            message="無日誌數據"
                            description="目前沒有符合條件的日誌記錄。"
                            type="info"
                            showIcon
                            style={{ marginBottom: '16px' }}
                        />
                    ) : (
                        <>
                            <Table
                                dataSource={logs}
                                columns={columns}
                                rowKey="_id"
                                bordered
                                pagination={false}
                                scroll={{ x: 'max-content' }}
                            />
                            <Pagination
                                current={currentPage}
                                pageSize={pageSize}
                                total={total}
                                onChange={setCurrentPage}
                                onShowSizeChange={(current, size) => {
                                    setCurrentPage(1);
                                    setPageSize(size);
                                }}
                                style={{ marginTop: '16px', textAlign: 'right' }}
                                showSizeChanger
                                pageSizeOptions={['10', '20', '50']}
                            />
                        </>
                    )}
                </Spin>
            </Card>
            <Modal
                title="日誌詳情"
                open={detailModalVisible}
                onOk={() => setDetailModalVisible(false)}
                onCancel={() => setDetailModalVisible(false)}
                width={800}
                footer={null}
            >
                {selectedLog && (
                    <Descriptions bordered column={1}>
                        <Descriptions.Item label="時間">{moment(selectedLog.metadata?.timestamp).format('YYYY-MM-DD HH:mm:ss')}</Descriptions.Item>
                        <Descriptions.Item label="級別">
                            <Tag color={selectedLog.level === 'error' ? 'red' : selectedLog.level === 'warn' ? 'orange' : 'green'}>
                                {selectedLog.level}
                            </Tag>
                        </Descriptions.Item>
                        <Descriptions.Item label="用戶 ID">{selectedLog.metadata?.userId || 'N/A'}</Descriptions.Item>
                        <Descriptions.Item label="消息">{selectedLog.message}</Descriptions.Item>
                        <Descriptions.Item label="來源">{selectedLog.metadata?.source || 'N/A'}</Descriptions.Item>
                        <Descriptions.Item label="錯誤詳情">
                            {selectedLog.metadata?.error ? (
                                <pre>{JSON.stringify(selectedLog.metadata.error, null, 2)}</pre>
                            ) : '無'}
                        </Descriptions.Item>
                        <Descriptions.Item label="用戶代理">{selectedLog.metadata?.userAgent || 'N/A'}</Descriptions.Item>
                        <Descriptions.Item label="完整 Metadata">
                            <pre>{JSON.stringify(selectedLog.metadata, null, 2)}</pre>
                        </Descriptions.Item>
                    </Descriptions>
                )}
            </Modal>
        </div>
    );
};

export default LogViewer;