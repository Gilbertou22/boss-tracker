// pages/ApplyItem.js
import React, { useState, useEffect, useCallback } from 'react';
import { Form, Select, Button, Spin, Alert, Card, Space, Input, Tag, Avatar, Typography, Row, Col, message, Modal } from 'antd';
import { LeftOutlined, SearchOutlined, GiftOutlined, CalendarOutlined, CheckCircleOutlined } from '@ant-design/icons';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import moment from 'moment';
import logger from '../utils/logger';

const { Option } = Select;
const { Title, Text } = Typography;

const BASE_URL = process.env.REACT_APP_API_URL || '';

// 與擊殺詳情頁面相同的顏色映射
const colorMapping = {
    '白色': '#f0f0f0',
    '綠色': '#00cc00',
    '藍色': '#1e90ff',
    '紅色': '#EC3636',
    '紫色': '#B931F3',
    '金色': '#ffd700',
};

const ApplyItem = () => {
    const [form] = Form.useForm();
    const [kills, setKills] = useState([]);
    const [filteredKills, setFilteredKills] = useState([]);
    const [filteredItems, setFilteredItems] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [userApplications, setUserApplications] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedKillId, setSelectedKillId] = useState(null);
    const [successModalVisible, setSuccessModalVisible] = useState(false); // 控制成功提示框
    const navigate = useNavigate();
    const token = localStorage.getItem('token');

    useEffect(() => {
        if (!token) {
            message.error('請先登錄！');
            navigate('/login');
            return;
        }
        fetchKills();
        fetchUserApplications();
    }, [token, navigate]);

    const fetchKills = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            const res = await axios.get(`${BASE_URL}/api/boss-kills`, {
                headers: { 'x-auth-token': token },
            });
     
            // 過濾 status === 'pending' 的擊殺記錄
            const pendingKills = res.data.data.filter(kill => {
                const killStatus = kill.status ? kill.status.toLowerCase() : 'pending';
                const isPending = killStatus === 'pending';
     
                return isPending;
            });
     
            setKills(pendingKills);
            setFilteredKills(pendingKills);
        } catch (err) {
     
            setError('載入擊殺記錄失敗: ' + (err.response?.data?.msg || err.message));
        } finally {
            setLoading(false);
        }
    }, [token]);

    const fetchUserApplications = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            const res = await axios.get(`${BASE_URL}/api/applications/user`, {
                headers: { 'x-auth-token': token },
            });
           
            const activeApplications = res.data.filter(app => app.status === 'pending' || app.status === 'approved');
            setUserApplications(activeApplications.map(app => `${app.kill_id._id}_${app.item_id}`));
           
        } catch (err) {
           
            setError('無法載入申請記錄，限制可能不準確');
        } finally {
            setLoading(false);
        }
    }, [token]);

    const handleSearch = (value) => {
        setSearchTerm(value);
        if (value.trim() === '') {
            setFilteredKills(kills);
        } else {
            const filtered = kills.filter(kill =>
                (kill.bossId?.name || '').toLowerCase().includes(value.toLowerCase()) ||
                moment(kill.kill_time).format('YYYY-MM-DD HH:mm').includes(value)
            );
            setFilteredKills(filtered);
        }
        form.setFieldsValue({ kill_id: undefined, item_name: undefined });
        setSelectedKillId(null);
        setFilteredItems([]);
    };

    const handleKillChange = (value) => {
        let validItems = [];
        const selectedKill = kills.find(kill => kill._id === value);
        if (selectedKill) {
            // 過濾掉已過期的物品
            validItems = (selectedKill.dropped_items || []).filter(item => {
                const applyDeadline = moment(item.apply_deadline);
                return applyDeadline.isAfter(moment());
            });
            
            setFilteredItems(validItems);
            setSelectedKillId(value);
            form.setFieldsValue({ kill_id: value });
            if (validItems.length === 0) {
                setError('此擊殺記錄中沒有可申請的物品');
            } else {
                setError(null);
            }
        } else {
            setFilteredItems([]);
            setSelectedKillId(null);
            form.setFieldsValue({ kill_id: undefined });
            setError(null);
        }
        form.setFieldsValue({ item_name: undefined });
       
    };

    const handleSubmit = async (values) => {
       
        try {
            setLoading(true);
            setError(null);
            const token = localStorage.getItem('token');
            if (!token) {
                message.error('請先登錄！');
                navigate('/login');
                return;
            }
            const selectedKill = kills.find(kill => kill._id === values.kill_id);
            const selectedItem = filteredItems.find(item => item.name === values.item_name);
            if (!selectedKill) {
                throw new Error('選擇的擊殺記錄無效');
            }
            if (!selectedItem || !selectedItem._id) {
                console.error('Selected item does not have an item_id:', selectedItem);
                throw new Error('物品缺少唯一標識，請聯繫管理員');
            }

            // 檢查物品是否已過期
            const applyDeadline = moment(selectedItem.apply_deadline);
            if (applyDeadline.isBefore(moment())) {
                throw new Error('此物品申請期限已過期，無法申請');
            }

            const applicationKey = `${values.kill_id}_${selectedItem._id}`;
            if (userApplications.includes(applicationKey)) {
                throw new Error('您已為此物品提交申請，無法再次申請！');
            }
           
            const res = await axios.post(
                `${BASE_URL}/api/applications`,
                {
                    kill_id: values.kill_id,
                    item_id: selectedItem._id,
                    item_name: values.item_name,
                },
                { headers: { 'x-auth-token': token } }
            );
       
            // 顯示成功提示框
            setSuccessModalVisible(true);
            form.resetFields();
            setSelectedKillId(null);
            setFilteredItems([]);
            fetchUserApplications();
        } catch (err) {
            console.error('Submit error:', err.response?.data || err);
            const errorMsg = err.response?.data?.msg || err.message || '申請失敗，請稍後再試';
            setError(errorMsg);
            logger.error('Apply item error', {
                userId: token, // 假設 token 中包含用戶信息
                killId: values.kill_id,
                itemName: values.item_name,
                error: err.response?.data || err.message,
                stack: err.stack,
            });
        } finally {
            setLoading(false);
        }
    };
    
    const handleSuccessModalClose = () => {
        setSuccessModalVisible(false);
        navigate('/kill-history'); // 提示框關閉後跳轉
    };

    return (
        <div style={{ padding: '20px', minHeight: '100vh', background: '#f0f2f5' }}>
            <Row justify="center">
                <Col xs={24} sm={20} md={16} lg={12}>
                    <Card
                        title={
                            <Space>
                                <Button
                                    type="link"
                                    icon={<LeftOutlined />}
                                    onClick={() => navigate(-1)}
                                    style={{ padding: 0 }}
                                >
                                    返回
                                </Button>
                                <Title level={3} style={{ margin: 0, color: '#1890ff' }}>
                                    申請物品
                                </Title>
                            </Space>
                        }
                        bordered={false}
                        style={{
                            borderRadius: '8px',
                            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
                            background: '#fff',
                        }}
                    >
                        <Spin spinning={loading}>
                            {error && (
                                <Alert
                                    message="錯誤"
                                    description={error}
                                    type="error"
                                    showIcon
                                    closable
                                    onClose={() => setError(null)}
                                    style={{ marginBottom: '16px' }}
                                />
                            )}
                            <Form form={form} name="apply-item" onFinish={handleSubmit} layout="vertical">
                                <Space direction="vertical" style={{ width: '100%', marginBottom: '16px' }}>
                                    <Input
                                        placeholder="搜索首領或日期（非必填）"
                                        prefix={<SearchOutlined />}
                                        value={searchTerm}
                                        onChange={(e) => handleSearch(e.target.value)}
                                        style={{ borderRadius: '4px' }}
                                    />
                                </Space>
                                <Form.Item
                                    name="kill_id"
                                    label={
                                        <Text strong>
                                            <CalendarOutlined style={{ marginRight: '8px' }} />
                                            選擇擊殺記錄
                                        </Text>
                                    }
                                    rules={[{ required: true, message: '請選擇擊殺記錄' }]}
                                >
                                    <Select
                                        placeholder="選擇擊殺記錄"
                                        onChange={handleKillChange}
                                        allowClear
                                        style={{ width: '100%' }}
                                        optionLabelProp="children"
                                        filterOption={false}
                                    >
                                        {filteredKills.map(kill => (
                                            <Option key={kill._id} value={kill._id}>
                                                <Space style={{ display: 'flex', alignItems: 'center' }}>
                                                    <Avatar
                                                        src={kill.bossId?.imageUrl || 'wp1.jpg'}
                                                        size={32}
                                                        style={{ marginRight: '8px' }}
                                                    />
                                                    <div>
                                                        <Text strong>{kill.bossId?.name || '未知首領'}</Text>
                                                        <br />
                                                        <Text type="secondary">
                                                            {moment(kill.kill_time).format('YYYY-MM-DD HH:mm')}
                                                        </Text>
                                                    </div>
                                                </Space>
                                            </Option>
                                        ))}
                                    </Select>
                                </Form.Item>
                                <Form.Item
                                    name="item_name"
                                    label={
                                        <Text strong>
                                            <GiftOutlined style={{ marginRight: '8px' }} />
                                            選擇物品
                                        </Text>
                                    }
                                    rules={[{ required: true, message: '請選擇物品' }]}
                                >
                                    <Select
                                        placeholder="選擇物品"
                                        disabled={!selectedKillId}
                                        style={{ width: '100%' }}
                                        notFoundContent={
                                            <Text type="secondary">
                                                {filteredItems.length === 0
                                                    ? '此擊殺記錄中沒有可申請的物品'
                                                    : '所有可申請的物品均已申請或過期，請選擇其他擊殺記錄'}
                                            </Text>
                                        }
                                    >
                                        {filteredItems.map(item => {
                                            const applicationKey = `${selectedKillId}_${item._id}`;
                                            const isApplied = userApplications.includes(applicationKey);
                                            const applyDeadline = moment(item.apply_deadline);
                                            const isExpired = applyDeadline.isBefore(moment());
                                            
                                            return (
                                                <Option
                                                    key={item._id}
                                                    value={item.name}
                                                    disabled={isApplied || isExpired}
                                                >
                                                    <Space style={{ display: 'flex', alignItems: 'center' }}>
                                                        <Text
                                                            strong
                                                            style={{
                                                                color: item.level?.color ? colorMapping[item.level.color] : '#000',
                                                            }}
                                                        >
                                                            {item.name}
                                                        </Text>
                                                        <Tag color="blue">{item.type}</Tag>
                                                        <Text type="secondary">
                                                            截止 {moment(item.apply_deadline).format('YYYY-MM-DD')}
                                                        </Text>
                                                        {isApplied && <Tag color="orange">已申請</Tag>}
                                                        {isExpired && <Tag color="red">已過期</Tag>}
                                                    </Space>
                                                </Option>
                                            );
                                        })}
                                    </Select>
                                </Form.Item>
                                <Form.Item>
                                    <Button type="primary" htmlType="submit" loading={loading} block>
                                        提交申請
                                    </Button>
                                </Form.Item>
                            </Form>
                        </Spin>
                    </Card>
                </Col>
            </Row>

            {/* 成功提示框 */}
            <Modal
                visible={successModalVisible}
                onCancel={handleSuccessModalClose}
                footer={null}
                afterClose={handleSuccessModalClose}
                closable={false}
                centered
                bodyStyle={{ textAlign: 'center', padding: '24px' }}
            >
                <Space direction="vertical" style={{ width: '100%' }}>
                    <CheckCircleOutlined style={{ fontSize: '48px', color: '#52c41a' }} />
                    <Title level={4}>成功</Title>
                    <Text>您的物品申請已提交成功！</Text>
                </Space>
            </Modal>

            <style jsx global>{`
                .ant-form-item-label > label {
                    font-size: 16px;
                    color: #333;
                }
                .ant-select-selector {
                    border-radius: 4px !important;
                    padding: 4px 11px !important;
                    height: auto !important;
                }
                .ant-select-selection-item {
                    display: flex;
                    align-items: center;
                    height: auto !important;
                }
                .ant-select-item-option-content {
                    display: flex;
                    align-items: center;
                    padding: 8px 0 !important;
                }
                .ant-btn-primary {
                    border-radius: 4px;
                    font-size: 16px;
                    height: 40px;
                }
                .ant-input {
                    border-radius: 4px !important;
                }
                @media (max-width: 768px) {
                    .ant-form-item-label > label {
                        font-size: 14px;
                    }
                    .ant-btn-primary {
                        font-size: 14px;
                        height: 36px;
                    }
                    .ant-select-selector {
                        font-size: 14px;
                    }
                    .ant-input {
                        font-size: 14px;
                    }
                    .ant-select-item-option-content {
                        padding: 4px 0 !important;
                    }
                }
            `}</style>
        </div>
    );
};

export default ApplyItem;