import React, { useState, useEffect, useContext } from 'react';
import { Tree, Button, Modal, Form, Input, Select, message, Spin, Row, Col, Popconfirm, Card, Space, Typography, Upload, Alert, Dropdown, Menu } from 'antd';
import { PlusOutlined, UploadOutlined } from '@ant-design/icons';
import { getIconMapping, getIconNames } from '../components/IconMapping';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../AuthProvider';
import logger from '../utils/logger';

const { Option } = Select;
const { Title, Text } = Typography;

const BASE_URL = process.env.REACT_APP_API_URL || '';

const ManageMenu = () => {
    const navigate = useNavigate();
    const { user } = useContext(AuthContext);
    const token = localStorage.getItem('token');
    const [treeData, setTreeData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [visible, setVisible] = useState(false);
    const [messageVisible, setMessageVisible] = useState(false);
    const [selectedUserId, setSelectedUserId] = useState(null);
    const [selectedNode, setSelectedNode] = useState(null);
    const [contextNode, setContextNode] = useState(null); // 用於右鍵菜單的節點
    const [contextMenuVisible, setContextMenuVisible] = useState(false); // 控制右鍵菜單可見性
    const [form] = Form.useForm();
    const [messageForm] = Form.useForm();
    const [editingItem, setEditingItem] = useState(null);

    useEffect(() => {
        if (!token) {
            navigate('/login');
        } else {
            fetchMenuItems();

            // 使用輪詢監聽菜單更新（簡單實現，建議使用 WebSocket）
            const interval = setInterval(() => {
                fetchMenuItems();
            }, 30000); // 每 30 秒檢查一次

            return () => clearInterval(interval);
        }
    }, [token, navigate]);

    // 監聽點擊和鍵盤事件以關閉右鍵菜單
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (contextMenuVisible && !event.target.closest('.ant-dropdown-menu') && !visible) {
                setContextMenuVisible(false);
                setContextNode(null);
            }
        };

        const handleEscKey = (event) => {
            if (event.key === 'Escape' && contextMenuVisible && !visible) {
                setContextMenuVisible(false);
                setContextNode(null);
            }
        };

        document.addEventListener('click', handleClickOutside);
        document.addEventListener('keydown', handleEscKey);

        return () => {
            document.removeEventListener('click', handleClickOutside);
            document.removeEventListener('keydown', handleEscKey);
        };
    }, [contextMenuVisible, visible]);

    useEffect(() => {
      
    }, [contextNode]);

    const fetchMenuItems = async () => {
        setLoading(true);
        try {
            const res = await axios.get(`${BASE_URL}/api/session/menu`, {
                headers: { 'x-auth-token': token },
                withCredentials: true,
            });

          
            // 處理後端返回的數據，根據 parentId 構建樹狀結構
            const seenIds = new Set();
            const allItems = res.data
                .filter(item => {
                    if (!item._id) {
                        console.warn('Item with undefined _id:', item);
                        return false;
                    }
                    if (seenIds.has(item._id)) {
                        console.warn('Duplicate _id found:', item._id);
                        return false;
                    }
                    seenIds.add(item._id);
                    return true;
                })
                .map(item => {
                    let roles;
                    try {
                        roles = Array.isArray(item.roles) ? item.roles : JSON.parse(item.roles || '[]');
                        while (typeof roles === 'string') {
                            roles = JSON.parse(roles);
                        }
                    } catch (err) {
                        console.warn('Failed to parse roles', { roles: item.roles, error: err.message });
                        roles = [];
                    }

                    return {
                        ...item,
                        roles,
                        key: item.key || item._id,
                        title: item.label,
                        children: [], // 初始設置為空，後續根據 parentId 填充
                    };
                });

            // 根據 parentId 構建樹狀結構
            const treeDataMap = {};
            const treeData = [];

            // 將所有節點放入 map
            allItems.forEach(item => {
                if (item.children && Array.isArray(item.children)) {
                    item.children = item.children.map(child => ({
                        ...child,
                        key: child.key || child._id,
                        title: child.label,
                        children: child.children || [],
                    }));
                }
                treeDataMap[item._id] = { ...item, children: item.children || [] };
            });

            // 根據 parentId 構建層級關係
            allItems.forEach(item => {
                if (item.parentId && treeDataMap[item.parentId]) {
                    treeDataMap[item.parentId].children.push(treeDataMap[item._id]);
                } else {
                    treeData.push(treeDataMap[item._id]);
                }
            });

            // 移除重複的頂層節點（如果它們已經作為子節點存在）
            const topLevelIds = new Set(treeData.map(item => item._id));
            const finalTreeData = treeData.filter(item => {
                let isChild = false;
                for (const topItem of treeData) {
                    if (topItem._id === item._id) continue;
                    const hasChild = (node) => {
                        if (node.children.some(child => child._id === item._id)) {
                            return true;
                        }
                        return node.children.some(child => hasChild(child));
                    };
                    if (hasChild(topItem)) {
                        isChild = true;
                        break;
                    }
                }
                return !isChild;
            });

           
            setTreeData(finalTreeData.length > 0 ? finalTreeData : [{ key: '/', label: '首頁', children: [] }]);
        } catch (err) {
            if (err.response?.status === 401) {
                // Token 過期，重新登錄
                navigate('/login');
            } else {
                logger.error('Fetch session menu items error', { error: err.response?.data || err.message });
                message.error({
                    content: '載入菜單項失敗',
                    duration: 3,
                    onClose: () => fetchMenuItems(),
                });
                setTreeData([{ key: '/', label: '首頁', children: [] }]); // 設置默認數據
            }
        } finally {
            setLoading(false);
        }
    };

    const handleCreateOrUpdate = async (values) => {
        setLoading(true);
        const formData = new FormData();
        formData.append('key', values.key);
        formData.append('label', values.label);
        formData.append('icon', values.icon || '');
        const roles = Array.isArray(values.roles) ? values.roles : [];
        formData.append('roles', JSON.stringify(roles));
        formData.append('order', values.order || 0);
        if (values.customIcon && values.customIcon.length > 0) {
            formData.append('customIcon', values.customIcon[0].originFileObj);
        }
        // 如果是新增子節點，設置 parentId
        if (contextNode && !editingItem) {
          
            if (!contextNode._id) {
                message.error('父節點 ID 無效，請重新選擇');
                setLoading(false);
                return;
            }
            formData.append('parentId', contextNode._id);
        } else {
         
        }

        try {
            let response;
            if (editingItem) {
                response = await axios.put(`${BASE_URL}/api/menu/${editingItem._id}`, formData, {
                    headers: { 'x-auth-token': token, 'Content-Type': 'multipart/form-data' },
                });
                message.success('菜單項更新成功');
            } else {
                response = await axios.post(`${BASE_URL}/api/menu`, formData, {
                    headers: { 'x-auth-token': token, 'Content-Type': 'multipart/form-data' },
                });
                message.success('菜單項創建成功');
            }
            fetchMenuItems(); // 更新 session 中的菜單數據
            setVisible(false);
            setContextNode(null);
            setContextMenuVisible(false); // 關閉右鍵菜單
            form.resetFields();
            setEditingItem(null);
            setSelectedNode(null);
        } catch (err) {
            message.error(err.response?.data?.msg || '操作失敗');
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id) => {
        setLoading(true);
        try {
            await axios.delete(`${BASE_URL}/api/menu/${id}`, {
                headers: { 'x-auth-token': token },
            });
            message.success('菜單項刪除成功');
            fetchMenuItems(); // 刷新數據
            setSelectedNode(null);
        } catch (err) {
            const errorMsg = err.response?.data?.msg || '刪除失敗';
            if (err.response?.status === 404) {
                message.warning('該菜單項已不存在，將刷新數據');
                fetchMenuItems(); // 刷新數據
                setSelectedNode(null);
            } else {
                message.error(errorMsg);
            }
        } finally {
            setLoading(false);
        }
    };

    const handleSendMessage = async (values) => {
        setLoading(true);
        try {
            const response = await axios.post(`${BASE_URL}/send-discord-message`, {
                discordId: selectedUserId,
                message: values.message,
            }, {
                headers: { 'x-auth-token': token },
            });
            if (response.data.success) {
                message.success('消息發送成功');
            } else {
                message.error(response.data.message || '消息發送失敗');
            }
            setMessageVisible(false);
            messageForm.resetFields();
            setSelectedUserId(null);
        } catch (err) {
            message.error(err.response?.data?.message || '消息發送失敗');
        } finally {
            setLoading(false);
        }
    };

    const onDrop = async (info) => {
        const dropKey = info.node.key;
        const dragKey = info.dragNode.key;
        const dropPos = info.node.pos.split('-');
        const dropPosition = info.dropPosition - Number(dropPos[dropPos.length - 1]);

        const loop = (data, key, callback) => {
            data.forEach((item, index, arr) => {
                if (item.key === key) {
                    return callback(item, index, arr);
                }
                if (item.children) {
                    loop(item.children, key, callback);
                }
            });
        };

        const data = JSON.parse(JSON.stringify(treeData)); // 深拷貝 treeData，避免修改原始數據

        let dragObj;
        loop(data, dragKey, (item, index, arr) => {
            arr.splice(index, 1);
            dragObj = item;
        });

        if (!info.dropToGap) {
            loop(data, dropKey, (item) => {
                item.children = item.children || [];
                item.children.push(dragObj);
            });
        } else if (
            (info.node.children || []).length > 0 &&
            info.node.expanded &&
            dropPosition === 1
        ) {
            loop(data, dropKey, (item) => {
                item.children = item.children || [];
                item.children.unshift(dragObj);
            });
        } else {
            let ar = [];
            let i;
            loop(data, dropKey, (item, index, arr) => {
                ar = arr;
                i = index;
            });
            if (dropPosition === -1) {
                ar.splice(i, 0, dragObj);
            } else {
                ar.splice(i + 1, 0, dragObj);
            }
        }

        // 驗證 data 中的每個節點是否包含有效的 _id
        const validateNode = (node) => {
            if (!node._id || typeof node._id !== 'string' || node._id.length !== 24 || !/^[0-9a-fA-F]{24}$/.test(node._id)) {
                throw new Error(`無效的 _id: ${JSON.stringify(node)}`);
            }
            if (node.children && Array.isArray(node.children)) {
                node.children.forEach(child => validateNode(child));
            }
        };

        try {
            data.forEach(node => validateNode(node));
        } catch (err) {
            message.error('無效的菜單項數據，請刷新後重試');
            console.error(err.message);
            fetchMenuItems();
            return;
        }    

        setTreeData(data);

        try {
            await axios.put(`${BASE_URL}/api/menu/reorder`, { treeData: data }, {
                headers: { 'x-auth-token': token },
            });
            message.success('菜單順序已保存');
            fetchMenuItems(); // 更新 session 中的菜單數據
        } catch (err) {
            message.error('保存順序失敗');
            fetchMenuItems();
        }
    };

    const onSelect = (selectedKeys, info) => {
        if (selectedKeys.length > 0) {
            const node = info.node;
            if (!node._id) {
                console.warn('Selected node has no _id:', node);
                setSelectedNode(null);
                form.resetFields();
                return;
            }
            setSelectedNode(node);
            form.setFieldsValue({
                key: node.key,
                label: node.label,
                icon: node.icon,
                roles: node.roles,
                order: node.order,
                customIcon: node.customIcon ? [{ uid: '-1', name: 'icon', status: 'done', url: node.customIcon }] : [],
            });
        } else {
            setSelectedNode(null);
            form.resetFields();
        }
    };

    const onRightClick = (info) => {
        const node = info.node;
     
        if (!node.parentId || node.parentId === '' || node.parentId === null) {
            setContextNode(node);
            setContextMenuVisible(true); // 顯示右鍵菜單
        } else {
            setContextNode(null);
            setContextMenuVisible(false); // 隱藏右鍵菜單
        }
    };

    const handleAddChild = () => {
        if (!contextNode) {
            message.error('請選擇一個父節點進行新增子節點');
            return;
        }
        setVisible(true); // 顯示模態框
        setEditingItem(null); // 確保是新增模式
        form.resetFields(); // 重置表單
        setContextMenuVisible(false); // 關閉右鍵菜單
    };

    // 右鍵菜單
    const contextMenu = (
        <Menu>
            <Menu.Item key="add-child" onClick={handleAddChild}>
                新增子節點
            </Menu.Item>
        </Menu>
    );

    return (
        <div style={{ padding: '20px', backgroundColor: '#f0f2f5', minHeight: 'calc(100vh - 64px)', paddingTop: '84px', boxSizing: 'border-box' }}>
            <Card
                title={
                    <Space>
                        <Title level={2} style={{ margin: 0, color: '#1890ff' }}>菜單管理</Title>
                    </Space>
                }
                bordered={false}
                style={{ boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)', borderRadius: '12px' }}
            >
                <Row gutter={[16, 16]} style={{ marginBottom: '16px' }}>
                    <Col xs={24} sm={12} md={8}>
                        <Button
                            type="primary"
                            onClick={() => {
                                setContextNode(null); // 確保新增頂層節點時不設置 parentId
                                setVisible(true);
                            }}
                            disabled={loading}
                            icon={<PlusOutlined />}
                            style={{ width: '100%', borderRadius: '8px' }}
                        >
                            新增菜單項
                        </Button>
                    </Col>
                </Row>
                <Row gutter={[16, 16]}>
                    <Col xs={24} md={8}>
                        <Card title="菜單結構" style={{ borderRadius: '12px', boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)' }}>
                            <Spin spinning={loading} size="large">
                                {treeData.length === 0 && !loading ? (
                                    <Alert
                                        message="無菜單項"
                                        description="目前沒有菜單項記錄。"
                                        type="info"
                                        showIcon
                                        style={{ marginBottom: '16px' }}
                                    />
                                ) : (
                                    <Dropdown
                                        overlay={contextMenu}
                                        trigger={['contextMenu']}
                                        visible={contextMenuVisible}
                                        onVisibleChange={(visible) => {
                                            if (!visible) {
                                                setContextMenuVisible(false);
                                                setContextNode(null);
                                            }
                                        }}
                                    >
                                        <Tree
                                            treeData={treeData}
                                            draggable
                                            onDrop={onDrop}
                                            onSelect={onSelect}
                                            onRightClick={onRightClick}
                                            blockNode
                                            showLine={true}
                                            defaultExpandedKeys={[]}
                                        />
                                    </Dropdown>
                                )}
                            </Spin>
                        </Card>
                    </Col>
                    <Col xs={24} md={16}>
                        <Card title="菜單項詳情" style={{ borderRadius: '12px', boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)' }}>
                            <Spin spinning={loading} size="large">
                                {selectedNode ? (
                                    <>
                                        <Form form={form} onFinish={handleCreateOrUpdate} layout="vertical">
                                            <Form.Item
                                                name="key"
                                                label="路徑"
                                                rules={[{ required: true, message: '請輸入路徑！' }]}
                                            >
                                                <Input placeholder="例如：/ 或 /wallet" />
                                            </Form.Item>
                                            <Form.Item
                                                name="label"
                                                label="顯示名稱"
                                                rules={[{ required: true, message: '請輸入顯示名稱！' }]}
                                            >
                                                <Input placeholder="例如：首頁" />
                                            </Form.Item>
                                            <Form.Item
                                                name="icon"
                                                label="預定義圖標"
                                            >
                                                <Select placeholder="選擇圖標" allowClear>
                                                    {getIconNames().map(icon => (
                                                        <Option key={icon} value={icon}>
                                                            <Space>
                                                                {getIconMapping()[icon]}
                                                                {icon}
                                                            </Space>
                                                        </Option>
                                                    ))}
                                                </Select>
                                            </Form.Item>
                                            <Form.Item
                                                name="customIcon"
                                                label="自定義圖標"
                                                valuePropName="fileList"
                                                getValueFromEvent={(e) => e && e.fileList}
                                            >
                                                <Upload
                                                    listType="picture"
                                                    maxCount={1}
                                                    beforeUpload={() => false}
                                                    accept="image/*"
                                                >
                                                    <Button icon={<UploadOutlined />}>上傳自定義圖標</Button>
                                                </Upload>
                                            </Form.Item>
                                            <Form.Item
                                                name="roles"
                                                label="可見角色"
                                                rules={[{ required: true, message: '請選擇可見角色！' }]}
                                            >
                                                <Select mode="multiple" placeholder="選擇角色">
                                                    <Option value="user">普通用戶</Option>
                                                    <Option value="admin">管理員</Option>
                                                    <Option value="moderator">版主</Option>
                                                </Select>
                                            </Form.Item>
                                            <Form.Item
                                                name="order"
                                                label="排序"
                                                rules={[{ type: 'number', message: '請輸入數字！' }]}
                                            >
                                                <Input type="number" placeholder="數字越小越靠前" />
                                            </Form.Item>
                                            <Form.Item>
                                                <Space>
                                                    <Button
                                                        type="primary"
                                                        htmlType="submit"
                                                        loading={loading}
                                                        style={{ borderRadius: '8px' }}
                                                        onClick={() => setEditingItem(selectedNode)}
                                                    >
                                                        保存
                                                    </Button>
                                                    <Button
                                                        onClick={() => {
                                                            setSelectedNode(null);
                                                            form.resetFields();
                                                        }}
                                                        style={{ borderRadius: '8px' }}
                                                    >
                                                        取消
                                                    </Button>
                                                    <Popconfirm
                                                        title="確認刪除此菜單項？"
                                                        onConfirm={() => {
                                                            if (!selectedNode || !selectedNode._id) {
                                                                message.error('請選擇一個有效的菜單項進行刪除');
                                                                return;
                                                            }
                                                            handleDelete(selectedNode._id);
                                                        }}
                                                        okText="是"
                                                        cancelText="否"
                                                        disabled={loading || !selectedNode || !selectedNode._id}
                                                    >
                                                        <Button
                                                            danger
                                                            disabled={loading || !selectedNode || !selectedNode._id}
                                                            style={{ borderRadius: '8px' }}
                                                        >
                                                            刪除
                                                        </Button>
                                                    </Popconfirm>
                                                    <Button
                                                        onClick={() => {
                                                            setSelectedUserId(selectedNode.discordId);
                                                            setMessageVisible(true);
                                                        }}
                                                        disabled={loading || !selectedNode.discordId}
                                                        style={{ borderRadius: '8px' }}
                                                    >
                                                        發送消息
                                                    </Button>
                                                </Space>
                                            </Form.Item>
                                        </Form>
                                    </>
                                ) : (
                                    <Text>請選擇一個菜單項以查看或編輯詳情</Text>
                                )}
                            </Spin>
                        </Card>
                    </Col>
                </Row>
            </Card>
            <Modal
                title="新增菜單項"
                open={visible}
                onCancel={() => {
                    setVisible(false);
                    setContextNode(null);
                    setContextMenuVisible(false); // 關閉右鍵菜單
                    form.resetFields();
                }}
                footer={null}
                transitionName="ant-fade"
            >
                <Form form={form} onFinish={handleCreateOrUpdate} layout="vertical">
                    <Form.Item
                        name="key"
                        label="路徑"
                        rules={[{ required: true, message: '請輸入路徑！' }]}
                    >
                        <Input placeholder="例如：/ 或 /wallet" />
                    </Form.Item>
                    <Form.Item
                        name="label"
                        label="顯示名稱"
                        rules={[{ required: true, message: '請輸入顯示名稱！' }]}
                    >
                        <Input placeholder="例如：首頁" />
                    </Form.Item>
                    <Form.Item
                        name="icon"
                        label="預定義圖標"
                    >
                        <Select placeholder="選擇圖標" allowClear>
                            {getIconNames().map(icon => (
                                <Option key={icon} value={icon}>
                                    <Space>
                                        {getIconMapping()[icon]}
                                        {icon}
                                    </Space>
                                </Option>
                            ))}
                        </Select>
                    </Form.Item>
                    <Form.Item
                        name="customIcon"
                        label="自定義圖標"
                        valuePropName="fileList"
                        getValueFromEvent={(e) => e && e.fileList}
                    >
                        <Upload
                            listType="picture"
                            maxCount={1}
                            beforeUpload={() => false}
                            accept="image/*"
                        >
                            <Button icon={<UploadOutlined />}>上傳自定義圖標</Button>
                        </Upload>
                    </Form.Item>
                    <Form.Item
                        name="roles"
                        label="可見角色"
                        rules={[{ required: true, message: '請選擇可見角色！' }]}
                    >
                        <Select mode="multiple" placeholder="選擇角色">
                            <Option value="user">普通用戶</Option>
                            <Option value="admin">管理員</Option>
                            <Option value="moderator">版主</Option>
                        </Select>
                    </Form.Item>
                    <Form.Item
                        name="order"
                        label="排序"
                        rules={[{ type: 'number', message: '請輸入數字！' }]}
                    >
                        <Input type="number" placeholder="數字越小越靠前" />
                    </Form.Item>
                    <Form.Item>
                        <Button type="primary" htmlType="submit" loading={loading} style={{ borderRadius: '8px' }}>
                            提交
                        </Button>
                    </Form.Item>
                </Form>
            </Modal>
            <Modal
                title="發送消息給用戶"
                open={messageVisible}
                onCancel={() => {
                    setMessageVisible(false);
                    setSelectedUserId(null);
                    messageForm.resetFields();
                }}
                footer={null}
                transitionName="ant-fade"
            >
                <Form form={messageForm} onFinish={handleSendMessage} layout="vertical">
                    <Form.Item
                        name="message"
                        label="消息內容"
                        rules={[{ required: true, message: '請輸入消息內容！' }]}
                    >
                        <Input.TextArea rows={4} placeholder="輸入你想發送的消息" />
                    </Form.Item>
                    <Form.Item>
                        <Button type="primary" htmlType="submit" loading={loading} style={{ borderRadius: '8px' }}>
                            發送
                        </Button>
                    </Form.Item>
                </Form>
            </Modal>
            <style jsx global>{`
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
    );
};

export default ManageMenu;