import { describe, expect, it } from 'vitest';
import { createIndexNowKeyRoute } from '../src/indexnow.js';
import { htmlFileToUrl, indexNowOnBranch } from '../src/integration.js';

const VALID_KEY = 'abcdef0123456789abcdef0123456789';

describe('createIndexNowKeyRoute', () => {
    it('serves the key as plain text with cache headers', async () => {
        const route = createIndexNowKeyRoute({ key: VALID_KEY });
        const res = await (route as () => Promise<Response>)();
        expect(await res.text()).toBe(VALID_KEY);
        expect(res.headers.get('Content-Type')).toBe('text/plain; charset=utf-8');
        expect(res.headers.get('Cache-Control')).toBe('public, max-age=86400');
    });

    it('omits Cache-Control when null', async () => {
        const route = createIndexNowKeyRoute({ key: VALID_KEY, cacheControl: null });
        const res = await (route as () => Promise<Response>)();
        expect(res.headers.get('Cache-Control')).toBeNull();
    });

    it('rejects invalid keys up front', () => {
        expect(() => createIndexNowKeyRoute({ key: 'nope' })).toThrow();
    });
});

describe('indexNowOnBranch', () => {
    const opts = { key: VALID_KEY, host: 'example.com', siteUrl: 'https://example.com' };

    it('returns options on the production branch', () => {
        expect(indexNowOnBranch('main', opts)).toBe(opts);
    });

    it('returns undefined on a non-production branch', () => {
        expect(indexNowOnBranch('feature/my-change', opts)).toBeUndefined();
    });

    it('returns undefined on an empty branch string', () => {
        expect(indexNowOnBranch('', opts)).toBeUndefined();
    });

    it('respects a custom productionBranch', () => {
        expect(indexNowOnBranch('master', opts, 'master')).toBe(opts);
        expect(indexNowOnBranch('main', opts, 'master')).toBeUndefined();
    });
});

describe('htmlFileToUrl', () => {
    it('rewrites index.html to trailing slash', () => {
        expect(htmlFileToUrl('blog/post/index.html', 'https://example.com')).toBe(
            'https://example.com/blog/post/',
        );
    });

    it('maps root index.html to /', () => {
        expect(htmlFileToUrl('index.html', 'https://example.com/')).toBe('https://example.com/');
    });

    it('strips .html on standalone files', () => {
        expect(htmlFileToUrl('about.html', 'https://example.com')).toBe(
            'https://example.com/about',
        );
    });

    it('tolerates Windows-style separators', () => {
        expect(htmlFileToUrl('blog\\post\\index.html', 'https://example.com')).toBe(
            'https://example.com/blog/post/',
        );
    });
});
