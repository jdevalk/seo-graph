import { describe, expect, it } from 'vitest';
import {
    buildUrlManifest,
    changedUrls,
    diffManifests,
    hashContent,
    parseManifest,
    serializeManifest,
    MANIFEST_VERSION,
    DEFAULT_HASH_ALGORITHM,
} from '../src/indexnow-manifest.js';

describe('hashContent', () => {
    it('is stable and content-sensitive', () => {
        expect(hashContent('abc')).toBe(hashContent('abc'));
        expect(hashContent('abc')).not.toBe(hashContent('abd'));
    });

    it('returns a 16-char hex string', () => {
        expect(hashContent('hello world')).toMatch(/^[0-9a-f]{16}$/);
    });
});

describe('buildUrlManifest', () => {
    it('maps each url to its content hash', () => {
        const manifest = buildUrlManifest([
            { url: 'https://x.com/a/', content: 'A' },
            { url: 'https://x.com/b/', content: 'B' },
        ]);
        expect(manifest['https://x.com/a/']).toBe(hashContent('A'));
        expect(manifest['https://x.com/b/']).toBe(hashContent('B'));
    });

    it('supports a custom hash for normalizing volatile markup', () => {
        const stripNonce = (html: string) => hashContent(html.replace(/nonce="[^"]*"/g, ''));
        const a = buildUrlManifest([{ url: '/p/', content: '<x nonce="111">hi</x>' }], stripNonce);
        const b = buildUrlManifest([{ url: '/p/', content: '<x nonce="222">hi</x>' }], stripNonce);
        expect(a['/p/']).toBe(b['/p/']);
    });
});

describe('diffManifests', () => {
    it('classifies added, updated, and deleted, sorted', () => {
        const prev = { '/keep/': 'h1', '/change/': 'h2', '/gone/': 'h3' };
        const curr = { '/keep/': 'h1', '/change/': 'h2-new', '/new/': 'h4' };
        expect(diffManifests(prev, curr)).toEqual({
            added: ['/new/'],
            updated: ['/change/'],
            deleted: ['/gone/'],
        });
    });

    it('treats an empty previous manifest as all-added (first run)', () => {
        const curr = { '/b/': 'h', '/a/': 'h' };
        const diff = diffManifests({}, curr);
        expect(diff.added).toEqual(['/a/', '/b/']);
        expect(diff.updated).toEqual([]);
        expect(diff.deleted).toEqual([]);
    });

    it('reports no changes when manifests match', () => {
        const m = { '/a/': 'h1', '/b/': 'h2' };
        expect(changedUrls(diffManifests(m, { ...m }))).toEqual([]);
    });
});

describe('changedUrls', () => {
    it('concatenates added, updated, and deleted', () => {
        expect(changedUrls({ added: ['/a/'], updated: ['/b/'], deleted: ['/c/'] })).toEqual([
            '/a/',
            '/b/',
            '/c/',
        ]);
    });
});

describe('serializeManifest / parseManifest', () => {
    it('round-trips a manifest', () => {
        const urls = { '/a/': 'h1', '/b/': 'h2' };
        expect(parseManifest(serializeManifest(urls))).toEqual(urls);
    });

    it('serializes with sorted keys and a version + algorithm header', () => {
        const json = serializeManifest({ '/b/': 'h2', '/a/': 'h1' });
        const parsed = JSON.parse(json);
        expect(parsed.version).toBe(MANIFEST_VERSION);
        expect(parsed.algorithm).toBe(DEFAULT_HASH_ALGORITHM);
        expect(Object.keys(parsed.urls)).toEqual(['/a/', '/b/']);
    });

    it('returns null for missing, malformed, or non-manifest input', () => {
        expect(parseManifest(null)).toBeNull();
        expect(parseManifest('')).toBeNull();
        expect(parseManifest('not json')).toBeNull();
        expect(parseManifest('"a string"')).toBeNull();
        expect(parseManifest('{"version":1}')).toBeNull();
    });

    it('ignores non-string hash values when parsing', () => {
        expect(parseManifest('{"urls":{"/a/":"h1","/b/":123}}')).toEqual({ '/a/': 'h1' });
    });
});
