import {
    extractOrganizationFactsFromHtml,
    pickContactUrl,
    type OrganizationFacts,
} from './contact.js';
import { diffRecommendedVsLive, flattenLiveEntities, type DiffOptions } from './diff.js';
import { extractFromHtml } from './extract.js';
import { fetchHtml, type FetchOptions } from './fetcher.js';
import { inferFromHtml, type InferredFacts } from './infer.js';
import { recommend, type PageClassification, type RecommendedGraph } from './recommend.js';
import { discoverFromSitemap, type DiscoverOptions } from './sitemap.js';
import { validateBlock, type Finding, type ValidatedBlock } from './validate.js';

export interface RecommendOptions {
    /**
     * Enable the HTML-inference → recommended-graph → diff pipeline.
     * When `true`, each page is additionally audited against a graph
     * the scanner *would have* emitted based on the page's HTML, and
     * any gaps show up in `findings`. Defaults to `true`.
     */
    enabled?: boolean;
    /** Forwarded to the diff step. See `DiffOptions` for details. */
    diff?: DiffOptions;
    /**
     * Contact-page extraction. When enabled, the scanner discovers a
     * contact/imprint page from the sitemap, fetches it once, and
     * feeds the extracted facts (business ids, VAT, phones, legal
     * form) into every per-page recommendation so the publisher
     * Organization entity is richer. Defaults to `true`.
     */
    contact?: {
        enabled?: boolean;
        /** Explicit contact page URL — overrides auto-discovery. */
        url?: string;
    };
}

export interface ScanOptions {
    sitemap: DiscoverOptions;
    fetch?: FetchOptions;
    /**
     * Recommendation/diff controls. Omit to run with defaults
     * (enabled, no spurious-entity reporting).
     */
    recommend?: RecommendOptions;
}

export interface PageReport {
    url: string;
    status: number;
    fetchError?: string;
    title?: string;
    ogType?: string;
    canonical?: string;
    blocks: ValidatedBlock[];
    findings: Finding[];
    /** Page classification from the recommender, when enabled. */
    classification?: PageClassification;
    /** The inferred facts used to build the recommendation. */
    inferred?: InferredFacts;
    /** The recommended graph — useful for debugging / offline diffs. */
    recommended?: RecommendedGraph;
}

export interface ScanReport {
    sitemapUrl: string;
    discoveredCount: number;
    pages: PageReport[];
    /**
     * Facts extracted from the site's contact/about/imprint page,
     * when one was discovered and fetched. Shared across all pages in
     * the report — this is site-wide information.
     */
    contactFacts?: OrganizationFacts;
    summary: {
        pagesScanned: number;
        pagesWithJsonLd: number;
        pagesWithoutJsonLd: number;
        pagesWithErrors: number;
        totalFindingsBySeverity: Record<Finding['severity'], number>;
    };
}

export async function scanSite(
    sitemapUrl: string,
    options: ScanOptions = { sitemap: {} },
): Promise<ScanReport> {
    const discovered = await discoverFromSitemap(sitemapUrl, options.sitemap);
    const results = await fetchHtml(
        discovered.map((d) => d.url),
        options.fetch,
    );
    const recommendEnabled = options.recommend?.enabled !== false;
    const contactEnabled = options.recommend?.contact?.enabled !== false;

    // Pre-pass: pick a contact/imprint/about page from the sitemap,
    // fetch it once, and extract site-wide Organization facts. These
    // flow into every per-page recommend() call so the publisher
    // Organization entity gets registry ids, VAT, phone, etc. — not
    // just a generic name + URL.
    let contactFacts: OrganizationFacts | undefined;
    if (recommendEnabled && contactEnabled) {
        const explicit = options.recommend?.contact?.url;
        const candidate = explicit ?? pickContactUrl(discovered.map((d) => d.url)) ?? undefined;
        if (candidate) {
            // If we already fetched the contact URL in the main batch,
            // reuse its HTML. Otherwise do a one-off fetch.
            const cached = results.find((r) => r.url === candidate && r.html);
            if (cached?.html) {
                contactFacts = extractOrganizationFactsFromHtml(cached.html, candidate);
            } else {
                const [extra] = await fetchHtml([candidate], options.fetch);
                if (extra?.html) {
                    contactFacts = extractOrganizationFactsFromHtml(extra.html, candidate);
                }
            }
        }
    }

    const pages: PageReport[] = results.map((res) => {
        if (!res.html) {
            const pageFinding: Finding = {
                severity: 'error',
                code: 'fetch-failed',
                message: res.error ?? `HTTP ${res.status}`,
            };
            return {
                url: res.url,
                status: res.status,
                fetchError: res.error ?? `HTTP ${res.status}`,
                blocks: [],
                findings: [pageFinding],
            };
        }

        const extracted = extractFromHtml(res.html);
        const blocks = extracted.jsonLd.map(validateBlock);
        const pageFindings: Finding[] = blocks.flatMap((b) => b.findings);

        if (blocks.length === 0) {
            pageFindings.push({
                severity: 'warning',
                code: 'no-json-ld',
                message: 'Page has no <script type="application/ld+json"> blocks.',
            });
        }

        const report: PageReport = {
            url: res.url,
            status: res.status,
            title: extracted.title,
            ogType: extracted.ogType,
            canonical: extracted.canonical,
            blocks,
            findings: pageFindings,
        };

        if (recommendEnabled) {
            const inferred = inferFromHtml(res.html, res.url);
            const liveEntities = flattenLiveEntities(extracted.jsonLd);
            // Pass live entities so the recommender preserves any
            // Organization subtype the site has explicitly declared
            // (NewsMediaOrganization, LocalBusiness, etc.) rather than
            // downgrading to generic Organization. Pass contact facts
            // so the publisher entity gets enriched with registry ids,
            // VAT, phone, sameAs registry URLs.
            const recommended = recommend(inferred, { liveEntities, contactFacts });
            report.classification = recommended.classification;
            report.inferred = inferred;
            report.recommended = recommended;

            // When the page has no JSON-LD at all, suppress the N
            // `missing-entity` findings — the single `no-json-ld`
            // warning plus the recommended graph on the PageReport is
            // enough (the formatter will render it as a copy-paste
            // snippet). Diffing only makes sense when there's a live
            // graph to compare against.
            if (liveEntities.length === 0) {
                report.findings = pageFindings;
            } else {
                const diffFindings = diffRecommendedVsLive(
                    recommended,
                    liveEntities,
                    options.recommend?.diff,
                );
                report.findings = [...pageFindings, ...diffFindings];
            }
        }

        return report;
    });

    const summary = {
        pagesScanned: pages.length,
        pagesWithJsonLd: pages.filter((p) => p.blocks.length > 0).length,
        pagesWithoutJsonLd: pages.filter((p) => p.blocks.length === 0 && !p.fetchError).length,
        pagesWithErrors: pages.filter((p) => p.fetchError).length,
        totalFindingsBySeverity: {
            error: 0,
            warning: 0,
            info: 0,
        } as Record<Finding['severity'], number>,
    };
    for (const page of pages) {
        for (const f of page.findings) {
            summary.totalFindingsBySeverity[f.severity] += 1;
        }
    }

    return {
        sitemapUrl,
        discoveredCount: discovered.length,
        pages,
        ...(contactFacts ? { contactFacts } : {}),
        summary,
    };
}
