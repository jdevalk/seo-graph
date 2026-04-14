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

import type { OrganizationFacts } from './contact.js';
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

/**
 * Well-known Organization subtypes we're willing to recommend. Kept
 * narrow on purpose — recommending an aggressive subtype (e.g. LocalBusiness
 * when there's only weak evidence) would be noisier than just defaulting
 * to Organization.
 */
export type OrganizationType =
    | 'Organization'
    | 'NewsMediaOrganization'
    | 'GovernmentOrganization'
    | 'EducationalOrganization'
    | 'Corporation'
    | 'NGO'
    | 'OnlineBusiness'
    | 'LocalBusiness'
    | 'Restaurant'
    | 'Store'
    | 'Hotel';

/** Known Organization-adjacent schema.org types we'll preserve verbatim from live JSON-LD. */
const KNOWN_ORG_SUBTYPES = new Set<string>([
    'Organization',
    'NewsMediaOrganization',
    'GovernmentOrganization',
    'EducationalOrganization',
    'CollegeOrUniversity',
    'School',
    'ResearchOrganization',
    'Corporation',
    'NGO',
    'OnlineBusiness',
    'LocalBusiness',
    'Restaurant',
    'Store',
    'Hotel',
    'MedicalOrganization',
    'SportsOrganization',
    'PerformingGroup',
    'LibrarySystem',
]);

export interface RecommendOptions {
    /**
     * Live JSON-LD entities the page already emits. When provided, the
     * recommender preserves any Organization subtype the site has
     * explicitly declared, rather than downgrading it to `Organization`.
     */
    liveEntities?: ReadonlyArray<Record<string, unknown>>;
    /**
     * Facts harvested from the site's contact/about/imprint page
     * (business registration ids, VAT, phones, legal form, non-profit
     * keywords). Typically produced once per scan by
     * `extractOrganizationFactsFromHtml` and reused across every page
     * on the site. Drives both subtype inference and enrichment of
     * the publisher Organization entity.
     */
    contactFacts?: OrganizationFacts;
}

