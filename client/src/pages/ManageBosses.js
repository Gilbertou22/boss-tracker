import React, { useState, useEffect } from 'react';
import { Table, Button, Modal, Form, Input, Select, message, Spin, Alert, Pagination, Row, Col, Popconfirm, Card, Space, Typography, InputNumber } from 'antd';
import { SearchOutlined, DeleteOutlined, EditOutlined, PlusOutlined, RedoOutlined } from '@ant-design/icons';
import axios from 'axios';

const { Option } = Select;
const { Title, Text } = Typography;

const BASE_URL = process.env.REACT_APP_API_URL || '';

// 錯誤邊界組件，用於捕獲渲染錯誤
class ErrorBoundary extends React.Component {
    state = { hasError: false };

    static getDerivedStateFromError(error) {
        return { hasError: true };
    }

    componentDidCatch(error, errorInfo) {
        console.error('Error caught in ErrorBoundary:', error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return <Alert message="發生錯誤，請刷新頁面" type="error" />;
        }
        return this.props.children;
    }
}

// 獲取 CSRF Token 的函數
const fetchCsrfToken = async () => {
    try {
        const res = await axios.get(`${BASE_URL}/csrf-token`, {
            withCredentials: true, // 確保發送 Cookie
        });
        return res.data.csrfToken;
    } catch (err) {
        console.error('Error fetching CSRF token:', err);
        return null;
    }
};

