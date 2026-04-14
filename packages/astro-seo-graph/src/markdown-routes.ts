import type { APIRoute } from 'astro';
import {
    renderMarkdownAlternate,
    type RenderMarkdownAlternateOptions,
} from './markdown-alternate.js';

export interface MarkdownEndpointOptions<Entry> {
    /**
     * Async source of content entries. Usually a thin wrapper around
     * Astro's `getCollection`, e.g. `() => getCollection('blog')`.
     */
    entries: () => Promise<readonly Entry[]>;
    /**
     * Match an entry against the route param (e.g. `Astro.params.slug`).
     * Return the renderer input for a match, or `null` to skip this entry.
     * The first non-null mapping wins.
     */
    mapper: (entry: Entry, slug: string) => RenderMarkdownAlternateOptions | null;
    /**
     * Name of the URL param to read. Defaults to `'slug'`, matching the
     * common `[...slug].md.ts` filename pattern.
     */
    paramName?: string;
    /** `Cache-Control`. Defaults to `max-age=300`. `null` to omit. */
    cacheControl?: string | null;
    /** `Content-Type`. Defaults to `text/markdown; charset=utf-8`. */
    contentType?: string;
    /** Emit `X-Markdown-Tokens`. Defaults to `true`. */
    emitTokenHeader?: boolean;
    /** Extra response headers. Caller wins on key conflicts. */
    extraHeaders?: Record<string, string>;
}

/**
 * Returns an Astro `APIRoute` that serves a markdown version of a
 * content collection entry, one `.md` URL per entry. Drop into an
 * `.ts` file under `src/pages/`, e.g. `src/pages/blog/[...slug].md.ts`.
 *
 * @example
 * ```ts
 * // src/pages/blog/[...slug].md.ts
 * import { getCollection } from 'astro:content';
 * import { createMarkdownEndpoint } from '@jdevalk/astro-seo-graph';
 *
 * export const getStaticPaths = async () => {
 *   const posts = await getCollection('blog');
 *   return posts.map((p) => ({ params: { slug: p.id } }));
 * };
 *
 * export const GET = createMarkdownEndpoint({
 *   entries: () => getCollection('blog'),
 *   mapper: (post, slug) => post.id !== slug ? null : ({
 *     frontmatter: {
 *       title: post.data.title,
 *       canonical: `https://example.com/blog/${post.id}/`,
 *       pubDate: post.data.pubDate,
 *       author: post.data.author,
 *       description: post.data.description,
 *       tags: post.data.tags,
 *     },
 *     body: post.body ?? '',
 *   }),
 * });
 * ```
 */
export function createMarkdownEndpoint<Entry>(options: MarkdownEndpointOptions<Entry>): APIRoute {
    const paramName = options.paramName ?? 'slug';
    const cacheControl = options.cacheControl === undefined ? 'max-age=300' : options.cacheControl;
    const contentType = options.contentType ?? 'text/markdown; charset=utf-8';
    const emitTokenHeader = options.emitTokenHeader !== false;

    return async ({ params }) => {
        const raw = params?.[paramName];
        const slug = Array.isArray(raw) ? raw.join('/') : (raw ?? '');
        if (!slug) return new Response('Not found', { status: 404 });

        const entries = await options.entries();
        let rendered: ReturnType<typeof renderMarkdownAlternate> | null = null;
        for (const entry of entries) {
            const input = options.mapper(entry, slug);
            if (input === null) continue;
            rendered = renderMarkdownAlternate(input);
            break;
        }
        if (!rendered) return new Response('Not found', { status: 404 });

        const headers: Record<string, string> = {
            'Content-Type': contentType,
            'X-Robots-Tag': 'noindex, follow',
        };
        if (cacheControl !== null) headers['Cache-Control'] = cacheControl;
        if (emitTokenHeader) headers['X-Markdown-Tokens'] = String(rendered.tokenCount);
        // Point crawlers at the HTML canonical — the .md URL is a
        // machine-readable alternate, not a separately indexable resource.
        const canonical = rendered.canonicalHref;
        if (canonical) headers['Link'] = `<${canonical}>; rel="canonical"`;
        if (options.extraHeaders) {
            for (const [k, v] of Object.entries(options.extraHeaders)) headers[k] = v;
        }
        return new Response(rendered.markdown, { headers });
    };
}
