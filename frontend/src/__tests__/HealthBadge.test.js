import { describe, it, expect } from 'vitest';

const formatDays = (days) => {
  if (days == null) return '未知';
  if (days < 1) return '今天';
  if (days < 30) return `${days} 天前`;
  if (days < 365) return `${Math.floor(days / 30)} 月前`;
  return `${Math.floor(days / 365)} 年前`;
};

const computeFallback = (repo) => {
  const stars = repo.stars || repo.forks || 0;
  let score;
  if (stars > 50000) score = 85;
  else if (stars > 10000) score = 75;
  else if (stars > 1000) score = 60;
  else if (stars > 100) score = 45;
  else if (stars > 10) score = 30;
  else score = 15;

  let days_since_push = null;
  if (repo.pushed_at) {
    days_since_push = Math.floor((Date.now() - new Date(repo.pushed_at).getTime()) / (1000 * 60 * 60 * 24));
  }

  return {
    score,
    level: score >= 60 ? 'healthy' : score >= 40 ? 'fair' : 'at_risk',
    activity_score: null,
    maturity_score: Math.min(100, score + 10),
    maintenance_score: null,
    release_score: null,
    days_since_push,
  };
};

describe('formatDays', () => {
  it('returns 未知 for null', () => {
    expect(formatDays(null)).toBe('未知');
  });

  it('returns 今天 for 0', () => {
    expect(formatDays(0)).toBe('今天');
  });

  it('returns X 天前 for days < 30', () => {
    expect(formatDays(15)).toBe('15 天前');
  });

  it('returns X 月前 for days < 365', () => {
    expect(formatDays(180)).toBe('6 月前');
  });

  it('returns X 年前 for days >= 365', () => {
    expect(formatDays(400)).toBe('1 年前');
  });
});

describe('computeFallback', () => {
  it('scores high-star repos highly', () => {
    const result = computeFallback({ stars: 100000 });
    expect(result.score).toBeGreaterThanOrEqual(80);
    expect(result.level).toBe('healthy');
  });

  it('scores low-star repos low', () => {
    const result = computeFallback({ stars: 5 });
    expect(result.score).toBeLessThan(40);
  });

  it('calculates days_since_push from pushed_at', () => {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const result = computeFallback({ stars: 100, pushed_at: yesterday });
    expect(result.days_since_push).toBe(1);
  });

  it('returns null days_since_push when pushed_at missing', () => {
    const result = computeFallback({ stars: 100 });
    expect(result.days_since_push).toBeNull();
  });
});