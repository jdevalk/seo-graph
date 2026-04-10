# @jdevalk/seo-graph-core

## 0.4.1

### Patch Changes

- c7ac7fe: Ship AGENTS.md in the npm package so AI coding agents can read the full reference locally. Fix README links to point to the GitHub URL instead of a relative monorepo path.

## 0.4.0

### Minor Changes

- 2b5c118: **seo-graph-core:**
    - Add shared `CreativeWorkFields` interface and `applyCreativeWorkFields` helper. `WebSiteInput`, `WebPageInput`, and `ArticleInput` all extend it, inheriting `description`, `inLanguage`, `datePublished`, `dateModified`, `about`, `copyrightHolder`, `copyrightYear`, `copyrightNotice`, `license`, and `isAccessibleForFree` as first-class optional fields.
    - `buildArticle` now accepts a third `type` parameter for Article subtypes: `'BlogPosting'`, `'NewsArticle'`, `'TechArticle'`, `'ScholarlyArticle'`, `'Report'`. Defaults to `'Article'`.
    - `buildBreadcrumbList` now emits the last ListItem's `item` as a `{ "@id": ... }` reference to the WebPage entity instead of a plain URL string.

    **astro-seo-graph:**
    - Add `breadcrumbsFromUrl` helper that derives a `BreadcrumbItem[]` trail from an Astro URL. Supports custom segment names, segment skipping, and sites with a base path.

## 0.3.0

### Minor Changes

- a2e0cd0: **`inLanguage` no longer defaults to `'en-US'`** on any piece builder. Previously, `buildWebSite`, `buildWebPage`, `buildArticle`, and `buildImageObject` silently stamped `inLanguage: 'en-US'` onto their output when the caller didn't pass one. That's wrong: silently assuming every unspecified site is American English is exactly the kind of default that produces bad metadata for the rest of the world, and schema.org treats `inLanguage` as optional everywhere it appears.

    After this change, all four piece builders simply omit `inLanguage` from the output when the caller doesn't pass one. Callers that want an explicit language should pass it — and they should, because accurate language metadata matters for SEO, accessibility, and agent-ready discovery.

    **This is a behaviour change and will affect the output of existing consumers.** If you were relying on the implicit default, your rendered JSON-LD will no longer include `inLanguage` unless you add it to your call sites. The fix is a one-line addition per piece call: `inLanguage: 'en-US'` (or whatever is actually correct for your site).

    joost.blog's integration test was updated to pass `inLanguage: 'en-US'` explicitly on `buildWebPage`, `buildArticle`, and `buildImageObject` — the fixture still matches byte-for-byte because joost.blog really is an `en-US` site, it just now says so out loud.

## 0.2.0

### Minor Changes

- c59de35: Two API improvements resolving long-standing known limitations. Both additive and non-breaking: existing call sites continue to work unchanged.

    **`buildOrganization` now accepts a generic type parameter** (`<T extends Organization = Organization>`), with `OrganizationInput.extra` typed as `Partial<T>`. Passing a concrete schema-dts subtype (`buildOrganization<Hotel>({...}, ids, 'Hotel')`) flows autocomplete into the `extra` field, so you get type-checked fields like `checkinTime`, `numberOfRooms`, etc. instead of an untyped `Record<string, unknown>`. The generic defaults to `Organization`, so call sites that don't need subtype typing continue to work without specifying `<T>`. The existing JSDoc example showing `buildOrganization<Hotel>(...)` previously didn't compile (there was no generic parameter); now it does.

    **`WebPageInput.breadcrumb` is now optional.** Schema.org treats `breadcrumb` as optional on `WebPage`, so consumers that don't emit `BreadcrumbList` entities can now call `buildWebPage({ url, name, isPartOf }, ids)` without a breadcrumb reference. When provided, output is unchanged. When omitted, the `breadcrumb` key is simply absent from the returned object.

## 0.1.0

### Minor Changes

- 1dab387: Initial alpha release.

    First publishable version of `@jdevalk/seo-graph-core`. Ships runtime-agnostic schema.org JSON-LD graph builders on top of [`schema-dts`](https://github.com/google/schema-dts):
    - `makeIds({ siteUrl, personUrl? })` — IdFactory for stable `@id` references across site-wide and per-page entities.
    - `assembleGraph(pieces)` and `deduplicateByGraphId` — wrap pieces in a `@context` / `@graph` envelope with first-wins deduplication.
    - 10 piece builders under `pieces/`: `buildWebSite`, `buildPerson`, `buildOrganization` (generic over schema-dts subtypes for all Organization and LocalBusiness variants), `buildSiteNavigationElement`, `buildWebPage` (`WebPage` / `ProfilePage` / `CollectionPage`), `buildArticle`, `buildBreadcrumbList`, `buildImageObject`, `buildVideoObject`, and `buildCustomPiece` as a raw escape hatch.
    - 31 tests passing, including a byte-identical integration test against a captured fixture from [joost.blog](https://joost.blog)'s `/schema/post.json` endpoint for the "Defending the open web is not enough" post.

    No page-type enum in core — dispatch lives in consumer adapters. Breadcrumbs are an input, not a derivation.

    This is the foundation for `@jdevalk/astro-seo-graph` (Phase 3) and the refactor of [`@jdevalk/emdash-plugin-seo`](https://github.com/jdevalk/emdash-plugin-seo) (Phase 6).

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

## 0.1.0-alpha.0

### Minor Changes

- 1dab387: Initial alpha release.

    First publishable version of `@jdevalk/seo-graph-core`. Ships runtime-agnostic schema.org JSON-LD graph builders on top of [`schema-dts`](https://github.com/google/schema-dts):
    - `makeIds({ siteUrl, personUrl? })` — IdFactory for stable `@id` references across site-wide and per-page entities.
    - `assembleGraph(pieces)` and `deduplicateByGraphId` — wrap pieces in a `@context` / `@graph` envelope with first-wins deduplication.
    - 10 piece builders under `pieces/`: `buildWebSite`, `buildPerson`, `buildOrganization` (generic over schema-dts subtypes for all Organization and LocalBusiness variants), `buildSiteNavigationElement`, `buildWebPage` (`WebPage` / `ProfilePage` / `CollectionPage`), `buildArticle`, `buildBreadcrumbList`, `buildImageObject`, `buildVideoObject`, and `buildCustomPiece` as a raw escape hatch.
    - 31 tests passing, including a byte-identical integration test against a captured fixture from [joost.blog](https://joost.blog)'s `/schema/post.json` endpoint for the "Defending the open web is not enough" post.

    No page-type enum in core — dispatch lives in consumer adapters. Breadcrumbs are an input, not a derivation.

    This is the foundation for `@jdevalk/astro-seo-graph` (Phase 3) and the refactor of [`@jdevalk/emdash-plugin-seo`](https://github.com/jdevalk/emdash-plugin-seo) (Phase 6).
