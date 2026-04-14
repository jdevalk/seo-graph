/**
 * Project inferred page facts onto a "recommended graph" — the JSON-LD
 * a well-instrumented integrator would have emitted for this page.
 *
 * The recommender is deliberately conservative: it only emits entities
 * it has evidence for. A page with no breadcrumb markup won't get a
 * BreadcrumbList recommendation, for example. That way the diff stage
 * can distinguish "you didn't emit this" from "we couldn't tell what
 * you meant".
 *
 * Page classification is driven primarily by `og:type`, with
 * microdata signals (e.g. a `Product` itemscope) as a secondary input.
 * Unknown types fall back to WebPage.
 */
import {
    buildArticle,
    buildBreadcrumbList,
    buildImageObject,
    buildPiece,
    buildWebPage,
    buildWebSite,
    makeIds,
    type ArticleType,
    type WebPageType,
} from '@jdevalk/seo-graph-core';

import type { InferredFacts } from './infer.js';

/** Page classification used to drive which pieces get recommended. */
export type PageClassification =
    | 'Article'
    | 'BlogPosting'
    | 'NewsArticle'
    | 'WebPage'
    | 'ProfilePage'
    | 'CollectionPage'
    | 'Product';

/** Flat list of recommended entities, ready for diffing. */
export interface RecommendedGraph {
    /** The classification chosen for this page. */
    classification: PageClassification;
    /** Root URL of the site (derived from canonical/page URL). */
    siteUrl: string;
    /** The recommended `@graph` entries, in emission order. */
    entities: Array<Record<string, unknown>>;
}

/** Try to parse a URL's origin; falls back to the input if parsing fails. */
function originOf(url: string): string {
    try {
        return new URL(url).origin;
    } catch {
        return url;
    }
}

/**
 * Turn an OG locale like `en_US` into a BCP 47 tag (`en-US`). Leaves
 * already-hyphenated values alone. Null-safe.
 */
function normalizeLocale(value: string | undefined): string | undefined {
    return value?.includes('_') ? value.replace('_', '-') : value;
}

/**
 * Classify the page from its inferred facts.
 */
export function classifyPage(facts: InferredFacts): PageClassification {
    const og = facts.ogType?.value;

    // Microdata Product takes precedence — it's the strongest product signal.
    const hasProductMicrodata = facts.microdata.some((m) =>
        /schema\.org\/Product$/i.test(m.itemtype),
    );
    if (hasProductMicrodata || og === 'product') return 'Product';

    if (og === 'article') {
        // Pick a finer-grained subtype if the page's section is newsworthy.
        const section = facts.articleSection?.value.toLowerCase() ?? '';
        if (/\b(news|politics|breaking)\b/.test(section)) return 'NewsArticle';
        return 'BlogPosting';
    }

    if (og === 'profile') return 'ProfilePage';

    // Root URL with og:type="website" is typically the home / collection page.
    if (og === 'website') {
        try {
            const { pathname } = new URL(facts.url);
            if (pathname === '/' || pathname === '') return 'CollectionPage';
        } catch {
            // fall through
        }
    }

    return 'WebPage';
}

/**
 * Derive the site root URL from a page URL. Canonical takes precedence
 * when the inference produced one (it's more authoritative than the
 * crawl URL).
 */
function resolveSiteUrl(facts: InferredFacts): string {
    const source = facts.canonical?.value ?? facts.url;
    return originOf(source);
}

/**
 * Build the RecommendedGraph for a set of inferred facts.
 *
 * Always emits: WebSite, WebPage, and a publisher (Organization by
 * default, Person if there's no siteName and the author appears to
 * represent the site). Optionally emits: Article, BreadcrumbList,
 * primary ImageObject, author Person (distinct from publisher), and a
 * Product for commerce pages.
 */
