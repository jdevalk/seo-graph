/**
 * Pure TypeScript layer for the <Seo> component. The .astro file is a
 * thin template that calls `buildAstroSeoProps` with the user's input
 * and an Astro context (mostly `Astro.url.href`). Keeping the logic
 * here makes it unit-testable with vitest — Astro's renderer isn't
 * easily accessible from vitest.
 */

import { buildAlternateLinks, type BuildAlternateLinksInput } from '../alternates.js';

/** Public props surface of the <Seo> component. */
export interface SeoProps {
    /** Page title. Required. */
    title: string;
    /**
     * Template for composing the full `<title>`. Use `%s` where the
     * title should be substituted. Defaults to the raw `title`.
     *
     * @example `"%s | Joost.blog"` → `"My Post | Joost.blog"`
     */
    titleTemplate?: string;
    /** Meta description. */
    description?: string;
    /**
     * Canonical URL. Defaults to the current page URL with the query
     * string stripped. Set `preserveQueryParams` to keep the query
     * string, or pass an explicit `canonical` to override entirely.
     *
     * Omitted from the output when `noindex` is true.
     */
    canonical?: string | URL;
    /**
     * Keep the query string in the default canonical URL. Defaults to
     * `false` (query params are stripped — the SEO-correct behavior for
     * most cases). Has no effect when `canonical` is explicitly set.
     */
    preserveQueryParams?: boolean;
    /** Open Graph type. Defaults to `'website'`. */
    ogType?: 'website' | 'article' | 'profile' | 'book';
    /** Absolute URL of the share image. */
    ogImage?: string;
    /** Alt text for the share image. */
    ogImageAlt?: string;
    /** Width of the share image in pixels. */
    ogImageWidth?: number;
    /** Height of the share image in pixels. */
    ogImageHeight?: number;
    /** Site name shown in OG tags, e.g. `"Joost.blog"`. */
    siteName?: string;
    /** OG locale. Defaults to `'en_US'`. */
    locale?: string;
    /** Twitter card metadata. */
    twitter?: {
        /** Twitter handle of the site owner, e.g. `'@jdevalk'`. */
        site?: string;
        /** Twitter handle of the author. */
        creator?: string;
        /** Card type. Defaults to `'summary_large_image'`. */
        card?: 'summary' | 'summary_large_image' | 'app' | 'player';
    };
    /**
     * Article-specific OG metadata. Only emitted when `ogType` is
     * `'article'`.
     */
    article?: {
        publishedTime?: Date | string;
        modifiedTime?: Date | string;
        expirationTime?: Date | string;
        authors?: readonly string[];
        tags?: readonly string[];
        section?: string;
    };
    /** Emit `<meta name="robots" content="noindex, follow, max-*">`. */
    noindex?: boolean;
    /** Emit `nofollow` in the robots meta. */
    nofollow?: boolean;
    /**
     * Facebook page URL of the publisher. Emitted as `article:publisher`
     * when `ogType` is `'article'`.
     */
    articlePublisher?: string;
    /**
     * Author name for the `<meta name="author">` tag. If omitted but
     * `article.authors` is set, the first author is used.
     */
    author?: string;
    /**
     * JSON-LD `@graph` envelope to inject as
     * `<script type="application/ld+json">`. Typically the output of
     * `buildSchemaGraph(...)` or `assembleGraph(...)` from
     * `@jdevalk/seo-graph-core`. Pass `null` or omit to skip JSON-LD.
     */
    graph?: Record<string, unknown> | null;
    /** Extra `<link>` tags (icons, sitemap, RSS alternate, etc.). */
    extraLinks?: ReadonlyArray<Record<string, string>>;
    /** Extra `<meta>` tags (author, custom fields). */
    extraMeta?: ReadonlyArray<Record<string, string>>;
    /**
     * hreflang alternate-language annotations.
     *
     * Emits one `<link rel="alternate" hreflang="…" href="…">` per
     * entry, plus an `x-default` entry pointing at the default-locale
     * sibling (or the first entry, if no default match is found). Also
     * emits matching `og:locale:alternate` tags.
     */
    alternates?: BuildAlternateLinksInput;
}

/**
 * Shape consumed by `astro-seo`'s `<SEO>` component. We expose it as a
 * type so tests can assert on exact keys / nesting rather than having
 * to parse rendered HTML.
 */
