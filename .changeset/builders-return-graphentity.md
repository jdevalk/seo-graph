---
'@jdevalk/seo-graph-core': minor
---

**Piece builders now return `GraphEntity` instead of `Record<string, unknown>`.**

`assembleGraph<T extends GraphEntity>(pieces)` requires each piece to be a
`GraphEntity`, whose `@type` is required. The builders (`buildWebSite`,
`buildWebPage`, `buildArticle`, `buildBreadcrumbList`, `buildImageObject`,
`buildVideoObject`, `buildSiteNavigationElement`, `buildPiece`) were declared
to return `Record<string, unknown>`, which lacks `@type` — so the documented
pattern `assembleGraph([buildWebSite(...), buildArticle(...)])` failed `tsc` /
`astro check` under strict mode and forced callers to cast `as GraphEntity[]`.

Every builder already produces an object with a literal `@type`, so the return
type is widened to `GraphEntity` with no runtime change. Builder results — and
the arrays returned by `aggregate`/`createSchemaEndpoint` mappers — now compose
with `assembleGraph` without a cast.
