# @jdevalk/astro-seo-graph

Astro integration for [`@jdevalk/seo-graph-core`](../seo-graph-core). Ships a
`<Seo>` component, route factories for agent-ready schema endpoints, a
themeable OG image renderer, and Zod content-collection helpers.

> **Status:** pre-v1, scaffolding phase. No stable API yet. See the
> [roadmap](https://github.com/jdevalk/seo-graph#roadmap) in the monorepo root.

## What this will ship (Phase 3)

- **`<Seo>`** — a single head component covering `<title>`, meta description,
  canonical link, Open Graph, Twitter Card, and an optional JSON-LD `@graph`.
- **`createSchemaEndpoint`** and **`createSchemaMap`** — factories for the
  agent-ready endpoints (`/schema/post.json`, `/schemamap.xml`, etc.) that
  publish a per-collection JSON-LD graph for agents to consume.
- **`createOgRenderer`** — neutral Satori+Sharp-based OG image helper where
  the caller owns the layout, fonts, and colors.
- **Zod content helpers** — `seoSchema` and `imageSchema` for
  `src/content.config.ts`.

## License

MIT © Joost de Valk
