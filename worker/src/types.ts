// Hacker News API item
export interface HNItem {
  id: number;
  type: string;
  by?: string;
  time?: number;
  title?: string;
  url?: string;
  score?: number;
  descendants?: number;
}

// Feed item stored in D1
export interface FeedItem {
  hn_id: number;
  date: string;
  title: string;
  url: string | null;
  domain: string | null;
  by: string | null;
  hn_score: number | null;
  descendants: number | null;
  hn_time: number | null;
  fetched_at: string;
  summary_short: string | null;
  summary_long: string | null;
  recommend_reason: string | null;
  global_score: number | null;
  usage_prompt_tokens: number | null;
  usage_completion_tokens: number | null;
  usage_total_tokens: number | null;
  tags: string | null;
  status: 'ok' | 'error';
  error_reason: string | null;
  updated_at: string;
}

// LLM response structure
export interface LLMSummaryResult {
  summary_short: string;
  summary_long: string;
  recommend_reason: string;
  global_score: number;
  tags: string[];
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

// API response types
export interface FeedResponse {
  date: string;
  count: number;
  items: FeedItem[];
}

export interface HealthResponse {
  version: string;
  timestamp: string;
}

export interface RefreshResponse {
  ok: boolean;
  date: string;
  ingested: number;
  failed: number;
}
