import React, { useState, useEffect, useContext, useMemo } from 'react';
import axios from 'axios';
import { Doughnut } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { useNavigate } from 'react-router-dom';
import './DiamondCalculator.css';
import { AuthContext } from '../AuthProvider';

// 註冊 Chart.js 組件
ChartJS.register(ArcElement, Tooltip, Legend);

const DiamondCalculator = () => {
  const [totalDiamonds, setTotalDiamonds] = useState('');
  const [members, setMembers] = useState([]);
  const [guildId, setGuildId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sortOrder, setSortOrder] = useState('desc');
  const { user, token } = useContext(AuthContext);
  const navigate = useNavigate();

  const BASE_URL = process.env.REACT_APP_API_URL || '';

  // 獲取唯一旅團和成員數據
  useEffect(() => {
    const fetchData = async () => {
      if (!token) {
        setError('請先登錄以獲取旅團數據');
        setLoading(false);
        return;
      }
      try {
        //console.log('Fetching guilds...');
        const guildsResponse = await axios.get(`${BASE_URL}/api/guilds`, {
          headers: { 'x-auth-token': token },
          cache: 'no-store',
        });
        const guilds = guildsResponse.data;

        if (guilds.length === 0) {
          setError('無可用旅團，請先創建一個旅團');
          setLoading(false);
          return;
        }
        if (guilds.length > 1) {
          setError('檢測到多個旅團，請聯繫管理員確認');
          setLoading(false);
          return;
        }

        const singleGuildId = guilds[0]._id;
        setGuildId(singleGuildId);

        const usersResponse = await axios.get(`${BASE_URL}/api/users?guildId=${singleGuildId}`, {
          headers: { 'x-auth-token': token },
          cache: 'no-store',
        });
        const activeMembers = usersResponse.data
          .filter(user => user.status === 'active')
          .map(user => ({
            id: user._id,
            name: user.character_name,
            diamonds: 0,
            attendanceCount: 0,
            attendanceRate: 0,
          }));

        const attendanceResponse = await axios.get(`${BASE_URL}/api/boss-kills/attendance/${singleGuildId}`, {
          headers: { 'x-auth-token': token },
          cache: 'no-store',
        });
        const attendanceData = attendanceResponse.data.attendance;

        const membersWithAttendance = activeMembers.map(member => {
          const attendance = attendanceData.find(a => a.character_name === member.name) || {
            attendanceCount: 0,
            attendanceRate: 0,
          };
          return {
            ...member,
            attendanceCount: attendance.attendanceCount,
            attendanceRate: attendance.attendanceRate,
          };
        });

        setMembers(membersWithAttendance);
        setLoading(false);
        if (membersWithAttendance.length === 0) {
          setError('當前旅團沒有活躍成員');
        }
      } catch (err) {
        const errorMsg = err.response
          ? `${err.response.status} - ${err.response.data.msg || '無法獲取數據'}`
          : `網絡錯誤: ${err.message}`;
        setError(errorMsg);
        setLoading(false);
      }
    };
    fetchData();
  }, [token]);

  // 排序成員
  const sortedMembers = useMemo(() => {
    return [...members].sort((a, b) => {
      return sortOrder === 'desc'
        ? b.attendanceRate - a.attendanceRate
        : a.attendanceRate - b.attendanceRate;
    });
  }, [members, sortOrder]);

  // 按出席率分配
  const handleDistribute = () => {
    if (totalDiamonds <= 0 || members.length === 0) return;

    const totalAttendanceRate = members.reduce((sum, member) => sum + member.attendanceRate, 0);
    if (totalAttendanceRate === 0) {
      const perMember = Math.floor(totalDiamonds / members.length);
      setMembers(members.map(member => ({
        ...member,
        diamonds: perMember,
      })));
    } else {
      setMembers(members.map(member => ({
        ...member,
        diamonds: Math.floor((totalDiamonds * member.attendanceRate) / totalAttendanceRate) || 0,
      })));
    }
  };

  // 調整個別分配（按份）
  const adjustDiamonds = (id, adjustment) => {
    const perMember = totalDiamonds > 0 && members.length > 0
      ? Math.floor(totalDiamonds / members.length)
      : 0;
    setMembers(members.map(member => {
      if (member.id === id) {
        const newDiamonds = Math.max(0, member.diamonds + (adjustment * perMember));
        return { ...member, diamonds: newDiamonds };
      }
      return member;
    }));
  };

  // 手動輸入鑽石數量
  const handleManualInput = (id, value) => {
    const newDiamonds = value === '' ? 0 : Math.max(0, Number(value));
    let updatedMembers = members.map(member => {
      if (member.id === id) {
        return { ...member, diamonds: newDiamonds };
      }
      return member;
    });

    // 檢查是否超出總量
    const totalDistributed = updatedMembers.reduce((sum, member) => sum + member.diamonds, 0);
    if (totalDistributed > totalDiamonds && totalDiamonds > 0) {
      // 計算需要減少的超額鑽石
      const excess = totalDistributed - totalDiamonds;
      // 獲取其他成員（排除當前手動調整的成員）
      const otherMembers = updatedMembers.filter(member => member.id !== id);
      const totalOtherAttendanceRate = otherMembers.reduce((sum, member) => sum + member.attendanceRate, 0);

      if (totalOtherAttendanceRate > 0) {
        // 按出席率比例減少其他成員的鑽石
        updatedMembers = updatedMembers.map(member => {
          if (member.id === id) {
            return member; // 保留手動調整的鑽石數
          }
          // 計算應減少的量，按出席率比例
          const reduction = Math.floor((excess * member.attendanceRate) / totalOtherAttendanceRate) || 0;
          const newAllocation = Math.max(0, member.diamonds - reduction);
          return { ...member, diamonds: newAllocation };
        });

        // 重新計算總分配量，確保不超額
        const newTotalDistributed = updatedMembers.reduce((sum, member) => sum + member.diamonds, 0);
        if (newTotalDistributed < totalDiamonds) {
          // 如果還有剩餘鑽石，按出席率重新分配給其他成員
          const remainingDiamonds = totalDiamonds - newDiamonds;
          updatedMembers = updatedMembers.map(member => {
            if (member.id === id) {
              return member;
            }
            const additional = Math.floor(
              (remainingDiamonds * member.attendanceRate) / totalOtherAttendanceRate
            ) || 0;
            return { ...member, diamonds: member.diamonds + additional };
          });
        }
      } else {
        // 如果沒有出席率數據，均分減少量
        const reductionPerMember = otherMembers.length > 0
          ? Math.floor(excess / otherMembers.length)
          : 0;
        updatedMembers = updatedMembers.map(member => {
          if (member.id === id) {
            return member;
          }
          const newAllocation = Math.max(0, member.diamonds - reductionPerMember);
          return { ...member, diamonds: newAllocation };
        });

        // 重新計算總分配量，確保不超額
        const newTotalDistributed = updatedMembers.reduce((sum, member) => sum + member.diamonds, 0);
        if (newTotalDistributed < totalDiamonds) {
          // 如果還有剩餘鑽石，均分給其他成員
          const remainingDiamonds = totalDiamonds - newDiamonds;
          const additionalPerMember = otherMembers.length > 0
            ? Math.floor(remainingDiamonds / otherMembers.length)
            : 0;
          updatedMembers = updatedMembers.map(member => {
            if (member.id === id) {
              return member;
            }
            return { ...member, diamonds: member.diamonds + additionalPerMember };
          });
        }
      }
    }

    setMembers(updatedMembers);
  };

  // 重置分配
  const handleReset = () => {
    setTotalDiamonds('');
    setMembers(members.map(member => ({ ...member, diamonds: 0 })));
  };

  // 導出 CSV
  const handleExport = () => {
    const data = sortedMembers.map(m => ({
      name: m.name,
      diamonds: m.diamonds,
      attendanceRate: (m.attendanceRate * 100).toFixed(1) + '%',
    }));
    const escapeCsvField = (field) => {
      if (typeof field !== 'string') return field;
      if (field.includes(',') || field.includes('"') || field.includes('\n')) {
        return `"${field.replace(/"/g, '""')}"`;
      }
      return field;
    };
    const csvContent = [
      '\uFEFF',
      '名稱,鑽石,出席率',
      ...data.map(m => `${escapeCsvField(m.name)},${m.diamonds},${m.attendanceRate}`),
    ].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `diamond_allocation_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  // 輸入驗證
  const handleInputChange = (e) => {
    const value = e.target.value;
    if (value === '' || (Number(value) >= 0 && !isNaN(value))) {
      setTotalDiamonds(value === '' ? '' : Number(value));
    }
  };

  // 切換排序
  const toggleSortOrder = () => {
    setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc');
  };

  const totalDistributed = sortedMembers.reduce((sum, member) => sum + member.diamonds, 0);
  const isInputValid = totalDiamonds !== '' && totalDiamonds > 0;

  // 圖表數據
  const chartData = {
    labels: sortedMembers.map(m => m.name),
    datasets: [
      {
        data: sortedMembers.map(m => m.diamonds),
        backgroundColor: [
          '#1a73e8',
          '#34c759',
          '#f4b400',
          '#e63946',
          '#9333ea',
          '#00b4d8',
          '#f97316',
        ].slice(0, sortedMembers.length),
        borderColor: '#ffffff',
        borderWidth: 2,
      },
    ],
  };

  const chartOptions = {
    plugins: {
      legend: {
        position: 'bottom',
        labels: { font: { size: 14 }, padding: 20 },
      },
      tooltip: {
        callbacks: {
          label: (context) => {
            const member = sortedMembers[context.dataIndex];
            const value = context.parsed || 0;
            const percentage = totalDiamonds > 0 ? ((value / totalDiamonds) * 100).toFixed(1) : 0;
            return `${context.label}: ${value} 鑽石 (${percentage}%), 出席率: ${Math.round(member.attendanceRate * 100)}%`;
          },
        },
      },
    },
    maintainAspectRatio: false,
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>正在加載旅團數據...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="error-container">
        <h2>錯誤</h2>
        <p>{error}</p>
        <div className="button-group">
          <button
            className="retry-button"
            onClick={() => window.location.reload()}
            title="重新加載頁面"
          >
            重試
          </button>
          {error.includes('無可用旅團') && (
            <button
              onClick={() => navigate('/guilds/create')}
              title="創建新旅團"
            >
              創建旅團
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <h1>旅團鑽石分配計算器</h1>
      <div className="input-section">
        <label className="input-label">
          總鑽石數量：
          <input
            type="number"
            min="0"
            value={totalDiamonds}
            onChange={handleInputChange}
            placeholder="輸入鑽石數量"
            className={isInputValid || totalDiamonds === '' ? '' : 'input-error'}
          />
          {!isInputValid && totalDiamonds !== '' && (
            <span className="input-error-message">請輸入有效的正數</span>
          )}
        </label>
        <div className="button-group">
          <button
            onClick={handleDistribute}
            disabled={!isInputValid || members.length === 0}
            title="按過去兩週的出席率加權分配鑽石"
          >
            按出席率分配
          </button>
          <button
            onClick={handleReset}
            disabled={totalDiamonds === '' && members.every(m => m.diamonds === 0)}
            title="清空輸入和分配結果"
          >
            重置
          </button>
          <button
            onClick={handleExport}
            disabled={members.every(m => m.diamonds === 0)}
            title="將分配結果導出為 CSV 文件（包含名稱、鑽石數、出席率）"
          >
            導出結果
          </button>
        </div>
      </div>
      {sortedMembers.length > 0 ? (
        <>
          <div className="sort-control">
            <button
              onClick={toggleSortOrder}
              title={`按出席率${sortOrder === 'desc' ? '降序' : '升序'}排序`}
            >
              按出席率 {sortOrder === 'desc' ? '↓' : '↑'} 排序
            </button>
          </div>
          <div className="member-list">
            {sortedMembers.map(member => (
              <div key={member.id} className="member-item">
                <span className="member-name">
                  {member.name}
                  <span className="attendance-info">
                    (出席: {member.attendanceCount} 次, {Math.round(member.attendanceRate * 100)}%)
                  </span>
                </span>
                <div className="member-diamonds">
                  <input
                    type="number"
                    min="0"
                    value={member.diamonds}
                    onChange={e => handleManualInput(member.id, e.target.value)}
                    className="diamond-input"
                    title="直接輸入分配的鑽石數量"
                  />
                  <span className="diamond-label">
                    鑽石
                    {totalDiamonds > 0 && (
                      <span className="percentage">
                        ({((member.diamonds / totalDiamonds) * 100).toFixed(1)}%)
                      </span>
                    )}
                  </span>
                </div>
                <div className="member-actions">
                  <button
                    onClick={() => adjustDiamonds(member.id, 1)}
                    disabled={!isInputValid}
                    title="增加一份平均分配量"
                  >
                    +1份
                  </button>
                  <button
                    onClick={() => adjustDiamonds(member.id, -1)}
                    disabled={!isInputValid || member.diamonds === 0}
                    title="減少一份平均分配量"
                  >
                    -1份
                  </button>
                </div>
              </div>
            ))}
          </div>
          <div className="summary">
            <p>
              已分配鑽石：<strong>{totalDistributed}</strong> / {totalDiamonds}
            </p>
            <p>
              剩餘鑽石：<strong>{totalDiamonds - totalDistributed}</strong>
            </p>
            {totalDistributed > totalDiamonds && (
              <p className="warning">警告：分配總量超過輸入的鑽石數量！</p>
            )}
            {totalDistributed > 0 && (
              <div className="chart-container">
                <h3>分配比例</h3>
                <div className="chart-wrapper">
                  <Doughnut data={chartData} options={chartOptions} />
                </div>
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="empty-state">
          <p>當前旅團沒有活躍成員可分配鑽石。</p>
        </div>
      )}
    </div>
  );
};

export default DiamondCalculator;