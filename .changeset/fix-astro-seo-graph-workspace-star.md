---
'@jdevalk/astro-seo-graph': patch
---

Republish to fix a broken `0.2.3` tarball. `0.2.3` was published via `npm publish` directly (workaround for a broken CI publish path), and `npm publish` doesn't rewrite `workspace:*` in the manifest the way `pnpm publish` does. Consumers installing `0.2.3` got `"@jdevalk/seo-graph-core": "workspace:*"` in their node_modules resolution, which fails with `EUNSUPPORTEDPROTOCOL` outside the seo-graph workspace — same bug that broke `0.2.0`.

`0.2.4` is functionally identical to `0.2.3` — same code, same hreflang alternates feature, same `seo-graph-core@0.3.0` dep. It just has a properly-rewritten manifest (thanks to `pnpm pack` now being part of the CI publish pipeline).
