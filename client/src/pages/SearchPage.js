import React, { useState, useEffect } from 'react';
import { Select, Table, Button, DatePicker, message } from 'antd';
import { Bar } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';
import { saveAs } from 'file-saver';
import axiosInstance from '../utils/axiosInstance';
import moment from 'moment';
import 'antd/dist/reset.css'; // Ant Design v5

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

const { Option } = Select;
const { RangePicker } = DatePicker;

const colorMapping = {
    '一般': '#f0f0f0',
    '高級': '#00cc00',
    '稀有': '#1e90ff',
    '英雄': '#EC3636',
    '傳說': '#B931F3',
    '神話': '#ffd700',
};

const SearchPage = () => {
    const [searchType, setSearchType] = useState('member');
    const [query, setQuery] = useState('');
    const [itemLevel, setItemLevel] = useState('');
    const [dateRange, setDateRange] = useState([]);
    const [data, setData] = useState([]);
    const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 });
    const [itemLevels, setItemLevels] = useState([]);
    const [options, setOptions] = useState([]);
    const [loading, setLoading] = useState(false);
    const [optionsLoading, setOptionsLoading] = useState(false);

    // 表格欄位
    const columns = [
        {
            title: '查詢成員',
            dataIndex: 'character_name',
            sorter: (a, b) => a.character_name.localeCompare(b.character_name),
            hidden: searchType !== 'member',
        },
        {
            title: '最終獲得者',
            dataIndex: 'final_recipient',
            sorter: (a, b) => a.final_recipient.localeCompare(b.final_recipient),
        },
        {
            title: '是否最終獲得',
            dataIndex: 'is_final_recipient',
            render: (value) => (value ? '是' : '否'),
            sorter: (a, b) => a.is_final_recipient - b.is_final_recipient,
            hidden: searchType !== 'member',
        },
        {
            title: '首領名稱',
            dataIndex: 'boss_name',
            sorter: (a, b) => a.boss_name.localeCompare(b.boss_name),
        },
        {
            title: '物品名稱',
            dataIndex: 'item_name',
            sorter: (a, b) => a.item_name.localeCompare(b.item_name),
        },
        {
            title: '物品等級',
            dataIndex: 'item_level',
            sorter: (a, b) => a.item_level.localeCompare(b.item_level),
            render: (text) => (
                <span style={{ color: colorMapping[text] || '#000000' }}>{text}</span>
            ),
        },
        {
            title: '物品類型',
            dataIndex: 'item_type',
            sorter: (a, b) => a.item_type.localeCompare(b.item_type),
        },
        {
            title: '掉落時間',
            dataIndex: 'kill_time',
            sorter: (a, b) => new Date(a.kill_time) - new Date(b.kill_time),
            render: (text) => moment(text).format('YYYY-MM-DD HH:mm'),
        },
        {
            title: '申請狀態',
            dataIndex: 'application_status',
            sorter: (a, b) => a.application_status.localeCompare(b.application_status),
        },
        {
            title: '掉落次數',
            dataIndex: 'drop_count',
            sorter: (a, b) => (a.drop_count || 0) - (b.drop_count || 0),
            render: (text) => text || '-',
        },
    ].filter(column => !column.hidden);

    // 獲取物品等級選項
    useEffect(() => {
        const fetchItemLevels = async () => {
            try {
                const response = await axiosInstance.get('/api/item-levels');
                setItemLevels(response.data);
            } catch (error) {
                message.error('獲取物品等級失敗');
            }
        };
        fetchItemLevels();
    }, []);

    // 根據 searchType 獲取下拉選單選項
    useEffect(() => {
        const fetchOptions = async () => {
            setOptionsLoading(true);
            try {
                const response = await axiosInstance.get(`/api/search/autocomplete?type=${searchType}`);
                setOptions(response.data.results);
            } catch (error) {
                message.error('獲取下拉選單選項失敗');
            } finally {
                setOptionsLoading(false);
            }
        };
        fetchOptions();
    }, [searchType]);

    // 查詢數據
    const fetchData = async (page = 1, pageSize = 10) => {
        setLoading(true);
        try {
            const params = {
                type: searchType,
                query,
                itemLevel,
                page,
                pageSize,
                startTime: dateRange[0] ? dateRange[0].format('YYYY-MM-DD') : undefined,
                endTime: dateRange[1] ? dateRange[1].format('YYYY-MM-DD') : undefined,
            };
            const response = await axiosInstance.get('/api/search', { params });
            setData(response.data.data);
            setPagination(response.data.pagination);
        } catch (error) {
            message.error(error.response?.data?.msg || '查詢失敗，請稍後重試');
        } finally {
            setLoading(false);
        }
    };

    // 處理表格分頁和排序
    const handleTableChange = (pagination, filters, sorter) => {
        fetchData(pagination.current, pagination.pageSize);
    };

    // 導出 CSV
    const exportToCSV = () => {
        const headers = searchType === 'member'
            ? ['查詢成員', '最終獲得者', '是否最終獲得', '首領名稱', '物品名稱', '物品等級', '物品類型', '掉落時間', '申請狀態', '掉落次數']
            : ['最終獲得者', '首領名稱', '物品名稱', '物品等級', '物品類型', '掉落時間', '申請狀態', '掉落次數'];
        const csv = [
            headers.join(','),
            ...data.map(row =>
                searchType === 'member'
                    ? [
                        row.character_name || '-',
                        row.final_recipient || '-',
                        row.is_final_recipient ? '是' : '否',
                        row.boss_name || '-',
                        row.item_name || '-',
                        row.item_level || '-',
                        row.item_type || '-',
                        moment(row.kill_time).format('YYYY-MM-DD HH:mm'),
                        row.application_status || '-',
                        row.drop_count || '-',
                    ].join(',')
                    : [
                        row.final_recipient || '-',
                        row.boss_name || '-',
                        row.item_name || '-',
                        row.item_level || '-',
                        row.item_type || '-',
                        moment(row.kill_time).format('YYYY-MM-DD HH:mm'),
                        row.application_status || '-',
                        row.drop_count || '-',
                    ].join(',')
            ),
        ].join('\n');
        const blob = new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8' });
        saveAs(blob, 'search_results.csv');
    };

    // 圖表數據
    const chartData = {
        labels: data.map(d => d.item_name || d.character_name || d.boss_name),
        datasets: [
            {
                label: searchType === 'item' ? '掉落次數' : '參與次數分佈',
                data: data.map(d => d.drop_count || 1),
                backgroundColor: data.map(d => colorMapping[d.item_level] || '#1890ff'),
            },
        ],
    };

    return (
        <div style={{ padding: '20px' }}>
            <h2>掉落記錄查詢</h2>
            <div style={{ marginBottom: '20px', display: 'flex', alignItems: 'center' }}>
                <Select
                    value={searchType}
                    onChange={(value) => {
                        setSearchType(value);
                        setQuery('');
                    }}
                    style={{ width: 120, marginRight: 10 }}
                >
                    <Option value="member">成員</Option>
                    <Option value="boss">首領</Option>
                    <Option value="item">物品</Option>
                </Select>
                <Select
                    value={query}
                    onChange={setQuery}
                    placeholder={`選擇${searchType === 'member' ? '成員名稱' : searchType === 'boss' ? '首領名稱' : '物品名稱'}`}
                    style={{ width: 200, marginRight: 10 }}
                    showSearch
                    optionFilterProp="children"
                    filterOption={(input, option) =>
                        option.children.toLowerCase().indexOf(input.toLowerCase()) >= 0
                    }
                    allowClear
                    loading={optionsLoading}
                >
                    {options.map(option => (
                        <Option key={option} value={option}>{option}</Option>
                    ))}
                </Select>
                <Select
                    placeholder="選擇物品等級"
                    value={itemLevel}
                    onChange={setItemLevel}
                    style={{ width: 150, marginRight: 10 }}
                    allowClear
                >
                    {itemLevels.map(level => (
                        <Option key={level._id} value={level.level}>{level.level}</Option>
                    ))}
                </Select>
                <RangePicker
                    onChange={(dates) => setDateRange(dates)}
                    style={{ marginRight: 10 }}
                />
                <Button type="primary" onClick={() => fetchData()} loading={loading}>
                    查詢
                </Button>
                <Button
                    onClick={() => {
                        setQuery('');
                        setItemLevel('');
                        setDateRange([]);
                        setData([]);
                    }}
                    style={{ marginLeft: 10 }}
                >
                    重置
                </Button>
                <Button onClick={exportToCSV} style={{ marginLeft: 10 }} disabled={!data.length}>
                    導出 CSV
                </Button>
            </div>
            <Table
                columns={columns}
                dataSource={data}
                pagination={pagination}
                loading={loading}
                onChange={handleTableChange}
                rowKey="_id"
            />

        </div>
    );
};

export default SearchPage;