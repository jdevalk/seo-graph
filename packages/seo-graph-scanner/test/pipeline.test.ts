/**
 * End-to-end integration test: HTML → infer → recommend → diff, asserting
 * the findings reach the caller through the exported API surface. Covers
 * the happy path (all recommended entities present) and two regression
 * cases where the JSON-LD silently disagrees with the HTML.
 */
import { describe, expect, it } from 'vitest';
import {
    diffRecommendedVsLive,
    extractFromHtml,
    flattenLiveEntities,
    inferFromHtml,
    recommend,
} from '../src/index.js';

/** Build a BlogPosting-flavoured HTML fixture. */
function articleHtml(opts: { pageUrl: string; jsonLd: string }): string {
    return [
        '<!DOCTYPE html>',
        '<html lang="en">',
        '<head>',
        '<title>Hello, Internet</title>',
        `<link rel="canonical" href="${opts.pageUrl}">`,
        '<meta name="description" content="An introductory post">',
        '<meta property="og:type" content="article">',
        '<meta property="og:title" content="Hello, Internet">',
        '<meta property="og:description" content="An introductory post">',
        `<meta property="og:url" content="${opts.pageUrl}">`,
        '<meta property="og:site_name" content="Example">',
        '<meta property="og:locale" content="en_US">',
        '<meta property="og:image" content="https://cdn.example/og.png">',
        '<meta property="og:image:width" content="1200">',
        '<meta property="og:image:height" content="675">',
        '<meta property="article:published_time" content="2026-04-01T00:00:00Z">',
        '<meta property="article:author" content="Joost de Valk">',
        `<script type="application/ld+json">${opts.jsonLd}</script>`,
        '</head>',
        '<body><h1>Hello, Internet</h1></body>',
        '</html>',
    ].join('\n');
}

const PAGE_URL = 'https://example.com/hello/';

describe('scanner pipeline', () => {
    it('produces zero diff findings when live JSON-LD matches what we would recommend', () => {
        // Feed the HTML through infer+recommend, then use the recommended
        // @graph as the page's own JSON-LD. Diff should come back empty —
        // the recommendation is exactly what's on the page.
        const facts = inferFromHtml(articleHtml({ pageUrl: PAGE_URL, jsonLd: '{}' }), PAGE_URL);
        const rec = recommend(facts);

        const liveHtml = articleHtml({
            pageUrl: PAGE_URL,
            jsonLd: JSON.stringify({
                '@context': 'https://schema.org',
                '@graph': rec.entities,
            }),
        });
        const extracted = extractFromHtml(liveHtml);
        const live = flattenLiveEntities(extracted.jsonLd);

        const diffFindings = diffRecommendedVsLive(rec, live);
        expect(diffFindings).toEqual([]);
    });

    it('flags every recommended entity as missing when the page has no JSON-LD', () => {
        const html = articleHtml({ pageUrl: PAGE_URL, jsonLd: '{}' });
        // Strip the <script> so there's no JSON-LD to match against.
        const noLdHtml = html.replace(/<script[^>]*>[\s\S]*?<\/script>/, '');
        const facts = inferFromHtml(noLdHtml, PAGE_URL);
        const rec = recommend(facts);

        const extracted = extractFromHtml(noLdHtml);
        const live = flattenLiveEntities(extracted.jsonLd);

        const diff = diffRecommendedVsLive(rec, live);
        // Every recommended entity becomes a missing-entity finding.
        expect(diff.length).toBe(rec.entities.length);
        expect(diff.every((f) => f.code === 'missing-entity')).toBe(true);
        // And we should have recommended at least the article trio.
        expect(rec.classification).toBe('BlogPosting');
        expect(rec.entities.map((e) => e['@type'])).toEqual(
            expect.arrayContaining(['Organization', 'Person', 'WebSite', 'WebPage', 'BlogPosting']),
        );
    });

    it('flags a missing headline when the live Article omits one', () => {
        // Live JSON-LD has most of the BlogPosting but is missing the
        // headline field — a realistic editor mistake.
        const live = {
            '@context': 'https://schema.org',
            '@graph': [
                { '@type': 'WebSite', '@id': 'https://example.com/#/schema.org/WebSite' },
                { '@type': 'WebPage', '@id': PAGE_URL, name: 'Hello, Internet' },
                {
                    '@type': 'BlogPosting',
                    '@id': `${PAGE_URL}#article`,
                    // headline intentionally omitted.
                    datePublished: '2026-04-01T00:00:00.000Z',
                },
            ],
        };
        const html = articleHtml({ pageUrl: PAGE_URL, jsonLd: JSON.stringify(live) });
        const facts = inferFromHtml(html, PAGE_URL);
        const rec = recommend(facts);

        const extracted = extractFromHtml(html);
        const flat = flattenLiveEntities(extracted.jsonLd);
        const diff = diffRecommendedVsLive(rec, flat);

        const headlineMissing = diff.find(
            (f) => f.code === 'missing-property' && f.path?.endsWith('.headline'),
        );
        expect(headlineMissing).toBeDefined();
        expect(headlineMissing?.severity).toBe('warning');
    });
});
