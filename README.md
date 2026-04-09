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
- [The silence is deafening: Google's agentic future leaves WordPress behind](https://joost.blog/deafening-silence-google-wordpress-agentic/)

## Roadmap

| Phase                           | Status   | Summary                                                                                                                                                   |
| ------------------------------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0 — Scaffold monorepo           | Done     | pnpm workspace, tsconfig base, changesets, CI, package skeletons.                                                                                         |
| 1 — `seo-graph-core` v0.1       | Done     | Ten piece builders, `makeIds`, `assembleGraph`, `deduplicateByGraphId`. 31 tests, including byte-identical integration test against a joost.blog fixture. |
| 2 — joost.blog core migration   | Done     | joost.blog consumes `seo-graph-core` through a thin adapter; schema endpoint output byte-identical to pre-migration fixtures.                             |
| 3 — `astro-seo-graph` v0.1      | Done     | `<Seo>`, `createSchemaEndpoint`, `createSchemaMap`, `aggregate`, Zod content helpers. 37 tests. `createOgRenderer` deferred to `0.2`.                     |
| 4 — limonaia.house migration    | Done     | First external consumer. `VacationRental` JSON-LD graph rendered via `<Seo>` with zero changes required to core or the integration.                       |
| 5 — joost.blog full integration | Done     | `BaseHead.astro` uses `<Seo>` from astro-seo-graph. Schema endpoints still byte-identical against golden fixtures.                                        |
| 6 — emdash-plugin-seo port      | Done     | `@jdevalk/emdash-plugin-seo@0.2.0` published; shares `assembleGraph` + `GraphEntity` type with the core, keeps its own EmDash-specific piece builders.    |
| 7 — `0.1.0` stable + blog post  | Shipping | Exit alpha, publish `0.1.0` on the `latest` dist tag. Write the positioning post on [joost.blog](https://joost.blog).                                     |

**Not yet:** `1.0.0` stable. The API has a few known warts (see each package's README "Known limitations" section). They'll be addressed in `0.2.x` without breaking changes. `1.0.0` comes when those are resolved and the API surface has been stable across a few minor releases.

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
