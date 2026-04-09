# @jdevalk/astro-seo-graph

Astro integration for [`@jdevalk/seo-graph-core`](../seo-graph-core). Ships a
`<Seo>` component, route factories for agent-ready schema endpoints, a
content-collection aggregator, and Zod helpers for content schemas.

> **Status:** `0.1.0` (pre-1.0). The API works and has two real consumers
> in production (joost.blog and limonaia.house), but a few known warts in
> the core will be smoothed out in `0.2.x` without breaking changes. See
> `@jdevalk/seo-graph-core`'s README for the full list.

## What's in v0.1

| API                            | Purpose                                                                                                                                                                                                          |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`<Seo>`** (`./Seo.astro`)    | Single head component covering `<title>`, meta description, canonical, Open Graph, Twitter card, and optional JSON-LD `@graph`. Wraps [`astro-seo`](https://github.com/jonasmerlin/astro-seo) for the meta tags. |
| **`createSchemaEndpoint`**     | Factory returning an Astro `APIRoute` handler that serves a corpus-wide JSON-LD `@graph` for a content collection.                                                                                               |
| **`createSchemaMap`**          | Factory returning an `APIRoute` handler that emits a sitemap-style XML listing of your site's schema endpoints — the discovery point for agent crawlers.                                                         |
| **`aggregate`**                | Shared engine behind the endpoint factories. Walks a list of entries, runs a caller-supplied mapper, deduplicates by `@id`.                                                                                      |
| **`seoSchema`, `imageSchema`** | Zod schemas for the `seo` and `image` fields on content collections. Import them into `src/content.config.ts`.                                                                                                   |
| **`buildAstroSeoProps`**       | Pure-TS logic that powers `<Seo>` — exported for users who want to feed a different head component.                                                                                                              |

## Not in `0.1.x` (coming in `0.2.x`)

- **`createOgRenderer`** — a themeable `satori` + `sharp` wrapper for generating
  Open Graph images at build time. Pulled out of `0.1` to keep the dep tree
  free of native binaries. Keep using your own `og-image.ts` for now.

## Installation

```sh
pnpm add @jdevalk/astro-seo-graph @jdevalk/seo-graph-core
```

`@jdevalk/seo-graph-core` is a direct dep of this package so it's installed
transitively, but depending on it explicitly lets you pin the version and
import piece builders directly.

## `<Seo>` component

```astro
---
import Seo from '@jdevalk/astro-seo-graph/Seo.astro';
import { buildSchemaGraph } from '../utils/schema';

const graph = buildSchemaGraph({
    pageType: 'blogPost',
    canonicalUrl: Astro.url.href,
    title: 'My Post',
    description: '…',
    publishDate: new Date('2026-04-07'),
});
---

<html>
    <head>
        <Seo
            title="My Post"
            titleTemplate="%s | Example"
            description="…"
            ogType="article"
            ogImage="https://example.com/og/my-post.jpg"
            ogImageAlt="My Post"
            ogImageWidth={1200}
            ogImageHeight={675}
            siteName="Example"
            twitter={{ site: '@example', creator: '@author' }}
            article={{ publishedTime: new Date('2026-04-07'), tags: ['tech'] }}
            graph={graph}
            extraLinks={[
                { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
                { rel: 'sitemap', href: '/sitemap-index.xml' },
            ]}
        />
    </head>
    <body>...</body>
</html>
```

## Schema endpoints

```ts
// src/pages/schema/post.json.ts
import { getCollection } from 'astro:content';
import { createSchemaEndpoint } from '@jdevalk/astro-seo-graph';
import { buildArticle, buildWebPage, makeIds } from '@jdevalk/seo-graph-core';

const ids = makeIds({ siteUrl: 'https://example.com' });

export const GET = createSchemaEndpoint({
    entries: () => getCollection('blog'),
    mapper: (post) => {
        const url = `https://example.com/${post.id}/`;
        return [
            buildWebPage(
                {
                    url,
                    name: post.data.title,
                    isPartOf: { '@id': ids.website },
                    breadcrumb: { '@id': ids.breadcrumb(url) },
                    datePublished: post.data.publishDate,
                },
                ids,
            ),
            buildArticle(
                {
                    url,
                    isPartOf: { '@id': ids.webPage(url) },
                    author: { '@id': ids.person },
                    publisher: { '@id': ids.person },
                    headline: post.data.title,
                    description: post.data.excerpt ?? '',
                    datePublished: post.data.publishDate,
                },
                ids,
            ),
        ];
    },
});
```

## Schema map discovery

```ts
// src/pages/schemamap.xml.ts
import { createSchemaMap } from '@jdevalk/astro-seo-graph';

export const GET = createSchemaMap({
    siteUrl: 'https://example.com',
    entries: [
        { path: '/schema/post.json', lastModified: new Date('2026-04-07') },
        { path: '/schema/video.json', lastModified: new Date('2026-03-13') },
    ],
});
```

## Zod content helpers

```ts
// src/content.config.ts
import { defineCollection, z } from 'astro:content';
import { seoSchema } from '@jdevalk/astro-seo-graph';

const blog = defineCollection({
    schema: ({ image }) =>
        z.object({
            title: z.string(),
            publishDate: z.coerce.date(),
            seo: seoSchema(image).optional(),
        }),
});
```

## License

MIT © Joost de Valk
