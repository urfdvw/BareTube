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

function thumb(t: any): string {
  const url = t?.medium?.url ?? t?.high?.url ?? t?.default?.url ?? '';
  return url.startsWith('//') ? `https:${url}` : url;
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
          title: item.snippet.channelTitle ?? item.snippet.title,
          thumbnail: thumb(item.snippet.thumbnails),
        },
      };
    }
    return {
      kind: 'video',
      video: {
        videoId: item.id.videoId,
        title: item.snippet.title,
        thumbnail: thumb(item.snippet.thumbnails),
        channelId: item.snippet.channelId,
        channelTitle: item.snippet.channelTitle,
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
    title: item.snippet.title,
    thumbnail: thumb(item.snippet.thumbnails),
    subscriberCount: item.statistics?.subscriberCount,
    description: item.snippet.description,
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

  return (data.items ?? [])
    .filter((item: any) => item.snippet?.resourceId?.kind === 'youtube#video')
    .map((item: any): Video => ({
      videoId: item.snippet.resourceId.videoId,
      title: item.snippet.title,
      thumbnail: thumb(item.snippet.thumbnails),
      channelId: item.snippet.channelId ?? item.snippet.videoOwnerChannelId,
      channelTitle: item.snippet.channelTitle ?? item.snippet.videoOwnerChannelTitle,
      publishedAt: item.snippet.publishedAt,
      description: item.snippet.description,
    }));
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
    title: item.snippet.title,
    thumbnail: thumb(item.snippet.thumbnails),
    channelId: item.snippet.channelId,
    channelTitle: item.snippet.channelTitle,
    publishedAt: item.snippet.publishedAt,
    description: item.snippet.description,
  };
}
