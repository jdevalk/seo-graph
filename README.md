# seo-graph

[![CI](https://github.com/jdevalk/seo-graph/actions/workflows/ci.yml/badge.svg)](https://github.com/jdevalk/seo-graph/actions/workflows/ci.yml)
[![seo-graph-core npm](https://img.shields.io/npm/v/%40jdevalk%2Fseo-graph-core?label=%40jdevalk%2Fseo-graph-core)](https://www.npmjs.com/package/@jdevalk/seo-graph-core)
[![astro-seo-graph npm](https://img.shields.io/npm/v/%40jdevalk%2Fastro-seo-graph?label=%40jdevalk%2Fastro-seo-graph)](https://www.npmjs.com/package/@jdevalk/astro-seo-graph)
[![license](https://img.shields.io/github/license/jdevalk/seo-graph)](./LICENSE)

> Agent-ready SEO for JavaScript. A pure schema.org JSON-LD graph builder plus
> an Astro integration, designed to be shared across frameworks and CMSes.

This monorepo ships two packages (plus a third consumer living elsewhere):

| Package                                                                      | Purpose                                                                                                                                     |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| [`@jdevalk/seo-graph-core`](./packages/seo-graph-core)                       | Pure, runtime-agnostic schema.org piece builders and graph assembler. Depends only on [`schema-dts`](https://github.com/google/schema-dts). |
| [`@jdevalk/astro-seo-graph`](./packages/astro-seo-graph)                     | Astro integration: `<Seo>` component, route factories for agent-ready endpoints, breadcrumb helper, Zod content helpers.                    |
| [`@jdevalk/emdash-plugin-seo`](https://github.com/jdevalk/emdash-plugin-seo) | EmDash CMS plugin. Lives in its own repo, depends on `seo-graph-core`.                                                                      |

## Documentation

See [AGENTS.md](./AGENTS.md) for the full reference: all builder signatures,
site-type recipes (blog, e-commerce, local business, docs, podcast, etc.),
and schema.org best practices. It's written for both humans and AI coding
agents.

## Why

Read more about [why this project exists](https://joost.blog/seo-graph/).

## Develop

```sh
pnpm install
pnpm typecheck
pnpm build
pnpm test
```

## Architecture notes

- **No page-type enum in core.** Core exposes piece builders. Dispatch lives in
  callers (joost.blog, EmDash, limonaia.house, …). This keeps the core's API
  surface small and avoids baking a specific content model into a shared lib.
- **`schema-dts` is the type substrate.** All builders accept schema.org
  properties at the top level with full autocomplete from `schema-dts`.
  `buildPiece<Product>` gives you every Product property typed; the `@type`
  value narrows union types to the matching leaf automatically.
- **Dedicated builders for non-trivial work.** Seven builders handle ID
  generation, date conversion, and transforms (`buildWebSite`, `buildWebPage`,
  `buildArticle`, `buildBreadcrumbList`, `buildImageObject`, `buildVideoObject`,
  `buildSiteNavigationElement`). Everything else — Person, Organization, Blog,
  Product, Recipe, Event, etc. — uses `buildPiece<Type>`.
- **Dangling reference validation.** `assembleGraph(pieces, { warnOnDanglingReferences: true })`
  warns when a `{ '@id': '...' }` reference doesn't resolve to any entity in
  the graph.
- **Breadcrumbs are an input, not a derivation.** Callers pre-compute the
  breadcrumb list. The Astro integration ships `breadcrumbsFromUrl` to
  derive crumbs from an `Astro.url`, but the core itself has no
  URL-parsing logic.

## License

MIT © Joost de Valk
