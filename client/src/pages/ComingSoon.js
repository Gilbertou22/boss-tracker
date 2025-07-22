import React, { useEffect } from 'react';
import { Card, Row, Col, Typography, Space } from 'antd';
import { ClockCircleOutlined } from '@ant-design/icons';
import { motion } from 'framer-motion'; // 使用 framer-motion 添加動畫效果

const { Title, Text } = Typography;

const ComingSoon = () => {

    return (
        <div style={{
            padding: '0px',
            backgroundColor: '#f0f2f5',
            paddingTop: '84px',
            minHeight: 'calc(90vh - 64px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'auto'
        }}>
            <motion.div
                initial={{ opacity: 0, y: 50 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
                style={{ width: '100%', maxWidth: '600px' }}
            >
                <Card
                    bordered={false}
                    style={{
                        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
                        borderRadius: '8px',
                        textAlign: 'center',
                        background: '#fff',
                        minHeight: '300px'
                    }}
                >
                    <Row justify="center" align="middle">
                        <Col>
                            <Space direction="vertical" size="large">
                                <ClockCircleOutlined style={{ fontSize: '64px', color: '#1890ff' }} />
                                <Title level={2} style={{ color: '#1890ff', margin: 0 }}>
                                    敬請期待
                                </Title>
                                <Text style={{ fontSize: '18px', color: '#595959' }}>
                                    Coming Soon
                                </Text>
                                <Text style={{ fontSize: '16px', color: '#8c8c8c' }}>
                                    功能正在開發中，敬請期待！<br />
                                    正在努力為您帶來更好的體驗。
                                </Text>
                            </Space>
                        </Col>
                    </Row>
                </Card>
            </motion.div>
        </div>
    );
};

export default ComingSoon;