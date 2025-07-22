// pages/DKPSettings.js
import React, { useState, useEffect } from 'react';
import { Table, Button, Input, message, Select, Modal, Form, Space } from 'antd';
import axios from 'axios';

const { Option } = Select;

const BASE_URL = process.env.REACT_APP_API_URL || '';

const DKPSettings = () => {
    const [settings, setSettings] = useState([]);
    const [bosses, setBosses] = useState([]); // 儲存所有 Boss 記錄
    const [loading, setLoading] = useState(false);
    const [selectedBossId, setSelectedBossId] = useState(null); // 選擇的 Boss ID
    const [dkpPoints, setDkpPoints] = useState('');
    const [editModalVisible, setEditModalVisible] = useState(false);
    const [editingSetting, setEditingSetting] = useState(null);
    const [form] = Form.useForm();

    useEffect(() => {
        fetchBosses();
        fetchSettings();
    }, []);

    // 獲取所有 Boss 記錄
    const fetchBosses = async () => {
        try {
            const res = await axios.get(`${BASE_URL}/api/bosses`, {
                headers: { 'x-auth-token': localStorage.getItem('token') },
            });
            setBosses(res.data);
        } catch (err) {
            message.error('無法獲取 Boss 列表');
        }
    };

    // 獲取所有 DKP 設定
    const fetchSettings = async () => {
        setLoading(true);
        try {
            const res = await axios.get(`${BASE_URL}/api/dkp`, {
                headers: { 'x-auth-token': localStorage.getItem('token') },
            });
            setSettings(res.data);
        } catch (err) {
            message.error('無法獲取 DKP 設定');
        } finally {
            setLoading(false);
        }
    };

    // 創建 DKP 設定
    const handleCreate = async () => {
        if (!selectedBossId || !dkpPoints || isNaN(dkpPoints) || dkpPoints < 0) {
            message.error('請選擇 Boss 並輸入有效的 DKP 點數（非負數）');
            return;
        }

        try {
            await axios.post(`${BASE_URL}/api/dkp`, {
                bossId: selectedBossId,
                dkpPoints: parseInt(dkpPoints),
            }, {
                headers: { 'x-auth-token': localStorage.getItem('token') },
            });
            message.success('DKP 設定創建成功');
            setSelectedBossId(null);
            setDkpPoints('');
            fetchSettings();
        } catch (err) {
            message.error('創建 DKP 設定失敗');
        }
    };

    // 打開編輯 Modal
    const handleEdit = (setting) => {
        setEditingSetting(setting);
        form.setFieldsValue({
            dkpPoints: setting.dkpPoints,
        });
        setEditModalVisible(true);
    };

    // 更新 DKP 設定
    const handleUpdate = async () => {
        try {
            const values = await form.validateFields();
            if (values.dkpPoints < 0) {
                message.error('DKP 點數不能為負數');
                return;
            }

            await axios.put(`${BASE_URL}/api/dkp/${editingSetting._id}`, {
                dkpPoints: parseInt(values.dkpPoints),
            }, {
                headers: { 'x-auth-token': localStorage.getItem('token') },
            });
            message.success('DKP 設定更新成功');
            setEditModalVisible(false);
            fetchSettings();
        } catch (err) {
            message.error('更新 DKP 設定失敗');
        }
    };

    // 刪除 DKP 設定
    const handleDelete = async (settingId) => {
        try {
            await axios.delete(`${BASE_URL}/api/dkp/${settingId}`, {
                headers: { 'x-auth-token': localStorage.getItem('token') },
            });
            message.success('DKP 設定刪除成功');
            fetchSettings();
        } catch (err) {
            message.error('刪除 DKP 設定失敗');
        }
    };

    const columns = [
        {
            title: 'Boss 名稱',
            dataIndex: ['bossId', 'name'],
            key: 'bossName',
        },
        {
            title: 'DKP 點數',
            dataIndex: 'dkpPoints',
            key: 'dkpPoints',
        },
        {
            title: '操作',
            key: 'actions',
            render: (_, record) => (
                <Space>
                    <Button type="link" onClick={() => handleEdit(record)}>
                        編輯
                    </Button>
                    <Button type="link" danger onClick={() => handleDelete(record._id)}>
                        刪除
                    </Button>
                </Space>
            ),
        },
    ];

    return (
        <div style={{ padding: '20px' }}>
            <h2>DKP 設定</h2>
            <div style={{ marginBottom: '20px' }}>
                <Select
                    placeholder="選擇 Boss"
                    value={selectedBossId}
                    onChange={(value) => setSelectedBossId(value)}
                    style={{ width: '200px', marginRight: '10px' }}
                >
                    {bosses.map(boss => (
                        <Option key={boss._id} value={boss._id}>
                            {boss.name}
                        </Option>
                    ))}
                </Select>
                <Input
                    placeholder="DKP 點數"
                    value={dkpPoints}
                    onChange={(e) => setDkpPoints(e.target.value)}
                    style={{ width: '100px', marginRight: '10px' }}
                />
                <Button type="primary" onClick={handleCreate}>
                    創建
                </Button>
            </div>
            <Table
                columns={columns}
                dataSource={settings}
                rowKey="_id"
                loading={loading}
            />

            <Modal
                title="編輯 DKP 設定"
                open={editModalVisible}
                onOk={handleUpdate}
                onCancel={() => setEditModalVisible(false)}
                okText="保存"
                cancelText="取消"
            >
                <Form form={form} layout="vertical">
                    <Form.Item
                        name="dkpPoints"
                        label="DKP 點數"
                        rules={[{ required: true, message: '請輸入 DKP 點數' }]}
                    >
                        <Input type="number" min={0} />
                    </Form.Item>
                </Form>
            </Modal>
        </div>
    );
};

export default DKPSettings;