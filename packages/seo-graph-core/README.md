# @jdevalk/seo-graph-core

Pure schema.org JSON-LD graph builders. Runtime-agnostic core for agent-ready SEO.

> **Status:** pre-v1, scaffolding phase. No stable API yet. See the
> [roadmap](https://github.com/jdevalk/seo-graph#roadmap) in the monorepo root.

## What this is

A small, dependency-light library that builds a valid schema.org `@graph` from
a set of typed inputs. It does one thing: turn structured page data into
byte-correct JSON-LD that search engines and agents can consume.

It does **not** know anything about Astro, Next.js, EmDash, WordPress, or any
other runtime. Use `@jdevalk/astro-seo-graph` for the Astro integration, or
consume this directly from your own CMS/framework.

## Why

The [agent-ready web](https://joost.blog/tag/agent-ready/) needs every
publisher to expose a rich, linked knowledge graph for their content. Hand-
writing JSON-LD is error-prone; writing it once per framework is worse.
`@jdevalk/seo-graph-core` is the shared core that two real consumers — this
blog (Astro) and [`@jdevalk/emdash-plugin-seo`](https://www.npmjs.com/package/@jdevalk/emdash-plugin-seo)
(EmDash CMS) — will both depend on, so the graph they emit stays consistent.

## License

MIT © Joost de Valk
