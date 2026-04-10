import { describe, expect, it } from 'vitest';
import {
    assembleGraph,
    buildArticle,
    buildBreadcrumbList,
    buildCustomPiece,
    buildImageObject,
    buildOrganization,
    buildPerson,
    buildSiteNavigationElement,
    buildVideoObject,
    buildWebPage,
    buildWebSite,
    deduplicateByGraphId,
    makeIds,
} from '../src/index.js';

const siteUrl = 'https://example.com';
const personUrl = 'https://example.com/about/';
const ids = makeIds({ siteUrl, personUrl });
const postUrl = 'https://example.com/hello-world/';

describe('makeIds', () => {
    it('produces stable site-wide ids', () => {
        expect(ids.person).toBe('https://example.com/about/#/schema.org/Person');
        expect(ids.website).toBe('https://example.com/#/schema.org/WebSite');
        expect(ids.personImage).toBe('https://example.com/#personlogo');
        expect(ids.navigation).toBe('https://example.com/#site-navigation');
        expect(ids.organization('yoast')).toBe(
            'https://example.com/#/schema.org/Organization/yoast',
        );
        expect(ids.country('NL')).toBe('https://example.com/#/schema.org/Country/nl');
    });

    it('produces stable per-page ids', () => {
        expect(ids.webPage(postUrl)).toBe(postUrl);
        expect(ids.breadcrumb(postUrl)).toBe(`${postUrl}#breadcrumb`);
        expect(ids.article(postUrl)).toBe(`${postUrl}#article`);
        expect(ids.videoObject(postUrl)).toBe(`${postUrl}#video`);
        expect(ids.primaryImage(postUrl)).toBe(`${postUrl}#primaryimage`);
    });

    it('defaults personUrl to siteUrl', () => {
        const plain = makeIds({ siteUrl });
        expect(plain.person).toBe('https://example.com/#/schema.org/Person');
    });

    it('strips a trailing slash from siteUrl', () => {
        const trailed = makeIds({
            siteUrl: 'https://example.com/',
            personUrl: 'https://example.com/about/',
        });
        expect(trailed.website).toBe('https://example.com/#/schema.org/WebSite');
    });
});

describe('deduplicateByGraphId', () => {
    it('keeps first occurrence of each @id', () => {
        const input = [
            { '@type': 'X', '@id': 'a', name: 'first' },
            { '@type': 'X', '@id': 'b', name: 'only' },
            { '@type': 'X', '@id': 'a', name: 'second' },
        ];
        const out = deduplicateByGraphId(input);
        expect(out).toHaveLength(2);
        expect(out[0]).toEqual({ '@type': 'X', '@id': 'a', name: 'first' });
    });

    it('keeps entities without @id', () => {
        const input = [{ '@type': 'X' }, { '@type': 'X' }];
        expect(deduplicateByGraphId(input)).toHaveLength(2);
    });
});

describe('assembleGraph', () => {
    it('wraps pieces in a @context + @graph envelope', () => {
        const pieces = [
            { '@type': 'Thing', '@id': '1' },
            { '@type': 'Thing', '@id': '2' },
        ];
        const graph = assembleGraph(pieces);
        expect(graph['@context']).toBe('https://schema.org');
        expect(graph['@graph']).toEqual(pieces);
    });

    it('dedupes during assembly', () => {
        const pieces = [
            { '@type': 'Thing', '@id': '1', name: 'a' },
            { '@type': 'Thing', '@id': '1', name: 'b' },
        ];
        expect(assembleGraph(pieces)['@graph']).toHaveLength(1);
    });
});

