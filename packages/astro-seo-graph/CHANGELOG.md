# @jdevalk/astro-seo-graph

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
