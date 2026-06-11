import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getVideoDetails, ApiError, QuotaExceededError } from '../lib/youtubeApi';
import type { Video } from '../lib/types';

export default function PlayerPage() {
  const { videoId } = useParams<{ videoId: string }>();
  const navigate = useNavigate();
  const [video, setVideo] = useState<Video | null>(null);
  const [error, setError] = useState('');
  const [descExpanded, setDescExpanded] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    if (!videoId) return;
    (async () => {
      try {
        const v = await getVideoDetails(videoId);
        if (!v) { setError('Video not found.'); return; }
        setVideo(v);
        updateMediaSession(v);
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
      <button className="back-btn" onClick={() => navigate(-1)}>← Back</button>
      <p className="error-msg">{error}</p>
    </div>
  );

  return (
    <div className="page player-page">
      <button className="back-btn" onClick={() => navigate(-1)}>← Back</button>
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
          <p
            className="player-channel"
            onClick={() => navigate(`/channel/${video.channelId}`)}
          >
            {video.channelTitle}
          </p>
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
