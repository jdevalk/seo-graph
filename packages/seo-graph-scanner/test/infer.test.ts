import { describe, expect, it } from 'vitest';
import { inferFromHtml } from '../src/infer.js';

const URL = 'https://example.com/posts/hello/';

describe('inferFromHtml', () => {
    describe('title and description', () => {
        it('prefers og:title over <title>', () => {
            const html =
                '<html><head><title>From title tag</title><meta property="og:title" content="From OG"></head></html>';
            const facts = inferFromHtml(html, URL);
            expect(facts.title).toEqual({ value: 'From OG', source: 'og' });
        });

        it('falls back to <title> when og:title absent', () => {
            const html = '<html><head><title>  The Page  </title></head></html>';
            expect(inferFromHtml(html, URL).title).toEqual({ value: 'The Page', source: 'title' });
        });

        it('prefers og:description over meta description', () => {
            const html =
                '<head><meta name="description" content="plain"><meta property="og:description" content="og"></head>';
            expect(inferFromHtml(html, URL).description).toEqual({ value: 'og', source: 'og' });
        });

        it('falls back to meta description', () => {
            const html = '<head><meta name="description" content="plain desc"></head>';
            expect(inferFromHtml(html, URL).description).toEqual({
                value: 'plain desc',
                source: 'html-meta',
            });
        });
    });

    describe('canonical', () => {
        it('resolves <link rel="canonical"> against page URL', () => {
            const html = '<head><link rel="canonical" href="/posts/hello/"></head>';
            expect(inferFromHtml(html, URL).canonical).toEqual({
                value: 'https://example.com/posts/hello/',
                source: 'link',
            });
        });

        it('falls back to og:url when canonical is absent', () => {
            const html = '<head><meta property="og:url" content="https://example.com/p/"></head>';
            expect(inferFromHtml(html, URL).canonical).toEqual({
                value: 'https://example.com/p/',
                source: 'og',
            });
        });
    });

    describe('locale', () => {
        it('prefers og:locale over html[lang]', () => {
            const html =
                '<html lang="en"><head><meta property="og:locale" content="en_US"></head></html>';
            expect(inferFromHtml(html, URL).locale).toEqual({ value: 'en_US', source: 'og' });
        });

        it('falls back to html[lang]', () => {
            const html = '<html lang="nl-NL"><head></head></html>';
            expect(inferFromHtml(html, URL).locale).toEqual({
                value: 'nl-NL',
                source: 'html-lang',
            });
        });
    });

    describe('article dates', () => {
        it('picks up article:published_time and article:modified_time', () => {
            const html =
                '<head>' +
                '<meta property="article:published_time" content="2026-04-01T00:00:00Z">' +
                '<meta property="article:modified_time" content="2026-04-10T10:00:00Z">' +
                '</head>';
            const facts = inferFromHtml(html, URL);
            expect(facts.datePublished?.value).toBe('2026-04-01T00:00:00Z');
            expect(facts.dateModified?.value).toBe('2026-04-10T10:00:00Z');
        });

        it('falls back to <time datetime> for publication', () => {
            const html =
                '<body><article><time datetime="2026-03-15">March 15</time></article></body>';
            const facts = inferFromHtml(html, URL);
            expect(facts.datePublished?.value).toBe('2026-03-15');
            expect(facts.datePublished?.source).toBe('time-element');
        });

        it('does not fall back to <time> when article:published_time exists', () => {
            const html =
                '<head><meta property="article:published_time" content="2026-04-01"></head>' +
                '<body><time datetime="1970-01-01">Lies</time></body>';
            expect(inferFromHtml(html, URL).datePublished?.value).toBe('2026-04-01');
        });
    });

    describe('author', () => {
        it('uses article:author as a URL when it looks like one', () => {
            const html =
                '<head><meta property="article:author" content="https://example.com/about/"></head>';
            const facts = inferFromHtml(html, URL);
            expect(facts.author).toEqual({
                name: '',
                url: 'https://example.com/about/',
                source: 'og',
            });
        });

        it('uses article:author as a name otherwise', () => {
            const html = '<head><meta property="article:author" content="Joost de Valk"></head>';
            expect(inferFromHtml(html, URL).author).toEqual({
                name: 'Joost de Valk',
                source: 'og',
            });
        });

        it('falls back to <a rel="author">', () => {
            const html = '<body><a rel="author" href="/authors/joost/">Joost de Valk</a></body>';
            expect(inferFromHtml(html, URL).author).toEqual({
                name: 'Joost de Valk',
                url: 'https://example.com/authors/joost/',
                source: 'rel-author',
            });
        });

        it('falls back to itemprop="author"', () => {
            const html =
                '<body><span itemprop="author" itemscope itemtype="https://schema.org/Person">' +
                '<a href="/authors/joost/"><span itemprop="name">Joost</span></a></span></body>';
            const author = inferFromHtml(html, URL).author;
            expect(author?.name).toBe('Joost');
            expect(author?.url).toBe('https://example.com/authors/joost/');
            expect(author?.source).toBe('microdata');
        });

        it('falls back to .byline / .author class', () => {
            const html =
                '<body><p class="byline">By <a href="/a/joost/">Joost de Valk</a></p></body>';
            const author = inferFromHtml(html, URL).author;
            expect(author?.name).toBe('Joost de Valk');
            expect(author?.url).toBe('https://example.com/a/joost/');
            expect(author?.source).toBe('article-byline');
        });
    });

    describe('publisher', () => {
        it('derives publisher from og:site_name + page origin', () => {
            const html = '<head><meta property="og:site_name" content="Joost.blog"></head>';
            expect(inferFromHtml(html, URL).publisher).toEqual({
                name: 'Joost.blog',
                url: 'https://example.com',
                source: 'og',
            });
        });

        it('is undefined when no site_name is available', () => {
            expect(inferFromHtml('<head></head>', URL).publisher).toBeUndefined();
        });
    });

    describe('primary image', () => {
        it('picks up og:image with alt, width, height', () => {
            const html =
                '<head>' +
                '<meta property="og:image" content="https://cdn.example/og.png">' +
                '<meta property="og:image:alt" content="hero">' +
                '<meta property="og:image:width" content="1200">' +
                '<meta property="og:image:height" content="675">' +
                '</head>';
            expect(inferFromHtml(html, URL).primaryImage).toEqual({
                url: 'https://cdn.example/og.png',
                alt: 'hero',
                width: 1200,
                height: 675,
                source: 'og',
            });
        });

        it('resolves a relative og:image against page URL', () => {
            const html = '<head><meta property="og:image" content="/img/x.png"></head>';
            expect(inferFromHtml(html, URL).primaryImage?.url).toBe(
                'https://example.com/img/x.png',
            );
        });
    });

    describe('all images', () => {
        it('collects <img> in body with resolved src', () => {
            const html =
                '<body><img src="/a.png" alt="A"><img src="https://cdn.example/b.png"></body>';
            const imgs = inferFromHtml(html, URL).allImages;
            expect(imgs).toEqual([
                { url: 'https://example.com/a.png', alt: 'A', source: 'img' },
                { url: 'https://cdn.example/b.png', alt: undefined, source: 'img' },
            ]);
        });

        it('returns an empty list when there are no <img> tags at all', () => {
            // Note: HTML parsers move stray <img> in <head> to <body> per
            // the HTML5 parsing algorithm, so we can't actually test
            // "ignores head images" — they don't exist at parse time.
            expect(inferFromHtml('<head></head><body></body>', URL).allImages).toEqual([]);
        });
    });

    describe('breadcrumbs', () => {
        it('extracts microdata BreadcrumbList', () => {
            const html =
                '<nav itemscope itemtype="https://schema.org/BreadcrumbList">' +
                '<span itemprop="itemListElement" itemscope itemtype="https://schema.org/ListItem">' +
                '<a itemprop="item" href="/"><span itemprop="name">Home</span></a>' +
                '</span>' +
                '<span itemprop="itemListElement" itemscope itemtype="https://schema.org/ListItem">' +
                '<a itemprop="item" href="/posts/"><span itemprop="name">Posts</span></a>' +
                '</span>' +
                '</nav>';
            const crumbs = inferFromHtml(html, URL).breadcrumbs;
            expect(crumbs).toEqual([
                {
                    position: 1,
                    name: 'Home',
                    url: 'https://example.com/',
                    source: 'microdata',
                },
                {
                    position: 2,
                    name: 'Posts',
                    url: 'https://example.com/posts/',
                    source: 'microdata',
                },
            ]);
        });

        it('falls back to nav[aria-label="breadcrumb"]', () => {
            const html =
                '<nav aria-label="breadcrumb"><a href="/">Home</a> / <a href="/posts/">Posts</a></nav>';
            const crumbs = inferFromHtml(html, URL).breadcrumbs;
            expect(crumbs.length).toBe(2);
            expect(crumbs[0]).toMatchObject({ position: 1, name: 'Home' });
            expect(crumbs[1]).toMatchObject({ position: 2, name: 'Posts' });
            expect(crumbs[0]?.source).toBe('breadcrumb-nav');
        });

        it('returns [] when no breadcrumb markup is present', () => {
            expect(inferFromHtml('<body><p>No crumbs</p></body>', URL).breadcrumbs).toEqual([]);
        });
    });

    describe('microdata islands', () => {
        it('flattens itemprops per itemscope', () => {
            const html =
                '<div itemscope itemtype="https://schema.org/Product">' +
                '<span itemprop="name">Widget</span>' +
                '<span itemprop="brand">Acme</span>' +
                '<meta itemprop="sku" content="W-123">' +
                '</div>';
            const items = inferFromHtml(html, URL).microdata;
            expect(items).toEqual([
                {
                    itemtype: 'https://schema.org/Product',
                    props: { name: 'Widget', brand: 'Acme', sku: 'W-123' },
                },
            ]);
        });

        it('skips itemscope without itemtype', () => {
            const html = '<div itemscope><span itemprop="name">Anon</span></div>';
            expect(inferFromHtml(html, URL).microdata).toEqual([]);
        });
    });

    describe('h1 and ogType', () => {
        it('trims and collapses H1 whitespace', () => {
            const html = '<body><h1>  Hello    World  </h1></body>';
            expect(inferFromHtml(html, URL).h1?.value).toBe('Hello World');
        });

        it('captures og:type verbatim', () => {
            const html = '<head><meta property="og:type" content="article"></head>';
            expect(inferFromHtml(html, URL).ogType?.value).toBe('article');
        });
    });

    it('returns a stable minimal shape for an empty document', () => {
        const facts = inferFromHtml('<html></html>', URL);
        expect(facts).toEqual({
            url: URL,
            allImages: [],
            breadcrumbs: [],
            microdata: [],
        });
    });
});
