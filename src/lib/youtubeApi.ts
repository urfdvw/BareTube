import { getApiKey, addQuotaUnits, getQuota } from './storage';
import type { Channel, Video, SearchResult } from './types';

const BASE = 'https://www.googleapis.com/youtube/v3';
const DAILY_QUOTA = 10000;

export class QuotaExceededError extends Error {
  constructor() {
    super('Daily API quota exceeded. Try again tomorrow or use a different API key.');
    this.name = 'QuotaExceededError';
  }
}

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

function parseDuration(iso: string): string {
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return '';
  const h = parseInt(m[1] ?? '0', 10);
  const min = parseInt(m[2] ?? '0', 10);
  const s = parseInt(m[3] ?? '0', 10);
  if (h > 0) return `${h}:${String(min).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${min}:${String(s).padStart(2, '0')}`;
}

async function fetchDurations(videoIds: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  for (let i = 0; i < videoIds.length; i += 50) {
    const batch = videoIds.slice(i, i + 50);
    const data = await apiFetch<any>('/videos', { part: 'contentDetails', id: batch.join(',') }, 1);
    for (const item of data.items ?? []) {
      map.set(item.id, parseDuration(item.contentDetails?.duration ?? ''));
    }
  }
  return map;
}

function thumb(t: any): string {
  const url = t?.medium?.url ?? t?.high?.url ?? t?.default?.url ?? '';
  return url.startsWith('//') ? `https:${url}` : url;
}

function decode(s: string): string {
  const el = document.createElement('textarea');
  el.innerHTML = s;
  return el.value;
}

function checkQuota(units: number): void {
  const q = getQuota();
  if (q.unitsUsed + units > DAILY_QUOTA) throw new QuotaExceededError();
}

async function apiFetch<T>(path: string, params: Record<string, string>, cost: number): Promise<T> {
  checkQuota(cost);
  const key = getApiKey();
  if (!key) throw new ApiError(0, 'No API key configured. Add one in Settings.');

  const url = new URL(`${BASE}${path}`);
  url.searchParams.set('key', key);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

  const res = await fetch(url.toString());
  addQuotaUnits(cost);

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const msg = body?.error?.message ?? `HTTP ${res.status}`;
    throw new ApiError(res.status, msg);
  }
  return res.json();
}

// Search (100 units)
export async function searchYouTube(query: string): Promise<SearchResult[]> {
  const data = await apiFetch<any>('/search', {
    part: 'snippet',
    q: query,
    type: 'video,channel',
    maxResults: '20',
    safeSearch: 'none',
  }, 100);

  return (data.items ?? []).map((item: any): SearchResult => {
    if (item.id.kind === 'youtube#channel') {
      return {
        kind: 'channel',
        channel: {
          channelId: item.id.channelId,
          title: decode(item.snippet.channelTitle ?? item.snippet.title),
          thumbnail: thumb(item.snippet.thumbnails),
        },
      };
    }
    return {
      kind: 'video',
      video: {
        videoId: item.id.videoId,
        title: decode(item.snippet.title),
        thumbnail: thumb(item.snippet.thumbnails),
        channelId: item.snippet.channelId,
        channelTitle: decode(item.snippet.channelTitle),
        publishedAt: item.snippet.publishedAt,
        description: item.snippet.description,
      },
    };
  });
}

// Channel details (1 unit)
export async function getChannelDetails(channelId: string): Promise<Channel | null> {
  const data = await apiFetch<any>('/channels', {
    part: 'snippet,contentDetails,statistics',
    id: channelId,
    maxResults: '1',
  }, 1);

  const item = data.items?.[0];
  if (!item) return null;
  return {
    channelId: item.id,
    title: decode(item.snippet.title),
    thumbnail: thumb(item.snippet.thumbnails),
    subscriberCount: item.statistics?.subscriberCount,
    description: decode(item.snippet.description ?? ''),
    uploadsPlaylistId: item.contentDetails?.relatedPlaylists?.uploads,
  };
}

// Uploads playlist (1 unit per call)
export async function getChannelVideos(uploadsPlaylistId: string, maxResults = 20): Promise<Video[]> {
  const data = await apiFetch<any>('/playlistItems', {
    part: 'snippet',
    playlistId: uploadsPlaylistId,
    maxResults: String(maxResults),
  }, 1);

  const videos: Video[] = (data.items ?? [])
    .filter((item: any) => item.snippet?.resourceId?.kind === 'youtube#video')
    .map((item: any): Video => ({
      videoId: item.snippet.resourceId.videoId,
      title: decode(item.snippet.title),
      thumbnail: thumb(item.snippet.thumbnails),
      channelId: item.snippet.channelId ?? item.snippet.videoOwnerChannelId,
      channelTitle: decode(item.snippet.channelTitle ?? item.snippet.videoOwnerChannelTitle ?? ''),
      publishedAt: item.snippet.publishedAt,
      description: item.snippet.description,
    }));

  const durations = await fetchDurations(videos.map(v => v.videoId));
  return videos.map(v => ({ ...v, duration: durations.get(v.videoId) }));
}

// Video details (1 unit)
export async function getVideoDetails(videoId: string): Promise<Video | null> {
  const data = await apiFetch<any>('/videos', {
    part: 'snippet',
    id: videoId,
    maxResults: '1',
  }, 1);

  const item = data.items?.[0];
  if (!item) return null;
  return {
    videoId: item.id,
    title: decode(item.snippet.title),
    thumbnail: thumb(item.snippet.thumbnails),
    channelId: item.snippet.channelId,
    channelTitle: decode(item.snippet.channelTitle),
    publishedAt: item.snippet.publishedAt,
    description: item.snippet.description,
  };
}
