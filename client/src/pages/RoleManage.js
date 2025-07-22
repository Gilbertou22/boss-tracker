import React, { useState, useEffect } from 'react';
import { Table, Button, Space, message, Popconfirm, Modal, Form, Input, Spin, Card } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import moment from 'moment';

const BASE_URL = process.env.REACT_APP_API_URL || '';

const RoleManage = () => {
    const navigate = useNavigate();
    const token = localStorage.getItem('token');
    const [roles, setRoles] = useState([]);
    const [loading, setLoading] = useState(false);
    const [modalVisible, setModalVisible] = useState(false);
    const [editingRole, setEditingRole] = useState(null);
    const [form] = Form.useForm();
    const [role, setRole] = useState(null);

    useEffect(() => {
        if (!token) {
            message.error('請先登入！');
            navigate('/login');
            return;
        }
        fetchUserInfo();
        fetchRoles();
    }, [token, navigate]);

    const fetchUserInfo = async () => {
        try {
            const res = await axios.get(`${BASE_URL}/api/users/me`, {
                headers: { 'x-auth-token': token },
            });
            setRole(res.data.roles); // 假設 roles 是陣列
        } catch (err) {
            message.error('無法載入用戶信息，請重新登入');
            navigate('/login');
        }
    };

    const fetchRoles = async () => {
        setLoading(true);
        try {
            const res = await axios.get(`${BASE_URL}/api/roles`, {
                headers: { 'x-auth-token': token },
            });
            setRoles(res.data);
        } catch (err) {
            message.error(`載入角色列表失敗: ${err.response?.data?.msg || err.message}`);
        } finally {
            setLoading(false);
        }
    };

    const handleAdd = () => {
        setEditingRole(null);
        form.resetFields();
        setModalVisible(true);
    };

    const handleEdit = (role) => {
        setEditingRole(role);
        form.setFieldsValue(role);
        setModalVisible(true);
    };

    const handleDelete = async (id) => {
        try {
            await axios.delete(`${BASE_URL}/api/roles/${id}`, {
                headers: { 'x-auth-token': token },
            });
            message.success('角色刪除成功');
            fetchRoles();
        } catch (err) {
            message.error(`刪除角色失敗: ${err.response?.data?.msg || err.message}`);
        }
    };

    const handleBatchDelete = async () => {
        if (selectedRowKeys.length === 0) {
            message.warning('請選擇要刪除的角色');
            return;
        }
        try {
            setLoading(true);
            await axios.delete(`${BASE_URL}/api/roles/batch-delete`, {
                headers: { 'x-auth-token': token },
                data: { ids: selectedRowKeys },
            });
            message.success('批量刪除成功');
            setSelectedRowKeys([]);
            fetchRoles();
        } catch (err) {
            message.error(`批量刪除失敗: ${err.response?.data?.msg || err.message}`);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (values) => {
        try {
            setLoading(true);
            if (editingRole) {
                await axios.put(`${BASE_URL}/api/roles/${editingRole._id}`, values, {
                    headers: { 'x-auth-token': token },
                });
                message.success('角色更新成功');
            } else {
                await axios.post(`${BASE_URL}/api/roles`, values, {
                    headers: { 'x-auth-token': token },
                });
                message.success('角色創建成功');
            }
            setModalVisible(false);
            fetchRoles();
        } catch (err) {
            message.error(`操作失敗: ${err.response?.data?.msg || err.message}`);
        } finally {
            setLoading(false);
        }
    };

    const [selectedRowKeys, setSelectedRowKeys] = useState([]);
    const rowSelection = {
        selectedRowKeys,
        onChange: (keys) => setSelectedRowKeys(keys),
    };

    const columns = [
        {
            title: '角色名稱',
            dataIndex: 'name',
            key: 'name',
            sorter: (a, b) => a.name.localeCompare(b.name),
        },
        {
            title: '描述',
            dataIndex: 'description',
            key: 'description',
        },
        {
            title: '創建時間',
            dataIndex: 'createdAt',
            key: 'createdAt',
            render: (time) => moment(time).format('YYYY-MM-DD HH:mm:ss'),
            sorter: (a, b) => new Date(a.createdAt) - new Date(b.createdAt),
        },
        {
            title: '操作',
            key: 'actions',
            render: (_, record) => (
                <Space size="small">
                    <Button
                        type="link"
                        icon={<EditOutlined />}
                        onClick={() => handleEdit(record)}
                    >
                        編輯
                    </Button>
                    <Popconfirm
                        title="確認刪除此角色？"
                        onConfirm={() => handleDelete(record._id)}
                        okText="是"
                        cancelText="否"
                    >
                        <Button type="link" icon={<DeleteOutlined />} style={{ color: '#ff4d4f' }}>
                            刪除
                        </Button>
                    </Popconfirm>
                </Space>
            ),
        },
    ];

    return (
        <div style={{ padding: '20px', backgroundColor: '#f0f2f5' }}>
            <Card
                title={<h2 style={{ margin: 0, fontSize: '24px', color: '#1890ff' }}>管理角色</h2>}
                bordered={false}
                style={{ boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)', borderRadius: '8px' }}
                extra={
                    role?.includes('admin') && (
                        <Space>
                            <Button
                                type="primary"
                                icon={<PlusOutlined />}
                                onClick={handleAdd}
                            >
                                新增角色
                            </Button>
                            <Button
                                type="primary"
                                danger
                                onClick={handleBatchDelete}
                                disabled={selectedRowKeys.length === 0}
                            >
                                批量刪除
                            </Button>
                        </Space>
                    )
                }
            >
                <Spin spinning={loading}>
                    <Table
                        rowSelection={role?.includes('admin') ? rowSelection : undefined}
                        columns={columns}
                        dataSource={roles}
                        rowKey="_id"
                        pagination={{
                            pageSize: 10,
                            showSizeChanger: true,
                            pageSizeOptions: ['10', '20', '50'],
                            showTotal: (total) => `共 ${total} 條記錄`,
                        }}
                    />
                </Spin>
            </Card>

            <Modal
                title={editingRole ? '編輯角色' : '新增角色'}
                open={modalVisible}
                onCancel={() => setModalVisible(false)}
                footer={null}
            >
                <Form
                    form={form}
                    layout="vertical"
                    onFinish={handleSubmit}
                >
                    <Form.Item
                        name="name"
                        label="角色名稱"
                        rules={[{ required: true, message: '請輸入角色名稱' }]}
                    >
                        <Input placeholder="例如：user" />
                    </Form.Item>
                    <Form.Item
                        name="description"
                        label="描述"
                    >
                        <Input.TextArea rows={4} placeholder="輸入角色描述" />
                    </Form.Item>
                    <Form.Item>
                        <Button type="primary" htmlType="submit" loading={loading} style={{ width: '100%' }}>
                            {editingRole ? '更新' : '創建'}
                        </Button>
                    </Form.Item>
                </Form>
            </Modal>
        </div>
    );
};

export default RoleManage;