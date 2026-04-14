import { describe, expect, it } from 'vitest';
import { formatReport } from '../src/format.js';
import type { ScanReport } from '../src/scan.js';

function report(overrides: Partial<ScanReport> = {}): ScanReport {
    return {
        sitemapUrl: 'https://example.com/sitemap.xml',
        discoveredCount: 0,
        pages: [],
        summary: {
            pagesScanned: 0,
            pagesWithJsonLd: 0,
            pagesWithoutJsonLd: 0,
            pagesWithErrors: 0,
            totalFindingsBySeverity: { error: 0, warning: 0, info: 0 },
        },
        ...overrides,
    };
}

describe('formatReport', () => {
    it('renders the header with site URL and page counts', () => {
        const out = formatReport(
            report({
                summary: {
                    pagesScanned: 3,
                    pagesWithJsonLd: 2,
                    pagesWithoutJsonLd: 1,
                    pagesWithErrors: 0,
                    totalFindingsBySeverity: { error: 0, warning: 5, info: 0 },
                },
            }),
        );
        expect(out).toContain('Scanned 3 pages from https://example.com/sitemap.xml');
        expect(out).toContain('with JSON-LD:    2');
        expect(out).toContain('without JSON-LD: 1');
        expect(out).toContain('Findings: 0 errors, 5 warnings, 0 info');
    });

    it('buckets findings by code with counts', () => {
        const out = formatReport(
            report({
                pages: [
                    {
                        url: 'https://example.com/a/',
                        status: 200,
                        blocks: [],
                        findings: [
                            { severity: 'warning', code: 'missing-entity', message: 'no WebSite' },
                            { severity: 'warning', code: 'missing-entity', message: 'no Person' },
                            {
                                severity: 'warning',
                                code: 'missing-property',
                                message: 'Article missing `headline`',
                            },
                        ],
                    },
                ],
                summary: {
                    pagesScanned: 1,
                    pagesWithJsonLd: 1,
                    pagesWithoutJsonLd: 0,
                    pagesWithErrors: 0,
                    totalFindingsBySeverity: { error: 0, warning: 3, info: 0 },
                },
            }),
        );
        expect(out).toContain('By code');
        expect(out).toMatch(/\s*2\s+\[warning\]\s+missing-entity/);
        expect(out).toMatch(/\s*1\s+\[warning\]\s+missing-property/);
    });

    it('lists top offenders sorted by finding count', () => {
        const out = formatReport(
            report({
                pages: [
                    {
                        url: 'https://example.com/quiet/',
                        status: 200,
                        blocks: [],
                        findings: [{ severity: 'warning', code: 'x', message: '' }],
                    },
                    {
                        url: 'https://example.com/loud/',
                        status: 200,
                        blocks: [],
                        findings: [
                            { severity: 'warning', code: 'x', message: '' },
                            { severity: 'warning', code: 'x', message: '' },
                            { severity: 'warning', code: 'x', message: '' },
                        ],
                    },
                ],
            }),
        );
        const loudIdx = out.indexOf('https://example.com/loud/');
        const quietIdx = out.indexOf('https://example.com/quiet/');
        expect(loudIdx).toBeGreaterThan(-1);
        expect(quietIdx).toBeGreaterThan(-1);
        expect(loudIdx).toBeLessThan(quietIdx); // loud comes first
    });

    it('truncates per-page details beyond the limit', () => {
        const out = formatReport(
            report({
                pages: [
                    {
                        url: 'https://example.com/p/',
                        status: 200,
                        blocks: [],
                        // All share the same code so the by-code bucket
                        // shows the first sample only; the Details section
                        // is what we're testing for truncation.
                        findings: Array.from({ length: 8 }, (_, i) => ({
                            severity: 'warning' as const,
                            code: 'shared-code',
                            message: `detail ${i}`,
                        })),
                    },
                ],
            }),
            { detailsPerPage: 3 },
        );
        expect(out).toContain('detail 0');
        expect(out).toContain('detail 2');
        expect(out).not.toContain('detail 3');
        expect(out).toContain('+ 5 more');
    });

    it('shows path and page classification when present', () => {
        const out = formatReport(
            report({
                pages: [
                    {
                        url: 'https://example.com/p/',
                        status: 200,
                        blocks: [],
                        classification: 'BlogPosting',
                        findings: [
                            {
                                severity: 'warning',
                                code: 'missing-property',
                                message: 'BlogPosting missing `headline`',
                                path: 'https://example.com/p/#article.headline',
                            },
                        ],
                    },
                ],
            }),
        );
        expect(out).toContain('https://example.com/p/  (BlogPosting)');
        expect(out).toContain('← https://example.com/p/#article.headline');
    });

    it('renders a ready-to-paste <script> snippet when a page has no JSON-LD', () => {
        const out = formatReport(
            report({
                pages: [
                    {
                        url: 'https://example.com/p/',
                        status: 200,
                        blocks: [], // no JSON-LD
                        classification: 'WebPage',
                        recommended: {
                            classification: 'WebPage',
                            organizationType: 'GovernmentOrganization',
                            siteUrl: 'https://example.com',
                            entities: [
                                {
                                    '@type': 'GovernmentOrganization',
                                    '@id': 'https://example.com/#/schema.org/Organization/publisher',
                                    name: 'Example',
                                    url: 'https://example.com',
                                },
                                {
                                    '@type': 'WebPage',
                                    '@id': 'https://example.com/p/',
                                    name: 'A page',
                                },
                            ],
                        },
                        findings: [
                            {
                                severity: 'warning',
                                code: 'no-json-ld',
                                message: 'Page has no <script type="application/ld+json"> blocks.',
                            },
                        ],
                    },
                ],
            }),
        );
        expect(out).toContain('Recommended JSON-LD:');
        expect(out).toContain('<script type="application/ld+json">');
        expect(out).toContain('"@context": "https://schema.org"');
        expect(out).toContain('"@type": "GovernmentOrganization"');
        expect(out).toContain('</script>');
    });

    it('does NOT render the snippet when the page already has JSON-LD blocks', () => {
        const out = formatReport(
            report({
                pages: [
                    {
                        url: 'https://example.com/p/',
                        status: 200,
                        // Has existing JSON-LD, so the snippet is not
                        // rendered — it would be confusing alongside
                        // the existing markup.
                        blocks: [
                            {
                                scriptIndex: 1,
                                shape: 'entity',
                                entities: [{ '@type': 'WebPage' }],
                                findings: [],
                            },
                        ],
                        classification: 'WebPage',
                        recommended: {
                            classification: 'WebPage',
                            organizationType: 'Organization',
                            siteUrl: 'https://example.com',
                            entities: [{ '@type': 'WebPage', '@id': 'x', name: 'x' }],
                        },
                        findings: [
                            {
                                severity: 'warning',
                                code: 'missing-property',
                                message: 'WebPage missing `name`',
                            },
                        ],
                    },
                ],
            }),
        );
        expect(out).not.toContain('Recommended JSON-LD:');
        expect(out).not.toContain('<script type="application/ld+json">');
    });

    it('omits sections cleanly when there are no findings', () => {
        const out = formatReport(
            report({
                pages: [{ url: 'https://example.com/ok/', status: 200, blocks: [], findings: [] }],
                summary: {
                    pagesScanned: 1,
                    pagesWithJsonLd: 1,
                    pagesWithoutJsonLd: 0,
                    pagesWithErrors: 0,
                    totalFindingsBySeverity: { error: 0, warning: 0, info: 0 },
                },
            }),
        );
        expect(out).not.toContain('By code');
        expect(out).not.toContain('Top pages');
        expect(out).not.toContain('Details');
    });
});
