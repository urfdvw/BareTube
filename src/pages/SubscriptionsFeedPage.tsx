import { useState, useEffect, useCallback } from 'react';
import { getSubscriptions } from '../lib/storage';
import { getChannelDetails, getChannelVideos, ApiError, QuotaExceededError } from '../lib/youtubeApi';
import type { Video } from '../lib/types';
import VideoCard from '../components/VideoCard';

export default function SubscriptionsFeedPage() {
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [loaded, setLoaded] = useState(false);

  const loadFeed = useCallback(async () => {
    const subs = getSubscriptions();
    if (subs.length === 0) {
      setVideos([]);
      setLoaded(true);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const allVideos: Video[] = [];
      for (const sub of subs) {
        let playlistId = sub.uploadsPlaylistId;
        if (!playlistId) {
          const details = await getChannelDetails(sub.channelId);
          playlistId = details?.uploadsPlaylistId;
        }
        if (!playlistId) continue;
        const vids = await getChannelVideos(playlistId, 10);
        allVideos.push(...vids);
      }
      allVideos.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
      setVideos(allVideos);
    } catch (err) {
      if (err instanceof QuotaExceededError || err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Failed to load feed. Check your API key.');
      }
    } finally {
      setLoading(false);
      setLoaded(true);
    }
  }, []);

  useEffect(() => { loadFeed(); }, [loadFeed]);

  const subs = getSubscriptions();

  if (!loaded && loading) {
    return <div className="page"><p className="loading-msg">Loading feed...</p></div>;
  }

  return (
    <div className="page">
      <div className="page-header">
        <h2 className="page-title">Subscriptions</h2>
        <button className="refresh-btn" onClick={loadFeed} disabled={loading}>
          {loading ? '...' : 'Refresh'}
        </button>
      </div>

      {error && <p className="error-msg">{error}</p>}

      {subs.length === 0 && (
        <p className="empty-msg">No subscriptions yet. Search for channels and subscribe.</p>
      )}

      {loading && <p className="loading-msg">Loading feed...</p>}

      <div className="results-list">
        {videos.map((v) => <VideoCard key={v.videoId} video={v} />)}
      </div>
    </div>
  );
}
