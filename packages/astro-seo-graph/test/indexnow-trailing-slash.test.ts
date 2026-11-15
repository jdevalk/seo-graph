import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import seoGraph, { applyTrailingSlash } from '../src/integration.js';

const SITE = 'https://example.com';

describe('applyTrailingSlash', () => {
    it("strips the trailing slash for 'never', except on the root", () => {
        expect(applyTrailingSlash(`${SITE}/web/page/`, 'never')).toBe(`${SITE}/web/page`);
        expect(applyTrailingSlash(`${SITE}/`, 'never')).toBe(`${SITE}/`);
    });

    it("adds a trailing slash for 'always'", () => {
        expect(applyTrailingSlash(`${SITE}/about`, 'always')).toBe(`${SITE}/about/`);
        expect(applyTrailingSlash(`${SITE}/about/`, 'always')).toBe(`${SITE}/about/`);
        expect(applyTrailingSlash(`${SITE}/`, 'always')).toBe(`${SITE}/`);
    });

    it("leaves the URL as built for 'ignore' or no setting", () => {
        expect(applyTrailingSlash(`${SITE}/about/`, 'ignore')).toBe(`${SITE}/about/`);
        expect(applyTrailingSlash(`${SITE}/about`, undefined)).toBe(`${SITE}/about`);
    });
});

describe('IndexNow submission and Astro trailingSlash', () => {
    let dir: string;
    const logger = { info: vi.fn(), warn: vi.fn() };

    beforeEach(() => {
        dir = mkdtempSync(join(tmpdir(), 'indexnow-trailing-slash-'));
        writeFileSync(join(dir, 'index.html'), '<h1>Home</h1>');
        mkdirSync(join(dir, 'web', 'page'), { recursive: true });
        writeFileSync(join(dir, 'web', 'page', 'index.html'), '<h1>Page</h1>');
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        rmSync(dir, { recursive: true, force: true });
    });

    async function submittedUrls(trailingSlash?: 'always' | 'never' | 'ignore') {
        const fetchMock = vi.fn(
            async (_input: string | URL | Request, _init?: RequestInit) =>
                new Response('', { status: 200 }),
        );
        vi.stubGlobal('fetch', fetchMock);
        const integration = seoGraph({
            validateH1: false,
            validateUniqueMetadata: false,
            validateImageAlt: false,
            validateMetadataLength: false,
            validateInternalLinks: false,
            indexNow: { key: 'abcdef0123456789', host: 'example.com', siteUrl: SITE },
        });
        integration.hooks['astro:config:setup']!({
            config: { site: SITE, trailingSlash },
            updateConfig: () => {},
        });
        await integration.hooks['astro:build:done']!({ dir: pathToFileURL(dir + '/'), logger });
        const body = JSON.parse(String(fetchMock.mock.calls[0]![1]?.body));
        return (body.urlList as string[]).sort();
    }

    it("submits URLs without a trailing slash when trailingSlash is 'never'", async () => {
        expect(await submittedUrls('never')).toEqual([`${SITE}/`, `${SITE}/web/page`]);
    });

    it("keeps the directory form when trailingSlash is 'always'", async () => {
        expect(await submittedUrls('always')).toEqual([`${SITE}/`, `${SITE}/web/page/`]);
    });

    it('keeps the built form when trailingSlash is not set', async () => {
        expect(await submittedUrls()).toEqual([`${SITE}/`, `${SITE}/web/page/`]);
    });
});
