/**
 * Normalized, flat, render-ready projection of `SeoProps`. The `<Seo>`
 * template consumes this directly — no further reshaping, no
 * conditionals beyond "field present?". Keeping normalization here (pure
 * TypeScript) means vitest can assert on every decision without touching
 * Astro's renderer.
 */

import { buildAlternateLinks, type AlternateLink } from '../alternates.js';
import type { SeoProps } from './seo-props.js';

/**
 * Opted-in robots directives for maximum snippet and preview sizes in
 * search results. Appended after any `noindex`/`nofollow` prefix.
 */
export const ROBOTS_EXTRAS = 'max-snippet:-1, max-image-preview:large, max-video-preview:-1';

/**
 * Render-ready normalization of `SeoProps`. Every field has been resolved
 * against defaults, every `Date` coerced to ISO string, every optional
 * block either populated or omitted. Templates just iterate.
 */
export interface SeoContext {
    /** Final `<title>` text, with `titleTemplate` already applied. */
    title: string;
    /** Meta description. Omitted from output when undefined. */
    description?: string;
    /**
     * Canonical URL. Already query-stripped (or preserved) per
     * `preserveQueryParams`. `undefined` when the page is `noindex` —
     * callers must not emit a canonical in that case.
     */
    canonical?: string;
    /** Resolved robots directives. Always present (extras always apply). */
    robots: {
        noindex: boolean;
        nofollow: boolean;
        /** Directives beyond noindex/nofollow — typically `ROBOTS_EXTRAS`. */
        extras: string;
    };
    /**
     * Open Graph fields. `title`, `type`, `url` are always populated.
     * `image` may be an empty string when no share image was provided.
     */
    og: {
        title: string;
        type: string;
        image: string;
        url: string;
        description?: string;
        siteName?: string;
        locale: string;
        localeAlternate?: readonly string[];
        imageAlt?: string;
        imageWidth?: number;
        imageHeight?: number;
        article?: {
            publishedTime?: string;
            modifiedTime?: string;
            expirationTime?: string;
            authors?: readonly string[];
            tags?: readonly string[];
            section?: string;
            publisher?: string;
        };
    };
    /** Twitter tags. Omitted entirely when the caller passed no `twitter` block. */
    twitter?: {
        card: 'summary' | 'summary_large_image' | 'app' | 'player';
        site?: string;
        creator?: string;
        title?: string;
        description?: string;
        image?: string;
        imageAlt?: string;
    };
    /**
     * hreflang alternate entries (including `x-default`). Empty array when
     * the caller passed no `alternates`, or when fewer than 2 entries
     * survive validation.
     */
    hreflangs: readonly AlternateLink[];
    /** Resolved author name for `<meta name="author">`. */
    authorName?: string;
    /** Passthrough extras. Empty arrays when not provided. */
    extraLinks: ReadonlyArray<Record<string, string>>;
    extraMeta: ReadonlyArray<Record<string, string>>;
    /** JSON-LD graph to inject. `null`/`undefined` → skip the script tag. */
    graph?: Record<string, unknown> | null;
}

function toIsoString(value: Date | string | undefined): string | undefined {
    if (value === undefined) return undefined;
    return value instanceof Date ? value.toISOString() : value;
}

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
 * Build the flat `SeoContext` from user-provided `SeoProps` and the
 * current page URL (usually `Astro.url.href`). Pure function; no Astro
 * runtime access.
 *
 * Invariants worth knowing:
 *   - `canonical` is omitted when `noindex` is true (Google recommendation).
 *   - `og:url` falls back to the query-stripped page URL when canonical
 *     is omitted, so share previews stay stable even on noindex pages.
 *   - Twitter override fields are suppressed when they equal their OG
 *     counterparts (Twitter falls back to OG automatically, so emitting
 *     the duplicate is noise).
 *   - `og:locale:alternate` is derived from `alternates` by converting
 *     hyphenated BCP 47 to underscore form and skipping entries that
 *     match the primary locale.
 */
