import type { IdFactory } from '../ids.js';

export interface BreadcrumbItem {
    /** Display name for this crumb, e.g. 'Home', 'Blog', 'Open Source'. */
    name: string;
    /** URL for this crumb. */
    url: string;
}

export interface BreadcrumbListInput {
    /**
     * The URL of the page this breadcrumb belongs to. The @id is
     * `${url}#breadcrumb`.
     */
    url: string;
    /** Pre-computed ordered list of crumbs, root first. */
    items: readonly BreadcrumbItem[];
    extra?: Record<string, unknown>;
}

/**
 * Build a schema.org BreadcrumbList piece.
 *
 * Breadcrumbs are an input to core, not a derivation. The caller knows
 * its routing conventions; core just wraps the pre-computed items in the
 * right schema.org shape. If you need to derive breadcrumbs from an
 * Astro URL, use `@jdevalk/astro-seo-graph`'s breadcrumb helper instead.
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
    return {
        '@type': 'BreadcrumbList',
        '@id': ids.breadcrumb(input.url),
        itemListElement,
        ...input.extra,
    };
}
