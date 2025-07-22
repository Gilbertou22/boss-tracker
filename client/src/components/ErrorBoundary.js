import React, { Component } from 'react';
import logger from '../utils/logger'; // 引入前端日誌工具

class ErrorBoundary extends Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null, errorInfo: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        this.setState({ error, errorInfo });
        console.error('Error caught by ErrorBoundary:', error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div>
                    <h2>發生錯誤</h2>
                    <p>請刷新頁面或聯繫管理員。錯誤詳情：{this.state.error?.message}</p>
                </div>
            );
        }
        return this.props.children;
    }
}

export default ErrorBoundary;