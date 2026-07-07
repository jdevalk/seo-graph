# @jdevalk/seo-graph-scanner

## 0.0.3

### Patch Changes

- 3d510e2: Embed TypeScript sources into emitted `.js.map` files via `inlineSources: true`. Without this, the published maps reference `../src/*.ts` paths that aren't included in the npm tarball (`files: ["dist", ...]`), causing Vite to warn `Sourcemap for ... points to missing source files` on every dev start in consumer projects. Inlining the sources keeps sourcemaps usable for debugging without shipping the `src/` directory.
- Updated dependencies [973a74d]
- Updated dependencies [973a74d]
- Updated dependencies [3d510e2]
    - @jdevalk/seo-graph-core@0.7.0

## 0.0.2

### Patch Changes

- Updated dependencies [ff5adcb]
    - @jdevalk/seo-graph-core@0.6.2
