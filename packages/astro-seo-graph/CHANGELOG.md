# @jdevalk/astro-seo-graph

## 2.1.0

### Minor Changes

- 110fc2b: **Incremental IndexNow submission via a published content-hash manifest.**

    The `indexNow` integration option submitted every URL on the site on every
    build. The IndexNow spec asks senders to submit only added/updated/deleted
    URLs, and full resubmits can trip per-host rate limits (HTTP 429).

    New opt-in `indexNow.incremental` (`true` or an options object). When enabled,
    each build hashes every eligible page into a manifest, fetches the previously
    published manifest from the live site, diffs them, and submits only the URLs
    that changed (added + updated + deleted) — then writes the new manifest into
    the build output so it ships with the deploy and becomes the next baseline.

    The previous state lives on the live site, so this works identically whether
    you build locally or in CI and needs no external store. A clean `404` is
    treated as a first run (baseline); any other fetch/parse failure is handled by
    `onError` (`'skip'` by default, so a transient blip can't trigger a full
    resubmit; `'full'` to fall back to submitting everything). A `normalize` hook
    lets you strip per-build volatile markup (nonces, timestamps) before hashing.

    Default behavior is unchanged — without `incremental`, the integration still
    submits the full set.

    Also exports the underlying pure helpers (`buildUrlManifest`, `diffManifests`,
    `changedUrls`, `hashContent`, `serializeManifest`, `parseManifest`) for callers
    who want to compute the changed set themselves.

- 29426cb: **Branch-gated IndexNow submission via `indexNowOnBranch`.**

    Preview and feature-branch deploys share the same IndexNow key as production
    but shouldn't notify search engines — submitting preview URLs wastes daily
    quota and can get the key flagged invalid. New `indexNowOnBranch(branch,
    options, productionBranch?)` helper passes the options through unchanged when
    `branch` matches `productionBranch` (default `"main"`) and returns `undefined`
    otherwise, so `seoGraph()` skips submission entirely on non-production deploys.
    Existing configs that pass `IndexNowIntegrationOptions` directly are
    unaffected.

### Patch Changes

- 497a720: Fix `validateImageAlt` false-positives on `alt=""` after HTML minification.

    Astro's build pipeline (via Vite's HTML minifier) implements HTML5 §2.3.2 and drops the value from empty boolean-form attributes, so `<img alt="">` in source becomes `<img ... alt ...>` in the rendered output. The previous regex (`/\balt\s*=/i`) required a literal `=`, so it missed the minified form and warned on every decorative image marked with `alt=""` — defeating the documented decorative-image escape hatch for any consumer using `astro:assets`.

    The new regex (`/\salt(?:\s*=|\s|\/?>|$)/i`) accepts both `alt="..."` and bare-boolean `alt`. The leading whitespace anchor also closes a latent false-skip on attribute names like `data-alt` (which the old regex matched as an `alt` attribute).

- 3d510e2: Embed TypeScript sources into emitted `.js.map` files via `inlineSources: true`. Without this, the published maps reference `../src/*.ts` paths that aren't included in the npm tarball (`files: ["dist", ...]`), causing Vite to warn `Sourcemap for ... points to missing source files` on every dev start in consumer projects. Inlining the sources keeps sourcemaps usable for debugging without shipping the `src/` directory.
- Updated dependencies [973a74d]
- Updated dependencies [973a74d]
- Updated dependencies [3d510e2]
    - @jdevalk/seo-graph-core@0.7.0

## 2.0.0

### Major Changes

- a32a1d4: **Breaking:** drop Astro 5 from peer deps; require Astro 6 and zod 4.

    Why: Astro 5.x ships zod 3 and Astro 6.x ships zod 4. Supporting both Astro majors meant shipping zod 3 as a runtime dep while users on Astro 6 had zod 4 from `astro:content`. zod brands schemas with version-specific symbols, so `seoSchema(image)` (returned as a zod 3 schema) couldn't compose cleanly into a user's `z.object({ ... })` from `astro:content` (zod 4) — composition produced TS type errors and worked at runtime only by accident.

    **What changed:**
    - `peerDependencies.astro` is now `^6.0.0` (was `^5.0.0 || ^6.0.0`).
    - `dependencies.zod` is now `^4.4.3` (was `^3.24.0`).

    **What didn't change:**
    - The exported API surface (`<Seo>`, `createSchemaEndpoint`, `createSchemaMap`, `createApiCatalog`, `createMarkdownEndpoint`, `createIndexNowKeyRoute`, `seoSchema`, `imageSchema`, `buildAlternateLinks`, `breadcrumbsFromUrl`, `gitLastmod`, `aggregate`, `renderLlmsTxt`, `renderMarkdownAlternate`, all types) — all unchanged.
    - Our zod usage is core surface only (`z.object`, `z.string`, `z.enum`, `.min`, `.max`, `.optional`, `.default`) — no zod 4-specific syntax.

    **Migration:**

    If you're already on Astro 6, install: `pnpm add @jdevalk/astro-seo-graph@2`. Your `seo` and `featureImage` collection fields will start composing without the silent type drift they had under 1.x.

    If you're still on Astro 5, stay on `@jdevalk/astro-seo-graph@1.4.1`. The 1.x line gets bug fixes only — no new features ship to it.

