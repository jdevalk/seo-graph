import { describe, expect, it } from 'vitest';
import { breadcrumbsFromUrl } from '../src/breadcrumbs.js';

const SITE = 'https://example.com';

describe('breadcrumbsFromUrl', () => {
    describe('basic derivation', () => {
        it('returns Home + page for a top-level page', () => {
            expect(
                breadcrumbsFromUrl({
                    url: 'https://example.com/about/',
                    siteUrl: SITE,
                    pageName: 'About Us',
                }),
            ).toEqual([
                { name: 'Home', url: 'https://example.com/' },
                { name: 'About Us', url: 'https://example.com/about/' },
            ]);
        });

        it('derives intermediate crumbs from path segments', () => {
            expect(
                breadcrumbsFromUrl({
                    url: 'https://example.com/blog/2024/my-post/',
                    siteUrl: SITE,
                    pageName: 'My Post',
                }),
            ).toEqual([
                { name: 'Home', url: 'https://example.com/' },
                { name: 'Blog', url: 'https://example.com/blog/' },
                { name: '2024', url: 'https://example.com/blog/2024/' },
                { name: 'My Post', url: 'https://example.com/blog/2024/my-post/' },
            ]);
        });

        it('returns only Home for the site root', () => {
            expect(
                breadcrumbsFromUrl({
                    url: 'https://example.com/',
                    siteUrl: SITE,
                    pageName: 'Home',
                }),
            ).toEqual([{ name: 'Home', url: 'https://example.com/' }]);
        });
    });

    describe('custom names', () => {
        it('uses names map for intermediate segments', () => {
            expect(
                breadcrumbsFromUrl({
                    url: 'https://example.com/blog/open-source/my-post/',
                    siteUrl: SITE,
                    pageName: 'My Post',
                    names: { blog: 'Articles', 'open-source': 'Open Source' },
                }),
            ).toEqual([
                { name: 'Home', url: 'https://example.com/' },
                { name: 'Articles', url: 'https://example.com/blog/' },
                { name: 'Open Source', url: 'https://example.com/blog/open-source/' },
                { name: 'My Post', url: 'https://example.com/blog/open-source/my-post/' },
            ]);
        });

        it('allows overriding the home name', () => {
            const items = breadcrumbsFromUrl({
                url: 'https://example.com/about/',
                siteUrl: SITE,
                pageName: 'About',
                homeName: 'Start',
            });
            expect(items[0]?.name).toBe('Start');
        });
    });

    describe('title-casing', () => {
        it('title-cases hyphenated slugs', () => {
            const items = breadcrumbsFromUrl({
                url: 'https://example.com/my-great-section/post/',
                siteUrl: SITE,
                pageName: 'Post',
            });
            expect(items[1]?.name).toBe('My Great Section');
        });

        it('capitalizes single-word slugs', () => {
            const items = breadcrumbsFromUrl({
                url: 'https://example.com/blog/post/',
                siteUrl: SITE,
                pageName: 'Post',
            });
            expect(items[1]?.name).toBe('Blog');
        });
    });

    describe('skip segments', () => {
        it('omits skipped segments from the trail', () => {
            expect(
                breadcrumbsFromUrl({
                    url: 'https://example.com/blog/category/open-source/my-post/',
                    siteUrl: SITE,
                    pageName: 'My Post',
                    skip: ['category'],
                }),
            ).toEqual([
                { name: 'Home', url: 'https://example.com/' },
                { name: 'Blog', url: 'https://example.com/blog/' },
                { name: 'Open Source', url: 'https://example.com/blog/category/open-source/' },
                { name: 'My Post', url: 'https://example.com/blog/category/open-source/my-post/' },
            ]);
        });

        it('skipped segments still build correct URLs for subsequent crumbs', () => {
            const items = breadcrumbsFromUrl({
                url: 'https://example.com/a/b/c/page/',
                siteUrl: SITE,
                pageName: 'Page',
                skip: ['b'],
            });
            // 'c' URL should include 'b' in the path even though 'b' is skipped as a crumb
            expect(items[2]?.url).toBe('https://example.com/a/b/c/');
        });
    });

    describe('URL handling', () => {
        it('accepts a URL object', () => {
            const items = breadcrumbsFromUrl({
                url: new URL('https://example.com/blog/post/'),
                siteUrl: SITE,
                pageName: 'Post',
            });
            expect(items).toHaveLength(3);
            expect(items[2]?.url).toBe('https://example.com/blog/post/');
        });

        it('adds trailing slash to page URLs without one', () => {
            const items = breadcrumbsFromUrl({
                url: 'https://example.com/about',
                siteUrl: SITE,
                pageName: 'About',
            });
            expect(items[1]?.url).toBe('https://example.com/about/');
        });

        it('works with a site that has a base path', () => {
            expect(
                breadcrumbsFromUrl({
                    url: 'https://example.com/docs/guide/intro/',
                    siteUrl: 'https://example.com/docs',
                    pageName: 'Introduction',
                }),
            ).toEqual([
                { name: 'Home', url: 'https://example.com/docs/' },
                { name: 'Guide', url: 'https://example.com/docs/guide/' },
                { name: 'Introduction', url: 'https://example.com/docs/guide/intro/' },
            ]);
        });
    });
});
