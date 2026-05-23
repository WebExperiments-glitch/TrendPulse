import React, { useState, useEffect, useCallback } from 'react';
import { Spin, Alert } from 'antd';
import RepositoryList from '../components/RepositoryList';
import { searchRepos } from '../api/api';
import { useLocation } from 'react-router-dom';

const SearchPage = () => {
  const location = useLocation();
  const [repos, setRepos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState('');
  const [lastUpdated, setLastUpdated] = useState(null);

  const handleSearch = useCallback(async (searchQuery) => {
    setLoading(true);
    setError(null);
    try {
      const response = await searchRepos(searchQuery);
      setRepos(response.data);
      setLastUpdated(new Date());
    } catch (error) {
        console.error('Error searching repositories:', error);
        // 只显示通用错误信息，避免泄露敏感信息
        setError('搜索仓库失败，请稍后重试');
        setRepos([]);
      } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // 从URL参数中获取搜索关键词
    const params = new URLSearchParams(location.search);
    const searchQuery = params.get('q') || '';
    setQuery(searchQuery);
    setError(null);

    if (searchQuery) {
      handleSearch(searchQuery);
    } else {
      setLoading(false);
    }
  }, [location.search, handleSearch]);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 className="page-title" style={{ marginBottom: 0 }}>搜索结果</h2>
        {lastUpdated && (
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            搜索时间: {lastUpdated.toLocaleString()}
          </div>
        )}
      </div>
      {loading ? (
        <Spin size="large" description="搜索中..." />
      ) : error ? (
        <Alert title={error} type="error" showIcon action={
          <button onClick={() => window.location.reload()} style={{ marginLeft: 8, cursor: 'pointer' }}>
            重试
          </button>
        } />
      ) : query ? (
        <>
          <div style={{ marginBottom: 16, color: 'var(--text-secondary)' }}>搜索关键词: <strong>{query}</strong></div>
          {repos.length === 0 ? (
            <Alert title="未找到相关仓库" type="info" showIcon />
          ) : (
            <>
              <div style={{ marginBottom: 16, fontSize: 14, color: 'var(--text-secondary)' }}>
                找到 {repos.length} 个结果
              </div>
              <RepositoryList repos={repos} period="search" />
            </>
          )}
        </>
      ) : (
        <div style={{
          textAlign: 'center', padding: 48,
          border: '1px dashed var(--border-color)',
          borderRadius: 'var(--radius-md)',
          background: 'var(--bg-filter)',
        }}>
          <div style={{ fontSize: 16, marginBottom: 8, color: 'var(--text-primary)' }}>请输入搜索关键词</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>例如: python, react, machine learning</div>
        </div>
      )}
    </div>
  );
};

export default SearchPage;