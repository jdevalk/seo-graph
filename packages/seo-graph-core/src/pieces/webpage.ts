import type { WebPageLeaf } from 'schema-dts';

import type { IdFactory } from '../ids.js';
import type { Reference, CreativeWorkFields, GraphEntity } from '../types.js';
import {
    applyCreativeWorkFields,
    spreadRemainingProperties,
    CREATIVE_WORK_KEYS,
} from '../types.js';

/**
 * Concrete WebPage subtype. `WebPage` is the default; use `ProfilePage`
 * for /about-me style pages and `CollectionPage` for index/listing pages.
 */
export type WebPageType = 'WebPage' | 'ProfilePage' | 'CollectionPage';

interface WebPageCoreFields extends CreativeWorkFields {
    /** Canonical URL of the page. The WebPage @id equals this URL. */
    url: string;
    /** Page title (becomes `name`). */
    name: string;
    /** Reference to the site-wide WebSite (usually ids.website). */
    isPartOf: Reference;
    /** Reference to the BreadcrumbList for this page. */
    breadcrumb?: Reference;
    /** Reference to the primary ImageObject, if any. */
    primaryImage?: Reference;
    /**
     * Custom potentialAction. If omitted, defaults to a single ReadAction
     * targeting the page URL.
     */
    potentialAction?: ReadonlyArray<Record<string, unknown>>;
}

export type WebPageInput = WebPageCoreFields &
    Omit<Partial<WebPageLeaf>, keyof WebPageCoreFields | '@type'>;

const HANDLED_KEYS = new Set<string>([
    ...CREATIVE_WORK_KEYS,
    'url',
    'name',
    'isPartOf',
    'breadcrumb',
    'primaryImage',
    'potentialAction',
]);

/**
 * Build a schema.org WebPage (or ProfilePage / CollectionPage) piece.
 */
export function buildWebPage(
    input: WebPageInput,
    ids: IdFactory,
    type: WebPageType = 'WebPage',
): GraphEntity {
    const potentialAction: ReadonlyArray<Record<string, unknown>> = input.potentialAction ?? [
        { '@type': 'ReadAction', target: [input.url] },
    ];

    const piece: GraphEntity = {
        '@type': type,
        '@id': ids.webPage(input.url),
        url: input.url,
        name: input.name,
        isPartOf: input.isPartOf,
        potentialAction,
    };

    if (input.breadcrumb !== undefined) piece.breadcrumb = input.breadcrumb;
    if (input.primaryImage !== undefined) piece.primaryImageOfPage = input.primaryImage;
    applyCreativeWorkFields(piece, input);
    spreadRemainingProperties(piece, input, HANDLED_KEYS);

    return piece;
}
