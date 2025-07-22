import axios from 'axios';
import { message } from 'antd';
import { useNavigate } from 'react-router-dom';

const BASE_URL = process.env.REACT_APP_API_URL || '';

const axiosInstance = axios.create({
    baseURL: BASE_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

let isRedirecting = false; // Global flag to prevent multiple redirects

axiosInstance.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('token');
        if (token) {
            config.headers['x-auth-token'] = token;
        }
        return config;
    },
    (error) => Promise.reject(error)
);

axiosInstance.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401 || error.response?.status === 403) {
            if (!isRedirecting) {
                isRedirecting = true;
                message.error(error.response?.data?.msg || '無權限訪問，請重新登入');
                localStorage.removeItem('token');
                window.location.href = '/login'; // Fallback to window.location.href
                setTimeout(() => { isRedirecting = false; }, 1000); // Reset after 1 second
                throw new Error('Redirecting to login');
            }
        }
        return Promise.reject(error);
    }
);

export default axiosInstance;