---
"@jdevalk/astro-seo-graph": minor
---

**New features:**

- **Astro integration** (`@jdevalk/astro-seo-graph/integration`) that runs build-time SEO checks. Currently warns about pages with zero or more than one `<h1>` element.
- **`X-Robots-Tag: noindex`** headers on responses from `createSchemaEndpoint` and `createSchemaMap`. Schema endpoints are for agent consumption, not search result indexing.

**Breaking:**

- `imageSchema` now **requires** `alt` (previously optional). Missing alt text is an accessibility and SEO failure. Decorative images should use `alt: ''` explicitly. Wrap with `.optional()` if you want the whole image field to be optional.
