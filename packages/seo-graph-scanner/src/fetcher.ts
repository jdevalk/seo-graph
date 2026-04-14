import PQueue from 'p-queue';

export interface FetchOptions {
    /** Max concurrent requests. Defaults to 4. */
    concurrency?: number;
    /** Minimum gap between requests per host, in ms. Defaults to 250. */
    intervalMs?: number;
    /** User-Agent header. Defaults to a seo-graph-scanner identifier. */
    userAgent?: string;
    /** Request timeout in ms. Defaults to 15_000. */
    timeout?: number;
}

export interface FetchResult {
    url: string;
    status: number;
    html?: string;
    error?: string;
}

const DEFAULT_UA = 'seo-graph-scanner/0.0.1 (+https://github.com/jdevalk/seo-graph)';

/**
 * Polite, throttled HTML fetcher. Uses p-queue for concurrency and
 * interval control; returns one FetchResult per URL regardless of
 * outcome so the caller can report failures.
 */
export async function fetchHtml(
    urls: readonly string[],
    options: FetchOptions = {},
): Promise<FetchResult[]> {
    const queue = new PQueue({
        concurrency: options.concurrency ?? 4,
        interval: options.intervalMs ?? 250,
        intervalCap: 1,
    });

    const userAgent = options.userAgent ?? DEFAULT_UA;
    const timeout = options.timeout ?? 15_000;

    const tasks = urls.map((url) =>
        queue.add(async (): Promise<FetchResult> => {
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), timeout);
            try {
                const res = await fetch(url, {
                    headers: { 'user-agent': userAgent, accept: 'text/html,*/*' },
                    signal: controller.signal,
                    redirect: 'follow',
                });
                const html = res.ok ? await res.text() : undefined;
                return { url, status: res.status, html };
            } catch (err) {
                return {
                    url,
                    status: 0,
                    error: err instanceof Error ? err.message : String(err),
                };
            } finally {
                clearTimeout(timer);
            }
        }),
    );

    const results = await Promise.all(tasks);
    return results.filter((r): r is FetchResult => r !== undefined);
}
