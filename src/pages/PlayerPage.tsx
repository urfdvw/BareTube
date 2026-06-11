import { useState, useEffect, useRef } from 'react';
const BackIcon = () => <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg>;
import { useParams, useNavigate } from 'react-router-dom';
import { getVideoDetails, getChannelDetails, ApiError, QuotaExceededError } from '../lib/youtubeApi';
import type { Video, Channel } from '../lib/types';

export default function PlayerPage() {
  const { videoId } = useParams<{ videoId: string }>();
  const navigate = useNavigate();
  const [video, setVideo] = useState<Video | null>(null);
  const [channel, setChannel] = useState<Channel | null>(null);
  const [imgFailed, setImgFailed] = useState(false);
  const [error, setError] = useState('');
  const [descExpanded, setDescExpanded] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    if (!videoId) return;
    setChannel(null);
    setImgFailed(false);
    (async () => {
      try {
        const v = await getVideoDetails(videoId);
        if (!v) { setError('Video not found.'); return; }
        setVideo(v);
        updateMediaSession(v);
        // fetch channel in background for the avatar — don't block on failure
        getChannelDetails(v.channelId).then(setChannel).catch(() => {});
      } catch (err) {
        if (err instanceof QuotaExceededError || err instanceof ApiError) {
          setError(err.message);
        } else {
          setError('Failed to load video info.');
        }
      }
    })();
  }, [videoId]);

  function updateMediaSession(v: Video) {
    if (!('mediaSession' in navigator)) return;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: v.title,
      artist: v.channelTitle,
      artwork: [{ src: v.thumbnail, sizes: '320x180', type: 'image/jpeg' }],
    });
  }

  if (error) return (
    <div className="page">
      <button className="back-btn" onClick={() => navigate(-1)} aria-label="Back"><BackIcon /></button>
      <p className="error-msg">{error}</p>
    </div>
  );

  return (
    <div className="page player-page">
      <button className="back-btn" onClick={() => navigate(-1)} aria-label="Back"><BackIcon /></button>
      <div className="player-wrapper">
        <iframe
          ref={iframeRef}
          className="player-iframe"
          src={`https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0`}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          title={video?.title ?? 'YouTube video'}
        />
      </div>
      {video && (
        <div className="player-info">
          <h2 className="player-title">{video.title}</h2>
          <div className="player-channel-row">
            <button
              className="player-channel-btn"
              onClick={() => navigate(`/channel/${video.channelId}`)}
            >
              {channel?.thumbnail && !imgFailed ? (
                <img
                  src={channel.thumbnail}
                  alt={video.channelTitle}
                  className="player-channel-avatar"
                  onError={() => setImgFailed(true)}
                />
              ) : (
                <div className="player-channel-avatar player-channel-avatar-fallback">
                  {video.channelTitle.charAt(0).toUpperCase()}
                </div>
              )}
              <span>{video.channelTitle}</span>
            </button>
          </div>
          {video.description && (
            <div className="player-desc-wrap">
              <p className={`player-desc ${descExpanded ? 'expanded' : ''}`}>
                {video.description}
              </p>
              <button
                className="desc-toggle"
                onClick={() => setDescExpanded((e) => !e)}
              >
                {descExpanded ? 'Show less' : 'Show more'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
