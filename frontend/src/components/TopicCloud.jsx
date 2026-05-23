import React, { useMemo } from 'react';
import { Tag } from 'antd';

const COLORS = [
  '#1677ff', '#52c41a', '#fa8c16', '#eb2f96', '#722ed1',
  '#13c2c2', '#f5222d', '#2f54eb', '#faad14', '#a0d911',
];

const TopicCloud = ({ repos, selectedTopics = [], onTopicClick }) => {
  const topicStats = useMemo(() => {
    const counts = {};
    repos.forEach((repo) => {
      (repo.topics || []).forEach((t) => {
        counts[t] = (counts[t] || 0) + 1;
      });
    });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 40);
  }, [repos]);

  if (topicStats.length === 0) return null;

  const maxCount = topicStats[0][1];
  const minCount = topicStats[topicStats.length - 1][1];

  const getFontSize = (count) => {
    const ratio = maxCount === minCount ? 0.5 : (count - minCount) / (maxCount - minCount);
    return 12 + ratio * 10;
  };

  return (
    <div style={{
      marginBottom: 20, padding: '16px 22px',
      background: 'var(--bg-filter)',
      backdropFilter: 'blur(var(--glass-blur)) saturate(var(--glass-saturate))',
      WebkitBackdropFilter: 'blur(var(--glass-blur)) saturate(var(--glass-saturate))',
      border: '1px solid var(--border-color)',
      borderRadius: 'var(--radius-md)',
      boxShadow: 'var(--shadow-sm)',
    }}>
      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{
          display: 'inline-block', width: 6, height: 6, borderRadius: '50%',
          background: 'var(--gradient-accent)',
        }} />
        🔥 话题热力地图
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
        {topicStats.map(([topic, count], i) => {
          const isSelected = selectedTopics.includes(topic);
          return (
            <Tag
              key={topic}
              style={{
                cursor: 'pointer',
                fontSize: getFontSize(count),
                padding: '3px 12px',
                borderRadius: 8,
                border: isSelected ? '2px solid currentColor' : '1px solid transparent',
                fontWeight: isSelected ? 700 : 400,
                opacity: isSelected ? 1 : 0.85,
                transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                transform: isSelected ? 'scale(1.05)' : 'scale(1)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'scale(1.08)';
                e.currentTarget.style.opacity = '1';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = isSelected ? 'scale(1.05)' : 'scale(1)';
                e.currentTarget.style.opacity = isSelected ? '1' : '0.85';
              }}
              color={isSelected ? 'blue' : COLORS[i % COLORS.length]}
              onClick={(e) => {
                e.stopPropagation();
                onTopicClick(topic);
              }}
            >
              {topic} <span style={{ fontSize: 9, opacity: 0.7 }}>{count}</span>
            </Tag>
          );
        })}
      </div>
    </div>
  );
};

export default TopicCloud;