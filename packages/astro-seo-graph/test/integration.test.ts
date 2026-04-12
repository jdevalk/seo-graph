import { describe, expect, it } from 'vitest';
import { countH1s } from '../src/integration.js';

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
