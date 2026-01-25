import { fetchWithTimeout, truncateText } from './utils';

const JINA_READER_BASE = 'https://r.jina.ai';

// Fetch article content via Jina Reader
export async function fetchArticleContent(
  url: string,
  maxChars: number
): Promise<{ content: string; success: boolean }> {
  try {
    const readerUrl = `${JINA_READER_BASE}/${url}`;
    const response = await fetchWithTimeout(readerUrl, {
      headers: {
        'Accept': 'text/plain',
      },
    }, 30000);

    if (!response.ok) {
      // Consume body to prevent stalled response warning
      await response.text().catch(() => {});
      return { content: '', success: false };
    }

    const text = await response.text();
    const truncated = truncateText(text, maxChars);
    return { content: truncated, success: true };
  } catch {
    return { content: '', success: false };
  }
}
