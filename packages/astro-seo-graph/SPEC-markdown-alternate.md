# Spec: markdown-alternate for `<Seo>` and endpoints

Status: draft
Owner: `@jdevalk/astro-seo-graph`
Target version: `0.3.x` (additive, non-breaking)
New files: `src/markdown-alternate.ts`, `test/markdown-alternate.test.ts`
Modified files: `src/routes.ts` (or new `src/markdown-routes.ts`), `src/components/seo-props.ts`, `src/components/seo-context.ts`, `src/index.ts`

## Problem

Agents (Claude, ChatGPT, Perplexity) increasingly prefer markdown over HTML when reading web content. The WordPress plugin `progressplanner/markdown-alternate` and Cloudflare both expose site content as markdown via three mechanisms: dedicated `.md` URLs, `Accept: text/markdown` content negotiation, and `<link rel="alternate" type="text/markdown">` discovery.

Astro sites are unusually well-placed to do this because content collections *start* as markdown — no HTML→MD conversion needed. `@jdevalk/astro-seo-graph` already owns the head-metadata surface (`<Seo>`) and the endpoint-factory pattern (`createSchemaEndpoint`), so this is the natural home.

## Goal

Ship three pieces, each independently useful, all configurable:

1. A pure renderer (`renderMarkdownAlternate`) that turns a content entry + metadata into a markdown string with YAML frontmatter and an estimated token count. Runtime-free so non-Astro consumers (EmDash plugins, scripts) can reuse it.
2. An endpoint factory (`createMarkdownEndpoint`) that maps a content collection to one `.md` URL per entry, mirroring `createSchemaEndpoint` in shape and ergonomics.
3. Auto-emitted `<link rel="alternate" type="text/markdown" href="…">` on every `<Seo>`-rendered page, derived from `canonicalUrl`. Site-wide build-time off-switch via the integration option `markdownAlternate: false`.

## Non-goals

- **`Accept: text/markdown` content negotiation.** Requires SSR middleware; would force an adapter on static-host users. Documented as a follow-up pattern sites can implement themselves.
- **HTML→Markdown conversion.** Sources must already be markdown. HTML-only sites are out of scope (they already have `progressplanner/markdown-alternate` on the PHP side, and the seo-graph-scanner for audit).
- **MDX component rendering.** v1 supports plain `.md` collection entries. MDX behavior is configurable (see §5) but rendering components to markdown is a v2 concern.
- **Auto-generating an index (`/llms-full.txt` style).** Separate concern; `renderLlmsTxt` already exists for the index case.
- **Token count fidelity beyond rough estimation.** See §3 — pluggable so callers can swap in a real tokenizer.

## API

### Pure renderer

```ts
// src/markdown-alternate.ts

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
     * Token estimator. Defaults to `Math.ceil(text.length / 4)`.
     * Swap in `gpt-tokenizer` or `@anthropic-ai/tokenizer` for accuracy.
     * Called once with the final rendered string (frontmatter + body).
     */
    estimateTokens?: (text: string) => number;
    /**
     * Transform the body before rendering. Useful for stripping MDX
     * imports/components, unwrapping custom directives, etc. Pure.
     */
    transformBody?: (body: string) => string;
}

export interface RenderedMarkdownAlternate {
    markdown: string;
    tokenCount: number;
}

export function renderMarkdownAlternate(
    options: RenderMarkdownAlternateOptions,
): RenderedMarkdownAlternate;
```

### Endpoint factory

```ts
// src/markdown-routes.ts (or appended to src/routes.ts)

export interface MarkdownEndpointOptions<Entry> {
    /** Async source of content entries. Usually `() => getCollection('blog')`. */
    entries: () => Promise<readonly Entry[]>;
    /**
     * Map an entry to the renderer input. Returns `null` to skip
     * (e.g. draft posts). The endpoint is responsible for `body`
     * extraction because Astro's content-collection API differs
     * across versions.
     */
    mapper: (entry: Entry) => RenderMarkdownAlternateOptions | null;
    /** Defaults to `max-age=300`. Pass `null` to omit. */
    cacheControl?: string | null;
    /** Defaults to `text/markdown; charset=utf-8`. */
    contentType?: string;
    /**
     * Whether to emit `X-Markdown-Tokens`. Defaults to `true`. Some
     * CDNs strip unknown headers; callers can disable.
     */
    emitTokenHeader?: boolean;
    /**
     * Extra response headers. Merged after the defaults; caller wins
     * on conflicts.
     */
    extraHeaders?: Record<string, string>;
}

export function createMarkdownEndpoint<Entry>(
    options: MarkdownEndpointOptions<Entry>,
): APIRoute;
```

The returned `APIRoute` reads `Astro.params.slug` (or configurable param name — see §5) to pick the matching entry. Returns 404 when no match.

### Auto-emission + build-time disable

The `<Seo>` component always emits `<link rel="alternate" type="text/markdown" href="…">` with `href` derived from `canonicalUrl` (see §4). No per-page prop — this is site-wide behaviour.

