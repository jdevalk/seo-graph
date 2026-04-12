---
'@jdevalk/astro-seo-graph': minor
---

**New features:**

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
