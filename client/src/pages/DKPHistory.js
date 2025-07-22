// pages/DKPHistory.js
import React, { useState, useEffect } from 'react';
import { Table, Tag } from 'antd';
import axios from 'axios';
import moment from 'moment';

const BASE_URL = process.env.REACT_APP_API_URL || '';

const DKPHistory = () => {
    const [records, setRecords] = useState([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        fetchRecords();
    }, []);

    const fetchRecords = async () => {
        setLoading(true);
        try {
            const res = await axios.get(`${BASE_URL}/api/dkp/records`, {
                headers: { 'x-auth-token': localStorage.getItem('token') },
            });
            setRecords(res.data);
        } catch (err) {
            console.error('Error fetching DKP records:', err);
        } finally {
            setLoading(false);
        }
    };

    const columns = [
        {
            title: '時間',
            dataIndex: 'createdAt',
            key: 'createdAt',
            render: (time) => moment(time).format('YYYY-MM-DD HH:mm:ss'),
        },
        {
            title: '類型',
            dataIndex: 'type',
            key: 'type',
            render: (type) => {
                const typeMap = {
                    participation: '參與',
                    supplement: '補單',
                    pickup: '撿取',
                    deduction: '扣除',
                    reclaim: '收回',
                };
                return typeMap[type] || type;
            },
        },
        {
            title: '點數變動',
            dataIndex: 'amount',
            key: 'amount',
            render: (amount) => (
                <Tag color={amount > 0 ? 'green' : 'red'}>
                    {amount > 0 ? '+' : ''}{amount}
                </Tag>
            ),
        },
        {
            title: '描述',
            dataIndex: 'description',
            key: 'description',
        },
    ];

    return (
        <div style={{ padding: '20px' }}>
            <h2>DKP 點數歷史記錄</h2>
            <Table
                columns={columns}
                dataSource={records}
                rowKey="_id"
                loading={loading}
            />
        </div>
    );
};

export default DKPHistory;