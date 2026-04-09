---
'@jdevalk/astro-seo-graph': patch
---

Fix broken `0.2.0` tarball: republish via `pnpm` so the `workspace:*` protocol on the `@jdevalk/seo-graph-core` dep gets rewritten to a real version range. `0.2.0` was published via `npm publish` which doesn't understand `workspace:*`, leaving consumers with an unusable dependency specifier. `0.2.1` is functionally identical to the intended `0.2.0` — same hreflang alternates feature, same API surface — just with a valid published manifest.
