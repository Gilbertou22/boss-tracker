import React, { useState, useEffect } from 'react';
import { Modal, Form, Input, DatePicker, Button, Upload, message, Spin, Select, Image, Descriptions, Tag, Space, Popconfirm } from 'antd';
import { UploadOutlined, DeleteOutlined, ClockCircleOutlined, UserOutlined, GiftOutlined, TagOutlined, AppstoreOutlined, TeamOutlined, CheckOutlined } from '@ant-design/icons';
import axios from 'axios';
import moment from 'moment';

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

const KillDetailModal = ({ visible, onCancel, killData, onUpdate, token, initialEditing = false }) => {
    const [form] = Form.useForm();
    const [editing, setEditing] = useState(initialEditing);
    const [loading, setLoading] = useState(false);
    const [fileList, setFileList] = useState([]);
    const [attendees, setAttendees] = useState([]);
    const [allUsers, setAllUsers] = useState([]);
    const [currentUser, setCurrentUser] = useState(null);
    const [updatedKillData, setUpdatedKillData] = useState(killData);
    const [role, setRole] = useState(null);
    const [applications, setApplications] = useState([]);

    useEffect(() => {
        if (visible) {
            fetchCurrentUser();
            if (killData && killData._id) {
                fetchKillData(killData._id);
                fetchApplications(killData._id);
            }
        }
    }, [visible, killData]);

    useEffect(() => {
        if (updatedKillData) {
            form.setFieldsValue({
                bossId: updatedKillData.bossId?._id,
                kill_time: updatedKillData.kill_time ? moment(updatedKillData.kill_time) : null,
                itemHolder: updatedKillData.itemHolder,
                attendees: updatedKillData.attendees || [],
                dropped_items: updatedKillData.dropped_items?.map(item => ({
                    name: item.name,
                    level: item.level?._id || item.level,
                })) || [],
            });
            setAttendees(updatedKillData.attendees || []);
            setFileList(updatedKillData.screenshots?.map((url, index) => ({
                uid: index,
                name: `screenshot-${index}.png`,
                status: 'done',
                url,
            })) || []);
        }
    }, [updatedKillData, form]);

    useEffect(() => {
        if (editing) {
            fetchAllUsers();
        }
    }, [editing]);

    const fetchCurrentUser = async () => {
        try {
            const res = await axios.get(`${BASE_URL}/api/users/me`, {
                headers: { 'x-auth-token': token },
            });
            setCurrentUser(res.data.character_name);
            setRole(res.data.role);
        } catch (err) {
            message.error('無法獲取當前用戶信息');
        }
    };

    const fetchKillData = async (killId) => {
        try {
            setLoading(true);
            const res = await axios.get(`${BASE_URL}/api/boss-kills/${killId}`, {
                headers: { 'x-auth-token': token },
            });
            const detail = res.data;
            detail.screenshots = detail.screenshots
                ? detail.screenshots.map(src => (src ? `${BASE_URL}/${src.replace('./', '')}` : ''))
                : [];
            setUpdatedKillData(detail);
        } catch (err) {
            message.error(`載入詳情失敗: ${err.response?.data?.msg || err.message}`);
        } finally {
            setLoading(false);
        }
    };

    const fetchApplications = async (killId) => {
        try {
            const res = await axios.get(`${BASE_URL}/api/applications/by-kill/${killId}`, {
                headers: { 'x-auth-token': token },
            });
            setApplications(res.data || []);
        } catch (err) {
            message.error('無法載入申請記錄');
            setApplications([]);
        }
    };

    const fetchAllUsers = async () => {
        try {
            const res = await axios.get(`${BASE_URL}/api/users`, {
                headers: { 'x-auth-token': token },
            });
            setAllUsers(res.data);
        } catch (err) {
            message.error('無法載入用戶列表');
        }
    };

    const handleSubmit = async (values) => {
        setLoading(true);
        try {
            const formData = new FormData();
            formData.append('bossId', values.bossId);
            formData.append('kill_time', values.kill_time.toISOString());
            formData.append('itemHolder', values.itemHolder);
            values.attendees.forEach(attendee => formData.append('attendees[]', attendee));
            values.dropped_items.forEach((item, index) => {
                formData.append(`dropped_items[${index}][name]`, item.name);
                formData.append(`dropped_items[${index}][level]`, item.level);
            });
            fileList.forEach(file => {
                if (file.originFileObj) {
                    formData.append('screenshots', file.originFileObj);
                }
            });

            const res = await axios.put(`${BASE_URL}/api/boss-kills/${killData._id}`, formData, {
                headers: {
                    'x-auth-token': token,
                    'Content-Type': 'multipart/form-data',
                },
            });
            message.success(res.data.msg || '更新成功！');
            onUpdate();
        } catch (err) {
            message.error(`更新失敗: ${err.response?.data?.msg || err.message}`);
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteScreenshot = (file) => {
        setFileList(fileList.filter(item => item.uid !== file.uid));
    };

    const handleUploadChange = ({ fileList }) => {
        setFileList(fileList);
    };

    const handleApproveApplication = async (applicationId) => {
        try {
            setLoading(true);
            const res = await axios.post(`${BASE_URL}/api/applications/${applicationId}/approve`, {}, {
                headers: { 'x-auth-token': token },
            });
            message.success(res.data.msg);
            fetchKillData(updatedKillData._id);
            fetchApplications(updatedKillData._id);
        } catch (err) {
            message.error(`批准申請失敗: ${err.response?.data?.msg || err.message}`);
        } finally {
            setLoading(false);
        }
    };

    const renderDetailView = () => {
        if (!updatedKillData) return null;

        return (
            <div>
                <h3 style={{ fontSize: '16px', marginBottom: '16px', color: '#1890ff' }}>擊殺詳情</h3>
                <Descriptions column={1} bordered size="small">
                    <Descriptions.Item label={<span><ClockCircleOutlined style={{ marginRight: 4 }} />擊殺時間</span>}>
                        {moment(updatedKillData.kill_time).format('YYYY-MM-DD HH:mm:ss')}
                    </Descriptions.Item>
                    <Descriptions.Item label={<span><TagOutlined style={{ marginRight: 4 }} />首領名稱</span>}>
                        {updatedKillData.bossId?.name || '未知首領'}
                    </Descriptions.Item>
                    <Descriptions.Item label={<span><TagOutlined style={{ marginRight: 4 }} />狀態</span>}>
                        <Tag
                            color={
                                updatedKillData.status === 'pending' ? 'orange' :
                                    updatedKillData.status === 'assigned' ? 'blue' :
                                        updatedKillData.status === 'expired' ? 'red' : 'default'
                            }
                        >
                            {updatedKillData.status === 'pending' ? '待分配' :
                                updatedKillData.status === 'assigned' ? '已分配' :
                                    updatedKillData.status === 'expired' ? '已過期' : '未知'}
                        </Tag>
                    </Descriptions.Item>
                    <Descriptions.Item label={<span><UserOutlined style={{ marginRight: 4 }} />物品持有人</span>}>
                        {updatedKillData.itemHolder || '未分配'}
                    </Descriptions.Item>
                </Descriptions>

                <h3 style={{ fontSize: '16px', margin: '12px 0 8px', color: '#1890ff' }}>參與者</h3>
                <div
                    style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: '8px',
                        background: '#fff',
                        borderRadius: '6px',
                        padding: '8px',
                        border: '1px solid #e8e8e8',
                    }}
                >
                    {updatedKillData.attendees && updatedKillData.attendees.length > 0 ? (
                        updatedKillData.attendees.map((attendee, index) => {
                            const isCurrentUser = currentUser && attendee === currentUser;
                            return (
                                <Tag
                                    key={index}
                                    icon={
                                        isCurrentUser ? (
                                            <CheckOutlined style={{ marginRight: 4, color: '#669126' }} />
                                        ) : (
                                            <TeamOutlined style={{ marginRight: 4, color: isCurrentUser ? '#fff' : '#1890ff' }} />
                                        )
                                    }
                                    color={isCurrentUser ? '#ebf5dc' : 'blue'}
                                    style={{
                                        margin: '2px',
                                        padding: '2px 6px',
                                        fontSize: '11px',
                                        borderRadius: '4px',
                                        color: isCurrentUser ? '#669126' : undefined,
                                        border: isCurrentUser ? '1px solid #669126' : undefined,
                                    }}
                                >
                                    {attendee}
                                </Tag>
                            );
                        })
                    ) : (
                        <p style={{ margin: 0, fontSize: '11px' }}>無參與者</p>
                    )}
                </div>

                <h3 style={{ fontSize: '16px', margin: '12px 0 8px', color: '#1890ff' }}>掉落物品</h3>
                {updatedKillData.dropped_items && updatedKillData.dropped_items.length > 0 ? (
                    updatedKillData.dropped_items.map((item, index) => {
                        const effectiveStatus = item.status ? item.status.toLowerCase() : 'pending';
                        const finalRecipient = item.final_recipient || updatedKillData.final_recipient || '未分配';

                        const itemApplications = applications.filter(app =>
                            (app.item_id.toString() === (item._id || item.id).toString())
                        );

                        return (
                            <div
                                key={index}
                                style={{
                                    border: '1px solid #e8e8e8',
                                    borderRadius: '6px',
                                    padding: '8px',
                                    background: '#fafafa',
                                    marginBottom: '8px',
                                }}
                            >
                                <Descriptions column={1} bordered size="small">
                                    <Descriptions.Item label={<span><GiftOutlined style={{ marginRight: 4 }} />物品名稱</span>}>
                                        <span style={{ color: colorMapping[item.level?.color] || '#000' }}>
                                            {item.name || '未知物品'}
                                        </span>
                                    </Descriptions.Item>
                                    <Descriptions.Item label={<span><TagOutlined style={{ marginRight: 4 }} />等級</span>}>
                                        {item.level?.level || '未知'}
                                    </Descriptions.Item>
                                    <Descriptions.Item label={<span><UserOutlined style={{ marginRight: 4 }} />最終分配者</span>}>
                                        {finalRecipient}
                                    </Descriptions.Item>
                                    <Descriptions.Item label={<span><TagOutlined style={{ marginRight: 4 }} />申請狀態</span>}>
                                        <Tag
                                            color={
                                                effectiveStatus === 'pending' ? 'orange' :
                                                    effectiveStatus === 'assigned' ? 'blue' :
                                                        effectiveStatus === 'expired' ? 'red' : 'default'
                                            }
                                        >
                                            {effectiveStatus === 'pending' ? '待分配' :
                                                effectiveStatus === 'assigned' ? '已分配' :
                                                    effectiveStatus === 'expired' ? '已過期' : '未知'}
                                        </Tag>
                                    </Descriptions.Item>
                                    {role === 'admin' && itemApplications.length > 0 && (
                                        <Descriptions.Item label={<span><UserOutlined style={{ marginRight: 4 }} />申請者</span>}>
                                            <Space direction="vertical">
                                                {itemApplications.map(app => (
                                                    <div key={app._id}>
                                                        <span>{app.user_id.character_name}</span>
                                                        {app.status === 'pending' && (
                                                            <Popconfirm
                                                                title={`確認批准 ${app.user_id.character_name} 的申請？`}
                                                                onConfirm={() => handleApproveApplication(app._id)}
                                                                okText="是"
                                                                cancelText="否"
                                                            >
                                                                <Button type="link" size="small" style={{ color: '#1890ff' }}>
                                                                    批准
                                                                </Button>
                                                            </Popconfirm>
                                                        )}
                                                    </div>
                                                ))}
                                            </Space>
                                        </Descriptions.Item>
                                    )}
                                </Descriptions>
                            </div>
                        );
                    })
                ) : (
                    <p style={{ margin: 0, fontSize: '11px' }}>無掉落物品</p>
                )}

                <h3 style={{ fontSize: '16px', margin: '12px 0 8px', color: '#1890ff' }}>擊殺截圖</h3>
                {updatedKillData.screenshots && updatedKillData.screenshots.length > 0 ? (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                        {updatedKillData.screenshots.map((url, index) => (
                            <Image
                                key={index}
                                src={url}
                                alt={`擊殺截圖 ${index + 1}`}
                                style={{ maxWidth: '100px', maxHeight: '100px', borderRadius: '6px' }}
                            />
                        ))}
                    </div>
                ) : (
                    <p style={{ margin: 0, fontSize: '11px' }}>無擊殺截圖</p>
                )}
            </div>
        );
    };

    return (
        <Modal
            title={<span style={{ fontSize: '18px', fontWeight: 'bold' }}>擊殺詳情</span>}
            open={visible}
            onCancel={onCancel}
            footer={editing ? [
                <Button key="cancel" onClick={onCancel}>
                    取消
                </Button>,
                <Button key="submit" type="primary" onClick={() => form.submit()} loading={loading}>
                    提交
                </Button>,
            ] : [
                <Button key="close" onClick={onCancel}>
                    關閉
                </Button>,
            ]}
            width="90vw"
            style={{ maxWidth: '800px', top: '10px' }}
            bodyStyle={{ maxHeight: '80vh', overflowY: 'auto' }}
        >
            <Spin spinning={loading}>
                {editing ? (
                    <Form
                        form={form}
                        layout="vertical"
                        onFinish={handleSubmit}
                    >
                        <Form.Item
                            name="bossId"
                            label="首領名稱"
                            rules={[{ required: true, message: '請輸入首領名稱' }]}
                        >
                            <Input />
                        </Form.Item>
                        <Form.Item
                            name="kill_time"
                            label="擊殺時間"
                            rules={[{ required: true, message: '請選擇擊殺時間' }]}
                        >
                            <DatePicker showTime style={{ width: '100%' }} />
                        </Form.Item>
                        <Form.Item
                            name="itemHolder"
                            label="物品持有人"
                            rules={[{ required: true, message: '請選擇物品持有人' }]}
                        >
                            <Select placeholder="選擇物品持有人">
                                {allUsers.map(user => (
                                    <Option key={user._id} value={user.character_name}>
                                        {user.character_name}
                                    </Option>
                                ))}
                            </Select>
                        </Form.Item>
                        <Form.Item
                            name="attendees"
                            label="參與者"
                            rules={[{ required: true, message: '請選擇參與者' }]}
                        >
                            <Select
                                mode="multiple"
                                placeholder="選擇參與者"
                                onChange={(value) => setAttendees(value)}
                            >
                                {allUsers.map(user => (
                                    <Option key={user._id} value={user.character_name}>
                                        {user.character_name}
                                    </Option>
                                ))}
                            </Select>
                        </Form.Item>
                        <Form.List name="dropped_items">
                            {(fields, { add, remove }) => (
                                <>
                                    {fields.map(({ key, name, ...restField }) => (
                                        <Space key={key} style={{ display: 'flex', marginBottom: 8 }} align="baseline">
                                            <Form.Item
                                                {...restField}
                                                name={[name, 'name']}
                                                rules={[{ required: true, message: '請輸入物品名稱' }]}
                                            >
                                                <Input placeholder="物品名稱" />
                                            </Form.Item>
                                            <Form.Item
                                                {...restField}
                                                name={[name, 'level']}
                                                rules={[{ required: true, message: '請選擇物品等級' }]}
                                            >
                                                <Select placeholder="物品等級" style={{ width: 120 }}>
                                                    {Object.keys(colorMapping).map(color => (
                                                        <Option key={color} value={color}>{color}</Option>
                                                    ))}
                                                </Select>
                                            </Form.Item>
                                            <Button
                                                type="link"
                                                icon={<DeleteOutlined />}
                                                onClick={() => remove(name)}
                                            />
                                        </Space>
                                    ))}
                                    <Form.Item>
                                        <Button type="dashed" onClick={() => add()} block icon={<UploadOutlined />}>
                                            添加掉落物品
                                        </Button>
                                    </Form.Item>
                                </>
                            )}
                        </Form.List>
                        <Form.Item label="擊殺截圖">
                            <Upload
                                listType="picture-card"
                                fileList={fileList}
                                onRemove={handleDeleteScreenshot}
                                onChange={handleUploadChange}
                                beforeUpload={() => false}
                            >
                                {fileList.length >= 8 ? null : (
                                    <div>
                                        <UploadOutlined />
                                        <div style={{ marginTop: 8 }}>上傳</div>
                                    </div>
                                )}
                            </Upload>
                        </Form.Item>
                    </Form>
                ) : (
                    renderDetailView()
                )}
            </Spin>

            <style jsx global>{`
                .ant-modal-body {
                    padding: 24px;
                }
                .ant-descriptions-item-label {
                    width: 150px;
                    background: #f5f5f5;
                    font-weight: 500;
                    font-size: 12px;
                    padding: 4px 8px;
                }
                .ant-descriptions-item-content {
                    background: #fff;
                    font-size: 12px;
                    padding: 4px 8px;
                }
                .ant-tag {
                    padding: 2px 6px;
                    font-size: 11px;
                }
                @media (max-width: 768px) {
                    .ant-modal-body {
                        padding: 12px;
                    }
                    .ant-descriptions-item-label {
                        width: 80px;
                        font-size: 11px;
                        padding: 2px 4px;
                    }
                    .ant-descriptions-item-content {
                        font-size: 11px;
                        padding: 2px 4px;
                    }
                    .ant-tag {
                        padding: 1px 4px;
                        font-size: 10px;
                    }
                    .ant-modal-content {
                        top: 5px;
                    }
                }
            `}</style>
        </Modal>
    );
};

export default KillDetailModal;