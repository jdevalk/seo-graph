import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import seoGraph from '../src/integration.js';
import { parseManifest, serializeManifest } from '../src/indexnow-manifest.js';

const SITE = 'https://example.com';
const MANIFEST_URL = `${SITE}/indexnow-manifest.json`;

const logger = { info: vi.fn(), warn: vi.fn() };

function integration(incremental: true | { onError: 'full' } = true) {
    return seoGraph({
        validateH1: false,
        validateUniqueMetadata: false,
        validateImageAlt: false,
        validateMetadataLength: false,
        validateInternalLinks: false,
        indexNow: {
            key: 'abcdef0123456789',
            host: 'example.com',
            siteUrl: SITE,
            incremental,
        },
    });
}

/**
 * Stub global fetch: the previous-manifest GET answers with `previous`
 * (404 when null, 500 when 'error'), the IndexNow POST answers with
 * `indexNowStatus`.
 */
function stubFetch(previous: Record<string, string> | null | 'error', indexNowStatus: number) {
    const fetchMock = vi.fn(async (input: string | URL | Request, _init?: RequestInit) => {
        const url = typeof input === 'string' ? input : input.toString();
        if (url === MANIFEST_URL) {
            if (previous === 'error') return new Response('', { status: 500 });
            return previous === null
                ? new Response('', { status: 404 })
                : new Response(serializeManifest(previous), { status: 200 });
        }
        return new Response('', { status: indexNowStatus });
    });
    vi.stubGlobal('fetch', fetchMock);
    return fetchMock;
}

describe('incremental IndexNow manifest', () => {
    let dir: string;

    beforeEach(() => {
        dir = mkdtempSync(join(tmpdir(), 'indexnow-incremental-'));
        writeFileSync(join(dir, 'index.html'), '<h1>Home</h1>');
        mkdirSync(join(dir, 'about'));
        writeFileSync(join(dir, 'about', 'index.html'), '<h1>About, new copy</h1>');
        logger.info.mockClear();
        logger.warn.mockClear();
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        rmSync(dir, { recursive: true, force: true });
    });

    async function build(incremental: true | { onError: 'full' } = true) {
        await integration(incremental).hooks['astro:build:done']!({
            dir: pathToFileURL(dir + '/'),
            logger,
        });
    }

    function publishedManifest() {
        return parseManifest(readFileSync(join(dir, 'indexnow-manifest.json'), 'utf8'));
    }

    it('publishes the new manifest when the submission succeeds', async () => {
        const previous = { [`${SITE}/`]: 'stale-home', [`${SITE}/about/`]: 'stale-about' };
        stubFetch(previous, 200);
        await build();
        const published = publishedManifest();
        expect(published).not.toEqual(previous);
        expect(Object.keys(published!).sort()).toEqual([`${SITE}/`, `${SITE}/about/`]);
    });

    it('keeps the previous manifest when the submission is refused', async () => {
        const previous = { [`${SITE}/`]: 'stale-home', [`${SITE}/about/`]: 'stale-about' };
        stubFetch(previous, 403);
        await build();
        expect(publishedManifest()).toEqual(previous);
    });

    it('resubmits the same URLs on the next build after a refused submission', async () => {
        const previous = { [`${SITE}/`]: 'stale-home', [`${SITE}/about/`]: 'stale-about' };
        stubFetch(previous, 403);
        await build();

        const fetchMock = stubFetch(publishedManifest(), 200);
        await build();
        const post = fetchMock.mock.calls.find(([url]) => String(url) !== MANIFEST_URL);
        const body = JSON.parse(String(post![1]?.body));
        expect(body.urlList.sort()).toEqual([`${SITE}/`, `${SITE}/about/`]);
    });

    it('publishes an empty baseline when the first submission is refused', async () => {
        stubFetch(null, 403);
        await build();
        expect(publishedManifest()).toEqual({});
    });

    it("publishes no manifest when onError 'full' falls back and is refused", async () => {
        stubFetch('error', 403);
        await build({ onError: 'full' });
        expect(existsSync(join(dir, 'indexnow-manifest.json'))).toBe(false);
    });

    it("still publishes the new manifest when onError 'skip' skips the submission", async () => {
        const fetchMock = stubFetch('error', 200);
        await build();
        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(Object.keys(publishedManifest()!).sort()).toEqual([`${SITE}/`, `${SITE}/about/`]);
    });
});