export function buildSeoContext(props: SeoProps, pageUrl: string): SeoContext {
    const fullTitle = props.titleTemplate
        ? props.titleTemplate.replace('%s', props.title)
        : props.title;

    // Canonical: explicit > preserveQueryParams > strip query. Omitted
    // entirely when noindex (Google recommendation).
    let canonical: string | undefined;
    if (props.canonical !== undefined) {
        canonical = props.canonical.toString();
    } else if (props.preserveQueryParams) {
        canonical = pageUrl;
    } else {
        canonical = stripQueryParams(pageUrl);
    }
    if (props.noindex) canonical = undefined;

    // og:url still points at the canonical or stripped page URL even
    // when canonical is omitted — share previews shouldn't carry query
    // params.
    const ogUrl = canonical ?? stripQueryParams(pageUrl);

    const ogType = props.ogType ?? 'website';
    const ogImage = props.ogImage ?? '';
    const locale = props.locale ?? 'en_US';

    const og: SeoContext['og'] = {
        title: fullTitle,
        type: ogType,
        image: ogImage,
        url: ogUrl,
        locale,
    };
    if (props.description !== undefined) og.description = props.description;
    if (props.siteName !== undefined) og.siteName = props.siteName;

    // og:locale:alternate: convert hyphens → underscores, skip dupes, skip
    // the primary locale, and skip language-only entries whose language
    // already matches the primary.
    if (props.alternates?.entries && props.alternates.entries.length > 1) {
        const primaryLang = locale.split('_')[0]?.toLowerCase();
        const localeAlternate: string[] = [];
        const seen = new Set<string>();
        for (const entry of props.alternates.entries) {
            const ogLocale = entry.hreflang.replace('-', '_');
            const entryLang = entry.hreflang.split('-')[0]?.toLowerCase();
            if (seen.has(ogLocale)) continue;
            if (ogLocale === locale) continue;
            if (!entry.hreflang.includes('-') && entryLang === primaryLang) continue;
            seen.add(ogLocale);
            localeAlternate.push(ogLocale);
        }
        if (localeAlternate.length > 0) og.localeAlternate = localeAlternate;
    }

    // OG image metadata: only when at least one dimension/alt is set, and
    // only when an image URL is actually present (width/height without a
    // URL is meaningless).
    if (ogImage) {
        if (props.ogImageAlt !== undefined) og.imageAlt = props.ogImageAlt;
        if (props.ogImageWidth !== undefined) og.imageWidth = props.ogImageWidth;
        if (props.ogImageHeight !== undefined) og.imageHeight = props.ogImageHeight;
    }

    // Article metadata: only when ogType === 'article'.
    if (ogType === 'article' && (props.article || props.articlePublisher)) {
        const article: NonNullable<SeoContext['og']['article']> = {};
        if (props.article) {
            const published = toIsoString(props.article.publishedTime);
            if (published !== undefined) article.publishedTime = published;
            const modified = toIsoString(props.article.modifiedTime);
            if (modified !== undefined) article.modifiedTime = modified;
            const expiration = toIsoString(props.article.expirationTime);
            if (expiration !== undefined) article.expirationTime = expiration;
            if (props.article.authors !== undefined) article.authors = props.article.authors;
            if (props.article.tags !== undefined) article.tags = props.article.tags;
            if (props.article.section !== undefined) article.section = props.article.section;
        }
        if (props.articlePublisher !== undefined) article.publisher = props.articlePublisher;
        og.article = article;
    }

    // Twitter: suppress overrides that equal their OG counterpart.
    let twitter: SeoContext['twitter'];
    if (props.twitter !== undefined) {
        const t: NonNullable<SeoContext['twitter']> = {
            card: props.twitter.card ?? 'summary_large_image',
        };
        if (props.twitter.site !== undefined) t.site = props.twitter.site;
        if (props.twitter.creator !== undefined) t.creator = props.twitter.creator;
        if (props.twitter.title !== undefined && props.twitter.title !== fullTitle) {
            t.title = props.twitter.title;
        }
        if (
            props.twitter.description !== undefined &&
            props.twitter.description !== props.description
        ) {
            t.description = props.twitter.description;
        }
        if (props.twitter.image !== undefined && props.twitter.image !== ogImage) {
            t.image = props.twitter.image;
        }
        if (props.twitter.imageAlt !== undefined && props.twitter.imageAlt !== props.ogImageAlt) {
            t.imageAlt = props.twitter.imageAlt;
        }
        twitter = t;
    }

    const hreflangs =
        props.alternates !== undefined ? buildAlternateLinks(props.alternates) : [];

    const authorName = props.author ?? props.article?.authors?.[0];

    const ctx: SeoContext = {
        title: fullTitle,
        robots: {
            noindex: props.noindex === true,
            nofollow: props.nofollow === true,
            extras: ROBOTS_EXTRAS,
        },
        og,
        hreflangs,
        extraLinks: props.extraLinks ?? [],
        extraMeta: props.extraMeta ?? [],
    };
    if (canonical !== undefined) ctx.canonical = canonical;
    if (props.description !== undefined) ctx.description = props.description;
    if (twitter !== undefined) ctx.twitter = twitter;
    if (authorName !== undefined) ctx.authorName = authorName;
    if (props.graph !== undefined) ctx.graph = props.graph;

    return ctx;
}
