import React, { useState, useMemo, useEffect } from 'react';
import { Row, Col, Button } from 'antd';
import { PictureOutlined, FileTextOutlined } from '@ant-design/icons';
import RepositoryCard from './RepositoryCard';
import FilterBar from './FilterBar';
import TopicCloud from './TopicCloud';
import RepoDetailModal from './RepoDetailModal';
import RandomDiscover from './RandomDiscover';
import PosterGenerator from './PosterGenerator';
import SummaryModal from './SummaryModal';
import { getReposHealth } from '../api/api';

const SUMMARY_PERIODS = ['daily', 'weekly', 'rising', 'declining'];

const RepositoryList = ({ repos, period }) => {
  const [filters, setFilters] = useState({ languages: [], topics: [] });
  const [modalRepo, setModalRepo] = useState(null);
  const [healthMap, setHealthMap] = useState({});
  const [posterVisible, setPosterVisible] = useState(false);
  const [summaryVisible, setSummaryVisible] = useState(false);

  useEffect(() => {
    if (!repos || repos.length === 0) return;
    const names = repos.map((r) => r.name).filter(Boolean);
    if (names.length === 0) return;
    const controller = new AbortController();
    getReposHealth(names, controller.signal).then((res) => {
      const map = {};
      (res.data || []).forEach((h, i) => { if (h) map[names[i]] = h; });
      setHealthMap(map);
    }).catch((err) => {
      if (err?.name === 'CanceledError' || err?.code === 'ERR_CANCELED') return;
    });
    return () => { controller.abort(); };
  }, [repos]);

  const filteredRepos = useMemo(() => {
    return repos.filter((repo) => {
      if (filters.languages.length > 0 && !filters.languages.includes(repo.language)) return false;
      if (filters.topics.length > 0) {
        const repoTopicSet = new Set(repo.topics || []);
        if (!filters.topics.some((t) => repoTopicSet.has(t))) return false;
      }
      return true;
    });
  }, [repos, filters]);

  const handleTopicClick = (topic) => {
    setFilters((prev) => {
      const exists = prev.topics.includes(topic);
      return { ...prev, topics: exists ? prev.topics.filter((t) => t !== topic) : [...prev.topics, topic] };
    });
  };

  const handleCardClick = (repo) => {
    setModalRepo(repo);
  };

  return (
    <div>
      <TopicCloud repos={repos} selectedTopics={filters.topics} onTopicClick={handleTopicClick} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <FilterBar repos={repos} filters={filters} onFilterChange={setFilters} />
        <div style={{ display: 'flex', gap: 8 }}>
          {SUMMARY_PERIODS.includes(period) && (
            <Button
              icon={<FileTextOutlined />}
              onClick={() => setSummaryVisible(true)}
              size="small"
              style={{
                fontWeight: 600,
                borderRadius: 8,
                border: '1px solid var(--border-color)',
                transition: 'all var(--transition-smooth)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-1px)';
                e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = '';
                e.currentTarget.style.boxShadow = '';
              }}
            >
              生成总结
            </Button>
          )}
          <Button
            icon={<PictureOutlined />}
            onClick={() => setPosterVisible(true)}
            size="small"
            type="primary"
            style={{
              fontWeight: 600,
              borderRadius: 8,
              boxShadow: '0 2px 8px rgba(22,119,255,0.35)',
              transition: 'all var(--transition-smooth)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-1px)';
              e.currentTarget.style.boxShadow = '0 4px 16px rgba(22,119,255,0.5)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = '';
              e.currentTarget.style.boxShadow = '0 2px 8px rgba(22,119,255,0.35)';
            }}
          >
            生成海报
          </Button>
        </div>
      </div>
      <Row gutter={[20, 20]}>
        {filteredRepos.map((repo, index) => (
          <Col key={repo.name || repo.url} xs={24} sm={12} md={8} lg={8}>
            <div style={{ animation: `fadeInUp 0.4s ease-out both`, animationDelay: `${index * 0.04}s` }}>
            <RepositoryCard
              repo={repo}
              onCardClick={handleCardClick}
              health={healthMap[repo.name]}
            />
            </div>
          </Col>
        ))}
      </Row>
      {filteredRepos.length === 0 && repos.length > 0 && (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
          没有匹配的仓库，请调整筛选条件
        </div>
      )}
      <RepoDetailModal
        repo={modalRepo}
        visible={!!modalRepo}
        onClose={() => setModalRepo(null)}
      />
      <RandomDiscover repos={repos} onPick={handleCardClick} />
      <PosterGenerator repos={repos} visible={posterVisible} onClose={() => setPosterVisible(false)} />
      <SummaryModal period={period} visible={summaryVisible} onClose={() => setSummaryVisible(false)} />
    </div>
  );
};

export default RepositoryList;