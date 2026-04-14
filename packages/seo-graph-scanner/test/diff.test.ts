import { describe, expect, it } from 'vitest';
import { diffRecommendedVsLive, flattenLiveEntities } from '../src/diff.js';
import type { ExtractedJsonLd } from '../src/extract.js';
import type { RecommendedGraph } from '../src/recommend.js';

/** Small helper to build an ExtractedJsonLd block from a payload object. */
function block(payload: unknown, i = 1): ExtractedJsonLd {
    return { payload, scriptIndex: i };
}

/** Build a minimal RecommendedGraph for tests. */
function recommended(
    entities: Array<Record<string, unknown>>,
    classification: RecommendedGraph['classification'] = 'WebPage',
): RecommendedGraph {
    return {
        classification,
        organizationType: 'Organization',
        siteUrl: 'https://example.com',
        entities,
    };
}

describe('flattenLiveEntities', () => {
    it('collects entities from @graph envelopes', () => {
        const payload = {
            '@context': 'https://schema.org',
            '@graph': [
                { '@type': 'WebSite', '@id': 'https://example.com/#/schema.org/WebSite' },
                { '@type': 'WebPage', '@id': 'https://example.com/' },
            ],
        };
        const flat = flattenLiveEntities([block(payload)]);
        expect(flat.map((e) => e['@type'])).toEqual(['WebSite', 'WebPage']);
    });

    it('collects bare top-level entities', () => {
        const flat = flattenLiveEntities([block({ '@type': 'Article', '@id': 'x' })]);
        expect(flat.length).toBe(1);
        expect(flat[0]?.['@type']).toBe('Article');
    });

    it('collects arrays of entities', () => {
        const flat = flattenLiveEntities([
            block([
                { '@type': 'Article', '@id': 'a' },
                { '@type': 'WebPage', '@id': 'p' },
            ]),
        ]);
        expect(flat.length).toBe(2);
    });

    it('skips blocks that failed to parse', () => {
        const flat = flattenLiveEntities([
            { payload: 'bad', scriptIndex: 1, parseError: 'oops' },
            block({ '@type': 'WebPage', '@id': 'p' }),
        ]);
        expect(flat.length).toBe(1);
    });

    it('skips primitives and non-entity objects', () => {
        const flat = flattenLiveEntities([
            block({ foo: 'bar' }), // no @type, no @graph
            block(null),
            block(42),
        ]);
        expect(flat).toEqual([]);
    });
});

