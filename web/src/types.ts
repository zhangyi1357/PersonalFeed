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
  recommend_reason: string | null;
  global_score: number | null;
  usage_prompt_tokens: number | null;
  usage_completion_tokens: number | null;
  usage_total_tokens: number | null;
  tags: string[];
  status: 'ok' | 'error';
  error_reason: string | null;
}

export interface FeedResponse {
  date: string;
  count: number;
  items: FeedItem[];
}
