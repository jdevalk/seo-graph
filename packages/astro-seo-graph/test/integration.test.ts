import { describe, expect, it } from 'vitest';
import {
    countH1s,
    extractTitle,
    extractMetaDescription,
    isDefaultExcludedFromIndexNow,
} from '../src/integration.js';

describe('countH1s', () => {
    it('returns 0 when there are no h1s', () => {
        expect(countH1s('<p>Hello</p>')).toBe(0);
    });

    it('counts a single h1', () => {
        expect(countH1s('<h1>Title</h1>')).toBe(1);
    });

    it('counts multiple h1s', () => {
        expect(countH1s('<h1>A</h1><h1>B</h1>')).toBe(2);
    });

    it('matches h1 with attributes', () => {
        expect(countH1s('<h1 class="foo" id="bar">Title</h1>')).toBe(1);
    });

    it('is case-insensitive', () => {
        expect(countH1s('<H1>Title</H1>')).toBe(1);
    });

    it('does not match h11, h10, etc.', () => {
        expect(countH1s('<h10>Not an h1</h10>')).toBe(0);
    });

    it('does not match h1 inside attribute values', () => {
        expect(countH1s('<div data-attr="h1">Not an h1</div>')).toBe(0);
    });

    it('handles real-world HTML', () => {
        const html = `
            <!DOCTYPE html>
            <html>
                <head><title>Page</title></head>
                <body>
                    <header><h1>Site Name</h1></header>
                    <main><h2>Section</h2></main>
                </body>
            </html>
        `;
        expect(countH1s(html)).toBe(1);
    });
});

describe('extractTitle', () => {
    it('returns the title text', () => {
        expect(extractTitle('<title>Hello</title>')).toBe('Hello');
    });

    it('collapses whitespace and decodes entities', () => {
        expect(extractTitle('<title>  Hello &amp;  World  </title>')).toBe('Hello & World');
    });

    it('returns null when absent or empty', () => {
        expect(extractTitle('<p>No title</p>')).toBeNull();
        expect(extractTitle('<title>   </title>')).toBeNull();
    });

    it('tolerates attributes on the title tag', () => {
        expect(extractTitle('<title data-foo="bar">Hi</title>')).toBe('Hi');
    });
});

describe('extractMetaDescription', () => {
    it('reads content when name precedes content', () => {
        expect(extractMetaDescription('<meta name="description" content="A short desc">')).toBe(
            'A short desc',
        );
    });

    it('reads content when content precedes name', () => {
        expect(extractMetaDescription('<meta content="Reversed order" name="description">')).toBe(
            'Reversed order',
        );
    });

    it('decodes entities', () => {
        expect(extractMetaDescription('<meta name="description" content="Rock &amp; Roll">')).toBe(
            'Rock & Roll',
        );
    });

    it('returns null when absent or empty', () => {
        expect(extractMetaDescription('<meta name="keywords" content="x">')).toBeNull();
        expect(extractMetaDescription('<meta name="description" content="">')).toBeNull();
    });

    it('is case-insensitive on the name attribute', () => {
        expect(extractMetaDescription('<META NAME="Description" CONTENT="caps">')).toBe('caps');
    });
});

describe('isDefaultExcludedFromIndexNow', () => {
    it('excludes /404', () => {
        expect(isDefaultExcludedFromIndexNow('https://example.com/404')).toBe(true);
    });

    it('excludes /404/', () => {
        expect(isDefaultExcludedFromIndexNow('https://example.com/404/')).toBe(true);
    });

    it('does not exclude nested paths that merely contain 404', () => {
        expect(isDefaultExcludedFromIndexNow('https://example.com/blog/404-error-post/')).toBe(
            false,
        );
        expect(isDefaultExcludedFromIndexNow('https://example.com/errors/404/')).toBe(false);
    });

    it('does not exclude ordinary pages', () => {
        expect(isDefaultExcludedFromIndexNow('https://example.com/')).toBe(false);
        expect(isDefaultExcludedFromIndexNow('https://example.com/blog/post/')).toBe(false);
    });

    it('returns false for unparseable input rather than throwing', () => {
        expect(isDefaultExcludedFromIndexNow('not a url')).toBe(false);
    });
});
