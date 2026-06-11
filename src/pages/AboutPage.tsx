import { useNavigate } from 'react-router-dom';
const BackIcon = () => <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg>;

export default function AboutPage() {
  const navigate = useNavigate();
  return (
    <div className="page">
      <button className="back-btn" onClick={() => navigate(-1)} aria-label="Back"><BackIcon /></button>
      <h2 className="page-title">About BareTube</h2>
      <p className="about-text">
        BareTube is a minimal, privacy-friendly YouTube subscriptions PWA. It runs entirely
        in your browser — no accounts, no tracking, no backend.
      </p>
      <h3 className="settings-heading">Version</h3>
      <p className="about-text">1.0.0</p>
      <h3 className="settings-heading">Known Limitations</h3>
      <ul className="about-list">
        <li>
          <strong>Ads:</strong> YouTube ads cannot be removed via the embed player. YouTube Premium
          is required to avoid ads.
        </li>
        <li>
          <strong>Background playback:</strong> Background audio while the screen is off is not
          reliably supported on all mobile browsers. Media Session API controls are registered
          for lock-screen controls where supported.
        </li>
        <li>
          <strong>Shorts:</strong> YouTube Shorts are not filtered from search results or feeds.
        </li>
        <li>
          <strong>Audio-only:</strong> Audio-only playback is not possible without violating
          YouTube's Terms of Service.
        </li>
        <li>
          <strong>API quota:</strong> The YouTube Data API v3 provides 10,000 free units per day.
          Each search costs 100 units; fetching a playlist costs 1 unit.
        </li>
      </ul>
      <h3 className="settings-heading">Privacy</h3>
      <p className="about-text">
        All data (subscriptions, API key) is stored locally in your browser's localStorage.
        Nothing is sent to any server other than the YouTube API.
      </p>
      <h3 className="settings-heading">Source</h3>
      <p className="about-text">
        Open source — view on{' '}
        <a href="https://github.com/urfdvw/baretube" target="_blank" rel="noopener noreferrer">
          GitHub
        </a>.
      </p>
    </div>
  );
}
