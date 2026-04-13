import { describe, expect, it } from 'vitest';
import { buildSeoContext, ROBOTS_EXTRAS } from '../src/components/seo-context.js';
import type { SeoProps } from '../src/components/seo-props.js';

const pageUrl = 'https://example.com/my-post/';

describe('buildSeoContext', () => {
    it('builds a minimal context from just a title', () => {
        const ctx = buildSeoContext({ title: 'Hello' }, pageUrl);
        expect(ctx.title).toBe('Hello');
        expect(ctx.canonical).toBe(pageUrl);
        expect(ctx.description).toBeUndefined();
        expect(ctx.twitter).toBeUndefined();
        expect(ctx.authorName).toBeUndefined();
        expect(ctx.hreflangs).toEqual([]);
        expect(ctx.extraLinks).toEqual([]);
        expect(ctx.extraMeta).toEqual([]);
        expect(ctx.graph).toBeUndefined();
        expect(ctx.og).toMatchObject({
            title: 'Hello',
            type: 'website',
            image: '',
            url: pageUrl,
            locale: 'en_US',
        });
        expect(ctx.og.article).toBeUndefined();
        expect(ctx.robots).toEqual({ noindex: false, nofollow: false, extras: ROBOTS_EXTRAS });
    });

    describe('title', () => {
        it('applies titleTemplate with %s substitution', () => {
            const ctx = buildSeoContext(
                { title: 'My Post', titleTemplate: '%s | Example' },
                pageUrl,
            );
            expect(ctx.title).toBe('My Post | Example');
            expect(ctx.og.title).toBe('My Post | Example');
        });

        it('leaves title untouched when no template is provided', () => {
            const ctx = buildSeoContext({ title: 'Raw' }, pageUrl);
            expect(ctx.title).toBe('Raw');
        });
    });

    describe('canonical', () => {
        it('strips query params from the default canonical', () => {
            const ctx = buildSeoContext({ title: 'Hello' }, `${pageUrl}?ref=twitter`);
            expect(ctx.canonical).toBe(pageUrl);
        });

        it('preserves query params when preserveQueryParams is true', () => {
            const urlWithQuery = `${pageUrl}?ref=twitter`;
            const ctx = buildSeoContext(
                { title: 'Hello', preserveQueryParams: true },
                urlWithQuery,
            );
            expect(ctx.canonical).toBe(urlWithQuery);
        });

        it('uses an explicit canonical over the page URL', () => {
            const ctx = buildSeoContext(
                { title: 'Hello', canonical: 'https://other.example/path/' },
                pageUrl,
            );
            expect(ctx.canonical).toBe('https://other.example/path/');
            expect(ctx.og.url).toBe('https://other.example/path/');
        });

        it('accepts a URL object for canonical', () => {
            const ctx = buildSeoContext(
                { title: 'Hello', canonical: new URL('https://example.com/other/') },
                pageUrl,
            );
            expect(ctx.canonical).toBe('https://example.com/other/');
        });

        it('is omitted entirely when noindex is true', () => {
            const ctx = buildSeoContext({ title: 'Hello', noindex: true }, pageUrl);
            expect(ctx.canonical).toBeUndefined();
        });

        it('falls back og:url to the stripped page URL when noindex omits canonical', () => {
            const ctx = buildSeoContext({ title: 'Hello', noindex: true }, `${pageUrl}?utm=x`);
            expect(ctx.canonical).toBeUndefined();
            expect(ctx.og.url).toBe(pageUrl);
        });
    });

    describe('robots', () => {
        it('defaults to noindex/nofollow false with max-* extras', () => {
            const ctx = buildSeoContext({ title: 'Hello' }, pageUrl);
            expect(ctx.robots).toEqual({ noindex: false, nofollow: false, extras: ROBOTS_EXTRAS });
        });

        it('reflects noindex', () => {
            const ctx = buildSeoContext({ title: 'Hello', noindex: true }, pageUrl);
            expect(ctx.robots.noindex).toBe(true);
            expect(ctx.robots.nofollow).toBe(false);
        });

        it('reflects nofollow', () => {
            const ctx = buildSeoContext({ title: 'Hello', nofollow: true }, pageUrl);
            expect(ctx.robots.noindex).toBe(false);
            expect(ctx.robots.nofollow).toBe(true);
        });

        it('reflects both noindex and nofollow', () => {
            const ctx = buildSeoContext({ title: 'Hello', noindex: true, nofollow: true }, pageUrl);
            expect(ctx.robots).toEqual({ noindex: true, nofollow: true, extras: ROBOTS_EXTRAS });
        });
    });

    describe('open graph', () => {
        it('defaults ogType to website and leaves image empty', () => {
            const ctx = buildSeoContext({ title: 'Hello' }, pageUrl);
            expect(ctx.og.type).toBe('website');
            expect(ctx.og.image).toBe('');
            expect(ctx.og.imageAlt).toBeUndefined();
        });

        it('carries description and siteName when provided', () => {
            const ctx = buildSeoContext(
                { title: 'Hello', description: 'A post', siteName: 'Example' },
                pageUrl,
            );
            expect(ctx.og.description).toBe('A post');
            expect(ctx.og.siteName).toBe('Example');
        });

        it('overrides locale when provided', () => {
            const ctx = buildSeoContext({ title: 'Hello', locale: 'fr_FR' }, pageUrl);
            expect(ctx.og.locale).toBe('fr_FR');
        });

        it('emits image dimensions only when a share image is present', () => {
            const without = buildSeoContext(
                { title: 'Hello', ogImageAlt: 'x', ogImageWidth: 1200 },
                pageUrl,
            );
            expect(without.og.imageAlt).toBeUndefined();
            expect(without.og.imageWidth).toBeUndefined();

            const withImage = buildSeoContext(
                {
                    title: 'Hello',
                    ogImage: 'https://example.com/og.png',
                    ogImageAlt: 'Hello image',
                    ogImageWidth: 1200,
                    ogImageHeight: 675,
                },
                pageUrl,
            );
            expect(withImage.og.imageAlt).toBe('Hello image');
            expect(withImage.og.imageWidth).toBe(1200);
            expect(withImage.og.imageHeight).toBe(675);
        });
    });

    describe('article', () => {
        it('is omitted when ogType is not article', () => {
            const ctx = buildSeoContext(
                {
                    title: 'Hello',
                    ogType: 'website',
                    article: { publishedTime: new Date('2026-04-01T00:00:00Z') },
                },
                pageUrl,
            );
            expect(ctx.og.article).toBeUndefined();
        });

        it('coerces Date values to ISO strings', () => {
            const ctx = buildSeoContext(
                {
                    title: 'Hello',
                    ogType: 'article',
                    article: {
                        publishedTime: new Date('2026-04-01T00:00:00Z'),
                        modifiedTime: new Date('2026-04-05T00:00:00Z'),
                    },
                },
                pageUrl,
            );
            expect(ctx.og.article?.publishedTime).toBe('2026-04-01T00:00:00.000Z');
            expect(ctx.og.article?.modifiedTime).toBe('2026-04-05T00:00:00.000Z');
        });

        it('passes string dates through verbatim', () => {
            const ctx = buildSeoContext(
                {
                    title: 'Hello',
                    ogType: 'article',
                    article: { publishedTime: '2026-04-01' },
                },
                pageUrl,
            );
            expect(ctx.og.article?.publishedTime).toBe('2026-04-01');
        });

        it('includes publisher when articlePublisher is set', () => {
            const ctx = buildSeoContext(
                {
                    title: 'Hello',
                    ogType: 'article',
                    articlePublisher: 'https://facebook.com/example',
                },
                pageUrl,
            );
            expect(ctx.og.article?.publisher).toBe('https://facebook.com/example');
        });

        it('carries authors, tags, and section', () => {
            const ctx = buildSeoContext(
                {
                    title: 'Hello',
                    ogType: 'article',
                    article: {
                        authors: ['https://example.com/about/'],
                        tags: ['tag-a', 'tag-b'],
                        section: 'Tech',
                    },
                },
                pageUrl,
            );
            expect(ctx.og.article?.authors).toEqual(['https://example.com/about/']);
            expect(ctx.og.article?.tags).toEqual(['tag-a', 'tag-b']);
            expect(ctx.og.article?.section).toBe('Tech');
        });
    });

    describe('twitter', () => {
        it('is undefined when no twitter block is passed', () => {
            const ctx = buildSeoContext({ title: 'Hello' }, pageUrl);
            expect(ctx.twitter).toBeUndefined();
        });

        it('defaults card to summary_large_image', () => {
            const ctx = buildSeoContext({ title: 'Hello', twitter: {} }, pageUrl);
            expect(ctx.twitter?.card).toBe('summary_large_image');
        });

        it('respects an explicit card override', () => {
            const ctx = buildSeoContext({ title: 'Hello', twitter: { card: 'summary' } }, pageUrl);
            expect(ctx.twitter?.card).toBe('summary');
        });

        it('emits site/creator and no duplicate fallbacks', () => {
            const ctx = buildSeoContext(
                {
                    title: 'Hello',
                    description: 'A post',
                    ogImage: 'https://example.com/og.png',
                    ogImageAlt: 'Alt',
                    twitter: { site: '@example', creator: '@author' },
                },
                pageUrl,
            );
            expect(ctx.twitter).toEqual({
                card: 'summary_large_image',
                site: '@example',
                creator: '@author',
            });
        });

        it('emits overrides that differ from OG counterparts', () => {
            const ctx = buildSeoContext(
                {
                    title: 'Hello',
                    description: 'A post',
                    ogImage: 'https://example.com/og.png',
                    ogImageAlt: 'Alt',
                    twitter: {
                        title: 'Twitter-only title',
                        description: 'Twitter-only description',
                        image: 'https://example.com/twitter.png',
                        imageAlt: 'Twitter-only alt',
                    },
                },
                pageUrl,
            );
            expect(ctx.twitter).toEqual({
                card: 'summary_large_image',
                title: 'Twitter-only title',
                description: 'Twitter-only description',
                image: 'https://example.com/twitter.png',
                imageAlt: 'Twitter-only alt',
            });
        });

        it('suppresses overrides that equal the OG counterpart', () => {
            const ctx = buildSeoContext(
                {
                    title: 'Hello',
                    description: 'A post',
                    ogImage: 'https://example.com/og.png',
                    ogImageAlt: 'Alt',
                    twitter: {
                        title: 'Hello',
                        description: 'A post',
                        image: 'https://example.com/og.png',
                        imageAlt: 'Alt',
                    },
                },
                pageUrl,
            );
            expect(ctx.twitter).toEqual({ card: 'summary_large_image' });
        });
    });

    describe('hreflang / og:locale:alternate', () => {
        const entries: SeoProps['alternates'] = {
            defaultLocale: 'en',
            entries: [
                { hreflang: 'en', href: 'https://example.com/en/' },
                { hreflang: 'fr-CA', href: 'https://example.com/fr-ca/' },
                { hreflang: 'de', href: 'https://example.com/de/' },
            ],
        };

        it('returns resolved hreflang entries (including x-default)', () => {
            const ctx = buildSeoContext({ title: 'Hello', alternates: entries }, pageUrl);
            expect(ctx.hreflangs.length).toBeGreaterThanOrEqual(3);
            expect(ctx.hreflangs.some((e) => e.hreflang === 'x-default')).toBe(true);
        });

        it('emits og:locale:alternate entries derived from hreflang', () => {
            const ctx = buildSeoContext({ title: 'Hello', alternates: entries }, pageUrl);
            // primary locale is en_US; `en` language-only should be skipped
            expect(ctx.og.localeAlternate).toEqual(['fr_CA', 'de']);
        });

        it('skips locales that equal the primary og:locale', () => {
            const ctx = buildSeoContext(
                {
                    title: 'Hello',
                    locale: 'fr_CA',
                    alternates: {
                        entries: [
                            { hreflang: 'fr-CA', href: 'https://example.com/fr-ca/' },
                            { hreflang: 'en', href: 'https://example.com/en/' },
                        ],
                    },
                },
                pageUrl,
            );
            expect(ctx.og.localeAlternate).toEqual(['en']);
        });

        it('leaves hreflangs empty when no alternates are provided', () => {
            const ctx = buildSeoContext({ title: 'Hello' }, pageUrl);
            expect(ctx.hreflangs).toEqual([]);
            expect(ctx.og.localeAlternate).toBeUndefined();
        });
    });

    describe('author', () => {
        it('uses explicit author over article.authors', () => {
            const ctx = buildSeoContext(
                {
                    title: 'Hello',
                    author: 'Joost',
                    ogType: 'article',
                    article: { authors: ['https://example.com/someone/'] },
                },
                pageUrl,
            );
            expect(ctx.authorName).toBe('Joost');
        });

        it('falls back to first article author when author is absent', () => {
            const ctx = buildSeoContext(
                {
                    title: 'Hello',
                    ogType: 'article',
                    article: { authors: ['https://example.com/joost/'] },
                },
                pageUrl,
            );
            expect(ctx.authorName).toBe('https://example.com/joost/');
        });

        it('is undefined when neither is set', () => {
            const ctx = buildSeoContext({ title: 'Hello' }, pageUrl);
            expect(ctx.authorName).toBeUndefined();
        });
    });

    describe('passthroughs', () => {
        it('passes extraLinks and extraMeta through verbatim', () => {
            const ctx = buildSeoContext(
                {
                    title: 'Hello',
                    extraLinks: [{ rel: 'icon', href: '/favicon.svg' }],
                    extraMeta: [{ name: 'custom', content: 'v' }],
                },
                pageUrl,
            );
            expect(ctx.extraLinks).toEqual([{ rel: 'icon', href: '/favicon.svg' }]);
            expect(ctx.extraMeta).toEqual([{ name: 'custom', content: 'v' }]);
        });

        it('carries graph when provided', () => {
            const graph = { '@context': 'https://schema.org', '@graph': [] };
            const ctx = buildSeoContext({ title: 'Hello', graph }, pageUrl);
            expect(ctx.graph).toBe(graph);
        });

        it('distinguishes null graph from absent graph', () => {
            const ctxNull = buildSeoContext({ title: 'Hello', graph: null }, pageUrl);
            expect(ctxNull.graph).toBeNull();

            const ctxAbsent = buildSeoContext({ title: 'Hello' }, pageUrl);
            expect(ctxAbsent.graph).toBeUndefined();
        });
    });
});
