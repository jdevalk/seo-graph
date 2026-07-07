---
'@jdevalk/astro-seo-graph': patch
'@jdevalk/seo-graph-core': patch
'@jdevalk/seo-graph-scanner': patch
---

Embed TypeScript sources into emitted `.js.map` files via `inlineSources: true`. Without this, the published maps reference `../src/*.ts` paths that aren't included in the npm tarball (`files: ["dist", ...]`), causing Vite to warn `Sourcemap for ... points to missing source files` on every dev start in consumer projects. Inlining the sources keeps sourcemaps usable for debugging without shipping the `src/` directory.
