# @jdevalk/seo-graph-core

Pure schema.org JSON-LD graph builders. Runtime-agnostic core for agent-ready SEO.

> **Status:** `0.1.0` (pre-1.0). The API works and has three real consumers
> in production, but a few known warts (listed below) will be smoothed out in
> `0.2.x` without breaking changes before a stable `1.0`.

## What this is

A small, dependency-light library that builds a valid schema.org `@graph`
from a set of typed inputs. It does one thing: turn structured page data
into byte-correct JSON-LD that search engines and agents can consume.

It does **not** know anything about Astro, Next.js, EmDash, WordPress, or
any other runtime. Use [`@jdevalk/astro-seo-graph`](https://www.npmjs.com/package/@jdevalk/astro-seo-graph)
for the Astro integration, or consume this directly from your own CMS or
framework.

## Install

```sh
npm install @jdevalk/seo-graph-core
```

## What you get

| API                                                                                                                                                                                                 | Purpose                                                                                   |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `makeIds({ siteUrl, personUrl? })`                                                                                                                                                                  | `IdFactory` for stable `@id` references across site-wide and per-page entities.           |
| `assembleGraph(pieces)`                                                                                                                                                                             | Wraps pieces in a `{ @context, @graph }` envelope with first-wins deduplication by `@id`. |
| `deduplicateByGraphId(entities)`                                                                                                                                                                    | The dedup engine on its own, in case you need custom assembly.                            |
| `buildArticle`, `buildWebPage`, `buildWebSite`, `buildBreadcrumbList`, `buildImageObject`, `buildPerson`, `buildOrganization`, `buildVideoObject`, `buildSiteNavigationElement`, `buildCustomPiece` | Piece builders. All return schema-dts typed objects.                                      |

## Usage

```ts
import {
    makeIds,
    assembleGraph,
    buildWebSite,
    buildArticle,
    buildWebPage,
    buildBreadcrumbList,
} from '@jdevalk/seo-graph-core';

const ids = makeIds({ siteUrl: 'https://example.com' });
const url = 'https://example.com/my-post/';

const graph = assembleGraph([
    buildWebSite(
        {
            url: 'https://example.com/',
            name: 'Example',
            publisher: { '@id': ids.person },
        },
        ids,
    ),
    buildWebPage(
        {
            url,
            name: 'My Post',
            isPartOf: { '@id': ids.website },
            breadcrumb: { '@id': ids.breadcrumb(url) },
            datePublished: new Date('2026-04-07'),
        },
        ids,
    ),
    buildArticle(
        {
            url,
            isPartOf: { '@id': ids.webPage(url) },
            author: { '@id': ids.person },
            publisher: { '@id': ids.person },
            headline: 'My Post',
            description: '…',
            datePublished: new Date('2026-04-07'),
        },
        ids,
    ),
    buildBreadcrumbList(
        {
            url,
            items: [
                { name: 'Home', url: 'https://example.com/' },
                { name: 'My Post', url },
            ],
        },
        ids,
    ),
]);

// graph === { '@context': 'https://schema.org', '@graph': [...] }
```

## Why

The [agent-ready web](https://joost.blog/tag/agent-ready/) needs every
publisher to expose a rich, linked knowledge graph for their content. Hand-
writing JSON-LD is error-prone; writing it once per framework is worse.
`@jdevalk/seo-graph-core` is the shared engine behind two downstream packages,
both in production:

- [`@jdevalk/astro-seo-graph`](https://www.npmjs.com/package/@jdevalk/astro-seo-graph) — the Astro integration (`<Seo>` + route factories). Used in production by [joost.blog](https://joost.blog) and [limonaia.house](https://limonaia.house).
- [`@jdevalk/emdash-plugin-seo`](https://www.npmjs.com/package/@jdevalk/emdash-plugin-seo) — the EmDash CMS plugin. Uses `assembleGraph` directly (EmDash contributes metadata through hooks, not through templates, so it doesn't go through the `<Seo>` component).

Two different integration runtimes, one graph engine.

## License

MIT © Joost de Valk
