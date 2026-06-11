import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Channel } from '../lib/types';

interface Props {
  channel: Channel;
}

export default function ChannelCard({ channel }: Props) {
  const navigate = useNavigate();
  const [imgFailed, setImgFailed] = useState(false);

  return (
    <div className="channel-card" onClick={() => navigate(`/channel/${channel.channelId}`)}>
      {!imgFailed && channel.thumbnail ? (
        <img
          src={channel.thumbnail}
          alt={channel.title}
          className="channel-thumb"
          loading="lazy"
          onError={() => setImgFailed(true)}
        />
      ) : (
        <div className="channel-thumb channel-thumb-fallback">
          {channel.title.charAt(0).toUpperCase()}
        </div>
      )}
      <p className="channel-title">{channel.title}</p>
    </div>
  );
}
