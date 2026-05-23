import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const ThemeContext = createContext(null);

const STORAGE_KEY = 'github_trending_theme';

function getInitialTheme() {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === 'dark' || stored === 'light') return stored;
  if (window.matchMedia('(prefers-color-scheme: dark)').matches) return 'dark';
  return 'light';
}

export const ThemeProvider = ({ children }) => {
  const [mode, setMode] = useState(getInitialTheme);

  const toggleTheme = useCallback(() => {
    setMode((prev) => {
      const next = prev === 'light' ? 'dark' : 'light';
      localStorage.setItem(STORAGE_KEY, next);
      return next;
    });
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', mode === 'dark');
  }, [mode]);

  const isDark = mode === 'dark';

  return (
    <ThemeContext.Provider value={{ isDark, mode, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);