import { useNavigate } from 'react-router-dom';
import { getSubscriptions, unsubscribe } from '../lib/storage';
import { useState } from 'react';

export default function ChannelsPage() {
  const navigate = useNavigate();
  const [, forceUpdate] = useState(0);
  const subs = getSubscriptions();

  function handleUnsubscribe(channelId: string, e: React.MouseEvent) {
    e.stopPropagation();
    unsubscribe(channelId);
    forceUpdate((n) => n + 1);
  }

  return (
    <div className="page">
      <h2 className="page-title">Channels</h2>
      {subs.length === 0 && (
        <p className="empty-msg">No subscriptions yet. Search for channels and subscribe.</p>
      )}
      <div className="channels-list">
        {subs.map((ch) => (
          <div key={ch.channelId} className="channel-list-item" onClick={() => navigate(`/channel/${ch.channelId}`)}>
            <img src={ch.thumbnail} alt={ch.title} className="channel-list-thumb" loading="lazy" />
            <span className="channel-list-title">{ch.title}</span>
            <button
              className="unsub-btn"
              onClick={(e) => handleUnsubscribe(ch.channelId, e)}
              aria-label="Unsubscribe"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
