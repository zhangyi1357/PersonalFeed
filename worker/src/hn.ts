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
      // Consume body to prevent stalled response warning
      await response.text().catch(() => {});
      return null;
    }
    return await response.json();
  } catch {
    return null;
  }
}

// Get multiple items in batches to avoid too many concurrent requests
export async function getItems(ids: number[], batchSize = 6): Promise<HNItem[]> {
  const allResults: HNItem[] = [];

  for (let i = 0; i < ids.length; i += batchSize) {
    const batch = ids.slice(i, i + batchSize);
    const results = await Promise.allSettled(batch.map((id) => getItem(id)));
    const items = results
      .filter((r): r is PromiseFulfilledResult<HNItem> =>
        r.status === 'fulfilled' && r.value !== null
      )
      .map((r) => r.value);
    allResults.push(...items);
  }

  return allResults;
}

// Filter items that have URL and title (skip Ask HN, Show HN without URL, etc.)
export function filterValidItems(items: HNItem[]): HNItem[] {
  return items.filter((item) => item.url && item.title && item.type === 'story');
}
