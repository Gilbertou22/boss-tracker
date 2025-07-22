import React, { useState, useEffect, useRef } from 'react';
import { Card, Spin, Alert, Row, Col, Button, Form, Select, message, Modal } from 'antd';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import moment from 'moment';
import logger from '../utils/logger';

const { Option } = Select;

const BASE_URL = process.env.REACT_APP_API_URL || '';
const token = localStorage.getItem('token');

const VotePage = () => {
    const [votes, setVotes] = useState([]);
    const [selectedVote, setSelectedVote] = useState(null);
    const [loading, setLoading] = useState(true); // 初始為 true
    const [initialLoadComplete, setInitialLoadComplete] = useState(false); // 跟踪初次加載
    const [form] = Form.useForm();
    const navigate = useNavigate();
    const [voteSuccessModalVisible, setVoteSuccessModalVisible] = useState(false);
    const isInitialMount = useRef(true); // 使用 useRef 跟踪初次掛載

    useEffect(() => {
        if (!token) {
            message.error('請先登入以參與投票！');
            navigate('/login');
            return;
        }
        // 僅在初次掛載時執行 fetchVotes
        if (isInitialMount.current) {
            fetchVotes();
            isInitialMount.current = false;
        }
    }, [navigate, token]); // 包含 token 作為依賴

    const fetchVotes = async () => {
        setLoading(true);
        try {
            const res = await axios.get(`${BASE_URL}/api/votes`, {
                headers: { 'x-auth-token': token },
            });
          
            setVotes(res.data || []); // 確保設置有效數據
            setInitialLoadComplete(true); // 標記初次加載完成
        } catch (err) {
            logger.error('Fetch votes error:', err);
            message.error('載入投票列表失敗');
            setVotes([]); // 設置空陣列作為後備
        } finally {
            setLoading(false); // 確保 loading 狀態關閉
        }
    };

    const handleVote = async (values) => {
        try {
            setLoading(true);
            const { optionIndexes } = values;
            
            const res = await axios.post(
                `${BASE_URL}/api/votes/${selectedVote._id}/vote`,
                { optionIndexes },
                { headers: { 'x-auth-token': token } }
            );
            if (res.data.msg === '您已投票' || res.data.msg === '投票成功') {
                setVoteSuccessModalVisible(true);
            } else {
                message.success(res.data.msg || '投票成功');
            }
            form.resetFields();
            fetchVotes();
        } catch (err) {
          
            message.error(`投票失敗: ${err.response?.data?.msg || err.message}`);
        } finally {
            setLoading(false);
        }
    };

    const handleSelectVote = (voteId) => {
        const vote = votes.find(v => v._id === voteId);
        if (vote.votes.some(v => v.userId.toString() === (JSON.parse(atob(token.split('.')[1])).user.id))) {
            navigate(`/vote-results?voteId=${voteId}`);
        } else if (vote.status === 'active' && moment().isBefore(vote.endTime)) {
            setSelectedVote(vote);
            form.setFieldsValue({ optionIndexes: [] });
        } else {
            message.warning('投票已結束或未開始');
        }
    };

    const handleVoteSuccessOk = () => {
        setVoteSuccessModalVisible(false);
        if (selectedVote) {
            navigate(`/vote-results?voteId=${selectedVote._id}`);
        }
    };

    const handleVoteSuccessCancel = () => {
        setVoteSuccessModalVisible(false);
    };

    return (
        <div style={{ padding: '20px', backgroundColor: '#f0f2f5' }}>
            <Card
                title={<h2 style={{ margin: 0, fontSize: '24px', color: '#1890ff' }}>投票參與</h2>}
                bordered={false}
                style={{ boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)', borderRadius: '8px' }}
            >
                <Spin spinning={loading} size="large">
                    {!initialLoadComplete && votes.length === 0 ? (
                        <Alert
                            message="加載中..."
                            description="正在獲取投票數據，請稍候。"
                            type="info"
                            showIcon
                            style={{ marginBottom: '16px' }}
                        />
                    ) : votes.length === 0 ? (
                        <Alert
                            message="無數據"
                            description="目前沒有可參與的投票記錄。"
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
                                            hoverable={!vote.votes.some(v => v.userId.toString() === (JSON.parse(atob(token.split('.')[1])).user.id))}
                                            onClick={() => handleSelectVote(vote._id)}
                                            style={{ width: 300, cursor: vote.votes.some(v => v.userId.toString() === (JSON.parse(atob(token.split('.')[1])).user.id)) ? 'default' : 'pointer' }}
                                        >
                                            <Card.Meta
                                                title={vote.title}
                                                description={
                                                    <>
                                                        <p>開始時間: {moment(vote.startTime).format('YYYY-MM-DD HH:mm')}</p>
                                                        <p>結束時間: {moment(vote.endTime).format('YYYY-MM-DD HH:mm')}</p>
                                                        <p>狀態: {vote.status === 'active' ? '進行中' : '已結束'}</p>
                                                        <p>參與者: {vote.participants.length} 人，已投票: {vote.votes.length} 人</p>
                                                    </>
                                                }
                                            />
                                        </Card>
                                    </Col>
                                ))}
                            </Row>
                            {selectedVote && selectedVote.status === 'active' && moment().isBefore(selectedVote.endTime) && (
                                <Card title="提交投票" style={{ marginBottom: '16px' }}>
                                    <Form form={form} onFinish={handleVote} layout="vertical">
                                        <Form.Item
                                            name="optionIndexes"
                                            label="選擇選項"
                                            rules={[{ required: true, message: '請選擇至少一個選項' }]}
                                        >
                                            <Select
                                                mode={selectedVote.multipleChoice ? 'multiple' : 'default'}
                                                placeholder="選擇您的選項"
                                                style={{ width: '100%' }}
                                            >
                                                {selectedVote.options.map((option, index) => (
                                                    <Option key={index} value={index}>
                                                        {option.text}
                                                    </Option>
                                                ))}
                                            </Select>
                                        </Form.Item>
                                        <Form.Item>
                                            <Button type="primary" htmlType="submit" block>
                                                提交投票
                                            </Button>
                                        </Form.Item>
                                    </Form>
                                </Card>
                            )}
                            {selectedVote && (selectedVote.status === 'closed' || moment().isAfter(selectedVote.endTime)) && (
                                <Alert
                                    message="投票已結束"
                                    description="此投票已關閉，無法參與。"
                                    type="warning"
                                    showIcon
                                />
                            )}
                        </>
                    )}
                </Spin>

                <Modal
                    title="投票成功"
                    visible={voteSuccessModalVisible}
                    onOk={handleVoteSuccessOk}
                    onCancel={handleVoteSuccessCancel}
                    okText="查看結果"
                    cancelText="關閉"
                >
                    <p>您已成功投票！是否立即查看投票結果？</p>
                </Modal>
            </Card>
        </div>
    );
};

export default VotePage;