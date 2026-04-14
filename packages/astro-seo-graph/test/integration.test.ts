import { describe, expect, it } from 'vitest';
import {
    classifyInternalLink,
    collectAstroRedirectSources,
    countH1s,
    DEFAULT_METADATA_LENGTH_BOUNDS,
    extractAnchorHrefs,
    extractTitle,
    extractMetaDescription,
    findImagesWithoutAlt,
    htmlFileToPath,
    isDefaultExcludedFromIndexNow,
    parseNetlifyRedirects,
    resolveMetadataLengthBounds,
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

describe('findImagesWithoutAlt', () => {
    it('returns [] when every img has alt', () => {
        const html = '<img src="/a.png" alt="A"><img src="/b.png" alt="">';
        expect(findImagesWithoutAlt(html)).toEqual([]);
    });

    it('flags images missing alt entirely', () => {
        const html = '<img src="/cat.jpg"><img src="/dog.jpg" alt="A dog">';
        expect(findImagesWithoutAlt(html)).toEqual(['/cat.jpg']);
    });

    it('accepts alt="" as intentional (decorative) and does not flag', () => {
        const html = '<img src="/divider.svg" alt="">';
        expect(findImagesWithoutAlt(html)).toEqual([]);
    });

    it('accepts role="presentation" as intentional (decorative) and does not flag', () => {
        expect(findImagesWithoutAlt('<img src="/divider.svg" role="presentation">')).toEqual([]);
    });

    it('accepts role="none" as equivalent to role="presentation"', () => {
        expect(findImagesWithoutAlt('<img src="/divider.svg" role="none">')).toEqual([]);
    });

    it('is case-insensitive on the role value', () => {
        expect(findImagesWithoutAlt('<img src="/x.svg" role="PRESENTATION">')).toEqual([]);
    });

    it('still flags images whose role is something unrelated', () => {
        expect(findImagesWithoutAlt('<img src="/x.svg" role="img">')).toEqual(['/x.svg']);
    });

    it('returns "(no src)" when both src and alt are missing', () => {
        expect(findImagesWithoutAlt('<img>')).toEqual(['(no src)']);
    });

    it('is case-insensitive on tag, attribute names, and src quoting', () => {
        const html = `<IMG SRC='/a.png'><Img src="/b.png" ALT="B">`;
        expect(findImagesWithoutAlt(html)).toEqual(['/a.png']);
    });

    it('does not confuse attribute names that contain alt (e.g. altitude)', () => {
        const html = '<img src="/map.png" data-altitude="100">';
        expect(findImagesWithoutAlt(html)).toEqual(['/map.png']);
    });

    it('tolerates attributes before and after src and alt', () => {
        const html = '<img loading="lazy" src="/x.png" width="10" height="10">';
        expect(findImagesWithoutAlt(html)).toEqual(['/x.png']);
    });

    it('finds multiple offenders in one document', () => {
        const html = `
            <p><img src="/a.png"></p>
            <figure><img src="/b.png" alt="B"></figure>
            <img src="/c.png">
        `;
        expect(findImagesWithoutAlt(html)).toEqual(['/a.png', '/c.png']);
    });
});

describe('resolveMetadataLengthBounds', () => {
    it('returns null when disabled (false or undefined)', () => {
        expect(resolveMetadataLengthBounds(false)).toBeNull();
        expect(resolveMetadataLengthBounds(undefined)).toBeNull();
    });

    it('returns defaults when true', () => {
        expect(resolveMetadataLengthBounds(true)).toEqual({
            title: { min: 30, max: 65 },
            description: { min: 70, max: 200 },
        });
    });

    it('defaults match DEFAULT_METADATA_LENGTH_BOUNDS', () => {
        const resolved = resolveMetadataLengthBounds(true);
        expect(resolved?.title.min).toBe(DEFAULT_METADATA_LENGTH_BOUNDS.title.min);
        expect(resolved?.title.max).toBe(DEFAULT_METADATA_LENGTH_BOUNDS.title.max);
        expect(resolved?.description.min).toBe(DEFAULT_METADATA_LENGTH_BOUNDS.description.min);
        expect(resolved?.description.max).toBe(DEFAULT_METADATA_LENGTH_BOUNDS.description.max);
    });

    it('applies per-field overrides while keeping defaults for the rest', () => {
        expect(resolveMetadataLengthBounds({ title: { max: 80 } })).toEqual({
            title: { min: 30, max: 80 },
            description: { min: 70, max: 200 },
        });
    });

    it('allows overriding only one side of the range', () => {
        expect(resolveMetadataLengthBounds({ description: { min: 100 } })).toEqual({
            title: { min: 30, max: 65 },
            description: { min: 100, max: 200 },
        });
    });

    it('accepts a full override', () => {
        expect(
            resolveMetadataLengthBounds({
                title: { min: 10, max: 100 },
                description: { min: 50, max: 300 },
            }),
        ).toEqual({
            title: { min: 10, max: 100 },
            description: { min: 50, max: 300 },
        });
    });
});

describe('htmlFileToPath', () => {
    it('maps index.html to root', () => {
        expect(htmlFileToPath('index.html')).toBe('/');
    });

    it('maps nested index.html to the directory path with trailing slash', () => {
        expect(htmlFileToPath('about/index.html')).toBe('/about/');
        expect(htmlFileToPath('blog/post/index.html')).toBe('/blog/post/');
    });

    it('maps flat .html files to extensionless paths', () => {
        expect(htmlFileToPath('about.html')).toBe('/about');
    });

    it('normalizes backslashes (Windows paths)', () => {
        expect(htmlFileToPath('blog\\post\\index.html')).toBe('/blog/post/');
    });
});

describe('extractAnchorHrefs', () => {
    it('returns hrefs in document order', () => {
        const html = '<a href="/a">A</a><p><a href="/b">B</a></p>';
        expect(extractAnchorHrefs(html)).toEqual(['/a', '/b']);
    });

    it('tolerates attributes before href and single quotes', () => {
        const html = `<a class="nav" href='/home'>Home</a>`;
        expect(extractAnchorHrefs(html)).toEqual(['/home']);
    });

    it('is case-insensitive on tag and attribute', () => {
        expect(extractAnchorHrefs('<A HREF="/x">x</A>')).toEqual(['/x']);
    });

    it('returns [] when there are no anchors', () => {
        expect(extractAnchorHrefs('<p>No links here</p>')).toEqual([]);
    });

    it('ignores anchor-like constructs inside attribute values', () => {
        // `<a href>` pattern must actually be an opening anchor tag.
        expect(extractAnchorHrefs('<div data-ref="a href=/x">')).toEqual([]);
    });
});

describe('classifyInternalLink', () => {
    const builtPaths = new Set(['/', '/about-me/', '/blog/post-1', '/contact/']);
    const origin = 'https://example.com';

    it('returns external for #fragment, mailto:, tel:, javascript:', () => {
        expect(classifyInternalLink('#top', builtPaths, origin).status).toBe('external');
        expect(classifyInternalLink('mailto:a@b.com', builtPaths, origin).status).toBe('external');
        expect(classifyInternalLink('tel:+1234', builtPaths, origin).status).toBe('external');
        expect(classifyInternalLink('javascript:void(0)', builtPaths, origin).status).toBe(
            'external',
        );
    });

    it('returns external for different origins', () => {
        expect(classifyInternalLink('https://other.com/foo', builtPaths, origin).status).toBe(
            'external',
        );
    });

    it('returns ok when a root-relative path matches exactly', () => {
        expect(classifyInternalLink('/about-me/', builtPaths, origin).status).toBe('ok');
    });

    it('returns ok when an absolute same-origin URL matches exactly', () => {
        expect(
            classifyInternalLink('https://example.com/about-me/', builtPaths, origin).status,
        ).toBe('ok');
    });

    it('flags a missing trailing slash against a directory build', () => {
        const result = classifyInternalLink('/about-me', builtPaths, origin);
        expect(result.status).toBe('trailing-slash');
        if (result.status === 'trailing-slash') {
            expect(result.suggested).toBe('/about-me/');
        }
    });

    it('flags a spurious trailing slash against a flat .html build', () => {
        const result = classifyInternalLink('/blog/post-1/', builtPaths, origin);
        expect(result.status).toBe('trailing-slash');
        if (result.status === 'trailing-slash') {
            expect(result.suggested).toBe('/blog/post-1');
        }
    });

    it('returns not-found for paths not in the build', () => {
        expect(classifyInternalLink('/missing/', builtPaths, origin).status).toBe('not-found');
    });

    it('strips query and fragment before matching', () => {
        expect(classifyInternalLink('/about-me/?utm=x#h', builtPaths, origin).status).toBe('ok');
        expect(classifyInternalLink('/about-me?utm=x', builtPaths, origin).status).toBe(
            'trailing-slash',
        );
    });

    it('treats absolute URLs as external when origin is undefined', () => {
        expect(
            classifyInternalLink('https://example.com/about-me/', builtPaths, undefined).status,
        ).toBe('external');
    });

    it('still classifies root-relative paths when origin is undefined', () => {
        expect(classifyInternalLink('/about-me', builtPaths, undefined).status).toBe(
            'trailing-slash',
        );
    });

    it('treats relative paths without leading slash as external (not worth guessing)', () => {
        expect(classifyInternalLink('about-me/', builtPaths, origin).status).toBe('external');
        expect(classifyInternalLink('../foo', builtPaths, origin).status).toBe('external');
    });

    it('returns external for empty href', () => {
        expect(classifyInternalLink('', builtPaths, origin).status).toBe('external');
    });
});

describe('parseNetlifyRedirects', () => {
    it('extracts literal from paths', () => {
        const content = `
/about-me /about-me/ 301
/old-page /new-page 301
        `;
        expect(parseNetlifyRedirects(content)).toEqual(['/about-me', '/old-page']);
    });

    it('skips comments and blank lines', () => {
        const content = `
# legacy rewrites
/a /b 301

# another group
/c /d
        `;
        expect(parseNetlifyRedirects(content)).toEqual(['/a', '/c']);
    });

    it('skips dynamic rules (wildcards, splats, placeholders)', () => {
        const content = [
            '/static /s 301',
            '/old/* /new/:splat 301',
            '/user/:id /users/:id 301',
            '/literal /ok 301',
        ].join('\n');
        expect(parseNetlifyRedirects(content)).toEqual(['/static', '/literal']);
    });

    it('skips non-path sources (full-URL proxy/rewrite rules)', () => {
        const content = 'https://old.example.com/* https://new.example.com/:splat 301';
        expect(parseNetlifyRedirects(content)).toEqual([]);
    });

    it('tolerates Windows line endings', () => {
        expect(parseNetlifyRedirects('/a /b\r\n/c /d\r\n')).toEqual(['/a', '/c']);
    });

    it('returns [] for empty input', () => {
        expect(parseNetlifyRedirects('')).toEqual([]);
    });
});

describe('collectAstroRedirectSources', () => {
    it('returns literal keys from a string-valued redirects map', () => {
        expect(
            collectAstroRedirectSources({
                '/about-me': '/about-me/',
                '/old': '/new',
            }),
        ).toEqual(['/about-me', '/old']);
    });

    it('returns literal keys when the value is a config object', () => {
        expect(
            collectAstroRedirectSources({
                '/legacy': { status: 301, destination: '/new' },
            }),
        ).toEqual(['/legacy']);
    });

    it('skips dynamic keys with params or wildcards', () => {
        expect(
            collectAstroRedirectSources({
                '/static': '/ok',
                '/old/[slug]': '/new/[slug]',
                '/path/*': '/other/*',
            }),
        ).toEqual(['/static']);
    });

    it('skips keys that do not start with a slash', () => {
        expect(
            collectAstroRedirectSources({
                'about-me': '/about-me/',
            }),
        ).toEqual([]);
    });

    it('returns [] when redirects is undefined', () => {
        expect(collectAstroRedirectSources(undefined)).toEqual([]);
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
