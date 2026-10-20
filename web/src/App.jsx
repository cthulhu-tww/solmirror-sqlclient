import { BrowserRouter, Routes, Route, Navigate, useLocation, Link } from 'react-router-dom';
import { useEffect } from 'react';
import { useApp } from './store.js';
import ConnectionsPage from './pages/ConnectionsPage.jsx';
import ConnectionForm from './pages/ConnectionForm.jsx';
import QueryPage from './pages/QueryPage.jsx';
import HistoryPage from './pages/HistoryPage.jsx';
import SettingsPage from './pages/SettingsPage.jsx';
import { IconDb, IconQuery, IconHistory, IconGear } from './components/Icons.jsx';

function TabBar() {
  const loc = useLocation();
  if (loc.pathname.startsWith('/conn')) return null;
  const tabs = [
    { to: '/', label: '连接', icon: <IconDb /> },
    { to: '/query', label: '查询', icon: <IconQuery /> },
    { to: '/history', label: '历史', icon: <IconHistory /> },
    { to: '/settings', label: '设置', icon: <IconGear /> }
  ];
  return (
    <nav className="tabbar">
      {tabs.map(t => {
        const on = t.to === '/' ? loc.pathname === '/' : loc.pathname.startsWith(t.to);
        return (
          <Link key={t.to} to={t.to} className={on ? 'on' : ''}>
            {t.icon}{t.label}
          </Link>
        );
      })}
    </nav>
  );
}

export default function App() {
  const theme = useApp(s => s.theme);
  useEffect(() => { document.documentElement.dataset.theme = theme; }, [theme]);

  return (
    <BrowserRouter>
      <div id="app">
        <Routes>
          <Route path="/" element={<ConnectionsPage />} />
          <Route path="/conn/new" element={<ConnectionForm />} />
          <Route path="/conn/:id" element={<ConnectionForm />} />
          <Route path="/query" element={<QueryPage />} />
          <Route path="/history" element={<HistoryPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <TabBar />
      </div>
    </BrowserRouter>
  );
}
