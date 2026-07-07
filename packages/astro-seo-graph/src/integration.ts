import { readFile, readdir, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { submitToIndexNow } from '@jdevalk/seo-graph-core';
import { renderLlmsTxt, type LlmsTxtSection } from './llms-txt.js';
import {
    buildUrlManifest,
    changedUrls,
    diffManifests,
    hashContent,
    parseManifest,
    serializeManifest,
    type ManifestEntry,
    type UrlManifest,
} from './indexnow-manifest.js';

// Narrow shape of the Astro integration hook we use. We don't import
// Astro types here to keep this package installable without `astro`
// present at type-check time (it's a peer dep).
interface BuildDoneHook {
    dir: URL;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    logger: { warn: (msg: string) => void; info: (msg: string) => void; [key: string]: any };
}

/**
 * Subset of `AstroConfig` we read in `astro:config:setup`. Only the
 * fields we actually use, so the integration stays decoupled from
 * Astro's full type surface.
 */
interface ConfigSetupHook {
    config: {
        site?: string | URL;
        trailingSlash?: 'always' | 'never' | 'ignore';
        redirects?: Record<string, string | { status?: number; destination: string } | undefined>;
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    updateConfig: (patch: Record<string, any>) => void;
}

interface AstroIntegrationLike {
    name: string;
    hooks: {
        'astro:config:setup'?: (args: ConfigSetupHook) => void | Promise<void>;
        'astro:build:done'?: (args: BuildDoneHook) => void | Promise<void>;
    };
}

export interface IndexNowIntegrationOptions {
    /** IndexNow key (8–128 chars from `[A-Za-z0-9-]`). Required to enable submission. */
    key: string;
    /** Bare host, e.g. `example.com`. */
    host: string;
    /**
     * Absolute site origin used to resolve built HTML paths into URLs
     * for submission. E.g. `https://example.com`. Trailing slash is
     * tolerated.
     */
    siteUrl: string;
    /**
     * Optional absolute URL to the key file. Defaults to
     * `https://<host>/<key>.txt`.
     */
    keyLocation?: string;
    /**
     * Override the IndexNow endpoint. Defaults to the neutral aggregator
     * at `api.indexnow.org`.
     */
    endpoint?: string;
    /**
     * Filter the list of URLs before submission. Return `false` to skip
     * a URL. Composed on top of the built-in `/404` exclusion — you
     * don't need to re-exclude that yourself.
     *
     * @example excluding paginated archives in addition to the default 404:
     * ```ts
     * filter: (url) => !/^\/blog\/\d+\/$/.test(new URL(url).pathname),
     * ```
     */
    filter?: (url: string) => boolean;
    /**
     * Submit only URLs that changed since the last build, instead of the
     * whole site every time (the IndexNow spec asks for added/updated/
     * deleted URLs only, and full resubmits can trip per-host rate limits).
     *
     * Enabled with `true` (defaults) or an options object. On each build the
     * integration hashes every eligible page into a manifest, fetches the
     * previously published manifest from the live site, diffs them, and
     * submits only the difference — then writes the new manifest into the
     * build output so it ships with this deploy and becomes the next baseline.
     *
     * The previous state lives on the live site (not local disk or a
     * key/value store), so this works the same whether you build locally or
     * in CI, and adds no infrastructure. Default is off (full submit).
     */
    incremental?: boolean | IndexNowIncrementalOptions;
}

/**
 * Options for incremental IndexNow submission (`indexNow.incremental`).
 */
export interface IndexNowIncrementalOptions {
    /**
     * Build-output path the manifest is written to, and the URL path it is
     * served from. Defaults to `indexnow-manifest.json` at the site root.
     */
    manifestPath?: string;
    /**
     * Absolute URL to fetch the previous manifest from. Defaults to
     * `<siteUrl>/<manifestPath>`. Override if the manifest is served from a
     * different host or path than where it's written.
     */
    manifestUrl?: string;
    /**
     * Normalize a page's HTML before hashing, to strip per-build volatile
     * markup (CSP nonces, timestamps, build ids) that would otherwise make
     * unchanged pages look modified. Receives the raw HTML and the page URL.
     */
    normalize?: (html: string, url: string) => string;
    /**
     * What to do when the previous manifest can't be fetched or parsed for a
     * reason other than a clean 404 (network error, 5xx, malformed body). A
     * 404 is always treated as "first run" (submit everything once).
     *
     * - `'skip'` (default): submit nothing this build, so a transient fetch
     *   failure can't trigger an accidental full resubmit.
     * - `'full'`: fall back to submitting every eligible URL.
     */
    onError?: 'skip' | 'full';
}

/**
 * Pathnames that `indexNow` excludes by default, regardless of any
 * caller-supplied `filter`. The 404 page is the only universal case —
 * search engines don't need to be notified about it, and submitting it
 * wastes daily IndexNow quota.
 *
 * Matches both `/404` (from an Astro `src/pages/404.astro` → `404.html`
 * that `htmlFileToUrl` strips to `/404`) and `/404/` (the directory form
 * when the build emits `404/index.html`).
 */
export function isDefaultExcludedFromIndexNow(url: string): boolean {
    let pathname: string;
    try {
        pathname = new URL(url).pathname;
    } catch {
        return false;
    }
    return pathname === '/404' || pathname === '/404/';
}

export interface LlmsTxtIntegrationOptions {
    /** H1 of the generated `llms.txt`. */
    title: string;
    /** Absolute site origin used to resolve built HTML paths into URLs. */
    siteUrl: string;
    /** Optional blockquote summary shown under the title. */
    summary?: string;
    /** Optional paragraphs of context between summary and sections. */
    details?: string;
    /**
     * User-supplied sections. When provided, these are used verbatim and
     * no pages are auto-collected from the build output. When omitted, a
     * single "Pages" section is generated from all built HTML files.
     */
    sections?: LlmsTxtSection[];
    /**
     * Filter which crawled URLs end up in the auto-generated section.
     * Ignored when `sections` is supplied.
     */
    filter?: (url: string) => boolean;
    /**
     * Section name used for auto-generated pages. Defaults to `Pages`.
     * Ignored when `sections` is supplied.
     */
    autoSectionName?: string;
    /**
     * Output file path relative to the build output directory. Defaults
     * to `llms.txt`.
     */
    outputPath?: string;
}

/**
 * Options for `validateInternalLinks`. Pass `true` to enable with
 * defaults, `false` to disable, or an object to customize.
 */
export interface ValidateInternalLinksOptions {
    /**
     * Skip a specific href from validation. Return `true` to exclude.
     * Useful for SSR-only routes, dynamic redirects, or paths handled
     * at the host/CDN layer that aren't present in the build output.
     *
     * Receives the raw `href` attribute value as it appeared in the
     * HTML (not resolved/normalized), so callers can match on the
     * source form.
     */
    skip?: (href: string) => boolean;
    /**
     * Treat explicit redirect sources as valid link targets. Defaults
     * to `true` — unions literal `from` paths from `public/_redirects`
     * (Netlify / Cloudflare Pages format) and literal keys from
     * Astro's `redirects` config into the built-paths set, so linking
     * to an intentional redirect doesn't warn.
     *
     * Set to `false` to treat only actual built pages as valid. Useful
     * when you want to surface "this link hits a redirect, even if
     * that's on purpose" — e.g. during an audit pass where you're
     * actively eliminating redirect hops for performance.
     */
    honorRedirects?: boolean;
}

/**
 * Configurable bounds for `validateMetadataLength`. Missing fields fall
 * back to the defaults (title 30–65, description 70–200).
 */
export interface MetadataLengthBounds {
    title?: { min?: number; max?: number };
    description?: { min?: number; max?: number };
}

/** Defaults applied when `validateMetadataLength: true`. */
export const DEFAULT_METADATA_LENGTH_BOUNDS = {
    title: { min: 30, max: 65 },
    description: { min: 70, max: 200 },
} as const;

/**
 * Resolve the `validateMetadataLength` option into concrete bounds, or
 * `null` when the check is disabled. Exported so callers can reuse the
 * same resolution in their own pipelines (and so tests can cover the
 * merge logic without running a full build).
 */
export function resolveMetadataLengthBounds(
    option: boolean | MetadataLengthBounds | undefined,
): { title: { min: number; max: number }; description: { min: number; max: number } } | null {
    if (option === false || option === undefined) return null;
    const overrides = option === true ? {} : option;
    return {
        title: {
            min: overrides.title?.min ?? DEFAULT_METADATA_LENGTH_BOUNDS.title.min,
            max: overrides.title?.max ?? DEFAULT_METADATA_LENGTH_BOUNDS.title.max,
        },
        description: {
            min: overrides.description?.min ?? DEFAULT_METADATA_LENGTH_BOUNDS.description.min,
            max: overrides.description?.max ?? DEFAULT_METADATA_LENGTH_BOUNDS.description.max,
        },
    };
}

export interface SeoGraphIntegrationOptions {
    /**
     * Warn when a built page has zero or more than one `<h1>` element.
     * Defaults to `true`. Only static pages are checked (SSR pages are
     * not present on disk at build time).
     */
    validateH1?: boolean;
    /**
     * Warn when two or more built pages share the same `<title>` or
     * meta description. Duplicate metadata is an SEO smell that can only
     * be detected across the whole corpus. Defaults to `true`.
     *
     * Pages without a title or description are reported separately by
     * the H1 validator's siblings — this check only compares values that
     * are present on multiple pages.
     */
    validateUniqueMetadata?: boolean;
    /**
     * Warn when a built page contains `<img>` tags without an `alt`
     * attribute. Missing alt text is both an accessibility and SEO
     * issue. Defaults to `true`.
     *
     * Decorative images with `alt=""` are treated as correct — that's
     * the intended WCAG pattern for images that convey no information.
     * Only a fully missing `alt` attribute triggers a warning.
     */
    validateImageAlt?: boolean;
    /**
     * Warn when `<title>` or `<meta name="description">` length falls
     * outside SERP-friendly bounds. Defaults to `true` (title 30–65
     * chars, description 70–200 chars).
     *
     * Pass `false` to disable, or an object to override the bounds.
     * Length is measured on the whitespace-collapsed, entity-decoded
     * text — the same thing Google displays in the SERP.
     */
    validateMetadataLength?: boolean | MetadataLengthBounds;
    /**
     * Warn when an internal `<a href>` points to a URL that doesn't
     * match a built page. Catches two common classes of bug:
     *
     * - **Trailing-slash mismatches.** Linking to `/about-me` when the
     *   site emits `/about-me/` (or vice versa). The link "works" via
     *   a redirect but wastes a round-trip and hurts SEO.
     * - **Broken internal links.** A link to a path that isn't in the
     *   build at all — a 404 waiting to happen.
     *
     * Defaults to `true`. Only checks links with the same origin as
     * `config.site` (plus root-relative `/foo`-style links). External
     * links, `mailto:`, `tel:`, fragment-only (`#x`), and SSR-only
     * routes are not checked. Pass `false` to disable, or
     * `{ skip: (href) => boolean }` to exclude specific hrefs (e.g.
     * dynamic redirects handled at the host layer).
     */
    validateInternalLinks?: boolean | ValidateInternalLinksOptions;
    /**
     * Submit built URLs to IndexNow after the build completes. Omit to
     * disable. Only URLs on `host` are submitted; URLs with trailing
     * `index.html` are rewritten to their directory form.
     */
    indexNow?: IndexNowIntegrationOptions;
    /**
     * Generate an `llms.txt` file at the root of the build output. Omit
     * to disable.
     */
    llmsTxt?: LlmsTxtIntegrationOptions;
    /**
     * Auto-emit `<link rel="alternate" type="text/markdown">` from `<Seo>`
     * on every page, with `href` derived from the canonical URL (e.g.
     * `/blog/post/` → `/blog/post.md`). Pair with `createMarkdownEndpoint`
     * to actually serve the markdown — this flag only controls the
     * discovery link, not whether the endpoint exists.
     *
     * Default: `false`. Enable explicitly once you've added
     * `createMarkdownEndpoint` at the matching path. Implemented via a
     * Vite `define` that replaces a sentinel token in the compiled
     * `<Seo>` component at build time.
     *
     * After the build, the integration walks the output directory and
     * strips any link whose target `.md` isn't on disk — so dangling
     * discovery links (collection entries that didn't get prerendered,
     * routes that don't cover this page) don't ship to production. SSR
     * users whose `.md` endpoints aren't prerendered should leave this
     * flag off and emit the link themselves.
     */
    markdownAlternate?: boolean;
}

/**
 * Turn a built HTML file path (relative to the outDir, e.g.
 * `blog/post/index.html`) into an absolute URL on `siteUrl`. Rewrites
 * `index.html` to a trailing slash and strips other `.html` extensions
 * — matching Astro's default `trailingSlash: 'ignore'` output layout.
 */
export function htmlFileToUrl(relativePath: string, siteUrl: string): string {
    const origin = siteUrl.replace(/\/+$/, '');
    const normalized = relativePath.split(/[\\/]/).join('/');
    let pathname: string;
    if (normalized === 'index.html' || normalized === '/index.html') {
        pathname = '/';
    } else if (normalized.endsWith('/index.html')) {
        pathname = '/' + normalized.slice(0, -'index.html'.length);
    } else if (normalized.endsWith('.html')) {
        pathname = '/' + normalized.slice(0, -'.html'.length);
    } else {
        pathname = '/' + normalized;
    }
    return `${origin}${pathname}`;
}

/**
 * Count `<h1>` elements in an HTML string. Matches the opening tag only;
 * tolerant of attributes and whitespace. Doesn't parse — good enough for
 * a lint warning.
 */
export function countH1s(html: string): number {
    const matches = html.match(/<h1[\s>]/gi);
    return matches ? matches.length : 0;
}

/**
 * Parse a Netlify/Cloudflare Pages `_redirects` file and return the
 * `from` paths of rules with literal sources (no wildcards or
 * placeholders). The literal subset is enough to treat those paths as
 * valid link targets — if a rule uses `*` or `:splat` it's dynamic and
 * we can't meaningfully pre-validate hrefs against it.
 *
 * Format per line: `from to [status]`. `#` starts a comment. Blank
 * lines are ignored. See:
 *   https://docs.netlify.com/routing/redirects/
 *   https://developers.cloudflare.com/pages/configuration/redirects/
 */
export function parseNetlifyRedirects(content: string): string[] {
    const sources: string[] = [];
    for (const rawLine of content.split(/\r?\n/)) {
        const line = rawLine.trim();
        if (line === '' || line.startsWith('#')) continue;
        const from = line.split(/\s+/)[0];
        if (!from) continue;
        // Skip dynamic rules — we only union literal paths into the
        // built-paths set. Glob/splat matching is out of scope.
        if (/[*:]/.test(from)) continue;
        // Ignore non-path sources (full URLs in _redirects denote
        // proxy/rewrite rules; not a link target we'd validate).
        if (!from.startsWith('/')) continue;
        sources.push(from);
    }
    return sources;
}

/**
 * Return the literal `from` paths from an Astro `config.redirects`
 * object. Parameterized routes (`/old/[slug]` or `/old/*`) are skipped
 * for the same reason `parseNetlifyRedirects` skips dynamic rules.
 */
export function collectAstroRedirectSources(
    redirects: ConfigSetupHook['config']['redirects'] | undefined,
): string[] {
    if (!redirects) return [];
    const sources: string[] = [];
    for (const from of Object.keys(redirects)) {
        if (!from.startsWith('/')) continue;
        if (/[[\]*]/.test(from)) continue;
        sources.push(from);
    }
    return sources;
}

/**
 * Turn a built HTML file path into its canonical pathname (the `url`
 * form without origin). Used by `validateInternalLinks` to build the
 * set of paths that actually exist in the build.
 */
export function htmlFileToPath(relativePath: string): string {
    const normalized = relativePath.split(/[\\/]/).join('/');
    if (normalized === 'index.html' || normalized === '/index.html') return '/';
    if (normalized.endsWith('/index.html')) {
        return '/' + normalized.slice(0, -'index.html'.length);
    }
    if (normalized.endsWith('.html')) {
        return '/' + normalized.slice(0, -'.html'.length);
    }
    return '/' + normalized;
}

/**
 * Build the set of root-relative paths that count as valid link
 * targets, given the full list of files produced by the build.
 *
 * HTML files become their pretty-URL form (via `htmlFileToPath`, so
 * `blog/post/index.html` → `/blog/post/`). Every other file —
 * static assets copied from `public/`, sitemap files, etc. — is
 * included verbatim as `/<path>`, because those are valid link
 * targets too even though they're not pages.
 *
 * Adding non-HTML files here is what stops `validateInternalLinks`
 * from flagging `<a href="/images/foo.avif">` as a 404.
 */
export function buildLinkTargetSet(files: readonly string[]): Set<string> {
    const paths = new Set<string>();
    for (const file of files) {
        if (file.endsWith('.html')) {
            paths.add(htmlFileToPath(file));
        } else {
            const normalized = file.split(/[\\/]/).join('/');
            paths.add('/' + normalized);
        }
    }
    return paths;
}

/**
 * Extract all `<a href="...">` values from an HTML string. Returns the
 * raw attribute values (not decoded) in document order.
 */
export function extractAnchorHrefs(html: string): string[] {
    const hrefs: string[] = [];
    for (const match of html.matchAll(/<a\b[^>]*\bhref\s*=\s*["']([^"']*)["'][^>]*>/gi)) {
        hrefs.push(match[1]!);
    }
    return hrefs;
}

/**
 * Classify an internal link's href against the set of built pathnames.
 *
 * Returns:
 *   - `{ status: 'external' }` for off-origin, `mailto:`, `tel:`,
 *     fragment-only, or non-http(s) schemes.
 *   - `{ status: 'ok' }` when the resolved pathname exactly matches a
 *     built page.
 *   - `{ status: 'trailing-slash', suggested }` when the other form
 *     (with/without trailing slash) matches — your case.
 *   - `{ status: 'not-found' }` when no form matches — a broken link.
 *
 * `origin` is the site's canonical origin (from Astro's `config.site`).
 * When omitted, only root-relative hrefs (`/foo`) are classified;
 * absolute URLs return `external`.
 */
export function classifyInternalLink(
    href: string,
    builtPaths: ReadonlySet<string>,
    origin: string | undefined,
):
    | { status: 'external' }
    | { status: 'ok' }
    | { status: 'trailing-slash'; suggested: string }
    | {
          status: 'not-found';
      } {
    if (!href) return { status: 'external' };
    // Same-page anchors and non-http schemes.
    if (href.startsWith('#')) return { status: 'external' };
    if (/^(?:mailto:|tel:|javascript:|data:|blob:)/i.test(href)) return { status: 'external' };

    let pathname: string;
    if (href.startsWith('/') && !href.startsWith('//')) {
        // Root-relative. Strip query + fragment.
        pathname = href.split('#')[0]!.split('?')[0]!;
    } else if (/^https?:\/\//i.test(href) || href.startsWith('//')) {
        // Absolute (or protocol-relative). Compare origins if we know ours.
        if (!origin) return { status: 'external' };
        let parsed: URL;
        try {
            parsed = new URL(href.startsWith('//') ? `https:${href}` : href);
        } catch {
            return { status: 'external' };
        }
        let ourOrigin: URL;
        try {
            ourOrigin = new URL(origin);
        } catch {
            return { status: 'external' };
        }
        if (parsed.origin !== ourOrigin.origin) return { status: 'external' };
        pathname = parsed.pathname;
    } else {
        // Relative or unknown shape — not worth guessing.
        return { status: 'external' };
    }

    if (builtPaths.has(pathname)) return { status: 'ok' };

    const flipped = pathname.endsWith('/') ? pathname.slice(0, -1) : pathname + '/';
    if (builtPaths.has(flipped)) {
        return { status: 'trailing-slash', suggested: flipped };
    }
    return { status: 'not-found' };
}

/**
 * Find `<img>` tags missing an `alt` attribute. Returns the `src` value
 * of each offending tag (or `"(no src)"` when src is absent too) so the
 * warning can identify which image to fix.
 *
 * Two WCAG-sanctioned ways to mark an image as decorative are respected
 * and NOT flagged:
 *
 *   - `alt=""` — the canonical decorative-image pattern. Also recognized
 *     in HTML5 boolean-attribute form `<img ... alt>` (no `=`), which is
 *     spec-equivalent to `alt=""` and is what Vite's HTML minifier (used
 *     by Astro) emits when given `alt=""`.
 *   - `role="presentation"` (or `role="none"`) — removes the image from
 *     the accessibility tree; typically paired with `alt=""` but some
 *     codebases use it alone.
 *
 * Only a tag that has neither an `alt` attribute nor a decorative role
 * triggers a warning.
 */
export function findImagesWithoutAlt(html: string): string[] {
    const results: string[] = [];
    for (const match of html.matchAll(/<img\b[^>]*>/gi)) {
        const tag = match[0];
        // Match `alt` whether written as `alt="..."`, bare-boolean `alt`,
        // or self-closed `alt/`. Leading `\s` anchors `alt` to an
        // attribute slot inside the tag, avoiding false matches on
        // attribute names like `data-alt` or `data-altitude`.
        if (/\salt(?:\s*=|\s|\/?>|$)/i.test(tag)) continue;
        if (/\brole\s*=\s*["'](?:presentation|none)["']/i.test(tag)) continue;
        const src = tag.match(/\bsrc\s*=\s*["']([^"']*)["']/i)?.[1] ?? '(no src)';
        results.push(src);
    }
    return results;
}

const HTML_ENTITIES: Record<string, string> = {
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&apos;': "'",
    '&#39;': "'",
    '&nbsp;': ' ',
};

function decodeHtmlEntities(value: string): string {
    return value.replace(/&(?:amp|lt|gt|quot|apos|#39|nbsp);/g, (m) => HTML_ENTITIES[m] ?? m);
}

/**
 * Extract the first `<title>` element's text content. Returns `null` when
 * no title tag is found. Whitespace-collapsed and entity-decoded so
 * duplicate-detection compares rendered text, not raw HTML.
 */
export function extractTitle(html: string): string | null {
    const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    if (!match) return null;
    const text = decodeHtmlEntities(match[1]!).replace(/\s+/g, ' ').trim();
    return text.length > 0 ? text : null;
}

/**
 * Extract the `content` attribute of the first `<meta name="description">`
 * tag. Returns `null` when absent. Entity-decoded for duplicate detection.
 *
 * Uses a backreference on the opening quote so the capture terminates
 * only on the *matching* quote — `content="don't stop"` keeps its
 * apostrophe, and `content='She said "hi"'` keeps its double quotes.
 * A naive `[^"']*` character class would cut both short.
 */
export function extractMetaDescription(html: string): string | null {
    // Two orderings: name-before-content or content-before-name.
    const nameFirst =
        /<meta\b[^>]*?\bname\s*=\s*["']description["'][^>]*?\bcontent\s*=\s*(["'])([\s\S]*?)\1/i;
    const contentFirst =
        /<meta\b[^>]*?\bcontent\s*=\s*(["'])([\s\S]*?)\1[^>]*?\bname\s*=\s*["']description["']/i;
    const match = nameFirst.exec(html) ?? contentFirst.exec(html);
    if (!match) return null;
    const raw = (match[2] ?? '').trim();
    if (!raw) return null;
    return decodeHtmlEntities(raw);
}

/**
 * Locate the auto-emitted `<link rel="alternate" type="text/markdown">`
 * tag in a built HTML file. Returns the full match text and the raw
 * `href` attribute value, or `null` when absent. Matches the exact
 * shape `<Seo>` produces — a simple regex is fine because we control
 * the source.
 */
export function findMarkdownAlternateLink(html: string): { match: string; href: string } | null {
    const re = /<link\s+rel="alternate"\s+type="text\/markdown"\s+href="([^"]*)"\s*\/?>/;
    const m = re.exec(html);
    if (!m) return null;
    return { match: m[0], href: m[1]! };
}

/**
 * Remove a previously-located markdown-alternate `<link>` tag from
 * `html`. Also trims one trailing newline if present, so the surrounding
 * `<head>` whitespace stays clean. No-op if `match` isn't found
 * verbatim.
 */
export function stripMarkdownAlternateLink(html: string, match: string): string {
    const idx = html.indexOf(match);
    if (idx === -1) return html;
    let end = idx + match.length;
    if (html[end] === '\n') end += 1;
    return html.slice(0, idx) + html.slice(end);
}

/**
 * Resolve a markdown-alternate `href` (as emitted by `<Seo>`) to its
 * expected build-output path, relative to `outDir`. Returns `null`
 * when the href is cross-origin (different origin than `siteOrigin`)
 * or otherwise unverifiable — caller should leave such links alone.
 *
 * `siteOrigin` may be undefined (no `config.site` in astro.config); in
 * that case only root-relative hrefs (starting with `/`) are resolvable.
 */
export function resolveMarkdownAlternatePath(
    href: string,
    siteOrigin: string | undefined,
): string | null {
    let pathname: string;
    if (href.startsWith('/') && !href.startsWith('//')) {
        pathname = href.split('#')[0]!.split('?')[0]!;
    } else if (/^https?:\/\//i.test(href)) {
        if (!siteOrigin) return null;
        let parsed: URL;
        let ours: URL;
        try {
            parsed = new URL(href);
            ours = new URL(siteOrigin);
        } catch {
            return null;
        }
        if (parsed.origin !== ours.origin) return null;
        pathname = parsed.pathname;
    } else {
        return null;
    }
    return pathname.replace(/^\/+/, '');
}

async function collectBuildFiles(dir: string, base: string = dir): Promise<string[]> {
    const entries = await readdir(dir, { withFileTypes: true });
    const files: string[] = [];
    for (const entry of entries) {
        const fullPath = join(dir, entry.name);
        if (entry.isDirectory()) {
            files.push(...(await collectBuildFiles(fullPath, base)));
        } else if (entry.isFile()) {
            files.push(relative(base, fullPath));
        }
    }
    return files;
}

/**
 * Astro integration for `@jdevalk/astro-seo-graph`.
 *
 * Currently:
 * - Warns about built pages with zero or more than one `<h1>` element
 *   (a common SEO and accessibility issue).
 *
 * ```js
 * // astro.config.mjs
 * import { defineConfig } from 'astro/config';
 * import seoGraph from '@jdevalk/astro-seo-graph/integration';
 *
 * export default defineConfig({
 *     integrations: [seoGraph()],
 * });
 * ```
 */
export default function seoGraph(options: SeoGraphIntegrationOptions = {}): AstroIntegrationLike {
    const {
        validateH1 = true,
        validateUniqueMetadata = true,
        validateImageAlt = true,
        validateMetadataLength = true,
        validateInternalLinks = true,
        indexNow,
        llmsTxt,
        markdownAlternate = false,
    } = options;
    const autoLlmsTxt = llmsTxt && !llmsTxt.sections;
    const lengthBounds = resolveMetadataLengthBounds(validateMetadataLength);
    const internalLinksEnabled = validateInternalLinks !== false;
    const internalLinksSkip =
        typeof validateInternalLinks === 'object' ? validateInternalLinks.skip : undefined;
    const internalLinksHonorRedirects =
        typeof validateInternalLinks === 'object'
            ? (validateInternalLinks.honorRedirects ?? true)
            : true;

    // Captured in astro:config:setup so astro:build:done can classify
    // absolute same-origin links against the site's canonical origin
    // and treat Astro-configured redirect sources as valid link targets.
    let siteOrigin: string | undefined;
    let astroRedirectSources: string[] = [];

    return {
        name: '@jdevalk/astro-seo-graph',
        hooks: {
            'astro:config:setup': ({ config, updateConfig }) => {
                // Vite `define` controls the auto-emitted
                // <link rel="alternate" type="text/markdown"> in <Seo>.
                // The sentinel is replaced token-by-token at build time;
                // when the integration isn't installed, the identifier
                // stays free and <Seo>'s `typeof` check falls back to
                // the default (enabled).
                updateConfig({
                    vite: {
                        define: {
                            __JDV_SEO_GRAPH_MD_ALT__: JSON.stringify(markdownAlternate),
                        },
                    },
                });
                if (config.site) {
                    try {
                        siteOrigin = new URL(config.site.toString()).origin;
                    } catch {
                        // Leave undefined — validateInternalLinks will
                        // still work for root-relative hrefs.
                    }
                }
                astroRedirectSources = collectAstroRedirectSources(config.redirects);
            },
            'astro:build:done': async ({ dir, logger }) => {
                const buildDir = fileURLToPath(dir);
                const needsContentScan =
                    validateH1 ||
                    validateUniqueMetadata ||
                    validateImageAlt ||
                    lengthBounds !== null ||
                    internalLinksEnabled ||
                    autoLlmsTxt ||
                    markdownAlternate;
                const needsAnyFiles =
                    needsContentScan ||
                    indexNow ||
                    llmsTxt ||
                    internalLinksEnabled ||
                    markdownAlternate;
                const allFiles = needsAnyFiles ? await collectBuildFiles(buildDir) : [];
                const htmlFiles = allFiles.filter((f) => f.endsWith('.html'));
                const builtFilesSet = markdownAlternate
                    ? new Set(allFiles.map((f) => f.split(/[\\/]/).join('/')))
                    : null;
                let builtPaths: Set<string> | null = null;
                if (internalLinksEnabled) {
                    // Include every build artefact, not just HTML pages.
                    // Static assets copied from public/ (images, fonts,
                    // downloads, etc.) are valid link targets too —
                    // filtering to .html would flag <a href="/images/foo.avif">
                    // as a 404.
                    builtPaths = buildLinkTargetSet(allFiles);
                    if (internalLinksHonorRedirects) {
                        // Treat explicit redirect sources as valid link
                        // targets. Reads `_redirects` (Netlify/Cloudflare
                        // Pages) from the build output and merges Astro's
                        // `config.redirects` captured at setup time.
                        try {
                            const redirectsContent = await readFile(
                                join(buildDir, '_redirects'),
                                'utf8',
                            );
                            for (const from of parseNetlifyRedirects(redirectsContent)) {
                                builtPaths.add(from);
                            }
                        } catch {
                            // No `_redirects` file; that's fine.
                        }
                        for (const from of astroRedirectSources) {
                            builtPaths.add(from);
                        }
                    }
                }
                const autoLinks: Array<{ url: string; title: string; description?: string }> = [];

                const h1Missing: string[] = [];
                const h1Multiple: Array<{ file: string; count: number }> = [];
                const titlesByValue = new Map<string, string[]>();
                const descriptionsByValue = new Map<string, string[]>();
                const imagesMissingAlt: Array<{ file: string; srcs: string[] }> = [];
                const internalLinkIssues: Array<{
                    file: string;
                    href: string;
                    kind: 'trailing-slash' | 'not-found';
                    suggested?: string;
                }> = [];
                const lengthIssues: Array<{
                    file: string;
                    field: 'title' | 'description';
                    length: number;
                    bound: 'short' | 'long';
                    limit: number;
                    value: string;
                }> = [];
                const mdAltStripped: Array<{ file: string; href: string }> = [];
                let mdAltVerified = 0;

                if (needsContentScan) {
                    for (const file of htmlFiles) {
                        let content = await readFile(join(buildDir, file), 'utf8');

                        if (markdownAlternate && builtFilesSet !== null) {
                            const link = findMarkdownAlternateLink(content);
                            if (link) {
                                const expected = resolveMarkdownAlternatePath(
                                    link.href,
                                    siteOrigin,
                                );
                                if (expected !== null) {
                                    if (builtFilesSet.has(expected)) {
                                        mdAltVerified += 1;
                                    } else {
                                        content = stripMarkdownAlternateLink(content, link.match);
                                        await writeFile(join(buildDir, file), content);
                                        mdAltStripped.push({ file, href: link.href });
                                    }
                                }
                            }
                        }

                        if (validateH1) {
                            const count = countH1s(content);
                            if (count === 0) h1Missing.push(file);
                            else if (count > 1) h1Multiple.push({ file, count });
                        }

                        if (validateImageAlt) {
                            const srcs = findImagesWithoutAlt(content);
                            if (srcs.length > 0) imagesMissingAlt.push({ file, srcs });
                        }

                        if (builtPaths !== null) {
                            for (const href of extractAnchorHrefs(content)) {
                                if (internalLinksSkip && internalLinksSkip(href)) continue;
                                const result = classifyInternalLink(href, builtPaths, siteOrigin);
                                if (result.status === 'trailing-slash') {
                                    internalLinkIssues.push({
                                        file,
                                        href,
                                        kind: 'trailing-slash',
                                        suggested: result.suggested,
                                    });
                                } else if (result.status === 'not-found') {
                                    internalLinkIssues.push({
                                        file,
                                        href,
                                        kind: 'not-found',
                                    });
                                }
                            }
                        }

                        const needsTitle =
                            validateUniqueMetadata || autoLlmsTxt || lengthBounds !== null;
                        const needsDescription = needsTitle;
                        const title = needsTitle ? extractTitle(content) : null;
                        const description = needsDescription
                            ? extractMetaDescription(content)
                            : null;

                        if (validateUniqueMetadata) {
                            if (title) {
                                const list = titlesByValue.get(title) ?? [];
                                list.push(file);
                                titlesByValue.set(title, list);
                            }
                            if (description) {
                                const list = descriptionsByValue.get(description) ?? [];
                                list.push(file);
                                descriptionsByValue.set(description, list);
                            }
                        }

                        if (lengthBounds !== null) {
                            if (title) {
                                if (title.length < lengthBounds.title.min) {
                                    lengthIssues.push({
                                        file,
                                        field: 'title',
                                        length: title.length,
                                        bound: 'short',
                                        limit: lengthBounds.title.min,
                                        value: title,
                                    });
                                } else if (title.length > lengthBounds.title.max) {
                                    lengthIssues.push({
                                        file,
                                        field: 'title',
                                        length: title.length,
                                        bound: 'long',
                                        limit: lengthBounds.title.max,
                                        value: title,
                                    });
                                }
                            }
                            if (description) {
                                if (description.length < lengthBounds.description.min) {
                                    lengthIssues.push({
                                        file,
                                        field: 'description',
                                        length: description.length,
                                        bound: 'short',
                                        limit: lengthBounds.description.min,
                                        value: description,
                                    });
                                } else if (description.length > lengthBounds.description.max) {
                                    lengthIssues.push({
                                        file,
                                        field: 'description',
                                        length: description.length,
                                        bound: 'long',
                                        limit: lengthBounds.description.max,
                                        value: description,
                                    });
                                }
                            }
                        }

                        if (autoLlmsTxt && llmsTxt) {
                            const url = htmlFileToUrl(file, llmsTxt.siteUrl);
                            if (!llmsTxt.filter || llmsTxt.filter(url)) {
                                autoLinks.push({
                                    url,
                                    title: title ?? url,
                                    description: description ?? undefined,
                                });
                            }
                        }
                    }
                }

                if (validateH1) {
                    if (h1Missing.length === 0 && h1Multiple.length === 0) {
                        logger.info(`H1 validation: ${htmlFiles.length} pages checked, all good.`);
                    } else {
                        for (const file of h1Missing) {
                            logger.warn(`H1 validation: ${file} has no <h1>.`);
                        }
                        for (const { file, count } of h1Multiple) {
                            logger.warn(
                                `H1 validation: ${file} has ${count} <h1> elements (expected 1).`,
                            );
                        }
                    }
                }

                if (builtPaths !== null) {
                    if (internalLinkIssues.length === 0) {
                        logger.info(`Internal links: ${htmlFiles.length} pages checked, all good.`);
                    } else {
                        for (const issue of internalLinkIssues) {
                            if (issue.kind === 'trailing-slash') {
                                logger.warn(
                                    `Internal links: ${issue.file} links to ${JSON.stringify(issue.href)} but built page is ${JSON.stringify(issue.suggested!)} (redirect on every visit).`,
                                );
                            } else {
                                logger.warn(
                                    `Internal links: ${issue.file} links to ${JSON.stringify(issue.href)} which isn't in the build (404).`,
                                );
                            }
                        }
                    }
                }

                if (validateImageAlt) {
                    if (imagesMissingAlt.length === 0) {
                        logger.info(
                            `Image alt validation: ${htmlFiles.length} pages checked, all good.`,
                        );
                    } else {
                        for (const { file, srcs } of imagesMissingAlt) {
                            const preview = srcs.slice(0, 5).join(', ');
                            const more = srcs.length > 5 ? ` (+${srcs.length - 5} more)` : '';
                            logger.warn(
                                `Image alt validation: ${file} has ${srcs.length} <img> without alt: ${preview}${more}`,
                            );
                        }
                    }
                }

                if (lengthBounds !== null) {
                    if (lengthIssues.length === 0) {
                        logger.info(
                            `Metadata length: ${htmlFiles.length} pages checked, all good.`,
                        );
                    } else {
                        for (const issue of lengthIssues) {
                            const direction = issue.bound === 'short' ? 'min' : 'max';
                            const preview =
                                issue.value.length > 80
                                    ? issue.value.slice(0, 77) + '…'
                                    : issue.value;
                            logger.warn(
                                `Metadata length: ${issue.file} ${issue.field} is ${issue.length} chars (${direction} ${issue.limit}): ${JSON.stringify(preview)}`,
                            );
                        }
                    }
                }

                if (validateUniqueMetadata) {
                    const dupTitles = [...titlesByValue.entries()].filter(
                        ([, files]) => files.length > 1,
                    );
                    const dupDescriptions = [...descriptionsByValue.entries()].filter(
                        ([, files]) => files.length > 1,
                    );

                    if (dupTitles.length === 0 && dupDescriptions.length === 0) {
                        logger.info(
                            `Metadata uniqueness: ${htmlFiles.length} pages checked, all good.`,
                        );
                    } else {
                        for (const [title, files] of dupTitles) {
                            logger.warn(
                                `Metadata uniqueness: title ${JSON.stringify(title)} appears on ${files.length} pages: ${files.join(', ')}`,
                            );
                        }
                        for (const [description, files] of dupDescriptions) {
                            const preview =
                                description.length > 80
                                    ? description.slice(0, 77) + '…'
                                    : description;
                            logger.warn(
                                `Metadata uniqueness: description ${JSON.stringify(preview)} appears on ${files.length} pages: ${files.join(', ')}`,
                            );
                        }
                    }
                }

                if (markdownAlternate) {
                    if (mdAltStripped.length === 0) {
                        logger.info(
                            `Markdown alternate: ${mdAltVerified} link(s) verified against build output.`,
                        );
                    } else {
                        for (const { file, href } of mdAltStripped) {
                            logger.warn(
                                `Markdown alternate: stripped link from ${file} — ${JSON.stringify(href)} is not in the build output (would 404).`,
                            );
                        }
                    }
                }

                if (indexNow) {
                    const eligible = htmlFiles
                        .map((f) => ({ file: f, url: htmlFileToUrl(f, indexNow.siteUrl) }))
                        .filter((e) => !isDefaultExcludedFromIndexNow(e.url))
                        .filter((e) => (indexNow.filter ? indexNow.filter(e.url) : true));

                    const submit = async (urls: string[]) => {
                        if (urls.length === 0) {
                            logger.info('IndexNow: no URLs to submit.');
                            return;
                        }
                        const results = await submitToIndexNow({
                            host: indexNow.host,
                            key: indexNow.key,
                            keyLocation: indexNow.keyLocation,
                            endpoint: indexNow.endpoint,
                            urls,
                        });
                        for (const r of results) {
                            if (r.ok) {
                                logger.info(
                                    `IndexNow: submitted ${r.submitted} URLs (status ${r.status}).`,
                                );
                            } else {
                                logger.warn(
                                    `IndexNow: submission failed (status ${r.status}): ${r.message}`,
                                );
                            }
                        }
                    };

                    if (!indexNow.incremental) {
                        await submit(eligible.map((e) => e.url));
                    } else {
                        const opts: IndexNowIncrementalOptions =
                            indexNow.incremental === true ? {} : indexNow.incremental;
                        const manifestRelPath = (
                            opts.manifestPath ?? 'indexnow-manifest.json'
                        ).replace(/^\//, '');
                        const siteBase = indexNow.siteUrl.replace(/\/$/, '');
                        const manifestUrl = opts.manifestUrl ?? `${siteBase}/${manifestRelPath}`;
                        const onError = opts.onError ?? 'skip';
                        const normalize = opts.normalize;

                        // Current manifest: hash every eligible page's built HTML.
                        const entries: ManifestEntry[] = [];
                        for (const e of eligible) {
                            const html = await readFile(join(buildDir, e.file), 'utf8');
                            entries.push({ url: e.url, content: html });
                        }
                        const current = buildUrlManifest(
                            entries,
                            normalize
                                ? (content, url) => hashContent(normalize(content, url))
                                : undefined,
                        );

                        // Previous state lives on the live site. A clean 404 means
                        // "first run" (baseline). Any other failure leaves `previous`
                        // null so we never accidentally full-resubmit on a transient
                        // network blip.
                        let previous: UrlManifest | null = null;
                        try {
                            const res = await fetch(manifestUrl);
                            if (res.status === 404) {
                                previous = {};
                            } else if (res.ok) {
                                previous = parseManifest(await res.text());
                            }
                        } catch {
                            previous = null;
                        }

                        // Always publish the new manifest so it ships with this
                        // deploy and becomes the next build's baseline.
                        await writeFile(
                            join(buildDir, manifestRelPath),
                            serializeManifest(current),
                            'utf8',
                        );

                        if (previous === null) {
                            if (onError === 'full') {
                                logger.warn(
                                    `IndexNow: could not read previous manifest at ${manifestUrl}; submitting all URLs.`,
                                );
                                await submit(Object.keys(current));
                            } else {
                                logger.warn(
                                    `IndexNow: could not read previous manifest at ${manifestUrl}; skipping submission this build.`,
                                );
                            }
                        } else {
                            const diff = diffManifests(previous, current);
                            logger.info(
                                `IndexNow: ${diff.added.length} added, ${diff.updated.length} updated, ${diff.deleted.length} deleted.`,
                            );
                            await submit(changedUrls(diff));
                        }
                    }
                }

                if (llmsTxt) {
                    const sections = llmsTxt.sections ?? [
                        { name: llmsTxt.autoSectionName ?? 'Pages', links: autoLinks },
                    ];
                    const rendered = renderLlmsTxt({
                        title: llmsTxt.title,
                        summary: llmsTxt.summary,
                        details: llmsTxt.details,
                        sections,
                    });
                    const outPath = join(buildDir, llmsTxt.outputPath ?? 'llms.txt');
                    await writeFile(outPath, rendered, 'utf8');
                    const linkCount = sections.reduce((n, s) => n + s.links.length, 0);
                    logger.info(
                        `llms.txt: wrote ${relative(buildDir, outPath)} with ${linkCount} link(s).`,
                    );
                }
            },
        },
    };
}
