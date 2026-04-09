# @jdevalk/seo-graph-core

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
