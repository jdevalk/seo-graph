import type { IdFactory } from '../ids.js';
import type { Reference } from '../types.js';

export interface WebSiteInput {
    /** Site URL, typically with trailing slash. */
    url: string;
    name: string;
    description?: string;
    /** Publisher entity — usually the site-wide Person or Organization. */
    publisher: Reference;
    /** Default content language, e.g. 'en-US'. */
    inLanguage?: string;
    /** Optional navigation reference (e.g. ids.navigation). */
    hasPart?: Reference;
    /** Escape hatch for extra schema.org properties. */
    extra?: Record<string, unknown>;
}

/**
 * Build a schema.org WebSite piece. This is the site-wide singleton;
 * every page's WebPage should reference it via `isPartOf`.
 */
export function buildWebSite(input: WebSiteInput, ids: IdFactory): Record<string, unknown> {
    const piece: Record<string, unknown> = {
        '@type': 'WebSite',
        '@id': ids.website,
        url: input.url,
        name: input.name,
    };
    if (input.description !== undefined) piece.description = input.description;
    piece.publisher = input.publisher;
    piece.inLanguage = input.inLanguage ?? 'en-US';
    if (input.hasPart !== undefined) piece.hasPart = input.hasPart;
    return { ...piece, ...input.extra };
}
