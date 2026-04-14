/**
 * Infer a page's "true facts" from its HTML — everything a well-authored
 * page says about itself outside its JSON-LD block. The output is the
 * input to `recommend.ts`, which projects these facts into a
 * seo-graph-core recommended graph that's then diffed against the
 * page's actual JSON-LD.
 *
 * Every field carries a `source` tag so the recommender (and anyone
 * reading the report) can tell whether a value came from a strong
 * signal (OpenGraph, microdata, visible content) or a weaker one
 * (a heuristic DOM selector). When multiple sources disagree we keep
 * the strongest.
 *
 * Parsing is deliberately conservative: we don't follow links, we
 * don't render JavaScript, we don't infer meanings that aren't
 * directly encoded. If a page doesn't expose a fact via its HTML, we
 * won't invent one — the recommender will just decline to suggest an
 * entity that depends on it.
 */
import * as cheerio from 'cheerio';

/** Source tag so downstream code can gauge signal strength. */
export type FactSource =
    | 'og' // OpenGraph meta
    | 'twitter' // Twitter card meta
    | 'html-meta' // generic <meta name>
    | 'link' // <link rel>
    | 'title' // <title>
    | 'html-lang' // <html lang>
    | 'heading' // <h1>
    | 'rel-author' // <a rel="author">
    | 'article-byline' // <.byline>, <[itemprop="author"]>, etc.
    | 'time-element' // <time datetime>
    | 'img' // <img>
    | 'breadcrumb-nav' // <nav aria-label="breadcrumb"> / .breadcrumb
    | 'microdata'; // itemtype + itemprop

/** A single inferred value plus the DOM hook it came from. */
export interface Fact<T = string> {
    value: T;
    source: FactSource;
}

/** Minimum shape we infer for an author or organisation. */
export interface PersonOrOrgFact {
    name: string;
    url?: string;
    source: FactSource;
}

export interface ImageFact {
    url: string;
    alt?: string;
    width?: number;
    height?: number;
    source: FactSource;
}

export interface BreadcrumbFact {
    /** 1-based position in the trail. */
    position: number;
    name: string;
    /** Absolute or relative href; may be absent for the current page. */
    url?: string;
    source: FactSource;
}

/** Microdata group: `<element itemscope itemtype="...">` + its itemprops. */
export interface MicrodataItem {
    /** The schema.org URL from `itemtype`. */
    itemtype: string;
    /** Flattened itemprop → string value map (first occurrence wins). */
    props: Record<string, string>;
}

/**
 * The full fact set inferred from a page. Every field is optional —
 * pages vary wildly. The recommender reads whichever are present and
 * degrades gracefully.
 */
export interface InferredFacts {
    /** Absolute URL of the page (always populated from the scan request). */
    url: string;
    title?: Fact;
    description?: Fact;
    canonical?: Fact;
    /** OpenGraph type: 'website', 'article', 'product', 'profile', etc. */
    ogType?: Fact;
    /** OG `og:site_name`. Strong signal for WebSite entity. */
    siteName?: Fact;
    /** Either `og:locale` or `<html lang>`, prefers OG. */
    locale?: Fact;
    /** ISO date/datetime. Either `article:published_time` or `<time datetime>`. */
    datePublished?: Fact;
    /** ISO date/datetime from `article:modified_time` when present. */
    dateModified?: Fact;
    /** Article section ("Opinion", "Tech"), usually from `article:section`. */
    articleSection?: Fact;
    /** Primary author. Aggregated across OG, rel=author, byline markup. */
    author?: PersonOrOrgFact;
    /** Publishing organisation. Usually `og:site_name` + logo. */
    publisher?: PersonOrOrgFact;
    /** Primary H1 text — useful as a fallback headline. */
    h1?: Fact;
    /** Primary share/featured image. */
    primaryImage?: ImageFact;
    /** All images found in the document body (not head). */
    allImages: ImageFact[];
    /** Breadcrumb trail, in order. */
    breadcrumbs: BreadcrumbFact[];
    /** Raw microdata islands on the page. */
    microdata: MicrodataItem[];
    /** Twitter handle (`@site`) from `twitter:site` — useful for Organization sameAs. */
    twitterSite?: Fact;
}

/**
 * Attempt to resolve a relative URL against a base. Returns the input
 * unchanged if resolution fails (e.g. `javascript:` or malformed input).
 */
function resolveUrl(raw: string | undefined, base: string): string | undefined {
    if (!raw) return undefined;
    const trimmed = raw.trim();
    if (!trimmed) return undefined;
    try {
        return new URL(trimmed, base).toString();
    } catch {
        return trimmed;
    }
}