export interface AstroSeoProps {
    title: string;
    description?: string;
    canonical?: string;
    openGraph: {
        basic: {
            title: string;
            type: string;
            image: string;
            url: string;
        };
        optional?: {
            description?: string;
            siteName?: string;
            locale?: string;
            localeAlternate?: string[];
        };
        image?: {
            alt?: string;
            width?: number;
            height?: number;
        };
        article?: {
            publishedTime?: string;
            modifiedTime?: string;
            expirationTime?: string;
            authors?: string[];
            tags?: string[];
            section?: string;
            publisher?: string;
        };
    };
    twitter?: {
        card: 'summary' | 'summary_large_image' | 'app' | 'player';
        site?: string;
        creator?: string;
        title: string;
        description?: string;
        image?: string;
        imageAlt?: string;
    };
    extend?: {
        link?: Array<Record<string, string>>;
        meta?: Array<Record<string, string>>;
    };
}

function toIsoString(value: Date | string | undefined): string | undefined {
    if (value === undefined) return undefined;
    return value instanceof Date ? value.toISOString() : value;
}

/**
 * Build the `content` value of the `<meta name="robots">` tag. Always
 * includes `max-snippet:-1, max-image-preview:large, max-video-preview:-1`
 * (opt into maximum snippet/preview sizes in search results). Prepends
 * `noindex`, `nofollow`, or `noindex, follow` as applicable.
 */
function buildRobotsContent(noindex?: boolean, nofollow?: boolean): string {
    const directives: string[] = [];
    if (noindex && nofollow) {
        directives.push('noindex', 'nofollow');
    } else if (noindex) {
        directives.push('noindex', 'follow');
    } else if (nofollow) {
        directives.push('nofollow');
    }
    directives.push('max-snippet:-1', 'max-image-preview:large', 'max-video-preview:-1');
    return directives.join(', ');
}

/**
 * Strip the query string from a URL. Fragments are preserved. Falls
 * back to returning the input unchanged if URL parsing fails.
 */
function stripQueryParams(url: string): string {
    try {
        const parsed = new URL(url);
        parsed.search = '';
        return parsed.toString();
    } catch {
        return url;
    }
}

/**
 * Project the public `SeoProps` onto the shape `astro-seo`'s `<SEO>`
 * component expects. Pure function; no Astro runtime access.
 *
 * @param props      Props as provided by the user.
 * @param pageUrl    The current page URL — usually `Astro.url.href`.
 *                   Used as the canonical URL when `props.canonical` is
 *                   not provided, and as the base for the OG `url`.
 */
