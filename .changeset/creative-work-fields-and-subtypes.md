---
'@jdevalk/seo-graph-core': minor
'@jdevalk/astro-seo-graph': minor
---

**seo-graph-core:**

- Add shared `CreativeWorkFields` interface and `applyCreativeWorkFields` helper. `WebSiteInput`, `WebPageInput`, and `ArticleInput` all extend it, inheriting `description`, `inLanguage`, `datePublished`, `dateModified`, `about`, `copyrightHolder`, `copyrightYear`, `copyrightNotice`, `license`, and `isAccessibleForFree` as first-class optional fields.
- `buildArticle` now accepts a third `type` parameter for Article subtypes: `'BlogPosting'`, `'NewsArticle'`, `'TechArticle'`, `'ScholarlyArticle'`, `'Report'`. Defaults to `'Article'`.
- `buildBreadcrumbList` now emits the last ListItem's `item` as a `{ "@id": ... }` reference to the WebPage entity instead of a plain URL string.

**astro-seo-graph:**

- Add `breadcrumbsFromUrl` helper that derives a `BreadcrumbItem[]` trail from an Astro URL. Supports custom segment names, segment skipping, and sites with a base path.
