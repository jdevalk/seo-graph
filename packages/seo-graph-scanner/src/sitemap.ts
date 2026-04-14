import Sitemapper from 'sitemapper';

export interface DiscoverOptions {
    /** Request timeout in ms. Defaults to 15_000. */
    timeout?: number;
    /** Optional URL pattern to filter against. */
    filter?: (url: string) => boolean;
    /** Max URLs to return. Defaults to unlimited. */
    limit?: number;
}

export interface DiscoveredUrl {
    url: string;
    lastmod?: string;
}

/**
 * Discover URLs from a sitemap.xml (or sitemap index). Follows nested
 * sitemaps automatically via the sitemapper library.
 */
export async function discoverFromSitemap(
    sitemapUrl: string,
    options: DiscoverOptions = {},
): Promise<DiscoveredUrl[]> {
    const sitemapper = new Sitemapper({
        url: sitemapUrl,
        timeout: options.timeout ?? 15_000,
    });

    const { sites } = await sitemapper.fetch();
    let urls: DiscoveredUrl[] = sites.map((url) => ({ url }));

    if (options.filter) {
        urls = urls.filter((u) => options.filter!(u.url));
    }
    if (options.limit !== undefined) {
        urls = urls.slice(0, options.limit);
    }

    return urls;
}

/**
 * Guess a sitemap URL from a site origin. Tries /sitemap.xml and
 * /sitemap_index.xml (the Yoast convention) in order.
 */
export async function resolveSitemapUrl(origin: string): Promise<string | undefined> {
    const candidates = [
        new URL('/sitemap_index.xml', origin).toString(),
        new URL('/sitemap.xml', origin).toString(),
    ];
    for (const candidate of candidates) {
        try {
            const res = await fetch(candidate, { method: 'HEAD' });
            if (res.ok) return candidate;
        } catch {
            // try next
        }
    }
    return undefined;
}
