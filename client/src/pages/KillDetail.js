import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { Card, Spin, message, Image } from 'antd';
import moment from 'moment';
import logger from '../utils/logger'; // 引入前端日誌工具

const BASE_URL = process.env.REACT_APP_API_URL || '';

const KillDetail = () => {
    const { id } = useParams();
    const [detail, setDetail] = useState(null);
    const [loading, setLoading] = useState(false);
    const token = localStorage.getItem('token');

    useEffect(() => {
        const fetchDetail = async () => {
            setLoading(true);
            try {
                const res = await axios.get(`${BASE_URL}/api/boss-kills/${id}`, {
                    headers: { 'x-auth-token': token },
                });
                setDetail(res.data);
            } catch (err) {
                console.error('Fetch kill detail error:', err);
                message.error(`載入詳情失敗: ${err.response?.data?.msg || err.message}`);
            } finally {
                setLoading(false);
            }
        };
        fetchDetail();
    }, [id, token]);

    if (loading) return <Spin />;
    if (!detail) return <div>無數據</div>;

    return (
        <Card title={`擊殺記錄詳情 (ID: ${id})`}>
            <p>首領名稱: {detail.boss_name || '未知首領'}</p>
            <p>擊殺時間: {moment(detail.kill_time).format('YYYY-MM-DD HH:mm')}</p>
            <p>狀態: {detail.status}</p>
            <p>掉落物品: {detail.dropped_items.map(item => item.name).join(', ') || '無'}</p>
            <p>參與者: {detail.attendees?.join(', ') || '無'}</p>
            <p>最終獲得者: {detail.final_recipient || '未分配'}</p>
            <Image.PreviewGroup>
                {detail.screenshots.map((src, index) => (
                    <Image
                        key={index}
                        src={src}
                        alt={`截圖 ${index + 1}`}
                        style={{ width: '200px', marginRight: '8px' }}
                    />
                ))}
            </Image.PreviewGroup>
        </Card>
    );
};

export default KillDetail;