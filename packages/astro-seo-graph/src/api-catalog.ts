import type { APIRoute } from 'astro';

/**
 * Standard path for the API catalog per RFC 9727. Exported so callers
 * can reference it from `_headers` files, schemamap entries, or
 * documentation links without duplicating the string.
 */
export const CATALOG_PATH = '/.well-known/api-catalog';

export interface ApiCatalogEntry {
    /**
     * URL or path of the API endpoint. Relative paths are resolved
     * against `siteUrl`; absolute URLs pass through unchanged.
     */
    anchor: string;
    /**
     * Documentation URL(s). Single string is normalized to a one-item
     * array. Relative paths resolved against `siteUrl`.
     */
    serviceDoc?: string | readonly string[];
    /**
     * Type URL(s). For schema.org endpoints, a `https://schema.org/<Type>`
     * URL. For OpenAPI-described services, the OAS document URL. Single
     * string is normalized to a one-item array.
     */
    type?: string | readonly string[];
}

export interface ApiCatalogSchemaEndpointEntry {
    /** Path of the endpoint, e.g. `/schema/post.json`. */
    path: string;
    /**
     * Schema.org type emitted, e.g. `BlogPosting`. Becomes
     * `https://schema.org/<Type>` in the `type` field.
     */
    schemaType: string;
    /** Optional documentation URL. */
    serviceDoc?: string;
}

export interface ApiCatalogSchemaMapEntry {
    /** Path of the schemamap, e.g. `/schemamap.xml`. */
    path: string;
    /** Optional documentation URL. */
    serviceDoc?: string;
}

export interface ApiCatalogOptions {
    /** Canonical site URL. Trailing slash is stripped. */
    siteUrl: string;
    /**
     * Schema.org JSON endpoints, typically the same set wired into
     * `createSchemaEndpoint` calls. Each entry is emitted with
     * `type: [{ href: "https://schema.org/<schemaType>" }]`.
     */
    schemaEndpoints?: readonly ApiCatalogSchemaEndpointEntry[];
    /**
     * Schema map endpoint, typically the path of the route created by
     * `createSchemaMap`. Emitted without a `type` (no standard type
     * exists for the schemamap format).
     */
    schemaMap?: ApiCatalogSchemaMapEntry;
    /** Site-specific APIs not covered by the package's own factories. */
    additional?: readonly ApiCatalogEntry[];
    /** Defaults to `max-age=300`. Pass `null` to omit. */
    cacheControl?: string | null;
    /**
     * Content-Type header. Defaults to `application/linkset+json` per
     * RFC 9727 / RFC 9264. Override only if you have a reason.
     */
    contentType?: string;
    /** JSON indentation. Defaults to `2`. Pass `0` for compact output. */
    indent?: number;
}

interface LinksetEntry {
    anchor: string;
    'service-doc'?: { href: string }[];
    type?: { href: string }[];
}

function absolutize(value: string, site: string): string {
    if (/^https?:\/\//i.test(value)) return value;
    const path = value.startsWith('/') ? value : `/${value}`;
    return `${site}${path}`;
}

function toHrefArray(
    value: string | readonly string[] | undefined,
    site: string,
): { href: string }[] | undefined {
    if (value === undefined) return undefined;
    const arr = typeof value === 'string' ? [value] : value;
    if (arr.length === 0) return undefined;
    return arr.map((v) => ({ href: absolutize(v, site) }));
}

/**
 * Returns an Astro `APIRoute` that serves an RFC 9727 API catalog
 * (`application/linkset+json`, RFC 9264) at `/.well-known/api-catalog`.
 *
 * Lists the site's APIs — schema.org JSON endpoints, the schema map,
 * and any additional services — with anchor URLs, optional service-doc
 * URLs, and type pointers. Drop the returned handler into
 * `src/pages/.well-known/api-catalog.ts`.
 *
 * @example
 * ```ts
 * import { createApiCatalog } from '@jdevalk/astro-seo-graph';
 *
 * export const GET = createApiCatalog({
 *   siteUrl: 'https://example.com',
 *   schemaEndpoints: [
 *     { path: '/schema/post.json', schemaType: 'BlogPosting' },
 *   ],
 *   schemaMap: { path: '/schemamap.xml' },
 * });
 * ```
 */
export function createApiCatalog(options: ApiCatalogOptions): APIRoute {
    const cacheControl = options.cacheControl === undefined ? 'max-age=300' : options.cacheControl;
    const contentType = options.contentType ?? 'application/linkset+json';
    const indent = options.indent ?? 2;
    const site = options.siteUrl.replace(/\/+$/, '');

    return async () => {
        const linkset: LinksetEntry[] = [];

        if (options.schemaEndpoints) {
            for (const e of options.schemaEndpoints) {
                const entry: LinksetEntry = { anchor: absolutize(e.path, site) };
                const sd = toHrefArray(e.serviceDoc, site);
                if (sd) entry['service-doc'] = sd;
                entry.type = [{ href: `https://schema.org/${e.schemaType}` }];
                linkset.push(entry);
            }
        }

        if (options.schemaMap) {
            const entry: LinksetEntry = { anchor: absolutize(options.schemaMap.path, site) };
            const sd = toHrefArray(options.schemaMap.serviceDoc, site);
            if (sd) entry['service-doc'] = sd;
            linkset.push(entry);
        }

        if (options.additional) {
            for (const e of options.additional) {
                const entry: LinksetEntry = { anchor: absolutize(e.anchor, site) };
                const sd = toHrefArray(e.serviceDoc, site);
                if (sd) entry['service-doc'] = sd;
                const t = toHrefArray(e.type, site);
                if (t) entry.type = t;
                linkset.push(entry);
            }
        }

        const headers: Record<string, string> = {
            'Content-Type': contentType,
            'X-Robots-Tag': 'noindex, follow',
        };
        if (cacheControl !== null) headers['Cache-Control'] = cacheControl;

        return new Response(JSON.stringify({ linkset }, null, indent), { headers });
    };
}
