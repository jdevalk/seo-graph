// IndexNow protocol support. Submits URLs to participating search engines
// (Bing, Yandex, Seznam, Naver, Yep) through the neutral aggregator
// endpoint at api.indexnow.org. Spec: https://www.indexnow.org/documentation

/** Default aggregator endpoint. Fans out to every participating engine. */
export const DEFAULT_INDEXNOW_ENDPOINT = 'https://api.indexnow.org/IndexNow';

/** IndexNow accepts up to 10,000 URLs per bulk request. */
export const INDEXNOW_MAX_URLS_PER_REQUEST = 10_000;

/** Key length constraints per the spec. */
const MIN_KEY_LENGTH = 8;
const MAX_KEY_LENGTH = 128;
// Per the IndexNow spec the key may contain [A-Za-z0-9-]. The wording at
// indexnow.org calls these "hexadecimal characters" but the explicit
// allow-list is the broader set, and Bing / Yandex both issue and accept
// non-hex keys (Yandex's own docs use a mixed-case example).
// Refs: https://www.indexnow.org/documentation
//       https://yandex.com/support/webmaster/en/indexnow/key
const KEY_RE = /^[A-Za-z0-9-]+$/;

export interface SubmitToIndexNowOptions {
    /** Bare host, e.g. `example.com`. No scheme, no trailing slash. */
    host: string;
    /** 8–128 character key from `[A-Za-z0-9-]`. Must match the key file served on the host. */
    key: string;
    /**
     * Optional absolute URL where the key file is hosted. Defaults to
     * `https://<host>/<key>.txt`. Supply this when the key file lives at
     * a non-default path.
     */
    keyLocation?: string;
    /** URLs to submit. Must all be on `host`. Empty list is a no-op. */
    urls: readonly string[];
    /** Override the endpoint. Defaults to {@link DEFAULT_INDEXNOW_ENDPOINT}. */
    endpoint?: string;
    /** Injectable fetch for testing. Defaults to global `fetch`. */
    fetch?: typeof fetch;
}

export interface IndexNowSubmitResult {
    /** HTTP status from the IndexNow server. `0` when the request failed. */
    status: number;
    /** Whether the submission was accepted (200 or 202). */
    ok: boolean;
    /** Response body text if any, or error message on network failure. */
    message: string;
    /** Number of URLs actually submitted after filtering/dedup. */
    submitted: number;
}

/**
 * Submit URLs to IndexNow. Filters out URLs not on `host`, deduplicates,
 * and chunks at {@link INDEXNOW_MAX_URLS_PER_REQUEST}. Returns one result
 * per chunk; a single-chunk submission returns a one-element array.
 */
export async function submitToIndexNow(
    options: SubmitToIndexNowOptions,
): Promise<IndexNowSubmitResult[]> {
    const { host, key, urls } = options;
    if (!validateIndexNowKey(key)) {
        throw new Error(
            `IndexNow key must be ${MIN_KEY_LENGTH}–${MAX_KEY_LENGTH} characters from [A-Za-z0-9-].`,
        );
    }
    if (!host || host.includes('/') || host.includes(':')) {
        throw new Error(`IndexNow host must be a bare host (got: ${host}).`);
    }

    const filtered = filterUrlsForHost(urls, host);
    if (filtered.length === 0) return [];

    const endpoint = options.endpoint ?? DEFAULT_INDEXNOW_ENDPOINT;
    const keyLocation = options.keyLocation ?? `https://${host}/${key}.txt`;
    const doFetch = options.fetch ?? fetch;

    const results: IndexNowSubmitResult[] = [];
    for (let i = 0; i < filtered.length; i += INDEXNOW_MAX_URLS_PER_REQUEST) {
        const chunk = filtered.slice(i, i + INDEXNOW_MAX_URLS_PER_REQUEST);
        const body = JSON.stringify({ host, key, keyLocation, urlList: chunk });
        try {
            const res = await doFetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json; charset=utf-8',
                    Accept: 'application/json',
                },
                body,
            });
            const text = await res.text().catch(() => '');
            results.push({
                status: res.status,
                ok: res.status === 200 || res.status === 202,
                message: text,
                submitted: chunk.length,
            });
        } catch (err) {
            results.push({
                status: 0,
                ok: false,
                message: err instanceof Error ? err.message : String(err),
                submitted: chunk.length,
            });
        }
    }
    return results;
}

/**
 * Keep only URLs whose hostname matches `host` (case-insensitive) and
 * deduplicate while preserving first-seen order.
 */
function filterUrlsForHost(urls: readonly string[], host: string): string[] {
    const lowerHost = host.toLowerCase();
    const seen = new Set<string>();
    const out: string[] = [];
    for (const raw of urls) {
        let parsed: URL;
        try {
            parsed = new URL(raw);
        } catch {
            continue;
        }
        if (parsed.hostname.toLowerCase() !== lowerHost) continue;
        const normalized = parsed.toString();
        if (seen.has(normalized)) continue;
        seen.add(normalized);
        out.push(normalized);
    }
    return out;
}

/** Returns true when `key` is 8–128 characters drawn from `[A-Za-z0-9-]`. */
export function validateIndexNowKey(key: string): boolean {
    if (typeof key !== 'string') return false;
    if (key.length < MIN_KEY_LENGTH || key.length > MAX_KEY_LENGTH) return false;
    return KEY_RE.test(key);
}

/**
 * Generate a cryptographically random IndexNow key of `length` hex
 * characters. Default 32. Uses Web Crypto, available in Node 20+,
 * browsers, and edge/worker runtimes.
 */
export function generateIndexNowKey(length = 32): string {
    if (length < MIN_KEY_LENGTH || length > MAX_KEY_LENGTH || length % 2 !== 0) {
        throw new Error(
            `IndexNow key length must be an even number between ${MIN_KEY_LENGTH} and ${MAX_KEY_LENGTH}.`,
        );
    }
    const bytes = new Uint8Array(length / 2);
    crypto.getRandomValues(bytes);
    let hex = '';
    for (const b of bytes) hex += b.toString(16).padStart(2, '0');
    return hex;
}

/**
 * Plain-text body to serve at `https://<host>/<key>.txt`. IndexNow
 * verifies ownership by fetching this file and comparing to the
 * submitted key.
 */
export function getIndexNowKeyFileContent(key: string): string {
    if (!validateIndexNowKey(key)) {
        throw new Error(
            `IndexNow key must be ${MIN_KEY_LENGTH}–${MAX_KEY_LENGTH} characters from [A-Za-z0-9-].`,
        );
    }
    return key;
}
