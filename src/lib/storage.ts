import type { Channel, QuotaInfo, Settings } from './types';

const KEYS = {
  SUBSCRIPTIONS: 'bt_subscriptions',
  QUOTA: 'bt_quota',
  SETTINGS: 'bt_settings',
} as const;

// Settings (includes apiKey)
export function getSettings(): Settings {
  try {
    return { apiKey: '', ...JSON.parse(localStorage.getItem(KEYS.SETTINGS) ?? '{}') };
  } catch {
    return { apiKey: '' };
  }
}
export function setSettings(s: Settings): void {
  localStorage.setItem(KEYS.SETTINGS, JSON.stringify(s));
}

// API Key — convenience wrappers backed by settings
export function getApiKey(): string {
  return getSettings().apiKey.trim();
}
export function setApiKey(key: string): void {
  setSettings({ ...getSettings(), apiKey: key });
}

// Subscriptions
export function getSubscriptions(): Channel[] {
  try {
    return JSON.parse(localStorage.getItem(KEYS.SUBSCRIPTIONS) ?? '[]');
  } catch {
    return [];
  }
}
export function setSubscriptions(subs: Channel[]): void {
  localStorage.setItem(KEYS.SUBSCRIPTIONS, JSON.stringify(subs));
}
export function isSubscribed(channelId: string): boolean {
  return getSubscriptions().some((c) => c.channelId === channelId);
}
export function subscribe(channel: Channel): void {
  const subs = getSubscriptions();
  if (!subs.some((c) => c.channelId === channel.channelId)) {
    setSubscriptions([...subs, channel]);
  }
}
export function unsubscribe(channelId: string): void {
  setSubscriptions(getSubscriptions().filter((c) => c.channelId !== channelId));
}

// Quota
const today = (): string => new Date().toISOString().slice(0, 10);

export function getQuota(): QuotaInfo {
  try {
    const raw = localStorage.getItem(KEYS.QUOTA);
    if (!raw) return { date: today(), unitsUsed: 0 };
    const q: QuotaInfo = JSON.parse(raw);
    if (q.date !== today()) return { date: today(), unitsUsed: 0 };
    return q;
  } catch {
    return { date: today(), unitsUsed: 0 };
  }
}
export function addQuotaUnits(units: number): QuotaInfo {
  const q = getQuota();
  const updated = { ...q, unitsUsed: q.unitsUsed + units };
  localStorage.setItem(KEYS.QUOTA, JSON.stringify(updated));
  return updated;
}
export function resetQuota(): void {
  localStorage.setItem(KEYS.QUOTA, JSON.stringify({ date: today(), unitsUsed: 0 }));
}

// Export / Import
export function exportData(): string {
  return JSON.stringify({
    subscriptions: getSubscriptions(),
    settings: getSettings(),
  });
}
export function importData(json: string): void {
  const data = JSON.parse(json);
  if (Array.isArray(data.subscriptions)) setSubscriptions(data.subscriptions);
  if (data.settings && typeof data.settings === 'object') setSettings({ apiKey: '', ...data.settings });
}
