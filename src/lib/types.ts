export interface Channel {
  channelId: string;
  title: string;
  thumbnail: string;
  subscriberCount?: string;
  description?: string;
  uploadsPlaylistId?: string;
}

export interface Video {
  videoId: string;
  title: string;
  thumbnail: string;
  channelId: string;
  channelTitle: string;
  publishedAt: string;
  description?: string;
}

export interface SearchResult {
  kind: 'channel' | 'video';
  channel?: Channel;
  video?: Video;
}

export interface QuotaInfo {
  date: string;
  unitsUsed: number;
}

export interface Settings {
  apiKey: string;
}

export interface AppStorage {
  apiKey: string;
  subscriptions: Channel[];
  quota: QuotaInfo;
  settings: Settings;
}
