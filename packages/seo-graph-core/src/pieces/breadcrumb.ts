import type { BreadcrumbListLeaf } from 'schema-dts';

import type { IdFactory } from '../ids.js';
import { spreadRemainingProperties } from '../types.js';

export interface BreadcrumbItem {
    /** Display name for this crumb, e.g. 'Home', 'Blog', 'Open Source'. */
    name: string;
    /** URL for this crumb. */
    url: string;
}

interface BreadcrumbListCoreFields {
    /** The URL of the page this breadcrumb belongs to. */
    url: string;
    /** Pre-computed ordered list of crumbs, root first. */
    items: readonly BreadcrumbItem[];
}

export type BreadcrumbListInput = BreadcrumbListCoreFields &
    Omit<Partial<BreadcrumbListLeaf>, keyof BreadcrumbListCoreFields | '@type'>;

const HANDLED_KEYS = new Set<string>(['url', 'items']);

/**
 * Build a schema.org BreadcrumbList piece.
 */
export function buildBreadcrumbList(
    input: BreadcrumbListInput,
    ids: IdFactory,
): Record<string, unknown> {
    const lastIndex = input.items.length - 1;
    const itemListElement = input.items.map((item, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: item.name,
        item: index === lastIndex ? { '@id': ids.webPage(item.url) } : item.url,
    }));

    const piece: Record<string, unknown> = {
        '@type': 'BreadcrumbList',
        '@id': ids.breadcrumb(input.url),
        itemListElement,
    };

    spreadRemainingProperties(piece, input, HANDLED_KEYS);

    return piece;
}
