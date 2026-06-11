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

export default function VideoCard({ video }: Props) {
  const navigate = useNavigate();
  return (
    <div className="video-card" onClick={() => navigate(`/player/${video.videoId}`)}>
      <img src={video.thumbnail} alt={video.title} className="video-thumb" loading="lazy" />
      <div className="video-info">
        <p className="video-title">{video.title}</p>
        <p className="video-meta">
          <span
            className="video-channel-link"
            onClick={(e) => { e.stopPropagation(); navigate(`/channel/${video.channelId}`); }}
          >
            {video.channelTitle}
          </span>
          {' · '}{timeAgo(video.publishedAt)}
        </p>
      </div>
    </div>
  );
}
