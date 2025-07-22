import React, { useState, useEffect } from 'react';
import { Card, Button, Modal, message, Tag, Image, Tooltip, Popconfirm } from 'antd';
import axios from 'axios';
import moment from 'moment';
import { useNavigate } from 'react-router-dom';
import formatNumber from '../utils/formatNumber';
import logger from '../utils/logger'; // 引入前端日誌工具
import 'moment/locale/zh-tw';
moment.locale('zh-tw');

const BASE_URL = process.env.REACT_APP_API_URL || '';

const statusMap = {
    active: '活躍',
    pending: '待處理',
    completed: '已完成',
    cancelled: '已取消',
    settled: '已結算', // 新增 settled 狀態
    unknown: '未知',
};

const colorMapping = {
    '白色': '#f0f0f0',
    '綠色': '#00cc00',
    '藍色': '#1e90ff',
    '紅色': '#EC3636',
    '紫色': '#B931F3',
    '金色': '#ffeb3b',
};

const WonAuctionList = () => {
    const [wonAuctions, setWonAuctions] = useState([]);
    const [userId, setUserId] = useState(null);
    const navigate = useNavigate();
    const token = localStorage.getItem('token');

    useEffect(() => {
        fetchUserInfo();
        fetchWonAuctions();
    }, []);

    const fetchUserInfo = async () => {
        try {
            const res = await axios.get(`${BASE_URL}/api/users/me`, {
                headers: { 'x-auth-token': token },
            });
            setUserId(res.data.id);
        } catch (err) {
            console.error('Fetch user info error:', err);
            message.error('無法獲取用戶信息，請重新登錄');
            navigate('/login');
        }
    };

    const fetchWonAuctions = async () => {
        try {
            const res = await axios.get(`${BASE_URL}/api/auctions/won`, {
                headers: { 'x-auth-token': token },
            });
            setWonAuctions(res.data);
        } catch (err) {
            console.error('Fetch won auctions error:', err);
            message.error('無法獲取得標拍賣列表，請刷新頁面後重試！');
            setWonAuctions([]);
        }
    };

    const getStatusTag = (status) => {
        let color, text;
        switch (status) {
            case 'active':
                color = 'green';
                text = '活躍';
                break;
            case 'pending':
                color = 'orange';
                text = '待處理（餘額不足）';
                break;
            case 'completed':
                color = 'blue';
                text = '已結算';
                break;
            case 'cancelled':
                color = 'red';
                text = '已取消';
                break;
            case 'settled':
                color = 'purple';
                text = '已結算';
                break;
            default:
                color = 'default';
                text = statusMap[status] || statusMap['unknown'];
        }
        return (
            <Tag
                color={color}
                style={{
                    borderRadius: '12px',
                    padding: '2px 12px',
                    fontWeight: 'bold',
                    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
                }}
            >
                {text}
            </Tag>
        );
    };

    const handleCompleteTransaction = async (auctionId) => {
        try {
            const res = await axios.put(`${BASE_URL}/api/auctions/${auctionId}/complete-transaction`, {}, {
                headers: { 'x-auth-token': token },
            });
            message.success(res.data.msg);
            fetchWonAuctions(); // 刷新得標列表
        } catch (err) {
            console.error('Complete transaction error:', err.response?.data || err);
            message.error(err.response?.data?.msg || '回報交易完成失敗，請稍後重試！');
        }
    };

    return (
        <div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
                {wonAuctions.map(auction => {
                    const levelColor = auction.level ? colorMapping[auction.level.color] || '#000000' : '#000000';
                    const endTime = auction.endTime ? moment(auction.endTime).format('MM-DD HH:mm') : '無截止時間';
                    const remainingTime = auction.endTime
                        ? moment(auction.endTime).diff(moment()) <= 0
                            ? '已結束'
                            : `${Math.floor(moment.duration(moment(auction.endTime).diff(moment())).asHours())}小時${moment.duration(moment(auction.endTime).diff(moment())).minutes()}分`
                        : '無截止時間';
                    const isCreator = auction.createdBy._id === userId;

                    return (
                        <Card
                            key={auction._id}
                            hoverable
                            style={{
                                borderRadius: '8px',
                                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
                                backgroundColor: '#fff',
                            }}
                            cover={
                                <div style={{ position: 'relative', width: '100%', paddingTop: '66.67%' }}>
                                    <Image
                                        src={`${BASE_URL}/${auction.imageUrl.replace(/\\/g, '/')}`}
                                        alt={auction.itemName}
                                        style={{
                                            position: 'absolute',
                                            top: 0,
                                            left: 0,
                                            width: '100%',
                                            height: '100%',
                                            objectFit: 'cover',
                                        }}
                                        onError={(e) => {
                                            console.error(`Image load error for ${auction.imageUrl}:`, e);
                                            message.warning('圖片加載失敗，使用占位圖');
                                        }}
                                    />
                                    {auction.status === 'active' && (
                                        <div
                                            style={{
                                                position: 'absolute',
                                                bottom: '0px',
                                                right: '0px',
                                                backgroundColor: 'rgba(48, 189, 106, 0.93)',
                                                color: 'white',
                                                padding: '3px 6px',
                                                borderRadius: '0px',
                                                fontSize: '12px',
                                                zIndex: 2,
                                            }}
                                        >
                                            {remainingTime}
                                        </div>
                                    )}
                                    <div
                                        style={{
                                            position: 'absolute',
                                            top: '50%',
                                            left: '50%',
                                            transform: 'translate(-50%, -50%)',
                                            color: 'rgba(255, 255, 255, 0.97)',
                                            fontSize: '18px',
                                            fontWeight: 'bold',
                                            background: 'rgba(0, 0, 0, 0.5)',
                                            padding: '8px 16px',
                                            borderRadius: '8px',
                                            wordBreak: 'break-all',
                                            lineHeight: '1.5',
                                            width: '80%',
                                            textShadow: '1px 1px 2px rgb(255, 255, 255)',
                                            textAlign: 'center',
                                        }}
                                    >
                                        [{endTime}]<br />
                                        <span style={{ color: levelColor }}>{auction.itemName || '未知物品'}</span>
                                    </div>
                                </div>
                            }
                            actions={[
                                isCreator && auction.status === 'completed' && (
                                    <Popconfirm
                                        title="確認交易已完成？"
                                        onConfirm={() => handleCompleteTransaction(auction._id)}
                                        okText="是"
                                        cancelText="否"
                                    >
                                        <Button type="primary">交易完成請按我</Button>
                                    </Popconfirm>
                                ),
                            ].filter(Boolean)}
                        >
                            <Card.Meta
                                description={
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                        {/* 得標金額 */}
                                        <div>
                                            <span style={{ fontWeight: 'bold' }}>得標金額：</span>
                                            <span style={{ color: '#1890ff' }}>{formatNumber(auction.currentPrice)} 💎</span>
                                        </div>
                                        {/* 物品持有人 */}
                                        <div>
                                            <span style={{ fontWeight: 'bold' }}>物品持有人：</span>
                                            <span>{auction.createdBy.character_name}</span>
                                        </div>
                                        {/* 聯絡方式 */}
                                        <div>
                                            <span style={{ fontWeight: 'bold' }}>聯絡方式：</span>
                                            <div>
                                                {auction.createdBy.lineId && (
                                                    <div>LINE: {auction.createdBy.lineId}</div>
                                                )}
                                                {auction.createdBy.discordId && (
                                                    <div>Discord: {auction.createdBy.discordId}</div>
                                                )}
                                                {!auction.createdBy.lineId && !auction.createdBy.discordId && (
                                                    <div>無聯絡方式</div>
                                                )}
                                            </div>
                                        </div>
                                        {/* 狀態 */}
                                        <div>
                                            <span style={{ fontWeight: 'bold' }}>狀態：</span>
                                            {getStatusTag(auction.status)}
                                        </div>
                                    </div>
                                }
                            />
                        </Card>
                    );
                })}
            </div>
        </div>
    );
};

export default WonAuctionList;