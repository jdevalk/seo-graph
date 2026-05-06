import { describe, it, expect } from 'vitest';
import { renderMarkdownAlternate, deriveMdUrl } from '../src/markdown-alternate.js';
import { createMarkdownEndpoint } from '../src/markdown-routes.js';

describe('renderMarkdownAlternate', () => {
    const base = {
        frontmatter: {
            title: 'Hello',
            canonical: 'https://example.com/hello/',
        },
        body: 'Hello world.',
    };

    it('renders minimal input with frontmatter delimiters and a trailing newline', () => {
        const { markdown } = renderMarkdownAlternate(base);
        expect(markdown).toBe(
            '---\ntitle: Hello\ncanonical: "https://example.com/hello/"\n---\n\nHello world.\n',
        );
    });

    it('renders all keys in declaration order', () => {
        const { markdown } = renderMarkdownAlternate({
            frontmatter: {
                title: 'T',
                canonical: 'https://ex.com/p',
                pubDate: new Date('2026-04-14T00:00:00Z'),
                updatedDate: '2026-04-15',
                author: 'Joost',
                description: 'D',
                tags: ['a', 'b'],
                categories: ['x'],
            },
            body: 'body',
        });
        const keys = markdown
            .split('\n')
            .filter((l) => /^[a-z]+:/i.test(l))
            .map((l) => l.split(':')[0]);
        expect(keys).toEqual([
            'title',
            'canonical',
            'pubDate',
            'updatedDate',
            'author',
            'description',
            'tags',
            'categories',
        ]);
    });

    it('serialises a Date pubDate as ISO', () => {
        const { markdown } = renderMarkdownAlternate({
            ...base,
            frontmatter: { ...base.frontmatter, pubDate: new Date('2026-04-14T12:00:00Z') },
        });
        expect(markdown).toContain('pubDate: "2026-04-14T12:00:00.000Z"');
    });

    it('passes a string pubDate through unchanged', () => {
        const { markdown } = renderMarkdownAlternate({
            ...base,
            frontmatter: { ...base.frontmatter, pubDate: '2026-04-14' },
        });
        expect(markdown).toContain('pubDate: 2026-04-14');
    });

    it('stringifies a URL canonical', () => {
        const { markdown } = renderMarkdownAlternate({
            ...base,
            frontmatter: { ...base.frontmatter, canonical: new URL('https://ex.com/a/') },
        });
        expect(markdown).toContain('canonical: "https://ex.com/a/"');
    });

    it('omits empty tags array entirely', () => {
        const { markdown } = renderMarkdownAlternate({
            ...base,
            frontmatter: { ...base.frontmatter, tags: [] },
        });
        expect(markdown).not.toContain('tags:');
    });

    it('renders tags as a flow-style list', () => {
        const { markdown } = renderMarkdownAlternate({
            ...base,
            frontmatter: { ...base.frontmatter, tags: ['astro', 'seo'] },
        });
        expect(markdown).toContain('tags: [astro, seo]');
    });

    it('quotes and escapes strings containing a colon', () => {
        const { markdown } = renderMarkdownAlternate({
            ...base,
            frontmatter: { ...base.frontmatter, title: 'Pro: tip "here"' },
        });
        expect(markdown).toContain('title: "Pro: tip \\"here\\""');
    });

    it('drops undefined core keys', () => {
        const { markdown } = renderMarkdownAlternate({
            ...base,
            frontmatter: { ...base.frontmatter, author: undefined },
        });
        expect(markdown).not.toContain('author:');
    });

    it('uses the default token estimator (chars/4)', () => {
        const { markdown, tokenCount } = renderMarkdownAlternate(base);
        expect(tokenCount).toBe(Math.ceil(markdown.length / 4));
    });

    it('calls a custom estimateTokens with the final rendered string', () => {
        const seen: string[] = [];
        const { tokenCount } = renderMarkdownAlternate({
            ...base,
            estimateTokens: (t) => {
                seen.push(t);
                return 42;
            },
        });
        expect(tokenCount).toBe(42);
        expect(seen).toHaveLength(1);
        expect(seen[0]).toContain('Hello world.');
    });

    it('applies transformBody before rendering', () => {
        const { markdown } = renderMarkdownAlternate({
            ...base,
            transformBody: (b) => b.toUpperCase(),
        });
        expect(markdown).toContain('HELLO WORLD.');
    });

    it('trims trailing whitespace from the body and appends one newline', () => {
        const { markdown } = renderMarkdownAlternate({ ...base, body: 'Body\n\n\n  ' });
        expect(markdown.endsWith('Body\n')).toBe(true);
    });

    it('exposes canonicalHref for downstream consumers', () => {
        const { canonicalHref } = renderMarkdownAlternate(base);
        expect(canonicalHref).toBe('https://example.com/hello/');
    });
});

