const DEFAULT_BASE_URL = 'https://personal-feed.zhangyi2537.workers.dev';

function parseArgs(argv) {
    const args = {
        base: DEFAULT_BASE_URL,
        limit: 30,
        date: null,
        maxAttempts: 20,
        sleepMs: 15_000,
        noCache: true,
        dryRun: false,
        force: false,
    };

    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (a === '--base' && argv[i + 1]) args.base = argv[++i];
        else if (a === '--limit' && argv[i + 1]) args.limit = Number(argv[++i]);
        else if (a === '--date' && argv[i + 1]) args.date = argv[++i];
        else if (a === '--max-attempts' && argv[i + 1]) args.maxAttempts = Number(argv[++i]);
        else if (a === '--sleep-ms' && argv[i + 1]) args.sleepMs = Number(argv[++i]);
        else if (a === '--no-cache') args.noCache = true;
        else if (a === '--dry-run') args.dryRun = true;
        else if (a === '--force') args.force = true;
        else if (a === '--help' || a === '-h') return { ...args, help: true };
    }
    return args;
}

function shanghaiDateISO(date = new Date()) {
    const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Shanghai',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    });
    return formatter.format(date);
}

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function asString(x) {
    return typeof x === 'string' ? x : '';
}

function isCompleteItem(item) {
    if (!item || item.status !== 'ok') return false;
    if (!asString(item.summary_short)) return false;
    if (!asString(item.summary_long)) return false;
    if (!asString(item.recommend_reason)) return false;
    if (typeof item.global_score !== 'number') return false;
    return true;
}

function stats(feed) {
    const items = Array.isArray(feed?.items) ? feed.items : [];
    const total = Number(feed?.count ?? items.length) || items.length;
    const ok = items.filter((i) => i?.status === 'ok').length;
    const errors = items.filter((i) => i?.status !== 'ok').length;
    const complete = items.filter(isCompleteItem).length;
    return { total, ok, errors, complete };
}

async function getJson(url) {
    const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
    const text = await res.text();
    if (!res.ok) {
        throw new Error(`HTTP ${res.status} ${res.statusText}: ${text.slice(0, 200)}`);
    }
    try {
        return JSON.parse(text);
    } catch {
        throw new Error(`Invalid JSON: ${text.slice(0, 200)}`);
    }
}

async function postJson(url, body) {
    const res = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
        },
        body: JSON.stringify(body),
    });
    const text = await res.text();
    if (!res.ok) {
        throw new Error(`HTTP ${res.status} ${res.statusText}: ${text.slice(0, 200)}`);
    }
    try {
        return JSON.parse(text);
    } catch {
        throw new Error(`Invalid JSON: ${text.slice(0, 200)}`);
    }
}

async function main() {
    const args = parseArgs(process.argv.slice(2));
    if (args.help) {
        console.log(`Usage:
  node scripts/refresh_until_complete.mjs [options]

Options:
  --base <url>           Worker base URL (default: ${DEFAULT_BASE_URL})
  --date <YYYY-MM-DD>    Target date (default: Shanghai today)
  --limit <n>            HN limit per refresh (default: 30)
  --max-attempts <n>     Max refresh attempts (default: 20)
  --sleep-ms <ms>        Sleep between attempts (default: 15000)
  --force                Force re-run (will reprocess even ok items)
  --dry-run              Only print current status, do not call refresh
  --help, -h             Show help
`);
        process.exit(0);
    }

    if (!Number.isFinite(args.limit) || args.limit <= 0) throw new Error('--limit must be a positive number');
    if (!Number.isFinite(args.maxAttempts) || args.maxAttempts <= 0) throw new Error('--max-attempts must be a positive number');
    if (!Number.isFinite(args.sleepMs) || args.sleepMs < 0) throw new Error('--sleep-ms must be >= 0');

    const date = args.date || shanghaiDateISO(new Date());
    const qs = args.noCache ? '&no_cache=1' : '';
    const feedUrl = `${args.base.replace(/\/$/, '')}/api/feed?date=${encodeURIComponent(date)}${qs}`;
    const refreshUrl = `${args.base.replace(/\/$/, '')}/api/admin/refresh`;

    console.log(`[target] base=${args.base} date=${date} limit=${args.limit} force=${args.force} dryRun=${args.dryRun}`);

    for (let attempt = 1; attempt <= args.maxAttempts; attempt++) {
        const feed = await getJson(feedUrl);
        const s = stats(feed);
        console.log(`[status] attempt=${attempt}/${args.maxAttempts} total=${s.total} ok=${s.ok} complete=${s.complete} errors=${s.errors}`);

        if (s.total > 0 && s.complete === s.total) {
            console.log('[done] all items complete');
            return;
        }

        if (args.dryRun) {
            console.log('[dry-run] stop without calling refresh');
            return;
        }

        const refresh = await postJson(refreshUrl, { limit: args.limit, force: args.force });
        console.log(`[refresh] ok=${refresh?.ok} date=${refresh?.date} ingested=${refresh?.ingested} failed=${refresh?.failed}`);

        if (attempt < args.maxAttempts && args.sleepMs > 0) {
            await sleep(args.sleepMs);
        }
    }

    throw new Error('Reached max attempts, still not complete');
}

main().catch((e) => {
    console.error(`[error] ${e?.message || String(e)}`);
    process.exit(1);
});

