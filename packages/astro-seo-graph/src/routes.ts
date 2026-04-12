import type { APIRoute } from 'astro';
import type { GraphEntity } from '@jdevalk/seo-graph-core';
import { aggregate } from './aggregator.js';

export interface SchemaEndpointOptions<Entry> {
    /**
     * Async source of content entries. Usually a thin wrapper around
     * Astro's `getCollection`, e.g. `() => getCollection('blog')`, or
     * a filtered variant: `() => (await getCollection('blog')).filter(isPublished)`.
     */
    entries: () => Promise<readonly Entry[]>;
    /**
     * Map a single entry to an array of schema.org pieces. The pieces
     * are assembled into a single `@graph` via the aggregator and
     * deduplicated by `@id`.
     */
    mapper: (entry: Entry) => ReadonlyArray<GraphEntity>;
    /**
     * `Cache-Control` header value. Defaults to `max-age=300` (5 min).
     * Pass `null` to omit the header entirely.
     */
    cacheControl?: string | null;
    /**
     * `Content-Type` header value. Defaults to `application/ld+json`.
     */
    contentType?: string;
    /**
     * JSON output indentation. Defaults to `2`. Pass `0` for compact
     * output.
     */
    indent?: number;
}

/**
 * Returns an Astro `APIRoute` that serves a corpus-wide schema.org
 * `@graph` for a content collection as JSON-LD. Drop the returned
 * handler into an `.ts` file under `src/pages/`.
 *
 * @example
 * ```ts
 * // src/pages/schema/post.json.ts
 * import { getCollection } from 'astro:content';
 * import { createSchemaEndpoint } from '@jdevalk/astro-seo-graph';
 * import { buildArticle, buildWebPage } from '@jdevalk/seo-graph-core';
 *
 * export const GET = createSchemaEndpoint({
 *   entries: () => getCollection('blog'),
 *   mapper: (post) => [
 *     buildWebPage({ url: `https://example.com/${post.id}/`, ... }, ids),
 *     buildArticle({ url: `https://example.com/${post.id}/`, ... }, ids),
 *   ],
 * });
 * ```
 */
export function createSchemaEndpoint<Entry>(options: SchemaEndpointOptions<Entry>): APIRoute {
    const cacheControl = options.cacheControl === undefined ? 'max-age=300' : options.cacheControl;
    const contentType = options.contentType ?? 'application/ld+json';
    const indent = options.indent ?? 2;

    return async () => {
        const entries = await options.entries();
        const graph = aggregate({ entries, mapper: options.mapper });
        const headers: Record<string, string> = {
            'Content-Type': contentType,
            'X-Robots-Tag': 'noindex',
        };
        if (cacheControl !== null) headers['Cache-Control'] = cacheControl;
        return new Response(JSON.stringify(graph, null, indent), { headers });
    };
}

export interface SchemaMapEntry {
    /**
     * URL path relative to the site root, e.g. `/schema/post.json`.
     * May start with or without a leading slash.
     */
    path: string;
    /** When the resource at this path was last modified. */
    lastModified: Date;
    /** Defaults to `'daily'`. */
    changeFreq?: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never';
    /** 0.0–1.0. Defaults to `0.8`. */
    priority?: number;
}

export interface SchemaMapOptions {
    /** Canonical site URL. Trailing slash is stripped. */
    siteUrl: string;
    /** One entry per schema endpoint. */
    entries: readonly SchemaMapEntry[];
    /** Defaults to `max-age=300`. Pass `null` to omit. */
    cacheControl?: string | null;
}

function escapeXml(value: string): string {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

/**
 * Returns an Astro `APIRoute` that serves a sitemap-style XML listing
 * of the site's schema.org endpoints. Agent crawlers can use this as
 * a discovery point for a site's JSON-LD knowledge graph.
 *
 * @example
 * ```ts
 * // src/pages/schemamap.xml.ts
 * import { createSchemaMap } from '@jdevalk/astro-seo-graph';
 *
 * export const GET = createSchemaMap({
 *   siteUrl: 'https://example.com',
 *   entries: [
 *     { path: '/schema/post.json', lastModified: new Date('2026-04-07') },
 *     { path: '/schema/video.json', lastModified: new Date('2026-03-13') },
 *   ],
 * });
 * ```
 */
export function createSchemaMap(options: SchemaMapOptions): APIRoute {
    const cacheControl = options.cacheControl === undefined ? 'max-age=300' : options.cacheControl;
    const site = options.siteUrl.replace(/\/+$/, '');

    return async () => {
        const urls = options.entries
            .map((entry) => {
                const pathPart = entry.path.startsWith('/') ? entry.path : `/${entry.path}`;
                const loc = escapeXml(`${site}${pathPart}`);
                const lastmod = entry.lastModified.toISOString().split('T')[0];
                const changefreq = entry.changeFreq ?? 'daily';
                const priority = entry.priority ?? 0.8;
                return `  <url contentType="structuredData/schema.org">
    <loc>${loc}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`;
            })
            .join('\n');

        const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`;

        const headers: Record<string, string> = {
            'Content-Type': 'application/xml',
            'X-Robots-Tag': 'noindex',
        };
        if (cacheControl !== null) headers['Cache-Control'] = cacheControl;
        return new Response(xml, { headers });
    };
}
