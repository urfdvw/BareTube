import { useNavigate } from 'react-router-dom';
import type { Video } from '../lib/types';

interface Props {
  video: Video;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  const mo = Math.floor(d / 30);
  if (mo < 12) return `${mo}mo ago`;
  return `${Math.floor(mo / 12)}y ago`;
}

const ChannelIcon = () => (
  <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" style={{ flexShrink: 0 }}>
    <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
  </svg>
);

export default function VideoCard({ video }: Props) {
  const navigate = useNavigate();
  return (
    <div className="video-card" onClick={() => navigate(`/player/${video.videoId}`)}>
      <div className="video-thumb-wrap">
        <img src={video.thumbnail} alt={video.title} className="video-thumb" loading="lazy" />
        {video.duration && <span className="video-duration">{video.duration}</span>}
      </div>
      <div className="video-info">
        <p className="video-title">{video.title}</p>
        <p className="video-time">{timeAgo(video.publishedAt)}</p>
        <div className="video-channel-row">
          <button
            className="video-channel-btn"
            onClick={(e) => { e.stopPropagation(); navigate(`/channel/${video.channelId}`); }}
          >
            <ChannelIcon />
            <span>{video.channelTitle}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
