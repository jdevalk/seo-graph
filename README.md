# seo-graph

> Agent-ready SEO for JavaScript. A pure schema.org JSON-LD graph builder plus
> an Astro integration, designed to be shared across frameworks and CMSes.

This monorepo ships two packages (plus a third consumer living elsewhere):

| Package                                                                      | Purpose                                                                                                                                     |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| [`@jdevalk/seo-graph-core`](./packages/seo-graph-core)                       | Pure, runtime-agnostic schema.org piece builders and graph assembler. Depends only on [`schema-dts`](https://github.com/google/schema-dts). |
| [`@jdevalk/astro-seo-graph`](./packages/astro-seo-graph)                     | Astro integration: `<Seo>` component, route factories for agent-ready endpoints, themeable OG renderer, Zod content helpers.                |
| [`@jdevalk/emdash-plugin-seo`](https://github.com/jdevalk/emdash-plugin-seo) | EmDash CMS plugin. Lives in its own repo, will depend on `seo-graph-core`.                                                                  |

## Why

The agent-ready web needs publishers to expose a rich, linked JSON-LD graph.
Hand-writing it is error-prone; writing it once per framework is worse. This
project extracts the graph-building logic out of [joost.blog](https://joost.blog)
and [`@jdevalk/emdash-plugin-seo`](https://github.com/jdevalk/emdash-plugin-seo)
into a shared core so both consumers (and any future ones) stay byte-consistent.

The thesis is argued in more detail in these posts:

- [Defending the open web is not enough](https://joost.blog/defending-open-web-not-enough/)
- [From installation to integration: making plugins agent-ready](https://joost.blog/agent-ready-plugins/)
- [EmDash plugins are not locked to Cloudflare](https://joost.blog/emdash-plugins-not-locked-to-cloudflare/)
- [The silence is deafening: Google's agentic future leaves WordPress behind](https://joost.blog/deafening-silence-google-wordpress-agentic/)

## Roadmap

| Phase                           | Status          | Summary                                                                                                                                                                                              |
| ------------------------------- | --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0 — Scaffold monorepo           | **In progress** | pnpm workspace, tsconfig base, changesets, CI, package skeletons.                                                                                                                                    |
| 1 — `seo-graph-core` v0.1       | Pending         | Piece builders (article, webpage, website, breadcrumb, image, person, organization, video, navigation, custom), `makeIds`, `assembleGraph`, `deduplicateByGraphId`. Unit tests with golden fixtures. |
| 2 — joost.blog migration        | Pending         | Replace joost.blog's local schema pieces with core imports. Regression-diff against captured fixtures.                                                                                               |
| 3 — `astro-seo-graph` v0.1      | Pending         | `<Seo>` component, `createSchemaEndpoint` + `createSchemaMap` factories, aggregator, `createOgRenderer`, Zod content helpers, integration wiring.                                                    |
| 4 — limonaia.house migration    | Pending         | First external consumer. Add JSON-LD (`LodgingBusiness`) to a primitive Astro site. If the abstraction needs to change for this, the design is wrong.                                                |
| 5 — joost.blog full integration | Pending         | joost.blog migrates from core-only to the full integration. Drop local aggregator and route code.                                                                                                    |
| 6 — emdash-plugin-seo port      | Pending         | `@jdevalk/emdash-plugin-seo` delegates to `seo-graph-core`. Gains four pieces it currently lacks (breadcrumb, image, video, navigation).                                                             |
| 7 — v1.0 + positioning post     | Pending         | Tag v1.0.0 across all three packages. Publish _"Agent-ready SEO, the same way on Astro and EmDash"_ on joost.blog.                                                                                   |

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
- **`schema-dts` is the type substrate.** All piece builders return strongly-
  typed schema.org values. Every `Organization` and `LocalBusiness` subtype is
  already typed; the core doesn't hand-maintain a subtype list.
- **Breadcrumbs are an input, not a derivation.** Callers pre-compute the
  breadcrumb list. The Astro integration will ship an optional helper that
  derives breadcrumbs from an `Astro.url`, but it's not in core.

## License

MIT © Joost de Valk
