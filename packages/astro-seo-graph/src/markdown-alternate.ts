/**
 * Markdown alternate rendering.
 *
 * Turns a content entry + metadata into a markdown string with YAML
 * frontmatter, suitable for serving at an `.md` URL so that AI agents
 * (Claude, Perplexity, ChatGPT) can consume a clean, machine-readable
 * version of the page. Pair with `createMarkdownEndpoint` to serve it,
 * and with the auto-emitted `<link rel="alternate" type="text/markdown">`
 * in `<Seo>` for discovery.
 *
 * Pure; no Astro runtime required. Safe to import from non-Astro TS.
 */

export interface MarkdownAlternateFrontmatter {
    title: string;
    canonical: string | URL;
    pubDate?: Date | string;
    updatedDate?: Date | string;
    author?: string;
    description?: string;
    tags?: readonly string[];
    categories?: readonly string[];
}

export interface RenderMarkdownAlternateOptions {
    frontmatter: MarkdownAlternateFrontmatter;
    /** Raw markdown body (entry.body from Astro content collections). */
    body: string;
    /**
     * Token estimator. Defaults to `Math.ceil(text.length / 4)` — crude,
     * dependency-free. Callers that need accuracy can pass in
     * `gpt-tokenizer` or `@anthropic-ai/tokenizer`. Called once with the
     * final rendered string so the returned `tokenCount` matches the
     * `X-Markdown-Tokens` header.
     */
    estimateTokens?: (text: string) => number;
    /**
     * Pre-render transform applied to `body`. Useful for stripping MDX
     * imports/components. Pure.
     */
    transformBody?: (body: string) => string;
}

export interface RenderedMarkdownAlternate {
    markdown: string;
    tokenCount: number;
    /**
     * The stringified canonical URL from `frontmatter.canonical`. Exposed
     * so the endpoint can echo it in a `Link: <…>; rel="canonical"`
     * header — tells crawlers the `.md` is an alternate representation,
     * not a separately indexable resource.
     */
    canonicalHref: string;
}

const FRONTMATTER_KEYS = [
    'title',
    'canonical',
    'pubDate',
    'updatedDate',
    'author',
    'description',
    'tags',
    'categories',
] as const satisfies ReadonlyArray<keyof MarkdownAlternateFrontmatter>;

function needsQuoting(value: string): boolean {
    if (value === '') return true;
    if (/^\s|\s$/.test(value)) return true;
    return /[:#[\]{}"'`,&*!|>%@]/.test(value);
}

function yamlString(value: string): string {
    if (!needsQuoting(value)) return value;
    const escaped = value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    return `"${escaped}"`;
}

function yamlList(values: readonly string[]): string {
    return `[${values.map(yamlString).join(', ')}]`;
}

function toIso(value: Date | string): string {
    return value instanceof Date ? value.toISOString() : value;
}

function renderFrontmatter(fm: MarkdownAlternateFrontmatter): string {
    const lines: string[] = ['---'];
    for (const key of FRONTMATTER_KEYS) {
        const raw = fm[key];
        if (raw === undefined || raw === null) continue;
        switch (key) {
            case 'title':
            case 'author':
            case 'description':
                lines.push(`${key}: ${yamlString(String(raw))}`);
                break;
            case 'canonical':
                lines.push(`canonical: ${yamlString(raw.toString())}`);
                break;
            case 'pubDate':
            case 'updatedDate':
                lines.push(`${key}: ${yamlString(toIso(raw as Date | string))}`);
                break;
            case 'tags':
            case 'categories': {
                const arr = raw as readonly string[];
                if (arr.length === 0) continue;
                lines.push(`${key}: ${yamlList(arr)}`);
                break;
            }
        }
    }
    lines.push('---');
    return lines.join('\n');
}

function defaultEstimate(text: string): number {
    return Math.ceil(text.length / 4);
}

/**
 * Render a `MarkdownAlternateFrontmatter` + body into a markdown string
 * with YAML frontmatter and a token count. Pure.
 */
export function renderMarkdownAlternate(
    options: RenderMarkdownAlternateOptions,
): RenderedMarkdownAlternate {
    const { frontmatter, body, estimateTokens = defaultEstimate, transformBody } = options;
    const rawBody = transformBody ? transformBody(body) : body;
    const trimmedBody = rawBody.replace(/\s+$/, '');
    const markdown = `${renderFrontmatter(frontmatter)}\n\n${trimmedBody}\n`;
    return {
        markdown,
        tokenCount: estimateTokens(markdown),
        canonicalHref: frontmatter.canonical.toString(),
    };
}

/**
 * Derive the `.md` URL from a canonical URL. Internal helper — exported
 * for testing and so `<Seo>` can reuse the same algorithm.
 *
 * Rules:
 *   - Root (`/`) → `/index.md`. Matches Astro's filesystem routing for
 *     `src/pages/index.md.ts`. Without this special case the trailing-
 *     slash rule below would yield `/.md`, which Astro never produces.
 *   - Trailing `/` → `.md` (e.g. `/blog/post/` → `/blog/post.md`).
 *   - Existing extension → replaced with `.md`.
 *   - No trailing slash, no extension → `.md` appended.
 *   - Query string and hash preserved.
 *   - Malformed URL → empty string (caller should emit nothing).
 */
export function deriveMdUrl(canonical: string | URL): string {
    let url: URL;
    try {
        url = typeof canonical === 'string' ? new URL(canonical) : new URL(canonical.toString());
    } catch {
        return '';
    }
    const { pathname } = url;
    let newPath: string;
    if (pathname === '/') {
        newPath = '/index.md';
    } else if (pathname.endsWith('/')) {
        newPath = `${pathname.slice(0, -1)}.md`;
    } else if (/\.[a-z0-9]+$/i.test(pathname)) {
        newPath = pathname.replace(/\.[a-z0-9]+$/i, '.md');
    } else {
        newPath = `${pathname}.md`;
    }
    url.pathname = newPath;
    return url.toString();
}