const ManageBosses = () => {
    const [bosses, setBosses] = useState([]);
    const [filteredBosses, setFilteredBosses] = useState([]);
    const [loading, setLoading] = useState(false);
    const [visible, setVisible] = useState(false);
    const [form] = Form.useForm();
    const [editingBoss, setEditingBoss] = useState(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const [filters, setFilters] = useState({ search: '', difficulty: 'all' });
    const [selectedRowKeys, setSelectedRowKeys] = useState([]);
    const [sort, setSort] = useState({ field: 'name', order: 'ascend' });

    useEffect(() => {
        fetchBosses();
    }, [filters, sort]);

    useEffect(() => {
        //console.log('Current pageSize:', pageSize);
    }, [pageSize]);

    const fetchBosses = async () => {
        setLoading(true);
        try {
            const res = await axios.get(`${BASE_URL}/api/bosses`, {
                params: {
                    search: filters.search || undefined,
                    difficulty: filters.difficulty === 'all' ? undefined : filters.difficulty,
                    sortBy: sort.field,
                    sortOrder: sort.order === 'ascend' ? 'asc' : 'desc',
                },
            });

            let newBosses = res.data || [];

            // 前端排序（如果後端未處理）
            if (sort.field && sort.order) {
                newBosses = [...newBosses].sort((a, b) => {
                    const valueA = a[sort.field] || '';
                    const valueB = b[sort.field] || '';
                    if (sort.order === 'ascend') {
                        return valueA.localeCompare(valueB);
                    } else {
                        return valueB.localeCompare(valueA);
                    }
                });
            }

            setBosses(newBosses);
            setFilteredBosses(newBosses);

            const validPageSize = Number(pageSize) || 10;

            if (newBosses.length === 0) {
                setCurrentPage(1);
            } else {
                const maxPage = Math.ceil(newBosses.length / validPageSize);
                const validCurrentPage = Number(currentPage) || 1;
                if (validCurrentPage > maxPage) {
                    setCurrentPage(maxPage);
                } else {
                    setCurrentPage(validCurrentPage);
                }
            }

            //console.log('After fetchBosses:', { filteredBosses: newBosses, currentPage, pageSize: validPageSize });
        } catch (err) {
            message.error(err.response?.data?.msg || '載入首領失敗');
            setBosses([]);
            setFilteredBosses([]);
            setCurrentPage(1);
        } finally {
            setLoading(false);
        }
    };

    const fetchDKPSetting = async (bossId) => {
        try {
            const res = await axios.get(`${BASE_URL}/api/dkp/${bossId}`, {
                headers: { 'x-auth-token': localStorage.getItem('token') },
            });
            return res.data.dkpPoints || 0;
        } catch (err) {
            console.error('Error fetching DKP setting:', err);
            return 0; // 如果未找到 DKP 設定，默認為 0
        }
    };

    const handleCreateOrUpdate = async (values) => {
        const token = localStorage.getItem('token');
        setLoading(true);
        try {
            if (editingBoss) {
                // 更新首領和 DKP 點數
                await axios.put(`${BASE_URL}/api/bosses/${editingBoss._id}`, {
                    name: values.name,
                    description: values.description,
                    difficulty: values.difficulty,
                    dkpPoints: values.dkpPoints, // 將 DKP 點數一起發送
                }, {
                    headers: { 'x-auth-token': token },
                });

                message.success('首領更新成功');
            } else {
                // 創建首領並設置 DKP 點數
                await axios.post(`${BASE_URL}/api/bosses`, {
                    name: values.name,
                    description: values.description,
                    difficulty: values.difficulty,
                    dkpPoints: values.dkpPoints,
                }, {
                    headers: { 'x-auth-token': token },
                });

                message.success('首領創建成功');
            }
            fetchBosses();
            setVisible(false);
            form.resetFields();
            setEditingBoss(null);
        } catch (err) {
            message.error(err.response?.data?.msg || '操作失敗');
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id) => {
        const token = localStorage.getItem('token');
        setLoading(true);
        try {
            await axios.delete(`${BASE_URL}/api/bosses/${id}`, {
                headers: { 'x-auth-token': token },
            });
            message.success('首領刪除成功');
            fetchBosses();
        } catch (err) {
            message.error(err.response?.data?.msg || '刪除失敗');
        } finally {
            setLoading(false);
        }
    };

    const handleBatchDelete = async () => {
        const token = localStorage.getItem('token');
        if (selectedRowKeys.length === 0) {
            message.warning('請至少選擇一個首領進行刪除');
            return;
        }
        const selectedBosses = bosses.filter(boss => selectedRowKeys.includes(boss._id));
        const bossNames = selectedBosses.map(boss => boss.name).join(', ');
        setLoading(true);
        try {
            await axios.delete(`${BASE_URL}/api/bosses/batch-delete`, {
                headers: { 'x-auth-token': token },
                data: { ids: selectedRowKeys },
            });
            message.success(`成功刪除 ${selectedRowKeys.length} 個首領：${bossNames}`);
            fetchBosses();
            setSelectedRowKeys([]);
        } catch (err) {
            message.error(err.response?.data?.msg || '批量刪除失敗');
        } finally {
            setLoading(false);
        }
    };

    const handleResetFilters = () => {
        setFilters({ search: '', difficulty: 'all' });
        setSort({ field: 'name', order: 'ascend' });
        setCurrentPage(1);
    };

    const handleEdit = async (record) => {
        setEditingBoss(record);
        setVisible(true);

        // 獲取當前首領的 DKP 點數
        const dkpPoints = await fetchDKPSetting(record._id);

        // 填充表單數據
        form.setFieldsValue({
            ...record,
            dkpPoints,
        });
    };

    const rowSelection = {
        selectedRowKeys,
        onChange: (selectedKeys) => setSelectedRowKeys(selectedKeys),
    };

    const columns = [
        { title: '名稱', dataIndex: 'name', key: 'name', sorter: true, width: 150 },
        { title: '描述', dataIndex: 'description', key: 'description', width: 200 },
        {
            title: '操作',
            key: 'action',
            render: (_, record) => (
                <Row gutter={[8, 8]} justify="center">
                    <Col>
                        <Button
                            onClick={() => handleEdit(record)}
                            disabled={loading}
                            type="primary"
                            shape="round"
                            size="small"
                            icon={<EditOutlined />}
                            style={{ background: '#1890ff', color: '#fff', borderColor: '#1890ff' }}
                        >
                            編輯
                        </Button>
                    </Col>
                    <Col>
                        <Popconfirm
                            title="確認刪除此首領？"
                            onConfirm={() => handleDelete(record._id)}
                            okText="是"
                            cancelText="否"
                            disabled={loading}
                        >
                            <Button
                                danger
                                disabled={loading}
                                shape="round"
                                size="small"
                                icon={<DeleteOutlined />}
                                style={{ background: '#ff4d4f', color: '#fff', borderColor: '#ff4d4f' }}
                            >
                                刪除
                            </Button>
                        </Popconfirm>
                    </Col>
                </Row>
            ),
            width: 150,
        },
    ];

    const validCurrentPage = Number(currentPage) || 1;
    const validPageSize = Number(pageSize) || 10;
    const paginatedBosses = filteredBosses.slice(
        (validCurrentPage - 1) * validPageSize,
        validCurrentPage * validPageSize
    );

    const handleTableChange = (pagination, _, sorter) => {
        const newCurrentPage = Number(pagination.current) || 1;
        setCurrentPage(newCurrentPage);
        if (sorter.field && sorter.order) {
            setSort({
                field: sorter.field,
                order: sorter.order,
            });
        }
    };

    return (
        <ErrorBoundary>
            <div style={{ padding: '20px', backgroundColor: '#f0f2f5', minHeight: 'calc(100vh - 64px)', paddingTop: '84px', boxSizing: 'border-box' }}>
                <Card
                    title={
                        <Space>
                            <Title level={2} style={{ margin: 0, color: '#1890ff' }}>首領管理</Title>
                            {selectedRowKeys.length > 0 && (
                                <Text type="secondary">已選擇 {selectedRowKeys.length} 個首領</Text>
                            )}
                        </Space>
                    }
                    bordered={false}
                    style={{ boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)', borderRadius: '12px' }}
                >
                    <Row gutter={[16, 16]} style={{ marginBottom: '16px' }}>
                        <Col xs={24} sm={12} md={6}>
                            <Input.Search
                                placeholder="搜索首領名稱或描述"
                                value={filters.search}
                                allowClear
                                onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                                style={{ width: '100%' }}
                                enterButton={<SearchOutlined />}
                            />
                        </Col>
                        <Col xs={24} sm={12} md={6}>
                            <Select
                                value={filters.difficulty}
                                onChange={(value) => setFilters(prev => ({ ...prev, difficulty: value }))}
                                style={{ width: '100%' }}
                            >
                                <Option value="all">全部難度</Option>
                                <Option value="easy">簡單</Option>
                                <Option value="medium">中等</Option>
                                <Option value="hard">困難</Option>
                            </Select>
                        </Col>
                        <Col xs={24} sm={12} md={6}>
                            <Button
                                type="primary"
                                onClick={() => setVisible(true)}
                                disabled={loading}
                                icon={<PlusOutlined />}
                                style={{ width: '100%', borderRadius: '8px' }}
                            >
                                新增首領
                            </Button>
                        </Col>
                        <Col xs={24} sm={12} md={6}>
                            <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
                                <Button
                                    onClick={handleResetFilters}
                                    icon={<RedoOutlined />}
                                    style={{ borderRadius: '8px' }}
                                >
                                    重置篩選
                                </Button>
                                <Popconfirm
                                    title={
                                        <div>
                                            確認批量刪除以下首領？<br />
                                            {bosses.filter(boss => selectedRowKeys.includes(boss._id)).map(boss => (
                                                <div key={boss._id}>- {boss.name}</div>
                                            ))}
                                        </div>
                                    }
                                    onConfirm={handleBatchDelete}
                                    okText="是"
                                    cancelText="否"
                                    disabled={loading || selectedRowKeys.length === 0}
                                >
                                    <Button
                                        type="danger"
                                        icon={<DeleteOutlined />}
                                        disabled={loading || selectedRowKeys.length === 0}
                                        style={{ borderRadius: '8px' }}
                                    >
                                        批量刪除
                                    </Button>
                                </Popconfirm>
                            </Space>
                        </Col>
                    </Row>
                    <Spin spinning={loading} size="large">
                        {filteredBosses.length === 0 && !loading ? (
                            <Alert
                                message="無首領"
                                description="目前沒有符合條件的首領記錄。"
                                type="info"
                                showIcon
                                style={{ marginBottom: '16px' }}
                            />
                        ) : (
                            <>
                                <Table
                                    rowSelection={rowSelection}
                                    dataSource={paginatedBosses}
                                    columns={columns}
                                    rowKey="_id"
                                    bordered
                                    pagination={{
                                        current: validCurrentPage,
                                        pageSize: validPageSize,
                                        total: filteredBosses.length,
                                        showSizeChanger: true,
                                        pageSizeOptions: ['10', '20', '50'].map(String),
                                    }}
                                    scroll={{ x: 'max-content' }}
                                    onChange={handleTableChange}
                                    rowClassName="table-row-hover"
                                />
                                <Pagination
                                    current={validCurrentPage}
                                    pageSize={validPageSize}
                                    total={filteredBosses.length}
                                    onChange={setCurrentPage}
                                    onShowSizeChange={(current, size) => {
                                        const newPageSize = Number(size) || 10;
                                        setCurrentPage(1);
                                        setPageSize(newPageSize);
                                        //console.log('Updated pageSize in onShowSizeChange:', newPageSize);
                                    }}
                                    style={{ marginTop: '16px', textAlign: 'right' }}
                                    showSizeChanger
                                    pageSizeOptions={['10', '20', '50'].map(String)}
                                    showTotal={(total) => `共 ${total} 條記錄`}
                                />
                            </>
                        )}
                    </Spin>
                </Card>
                <Modal
                    title={editingBoss ? '編輯首領' : '新增首領'}
                    open={visible}
                    onCancel={() => {
                        setVisible(false);
                        setEditingBoss(null);
                        form.resetFields();
                    }}
                    footer={null}
                    transitionName="ant-fade"
                >
                    <Form form={form} onFinish={handleCreateOrUpdate} layout="vertical">
                        <Form.Item
                            name="name"
                            label="名稱"
                            rules={[
                                { required: true, message: '請輸入首領名稱！' },
                                { min: 2, message: '名稱至少需要 2 個字符' },
                            ]}
                        >
                            <Input />
                        </Form.Item>
                        <Form.Item name="description" label="描述" rules={[{ max: 500, message: '描述不得超過 500 個字符' }]}>
                            <Input.TextArea />
                        </Form.Item>
                        <Form.Item
                            name="difficulty"
                            label="難度"
                            rules={[{ required: true, message: '請選擇首領難度！' }]}
                        >
                            <Select>
                                <Option value="easy">簡單</Option>
                                <Option value="medium">中等</Option>
                                <Option value="hard">困難</Option>
                            </Select>
                        </Form.Item>
                        <Form.Item
                            name="dkpPoints"
                            label="DKP 點數"
                            rules={[
                                { required: true, message: '請輸入 DKP 點數！' },
                                {
                                    type: 'number',
                                    min: 0,
                                    message: 'DKP 點數必須是非負數！',
                                },
                            ]}
                        >
                            <InputNumber style={{ width: '100%' }} />
                        </Form.Item>
                        <Form.Item>
                            <Button type="primary" htmlType="submit" loading={loading} style={{ borderRadius: '8px' }}>
                                提交
                            </Button>
                        </Form.Item>
                    </Form>
                </Modal>
                <style jsx global>{`
                    .table-row-hover:hover {
                        background-color: #f0f4f8 !important;
                    }
                    .ant-btn-primary, .ant-btn-danger {
                        transition: all 0.3s ease;
                    }
                    .ant-btn-primary:hover, .ant-btn-danger:hover {
                        transform: scale(1.05);
                    }
                    .ant-modal {
                        transition: all 0.3s ease;
                    }
                `}</style>
            </div>
        </ErrorBoundary>
    );
};

export default ManageBosses;