describe('buildWebSite', () => {
    it('builds a minimal WebSite without inLanguage when none provided', () => {
        const site = buildWebSite(
            {
                url: 'https://example.com/',
                name: 'Example',
                publisher: { '@id': ids.person },
            },
            ids,
        );
        expect(site).toEqual({
            '@type': 'WebSite',
            '@id': ids.website,
            url: 'https://example.com/',
            name: 'Example',
            publisher: { '@id': ids.person },
        });
        expect(site).not.toHaveProperty('inLanguage');
    });

    it('emits inLanguage when explicitly provided', () => {
        const site = buildWebSite(
            {
                url: 'https://example.com/',
                name: 'Example',
                publisher: { '@id': ids.person },
                inLanguage: 'nl-NL',
            },
            ids,
        );
        expect(site.inLanguage).toBe('nl-NL');
    });

    it('includes optional hasPart and description', () => {
        const site = buildWebSite(
            {
                url: 'https://example.com/',
                name: 'Example',
                description: 'A site',
                publisher: { '@id': ids.person },
                hasPart: { '@id': ids.navigation },
            },
            ids,
        );
        expect(site.description).toBe('A site');
        expect(site.hasPart).toEqual({ '@id': ids.navigation });
    });

    it('includes optional about reference', () => {
        const site = buildWebSite(
            {
                url: 'https://example.com/',
                name: 'Example',
                publisher: { '@id': ids.person },
                about: { '@id': ids.person },
            },
            ids,
        );
        expect(site.about).toEqual({ '@id': ids.person });
    });
});

describe('buildPerson', () => {
    it('uses the site-wide Person @id', () => {
        const person = buildPerson({ name: 'Jane Doe' }, ids);
        expect(person['@type']).toBe('Person');
        expect(person['@id']).toBe(ids.person);
        expect(person.name).toBe('Jane Doe');
    });

    it('passes through all schema.org properties', () => {
        const person = buildPerson(
            {
                name: 'Jane',
                jobTitle: 'Engineer',
                sameAs: ['https://example.com'],
                knowsLanguage: ['en', 'nl'],
            },
            ids,
        );
        expect(person.jobTitle).toBe('Engineer');
        expect(person.sameAs).toEqual(['https://example.com']);
        expect(person.knowsLanguage).toEqual(['en', 'nl']);
    });
});

describe('buildOrganization', () => {
    it('builds a plain Organization', () => {
        const org = buildOrganization(
            { slug: 'acme', name: 'ACME', url: 'https://acme.example' },
            ids,
        );
        expect(org).toEqual({
            '@type': 'Organization',
            '@id': ids.organization('acme'),
            name: 'ACME',
            url: 'https://acme.example',
        });
    });

    it('accepts a subtype and merges extra properties', () => {
        const hotel = buildOrganization(
            {
                slug: 'la-limonaia',
                name: 'La Limonaia',
                extra: { checkinTime: '16:00:00', checkoutTime: '10:00:00' },
            },
            ids,
            'Hotel',
        );
        expect(hotel['@type']).toBe('Hotel');
        expect(hotel.checkinTime).toBe('16:00:00');
        expect(hotel.checkoutTime).toBe('10:00:00');
    });

    it('flows schema-dts subtype types through the generic parameter', () => {
        // This test is primarily a compile-time check — if the
        // generic doesn't carry through to `extra`, this call site
        // will either error or lose autocomplete on `checkinTime`.
        // At runtime we still just verify the property lands on the
        // output object.
        type Hotel = import('schema-dts').Hotel;
        const hotel = buildOrganization<Hotel>(
            {
                slug: 'la-limonaia',
                name: 'La Limonaia',
                extra: { checkinTime: '16:00:00' },
            },
            ids,
            'Hotel',
        );
        expect(hotel['@type']).toBe('Hotel');
        expect(hotel.checkinTime).toBe('16:00:00');
    });
});

describe('buildSiteNavigationElement', () => {
    it('wraps items in a hasPart list', () => {
        const nav = buildSiteNavigationElement(
            {
                name: 'Main navigation',
                isPartOf: { '@id': ids.website },
                items: [
                    { name: 'Home', url: 'https://example.com/' },
                    { name: 'Blog', url: 'https://example.com/blog/' },
                ],
            },
            ids,
        );
        expect(nav['@id']).toBe(ids.navigation);
        expect(nav.hasPart).toEqual([
            { '@type': 'SiteNavigationElement', name: 'Home', url: 'https://example.com/' },
            { '@type': 'SiteNavigationElement', name: 'Blog', url: 'https://example.com/blog/' },
        ]);
    });
});

