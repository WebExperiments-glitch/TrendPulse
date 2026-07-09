import React, { useEffect, useState } from 'react';
import { Modal, Spin, Tag, Descriptions, Timeline, Button, Typography, Empty, Tooltip } from 'antd';
import { GithubOutlined, ClockCircleOutlined, StarOutlined, ForkOutlined, ExclamationCircleOutlined, TagOutlined } from '@ant-design/icons';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip as ChartTooltip,
} from 'chart.js';
import { getRepoDetail, getRepoReleases, getStarHistory, getRepoHistory } from '../api/api';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Filler, ChartTooltip);

const { Paragraph } = Typography;

const RepoDetailModal = ({ repo, visible, onClose }) => {
  const [detail, setDetail] = useState(null);
  const [releases, setReleases] = useState([]);
  const [history, setHistory] = useState(null);
  const [realHistory, setRealHistory] = useState(null);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState('overview');

  useEffect(() => {
    if (!visible || !repo) return;
    setLoading(true);
    setDetail(null);
    setReleases([]);
    setRealHistory(null);
    setHistory(null);

    const repoName = repo.name || repo.repo_name || '';
    Promise.allSettled([
      getRepoDetail(repoName).then((r) => r.data).catch(() => null),
      getRepoReleases(repoName).then((r) => r.data).catch(() => []),
      getStarHistory(repo.stars, repo.period || 'daily', null, repoName).then((r) => r.data).catch(() => null),
      getRepoHistory(repoName, 30).then((r) => r.data).catch(() => null),
    ]).then(([d, rl, h, rh]) => {
      if (d.status === 'fulfilled') setDetail(d.value);
      if (rl.status === 'fulfilled') setReleases(rl.value);
      if (h.status === 'fulfilled') setHistory(h.value);
      if (rh.status === 'fulfilled' && rh.value?.history?.length > 1) setRealHistory(rh.value);
      setLoading(false);
    });
  }, [visible, repo]);

  const starHistoryData = history ? (history.history || history) : null;
  const starHistoryChart = starHistoryData && starHistoryData.length > 0 ? (() => {
    const isUp = starHistoryData[starHistoryData.length - 1]?.stars >= starHistoryData[0]?.stars;
    const lineColor = isUp ? '#52c41a' : '#ff4d4f';
    return {
      data: {
        labels: starHistoryData.map((_, i) => i % 15 === 0 ? (starHistoryData[i].date || '').slice(5) : ''),
        datasets: [{
          data: starHistoryData.map((d) => d.stars),
          borderColor: lineColor,
          backgroundColor: isUp ? 'rgba(82,196,26,0.08)' : 'rgba(255,77,79,0.08)',
          fill: true, borderWidth: 2, pointRadius: 0, pointHoverRadius: 4, tension: 0.3,
        }],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { maxTicksLimit: 6, font: { size: 10 } }, grid: { display: false } },
          y: { ticks: { font: { size: 10 } } },
        },
      },
    };
  })() : null;

  const realHistoryChart = realHistory && realHistory.history?.length > 1 ? (() => {
    const data = realHistory.history;
    const isUp = data[data.length - 1]?.stars >= data[0]?.stars;
    const lineColor = isUp ? '#1677ff' : '#fa8c16';
    const change = data[data.length - 1]?.stars - data[0]?.stars;
    const changePercent = data[0]?.stars > 0 ? ((change / data[0].stars) * 100).toFixed(1) : '0';
    return {
      chart: {
        data: {
          labels: data.map((d) => d.date),
          datasets: [{
            label: 'Star 数',
            data: data.map((d) => d.stars),
            borderColor: lineColor,
            backgroundColor: lineColor + '20',
            fill: true, borderWidth: 2, pointRadius: 3, pointHoverRadius: 5, tension: 0.3,
          }],
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: { ticks: { maxTicksLimit: 7, font: { size: 10 } }, grid: { display: false } },
            y: { ticks: { font: { size: 10 } } },
          },
        },
      },
      meta: {
        start: data[0]?.stars || 0,
        end: data[data.length - 1]?.stars || 0,
        change, changePercent, isUp,
        count: data.length,
      },
    };
  })() : null;

  return (
    <Modal
      title={
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700 }}>
        <GithubOutlined style={{ color: 'var(--text-primary)' }} /> {repo?.name}
      </div>
    }
      open={visible}
      onCancel={onClose}
      width={720}
      footer={[
        <Button key="github" type="primary" icon={<GithubOutlined />}
          style={{
            background: 'var(--gradient-cool)',
            border: 'none',
            fontWeight: 600,
            borderRadius: 8,
          }}
          onClick={() => window.open(repo?.url, '_blank')}>
          在 GitHub 打开
        </Button>,
        <Button key="close" onClick={onClose} style={{ borderRadius: 8 }}>关闭</Button>,
      ]}
      destroyOnHidden
      styles={{
        content: {
          borderRadius: 'var(--radius-lg)',
          overflow: 'hidden',
        },
      }}
    >
      {loading ? (
        <div style={{ textAlign: 'center', padding: 60 }}><Spin size="large" /></div>
      ) : (
        <div>
          <div style={{ marginBottom: 16 }}>
            <Paragraph style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
              {repo?.description || detail?.description || ''}
            </Paragraph>
          </div>

          <div style={{ display: 'flex', gap: 24, marginBottom: 16, flexWrap: 'wrap' }}>
            <Tooltip title="Stars">
              <span><StarOutlined style={{ color: '#fadb14', marginRight: 4 }} />{(detail?.stars || repo?.stars || 0).toLocaleString()}</span>
            </Tooltip>
            {detail?.forks != null && (
              <Tooltip title="Forks">
                <span><ForkOutlined style={{ marginRight: 4 }} />{(detail.forks || 0).toLocaleString()}</span>
              </Tooltip>
            )}
            {detail?.open_issues != null && (
              <Tooltip title="Open Issues">
                <span><ExclamationCircleOutlined style={{ marginRight: 4 }} />{(detail.open_issues || 0).toLocaleString()}</span>
              </Tooltip>
            )}
            <Tooltip title="语言">
              <span><CodeOutlined style={{ marginRight: 4 }} />{detail?.language || repo?.language || '-'}</span>
            </Tooltip>
            {detail?.archived && <Tag color="default">📦 已归档</Tag>}
          </div>

          {(detail?.topics || repo?.topics) && (detail?.topics || repo?.topics || []).length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <TagOutlined style={{ marginRight: 4 }} />
              {(detail?.topics || repo?.topics || []).slice(0, 10).map((t) => (
                <Tag key={t} style={{ marginBottom: 4 }}>{t}</Tag>
              ))}
            </div>
          )}

          <Descriptions size="small" column={2} style={{ marginBottom: 16 }}>
            {detail?.pushed_at && (
              <Descriptions.Item label={<><ClockCircleOutlined /> 最近推送</>}>
                {new Date(detail.pushed_at).toLocaleDateString('zh-CN')}
              </Descriptions.Item>
            )}
            {detail?.created_at && (
              <Descriptions.Item label="创建时间">
                {new Date(detail.created_at).toLocaleDateString('zh-CN')}
              </Descriptions.Item>
            )}
          </Descriptions>

          {starHistoryChart && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: 'var(--text-primary)' }}>
                📈 90天 Star 增长趋势
              </div>
              <div style={{ height: 200 }}>
                <Line data={starHistoryChart.data} options={starHistoryChart.options} />
              </div>
            </div>
          )}

          {realHistoryChart ? (
            <div style={{ marginBottom: 20, padding: 14, background: 'var(--bg-elevated)', borderRadius: 10, border: '1px solid var(--border-color)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
                  ⌛ 历史快照 ({realHistoryChart.meta.count} 个记录)
                </span>
                <span style={{
                  fontSize: 13, fontWeight: 600,
                  color: realHistoryChart.meta.isUp ? '#52c41a' : '#ff4d4f',
                }}>
                  {realHistoryChart.meta.isUp ? '+' : ''}{realHistoryChart.meta.change.toLocaleString()}
                  <span style={{ fontSize: 11, marginLeft: 2 }}>
                    ({realHistoryChart.meta.changePercent}%)
                  </span>
                </span>
              </div>
              <div style={{ height: 180 }}>
                <Line data={realHistoryChart.chart.data} options={realHistoryChart.chart.options} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 11, color: 'var(--text-muted)' }}>
                <span>{realHistoryChart.meta.start.toLocaleString()} ⭐</span>
                <span>{realHistoryChart.meta.end.toLocaleString()} ⭐</span>
              </div>
            </div>
          ) : history && (
            <div style={{ marginBottom: 20, padding: 12, background: 'var(--bg-elevated)', borderRadius: 8, border: '1px dashed var(--border-color)', textAlign: 'center' }}>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                ⌛ 历史数据将在第二天开始累积。每天自动保存排行榜快照，届时可查看真实 Star 变化趋势。
              </span>
            </div>
          )}

          {releases.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: 'var(--text-primary)' }}>
                🚀 最近发布 ({releases.length})
              </div>
              <Timeline
                items={releases.map((r) => ({
                  color: r.prerelease ? 'orange' : 'blue',
                  children: (
                    <div>
                      <a href={r.html_url} target="_blank" rel="noopener noreferrer" style={{ fontWeight: 600 }}>
                        {r.name}
                      </a>
                      {r.prerelease && <Tag color="orange" style={{ marginLeft: 6, fontSize: 10 }}>pre</Tag>}
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        {r.published_at ? new Date(r.published_at).toLocaleDateString('zh-CN') : ''}
                      </div>
                    </div>
                  ),
                }))}
              />
            </div>
          )}

          {!detail && !releases.length && (
            <Empty description="暂无仓库详细信息" image={Empty.PRESENTED_IMAGE_SIMPLE} />
          )}
        </div>
      )}
    </Modal>
  );
};

const CodeOutlined = ({ style, ...props }) => (
  <span style={{ display: 'inline-flex', alignItems: 'center', ...style }} {...props}>
    <svg viewBox="0 0 1024 1024" width="1em" height="1em" fill="currentColor">
      <path d="M516 673c0 4.4 3.4 8 7.5 8h185c4.1 0 7.5-3.6 7.5-8v-48c0-4.4-3.4-8-7.5-8h-185c-4.1 0-7.5 3.6-7.5 8v48zm-194.9 6.1l192-161c3.8-3.2 3.8-9.1 0-12.3l-192-160.9A7.95 7.95 0 00308 351v62.7c0 2.4 1 4.6 2.9 6.1L420.7 512l-109.8 92.2a8.1 8.1 0 00-2.9 6.1V673c0 6.8 7.9 10.5 13.1 6.1zM880 112H144c-17.7 0-32 14.3-32 32v736c0 17.7 14.3 32 32 32h736c17.7 0 32-14.3 32-32V144c0-17.7-14.3-32-32-32zm-40 728H184V184h656v656z"/>
    </svg>
  </span>
);

export default RepoDetailModal;