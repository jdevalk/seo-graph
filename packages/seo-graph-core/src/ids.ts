/**
 * Factory for stable @id URIs used to cross-reference entities in the graph.
 *
 * Site-wide singletons live at `${siteUrl}/#/schema.org/<Type>` (WebSite,
 * Person, etc). Per-page entities live at `${pageUrl}#<suffix>` (Article,
 * Breadcrumb, PrimaryImage). The `person` id defaults to the site root but
 * can be relocated to e.g. `/about-me/` via `personUrl`.
 */
export interface IdFactory {
    /** Site-wide Person id. Defaults to `${siteUrl}/#/schema.org/Person`. */
    readonly person: string;
    /** Site-wide Person image id (friendly-named fragment). */
    readonly personImage: string;
    /** Site-wide WebSite id. */
    readonly website: string;
    /** Site-wide SiteNavigationElement id. */
    readonly navigation: string;
    /** Per-org id factory — pass a stable slug. */
    organization(slug: string): string;
    /** Per-country id factory — pass an ISO 3166 alpha-2 code. */
    country(code: string): string;
    /** WebPage id equals the canonical URL itself. */
    webPage(url: string): string;
    /** Breadcrumb id for a given page URL. */
    breadcrumb(url: string): string;
    /** Article id for a given page URL. */
    article(url: string): string;
    /** VideoObject id for a given page URL. */
    videoObject(url: string): string;
    /** Primary ImageObject id for a given page URL. */
    primaryImage(url: string): string;
}

export interface MakeIdsOptions {
    /** Canonical site URL, with or without trailing slash. E.g. `https://joost.blog`. */
    siteUrl: string;
    /**
     * URL where the site-wide Person entity lives, with trailing slash.
     * Defaults to `${siteUrl}/`. joost.blog uses `${siteUrl}/about-me/`.
     */
    personUrl?: string;
}

/**
 * Normalize a base URL: strip any trailing slash so we can append `/#...`
 * consistently.
 */
function stripTrailingSlash(url: string): string {
    return url.replace(/\/+$/, '');
}

/**
 * Normalize a person URL: ensure a single trailing slash so the resulting
 * id reads `${personUrl}#/schema.org/Person` with the `/` already present.
 */
function ensureTrailingSlash(url: string): string {
    return url.endsWith('/') ? url : `${url}/`;
}

/**
 * Build an IdFactory for a given site. The returned factory is stateless —
 * call it as many times as you like, on any piece builder.
 */
export function makeIds(options: MakeIdsOptions): IdFactory {
    const site = stripTrailingSlash(options.siteUrl);
    const person = ensureTrailingSlash(options.personUrl ?? `${site}/`);

    return {
        person: `${person}#/schema.org/Person`,
        personImage: `${site}/#personlogo`,
        website: `${site}/#/schema.org/WebSite`,
        navigation: `${site}/#site-navigation`,
        organization: (slug: string) => `${site}/#/schema.org/Organization/${slug}`,
        country: (code: string) => `${site}/#/schema.org/Country/${code.toLowerCase()}`,
        webPage: (url: string) => url,
        breadcrumb: (url: string) => `${url}#breadcrumb`,
        article: (url: string) => `${url}#article`,
        videoObject: (url: string) => `${url}#video`,
        primaryImage: (url: string) => `${url}#primaryimage`,
    };
}
