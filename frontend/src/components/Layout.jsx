import React from 'react';
import { Layout as AntLayout } from 'antd';
import { Outlet } from 'react-router-dom';
import Header from './Header';

const { Content } = AntLayout;

const Layout = () => {
  return (
    <AntLayout style={{ minHeight: '100vh', background: 'var(--bg-primary)' }}>
      <Header />
      <Content style={{ padding: '28px 32px', maxWidth: 1280, margin: '0 auto', width: '100%', animation: 'fadeIn 0.4s ease-out' }}>
        <Outlet />
      </Content>
    </AntLayout>
  );
};

export default Layout;