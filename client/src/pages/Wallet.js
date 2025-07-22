import React, { useState, useEffect, useCallback } from 'react';
import { Table, Tag, Card, message, Select, DatePicker, Button, Space, Modal, Descriptions, Image, Row, Col, Tabs } from 'antd';
import axios from 'axios';
import moment from 'moment';
import logger from '../utils/logger';
import formatNumber from '../utils/formatNumber';
import { DownloadOutlined, EyeOutlined, ClockCircleOutlined, SwapOutlined, DollarOutlined, AppstoreOutlined, UserOutlined, CalendarOutlined, GiftOutlined, TagOutlined, FilterOutlined, WalletOutlined, LineChartOutlined } from '@ant-design/icons';
import Papa from 'papaparse';
import CountUp from 'react-countup';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const { Option } = Select;
const { RangePicker } = DatePicker;
const { TabPane } = Tabs;

const BASE_URL = process.env.REACT_APP_API_URL || '';

const isValidObjectId = (id) => /^[0-9a-fA-F]{24}$/.test(id);

const colorMapping = {
    '白色': '#f0f0f0',
    '綠色': '#00cc00',
    '藍色': '#1e90ff',
    '紅色': '#EC3636',
    '紫色': '#B931F3',
    '金色': '#ffd700',
};