describe('diffRecommendedVsLive', () => {
    describe('missing entities', () => {
        it('flags every recommended entity that has no live counterpart', () => {
            const out = diffRecommendedVsLive(
                recommended([
                    { '@type': 'WebSite', '@id': 'https://example.com/#/schema.org/WebSite' },
                    { '@type': 'WebPage', '@id': 'https://example.com/' },
                ]),
                [],
            );
            expect(out.map((f) => f.code)).toEqual(['missing-entity', 'missing-entity']);
            expect(out[0]?.path).toBe('https://example.com/#/schema.org/WebSite');
        });
    });

    describe('matching by @id', () => {
        it('matches entities with the same @id and treats extra live fields as fine', () => {
            const out = diffRecommendedVsLive(
                recommended([{ '@type': 'WebPage', '@id': 'https://example.com/', name: 'Home' }]),
                [
                    {
                        '@type': 'WebPage',
                        '@id': 'https://example.com/',
                        name: 'Home',
                        description: 'Extra field — not flagged.',
                    },
                ],
            );
            expect(out).toEqual([]);
        });
    });

    describe('matching by @type (fallback)', () => {
        it('matches by type when ids differ', () => {
            const out = diffRecommendedVsLive(
                recommended([{ '@type': 'WebPage', '@id': 'rec-id', name: 'Home' }]),
                [{ '@type': 'WebPage', '@id': 'live-id', name: 'Home' }],
            );
            expect(out).toEqual([]);
        });

        it('prefers unclaimed candidates when multiple live entities share a type', () => {
            const out = diffRecommendedVsLive(
                recommended([
                    { '@type': 'Article', '@id': 'rec-a', headline: 'A' },
                    { '@type': 'Article', '@id': 'rec-b', headline: 'B' },
                ]),
                [
                    { '@type': 'Article', '@id': 'live-1', headline: 'A' },
                    { '@type': 'Article', '@id': 'live-2', headline: 'B' },
                ],
            );
            expect(out).toEqual([]);
        });
    });

    describe('missing properties', () => {
        it('flags a recommended property that the live entity omits', () => {
            const out = diffRecommendedVsLive(
                recommended([
                    {
                        '@type': 'WebPage',
                        '@id': 'https://example.com/',
                        name: 'Home',
                        description: 'Welcome',
                    },
                ]),
                [{ '@type': 'WebPage', '@id': 'https://example.com/', name: 'Home' }],
            );
            expect(out.length).toBe(1);
            expect(out[0]).toMatchObject({
                severity: 'warning',
                code: 'missing-property',
                path: 'https://example.com/.description',
            });
        });
    });

    describe('property mismatches', () => {
        it('flags differing scalar values', () => {
            const out = diffRecommendedVsLive(
                recommended([{ '@type': 'WebPage', '@id': 'p', name: 'Expected' }]),
                [{ '@type': 'WebPage', '@id': 'p', name: 'Actual' }],
            );
            expect(out).toEqual([
                expect.objectContaining({ code: 'property-mismatch', path: 'p.name' }),
            ]);
        });

        it('compares references by @id', () => {
            const out = diffRecommendedVsLive(
                recommended([
                    {
                        '@type': 'WebPage',
                        '@id': 'p',
                        isPartOf: { '@id': 'https://example.com/#/schema.org/WebSite' },
                    },
                ]),
                [
                    {
                        '@type': 'WebPage',
                        '@id': 'p',
                        isPartOf: { '@id': 'https://example.com/#/schema.org/WebSite' },
                    },
                ],
            );
            expect(out).toEqual([]);
        });

        it('flags reference mismatches when @id differs', () => {
            const out = diffRecommendedVsLive(
                recommended([
                    {
                        '@type': 'WebPage',
                        '@id': 'p',
                        isPartOf: { '@id': 'https://example.com/#/schema.org/WebSite' },
                    },
                ]),
                [
                    {
                        '@type': 'WebPage',
                        '@id': 'p',
                        isPartOf: { '@id': 'https://OTHER.example/#/schema.org/WebSite' },
                    },
                ],
            );
            expect(out.map((f) => f.code)).toEqual(['property-mismatch']);
        });

        it('compares arrays as order-insensitive sets', () => {
            const out = diffRecommendedVsLive(
                recommended([{ '@type': 'Organization', '@id': 'o', sameAs: ['A', 'B'] }]),
                [{ '@type': 'Organization', '@id': 'o', sameAs: ['B', 'A'] }],
            );
            expect(out).toEqual([]);
        });

        it('flags array length mismatches', () => {
            const out = diffRecommendedVsLive(
                recommended([{ '@type': 'Organization', '@id': 'o', sameAs: ['A', 'B'] }]),
                [{ '@type': 'Organization', '@id': 'o', sameAs: ['A'] }],
            );
            expect(out.map((f) => f.code)).toEqual(['property-mismatch']);
        });

        it('does not flag mismatches for nested objects without @id (too noisy)', () => {
            const out = diffRecommendedVsLive(
                recommended([
                    {
                        '@type': 'ImageObject',
                        '@id': 'img',
                        thumbnail: { width: 100, height: 100 },
                    },
                ]),
                [
                    {
                        '@type': 'ImageObject',
                        '@id': 'img',
                        thumbnail: { width: 200, height: 200 },
                    },
                ],
            );
            expect(out).toEqual([]);
        });
    });

    describe('structural keys', () => {
        it('does not diff @id, @type, @context', () => {
            const out = diffRecommendedVsLive(
                recommended([
                    { '@type': 'WebPage', '@id': 'p', '@context': 'https://schema.org', name: 'n' },
                ]),
                [{ '@type': 'WebPage', '@id': 'p', name: 'n' }],
            );
            expect(out).toEqual([]);
        });
    });

    describe('spurious entities', () => {
        it('does not report unmatched live entities by default', () => {
            const out = diffRecommendedVsLive(
                recommended([{ '@type': 'WebPage', '@id': 'p', name: 'n' }]),
                [
                    { '@type': 'WebPage', '@id': 'p', name: 'n' },
                    { '@type': 'FAQPage', '@id': 'faq' },
                ],
            );
            expect(out).toEqual([]);
        });

        it('reports spurious entities as info when reportSpurious=true', () => {
            const out = diffRecommendedVsLive(
                recommended([{ '@type': 'WebPage', '@id': 'p', name: 'n' }]),
                [
                    { '@type': 'WebPage', '@id': 'p', name: 'n' },
                    { '@type': 'FAQPage', '@id': 'faq' },
                ],
                { reportSpurious: true },
            );
            expect(out).toEqual([
                expect.objectContaining({
                    severity: 'info',
                    code: 'spurious-entity',
                    path: 'faq',
                }),
            ]);
        });
    });
});
