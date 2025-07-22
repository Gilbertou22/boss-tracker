// pages/MenuLogs.js
import React, { useState, useEffect } from 'react';
import { Table, Card, Spin, Alert, message } from 'antd';
import axios from 'axios';
import moment from 'moment';

const BASE_URL = process.env.REACT_APP_API_URL || '';

const MenuLogs = () => {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const fetchLogs = async () => {
            setLoading(true);
            try {
                const res = await axios.get(`${BASE_URL}/api/menu/logs`, {
                    headers: { 'x-auth-token': localStorage.getItem('token') },
                });
                setLogs(res.data);
            } catch (err) {
                message.error('載入操作歷史失敗');
            } finally {
                setLoading(false);
            }
        };
        fetchLogs();
    }, []);

    const columns = [
        { title: '操作', dataIndex: 'action', key: 'action' },
        { title: '菜單項 ID', dataIndex: 'menuItemId', key: 'menuItemId' },
        { title: '操作用戶', dataIndex: 'userId', key: 'userId' },
        { title: '詳情', dataIndex: 'details', key: 'details', render: details => JSON.stringify(details) },
        { title: '時間', dataIndex: 'createdAt', key: 'createdAt', render: time => moment(time).format('YYYY-MM-DD HH:mm:ss') },
    ];

    return (
        <div style={{ padding: '20px', backgroundColor: '#f0f2f5', minHeight: 'calc(100vh - 64px)', paddingTop: '84px', boxSizing: 'border-box' }}>
            <Card title="操作歷史" style={{ boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)', borderRadius: '12px' }}>
                <Spin spinning={loading}>
                    <Table
                        dataSource={logs}
                        columns={columns}
                        rowKey="_id"
                        bordered
                        scroll={{ x: 'max-content' }}
                    />
                </Spin>
            </Card>
        </div>
    );
};

export default MenuLogs;