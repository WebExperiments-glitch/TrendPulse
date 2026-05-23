import React, { useState, useEffect } from 'react';
import { Row, Col, Empty, Tag, Button } from 'antd';
import { ReloadOutlined, RiseOutlined, FallOutlined } from '@ant-design/icons';
import RepositoryCard from '../components/RepositoryCard';
import FilterBar from '../components/FilterBar';
import { useWatch } from '../contexts/WatchContext';
import { getReposHealth } from '../api/api';

const WatchedPage = () => {
  const { watchlist, alerts, refreshAlerts, getAlert } = useWatch();
  const [filters, setFilters] = useState({ languages: [], topics: [] });
  const [healthMap, setHealthMap] = useState({});
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    if (watchlist.length === 0) return;
    const names = watchlist.map((r) => r.name).filter(Boolean);
    const controller = new AbortController();
    getReposHealth(names, controller.signal).then((res) => {
      const map = {};
      (res.data || []).forEach((h, i) => { if (h) map[names[i]] = h; });
      setHealthMap(map);
    }).catch((err) => {
      if (err?.name === 'CanceledError' || err?.code === 'ERR_CANCELED') return;
    });
    return () => { controller.abort(); };
  }, [watchlist]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refreshAlerts();
    setIsRefreshing(false);
  };

  const filteredRepos = watchlist.filter((repo) => {
    if (filters.languages.length > 0 && !filters.languages.includes(repo.language)) return false;
    if (filters.topics.length > 0) {
      const rt = repo.topics || [];
      if (!filters.topics.some((t) => rt.includes(t))) return false;
    }
    return true;
  });

  if (watchlist.length === 0) {
    return (
      <div>
        <h2 className="page-title">我的雷达</h2>
        <Empty
          description={
            <span>还没有关注任何仓库，点击卡片上的 ⭐ 开始监控</span>
          }
        />
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h2 className="page-title" style={{ marginBottom: 0 }}>
          我的雷达 ({watchlist.length})
        </h2>
        <Button
          icon={<ReloadOutlined />}
          loading={isRefreshing}
          onClick={handleRefresh}
          size="small"
          style={{
            borderRadius: 8,
            fontWeight: 600,
            border: '1px solid var(--border-color)',
          }}
        >
          刷新检测
        </Button>
      </div>

      {alerts.length > 0 && (
        <div style={{
          marginBottom: 20, padding: '14px 22px',
          background: 'var(--bg-filter)',
          backdropFilter: 'blur(var(--glass-blur)) saturate(var(--glass-saturate))',
          WebkitBackdropFilter: 'blur(var(--glass-blur)) saturate(var(--glass-saturate))',
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--radius-md)',
          boxShadow: 'var(--shadow-sm)',
        }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8, color: 'var(--text-primary)' }}>
            🚨 检测到 {alerts.length} 个仓库发生剧烈波动（±20%）
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {alerts.map((a) => (
              <Tag
                key={a.name}
                color={a.direction === 'up' ? 'green' : 'red'}
                icon={a.direction === 'up' ? <RiseOutlined /> : <FallOutlined />}
                style={{ fontSize: 12, padding: '2px 8px' }}
              >
                {a.name} {a.change > 0 ? '+' : ''}{a.change}%
              </Tag>
            ))}
          </div>
        </div>
      )}

      <FilterBar repos={filteredRepos} filters={filters} onFilterChange={setFilters} />

      <Row gutter={[20, 20]}>
        {filteredRepos.map((repo, index) => {
          const alert = getAlert(repo.name);
          const repoWithTopics = { ...repo, topics: repo.topics || [] };
          return (
            <Col key={repo.name} xs={24} sm={12} md={8} lg={8}>
              <div style={{ position: 'relative', animation: `fadeInUp 0.4s ease-out both`, animationDelay: `${index * 0.04}s` }}>
                {alert && (
                  <div style={{
                    position: 'absolute', top: -8, right: -8, zIndex: 10,
                    background: alert.direction === 'up' ? '#52c41a' : '#ff4d4f',
                    color: '#fff', borderRadius: '50%', width: 28, height: 28,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 10, fontWeight: 700, lineHeight: 1,
                    boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
                  }}>
                    {alert.direction === 'up' ? '🔥' : '📉'}
                  </div>
                )}
                <RepositoryCard repo={repoWithTopics} health={healthMap[repo.name]} />
              </div>
            </Col>
          );
        })}
      </Row>
    </div>
  );
};

export default WatchedPage;