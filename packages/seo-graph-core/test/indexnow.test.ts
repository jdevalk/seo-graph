import { describe, it, expect, vi } from 'vitest';
import {
    submitToIndexNow,
    validateIndexNowKey,
    generateIndexNowKey,
    getIndexNowKeyFileContent,
    DEFAULT_INDEXNOW_ENDPOINT,
    INDEXNOW_MAX_URLS_PER_REQUEST,
} from '../src/indexnow.js';

describe('validateIndexNowKey', () => {
    it('accepts 8–128 characters from [A-Za-z0-9-]', () => {
        expect(validateIndexNowKey('a'.repeat(8))).toBe(true);
        expect(validateIndexNowKey('f'.repeat(128))).toBe(true);
        expect(validateIndexNowKey('ABCDEF0123456789')).toBe(true);
    });

    it('accepts non-hex keys per the IndexNow spec', () => {
        // Ahrefs Site Audit-issued key (mixed letters past f, some digits).
        expect(validateIndexNowKey('f37uz8z9ffyjaa42pbnbqyn95qvbz4jz')).toBe(true);
        // Yandex Webmaster docs example (mixed case).
        expect(validateIndexNowKey('EdD8dkmdNLlxREi2LkhJjYOH2kyQbJqM3cBKT5fX')).toBe(true);
        // Dashes are allowed.
        expect(validateIndexNowKey('abc-def-ghi-jkl')).toBe(true);
    });

    it('rejects keys that are too short, too long, or empty', () => {
        expect(validateIndexNowKey('a'.repeat(7))).toBe(false);
        expect(validateIndexNowKey('a'.repeat(129))).toBe(false);
        expect(validateIndexNowKey('')).toBe(false);
    });

    it('rejects characters outside [A-Za-z0-9-]', () => {
        expect(validateIndexNowKey('underscore_chars')).toBe(false);
        expect(validateIndexNowKey('has spaces here ')).toBe(false);
        expect(validateIndexNowKey('special!@chars')).toBe(false);
        expect(validateIndexNowKey('dotted.key.value')).toBe(false);
    });
});

describe('generateIndexNowKey', () => {
    it('returns hex of requested length', () => {
        const key = generateIndexNowKey(32);
        expect(key).toHaveLength(32);
        expect(validateIndexNowKey(key)).toBe(true);
    });

    it('generates unique values', () => {
        const a = generateIndexNowKey();
        const b = generateIndexNowKey();
        expect(a).not.toBe(b);
    });

    it('rejects invalid lengths', () => {
        expect(() => generateIndexNowKey(7)).toThrow();
        expect(() => generateIndexNowKey(9)).toThrow();
        expect(() => generateIndexNowKey(200)).toThrow();
    });
});

describe('getIndexNowKeyFileContent', () => {
    it('returns the key verbatim', () => {
        const key = 'abcdef0123456789';
        expect(getIndexNowKeyFileContent(key)).toBe(key);
    });

    it('throws on invalid keys', () => {
        expect(() => getIndexNowKeyFileContent('nope')).toThrow();
    });
});

