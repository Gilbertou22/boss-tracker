import 'antd/dist/reset.css';
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import Register from './pages/Register';
import BossKillForm from './pages/BossKillForm';
import Login from './pages/Login';
import ApplyItem from './pages/ApplyItem';
import Auction from './pages/Auction';
import Stats from './pages/Stats';
import CreateAuction from './pages/CreateAuction';
import Home from './pages/Home';
import ManageBosses from './pages/ManageBosses';
import ManageItems from './pages/ManageItems';
import ApproveApplications from './pages/ApproveApplications';
import ManageUsers from './pages/ManageUsers';
import ManageItemLevels from './pages/ManageItemLevels';
import RoleRoute from './components/RoleRoute';
import Navbar from './components/Navbar';
import KillHistory from './pages/KillHistory';
import KillDetail from './pages/KillDetail';
import UserProfile from './pages/UserProfile';
import Notifications from './pages/Notifications';
import Guilds from './pages/GuildSettings';
import ApproveAttendRequest from './pages/ManageSupplementRequests';
import React, { useState, useEffect, useContext } from 'react';
import { NotificationProvider } from './components/NotificationContext';
import { AuthProvider } from './AuthProvider'; // 修改為命名導出
import { Layout, Spin, Typography } from 'antd';
import ChangePassword from './components/ChangePassword';
import LogViewer from './pages/LogViewer';
import Wallet from './pages/Wallet';
import DKPSettings from './pages/DKPSettings';
import DKPHistory from './pages/DKPHistory';
import ComingSoon from './pages/ComingSoon';
import ManageMenu from './pages/ManageMenu';
import Forbidden from './pages/Forbidden';
import MenuLogs from './pages/MenuLogs';
import ProfessionManage from './pages/ProfessionManage';
import RoleManage from './pages/RoleManage';
import UserRecords from './pages/UserRecords';
import VoteResults from './components/VoteResults';
import VotePage from './components/VotePage';
import DiamondCalculator from './components/DiamondCalculator';
import DiscordMessageSender from './pages/DCMsgSender';
import SearchPage from './pages/SearchPage';


const { Content, Footer } = Layout;
const { Text } = Typography;

