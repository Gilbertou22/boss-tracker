import React, { useState, useEffect } from 'react';
import { Table, Card, Spin, message, Tabs, Typography, Tag, Space, Button, Pagination, Modal, Descriptions, Image, Select, Alert, DatePicker } from 'antd';
import { EyeOutlined, SearchOutlined } from '@ant-design/icons';
import axios from 'axios';
import moment from 'moment';
import { useNavigate } from 'react-router-dom';

const { TabPane } = Tabs;
const { Title, Text } = Typography;
const { Option } = Select;
const { RangePicker } = DatePicker;
const BASE_URL = process.env.REACT_APP_API_URL || '';

const UserRecords = () => {
    const navigate = useNavigate();
    const [selectedGuildMember, setSelectedGuildMember] = useState(null);
    const [selectedItem, setSelectedItem] = useState(null);
    const [activeTab, setActiveTab] = useState('1');
    const [timeRange, setTimeRange] = useState([]);
    const [items, setItems] = useState([]);
    const [guildMembers, setGuildMembers] = useState([]);
    const [searchRecipient, setSearchRecipient] = useState('');
    const [records, setRecords] = useState({
        killRecords: [],
        acquiredItems: [],
        biddingHistory: [],
        itemRecipients: [],
        wonAuctions: [],
    });
    const [pagination, setPagination] = useState({
        killRecords: { current: 1, pageSize: 10, total: 0 },
        acquiredItems: { current: 1, pageSize: 10, total: 0 },
        biddingHistory: { current: 1, pageSize: 10, total: 0 },
        itemRecipients: { current: 1, pageSize: 10, total: 0 },
        wonAuctions: { current: 1, pageSize: 10, total: 0 },
    });
    const [loading, setLoading] = useState(false);
    const [currentUser, setCurrentUser] = useState(null);
    const [detailModalVisible, setDetailModalVisible] = useState(false);
    const [selectedKillRecord, setSelectedKillRecord] = useState(null);
    const token = localStorage.getItem('token');

    // 自定義顏色映射（與 BossKillForm 一致）
    const colorMapping = {
        '白色': '#f0f0f0',
        '綠色': '#00cc00',
        '藍色': '#1e90ff',
        '紅色': '#EC3636',
        '紫色': '#B931F3',
        '金色': '#ffd700',
    };

    // 根據背景顏色計算文字顏色
    const getTextColor = (bgColor) => {
        if (!bgColor) return '#000';
        const hex = bgColor.replace('#', '');
        const r = parseInt(hex.substring(0, 2), 16);
        const g = parseInt(hex.substring(2, 4), 16);
        const b = parseInt(hex.substring(4, 6), 16);
        const brightness = Math.sqrt(0.299 * (r * r) + 0.587 * (g * g) + 0.114 * (b * b));
        return brightness > 128 ? '#000' : '#fff';
    };

    useEffect(() => {
        if (!token) {
            message.error('請先登入！');
            navigate('/login');
            return;
        }
        fetchCurrentUser();
        fetchItems();
        fetchGuildMembers();
    }, [token, navigate]);

    const fetchCurrentUser = async () => {
        try {
            const res = await axios.get(`${BASE_URL}/api/users/me`, {
                headers: { 'x-auth-token': token },
            });
            setCurrentUser(res.data);
            setSelectedGuildMember(res.data.character_name); // 自動選擇當前用戶
        } catch (err) {

            message.error('無法載入用戶信息，請重新登入');
            navigate('/login');
        }
    };

    const fetchGuildMembers = async () => {
        try {
            const res = await axios.get(`${BASE_URL}/api/users`, {
                headers: { 'x-auth-token': token },
            });
            const members = res.data.map(user => user.character_name);

            setGuildMembers(members);
            if (members.length === 0) {
                message.warning('未找到旅團成員，可能權限不足或無數據');
            }
        } catch (err) {

            message.error(`載入旅團成員失敗：${err.response?.data?.msg || err.message}`);
        }
    };

    const fetchItems = async () => {
        try {
            const res = await axios.get(`${BASE_URL}/api/items`, {
                headers: { 'x-auth-token': token },
            });

            setItems(res.data);
            if (res.data.length === 0) {
                message.warning('未找到物品數據，可能無數據或權限不足');
            }
        } catch (err) {

            message.error(`載入物品失敗：${err.response?.data?.msg || err.message}`);
        }
    };

    const fetchRecords = async (name, tabKey = '1', page = 1, pageSize = 10, itemName = null, guildMember = null, startTime = null, endTime = null) => {
        const queryName = name || selectedGuildMember || currentUser?.character_name;
        if (!queryName) {
            message.warning('請選擇旅團成員或等待用戶信息加載');
            return;
        }
        if (!currentUser) {
            message.error('請先載入用戶信息');
            return;
        }
        if (!currentUser.roles.includes('admin') && currentUser.character_name !== queryName) {
            message.error('無權查詢其他用戶的記錄');
            return;
        }

        setLoading(true);
        try {
            const encodedName = encodeURIComponent(queryName);
            const params = {
                tab: tabKey,
                page,
                pageSize,
            };
            if (itemName) {
                params.itemName = itemName;
            }
            if (guildMember) {
                params.guildMember = guildMember;
            }
            if (startTime) {
                params.startTime = startTime;
            }
            if (endTime) {
                params.endTime = endTime;
            }

            const res = await axios.get(`${BASE_URL}/api/users/${encodedName}/records`, {
                headers: { 'x-auth-token': token },
                params,
            });

            const { killRecords, acquiredItems, biddingHistory, wonAuctions, pagination: serverPagination } = res.data;

            setRecords(prevRecords => ({
                ...prevRecords,
                killRecords: killRecords || [],
                acquiredItems: acquiredItems || [],
                biddingHistory: biddingHistory || [],
                wonAuctions: wonAuctions || [],
            }));

            setPagination({
                killRecords: {
                    current: serverPagination?.killRecords?.current || 1,
                    pageSize: serverPagination?.killRecords?.pageSize || 10,
                    total: serverPagination?.killRecords?.total || 0,
                },
                acquiredItems: {
                    current: serverPagination?.acquiredItems?.current || 1,
                    pageSize: serverPagination?.acquiredItems?.pageSize || 10,
                    total: serverPagination?.acquiredItems?.total || 0,
                },
                biddingHistory: {
                    current: serverPagination?.biddingHistory?.current || 1,
                    pageSize: serverPagination?.biddingHistory?.pageSize || 10,
                    total: serverPagination?.biddingHistory?.total || 0,
                },
                wonAuctions: {
                    current: serverPagination?.wonAuctions?.current || 1,
                    pageSize: serverPagination?.wonAuctions?.pageSize || 10,
                    total: serverPagination?.wonAuctions?.total || 0,
                },
                itemRecipients: pagination.itemRecipients,
            });
        } catch (err) {

            message.error(`查詢失敗: ${err.response?.data?.msg || err.message}`);
            setRecords(prevRecords => ({
                ...prevRecords,
                killRecords: [],
                acquiredItems: [],
                biddingHistory: [],
                wonAuctions: [],
            }));
        } finally {
            setLoading(false);
        }
    };

    const fetchItemRecipients = async (name, itemName, page = 1, pageSize = 10, startTime = null, endTime = null) => {
        const queryName = name || selectedGuildMember || currentUser?.character_name;
        if (!queryName || !itemName) {
            message.warning('請選擇旅團成員和物品');
            return;
        }
        if (!currentUser) {
            message.error('請先載入用戶信息');
            return;
        }
        if (!currentUser.roles.includes('admin') && currentUser.character_name !== queryName) {
            message.error('無權查詢其他用戶的記錄');
            return;
        }

        setLoading(true);
        try {
            const encodedName = encodeURIComponent(queryName);
            const params = {
                itemName,
                page,
                pageSize,
            };
            if (startTime) {
                params.startTime = startTime;
            }
            if (endTime) {
                params.endTime = endTime;
            }

            const res = await axios.get(`${BASE_URL}/api/users/${encodedName}/item-recipients`, {
                headers: { 'x-auth-token': token },
                params,
            });

            const { itemRecipients, pagination: serverPagination } = res.data;

            setRecords(prevRecords => ({
                ...prevRecords,
                itemRecipients: itemRecipients || [],
            }));

            setPagination(prevPagination => ({
                ...prevPagination,
                itemRecipients: {
                    current: serverPagination.current || 1,
                    pageSize: serverPagination.pageSize || 10,
                    total: serverPagination.total || 0,
                },
            }));
        } catch (err) {

            message.error(`查詢獲得者記錄失敗: ${err.response?.data?.msg || err.message}`);
            setRecords(prevRecords => ({
                ...prevRecords,
                itemRecipients: [],
            }));
        } finally {
            setLoading(false);
        }
    };

    const fetchKillRecordDetails = async (killId) => {
        try {
            setLoading(true);
            const res = await axios.get(`${BASE_URL}/api/boss-kills/${killId}`, {
                headers: { 'x-auth-token': token },
            });
            setSelectedKillRecord(res.data);
            setDetailModalVisible(true);
        } catch (err) {

            message.error(`無法載入擊殺記錄詳情: ${err.response?.data?.msg || err.message}`);
        } finally {
            setLoading(false);
        }
    };

    const handleTabChange = (key) => {
        setActiveTab(key);
        const start = timeRange[0] ? timeRange[0].toISOString() : null;
        const end = timeRange[1] ? timeRange[1].toISOString() : null;
        if (key === '4') {
            if (selectedItem) {
                fetchItemRecipients(null, selectedItem, pagination.itemRecipients.current, pagination.itemRecipients.pageSize, start, end);
            }
        } else {
            fetchRecords(null, key, pagination[key === '1' ? 'killRecords' : key === '2' ? 'acquiredItems' : key === '3' ? 'biddingHistory' : 'wonAuctions'].current, undefined, selectedItem, selectedGuildMember, start, end);
        }
    };

    const handlePaginationChange = (tabKey, page, pageSize) => {
        const newPagination = { ...pagination, [tabKey]: { current: page, pageSize, total: pagination[tabKey].total } };
        setPagination(newPagination);
        const start = timeRange[0] ? timeRange[0].toISOString() : null;
        const end = timeRange[1] ? timeRange[1].toISOString() : null;
        if (tabKey === 'itemRecipients') {
            fetchItemRecipients(null, selectedItem, page, pageSize, start, end);
        } else {
            fetchRecords(
                null,
                tabKey === 'killRecords' ? '1' : tabKey === 'acquiredItems' ? '2' : tabKey === 'biddingHistory' ? '3' : '4',
                page,
                pageSize,
                selectedItem,
                selectedGuildMember,
                start,
                end
            );
        }
    };

    const handleItemChange = (value) => {

        setSelectedItem(value || null);
        setSearchRecipient('');
        const start = timeRange[0] ? timeRange[0].toISOString() : null;
        const end = timeRange[1] ? timeRange[1].toISOString() : null;
        if (value) {
            fetchItemRecipients(null, value, 1, pagination.itemRecipients.pageSize, start, end);
            setActiveTab('4'); // 切換到「獲得者記錄」標籤
        } else {
            setRecords(prevRecords => ({
                ...prevRecords,
                itemRecipients: [],
            }));
        }
        fetchRecords(null, activeTab, 1, pagination.killRecords.pageSize, value || null, selectedGuildMember, start, end);
    };

    const handleGuildMemberChange = (value) => {

        setSelectedGuildMember(value || null);
        const start = timeRange[0] ? timeRange[0].toISOString() : null;
        const end = timeRange[1] ? timeRange[1].toISOString() : null;
        if (value) {
            fetchRecords(null, '3', 1, pagination.biddingHistory.pageSize, selectedItem, value, start, end);
            setActiveTab('3'); // 切換到「競標歷史」標籤
        }
    };

    const handleTimeRangeChange = (dates) => {
        setTimeRange(dates || []);
        const start = dates && dates[0] ? dates[0].toISOString() : null;
        const end = dates && dates[1] ? dates[1].toISOString() : null;
        fetchRecords(null, activeTab, 1, pagination.killRecords.pageSize, selectedItem, selectedGuildMember, start, end);
        if (selectedItem) {
            fetchItemRecipients(null, selectedItem, 1, pagination.itemRecipients.pageSize, start, end);
        }
    };

    const handleSearchRecipient = (value) => {
        setSearchRecipient(value);
        const start = timeRange[0] ? timeRange[0].toISOString() : null;
        const end = timeRange[1] ? timeRange[1].toISOString() : null;
        if (selectedItem) {
            fetchItemRecipients(null, selectedItem, 1, pagination.itemRecipients.pageSize, start, end);
        }
    };

    const killColumns = [
        {
            title: '擊殺時間',
            dataIndex: 'kill_time',
            key: 'kill_time',
            render: (time) => moment(time).format('YYYY-MM-DD HH:mm:ss'),
            sorter: (a, b) => new Date(a.kill_time) - new Date(b.kill_time),
            width: 150,
        },
        {
            title: '首領名稱',
            dataIndex: 'bossId',
            key: 'bossId',
            render: (bossId) => bossId?.name || '未知首領',
            width: 150,
        },
        {
            title: '掉落物品',
            dataIndex: 'dropped_items',
            key: 'dropped_items',
            render: (items) => items.map(item => {
                const bgColor = item.level?.color ? colorMapping[item.level.color] || colorMapping['白色'] : colorMapping['白色'];
                const textColor = getTextColor(bgColor);
                return (
                    <Tag
                        key={item._id}
                        style={{
                            backgroundColor: bgColor,
                            color: textColor,
                            border: `1px solid ${textColor}`,
                            marginBottom: 4,
                        }}
                    >
                        {item.name} {item.final_recipient ? `(已分配給 ${item.final_recipient})` : '(未分配)'}
                    </Tag>
                );
            }),
            width: 200,
        },
        {
            title: '出席成員',
            dataIndex: 'attendees',
            key: 'attendees',
            render: (attendees) => attendees.join(', '),
            width: 200,
        },
        {
            title: '操作',
            key: 'actions',
            render: (_, record) => (
                <Button
                    type="link"
                    icon={<EyeOutlined />}
                    onClick={() => fetchKillRecordDetails(record._id)}
                >
                    查看詳情
                </Button>
            ),
            width: 100,
        },
    ];

    const itemColumns = [
        {
            title: '物品名稱',
            dataIndex: 'itemName',
            key: 'itemName',
            width: 150,
        },
        {
            title: '獲得時間',
            dataIndex: 'acquiredAt',
            key: 'acquiredAt',
            render: (time) => moment(time).format('YYYY-MM-DD HH:mm:ss'),
            sorter: (a, b) => new Date(a.acquiredAt) - new Date(b.acquiredAt),
            width: 150,
        },
        {
            title: '來源首領',
            dataIndex: 'bossName',
            key: 'bossName',
            width: 150,
        },
        {
            title: '獲得者',
            dataIndex: 'recipient',
            key: 'recipient',
            render: (recipient) => recipient || '未知',
            width: 150,
        },
    ];

    const biddingColumns = [
        {
            title: '物品名稱',
            dataIndex: 'itemName',
            key: 'itemName',
            width: 150,
        },
        {
            title: '最高出價',
            dataIndex: 'highestBid',
            key: 'highestBid',
            render: (bid) => `${bid} 鑽石`,
            width: 120,
        },
        {
            title: '我的出價',
            dataIndex: 'userBids',
            key: 'userBids',
            render: (bids) => bids.length > 0 ? bids.map(bid => (
                <div key={bid.time}>
                    {bid.amount} 鑽石 ({moment(bid.time).format('YYYY-MM-DD HH:mm:ss')})
                </div>
            )) : '未出價',
            width: 200,
        },
        {
            title: '競標結果',
            dataIndex: 'won',
            key: 'won',
            render: (won, record) => (
                <Tag color={record.status === 'closed' ? (won ? 'green' : 'red') : 'blue'}>
                    {record.status === 'closed' ? (won ? '獲勝' : '失敗') : '競標中'}
                </Tag>
            ),
            width: 120,
        },
        {
            title: '狀態',
            dataIndex: 'status',
            key: 'status',
            render: (status) => (
                <Tag color={status === 'settled' ? 'green' : status === 'completed' ? 'blue' : 'orange'}>
                    {status === 'settled' ? '已結算' : status === 'completed' ? '待確認' : '待結算'}
                </Tag>
            ),
            width: 120,
        },
        {
            title: '結束時間',
            dataIndex: 'endTime',
            key: 'endTime',
            render: (time) => time ? moment(time).format('YYYY-MM-DD HH:mm:ss') : '尚未結束',
            sorter: (a, b) => new Date(a.endTime) - new Date(b.endTime),
            width: 150,
        },
    ];

    const wonAuctionColumns = [
        {
            title: '物品名稱',
            dataIndex: 'itemName',
            key: 'itemName',
            width: 150,
        },
        {
            title: '得標時間',
            dataIndex: 'wonAt',
            key: 'wonAt',
            render: (time) => moment(time).format('YYYY-MM-DD HH:mm:ss'),
            sorter: (a, b) => new Date(a.wonAt) - new Date(b.wonAt),
            width: 150,
        },
        {
            title: '最終價格',
            dataIndex: 'finalPrice',
            key: 'finalPrice',
            render: (price) => `${price} 鑽石`,
            width: 120,
        },
    ];

    const recipientColumns = [
        {
            title: '物品名稱',
            dataIndex: 'itemName',
            key: 'itemName',
            width: 150,
        },
        {
            title: '獲得時間',
            dataIndex: 'acquiredAt',
            key: 'acquiredAt',
            render: (time) => moment(time).format('YYYY-MM-DD HH:mm:ss'),
            sorter: (a, b) => new Date(a.acquiredAt) - new Date(b.acquiredAt),
            width: 150,
        },
        {
            title: '來源首領',
            dataIndex: 'bossName',
            key: 'bossName',
            width: 150,
        },
        {
            title: '獲得者',
            dataIndex: 'recipient',
            key: 'recipient',
            render: (recipient) => recipient || '未知',
            width: 150,
        },
    ];

    return (
        <div style={{ padding: '20px', backgroundColor: '#f0f2f5' }}>
            <Card
                title={<Title level={2}>用戶記錄查詢</Title>}
                bordered={false}
                style={{ boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)', borderRadius: '8px' }}
            >
                <Space direction="vertical" style={{ width: '100%' }}>
                    <Space wrap>
                        <Select
                            placeholder="選擇或輸入旅團成員"
                            value={selectedGuildMember}
                            onChange={handleGuildMemberChange}
                            style={{ width: 200 }}
                            showSearch
                            allowClear
                            filterOption={(input, option) =>
                                option.children.toLowerCase().indexOf(input.toLowerCase()) >= 0
                            }
                        >
                            {guildMembers.map(member => (
                                <Option key={member} value={member}>
                                    {member}
                                </Option>
                            ))}
                        </Select>
                        <Select
                            placeholder="選擇物品（可選）"
                            value={selectedItem}
                            onChange={handleItemChange}
                            style={{ width: 200 }}
                            allowClear
                            showSearch
                            filterOption={(input, option) =>
                                option.children.toLowerCase().indexOf(input.toLowerCase()) >= 0
                            }
                        >
                            {items.map(item => (
                                <Option key={item._id} value={item.name}>
                                    {item.name}
                                </Option>
                            ))}
                        </Select>
                        <RangePicker
                            value={timeRange}
                            onChange={handleTimeRangeChange}
                            format="YYYY-MM-DD"
                            style={{ width: 300 }}
                        />
                    </Space>
                    {currentUser && !currentUser.roles.includes('admin') && (
                        <Text type="secondary">
                            您正在查詢自己的記錄：{currentUser.character_name}
                        </Text>
                    )}
                </Space>
                <Spin spinning={loading}>
                    <Tabs activeKey={activeTab} onChange={handleTabChange}>
                        <TabPane tab="擊殺記錄" key="1">
                            {records.killRecords.length === 0 && !loading ? (
                                <Text type="secondary">暫無擊殺記錄</Text>
                            ) : (
                                <>
                                    <Table
                                        columns={killColumns}
                                        dataSource={records.killRecords}
                                        rowKey="_id"
                                        pagination={false}
                                        bordered
                                        scroll={{ x: 'max-content' }}
                                    />
                                    <Pagination
                                        current={pagination.killRecords.current}
                                        pageSize={pagination.killRecords.pageSize}
                                        total={pagination.killRecords.total}
                                        onChange={(page, pageSize) => handlePaginationChange('killRecords', page, pageSize)}
                                        showSizeChanger
                                        style={{ marginTop: 16, textAlign: 'right' }}
                                        pageSizeOptions={['10', '20', '50']}
                                    />
                                </>
                            )}
                        </TabPane>
                        <TabPane tab="獲得物品" key="2">
                            {records.acquiredItems.length === 0 && !loading ? (
                                <Text type="secondary">暫無獲得物品記錄</Text>
                            ) : (
                                <>
                                    <Table
                                        columns={itemColumns}
                                        dataSource={records.acquiredItems}
                                        rowKey={(record, index) => index}
                                        pagination={false}
                                        bordered
                                        scroll={{ x: 'max-content' }}
                                    />
                                    <Pagination
                                        current={pagination.acquiredItems.current}
                                        pageSize={pagination.acquiredItems.pageSize}
                                        total={pagination.acquiredItems.total}
                                        onChange={(page, pageSize) => handlePaginationChange('acquiredItems', page, pageSize)}
                                        showSizeChanger
                                        style={{ marginTop: 16, textAlign: 'right' }}
                                        pageSizeOptions={['10', '20', '50']}
                                    />
                                </>
                            )}
                        </TabPane>
                        <TabPane tab="競標歷史" key="3">
                            {records.biddingHistory.length === 0 && !loading ? (
                                <Text type="secondary">暫無競標歷史記錄</Text>
                            ) : (
                                <>
                                    <Table
                                        columns={biddingColumns}
                                        dataSource={records.biddingHistory}
                                        rowKey={(record, index) => index}
                                        pagination={false}
                                        bordered
                                        scroll={{ x: 'max-content' }}
                                    />
                                    <Pagination
                                        current={pagination.biddingHistory.current}
                                        pageSize={pagination.biddingHistory.pageSize}
                                        total={pagination.biddingHistory.total}
                                        onChange={(page, pageSize) => handlePaginationChange('biddingHistory', page, pageSize)}
                                        showSizeChanger
                                        style={{ marginTop: 16, textAlign: 'right' }}
                                        pageSizeOptions={['10', '20', '50']}
                                    />
                                </>
                            )}
                        </TabPane>
                        <TabPane tab="競標贏得記錄" key="5">
                            {records.wonAuctions.length === 0 && !loading ? (
                                <Alert
                                    message="無競標贏得記錄"
                                    description="目前沒有符合條件的競標贏得記錄。"
                                    type="info"
                                    showIcon
                                    style={{ marginBottom: '16px' }}
                                />
                            ) : (
                                <>
                                    <Table
                                        columns={wonAuctionColumns}
                                        dataSource={records.wonAuctions}
                                        rowKey={(record, index) => index}
                                        pagination={false}
                                        bordered
                                        scroll={{ x: 'max-content' }}
                                    />
                                    <Pagination
                                        current={pagination.wonAuctions.current}
                                        pageSize={pagination.wonAuctions.pageSize}
                                        total={pagination.wonAuctions.total}
                                        onChange={(page, pageSize) => handlePaginationChange('wonAuctions', page, pageSize)}
                                        showSizeChanger
                                        style={{ marginTop: 16, textAlign: 'right' }}
                                        pageSizeOptions={['10', '20', '50']}
                                    />
                                </>
                            )}
                        </TabPane>
                        <TabPane tab="獲得者記錄" key="4">
                            {selectedItem ? (
                                <>
                                    <div style={{ marginBottom: '16px', display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                                        <Select
                                            placeholder="搜索獲得者或首領名稱"
                                            value={searchRecipient}
                                            onChange={handleSearchRecipient}
                                            style={{ width: 200 }}
                                            allowClear
                                            showSearch
                                            filterOption={(input, option) =>
                                                option.children.toLowerCase().indexOf(input.toLowerCase()) >= 0
                                            }
                                        >
                                            {[...new Set(records.itemRecipients.map(record => record.recipient))].map(recipient => (
                                                <Option key={recipient} value={recipient}>
                                                    {recipient}
                                                </Option>
                                            ))}
                                            {[...new Set(records.itemRecipients.map(record => record.bossName))].map(bossName => (
                                                <Option key={bossName} value={bossName}>
                                                    {bossName}
                                                </Option>
                                            ))}
                                        </Select>
                                    </div>
                                    {records.itemRecipients.length === 0 && !loading ? (
                                        <Alert
                                            message="無獲得者記錄"
                                            description="目前沒有符合條件的獲得者記錄。"
                                            type="info"
                                            showIcon
                                            style={{ marginBottom: '16px' }}
                                        />
                                    ) : (
                                        <>
                                            <Table
                                                columns={recipientColumns}
                                                dataSource={records.itemRecipients}
                                                rowKey={(record, index) => index}
                                                pagination={false}
                                                bordered
                                                scroll={{ x: 'max-content' }}
                                            />
                                            <Pagination
                                                current={pagination.itemRecipients.current}
                                                pageSize={pagination.itemRecipients.pageSize}
                                                total={pagination.itemRecipients.total}
                                                onChange={(page, pageSize) => handlePaginationChange('itemRecipients', page, pageSize)}
                                                showSizeChanger
                                                style={{ marginTop: 16, textAlign: 'right' }}
                                                pageSizeOptions={['10', '20', '50']}
                                            />
                                        </>
                                    )}
                                </>
                            ) : (
                                <Text type="secondary">請選擇一個物品以查看獲得者記錄</Text>
                            )}
                        </TabPane>
                    </Tabs>
                </Spin>
            </Card>

            {/* 擊殺記錄詳情彈出框 */}
            <Modal
                title="擊殺記錄詳情"
                open={detailModalVisible}
                onCancel={() => {
                    setDetailModalVisible(false);
                    setSelectedKillRecord(null);
                }}
                footer={null}
                width={800}
            >
                {selectedKillRecord ? (
                    <Descriptions bordered column={1}>
                        <Descriptions.Item label="擊殺時間">
                            {moment(selectedKillRecord.kill_time).format('YYYY-MM-DD HH:mm:ss')}
                        </Descriptions.Item>
                        <Descriptions.Item label="首領名稱">
                            {selectedKillRecord.bossId?.name || '未知首領'}
                        </Descriptions.Item>
                        <Descriptions.Item label="掉落物品">
                            {selectedKillRecord.dropped_items.map(item => {
                                const bgColor = item.level?.color ? colorMapping[item.level.color] || colorMapping['白色'] : colorMapping['白色'];
                                const textColor = getTextColor(bgColor);
                                return (
                                    <Tag
                                        key={item._id}
                                        style={{
                                            backgroundColor: bgColor,
                                            color: textColor,
                                            border: `1px solid ${textColor}`,
                                            marginBottom: 8,
                                        }}
                                    >
                                        {item.name} {item.level?.level ? `(等級: ${item.level.level})` : ''}
                                        {item.final_recipient ? `(已分配給 ${item.final_recipient})` : '(未分配)'}
                                    </Tag>
                                );
                            })}
                        </Descriptions.Item>
                        <Descriptions.Item label="出席成員">
                            {selectedKillRecord.attendees.join(', ')}
                        </Descriptions.Item>
                        <Descriptions.Item label="截圖">
                            {selectedKillRecord.screenshots && selectedKillRecord.screenshots.length > 0 ? (
                                selectedKillRecord.screenshots.map((url, index) => (
                                    <Image
                                        key={index}
                                        src={url}
                                        alt={`擊殺截圖 ${index + 1}`}
                                        width={200}
                                        style={{ marginRight: 8 }}
                                    />
                                ))
                            ) : (
                                '無截圖'
                            )}
                        </Descriptions.Item>
                        <Descriptions.Item label="狀態">
                            <Tag color={selectedKillRecord.status === 'assigned' ? 'green' : selectedKillRecord.status === 'pending' ? 'blue' : 'red'}>
                                {selectedKillRecord.status === 'assigned' ? '已分配' : selectedKillRecord.status === 'pending' ? '待分配' : '已過期'}
                            </Tag>
                        </Descriptions.Item>
                    </Descriptions>
                ) : (
                    <Text type="secondary">載入中...</Text>
                )}
            </Modal>
        </div>
    );
};

export default UserRecords;