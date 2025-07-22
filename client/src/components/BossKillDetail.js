// components/BossKillDetail.js
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Form, InputNumber, Button, Select, Checkbox, Tooltip, message } from 'antd';
import axios from 'axios';
import CreateAuction from './CreateAuction';
import logger from '../utils/logger';

const BASE_URL = process.env.REACT_APP_API_URL || '';

const BossKillDetail = () => {
    const { killId } = useParams(); // 從 URL 獲取 killId
    const navigate = useNavigate();
    const [bossKill, setBossKill] = useState(null);
    const [showCreateAuction, setShowCreateAuction] = useState(false);
    const token = localStorage.getItem('token');

    useEffect(() => {
        // 檢查 killId 是否有效
        if (!killId || killId === 'undefined') {
            logger.error('Invalid killId in BossKillDetail', { killId });
            navigate('/error', { state: { message: '無效的擊殺記錄 ID，請選擇有效的擊殺記錄！' } });
            return;
        }

        const fetchBossKill = async () => {
            try {
                const res = await axios.get(`${BASE_URL}/api/boss-kills/${killId}`, {
                    headers: { 'x-auth-token': token },
                });
                setBossKill(res.data);
            } catch (err) {
                logger.error('Fetch boss kill error in BossKillDetail', { error: err.message, stack: err.stack });
                navigate('/error', { state: { message: '無法獲取擊殺記錄，請稍後重試！' } });
            }
        };
        fetchBossKill();
    }, [killId, token, navigate]);

    const handleCreateAuctionSuccess = () => {
        setShowCreateAuction(false);
        fetchBossKill(); // 重新獲取數據以更新頁面
    };

    const handleCreateAuctionCancel = () => {
        setShowCreateAuction(false);
    };

    const fetchBossKill = async () => {
        try {
            const res = await axios.get(`${BASE_URL}/api/boss-kills/${killId}`, {
                headers: { 'x-auth-token': token },
            });
            setBossKill(res.data);
        } catch (err) {
            logger.error('Fetch boss kill error in BossKillDetail', { error: err.message, stack: err.stack });
            navigate('/error', { state: { message: '無法獲取擊殺記錄，請稍後重試！' } });
        }
    };

    if (!bossKill) {
        return <div>加載中...</div>;
    }

    return (
        <div style={{ padding: '20px' }}>
            <h1 style={{ fontSize: '20px', fontWeight: 'bold', color: '#1890ff' }}>
                擊殺記錄詳情 - {bossKill.boss_name}
            </h1>
            <p>狀態：{bossKill.status}</p>
            <p>拍賣狀態：{bossKill.auction_status}</p>
            <h2 style={{ fontSize: '16px', fontWeight: 'bold', color: '#1890ff', marginTop: '16px' }}>
                掉落物品
            </h2>
            {bossKill.dropped_items && bossKill.dropped_items.length > 0 ? (
                bossKill.dropped_items.map((item, index) => (
                    <div key={index} style={{ marginBottom: '8px' }}>
                        <p>物品名稱：{item.name}</p>
                        {item.image_url && <img src={item.image_url} alt={item.name} style={{ width: '100px', height: '100px' }} />}
                    </div>
                ))
            ) : (
                <p>無掉落物品</p>
            )}

            {bossKill.auction_status === 'pending' && (
                <Button type="primary" onClick={() => setShowCreateAuction(true)} style={{ marginTop: '16px' }}>
                    發起競標
                </Button>
            )}

            {showCreateAuction && (
                <CreateAuction
                    killId={killId}
                    onSuccess={handleCreateAuctionSuccess}
                    onCancel={handleCreateAuctionCancel}
                />
            )}
        </div>
    );
};

export default BossKillDetail;