describe('deriveMdUrl', () => {
    it('replaces a trailing slash with .md', () => {
        expect(deriveMdUrl('https://ex.com/blog/post/')).toBe('https://ex.com/blog/post.md');
    });

    it('appends .md when there is no trailing slash or extension', () => {
        expect(deriveMdUrl('https://ex.com/blog/post')).toBe('https://ex.com/blog/post.md');
    });

    it('replaces an existing extension with .md', () => {
        expect(deriveMdUrl('https://ex.com/blog/post.html')).toBe('https://ex.com/blog/post.md');
    });

    it('maps the root URL to /index.md (matches Astro src/pages/index.md.ts)', () => {
        expect(deriveMdUrl('https://ex.com/')).toBe('https://ex.com/index.md');
    });

    it('preserves query and hash on the root URL', () => {
        expect(deriveMdUrl('https://ex.com/?q=1#a')).toBe('https://ex.com/index.md?q=1#a');
    });

    it('preserves query and hash', () => {
        expect(deriveMdUrl('https://ex.com/p/?q=1#a')).toBe('https://ex.com/p.md?q=1#a');
    });

    it('returns empty string for a malformed URL', () => {
        expect(deriveMdUrl('not a url')).toBe('');
    });
});

describe('createMarkdownEndpoint', () => {
    type Post = { id: string; body: string; title: string };
    const posts: Post[] = [
        { id: 'hello', body: 'Hello body.', title: 'Hello' },
        { id: 'world', body: 'World body.', title: 'World' },
    ];
    const base = {
        entries: () => Promise.resolve(posts),
        mapper: (p: Post, slug: string) =>
            p.id !== slug
                ? null
                : {
                      frontmatter: {
                          title: p.title,
                          canonical: `https://ex.com/${p.id}/`,
                      },
                      body: p.body,
                  },
    };

    async function call(endpoint: ReturnType<typeof createMarkdownEndpoint<Post>>, slug: unknown) {
        return endpoint({ params: { slug } } as never) as Promise<Response>;
    }

    it('returns 200 with correct headers and rendered body on a happy path', async () => {
        const GET = createMarkdownEndpoint<Post>(base);
        const res = await call(GET, 'hello');
        expect(res.status).toBe(200);
        expect(res.headers.get('Content-Type')).toBe('text/markdown; charset=utf-8');
        expect(res.headers.get('Cache-Control')).toBe('max-age=300');
        expect(res.headers.get('X-Robots-Tag')).toBe('noindex, follow');
        expect(res.headers.get('X-Markdown-Tokens')).toMatch(/^\d+$/);
        expect(res.headers.get('Link')).toBe('<https://ex.com/hello/>; rel="canonical"');
        expect(await res.text()).toContain('Hello body.');
    });

    it('omits X-Markdown-Tokens when emitTokenHeader is false', async () => {
        const GET = createMarkdownEndpoint<Post>({ ...base, emitTokenHeader: false });
        const res = await call(GET, 'hello');
        expect(res.headers.get('X-Markdown-Tokens')).toBeNull();
    });

    it('lets extraHeaders override defaults', async () => {
        const GET = createMarkdownEndpoint<Post>({
            ...base,
            extraHeaders: { 'Cache-Control': 'no-store', 'X-Custom': 'yes' },
        });
        const res = await call(GET, 'hello');
        expect(res.headers.get('Cache-Control')).toBe('no-store');
        expect(res.headers.get('X-Custom')).toBe('yes');
    });

    it('returns 404 when mapper returns null for every entry', async () => {
        const GET = createMarkdownEndpoint<Post>({ ...base, mapper: () => null });
        const res = await call(GET, 'hello');
        expect(res.status).toBe(404);
    });

    it('returns 404 for an unknown slug', async () => {
        const GET = createMarkdownEndpoint<Post>(base);
        const res = await call(GET, 'nope');
        expect(res.status).toBe(404);
    });

    it('reads a custom paramName', async () => {
        const GET = createMarkdownEndpoint<Post>({ ...base, paramName: 'id' });
        const res = await (GET({ params: { id: 'hello' } } as never) as Promise<Response>);
        expect(res.status).toBe(200);
    });

    it('joins array params for rest routes', async () => {
        const nested: Post = { id: 'nested/slug', body: 'b', title: 't' };
        const GET = createMarkdownEndpoint<Post>({
            entries: () => Promise.resolve([nested]),
            mapper: (p, slug) =>
                p.id !== slug
                    ? null
                    : {
                          frontmatter: { title: p.title, canonical: 'https://ex.com/x/' },
                          body: p.body,
                      },
        });
        const res = await (GET({
            params: { slug: ['nested', 'slug'] },
        } as never) as Promise<Response>);
        expect(res.status).toBe(200);
    });
});
