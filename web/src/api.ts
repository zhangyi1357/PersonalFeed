import type { FeedResponse } from './types';

const API_BASE = import.meta.env.VITE_API_BASE || '';

export async function fetchFeedToday(): Promise<FeedResponse> {
  const res = await fetch(`${API_BASE}/api/feed/today`);
  if (!res.ok) throw new Error('Failed to fetch feed');
  return res.json();
}

export async function fetchFeedByDate(date: string): Promise<FeedResponse> {
  const res = await fetch(`${API_BASE}/api/feed?date=${date}`);
  if (!res.ok) throw new Error('Failed to fetch feed');
  return res.json();
}
