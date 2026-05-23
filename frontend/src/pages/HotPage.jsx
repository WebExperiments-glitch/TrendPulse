import React, { useState, useEffect, useCallback } from 'react';
import { Spin, Alert, Button } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import RepositoryList from '../components/RepositoryList';
import { getHottest } from '../api/api';
import { getCachedData, setCachedData } from '../utils/cache';

const CACHE_KEY = 'hottest';

const HotPage = () => {
  const [repos, setRepos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  const fetchHottestTrending = useCallback(async (isManual = false) => {
    if (isManual) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);
    try {
      const response = await getHottest();
      const data = response.data;
      setRepos(data);
      setCachedData(CACHE_KEY, data);
      setLastUpdated(new Date());
    } catch (error) {
      console.error('Error fetching hottest trending:', error);
      setError('获取最火仓库失败，请稍后重试');
      if (!isManual) setRepos([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const cached = getCachedData(CACHE_KEY);
    if (cached) {
      setRepos(cached.data);
      setLastUpdated(new Date(cached.timestamp));
      setLoading(false);
    } else {
      fetchHottestTrending();
    }
  }, [fetchHottestTrending]);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 className="page-title" style={{ marginBottom: 0 }}>
          🔥 最火仓库
        </h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {lastUpdated && (
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              最后更新: {lastUpdated.toLocaleString()}
            </span>
          )}
          <Button
            icon={<ReloadOutlined />}
            size="small"
            loading={refreshing}
            onClick={() => fetchHottestTrending(true)}
            style={{ borderRadius: 8, fontWeight: 600, border: '1px solid var(--border-color)' }}
          >
            刷新
          </Button>
        </div>
      </div>
      {loading ? (
        <Spin size="large" description="加载中..." />
      ) : error ? (
        <Alert title={error} type="error" showIcon action={
          <Button size="small" onClick={() => fetchHottestTrending(true)}>重试</Button>
        } />
      ) : repos.length === 0 ? (
        <Alert title="暂无数据" type="info" showIcon />
      ) : (
        <RepositoryList repos={repos} period="hot" />
      )}
    </div>
  );
};

export default HotPage;