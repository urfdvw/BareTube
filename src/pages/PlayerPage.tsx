import { useState, useEffect, useRef } from 'react';
const BackIcon = () => <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg>;
import { useParams, useNavigate } from 'react-router-dom';
import { getVideoDetails, getChannelDetails, ApiError, QuotaExceededError } from '../lib/youtubeApi';
import type { Video, Channel } from '../lib/types';

const TS_REGEX = /\b(\d{1,2}:\d{2}(?::\d{2})?)\b/g;

function tsToSeconds(ts: string): number {
  const parts = ts.split(':').map(Number);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return parts[0] * 60 + parts[1];
}

type DescPart = { kind: 'text'; text: string } | { kind: 'ts'; ts: string };

function parseDesc(text: string): DescPart[] {
  const parts: DescPart[] = [];
  let last = 0;
  TS_REGEX.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = TS_REGEX.exec(text)) !== null) {
    if (m.index > last) parts.push({ kind: 'text', text: text.slice(last, m.index) });
    parts.push({ kind: 'ts', ts: m[1] });
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push({ kind: 'text', text: text.slice(last) });
  return parts;
}

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

  function seekTo(seconds: number) {
    iframeRef.current?.contentWindow?.postMessage(
      JSON.stringify({ event: 'command', func: 'seekTo', args: [seconds, true] }),
      'https://www.youtube.com'
    );
  }

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
          src={`https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0&enablejsapi=1`}
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
              <div className={`player-desc ${descExpanded ? 'expanded' : ''}`}>
                {parseDesc(video.description).map((part, i) =>
                  part.kind === 'ts' ? (
                    <button
                      key={i}
                      className="desc-timestamp"
                      onClick={() => seekTo(tsToSeconds(part.ts))}
                    >
                      {part.ts}
                    </button>
                  ) : (
                    <span key={i}>{part.text}</span>
                  )
                )}
              </div>
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