/** Flat list of recommended entities, ready for diffing. */
export interface RecommendedGraph {
    /** The classification chosen for this page. */
    classification: PageClassification;
    /** Organization subtype we recommend for the publisher. */
    organizationType: OrganizationType | string;
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
 * Extract the plain @type string from an entity, ignoring array forms.
 * Returns the first string in an array-of-types so we can still match
 * against KNOWN_ORG_SUBTYPES for multi-typed entities.
 */
function primaryType(entity: Record<string, unknown>): string | undefined {
    const t = entity['@type'];
    if (typeof t === 'string') return t;
    if (Array.isArray(t)) {
        const first = t.find((v): v is string => typeof v === 'string');
        return first;
    }
    return undefined;
}

/**
 * Host patterns that identify government domains. Each regex is
 * anchored at the end of the hostname so subdomains match naturally
 * (`digital.service.gov.uk` matches `.gov.uk`).
 */
const GOVERNMENT_HOST_PATTERNS: RegExp[] = [
    /\.gov(\.[a-z]{2,})?$/, // .gov (US federal), .gov.uk, .gov.au, .gov.nl, .gov.sg, etc.
    /\.mil$/, // US military
    /\.gob(\.[a-z]{2,})?$/, // Spanish / Latin American government (.gob.mx, .gob.ar, .gob.es)
    /\.gouv\.fr$/, // France — central government portal
    /\.gc\.ca$/, // Government of Canada
    /\.go\.jp$/, // Japan — central/local government
    /\.bund\.de$/, // Germany — federal government
    /\.overheid\.nl$/, // Netherlands — government portal
];

/** Academic-domain patterns — catches institutional hosts outside `.edu`. */
const EDUCATION_HOST_PATTERNS: RegExp[] = [
    /\.edu(\.[a-z]{2,})?$/, // .edu (US), .edu.au, .edu.sg, etc.
    /\.ac\.[a-z]{2,}$/, // .ac.uk, .ac.jp, .ac.at, .ac.nz, etc. (academic second-level)
];

/** News-org host patterns. */
const NEWS_HOST_PATTERNS: RegExp[] = [
    /^news\./, // news.bbc.co.uk, news.ycombinator.com, etc.
    /\.news$/, // the `.news` gTLD
];

/** Itemprops on a bare-`Organization` microdata island that imply LocalBusiness. */
const LOCAL_BUSINESS_MICRODATA_PROPS = ['telephone', 'address', 'openingHours'];

/**
 * Pick the most specific Organization subtype to recommend, honoring
 * signals in this order (strongest first):
 *
 *   1. Whatever the site already declares in its JSON-LD. If a live
 *      entity's @type is a known Organization subtype (e.g.
 *      NewsMediaOrganization, LocalBusiness), we preserve it — never
 *      downgrade a caller's explicit choice.
 *   2. A specific subtype encoded in page microdata (`<div itemtype="…Restaurant">`).
 *   3. A bare-`Organization` microdata island that carries LocalBusiness
 *      itemprops (`telephone`, `address`, `openingHours`).
 *   4. URL host matches a known government pattern (`.gov*`, `.mil`,
 *      `.gouv.fr`, `.gc.ca`, `.go.jp`, `.bund.de`, `.overheid.nl`, etc.).
 *   5. URL host matches a known academic pattern (`.edu*`, `.ac.<cc>`).
 *   6. URL host matches a news pattern (`news.*` subdomain or `.news` TLD).
 *   7. Page-level classification — if this page itself reads as a
 *      NewsArticle, the publisher is almost certainly news.
 *   8. Fall back to the generic `Organization`.
 *
 * The id scheme keeps `/#/schema.org/Organization/publisher` regardless
 * of the subtype chosen; the URL is an opaque identifier, not a type
 * assertion, and keeping it stable matches core's convention.
 */
export function inferOrganizationType(
    facts: InferredFacts,
    liveEntities: ReadonlyArray<Record<string, unknown>> = [],
    contactFacts?: OrganizationFacts,
): OrganizationType | string {
    // 1. Preserve existing subtype in live JSON-LD.
    for (const entity of liveEntities) {
        const t = primaryType(entity);
        if (t && t !== 'Organization' && KNOWN_ORG_SUBTYPES.has(t)) return t;
    }

    // 2. Specific Organization subtype in microdata itemtype.
    for (const item of facts.microdata) {
        const match = item.itemtype.match(/schema\.org\/(\w+)$/);
        const type = match?.[1];
        if (type && type !== 'Organization' && KNOWN_ORG_SUBTYPES.has(type)) return type;
    }

    // 3. Bare-Organization microdata island carrying LocalBusiness props.
    for (const item of facts.microdata) {
        const match = item.itemtype.match(/schema\.org\/(\w+)$/);
        const type = match?.[1];
        if (type !== 'Organization') continue;
        if (LOCAL_BUSINESS_MICRODATA_PROPS.some((prop) => item.props[prop])) {
            return 'LocalBusiness';
        }
    }

    // 4. Contact-page signals. Non-profit keywords are the most
    //    directive ("Stichting", "e.V.", "501(c)(3)"). After that,
    //    business-registration ids + a visible phone number suggest a
    //    LocalBusiness (they're findable), while ids alone suggest a
    //    straight Corporation.
    if (contactFacts) {
        if (contactFacts.isNonProfit) return 'NGO';
        const hasBusinessId = contactFacts.identifiers.length > 0 || contactFacts.vatIds.length > 0;
        if (hasBusinessId) {
            return contactFacts.telephones.length > 0 ? 'LocalBusiness' : 'Corporation';
        }
        // No id but a phone on the contact page — still reasonable to
        // treat as LocalBusiness (weaker signal, so ranked below ids).
        if (contactFacts.telephones.length > 0) return 'LocalBusiness';
    }

    // 5–7. Host-based heuristics.
    let host = '';
    try {
        host = new URL(facts.url).hostname.toLowerCase();
    } catch {
        // Malformed URL — fall straight through to the default below.
    }
    if (host) {
        if (GOVERNMENT_HOST_PATTERNS.some((re) => re.test(host))) return 'GovernmentOrganization';
        if (EDUCATION_HOST_PATTERNS.some((re) => re.test(host))) return 'EducationalOrganization';
        if (NEWS_HOST_PATTERNS.some((re) => re.test(host))) return 'NewsMediaOrganization';
    }

    // 8. Page classification signal — NewsArticle implies a news publisher.
    if (classifyPage(facts) === 'NewsArticle') return 'NewsMediaOrganization';

    return 'Organization';
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
export function recommend(facts: InferredFacts, options: RecommendOptions = {}): RecommendedGraph {
    const classification = classifyPage(facts);
    const organizationType = inferOrganizationType(
        facts,
        options.liveEntities,
        options.contactFacts,
    );
    const siteUrl = resolveSiteUrl(facts);
    const ids = makeIds({ siteUrl });
    const pageUrl = facts.canonical?.value ?? facts.url;
    const inLanguage = normalizeLocale(facts.locale?.value);

    const entities: Array<Record<string, unknown>> = [];

    // --- Publisher (Organization subtype) ---
    // Every site gets a publisher entity. Without a siteName we still
    // emit an Organization pinned to the site root so references resolve.
    // The subtype (Organization, NewsMediaOrganization, LocalBusiness,
    // GovernmentOrganization, etc.) comes from `inferOrganizationType`.
    const publisherName = facts.siteName?.value ?? new URL(siteUrl).hostname;

    // Merge `sameAs` from Twitter handle + public-registry deep links
    // harvested from the contact page. Dedupe so repeated mentions
    // don't produce duplicate entries.
    const sameAsSet = new Set<string>();
    if (facts.twitterSite?.value) {
        const handle = facts.twitterSite.value.replace(/^@/, '');
        if (handle) sameAsSet.add(`https://twitter.com/${handle}`);
    }
    for (const url of options.contactFacts?.registrySameAs ?? []) sameAsSet.add(url);

    // Shape identifiers from the contact page into schema.org PropertyValues.
    const identifiers = (options.contactFacts?.identifiers ?? []).map((id) => ({
        '@type': 'PropertyValue' as const,
        propertyID: id.kind,
        value: id.value,
    }));

    const contactFacts = options.contactFacts;
    const publisherPiece = buildPiece({
        '@type': organizationType,
        '@id': ids.organization('publisher'),
        name: publisherName,
        url: siteUrl,
        ...(identifiers.length > 0 ? { identifier: identifiers } : {}),
        ...(contactFacts?.vatIds[0] ? { vatID: contactFacts.vatIds[0] } : {}),
        ...(contactFacts?.telephones[0] ? { telephone: contactFacts.telephones[0] } : {}),
        ...(contactFacts?.legalForm && !publisherName.includes(contactFacts.legalForm)
            ? { legalName: `${publisherName} ${contactFacts.legalForm}` }
            : {}),
        ...(sameAsSet.size > 0 ? { sameAs: [...sameAsSet] } : {}),
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

    return { classification, organizationType, siteUrl, entities };
}
