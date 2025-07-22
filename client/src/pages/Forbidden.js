// pages/Forbidden.js
import React from 'react';
import { Result, Button } from 'antd';
import { useNavigate } from 'react-router-dom';

const Forbidden = () => {
    const navigate = useNavigate();

    return (
        <Result
            status="403"
            title="403"
            subTitle="抱歉，您無權訪問此頁面。"
            extra={
                <Button type="primary" onClick={() => navigate('/')}>
                    返回首頁
                </Button>
            }
        />
    );
};

export default Forbidden;