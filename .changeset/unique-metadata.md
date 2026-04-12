---
'@jdevalk/astro-seo-graph': minor
---

Add `validateUniqueMetadata` option to the Astro integration. Warns when
two or more built pages share the same `<title>` or meta description —
an SEO smell that can only be detected across the whole corpus. Enabled
by default.

Exports `extractTitle` and `extractMetaDescription` helpers for callers
that want to reuse the extraction logic outside the integration hook.
