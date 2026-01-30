import { Env } from './env';
import { FeedResponse, HealthResponse, RefreshResponse } from './types';
import { getItemsByDate } from './db';
import { runIngest } from './ingest';
import { getShanghaiDateISO, jsonResponse } from './utils';

const VERSION = '1.0.0';

export default {
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    console.log(`Cron triggered at ${new Date().toISOString()}`);
    ctx.waitUntil(
      runIngest(env).then((result) => {
        console.log(`Scheduled ingest complete: ${result.ingested} ingested, ${result.failed} failed`);
      })
    );
  },

  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    const noCache = url.searchParams.has('no_cache') || url.searchParams.has('noCache');

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
      });
    }

    // Route: GET /api/health
    if (path === '/api/health' && request.method === 'GET') {
      const response: HealthResponse = {
        version: VERSION,
        timestamp: new Date().toISOString(),
      };
      return jsonResponse(response);
    }

    // Route: GET /api/feed/today
    if (path === '/api/feed/today' && request.method === 'GET') {
      const date = getShanghaiDateISO();
      const items = await getItemsByDate(env.daily_feed_db, date);
      const response: FeedResponse = {
        date,
        count: items.length,
        items,
      };
      return jsonResponse(response, 200, noCache ? 0 : 300); // Cache 5 minutes
    }

    // Route: GET /api/feed?date=YYYY-MM-DD
    if (path === '/api/feed' && request.method === 'GET') {
      const dateParam = url.searchParams.get('date');
      if (!dateParam || !/^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
        return jsonResponse({ error: 'Invalid date format. Use YYYY-MM-DD' }, 400);
      }
      const items = await getItemsByDate(env.daily_feed_db, dateParam);
      const today = getShanghaiDateISO();
      const response: FeedResponse = {
        date: dateParam,
        count: items.length,
        items,
      };
      const cacheSeconds = dateParam === today ? 300 : 3600;
      return jsonResponse(response, 200, noCache ? 0 : cacheSeconds);
    }

    // Route: POST /api/admin/refresh
    if (path === '/api/admin/refresh' && request.method === 'POST') {
      let limit: number | undefined;
      let force = false;

      try {
        const body = await request.json() as { limit?: number; force?: boolean };
        if (body.limit && typeof body.limit === 'number') {
          limit = body.limit;
        }
        if (typeof body.force === 'boolean') {
          force = body.force;
        }
      } catch {
        // No body or invalid JSON, use default limit
      }

      const result = await runIngest(env, limit, { force });
      const response: RefreshResponse = {
        ok: result.failed === 0,
        date: result.date,
        ingested: result.ingested,
        failed: result.failed,
      };
      return jsonResponse(response);
    }

    // 404 for unknown routes
    return jsonResponse({ error: 'Not found' }, 404);
  },
};
