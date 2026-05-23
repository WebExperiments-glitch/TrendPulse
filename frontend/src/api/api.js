import axios from 'axios';

const instance = axios.create({
  baseURL: '/api',
  timeout: 10000,
});

const withRetry = async (fn, retries = 3, delay = 1000, signal) => {
  for (let i = 0; i < retries; i++) {
    if (signal?.aborted) throw new Error('Request cancelled');
    try {
      return await fn(signal);
    } catch (error) {
      if (error?.name === 'CanceledError' || error?.code === 'ERR_CANCELED') throw error;
      if (i === retries - 1) throw error;
      console.log(`请求失败，${delay}ms后重试 (${i + 1}/${retries})`);
      await new Promise((resolve, reject) => {
        const timer = setTimeout(resolve, delay);
        signal?.addEventListener('abort', () => { clearTimeout(timer); reject(new Error('Request cancelled')); }, { once: true });
      });
    }
  }
};

export const getDaily = (signal) => withRetry((s) => instance.get('/trending/daily', { signal: s }), 3, 1000, signal);
export const getWeekly = (signal) => withRetry((s) => instance.get('/trending/weekly', { signal: s }), 3, 1000, signal);
export const getRising = (signal) => withRetry((s) => instance.get('/trending/rising', { signal: s }), 3, 1000, signal);
export const getDeclining = (signal) => withRetry((s) => instance.get('/trending/declining', { signal: s }), 3, 1000, signal);
export const getHottest = (signal) => withRetry((s) => instance.get('/trending/hottest', { signal: s }), 3, 1000, signal);
export const getStarHistory = (stars, period, signal) => withRetry((s) => instance.get('/repo/star-history', { params: { stars, period }, signal: s }), 3, 1000, signal);
export const getRepoDetail = (repo, signal) => withRetry((s) => instance.get('/repo/detail', { params: { repo }, signal: s }), 3, 1000, signal);
export const getRepoInsights = (repo, signal) => withRetry((s) => instance.get('/repo/insights', { params: { repo }, signal: s }), 3, 1000, signal);
export const getRepoReleases = (repo, signal) => withRetry((s) => instance.get('/repo/releases', { params: { repo }, signal: s }), 3, 1000, signal);
export const getReposHealth = (repos, signal) => withRetry((s) => instance.post('/repos/health', { repos }, { signal: s, timeout: 30000 }), 2, 2000, signal);
export const compareRepos = (repo1, repo2, signal) => withRetry((s) => instance.get('/compare', { params: { repo1, repo2 }, signal: s }), 3, 1000, signal);
export const searchRepos = (q, signal) => withRetry((s) => instance.get('/search', { params: { q }, signal: s }), 3, 1000, signal);
export const getRepoHistory = (repo, days, signal) => withRetry((s) => instance.get('/repo/history', { params: { repo, days }, signal: s }), 3, 1000, signal);
export const getSummary = (period, tone, signal) => withRetry((s) => instance.get('/summary', { params: { period, tone }, signal: s }), 3, 1000, signal);
