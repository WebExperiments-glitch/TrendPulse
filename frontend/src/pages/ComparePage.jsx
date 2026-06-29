import React, { useState } from 'react';
import { Input, Button, Card, Spin, Space, Statistic, Row, Col, Tag, Alert } from 'antd';
import { SwapOutlined, StarOutlined, ForkOutlined, BugOutlined } from '@ant-design/icons';
import { Line } from 'react-chartjs-2';
import { compareRepos, getStarHistory } from '../api/api';

const ComparePage = () => {
  const [repo1, setRepo1] = useState('');
  const [repo2, setRepo2] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  const handleCompare = async () => {
    if (!repo1.trim() || !repo2.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await compareRepos(repo1.trim(), repo2.trim());
      if (res.data.error) {
        setError(res.data.error);
        setResult(null);
        return;
      }
      const r1 = res.data.repo1;
      const r2 = res.data.repo2;
      // 传入 repo 名以便后端走真实 Star 历史；拿不到时再回退到模拟数据
      const [h1, h2] = await Promise.all([
        getStarHistory(r1.stars, 'daily', null, r1.name),
        getStarHistory(r2.stars, 'daily', null, r2.name),
      ]);
      setResult({ r1, r2, h1: h1.data, h2: h2.data, real: h1.data?.source === 'star-history.com / GitHub API' && h2.data?.source === 'star-history.com / GitHub API' });
    } catch (e) {
      setError(e.response?.data?.error || '请求失败');
    } finally {
      setLoading(false);
    }
  };

  const chartData = result ? {
    labels: (result.h1.history || result.h1).map((d) => (d.date || '').slice(5)),
    datasets: [
      {
        label: result.r1.name,
        data: (result.h1.history || result.h1).map((d) => d.stars),
        borderColor: '#1677ff',
        backgroundColor: 'rgba(22, 119, 255, 0.05)',
        fill: true,
        tension: 0.3,
        pointRadius: 0,
        borderWidth: 2,
      },
      {
        label: result.r2.name,
        data: (result.h2.history || result.h2).map((d) => d.stars),
        borderColor: '#ff4d4f',
        backgroundColor: 'rgba(255, 77, 79, 0.05)',
        fill: true,
        tension: 0.3,
        pointRadius: 0,
        borderWidth: 2,
      },
    ],
  } : null;

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { intersect: false, mode: 'index' },
    plugins: {
      legend: { position: 'top' },
      tooltip: { callbacks: { label: (c) => `${c.dataset.label}: ${c.raw.toLocaleString()} Stars` } },
    },
    scales: { y: { ticks: { callback: (v) => (v / 1000).toFixed(0) + 'k' } } },
  };

  return (
    <div>
      <h2 className="page-title">仓库对比</h2>
      <div style={{
        marginBottom: 24, padding: '18px 22px',
        background: 'var(--bg-filter)',
        backdropFilter: 'blur(var(--glass-blur)) saturate(var(--glass-saturate))',
        WebkitBackdropFilter: 'blur(var(--glass-blur)) saturate(var(--glass-saturate))',
        borderRadius: 'var(--radius-md)',
        border: '1px solid var(--border-color)',
        boxShadow: 'var(--shadow-sm)',
      }}>
        <Space style={{ width: '100%' }}>
          <Input
            placeholder="owner/repo (如 tensorflow/tensorflow)"
            value={repo1}
            onChange={(e) => setRepo1(e.target.value)}
            style={{ width: 280, borderRadius: 8 }}
            onPressEnter={handleCompare}
          />
          <SwapOutlined style={{ fontSize: 18, color: 'var(--text-muted)' }} />
          <Input
            placeholder="owner/repo (如 pytorch/pytorch)"
            value={repo2}
            onChange={(e) => setRepo2(e.target.value)}
            style={{ width: 280, borderRadius: 8 }}
            onPressEnter={handleCompare}
          />
          <Button type="primary" onClick={handleCompare} loading={loading}
            style={{
              background: 'var(--gradient-accent)',
              border: 'none',
              fontWeight: 600,
              borderRadius: 8,
            }}
          >对比</Button>
        </Space>
      </div>

      {loading && <Spin size="large" />}
      {error && <Alert title={error} type="error" showIcon />}

      {result && (
        <>
          <Row gutter={16} style={{ marginBottom: 24 }}>
            <Col span={12}>
              <Card title={result.r1.name} size="small"
                style={{
                  background: 'var(--bg-card)',
                  backdropFilter: 'blur(var(--glass-blur)) saturate(var(--glass-saturate))',
                  WebkitBackdropFilter: 'blur(var(--glass-blur)) saturate(var(--glass-saturate))',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-md)',
                }}>
                <Row gutter={8}>
                  <Col span={8}><Statistic title="Stars" value={result.r1.stars} prefix={<StarOutlined />} /></Col>
                  <Col span={8}><Statistic title="Forks" value={result.r1.forks} prefix={<ForkOutlined />} /></Col>
                  <Col span={8}><Statistic title="Issues" value={result.r1.open_issues} prefix={<BugOutlined />} /></Col>
                </Row>
                <div style={{ marginTop: 8 }}>
                  <Tag>{result.r1.language || 'Unknown'}</Tag>
                  {result.r1.archived && <Tag color="warning">已归档</Tag>}
                  {result.r1.pushed_at && <Tag>最后推送: {result.r1.pushed_at.slice(0, 10)}</Tag>}
                </div>
                <p style={{ color: 'var(--text-secondary)', fontSize: 12, marginTop: 4 }}>{result.r1.description}</p>
              </Card>
            </Col>
            <Col span={12}>
              <Card title={result.r2.name} size="small"
                style={{
                  background: 'var(--bg-card)',
                  backdropFilter: 'blur(var(--glass-blur)) saturate(var(--glass-saturate))',
                  WebkitBackdropFilter: 'blur(var(--glass-blur)) saturate(var(--glass-saturate))',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-md)',
                }}>
                <Row gutter={8}>
                  <Col span={8}><Statistic title="Stars" value={result.r2.stars} prefix={<StarOutlined />} /></Col>
                  <Col span={8}><Statistic title="Forks" value={result.r2.forks} prefix={<ForkOutlined />} /></Col>
                  <Col span={8}><Statistic title="Issues" value={result.r2.open_issues} prefix={<BugOutlined />} /></Col>
                </Row>
                <div style={{ marginTop: 8 }}>
                  <Tag>{result.r2.language || 'Unknown'}</Tag>
                  {result.r2.archived && <Tag color="warning">已归档</Tag>}
                  {result.r2.pushed_at && <Tag>最后推送: {result.r2.pushed_at.slice(0, 10)}</Tag>}
                </div>
                <p style={{ color: 'var(--text-secondary)', fontSize: 12, marginTop: 4 }}>{result.r2.description}</p>
              </Card>
            </Col>
          </Row>
          <Card title={result.real ? 'Star 增长趋势对比（真实数据）' : 'Star 增长趋势对比（参考：模拟数据）'} style={{
            marginBottom: 24,
            background: 'var(--bg-card)',
            backdropFilter: 'blur(var(--glass-blur)) saturate(var(--glass-saturate))',
            WebkitBackdropFilter: 'blur(var(--glass-blur)) saturate(var(--glass-saturate))',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-md)',
          }}>
            <div style={{ height: 320 }}>
              <Line data={chartData} options={chartOptions} />
            </div>
          </Card>
          <Alert
            type="info"
            showIcon
            message="趋势对比说明"
            description={
              result.r1.stars > result.r2.stars
                ? `${result.r1.name} (${result.r1.stars.toLocaleString()} Stars) 目前领先 ${result.r2.name} (${result.r2.stars.toLocaleString()} Stars)，相差 ${(result.r1.stars - result.r2.stars).toLocaleString()} Stars`
                : `${result.r2.name} (${result.r2.stars.toLocaleString()} Stars) 目前领先 ${result.r1.name} (${result.r1.stars.toLocaleString()} Stars)，相差 ${(result.r2.stars - result.r1.stars).toLocaleString()} Stars`
            }
          />
        </>
      )}
    </div>
  );
};

export default ComparePage;