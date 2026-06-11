import { useNavigate } from 'react-router-dom';
import type { Channel } from '../lib/types';

interface Props {
  channel: Channel;
}

export default function ChannelCard({ channel }: Props) {
  const navigate = useNavigate();
  return (
    <div className="channel-card" onClick={() => navigate(`/channel/${channel.channelId}`)}>
      <img src={channel.thumbnail} alt={channel.title} className="channel-thumb" loading="lazy" />
      <p className="channel-title">{channel.title}</p>
    </div>
  );
}
