// components/Layout.js
import React from 'react';
import { Layout as AntLayout, Typography } from 'antd';

const { Content, Footer } = AntLayout;
const { Text } = Typography;

const Layout = ({ children }) => {
    return (
        <AntLayout style={{ minHeight: '100vh' }}>
            <Content style={{ padding: '20px', flex: '1 0 auto' }}>
                {children}
            </Content>
            <Footer style={{ textAlign: 'center', padding: '4px 0', flexShrink: 0 }}>
                <Text type="secondary">
                    Copyright 邊緣香菇 © 2025 Ver.2025.1.0.0
                </Text>
            </Footer>
        </AntLayout>
    );
};

export default Layout;