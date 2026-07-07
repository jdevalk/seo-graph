# @jdevalk/seo-graph-core

[![npm version](https://img.shields.io/npm/v/@jdevalk/seo-graph-core)](https://www.npmjs.com/package/@jdevalk/seo-graph-core)
[![license](https://img.shields.io/npm/l/@jdevalk/seo-graph-core)](https://github.com/jdevalk/seo-graph/blob/main/LICENSE)

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
schema.org best practices — see [AGENTS.md](https://github.com/jdevalk/seo-graph/blob/main/AGENTS.md).

## Install

```sh
npm install @jdevalk/seo-graph-core
```

## What you get

### Graph assembly

| API                                | Purpose                                                                                   |
| ---------------------------------- | ----------------------------------------------------------------------------------------- |
| `makeIds({ siteUrl, personUrl? })` | `IdFactory` for stable `@id` references across site-wide and per-page entities.           |
| `assembleGraph(pieces)`            | Wraps pieces in a `{ @context, @graph }` envelope with first-wins deduplication by `@id`. |
| `deduplicateByGraphId(entities)`   | The dedup engine on its own, in case you need custom assembly.                            |

Pass `{ warnOnDanglingReferences: true }` to `assembleGraph` to emit a
console warning when any `{ '@id': '...' }` reference doesn't resolve to
an entity in the graph — a cheap sanity check to catch typos and
missing pieces during development.

### IndexNow

| API                         | Purpose                                                                        |
| --------------------------- | ------------------------------------------------------------------------------ |
| `submitToIndexNow`          | POST URLs to the IndexNow aggregator. Filters by host, dedupes, chunks at 10k. |
| `generateIndexNowKey`       | Generate a random hex key (Web Crypto).                                        |
| `validateIndexNowKey`       | Verify a key is 8–128 chars from `[A-Za-z0-9-]` (IndexNow spec allow-list).    |
| `getIndexNowKeyFileContent` | Body to serve at `/<key>.txt` for host verification.                           |

### Piece builders

The dedicated builders take an input object and the `IdFactory`, and return a
plain object with `@type` and `@id`. `buildPiece` is the exception: it takes
only the input object — pass `@id` and `@type` inline in that object. Builders
for CreativeWork subtypes (`WebSite`,
`WebPage`, `Article`) share a common set of optional fields via
`CreativeWorkFields`: `description`, `inLanguage`, `datePublished`,
`dateModified`, `about`, `copyrightHolder`, `copyrightYear`,
`copyrightNotice`, `license`, and `isAccessibleForFree`.

| Builder                      | Schema.org type         | Subtype parameter                                                                                          |
| ---------------------------- | ----------------------- | ---------------------------------------------------------------------------------------------------------- |
| `buildWebSite`               | `WebSite`               | —                                                                                                          |
| `buildWebPage`               | `WebPage`               | `'WebPage'` \| `'ProfilePage'` \| `'CollectionPage'`                                                       |
| `buildArticle`               | `Article`               | `'Article'` \| `'BlogPosting'` \| `'NewsArticle'` \| `'TechArticle'` \| `'ScholarlyArticle'` \| `'Report'` |
| `buildBreadcrumbList`        | `BreadcrumbList`        | —                                                                                                          |
| `buildImageObject`           | `ImageObject`           | —                                                                                                          |
| `buildVideoObject`           | `VideoObject`           | —                                                                                                          |
| `buildSiteNavigationElement` | `SiteNavigationElement` | —                                                                                                          |
| `buildPiece`                 | Any                     | `schema-dts` generic for autocomplete (e.g. `buildPiece<Product>`, `buildPiece<Person>`)                   |

All schema.org properties are accepted at the top level with full autocomplete
from `schema-dts`. Dedicated builders handle ID generation, date conversion,
and non-trivial transforms. Use `buildPiece<Type>` for everything else
(Person, Organization, Blog, Product, Recipe, Event, etc.).

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

## IndexNow

Runtime-agnostic helpers for the [IndexNow](https://www.indexnow.org) protocol.
Submit URLs to participating search engines (Bing, Yandex, Seznam, Naver, Yep)
through the neutral aggregator at `api.indexnow.org`.

```ts
import {
    generateIndexNowKey,
    getIndexNowKeyFileContent,
    submitToIndexNow,
    validateIndexNowKey,
} from '@jdevalk/seo-graph-core';

const key = generateIndexNowKey(); // 32-char hex, persist this

// Serve this body at https://example.com/<key>.txt
const keyFileBody = getIndexNowKeyFileContent(key);

const results = await submitToIndexNow({
    host: 'example.com',
    key,
    urls: ['https://example.com/blog/new-post/'],
});
```

URLs not on `host` and duplicates are filtered automatically. Bulk submissions
are chunked at 10,000 URLs per request. `submitToIndexNow` never throws on
network errors — it returns one result per chunk with `ok`, `status`, and
`message`. Pass `endpoint` to override the default aggregator, `keyLocation`
to point at a non-default key-file path, or `fetch` for testing.

> **Deploy the key file before submitting.** IndexNow verifies host
> ownership by fetching `https://<host>/<key>.txt` (or `keyLocation`)
> on every call. Submissions sent before the file is publicly reachable
> are rejected with HTTP 403 and the key is marked invalid — rotate
> with `generateIndexNowKey()` if that happens.

## Why

Read more about [why this project exists](https://joost.blog/seo-graph/).

## License

MIT © Joost de Valk
