import React, { useState, useEffect } from 'react';
import { Form, Button, Upload, Select, message, DatePicker, Input, Row, Col, Alert, Spin, Card, Space, Typography, Modal, Tag, List } from 'antd';
import { UploadOutlined, UserOutlined, PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import axiosInstance from '../utils/axiosInstance';
import moment from 'moment';
import imageCompression from 'browser-image-compression';
import logger from '../utils/logger';
import { useNavigate } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';

const { Option } = Select;
const { TextArea } = Input;
const { Text, Title } = Typography;

const BASE_URL = process.env.REACT_APP_API_URL || '';

const colorMapping = {
    '白色': '#f0f0f0',
    '綠色': '#00cc00',
    '藍色': '#1e90ff',
    '紅色': '#EC3636',
    '紫色': '#B931F3',
    '金色': '#ffd700',
};

const BossKillForm = () => {
    const navigate = useNavigate();
    const [fileList, setFileList] = useState([]);
    const [form] = Form.useForm();
    const [bosses, setBosses] = useState([]);
    const [items, setItems] = useState([]);
    const [users, setUsers] = useState([]);
    const [userOptions, setUserOptions] = useState({
        attendees: [],
        itemHolder: [],
        guildCaptain: null,
    });
    const [date, setDate] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [pasteImageLoading, setPasteImageLoading] = useState(false);
    const [loading, setLoading] = useState(false);
    const [rolesLoading, setRolesLoading] = useState(true);
    const [online, setOnline] = useState(navigator.onLine);
    const [deferredPrompt, setDeferredPrompt] = useState(null);
    const [logText, setLogText] = useState('');
    const [userRoles, setUserRoles] = useState([]);
    const [addItemModalVisible, setAddItemModalVisible] = useState(false);
    const [confirmModalVisible, setConfirmModalVisible] = useState(false);
    const [formValues, setFormValues] = useState(null);
    const [itemForm] = Form.useForm();
    const [itemLevels, setItemLevels] = useState([]);
    const token = localStorage.getItem('token');

    useEffect(() => {
        if (!token) {
            message.error('請先登入！');
            navigate('/login');
            return;
        }

        fetchUserRoles();
        fetchBosses();
        fetchItems();
        fetchUsers();
        fetchItemLevels();
        form.setFieldsValue({ kill_time: null });

        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            setDeferredPrompt(e);
        });

        window.addEventListener('online', () => setOnline(true));
        window.addEventListener('offline', () => setOnline(false));

        return () => {
            window.removeEventListener('beforeinstallprompt', () => {});
            window.removeEventListener('online', () => {});
            window.removeEventListener('offline', () => {});
        };
    }, [navigate]);

    const fetchUserRoles = async () => {
        try {
            setRolesLoading(true);
            const res = await axiosInstance.get('/api/users/me');
            setUserRoles(res.data.roles || []);
            logger.info('Fetched user roles:', res.data.roles);
        } catch (err) {
            logger.error('Fetch user roles failed', { error: err.message, stack: err.stack });
        } finally {
            setRolesLoading(false);
        }
    };

    const fetchItemLevels = async () => {
        try {
            const res = await axiosInstance.get('/api/items/item-levels');
            setItemLevels(res.data);
        } catch (err) {
            message.error('載入物品等級失敗');
            logger.error('Fetch item levels failed', { error: err.message, stack: err.stack });
        }
    };

    const handleInstallPWA = () => {
        if (deferredPrompt) {
            deferredPrompt.prompt();
            deferredPrompt.userChoice.then((choiceResult) => {
                if (choiceResult.outcome === 'accepted') {
                    logger.info('User accepted the install prompt');
                } else {
                    logger.info('User dismissed the install prompt');
                }
                setDeferredPrompt(null);
            });
        }
    };

    const fetchBosses = async () => {
        try {
            const res = await axiosInstance.get('/api/bosses');
            setBosses(res.data);
        } catch (err) {
            message.error('載入首領失敗');
            logger.error('Fetch bosses failed', { error: err.message, stack: err.stack });
        }
    };

    const fetchItems = async () => {
        try {
            const res = await axiosInstance.get('/api/items');
            setItems(res.data);
        } catch (err) {
            message.error('載入物品失敗');
            logger.error('Fetch items failed', { error: err.message, stack: err.stack });
        }
    };

    const fetchUsers = async () => {
        try {
            let allUsers = [];
            let page = 1;
            let totalPages = 1;

            while (page <= totalPages) {
                const res = await axiosInstance.get('/api/users', {
                    params: { page, pageSize: 50 },
                });

                if (!Array.isArray(res.data.data)) {
                    throw new Error('後端返回的用戶數據格式不正確');
                }

                allUsers = [...allUsers, ...res.data.data];
                totalPages = Math.ceil(res.data.pagination.total / res.data.pagination.pageSize);
                page++;
            }

            const allAttendees = allUsers.map(user => user.character_name);
            const filteredItemHolders = allUsers
                .filter(user => !user.roles.some(role => role.name === 'guild'))
                .map(user => user.character_name);
            const guildCaptain = allUsers.find(user => user.roles.some(role => role.name === 'admin'))?.character_name;

            setUsers(allAttendees);
            setUserOptions({
                attendees: [
                    { value: 'all', label: '選擇全部' },
                    ...allAttendees.map(name => ({ value: name, label: name }))
                ],
                itemHolder: filteredItemHolders.map(name => ({ value: name, label: name })),
                guildCaptain,
            });
            logger.info('Fetched users:', allAttendees);
        } catch (err) {
            message.error('載入用戶失敗: ' + err.message);
            logger.error('Fetch users failed', { error: err.message, stack: err.stack });
        }
    };

    const compressionOptions = {
        maxSizeMB: 0.6,
        maxWidthOrHeight: 1024,
        useWebWorker: true,
    };

    const handleBeforeUpload = async (file) => {
        setUploading(true);
        try {
            const isImage = file.type === 'image/jpeg' || file.type === 'image/png';
            if (!isImage) {
                message.error('僅支援 JPEG/PNG 圖片！');
                setUploading(false);
                return Upload.LIST_IGNORE;
            }

            const isLt600KB = file.size / 1024 <= 600;
            if (isLt600KB) {
                setFileList([...fileList, file]);
                setUploading(false);
                return false;
            }

            message.info('圖片過大，正在壓縮...');
            const compressedFile = await imageCompression(file, compressionOptions);

            if (compressedFile.size / 1024 > 600) {
                message.error('圖片壓縮後仍超過 600KB，請選擇更小的圖片！');
                setUploading(false);
                return Upload.LIST_IGNORE;
            }

            setFileList([...fileList, { ...compressedFile, uid: file.uid, name: file.name, originFileObj: compressedFile }]);
            setUploading(false);
            return false;
        } catch (err) {
            message.error('圖片壓縮失敗，請重試！');
            setUploading(false);
            return Upload.LIST_IGNORE;
        }
    };

    const handleRemove = (file) => {
        setFileList(fileList.filter(item => item.uid !== file.uid));
    };

    const handlePasteImage = async (event) => {
        if (fileList.length >= 8) {
            message.error('最多只能上傳或貼上 8 張圖片！');
            return;
        }
        setPasteImageLoading(true);
        try {
            const items = event.clipboardData?.items;
            if (!items) {
                message.error('無法讀取剪貼簿內容，請使用檔案上傳');
                setPasteImageLoading(false);
                return;
            }
            let imageItem = null;
            for (const item of items) {
                if (item.type.startsWith('image/') && (item.type === 'image/png' || item.type === 'image/jpeg')) {
                    imageItem = item;
                    break;
                }
            }
            if (!imageItem) {
                message.error('剪貼簿中無有效圖片（僅支援 JPEG/PNG）');
                setPasteImageLoading(false);
                return;
            }
            const file = imageItem.getAsFile();
            if (!file) {
                message.error('無法從剪貼簿提取圖片');
                setPasteImageLoading(false);
                return;
            }
            message.info('正在處理貼上的圖片...');
            const compressedFile = await imageCompression(file, compressionOptions);
            if (compressedFile.size / 1024 > 600) {
                message.error('貼上的圖片壓縮後仍超過 600KB，請選擇較小的圖片');
                setPasteImageLoading(false);
                return;
            }
            const newFile = {
                uid: `paste - ${ Date.now() } `,
                name: `pasted - image - ${ Date.now() }.${ file.type.split('/')[1] } `,
                status: 'done',
                originFileObj: compressedFile,
            };
            setFileList([...fileList, newFile]);
            message.success('圖片貼上成功');
        } catch (err) {
            message.error('處理貼上圖片失敗，請重試');
            logger.error('Paste image failed', { error: err.message, stack: err.stack });
        } finally {
            setPasteImageLoading(false);
        }
    };

    const getDefaultImage = async () => {
        try {
            const response = await fetch('/wp.jpg');
            if (!response.ok) {
                throw new Error('無法載入預設圖片');
            }
            const blob = await response.blob();
            return new File([blob], 'wp.jpg', { type: 'image/jpeg' });
        } catch (err) {
            message.error('載入預設圖片失敗，請手動上傳圖片');
            logger.error('Failed to load default image', { error: err.message });
            return null;
        }
    };

    const parseLogAndFillForm = () => {
        try {
            const lines = logText.split('\n').map(line => line.trim()).filter(line => line);
            if (lines.length < 2) {
                message.error('日誌內容過短，請確保包含必要信息');
                return;
            }

            logger.info('Parsing log:', { logText, lines });

            let attendees = [];
            const attendeesStartIndex = lines.findIndex(line => line.includes('戰鬥參與者'));
            if (attendeesStartIndex !== -1) {
                const attendeesEndIndex = lines.findIndex((line, idx) => idx > attendeesStartIndex && (line.startsWith('旅團部隊成員') || line.startsWith('戰利品')));
                const attendeesLines = attendeesEndIndex !== -1 ? lines.slice(attendeesStartIndex + 1, attendeesEndIndex) : lines.slice(attendeesStartIndex + 1);
                attendees = attendeesLines
                    .flatMap(line => line.split(/[,，\t\s]+/).map(item => item.trim()))
                    .filter(name => name && name !== '戰鬥參與者');
            } else {
                const potentialAttendeesLine = lines.find(line => line.includes('，') || line.includes(',') || line.includes(' '));
                if (potentialAttendeesLine) {
                    attendees = potentialAttendeesLine
                        .split(/[,，\t\s]+/)
                        .map(name => name.trim())
                        .filter(name => name);
                }
            }

            const validAttendees = attendees
                .filter(attendee => {
                    const normalizedAttendee = attendee.trim().toLowerCase();
                    const isValid = users.some(user => user.trim().toLowerCase() === normalizedAttendee);
                    if (!isValid) {
                        logger.warn(`Attendee ${ attendee } not found in users list`, { users });
                    }
                    return isValid;
                })
                .map(attendee => users.find(user => user.trim().toLowerCase() === attendee.trim().toLowerCase()));
            if (validAttendees.length > 0) {
                form.setFieldsValue({ attendees: validAttendees });
                message.success(`成功解析 ${ validAttendees.length } 名戰鬥參與者`);
            } else {
                const missingAttendees = attendees.filter(attendee =>
                    !users.some(user => user.trim().toLowerCase() === attendee.trim().toLowerCase())
                );
                message.warning(`未找到以下參與者：${ missingAttendees.join(', ') }，請確認用戶名或手動選擇`);
                logger.warn('No valid attendees found', { attendees, users, missingAttendees });
            }

            const headerLine = lines[0];
            const contentLine = lines[1];
            const headers = headerLine.split(/[\t\s]+/).map(h => h.trim());
            const contents = contentLine.split(/[\t\s]+/).map(c => c.trim());

            if (headers.length !== contents.length) {
                message.error(`日誌格式錯誤：表頭字段數(${ headers.length }) 與內容字段數(${ contents.length }) 不一致`);
                return;
            }

            const logData = {};
            headers.forEach((header, index) => {
                logData[header] = contents[index];
            });

            const timeStr = logData['消滅時間'];
            let killTime = null;
            if (timeStr) {
                const timeRegex = /(\d{4}\.\d{2}\.\d{2})[- ](\d{2}[\.:]\d{2}[\.:]\d{2})/;
                const match = timeStr.match(timeRegex);
                if (match) {
                    const datePart = match[1];
                    let timePart = match[2].replace(/\./g, ':');
                    const formattedTime = `${ datePart.replace(/\./g, '-') } ${ timePart } `;
                    killTime = moment(formattedTime, 'YYYY-MM-DD HH:mm:ss');
                    if (!killTime.isValid()) {
                        message.warning('消滅時間格式無效，請手動選擇');
                    } else {
                        form.setFieldsValue({ kill_time: killTime });
                        setDate(killTime);
                    }
                } else {
                    message.warning('未找到有效的消滅時間格式，請手動選擇');
                }
            } else {
                message.warning('未找到消滅時間，請手動選擇');
            }

            const bossName = logData['首領'];
            if (bossName) {
                const boss = bosses.find(b => b.name === bossName);
                if (boss) {
                    form.setFieldsValue({ bossId: boss._id });
                } else {
                    message.warning(`未找到首領 ${ bossName }，請手動選擇`);
                }
            }

            const distribution = logData['分配方式'];
            const guildCaptainName = logData['旅團部隊長'];
            if (distribution) {
                if (distribution.includes('旅團部隊長獲得')) {
                    if (guildCaptainName && users.includes(guildCaptainName)) {
                        form.setFieldsValue({ itemHolder: guildCaptainName });
                        message.success(`已自動選擇旅團部隊長 ${ guildCaptainName } 作為戰利品持有人`);
                    } else {
                        message.warning('未找到旅團部隊長或旅團部隊長不在用戶列表中，請手動選擇物品持有人');
                    }
                } else {
                    const holderMatch = distribution.match(/物品持有人,\s*([^ ]+)/);
                    if (holderMatch) {
                        const itemHolder = holderMatch[1];
                        if (users.includes(itemHolder)) {
                            form.setFieldsValue({ itemHolder });
                        } else {
                            message.warning(`未找到用戶 ${ itemHolder }，請手動選擇物品持有人`);
                        }
                    } else {
                        message.warning('未找到物品持有人，請手動選擇');
                    }
                }
            } else {
                message.warning('未找到分配方式，請手動選擇物品持有人');
            }

            const itemsStartIndex = lines.findIndex(line => line.includes('戰利品'));
            if (itemsStartIndex !== -1) {
                const itemsLines = lines.slice(itemsStartIndex + 1);
                const droppedItems = itemsLines
                    .map(line => {
                        const parts = line.split(/[\t\s]+(?=\d+個)/).map(part => part.trim());
                        logger.info('Parsed item parts:', { line, parts });
                        if (parts.length >= 2) {
                            const itemName = parts[0].split(' (拾取:')[0].trim();
                            return itemName;
                        }
                        return null;
                    })
                    .filter(item => item);
                logger.info('Dropped items:', { droppedItems });
                const validItems = droppedItems
                    .map(itemName => {
                        const normalizedItemName = itemName.replace(/–/g, '-').trim();
                        const foundItem = items.find(item =>
                            item.name.replace(/–/g, '-').trim() === normalizedItemName
                        );
                        if (!foundItem) {
                            logger.warn(`Item ${ itemName } not found in items list`, { normalizedItemName, items });
                        }
                        return foundItem;
                    })
                    .filter(item => item)
                    .map(item => ({ name: item.name }));
                if (validItems.length > 0) {
                    form.setFieldsValue({ item_names: validItems });
                    message.success(`成功解析 ${ validItems.length } 個戰利品`);
                } else {
                    message.warning('未找到有效的戰利品，請檢查物品名稱或手動選擇');
                    logger.warn('No valid items found', { droppedItems, items });
                }
            }

            message.success('已自動填寫表單，請檢查並提交');
        } catch (err) {
            message.error('解析旅團日誌失敗，請檢查格式並重試');
            logger.error('Parse log failed', { error: err.message, stack: err.stack });
        }
    };

    const onFinish = (values) => {
        if (values.item_names && values.item_names.length > 0) {
            setFormValues(values);
            setConfirmModalVisible(true);
        } else {
            message.error('請至少選擇一個掉落物品！');
        }
    };

    const handleConfirmSubmit = () => {
        setConfirmModalVisible(false);
        handleSubmit(formValues);
    };

    const handleCancelSubmit = () => {
        setConfirmModalVisible(false);
        setFormValues(null);
    };

    const handleSubmit = async (values) => {
        setLoading(true);
        const itemNames = values.item_names || [];
        const batchId = uuidv4(); // Generate a unique batch ID for this submission

        try {
            const formDataArray = [];
            for (let i = 0; i < itemNames.length; i++) {
                const item = itemNames[i];
                const selectedItem = items.find(i => i.name === item.name);
                if (!selectedItem) {
                    message.error(`未找到物品 ${ item.name } 的等級信息`);
                    setLoading(false);
                    return;
                }

                const formData = new FormData();
                formData.append('bossId', values.bossId);
                formData.append('kill_time', values.kill_time.toISOString());
                formData.append('dropped_items', JSON.stringify([{
                    name: item.name,
                    type: selectedItem.type || 'equipment',
                    level: selectedItem.level,
                }]));
                formData.append('attendees', JSON.stringify(Array.isArray(values.attendees) ? values.attendees : []));
                formData.append('itemHolder', values.itemHolder || '');
                formData.append('logText', logText);
                formData.append('batchId', batchId); // Add batchId to group records

                // Attach the corresponding screenshot or default image
                if (fileList[i]) {
                    formData.append('screenshot', fileList[i].originFileObj);
                } else {
                    const defaultImage = await getDefaultImage();
                    if (defaultImage) {
                        formData.append('screenshot', defaultImage);
                    }
                }

                formDataArray.push(formData);
            }

            const responses = await Promise.all(formDataArray.map(formData =>
                axiosInstance.post('/api/boss-kills', formData, {
                    headers: { 'Content-Type': 'multipart/form-data' },
                })
            ));

            const killIds = responses.map(res => res.data.results[0]?.kill_id).filter(id => id);
            if (killIds.length > 0) {
                await Promise.all(killIds.map(killId =>
                    axiosInstance.post(`/api/dkp/distribute/${ killId } `, {})
                ));
                logger.info('DKP distributed for kills', { killIds });
            }

            logger.info('Boss kills recorded', { killIds, batchId });
            alert(`擊殺記錄成功！ID: ${ killIds.join(', ') } `);
            form.resetFields();
            setFileList([]);
            setLogText('');
            form.setFieldsValue({ kill_time: null });
        } catch (err) {
            message.error(`提交失敗: ${ err.response?.data?.msg || err.message } `);
            logger.error('Submit boss kills failed', { error: err.message, stack: err.stack });
        } finally {
            setLoading(false);
        }
    };

    const handleAddItem = async (values) => {
        try {
            setLoading(true);
            const newItem = {
                name: values.name,
                type: values.type,
                level: values.level,
                description: values.description || '',
                imageUrl: values.imageUrl || '',
            };
            const res = await axiosInstance.post('/api/items', newItem);
            const addedItem = res.data;
            setItems([...items, addedItem]);
            message.success('新物品添加成功！');

            const currentItems = form.getFieldValue('item_names') || [];
            form.setFieldsValue({
                item_names: [...currentItems, { name: addedItem.name }],
            });

            setAddItemModalVisible(false);
            itemForm.resetFields();
        } catch (err) {
            message.error(`添加新物品失敗: ${ err.response?.data?.msg || err.message } `);
        } finally {
            setLoading(false);
        }
    };

    const uploadProps = {
        onChange: ({ fileList: newFileList }) => {
            setFileList(newFileList.slice(-8));
        },
        beforeUpload: handleBeforeUpload,
        onRemove: handleRemove,
        fileList,
        listType: 'picture-card',
        showUploadList: {
            showPreviewIcon: true,
            showRemoveIcon: true,
            showDownloadIcon: false,
        },
        previewFile: file => {
            return new Promise((resolve) => {
                const reader = new FileReader();
                reader.onload = (e) => resolve(e.target.result);
                reader.readAsDataURL(file.originFileObj || file);
            });
        },
        maxCount: 8,
        accept: 'image/jpeg,image/png',
    };

    const handleAttendeesChange = (value) => {
        const filteredValue = value.filter(val => val !== 'all');
        const allAttendees = userOptions.attendees
            .filter(option => option.value !== 'all')
            .map(option => option.value);

        if (value.includes('all')) {
            const isAllSelected = filteredValue.length === allAttendees.length;
            if (isAllSelected) {
                form.setFieldsValue({ attendees: [] });
            } else {
                form.setFieldsValue({ attendees: allAttendees });
            }
        } else {
            form.setFieldsValue({ attendees: filteredValue });
        }
    };

    const renderItemOption = (item) => {
        const color = item.level?.color || '白色';
        return (
            <Select.Option key={item.name} value={item.name}>
                <span style={{ color: colorMapping[color] || '#000000' }}>{item.name}</span>
            </Select.Option>
        );
    };

    if (rolesLoading) {
        return (
            <div style={{ textAlign: 'center', padding: '50px' }}>
                <Spin size="large" tip="正在載入權限信息..." />
            </div>
        );
    }

    if (!userRoles.includes('admin') && !userRoles.includes('moderator')) {
        return (
            <div style={{ textAlign: 'center', padding: '50px' }}>
                <Alert
                    message="權限不足"
                    description="只有管理員或版主可以訪問此頁面。"
                    type="error"
                    showIcon
                />
            </div>
        );
    }

    return (
        <div style={{
            padding: '20px',
            backgroundColor: '#f0f2f5',
            minHeight: 'calc(90vh - 64px)',
            paddingTop: '84px',
            boxSizing: 'border-box'
        }}>
            <Card
                title={
                    <Row justify="space-between" align="middle">
                        <h2 style={{ margin: 0, fontSize: '24px', color: '#1890ff' }}>首領消滅記錄</h2>
                        {deferredPrompt && (
                            <Button type="link" onClick={handleInstallPWA}>
                                安裝應用
                            </Button>
                        )}
                    </Row>
                }
                bordered={false}
                style={{ boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)', borderRadius: '8px', maxWidth: 1000, margin: '0 auto' }}
            >
                <Spin spinning={loading} size="large">
                    <Form
                        form={form}
                        name="boss_kill"
                        onFinish={onFinish}
                        layout="vertical"
                        style={{ maxWidth: '100%' }}
                        initialValues={{ kill_time: null }}
                        requiredMark={true}
                    >
                        <Form.Item
                            label={
                                <span>
                                    貼上旅團日誌（可自動填寫表單）
                                    
                                </span>
                            }
                            style={{ marginBottom: 16 }}
                        >
                            <Space direction="vertical" style={{ width: '100%' }}>
                                <TextArea
                                    rows={6}
                                    value={logText}
                                    onChange={(e) => setLogText(e.target.value)}
                                    placeholder="請貼上旅團日誌內容"
                                />
                                <Button type="primary" onClick={parseLogAndFillForm}>
                                    解析並填寫表單
                                </Button>
                            </Space>
                        </Form.Item>

                        <Form.Item
                            label="貼上圖片（可選，Ctrl+V 貼上，最多8張）"
                            style={{ marginBottom: 16 }}
                        >
                            <TextArea
                                rows={3}
                                placeholder="按 Ctrl+V 貼上圖片（僅支援 JPEG/PNG）"
                                onPaste={handlePasteImage}
                                disabled={pasteImageLoading || fileList.length >= 8}
                            />
                        </Form.Item>

                        <Form.Item
                            name="screenshots"
                            label="上傳圖片（可選，最多8張，若未上傳則使用預設圖片）"
                            style={{ marginBottom: 16, marginTop: 16 }}
                        >
                            <Upload {...uploadProps}>
                                <Button icon={<UploadOutlined />} loading={uploading}>
                                    上傳圖片
                                </Button>
                            </Upload>
                        </Form.Item>

                        <Row gutter={16}>
                            <Col xs={24} sm={12}>
                                <Form.Item
                                    name="bossId"
                                    label="首領名稱"
                                    rules={[{ required: true, message: '請選擇首領！' }]}
                                    style={{ marginBottom: 16 }}
                                >
                                    <Select
                                        placeholder="選擇首領"
                                        allowClear
                                    >
                                        {bosses.map(boss => (
                                            <Option key={boss._id} value={boss._id}>
                                                {boss.name}
                                            </Option>
                                        ))}
                                    </Select>
                                </Form.Item>
                                <Form.Item
                                    name="kill_time"
                                    label="消滅時間"
                                    rules={[{ required: true, message: '請選擇消滅時間！' }]}
                                    style={{ marginBottom: 16 }}
                                >
                                    <DatePicker
                                        showTime
                                        format="YYYY-MM-DD HH:mm"
                                        value={date}
                                        onChange={(date) => setDate(date)}
                                        style={{ width: '100%' }}
                                        getPopupContainer={trigger => trigger.parentElement}
                                        disabledDate={(current) => current && current > moment().endOf('day')}
                                    />
                                </Form.Item>
                                <Form.List name="item_names">
                                    {(fields, { add, remove }) => (
                                        <>
                                            {fields.map(({ key, name, ...restField }) => (
                                                <Row gutter={16} key={key} style={{ marginBottom: 16 }}>
                                                    <Col xs={24} sm={22}>
                                                        <Form.Item
                                                            {...restField}
                                                            name={[name, 'name']}
                                                            rules={[{ required: true, message: '請選擇戰利品！' }]}
                                                        >
                                                            <Select
                                                                placeholder="選擇戰利品"
                                                                allowClear
                                                                dropdownRender={(menu) => (
                                                                    <>
                                                                        {menu}
                                                                        <Space style={{ padding: '8px', borderTop: '1px solid #e8e8e8' }}>
                                                                            <Button
                                                                                type="link"
                                                                                icon={<PlusOutlined />}
                                                                                onClick={() => setAddItemModalVisible(true)}
                                                                                style={{ width: '100%', textAlign: 'left' }}
                                                                            >
                                                                                新增物品
                                                                            </Button>
                                                                        </Space>
                                                                    </>
                                                                )}
                                                            >
                                                                {items.map(item => renderItemOption(item))}
                                                            </Select>
                                                        </Form.Item>
                                                    </Col>
                                                    <Col xs={24} sm={2}>
                                                        <Button
                                                            type="link"
                                                            onClick={() => remove(name)}
                                                            icon={<DeleteOutlined />}
                                                        />
                                                    </Col>
                                                </Row>
                                            ))}
                                            <Form.Item>
                                                <Button
                                                    type="dashed"
                                                    onClick={() => add()}
                                                    block
                                                    icon={<PlusOutlined />}
                                                >
                                                    添加戰利品
                                                </Button>
                                            </Form.Item>
                                        </>
                                    )}
                                </Form.List>
                            </Col>
                            <Col xs={24} sm={12}>
                                <Form.Item
                                    name="attendees"
                                    label={
                                        <span>
                                            戰鬥參與者{' '}
                                            {form.getFieldValue('attendees')?.length > 0 && (
                                                <span>({form.getFieldValue('attendees').length} 已選)</span>
                                            )}
                                        </span>
                                    }
                                    rules={[{ required: true, message: '請至少選擇一名參與者！' }]}
                                    style={{ marginBottom: 16 }}
                                >
                                    <Select
                                        mode="multiple"
                                        allowClear
                                        style={{ width: '100%' }}
                                        placeholder="請選擇戰鬥參與者（可多選）"
                                        onChange={handleAttendeesChange}
                                        options={userOptions.attendees}
                                        showSearch
                                        filterOption={(input, option) =>
                                            option.label.toLowerCase().indexOf(input.toLowerCase()) >= 0
                                        }
                                    />
                                </Form.Item>
                                <Form.Item
                                    name="itemHolder"
                                    label="戰利品持有人"
                                    style={{ marginBottom: 16 }}
                                >
                                    <Select
                                        allowClear
                                        style={{ width: '100%' }}
                                        placeholder="請選擇戰利品持有人"
                                        options={userOptions.itemHolder}
                                        showSearch
                                        filterOption={(input, option) =>
                                            option.label.toLowerCase().indexOf(input.toLowerCase()) >= 0
                                        }
                                    />
                                </Form.Item>
                            </Col>
                        </Row>
                        <Form.Item style={{ marginBottom: 0 }}>
                            <Button type="primary" htmlType="submit" block disabled={uploading || pasteImageLoading || !online}>
                                提交
                            </Button>
                        </Form.Item>
                    </Form>
                    {!online && (
                        <Alert
                            message="離線模式"
                            description="目前處於離線模式，無法上傳圖片或記錄擊殺。"
                            type="warning"
                            showIcon
                            style={{ marginTop: '16px' }}
                        />
                    )}
                </Spin>
            </Card>

            <Modal
                title={<Title level={4}>確認提交首領消滅記錄</Title>}
                open={confirmModalVisible}
                onOk={handleConfirmSubmit}
                onCancel={handleCancelSubmit}
                okText="確認"
                cancelText="取消"
                width={600}
                style={{ top: 20 }}
                bodyStyle={{ padding: '20px' }}
            >
                {formValues && (
                    <List
                        size="small"
                        bordered
                        dataSource={[
                            { label: '首領名稱', value: bosses.find(b => b._id === formValues.bossId)?.name || '未知' },
                            { label: '擊殺時間', value: formValues.kill_time ? formValues.kill_time.format('YYYY-MM-DD HH:mm') : '' },
                            { label: '掉落物品', value: formValues.item_names?.map(item => item.name).join(', ') || '無' },
                            { label: '出席成員', value: Array.isArray(formValues.attendees) ? formValues.attendees.join(', ') : '無' },
                            { label: '物品持有人', value: formValues.itemHolder || '未分配' },
                            { label: '補充圖片數量', value: fileList.length > 0 ? fileList.length : '使用預設圖片 (wp.jpg)' },
                        ]}
                        renderItem={item => (
                            <List.Item>
                                <Text strong style={{ width: '120px' }}>{item.label}:</Text>
                                <Text>{item.value}</Text>
                            </List.Item>
                        )}
                        style={{ background: '#fff', borderRadius: '8px' }}
                    />
                )}
            </Modal>

            <Modal
                title="新增物品"
                open={addItemModalVisible}
                onCancel={() => {
                    setAddItemModalVisible(false);
                    itemForm.resetFields();
                }}
                footer={null}
            >
                <Form
                    form={itemForm}
                    layout="vertical"
                    onFinish={handleAddItem}
                >
                    <Form.Item
                        name="name"
                        label="物品名稱"
                        rules={[{ required: true, message: '請輸入物品名稱！' }]}
                    >
                        <Input placeholder="輸入物品名稱" />
                    </Form.Item>
                    <Form.Item
                        name="type"
                        label="類型"
                        rules={[{ required: true, message: '請選擇物品類型！' }]}
                    >
                        <Select placeholder="選擇類型">
                            <Option value="equipment">裝備</Option>
                            <Option value="skill">技能</Option>
                        </Select>
                    </Form.Item>
                    <Form.Item
                        name="level"
                        label="等級"
                        rules={[{ required: true, message: '請選擇物品等級！' }]}
                    >
                        <Select placeholder="選擇等級">
                            {itemLevels.map(level => (
                                <Option key={level._id} value={level._id}>
                                    <Tag color={colorMapping[level.color]}>{level.level}</Tag>
                                </Option>
                            ))}
                        </Select>
                    </Form.Item>
                    <Form.Item
                        name="description"
                        label="描述（可選）"
                    >
                        <Input.TextArea placeholder="輸入描述" />
                    </Form.Item>
                    <Form.Item
                        name="imageUrl"
                        label="圖片 URL（可選）"
                        rules={[{ type: 'url', message: '請輸入有效的 URL 地址' }]}
                    >
                        <Input placeholder="輸入圖片 URL" />
                    </Form.Item>
                    <Form.Item>
                        <Button type="primary" htmlType="submit" loading={loading}>
                            提交
                        </Button>
                    </Form.Item>
                </Form>
            </Modal>

            <style jsx>{`
    .ant - upload - list - picture - card.ant - upload - list - item {
    margin: 8px;
    border: 1px solid #d9d9d9;
    borderRadius: 4px;
}
                .ant - upload - list - picture - card.ant - upload - list - item - thumbnail img {
    object - fit: contain;
    width: 100 %;
    height: 100 %;
    border - radius: 4px;
}
                .ant - upload - list - picture - card.ant - upload - list - item - name {
    display: none;
}
                .ant - upload - list - picture - card.ant - upload - list - item - card - actions {
    background: rgba(0, 0, 0, 0.5);
}
                .ant - upload - list - picture - card.ant - upload - list - item - card - actions - btn {
    opacity: 0.8;
}
`}
            </style>
        </div>
    );
};

export default BossKillForm;
