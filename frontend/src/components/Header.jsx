import React, { useState } from 'react';
import { Layout, Input, Button, Badge } from 'antd';
import { GithubOutlined, SearchOutlined, BellOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useWatch } from '../contexts/WatchContext';
import HamburgerMenu from './HamburgerMenu';

const { Header: AntHeader } = Layout;
const { Search } = Input;

const Header = () => {
  const navigate = useNavigate();
  const { alerts } = useWatch();
  const [searchValue, setSearchValue] = useState('');

  const handleSearch = (value) => {
    if (value) navigate(`/search?q=${encodeURIComponent(value)}`);
  };

  return (
    <AntHeader style={{
      position: 'sticky', top: 0, zIndex: 1000,
      background: 'var(--bg-header)',
      backdropFilter: 'blur(var(--glass-blur)) saturate(var(--glass-saturate))',
      WebkitBackdropFilter: 'blur(var(--glass-blur)) saturate(var(--glass-saturate))',
      padding: '0 32px',
      boxShadow: 'var(--shadow-md)',
      borderBottom: '1px solid var(--border-color)',
      display: 'flex', alignItems: 'center', height: 56,
    }}>
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0, height: 2,
        background: 'var(--gradient-accent)',
      }} />
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        width: '100%', maxWidth: 1280, margin: '0 auto',
      }}>
        <div
          style={{ fontSize: 16, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap' }}
          onClick={() => navigate('/')}
        >
          <GithubOutlined style={{ fontSize: 22 }} />
          GitHub Trending
        </div>
        <div style={{ flex: 1, maxWidth: 360, margin: '0 32px' }}>
          <Search
            placeholder="搜索仓库..."
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            onSearch={handleSearch}
            enterButton={<SearchOutlined />}
            allowClear
            style={{ width: '100%' }}
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Badge count={alerts.length} size="small" offset={[-2, 4]}>
            <Button
              type="text"
              icon={<BellOutlined />}
              onClick={() => navigate('/watched')}
              title="我的雷达"
            />
          </Badge>
          <HamburgerMenu />
        </div>
      </div>
    </AntHeader>
  );
};

export default Header;