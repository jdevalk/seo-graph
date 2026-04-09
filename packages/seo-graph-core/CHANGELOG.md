# @jdevalk/seo-graph-core

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
