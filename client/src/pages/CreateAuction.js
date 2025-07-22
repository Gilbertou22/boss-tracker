import React, { useState, useEffect, useCallback } from 'react';
import { Form, Input, Button, Card, Spin, Row, Col, Select, message, DatePicker, Alert, Space, Typography, Divider, Tooltip } from 'antd';
import { useNavigate } from 'react-router-dom';
import moment from 'moment';
import axios from 'axios';
import { motion } from 'framer-motion';
import { InfoCircleOutlined, ClockCircleOutlined, DollarOutlined, TagOutlined, QuestionCircleOutlined } from '@ant-design/icons';
import ErrorBoundary from '../components/ErrorBoundary';
import logger from '../utils/logger';

const { Option } = Select;
const { Title, Text } = Typography;

const BASE_URL = process.env.REACT_APP_API_URL || '';

// 簡單的 MongoDB ObjectId 格式驗證
const isValidObjectId = (id) => {
    return /^[0-9a-fA-F]{24}$/.test(id);
};

// 顏色映射表，參考 WALLET 頁面
const colorMapping = {
    '白色': '#666', // 深灰色，確保可見
    '綠色': '#00cc00',
    '藍色': '#1e90ff',
    '紅色': '#EC3636',
    '紫色': '#B931F3',
    '金色': '#ffd700',
};

// 動畫變量
const fadeIn = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
};

