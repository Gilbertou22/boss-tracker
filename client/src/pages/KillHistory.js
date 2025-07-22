import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Row, Col, Button, DatePicker, message, Image, Card, Spin, Alert, Tag, Tooltip, Popconfirm, Dropdown, Menu, Select, Table, Radio, Pagination, Input, Space } from 'antd';
import { PlusOutlined, CheckOutlined, MoreOutlined, SendOutlined, InfoCircleOutlined, UserOutlined, AppstoreOutlined, UnorderedListOutlined, DownloadOutlined } from '@ant-design/icons';
import axios from 'axios';
import moment from 'moment';
import Papa from 'papaparse';
import KillDetailModal from './KillDetailModal';
import AddAttendeeModal from './AddAttendeeModal';
import statusTag from '../utils/statusTag';

const { RangePicker } = DatePicker;
const { Option } = Select;
const BASE_URL = process.env.REACT_APP_API_URL || '';

const colorMapping = {
    '白色': '#f0f0f0',
    '綠色': '#00cc00',
    '藍色': '#1e90ff',
    '紅色': '#EC3636',
    '紫色': '#B931F3',
    '金色': '#ffd700',
};

const KillHistory = () => {
    const [history, setHistory] = useState([]);
    const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 });
    const [filters, setFilters] = useState({ bossId: '', start_time: null, end_time: null, status: 'pending', keyword: '' });
    const [sort, setSort] = useState({ field: 'kill_time', order: 'desc' });
    const [role, setRole] = useState(null);
    const [currentUser, setCurrentUser] = useState(null);
    const [loading, setLoading] = useState(false);
    const [applying, setApplying] = useState(false);
    const token = localStorage.getItem('token');
    const [userId, setUserId] = useState(null);
    const [userApplications, setUserApplications] = useState([]);
    const [itemApplications, setItemApplications] = useState({});
    const [visible, setVisible] = useState(false);
    const [selectedKill, setSelectedKill] = useState(null);
    const [modalLoading, setModalLoading] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [addVisible, setAddVisible] = useState(false);
    const [addKillId, setAddKillId] = useState(null);
    const [applyDeadlineHours, setApplyDeadlineHours] = useState(48);
    const [bosses, setBosses] = useState([]);
    const [displayMode, setDisplayMode] = useState('grid');
    const [selectedRowKeys, setSelectedRowKeys] = useState([]);

    useEffect(() => {
        if (!token) {
            message.error('請先登入以查看擊殺歷史！');
            return;
        }
        fetchUserInfo();
        fetchGuildSettings();
        fetchBosses();
    }, [token]);

    useEffect(() => {
        const loadApplications = async () => {
            if (currentUser !== null) {
                await fetchUserApplications();
            }
        };
        loadApplications();
    }, [currentUser]);

    useEffect(() => {
        if (currentUser !== null) {
            fetchHistory(pagination.current, pagination.pageSize);
        }
    }, [currentUser, filters, pagination.current, pagination.pageSize, sort, userApplications]);

    const fetchUserInfo = async () => {
        try {
            setLoading(true);
            const res = await axios.get(`${BASE_URL}/api/users/me`, {
                headers: { 'x-auth-token': token },
            });

            setRole(res.data.roles && res.data.roles.length > 0 ? res.data.roles[0] : null);
            setCurrentUser(res.data.character_name);
            setUserId(res.data.id);
          
        } catch (err) {
            //console.error('Fetch user info error:', err);
            message.error('載入用戶信息失敗: ' + (err.response?.data?.msg || err.message));
        } finally {
            setLoading(false);
        }
    };

    const fetchGuildSettings = async () => {
        try {
            const res = await axios.get(`${BASE_URL}/api/guilds/me`, {
                headers: { 'x-auth-token': token },
            });
            setApplyDeadlineHours(res.data.settings.applyDeadlineHours || 48);
        } catch (err) {
            message.warning('載入旅團設定失敗，使用預設 48 小時補登期限');
        }
    };

    const fetchBosses = async () => {
        try {
            const res = await axios.get(`${BASE_URL}/api/bosses`, {
                headers: { 'x-auth-token': token },
            });
            setBosses(res.data);
        } catch (err) {
            //console.error('Fetch bosses error:', err);
            message.error('載入首領列表失敗');
        }
    };

    const fetchItemApplications = async (kill_id, item_id) => {
        try {
            const res = await axios.get(`${BASE_URL}/api/applications/by-kill-and-item`, {
                headers: { 'x-auth-token': token },
                params: { kill_id, item_id },
            });
            return res.data || [];
        } catch (err) {
            return [];
        }
    };

    const fetchKillDetail = async (killId) => {
        setModalLoading(true);
        try {
            const res = await axios.get(`${BASE_URL}/api/boss-kills/${killId}`, {
                headers: { 'x-auth-token': token },
            });
            const detail = res.data;
            detail.screenshots = detail.screenshots
                ? detail.screenshots.map(src => (src ? `${BASE_URL}/${src.replace('./', '')}` : ''))
                : [];
            setSelectedKill(detail);
        } catch (err) {
            //console.error('Fetch kill detail error:', err);
            message.error(`載入詳情失敗: ${err.response?.data?.msg || err.message}`);
        } finally {
            setModalLoading(false);
        }
    };

    const fetchUserApplications = async () => {
        try {
            const res = await axios.get(`${BASE_URL}/api/applications/user`, {
                headers: { 'x-auth-token': token },
            });

            const activeApplications = res.data.filter(app => {
                if (!app) {
                    //console.warn('Invalid application entry:', app);
                    return false;
                }
                if (!app.item_id) {
                    //console.warn('Missing item_id in application:', app);
                    return false;
                }
                const isActive = app.status === 'pending' || app.status === 'approved';
                return isActive;
            });

            if (activeApplications.length === 0) {
                //console.warn('No active applications after filtering. Raw data:', res.data);
            }
            setUserApplications(activeApplications);
        } catch (err) {
            //console.error('Fetch user applications error:', err.response?.data || err.message);
            message.warning('無法載入申請記錄，申請中標示可能不準確');
            setUserApplications([]);
        }
    };

    const fetchHistory = useCallback(async (page = 1, pageSize = 10) => {
        try {
            setLoading(true);
            const params = {
                bossId: filters.bossId || undefined,
                start_time: filters.start_time ? filters.start_time.format('YYYY-MM-DD') : undefined,
                end_time: filters.end_time ? filters.end_time.format('YYYY-MM-DD') : undefined,
                status: filters.status || undefined,
                keyword: filters.keyword || undefined,
                page,
                pageSize,
                sortBy: sort.field,
                sortOrder: sort.order,
            };
            const res = await axios.get(`${BASE_URL}/api/boss-kills`, {
                headers: { 'x-auth-token': token },
                params,
            });

            if (!res.data.data || res.data.data.length === 0) {
                
                setHistory([]);
                setPagination({ current: page, pageSize, total: 0 });
                setLoading(false);
                return;
            }

            res.data.data.forEach(record => {
                if (!record.bossId) {
                    //console.warn(`Missing bossId in record ${record._id}`);
                } else if (!record.bossId.name) {
                    //console.warn(`Missing bossId.name in record ${record._id}`);
                }
            });

            const updatedHistory = res.data.data.map(record => {
                const applyingItems = record.dropped_items
                    ?.filter(item => {
                        const itemId = item._id || item.id;
                        if (!itemId) {
                            console.warn(`Missing item_id in dropped_items for record ${record._id}:`, item);
                            return false;
                        }
                        const hasApplication = userApplications.some(app => {
                            const appKillId = app.kill_id && app.kill_id._id ? app.kill_id._id.toString() : null;
                            const appItemId = app.item_id ? app.item_id.toString() : null;
                            const match = appKillId === record._id.toString() &&
                                appItemId === itemId.toString() &&
                                app.status === 'pending';
                            return match;
                        });
                        return hasApplication;
                    })
                    ?.map(item => item.name) || [];

                return {
                    ...record,
                    applyingItems,
                };
            });

            if (role === 'admin') {
                const applicationsMap = {};
                for (const record of updatedHistory) {
                    for (const item of record.dropped_items || []) {
                        const itemId = item._id || item.id;
                        if (itemId) {
                            const key = `${record._id}_${itemId}`;
                            const applications = await fetchItemApplications(record._id, itemId);
                            applicationsMap[key] = applications;
                        }
                    }
                }
                setItemApplications(applicationsMap);
            }

            const finalHistory = updatedHistory.map(record => {
                const deadline = moment(record.kill_time).add(applyDeadlineHours, 'hours');
                const isWithinDeadline = moment().isBefore(deadline);
                const remainingHours = moment(deadline).diff(moment(), 'hours');
                return {
                    ...record,
                    screenshots: record.screenshots
                        ? record.screenshots.map(src => (src ? `${BASE_URL}/${src.replace('./', '')}` : '/wp.jpg'))
                        : ['/wp.jpg'],
                    isWithinDeadline,
                    remainingHours,
                };
            });

            setHistory(finalHistory);
            setPagination({
                current: res.data.pagination.current,
                pageSize: res.data.pagination.pageSize,
                total: res.data.pagination.total,
            });
        } catch (err) {
            message.error(`載入擊殺歷史失敗: ${err.response?.data?.msg || err.message}`);
        } finally {
            setLoading(false);
        }
    }, [filters, sort, applyDeadlineHours, currentUser, role, token, userApplications]);

    const handleFilterChange = (field, value) => {
        setFilters(prev => ({ ...prev, [field]: value }));
        setPagination(prev => ({ ...prev, current: 1 }));
    };

    const handleTableChange = (pagination, _, sorter) => {
        setPagination(pagination);
        if (sorter.field && sorter.order) {
            setSort({
                field: sorter.field,
                order: sorter.order === 'ascend' ? 'asc' : 'desc',
            });
        }
        fetchHistory(pagination.current, pagination.pageSize);
    };

    const handlePaginationChange = (page, pageSize) => {
        setPagination(prev => ({ ...prev, current: page, pageSize }));
        fetchHistory(page, pageSize);
    };

    const handleSortChange = (value) => {
        const [field, order] = value.split('_');
        setSort({ field, order });
        setPagination(prev => ({ ...prev, current: 1 }));
    };

    const handleBatchDelete = async () => {
        if (selectedRowKeys.length === 0) {
            message.warning('請選擇要刪除的記錄');
            return;
        }
        try {
            setLoading(true);
            await axios.post(
                `${BASE_URL}/api/boss-kills/batch-delete`,
                { ids: selectedRowKeys },
                { headers: { 'x-auth-token': token } }
            );
            message.success('批量刪除成功');
            setSelectedRowKeys([]);
            fetchHistory(pagination.current, pagination.pageSize);
        } catch (err) {
            //console.error('Batch delete error:', err);
            message.error(`批量刪除失敗: ${err.response?.data?.msg || err.message}`);
        } finally {
            setLoading(false);
        }
    };

    const handleBatchExpire = async () => {
        if (selectedRowKeys.length === 0) {
            message.warning('請選擇要設為已過期的記錄');
            return;
        }
        try {
            setLoading(true);
            await axios.post(
                `${BASE_URL}/api/boss-kills/batch-expire`,
                { ids: selectedRowKeys },
                { headers: { 'x-auth-token': token } }
            );
            message.success('批量設為已過期成功');
            setSelectedRowKeys([]);
            fetchHistory(pagination.current, pagination.pageSize);
        } catch (err) {
            //console.error('Batch expire error:', err);
            message.error(`批量設為已過期失敗: ${err.response?.data?.msg || err.message}`);
        } finally {
            setLoading(false);
        }
    };

    const handleExportCSV = async () => {
        try {
            const params = {
                bossId: filters.bossId || undefined,
                start_time: filters.start_time ? filters.start_time.format('YYYY-MM-DD') : undefined,
                end_time: filters.end_time ? filters.end_time.format('YYYY-MM-DD') : undefined,
                status: filters.status || undefined,
                keyword: filters.keyword || undefined,
                sortBy: sort.field,
                sortOrder: sort.order,
            };
            const res = await axios.get(`${BASE_URL}/api/boss-kills/export`, {
                headers: { 'x-auth-token': token },
                params,
            });

            const data = res.data.map(record => ({
                擊殺時間: moment(record.kill_time).format('YYYY-MM-DD HH:mm:ss'),
                相對時間: moment(record.kill_time).fromNow(),
                首領名稱: record.bossId?.name || '未知首領',
                狀態: record.status,
                掉落物品: record.dropped_items.map(item => item.name).join(', ') || '無',
                物品持有人: record.itemHolder || '未分配',
                參與者: record.attendees.join(', '),
            }));

            const csv = Papa.unparse(data, {
                header: true,
                delimiter: ',',
            });

            const blob = new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = `kill_history_${moment().format('YYYYMMDD_HHmmss')}.csv`;
            link.click();
            URL.revokeObjectURL(link.href);

            message.success('擊殺記錄已導出為 CSV');
        } catch (err) {
            //console.error('Export kill history error:', err);
            message.error('導出擊殺記錄失敗');
        }
    };

    const getApplicationDetails = (killId, itemId) => {
        const app = userApplications.find(app => {
            const appKillId = app.kill_id && app.kill_id._id ? app.kill_id._id.toString() : null;
            const match = appKillId === killId.toString() &&
                app.item_id && app.item_id.toString() === itemId.toString() &&
                app.status === 'pending';
            return match;
        });
        return app;
    };

    const handleQuickApply = async (killId, itemId, itemName) => {
        if (applying) return;
        setApplying(true);
        try {
            const token = localStorage.getItem('token');
            if (!token) {
                message.error('請先登錄！');
                return;
            }

            const kill = history.find(record => record._id === killId);
            if (!kill || !kill.attendees.includes(currentUser)) {
                message.warning('您未參與該擊殺，無法申請物品。請先補登參與者身份！');
                return;
            }

            const applicationKey = `${killId}_${itemId}`;
            if (userApplications.some(app => {
                const appKillId = app.kill_id && app.kill_id._id ? app.kill_id._id.toString() : null;
                return appKillId === killId.toString() && app.item_id.toString() === itemId.toString();
            })) {
                message.warning('您已為此物品提交申請！');
                return;
            }

            const res = await axios.post(
                `${BASE_URL}/api/applications`,
                {
                    kill_id: killId,
                    item_id: itemId,
                    item_name: itemName,
                },
                { headers: { 'x-auth-token': token } }
            );
            message.success(res.data.msg || '申請提交成功！');
            await fetchUserApplications();
            fetchHistory(pagination.current, pagination.pageSize);
        } catch (err) {
            //console.error('Quick apply error:', err.response?.data || err);
            message.error(`申請失敗: ${err.response?.data?.msg || err.message}`);
        } finally {
            setApplying(false);
        }
    };

    const handleShowDetail = (killId, editing = false) => {
        fetchKillDetail(killId);
        setIsEditing(editing);
        setVisible(true);
    };

    const handleCloseModal = () => {
        setVisible(false);
        setSelectedKill(null);
        setIsEditing(false);
    };

    const handleUpdate = () => {
        fetchHistory(pagination.current, pagination.pageSize);
        handleCloseModal();
    };

    const handleShowAddModal = (killId) => {
        setAddKillId(killId);
        setAddVisible(true);
    };

    const handleCloseAddModal = () => {
        setAddVisible(false);
        setAddKillId(null);
    };

    const handleAddSubmit = () => {
        fetchHistory(pagination.current, pagination.pageSize);
        handleCloseAddModal();
    };

    const handleDelete = async (killId) => {
        try {
            await axios.delete(`${BASE_URL}/api/boss-kills/${killId}`, {
                headers: { 'x-auth-token': token },
            });
            message.success('擊殺記錄刪除成功');
            fetchHistory(pagination.current, pagination.pageSize);
        } catch (err) {
            //console.error('Delete boss kill error:', err);
            message.error(`刪除擊殺記錄失敗: ${err.response?.data?.msg || err.message}`);
        }
    };

    const handleSetItemExpired = async (killId, itemId) => {
        try {
            setLoading(true);
            const token = localStorage.getItem('token');
            if (!token || role !== 'admin') {
                message.error('無權限執行此操作！');
                return;
            }

            const res = await axios.put(
                `${BASE_URL}/api/boss-kills/${killId}/items/${itemId}`,
                { status: 'expired' },
                { headers: { 'x-auth-token': token } }
            );
            message.success(res.data.msg || '物品狀態已設為已過期，可發起競標！');
            fetchHistory(pagination.current, pagination.pageSize);
        } catch (err) {
            //console.error('Set item expired error:', err);
            message.error(`設置物品狀態失敗: ${err.response?.data?.msg || err.message}`);
        } finally {
            setLoading(false);
        }
    };

    const renderGridItem = (record) => {
        const firstScreenshot = record.screenshots && record.screenshots.length > 0 && record.screenshots[0]
            ? record.screenshots[0]
            : '/wp.jpg';
        const killTime = moment(record.kill_time).format('MM-DD HH:mm');
        const relativeTime = moment(record.kill_time).fromNow();
        const item = record.dropped_items && record.dropped_items.length > 0 ? record.dropped_items[0] : null;
        const itemName = item ? item.name : '無';
        const bossName = record.bossId?.name || '未知首領';
        const isAttendee = record.attendees?.includes(currentUser);
        const canAddAttendee = record.status === 'pending' && !isAttendee && record.isWithinDeadline;
        const remainingTime = record.remainingHours > 0 ? `${Math.max(0, Math.ceil(record.remainingHours))}小時內可補登` : '補登結束';

        const itemColor = item?.level ? colorMapping[item.level.color] || '#ffffff' : '#ffffff';

        const hasPendingItems = record.dropped_items.some(item => {
            const effectiveStatus = item.status ? item.status.toLowerCase() : 'pending';
            return effectiveStatus === 'pending';
        });

        const hasApplied = record.applyingItems && record.applyingItems.length > 0;

        const moreMenu = (
            <Menu className="kill-history-more-menu">
                {role !== 'admin' && canAddAttendee && remainingTime !== '補登結束' && (
                    <Menu.Item key="addAttendee">
                        <Button
                            type="link"
                            onClick={() => handleShowAddModal(record._id)}
                            style={{ padding: 0 }}
                        >
                            補登
                        </Button>
                    </Menu.Item>
                )}
                {role !== 'admin' && canAddAttendee && remainingTime === '補登結束' && (
                    <Menu.Item key="addAttendeeDisabled">
                        <Button
                            type="link"
                            onClick={() => handleShowAddModal(record._id)}
                            disabled
                            style={{ padding: 0 }}
                        >
                            補登
                        </Button>
                    </Menu.Item>
                )}
                {role === 'admin' && record.status === 'pending' && (
                    <Menu.Item key="edit">
                        <Button
                            type="link"
                            onClick={() => handleShowDetail(record._id, true)}
                            style={{ padding: 0 }}
                        >
                            編輯
                        </Button>
                    </Menu.Item>
                )}
                {role === 'admin' && record.status === 'pending' && (
                    <Menu.Item key="delete">
                        <Popconfirm
                            title="確認刪除此記錄？"
                            onConfirm={() => handleDelete(record._id)}
                            okText="是"
                            cancelText="否"
                        >
                            <Button type="link" style={{ padding: 0, color: '#ff4d4f' }}>
                                刪除
                            </Button>
                        </Popconfirm>
                    </Menu.Item>
                )}
                {role === 'admin' && hasPendingItems && (
                    <Menu.SubMenu title="設置物品狀態" key="setItemStatus">
                        {record.dropped_items.map((item, index) => {
                            const effectiveStatus = item.status ? item.status.toLowerCase() : 'pending';
                            if (effectiveStatus !== 'pending') return null;
                            return (
                                <Menu.Item key={`setExpired-${record._id}-${item._id || item.id}`}>
                                    <Popconfirm
                                        title={`確認將 "${item.name}" 設為已過期？`}
                                        onConfirm={() => handleSetItemExpired(record._id, item._id || item.id)}
                                        okText="是"
                                        cancelText="否"
                                    >
                                        <Button type="link" style={{ padding: 0 }}>
                                            {item.name} 設為已過期
                                        </Button>
                                    </Popconfirm>
                                </Menu.Item>
                            );
                        })}
                    </Menu.SubMenu>
                )}
            </Menu>
        );

        const detailContent = (
            <div>
                <p><strong>參與者:</strong> {record.attendees.join(', ')}</p>
                <p><strong>掉落物品:</strong> {record.dropped_items.map(item => item.name).join(', ') || '無'}</p>
                <p><strong>物品持有人:</strong> {record.itemHolder || '未分配'}</p>
            </div>
        );

        return (
            <Col xs={24} sm={12} md={8} lg={4} key={record._id} style={{ marginBottom: '8px', position: 'relative' }}>
                {isAttendee && (
                    <div
                        style={{
                            position: 'absolute',
                            top: 0,
                            left: '3px',
                            width: '30px',
                            height: '30px',
                            background: hasApplied ? '#00cc00' : 'red',
                            clipPath: 'polygon(0 0, 100% 0, 0 100%)',
                            display: 'flex',
                            justifyContent: 'center',
                            alignItems: 'center',
                            zIndex: 1,
                        }}
                    >
                        <CheckOutlined style={{ position: 'absolute', color: 'white', fontSize: '13px', left: '3px', top: '3px' }} />
                    </div>
                )}
                <Card
                    hoverable
                    cover={
                        <div style={{ position: 'relative', width: '100%', paddingTop: '66.67%' }}>
                            <Image
                                src={firstScreenshot}
                                alt="擊殺截圖"
                                style={{
                                    position: 'absolute',
                                    top: 0,
                                    left: 0,
                                    width: '100%',
                                    height: '100%',
                                    objectFit: 'cover',
                                }}
                                onError={(e) => {
                                    //console.error(`Image load error for ${firstScreenshot}:`, e);
                                    message.warning('截圖加載失敗，使用占位圖');
                                    e.target.src = 'wp1.jpg';
                                }}
                                loading="lazy"
                            />
                            {record.status === 'pending' && record.isWithinDeadline && (
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
                                [{killTime}]<br />
                                <span style={{ color: itemColor }}>{itemName}</span>
                            </div>
                        </div>
                    }
                    actions={[
                        <Tooltip title="查看詳情">
                            <Button
                                type="link"
                                icon={<InfoCircleOutlined />}
                                onClick={() => handleShowDetail(record._id, false)}
                                style={{ padding: '0 8px' }}
                            />
                        </Tooltip>,
                        role !== 'admin' && isAttendee && record.status === 'pending' && record.dropped_items.some(item => {
                            const itemId = item._id || item.id;
                            const appDetails = getApplicationDetails(record._id, itemId);
                            const effectiveStatus = item.status ? item.status.toLowerCase() : 'pending';
                            return !appDetails && effectiveStatus === 'pending';
                        }) && (
                            <Popconfirm
                                title="確認申請此物品？"
                                onConfirm={() => handleQuickApply(record._id, record.dropped_items[0]._id || record.dropped_items[0].id, record.dropped_items[0].name)}
                                okText="是"
                                cancelText="否"
                            >
                                <Button
                                    type="link"
                                    icon={<SendOutlined />}
                                    loading={applying}
                                    disabled={applying}
                                    style={{ padding: '0 8px' }}
                                />
                            </Popconfirm>
                        ),
                        record.status === 'pending' && (
                            <Dropdown overlay={moreMenu} trigger={['click']}>
                                <Button type="link" icon={<MoreOutlined />} style={{ padding: '0 8px' }} />
                            </Dropdown>
                        )
                    ]}
                >
                    <Card.Meta
                        title={
                            <>
                                <span style={{ fontSize: '12px', color: '#888' }}>{relativeTime}</span>
                                <br />
                                <span>{bossName}</span>
                            </>
                        }
                        description={
                            <>
                                <p>狀態: {statusTag(record.status)}</p>
                                <p>掉落物品: {record.dropped_items.map(item => item.name).join(', ') || '無'}</p>
                                <p style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <UserOutlined style={{ color: '#000', fontSize: '16px' }} />
                                    物品持有人: {record.itemHolder || '未分配'}
                                </p>
                            </>
                        }
                    />
                </Card>
            </Col>
        );
    };

    const columns = [
        {
            title: '擊殺時間',
            dataIndex: 'kill_time',
            key: 'kill_time',
            sorter: true,
            render: (time) => moment(time).format('MM-DD HH:mm'),
        },
        {
            title: '相對時間',
            dataIndex: 'kill_time',
            key: 'relative_time',
            render: (time) => moment(time).fromNow(),
        },
        {
            title: '首領名稱',
            dataIndex: 'bossId',
            key: 'boss_name',
            sorter: true,
            render: (bossId) => bossId?.name || '未知首領',
        },
        {
            title: '狀態',
            dataIndex: 'status',
            key: 'status',
            render: (status) => statusTag(status),
        },
        {
            title: '掉落物品',
            dataIndex: 'dropped_items',
            key: 'dropped_items',
            render: (items) => items.map(item => item.name).join(', ') || '無',
        },
        {
            title: '物品持有人',
            dataIndex: 'itemHolder',
            key: 'itemHolder',
            render: (itemHolder) => (
                <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <UserOutlined style={{ color: '#000', fontSize: '16px' }} />
                    {itemHolder || '未分配'}
                </span>
            ),
        },
        {
            title: '操作',
            key: 'actions',
            render: (_, record) => {
                const isAttendee = record.attendees?.includes(currentUser);
                const canAddAttendee = record.status === 'pending' && !isAttendee && record.isWithinDeadline;
                const remainingTime = record.remainingHours > 0 ? `${Math.max(0, Math.ceil(record.remainingHours))}小時內可補登` : '補登結束';
                const hasPendingItems = record.dropped_items.some(item => {
                    const effectiveStatus = item.status ? item.status.toLowerCase() : 'pending';
                    return effectiveStatus === 'pending';
                });

                const moreMenu = (
                    <Menu className="kill-history-more-menu">
                        {role !== 'admin' && canAddAttendee && remainingTime !== '補登結束' && (
                            <Menu.Item key="addAttendee">
                                <Button
                                    type="link"
                                    onClick={() => handleShowAddModal(record._id)}
                                    style={{ padding: 0 }}
                                >
                                    補登
                                </Button>
                            </Menu.Item>
                        )}
                        {role !== 'admin' && canAddAttendee && remainingTime === '補登結束' && (
                            <Menu.Item key="addAttendeeDisabled">
                                <Button
                                    type="link"
                                    onClick={() => handleShowAddModal(record._id)}
                                    disabled
                                    style={{ padding: 0 }}
                                >
                                    補登
                                </Button>
                            </Menu.Item>
                        )}
                        {role === 'admin' && record.status === 'pending' && (
                            <Menu.Item key="edit">
                                <Button
                                    type="link"
                                    onClick={() => handleShowDetail(record._id, true)}
                                    style={{ padding: 0 }}
                                >
                                    編輯
                                </Button>
                            </Menu.Item>
                        )}
                        {role === 'admin' && record.status === 'pending' && (
                            <Menu.Item key="delete">
                                <Popconfirm
                                    title="確認刪除此記錄？"
                                    onConfirm={() => handleDelete(record._id)}
                                    okText="是"
                                    cancelText="否"
                                >
                                    <Button type="link" style={{ padding: 0, color: '#ff4d4f' }}>
                                        刪除
                                    </Button>
                                </Popconfirm>
                            </Menu.Item>
                        )}
                        {role === 'admin' && hasPendingItems && (
                            <Menu.SubMenu title="設置物品狀態" key="setItemStatus">
                                {record.dropped_items.map((item, index) => {
                                    const effectiveStatus = item.status ? item.status.toLowerCase() : 'pending';
                                    if (effectiveStatus !== 'pending') return null;
                                    return (
                                        <Menu.Item key={`setExpired-${record._id}-${item._id || item.id}`}>
                                            <Popconfirm
                                                title={`確認將 "${item.name}" 設為已過期？`}
                                                onConfirm={() => handleSetItemExpired(record._id, item._id || item.id)}
                                                okText="是"
                                                cancelText="否"
                                            >
                                                <Button type="link" style={{ padding: 0 }}>
                                                    {item.name} 設為已過期
                                                </Button>
                                            </Popconfirm>
                                        </Menu.Item>
                                    );
                                })}
                            </Menu.SubMenu>
                        )}
                    </Menu>
                );

                return (
                    <Space size="small">
                        <Tooltip title="查看詳情">
                            <Button
                                type="link"
                                icon={<InfoCircleOutlined />}
                                onClick={() => handleShowDetail(record._id, false)}
                            />
                        </Tooltip>
                        {role !== 'admin' && isAttendee && record.status === 'pending' && record.dropped_items.some(item => {
                            const itemId = item._id || item.id;
                            const appDetails = getApplicationDetails(record._id, itemId);
                            const effectiveStatus = item.status ? item.status.toLowerCase() : 'pending';
                            return !appDetails && effectiveStatus === 'pending';
                        }) && (
                                <Popconfirm
                                    title="確認申請此物品？"
                                    onConfirm={() => handleQuickApply(record._id, record.dropped_items[0]._id || record.dropped_items[0].id, record.dropped_items[0].name)}
                                    okText="是"
                                    cancelText="否"
                                >
                                    <Button
                                        type="link"
                                        icon={<PlusOutlined />}
                                        loading={applying}
                                        disabled={applying}
                                    />
                                </Popconfirm>
                            )}
                        {record.status === 'pending' && (
                            <Dropdown overlay={moreMenu} trigger={['click']}>
                                <Button type="link" icon={<MoreOutlined />} />
                            </Dropdown>
                        )}
                    </Space>
                );
            },
        },
    ];

    return (
        <div style={{ padding: '20px', backgroundColor: '#f0f2f5' }}>
            <Card
                title={<h2 style={{ margin: 0, fontSize: '24px', color: '#1890ff' }}>{role === 'admin' ? '管理員 - 所有擊殺歷史記錄' : '擊殺歷史記錄'}</h2>}
                bordered={false}
                style={{ boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)', borderRadius: '8px' }}
                extra={
                    <Space wrap>
                        <Radio.Group
                            value={displayMode}
                            onChange={(e) => setDisplayMode(e.target.value)}
                            buttonStyle="solid"
                        >
                            <Radio.Button value="grid"><AppstoreOutlined /> 網格</Radio.Button>
                            <Radio.Button value="list"><UnorderedListOutlined /> 列表</Radio.Button>
                        </Radio.Group>
                        <Button
                            type="primary"
                            icon={<DownloadOutlined />}
                            onClick={handleExportCSV}
                        >
                            導出 CSV
                        </Button>
                    </Space>
                }
            >
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: '16px', gap: '16px', flexWrap: 'wrap' }}>
                    <Select
                        placeholder="選擇首領"
                        value={filters.bossId}
                        onChange={(value) => handleFilterChange('bossId', value)}
                        style={{ width: 200 }}
                        allowClear
                    >
                        {bosses.map(boss => (
                            <Option key={boss._id} value={boss._id}>
                                {boss.name}
                            </Option>
                        ))}
                    </Select>
                    <RangePicker
                        value={[filters.start_time, filters.end_time]}
                        onChange={(dates) => {
                            handleFilterChange('start_time', dates ? dates[0] : null);
                            handleFilterChange('end_time', dates ? dates[1] : null);
                        }}
                        style={{ marginRight: 0 }}
                    />
                    <Select
                        placeholder="選擇狀態"
                        value={filters.status}
                        onChange={(value) => handleFilterChange('status', value)}
                        style={{ width: 200 }}
                        allowClear
                    >
                        <Option value="pending">待分配</Option>
                        <Option value="assigned">已分配</Option>
                        <Option value="expired">已過期</Option>
                    </Select>
                    <Input.Search
                        placeholder="搜索物品名稱、持有人或參與者"
                        value={filters.keyword}
                        onChange={(e) => handleFilterChange('keyword', e.target.value)}
                        onSearch={() => fetchHistory(pagination.current, pagination.pageSize)}
                        style={{ width: 200 }}
                    />
                    {displayMode === 'grid' && (
                        <Select
                            placeholder="排序方式"
                            value={`${sort.field}_${sort.order}`}
                            onChange={handleSortChange}
                            style={{ width: 200 }}
                        >
                            <Option value="kill_time_desc">擊殺時間（降序）</Option>
                            <Option value="kill_time_asc">擊殺時間（升序）</Option>
                            <Option value="boss_name_desc">首領名稱（降序）</Option>
                            <Option value="boss_name_asc">首領名稱（升序）</Option>
                        </Select>
                    )}
                </div>
                <Spin spinning={loading || applying} size="large">
                    {history.length === 0 && !loading ? (
                        <Alert
                            message="無數據"
                            description="目前沒有符合條件的擊殺記錄。請檢查過濾條件或確保有相關數據。"
                            type="info"
                            showIcon
                            style={{ marginBottom: '16px' }}
                        />
                    ) : displayMode === 'grid' ? (
                        <>
                            <Row gutter={[8, 8]}>
                                {history.map(record => renderGridItem(record))}
                            </Row>
                            <div style={{ marginTop: '16px', textAlign: 'right' }}>
                                <Pagination
                                    current={pagination.current}
                                    pageSize={pagination.pageSize}
                                    total={pagination.total}
                                    showSizeChanger
                                    pageSizeOptions={['10', '20', '50']}
                                    showTotal={(total) => `共 ${total} 條記錄`}
                                    onChange={handlePaginationChange}
                                    onShowSizeChange={handlePaginationChange}
                                />
                            </div>
                        </>
                    ) : (
                        <>
                            {role === 'admin' && (
                                <div style={{ marginBottom: '16px' }}>
                                    <Space>
                                        <Button
                                            type="primary"
                                            danger
                                            onClick={handleBatchDelete}
                                            disabled={selectedRowKeys.length === 0}
                                        >
                                            批量刪除
                                        </Button>
                                        <Button
                                            type="primary"
                                            onClick={handleBatchExpire}
                                            disabled={selectedRowKeys.length === 0}
                                        >
                                            批量設為已過期
                                        </Button>
                                    </Space>
                                </div>
                            )}
                            <Table
                                rowSelection={role === 'admin' ? {
                                    selectedRowKeys,
                                    onChange: (keys) => setSelectedRowKeys(keys),
                                } : undefined}
                                columns={columns}
                                dataSource={history}
                                rowKey="_id"
                                pagination={{
                                    current: pagination.current,
                                    pageSize: pagination.pageSize,
                                    total: pagination.total,
                                    showSizeChanger: true,
                                    pageSizeOptions: ['10', '20', '50'],
                                    showTotal: (total) => `共 ${total} 條記錄`,
                                }}
                                onChange={handleTableChange}
                                expandable={{
                                    expandedRowRender: (record) => renderGridItem(record),
                                    expandRowByClick: true,
                                }}
                            />
                        </>
                    )}
                </Spin>
            </Card>

            <KillDetailModal
                visible={visible}
                onCancel={handleCloseModal}
                killData={selectedKill}
                onUpdate={handleUpdate}
                token={token}
                initialEditing={isEditing}
            />

            <AddAttendeeModal
                visible={addVisible}
                onCancel={handleCloseAddModal}
                killId={addKillId}
                token={token}
                onSubmit={handleAddSubmit}
            />

            <style jsx global>{`
                .ant-image {
                    position: static !important;
                }
                .ant-image .ant-image-mask {
                    position: static !important;
                }
                .ant-card-actions {
                    display: flex;
                    justify-content: center;
                    gap: 8px;
                }
                .ant-card-actions > li {
                    margin: 0 !important;
                    width: auto !important;
                    text-align: center;
                }
                @media (max-width: 768px) {
                    .ant-card-actions > li {
                        padding: 0 4px !important;
                    }
                    .ant-btn-link {
                        padding: 0 6px !important;
                    }
                    .ant-card-head {
                        display: flex;
                        flex-direction: column;
                        align-items: flex-start;
                        padding: 16px;
                    }
                    .ant-card-head-title {
                        flex: none;
                        padding: 0 0 8px 0;
                        width: 100%;
                        white-space: normal;
                        overflow: visible;
                    }
                    .ant-card-extra {
                        flex: none;
                        width: 100%;
                        display: flex;
                        justify-content: flex-end;
                        margin-top: 8px;
                    }
                    .ant-space {
                        flex-wrap: wrap;
                        gap: 8px;
                    }
                }
                .kill-history-more-menu {
                    background-color: #fff !important;
                    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15) !important;
                }
                .kill-history-more-menu .ant-dropdown-menu-item {
                    padding: 8px 16px !important;
                    transition: background-color 0.3s ease !important;
                }
                .kill-history-more-menu .ant-dropdown-menu-item:hover {
                    background-color: #f0f0f0 !important;
                }
            `}</style>
        </div>
    );
};

export default KillHistory;