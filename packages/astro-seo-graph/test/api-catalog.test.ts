import { describe, expect, it } from 'vitest';
import type { APIContext, APIRoute } from 'astro';
import { CATALOG_PATH, createApiCatalog } from '../src/api-catalog.js';

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

interface LinksetEntry {
    anchor: string;
    'service-doc'?: { href: string }[];
    type?: { href: string }[];
}

async function readLinkset(route: APIRoute): Promise<LinksetEntry[]> {
    const body = await (await invoke(route)).json();
    return body.linkset as LinksetEntry[];
}

describe('createApiCatalog', () => {
    it('exports the standard RFC 9727 path constant', () => {
        expect(CATALOG_PATH).toBe('/.well-known/api-catalog');
    });

    it('emits schema.org type URLs for schema endpoints', async () => {
        const route = createApiCatalog({
            siteUrl: 'https://example.com',
            schemaEndpoints: [
                { path: '/schema/post.json', schemaType: 'BlogPosting' },
                { path: '/schema/video.json', schemaType: 'VideoObject' },
            ],
        });
        const linkset = await readLinkset(route);
        expect(linkset).toEqual([
            {
                anchor: 'https://example.com/schema/post.json',
                type: [{ href: 'https://schema.org/BlogPosting' }],
            },
            {
                anchor: 'https://example.com/schema/video.json',
                type: [{ href: 'https://schema.org/VideoObject' }],
            },
        ]);
    });

    it('emits the schema map without a type field', async () => {
        const route = createApiCatalog({
            siteUrl: 'https://example.com',
            schemaMap: { path: '/schemamap.xml', serviceDoc: '/seo-graph/' },
        });
        const linkset = await readLinkset(route);
        expect(linkset).toEqual([
            {
                anchor: 'https://example.com/schemamap.xml',
                'service-doc': [{ href: 'https://example.com/seo-graph/' }],
            },
        ]);
        expect(linkset[0]).not.toHaveProperty('type');
    });

    it('absolutizes relative anchor / serviceDoc / type in additional entries', async () => {
        const route = createApiCatalog({
            siteUrl: 'https://example.com',
            additional: [
                {
                    anchor: '/ask',
                    serviceDoc: '/ask-docs/',
                    type: '/types/SearchAction',
                },
            ],
        });
        const linkset = await readLinkset(route);
        expect(linkset[0]).toEqual({
            anchor: 'https://example.com/ask',
            'service-doc': [{ href: 'https://example.com/ask-docs/' }],
            type: [{ href: 'https://example.com/types/SearchAction' }],
        });
    });

    it('passes through absolute URLs unchanged', async () => {
        const route = createApiCatalog({
            siteUrl: 'https://example.com',
            additional: [
                {
                    anchor: 'https://other.example.org/api',
                    serviceDoc: 'https://docs.example.org/',
                    type: 'https://schema.org/SearchAction',
                },
            ],
        });
        const linkset = await readLinkset(route);
        expect(linkset[0]).toEqual({
            anchor: 'https://other.example.org/api',
            'service-doc': [{ href: 'https://docs.example.org/' }],
            type: [{ href: 'https://schema.org/SearchAction' }],
        });
    });

    it('inserts a leading slash when a path is missing one', async () => {
        const route = createApiCatalog({
            siteUrl: 'https://example.com',
            schemaEndpoints: [{ path: 'schema/a.json', schemaType: 'WebPage' }],
        });
        const linkset = await readLinkset(route);
        expect(linkset[0]?.anchor).toBe('https://example.com/schema/a.json');
    });

    it('strips a trailing slash from siteUrl', async () => {
        const route = createApiCatalog({
            siteUrl: 'https://example.com/',
            schemaMap: { path: '/schemamap.xml' },
        });
        const linkset = await readLinkset(route);
        expect(linkset[0]?.anchor).toBe('https://example.com/schemamap.xml');
    });

    it('accepts both string and string[] for serviceDoc and type in additional entries', async () => {
        const route = createApiCatalog({
            siteUrl: 'https://example.com',
            additional: [
                {
                    anchor: '/multi',
                    serviceDoc: ['/docs/a', '/docs/b'],
                    type: ['https://schema.org/Action', 'https://schema.org/Service'],
                },
            ],
        });
        const linkset = await readLinkset(route);
        expect(linkset[0]).toEqual({
            anchor: 'https://example.com/multi',
            'service-doc': [
                { href: 'https://example.com/docs/a' },
                { href: 'https://example.com/docs/b' },
            ],
            type: [{ href: 'https://schema.org/Action' }, { href: 'https://schema.org/Service' }],
        });
    });

    it('preserves order: schemaEndpoints, schemaMap, additional', async () => {
        const route = createApiCatalog({
            siteUrl: 'https://example.com',
            schemaEndpoints: [{ path: '/schema/a.json', schemaType: 'WebPage' }],
            schemaMap: { path: '/schemamap.xml' },
            additional: [{ anchor: '/extra' }],
        });
        const linkset = await readLinkset(route);
        expect(linkset.map((e) => e.anchor)).toEqual([
            'https://example.com/schema/a.json',
            'https://example.com/schemamap.xml',
            'https://example.com/extra',
        ]);
    });

    it('emits an empty linkset when no entries are provided', async () => {
        const route = createApiCatalog({ siteUrl: 'https://example.com' });
        const body = await (await invoke(route)).json();
        expect(body).toEqual({ linkset: [] });
    });

    it('defaults Content-Type to application/linkset+json', async () => {
        const route = createApiCatalog({ siteUrl: 'https://example.com' });
        const response = await invoke(route);
        expect(response.headers.get('Content-Type')).toBe('application/linkset+json');
    });

    it('sets X-Robots-Tag: noindex, follow', async () => {
        const route = createApiCatalog({ siteUrl: 'https://example.com' });
        const response = await invoke(route);
        expect(response.headers.get('X-Robots-Tag')).toBe('noindex, follow');
    });

    it('sets a default Cache-Control of max-age=300', async () => {
        const route = createApiCatalog({ siteUrl: 'https://example.com' });
        const response = await invoke(route);
        expect(response.headers.get('Cache-Control')).toBe('max-age=300');
    });

    it('omits Cache-Control when explicitly null', async () => {
        const route = createApiCatalog({
            siteUrl: 'https://example.com',
            cacheControl: null,
        });
        const response = await invoke(route);
        expect(response.headers.get('Cache-Control')).toBeNull();
    });

    it('honors a custom Content-Type', async () => {
        const route = createApiCatalog({
            siteUrl: 'https://example.com',
            contentType: 'application/json',
        });
        const response = await invoke(route);
        expect(response.headers.get('Content-Type')).toBe('application/json');
    });

    it('honors indent: 0 for compact output', async () => {
        const route = createApiCatalog({
            siteUrl: 'https://example.com',
            schemaMap: { path: '/schemamap.xml' },
            indent: 0,
        });
        const text = await (await invoke(route)).text();
        expect(text).not.toContain('\n');
    });
});