const CreateAuction = () => {
    const [form] = Form.useForm();
    const [loading, setLoading] = useState(false);
    const [items, setItems] = useState([]);
    const [online, setOnline] = useState(navigator.onLine);
    const [auctionType, setAuctionType] = useState('open');
    const [selectedItem, setSelectedItem] = useState(null);
    const [existingAuction, setExistingAuction] = useState(null); // 儲存已存在的拍賣
    const token = localStorage.getItem('token');
    const navigate = useNavigate();

    // PWA 安裝提示
    const [deferredPrompt, setDeferredPrompt] = useState(null);
    useEffect(() => {
        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            setDeferredPrompt(e);
        });

        window.addEventListener('online', () => setOnline(true));
        window.addEventListener('offline', () => setOnline(false));
    }, []);

    const handleInstallPWA = () => {
        if (deferredPrompt) {
            deferredPrompt.prompt();
            deferredPrompt.userChoice.then((choiceResult) => {
                if (choiceResult.outcome === 'accepted') {
                
                } else {
                
                }
                setDeferredPrompt(null);
            });
        }
    };

    const fetchAuctionableItems = useCallback(async () => {
        if (!online) {
            message.warning('目前處於離線模式，無法獲取物品列表');
            setItems([]);
            return;
        }
        try {
            setLoading(true);
            const res = await axios.get(`${BASE_URL}/api/boss-kills/expired-items`, {
                headers: { 'x-auth-token': token },
            });
            const options = res.data.map(item => ({
                value: item.kill_id,
                label: item.item_name,
                kill_id: item.kill_id,
                item_name: item.item_name,
                boss_name: item.boss_name,
                apply_deadline: item.apply_deadline,
                level: item.level,
                image_url: item.image_url, // 假設後端返回了圖片 URL
            }));
            // 驗證每個 kill_id 是否有效
            const validOptions = options.filter(option => {
                if (!isValidObjectId(option.kill_id)) {
                    logger.error('Invalid kill_id in auctionable items', { kill_id: option.kill_id, item: option });
                    return false;
                }
                return true;
            });
            setItems(validOptions);
            logger.info('Fetched auctionable items', { options: validOptions });
            if (validOptions.length === 0) {
                message.warning('目前沒有可競標的物品，請檢查擊殺記錄！');
            } else {
                // 預設選擇第一個選項
                form.setFieldsValue({ item: validOptions[0].value });
                setSelectedItem(validOptions[0]);
            }
        } catch (err) {
            logger.error('Fetch auctionable items error', {
                status: err.response?.status,
                data: err.response?.data,
                message: err.message,
            });
            message.error(`獲取可競標物品失敗: ${err.response?.data?.msg || '服務器錯誤，請稍後重試'}`);
            setItems([]);
        } finally {
            setLoading(false);
        }
    }, [token, online, form]);

    // 檢查是否存在拍賣
    const checkExistingAuction = useCallback(async (kill_id) => {
        try {
            const res = await axios.get(`${BASE_URL}/api/auctions`, {
                headers: { 'x-auth-token': token },
            });
            const auctions = res.data;
            const existing = auctions.find(auction => auction.itemId === kill_id);
            setExistingAuction(existing || null);
            return existing;
        } catch (err) {
            logger.error('Check existing auction error', {
                kill_id,
                error: err.message,
                stack: err.stack,
            });
            return null;
        }
    }, [token]);

    useEffect(() => {
        fetchAuctionableItems();
    }, [fetchAuctionableItems]);

    const onFinish = async (values) => {
        if (!online) {
            message.error('目前處於離線模式，無法創建競標');
            return;
        }
        setLoading(true);
        try {
            const startingPrice = parseInt(values.startingPrice);
            if (isNaN(startingPrice) || startingPrice < 100 || startingPrice > 9999) {
                throw new Error('起標價格必須在 100-9999 之間！');
            }

            const buyoutPrice = values.buyoutPrice ? parseInt(values.buyoutPrice) : null;
            if (buyoutPrice && (isNaN(buyoutPrice) || buyoutPrice <= startingPrice)) {
                throw new Error('直接得標價必須大於起標價格！');
            }

            let endTime = values.endTime;
            const now = moment.utc();
            if (!endTime) {
                throw new Error('請選擇截止時間！');
            }
            if (endTime.isBefore(now.add(1, 'hour'))) {
                throw new Error('截止時間必須至少在 1 小時後！');
            }

            // 驗證選擇的物品
            if (!values.item) {
                throw new Error('請選擇一個物品！');
            }
            logger.info('Selected item value', { selectedValue: values.item, items });
            const selectedItem = items.find(option => option.value === values.item);
            if (!selectedItem) {
                logger.error('Invalid item selection', { selectedValue: values.item, items });
                throw new Error('無效的物品選擇！');
            }
            const kill_id = selectedItem.kill_id;
            if (!kill_id || !isValidObjectId(kill_id)) {
                logger.error('Invalid kill_id for selected item', { kill_id, selectedItem });
                throw new Error('無效的擊殺記錄 ID，請選擇其他物品！');
            }

            // 檢查是否存在拍賣
            const existingAuction = await checkExistingAuction(kill_id);
            if (existingAuction) {
                if (['active', 'pending'].includes(existingAuction.status)) {
                    throw new Error(`該物品的拍賣正在進行中（狀態：${existingAuction.status}），無法創建新拍賣。請查看現有拍賣（ID: ${existingAuction._id}）。`);
                } else if (existingAuction.status === 'completed') {
                    throw new Error(`該物品的拍賣已結算（狀態：completed），但尚未完成交易。請先完成交易（ID: ${existingAuction._id}）或聯繫管理員取消拍賣。`);
                }
            }

            // 解析限制條件標籤
            const restrictions = {
                sameWorld: false,
                hasAttended: false,
                dkpThreshold: 0,
                sameGuild: false,
            };

            // 從 restrictionsTags 中解析標籤
            if (values.restrictionsTags) {
                values.restrictionsTags.forEach(tag => {
                    if (tag === '同世界') restrictions.sameWorld = true;
                    if (tag === '參加戰役') restrictions.hasAttended = true;
                    if (tag === '同旅團') restrictions.sameGuild = true;
                    if (tag.startsWith('DKP>')) {
                        const dkpValue = parseInt(tag.replace('DKP>', ''));
                        if (!isNaN(dkpValue) && dkpValue >= 0) {
                            restrictions.dkpThreshold = dkpValue;
                        }
                    }
                });
            }

            logger.info('Submitting auction form', { kill_id, startingPrice, buyoutPrice, endTime, auctionType, restrictions });
            const res = await axios.post(`${BASE_URL}/api/auctions/${kill_id}/start`, {
                startingPrice,
                buyoutPrice,
                duration: moment.duration(endTime.diff(moment())).asHours(),
                auctionType,
                itemIndex: 0, // 假設 BossKill 記錄中只有一個 dropped_items，索引為 0
                restrictions, // 傳遞限制條件
            }, {
                headers: { 'x-auth-token': token },
            });
            logger.info('Auction creation response', { response: res.data });
            message.success('競標創建成功！');
            form.resetFields();
            setDate(null);
            setAuctionType('open');
            setSelectedItem(null);
            setExistingAuction(null);
            navigate('/auction');
        } catch (err) {
            logger.error('Create auction error', { error: err.response?.data || err.message, stack: err.stack });
            const errorMsg = err.response?.data?.msg || err.message || '服務器錯誤，請稍後重試';
            if (errorMsg.includes('拍賣正在進行中') || errorMsg.includes('尚未完成交易')) {
                message.error(
                    <span>
                        {errorMsg}
                        <Button
                            type="link"
                            onClick={() => navigate(`/auction/${existingAuction._id}`)}
                            style={{ padding: 0, marginLeft: 8 }}
                        >
                            查看拍賣
                        </Button>
                        {existingAuction?.status === 'completed' && (
                            <Button
                                type="link"
                                onClick={async () => {
                                    try {
                                        await axios.put(`${BASE_URL}/api/auctions/${existingAuction._id}/complete-transaction`, {}, {
                                            headers: { 'x-auth-token': token },
                                        });
                                        message.success('交易已完成，您可以重新創建拍賣！');
                                        setExistingAuction(null);
                                        fetchAuctionableItems();
                                    } catch (completeErr) {
                                        message.error(`完成交易失敗: ${completeErr.response?.data?.msg || completeErr.message}`);
                                    }
                                }}
                                style={{ padding: 0, marginLeft: 8 }}
                            >
                                完成交易
                            </Button>
                        )}
                    </span>,
                    5
                );
            } else {
                message.error(`創建失敗: ${errorMsg}`);
            }
        } finally {
            setLoading(false);
        }
    };

    const [date, setDate] = useState(null); // 預設截止時間為空

    // 預設截止時間選項
    const presetDurations = [
        { label: '1 小時', value: moment().add(1, 'hour') },
        { label: '24 小時', value: moment().add(24, 'hours') },
        { label: '3 天', value: moment().add(3, 'days') },
        { label: '7 天', value: moment().add(7, 'days') },
    ];

    const handlePresetDuration = (preset) => {
        setDate(preset);
        form.setFieldsValue({ endTime: preset });
    };

    const handleItemChange = (value) => {
        const item = items.find(option => option.value === value);
        setSelectedItem(item);
        form.setFieldsValue({ item: value });
        // 根據物品等級動態建議起始價格
        if (item.level?.level === '傳說') {
            form.setFieldsValue({ startingPrice: 5000 });
        } else if (item.level?.level === '史詩') {
            form.setFieldsValue({ startingPrice: 2000 });
        } else if (item.level?.level === '英雄') {
            form.setFieldsValue({ startingPrice: 3000 });
        } else {
            form.setFieldsValue({ startingPrice: 1000 });
        }
        // 檢查是否存在拍賣
        checkExistingAuction(item.kill_id);
    };

    // 預設限制條件選項
    const restrictionOptions = [
        { label: '同世界', value: '同世界' },
        { label: '參加戰役', value: '參加戰役' },
        { label: '同旅團', value: '同旅團' },
    ];

    return (
        <ErrorBoundary>
            <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
                <Card
                    title={<Title level={3} style={{ margin: 0, color: '#1890ff' }}>發起新競標</Title>}
                    bordered={false}
                    style={{ boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)', borderRadius: '8px' }}
                    extra={
                        deferredPrompt && (
                            <Button type="link" onClick={handleInstallPWA}>
                                安裝應用
                            </Button>
                        )
                    }
                >
                    <Spin spinning={loading}>
                        <Form
                            form={form}
                            name="createAuction"
                            onFinish={onFinish}
                            layout="vertical"
                            initialValues={{
                                startingPrice: 100,
                                endTime: null,
                                restrictionsTags: [], // 預設為空標籤
                            }}
                            requiredMark={true}
                        >
                            <motion.div initial="hidden" animate="visible" variants={fadeIn}>
                                <Row gutter={[16, 16]}>
                                    <Col xs={24} sm={12}>
                                        <Form.Item
                                            name="item"
                                            label={
                                                <Tooltip title="選擇要競標的物品，物品詳情將顯示在下方">
                                                    <Text strong>
                                                        選擇物品 <TagOutlined style={{ color: '#1890ff' }} /> <QuestionCircleOutlined style={{ color: '#1890ff' }} />
                                                    </Text>
                                                </Tooltip>
                                            }
                                            rules={[{ required: true, message: '請選擇物品！' }]}
                                            hasFeedback
                                        >
                                            <Select
                                                placeholder="請選擇物品"
                                                onChange={handleItemChange}
                                                showSearch
                                                filterOption={(input, option) =>
                                                    option.label.toLowerCase().indexOf(input.toLowerCase()) !== -1
                                                }
                                                style={{ width: '100%', transition: 'all 0.3s' }}
                                                disabled={items.length === 0}
                                            >
                                                {items.map(item => (
                                                    <Option key={item.value} value={item.value}>
                                                        <span
                                                            style={{
                                                                color: colorMapping[item.level?.color] || '#000',
                                                                padding: '2px 4px',
                                                                borderRadius: '4px',
                                                                background: colorMapping[item.level?.color] === '#666' ? '#f0f0f0' : 'transparent',
                                                                transition: 'all 0.3s',
                                                            }}
                                                        >
                                                            {item.label}
                                                        </span>
                                                    </Option>
                                                ))}
                                            </Select>
                                        </Form.Item>
                                        {selectedItem && (
                                            <motion.div
                                                initial={{ opacity: 0, height: 0 }}
                                                animate={{ opacity: 1, height: 'auto' }}
                                                transition={{ duration: 0.3 }}
                                                style={{
                                                    background: '#f5f5f5',
                                                    padding: '12px',
                                                    borderRadius: '4px',
                                                    marginBottom: '16px',
                                                    border: '1px solid #e8e8e8',
                                                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.05)',
                                                }}
                                            >
                                                <Text strong>物品詳情</Text>
                                                <Divider style={{ margin: '8px 0' }} />
                                                <Text>首領名稱: {selectedItem.boss_name}</Text><br />
                                                <Text>
                                                    物品名稱: <span
                                                        style={{
                                                            color: colorMapping[selectedItem.level?.color] || '#000',
                                                            padding: '2px 4px',
                                                            borderRadius: '4px',
                                                            background: colorMapping[selectedItem.level?.color] === '#666' ? '#f0f0f0' : 'transparent',
                                                        }}
                                                    >
                                                        {selectedItem.item_name}
                                                    </span>
                                                </Text><br />
                                                <Text>申請截止時間: {moment(selectedItem.apply_deadline).format('YYYY-MM-DD HH:mm')}</Text><br />
                                                {selectedItem.image_url && (
                                                    <img
                                                        src={selectedItem.image_url}
                                                        alt={selectedItem.item_name}
                                                        style={{ width: '100px', height: '100px', objectFit: 'cover', marginTop: '8px', borderRadius: '4px' }}
                                                    />
                                                )}
                                            </motion.div>
                                        )}
                                        {items.length === 0 && (
                                            <Alert
                                                message="無可競標物品"
                                                description="目前沒有可競標的物品，請檢查擊殺記錄或聯繫管理員。"
                                                type="warning"
                                                showIcon
                                                style={{ marginBottom: '16px' }}
                                            />
                                        )}
                                    </Col>
                                    <Col xs={24} sm={12}>
                                        <Form.Item
                                            name="auctionType"
                                            label={
                                                <Tooltip title="選擇拍賣類型：明標（公開出價）、暗標（隱藏出價）、抽籤（隨機分配）">
                                                    <Text strong>
                                                        拍賣類型 <InfoCircleOutlined style={{ color: '#1890ff' }} /> <QuestionCircleOutlined style={{ color: '#1890ff' }} />
                                                    </Text>
                                                </Tooltip>
                                            }
                                            rules={[{ required: true, message: '請選擇拍賣類型！' }]}
                                            hasFeedback
                                        >
                                            <Select
                                                value={auctionType}
                                                onChange={(value) => setAuctionType(value)}
                                                style={{ width: '100%', transition: 'all 0.3s' }}
                                            >
                                                <Option value="open">明標</Option>
                                                <Option value="blind">暗標</Option>
                                                <Option value="lottery">抽籤</Option>
                                            </Select>
                                        </Form.Item>
                                    </Col>
                                    <Col xs={24} sm={12}>
                                        <Form.Item
                                            name="startingPrice"
                                            label={
                                                <Tooltip title="起標價格是競標的起始價格，必須在 100-9999 鑽石之間">
                                                    <Text strong>
                                                        {auctionType === 'lottery' ? "抽籤價格 (鑽石)" : "起標價格 (鑽石)"} <DollarOutlined style={{ color: '#1890ff' }} /> <QuestionCircleOutlined style={{ color: '#1890ff' }} />
                                                    </Text>
                                                </Tooltip>
                                            }
                                            rules={[
                                                { required: true, message: '請輸入價格！' },
                                                {
                                                    validator: (_, value) => {
                                                        const numValue = parseInt(value);
                                                        if (isNaN(numValue)) return Promise.reject(new Error('請輸入有效的數字！'));
                                                        if (numValue < 100) return Promise.reject(new Error('價格最低為 100 鑽石！'));
                                                        if (numValue > 9999) return Promise.reject(new Error('價格最高為 9999 鑽石！'));
                                                        return Promise.resolve();
                                                    },
                                                },
                                            ]}
                                            hasFeedback
                                        >
                                            <Input
                                                type="number"
                                                placeholder="輸入 100-9999 鑽石"
                                                onKeyPress={(e) => {
                                                    const charCode = e.which ? e.which : e.keyCode;
                                                    if (charCode < 48 || charCode > 57) e.preventDefault();
                                                }}
                                                min={100}
                                                max={9999}
                                                style={{ width: '100%', transition: 'all 0.3s' }}
                                            />
                                        </Form.Item>
                                    </Col>
                                    {auctionType !== 'lottery' && (
                                        <Col xs={24} sm={12}>
                                            <Form.Item
                                                name="buyoutPrice"
                                                label={
                                                    <Tooltip title="直接得標價是可選的，必須大於起標價格">
                                                        <Text strong>
                                                            直接得標價 (鑽石，可選) <DollarOutlined style={{ color: '#1890ff' }} /> <QuestionCircleOutlined style={{ color: '#1890ff' }} />
                                                        </Text>
                                                    </Tooltip>
                                                }
                                                rules={[
                                                    {
                                                        validator: (_, value) => {
                                                            if (!value) return Promise.resolve();
                                                            const numValue = parseInt(value);
                                                            const startingPrice = parseInt(form.getFieldValue('startingPrice'));
                                                            if (isNaN(numValue)) return Promise.reject(new Error('請輸入有效的數字！'));
                                                            if (numValue <= startingPrice) return Promise.reject(new Error('直接得標價必須大於起標價格！'));
                                                            return Promise.resolve();
                                                        },
                                                    },
                                                ]}
                                                hasFeedback
                                            >
                                                <Input
                                                    type="number"
                                                    placeholder="輸入直接得標價（大於起標價格）"
                                                    onKeyPress={(e) => {
                                                        const charCode = e.which ? e.which : e.keyCode;
                                                        if (charCode < 48 || charCode > 57) e.preventDefault();
                                                    }}
                                                    min={100}
                                                    style={{ width: '100%', transition: 'all 0.3s' }}
                                                />
                                            </Form.Item>
                                        </Col>
                                    )}
                                    <Col xs={24} sm={12}>
                                        <Form.Item
                                            name="endTime"
                                            label={
                                                <Tooltip title="選擇競標的截止時間，必須至少在 1 小時後">
                                                    <Text strong>
                                                        截止時間 <ClockCircleOutlined style={{ color: '#1890ff' }} /> <QuestionCircleOutlined style={{ color: '#1890ff' }} />
                                                    </Text>
                                                </Tooltip>
                                            }
                                            rules={[
                                                { required: true, message: '請選擇截止時間！' },
                                                {
                                                    validator: (_, value) => {
                                                        if (!value || !moment(value).isValid()) {
                                                            return Promise.reject(new Error('請選擇有效的截止時間！'));
                                                        }
                                                        const now = moment();
                                                        const selectedTime = value;
                                                        if (selectedTime.isBefore(now.add(1, 'hour'))) {
                                                            return Promise.reject(new Error('截止時間必須至少在 1 小時後！'));
                                                        }
                                                        return Promise.resolve();
                                                    },
                                                },
                                            ]}
                                            hasFeedback
                                        >
                                            <Space direction="vertical" style={{ width: '100%' }}>
                                                <DatePicker
                                                    placeholder="選擇截止時間（至少 1 小時後）"
                                                    value={date}
                                                    onChange={(date) => {
                                                        setDate(date);
                                                        form.setFieldsValue({ endTime: date });
                                                    }}
                                                    style={{ width: '100%', transition: 'all 0.3s' }}
                                                    getPopupContainer={trigger => trigger.parentElement}
                                                />
                                                <Space wrap>
                                                    {presetDurations.map(preset => (
                                                        <Button
                                                            key={preset.label}
                                                            onClick={() => handlePresetDuration(preset.value)}
                                                            size="small"
                                                            style={{ marginTop: '8px', transition: 'all 0.3s' }}
                                                        >
                                                            {preset.label}
                                                        </Button>
                                                    ))}
                                                </Space>
                                            </Space>
                                        </Form.Item>
                                    </Col>
                                    {/* 限制條件字段 */}
                                    <Col xs={24}>
                                        <Divider orientation="left">競標限制條件</Divider>
                                    </Col>
                                    <Col xs={24}>
                                        <Form.Item
                                            name="restrictionsTags"
                                            label={
                                                <Tooltip title="輸入競標限制條件，例如：同世界、參加戰役、同旅團、DKP>1000">
                                                    <Text strong>
                                                        競標限制條件 <QuestionCircleOutlined style={{ color: '#1890ff' }} />
                                                    </Text>
                                                </Tooltip>
                                            }
                                            rules={[
                                                {
                                                    validator: (_, value) => {
                                                        if (value && value.some(tag => tag.startsWith('DKP>'))) {
                                                            const dkpTags = value.filter(tag => tag.startsWith('DKP>'));
                                                            for (const tag of dkpTags) {
                                                                const dkpValue = parseInt(tag.replace('DKP>', ''));
                                                                if (isNaN(dkpValue) || dkpValue < 0) {
                                                                    return Promise.reject(new Error('DKP 限制必須為有效的正數，例如 DKP>1000'));
                                                                }
                                                            }
                                                        }
                                                        return Promise.resolve();
                                                    },
                                                },
                                            ]}
                                        >
                                            <Select
                                                mode="tags"
                                                placeholder="輸入限制條件（例如：同世界、參加戰役、同旅團、DKP>1000）"
                                                style={{ width: '100%' }}
                                                tokenSeparators={[',']}
                                                dropdownStyle={{ minWidth: '200px' }}
                                            >
                                                {restrictionOptions.map(option => (
                                                    <Option key={option.value} value={option.value}>
                                                        {option.label}
                                                    </Option>
                                                ))}
                                            </Select>
                                        </Form.Item>
                                    </Col>
                                </Row>
                                <Form.Item>
                                    <Space direction="vertical" style={{ width: '100%' }}>
                                        <Button
                                            type="primary"
                                            htmlType="submit"
                                            disabled={loading || !online || items.length === 0}
                                            style={{ width: '100%', height: '40px', fontSize: '16px', transition: 'all 0.3s' }}
                                        >
                                            {loading ? '創建中...' : '創建競標'}
                                        </Button>
                                        {!online && (
                                            <Alert
                                                message="離線模式"
                                                description="目前處於離線模式，無法創建競標，請檢查網絡後重試。"
                                                type="warning"
                                                showIcon
                                            />
                                        )}
                                        <Button
                                            type="default"
                                            onClick={() => navigate('/kill-history')}
                                            style={{ width: '100%', height: '40px', fontSize: '16px', transition: 'all 0.3s' }}
                                        >
                                            返回擊殺記錄列表
                                        </Button>
                                    </Space>
                                </Form.Item>
                            </motion.div>
                        </Form>
                    </Spin>
                </Card>
            </div>
        </ErrorBoundary>
    );
};

export default CreateAuction;