describe('buildWebPage', () => {
    it('adds a default ReadAction potentialAction', () => {
        const page = buildWebPage(
            {
                url: postUrl,
                name: 'Hello',
                isPartOf: { '@id': ids.website },
                breadcrumb: { '@id': ids.breadcrumb(postUrl) },
            },
            ids,
        );
        expect(page.potentialAction).toEqual([{ '@type': 'ReadAction', target: [postUrl] }]);
    });

    it('supports ProfilePage and CollectionPage subtypes', () => {
        const profile = buildWebPage(
            {
                url: 'https://example.com/about/',
                name: 'About',
                isPartOf: { '@id': ids.website },
                breadcrumb: { '@id': ids.breadcrumb('https://example.com/about/') },
            },
            ids,
            'ProfilePage',
        );
        expect(profile['@type']).toBe('ProfilePage');

        const collection = buildWebPage(
            {
                url: 'https://example.com/blog/',
                name: 'Blog',
                isPartOf: { '@id': ids.website },
                breadcrumb: { '@id': ids.breadcrumb('https://example.com/blog/') },
            },
            ids,
            'CollectionPage',
        );
        expect(collection['@type']).toBe('CollectionPage');
    });

    it('serializes dates as ISO strings', () => {
        const page = buildWebPage(
            {
                url: postUrl,
                name: 'Hello',
                isPartOf: { '@id': ids.website },
                breadcrumb: { '@id': ids.breadcrumb(postUrl) },
                datePublished: new Date('2026-01-01T00:00:00.000Z'),
                dateModified: new Date('2026-02-01T00:00:00.000Z'),
            },
            ids,
        );
        expect(page.datePublished).toBe('2026-01-01T00:00:00.000Z');
        expect(page.dateModified).toBe('2026-02-01T00:00:00.000Z');
    });

    it('omits breadcrumb when not provided', () => {
        const page = buildWebPage(
            {
                url: postUrl,
                name: 'Hello',
                isPartOf: { '@id': ids.website },
            },
            ids,
        );
        expect(page).not.toHaveProperty('breadcrumb');
        // The rest of the shape is unaffected.
        expect(page['@type']).toBe('WebPage');
        expect(page['@id']).toBe(postUrl);
        expect(page.isPartOf).toEqual({ '@id': ids.website });
    });

    it('omits inLanguage when not provided, and emits it when given', () => {
        const without = buildWebPage(
            {
                url: postUrl,
                name: 'Hello',
                isPartOf: { '@id': ids.website },
                breadcrumb: { '@id': ids.breadcrumb(postUrl) },
            },
            ids,
        );
        expect(without).not.toHaveProperty('inLanguage');

        const withLocale = buildWebPage(
            {
                url: postUrl,
                name: 'Hello',
                isPartOf: { '@id': ids.website },
                breadcrumb: { '@id': ids.breadcrumb(postUrl) },
                inLanguage: 'nl-NL',
            },
            ids,
        );
        expect(withLocale.inLanguage).toBe('nl-NL');
    });
});

describe('buildArticle', () => {
    it('builds a minimal Article', () => {
        const article = buildArticle(
            {
                url: postUrl,
                isPartOf: { '@id': ids.webPage(postUrl) },
                author: { '@id': ids.person },
                publisher: { '@id': ids.person },
                headline: 'Hello',
                description: 'World',
                datePublished: new Date('2026-01-01T00:00:00.000Z'),
            },
            ids,
        );
        expect(article['@type']).toBe('Article');
        expect(article['@id']).toBe(`${postUrl}#article`);
        expect(article.mainEntityOfPage).toEqual({ '@id': postUrl });
        expect(article.datePublished).toBe('2026-01-01T00:00:00.000Z');
        expect(article.dateModified).toBeUndefined();
        expect(article.articleBody).toBeUndefined();
        expect(article).not.toHaveProperty('inLanguage');
    });

    it('includes optional fields when provided', () => {
        const article = buildArticle(
            {
                url: postUrl,
                isPartOf: { '@id': ids.webPage(postUrl) },
                author: { '@id': ids.person },
                publisher: { '@id': ids.person },
                headline: 'Hello',
                description: 'World',
                datePublished: new Date('2026-01-01T00:00:00.000Z'),
                dateModified: new Date('2026-02-01T00:00:00.000Z'),
                image: { '@id': ids.primaryImage(postUrl) },
                articleSection: 'Tech',
                wordCount: 100,
                articleBody: 'Hello world',
            },
            ids,
        );
        expect(article.dateModified).toBe('2026-02-01T00:00:00.000Z');
        expect(article.image).toEqual({ '@id': ids.primaryImage(postUrl) });
        expect(article.articleSection).toBe('Tech');
        expect(article.wordCount).toBe(100);
        expect(article.articleBody).toBe('Hello world');
    });
});

