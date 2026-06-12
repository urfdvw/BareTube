import { useState, useEffect, useCallback, useRef } from 'react';
import { getSubscriptions } from '../lib/storage';
import { getChannelDetails, getChannelVideos, ApiError, QuotaExceededError } from '../lib/youtubeApi';
import type { Video } from '../lib/types';
import VideoCard from '../components/VideoCard';

const CACHE_KEY = 'bt_feed_cache';
const CACHE_TS_KEY = 'bt_feed_last_refresh';
const PULL_THRESHOLD = 70;

function loadCache(): { videos: Video[]; ts: number } | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    const ts = Number(localStorage.getItem(CACHE_TS_KEY));
    if (raw && ts) return { videos: JSON.parse(raw), ts };
  } catch {}
  return null;
}

function saveCache(videos: Video[]) {
  const ts = Date.now();
  localStorage.setItem(CACHE_KEY, JSON.stringify(videos));
  localStorage.setItem(CACHE_TS_KEY, String(ts));
  return ts;
}

function refreshTimeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'Last refreshed just now';
  if (m < 60) return `Last refreshed ${m} minute${m === 1 ? '' : 's'} ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `Last refreshed ${h} hour${h === 1 ? '' : 's'} ago`;
  const d = Math.floor(h / 24);
  return `Last refreshed ${d} day${d === 1 ? '' : 's'} ago`;
}

export default function SubscriptionsFeedPage() {
  const cached = loadCache();
  const [videos, setVideos] = useState<Video[]>(cached?.videos ?? []);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [loaded, setLoaded] = useState(!!cached);
  const [lastRefresh, setLastRefresh] = useState<number | null>(cached?.ts ?? null);
  const [pullY, setPullY] = useState(0);
  const [, setTick] = useState(0);

  const pageRef = useRef<HTMLDivElement>(null);
  const startY = useRef(0);
  const isPulling = useRef(false);
  const loadFeedRef = useRef<() => void>(() => {});

  // Re-render every minute so the relative time stays fresh
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 60000);
    return () => clearInterval(id);
  }, []);

  const loadFeed = useCallback(async () => {
    const subs = getSubscriptions();
    if (subs.length === 0) {
      setVideos([]);
      setLoaded(true);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const allVideos: Video[] = [];
      for (const sub of subs) {
        let playlistId = sub.uploadsPlaylistId;
        if (!playlistId) {
          const details = await getChannelDetails(sub.channelId);
          playlistId = details?.uploadsPlaylistId;
        }
        if (!playlistId) continue;
        const vids = await getChannelVideos(playlistId, 10);
        allVideos.push(...vids);
      }
      allVideos.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
      setVideos(allVideos);
      setLastRefresh(saveCache(allVideos));
    } catch (err) {
      if (err instanceof QuotaExceededError || err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Failed to load feed. Check your API key.');
      }
    } finally {
      setLoading(false);
      setLoaded(true);
    }
  }, []);

  useEffect(() => { loadFeedRef.current = loadFeed; }, [loadFeed]);

  useEffect(() => { if (!cached) loadFeed(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Pull-to-refresh: attach non-passive touch listeners to the scroll container (.app-main)
  useEffect(() => {
    const scrollEl = pageRef.current?.parentElement;
    if (!scrollEl) return;

    const onTouchStart = (e: TouchEvent) => {
      if (scrollEl.scrollTop === 0) {
        startY.current = e.touches[0].clientY;
        isPulling.current = true;
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!isPulling.current) return;
      const delta = e.touches[0].clientY - startY.current;
      if (delta > 0) {
        if (e.cancelable) e.preventDefault();
        setPullY(Math.min(delta * 0.5, PULL_THRESHOLD));
      } else {
        isPulling.current = false;
        setPullY(0);
      }
    };

    const onTouchEnd = () => {
      if (!isPulling.current) return;
      isPulling.current = false;
      setPullY(prev => {
        if (prev >= PULL_THRESHOLD) loadFeedRef.current();
        return 0;
      });
    };

    scrollEl.addEventListener('touchstart', onTouchStart, { passive: true });
    scrollEl.addEventListener('touchmove', onTouchMove, { passive: false });
    scrollEl.addEventListener('touchend', onTouchEnd, { passive: true });

    return () => {
      scrollEl.removeEventListener('touchstart', onTouchStart);
      scrollEl.removeEventListener('touchmove', onTouchMove);
      scrollEl.removeEventListener('touchend', onTouchEnd);
    };
  }, []);

  const subs = getSubscriptions();
  const pullTriggered = pullY >= PULL_THRESHOLD;

  if (!loaded && loading) {
    return <div className="page"><p className="loading-msg">Loading feed...</p></div>;
  }

  return (
    <div className="page" ref={pageRef}>
      <div
        className="pull-indicator"
        style={{ height: pullY, opacity: pullY / PULL_THRESHOLD }}
      >
        <span className={`pull-icon${pullTriggered ? ' pull-icon--ready' : ''}`}>↓</span>
      </div>

      <div className="page-header">
        <h2 className="page-title">Subscriptions</h2>
        <div className="feed-header-right">
          {lastRefresh && !loading && (
            <span className="feed-refresh-time">{refreshTimeAgo(lastRefresh)}</span>
          )}
          <button className="refresh-btn" onClick={loadFeed} disabled={loading} aria-label="Refresh feed">
            <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"
              style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }}>
              <path d="M17.65 6.35A7.958 7.958 0 0 0 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08A5.99 5.99 0 0 1 12 18c-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/>
            </svg>
          </button>
        </div>
      </div>

      {error && <p className="error-msg">{error}</p>}

      {subs.length === 0 && (
        <p className="empty-msg">No subscriptions yet. Search for channels and subscribe.</p>
      )}

      {loading && <p className="loading-msg">Loading feed...</p>}

      <div className="results-list">
        {videos.map((v) => <VideoCard key={v.videoId} video={v} />)}
      </div>
    </div>
  );
}
