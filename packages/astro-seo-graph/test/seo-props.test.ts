import { describe, expect, it } from 'vitest';
import { buildAstroSeoProps, type SeoProps } from '../src/components/seo-props.js';

const pageUrl = 'https://example.com/my-post/';

describe('buildAstroSeoProps', () => {
    it('builds minimal props from just a title', () => {
        const out = buildAstroSeoProps({ title: 'Hello' }, pageUrl);
        expect(out.title).toBe('Hello');
        expect(out.canonical).toBe(pageUrl);
        expect(out.openGraph.basic).toEqual({
            title: 'Hello',
            type: 'website',
            image: '',
            url: pageUrl,
        });
        expect(out.openGraph.optional?.locale).toBe('en_US');
        expect(out.description).toBeUndefined();
        expect(out.twitter).toBeUndefined();
        expect(out.extend).toBeUndefined();
    });

    it('applies titleTemplate with %s substitution', () => {
        const out = buildAstroSeoProps(
            { title: 'My Post', titleTemplate: '%s | Example' },
            pageUrl,
        );
        expect(out.title).toBe('My Post | Example');
        expect(out.openGraph.basic.title).toBe('My Post | Example');
    });

    it('uses an explicit canonical over the page URL', () => {
        const out = buildAstroSeoProps(
            { title: 'Hello', canonical: 'https://other.example/path/' },
            pageUrl,
        );
        expect(out.canonical).toBe('https://other.example/path/');
        expect(out.openGraph.basic.url).toBe('https://other.example/path/');
    });

    it('accepts a URL object for canonical', () => {
        const out = buildAstroSeoProps(
            { title: 'Hello', canonical: new URL('https://example.com/other/') },
            pageUrl,
        );
        expect(out.canonical).toBe('https://example.com/other/');
    });

    it('emits an OG image block only when image metadata is present', () => {
        const withoutMeta = buildAstroSeoProps(
            { title: 'Hello', ogImage: 'https://example.com/og.png' },
            pageUrl,
        );
        expect(withoutMeta.openGraph.image).toBeUndefined();
        expect(withoutMeta.openGraph.basic.image).toBe('https://example.com/og.png');

        const withMeta = buildAstroSeoProps(
            {
                title: 'Hello',
                ogImage: 'https://example.com/og.png',
                ogImageAlt: 'Hello image',
                ogImageWidth: 1200,
                ogImageHeight: 675,
            },
            pageUrl,
        );
        expect(withMeta.openGraph.image).toEqual({
            alt: 'Hello image',
            width: 1200,
            height: 675,
        });
    });

    it('emits the OG article block only when ogType is article', () => {
        const nonArticle = buildAstroSeoProps(
            {
                title: 'Hello',
                ogType: 'website',
                article: { publishedTime: new Date('2026-04-01T00:00:00Z') },
            },
            pageUrl,
        );
        expect(nonArticle.openGraph.article).toBeUndefined();

        const asArticle = buildAstroSeoProps(
            {
                title: 'Hello',
                ogType: 'article',
                article: {
                    publishedTime: new Date('2026-04-01T00:00:00Z'),
                    modifiedTime: new Date('2026-04-05T00:00:00Z'),
                    authors: ['https://example.com/about/'],
                    tags: ['tag-a', 'tag-b'],
                    section: 'Tech',
                },
            },
            pageUrl,
        );
        expect(asArticle.openGraph.article).toEqual({
            publishedTime: '2026-04-01T00:00:00.000Z',
            modifiedTime: '2026-04-05T00:00:00.000Z',
            authors: ['https://example.com/about/'],
            tags: ['tag-a', 'tag-b'],
            section: 'Tech',
        });
    });

    it('accepts string dates on article metadata', () => {
        const out = buildAstroSeoProps(
            {
                title: 'Hello',
                ogType: 'article',
                article: { publishedTime: '2026-04-01' },
            },
            pageUrl,
        );
        expect(out.openGraph.article?.publishedTime).toBe('2026-04-01');
    });

    it('emits twitter block with defaults when `twitter` is provided', () => {
        const out = buildAstroSeoProps(
            {
                title: 'Hello',
                description: 'A post',
                ogImage: 'https://example.com/og.png',
                ogImageAlt: 'Alt text',
                twitter: { site: '@example', creator: '@author' },
            },
            pageUrl,
        );
        expect(out.twitter).toEqual({
            card: 'summary_large_image',
            site: '@example',
            creator: '@author',
            title: 'Hello',
            description: 'A post',
            image: 'https://example.com/og.png',
            imageAlt: 'Alt text',
        });
    });

    it('respects an explicit twitter card override', () => {
        const out = buildAstroSeoProps({ title: 'Hello', twitter: { card: 'summary' } }, pageUrl);
        expect(out.twitter?.card).toBe('summary');
    });

    it('passes through extraLinks and extraMeta via extend', () => {
        const out = buildAstroSeoProps(
            {
                title: 'Hello',
                extraLinks: [
                    { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
                    { rel: 'sitemap', href: '/sitemap-index.xml' },
                ],
                extraMeta: [{ name: 'author', content: 'Jane Doe' }],
            },
            pageUrl,
        );
        expect(out.extend?.link).toHaveLength(2);
        expect(out.extend?.link?.[0]).toEqual({
            rel: 'icon',
            type: 'image/svg+xml',
            href: '/favicon.svg',
        });
        expect(out.extend?.meta).toEqual([{ name: 'author', content: 'Jane Doe' }]);
    });

    it('emits noindex when requested', () => {
        const out = buildAstroSeoProps({ title: 'Hello', noindex: true }, pageUrl);
        expect(out.noindex).toBe(true);
    });

    it('omits noindex when false or absent', () => {
        expect(buildAstroSeoProps({ title: 'Hello' }, pageUrl).noindex).toBeUndefined();
        expect(
            buildAstroSeoProps({ title: 'Hello', noindex: false }, pageUrl).noindex,
        ).toBeUndefined();
    });

    it('respects a custom locale', () => {
        const out = buildAstroSeoProps({ title: 'Hello', locale: 'nl_NL' }, pageUrl);
        expect(out.openGraph.optional?.locale).toBe('nl_NL');
    });

    describe('alternates (hreflang)', () => {
        it('emits hreflang links via extend.link when alternates has ≥2 valid entries', () => {
            const out = buildAstroSeoProps(
                {
                    title: 'Hello',
                    alternates: {
                        defaultLocale: 'en',
                        entries: [
                            { hreflang: 'en', href: 'https://example.com/' },
                            { hreflang: 'fr', href: 'https://example.com/fr/' },
                            { hreflang: 'nl', href: 'https://example.com/nl/' },
                        ],
                    },
                },
                pageUrl,
            );
            expect(out.extend?.link).toHaveLength(4);
            expect(out.extend?.link?.[0]).toEqual({
                rel: 'alternate',
                href: 'https://example.com/',
                hreflang: 'en',
            });
            expect(out.extend?.link?.[1]).toEqual({
                rel: 'alternate',
                href: 'https://example.com/fr/',
                hreflang: 'fr',
            });
            expect(out.extend?.link?.[2]).toEqual({
                rel: 'alternate',
                href: 'https://example.com/nl/',
                hreflang: 'nl',
            });
            expect(out.extend?.link?.[3]).toEqual({
                rel: 'alternate',
                href: 'https://example.com/',
                hreflang: 'x-default',
            });
        });

        it('combines alternates with extraLinks (extras first, alternates after)', () => {
            const out = buildAstroSeoProps(
                {
                    title: 'Hello',
                    extraLinks: [{ rel: 'icon', href: '/favicon.svg' }],
                    alternates: {
                        entries: [
                            { hreflang: 'en', href: 'https://example.com/' },
                            { hreflang: 'fr', href: 'https://example.com/fr/' },
                        ],
                    },
                },
                pageUrl,
            );
            expect(out.extend?.link).toHaveLength(4); // 1 extra + 2 alternates + x-default
            expect(out.extend?.link?.[0]).toEqual({ rel: 'icon', href: '/favicon.svg' });
            expect(out.extend?.link?.[1]?.rel).toBe('alternate');
        });

        it('does not mutate extend.link when alternates has fewer than 2 valid entries', () => {
            const out = buildAstroSeoProps(
                {
                    title: 'Hello',
                    alternates: {
                        entries: [{ hreflang: 'en', href: 'https://example.com/' }],
                    },
                },
                pageUrl,
            );
            expect(out.extend).toBeUndefined();
        });
    });
});