describe('buildBreadcrumbList', () => {
    it('emits ListItem entries with 1-based positions', () => {
        const breadcrumb = buildBreadcrumbList(
            {
                url: postUrl,
                items: [
                    { name: 'Home', url: 'https://example.com/' },
                    { name: 'Blog', url: 'https://example.com/blog/' },
                    { name: 'Hello', url: postUrl },
                ],
            },
            ids,
        );
        expect(breadcrumb['@id']).toBe(`${postUrl}#breadcrumb`);
        const items = breadcrumb.itemListElement as Array<Record<string, unknown>>;
        expect(items).toHaveLength(3);
        expect(items[0]).toEqual({
            '@type': 'ListItem',
            position: 1,
            name: 'Home',
            item: 'https://example.com/',
        });
        expect(items[2]?.position).toBe(3);
        // Last item references the WebPage by @id instead of a plain URL.
        expect(items[2]?.item).toEqual({ '@id': postUrl });
        // Non-last items use plain URL strings.
        expect(items[0]?.item).toBe('https://example.com/');
        expect(items[1]?.item).toBe('https://example.com/blog/');
    });
});

describe('buildImageObject', () => {
    it('uses pageUrl to derive the @id', () => {
        const img = buildImageObject(
            {
                pageUrl: postUrl,
                url: 'https://example.com/og/hello.png',
                width: 1200,
                height: 630,
            },
            ids,
        );
        expect(img['@id']).toBe(`${postUrl}#primaryimage`);
        expect(img.url).toBe('https://example.com/og/hello.png');
        expect(img.contentUrl).toBe('https://example.com/og/hello.png');
        expect(img.width).toBe(1200);
        expect(img.height).toBe(630);
        expect(img).not.toHaveProperty('inLanguage');
    });

    it('accepts an explicit id override', () => {
        const img = buildImageObject(
            {
                id: ids.personImage,
                url: 'https://example.com/me.jpg',
                width: 400,
                height: 400,
                caption: 'Jane Doe',
            },
            ids,
        );
        expect(img['@id']).toBe(ids.personImage);
        expect(img.caption).toBe('Jane Doe');
    });

    it('throws if neither id nor pageUrl is provided', () => {
        expect(() =>
            buildImageObject({ url: 'https://example.com/x.png', width: 1, height: 1 }, ids),
        ).toThrow(/either `id` or `pageUrl`/);
    });
});

describe('buildVideoObject', () => {
    it('derives YouTube thumbnail and embed URLs from youtubeId', () => {
        const video = buildVideoObject(
            {
                url: 'https://example.com/v/',
                name: 'Talk',
                description: 'A talk',
                isPartOf: { '@id': 'https://example.com/v/' },
                youtubeId: 'abc123',
            },
            ids,
        );
        expect(video.thumbnailUrl).toBe('https://img.youtube.com/vi/abc123/maxresdefault.jpg');
        expect(video.embedUrl).toBe('https://www.youtube-nocookie.com/embed/abc123');
    });

    it('respects explicit thumbnail and embed overrides', () => {
        const video = buildVideoObject(
            {
                url: 'https://example.com/v/',
                name: 'Talk',
                description: 'A talk',
                isPartOf: { '@id': 'https://example.com/v/' },
                youtubeId: 'abc123',
                thumbnailUrl: 'https://cdn.example/thumb.jpg',
                embedUrl: 'https://cdn.example/embed',
            },
            ids,
        );
        expect(video.thumbnailUrl).toBe('https://cdn.example/thumb.jpg');
        expect(video.embedUrl).toBe('https://cdn.example/embed');
    });
});

describe('buildCustomPiece', () => {
    it('returns the input unchanged', () => {
        const raw = { '@type': 'Recipe', '@id': 'x', name: 'Bread' };
        expect(buildCustomPiece(raw)).toBe(raw);
    });
});
