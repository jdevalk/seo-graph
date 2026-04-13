/**
 * Public props surface of the <Seo> component. The `.astro` template
 * normalizes these via `buildSeoContext` (in `seo-context.ts`) and
 * renders the resulting flat shape directly — no intermediate adapter.
 */

import type { BuildAlternateLinksInput } from '../alternates.js';

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
    /**
     * Twitter card metadata. Only Twitter-specific tags (card, site,
     * creator) are emitted by default — twitter:title, :description,
     * :image, and :image:alt fall back to their `og:` counterparts
     * automatically. Set `title`, `description`, `image`, or `imageAlt`
     * here only when you want Twitter-specific content that differs
     * from the OG values.
     */
    twitter?: {
        /** Twitter handle of the site owner, e.g. `'@jdevalk'`. */
        site?: string;
        /** Twitter handle of the author. */
        creator?: string;
        /** Card type. Defaults to `'summary_large_image'`. */
        card?: 'summary' | 'summary_large_image' | 'app' | 'player';
        /** Override twitter:title. Omit to fall back to og:title. */
        title?: string;
        /** Override twitter:description. Omit to fall back to og:description. */
        description?: string;
        /** Override twitter:image. Omit to fall back to og:image. */
        image?: string;
        /** Override twitter:image:alt. Omit to fall back to og:image:alt. */
        imageAlt?: string;
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
