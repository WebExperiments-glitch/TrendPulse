import React from 'react';
import { Card, Typography, Space, Tag, Button } from 'antd';
import { StarOutlined, UserOutlined, CodeOutlined, StarFilled, LinkOutlined, CopyOutlined } from '@ant-design/icons';
import { message } from 'antd';
import StarSparkline from './StarSparkline';
import DeclineBadge from './DeclineBadge';
import HealthBadge from './HealthBadge';
import { useWatch } from '../contexts/WatchContext';
import './RepositoryCard.css';

const { Title, Text, Paragraph } = Typography;

const RepositoryCard = ({ repo, onCardClick, health }) => {
  const { isWatched, toggleWatch } = useWatch();

  const handleCardClick = () => {
    if (onCardClick) {
      onCardClick(repo);
    } else {
      window.open(repo.url, '_blank');
    }
  };

  const handleWatchClick = (e) => {
    e.stopPropagation();
    toggleWatch(repo);
  };

  const handleCopyUrl = (e) => {
    e.stopPropagation();
    navigator.clipboard.writeText(repo.url).then(() => {
      message.success('已复制');
    });
  };

  const handleCopyMarkdown = (e) => {
    e.stopPropagation();
    const desc = repo.description ? ` - ${repo.description.slice(0, 80)}` : '';
    const md = `[${repo.name}](${repo.url})${desc} ⭐ ${repo.stars ? repo.stars.toLocaleString() : '0'}`;
    navigator.clipboard.writeText(md).then(() => {
      message.success('Markdown 已复制');
    });
  };

  const watched = isWatched(repo.name);
  const topics = repo.topics || [];
  const isDeclining = repo.period === 'declining';

  return (
    <Card
      hoverable
      className="repo-card"
      onClick={handleCardClick}
      styles={{ body: { padding: '18px', display: 'flex', flexDirection: 'column', borderRadius: 'var(--radius-md)' } }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <Title level={5} ellipsis={{ rows: 2 }} style={{ marginTop: 0, marginBottom: 4, flex: 1 }}>
          {repo.name}
        </Title>
        <Button
          type="text"
          size="small"
          icon={watched ? <StarFilled style={{ color: '#fadb14' }} /> : <StarOutlined />}
          onClick={handleWatchClick}
          style={{ flexShrink: 0, marginLeft: 4 }}
        />
        <Button
          type="text"
          size="small"
          icon={<CopyOutlined />}
          onClick={handleCopyMarkdown}
          style={{ flexShrink: 0 }}
        />
        <Button
          type="text"
          size="small"
          icon={<LinkOutlined />}
          onClick={handleCopyUrl}
          style={{ flexShrink: 0 }}
        />
      </div>
      {repo.description && (
        <Paragraph
          ellipsis={{ rows: 2 }}
          type="secondary"
          style={{ fontSize: 12, marginBottom: 8 }}
        >
          {repo.description}
        </Paragraph>
      )}
      {topics.length > 0 && (
        <div style={{ marginBottom: 4 }}>
          {topics.slice(0, 4).map((t) => (
            <Tag key={t} style={{ fontSize: 10, marginBottom: 2 }}>{t}</Tag>
          ))}
          {topics.length > 4 && (
            <Tag style={{ fontSize: 10, marginBottom: 2 }}>+{topics.length - 4}</Tag>
          )}
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
        {isDeclining && <DeclineBadge repoName={repo.name} />}
        <HealthBadge health={health} repo={repo} />
      </div>
      <div style={{ flex: '0 0 auto' }}>
        <StarSparkline stars={repo.stars} period={repo.period} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
        <Space size={4}>
          <UserOutlined style={{ fontSize: 12 }} />
          <Text type="secondary" style={{ fontSize: 12 }}>{repo.author}</Text>
        </Space>
        <Space size={4}>
          {repo.language && <CodeOutlined style={{ fontSize: 12, color: 'var(--text-muted)' }} />}
          {repo.language && <Text type="secondary" style={{ fontSize: 12 }}>{repo.language}</Text>}
        </Space>
        <Space size={4}>
          <StarOutlined style={{ color: '#fadb14', fontSize: 12 }} />
          <Text strong style={{ fontSize: 13 }}>{repo.stars != null ? repo.stars.toLocaleString() : '0'}</Text>
        </Space>
      </div>
    </Card>
  );
};

export default RepositoryCard;