function App() {
    const [profileVisible, setProfileVisible] = useState(false);

    return (
        <NotificationProvider>
            <Router>
                <AuthProvider>
                    <Layout style={{ minHeight: '100vh' }}>
                        <Navbar />
                        <Layout style={{ marginTop: '64px' }}>
                            <Content
                                style={{
                                    padding: '20px',
                                    minHeight: 'calc(100vh - 64px - 64px)',
                                    overflowX: 'hidden',
                                    overflowY: 'auto',
                                    background: '#fff',
                                    flex: '1 0 auto',
                                }}
                            >
                                <Spin spinning={false} size="large">
                                    <Routes>
                                        <Route path="/" element={<Home />} />
                                        <Route path="/register" element={<Register />} />
                                        <Route path="/login" element={<Login />} />
                                        <Route path="/coming-soon" element={<ComingSoon />} />
                                        <Route path="/dcalc"
                                            element={
                                                <RoleRoute allowedRoles={['admin']}>
                                                    <DiamondCalculator />
                                                </RoleRoute>
                                            }
                                        />
                                        <Route
                                            path="/manage-menu"
                                            element={
                                                <RoleRoute allowedRoles={['admin']}>
                                                    <ManageMenu />
                                                </RoleRoute>
                                            }
                                        />
                                        <Route path="/403" element={<Forbidden />} />
                                        <Route path="/change-password" element={<ChangePassword />} />
                                        <Route path="/menu-logs" element={<MenuLogs />} />
                                        <Route
                                            path="/apply-item"
                                            element={
                                                <RoleRoute allowedRoles={['user', 'moderator', 'admin']}>
                                                    <ApplyItem />
                                                </RoleRoute>
                                            }
                                        />
                                        <Route
                                            path="/auction"
                                            element={
                                                <RoleRoute allowedRoles={['user', 'moderator', 'admin']}>
                                                    <Auction />
                                                </RoleRoute>
                                            }
                                        />
                                        <Route
                                            path="/user-records"
                                            element={
                                                <RoleRoute allowedRoles={['user', 'moderator', 'admin']}>
                                                    <UserRecords />
                                                </RoleRoute>
                                            }
                                        />
                                        <Route
                                            path="/search"
                                            element={
                                                <RoleRoute allowedRoles={['admin']}>
                                                    <SearchPage />
                                                </RoleRoute>
                                            }
                                        />
                                        <Route
                                            path="/dcmsg"
                                            element={
                                                <RoleRoute allowedRoles={['admin']}>
                                                    <DiscordMessageSender />
                                                </RoleRoute>
                                            }
                                        />
                                        <Route
                                            path="/manage-professions"
                                            element={
                                                <RoleRoute allowedRoles={['admin']}>
                                                    <ProfessionManage />
                                                </RoleRoute>
                                            }
                                        />
                                        <Route
                                            path="/manage-roles"
                                            element={
                                                <RoleRoute allowedRoles={['admin']}>
                                                    <RoleManage />
                                                </RoleRoute>
                                            }
                                        />
                                        <Route
                                            path="/stats"
                                            element={
                                                <RoleRoute allowedRoles={['admin']}>
                                                    <Stats />
                                                </RoleRoute>
                                            }
                                        />
                                        <Route
                                            path="/logs"
                                            element={
                                                <RoleRoute allowedRoles={['admin']}>
                                                    <LogViewer />
                                                </RoleRoute>
                                            }
                                        />
                                        <Route
                                            path="/dkp/settings"
                                            element={
                                                <RoleRoute allowedRoles={['moderator', 'admin']}>
                                                    <DKPSettings />
                                                </RoleRoute>
                                            }
                                        />
                                        <Route
                                            path="/dkp/history"
                                            element={
                                                <RoleRoute allowedRoles={['user', 'moderator', 'admin']}>
                                                    <DKPHistory />
                                                </RoleRoute>
                                            }
                                        />
                                        <Route
                                            path="/vote-results"
                                            element={
                                                <RoleRoute allowedRoles={['user', 'moderator', 'admin']}>
                                                    <VoteResults />
                                                </RoleRoute>
                                            }
                                        />
                                        <Route
                                            path="/vote"
                                            element={
                                                <RoleRoute allowedRoles={['user', 'moderator', 'admin']}>
                                                    <VotePage />
                                                </RoleRoute>
                                            }
                                        />
                                        <Route
                                            path="/create-auction"
                                            element={
                                                <RoleRoute allowedRoles={['moderator', 'admin']}>
                                                    <CreateAuction />
                                                </RoleRoute>
                                            }
                                        />
                                        <Route
                                            path="/boss-kill"
                                            element={
                                                <RoleRoute allowedRoles={['moderator', 'admin']}>
                                                    <BossKillForm />
                                                </RoleRoute>
                                            }
                                        />
                                        <Route
                                            path="/wallet"
                                            element={
                                                <RoleRoute allowedRoles={['user', 'moderator', 'admin']}>
                                                    <Wallet />
                                                </RoleRoute>
                                            }
                                        />
                                        <Route
                                            path="/manage-bosses"
                                            element={
                                                <RoleRoute allowedRoles={['admin', 'moderator']}>
                                                    <ManageBosses />
                                                </RoleRoute>
                                            }
                                        />
                                        <Route
                                            path="/manage-items"
                                            element={
                                                <RoleRoute allowedRoles={['admin', 'moderator']}>
                                                    <ManageItems />
                                                </RoleRoute>
                                            }
                                        />
                                        <Route
                                            path="/manage-items-level"
                                            element={
                                                <RoleRoute allowedRoles={['admin', 'moderator']}>
                                                    <ManageItemLevels />
                                                </RoleRoute>
                                            }
                                        />
                                        <Route
                                            path="/approve-applications"
                                            element={
                                                <RoleRoute allowedRoles={['moderator', 'admin']}>
                                                    <ApproveApplications />
                                                </RoleRoute>
                                            }
                                        />
                                        <Route
                                            path="/manage-users"
                                            element={
                                                <RoleRoute allowedRoles={['admin']}>
                                                    <ManageUsers />
                                                </RoleRoute>
                                            }
                                        />
                                        <Route
                                            path="/kill-history"
                                            element={
                                                <RoleRoute allowedRoles={['user', 'moderator', 'admin']}>
                                                    <KillHistory />
                                                </RoleRoute>
                                            }
                                        />
                                        <Route
                                            path="/kill-detail/:id"
                                            element={
                                                <RoleRoute allowedRoles={['user', 'moderator', 'admin']}>
                                                    <KillDetail />
                                                </RoleRoute>
                                            }
                                        />
                                        <Route
                                            path="/guilds"
                                            element={
                                                <RoleRoute allowedRoles={['admin']}>
                                                    <Guilds />
                                                </RoleRoute>
                                            }
                                        />
                                        <Route
                                            path="/approve-attend-request"
                                            element={
                                                <RoleRoute allowedRoles={['moderator', 'admin']}>
                                                    <ApproveAttendRequest />
                                                </RoleRoute>
                                            }
                                        />
                                        <Route
                                            path="/notifications"
                                            element={
                                                <RoleRoute allowedRoles={['user', 'moderator', 'admin']}>
                                                    <Notifications />
                                                </RoleRoute>
                                            }
                                        />
                                        <Route path="*" element={<h1 style={{ textAlign: 'center', padding: '20px' }}>404 - 頁面未找到</h1>} />
                                    </Routes>
                                </Spin>
                            </Content>
                            <Footer style={{ textAlign: 'center', padding: '4px 0', flexShrink: 0 }}>
                                <Text type="secondary">
                                    Copyright 邊緣香菇 © 2025 Ver.2025.1.0.0
                                </Text>
                            </Footer>
                        </Layout>
                        <UserProfile visible={profileVisible} onCancel={() => setProfileVisible(false)} />
                    </Layout>
                </AuthProvider>
            </Router>
        </NotificationProvider>
    );
}

export default App;