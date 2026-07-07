---
'@jdevalk/seo-graph-core': minor
---

**`buildArticle` now accepts an array for `isPartOf`.**

`ArticleInput.isPartOf` was typed as a single `Reference`, but the shipped
"Personal blog" recipe in `AGENTS.md` links a posting to both its `WebPage`
and the `Blog` via `isPartOf: [{ '@id': webPage }, { '@id': blog }]`. The
builder already emitted the value verbatim at runtime, so the array worked —
but the type rejected it, forcing callers to add an `as` cast.

The input type is now `Reference | Reference[]`. No runtime change; existing
single-reference callers are unaffected.
