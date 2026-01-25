export interface FeedItem {
  hn_id: number;
  title: string;
  url: string | null;
  domain: string | null;
  by: string;
  hn_score: number;
  descendants: number;
  hn_time: number;
  fetched_at: string;
  summary_short: string | null;
  summary_long: string | null;
  global_score: number | null;
  tags: string[];
  status: 'ok' | 'error';
  error_reason: string | null;
}

export interface FeedResponse {
  date: string;
  count: number;
  items: FeedItem[];
}
