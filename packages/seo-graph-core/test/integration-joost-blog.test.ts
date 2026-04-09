import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import {
    buildArticle,
    buildBreadcrumbList,
    buildImageObject,
    buildWebPage,
    makeIds,
} from '../src/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Reproduce the four per-post schema.org entities from the
 * "Defending the open web is not enough" post on joost.blog, using only
 * core primitives. This is Phase 1's acceptance test: if the core can't
 * reproduce the fixture byte-for-byte, the extraction will regress during
 * Phase 2.
 *
 * The fixture was captured from joost.blog's /schema/post.json endpoint
 * and pruned to the 4 entities for this single post — see the
 * `tests/fixtures/schema-graph/post.json` capture in the joost.blog repo.
 */
describe('integration: joost.blog — Defending the open web is not enough', () => {
    const fixturePath = join(__dirname, 'fixtures/joost-blog-defending-open-web.json');
    const expected = JSON.parse(readFileSync(fixturePath, 'utf-8')) as Array<
        Record<string, unknown>
    >;
    const [expectedBreadcrumb, expectedWebPage, expectedArticle, expectedImage] = expected as [
        Record<string, unknown>,
        Record<string, unknown>,
        Record<string, unknown>,
        Record<string, unknown>,
    ];

    const ids = makeIds({
        siteUrl: 'https://joost.blog',
        personUrl: 'https://joost.blog/about-me/',
    });
    const url = 'https://joost.blog/defending-open-web-not-enough/';

    it('reproduces the BreadcrumbList', () => {
        const breadcrumb = buildBreadcrumbList(
            {
                url,
                items: [
                    { name: 'Home', url: 'https://joost.blog/' },
                    { name: 'Blog', url: 'https://joost.blog/blog/' },
                    { name: 'Open Source', url: 'https://joost.blog/blog/category/open-source/' },
                    { name: 'Defending the open web is not enough', url },
                ],
            },
            ids,
        );
        expect(breadcrumb).toEqual(expectedBreadcrumb);
    });

    it('reproduces the WebPage', () => {
        const webPage = buildWebPage(
            {
                url,
                name: 'Defending the open web is not enough',
                isPartOf: { '@id': ids.website },
                breadcrumb: { '@id': ids.breadcrumb(url) },
                datePublished: new Date('2026-04-07T00:00:00.000Z'),
                primaryImage: { '@id': ids.primaryImage(url) },
            },
            ids,
        );
        expect(webPage).toEqual(expectedWebPage);
    });

    it('reproduces the Article, including articleBody', () => {
        const article = buildArticle(
            {
                url,
                isPartOf: { '@id': ids.webPage(url) },
                author: { name: 'Joost de Valk', '@id': ids.person },
                publisher: { '@id': ids.person },
                headline: 'Defending the open web is not enough',
                description: expectedArticle.description as string,
                datePublished: new Date('2026-04-07T00:00:00.000Z'),
                image: { '@id': ids.primaryImage(url) },
                articleSection: 'Open Source',
                wordCount: 2366,
                articleBody: expectedArticle.articleBody as string,
            },
            ids,
        );
        expect(article).toEqual(expectedArticle);
    });

    it('reproduces the primary ImageObject', () => {
        const image = buildImageObject(
            {
                pageUrl: url,
                url: 'https://joost.blog/og/defending-open-web-not-enough.png',
                width: 1200,
                height: 630,
            },
            ids,
        );
        expect(image).toEqual(expectedImage);
    });
});