const Wallet = () => {
    const [transactions, setTransactions] = useState([]);
    const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 });
    const [loading, setLoading] = useState(false);
    const [diamonds, setDiamonds] = useState(0);
    const [dkpPoints, setDkpPoints] = useState(0);
    const [filters, setFilters] = useState({
        type: null,
        dateRange: null,
        source: null,
    });
    const [modalVisible, setModalVisible] = useState(false);
    const [selectedTransaction, setSelectedTransaction] = useState(null);
    const [auctionDetails, setAuctionDetails] = useState(null);
    const [trendData, setTrendData] = useState([]);
    const [trendRange, setTrendRange] = useState('all');

    const fetchUserInfo = useCallback(async () => {
        try {
            const res = await axios.get(`${BASE_URL}/api/users/me`, {
                headers: { 'x-auth-token': localStorage.getItem('token') },
            });
            setDiamonds(res.data.diamonds || 0);

            const dkpRes = await axios.get(`${BASE_URL}/api/dkp/stats`, {
                headers: { 'x-auth-token': localStorage.getItem('token') },
            });
            setDkpPoints(dkpRes.data.dkpPoints || 0);
        } catch (err) {
            logger.error('Fetch user info error in Wallet', { error: err.message, stack: err.stack });
            message.error('無法獲取用戶信息');
        }
    }, []);

    const fetchTransactions = useCallback(async (page = 1, pageSize = 10) => {
        setLoading(true);
        try {
            const params = {
                page,
                pageSize,
                type: filters.type,
                source: filters.source,
                startDate: filters.dateRange ? filters.dateRange[0].toISOString() : null,
                endDate: filters.dateRange ? filters.dateRange[1].toISOString() : null,
                sortBy: 'timestamp',
                sortOrder: 'desc',
            };
            const res = await axios.get(`${BASE_URL}/api/wallet/transactions`, {
                headers: { 'x-auth-token': localStorage.getItem('token') },
                params,
            });

            // 過濾掉描述中包含 "DKP 點數變動" 的記錄
            const filteredTransactions = res.data.transactions.filter(transaction =>
                !transaction.description.includes('DKP 點數變動')
            );

            setTransactions(filteredTransactions);
            setPagination({
                current: res.data.pagination.current,
                pageSize: res.data.pagination.pageSize,
                total: filteredTransactions.length,
            });

            const trend = filteredTransactions.reduce((acc, transaction) => {
                const date = moment(transaction.timestamp).format('YYYY-MM-DD');
                const lastEntry = acc.length > 0 ? acc[acc.length - 1] : { diamonds: diamonds, dkpPoints: dkpPoints };
                const newDiamonds = transaction.source !== 'dkp' ? lastEntry.diamonds + transaction.amount : lastEntry.diamonds;
                const newDkpPoints = transaction.source === 'dkp' ? lastEntry.dkpPoints + transaction.amount : lastEntry.dkpPoints;
                acc.push({ date, diamonds: newDiamonds, dkpPoints: newDkpPoints });
                return acc;
            }, []);
            setTrendData(trend);
        } catch (err) {
            logger.error('Fetch wallet transactions error', { error: err.message, stack: err.stack });
            message.error('無法獲取錢包記錄');
        } finally {
            setLoading(false);
        }
    }, [filters, diamonds, dkpPoints]);

    useEffect(() => {
        fetchUserInfo();
        fetchTransactions();
    }, [fetchUserInfo, fetchTransactions]);

    const handleTableChange = (pagination) => {
        fetchTransactions(pagination.current, pagination.pageSize);
    };

    const handleFilterChange = (field, value) => {
        setFilters(prev => ({ ...prev, [field]: value }));
        fetchTransactions(1, pagination.pageSize);
    };

    const handleExportCSV = async () => {
        try {
            const params = {
                type: filters.type,
                source: filters.source,
                startDate: filters.dateRange ? filters.dateRange[0].toISOString() : null,
                endDate: filters.dateRange ? filters.dateRange[1].toISOString() : null,
            };
            const res = await axios.get(`${BASE_URL}/api/wallet/transactions/export`, {
                headers: { 'x-auth-token': localStorage.getItem('token') },
                params,
            });

            // 過濾掉描述中包含 "DKP 點數變動" 的記錄
            const filteredTransactions = res.data.transactions.filter(transaction =>
                !transaction.description.includes('DKP 點數變動')
            );

            const data = filteredTransactions.map((transaction) => ({
                時間: moment(transaction.timestamp).format('YYYY-MM-DD HH:mm:ss'),
                類型: transaction.type === 'income' ? '收入' : '支出',
                異動: `${transaction.amount > 0 ? '▲' : '▼'}${formatNumber(Math.abs(transaction.amount))} ${transaction.source === 'dkp' ? '' : '💎'}`,
                來源: transaction.source === 'auction' ? '拍賣' : transaction.source === 'recharge' ? '充值' : transaction.source === 'system' ? '系統' : transaction.source === 'dkp' ? 'DKP' : '未知',
                描述: transaction.description,
            }));

            const csv = Papa.unparse(data, {
                header: true,
                delimiter: ',',
            });

            const blob = new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = `wallet_transactions_${moment().format('YYYYMMDD_HHmmss')}.csv`;
            link.click();
            URL.revokeObjectURL(link.href);

            message.success('錢包記錄已導出為 CSV');
        } catch (err) {
            logger.error('Export wallet transactions error', { error: err.message, stack: err.stack });
            message.error('導出錢包記錄失敗');
        }
    };

    const handleViewDetails = async (transaction) => {
        setSelectedTransaction(transaction);
        setAuctionDetails(null);

        if (transaction.source === 'auction' && transaction.auctionId) {
            try {
                const auctionId = typeof transaction.auctionId === 'object' && transaction.auctionId._id
                    ? transaction.auctionId._id
                    : transaction.auctionId.toString();
                if (!isValidObjectId(auctionId)) {
                    logger.warn('Invalid auctionId in transaction', { transactionId: transaction._id, auctionId });
                    message.error('無效的拍賣 ID');
                    return;
                }
                const res = await axios.get(`${BASE_URL}/api/auctions/${auctionId}`, {
                    headers: { 'x-auth-token': localStorage.getItem('token') },
                });
                setAuctionDetails(res.data);
            } catch (err) {
                logger.error('Fetch auction details error', { auctionId: transaction.auctionId, error: err.message, stack: err.stack });
                message.error('無法獲取拍賣詳情');
            }
        }

        setModalVisible(true);
    };

    const handleTrendRangeChange = (value) => {
        setTrendRange(value);
        const filteredTrendData = trendData.filter(data => {
            if (value === '7d') {
                return moment(data.date).isAfter(moment().subtract(7, 'days'));
            } else if (value === '30d') {
                return moment(data.date).isAfter(moment().subtract(30, 'days'));
            }
            return true;
        });
        setTrendData(filteredTrendData);
    };

    const columns = [
        {
            title: '時間',
            dataIndex: 'timestamp',
            key: 'timestamp',
            sorter: (a, b) => moment(a.timestamp).unix() - moment(b.timestamp).unix(),
            render: (time) => moment(time).format('YYYY-MM-DD HH:mm:ss'),
        },
        {
            title: '異動',
            dataIndex: 'amount',
            key: 'amount',
            sorter: (a, b) => a.amount - b.amount,
            render: (amount, record) => (
                <span style={{ color: amount > 0 ? '#52c41a' : '#ff4d4f' }}>
                    {amount > 0 ? '▲' : '▼'} {formatNumber(Math.abs(amount))} {record.source === 'dkp' ? '' : '💎'}
                </span>
            ),
        },
        {
            title: '來源',
            dataIndex: 'source',
            key: 'source',
            render: (source) => {
                const sourceMap = {
                    auction: '拍賣',
                    recharge: '充值',
                    system: '系統',
                    dkp: 'DKP',
                };
                return sourceMap[source] || source;
            },
        },
        {
            title: '備註',
            dataIndex: 'description',
            key: 'description',
        },
        {
            title: '詳細',
            key: 'details',
            render: (_, record) => (
                <Button
                    type="link"
                    icon={<EyeOutlined />}
                    onClick={() => handleViewDetails(record)}
                    className="view-details-btn"
                >
                    查看
                </Button>
            ),
        },
    ];

    return (
        <div className="wallet-container">
            <Card className="wallet-balance-card">
                <Row gutter={[16, 16]} align="middle">
                    <Col xs={24} sm={12}>
                        <div className="balance-section">
                            <WalletOutlined style={{ fontSize: '32px', color: '#1890ff', marginRight: '16px' }} />
                            <div>
                                <h3>當前餘額</h3>
                                <h2 className="balance-value">
                                    <CountUp end={diamonds} duration={1.5} separator="," /> 💎
                                </h2>
                            </div>
                        </div>
                    </Col>
                    <Col xs={24} sm={12}>
                        <div className="balance-section">
                            <DollarOutlined style={{ fontSize: '32px', color: '#fa8c16', marginRight: '16px' }} />
                            <div>
                                <h3>DKP 總點數</h3>
                                <h2 className="balance-value">
                                    <CountUp end={dkpPoints} duration={1.5} separator="," />
                                </h2>
                            </div>
                        </div>
                    </Col>
                </Row>
            </Card>

            <Card className="wallet-trend-card">
                <Row gutter={[16, 16]} align="middle">
                    <Col xs={24} sm={6}>
                        <Select
                            placeholder="趨勢範圍"
                            style={{ width: '100%' }}
                            onChange={handleTrendRangeChange}
                            defaultValue="all"
                        >
                            <Option value="all">全部</Option>
                            <Option value="7d">最近 7 天</Option>
                            <Option value="30d">最近 30 天</Option>
                        </Select>
                    </Col>
                    <Col xs={24} sm={18}>
                        <h3 style={{ fontSize: '16px', marginBottom: '16px', color: '#1890ff' }}>
                            <LineChartOutlined style={{ marginRight: '8px' }} /> 餘額與 DKP 趨勢
                        </h3>
                        <ResponsiveContainer width="100%" height={200}>
                            <LineChart data={trendData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="date" />
                                <YAxis />
                                <Tooltip />
                                <Legend />
                                <Line type="monotone" dataKey="diamonds" name="餘額 (💎)" stroke="#1890ff" activeDot={{ r: 8 }} />
                                <Line type="monotone" dataKey="dkpPoints" name="DKP 點數" stroke="#fa8c16" />
                            </LineChart>
                        </ResponsiveContainer>
                    </Col>
                </Row>
            </Card>

            <Card className="wallet-filter-card">
                <Space wrap>
                    <Select
                        placeholder="篩選類型"
                        style={{ width: 120 }}
                        allowClear
                        onChange={(value) => handleFilterChange('type', value)}
                        prefix={<FilterOutlined />}
                    >
                        <Option value="income">收入</Option>
                        <Option value="expense">支出</Option>
                    </Select>
                    <Select
                        placeholder="篩選來源"
                        style={{ width: 120 }}
                        allowClear
                        onChange={(value) => handleFilterChange('source', value)}
                        prefix={<FilterOutlined />}
                    >
                        <Option value="auction">拍賣</Option>
                        <Option value="recharge">充值</Option>
                        <Option value="system">系統</Option>
                        <Option value="dkp">DKP</Option>
                    </Select>
                    <RangePicker
                        onChange={(dates) => handleFilterChange('dateRange', dates)}
                        style={{ width: 240 }}
                    />
                    <Button
                        type="primary"
                        icon={<DownloadOutlined />}
                        onClick={handleExportCSV}
                        className="export-btn"
                    >
                        導出 CSV
                    </Button>
                </Space>
            </Card>

            <Table
                columns={columns}
                dataSource={transactions}
                rowKey="_id"
                pagination={{
                    current: pagination.current,
                    pageSize: pagination.pageSize,
                    total: pagination.total,
                    showSizeChanger: true,
                    pageSizeOptions: ['10', '20', '50'],
                    showTotal: (total) => `共 ${total} 條記錄`,
                }}
                loading={loading}
                onChange={handleTableChange}
                className="wallet-table"
                onRow={(record) => ({
                    onClick: () => handleViewDetails(record),
                    className: 'clickable-row',
                })}
            />

            <Modal
                title={<span style={{ fontSize: '18px', fontWeight: 'bold' }}>交易詳細</span>}
                open={modalVisible}
                onCancel={() => setModalVisible(false)}
                footer={[
                    <Button key="close" onClick={() => setModalVisible(false)}>
                        關閉
                    </Button>,
                ]}
                width={700}
            >
                {selectedTransaction && (
                    <Tabs defaultActiveKey="transaction" className="transaction-tabs">
                        <TabPane
                            tab={<span><SwapOutlined style={{ marginRight: 8 }} />交易信息</span>}
                            key="transaction"
                        >
                            <Descriptions column={1} bordered size="small">
                                <Descriptions.Item label={<span><ClockCircleOutlined style={{ marginRight: 8 }} />時間</span>}>
                                    {moment(selectedTransaction.timestamp).format('YYYY-MM-DD HH:mm:ss')}
                                </Descriptions.Item>
                                <Descriptions.Item label={<span><SwapOutlined style={{ marginRight: 8 }} />類型</span>}>
                                    <Tag color={selectedTransaction.type === 'income' ? 'green' : 'red'}>
                                        {selectedTransaction.type === 'income' ? '收入' : '支出'}
                                    </Tag>
                                </Descriptions.Item>
                                <Descriptions.Item label={<span><DollarOutlined style={{ marginRight: 8 }} />異動</span>}>
                                    <span style={{ color: selectedTransaction.amount > 0 ? '#52c41a' : '#ff4d4f' }}>
                                        {selectedTransaction.amount > 0 ? '▲' : '▼'} {formatNumber(Math.abs(selectedTransaction.amount))} {selectedTransaction.source === 'dkp' ? 'DKP' : '💎'}
                                    </span>
                                </Descriptions.Item>
                                <Descriptions.Item label={<span><AppstoreOutlined style={{ marginRight: 8 }} />來源</span>}>
                                    {selectedTransaction.source === 'auction' ? '拍賣' : selectedTransaction.source === 'recharge' ? '充值' : selectedTransaction.source === 'system' ? '系統' : selectedTransaction.source === 'dkp' ? 'DKP' : '未知'}
                                </Descriptions.Item>
                                <Descriptions.Item label={<span><TagOutlined style={{ marginRight: 8 }} />描述</span>}>
                                    {selectedTransaction.description}
                                </Descriptions.Item>
                            </Descriptions>
                        </TabPane>

                        {selectedTransaction.source === 'auction' && auctionDetails && (
                            <TabPane
                                tab={<span><GiftOutlined style={{ marginRight: 8 }} />拍賣詳情</span>}
                                key="auction"
                            >
                                <div style={{ border: '1px solid #e8e8e8', borderRadius: '8px', padding: '16px', background: '#fafafa' }}>
                                    {auctionDetails.imageUrl && (
                                        <div style={{ marginBottom: '16px', textAlign: 'center' }}>
                                            <Image
                                                src={auctionDetails.imageUrl}
                                                alt={auctionDetails.itemName}
                                                style={{ maxWidth: '200px', maxHeight: '200px', borderRadius: '8px' }}
                                            />
                                        </div>
                                    )}
                                    <Descriptions column={1} bordered size="small">
                                        <Descriptions.Item label={<span><TagOutlined style={{ marginRight: 8 }} />拍賣 ID</span>}>
                                            {auctionDetails._id}
                                        </Descriptions.Item>
                                        <Descriptions.Item label={<span><GiftOutlined style={{ marginRight: 8 }} />物品名稱</span>}>
                                            <span style={{ color: colorMapping[auctionDetails.level?.color] || colorMapping['白色'] }}>
                                                {auctionDetails.itemName || '未知物品'}
                                            </span>
                                        </Descriptions.Item>
                                        <Descriptions.Item label={<span><UserOutlined style={{ marginRight: 8 }} />得標者</span>}>
                                            {auctionDetails.highestBidder?.character_name || '無'}
                                        </Descriptions.Item>
                                        <Descriptions.Item label={<span><DollarOutlined style={{ marginRight: 8 }} />最終價格</span>}>
                                            {formatNumber(auctionDetails.currentPrice)} 💎
                                        </Descriptions.Item>
                                        <Descriptions.Item label={<span><DollarOutlined style={{ marginRight: 8 }} />起標價格</span>}>
                                            {formatNumber(auctionDetails.startingPrice)} 💎
                                        </Descriptions.Item>
                                        <Descriptions.Item label={<span><DollarOutlined style={{ marginRight: 8 }} />直接得標價</span>}>
                                            {auctionDetails.buyoutPrice ? formatNumber(auctionDetails.buyoutPrice) : '無'} 💎
                                        </Descriptions.Item>
                                        <Descriptions.Item label={<span><CalendarOutlined style={{ marginRight: 8 }} />創建時間</span>}>
                                            {moment(auctionDetails.createdAt).format('YYYY-MM-DD HH:mm:ss')}
                                        </Descriptions.Item>
                                        <Descriptions.Item label={<span><CalendarOutlined style={{ marginRight: 8 }} />結束時間</span>}>
                                            {moment(auctionDetails.endTime).format('YYYY-MM-DD HH:mm:ss')}
                                        </Descriptions.Item>
                                        <Descriptions.Item label={<span><TagOutlined style={{ marginRight: 8 }} />狀態</span>}>
                                            <Tag
                                                color={
                                                    auctionDetails.status === 'active' ? 'green' :
                                                        auctionDetails.status === 'pending' ? 'orange' :
                                                            auctionDetails.status === 'completed' ? 'blue' :
                                                                auctionDetails.status === 'settled' ? 'purple' :
                                                                    auctionDetails.status === 'cancelled' ? 'red' : 'default'
                                                }
                                            >
                                                {auctionDetails.status === 'active' ? '活躍' :
                                                    auctionDetails.status === 'pending' ? '待處理' :
                                                        auctionDetails.status === 'completed' ? '已完成' :
                                                            auctionDetails.status === 'settled' ? '已結算' :
                                                                auctionDetails.status === 'cancelled' ? '已取消' : '未知'}
                                            </Tag>
                                        </Descriptions.Item>
                                        <Descriptions.Item label={<span><UserOutlined style={{ marginRight: 8 }} />物品持有人</span>}>
                                            {auctionDetails.itemHolder || '無'}
                                        </Descriptions.Item>
                                    </Descriptions>
                                </div>
                            </TabPane>
                        )}
                    </Tabs>
                )}
            </Modal>

            <style jsx global>{`
                .wallet-container {
                    padding: 24px;
                    background: #f5f5f5;
                    min-height: 100vh;
                }
                .wallet-balance-card {
                    margin-bottom: 24px;
                    border-radius: 12px;
                    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
                    background: linear-gradient(135deg, #ffffff, #f0f4f8);
                    padding: 24px;
                    transition: transform 0.3s ease;
                }
                .wallet-balance-card:hover {
                    transform: translateY(-4px);
                }
                .balance-section {
                    display: flex;
                    align-items: center;
                }
                .balance-value {
                    font-size: 28px;
                    font-weight: bold;
                    color: #1890ff;
                }
                .balance-section h3 {
                    font-size: 16px;
                    color: #666;
                    margin: 0;
                }
                .wallet-trend-card {
                    margin-bottom: 24px;
                    border-radius: 12px;
                    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
                    background: #fff;
                    padding: 16px;
                }
                .wallet-filter-card {
                    margin-bottom: 24px;
                    border-radius: 12px;
                    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
                    background: #fff;
                    padding: 16px;
                }
                .wallet-table {
                    background: #fff;
                    border-radius: 12px;
                    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
                }
                .wallet-table .ant-table-tbody > tr > td {
                    padding: 12px !important;
                    line-height: 1.5 !important;
                    transition: background-color 0.3s ease;
                }
                .wallet-table .ant-table-thead > tr > th {
                    padding: 12px !important;
                    background: #e8e8e8 !important;
                    font-weight: bold;
                    color: #333;
                }
                .wallet-table .ant-table-row {
                    transition: background-color 0.3s ease;
                }
                .wallet-table .ant-table-row:hover {
                    background-color: #f0f4f8 !important;
                }
                .clickable-row {
                    cursor: pointer;
                }
                .view-details-btn {
                    transition: transform 0.3s ease;
                }
                .view-details-btn:hover {
                    transform: scale(1.1);
                }
                .export-btn {
                    transition: transform 0.3s ease;
                }
                .export-btn:hover {
                    transform: scale(1.05);
                }
                .ant-modal-body {
                    padding: 24px;
                }
                .ant-descriptions-item-label {
                    width: 150px;
                    background: #f5f5f5;
                    font-weight: 500;
                }
                .ant-descriptions-item-content {
                    background: #fff;
                }
                .transaction-tabs .ant-tabs-tab {
                    font-size: 14px;
                    padding: 8px 16px;
                    transition: all 0.3s ease;
                }
                .transaction-tabs .ant-tabs-tab:hover {
                    color: #1890ff;
                }
                .transaction-tabs .ant-tabs-tab-active {
                    font-weight: bold;
                    color: #1890ff;
                }
                .transaction-tabs .ant-tabs-ink-bar {
                    background: #1890ff;
                }
                @media (max-width: 768px) {
                    .wallet-container {
                        padding: 16px;
                    }
                    .wallet-balance-card {
                        padding: 16px;
                    }
                    .balance-value {
                        font-size: 24px;
                    }
                    .wallet-table .ant-table-tbody > tr > td,
                    .wallet-table .ant-table-thead > tr > th {
                        padding: 8px !important;
                    }
                }
            `}</style>
        </div>
    );
};

export default Wallet;