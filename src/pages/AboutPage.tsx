import { useNavigate } from 'react-router-dom';
const BackIcon = () => <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg>;

export default function AboutPage() {
  const navigate = useNavigate();
  return (
    <div className="page">
      <button className="back-btn" onClick={() => navigate(-1)} aria-label="Back"><BackIcon /></button>
      <h2 className="page-title">About BareTube</h2>
      <p className="about-text">
        A minimal distraction-free YouTube PWA.
      </p>
      <h3 className="settings-heading">Version</h3>
      <p className="about-text">1.0.0</p>
      <h3 className="settings-heading">FAQ</h3>
      <h4 className="settings-subheading">How can I play video in the background?</h4>
      <p className="about-text">
        This totally depends on your OS and browser.
        I use Firefox on Android with the "Video Background Play Fix" extension.
      </p>
      <h4 className="settings-subheading">Why am I getting ads?</h4>
      <p className="about-text">
        You will need to log in to your YouTube account and also have a subscription.
      </p>
      <p className="about-text">
        If you have a subscription and are logged in to your YouTube account but are still seeing
        ads in BareTube, it is probably because you have anti-tracking features enabled, so your
        YouTube cookies are not visible to BareTube. Try turning that feature off in browser for
        BareTube.
      </p>
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
