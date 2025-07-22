import React, { useState, useEffect } from 'react';
import { Table, Button, Modal, Form, Input, Select, message, Spin, Alert, Pagination, Row, Col, Popconfirm, Image, Tag, Card, Space, Typography } from 'antd';
import { SearchOutlined, DeleteOutlined, EditOutlined, PlusOutlined, EyeOutlined, RedoOutlined } from '@ant-design/icons';
import axios from 'axios';

const { Option } = Select;
const { Title, Text } = Typography;

const BASE_URL = process.env.REACT_APP_API_URL || '';

// 計算背景色的亮度，用於確定文字顏色
const getLuminance = (hexColor) => {
    const r = parseInt(hexColor.slice(1, 3), 16) / 255;
    const g = parseInt(hexColor.slice(3, 5), 16) / 255;
    const b = parseInt(hexColor.slice(5, 7), 16) / 255;
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

// 根據背景色亮度選擇文字顏色
const getTextColor = (bgColor) => {
    const luminance = getLuminance(bgColor);
    return luminance > 0.7 ? '#000000' : '#ffffff';
};

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

const ManageItems = () => {
    const [items, setItems] = useState([]);
    const [filteredItems, setFilteredItems] = useState([]);
    const [loading, setLoading] = useState(false);
    const [visible, setVisible] = useState(false);
    const [form] = Form.useForm();
    const [editingItem, setEditingItem] = useState(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const [filters, setFilters] = useState({ search: '', type: 'all' });
    const [selectedRowKeys, setSelectedRowKeys] = useState([]);
    const [itemLevels, setItemLevels] = useState([]);
    const [sort, setSort] = useState({ field: 'name', order: 'ascend' });

    useEffect(() => {
        fetchItems();
        fetchItemLevels();
    }, [filters, sort]);

    useEffect(() => {
        //console.log('Current pageSize:', pageSize);
    }, [pageSize]);

    const fetchItemLevels = async () => {
        try {
            const res = await axios.get(`${BASE_URL}/api/items/item-levels`);
            setItemLevels(res.data);
        } catch (err) {
            console.error('Fetch item levels error:', err);
            message.error('載入物品等級失敗');
        }
    };

    const fetchItems = async () => {
        setLoading(true);
        try {
            const res = await axios.get(`${BASE_URL}/api/items`, {
                params: {
                    search: filters.search || undefined,
                    type: filters.type === 'all' ? undefined : filters.type,
                    sortBy: sort.field,
                    sortOrder: sort.order === 'ascend' ? 'asc' : 'desc',
                },
            });

            let newItems = res.data || [];

            if (sort.field && sort.order) {
                newItems = [...newItems].sort((a, b) => {
                    const valueA = a[sort.field] || '';
                    const valueB = b[sort.field] || '';
                    if (sort.order === 'ascend') {
                        return valueA.localeCompare(valueB);
                    } else {
                        return valueB.localeCompare(valueA);
                    }
                });
            }

            setItems(newItems);
            setFilteredItems(newItems);

            const validPageSize = Number(pageSize) || 10;

            if (newItems.length === 0) {
                setCurrentPage(1);
            } else {
                const maxPage = Math.ceil(newItems.length / validPageSize);
                const validCurrentPage = Number(currentPage) || 1;
                if (validCurrentPage > maxPage) {
                    setCurrentPage(maxPage);
                } else {
                    setCurrentPage(validCurrentPage);
                }
            }

            //console.log('After fetchItems:', { filteredItems: newItems, currentPage, pageSize: validPageSize });
        } catch (err) {
            console.error('Fetch items error:', err);
            message.error(err.response?.data?.msg || '載入物品失敗');
            setItems([]);
            setFilteredItems([]);
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
                await axios.put(`${BASE_URL}/api/items/${editingItem._id}`, values, {
                    headers: { 'x-auth-token': token },
                });
                message.success('物品更新成功');
            } else {
                await axios.post(`${BASE_URL}/api/items`, values, {
                    headers: { 'x-auth-token': token },
                });
                message.success('物品創建成功');
            }
            fetchItems();
            setVisible(false);
            form.resetFields();
            setEditingItem(null);
        } catch (err) {
            console.error('Create/Update item error:', err);
            message.error(err.response?.data?.msg || '操作失敗');
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id) => {
        const token = localStorage.getItem('token');
        setLoading(true);
        try {
            await axios.delete(`${BASE_URL}/api/items/${id}`, {
                headers: { 'x-auth-token': token },
            });
            message.success('物品刪除成功');
            fetchItems();
        } catch (err) {
            console.error('Delete item error:', err);
            message.error(err.response?.data?.msg || '刪除失敗');
        } finally {
            setLoading(false);
        }
    };

    const handleBatchDelete = async () => {
        const token = localStorage.getItem('token');
        if (selectedRowKeys.length === 0) {
            message.warning('請至少選擇一個物品進行刪除');
            return;
        }
        const selectedItems = items.filter(item => selectedRowKeys.includes(item._id));
        const itemNames = selectedItems.map(item => item.name).join(', ');
        setLoading(true);
        try {
            await axios.delete(`${BASE_URL}/api/items/batch-delete`, {
                headers: { 'x-auth-token': token },
                data: { ids: selectedRowKeys },
            });
            message.success(`成功刪除 ${selectedRowKeys.length} 個物品：${itemNames}`);
            fetchItems();
            setSelectedRowKeys([]);
        } catch (err) {
            console.error('Batch delete error:', err);
            message.error(err.response?.data?.msg || '批量刪除失敗');
        } finally {
            setLoading(false);
        }
    };

    const handleResetFilters = () => {
        setFilters({ search: '', type: 'all' });
        setSort({ field: 'name', order: 'ascend' });
        setCurrentPage(1);
    };

    const rowSelection = {
        selectedRowKeys,
        onChange: (selectedKeys) => setSelectedRowKeys(selectedKeys),
    };

    const typeMapping = {
        equipment: '裝備',
        skill: '技能',
    };

    const colorMapping = {
        '白色': '#f0f0f0',
        '綠色': '#00cc00',
        '藍色': '#1e90ff',
        '紅色': '#EC3636',
        '紫色': '#B931F3',
        '金色': '#ffeb3b',
    };

    const columns = [
        {
            title: '圖片',
            dataIndex: 'imageUrl',
            key: 'imageUrl',
            render: (imageUrl) => (
                <Image
                    src={imageUrl || 'wp1.jpg'}
                    alt=""
                    width={50}
                    height={50}
                    style={{ objectFit: 'cover', borderRadius: '4px' }}
                    preview={{ mask: <EyeOutlined /> }}
                    loading="lazy"
                />
            ),
            width: 80,
        },
        {
            title: '名稱',
            dataIndex: 'name',
            key: 'name',
            sorter: true,
            width: 150,
            render: (name, record) => {
                const level = record.level;
                if (!level) return name;
                const levelColor = colorMapping[level.color] || '#000000';
                return (
                    <span
                        style={{
                            color: levelColor,
                            fontWeight: 'bold',
                            fontSize: '16px',
                            textShadow: `0px 0px 1px rgb(97, 97, 97)`,
                        }}
                    >
                        {name}
                    </span>
                );
            },
        },
        {
            title: '類型',
            dataIndex: 'type',
            key: 'type',
            sorter: true,
            width: 120,
            render: (type) => typeMapping[type] || '未設置',
        },
        {
            title: '等級',
            dataIndex: 'level',
            key: 'level',
            width: 120,
            render: (level) => {
                if (!level) return '未設置';
                const bgColor = colorMapping[level.color] || '#000000';
                const textColor = getTextColor(bgColor);
                return (
                    <Tag
                        color={bgColor}
                        style={{
                            padding: '6px 12px',
                            fontSize: '16px',
                            fontWeight: 'bold',
                            border: '1px solid #d9d9d9',
                            boxShadow: '0 1px 2px rgba(0, 0, 0, 0.1)',
                            color: textColor,
                            textShadow: '1px 1px 2px rgba(0, 0, 0, 0.5)',
                        }}
                    >
                        {level.level}
                    </Tag>
                );
            },
        },
        { title: '描述', dataIndex: 'description', key: 'description', width: 200 },
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
                                form.setFieldsValue({
                                    ...record,
                                    level: record.level?._id || null,
                                });
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
                            title="確認刪除此物品？"
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
    const paginatedItems = filteredItems.slice(
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
                            <Title level={2} style={{ margin: 0, color: '#1890ff' }}>掉落物品</Title>
                            {selectedRowKeys.length > 0 && (
                                <Text type="secondary">已選擇 {selectedRowKeys.length} 個物品</Text>
                            )}
                        </Space>
                    }
                    bordered={false}
                    style={{ boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)', borderRadius: '12px' }}
                >
                    <Row gutter={[16, 16]} style={{ marginBottom: '16px' }}>
                        <Col xs={24} sm={12} md={6}>
                            <Input.Search
                                placeholder="搜索物品名稱或描述"
                                value={filters.search}
                                onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                                onSearch={() => fetchItems()}
                                allowClear
                                onClear={() => setFilters(prev => ({ ...prev, search: '' }))}
                                style={{ width: '100%' }}
                                enterButton={<SearchOutlined />}
                            />
                        </Col>
                        <Col xs={24} sm={12} md={6}>
                            <Select
                                value={filters.type}
                                onChange={(value) => setFilters(prev => ({ ...prev, type: value }))}
                                style={{ width: '100%' }}
                            >
                                <Option value="all">全部類型</Option>
                                <Option value="equipment">裝備</Option>
                                <Option value="skill">技能</Option>
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
                                新增物品
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
                                            確認批量刪除以下物品？<br />
                                            {items.filter(item => selectedRowKeys.includes(item._id)).map(item => (
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
                        {filteredItems.length === 0 && !loading ? (
                            <Alert
                                message="無物品"
                                description="目前沒有符合條件的物品記錄。"
                                type="info"
                                showIcon
                                style={{ marginBottom: '16px' }}
                            />
                        ) : (
                            <>
                                <Table
                                    rowSelection={rowSelection}
                                    dataSource={paginatedItems}
                                    columns={columns}
                                    rowKey="_id"
                                    bordered
                                    pagination={{
                                        current: validCurrentPage,
                                        pageSize: validPageSize,
                                        total: filteredItems.length,
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
                                    total={filteredItems.length}
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
                    title={editingItem ? '編輯物品' : '新增物品'}
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
                                { required: true, message: '請輸入物品名稱！' },
                                { min: 2, message: '名稱至少需要 2 個字符' },
                            ]}
                        >
                            <Input />
                        </Form.Item>
                        <Form.Item
                            name="type"
                            label="類型"
                            rules={[{ required: true, message: '請選擇物品類型！' }]}
                        >
                            <Select>
                                <Option value="equipment">裝備</Option>
                                <Option value="skill">技能</Option>
                            </Select>
                        </Form.Item>
                        <Form.Item
                            name="level"
                            label="等級"
                            rules={[{ message: '請選擇物品等級！' }]}
                        >
                            <Select placeholder="選擇等級" allowClear>
                                {itemLevels.map(level => {
                                    const bgColor = colorMapping[level.color] || '#000000';
                                    const textColor = getTextColor(bgColor);
                                    return (
                                        <Option key={level._id} value={level._id}>
                                            <Tag
                                                color={bgColor}
                                                style={{
                                                    padding: '6px 12px',
                                                    fontSize: '16px',
                                                    fontWeight: 'bold',
                                                    border: '1px solid #d9d9d9',
                                                    boxShadow: '0 1px 2px rgba(0, 0, 0, 0.1)',
                                                    color: textColor,
                                                    textShadow: '1px 1px 2px rgba(0, 0, 0, 0.5)',
                                                }}
                                            >
                                                {level.level}
                                            </Tag>
                                        </Option>
                                    );
                                })}
                            </Select>
                        </Form.Item>
                        <Form.Item
                            name="description"
                            label="描述"
                            rules={[{ max: 500, message: '描述不得超過 500 個字符' }]}
                        >
                            <Input.TextArea />
                        </Form.Item>
                        <Form.Item
                            name="imageUrl"
                            label="圖片 URL"
                            rules={[{ type: 'url', message: '請輸入有效的 URL 地址' }]}
                        >
                            <Input placeholder="輸入圖片 URL（可選）" />
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

export default ManageItems;