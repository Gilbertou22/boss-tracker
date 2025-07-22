import React from 'react';
import { Navigate } from 'react-router-dom';
import axios from 'axios';
import logger from '../utils/logger'; // 引入前端日誌工具


const BASE_URL = process.env.REACT_APP_API_URL || '';

const AdminRoute = ({ children }) => {
    const token = localStorage.getItem('token');

    const [isAdmin, setIsAdmin] = React.useState(false);
    const [loading, setLoading] = React.useState(true);

    React.useEffect(() => {
        const checkAdmin = async () => {
            if (!token) {
                setLoading(false);
                return;
            }
            try {
                const res = await axios.get(`${BASE_URL}/api/users/me`, {
                    headers: { 'x-auth-token': token },
                });
                setIsAdmin(res.data.role === 'admin');
            } catch (err) {
                console.error('Check admin error:', err);
            } finally {
                setLoading(false);
            }
        };
        checkAdmin();
    }, [token]);

    if (loading) return <div>檢查權限中...</div>;
    return isAdmin ? children : <Navigate to="/login" replace />;
};

export default AdminRoute;