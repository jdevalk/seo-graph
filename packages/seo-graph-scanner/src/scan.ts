import { discoverFromSitemap, type DiscoverOptions } from './sitemap.js';
import { fetchHtml, type FetchOptions } from './fetcher.js';
import { extractFromHtml } from './extract.js';
import { validateBlock, type Finding, type ValidatedBlock } from './validate.js';

export interface ScanOptions {
    sitemap: DiscoverOptions;
    fetch?: FetchOptions;
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
}

export interface ScanReport {
    sitemapUrl: string;
    discoveredCount: number;
    pages: PageReport[];
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

        return {
            url: res.url,
            status: res.status,
            title: extracted.title,
            ogType: extracted.ogType,
            canonical: extracted.canonical,
            blocks,
            findings: pageFindings,
        };
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
        summary,
    };
}
