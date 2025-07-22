import React, { useState, useEffect } from 'react';
import { Tabs } from 'antd';
import AuctionList from './AuctionList'; // 原來的拍賣列表組件
import WonAuctionList from './WonAuctionList'; // 新增的得標拍賣列表組件

const { TabPane } = Tabs;

const AuctionTabs = () => {
    return (
        <Tabs defaultActiveKey="1">
            <TabPane tab="拍賣列表" key="1">
                <AuctionList />
            </TabPane>
            <TabPane tab="得標" key="2">
                <WonAuctionList />
            </TabPane>
        </Tabs>
    );
};

export default AuctionTabs;