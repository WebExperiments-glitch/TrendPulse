import { describe, it, expect } from 'vitest';

const extractLanguages = (repos) => {
  const langs = new Set();
  repos.forEach((r) => { if (r.language) langs.add(r.language); });
  return [...langs].sort();
};

const extractTopics = (repos) => {
  const countMap = {};
  repos.forEach((r) => {
    (r.topics || []).forEach((t) => {
      countMap[t] = (countMap[t] || 0) + 1;
    });
  });
  return Object.entries(countMap)
    .sort((a, b) => b[1] - a[1])
    .map(([t, c]) => ({ topic: t, count: c }));
};

describe('extractLanguages', () => {
  it('returns unique languages sorted', () => {
    const repos = [
      { language: 'Python' },
      { language: 'JavaScript' },
      { language: 'Python' },
    ];
    expect(extractLanguages(repos)).toEqual(['JavaScript', 'Python']);
  });

  it('skips null/undefined languages', () => {
    const repos = [
      { language: 'Python' },
      { language: null },
      { language: undefined },
    ];
    expect(extractLanguages(repos)).toEqual(['Python']);
  });

  it('returns empty array for empty input', () => {
    expect(extractLanguages([])).toEqual([]);
  });
});

describe('extractTopics', () => {
  it('counts topic occurrences correctly', () => {
    const repos = [
      { topics: ['ai', 'ml'] },
      { topics: ['ai', 'python'] },
      { topics: ['ml'] },
    ];
    const result = extractTopics(repos);
    expect(result).toContainEqual({ topic: 'ai', count: 2 });
    expect(result).toContainEqual({ topic: 'ml', count: 2 });
    expect(result).toContainEqual({ topic: 'python', count: 1 });
  });

  it('sorts by count descending', () => {
    const repos = [
      { topics: ['b'] },
      { topics: ['a', 'a', 'a'] },
    ];
    const result = extractTopics(repos);
    expect(result[0].topic).toBe('a');
  });

  it('handles missing topics array', () => {
    const repos = [{ name: 'x' }, { topics: ['test'] }];
    const result = extractTopics(repos);
    expect(result).toEqual([{ topic: 'test', count: 1 }]);
  });
});