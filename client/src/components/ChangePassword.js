import React, { useState, useEffect } from 'react';
import { Form, Input, Button, message, Typography } from 'antd';
import axios from 'axios';
import logger from '../utils/logger';
import { useNavigate } from 'react-router-dom';

const { Text } = Typography;
const BASE_URL = process.env.REACT_APP_API_URL || '';

const ChangePassword = () => {
    const [form] = Form.useForm();
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();
    const tempToken = localStorage.getItem('tempToken');

    // Retrieve character_name from sessionStorage
    const changePasswordState = sessionStorage.getItem('changePasswordState');
    const { character_name } = changePasswordState ? JSON.parse(changePasswordState) : { character_name: '未知用戶' };

    useEffect(() => {
        sessionStorage.removeItem('changePasswordState');
    }, []);

    // If tempToken is missing, redirect to login
    if (!tempToken) {
     
        message.error('請先登入！');
        navigate('/login');
        return null;
    }

    const handleSubmit = async (values) => {
        try {
            setLoading(true);
     
            const res = await axios.post(
                `${BASE_URL}/api/users/change-password`,
                {
                    newPassword: values.newPassword,
                },
                { headers: { 'x-auth-token': tempToken } }
            );
         
            message.success(res.data.msg || '密碼更改成功！');
            localStorage.removeItem('tempToken');
            setTimeout(() => {
                message.info('請使用新密碼重新登入');
                navigate('/login');
            }, 1000);
        } catch (err) {
            console.error('Change password error:', err);
         
            message.error('更改密碼失敗: ' + (err.response?.data?.msg || err.message));
            if (err.response?.status === 401 || err.response?.status === 403) {
                localStorage.removeItem('tempToken');
                navigate('/login');
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ maxWidth: 400, margin: '50px auto' }}>
            <h2>更改密碼</h2>
            <Text type="warning" style={{ display: 'block', marginBottom: 16 }}>
                您的初始密碼為用戶名（{character_name}），請更改密碼以繼續使用系統。
            </Text>
            <Form form={form} name="change-password" onFinish={handleSubmit}>
                <Form.Item
                    name="newPassword"
                    label="新密碼"
                    rules={[
                        { required: true, message: '請輸入新密碼！' },
                        { min: 6, message: '密碼至少6位！' },
                    ]}
                >
                    <Input.Password placeholder="輸入新密碼" />
                </Form.Item>
                <Form.Item
                    name="confirmPassword"
                    label="確認新密碼"
                    dependencies={['newPassword']}
                    rules={[
                        { required: true, message: '請再次輸入新密碼！' },
                        ({ getFieldValue }) => ({
                            validator(_, value) {
                                if (!value || getFieldValue('newPassword') === value) {
                                    return Promise.resolve();
                                }
                                return Promise.reject(new Error('兩次輸入的密碼不一致！'));
                            },
                        }),
                    ]}
                >
                    <Input.Password placeholder="再次輸入新密碼" />
                </Form.Item>
                <Form.Item>
                    <Button type="primary" htmlType="submit" block loading={loading}>
                        提交
                    </Button>
                </Form.Item>
            </Form>
        </div>
    );
};

export default ChangePassword;