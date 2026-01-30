import { FeedItem } from './types';

// Upsert a feed item
export async function upsertItem(db: D1Database, item: FeedItem): Promise<void> {
  await db
    .prepare(
      `INSERT INTO items (
        hn_id, date, title, url, domain, by, hn_score, descendants,
        hn_time, fetched_at, summary_short, summary_long, recommend_reason, global_score,
        usage_prompt_tokens, usage_completion_tokens, usage_total_tokens,
        tags, status, error_reason, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(hn_id) DO UPDATE SET
        date = excluded.date,
        title = excluded.title,
        url = excluded.url,
        domain = excluded.domain,
        by = excluded.by,
        hn_score = excluded.hn_score,
        descendants = excluded.descendants,
        hn_time = excluded.hn_time,
        fetched_at = excluded.fetched_at,
        summary_short = excluded.summary_short,
        summary_long = excluded.summary_long,
        recommend_reason = excluded.recommend_reason,
        global_score = excluded.global_score,
        usage_prompt_tokens = excluded.usage_prompt_tokens,
        usage_completion_tokens = excluded.usage_completion_tokens,
        usage_total_tokens = excluded.usage_total_tokens,
        tags = excluded.tags,
        status = excluded.status,
        error_reason = excluded.error_reason,
        updated_at = excluded.updated_at`
    )
    .bind(
      item.hn_id,
      item.date,
      item.title,
      item.url,
      item.domain,
      item.by,
      item.hn_score,
      item.descendants,
      item.hn_time,
      item.fetched_at,
      item.summary_short,
      item.summary_long,
      item.recommend_reason,
      item.global_score,
      item.usage_prompt_tokens,
      item.usage_completion_tokens,
      item.usage_total_tokens,
      item.tags,
      item.status,
      item.error_reason,
      item.updated_at
    )
    .run();
}

// Get feed items by date, ordered by global_score descending
export async function getItemsByDate(db: D1Database, date: string): Promise<FeedItem[]> {
  const result = await db
    .prepare(
      `SELECT * FROM items WHERE date = ? ORDER BY global_score DESC LIMIT 30`
    )
    .bind(date)
    .all();

  return (result.results || []).map((row) => ({
    ...row,
    tags: typeof row.tags === 'string' ? JSON.parse(row.tags) : (row.tags || []),
  })) as FeedItem[];
}

export type ItemProcessingState = {
  hn_id: number;
  status: 'ok' | 'error';
  summary_short: string | null;
  summary_long: string | null;
  recommend_reason: string | null;
  global_score: number | null;
  error_reason: string | null;
  updated_at: string;
};

export async function getItemProcessingStatesByIds(
  db: D1Database,
  date: string,
  hnIds: number[]
): Promise<Map<number, ItemProcessingState>> {
  if (!hnIds.length) return new Map();
  const placeholders = hnIds.map(() => '?').join(', ');
  const result = await db
    .prepare(
      `SELECT hn_id, status, summary_short, summary_long, recommend_reason, global_score, error_reason, updated_at
       FROM items
       WHERE date = ? AND hn_id IN (${placeholders})`
    )
    .bind(date, ...hnIds)
    .all();

  const map = new Map<number, ItemProcessingState>();
  for (const row of (result.results || []) as any[]) {
    map.set(Number(row.hn_id), row as ItemProcessingState);
  }
  return map;
}

// Check if item exists
export async function itemExists(db: D1Database, hnId: number): Promise<boolean> {
  const result = await db
    .prepare(`SELECT 1 FROM items WHERE hn_id = ?`)
    .bind(hnId)
    .first();
  return result !== null;
}