## 1.4.1

### Patch Changes

- 20e8049: Fix `deriveMdUrl` so the site root (`/`) maps to `/index.md` instead of `/.md`. The auto-emitted `<link rel="alternate" type="text/markdown">` on the homepage previously pointed at `https://example.com/.md`, which doesn't match the file Astro produces from `src/pages/index.md.ts` (`/index.md`). The build-end verification then stripped the link and warned per occurrence. The new behavior matches Astro's filesystem routing for the index route — homepages with a markdown alternate now keep the discovery link.

    Fixes [#40](https://github.com/jdevalk/seo-graph/issues/40).

- Updated dependencies [ff5adcb]
    - @jdevalk/seo-graph-core@0.6.2

## 1.4.0

### Minor Changes

- 9c67905: Add `createApiCatalog` route factory: serves an [RFC 9727](https://www.rfc-editor.org/rfc/rfc9727) API catalog at `/.well-known/api-catalog` as `application/linkset+json` ([RFC 9264](https://www.rfc-editor.org/rfc/rfc9264)). Accepts three categories of entry — schema.org JSON endpoints (auto-typed as `https://schema.org/<schemaType>`), the schema map (no type field, no standard type exists), and free-form `additional` APIs. Relative paths are absolutized against `siteUrl`; absolute URLs pass through unchanged.

    Also exports a `CATALOG_PATH` constant (`'/.well-known/api-catalog'`) so callers can reference the path from `_headers` files, the schemamap, or documentation links without duplicating the string.

    Pairs with the existing `createSchemaEndpoint` and `createSchemaMap` factories: schemas are listed once in catalog config, the catalog auto-fills `type` URLs, and the wire format is fixed by RFC 9727 so there's no ambiguity for agent crawlers.

- f7e2e64: Add `gitLastmod` helper: reads the committer date of the most recent git commit that touched a file, with configurable `excludeCommits` (skip bulk imports / reformats / renames) and `depth`. Use it to feed trustworthy `dateModified` / `<lastmod>` values from git history instead of filesystem `mtime`, which gets rewritten on every CI checkout.

    Returns `null` when the file has no git history, git isn't on the PATH, or every commit in the inspected window is excluded — callers should fall back to `publishDate` (or skip the field) in that case. `excludeCommits` matches on the first 7 characters of the SHA, so short hashes from `git log --oneline` work directly.

    Build-time only — shells out to the `git` binary via `execFileSync` (no shell parsing, so file paths containing quotes or `$` are safe).

## 1.3.0

### Minor Changes

- b82bddb: Verify markdown-alternate links against the build output.

    When `seoGraph({ markdownAlternate: true })` is enabled, the integration now walks the build output after every build, finds each auto-emitted `<link rel="alternate" type="text/markdown">`, checks whether the referenced `.md` file is actually on disk, and strips any link whose target is missing — with a `warn` per occurrence so misconfigured endpoints stay visible.

    Mirrors the existence check in `astro-markdown-alternate`. Previously `<Seo>` derived the markdown URL optimistically from the canonical and could ship a link pointing at a 404 (collection entries that didn't get prerendered, routes that don't cover this page).

    New exports for callers building their own pipelines: `findMarkdownAlternateLink`, `stripMarkdownAlternateLink`, `resolveMarkdownAlternatePath`.

    SSR users whose `.md` endpoints aren't prerendered should leave `markdownAlternate` off and emit the discovery link themselves — the on-disk verification will otherwise strip every link.

## 1.2.0

### Minor Changes

- 6e48ee8: Add markdown-alternate support: serve clean markdown versions of pages at parallel `.md` URLs so AI agents (Claude, ChatGPT, Perplexity, Cloudflare's AI crawlers) can consume content without HTML parsing.

    **`createMarkdownEndpoint`** — factory returning an Astro `APIRoute` that serves a markdown entry: YAML frontmatter (title, canonical, pubDate, updatedDate, author, description, tags, categories) + body. Ships with `Content-Type: text/markdown; charset=utf-8`, `X-Robots-Tag: noindex, follow`, `X-Markdown-Tokens: <n>`, and `Link: <canonical>; rel="canonical"` pointing crawlers at the HTML. Token count defaults to a rough `chars/4` estimate; swap in `gpt-tokenizer` or `@anthropic-ai/tokenizer` via `estimateTokens` for accuracy.

    **`renderMarkdownAlternate`** — pure renderer behind the endpoint. Importable from non-Astro code for the same frontmatter + body + token-count output.

    **Auto-emitted discovery link (opt-in)** — new `markdownAlternate?: boolean` option on the `seoGraph()` integration. When `true`, `<Seo>` emits `<link rel="alternate" type="text/markdown" href="…">` on every page with `href` derived from the canonical (e.g. `/blog/post/` → `/blog/post.md`). Default is `false` — enable only after wiring up `createMarkdownEndpoint` at the matching path, or the link will 404. Implemented via a Vite `define` that replaces a sentinel in the compiled `<Seo>` component at build time — no runtime cost.

    **Cloudflare content negotiation** — README gains a recipe for honouring `Accept: text/markdown` on static sites via CF Transform Rules (URL rewrite + `Vary: Accept` response header), no SSR or middleware required.

    No breaking changes. Existing `<Seo>` consumers render byte-identical output unless they opt into `markdownAlternate: true`.

## 1.1.1

### Patch Changes

- e62b8c3: Fix two bugs in the 1.1.0 validators.

    **`validateInternalLinks` flagged static assets as 404s.** The
    built-paths set was constructed only from `*.html` files, so any link
    to a file copied from `public/` (images, fonts, downloads,
    `favicon.svg`, etc.) came back as `not-found`. The walker now collects
    every file produced by the build and includes non-HTML paths verbatim
    as link targets. HTML pages still map through `htmlFileToPath` so the
    trailing-slash mismatch detection keeps working.

    New export: `buildLinkTargetSet(files)` — turns a list of built files
    into the valid-link-target set used by `classifyInternalLink`.

    **`extractMetaDescription` truncated on apostrophes.** The regex used
    `[^"']*` to capture the attribute value, which terminates on _either_
    quote — so `content="don't stop"` was captured as `don`, and
    `validateMetadataLength` reported absurdly short lengths like "11
    chars" for descriptions that were actually 90. The extractor now uses
    a backreference on the opening quote, so the capture only terminates
    on the quote that opened it. Entity decoding is unchanged; the
    returned value is the whitespace-collapsed, entity-decoded text that
    Google renders in the SERP.

## 1.1.0

### Minor Changes

- e8367dc: Three new build-time validators on the `seoGraph()` integration.

    **`validateImageAlt`** (default `true`) — warns about `<img>` tags
    missing an `alt` attribute. Common SEO and accessibility miss that's
    easy to overlook while drafting. Respects both WCAG decorative-image
    patterns: `alt=""` (the canonical form) and
    `role="presentation"`/`role="none"` (removes the image from the
    accessibility tree). Only a tag with neither is flagged. Warnings
    identify each page and list the first few `src` values so offenders
    are findable without reopening the file.

    **`validateMetadataLength`** (default `true`) — warns when `<title>` or
    `<meta name="description">` length falls outside SERP-friendly bounds.
    Defaults: title 30–65 characters, description 70–200. Pass `false` to
    disable or an object to override per-field — e.g.
    `{ title: { max: 60 }, description: { min: 120 } }` applies the
    overrides and keeps defaults for the rest. Length is measured on the
    whitespace-collapsed, entity-decoded text (the same thing Google
    renders in the SERP).

    **`validateInternalLinks`** (default `true`) — warns when an internal
    `<a href>` points to a URL that doesn't match a built page. Catches two
    common bugs: trailing-slash mismatches (e.g. linking to `/about-me`
    when the built page is `/about-me/` — "works" via redirect but wastes
    a round-trip on every click) and true 404s. Only same-origin (via
    `config.site`) and root-relative links are checked; external URLs,
    `mailto:`/`tel:`, and fragment-only links are skipped. Explicit
    redirects are honored as valid targets by default: literal sources in
    `public/_redirects` (Netlify / Cloudflare Pages format) and literal
    keys in Astro's `redirects` config are unioned into the built-paths
    set. Set `honorRedirects: false` to opt out when auditing for redirect
    hops. Dynamic rules (wildcards, splats, `[slug]` params) are skipped;
    use `skip` for those. Pass `{ skip: (href) => boolean }` to exclude
    additional hrefs (e.g. SSR-only routes).

    New exports on `@jdevalk/astro-seo-graph/integration`:
    `findImagesWithoutAlt`, `resolveMetadataLengthBounds`,
    `MetadataLengthBounds`, `DEFAULT_METADATA_LENGTH_BOUNDS`,
    `classifyInternalLink`, `extractAnchorHrefs`, `htmlFileToPath`,
    `parseNetlifyRedirects`, `collectAstroRedirectSources`,
    `ValidateInternalLinksOptions` — for callers running the same checks
    in their own pipelines (pre-commit hooks, CI scripts, etc.).

## 1.0.1

### Patch Changes

- bf6efb2: IndexNow: exclude `/404` (and `/404/`) from submission by default. Search
  engines don't need to be notified about a site's 404 page, and submitting
  it wastes daily IndexNow quota. The exclusion is applied before any
  caller-supplied `filter` runs, so callers don't need to re-exclude it
  themselves.

    Also documents the `filter` option alongside common patterns (e.g.
    excluding paginated archives like `/blog/2/`), and exposes
    `isDefaultExcludedFromIndexNow(url)` for callers building their own
    submission pipelines.

    Closes #26.

## 1.0.0

### Major Changes

- fc161b9: `<Seo>` is now a first-party component. Removes the `astro-seo` dependency
  and renders every `<head>` tag directly. Net result: cleaner output, two
  silent bugs fixed, lighter install.

                        ### Bug fixes (behavior changes that fix wrong output)
                        - **`articlePublisher` now actually renders.** Previously the prop typechecked
                          but was silently dropped — `astro-seo`'s `OpenGraphArticleTags` doesn't
                          destructure `publisher`, and its `openGraph.article` type doesn't include
                          the field. Anyone using `articlePublisher` was getting no output. `<Seo>`
                          now emits `<meta property="article:publisher" content="…">` as documented.
                          Filed upstream: [jonasmerlin/astro-seo#110](https://github.com/jonasmerlin/astro-seo/issues/110).
                        - **`<link rel="canonical">` no longer leaks on `noindex` pages.** The
                          intent ("omit canonical on noindex" per Google recommendation) was
                          defeated by `astro-seo`'s built-in canonical fallback that reconstructs
                          the tag from `Astro.url` when the prop is undefined. `<Seo>` now omits
                          the tag cleanly. Tracked upstream:
                          [jonasmerlin/astro-seo#107](https://github.com/jonasmerlin/astro-seo/issues/107).
                        - **Single `og:image` tag instead of `og:image` + `og:image:url`.** The
                          `astro-seo` path emitted both with the same value — synonymous, harmless,
                          but noise. `<Seo>` emits just `og:image`.
                        - **Single `<meta name="robots">` tag.** The `astro-seo` path always
                          emitted its own default `index, follow` tag that couldn't be suppressed,
                          while we needed our own to add `max-snippet:-1, max-image-preview:large,

    max-video-preview:-1`. Result was two robots tags per page. `<Seo>` now
    emits one merged tag with all directives.

                        ### Cosmetic changes (HTML diff but equivalent meaning)

                        The byte-for-byte head output differs from 0.x in tag ordering. Search engines
                        treat these as identical, but consumers running snapshot tests against
                        `<Seo>` output will see diffs.
                        - **Tag grouping by concern**: title → canonical → description → robots →
                          OG basic → OG optional → OG image meta → OG article → twitter →
                          hreflang → author → extras → JSON-LD. Previously the order was driven
                          by `astro-seo`'s sub-components.
                        - **Twitter overrides** follow the same field order as their OG counterparts
                          (card / site / creator / title / description / image / imageAlt). The
                          legacy order was card / site / title / image / imageAlt / description / creator.
                        - **Hreflang link attribute order**: `rel` → `hreflang` → `href`.
                          The legacy order was `rel` → `href` → `hreflang`.

                        ### Breaking API changes
                        - **Removed `buildAstroSeoProps`**. Replaced by `buildSeoContext`, which
                          returns a flat, render-ready normalization (`SeoContext`) rather than the
                          nested `astro-seo`-shaped adapter. Migration:

                            ```diff
                            - import { buildAstroSeoProps } from '@jdevalk/astro-seo-graph';
                            - const props = buildAstroSeoProps(seo, Astro.url.href);
                            - props.openGraph.basic.title // nested
                            + import { buildSeoContext } from '@jdevalk/astro-seo-graph';
                            + const ctx = buildSeoContext(seo, Astro.url.href);
                            + ctx.og.title // flat
                            ```

                        - **Removed `AstroSeoProps` type export**. The intermediate shape no
                          longer exists. Use `SeoContext` (the new normalized shape) or `SeoProps`
                          (the public input shape) depending on which side of the boundary you're on.
                        - **Removed `astro-seo` from dependencies**. If you imported it transitively
                          through this package, install it directly: `pnpm add astro-seo`.

                        ### New exports
                        - `buildSeoContext(props, url): SeoContext` — pure-TS normalization.
                        - `SeoContext` type — flat render-ready shape.
                        - `ROBOTS_EXTRAS` constant — the `max-snippet:-1, max-image-preview:large,

    max-video-preview:-1`directives`<Seo>` always appends to the robots tag.

## 0.9.0

### Minor Changes

- 8de1aaa: Add `llmsTxt` option to the Astro integration. When enabled, writes an
  [`llms.txt`](https://llmstxt.org) file at the root of the build output.
  Pages are auto-collected from crawled HTML (`<title>` + meta description)
  into a single section; callers can supply `sections` explicitly to skip
  auto-collection, or use `filter` / `autoSectionName` / `outputPath` to
  tune the auto-generated output.

    Exports `renderLlmsTxt` and related types (`LlmsTxtInput`,
    `LlmsTxtSection`, `LlmsTxtLink`) for callers that want to render
    `llms.txt` outside the integration hook.

## 0.8.0

### Minor Changes

- fbaf594: Add `validateUniqueMetadata` option to the Astro integration. Warns when
  two or more built pages share the same `<title>` or meta description —
  an SEO smell that can only be detected across the whole corpus. Enabled
  by default.

    Exports `extractTitle` and `extractMetaDescription` helpers for callers
    that want to reuse the extraction logic outside the integration hook.

### Patch Changes

- 946ceaf: Docs: warn that the IndexNow key file must be deployed and reachable
  over HTTPS _before_ any submissions are sent. Early submissions get
  rejected (HTTP 403) and the key is marked invalid, forcing rotation.
- ee68bfc: Use direct re-export syntax for `submitToIndexNow`, `validateIndexNowKey`,
  and `IndexNowSubmitResult` from `@jdevalk/seo-graph-core`. Fixes a Vite
  warning about imported-but-unused symbols in the built module.
- Updated dependencies [946ceaf]
    - @jdevalk/seo-graph-core@0.6.1

## 0.7.0

### Minor Changes

- 07d5e02: Add IndexNow protocol support.

    `seo-graph-core` ships new runtime-agnostic helpers:
    `submitToIndexNow`, `generateIndexNowKey`, `validateIndexNowKey`, and
    `getIndexNowKeyFileContent`. URLs are filtered to the target host,
    deduplicated, and chunked at 10,000 per request. Network errors never
    throw — each chunk returns a `{ status, ok, message }` result.

    `astro-seo-graph` adds `createIndexNowKeyRoute` (serves the
    `/<key>.txt` verification file) and an `indexNow` option on the Astro
    integration that submits built URLs to IndexNow on
    `astro:build:done`. `index.html` paths are rewritten to their
    trailing-slash form before submission.

### Patch Changes

- Updated dependencies [07d5e02]
    - @jdevalk/seo-graph-core@0.6.0

## 0.6.0

### Minor Changes

- 5511a79: **New features:**
    - **Astro integration** (`@jdevalk/astro-seo-graph/integration`) that runs build-time SEO checks. Currently warns about pages with zero or more than one `<h1>` element.
    - **`X-Robots-Tag: noindex, follow`** headers on responses from `createSchemaEndpoint` and `createSchemaMap`. Schema endpoints are for agent consumption, not search result indexing; `follow` ensures crawlers still traverse the links they contain.
    - **Robots meta defaults**. `<Seo>` now always emits `max-snippet:-1, max-image-preview:large, max-video-preview:-1` on the robots meta tag (opts into maximum snippet and preview sizes in search results). With `noindex`, emits `noindex, follow, max-*`.
    - **`nofollow` prop** on `<Seo>` for explicit `nofollow` directives (independent of `noindex`).
    - **Canonical omitted when `noindex` is true** (Google recommendation — canonicalizing a noindex page confuses crawlers).
    - **Canonical strips query parameters by default**. Add `preserveQueryParams` to opt out, or set `canonical` explicitly to override.
    - **`og:locale:alternate`** derived from `alternates` prop for multilingual pages.
    - **`<meta name="author">`** from new `author` prop, with fallback to `article.authors[0]`.
    - **`article:publisher`** via new `articlePublisher` prop (Facebook page URL of the publisher).
    - **Twitter tags deduplicated against OG.** `twitter:title`, `:description`, `:image`, and `:image:alt` are only emitted when explicitly overridden via the `twitter.title/description/image/imageAlt` props — otherwise Twitter falls back to the `og:` counterparts automatically (reduces meta tag noise).

    **Breaking:**
    - `imageSchema` now **requires** `alt` (previously optional). Missing alt text is an accessibility and SEO failure. Decorative images should use `alt: ''` explicitly. Wrap with `.optional()` if you want the whole image field to be optional.
    - `AstroSeoProps.canonical` is now optional (previously required). `AstroSeoProps.noindex` has been removed — robots directives go through `extend.meta` instead. Internal shape change; only affects consumers calling `buildAstroSeoProps` directly.
    - `createSchemaMap` no longer emits `<changefreq>` or `<priority>` — these have been deprecated by Google and other major crawlers. `SchemaMapEntry.changeFreq` and `SchemaMapEntry.priority` have been removed from the interface.

## 0.5.2

### Patch Changes

- e5792ad: FuzzyRedirect now detects out-of-bounds pagination URLs (e.g. `/blog/page/99/`) and redirects to the base path (`/blog/`) before attempting fuzzy matching.

## 0.5.1

### Patch Changes

- b7e22f3: FuzzyRedirect: log best match and similarity to console, adjust default thresholds (suggest at 0.6+, auto-redirect at 0.85+).

## 0.5.0

### Minor Changes

- 330b7fe: Add `<FuzzyRedirect>` component for 404 pages. Fetches the sitemap, fuzzy-matches the current URL against known paths, and suggests or auto-redirects to close matches. Configurable thresholds, sitemap URL, and suggestion text.

## 0.4.2

### Patch Changes

- 2a076cb: `BreadcrumbItem` now accepts an optional `id` field. When set, the ListItem's `item` value uses `{ "@id": id }` instead of the plain URL, allowing breadcrumb items to reference entities in the graph (e.g. linking a "Blog" crumb to a Blog entity).
- Updated dependencies [2a076cb]
    - @jdevalk/seo-graph-core@0.5.2

## 0.4.1

### Patch Changes

- a81df48: All dedicated builders now allow overriding the computed `@id` by passing `'@id'` directly in the input. Document the pattern in AGENTS.md.
- Updated dependencies [a81df48]
    - @jdevalk/seo-graph-core@0.5.1

## 0.4.0

### Minor Changes

- 407349b: **Breaking changes:**
    - **`extra` removed from all builders.** All schema.org properties are now accepted at the top level with full autocomplete from `schema-dts`. Builders use `Partial<*Leaf>` intersections for typing and `spreadRemainingProperties` for emission.
    - **`buildCustomPiece` renamed to `buildPiece`.** The deprecated alias has been removed.
    - **`buildPerson` removed.** Use `buildPiece<Person>({ '@type': 'Person', '@id': ids.person, ... })`.
    - **`buildOrganization` removed.** Use `buildPiece<Organization>({ '@type': 'Organization', '@id': ids.organization('slug'), ... })` or `buildPiece<Restaurant>({ '@type': 'Restaurant', ... })` for subtypes.

    **New features:**
    - **`buildPiece<T>` with `@type` narrowing.** Pass a `schema-dts` type as the generic and the `@type` value in your input automatically narrows union types to the matching leaf — `buildPiece<Product>` with `'@type': 'Product'` gives full ProductLeaf autocomplete. No need to import Leaf types.
    - **Dangling reference validation.** `assembleGraph(pieces, { warnOnDanglingReferences: true })` warns when `{ '@id': '...' }` references don't resolve to any entity in the graph.
    - **`spreadRemainingProperties` and `CREATIVE_WORK_KEYS` exported** for third-party builders.

### Patch Changes

- Updated dependencies [407349b]
    - @jdevalk/seo-graph-core@0.5.0

## 0.3.1

### Patch Changes

- c7ac7fe: Ship AGENTS.md in the npm package so AI coding agents can read the full reference locally. Fix README links to point to the GitHub URL instead of a relative monorepo path.
- Updated dependencies [c7ac7fe]
    - @jdevalk/seo-graph-core@0.4.1

## 0.3.0

### Minor Changes

- 2b5c118: **seo-graph-core:**
    - Add shared `CreativeWorkFields` interface and `applyCreativeWorkFields` helper. `WebSiteInput`, `WebPageInput`, and `ArticleInput` all extend it, inheriting `description`, `inLanguage`, `datePublished`, `dateModified`, `about`, `copyrightHolder`, `copyrightYear`, `copyrightNotice`, `license`, and `isAccessibleForFree` as first-class optional fields.
    - `buildArticle` now accepts a third `type` parameter for Article subtypes: `'BlogPosting'`, `'NewsArticle'`, `'TechArticle'`, `'ScholarlyArticle'`, `'Report'`. Defaults to `'Article'`.
    - `buildBreadcrumbList` now emits the last ListItem's `item` as a `{ "@id": ... }` reference to the WebPage entity instead of a plain URL string.

    **astro-seo-graph:**
    - Add `breadcrumbsFromUrl` helper that derives a `BreadcrumbItem[]` trail from an Astro URL. Supports custom segment names, segment skipping, and sites with a base path.

### Patch Changes

- Updated dependencies [2b5c118]
    - @jdevalk/seo-graph-core@0.4.0

## 0.2.4

### Patch Changes

- 2f35813: Republish to fix a broken `0.2.3` tarball. `0.2.3` was published via `npm publish` directly (workaround for a broken CI publish path), and `npm publish` doesn't rewrite `workspace:*` in the manifest the way `pnpm publish` does. Consumers installing `0.2.3` got `"@jdevalk/seo-graph-core": "workspace:*"` in their node_modules resolution, which fails with `EUNSUPPORTEDPROTOCOL` outside the seo-graph workspace — same bug that broke `0.2.0`.

    `0.2.4` is functionally identical to `0.2.3` — same code, same hreflang alternates feature, same `seo-graph-core@0.3.0` dep. It just has a properly-rewritten manifest (thanks to `pnpm pack` now being part of the CI publish pipeline).

## 0.2.3

### Patch Changes

- Updated dependencies [a2e0cd0]
    - @jdevalk/seo-graph-core@0.3.0

## 0.2.2

### Patch Changes

- Updated dependencies [c59de35]
    - @jdevalk/seo-graph-core@0.2.0

## 0.2.1

### Patch Changes

- b5b31d1: Fix broken `0.2.0` tarball: republish via `pnpm` so the `workspace:*` protocol on the `@jdevalk/seo-graph-core` dep gets rewritten to a real version range. `0.2.0` was published via `npm publish` which doesn't understand `workspace:*`, leaving consumers with an unusable dependency specifier. `0.2.1` is functionally identical to the intended `0.2.0` — same hreflang alternates feature, same API surface — just with a valid published manifest.

## 0.2.0

### Minor Changes

- c88403a: Add hreflang alternate-language support to `<Seo>`.

    A new `alternates` prop on `<Seo>` accepts a list of `{ hreflang, href }` entries plus an optional `defaultLocale` hint, and emits one `<link rel="alternate" hreflang="…" href="…">` per entry along with an automatically-resolved `x-default` entry. The underlying `buildAlternateLinks` helper is exported from the package's main entry so non-Astro callers (notably `@jdevalk/emdash-plugin-seo`) can use it to feed their own metadata pipelines.

    Behaviour:
    - BCP 47 tags are normalized on output: `fr-ca` → `fr-CA`, `zh-hant-hk` → `zh-Hant-HK`.
    - Absolute `http(s)://` URLs are required; relative, protocol-relative, and non-http schemes are dropped silently.
    - Duplicate tags are deduped (first entry wins after normalization).
    - `x-default` is resolved against the `defaultLocale` hint when provided, falling back to the first surviving entry.
    - When fewer than two entries survive validation, no tags are emitted — a single-locale page has no meaningful alternates.
    - The literal `"x-default"` is reserved as an input value and dropped if passed.

    Additive and non-breaking: sites that don't pass `alternates` render identical head output.

## 0.1.0

### Minor Changes

- f1f57fd: First publishable alpha.

    Ships the v0.1 surface: `<Seo>` component wrapping `astro-seo` with optional JSON-LD graph injection, `createSchemaEndpoint` and `createSchemaMap` route factories for agent-ready schema endpoints, an `aggregate` walk-and-dedupe helper, and Zod `seoSchema` / `imageSchema` for `content.config.ts`. The pure-TS `buildAstroSeoProps` is exported for callers who want to drive a different head component.

    `createOgRenderer` (satori + sharp) is deliberately not in v0.1 — it lands in v0.2 once a consumer needs it, keeping the dep tree free of native binaries.

    37 tests passing covering title templating, OG image / article metadata gating, Twitter overrides, noindex, locale, dedup semantics, endpoint headers, XML escaping, and Zod length bounds.

### Patch Changes

- First stable `0.x` release (not 1.0.0).

    Exits the alpha pre-release track and ships both packages on the `latest` dist tag. The `0.x.y` version is the semver-native "works, but we're not yet committing to long-term API stability" signal — the API is honest about being pre-1.0 while still being installable as a normal dependency.

    ## What's actually in `0.1.0`

    **`@jdevalk/seo-graph-core`** is the runtime-agnostic schema.org graph engine:
    - `makeIds({ siteUrl, personUrl? })` — IdFactory for stable `@id` references
    - `assembleGraph(pieces)` + `deduplicateByGraphId` — envelope wrapping with first-wins dedup
    - Ten piece builders on top of [`schema-dts`](https://github.com/google/schema-dts) types: `buildWebSite`, `buildPerson`, `buildOrganization`, `buildSiteNavigationElement`, `buildWebPage` (with `WebPage` / `ProfilePage` / `CollectionPage`), `buildArticle`, `buildBreadcrumbList`, `buildImageObject`, `buildVideoObject`, and `buildCustomPiece` as a raw escape hatch
    - 31 tests, including a byte-identical integration test against a captured `/schema/post.json` fixture from [joost.blog](https://joost.blog)

    **`@jdevalk/astro-seo-graph`** is the Astro integration on top of the core:
    - `<Seo>` — single head component wrapping [`astro-seo`](https://github.com/jonasmerlin/astro-seo), takes an optional JSON-LD `@graph` and emits it as an inline `<script type="application/ld+json">`
    - `createSchemaEndpoint` + `createSchemaMap` — factories for agent-ready schema endpoints (`/schema/post.json`, `/schemamap.xml`, etc.)
    - `aggregate` — the shared walk + mapper + dedup engine behind the endpoint factories
    - `seoSchema` + `imageSchema` — Zod helpers for `src/content.config.ts`
    - `buildAstroSeoProps` — the pure-TS core of `<Seo>`, exported for custom head renderers
    - 37 tests

    ## Proven by three consumers
    - **joost.blog** (Astro) — runs `@jdevalk/seo-graph-core` under a thin local adapter in `src/utils/schema/`, and `<Seo>` from `@jdevalk/astro-seo-graph` in `BaseHead.astro`. Schema endpoints byte-identical to pre-migration fixtures across 300 post entities, 138 video entities, and 39 page entities.
    - **limonaia.house** (Astro) — consumes `@jdevalk/astro-seo-graph` to emit a `VacationRental` JSON-LD graph (a schema-dts subtype the core had never explicitly seen), with no changes needed to core or the integration.
    - **[`@jdevalk/emdash-plugin-seo`](https://www.npmjs.com/package/@jdevalk/emdash-plugin-seo)** (EmDash CMS) — shares the envelope + dedup engine via `assembleGraph`, keeps its own EmDash-specific piece builders.

    Cross-runtime code sharing is proven: two different CMS/SSG runtimes, one graph engine.

    ## Known limitations (will be addressed in `0.2.x` without breaking changes)
    - `WebPageInput.breadcrumb` is required — schema.org treats it as optional, and consumers like EmDash that don't have breadcrumbs can't use `buildWebPage` without an `extra` override. Should be optional.
    - `buildOrganization` takes a `subtype: string` parameter instead of a generic type parameter, which loses schema-dts autocomplete for subtype-specific fields. Should be `buildOrganization<T extends Organization>(...)`.
    - `makeIds` is hardcoded to joost.blog's `@id` scheme (`/#/schema.org/WebSite`, etc.). EmDash-style sites can't use it as-is. Should accept custom ID pattern overrides.
    - `@jdevalk/astro-seo-graph` doesn't ship `createOgRenderer` yet (deferred to `0.2.x`). Sites needing OG image generation keep their own `og-image.ts` for now.

    None of these block existing consumers — all current usage works. The fixes are additive.

- Updated dependencies
- Updated dependencies [1dab387]
    - @jdevalk/seo-graph-core@0.1.0

## 0.1.0-alpha.1

### Minor Changes

- First publishable alpha.

    Ships the v0.1 surface: `<Seo>` component wrapping `astro-seo` with optional JSON-LD graph injection, `createSchemaEndpoint` and `createSchemaMap` route factories for agent-ready schema endpoints, an `aggregate` walk-and-dedupe helper, and Zod `seoSchema` / `imageSchema` for `content.config.ts`. The pure-TS `buildAstroSeoProps` is exported for callers who want to drive a different head component.

    `createOgRenderer` (satori + sharp) is deliberately not in v0.1 — it lands in v0.2 once a consumer needs it, keeping the dep tree free of native binaries.

    37 tests passing covering title templating, OG image / article metadata gating, Twitter overrides, noindex, locale, dedup semantics, endpoint headers, XML escaping, and Zod length bounds.

## 0.0.1-alpha.0

### Patch Changes

- Updated dependencies [1dab387]
    - @jdevalk/seo-graph-core@0.1.0-alpha.0
