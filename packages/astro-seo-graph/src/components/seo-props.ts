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
    /** Canonical URL. Defaults to the current page URL (`Astro.url.href`). */
    canonical?: string | URL;
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
    /** Emit `<meta name="robots" content="noindex, follow">` when `true`. */
    noindex?: boolean;
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
     * sibling (or the first entry, if no default match is found).
     *
     * All `href` values MUST be absolute `http(s)://` URLs — relative
     * or other-scheme values are dropped silently. BCP 47 tags are
     * normalized on output (`fr-ca` → `fr-CA`, `zh-hant-hk` →
     * `zh-Hant-HK`). On duplicate normalized tags, the first entry
     * wins.
     *
     * **The caller must include the current page itself** in the
     * entries list — Google treats self-referential hreflang as
     * required, not optional.
     *
     * When fewer than 2 entries survive validation, nothing is emitted
     * (a single-locale page has no meaningful alternates). If you
     * prefer strict input checking, validate before passing in.
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
    canonical: string;
    noindex?: boolean;
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

    const canonical = props.canonical !== undefined ? props.canonical.toString() : pageUrl;

    const ogType = props.ogType ?? 'website';
    const ogImage = props.ogImage ?? '';

    const openGraph: AstroSeoProps['openGraph'] = {
        basic: {
            title: fullTitle,
            type: ogType,
            image: ogImage,
            url: canonical,
        },
    };

    const optional: NonNullable<AstroSeoProps['openGraph']['optional']> = {};
    if (props.description !== undefined) optional.description = props.description;
    if (props.siteName !== undefined) optional.siteName = props.siteName;
    optional.locale = props.locale ?? 'en_US';
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

    if (ogType === 'article' && props.article) {
        const article: NonNullable<AstroSeoProps['openGraph']['article']> = {};
        const published = toIsoString(props.article.publishedTime);
        if (published !== undefined) article.publishedTime = published;
        const modified = toIsoString(props.article.modifiedTime);
        if (modified !== undefined) article.modifiedTime = modified;
        const expiration = toIsoString(props.article.expirationTime);
        if (expiration !== undefined) article.expirationTime = expiration;
        if (props.article.authors !== undefined) article.authors = [...props.article.authors];
        if (props.article.tags !== undefined) article.tags = [...props.article.tags];
        if (props.article.section !== undefined) article.section = props.article.section;
        openGraph.article = article;
    }

    const astroSeo: AstroSeoProps = {
        title: fullTitle,
        canonical,
        openGraph,
    };

    if (props.description !== undefined) astroSeo.description = props.description;
    if (props.noindex) astroSeo.noindex = true;

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

    const hasExtraLinks = props.extraLinks !== undefined && props.extraLinks.length > 0;
    const hasExtraMeta = props.extraMeta !== undefined && props.extraMeta.length > 0;
    const hasAlternates = alternateLinks.length > 0;

    if (hasExtraLinks || hasExtraMeta || hasAlternates) {
        const extend: NonNullable<AstroSeoProps['extend']> = {};
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
        if (link.length > 0) extend.link = link;
        if (hasExtraMeta) {
            extend.meta = props.extraMeta!.map((meta) => ({ ...meta }));
        }
        astroSeo.extend = extend;
    }

    return astroSeo;
}
