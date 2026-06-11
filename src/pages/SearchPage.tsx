import { useState, useRef } from 'react';
import { searchYouTube, ApiError, QuotaExceededError } from '../lib/youtubeApi';
import type { SearchResult } from '../lib/types';
import VideoCard from '../components/VideoCard';
import ChannelCard from '../components/ChannelCard';

export default function SearchPage() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    setLoading(true);
    setError('');
    try {
      const res = await searchYouTube(q);
      setResults(res);
    } catch (err) {
      if (err instanceof QuotaExceededError || err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Search failed. Check your API key and network connection.');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page">
      <form className="search-form" onSubmit={handleSearch}>
        <input
          ref={inputRef}
          type="search"
          className="search-input"
          placeholder="Search YouTube..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
        />
        <button type="submit" className="search-btn" disabled={loading}>
          {loading ? '...' : 'Search'}
        </button>
      </form>

      {error && <p className="error-msg">{error}</p>}

      <div className="results-list">
        {results.map((r, i) =>
          r.kind === 'channel' && r.channel ? (
            <ChannelCard key={r.channel.channelId} channel={r.channel} />
          ) : r.video ? (
            <VideoCard key={r.video.videoId + i} video={r.video} />
          ) : null
        )}
      </div>
    </div>
  );
}
