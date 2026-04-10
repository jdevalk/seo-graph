/**
 * Breadcrumb derivation helper for Astro pages.
 *
 * Pure function: no DOM, no fetch, no Astro runtime. Takes a page URL
 * (typically `Astro.url`) and derives an ordered breadcrumb trail from
 * its path segments. The returned `BreadcrumbItem[]` array is passed
 * straight to `buildBreadcrumbList` from `@jdevalk/seo-graph-core`.
 *
 * Callers control display names via the `names` map and can omit
 * segments via `skip`. Segments without a mapped name are title-cased
 * from their slug (e.g. `open-source` → `Open Source`).
 */

import type { BreadcrumbItem } from '@jdevalk/seo-graph-core';

export interface BreadcrumbsFromUrlInput {
    /**
     * The full page URL. Typically `Astro.url` inside a layout, or any
     * absolute URL string.
     */
    url: URL | string;

    /**
     * Site origin with optional base path, e.g. `'https://example.com'`
     * or `'https://example.com/docs'`. Used to construct absolute URLs
     * for each crumb. Must not end with a slash.
     */
    siteUrl: string;

    /** Display name for the current (last) page. */
    pageName: string;

    /**
     * Display name for the root crumb. Defaults to `'Home'`.
     */
    homeName?: string;

    /**
     * Map of path segments to display names. Keys are individual slug
     * segments (e.g. `'blog'`, `'open-source'`). Segments not in this
     * map are title-cased from their slug.
     */
    names?: Readonly<Record<string, string>>;

    /**
     * Segments to exclude from the breadcrumb trail. The pages they
     * point to are still valid URLs — they just won't appear as crumbs.
     * For example, `['category']` skips a `/blog/category/` crumb while
     * still including `/blog/category/open-source/`.
     */
    skip?: readonly string[];
}

/**
 * Title-case a URL slug: split on hyphens, capitalize each word.
 *
 * `'open-source'` → `'Open Source'`
 */
function titleCaseSlug(slug: string): string {
    return slug
        .split('-')
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
}

/**
 * Ensure `url` ends with exactly one trailing slash.
 */
function trailingSlash(url: string): string {
    return url.endsWith('/') ? url : url + '/';
}

/**
 * Derive a breadcrumb trail from a page URL.
 *
 * Always includes a root ("Home") crumb and the current page as the
 * last crumb. Intermediate crumbs are derived from path segments
 * between root and the page, skipping any segments listed in `skip`.
 *
 * @returns Ordered `BreadcrumbItem[]`, root first. Pass directly to
 *          `buildBreadcrumbList`'s `items` field.
 */
export function breadcrumbsFromUrl(input: BreadcrumbsFromUrlInput): BreadcrumbItem[] {
    const { pageName, homeName = 'Home', names = {}, skip = [] } = input;

    const normalizedSiteUrl = trailingSlash(input.siteUrl);
    const pageUrl = typeof input.url === 'string' ? new URL(input.url) : input.url;
    const pageHref = trailingSlash(pageUrl.href);

    // Derive the path relative to the site origin.
    const siteOrigin = new URL(normalizedSiteUrl);
    const relativePath = pageUrl.pathname.slice(siteOrigin.pathname.length);
    const segments = relativePath.split('/').filter(Boolean);

    // When the page is the site root, there is only one crumb.
    if (segments.length === 0) {
        return [{ name: pageName, url: pageHref }];
    }

    const skipSet = new Set(skip);
    const items: BreadcrumbItem[] = [{ name: homeName, url: normalizedSiteUrl }];

    // Build intermediate crumbs (everything except the last segment,
    // which is the current page).
    let accumulated = siteOrigin.pathname;
    for (const segment of segments.slice(0, -1)) {
        accumulated = trailingSlash(accumulated + segment);
        if (skipSet.has(segment)) continue;
        const name = names[segment] ?? titleCaseSlug(segment);
        items.push({ name, url: siteOrigin.origin + accumulated });
    }

    // Current page is always the last crumb.
    items.push({ name: pageName, url: pageHref });

    return items;
}
