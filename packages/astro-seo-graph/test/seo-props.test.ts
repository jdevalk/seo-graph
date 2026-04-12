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
        // Robots meta is always emitted with max-* defaults.
        expect(out.extend?.meta).toEqual([
            {
                name: 'robots',
                content: 'max-snippet:-1, max-image-preview:large, max-video-preview:-1',
            },
        ]);
        expect(out.extend?.link).toBeUndefined();
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

    it('emits only Twitter-specific tags; title/description/image/imageAlt fall back to OG', () => {
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
        });
    });

    it('emits twitter:title/description/image/imageAlt when explicitly overridden', () => {
        const out = buildAstroSeoProps(
            {
                title: 'Hello',
                description: 'A post',
                ogImage: 'https://example.com/og.png',
                ogImageAlt: 'Alt text',
                twitter: {
                    site: '@example',
                    title: 'Twitter-only title',
                    description: 'Twitter-only description',
                    image: 'https://example.com/twitter.png',
                    imageAlt: 'Twitter-only alt',
                },
            },
            pageUrl,
        );
        expect(out.twitter).toEqual({
            card: 'summary_large_image',
            site: '@example',
            title: 'Twitter-only title',
            description: 'Twitter-only description',
            image: 'https://example.com/twitter.png',
            imageAlt: 'Twitter-only alt',
        });
    });

    it('omits twitter override when it equals the OG counterpart', () => {
        const out = buildAstroSeoProps(
            {
                title: 'Hello',
                description: 'A post',
                ogImage: 'https://example.com/og.png',
                twitter: {
                    site: '@example',
                    title: 'Hello', // same as og:title
                    description: 'A post', // same as og:description
                    image: 'https://example.com/og.png', // same as og:image
                },
            },
            pageUrl,
        );
        expect(out.twitter).toEqual({
            card: 'summary_large_image',
            site: '@example',
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
                extraMeta: [{ name: 'custom', content: 'value' }],
            },
            pageUrl,
        );
        expect(out.extend?.link).toHaveLength(2);
        expect(out.extend?.link?.[0]).toEqual({
            rel: 'icon',
            type: 'image/svg+xml',
            href: '/favicon.svg',
        });
        // Meta now always starts with robots; extraMeta follows.
        expect(out.extend?.meta).toContainEqual({ name: 'custom', content: 'value' });
        expect(out.extend?.meta?.[0]?.name).toBe('robots');
    });

    describe('robots meta', () => {
        it('always emits max-* defaults even without noindex', () => {
            const out = buildAstroSeoProps({ title: 'Hello' }, pageUrl);
            const robots = out.extend?.meta?.find((m) => m.name === 'robots');
            expect(robots?.content).toBe(
                'max-snippet:-1, max-image-preview:large, max-video-preview:-1',
            );
        });

        it('emits noindex, follow when noindex is true', () => {
            const out = buildAstroSeoProps({ title: 'Hello', noindex: true }, pageUrl);
            const robots = out.extend?.meta?.find((m) => m.name === 'robots');
            expect(robots?.content).toBe(
                'noindex, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1',
            );
        });

        it('emits nofollow when nofollow is true', () => {
            const out = buildAstroSeoProps({ title: 'Hello', nofollow: true }, pageUrl);
            const robots = out.extend?.meta?.find((m) => m.name === 'robots');
            expect(robots?.content).toBe(
                'nofollow, max-snippet:-1, max-image-preview:large, max-video-preview:-1',
            );
        });

        it('emits noindex, nofollow when both are true', () => {
            const out = buildAstroSeoProps(
                { title: 'Hello', noindex: true, nofollow: true },
                pageUrl,
            );
            const robots = out.extend?.meta?.find((m) => m.name === 'robots');
            expect(robots?.content).toBe(
                'noindex, nofollow, max-snippet:-1, max-image-preview:large, max-video-preview:-1',
            );
        });
    });

    describe('canonical', () => {
        it('strips query params from the default canonical', () => {
            const out = buildAstroSeoProps({ title: 'Hello' }, `${pageUrl}?ref=twitter`);
            expect(out.canonical).toBe(pageUrl);
        });

        it('preserves query params when preserveQueryParams is true', () => {
            const urlWithQuery = `${pageUrl}?ref=twitter`;
            const out = buildAstroSeoProps(
                { title: 'Hello', preserveQueryParams: true },
                urlWithQuery,
            );
            expect(out.canonical).toBe(urlWithQuery);
        });

        it('omits canonical when noindex is true', () => {
            const out = buildAstroSeoProps({ title: 'Hello', noindex: true }, pageUrl);
            expect(out.canonical).toBeUndefined();
        });

        it('og:url still falls back to page URL when canonical is omitted', () => {
            const out = buildAstroSeoProps({ title: 'Hello', noindex: true }, pageUrl);
            expect(out.openGraph.basic.url).toBe(pageUrl);
        });
    });

    describe('og:locale:alternate', () => {
        it('derives from alternates, excluding the default locale', () => {
            const out = buildAstroSeoProps(
                {
                    title: 'Hello',
                    locale: 'en_US',
                    alternates: {
                        entries: [
                            { hreflang: 'en', href: 'https://example.com/' },
                            { hreflang: 'fr-CA', href: 'https://example.com/fr-ca/' },
                            { hreflang: 'nl', href: 'https://example.com/nl/' },
                        ],
                    },
                },
                pageUrl,
            );
            // fr-CA → fr_CA (underscore), en excluded since it matches locale.
            expect(out.openGraph.optional?.localeAlternate).toEqual(['fr_CA', 'nl']);
        });

        it('emits nothing when alternates has fewer than 2 entries', () => {
            const out = buildAstroSeoProps(
                {
                    title: 'Hello',
                    alternates: {
                        entries: [{ hreflang: 'en', href: 'https://example.com/' }],
                    },
                },
                pageUrl,
            );
            expect(out.openGraph.optional?.localeAlternate).toBeUndefined();
        });
    });

    describe('author and publisher', () => {
        it('emits meta name=author from explicit prop', () => {
            const out = buildAstroSeoProps({ title: 'Hello', author: 'Jane Doe' }, pageUrl);
            const author = out.extend?.meta?.find((m) => m.name === 'author');
            expect(author?.content).toBe('Jane Doe');
        });

        it('falls back to article.authors[0] for meta name=author', () => {
            const out = buildAstroSeoProps(
                {
                    title: 'Hello',
                    ogType: 'article',
                    article: { authors: ['Jane Doe', 'John Smith'] },
                },
                pageUrl,
            );
            const author = out.extend?.meta?.find((m) => m.name === 'author');
            expect(author?.content).toBe('Jane Doe');
        });

        it('emits article:publisher when articlePublisher is set', () => {
            const out = buildAstroSeoProps(
                {
                    title: 'Hello',
                    ogType: 'article',
                    articlePublisher: 'https://facebook.com/example',
                },
                pageUrl,
            );
            expect(out.openGraph.article?.publisher).toBe('https://facebook.com/example');
        });
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
            expect(out.extend?.link).toBeUndefined();
        });
    });
});
