import React, { useState, useEffect } from 'react';
import { Form, Input, Button, message, Card, Spin, Typography } from 'antd';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { loadCaptchaEnginge, LoadCanvasTemplate, validateCaptcha } from 'react-simple-captcha';
import { useAuth } from '../AuthProvider';
import logger from '../utils/logger';

const { Text } = Typography;

const BASE_URL = process.env.REACT_APP_API_URL || '';

const Login = () => {
    const [form] = Form.useForm();
    const [loading, setLoading] = useState(false);
    const [clientIp, setClientIp] = useState('正在獲取...');
    const navigate = useNavigate();
    const { login, user } = useAuth();
    const [isLoggedIn, setIsLoggedIn] = useState(false);

    useEffect(() => {
        const fetchClientIp = async () => {
            try {
                const res = await axios.get(`${BASE_URL}/api/auth/client-ip`, {
                    withCredentials: true,
                });
                setClientIp(res.data.ip);
            } catch (err) {
                logger.error('Fetch client IP error:', {
                    message: err.message,
                    response: err.response?.data,
                });
                setClientIp('無法獲取 IP');
            }
        };

        fetchClientIp();
        loadCaptchaEnginge(4, 'white', 'black', 'lower'); // Initialize CAPTCHA with 6 characters
    }, []);

    useEffect(() => {
        if (user) {
            navigate('/', { replace: true });
        }
    }, [user, navigate]);

    const handleSubmit = async () => {
        if (isLoggedIn) {
            return;
        }

        try {
            const values = await form.validateFields();
            const captchaInput = values.captcha_input?.trim();

            if (!captchaInput) {
                message.error('請輸入驗證碼！');
                return;
            }

            // Client-side CAPTCHA validation
            if (!validateCaptcha(captchaInput)) {
                message.error('驗證碼錯誤，請重試！');
                loadCaptchaEnginge(4, 'white', 'black', 'lower');
                form.setFieldsValue({ captcha_input: '' });
                return;
            }

            setLoading(true);

            const trimmedValues = {
                character_name: values.character_name.trim(),
                password: values.password.trim(),
                captcha_input: captchaInput,
            };

            if (!trimmedValues.character_name || !trimmedValues.password) {
                message.error('角色名稱和密碼不能為空！');
                setLoading(false);
                return;
            }

            const res = await axios.post(`${BASE_URL}/api/auth/login`, trimmedValues, {
                withCredentials: true,
            });

            if (res.data.mustChangePassword) {
                message.warning('請更改您的密碼！');
                localStorage.setItem('tempToken', res.data.tempToken);
                window.location.href = '/change-password';
                sessionStorage.setItem('changePasswordState', JSON.stringify({ character_name: trimmedValues.character_name }));
                return;
            }

            const { token, user } = res.data;
            setIsLoggedIn(true);
            await login(user, token);
            form.resetFields();
            loadCaptchaEnginge(4, 'white', 'black', 'lower');
            message.success('登入成功');
        } catch (err) {
            if (err.errorFields) {
                message.error('請檢查表單欄位！');
            } else {
                const errorMsg = err.response?.data?.msg || '登入失敗，請稍後再試';
                logger.error('Login error:', {
                    message: err.message,
                    response: err.response?.data,
                    status: err.response?.status,
                });
                message.error(errorMsg);
                loadCaptchaEnginge(4, 'white', 'black', 'lower');
                form.setFieldsValue({ captcha_input: '' });
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="login-container">
            <Spin spinning={loading} tip="正在登入...">
                <Card>
                    <Form
                        form={form}
                        onFinish={handleSubmit}
                        layout="vertical"
                        initialValues={{
                            character_name: '',
                            password: '',
                            captcha_input: '',
                        }}
                    >
                        <Form.Item
                            name="character_name"
                            label="角色名稱"
                            rules={[
                                { required: true, message: '請輸入角色名稱！' },
                                {
                                    pattern: /^[a-zA-Z0-9_\u4e00-\u9fa5]+$/,
                                    message: '角色名稱只能包含字母、數字、下劃線和中文！',
                                },
                            ]}
                        >
                            <Input placeholder="請輸入角色名稱" disabled={loading || isLoggedIn} />
                        </Form.Item>
                        <Form.Item
                            name="password"
                            label="密碼"
                            rules={[
                                { required: true, message: '請輸入密碼！' },
                               
                            ]}
                        >
                            <Input.Password placeholder="請輸入密碼" disabled={loading || isLoggedIn} />
                        </Form.Item>
                        <Form.Item
                            name="captcha_input"
                            label="驗證碼"
                            rules={[{ required: true, message: '請輸入驗證碼！' }]}
                        >
                            <div>
                                <LoadCanvasTemplate reloadText="看不清" />
                                <Input
                                    placeholder="請輸入驗證碼"
                                    style={{ marginTop: 8 }}
                                    disabled={loading || isLoggedIn}
                                />
                            </div>
                        </Form.Item>
                        <Form.Item>
                            <Button
                                type="primary"
                                htmlType="submit"
                                loading={loading}
                                block
                                className="login-button"
                                disabled={loading || isLoggedIn}
                            >
                                登入
                            </Button>
                        </Form.Item>
                        <Text type="secondary" style={{ display: 'block', textAlign: 'center', marginTop: '10px' }}>
                            您目前的 IP 為 {clientIp}
                        </Text>
                    </Form>
                </Card>
            </Spin>
            <style jsx global>{`
                .login-container {
                    display: flex;
                    justify-content: center;
                    align-items: flex-start;
                    padding: 1px;
                    margin-top: 50px;
                }
                .login-card {
                    width: 100%;
                    max-width: 400px;
                    border-radius: 10px;
                    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
                    animation: fadeIn 0.5s ease-in-out;
                }
                .ant-form-item {
                    margin-bottom: 16px;
                }
                .ant-form-item-label > label {
                    color: #595959;
                    font-weight: 500;
                }
                .ant-input, .ant-input-password {
                    border-radius: 6px;
                    transition: all 0.3s;
                }
                .ant-input:focus, .ant-input-password:focus {
                    border-color: #40c4ff;
                    box-shadow: 0 0 0 2px rgba(64, 196, 255, 0.2);
                }
                .login-button {
                    border-radius: 6px;
                    height: 40px;
                    font-size: 16px;
                    transition: all 0.3s;
                }
                .login-button:hover {
                    transform: scale(1.05);
                    background-color: #40c4ff;
                    border-color: #40c4ff;
                }
                @keyframes fadeIn {
                    0% {
                        opacity: 0;
                        transform: translateY(20px);
                    }
                    100% {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }
                @media (max-width: 576px) {
                    .login-container {
                        margin-top: 20px;
                    }
                    .login-card {
                        max-width: 100%;
                        margin: 0 10px;
                    }
                }
            `}</style>
        </div>
    );
};

export default Login;