/**
 * Convert a number-ish attribute string ("1200", " 1200 ") to a number.
 * Returns undefined for non-numeric or negative values.
 */
function parseNumericAttr(raw: string | undefined): number | undefined {
    if (!raw) return undefined;
    const n = Number.parseInt(raw.trim(), 10);
    return Number.isFinite(n) && n >= 0 ? n : undefined;
}

/**
 * Infer page-level facts from an HTML string.
 *
 * @param html  Raw HTML body.
 * @param url   Page URL — used as the resolution base for relative
 *              attributes like `<img src>` and `<link href>`.
 */
export function inferFromHtml(html: string, url: string): InferredFacts {
    const $ = cheerio.load(html);
    const facts: InferredFacts = {
        url,
        allImages: [],
        breadcrumbs: [],
        microdata: [],
    };

    // --- Head scalars ---

    const ogTitle = $('meta[property="og:title"]').attr('content')?.trim();
    const plainTitle = $('title').first().text().trim();
    if (ogTitle) facts.title = { value: ogTitle, source: 'og' };
    else if (plainTitle) facts.title = { value: plainTitle, source: 'title' };

    const ogDesc = $('meta[property="og:description"]').attr('content')?.trim();
    const metaDesc = $('meta[name="description"]').attr('content')?.trim();
    if (ogDesc) facts.description = { value: ogDesc, source: 'og' };
    else if (metaDesc) facts.description = { value: metaDesc, source: 'html-meta' };

    const linkCanonical = $('link[rel="canonical"]').attr('href')?.trim();
    const ogUrl = $('meta[property="og:url"]').attr('content')?.trim();
    if (linkCanonical) facts.canonical = { value: resolveUrl(linkCanonical, url)!, source: 'link' };
    else if (ogUrl) facts.canonical = { value: resolveUrl(ogUrl, url)!, source: 'og' };

    const ogType = $('meta[property="og:type"]').attr('content')?.trim();
    if (ogType) facts.ogType = { value: ogType, source: 'og' };

    const siteName = $('meta[property="og:site_name"]').attr('content')?.trim();
    if (siteName) facts.siteName = { value: siteName, source: 'og' };

    const ogLocale = $('meta[property="og:locale"]').attr('content')?.trim();
    const htmlLang = $('html').attr('lang')?.trim();
    if (ogLocale) facts.locale = { value: ogLocale, source: 'og' };
    else if (htmlLang) facts.locale = { value: htmlLang, source: 'html-lang' };

    const published = $('meta[property="article:published_time"]').attr('content')?.trim();
    const modified = $('meta[property="article:modified_time"]').attr('content')?.trim();
    if (published) facts.datePublished = { value: published, source: 'og' };
    if (modified) facts.dateModified = { value: modified, source: 'og' };

    const section = $('meta[property="article:section"]').attr('content')?.trim();
    if (section) facts.articleSection = { value: section, source: 'og' };

    const twitterSite = $('meta[name="twitter:site"]').attr('content')?.trim();
    if (twitterSite) facts.twitterSite = { value: twitterSite, source: 'twitter' };

    // --- Primary image (share image) ---

    const ogImage = $('meta[property="og:image"]').attr('content')?.trim();
    const ogImageAlt = $('meta[property="og:image:alt"]').attr('content')?.trim();
    const ogImageW = parseNumericAttr($('meta[property="og:image:width"]').attr('content'));
    const ogImageH = parseNumericAttr($('meta[property="og:image:height"]').attr('content'));
    if (ogImage) {
        const resolved = resolveUrl(ogImage, url);
        if (resolved) {
            facts.primaryImage = {
                url: resolved,
                alt: ogImageAlt,
                width: ogImageW,
                height: ogImageH,
                source: 'og',
            };
        }
    }

    // --- H1 ---

    const h1Text = $('h1').first().text().replace(/\s+/g, ' ').trim();
    if (h1Text) facts.h1 = { value: h1Text, source: 'heading' };

    // --- Date fallback from <time datetime> ---

    if (!facts.datePublished) {
        const t = $('time[datetime]').first().attr('datetime')?.trim();
        if (t) facts.datePublished = { value: t, source: 'time-element' };
    }

    // --- Author inference ---
    //
    // Strongest: article:author OG tag (explicit publisher intent).
    // Next: <a rel="author">.
    // Weakest: visible byline nodes (.byline, .author, [itemprop="author"]).
    const ogAuthor = $('meta[property="article:author"]').attr('content')?.trim();
    const relAuthor = $('a[rel="author"]').first();
    const itempropAuthor = $('[itemprop="author"]').first();
    const bylineNode = $('.author, .byline, .post-author').first();

    if (ogAuthor) {
        // og:author is often a URL (Facebook profile) or a name. Treat
        // URLs as `url`, non-URL strings as `name`.
        const isUrl = /^https?:\/\//i.test(ogAuthor);
        facts.author = isUrl
            ? { name: '', url: ogAuthor, source: 'og' }
            : { name: ogAuthor, source: 'og' };
    } else if (relAuthor.length) {
        facts.author = {
            name: relAuthor.text().replace(/\s+/g, ' ').trim(),
            url: resolveUrl(relAuthor.attr('href'), url),
            source: 'rel-author',
        };
    } else if (itempropAuthor.length) {
        const name =
            itempropAuthor.find('[itemprop="name"]').first().text().trim() ||
            itempropAuthor.text().replace(/\s+/g, ' ').trim();
        const link = itempropAuthor.find('a[href]').first().attr('href');
        facts.author = {
            name,
            url: resolveUrl(link, url),
            source: 'microdata',
        };
    } else if (bylineNode.length) {
        const text = bylineNode.text().replace(/\s+/g, ' ').trim();
        if (text) {
            const link = bylineNode.find('a[href]').first().attr('href');
            facts.author = {
                name: text.replace(/^by\s+/i, ''),
                url: resolveUrl(link, url),
                source: 'article-byline',
            };
        }
    }

    // --- Publisher ---
    //
    // Typically the site itself. Use `og:site_name` for the name and
    // the page's origin as a fallback URL.
    if (facts.siteName) {
        facts.publisher = {
            name: facts.siteName.value,
            url: new URL(url).origin,
            source: 'og',
        };
    }

    // --- Images ---

    $('body img[src]').each((_, el) => {
        const src = $(el).attr('src');
        if (!src) return;
        const resolved = resolveUrl(src, url);
        if (!resolved) return;
        facts.allImages.push({
            url: resolved,
            alt: $(el).attr('alt'),
            width: parseNumericAttr($(el).attr('width')),
            height: parseNumericAttr($(el).attr('height')),
            source: 'img',
        });
    });

    // --- Breadcrumbs ---
    //
    // Prefer explicit microdata. Fall back to `<nav aria-label="breadcrumb">`.
    // In both cases, follow link text and `href` per item.
    const microdataBread = $('[itemtype$="BreadcrumbList"]').first();
    if (microdataBread.length) {
        microdataBread.find('[itemprop="itemListElement"]').each((i, el) => {
            const $el = $(el);
            const name =
                $el.find('[itemprop="name"]').first().text().trim() ||
                $el.text().replace(/\s+/g, ' ').trim();
            const href =
                $el.find('[itemprop="item"]').first().attr('href') ??
                $el.find('a[href]').first().attr('href');
            if (name) {
                facts.breadcrumbs.push({
                    position: i + 1,
                    name,
                    url: resolveUrl(href, url),
                    source: 'microdata',
                });
            }
        });
    } else {
        const nav = $(
            'nav[aria-label="breadcrumb" i], nav.breadcrumb, .breadcrumb, .breadcrumbs',
        ).first();
        if (nav.length) {
            const items = nav.find('a, li').toArray();
            let pos = 0;
            for (const node of items) {
                const $node = $(node);
                const name = $node.text().replace(/\s+/g, ' ').trim();
                if (!name) continue;
                const href = $node.is('a') ? $node.attr('href') : $node.find('a').attr('href');
                pos += 1;
                facts.breadcrumbs.push({
                    position: pos,
                    name,
                    url: resolveUrl(href, url),
                    source: 'breadcrumb-nav',
                });
            }
        }
    }

    // --- Microdata islands (generic) ---
    //
    // Flat: one entry per itemscope, props are the immediate itemprop
    // descendants as string values. Useful for Product, Event, Recipe
    // etc. detection in `recommend.ts`.
    $('[itemscope][itemtype]').each((_, el) => {
        const $el = $(el);
        const itemtype = $el.attr('itemtype')?.trim();
        if (!itemtype) return;
        const props: Record<string, string> = {};
        $el.find('[itemprop]').each((_, propEl) => {
            const $p = $(propEl);
            const name = $p.attr('itemprop')?.trim();
            if (!name || props[name] !== undefined) return;
            const value =
                $p.attr('content') ??
                $p.attr('href') ??
                $p.attr('src') ??
                $p.attr('datetime') ??
                $p.text().replace(/\s+/g, ' ').trim();
            if (value) props[name] = value;
        });
        facts.microdata.push({ itemtype, props });
    });

    return facts;
}
