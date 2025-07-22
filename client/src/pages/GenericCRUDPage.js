import React, { useState, useEffect } from 'react';
import { Table, Button, Modal, Form, Input, Select, message, Spin, Alert, Pagination, Row, Col, Popconfirm, Tag, Card, Space, Typography } from 'antd';
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

const GenericCRUDPage = () => {
    const [data, setData] = useState([]);
    const [filteredData, setFilteredData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [visible, setVisible] = useState(false);
    const [form] = Form.useForm();
    const [editingItem, setEditingItem] = useState(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const [filters, setFilters] = useState({ search: '', filterType: 'all' }); // 根據需求調整篩選條件
    const [selectedRowKeys, setSelectedRowKeys] = useState([]);
    const [sort, setSort] = useState({ field: 'name', order: 'ascend' });

    useEffect(() => {
        fetchData();
    }, [filters, sort]);

    useEffect(() => {
        console.log('Current pageSize:', pageSize);
    }, [pageSize]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const res = await axios.get(`${BASE_URL}/api/your-endpoint`, {
                params: {
                    search: filters.search || undefined,
                    filterType: filters.filterType === 'all' ? undefined : filters.filterType,
                    sortBy: sort.field,
                    sortOrder: sort.order === 'ascend' ? 'asc' : 'desc',
                },
            });

            let newData = res.data || [];

            // 前端排序（如果後端未處理）
            if (sort.field && sort.order) {
                newData = [...newData].sort((a, b) => {
                    const valueA = a[sort.field] || '';
                    const valueB = b[sort.field] || '';
                    if (sort.order === 'ascend') {
                        return valueA.localeCompare(valueB);
                    } else {
                        return valueB.localeCompare(valueA);
                    }
                });
            }

            setData(newData);
            setFilteredData(newData);

            const validPageSize = Number(pageSize) || 10;

            if (newData.length === 0) {
                setCurrentPage(1);
            } else {
                const maxPage = Math.ceil(newData.length / validPageSize);
                const validCurrentPage = Number(currentPage) || 1;
                if (validCurrentPage > maxPage) {
                    setCurrentPage(maxPage);
                } else {
                    setCurrentPage(validCurrentPage);
                }
            }

            console.log('After fetchData:', { filteredData: newData, currentPage, pageSize: validPageSize });
        } catch (err) {
            message.error(err.response?.data?.msg || '載入數據失敗');
            setData([]);
            setFilteredData([]);
            setCurrentPage(1);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateOrUpdate = async (values) => {
        const token = localStorage.getItem('token');
        setLoading(true);
        try {
            if (editingItem) {
                await axios.put(`${BASE_URL}/api/your-endpoint/${editingItem._id}`, values, {
                    headers: { 'x-auth-token': token },
                });
                message.success('數據更新成功');
            } else {
                await axios.post(`${BASE_URL}/api/your-endpoint`, values, {
                    headers: { 'x-auth-token': token },
                });
                message.success('數據創建成功');
            }
            fetchData();
            setVisible(false);
            form.resetFields();
            setEditingItem(null);
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
            await axios.delete(`${BASE_URL}/api/your-endpoint/${id}`, {
                headers: { 'x-auth-token': token },
            });
            message.success('數據刪除成功');
            fetchData();
        } catch (err) {
            message.error(err.response?.data?.msg || '刪除失敗');
        } finally {
            setLoading(false);
        }
    };

    const handleBatchDelete = async () => {
        const token = localStorage.getItem('token');
        if (selectedRowKeys.length === 0) {
            message.warning('請至少選擇一條數據進行刪除');
            return;
        }
        const selectedItems = data.filter(item => selectedRowKeys.includes(item._id));
        const itemNames = selectedItems.map(item => item.name).join(', ');
        setLoading(true);
        try {
            await axios.delete(`${BASE_URL}/api/your-endpoint/batch-delete`, {
                headers: { 'x-auth-token': token },
                data: { ids: selectedRowKeys },
            });
            message.success(`成功刪除 ${selectedRowKeys.length} 條數據：${itemNames}`);
            fetchData();
            setSelectedRowKeys([]);
        } catch (err) {
            message.error(err.response?.data?.msg || '批量刪除失敗');
        } finally {
            setLoading(false);
        }
    };

    const handleResetFilters = () => {
        setFilters({ search: '', filterType: 'all' });
        setSort({ field: 'name', order: 'ascend' });
        setCurrentPage(1);
    };

    const rowSelection = {
        selectedRowKeys,
        onChange: (selectedKeys) => setSelectedRowKeys(selectedKeys),
    };

    const columns = [
        { title: '名稱', dataIndex: 'name', key: 'name', sorter: true, width: 150 },
        { title: '描述', dataIndex: 'description', key: 'description', width: 200 },
        // 根據需求添加其他欄位
        {
            title: '操作',
            key: 'action',
            render: (_, record) => (
                <Row gutter={[8, 8]} justify="center">
                    <Col>
                        <Button
                            onClick={() => {
                                setEditingItem(record);
                                setVisible(true);
                                form.setFieldsValue(record);
                            }}
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
                            title="確認刪除此數據？"
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
    const paginatedData = filteredData.slice(
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
                            <Title level={2} style={{ margin: 0, color: '#1890ff' }}>數據管理</Title>
                            {selectedRowKeys.length > 0 && (
                                <Text type="secondary">已選擇 {selectedRowKeys.length} 條數據</Text>
                            )}
                        </Space>
                    }
                    bordered={false}
                    style={{ boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)', borderRadius: '12px' }}
                >
                    <Row gutter={[16, 16]} style={{ marginBottom: '16px' }}>
                        <Col xs={24} sm={12} md={6}>
                            <Input.Search
                                placeholder="搜索名稱或描述"
                                value={filters.search}
                                onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                                style={{ width: '100%' }}
                                enterButton={<SearchOutlined />}
                            />
                        </Col>
                        <Col xs={24} sm={12} md={6}>
                            <Select
                                value={filters.filterType}
                                onChange={(value) => setFilters(prev => ({ ...prev, filterType: value }))}
                                style={{ width: '100%' }}
                            >
                                <Option value="all">全部類型</Option>
                                {/* 根據需求添加其他選項 */}
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
                                新增數據
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
                                            確認批量刪除以下數據？<br />
                                            {data.filter(item => selectedRowKeys.includes(item._id)).map(item => (
                                                <div key={item._id}>- {item.name}</div>
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
                        {filteredData.length === 0 && !loading ? (
                            <Alert
                                message="無數據"
                                description="目前沒有符合條件的數據記錄。"
                                type="info"
                                showIcon
                                style={{ marginBottom: '16px' }}
                            />
                        ) : (
                            <>
                                <Table
                                    rowSelection={rowSelection}
                                    dataSource={paginatedData}
                                    columns={columns}
                                    rowKey="_id"
                                    bordered
                                    pagination={{
                                        current: validCurrentPage,
                                        pageSize: validPageSize,
                                        total: filteredData.length,
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
                                    total={filteredData.length}
                                    onChange={setCurrentPage}
                                    onShowSizeChange={(current, size) => {
                                        const newPageSize = Number(size) || 10;
                                        setCurrentPage(1);
                                        setPageSize(newPageSize);
                                        console.log('Updated pageSize in onShowSizeChange:', newPageSize);
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
                    title={editingItem ? '編輯數據' : '新增數據'}
                    open={visible}
                    onCancel={() => {
                        setVisible(false);
                        setEditingItem(null);
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
                                { required: true, message: '請輸入名稱！' },
                                { min: 2, message: '名稱至少需要 2 個字符' },
                            ]}
                        >
                            <Input />
                        </Form.Item>
                        <Form.Item name="description" label="描述" rules={[{ max: 500, message: '描述不得超過 500 個字符' }]}>
                            <Input.TextArea />
                        </Form.Item>
                        {/* 根據需求添加其他表單字段 */}
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

export default GenericCRUDPage;