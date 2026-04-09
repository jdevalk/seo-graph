import type { IdFactory } from '../ids.js';
import type { Reference } from '../types.js';

export interface NavigationItem {
    name: string;
    url: string;
}

export interface SiteNavigationInput {
    /** Human-readable nav name, e.g. 'Main navigation'. */
    name: string;
    /** Parent WebSite reference (usually ids.website). */
    isPartOf: Reference;
    items: readonly NavigationItem[];
    extra?: Record<string, unknown>;
}

/**
 * Build a schema.org SiteNavigationElement whose `hasPart` is a list of
 * sub-SiteNavigationElement entries (one per nav link).
 */
export function buildSiteNavigationElement(
    input: SiteNavigationInput,
    ids: IdFactory,
): Record<string, unknown> {
    const hasPart = input.items.map((item) => ({
        '@type': 'SiteNavigationElement',
        name: item.name,
        url: item.url,
    }));
    return {
        '@type': 'SiteNavigationElement',
        '@id': ids.navigation,
        name: input.name,
        isPartOf: input.isPartOf,
        hasPart,
        ...input.extra,
    };
}
