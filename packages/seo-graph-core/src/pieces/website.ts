import type { WebSiteLeaf } from 'schema-dts';

import type { IdFactory } from '../ids.js';
import type { Reference, CreativeWorkFields, GraphEntity } from '../types.js';
import {
    applyCreativeWorkFields,
    spreadRemainingProperties,
    CREATIVE_WORK_KEYS,
} from '../types.js';

interface WebSiteCoreFields extends CreativeWorkFields {
    /** Site URL, typically with trailing slash. */
    url: string;
    name: string;
    /** Publisher entity — usually the site-wide Person or Organization. */
    publisher: Reference;
    /** Optional navigation reference (e.g. ids.navigation). */
    hasPart?: Reference;
}

export type WebSiteInput = WebSiteCoreFields &
    Omit<Partial<WebSiteLeaf>, keyof WebSiteCoreFields | '@type'>;

const HANDLED_KEYS = new Set<string>([
    ...CREATIVE_WORK_KEYS,
    'url',
    'name',
    'publisher',
    'hasPart',
]);

/**
 * Build a schema.org WebSite piece. This is the site-wide singleton;
 * every page's WebPage should reference it via `isPartOf`.
 */
export function buildWebSite(input: WebSiteInput, ids: IdFactory): GraphEntity {
    const piece: GraphEntity = {
        '@type': 'WebSite',
        '@id': ids.website,
        url: input.url,
        name: input.name,
        publisher: input.publisher,
    };

    applyCreativeWorkFields(piece, input);
    if (input.hasPart !== undefined) piece.hasPart = input.hasPart;
    spreadRemainingProperties(piece, input, HANDLED_KEYS);

    return piece;
}
