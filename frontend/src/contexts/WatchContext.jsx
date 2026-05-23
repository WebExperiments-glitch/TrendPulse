import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { getDaily, getWeekly, getRising, getDeclining } from '../api/api';

const WatchContext = createContext();

const WATCHLIST_KEY = 'github_trending_watchlist';
const ALERTS_KEY = 'github_trending_alerts';

export const WatchProvider = ({ children }) => {
  const [watchlist, setWatchlist] = useState(() => {
    try { return JSON.parse(localStorage.getItem(WATCHLIST_KEY) || '[]'); } catch { return []; }
  });
  const [alerts, setAlerts] = useState([]);
  const checkingRef = useRef(false);

  useEffect(() => {
    localStorage.setItem(WATCHLIST_KEY, JSON.stringify(watchlist));
  }, [watchlist]);

  const refreshAlerts = useCallback(async () => {
    if (watchlist.length === 0) { setAlerts([]); return; }
    if (checkingRef.current) return;
    checkingRef.current = true;
    try {
      const allData = [];
      const fetchers = [getDaily, getWeekly, getRising, getDeclining];
      const results = await Promise.allSettled(fetchers.map((f) => f()));
      results.forEach((r) => {
        if (r.status === 'fulfilled' && Array.isArray(r.value?.data)) allData.push(...r.value.data);
      });

      const foundMap = {};
      allData.forEach((repo) => { foundMap[repo.name] = repo; });

      const newAlerts = watchlist
        .map((w) => {
          const current = foundMap[w.name];
          if (!current) return null;
          const prevStars = w.stars || 0;
          const currStars = current.stars || 0;
          if (prevStars === 0) return null;
          const change = ((currStars - prevStars) / prevStars) * 100;
          if (Math.abs(change) < 20) return null;
          return {
            name: w.name,
            prevStars,
            currStars,
            change: Math.round(change * 10) / 10,
            direction: change > 0 ? 'up' : 'down',
          };
        })
        .filter(Boolean);

      setAlerts(newAlerts);
      localStorage.setItem(ALERTS_KEY, JSON.stringify({ time: Date.now(), alerts: newAlerts }));
    } catch {
      try {
        const cached = JSON.parse(localStorage.getItem(ALERTS_KEY) || '{}');
        if (cached.alerts) setAlerts(cached.alerts);
      } catch {}
    } finally {
      checkingRef.current = false;
    }
  }, [watchlist]);

  useEffect(() => {
    refreshAlerts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isWatched = useCallback((repoName) => watchlist.some((w) => w.name === repoName), [watchlist]);

  const toggleWatch = useCallback((repo) => {
    setWatchlist((prev) => {
      if (prev.some((w) => w.name === repo.name)) {
        setAlerts((a) => a.filter((x) => x.name !== repo.name));
        return prev.filter((w) => w.name !== repo.name);
      }
      return [...prev, { name: repo.name, author: repo.author, repo_name: repo.repo_name, url: repo.url, stars: repo.stars, language: repo.language, period: repo.period, addedAt: new Date().toISOString() }];
    });
  }, []);

  const getAlert = useCallback((repoName) => alerts.find((a) => a.name === repoName), [alerts]);

  return (
    <WatchContext.Provider value={{ watchlist, isWatched, toggleWatch, alerts, refreshAlerts, getAlert }}>
      {children}
    </WatchContext.Provider>
  );
};

export const useWatch = () => useContext(WatchContext);