import React, { useState, useEffect } from 'react';
import { Card, Button, Modal, Input, Tag, Image, Tooltip, Popconfirm, Table } from 'antd';
import {
  InfoCircleOutlined,
  DiscordOutlined,
  TrophyOutlined,
  GiftOutlined,
  HistoryOutlined,
  CheckCircleOutlined,
  DollarOutlined,
  CloseCircleOutlined,
  SyncOutlined,
  DollarCircleOutlined,
  AuditOutlined,
  UserOutlined,
  ExclamationCircleOutlined,
  EyeOutlined,
  EyeInvisibleOutlined,
} from '@ant-design/icons';
import axios from 'axios';
import moment from 'moment';
import { useNavigate } from 'react-router-dom';
import formatNumber from '../utils/formatNumber';
import 'moment/locale/zh-tw';
import logger from '../utils/logger';
moment.locale('zh-tw');

const BASE_URL = process.env.REACT_APP_API_URL || '';

const statusMap = {
  active: '活躍',
  pending: '待處理',
  completed: '已完成',
  cancelled: '已取消',
  settled: '已結算',
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

const AuctionList = ({ auctions, fetchAuctions, userRole, userId, handleSettleAuction, isWonTab = false }) => {
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [selectedAuction, setSelectedAuction] = useState(null);
  const [bidAmount, setBidAmount] = useState('');
  const [bids, setBids] = useState({});
  const [userDiamonds, setUserDiamonds] = useState(0);
  const [characterName, setCharacterName] = useState(null);
  const [historyModalVisible, setHistoryModalVisible] = useState(false);
  const [selectedAuctionId, setSelectedAuctionId] = useState(null);
  const [localUserRole, setLocalUserRole] = useState(null);
  const [errorModalVisible, setErrorModalVisible] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successModalVisible, setSuccessModalVisible] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const navigate = useNavigate();
  const token = localStorage.getItem('token');

  useEffect(() => {
    fetchUserInfo();
  }, [auctions, token]);

  const fetchUserInfo = async () => {
    try {
      const res = await axios.get(`${BASE_URL}/api/users/me`, {
        headers: { 'x-auth-token': token },
      });
      setUserDiamonds(res.data.diamonds || 0);
      setCharacterName(res.data.character_name);
      setLocalUserRole(res.data.roles && res.data.roles.includes('admin') ? 'admin' : 'user');
      logger.info('Fetched user info in AuctionList', { userId: res.data.id, character_name: res.data.character_name, roles: res.data.roles });
    } catch (err) {
      logger.error('Fetch user info error in AuctionList', { error: err.message, stack: err.stack });
      setErrorMessage('無法獲取用戶信息，請重新登錄');
      setErrorModalVisible(true);
      navigate('/login');
    }
  };

  const fetchBids = async (auctionId) => {
    try {
      const res = await axios.get(`${BASE_URL}/api/auctions/${auctionId}/bids`, {
        headers: { 'x-auth-token': token },
      });
      logger.info(`Fetched bids for auction ${auctionId}`, { count: res.data.length });
      setBids(prev => ({ ...prev, [auctionId]: res.data }));
    } catch (err) {
      logger.error(`Error fetching bids for auction ${auctionId}`, { error: err.response?.data || err.message, stack: err.stack });
      setErrorMessage('無法獲取下標歷史，請刷新頁面後重試！');
      setErrorModalVisible(true);
      setBids(prev => ({ ...prev, [auctionId]: [] }));
    }
  };

  const sendSystemNotification = async (userIdToNotify, auctionId, itemName, amount) => {
    try {
      const messageContent = `您已成功投得競標 [${auctionId}] 的物品 [${itemName}]，得標金額為 ${formatNumber(amount)} 💎。`;
      const res = await axios.post(
        `${BASE_URL}/api/notifications`,
        {
          userId: userIdToNotify,
          message: messageContent,
          type: 'system',
          auctionId,
        },
        { headers: { 'x-auth-token': token } }
      );
      logger.info('System notification sent', { userId: userIdToNotify, auctionId });
    } catch (err) {
      logger.error('Send system notification error', { error: err.response?.data || err.message, stack: err.stack });
      setErrorMessage('系統消息發送失敗，但競標操作已完成');
      setErrorModalVisible(true);
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
        text = '待處理';
        break;
      case 'completed':
        color = 'blue';
        text = '已完成';
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

  const getAuctionTypeIcon = (auctionType) => {
    switch (auctionType) {
      case 'open':
        return <EyeOutlined style={{ color: '#1890ff', fontSize: '18px' }} />;
      case 'blind':
        return <EyeInvisibleOutlined style={{ color: '#1890ff', fontSize: '18px' }} />;
      case 'lottery':
        return <GiftOutlined style={{ color: '#1890ff', fontSize: '18px' }} />;
      default:
        return null;
    }
  };

  const getRestrictionTags = (restrictions) => {
    const tags = [];
    if (restrictions.sameWorld) {
      tags.push('同世界');
    }
    if (restrictions.hasAttended) {
      tags.push('有出席');
    }
    if (restrictions.dkpThreshold > 0) {
      tags.push(`DKP>${restrictions.dkpThreshold}`);
    }
    if (restrictions.sameGuild) {
      tags.push('同旅團');
    }
    return tags;
  };

  const handleCancelAuction = async (auctionId) => {
    try {
      logger.info('User clicked cancel auction button', { auctionId, userId });
      const res = await axios.put(`${BASE_URL}/api/auctions/${auctionId}/cancel`, {}, {
        headers: { 'x-auth-token': token },
      });
      setSuccessMessage(res.data.msg);
      setSuccessModalVisible(true);
      logger.info('Auction cancelled successfully', { auctionId, userId, response: res.data });
      fetchAuctions();
    } catch (err) {
      logger.error('Cancel auction error', { auctionId, userId, error: err.response?.data || err.message, stack: err.stack });
      setErrorMessage(`取消拍賣失敗: ${err.response?.data?.msg || err.message}`);
      setErrorModalVisible(true);
    }
  };

  const handleReassignAuction = async (auctionId) => {
    try {
      logger.info('User clicked reassign auction button', { auctionId, userId });
      const res = await axios.put(`${BASE_URL}/api/auctions/${auctionId}/reassign`, {}, {
        headers: { 'x-auth-token': token },
      });
      setSuccessMessage(res.data.msg);
      setSuccessModalVisible(true);
      logger.info('Auction reassigned successfully', { auctionId, userId, response: res.data });
      fetchAuctions();
    } catch (err) {
      logger.error('Reassign auction error', { auctionId, userId, error: err.response?.data || err.message, stack: err.stack });
      setErrorMessage(`重新分配拍賣失敗: ${err.response?.data?.msg || err.message}`);
      setErrorModalVisible(true);
    }
  };

  const handleCompleteTransaction = async (auctionId) => {
    try {
      logger.info('User clicked complete transaction button', { auctionId, userId, characterName });
      const res = await axios.put(`${BASE_URL}/api/auctions/${auctionId}/complete-transaction`, {}, {
        headers: { 'x-auth-token': token },
      });
      setSuccessMessage(res.data.msg);
      setSuccessModalVisible(true);
      logger.info('Transaction completed successfully', { auctionId, userId, characterName, response: res.data });
      fetchAuctions();
    } catch (err) {
      logger.error('Complete transaction error', { auctionId, userId, characterName, error: err.response?.data || err.message, stack: err.stack });
      setErrorMessage(`回報交易完成失敗: ${err.response?.data?.msg || err.message}`);
      setErrorModalVisible(true);
    }
  };

  const handleBidClick = (auction) => {
    logger.info('User clicked bid button', { auctionId: auction._id, userId });
    if (!auction || !auction._id) {
      setErrorMessage('無法找到拍賣信息，請刷新頁面！');
      setErrorModalVisible(true);
      return;
    }
    setSelectedAuction(auction);
    setIsModalVisible(true);
  };

  const handleRegisterClick = (auction) => {
    logger.info('User clicked register button for lottery', { auctionId: auction._id, userId });
    if (!auction || !auction._id) {
      setErrorMessage('無法找到拍賣信息，請刷新頁面！');
      setErrorModalVisible(true);
      return;
    }
    setSelectedAuction(auction);
    setIsModalVisible(true);
  };

  const handleHistoryClick = (auctionId) => {
    logger.info('User clicked history button', { auctionId, userId });
    setSelectedAuctionId(auctionId);
    fetchBids(auctionId);
    setHistoryModalVisible(true);
  };

  const handleHistoryModalClose = () => {
    setHistoryModalVisible(false);
    setSelectedAuctionId(null);
  };

  const handleBidSubmit = async () => {
    try {
      if (selectedAuction.auctionType === 'lottery') {
        // 抽籤：直接報名
        logger.info('Sending registration request for lottery', { auctionId: selectedAuction._id, userId });
        const res = await axios.post(
          `${BASE_URL}/api/auctions/${selectedAuction._id}/bid`,
          { amount: 0 },
          { headers: { 'x-auth-token': token } }
        );
        setSuccessMessage(res.data.msg || '報名成功！');
        setSuccessModalVisible(true);
        logger.info('Registration successful', { auctionId: selectedAuction._id, userId });
        setIsModalVisible(false);
        fetchAuctions();
      } else {
        // 明標或暗標：處理出價
        if (!bidAmount) {
          throw new Error('請輸入下標金額！');
        }
        if (isNaN(bidAmount) || parseInt(bidAmount) <= 0) {
          throw new Error('下標金額必須為正整數！');
        }

        const bidValue = parseInt(bidAmount);
        const currentPrice = selectedAuction?.currentPrice || 0;

        if (selectedAuction.auctionType === 'open') {
          if (bidValue === currentPrice) {
            throw new Error(`下標金額不能等於當前價格 ${formatNumber(currentPrice)} 💎，請輸入更高的金額！`);
          }
          if (bidValue < currentPrice) {
            throw new Error(`下標金額必須大於當前價格 ${formatNumber(currentPrice)} 💎！`);
          }
        }

        logger.info('Checking auction status before bidding', { auctionId: selectedAuction._id, userId });
        const resCheck = await axios.get(`${BASE_URL}/api/auctions/${selectedAuction._id}`, {
          headers: { 'x-auth-token': token },
        });
        const latestAuction = resCheck.data;
        if (!latestAuction) {
          throw new Error('拍賣不存在');
        }
        if (latestAuction.status !== 'active') {
          throw new Error(`拍賣已結束或被取消，當前狀態為 ${statusMap[latestAuction.status] || latestAuction.status}，無法下標。請刷新頁面後重試。`);
        }

        logger.info('Sending bid request', { auctionId: selectedAuction._id, amount: bidValue, userId });

        const res = await axios.post(
          `${BASE_URL}/api/auctions/${selectedAuction._id}/bid`,
          { amount: bidValue },
          { headers: { 'x-auth-token': token } }
        );

        const finalPrice = res.data.finalPrice || bidValue;
        const isBuyout = res.data.msg.includes('已直接得標');

        if (isBuyout) {
          setSuccessMessage('下標成功，已直接得標！競標已結束。');
          setSuccessModalVisible(true);
          await sendSystemNotification(userId, selectedAuction._id, selectedAuction.itemName, finalPrice);
        } else {
          setSuccessMessage(`下標成功！您已下標 ${formatNumber(finalPrice)} 💎，請確保結算前餘額足夠（當前餘額：${formatNumber(userDiamonds)} 💎）。`);
          setSuccessModalVisible(true);
        }

        await fetchAuctions();
        await fetchBids(selectedAuction._id);

        if (historyModalVisible && selectedAuctionId === selectedAuction._id) {
          setHistoryModalVisible(false);
          setTimeout(() => {
            setHistoryModalVisible(true);
          }, 0);
        }

        setIsModalVisible(false);
        setBidAmount('');
      }
    } catch (err) {
      logger.error('Bid error', {
        auctionId: selectedAuction?._id,
        userId,
        error: err.response?.data || err.message,
        stack: err.stack,
        response: err.response ? {
          status: err.response.status,
          data: err.response.data,
          headers: err.response.headers,
        } : null,
      });

      let errorMsg = '操作失敗';
      let errorDetail = '';

      if (err.response) {
        const status = err.response.status;
        errorMsg = err.response.data?.msg || '未知錯誤';
        errorDetail = err.response.data?.detail || '';

        switch (status) {
          case 400:
            errorMsg = `${errorMsg}${errorDetail ? `：${errorDetail}` : ''}`;
            break;
          case 401:
            errorMsg = '認證失敗，請重新登錄！';
            setTimeout(() => {
              navigate('/login');
            }, 2000);
            break;
          case 403:
            errorMsg = '您無權進行此操作！';
            break;
          case 404:
            errorMsg = `拍賣不存在，請刷新頁面後重試！${errorDetail ? `（${errorDetail}）` : ''}`;
            fetchAuctions();
            break;
          case 500:
            errorMsg = '伺服器錯誤，請稍後重試！';
            break;
          default:
            errorMsg = `操作失敗：${errorMsg}${errorDetail ? `（${errorDetail}）` : ''}`;
            break;
        }
      } else if (err.request) {
        errorMsg = '網絡錯誤，請檢查您的網絡連線！';
      } else {
        errorMsg = err.message || '未知錯誤';
      }

      logger.info('Displaying error message', { message: errorMsg });
      setErrorMessage(errorMsg);
      setErrorModalVisible(true);

      setTimeout(() => {
        setIsModalVisible(false);
        setBidAmount('');
      }, 1000);
    }
  };

  const bidColumns = [
    {
      title: '下標者',
      dataIndex: 'userId',
      key: 'userId',
      render: (user) => (
        <span>{user?.character_name || '未知用戶'}</span>
      ),
    },
    {
      title: '下標金額',
      dataIndex: 'amount',
      key: 'amount',
      sorter: (a, b) => b.amount - a.amount,
      render: (amount, record, index) => {
        const isHighestBid = index === 0;
        return (
          <span style={{ color: isHighestBid ? '#52c41a' : '#000', fontWeight: isHighestBid ? 'bold' : 'normal' }}>
            {amount === 0 ? '報名' : `${formatNumber(amount)} 💎`}
          </span>
        );
      },
    },
    {
      title: '下標時間',
      dataIndex: 'timestamp',
      key: 'timestamp',
      sorter: (a, b) => moment(a.timestamp).unix() - moment(b.timestamp).unix(),
      render: (time) => {
        if (!time) return '無時間記錄';
        const now = moment();
        const createdMoment = moment(time);
        const duration = now.diff(createdMoment);
        if (duration < 60000) {
          return (
            <Tooltip title={createdMoment.format('YYYY-MM-DD HH:mm:ss')}>
              {createdMoment.format('YYYY-MM-DD HH:mm:ss')}
            </Tooltip>
          );
        }
        return (
          <Tooltip title={createdMoment.format('YYYY-MM-DD HH:mm:ss')}>
            {createdMoment.fromNow()}
          </Tooltip>
        );
      },
    },
  ];

  return (
    <div>
      {auctions.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '20px' }}>
          <p>您目前沒有得標或持有的拍賣。</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
          {auctions.map(auction => {
            const levelColor = auction.level ? colorMapping[auction.level.color] || '#000000' : '#000000';
            const bidsForAuction = bids[auction._id] || [];
            const sortedBids = [...bidsForAuction].sort((a, b) => b.amount - a.amount);
            const endTime = auction.endTime ? moment(auction.endTime).format('MM-DD HH:mm') : '無截止時間';
            const remainingTime = auction.endTime
              ? moment(auction.endTime).diff(moment()) <= 0
                ? '已結束'
                : `${Math.floor(moment.duration(moment(auction.endTime).diff(moment())).asHours())}小時${moment.duration(moment(auction.endTime).diff(moment())).minutes()}分`
              : '無截止時間';
            const isItemHolderOrWinner = auction.itemHolder === characterName || (auction.highestBidder && auction.highestBidder._id === userId);
            const auctionType = auction.auctionType || 'open';
            const restrictionTags = getRestrictionTags(auction.restrictions || {});

            const shouldShowSettleButton = localUserRole === 'admin' && auction.status === 'pending';

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
                      src={auction.imageUrl || '/wp.jpg'}
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
                        logger.error('Image load error, using default image', { imageUrl: auction.imageUrl, error: e.message });
                        e.target.src = '/wp.jpg';
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
                actions={
                  isWonTab ? [
                    shouldShowSettleButton && (
                      <Popconfirm
                        key="settle"
                        title="確認核實此拍賣？"
                        onConfirm={() => handleSettleAuction(auction._id)}
                        okText="是"
                        cancelText="否"
                      >
                        <Tooltip title="核實交易">
                          <Button
                            type="default"
                            shape="circle"
                            icon={<AuditOutlined />}
                            size="small"
                          />
                        </Tooltip>
                      </Popconfirm>
                    ),
                    isItemHolderOrWinner && auction.status === 'completed' && (
                      <Popconfirm
                        key="complete"
                        title="確認交易已完成？"
                        onConfirm={() => handleCompleteTransaction(auction._id)}
                        okText="是"
                        cancelText="否"
                      >
                        <Tooltip title="交易完成">
                          <Button
                            type="primary"
                            shape="circle"
                            icon={<CheckCircleOutlined />}
                            size="small"
                          />
                        </Tooltip>
                      </Popconfirm>
                    ),
                    auction.highestBidder && auction.highestBidder._id === userId && auction.status === 'pending' && (
                      <Tooltip key="waiting" title="等待管理員核實">
                        <Button
                          type="default"
                          shape="circle"
                          icon={<InfoCircleOutlined />}
                          size="small"
                          disabled
                        />
                      </Tooltip>
                    ),
                  ].filter(Boolean) : [
                    auctionType !== 'lottery' ? (
                      <Tooltip key="bid" title="下標">
                        <Button
                          type="primary"
                          shape="circle"
                          icon={<DollarCircleOutlined />}
                          size="small"
                          onClick={() => handleBidClick(auction)}
                          disabled={auction.status !== 'active'}
                        />
                      </Tooltip>
                    ) : (
                      <Tooltip key="register" title="報名">
                        <Button
                          type="primary"
                          shape="circle"
                          icon={<UserOutlined />}
                          size="small"
                          onClick={() => handleRegisterClick(auction)}
                          disabled={auction.status !== 'active'}
                        />
                      </Tooltip>
                    ),
                    <Tooltip key="history" title="詳細">
                      <Button
                        type="default"
                        shape="circle"
                        icon={<HistoryOutlined />}
                        size="small"
                        onClick={() => handleHistoryClick(auction._id)}
                      />
                    </Tooltip>,
                    localUserRole === 'admin' && auction.status === 'pending' && (
                      <Popconfirm
                        key="settle"
                        title="確認結算此拍賣？"
                        onConfirm={() => handleSettleAuction(auction._id)}
                        okText="是"
                        cancelText="否"
                        disabled={auction.status !== 'pending'}
                      >
                        <Tooltip title="結算">
                          <Button
                            type="default"
                            shape="circle"
                            icon={<DollarOutlined />}
                            size="small"
                            disabled={auction.status !== 'pending'}
                          />
                        </Tooltip>
                      </Popconfirm>
                    ),
                    localUserRole === 'admin' && auction.status !== 'completed' && auction.status !== 'cancelled' && (
                      <Popconfirm
                        key="cancel"
                        title="確認取消此拍賣？"
                        onConfirm={() => handleCancelAuction(auction._id)}
                        okText="是"
                        cancelText="否"
                        disabled={auction.status !== 'active' && auction.status !== 'pending'}
                      >
                        <Tooltip title="取消">
                          <Button
                            type="danger"
                            shape="circle"
                            icon={<CloseCircleOutlined />}
                            size="small"
                            disabled={auction.status !== 'active' && auction.status !== 'pending'}
                          />
                        </Tooltip>
                      </Popconfirm>
                    ),
                    localUserRole === 'admin' && auction.status === 'pending' && (
                      <Popconfirm
                        key="reassign"
                        title="確認重新分配此拍賣？"
                        onConfirm={() => handleReassignAuction(auction._id)}
                        okText="是"
                        cancelText="否"
                        disabled={auction.status !== 'pending'}
                      >
                        <Tooltip title="重新分配">
                          <Button
                            type="default"
                            shape="circle"
                            icon={<SyncOutlined />}
                            size="small"
                            disabled={auction.status !== 'pending'}
                          />
                        </Tooltip>
                      </Popconfirm>
                    ),
                  ]
                }
              >
                <Card.Meta
                  description={
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {isWonTab ? (
                        <>
                          {/* 得標金額 */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <TrophyOutlined style={{ color: '#1890ff', fontSize: '16px' }} />
                            <span style={{ color: '#1890ff', fontSize: '16px' }}>{formatNumber(auction.currentPrice)}</span>
                          </div>
                          {/* 物品持有人 */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <GiftOutlined style={{ color: '#000', fontSize: '16px' }} />
                            <span>{auction.itemHolder || auction.createdBy.character_name}</span>
                          </div>
                          {/* 聯絡方式 */}
                          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                            <DiscordOutlined style={{ color: '#000', fontSize: '16px', marginTop: '2px' }} />
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
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <InfoCircleOutlined style={{ color: '#000', fontSize: '16px' }} />
                            {getStatusTag(auction.status)}
                          </div>
                          {/* 提示信息 */}
                          {isItemHolderOrWinner && auction.status === 'pending' && localUserRole !== 'admin' && (
                            <div style={{ marginTop: '8px', color: '#1890ff' }}>
                              <p>等待管理員核實</p>
                              <p>此拍賣正在等待管理員核實交易，核實完成後您可以回報交易完成。</p>
                            </div>
                          )}
                        </>
                      ) : (
                        <>
                          {/* 起標 {價格} 競標類型圖示 {拍賣類型} */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ color: '#1890ff', fontSize: '18px', fontWeight: 'bold' }}>
                              起標 {formatNumber(auction.startingPrice) || 0}
                            </span>
                            {getAuctionTypeIcon(auctionType)}
                            <span style={{ color: '#1890ff', fontSize: '18px', fontWeight: 'bold' }}>
                              {auctionType === 'open' ? '明標' : auctionType === 'blind' ? '暗標' : '抽籤'}
                            </span>
                          </div>
                          {/* 物品持有人 */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <UserOutlined style={{ color: '#000', fontSize: '16px' }} />
                            <span style={{ fontSize: '16px' }}>{auction.itemHolder || auction.createdBy.character_name}</span>
                          </div>
                          {/* 分隔線 */}
                          <hr style={{ border: 'none', borderTop: '1px dashed #e8e8e8', margin: '8px 0' }} />
                          {/* 競標限制標籤 */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                            {restrictionTags.length > 0 ? (
                              restrictionTags.map((tag, index) => (
                                <Tag key={index} color="blue" style={{ fontSize: '14px', padding: '2px 8px' }}>
                                  {tag}
                                </Tag>
                              ))
                            ) : (
                              <span style={{ color: '#000', fontSize: '16px' }}>
                                無競標限制
                              </span>
                            )}
                          </div>
                          {/* 分隔線 */}
                          <hr style={{ border: 'none', borderTop: '1px dashed #e8e8e8', margin: '8px 0' }} />
                        </>
                      )}
                    </div>
                  }
                />
              </Card>
            );
          })}
        </div>
      )}

      {/* 出價/報名 Modal */}
      <Modal
        title={selectedAuction?.auctionType === 'lottery' ? `報名參與 ${selectedAuction?.itemName || '未知物品'} 抽籤` : `為 ${selectedAuction?.itemName || '未知物品'} 下標`}
        open={isModalVisible}
        onOk={handleBidSubmit}
        onCancel={() => {
          setIsModalVisible(false);
          setBidAmount('');
        }}
        okText={selectedAuction?.auctionType === 'lottery' ? '報名' : '下標'}
        cancelText="取消"
      >
        {selectedAuction?.auctionType === 'lottery' ? (
          <p>您確定要報名參與此抽籤拍賣嗎？得標後需支付 {formatNumber(selectedAuction.startingPrice)} 💎。</p>
        ) : (
          <>
            {selectedAuction?.auctionType === 'open' && (
              <p>當前價格: {formatNumber(selectedAuction.currentPrice) || 0} 💎</p>
            )}
            {selectedAuction?.buyoutPrice && (
              <p>直接得標價: {formatNumber(selectedAuction.buyoutPrice)} 💎</p>
            )}
            <Input
              type="number"
              value={bidAmount}
              onChange={(e) => setBidAmount(e.target.value)}
              placeholder="輸入下標金額"
              min={(selectedAuction?.currentPrice || 0) + 1}
              style={{ margin: '10px 0' }}
            />
            {bidAmount && parseInt(bidAmount) > userDiamonds && (
              <p style={{ color: 'red' }}>
                警告：您的餘額（{formatNumber(userDiamonds)} 💎）低於下標金額（{formatNumber(bidAmount)} 💎），請確保結算前充值！
              </p>
            )}
            <p>注意：下標後，💎將在結算時扣除。您的餘額：{formatNumber(userDiamonds)} 💎</p>
          </>
        )}
      </Modal>

      {/* 出價歷史 Modal */}
      <Modal
        title="下標歷史"
        open={historyModalVisible}
        onCancel={handleHistoryModalClose}
        footer={[
          <Button key="close" onClick={handleHistoryModalClose}>
            關閉
          </Button>,
        ]}
        width={800}
      >
        <Table
          columns={bidColumns}
          dataSource={selectedAuctionId ? (bids[selectedAuctionId] || []).sort((a, b) => b.amount - a.amount) : []}
          rowKey="_id"
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            pageSizeOptions: ['5', '10', '20'],
            showTotal: (total) => `共 ${total} 條記錄`,
          }}
          locale={{ emptyText: '暫無下標記錄' }}
          style={{
            background: '#f5f5f5',
            borderRadius: '8px',
            padding: '8px',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
          }}
          rowClassName={(record, index) => (index === 0 ? 'highest-bid-row' : '')}
        />
      </Modal>

      {/* 自定義錯誤提示模態框 */}
      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ExclamationCircleOutlined style={{ color: '#ff4d4f', fontSize: '24px' }} />
            <span>錯誤提示</span>
          </div>
        }
        open={errorModalVisible}
        onOk={() => setErrorModalVisible(false)}
        onCancel={() => setErrorModalVisible(false)}
        okText="確認"
        cancelText="關閉"
        width={400}
        style={{ top: '20%' }}
      >
        <div style={{ padding: '10px 0', color: '#ff4d4f', fontSize: '16px' }}>
          {errorMessage}
        </div>
      </Modal>

      {/* 自定義成功提示模態框 */}
      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CheckCircleOutlined style={{ color: '#52c41a', fontSize: '24px' }} />
            <span>操作成功</span>
          </div>
        }
        open={successModalVisible}
        onOk={() => setSuccessModalVisible(false)}
        onCancel={() => setSuccessModalVisible(false)}
        okText="確認"
        cancelText="關閉"
        width={400}
        style={{ top: '20%' }}
      >
        <div style={{ padding: '10px 0', color: '#52c41a', fontSize: '16px' }}>
          {successMessage}
        </div>
      </Modal>

      <style jsx global>{`
        .highest-bid-row {
          background-color: #e6f7e5 !important;
        }
        .highest-bid-row td {
          border-bottom: 1px solid #d9d9d9 !important;
        }
        .ant-table-expanded-row .ant-table {
          margin: 0 !important;
        }
        .ant-table-expanded-row .ant-table-thead > tr > th {
          background: #e8e8e8 !important;
          fontWeight: bold;
        }
        .ant-table-expanded-row .ant-table-tbody > tr:hover > td {
          background: #fafafa !important;
        }
        .ant-image {
          position: static !important;
        }
        .ant-image .ant-image-mask {
          position: static !important;
        }
        .ant-card-actions {
          display: flex !important;
          justify-content: center !important;
          gap: 8px !important;
          padding: 8px 0 !important;
        }
        .ant-card-actions > li {
          margin: 0 !important;
          width: auto !important;
          text-align: center !important;
        }
        .ant-card-actions .ant-btn {
          padding: 4px !important;
          width: 32px !important;
          height: 32px !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
        }
        @media (max-width: 768px) {
          .ant-card-actions {
            gap: 4px !important;
          }
          .ant-card-actions .ant-btn {
            width: 28px !important;
            height: 28px !important;
          }
        }
        .ant-btn-circle {
          pointer-events: auto !important;
          opacity: 1 !important;
        }
      `}</style>
    </div>
  );
};

export default AuctionList;