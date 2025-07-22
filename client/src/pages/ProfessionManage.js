import React, { useState, useEffect } from 'react';
import { Table, Button, Space, message, Modal, Form, Input, Select, Spin, Card, Row, Col } from 'antd';
import { PlusOutlined, EditOutlined } from '@ant-design/icons';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { icons } from '../assets/icons';
import moment from 'moment';

const { Option } = Select;
const BASE_URL = process.env.REACT_APP_API_URL || '';

const ProfessionManage = () => {
    const navigate = useNavigate();
    const token = localStorage.getItem('token');
    const [professions, setProfessions] = useState([]);
    const [loading, setLoading] = useState(false);
    const [modalVisible, setModalVisible] = useState(false);
    const [editingProfession, setEditingProfession] = useState(null);
    const [form] = Form.useForm();
    const [roles, setRoles] = useState([]); // 修改為 roles 陣列

    useEffect(() => {
        if (!token) {
            message.error('請先登入！');
            navigate('/login');
            return;
        }
        fetchUserInfo();
        fetchProfessions();
    }, [token, navigate]);

    const fetchUserInfo = async () => {
        try {
            const res = await axios.get(`${BASE_URL}/api/users/me`, {
                headers: { 'x-auth-token': token },
            });
            setRoles(res.data.roles); // 儲存 roles 陣列
        } catch (err) {
            message.error('無法載入用戶信息，請重新登入');
            navigate('/login');
        }
    };

    const fetchProfessions = async () => {
        setLoading(true);
        try {
            const res = await axios.get(`${BASE_URL}/api/professions`, {
                headers: { 'x-auth-token': token },
            });
            setProfessions(res.data);
        } catch (err) {
            message.error(`載入職業列表失敗: ${err.response?.data?.msg || err.message}`);
        } finally {
            setLoading(false);
        }
    };

    const handleAdd = () => {
        setEditingProfession(null);
        form.resetFields();
        setModalVisible(true);
    };

    const handleEdit = (profession) => {
        setEditingProfession(profession);
        form.setFieldsValue(profession);
        setModalVisible(true);
    };

    const handleSubmit = async (values) => {
        try {
            setLoading(true);
            if (editingProfession) {
                // 編輯職業
                await axios.put(`${BASE_URL}/api/professions/${editingProfession._id}`, values, {
                    headers: { 'x-auth-token': token },
                });
                message.success('職業更新成功');
            } else {
                // 新增職業
                await axios.post(`${BASE_URL}/api/professions`, values, {
                    headers: { 'x-auth-token': token },
                });
                message.success('職業創建成功');
            }
            setModalVisible(false);
            fetchProfessions();
        } catch (err) {
            message.error(`操作失敗: ${err.response?.data?.msg || err.message}`);
        } finally {
            setLoading(false);
        }
    };

    const columns = [
        {
            title: '職業名稱',
            dataIndex: 'name',
            key: 'name',
            sorter: (a, b) => a.name.localeCompare(b.name),
        },
        {
            title: '圖標',
            dataIndex: 'icon',
            key: 'icon',
            render: (icon) => (
                <img src={icons[icon]} alt={icon} style={{ width: 24, height: 24 }} />
            ),
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
                </Space>
            ),
        },
    ];

    return (
        <div style={{ padding: '20px', backgroundColor: '#f0f2f5' }}>
            <Card
                title={<h2 style={{ margin: 0, fontSize: '24px', color: '#1890ff' }}>管理職業（種族）</h2>}
                bordered={false}
                style={{ boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)', borderRadius: '8px' }}
                extra={
                    roles.includes('admin') && ( // 使用 roles.includes('admin') 檢查
                        <Space>
                            <Button
                                type="primary"
                                icon={<PlusOutlined />}
                                onClick={handleAdd}
                            >
                                新增職業
                            </Button>
                        </Space>
                    )
                }
            >
                <Spin spinning={loading}>
                    <Table
                        columns={columns}
                        dataSource={professions}
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
                title={editingProfession ? '編輯職業' : '新增職業'}
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
                        label="職業名稱"
                        rules={[{ required: true, message: '請輸入職業名稱' }]}
                    >
                        <Input placeholder="例如：幻影劍士" />
                    </Form.Item>
                    <Form.Item
                        name="icon"
                        label="職業圖標"
                        rules={[{ required: true, message: '請選擇職業圖標' }]}
                    >
                        <Select placeholder="選擇圖標">
                            <Option value="classMirageblade">
                                <img src={icons.classMirageblade} alt="幻影劍士" style={{ width: 24, height: 24, marginRight: 8 }} />
                                幻影劍士
                            </Option>
                            <Option value="classIncensearcher">
                                <img src={icons.classIncensearcher} alt="香射手" style={{ width: 24, height: 24, marginRight: 8 }} />
                                香射手
                            </Option>
                            <Option value="classRunescribe">
                                <img src={icons.classRunescribe} alt="咒文刻印使" style={{ width: 24, height: 24, marginRight: 8 }} />
                                咒文刻印使
                            </Option>
                            <Option value="classEnforcer">
                                <img src={icons.classEnforcer} alt="執行官" style={{ width: 24, height: 24, marginRight: 8 }} />
                                執行官
                            </Option>
                            <Option value="classSolarsentinel">
                                <img src={icons.classSolarsentinel} alt="太陽監視者" style={{ width: 24, height: 24, marginRight: 8 }} />
                                太陽監視者
                            </Option>
                            <Option value="classAbyssrevenant">
                                <img src={icons.classAbyssrevenant} alt="深淵放逐者" style={{ width: 24, height: 24, marginRight: 8 }} />
                                深淵放逐者
                            </Option>
                        </Select>
                    </Form.Item>
                    <Form.Item
                        name="description"
                        label="描述"
                    >
                        <Input.TextArea rows={4} placeholder="輸入職業描述" />
                    </Form.Item>
                    <Form.Item>
                        <Button type="primary" htmlType="submit" loading={loading} style={{ width: '100%' }}>
                            {editingProfession ? '更新' : '創建'}
                        </Button>
                    </Form.Item>
                </Form>
            </Modal>
        </div>
    );
};

export default ProfessionManage;