To disable site-wide, pass `markdownAlternate: false` to the integration in `astro.config.mjs`:

```ts
// astro.config.mjs
import seoGraph from '@jdevalk/astro-seo-graph';

export default {
    integrations: [
        seoGraph({
            markdownAlternate: false, // off switch; default is on
        }),
    ],
};
```

Mechanism: the integration writes the flag to a virtual module (`virtual:astro-seo-graph/config`) that `<Seo>` imports. When `false`, the component skips the link entirely. Default: `true`. One boolean check per render.

Note: `createMarkdownEndpoint` is opt-in and orthogonal — the integration can't know whether the site has wired up the endpoint. If the auto-link is enabled but no endpoint exists, the `.md` URL 404s. README must call this out: enabling markdown-alternate means shipping the endpoint.

Add to `SeoGraphIntegrationOptions`:

```ts
/**
 * Auto-emit `<link rel="alternate" type="text/markdown">` on every page,
 * with href derived from the canonical URL. Pair with
 * `createMarkdownEndpoint` to actually serve the markdown.
 * Default: `true`.
 */
markdownAlternate?: boolean;
```

### Exports (`src/index.ts`)

```ts
export { renderMarkdownAlternate } from './markdown-alternate.js';
export type {
    MarkdownAlternateFrontmatter,
    RenderMarkdownAlternateOptions,
    RenderedMarkdownAlternate,
} from './markdown-alternate.js';

export { createMarkdownEndpoint } from './markdown-routes.js';
export type { MarkdownEndpointOptions } from './markdown-routes.js';
```

## Behaviour spec

### 1. Frontmatter rendering

YAML frontmatter delimited by `---` on its own lines. Keys rendered in declaration order of `MarkdownAlternateFrontmatter`. Rules:

