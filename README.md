# seo-graph

> Agent-ready SEO for JavaScript. A pure schema.org JSON-LD graph builder plus
> an Astro integration, designed to be shared across frameworks and CMSes.

This monorepo ships two packages (plus a third consumer living elsewhere):

| Package | Purpose |
|---|---|
| [`@jdevalk/seo-graph-core`](./packages/seo-graph-core) | Pure, runtime-agnostic schema.org piece builders and graph assembler. Depends only on [`schema-dts`](https://github.com/google/schema-dts). |
| [`@jdevalk/astro-seo-graph`](./packages/astro-seo-graph) | Astro integration: `<Seo>` component, route factories for agent-ready endpoints, breadcrumb helper, Zod content helpers. |
| [`@jdevalk/emdash-plugin-seo`](https://github.com/jdevalk/emdash-plugin-seo) | EmDash CMS plugin. Lives in its own repo, depends on `seo-graph-core`. |

## Documentation

See [AGENTS.md](./AGENTS.md) for the full reference: all builder signatures,
site-type recipes (blog, e-commerce, local business, docs, podcast, etc.),
and schema.org best practices. It's written for both humans and AI coding
agents.

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
- **Shared `CreativeWorkFields`.** Properties common to all `CreativeWork`
  subtypes (`description`, `inLanguage`, `datePublished`, `dateModified`,
  `about`, copyright/licensing fields) live in a single interface that
  `WebSiteInput`, `WebPageInput`, and `ArticleInput` extend.
- **Subtypes via parameter.** `buildWebPage`, `buildArticle`, and
  `buildOrganization` all accept a third argument for the concrete schema.org
  type (e.g. `'CollectionPage'`, `'BlogPosting'`, `'Restaurant'`). Defaults
  are the base type.
- **Breadcrumbs are an input, not a derivation.** Callers pre-compute the
  breadcrumb list. The Astro integration ships `breadcrumbsFromUrl` to
  derive crumbs from an `Astro.url`, but the core itself has no
  URL-parsing logic.

## License

MIT © Joost de Valk
