import React, { useState, useEffect } from 'react';
import { Card, Spin, Alert, Row, Col, Button, Modal, Form, Input, DatePicker, Select, Radio, message } from 'antd';
import { Bar, Pie } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, ArcElement, Title, Tooltip, Legend } from 'chart.js';
import { Popconfirm } from 'antd';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import moment from 'moment-timezone'; // 使用 moment-timezone
import logger from '../utils/logger';

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Title, Tooltip, Legend);

const BASE_URL = process.env.REACT_APP_API_URL || '';
const token = localStorage.getItem('token');

const { Option } = Select;
const { TextArea } = Input;

const VoteResults = () => {
    const [votes, setVotes] = useState([]);
    const [selectedVote, setSelectedVote] = useState(null);
    const [loading, setLoading] = useState(false);
    const [chartData, setChartData] = useState(null);
    const [chartType, setChartType] = useState('bar');
    const [role, setRole] = useState(null);
    const [createModalVisible, setCreateModalVisible] = useState(false);
    const [editModalVisible, setEditModalVisible] = useState(false);
    const [form] = Form.useForm();
    const [editForm] = Form.useForm();
    const navigate = useNavigate();

    useEffect(() => {
        if (!token) {
            message.error('請先登入以查看投票結果！');
            navigate('/login');
            return;
        }
        fetchUserInfo();
        fetchVotes();
    }, [navigate]);

    const fetchUserInfo = async () => {
        try {
            const res = await axios.get(`${BASE_URL}/api/users/me`, {
                headers: { 'x-auth-token': token },
            });
            setRole(res.data.roles && res.data.roles.length > 0 ? res.data.roles[0] : null);
        } catch (err) {
            logger.error('Fetch user info error:', err);
            message.error('載入用戶信息失敗');
        }
    };

    const fetchVotes = async () => {
        try {
            setLoading(true);
            const res = await axios.get(`${BASE_URL}/api/votes`, {
                headers: { 'x-auth-token': token },
            });
            setVotes(res.data);
        } catch (err) {
            logger.error('Fetch votes error:', err);
            message.error('載入投票列表失敗');
        } finally {
            setLoading(false);
        }
    };

    const fetchVoteResults = async (voteId) => {
        try {
            setLoading(true);
            const res = await axios.get(`${BASE_URL}/api/votes/${voteId}/results`, {
                headers: { 'x-auth-token': token },
            });
            const vote = res.data;

            const labels = vote.options.map(option => option.text);
            const data = vote.options.map(option => option.votes);
            const backgroundColors = [
                'rgba(255, 99, 132, 0.6)',
                'rgba(54, 162, 235, 0.6)',
                'rgba(255, 206, 86, 0.6)',
                'rgba(75, 192, 192, 0.6)',
                'rgba(153, 102, 255, 0.6)',
            ];

            setChartData({
                labels,
                datasets: [{
                    label: '票數',
                    data,
                    backgroundColor: backgroundColors.slice(0, labels.length),
                    borderColor: backgroundColors.slice(0, labels.length).map(color => color.replace('0.6', '1')),
                    borderWidth: 1,
                }],
            });
            setSelectedVote(vote);
        } catch (err) {
            logger.error('Fetch vote results error:', err);
            message.error(`載入投票結果失敗: ${err.response?.data?.msg || err.message}`);
        } finally {
            setLoading(false);
        }
    };

    const handleChartTypeChange = (type) => {
        setChartType(type);
    };

    const chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        aspectRatio: 1.5,
        plugins: {
            legend: { position: 'top' },
            title: {
                display: true,
                text: selectedVote ? `${selectedVote.title} - 結果` : '投票結果',
            },
        },
        layout: {
            padding: {
                left: 10,
                right: 10,
                top: 10,
                bottom: 10,
            },
        },
        scales: {
            x: { ticks: { font: { size: 12 } } },
            y: { beginAtZero: true, ticks: { font: { size: 12 } } },
        },
    };

    const handleCreateVote = async (values) => {
        try {
            const { title, options, startTime, endTime, multipleChoice, participantIds } = values;
            await axios.post(
                `${BASE_URL}/api/votes/create`,
                {
                    title,
                    options: options.split('\n').filter(opt => opt.trim()),
                    startTime: startTime.format('YYYY-MM-DD HH:mm'),
                    endTime: endTime.format('YYYY-MM-DD HH:mm'),
                    multipleChoice,
                    participantIds,
                },
                { headers: { 'x-auth-token': token } }
            );
            message.success('投票創建成功');
            setCreateModalVisible(false);
            form.resetFields();
            fetchVotes();
        } catch (err) {
            logger.error('Create vote error:', err);
            message.error(`創建投票失敗: ${err.response?.data?.msg || err.message}`);
        }
    };

    const handleUpdateVote = async (values) => {
        try {
            const { voteId, title, options, startTime, endTime, multipleChoice, participantIds } = values;
            await axios.put(
                `${BASE_URL}/api/votes/${voteId}`,
                {
                    title,
                    options: options.split('\n').filter(opt => opt.trim()),
                    startTime: startTime.format('YYYY-MM-DD HH:mm'),
                    endTime: endTime.format('YYYY-MM-DD HH:mm'),
                    multipleChoice,
                    participantIds,
                },
                { headers: { 'x-auth-token': token } }
            );
            message.success('投票更新成功');
            setEditModalVisible(false);
            editForm.resetFields();
            fetchVotes();
            if (selectedVote && selectedVote._id === voteId) fetchVoteResults(voteId);
        } catch (err) {
            logger.error('Update vote error:', err);
            message.error(`更新投票失敗: ${err.response?.data?.msg || err.message}`);
        }
    };

    const handleDeleteVote = async (voteId) => {
        try {
            await axios.delete(`${BASE_URL}/api/votes/${voteId}`, {
                headers: { 'x-auth-token': token },
            });
            message.success('投票刪除成功');
            setSelectedVote(null);
            setChartData(null);
            fetchVotes();
        } catch (err) {
            logger.error('Delete vote error:', err);
            message.error(`刪除投票失敗: ${err.response?.data?.msg || err.message}`);
        }
    };

    const showEditModal = (vote) => {
        if (vote.votes.length > 0 || moment.tz('Asia/Taipei').isAfter(vote.endTime) || vote.status === 'closed') {
            message.warning('已有成員投票或投票已過期，無法修改');
            return;
        }
        editForm.setFieldsValue({
            voteId: vote._id,
            title: vote.title,
            options: vote.options.map(opt => opt.text).join('\n'),
            startTime: moment(vote.startTime),
            endTime: moment(vote.endTime),
            multipleChoice: vote.multipleChoice,
            participantIds: vote.participants,
        });
        setEditModalVisible(true);
    };

    const [members, setMembers] = useState([]);

    useEffect(() => {
        const fetchMembers = async () => {
            try {
                const res = await axios.get(`${BASE_URL}/api/users/guild-members`, {
                    headers: { 'x-auth-token': token },
                });
                setMembers(res.data);
            } catch (err) {
                logger.error('Fetch members error:', err);
                message.error('載入旅團成員列表失敗');
            }
        };
        if (role === 'admin') fetchMembers();
    }, [role]);

    return (
        <div style={{ padding: '20px', backgroundColor: '#f0f2f5' }}>
            <Card
                title={<h2 style={{ margin: 0, fontSize: '24px', color: '#1890ff' }}>投票結果</h2>}
                bordered={false}
                style={{ boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)', borderRadius: '8px' }}
                extra={role === 'admin' && (
                    <Button type="primary" onClick={() => setCreateModalVisible(true)}>
                        創建投票
                    </Button>
                )}
            >
                <Spin spinning={loading} size="large">
                    {votes.length === 0 ? (
                        <Alert
                            message="無數據"
                            description="目前沒有可用的投票記錄。"
                            type="info"
                            showIcon
                            style={{ marginBottom: '16px' }}
                        />
                    ) : (
                        <>
                            <Row gutter={[16, 16]} style={{ marginBottom: '16px' }}>
                                {votes.map(vote => (
                                    <Col key={vote._id}>
                                        <Card
                                            hoverable
                                            onClick={() => fetchVoteResults(vote._id)}
                                            style={{ width: 300, cursor: 'pointer' }}
                                            actions={role === 'admin' && vote.votes.length === 0 && moment.tz('Asia/Taipei').isBefore(vote.endTime) && vote.status === 'active' && [
                                                <Button type="link" onClick={(e) => { e.stopPropagation(); showEditModal(vote); }}>
                                                    編輯
                                                </Button>,
                                                <Popconfirm
                                                    title="確認刪除此投票？"
                                                    onConfirm={(e) => { e.stopPropagation(); handleDeleteVote(vote._id); }}
                                                    okText="是"
                                                    cancelText="否"
                                                >
                                                    <Button type="link" danger>
                                                        刪除
                                                    </Button>
                                                </Popconfirm>,
                                            ]}
                                        >
                                            <Card.Meta
                                                title={vote.title}
                                                description={
                                                    <>
                                                        <p>開始時間: {moment(vote.startTime).format('YYYY-MM-DD HH:mm')}</p>
                                                        <p>結束時間: {moment(vote.endTime).format('YYYY-MM-DD HH:mm')}</p>
                                                        <p>狀態: {vote.status === 'active' ? '進行中' : '已結束'}</p>
                                                    </>
                                                }
                                            />
                                        </Card>
                                    </Col>
                                ))}
                            </Row>
                            {selectedVote && chartData && (
                                <div>
                                    <Row justify="center" style={{ marginBottom: '16px' }}>
                                        <Col>
                                            <Button
                                                onClick={() => handleChartTypeChange('bar')}
                                                type={chartType === 'bar' ? 'primary' : 'default'}
                                            >
                                                柱狀圖
                                            </Button>
                                            <Button
                                                onClick={() => handleChartTypeChange('pie')}
                                                type={chartType === 'pie' ? 'primary' : 'default'}
                                                style={{ marginLeft: '8px' }}
                                            >
                                                圓形圖
                                            </Button>
                                        </Col>
                                    </Row>
                                    <Card style={{ maxWidth: '600px', margin: '0 auto', marginBottom: '16px' }}>
                                        <div style={{ height: '300px' }}>
                                            {chartType === 'bar' ? (
                                                <Bar data={chartData} options={chartOptions} />
                                            ) : (
                                                <Pie data={chartData} options={chartOptions} />
                                            )}
                                        </div>
                                    </Card>
                                    <p>總票數: {selectedVote.totalVotes}</p>
                                    <p>狀態: {selectedVote.status === 'active' ? '進行中' : '已結束'}</p>
                                </div>
                            )}
                        </>
                    )}
                </Spin>
            </Card>

            <Modal
                title="創建投票"
                visible={createModalVisible}
                onOk={() => form.submit()}
                onCancel={() => setCreateModalVisible(false)}
                okText="提交"
                cancelText="取消"
            >
                <Form form={form} onFinish={handleCreateVote} layout="vertical">
                    <Form.Item name="title" label="投票主題" rules={[{ required: true, message: '請輸入投票主題' }]}>
                        <Input />
                    </Form.Item>
                    <Form.Item name="options" label="選項（每行一個）" rules={[{ required: true, message: '請輸入至少兩個選項' }]}>
                        <TextArea placeholder="每行一個選項" autoSize={{ minRows: 3, maxRows: 6 }} />
                    </Form.Item>
                    <Form.Item name="startTime" label="開始時間" rules={[{ required: true, message: '請選擇開始時間' }]}>
                        <DatePicker showTime format="YYYY-MM-DD HH:mm" style={{ width: '100%' }} />
                    </Form.Item>
                    <Form.Item name="endTime" label="結束時間" rules={[{ required: true, message: '請選擇結束時間' }]}>
                        <DatePicker showTime format="YYYY-MM-DD HH:mm" style={{ width: '100%' }} />
                    </Form.Item>
                    <Form.Item name="multipleChoice" label="允許多選" valuePropName="checked" initialValue={false}>
                        <Radio.Group>
                            <Radio value={true}>是</Radio>
                            <Radio value={false}>否</Radio>
                        </Radio.Group>
                    </Form.Item>
                    <Form.Item name="participantIds" label="參與者（可選）">
                        <Select mode="multiple" placeholder="選擇參與者" style={{ width: '100%' }}>
                            {members.map(member => (
                                <Option key={member._id} value={member._id}>
                                    {member.character_name}
                                </Option>
                            ))}
                        </Select>
                    </Form.Item>
                </Form>
            </Modal>

            <Modal
                title="編輯投票"
                visible={editModalVisible}
                onOk={() => editForm.submit()}
                onCancel={() => setEditModalVisible(false)}
                okText="提交"
                cancelText="取消"
            >
                <Form form={editForm} onFinish={handleUpdateVote} layout="vertical">
                    <Form.Item name="voteId" hidden>
                        <Input />
                    </Form.Item>
                    <Form.Item name="title" label="投票主題" rules={[{ required: true, message: '請輸入投票主題' }]}>
                        <Input />
                    </Form.Item>
                    <Form.Item name="options" label="選項（每行一個）" rules={[{ required: true, message: '請輸入至少兩個選項' }]}>
                        <TextArea placeholder="每行一個選項" autoSize={{ minRows: 3, maxRows: 6 }} />
                    </Form.Item>
                    <Form.Item name="startTime" label="開始時間" rules={[{ required: true, message: '請選擇開始時間' }]}>
                        <DatePicker showTime format="YYYY-MM-DD HH:mm" style={{ width: '100%' }} />
                    </Form.Item>
                    <Form.Item name="endTime" label="結束時間" rules={[{ required: true, message: '請選擇結束時間' }]}>
                        <DatePicker showTime format="YYYY-MM-DD HH:mm" style={{ width: '100%' }} />
                    </Form.Item>
                    <Form.Item name="multipleChoice" label="允許多選" valuePropName="checked">
                        <Radio.Group>
                            <Radio value={true}>是</Radio>
                            <Radio value={false}>否</Radio>
                        </Radio.Group>
                    </Form.Item>
                    <Form.Item name="participantIds" label="參與者（可選）">
                        <Select mode="multiple" placeholder="選擇參與者" style={{ width: '100%' }}>
                            {members.map(member => (
                                <Option key={member._id} value={member._id}>
                                    {member.character_name}
                                </Option>
                            ))}
                        </Select>
                    </Form.Item>
                </Form>
            </Modal>
        </div>
    );
};

export default VoteResults;