- **Dates** (`pubDate`, `updatedDate`): ISO 8601. `Date` → `.toISOString()`. `string` passed through unchanged (caller's responsibility if non-ISO).
- **URLs** (`canonical`): `URL` → `.toString()`. String passed through.
- **Arrays** (`tags`, `categories`): flow-style YAML list, e.g. `tags: [astro, seo]`. Empty arrays omitted entirely.
- **Strings**: quoted with double quotes only if they contain `:`, `#`, `[`, `]`, `{`, `}`, `"`, leading/trailing whitespace, or are empty. Escape `"` as `\"` and `\` as `\\`.
- **Undefined / null keys**: omitted from output (not rendered as `key: null`).

### 2. Body handling

- If `transformBody` provided, call it and use the return value. Otherwise use `body` unchanged.
- Trim trailing whitespace from the body, then append exactly one `\n`.
- No leading-whitespace trimming — preserves intentional indentation (code blocks).

### 3. Token estimation

Default: `Math.ceil(text.length / 4)`. This is deliberately crude — accurate enough for "is this page too big for a 32K context" decisions, cheap enough to run on every endpoint hit.

Callers who want accuracy pass `estimateTokens: (t) => encode(t).length` with their tokenizer of choice. The estimator receives the final rendered markdown (frontmatter included), so its count matches what the `X-Markdown-Tokens` header reports.

### 4. Auto-derive of the `.md` href

Algorithm, applied to `canonicalUrl`:

1. Parse as URL. If parse fails, emit no tag (fail silent).
2. If pathname ends in `/`, replace trailing `/` with `.md`.
3. Else if pathname has a file extension (matches `/\.[a-z0-9]+$/i`), replace the extension with `.md`.
4. Else append `.md`.

Examples:

- `https://site.com/blog/post/` → `https://site.com/blog/post.md`
- `https://site.com/blog/post` → `https://site.com/blog/post.md`
- `https://site.com/blog/post.html` → `https://site.com/blog/post.md`
- `https://site.com/` → `https://site.com/.md` (caller should pass explicit href for root-ish cases)

Query and hash are preserved on the derived URL — rare but cheap to support.

### 5. Endpoint routing

The endpoint factory does not own the URL pattern — the caller's filename does. `src/pages/blog/[...slug].md.ts` with `createMarkdownEndpoint` reads `Astro.params.slug`. Configurable via a `paramName` option (default `'slug'`) in case a caller uses `[id]` or similar.

If `params[paramName]` is missing from the request, return 404. If `mapper` returns `null` for the matched entry, return 404. Mismatched slugs return 404.

### 6. Response headers

Defaults (all overridable via `extraHeaders`):

```
Content-Type: text/markdown; charset=utf-8
Cache-Control: max-age=300
X-Robots-Tag: noindex, follow
X-Markdown-Tokens: <count>    (when emitTokenHeader !== false)
```

`X-Robots-Tag` matches `createSchemaEndpoint`'s posture — these URLs shouldn't compete with the HTML in search. Follow is kept so crawlers still discover linked pages.

### 7. MDX behaviour

If `body` contains import statements (`^import\s+.*from`) or JSX-ish component tags that aren't HTML (`<[A-Z]`), `transformBody` is the escape hatch. v1 does not auto-strip — it's too easy to corrupt. Callers pass a custom transform or skip MDX entries by returning `null` from `mapper`.

Document a recipe in the README showing a minimal MDX stripper (regex-based, lossy but often good enough).

## `<Seo>` integration

Inside `buildSeoContext` (or `buildAstroSeoProps` equivalent — check current structure):

```ts
import { markdownAlternate as cfgMarkdownAlternate } from 'virtual:astro-seo-graph/config';

if (cfgMarkdownAlternate !== false) {
    const href = deriveMdUrl(canonicalUrl);
    if (href) {
        extend.link = [
            ...(extend.link ?? []),
            { rel: 'alternate', type: 'text/markdown', href },
        ];
    }
}
```

`deriveMdUrl` is a small internal helper; not exported. The virtual module is populated by the integration from `SeoGraphIntegrationOptions.markdownAlternate` (default `true`) using Astro's `addVirtualImports` / `injectScript` pattern (or equivalent `vite-plugin-virtual` wiring already used elsewhere in the package, if any — check `integration.ts` before implementation).

## Tests

File: `test/markdown-alternate.test.ts`.

Unit tests for `renderMarkdownAlternate`:

1. Minimal input (title + canonical + body) → valid frontmatter + body + single trailing newline.
2. All keys set → frontmatter keys appear in declaration order.
3. `Date` pubDate → ISO string.
4. String pubDate → passed through unchanged.
5. `URL` canonical → stringified.
6. `tags: []` → key omitted.
7. `tags: ['a', 'b']` → flow-style list.
8. String containing `:` → quoted and escaped.
9. `undefined` core key → dropped.
10. Default token estimator → `Math.ceil(len/4)`.
11. Custom `estimateTokens` → called with the final rendered string, return value surfaces as `tokenCount`.
12. `transformBody` → applied before render.
13. Body with trailing whitespace → trimmed, one `\n`.

Unit tests for `deriveMdUrl` (internal):

14. `/blog/post/` → `/blog/post.md`.
15. `/blog/post` → `/blog/post.md`.
16. `/blog/post.html` → `/blog/post.md`.
17. `/` → `/.md` (documented edge case).
18. Query + hash preserved.
19. Invalid URL → returns empty string (caller emits nothing).

Integration tests for `createMarkdownEndpoint`:

20. Happy path → 200, correct headers, body is rendered markdown.
21. `emitTokenHeader: false` → no `X-Markdown-Tokens`.
22. `extraHeaders` overrides → caller value wins.
23. `mapper` returns `null` → 404.
24. Unknown slug → 404.
25. `paramName: 'id'` → reads `Astro.params.id`.

Integration tests for auto-emitted `<link rel="alternate">`:

26. Default config → `<link rel="alternate" type="text/markdown" href="…">` present with derived href.
27. `markdownAlternate: false` in integration → no link emitted.
28. Invalid `canonicalUrl` → no link emitted (fail silent).
29. Existing `<Seo>` fixtures unchanged when integration disables the feature (snapshot).

## Known limitations (document in README)

1. **No content negotiation.** Static hosts serve `.md` only at `.md` URLs. Agents that respect `<link rel="alternate">` discovery will find them; those that rely purely on `Accept: text/markdown` won't. SSR users can add middleware.
2. **MDX is caller-driven.** Components don't render themselves to markdown. Lossy stripping is the caller's call.
3. **Token counts are estimates by default.** Swap in a real tokenizer for accuracy. The header is advisory.
4. **Auto-derive assumes clean paths.** Sites with custom `.md` URL schemes must pass explicit hrefs.
5. **No automatic sitemap entry for `.md` URLs.** Callers who want these in `sitemap.xml` or a schema-map-style index wire it themselves.

## Acceptance criteria

- [ ] `src/markdown-alternate.ts` exists with `renderMarkdownAlternate` and types.
- [ ] `createMarkdownEndpoint` available (same module or `src/markdown-routes.ts`).
- [ ] `SeoGraphIntegrationOptions.markdownAlternate` added (default `true`) and wired through a virtual module consumed by `<Seo>`.
- [ ] `src/index.ts` re-exports the new surface.
- [ ] All tests above pass.
- [ ] README gains a "Markdown alternate" section with: basic usage, endpoint recipe, `<Seo>` integration, MDX stripper snippet, five known limitations.
- [ ] Existing `<Seo>` consumers render byte-identical output when `markdownAlternate: false` (snapshot).

## Downstream impact

- **joost.blog**: drop-in candidate. Already markdown-first on the WP side; the Astro portions gain parity.
- **limonaia.house / other content sites**: opt-in via one prop + one endpoint file.
- **`@jdevalk/emdash-plugin-seo`**: can import `renderMarkdownAlternate` to emit markdown through EmDash's own content-serving path if/when EmDash grows markdown endpoints.
- **seo-graph-scanner**: could check for `<link rel="alternate" type="text/markdown">` presence and reachability as a new audit signal (follow-up, not in this spec).