export function buildAstroSeoProps(props: SeoProps, pageUrl: string): AstroSeoProps {
    const fullTitle = props.titleTemplate
        ? props.titleTemplate.replace('%s', props.title)
        : props.title;

    // Default canonical strips query params (SEO-correct for most
    // cases). `preserveQueryParams` opts out. Explicit `canonical`
    // overrides entirely.
    let canonical: string | undefined;
    if (props.canonical !== undefined) {
        canonical = props.canonical.toString();
    } else if (props.preserveQueryParams) {
        canonical = pageUrl;
    } else {
        canonical = stripQueryParams(pageUrl);
    }

    // Omit canonical when the page is noindex (Google recommendation).
    if (props.noindex) {
        canonical = undefined;
    }

    // og:url uses the canonical when available, otherwise the (possibly
    // query-stripped) page URL.
    const ogUrl = canonical ?? stripQueryParams(pageUrl);

    const ogType = props.ogType ?? 'website';
    const ogImage = props.ogImage ?? '';

    const openGraph: AstroSeoProps['openGraph'] = {
        basic: {
            title: fullTitle,
            type: ogType,
            image: ogImage,
            url: ogUrl,
        },
    };

    const optional: NonNullable<AstroSeoProps['openGraph']['optional']> = {};
    if (props.description !== undefined) optional.description = props.description;
    if (props.siteName !== undefined) optional.siteName = props.siteName;
    optional.locale = props.locale ?? 'en_US';

    // og:locale:alternate from hreflang entries. Convert hyphenated
    // BCP 47 (fr-CA) to OG-style underscores (fr_CA), and skip any
    // entry that matches the primary og:locale (including language-only
    // matches like hreflang='en' when og:locale='en_US').
    if (props.alternates?.entries && props.alternates.entries.length > 1) {
        const primaryLang = optional.locale?.split('_')[0]?.toLowerCase();
        const localeAlternate: string[] = [];
        const seen = new Set<string>();
        for (const entry of props.alternates.entries) {
            const ogLocale = entry.hreflang.replace('-', '_');
            const entryLang = entry.hreflang.split('-')[0]?.toLowerCase();
            if (seen.has(ogLocale)) continue;
            if (ogLocale === optional.locale) continue;
            // Skip language-only hreflang when it matches the primary locale's language.
            if (!entry.hreflang.includes('-') && entryLang === primaryLang) continue;
            seen.add(ogLocale);
            localeAlternate.push(ogLocale);
        }
        if (localeAlternate.length > 0) optional.localeAlternate = localeAlternate;
    }

    openGraph.optional = optional;

    const hasImageMeta =
        props.ogImageAlt !== undefined ||
        props.ogImageWidth !== undefined ||
        props.ogImageHeight !== undefined;
    if (ogImage && hasImageMeta) {
        const image: NonNullable<AstroSeoProps['openGraph']['image']> = {};
        if (props.ogImageAlt !== undefined) image.alt = props.ogImageAlt;
        if (props.ogImageWidth !== undefined) image.width = props.ogImageWidth;
        if (props.ogImageHeight !== undefined) image.height = props.ogImageHeight;
        openGraph.image = image;
    }

    if (ogType === 'article' && (props.article || props.articlePublisher)) {
        const article: NonNullable<AstroSeoProps['openGraph']['article']> = {};
        if (props.article) {
            const published = toIsoString(props.article.publishedTime);
            if (published !== undefined) article.publishedTime = published;
            const modified = toIsoString(props.article.modifiedTime);
            if (modified !== undefined) article.modifiedTime = modified;
            const expiration = toIsoString(props.article.expirationTime);
            if (expiration !== undefined) article.expirationTime = expiration;
            if (props.article.authors !== undefined) article.authors = [...props.article.authors];
            if (props.article.tags !== undefined) article.tags = [...props.article.tags];
            if (props.article.section !== undefined) article.section = props.article.section;
        }
        if (props.articlePublisher !== undefined) article.publisher = props.articlePublisher;
        openGraph.article = article;
    }

    const astroSeo: AstroSeoProps = {
        title: fullTitle,
        openGraph,
    };

    if (canonical !== undefined) astroSeo.canonical = canonical;
    if (props.description !== undefined) astroSeo.description = props.description;

    if (props.twitter !== undefined) {
        const twitter: NonNullable<AstroSeoProps['twitter']> = {
            card: props.twitter.card ?? 'summary_large_image',
            title: fullTitle,
        };
        if (props.twitter.site !== undefined) twitter.site = props.twitter.site;
        if (props.twitter.creator !== undefined) twitter.creator = props.twitter.creator;
        if (props.description !== undefined) twitter.description = props.description;
        if (ogImage) twitter.image = ogImage;
        if (props.ogImageAlt !== undefined) twitter.imageAlt = props.ogImageAlt;
        astroSeo.twitter = twitter;
    }

    // Resolve hreflang alternates (if any). Returns [] when fewer than
    // 2 entries survive validation, so this is cheap to call.
    const alternateLinks =
        props.alternates !== undefined ? buildAlternateLinks(props.alternates) : [];

    // Build our own robots meta (astro-seo's doesn't support max-*).
    const robotsContent = buildRobotsContent(props.noindex, props.nofollow);

    // Resolve author name: explicit prop takes precedence, falls back
    // to first entry in article.authors.
    const authorName = props.author ?? props.article?.authors?.[0];

    const meta: Array<Record<string, string>> = [];
    meta.push({ name: 'robots', content: robotsContent });
    if (authorName !== undefined) {
        meta.push({ name: 'author', content: authorName });
    }
    if (props.extraMeta !== undefined) {
        for (const entry of props.extraMeta) meta.push({ ...entry });
    }

    const hasExtraLinks = props.extraLinks !== undefined && props.extraLinks.length > 0;
    const hasAlternates = alternateLinks.length > 0;
    const link: Array<Record<string, string>> = [];
    if (hasExtraLinks) {
        for (const entry of props.extraLinks!) link.push({ ...entry });
    }
    if (hasAlternates) {
        for (const entry of alternateLinks) {
            link.push({
                rel: entry.rel,
                href: entry.href,
                hreflang: entry.hreflang,
            });
        }
    }

    const extend: NonNullable<AstroSeoProps['extend']> = {};
    if (link.length > 0) extend.link = link;
    if (meta.length > 0) extend.meta = meta;
    if (extend.link !== undefined || extend.meta !== undefined) {
        astroSeo.extend = extend;
    }

    return astroSeo;
}
