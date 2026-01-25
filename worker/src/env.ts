export interface Env {
  daily_feed_db: D1Database;
  LLM_API_KEY: string;
  LLM_BASE_URL?: string;
  LLM_MODEL?: string;
  HN_LIMIT?: string;
  MAX_ARTICLE_CHARS?: string;
  MAX_OUTPUT_TOKENS?: string;
  TEMPERATURE?: string;
}

export const defaults = {
  LLM_BASE_URL: 'https://api.deepseek.com/v1',
  LLM_MODEL: 'deepseek-chat',
  HN_LIMIT: 30,
  MAX_ARTICLE_CHARS: 12000,
  MAX_OUTPUT_TOKENS: 350,
  TEMPERATURE: 0.1,
};

export function getConfig(env: Env) {
  return {
    llmApiKey: env.LLM_API_KEY,
    llmBaseUrl: env.LLM_BASE_URL || defaults.LLM_BASE_URL,
    llmModel: env.LLM_MODEL || defaults.LLM_MODEL,
    hnLimit: parseInt(env.HN_LIMIT || String(defaults.HN_LIMIT), 10),
    maxArticleChars: parseInt(env.MAX_ARTICLE_CHARS || String(defaults.MAX_ARTICLE_CHARS), 10),
    maxOutputTokens: parseInt(env.MAX_OUTPUT_TOKENS || String(defaults.MAX_OUTPUT_TOKENS), 10),
    temperature: parseFloat(env.TEMPERATURE || String(defaults.TEMPERATURE)),
  };
}
