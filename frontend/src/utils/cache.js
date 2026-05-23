const CACHE_PREFIX = 'trending_cache_';

export const getCachedData = (key) => {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !parsed.data || !parsed.timestamp) return null;
    return parsed;
  } catch {
    return null;
  }
};

export const setCachedData = (key, data) => {
  try {
    localStorage.setItem(CACHE_PREFIX + key, JSON.stringify({
      data,
      timestamp: Date.now(),
    }));
  } catch {
    console.warn('localStorage 缓存写入失败');
  }
};