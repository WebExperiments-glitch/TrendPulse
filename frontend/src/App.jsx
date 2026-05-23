import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ConfigProvider, App as AntApp } from 'antd';
import Layout from './components/Layout';
import DailyPage from './pages/DailyPage';
import WeeklyPage from './pages/WeeklyPage';
import RisingPage from './pages/RisingPage';
import DecliningPage from './pages/DecliningPage';
import HotPage from './pages/HotPage';
import ComparePage from './pages/ComparePage';
import WatchedPage from './pages/WatchedPage';
import SearchPage from './pages/SearchPage';
import { WatchProvider } from './contexts/WatchContext';
import { ThemeProvider, useTheme } from './contexts/ThemeContext';
import { useEffect } from 'react';

function AppContent() {
  const { isDark } = useTheme();

  useEffect(() => {
    document.documentElement.style.colorScheme = isDark ? 'dark' : 'light';
  }, [isDark]);

  return (
    <ConfigProvider
      theme={{
        token: {
          borderRadius: 8,
          colorPrimary: '#1677ff',
        },
      }}
    >
      <AntApp>
        <WatchProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Layout />}>
                <Route index element={<DailyPage />} />
                <Route path="daily" element={<DailyPage />} />
                <Route path="weekly" element={<WeeklyPage />} />
                <Route path="rising" element={<RisingPage />} />
                <Route path="declining" element={<DecliningPage />} />
                <Route path="hot" element={<HotPage />} />
                <Route path="compare" element={<ComparePage />} />
                <Route path="watched" element={<WatchedPage />} />
                <Route path="search" element={<SearchPage />} />
              </Route>
            </Routes>
          </BrowserRouter>
        </WatchProvider>
      </AntApp>
    </ConfigProvider>
  );
}

function App() {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
}

export default App;