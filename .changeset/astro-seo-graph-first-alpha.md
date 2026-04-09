---
'@jdevalk/astro-seo-graph': minor
---

First publishable alpha.

Ships the v0.1 surface: `<Seo>` component wrapping `astro-seo` with optional JSON-LD graph injection, `createSchemaEndpoint` and `createSchemaMap` route factories for agent-ready schema endpoints, an `aggregate` walk-and-dedupe helper, and Zod `seoSchema` / `imageSchema` for `content.config.ts`. The pure-TS `buildAstroSeoProps` is exported for callers who want to drive a different head component.

`createOgRenderer` (satori + sharp) is deliberately not in v0.1 — it lands in v0.2 once a consumer needs it, keeping the dep tree free of native binaries.

37 tests passing covering title templating, OG image / article metadata gating, Twitter overrides, noindex, locale, dedup semantics, endpoint headers, XML escaping, and Zod length bounds.
