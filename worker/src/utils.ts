// Get current date in Shanghai timezone (YYYY-MM-DD)
export function getShanghaiDateISO(date: Date = new Date()): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(date);
}

// Get current ISO timestamp
export function getISOTimestamp(): string {
  return new Date().toISOString();
}

// Truncate text to max characters
export function truncateText(text: string, maxChars: number): string {
  if (text.length <= maxChars) {
    return text;
  }
  return text.slice(0, maxChars) + '...';
}

// Extract domain from URL
export function extractDomain(url: string): string | null {
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

// Fetch with timeout
export async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs: number = 30000
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

// Sleep helper
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// JSON response helper
export function jsonResponse(data: unknown, status: number = 200, cacheSeconds: number = 0): Response {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  };
  if (cacheSeconds > 0) {
    headers['Cache-Control'] = `public, max-age=${cacheSeconds}`;
  }
  return new Response(JSON.stringify(data), {
    status,
    headers,
  });
}