describe('submitToIndexNow', () => {
    const key = 'abcdef0123456789abcdef0123456789';

    function mockFetch(status = 200, body = 'OK') {
        return vi.fn(async () => new Response(body, { status })) as unknown as typeof fetch;
    }

    it('POSTs to the default endpoint with correct body', async () => {
        const fetchMock = mockFetch(200);
        const results = await submitToIndexNow({
            host: 'example.com',
            key,
            urls: ['https://example.com/a', 'https://example.com/b'],
            fetch: fetchMock,
        });

        expect(fetchMock).toHaveBeenCalledTimes(1);
        const call = (fetchMock as unknown as ReturnType<typeof vi.fn>).mock.calls[0]!;
        const url = call[0];
        const init = call[1] as RequestInit;
        expect(url).toBe(DEFAULT_INDEXNOW_ENDPOINT);
        expect(init.method).toBe('POST');
        const parsed = JSON.parse(init.body as string);
        expect(parsed).toEqual({
            host: 'example.com',
            key,
            keyLocation: `https://example.com/${key}.txt`,
            urlList: ['https://example.com/a', 'https://example.com/b'],
        });
        expect(results).toEqual([{ status: 200, ok: true, message: 'OK', submitted: 2 }]);
    });

    it('filters out URLs not on the host and deduplicates', async () => {
        const fetchMock = mockFetch(202, '');
        const results = await submitToIndexNow({
            host: 'example.com',
            key,
            urls: [
                'https://example.com/a',
                'https://other.com/b',
                'https://example.com/a',
                'not-a-url',
                'https://EXAMPLE.com/c',
            ],
            fetch: fetchMock,
        });
        const call = (fetchMock as unknown as ReturnType<typeof vi.fn>).mock.calls[0]!;
        const parsed = JSON.parse((call[1] as RequestInit).body as string);
        expect(parsed.urlList).toHaveLength(2);
        expect(parsed.urlList[0]).toBe('https://example.com/a');
        expect(results[0]!.ok).toBe(true);
        expect(results[0]!.status).toBe(202);
    });

    it('returns empty array and does not fetch when no URLs match host', async () => {
        const fetchMock = mockFetch();
        const results = await submitToIndexNow({
            host: 'example.com',
            key,
            urls: ['https://other.com/a'],
            fetch: fetchMock,
        });
        expect(fetchMock).not.toHaveBeenCalled();
        expect(results).toEqual([]);
    });

    it('chunks at INDEXNOW_MAX_URLS_PER_REQUEST', async () => {
        const fetchMock = mockFetch();
        const urls = Array.from(
            { length: INDEXNOW_MAX_URLS_PER_REQUEST + 5 },
            (_, i) => `https://example.com/p${i}`,
        );
        const results = await submitToIndexNow({
            host: 'example.com',
            key,
            urls,
            fetch: fetchMock,
        });
        expect(fetchMock).toHaveBeenCalledTimes(2);
        expect(results[0]!.submitted).toBe(INDEXNOW_MAX_URLS_PER_REQUEST);
        expect(results[1]!.submitted).toBe(5);
    });

    it('supports a custom endpoint and keyLocation', async () => {
        const fetchMock = mockFetch();
        await submitToIndexNow({
            host: 'example.com',
            key,
            urls: ['https://example.com/a'],
            endpoint: 'https://www.bing.com/indexnow',
            keyLocation: 'https://example.com/.well-known/indexnow.txt',
            fetch: fetchMock,
        });
        const call = (fetchMock as unknown as ReturnType<typeof vi.fn>).mock.calls[0]!;
        expect(call[0]).toBe('https://www.bing.com/indexnow');
        const body = JSON.parse((call[1] as RequestInit).body as string);
        expect(body.keyLocation).toBe('https://example.com/.well-known/indexnow.txt');
    });

    it('captures network errors without throwing', async () => {
        const fetchMock = vi.fn(async () => {
            throw new Error('boom');
        }) as unknown as typeof fetch;
        const results = await submitToIndexNow({
            host: 'example.com',
            key,
            urls: ['https://example.com/a'],
            fetch: fetchMock,
        });
        expect(results[0]).toEqual({
            status: 0,
            ok: false,
            message: 'boom',
            submitted: 1,
        });
    });

    it('throws on invalid key', async () => {
        await expect(
            submitToIndexNow({
                host: 'example.com',
                key: 'nope',
                urls: ['https://example.com/a'],
            }),
        ).rejects.toThrow();
    });

    it('throws on non-bare host', async () => {
        await expect(
            submitToIndexNow({
                host: 'https://example.com',
                key,
                urls: ['https://example.com/a'],
            }),
        ).rejects.toThrow();
    });
});
