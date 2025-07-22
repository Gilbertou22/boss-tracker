import React, { useState, useEffect } from 'react';
import { Table, Button, Modal, Form, Input, Select, message, Spin, Alert, Pagination, Row, Col, Popconfirm, Tag, Card } from 'antd';
import { SearchOutlined, DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons';
import axios from 'axios';
import logger from '../utils/logger'; // 引入前端日誌工具

const { Option } = Select;

const BASE_URL = process.env.REACT_APP_API_URL || '';

const ManageItemLevels = () => {
    const [itemLevels, setItemLevels] = useState([]);
    const [filteredLevels, setFilteredLevels] = useState([]);
    const [loading, setLoading] = useState(false);
    const [visible, setVisible] = useState(false);
    const [form] = Form.useForm();
    const [editingLevel, setEditingLevel] = useState(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const [filters, setFilters] = useState({ search: '' });
    const [selectedRowKeys, setSelectedRowKeys] = useState([]);

    useEffect(() => {
        fetchItemLevels();
    }, []);

    const fetchItemLevels = async () => {
        setLoading(true);
        try {
            const res = await axios.get(`${BASE_URL}/api/items/item-levels`, {
                headers: { 'x-auth-token': localStorage.getItem('token') },
            });
       
            setItemLevels(res.data);
            setFilteredLevels(res.data);
        } catch (err) {
       
            message.error(err.response?.data?.msg || '載入物品等級失敗');
        } finally {
            setLoading(false);
        }
    };

    const handleSearch = () => {
        const filtered = itemLevels.filter(level =>
            level.level.toLowerCase().includes(filters.search.toLowerCase())
        );
        setFilteredLevels(filtered);
    };

    const handleCreateOrUpdate = async (values) => {
        const token = localStorage.getItem('token');
        setLoading(true);
        try {
            if (editingLevel) {
                await axios.put(`${BASE_URL}/api/items/item-levels/${editingLevel._id}`, values, {
                    headers: { 'x-auth-token': token },
                });
                message.success('物品等級更新成功');
            } else {
                await axios.post(`${BASE_URL}/api/items/item-levels`, values, {
                    headers: { 'x-auth-token': token },
                });
                message.success('物品等級創建成功');
            }
            fetchItemLevels();
            setVisible(false);
            form.resetFields();
            setEditingLevel(null);
        } catch (err) {
            console.error('Create/Update item level error:', err);
            message.error(err.response?.data?.msg || '操作失敗');
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id) => {
        const token = localStorage.getItem('token');
        setLoading(true);
        try {
            await axios.delete(`${BASE_URL}/api/items/item-levels/${id}`, {
                headers: { 'x-auth-token': token },
            });
            message.success('物品等級刪除成功');
            fetchItemLevels();
        } catch (err) {
            console.error('Delete item level error:', err);
            message.error(err.response?.data?.msg || '刪除失敗');
        } finally {
            setLoading(false);
        }
    };

    const handleBatchDelete = async () => {
        const token = localStorage.getItem('token');
        if (selectedRowKeys.length === 0) {
            message.warning('請至少選擇一個物品等級進行刪除');
            return;
        }
        setLoading(true);
        try {
            await axios.delete(`${BASE_URL}/api/items/item-levels/batch-delete`, {
                headers: { 'x-auth-token': token },
                data: { ids: selectedRowKeys },
            });
            message.success('批量刪除成功');
            fetchItemLevels();
            setSelectedRowKeys([]);
        } catch (err) {
            console.error('Batch delete error:', err);
            message.error(err.response?.data?.msg || '批量刪除失敗');
        } finally {
            setLoading(false);
        }
    };

    const rowSelection = {
        selectedRowKeys,
        onChange: (selectedKeys) => setSelectedRowKeys(selectedKeys),
    };

    const colorMapping = {
        '白色': '#f0f0f0',
        '綠色': '#00cc00',
        '藍色': '#1e90ff',
        '紅色': '#ff4040',
        '紫色': '#ff00ff',
        '金色': '#ffd700',
    };

    // 根據背景色選擇文字顏色
    const textColorMapping = {
        '白色': '#000000', // 淺色背景用黑色文字
        '綠色': '#ffffff', // 深色背景用白色文字
        '藍色': '#ffffff',
        '紅色': '#ffffff',
        '紫色': '#ffffff',
        '金色': '#000000',
    };

    const columns = [
        { title: '等級', dataIndex: 'level', key: 'level', width: 150 },
        {
            title: '顏色',
            dataIndex: 'color',
            key: 'color',
            width: 120,
            render: (color) => (
                <Tag
                    color={colorMapping[color] || '#000000'}
                    style={{
                        padding: '6px 12px', // 增加內邊距
                        fontSize: '14px', // 增大字體
                        fontWeight: 'bold', // 加粗
                        border: '1px solid #d9d9d9', // 添加邊框
                        boxShadow: '0 1px 2px rgba(0, 0, 0, 0.1)', // 添加陰影
                        color: textColorMapping[color] || '#000000', // 動態設置文字顏色
                    }}
                >
                    {color}
                </Tag>
            ),
        },
        {
            title: '操作',
            key: 'action',
            render: (_, record) => (
                <Row gutter={[8, 8]} justify="center">
                    <Col>
                        <Button
                            onClick={() => {
                                setEditingLevel(record);
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
                            title="確認刪除此等級？"
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

    const paginatedLevels = filteredLevels.slice(
        (currentPage - 1) * pageSize,
        currentPage * pageSize
    );

    return (
        <div style={{ padding: '20px', backgroundColor: '#f0f2f5', minHeight: '100vh' }}>
            <Card
                title={<h2 style={{ margin: 0, fontSize: '24px', color: '#1890ff' }}>管理物品等級</h2>}
                bordered={false}
                style={{ boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)', borderRadius: '8px' }}
            >
                <div style={{ marginBottom: '16px', display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                    <Input.Search
                        placeholder="搜索等級名稱"
                        value={filters.search}
                        onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                        onSearch={handleSearch}
                        style={{ width: 200 }}
                        enterButton={<SearchOutlined />}
                    />
                    <Button
                        type="primary"
                        onClick={() => setVisible(true)}
                        style={{ marginLeft: 'auto' }}
                        disabled={loading}
                        icon={<PlusOutlined />}
                    >
                        新增等級
                    </Button>
                    <Popconfirm
                        title="確認批量刪除選中等級？"
                        onConfirm={handleBatchDelete}
                        okText="是"
                        cancelText="否"
                        disabled={loading || selectedRowKeys.length === 0}
                    >
                        <Button
                            type="danger"
                            icon={<DeleteOutlined />}
                            disabled={loading || selectedRowKeys.length === 0}
                        >
                            批量刪除
                        </Button>
                    </Popconfirm>
                </div>
                <Spin spinning={loading} size="large">
                    {filteredLevels.length === 0 && !loading ? (
                        <Alert
                            message="無等級"
                            description="目前沒有物品等級記錄。"
                            type="info"
                            showIcon
                            style={{ marginBottom: '16px' }}
                        />
                    ) : (
                        <>
                            <Table
                                rowSelection={rowSelection}
                                dataSource={paginatedLevels}
                                columns={columns}
                                rowKey="_id"
                                bordered
                                pagination={false}
                                scroll={{ x: 'max-content' }}
                            />
                            <Pagination
                                current={currentPage}
                                pageSize={pageSize}
                                total={filteredLevels.length}
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
                title={editingLevel ? '編輯物品等級' : '新增物品等級'}
                open={visible}
                onCancel={() => {
                    setVisible(false);
                    setEditingLevel(null);
                    form.resetFields();
                }}
                footer={null}
            >
                <Form form={form} onFinish={handleCreateOrUpdate} layout="vertical">
                    <Form.Item
                        name="level"
                        label="等級"
                        rules={[{ required: true, message: '請輸入等級名稱！' }]}
                    >
                        <Input placeholder="例如: 一般, 傳說" />
                    </Form.Item>
                    <Form.Item
                        name="color"
                        label="顏色"
                        rules={[{ required: true, message: '請選擇顏色！' }]}
                    >
                        <Select placeholder="選擇顏色">
                            <Option value="白色">
                                <Tag color={colorMapping['白色']} style={{ color: textColorMapping['白色'] }}>白色</Tag>
                            </Option>
                            <Option value="綠色">
                                <Tag color={colorMapping['綠色']} style={{ color: textColorMapping['綠色'] }}>綠色</Tag>
                            </Option>
                            <Option value="藍色">
                                <Tag color={colorMapping['藍色']} style={{ color: textColorMapping['藍色'] }}>藍色</Tag>
                            </Option>
                            <Option value="紅色">
                                <Tag color={colorMapping['紅色']} style={{ color: textColorMapping['紅色'] }}>紅色</Tag>
                            </Option>
                            <Option value="紫色">
                                <Tag color={colorMapping['紫色']} style={{ color: textColorMapping['紫色'] }}>紫色</Tag>
                            </Option>
                            <Option value="金色">
                                <Tag color={colorMapping['金色']} style={{ color: textColorMapping['金色'] }}>金色</Tag>
                            </Option>
                        </Select>
                    </Form.Item>
                    <Form.Item>
                        <Button type="primary" htmlType="submit" loading={loading}>
                            提交
                        </Button>
                    </Form.Item>
                </Form>
            </Modal>
        </div>
    );
};

export default ManageItemLevels;