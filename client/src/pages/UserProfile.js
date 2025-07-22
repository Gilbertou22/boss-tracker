import React, { useState, useEffect } from 'react';
import { Modal, Form, Input, InputNumber, Button, message, Spin } from 'antd';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import logger from '../utils/logger'; // 引入前端日誌工具

const { TextArea } = Input;
const BASE_URL = process.env.REACT_APP_API_URL || '';

const UserProfile = ({ visible, onCancel }) => {
    const [form] = Form.useForm();
    const [loading, setLoading] = useState(false);
    const token = localStorage.getItem('token');
    const navigate = useNavigate();



    // 僅在模態窗口可見時執行
    useEffect(() => {
        if (!visible) return;

        const fetchUserProfile = async () => {
            if (!token) {

                return; // 不執行重定向
            }

            try {
                setLoading(true);
                const res = await axios.get(`${BASE_URL}/api/users/profile`, {
                    headers: { 'x-auth-token': token },
                });

                form.setFieldsValue({
                    world_name: res.data.world_name,
                    character_name: res.data.character_name,
                    discord_id: res.data.discord_id || '',
                    raid_level: res.data.raid_level || 0,
                });
            } catch (err) {

                console.error('Fetch user profile error:', {
                    status: err.response?.status,
                    data: err.response?.data,
                    message: err.message,
                });
                if (err.response?.status === 401 || err.response?.status === 403 || err.response?.status === 404 || err.response?.status === 500) {
                    message.error('請求失敗，請重新登入或檢查服務器:', err.response?.data?.msg);
                    // 僅在模態窗口可見時重定向
                    if (visible) {
                        navigate('/login');
                    }
                } else {
                    message.error(`載入用戶資料失敗: ${err.response?.data?.msg || err.message}`);
                }
            } finally {
                setLoading(false);
            }
        };

        fetchUserProfile();
    }, [visible, token, navigate]);

    const onFinish = async (values) => {
        try {
            setLoading(true);
            const { character_name, ...submitValues } = values;

            const config = {
                headers: { 'x-auth-token': token },
                timeout: 5000,
            };
            const res = await axios.put(`${BASE_URL}/api/users/profile`, submitValues, config);

            alert('用戶資料更新成功');
            onCancel();
        } catch (err) {
            console.error('Update error:', {
                status: err.response?.status,
                data: err.response?.data,
                message: err.message,
                config: err.config,
            });
            if (err.response?.status === 403) {
                message.error('權限不足，請檢查後端日志:', err.response?.data?.msg);
                if (visible) navigate('/login');
            } else if (err.response?.status === 401 || err.response?.status === 404 || err.response?.status === 500) {
                message.error('請求失敗，請重新登入或檢查服務器:', err.response?.data?.msg);
                if (visible) navigate('/login');
            } else if (err.code === 'ECONNABORTED') {
                message.error('請求超時，請稍後重試');
            } else {
                message.error(`更新失敗: ${err.response?.data?.msg || err.message}`);
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal
            title="修改個人資料"
            open={visible}
            onOk={() => form.submit()}
            onCancel={onCancel}
            footer={[
                <Button key="cancel" onClick={onCancel}>
                    取消
                </Button>,
                <Button key="submit" type="primary" onClick={() => form.submit()} loading={loading}>
                    保存
                </Button>,
            ]}
            destroyOnClose
        >
            <Spin spinning={loading}>
                <Form form={form} name="userProfile" onFinish={onFinish} layout="vertical">
                    <Form.Item name="world_name" label="世界名稱" rules={[{ required: true, message: '請輸入世界名稱！' }]}>
                        <Input />
                    </Form.Item>
                    <Form.Item name="character_name" label="角色名稱" rules={[{ required: true, message: '請輸入角色名稱！' }]}>
                        <Input disabled />
                    </Form.Item>
                    <Form.Item name="discord_id" label="Discord ID">
                        <Input />
                    </Form.Item>
                    <Form.Item name="raid_level" label="討伐等級" initialValue={0}>
                        <InputNumber style={{ width: '100%' }} />
                    </Form.Item>
                </Form>
            </Spin>
        </Modal>
    );
};

export default UserProfile;