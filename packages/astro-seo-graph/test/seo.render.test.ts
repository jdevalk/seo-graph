import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import type { AstroComponentFactory } from 'astro/runtime/server/index.js';
import { beforeAll, describe, expect, it } from 'vitest';
import Seo from '../src/components/Seo.astro';
import type { SeoProps } from '../src/components/seo-props.js';

let container: AstroContainer;

beforeAll(async () => {
    container = await AstroContainer.create();
});

async function render(props: SeoProps, url = 'https://example.com/my-post/'): Promise<string> {
    return container.renderToString(Seo as AstroComponentFactory, {
        props: props as unknown as Record<string, unknown>,
        request: new Request(url),
    });
}

describe('Seo rendering', () => {
    it('renders a minimal head with title, canonical, robots, and OG basics', async () => {
        const html = await render({ title: 'Hello' });
        expect(html).toContain('<title>Hello</title>');
        expect(html).toContain('<link rel="canonical" href="https://example.com/my-post/">');
        expect(html).toContain(
            '<meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1">',
        );
        expect(html).toContain('<meta property="og:title" content="Hello">');
        expect(html).toContain('<meta property="og:type" content="website">');
        expect(html).toContain('<meta property="og:url" content="https://example.com/my-post/">');
        expect(html).toContain('<meta property="og:locale" content="en_US">');
    });

    it('emits exactly one <meta name="robots"> tag', async () => {
        const html = await render({ title: 'Hello' });
        const matches = html.match(/<meta name="robots"/g) ?? [];
        expect(matches).toHaveLength(1);
    });

    it('omits canonical but emits og:url when noindex is true', async () => {
        const html = await render({ title: 'Hello', noindex: true });
        expect(html).not.toContain('rel="canonical"');
        expect(html).toContain('<meta property="og:url" content="https://example.com/my-post/">');
        expect(html).toContain(
            '<meta name="robots" content="noindex, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1">',
        );
    });

    it('omits description and siteName when not provided', async () => {
        const html = await render({ title: 'Hello' });
        expect(html).not.toContain('name="description"');
        expect(html).not.toContain('og:site_name');
    });

    it('renders OG image meta only alongside an image URL', async () => {
        const html = await render({
            title: 'Hello',
            ogImage: 'https://example.com/og.png',
            ogImageAlt: 'Alt',
            ogImageWidth: 1200,
            ogImageHeight: 675,
        });
        expect(html).toContain('<meta property="og:image" content="https://example.com/og.png">');
        expect(html).toContain('<meta property="og:image:alt" content="Alt">');
        expect(html).toContain('<meta property="og:image:width" content="1200">');
        expect(html).toContain('<meta property="og:image:height" content="675">');
    });

    it('renders article meta when ogType is article', async () => {
        const html = await render({
            title: 'Post',
            ogType: 'article',
            article: {
                publishedTime: '2026-04-01T00:00:00.000Z',
                modifiedTime: '2026-04-05T00:00:00.000Z',
                authors: ['https://example.com/joost/'],
                tags: ['seo', 'astro'],
                section: 'Tech',
            },
            articlePublisher: 'https://facebook.com/example',
        });
        expect(html).toContain('<meta property="og:type" content="article">');
        expect(html).toContain(
            '<meta property="article:published_time" content="2026-04-01T00:00:00.000Z">',
        );
        expect(html).toContain(
            '<meta property="article:modified_time" content="2026-04-05T00:00:00.000Z">',
        );
        expect(html).toContain(
            '<meta property="article:author" content="https://example.com/joost/">',
        );
        expect(html).toContain('<meta property="article:tag" content="seo">');
        expect(html).toContain('<meta property="article:tag" content="astro">');
        expect(html).toContain('<meta property="article:section" content="Tech">');
        expect(html).toContain(
            '<meta property="article:publisher" content="https://facebook.com/example">',
        );
    });

    it('does not render article meta when ogType is not article', async () => {
        const html = await render({
            title: 'Page',
            ogType: 'website',
            article: { publishedTime: '2026-04-01T00:00:00.000Z' },
        });
        expect(html).not.toContain('article:published_time');
        expect(html).not.toContain('article:author');
    });

    it('renders twitter card + overrides', async () => {
        const html = await render({
            title: 'Hello',
            description: 'A post',
            ogImage: 'https://example.com/og.png',
            twitter: {
                site: '@example',
                creator: '@author',
                title: 'Twitter-only title',
                image: 'https://example.com/tw.png',
            },
        });
        expect(html).toContain('<meta name="twitter:card" content="summary_large_image">');
        expect(html).toContain('<meta name="twitter:site" content="@example">');
        expect(html).toContain('<meta name="twitter:creator" content="@author">');
        expect(html).toContain('<meta name="twitter:title" content="Twitter-only title">');
        expect(html).toContain('<meta name="twitter:image" content="https://example.com/tw.png">');
        expect(html).not.toContain('twitter:description'); // description matches OG → suppressed
    });

    it('does not render twitter tags when no twitter block is passed', async () => {
        const html = await render({ title: 'Hello' });
        expect(html).not.toContain('twitter:');
    });

    it('renders hreflang alternate links and og:locale:alternate tags', async () => {
        const html = await render({
            title: 'Hello',
            alternates: {
                defaultLocale: 'en',
                entries: [
                    { hreflang: 'en', href: 'https://example.com/en/' },
                    { hreflang: 'fr-CA', href: 'https://example.com/fr-ca/' },
                    { hreflang: 'de', href: 'https://example.com/de/' },
                ],
            },
        });
        expect(html).toContain(
            '<link rel="alternate" hreflang="en" href="https://example.com/en/">',
        );
        expect(html).toContain(
            '<link rel="alternate" hreflang="fr-CA" href="https://example.com/fr-ca/">',
        );
        expect(html).toContain(
            '<link rel="alternate" hreflang="x-default" href="https://example.com/en/">',
        );
        expect(html).toContain('<meta property="og:locale:alternate" content="fr_CA">');
        expect(html).toContain('<meta property="og:locale:alternate" content="de">');
    });

    it('does not emit <link rel="alternate" type="text/markdown"> by default', async () => {
        const html = await render({ title: 'Hello' });
        expect(html).not.toContain('type="text/markdown"');
    });

    it('renders author from explicit prop', async () => {
        const html = await render({ title: 'Hello', author: 'Joost' });
        expect(html).toContain('<meta name="author" content="Joost">');
    });

    it('passes through extraLinks and extraMeta', async () => {
        const html = await render({
            title: 'Hello',
            extraLinks: [{ rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' }],
            extraMeta: [{ name: 'theme-color', content: '#ffffff' }],
        });
        expect(html).toContain('<link rel="icon" type="image/svg+xml" href="/favicon.svg">');
        expect(html).toContain('<meta name="theme-color" content="#ffffff">');
    });

    it('injects JSON-LD when graph is provided', async () => {
        const graph = {
            '@context': 'https://schema.org',
            '@graph': [{ '@type': 'WebSite', url: 'https://example.com/' }],
        };
        const html = await render({ title: 'Hello', graph });
        expect(html).toContain('<script type="application/ld+json">');
        expect(html).toContain('"@type":"WebSite"');
    });

    it('does not inject a JSON-LD script when graph is null', async () => {
        const html = await render({ title: 'Hello', graph: null });
        expect(html).not.toContain('application/ld+json');
    });
});
