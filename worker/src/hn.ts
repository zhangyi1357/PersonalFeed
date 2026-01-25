import { HNItem } from './types';
import { fetchWithTimeout } from './utils';

const HN_API_BASE = 'https://hacker-news.firebaseio.com/v0';

// Get top story IDs
export async function getTopStoryIds(limit: number): Promise<number[]> {
  const response = await fetchWithTimeout(`${HN_API_BASE}/topstories.json`);
  if (!response.ok) {
    throw new Error(`Failed to fetch top stories: ${response.status}`);
  }
  const ids: number[] = await response.json();
  return ids.slice(0, limit);
}

// Get item details
export async function getItem(id: number): Promise<HNItem | null> {
  try {
    const response = await fetchWithTimeout(`${HN_API_BASE}/item/${id}.json`);
    if (!response.ok) {
      return null;
    }
    return await response.json();
  } catch {
    return null;
  }
}

// Get multiple items in parallel
export async function getItems(ids: number[]): Promise<HNItem[]> {
  const results = await Promise.allSettled(ids.map((id) => getItem(id)));
  return results
    .filter((r): r is PromiseFulfilledResult<HNItem> =>
      r.status === 'fulfilled' && r.value !== null
    )
    .map((r) => r.value);
}

// Filter items that have URL and title (skip Ask HN, Show HN without URL, etc.)
export function filterValidItems(items: HNItem[]): HNItem[] {
  return items.filter((item) => item.url && item.title && item.type === 'story');
}
