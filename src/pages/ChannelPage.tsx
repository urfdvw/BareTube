import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getChannelDetails, getChannelVideos, ApiError, QuotaExceededError } from '../lib/youtubeApi';
import { isSubscribed, subscribe, unsubscribe } from '../lib/storage';
import type { Channel, Video } from '../lib/types';
import VideoCard from '../components/VideoCard';

export default function ChannelPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [channel, setChannel] = useState<Channel | null>(null);
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [subbed, setSubbed] = useState(false);

  useEffect(() => {
    if (!id) return;
    setSubbed(isSubscribed(id));
    setLoading(true);
    setError('');
    (async () => {
      try {
        const ch = await getChannelDetails(id);
        if (!ch) { setError('Channel not found.'); return; }
        setChannel(ch);
        if (ch.uploadsPlaylistId) {
          const vids = await getChannelVideos(ch.uploadsPlaylistId, 20);
          setVideos(vids);
        }
      } catch (err) {
        if (err instanceof QuotaExceededError || err instanceof ApiError) {
          setError(err.message);
        } else {
          setError('Failed to load channel.');
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  function toggleSub() {
    if (!channel) return;
    if (subbed) {
      unsubscribe(channel.channelId);
      setSubbed(false);
    } else {
      subscribe(channel);
      setSubbed(true);
    }
  }

  if (loading) return <div className="page"><p className="loading-msg">Loading channel...</p></div>;
  if (error) return (
    <div className="page">
      <button className="back-btn" onClick={() => navigate(-1)}>← Back</button>
      <p className="error-msg">{error}</p>
    </div>
  );
  if (!channel) return null;

  return (
    <div className="page">
      <button className="back-btn" onClick={() => navigate(-1)}>← Back</button>
      <div className="channel-header">
        <img src={channel.thumbnail} alt={channel.title} className="channel-header-thumb" />
        <div className="channel-header-info">
          <h2 className="channel-header-title">{channel.title}</h2>
          {channel.subscriberCount && (
            <p className="channel-sub-count">
              {Number(channel.subscriberCount).toLocaleString()} subscribers
            </p>
          )}
        </div>
        <button className={`sub-btn ${subbed ? 'subbed' : ''}`} onClick={toggleSub}>
          {subbed ? 'Unsubscribe' : 'Subscribe'}
        </button>
      </div>
      {channel.description && (
        <p className="channel-description">{channel.description}</p>
      )}
      <h3 className="section-title">Videos</h3>
      <div className="results-list">
        {videos.map((v) => <VideoCard key={v.videoId} video={v} />)}
      </div>
    </div>
  );
}
