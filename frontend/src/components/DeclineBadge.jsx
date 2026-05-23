import React, { useEffect, useState } from 'react';
import { Tag, Tooltip } from 'antd';
import { getRepoInsights } from '../api/api';

const colorMap = {
  default: 'default',
  warning: 'warning',
  processing: 'processing',
  purple: 'purple',
  error: 'error',
  success: 'success',
};

const DeclineBadge = ({ repoName }) => {
  const [reasons, setReasons] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!repoName) return;
    let cancelled = false;
    setLoading(true);
    getRepoInsights(repoName)
      .then((res) => {
        if (!cancelled) setReasons(res.data.reasons || []);
      })
      .catch(() => {
        if (!cancelled) setReasons(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [repoName]);

  if (loading || !reasons || reasons.length === 0) return null;

  return (
    <div style={{ marginTop: 4 }}>
      {reasons.map((r, i) => (
        <Tooltip key={i} title={r.label}>
          <Tag color={colorMap[r.color] || 'default'} style={{ fontSize: 10, marginBottom: 2 }}>
            {r.type === 'archived' && '📦 已归档'}
            {r.type === 'inactive' && (r.label.includes('停更') ? '⏸ ' + r.label.split('停更')[1].replace('个月', '月未更新') : r.label)}
            {r.type === 'slow' && '🐢 ' + r.label}
            {r.type === 'migration' && '🔀 ' + (r.label.length > 15 ? r.label.slice(0, 15) + '...' : r.label)}
            {r.type === 'natural' && '📉 自然回落'}
          </Tag>
        </Tooltip>
      ))}
    </div>
  );
};

export default DeclineBadge;