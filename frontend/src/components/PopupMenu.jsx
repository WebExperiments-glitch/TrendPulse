import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button, Dropdown, message, Modal, Checkbox } from 'antd';
import {
  RiseOutlined,
  FallOutlined,
  CalendarOutlined,
  FireOutlined,
  SwapOutlined,
  ExportOutlined,
  CopyOutlined,
  FileTextOutlined,
  FileExcelOutlined,
  CodeOutlined,
  DeleteOutlined,
  ClearOutlined,
  TrophyOutlined,
} from '@ant-design/icons';
import { getDaily, getWeekly, getRising, getDeclining, getHottest } from '../api/api';
import { getCachedData } from '../utils/cache';
import {
  exportMarkdown,
  exportCSV,
  exportJSON,
  exportHTML,
  downloadFile,
  copyToClipboard,
} from '../utils/export';
import './PopupMenu.css';

const PERIOD_MAP = {
  '/': 'daily',
  '/daily': 'daily',
  '/weekly': 'weekly',
  '/rising': 'rising',
  '/declining': 'declining',
  '/hot': 'hot',
  '/watched': 'watched',
  '/search': 'search',
};

const PopupMenu = ({ onClose }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [exporting, setExporting] = useState(false);

  const period = PERIOD_MAP[location.pathname] || 'daily';

  const getData = async () => {
    if (period === 'watched') {
      try {
        return JSON.parse(localStorage.getItem('github_trending_watchlist') || '[]');
      } catch {
        return [];
      }
    }
    const fetchers = { daily: getDaily, weekly: getWeekly, rising: getRising, declining: getDeclining, hot: getHottest };
    const fetcher = fetchers[period];
    if (!fetcher) return [];
    const res = await fetcher();
    return res.data;
  };

  const doExport = async (type) => {
    setExporting(true);
    try {
      const repos = await getData();
      if (!repos || repos.length === 0) {
        message.warning('当前没有数据可导出');
        return;
      }
      const ts = new Date().toISOString().slice(0, 10);
      const prefix = `trending-${period}-${ts}`;

      switch (type) {
        case 'markdown': {
          const md = exportMarkdown(repos, period);
          await copyToClipboard(md);
          message.success('Markdown 已复制到剪贴板');
          break;
        }
        case 'csv': {
          const csv = exportCSV(repos, period);
          downloadFile(csv, `${prefix}.csv`);
          message.success('CSV 下载中...');
          break;
        }
        case 'json': {
          const json = exportJSON(repos, period);
          downloadFile(json, `${prefix}.json`);
          message.success('JSON 下载中...');
          break;
        }
        case 'html': {
          const html = exportHTML(repos, period);
          downloadFile(html, `${prefix}.html`);
          message.success('HTML 下载中...');
          break;
        }
      }
    } catch (e) {
      message.error('导出失败: ' + (e.message || '未知错误'));
    } finally {
      setExporting(false);
    }
  };

  const exportItems = [
    { key: 'markdown', label: '复制 Markdown', icon: <CopyOutlined /> },
    { key: 'csv', label: '下载 CSV', icon: <FileExcelOutlined /> },
    { key: 'json', label: '下载 JSON', icon: <CodeOutlined /> },
    { key: 'html', label: '导出为独立 HTML 文件', icon: <FileTextOutlined /> },
  ];

  const handleDaily = () => { navigate('/daily'); onClose(); };
  const handleWeekly = () => { navigate('/weekly'); onClose(); };
  const handleRising = () => { navigate('/rising'); onClose(); };
  const handleDeclining = () => { navigate('/declining'); onClose(); };
  const handleHot = () => { navigate('/hot'); onClose(); };
  const handleCompare = () => { navigate('/compare'); onClose(); };

  // 清除缓存功能
  const getCacheStats = () => {
    const stats = {};
    const cacheLabelMap = {
      daily: '每日热点',
      weekly: '每周热点',
      rising: '上升趋势',
      declining: '下降趋势',
      hottest: '最火仓库',
    };
    Object.entries(cacheLabelMap).forEach(([key, label]) => {
      const cached = getCachedData(key);
      if (cached && cached.data) {
        stats[key] = {
          label,
          count: Array.isArray(cached.data) ? cached.data.length : 0,
          time: new Date(cached.timestamp).toLocaleString(),
          hasData: true,
        };
      } else {
        stats[key] = { label, count: 0, time: null, hasData: false };
      }
    });

    try {
      const watchlist = JSON.parse(localStorage.getItem('github_trending_watchlist') || '[]');
      const alerts = JSON.parse(localStorage.getItem('github_trending_alerts') || '{}');
      stats.watchlist = {
        label: '关注列表',
        count: Array.isArray(watchlist) ? watchlist.length : 0,
        time: null,
        hasData: Array.isArray(watchlist) && watchlist.length > 0,
      };
      stats.alerts = {
        label: '波动告警',
        count: alerts?.alerts?.length || 0,
        time: alerts?.time ? new Date(alerts.time).toLocaleString() : null,
        hasData: alerts?.alerts?.length > 0,
      };
    } catch {
      stats.watchlist = { label: '关注列表', count: 0, hasData: false };
      stats.alerts = { label: '波动告警', count: 0, hasData: false };
    }

    return stats;
  };

  const cacheKeys = {
    daily: ['trending_cache_daily'],
    weekly: ['trending_cache_weekly'],
    rising: ['trending_cache_rising'],
    declining: ['trending_cache_declining'],
    hottest: ['trending_cache_hottest'],
    watchlist: ['github_trending_watchlist'],
    alerts: ['github_trending_alerts'],
  };

  const [selectedCaches, setSelectedCaches] = useState({
    daily: true, weekly: true, rising: true, declining: true, hottest: true,
    watchlist: false, alerts: false,
  });

  const handleCacheToggle = (key, checked) => {
    setSelectedCaches(prev => ({ ...prev, [key]: checked }));
  };

  const isAllSelected = Object.values(selectedCaches).every(Boolean);
  const isIndeterminate = Object.values(selectedCaches).some(Boolean) && !isAllSelected;

  const handleSelectAll = (checked) => {
    const next = {};
    Object.keys(selectedCaches).forEach(k => { next[k] = checked; });
    setSelectedCaches(next);
  };

  const showClearCacheModal = () => {
    setSelectedCaches({
      daily: true, weekly: true, rising: true, declining: true, hottest: true,
      watchlist: false, alerts: false,
    });

    const stats = getCacheStats();

    Modal.confirm({
      title: '管理缓存数据',
      icon: <DeleteOutlined />,
      width: 480,
      content: (
        <div style={{ marginTop: 12 }}>
          <p style={{ marginBottom: 8, color: 'var(--text-secondary)', fontSize: 13 }}>
            勾选要清除的缓存，取消勾选保留：
          </p>
          <Checkbox
            indeterminate={isIndeterminate}
            checked={isAllSelected}
            onChange={(e) => handleSelectAll(e.target.checked)}
            style={{ marginBottom: 10, fontWeight: 500 }}
          >
            全选 / 取消全选
          </Checkbox>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {Object.entries(cacheKeys).map(([key, keys]) => {
              const info = stats[key] || {};
              return (
                <div
                  key={key}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '6px 10px', borderRadius: 8,
                    background: 'rgba(0,0,0,0.03)',
                    opacity: info.hasData ? 1 : 0.55,
                  }}
                >
                  <Checkbox
                    checked={selectedCaches[key]}
                    onChange={(e) => handleCacheToggle(key, e.target.checked)}
                    disabled={!info.hasData}
                  >
                    <span style={{ fontSize: 13, fontWeight: 500 }}>{info.label}</span>
                  </Checkbox>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    {info.hasData
                      ? `${info.count} 条${info.time ? ' · ' + info.time.slice(5, 16) : ''}`
                      : '无数据'}
                  </span>
                </div>
              );
            })}
          </div>
          <p style={{ color: '#ff4d4f', fontSize: 12, marginTop: 14, marginBottom: 0 }}>
            清除后需重新获取数据，关注列表清除后不可恢复
          </p>
        </div>
      ),
      okText: '确认清除',
      okButtonProps: { danger: true },
      cancelText: '取消',
      onOk: () => {
        let clearedCount = 0;
        Object.entries(cacheKeys).forEach(([category, keys]) => {
          if (selectedCaches[category]) {
            keys.forEach(k => {
              if (localStorage.getItem(k) !== null) {
                localStorage.removeItem(k);
                clearedCount++;
              }
            });
          }
        });
        if (clearedCount > 0) {
          message.success(`已清除 ${clearedCount} 项缓存`);
        } else {
          message.info('所选缓存无数据，无需清除');
        }
        onClose();
      },
    });
  };

  const dividerStyle = { borderTop: '1px solid var(--border-color)', margin: '4px 0' };

  return (
    <div className="popup-menu">
      <div className="menu-list">
        <div className="menu-item">
          <Button type="link" onClick={handleDaily} icon={<CalendarOutlined />}>每日热点</Button>
        </div>
        <div className="menu-item">
          <Button type="link" onClick={handleWeekly} icon={<FireOutlined />}>一周热点</Button>
        </div>
        <div className="menu-item">
          <Button type="link" onClick={handleRising} icon={<RiseOutlined />}>上升趋势热点</Button>
        </div>
        <div className="menu-item">
          <Button type="link" onClick={handleDeclining} icon={<FallOutlined />}>下降趋势仓库</Button>
        </div>
        <div style={dividerStyle} />
        <div className="menu-item">
          <Button type="link" onClick={handleHot} icon={<TrophyOutlined style={{ color: '#faad14' }} />}>最火仓库</Button>
        </div>
        <div style={dividerStyle} />
        <div className="menu-item">
          <Button type="link" onClick={handleCompare} icon={<SwapOutlined />}>仓库对比</Button>
        </div>
        <div style={dividerStyle} />
        <div className="menu-item">
          <Button type="link" onClick={showClearCacheModal} icon={<ClearOutlined />} danger>
            清除缓存
          </Button>
        </div>
        <div style={dividerStyle} />
        <div className="menu-item">
          <Dropdown
            menu={{
              items: exportItems.map((item) => ({ ...item, onClick: () => doExport(item.key) })),
            }}
            trigger={['click']}
            placement="bottomRight"
          >
            <Button
              type="link"
              icon={<ExportOutlined />}
              loading={exporting}
              onClick={(e) => e.preventDefault()}
            >
              导出数据
            </Button>
          </Dropdown>
        </div>
      </div>
    </div>
  );
};

export default PopupMenu;