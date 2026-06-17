import { useState, useRef } from 'react';
import { searchYouTube, ApiError, QuotaExceededError } from '../lib/youtubeApi';
import type { SearchResult } from '../lib/types';
import VideoCard from '../components/VideoCard';
import ChannelCard from '../components/ChannelCard';

let _cachedQuery = '';
let _cachedResults: SearchResult[] = [];
let _cachedError = '';

export default function SearchPage() {
  const [query, setQuery] = useState(_cachedQuery);
  const [results, setResults] = useState<SearchResult[]>(_cachedResults);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(_cachedError);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    setLoading(true);
    setError('');
    _cachedError = '';
    try {
      const res = await searchYouTube(q);
      setResults(res);
      _cachedResults = res;
      _cachedQuery = q;
    } catch (err) {
      const msg = err instanceof QuotaExceededError || err instanceof ApiError
        ? err.message
        : 'Search failed. Check your API key and network connection.';
      setError(msg);
      _cachedError = msg;
      _cachedResults = [];
      setResults([]);
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
          onChange={(e) => { setQuery(e.target.value); _cachedQuery = e.target.value; }}
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
