import type { BreadcrumbListLeaf } from 'schema-dts';

import type { IdFactory } from '../ids.js';
import type { GraphEntity } from '../types.js';
import { spreadRemainingProperties } from '../types.js';

export interface BreadcrumbItem {
    /** Display name for this crumb, e.g. 'Home', 'Blog', 'Open Source'. */
    name: string;
    /** URL for this crumb. */
    url: string;
    /** Optional @id override. When set, the `item` value uses this @id instead of the URL. */
    id?: string;
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
export function buildBreadcrumbList(input: BreadcrumbListInput, ids: IdFactory): GraphEntity {
    const lastIndex = input.items.length - 1;
    const itemListElement = input.items.map((item, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: item.name,
        item: item.id
            ? { '@id': item.id }
            : index === lastIndex
              ? { '@id': ids.webPage(item.url) }
              : item.url,
    }));

    const piece: GraphEntity = {
        '@type': 'BreadcrumbList',
        '@id': ids.breadcrumb(input.url),
        itemListElement,
    };

    spreadRemainingProperties(piece, input, HANDLED_KEYS);

    return piece;
}
