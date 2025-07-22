import React, { useState, useEffect } from 'react';
import { Form, Input, InputNumber, Upload, Button, message, Modal, Card, Typography, Space, Alert, Progress, Select } from 'antd';
import { UploadOutlined, CheckCircleOutlined, ExclamationCircleOutlined } from '@ant-design/icons';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import logger from '../utils/logger';
import { motion } from 'framer-motion';
import { icons } from '../assets/icons';

const { Title, Text } = Typography;
const { Option } = Select;
const BASE_URL = process.env.REACT_APP_API_URL || '';

const fadeIn = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
};

const getPasswordStrength = (password) => {
    if (!password) return 0;
    let strength = 0;
    if (password.length >= 6) strength += 25;
    if (password.match(/[A-Z]/)) strength += 25;
    if (password.match(/[0-9]/)) strength += 25;
    if (password.match(/[^A-Za-z0-9]/)) strength += 25;
    return strength;
};

const Register = () => {
    const [fileList, setFileList] = useState([]);
    const [form] = Form.useForm();
    const navigate = useNavigate();
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [registerResponse, setRegisterResponse] = useState(null);
    const [online, setOnline] = useState(navigator.onLine);
    const [errorModalVisible, setErrorModalVisible] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');
    const [successModalVisible, setSuccessModalVisible] = useState(false);
    const [successMessage, setSuccessMessage] = useState('');
    const [deferredPrompt, setDeferredPrompt] = useState(null);
    const [passwordStrength, setPasswordStrength] = useState(0);
    const [professions, setProfessions] = useState([]);

    useEffect(() => {
        const handleOnline = () => {
            setOnline(true);
            message.success('網絡已恢復！');
            logger.info('Network restored');
        };
        const handleOffline = () => {
            setOnline(false);
            message.warning('您已離線，表單數據將暫存，恢復網絡後可重新提交。');
            logger.warn('Network disconnected');
        };

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            setDeferredPrompt(e);
            logger.info('PWA install prompt available');
        });

        fetchProfessions();

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    const fetchProfessions = async () => {
        try {
            const res = await axios.get(`${BASE_URL}/api/professions`);
            setProfessions(res.data);
        } catch (err) {
            logger.error('Fetch professions error:', err);
            message.error('無法載入職業列表，請稍後重試');
        }
    };

    useEffect(() => {
        form.setFieldsValue({ world_name: '修連05' });
    }, [form]);

    const handlePasswordChange = (e) => {
        const password = e.target.value;
        const strength = getPasswordStrength(password);
        setPasswordStrength(strength);
    };

    const onFinish = async (values) => {
        if (!online) {
            localStorage.setItem('pendingRegistration', JSON.stringify(values));
            setErrorMessage('目前處於離線狀態，表單數據已暫存。請在恢復網絡後重新提交。');
            setErrorModalVisible(true);
            logger.warn('Registration attempted offline, data saved to localStorage', { values });
            return;
        }

        const formData = new FormData();
        formData.append('world_name', values.world_name);
        formData.append('character_name', values.character_name);
        formData.append('discord_id', values.discord_id || '');
        formData.append('raid_level', values.raid_level || 0);
        formData.append('password', values.password);
        formData.append('profession', values.profession);
        // 移除 roles 字段，後端會自動設置為 user
        if (fileList.length > 0) {
            formData.append('screenshot', fileList[0].originFileObj);
        }

        try {
            logger.info('Submitting registration with data:', values);
            const res = await axios.post(`${BASE_URL}/api/users/register`, formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            });
            logger.info('Registration response:', res.data);
            setRegisterResponse(res.data);
            setSuccessMessage('註冊成功，等待審核！');
            setSuccessModalVisible(true);
        } catch (err) {
            const errorMsg = err.response?.data?.msg || err.message || '註冊失敗，請稍後再試';
            setErrorMessage(errorMsg);
            setErrorModalVisible(true);
            logger.error('Register error:', err.response?.data || err);
        }
    };

    const handleSuccessModalOk = () => {
        setSuccessModalVisible(false);
        navigate('/login');
        form.resetFields();
        setFileList([]);
        setPasswordStrength(0);
        logger.info('Navigated to /login after successful registration');
    };

    const uploadProps = {
        onChange: ({ fileList: newFileList }) => {
            setFileList(newFileList.slice(-1));
            logger.info('File list updated:', newFileList);
        },
        beforeUpload: (file) => {
            const isImage = file.type.startsWith('image/');
            if (!isImage) {
                message.error('請上傳圖片文件（jpg、png 等）！');
                logger.warn('Invalid file type uploaded:', file.type);
                return false;
            }
            const isLt2M = file.size / 1024 / 1024 < 2;
            if (!isLt2M) {
                message.error('圖片大小必須小於 2MB！');
                logger.warn('File size too large:', file.size);
                return false;
            }
            return false;
        },
        fileList,
        maxCount: 1,
        listType: 'picture',
        showUploadList: {
            showPreviewIcon: true,
            showRemoveIcon: true,
        },
    };

    const handleInstallPWA = () => {
        if (deferredPrompt) {
            deferredPrompt.prompt();
            deferredPrompt.userChoice.then((choiceResult) => {
                if (choiceResult.outcome === 'accepted') {
                    logger.info('User accepted PWA install prompt');
                } else {
                    logger.info('User dismissed PWA install prompt');
                }
                setDeferredPrompt(null);
            });
        }
    };

    return (
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f0f2f5', padding: '0px' }}>
            <motion.div initial="hidden" animate="visible" variants={fadeIn} style={{ width: '100%', maxWidth: 400 }}>
                <Card
                    title={<Title level={3} style={{ margin: 0, textAlign: 'center', color: '#1890ff' }}>用戶註冊</Title>}
                    bordered={false}
                    style={{ boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)', borderRadius: '8px' }}
                    extra={
                        deferredPrompt && (
                            <Button type="link" onClick={handleInstallPWA}>
                                安裝應用
                            </Button>
                        )
                    }
                >
                    <Form form={form} name="register" onFinish={onFinish} layout="vertical">
                        <Form.Item
                            name="world_name"
                            label="世界名稱"
                            rules={[{ required: true, message: '請輸入世界名稱！' }]}
                        >
                            <Input placeholder="世界名稱" autoComplete="off" readOnly value="修連05" />
                        </Form.Item>
                        <Form.Item
                            name="character_name"
                            label="角色名稱"
                            rules={[
                                { required: true, message: '請輸入角色名稱！' },
                                { min: 2, message: '角色名稱至少 2 個字符！' },
                                { max: 20, message: '角色名稱最多 20 個字符！' },
                                { pattern: /^[a-zA-Z0-9\u4e00-\u9fa5]+$/, message: '角色名稱只能包含中文、字母和數字！' },
                            ]}
                        >
                            <Input placeholder="角色名稱" autoComplete="off" />
                        </Form.Item>
                        <Form.Item name="discord_id" label="Discord ID">
                            <Input placeholder="Discord ID" autoComplete="off" />
                        </Form.Item>
                        <Form.Item name="raid_level" label="討伐等級">
                            <InputNumber min={0} max={100} placeholder="討伐等級" style={{ width: '100%' }} autoComplete="off" />
                        </Form.Item>
                        <Form.Item
                            name="profession"
                            label="職業"
                            rules={[{ required: true, message: '請選擇職業！' }]}
                        >
                            <Select placeholder="選擇職業">
                                {professions.map(prof => (
                                    <Option key={prof._id} value={prof._id}>
                                        <Space>
                                            <img src={icons[prof.icon]} alt={prof.name} style={{ width: 24, height: 24 }} />
                                            <span>{prof.name}</span>
                                        </Space>
                                    </Option>
                                ))}
                            </Select>
                        </Form.Item>
                        <Form.Item
                            name="password"
                            label="密碼"
                            rules={[
                                { required: true, message: '請輸入密碼！' },
                                { min: 6, message: '密碼至少 6 個字符！' },
                                { max: 20, message: '密碼最多 20 個字符！' },
                            ]}
                        >
                            <Input.Password
                                placeholder="密碼"
                                autoComplete="off"
                                onChange={handlePasswordChange}
                            />
                        </Form.Item>
                        {passwordStrength > 0 && (
                            <Form.Item>
                                <Progress
                                    percent={passwordStrength}
                                    status={passwordStrength < 50 ? 'exception' : passwordStrength < 75 ? 'normal' : 'success'}
                                    showInfo={false}
                                    strokeColor={
                                        passwordStrength < 50
                                            ? '#ff4d4f'
                                            : passwordStrength < 75
                                                ? '#faad14'
                                                : '#52c41a'
                                    }
                                />
                                <Text type={passwordStrength < 50 ? 'danger' : passwordStrength < 75 ? 'warning' : 'success'}>
                                    密碼強度：{passwordStrength < 50 ? '弱' : passwordStrength < 75 ? '中' : '強'}
                                </Text>
                            </Form.Item>
                        )}
                        <Form.Item
                            name="confirmPassword"
                            label="確認密碼"
                            dependencies={['password']}
                            rules={[
                                { required: true, message: '請確認密碼！' },
                                ({ getFieldValue }) => ({
                                    validator(_, value) {
                                        if (!value || getFieldValue('password') === value) {
                                            return Promise.resolve();
                                        }
                                        return Promise.reject(new Error('兩次輸入的密碼不一致！'));
                                    },
                                }),
                            ]}
                        >
                            <Input.Password placeholder="確認密碼" autoComplete="off" />
                        </Form.Item>
                        <Form.Item name="screenshot" label="截圖（可選，上傳角色信息截圖）">
                            <Upload {...uploadProps}>
                                <Button icon={<UploadOutlined />}>上傳截圖（僅限1張，格式：jpg/png，小於2MB）</Button>
                            </Upload>
                        </Form.Item>
                        <Form.Item>
                            <Space direction="vertical" style={{ width: '100%' }}>
                                <Button
                                    type="primary"
                                    htmlType="submit"
                                    block
                                    style={{ height: '40px', fontSize: '16px', transition: 'all 0.3s' }}
                                    disabled={!online}
                                >
                                    提交
                                </Button>
                                {!online && (
                                    <Alert
                                        message="離線模式"
                                        description="目前處於離線模式，表單數據將在恢復網絡後提交。"
                                        type="warning"
                                        showIcon
                                    />
                                )}
                                <Button
                                    type="default"
                                    onClick={() => navigate('/login')}
                                    block
                                    style={{ height: '40px', fontSize: '16px', transition: 'all 0.3s' }}
                                >
                                    返回登錄
                                </Button>
                            </Space>
                        </Form.Item>
                    </Form>
                </Card>
            </motion.div>

            <Modal
                title={
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <CheckCircleOutlined style={{ color: '#52c41a', fontSize: '24px' }} />
                        <span>註冊成功</span>
                    </div>
                }
                open={successModalVisible}
                onOk={handleSuccessModalOk}
                onCancel={handleSuccessModalOk}
                okText="確認"
                cancelText="關閉"
                width={400}
                style={{ top: '20%' }}
            >
                <div style={{ padding: '10px 0', color: '#52c41a', fontSize: '16px' }}>
                    {successMessage}
                    {registerResponse?.user_id && (
                        <div>ID: {registerResponse.user_id}</div>
                    )}
                </div>
            </Modal>

            <Modal
                title={
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <ExclamationCircleOutlined style={{ color: '#ff4d4f', fontSize: '24px' }} />
                        <span>錯誤提示</span>
                    </div>
                }
                open={errorModalVisible}
                onOk={() => setErrorModalVisible(false)}
                onCancel={() => setErrorModalVisible(false)}
                okText="確認"
                cancelText="關閉"
                width={400}
                style={{ top: '20%' }}
            >
                <div style={{ padding: '10px 0', color: '#ff4d4f', fontSize: '16px' }}>
                    {errorMessage}
                </div>
            </Modal>

            <style jsx global>{`
                .ant-form-item-label > label {
                    font-weight: 500;
                    color: #595959;
                }
                .ant-input, .ant-input-number, .ant-input-password {
                    border-radius: 6px;
                    transition: all 0.3s;
                }
                .ant-input:focus, .ant-input-number:focus, .ant-input-password:focus {
                    border-color: #1890ff;
                    box-shadow: 0 0 0 2px rgba(24, 144, 255, 0.2);
                }
                .ant-upload-list-item {
                    border-radius: 6px;
                }
                .ant-upload-list-item img {
                    border-radius: 6px;
                }
                .ant-btn-primary {
                    background-color: #1890ff;
                    border-color: #1890ff;
                }
                .ant-btn-primary:hover, .ant-btn-primary:focus {
                    background-color: #40a9ff;
                    border-color: #40a9ff;
                }
                .ant-btn-default {
                    border-color: #d9d9d9;
                }
                .ant-btn-default:hover, .ant-btn-default:focus {
                    border-color: #1890ff;
                    color: #1890ff;
                }
                @media (max-width: 768px) {
                    .ant-form-item-label {
                        padding-bottom: 4px !important;
                    }
                    .ant-form-item {
                        margin-bottom: 16px !important;
                    }
                }
            `}</style>
        </div>
    );
};

export default Register;