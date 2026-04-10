import type { IdFactory } from '../ids.js';
import type { Reference, CreativeWorkFields } from '../types.js';
import { applyCreativeWorkFields } from '../types.js';

/**
 * Concrete WebPage subtype. `WebPage` is the default; use `ProfilePage`
 * for /about-me style pages and `CollectionPage` for index/listing pages.
 */
export type WebPageType = 'WebPage' | 'ProfilePage' | 'CollectionPage';

export interface WebPageInput extends CreativeWorkFields {
    /** Canonical URL of the page. The WebPage @id equals this URL. */
    url: string;
    /** Page title (becomes `name`). */
    name: string;
    /** Reference to the site-wide WebSite (usually ids.website). */
    isPartOf: Reference;
    /**
     * Reference to the BreadcrumbList for this page (usually
     * `ids.breadcrumb(url)`). Optional — schema.org treats `breadcrumb`
     * as optional on `WebPage`, so consumers without breadcrumbs can
     * simply omit it.
     */
    breadcrumb?: Reference;
    /** Reference to the primary ImageObject, if any. */
    primaryImage?: Reference;
    /**
     * Custom potentialAction. If omitted, defaults to a single ReadAction
     * targeting the page URL.
     */
    potentialAction?: ReadonlyArray<Record<string, unknown>>;
    extra?: Record<string, unknown>;
}

/**
 * Build a schema.org WebPage (or ProfilePage / CollectionPage) piece.
 *
 * Choose the concrete subtype via the second argument; defaults to
 * `WebPage`. Dispatch (e.g. "blog listing pages use CollectionPage")
 * is a caller concern, not a core concern — core ships the primitives
 * and lets the caller decide.
 */
export function buildWebPage(
    input: WebPageInput,
    ids: IdFactory,
    type: WebPageType = 'WebPage',
): Record<string, unknown> {
    const potentialAction: ReadonlyArray<Record<string, unknown>> = input.potentialAction ?? [
        { '@type': 'ReadAction', target: [input.url] },
    ];

    const piece: Record<string, unknown> = {
        '@type': type,
        '@id': ids.webPage(input.url),
        url: input.url,
        name: input.name,
        isPartOf: input.isPartOf,
        potentialAction,
    };

    if (input.breadcrumb !== undefined) {
        piece.breadcrumb = input.breadcrumb;
    }
    if (input.primaryImage !== undefined) {
        piece.primaryImageOfPage = input.primaryImage;
    }
    applyCreativeWorkFields(piece, input);

    return { ...piece, ...input.extra };
}