export function recommend(facts: InferredFacts): RecommendedGraph {
    const classification = classifyPage(facts);
    const siteUrl = resolveSiteUrl(facts);
    const ids = makeIds({ siteUrl });
    const pageUrl = facts.canonical?.value ?? facts.url;
    const inLanguage = normalizeLocale(facts.locale?.value);

    const entities: Array<Record<string, unknown>> = [];

    // --- Publisher (Organization) ---
    // Every site gets a publisher entity. Without a siteName we still
    // emit an Organization pinned to the site root so references resolve.
    const publisherName = facts.siteName?.value ?? new URL(siteUrl).hostname;
    const orgSameAs: string[] = [];
    if (facts.twitterSite?.value) {
        const handle = facts.twitterSite.value.replace(/^@/, '');
        if (handle) orgSameAs.push(`https://twitter.com/${handle}`);
    }
    const publisherPiece = buildPiece({
        '@type': 'Organization',
        '@id': ids.organization('publisher'),
        name: publisherName,
        url: siteUrl,
        ...(orgSameAs.length > 0 ? { sameAs: orgSameAs } : {}),
    });
    entities.push(publisherPiece);

    // --- Author (Person), distinct from publisher when present and named ---
    let authorRef: { '@id': string; name?: string } | undefined;
    if (facts.author && (facts.author.name || facts.author.url)) {
        // Anchor the Person id on the author's URL when we have one,
        // else the site root. Match core's `${url-with-trailing-slash}#/...`
        // convention so ids line up with joost.blog's pattern.
        const personBase = facts.author.url
            ? facts.author.url.endsWith('/')
                ? facts.author.url
                : `${facts.author.url}/`
            : `${siteUrl}/`;
        const personId = `${personBase}#/schema.org/Person`;
        entities.push(
            buildPiece({
                '@type': 'Person',
                '@id': personId,
                ...(facts.author.name ? { name: facts.author.name } : {}),
                ...(facts.author.url ? { url: facts.author.url } : {}),
            }),
        );
        authorRef = facts.author.name
            ? { '@id': personId, name: facts.author.name }
            : { '@id': personId };
    }

    // --- WebSite ---
    entities.push(
        buildWebSite(
            {
                url: siteUrl,
                name: publisherName,
                publisher: { '@id': ids.organization('publisher') },
                ...(inLanguage ? { inLanguage } : {}),
            },
            ids,
        ),
    );

    // --- Primary ImageObject (optional) ---
    let primaryImageRef: { '@id': string } | undefined;
    if (facts.primaryImage) {
        // ImageObject requires width/height in core. Skip when unknown —
        // recommending a half-formed image would fail the builder.
        if (facts.primaryImage.width && facts.primaryImage.height) {
            entities.push(
                buildImageObject(
                    {
                        pageUrl,
                        url: facts.primaryImage.url,
                        width: facts.primaryImage.width,
                        height: facts.primaryImage.height,
                        ...(facts.primaryImage.alt ? { caption: facts.primaryImage.alt } : {}),
                        ...(inLanguage ? { inLanguage } : {}),
                    },
                    ids,
                ),
            );
            primaryImageRef = { '@id': ids.primaryImage(pageUrl) };
        }
    }

    // --- BreadcrumbList (optional) ---
    let breadcrumbRef: { '@id': string } | undefined;
    if (facts.breadcrumbs.length > 0) {
        const items = facts.breadcrumbs
            .filter((b) => b.url) // BreadcrumbItem requires a URL
            .map((b) => ({ name: b.name, url: b.url! }));
        if (items.length > 0) {
            entities.push(
                buildBreadcrumbList(
                    {
                        url: pageUrl,
                        items,
                    },
                    ids,
                ),
            );
            breadcrumbRef = { '@id': ids.breadcrumb(pageUrl) };
        }
    }

    // --- WebPage ---
    const webPageType: WebPageType =
        classification === 'ProfilePage'
            ? 'ProfilePage'
            : classification === 'CollectionPage'
              ? 'CollectionPage'
              : 'WebPage';
    // WebPage inputs extend CreativeWorkFields, so datePublished /
    // dateModified carry across even for non-Article pages. Use the
    // inferred dates when we have them — a homepage with a recent
    // `article:modified_time` should reflect that on its WebPage too.
    const webPagePublished = facts.datePublished?.value
        ? new Date(facts.datePublished.value)
        : undefined;
    const webPageModified = facts.dateModified?.value
        ? new Date(facts.dateModified.value)
        : undefined;
    entities.push(
        buildWebPage(
            {
                url: pageUrl,
                name: facts.title?.value ?? facts.h1?.value ?? pageUrl,
                isPartOf: { '@id': ids.website },
                ...(facts.description ? { description: facts.description.value } : {}),
                ...(breadcrumbRef ? { breadcrumb: breadcrumbRef } : {}),
                ...(primaryImageRef ? { primaryImage: primaryImageRef } : {}),
                ...(inLanguage ? { inLanguage } : {}),
                ...(webPagePublished && !Number.isNaN(webPagePublished.getTime())
                    ? { datePublished: webPagePublished }
                    : {}),
                ...(webPageModified && !Number.isNaN(webPageModified.getTime())
                    ? { dateModified: webPageModified }
                    : {}),
            },
            ids,
            webPageType,
        ),
    );

    // --- Article (optional) ---
    if (
        classification === 'Article' ||
        classification === 'BlogPosting' ||
        classification === 'NewsArticle'
    ) {
        const publishedIso = facts.datePublished?.value;
        if (publishedIso) {
            const publishedDate = new Date(publishedIso);
            if (!Number.isNaN(publishedDate.getTime())) {
                const articleType: ArticleType =
                    classification === 'NewsArticle'
                        ? 'NewsArticle'
                        : classification === 'Article'
                          ? 'Article'
                          : 'BlogPosting';
                entities.push(
                    buildArticle(
                        {
                            url: pageUrl,
                            isPartOf: { '@id': ids.webPage(pageUrl) },
                            author: authorRef ?? { '@id': ids.organization('publisher') },
                            publisher: { '@id': ids.organization('publisher') },
                            headline: facts.title?.value ?? facts.h1?.value ?? '',
                            description: facts.description?.value ?? '',
                            datePublished: publishedDate,
                            ...(facts.dateModified?.value
                                ? { dateModified: new Date(facts.dateModified.value) }
                                : {}),
                            ...(primaryImageRef ? { image: primaryImageRef } : {}),
                            ...(facts.articleSection
                                ? { articleSection: facts.articleSection.value }
                                : {}),
                            ...(inLanguage ? { inLanguage } : {}),
                        },
                        ids,
                        articleType,
                    ),
                );
            }
        }
    }

    // --- Product (optional, from microdata) ---
    if (classification === 'Product') {
        const productItem = facts.microdata.find((m) => /schema\.org\/Product$/i.test(m.itemtype));
        if (productItem) {
            const name = productItem.props.name ?? facts.title?.value ?? facts.h1?.value ?? '';
            entities.push(
                buildPiece({
                    '@type': 'Product',
                    '@id': `${pageUrl}#product`,
                    name,
                    ...(productItem.props.description
                        ? { description: productItem.props.description }
                        : facts.description
                          ? { description: facts.description.value }
                          : {}),
                    ...(productItem.props.sku ? { sku: productItem.props.sku } : {}),
                    ...(productItem.props.brand ? { brand: productItem.props.brand } : {}),
                    ...(productItem.props.image
                        ? { image: productItem.props.image }
                        : facts.primaryImage
                          ? { image: facts.primaryImage.url }
                          : {}),
                }),
            );
        }
    }

    return { classification, siteUrl, entities };
}
