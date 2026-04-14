import { describe, expect, it } from 'vitest';
import { extractFromHtml } from '../src/extract.js';

describe('extractFromHtml', () => {
    it('pulls JSON-LD, canonical, title, description, og:type', () => {
        const html = `<!doctype html><html><head>
            <title>  Hello  </title>
            <link rel="canonical" href="https://example.com/post" />
            <meta name="description" content="A post" />
            <meta property="og:type" content="article" />
            <script type="application/ld+json">{"@type":"Article","@id":"x"}</script>
            <script type="application/ld+json">not json</script>
        </head><body></body></html>`;
        const result = extractFromHtml(html);
        expect(result.title).toBe('Hello');
        expect(result.canonical).toBe('https://example.com/post');
        expect(result.description).toBe('A post');
        expect(result.ogType).toBe('article');
        expect(result.jsonLd).toHaveLength(2);
        expect(result.jsonLd[0]?.parseError).toBeUndefined();
        expect(result.jsonLd[1]?.parseError).toBeDefined();
    });
});
