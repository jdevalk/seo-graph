---
'@jdevalk/astro-seo-graph': patch
---

Fix `deriveMdUrl` so the site root (`/`) maps to `/index.md` instead of `/.md`. The auto-emitted `<link rel="alternate" type="text/markdown">` on the homepage previously pointed at `https://example.com/.md`, which doesn't match the file Astro produces from `src/pages/index.md.ts` (`/index.md`). The build-end verification then stripped the link and warned per occurrence. The new behavior matches Astro's filesystem routing for the index route — homepages with a markdown alternate now keep the discovery link.

Fixes [#40](https://github.com/jdevalk/seo-graph/issues/40).
