import { describe, expect, it } from 'vitest';
import { createSchemaEndpoint, createSchemaMap } from '../src/routes.js';
import type { APIContext, APIRoute } from 'astro';

// Minimal APIContext stub. The route handlers under test don't touch
// any of its fields, so passing `{}` cast is sufficient — but this
// helper documents intent and makes future expansion easier.
function fakeContext(): APIContext {
    return {} as APIContext;
}

async function invoke(route: APIRoute): Promise<Response> {
    const result = await route(fakeContext());
    if (!(result instanceof Response)) {
        throw new Error('route did not return a Response');
    }
    return result;
}

interface FakePost {
    id: string;
    data: { title: string; draft: boolean };
}

const posts: FakePost[] = [
    { id: 'first', data: { title: 'First Post', draft: false } },
    { id: 'second', data: { title: 'Second Post', draft: false } },
    { id: 'draft', data: { title: 'Draft Post', draft: true } },
];

describe('createSchemaEndpoint', () => {
    it('serves an @context / @graph JSON-LD response', async () => {
        const route = createSchemaEndpoint<FakePost>({
            entries: async () => posts.filter((p) => !p.data.draft),
            mapper: (post) => [
                {
                    '@type': 'Article',
                    '@id': `https://example.com/${post.id}/#article`,
                    headline: post.data.title,
                },
            ],
        });

        const response = await invoke(route);
        expect(response.status).toBe(200);
        expect(response.headers.get('Content-Type')).toBe('application/ld+json');
        expect(response.headers.get('X-Robots-Tag')).toBe('noindex');

        const body = await response.json();
        expect(body['@context']).toBe('https://schema.org');
        expect(body['@graph']).toHaveLength(2);
        expect(body['@graph'][0]['@id']).toBe('https://example.com/first/#article');
    });

    it('sets a default Cache-Control header', async () => {
        const route = createSchemaEndpoint<FakePost>({
            entries: async () => posts,
            mapper: () => [],
        });
        const response = await invoke(route);
        expect(response.headers.get('Cache-Control')).toBe('max-age=300');
    });

    it('allows a custom Cache-Control header', async () => {
        const route = createSchemaEndpoint<FakePost>({
            entries: async () => posts,
            mapper: () => [],
            cacheControl: 'max-age=3600, public',
        });
        const response = await invoke(route);
        expect(response.headers.get('Cache-Control')).toBe('max-age=3600, public');
    });

    it('omits Cache-Control when explicitly passed null', async () => {
        const route = createSchemaEndpoint<FakePost>({
            entries: async () => posts,
            mapper: () => [],
            cacheControl: null,
        });
        const response = await invoke(route);
        expect(response.headers.get('Cache-Control')).toBeNull();
    });

    it('filters entries via the caller-provided async source', async () => {
        const route = createSchemaEndpoint<FakePost>({
            entries: async () => posts.filter((p) => !p.data.draft),
            mapper: (post) => [
                {
                    '@type': 'Article',
                    '@id': `https://example.com/${post.id}/`,
                    headline: post.data.title,
                },
            ],
        });
        const body = await (await invoke(route)).json();
        const headlines = body['@graph'].map((e: { headline: string }) => e.headline);
        expect(headlines).toEqual(['First Post', 'Second Post']);
    });
});

describe('createSchemaMap', () => {
    it('emits a valid sitemap-style XML with a loc per entry', async () => {
        const route = createSchemaMap({
            siteUrl: 'https://example.com',
            entries: [
                {
                    path: '/schema/post.json',
                    lastModified: new Date('2026-04-07T12:00:00Z'),
                },
                {
                    path: '/schema/video.json',
                    lastModified: new Date('2026-03-13T00:00:00Z'),
                },
            ],
        });

        const response = await invoke(route);
        expect(response.headers.get('Content-Type')).toBe('application/xml');
        expect(response.headers.get('X-Robots-Tag')).toBe('noindex');

        const xml = await response.text();
        expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
        expect(xml).toContain('<loc>https://example.com/schema/post.json</loc>');
        expect(xml).toContain('<loc>https://example.com/schema/video.json</loc>');
        expect(xml).toContain('<lastmod>2026-04-07</lastmod>');
        expect(xml).toContain('<lastmod>2026-03-13</lastmod>');
        expect(xml).toContain('<changefreq>daily</changefreq>');
        expect(xml).toContain('<priority>0.8</priority>');
    });

    it('strips a trailing slash from siteUrl', async () => {
        const route = createSchemaMap({
            siteUrl: 'https://example.com/',
            entries: [{ path: '/schema/a.json', lastModified: new Date('2026-01-01') }],
        });
        const xml = await (await invoke(route)).text();
        expect(xml).toContain('<loc>https://example.com/schema/a.json</loc>');
    });

    it('inserts a leading slash when the path is missing one', async () => {
        const route = createSchemaMap({
            siteUrl: 'https://example.com',
            entries: [{ path: 'schema/a.json', lastModified: new Date('2026-01-01') }],
        });
        const xml = await (await invoke(route)).text();
        expect(xml).toContain('<loc>https://example.com/schema/a.json</loc>');
    });

    it('respects custom changefreq and priority', async () => {
        const route = createSchemaMap({
            siteUrl: 'https://example.com',
            entries: [
                {
                    path: '/schema/a.json',
                    lastModified: new Date('2026-01-01'),
                    changeFreq: 'weekly',
                    priority: 0.5,
                },
            ],
        });
        const xml = await (await invoke(route)).text();
        expect(xml).toContain('<changefreq>weekly</changefreq>');
        expect(xml).toContain('<priority>0.5</priority>');
    });

    it('XML-escapes special characters in the path', async () => {
        const route = createSchemaMap({
            siteUrl: 'https://example.com',
            entries: [
                {
                    path: '/schema/a&b<c>.json',
                    lastModified: new Date('2026-01-01'),
                },
            ],
        });
        const xml = await (await invoke(route)).text();
        expect(xml).toContain('<loc>https://example.com/schema/a&amp;b&lt;c&gt;.json</loc>');
    });
});
