# @jdevalk/seo-graph-core

Pure schema.org JSON-LD graph builders. Runtime-agnostic core for agent-ready SEO.

## What this is

A small, dependency-light library that builds a valid schema.org `@graph`
from a set of typed inputs. It does one thing: turn structured page data
into byte-correct JSON-LD that search engines and agents can consume.

It does **not** know anything about Astro, Next.js, EmDash, WordPress, or
any other runtime. Use [`@jdevalk/astro-seo-graph`](https://www.npmjs.com/package/@jdevalk/astro-seo-graph)
for the Astro integration, or consume this directly from your own CMS or
framework.

For detailed usage — including all builder signatures, site-type recipes, and
schema.org best practices — see [AGENTS.md](../../AGENTS.md) in the repository
root.

## Install

```sh
npm install @jdevalk/seo-graph-core
```

## What you get

### Graph assembly

| API | Purpose |
|---|---|
| `makeIds({ siteUrl, personUrl? })` | `IdFactory` for stable `@id` references across site-wide and per-page entities. |
| `assembleGraph(pieces)` | Wraps pieces in a `{ @context, @graph }` envelope with first-wins deduplication by `@id`. |
| `deduplicateByGraphId(entities)` | The dedup engine on its own, in case you need custom assembly. |

### Piece builders

All builders take an input object and the `IdFactory`, and return a plain
object with `@type` and `@id`. Builders for CreativeWork subtypes (`WebSite`,
`WebPage`, `Article`) share a common set of optional fields via
`CreativeWorkFields`: `description`, `inLanguage`, `datePublished`,
`dateModified`, `about`, `copyrightHolder`, `copyrightYear`,
`copyrightNotice`, `license`, and `isAccessibleForFree`.

| Builder | Schema.org type | Subtype parameter |
|---|---|---|
| `buildWebSite` | `WebSite` | — |
| `buildWebPage` | `WebPage` | `'WebPage'` \| `'ProfilePage'` \| `'CollectionPage'` |
| `buildArticle` | `Article` | `'Article'` \| `'BlogPosting'` \| `'NewsArticle'` \| `'TechArticle'` \| `'ScholarlyArticle'` \| `'Report'` |
| `buildPerson` | `Person` | — |
| `buildOrganization` | `Organization` | Any subtype string (e.g. `'Restaurant'`, `'LocalBusiness'`) |
| `buildBreadcrumbList` | `BreadcrumbList` | — |
| `buildImageObject` | `ImageObject` | — |
| `buildVideoObject` | `VideoObject` | — |
| `buildSiteNavigationElement` | `SiteNavigationElement` | — |
| `buildCustomPiece` | Any | Pass `@type` directly in the input object |

Every builder accepts an `extra` escape hatch for schema.org properties not
covered by the typed interface.

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
            inLanguage: 'en-US',
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
            description: 'A post about something interesting.',
            datePublished: new Date('2026-04-07'),
        },
        ids,
        'BlogPosting',
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
