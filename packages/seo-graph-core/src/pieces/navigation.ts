import type { SiteNavigationElementLeaf } from 'schema-dts';

import type { IdFactory } from '../ids.js';
import type { Reference, GraphEntity } from '../types.js';
import { spreadRemainingProperties } from '../types.js';

export interface NavigationItem {
    name: string;
    url: string;
}

interface SiteNavigationCoreFields {
    name: string;
    isPartOf: Reference;
    items: readonly NavigationItem[];
}

export type SiteNavigationInput = SiteNavigationCoreFields &
    Omit<Partial<SiteNavigationElementLeaf>, keyof SiteNavigationCoreFields | '@type'>;

const HANDLED_KEYS = new Set<string>(['name', 'isPartOf', 'items']);

/**
 * Build a schema.org SiteNavigationElement whose `hasPart` is a list of
 * sub-SiteNavigationElement entries (one per nav link).
 */
export function buildSiteNavigationElement(
    input: SiteNavigationInput,
    ids: IdFactory,
): GraphEntity {
    const hasPart = input.items.map((item) => ({
        '@type': 'SiteNavigationElement',
        name: item.name,
        url: item.url,
    }));

    const piece: GraphEntity = {
        '@type': 'SiteNavigationElement',
        '@id': ids.navigation,
        name: input.name,
        isPartOf: input.isPartOf,
        hasPart,
    };

    spreadRemainingProperties(piece, input, HANDLED_KEYS);

    return piece;
}
