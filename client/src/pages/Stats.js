import React, { useState, useEffect } from 'react';
import { Card, Row, Col, message, Table, Input, Button, Form, Statistic } from 'antd';
import { Bar, Pie } from 'react-chartjs-2';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    BarElement,
    Title,
    Tooltip,
    Legend,
    ArcElement,
} from 'chart.js';
import axios from 'axios';
import logger from '../utils/logger'; // 引入前端日誌工具

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement);

const BASE_URL = process.env.REACT_APP_API_URL || '';

const Stats = () => {
    const [stats, setStats] = useState({
        totalBossKills: 0,
        totalAuctions: 0,
        totalApplications: 0,
        totalDiamonds: 0,
        itemsAssigned: 0,
        itemsPending: 0,
        applicationSuccessRate: 0,
        auctionSuccessRate: 0,
        bossStats: [],
        userStats: [],
        pagination: { total: 0, page: 1, pageSize: 10 },
    });
    const [form] = Form.useForm();

    useEffect(() => {
        fetchStats({ page: 1, pageSize: 10 });
    }, []);

    const fetchStats = async (params = {}) => {
        try {
            const token = localStorage.getItem('token');
            if (!token) {
                message.error('請先登錄！');
                window.location.href = '/login';
                return;
            }
            const res = await axios.get(`${BASE_URL}/api/stats/summary`, {
                headers: { 'x-auth-token': token },
                params: { ...params },
            });
            setStats(prevStats => ({
                ...prevStats,
                ...res.data,
                bossStats: res.data.bossStats || [],
                userStats: res.data.userStats || [],
                pagination: res.data.pagination || { total: 0, page: 1, pageSize: 10 },
            }));
        } catch (err) {
            const errorMsg = err.response?.data?.msg || err.message || '載入統計數據失敗';
            message.error(errorMsg);
            if (err.response && (err.response.status === 401 || err.response.status === 403)) {
                localStorage.removeItem('token');
                window.location.href = '/login';
            }
        }
    };

    const onFinish = (values) => {
        fetchStats({ ...values, page: 1, pageSize: stats.pagination.pageSize });
    };

    const handleTableChange = (pagination) => {
        const currentValues = form.getFieldsValue();
        fetchStats({
            ...currentValues,
            page: pagination.current,
            pageSize: pagination.pageSize,
        });
    };

    const barData = {
        labels: stats.bossStats.map(stat => stat._id),
        datasets: [
            {
                label: '擊殺次數',
                data: stats.bossStats.map(stat => stat.count),
                backgroundColor: 'rgba(75, 192, 192, 0.6)',
                borderColor: 'rgba(75, 192, 192, 1)',
                borderWidth: 1,
            },
        ],
    };

    const pieData = {
        labels: ['擊殺', '競標', '申請'],
        datasets: [
            {
                data: [stats.totalBossKills, stats.totalAuctions, stats.totalApplications],
                backgroundColor: ['#36A2EB', '#FF6384', '#FFCE56'],
                hoverBackgroundColor: ['#36A2EB', '#FF6384', '#FFCE56'],
            },
        ],
    };

    const barOptions = {
        responsive: true,
        plugins: {
            legend: { position: 'top' },
            title: { display: true, text: '各首領擊殺統計' },
        },
        scales: {
            y: { beginAtZero: true, title: { display: true, text: '次數' } },
            x: { title: { display: true, text: '首領名稱' } },
        },
    };

    const pieOptions = {
        responsive: true,
        plugins: {
            legend: { position: 'right' },
            title: { display: true, text: '活動分佈' },
        },
    };

    const userColumns = [
        { title: '角色名稱', dataIndex: 'character_name', key: 'character_name' },
        { title: '申請次數', dataIndex: 'applicationCount', key: 'applicationCount' },
        { title: '競標次數', dataIndex: 'auctionCount', key: 'auctionCount' },
        { title: '獲得物品數', dataIndex: 'itemReceived', key: 'itemReceived' },
    ];

    return (
        <div style={{ maxWidth: 1000, margin: '50px auto' }}>
            <h2>統計報表</h2>
            <Row gutter={[16, 16]}>
                <Col span={6}>
                    <Statistic title="總擊殺次數" value={stats.totalBossKills} />
                </Col>
                <Col span={6}>
                    <Statistic title="總競標數" value={stats.totalAuctions} />
                </Col>
                <Col span={6}>
                    <Statistic title="總申請數" value={stats.totalApplications} />
                </Col>
                <Col span={6}>
                    <Statistic title="總鑽石收益" value={stats.totalDiamonds} />
                </Col>
            </Row>
            <Row gutter={[16, 16]} style={{ marginTop: 20 }}>
                <Col span={6}>
                    <Statistic title="已分配物品數" value={stats.itemsAssigned} />
                </Col>
                <Col span={6}>
                    <Statistic title="未分配物品數" value={stats.itemsPending} />
                </Col>
                <Col span={6}>
                    <Statistic title="申請成功率 (%)" value={stats.applicationSuccessRate} />
                </Col>
                <Col span={6}>
                    <Statistic title="競標成功率 (%)" value={stats.auctionSuccessRate} />
                </Col>
            </Row>
            <Row gutter={[16, 16]} style={{ marginTop: 20 }}>
                <Col span={12}>
                    <Bar data={barData} options={barOptions} />
                </Col>
                <Col span={12}>
                    <Pie data={pieData} options={pieOptions} />
                </Col>
            </Row>
            <div style={{ marginTop: 20 }}>
                <h3>用戶參與統計</h3>
                <Form form={form} onFinish={onFinish} layout="inline" style={{ marginBottom: 16 }}>
                    <Form.Item name="character_name" label="角色名稱">
                        <Input placeholder="輸入角色名稱" />
                    </Form.Item>
                    <Form.Item name="min_applications" label="最少申請次數">
                        <Input type="number" min={0} placeholder="0" style={{ width: 100 }} />
                    </Form.Item>
                    <Form.Item name="min_auctions" label="最少競標次數">
                        <Input type="number" min={0} placeholder="0" style={{ width: 100 }} />
                    </Form.Item>
                    <Form.Item>
                        <Button type="primary" htmlType="submit">
                            篩選
                        </Button>
                    </Form.Item>
                </Form>
                <Table
                    dataSource={stats.userStats}
                    columns={userColumns}
                    rowKey="_id"
                    bordered
                    pagination={{
                        current: stats.pagination.page,
                        pageSize: stats.pagination.pageSize,
                        total: stats.pagination.total,
                        showSizeChanger: true,
                        pageSizeOptions: ['10', '20', '50'],
                    }}
                    onChange={handleTableChange}
                    style={{ background: '#fafafa' }}
                    rowClassName={() => 'custom-row-height'}
                    components={{
                        header: {
                            cell: (props) => (
                                <th
                                    {...props}
                                    style={{
                                        background: '#1890ff',
                                        color: '#fff',
                                        fontWeight: 'bold',
                                    }}
                                />
                            ),
                        },
                    }}
                />
            </div>
            <style jsx>{`
        .custom-row-height {
          height: 50px;
        }
      `}</style>
        </div>
    );
};

export default Stats;