import { HashRouter, Routes, Route } from 'react-router-dom';
import BottomNav from './components/BottomNav';
import HamburgerMenu from './components/HamburgerMenu';
import SearchPage from './pages/SearchPage';
import SubscriptionsFeedPage from './pages/SubscriptionsFeedPage';
import ChannelsPage from './pages/ChannelsPage';
import ChannelPage from './pages/ChannelPage';
import PlayerPage from './pages/PlayerPage';
import SettingsPage from './pages/SettingsPage';
import AboutPage from './pages/AboutPage';

export default function App() {
  return (
    <HashRouter>
      <div className="app-shell">
        <header className="app-header">
          <HamburgerMenu />
          <span className="header-title">BareTube</span>
        </header>
        <main className="app-main">
          <Routes>
            <Route path="/" element={<SearchPage />} />
            <Route path="/subscriptions" element={<SubscriptionsFeedPage />} />
            <Route path="/channels" element={<ChannelsPage />} />
            <Route path="/channel/:id" element={<ChannelPage />} />
            <Route path="/player/:videoId" element={<PlayerPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/about" element={<AboutPage />} />
          </Routes>
        </main>
        <BottomNav />
      </div>
    </HashRouter>
  );
}
