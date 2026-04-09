# @jdevalk/astro-seo-graph

Astro integration for [`@jdevalk/seo-graph-core`](../seo-graph-core). Ships a
`<Seo>` component, route factories for agent-ready schema endpoints, a
content-collection aggregator, and Zod helpers for content schemas.

> **Status:** `0.1.0` (pre-1.0). The API works and has two real consumers
> in production (joost.blog and limonaia.house), but a few known warts in
> the core will be smoothed out in `0.2.x` without breaking changes. See
> `@jdevalk/seo-graph-core`'s README for the full list.

## What's in v0.1

| API                            | Purpose                                                                                                                                                                                                                                                                 |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`<Seo>`** (`./Seo.astro`)    | Single head component covering `<title>`, meta description, canonical, Open Graph, Twitter card, hreflang alternates, and optional JSON-LD `@graph`. Wraps [`astro-seo`](https://github.com/jonasmerlin/astro-seo) for the meta tags.                                   |
| **`createSchemaEndpoint`**     | Factory returning an Astro `APIRoute` handler that serves a corpus-wide JSON-LD `@graph` for a content collection.                                                                                                                                                      |
| **`createSchemaMap`**          | Factory returning an `APIRoute` handler that emits a sitemap-style XML listing of your site's schema endpoints — the discovery point for agent crawlers.                                                                                                                |
| **`aggregate`**                | Shared engine behind the endpoint factories. Walks a list of entries, runs a caller-supplied mapper, deduplicates by `@id`.                                                                                                                                             |
| **`seoSchema`, `imageSchema`** | Zod schemas for the `seo` and `image` fields on content collections. Import them into `src/content.config.ts`.                                                                                                                                                          |
| **`buildAstroSeoProps`**       | Pure-TS logic that powers `<Seo>` — exported for users who want to feed a different head component.                                                                                                                                                                     |
| **`buildAlternateLinks`**      | Pure helper that turns a `{ hreflang, href }` entry list into normalized `<link rel="alternate">` tags plus an `x-default`. Used internally by `<Seo>`'s `alternates` prop, and exported for non-Astro callers (e.g. CMS plugins feeding their own metadata pipelines). |

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

## hreflang alternates

For multilingual sites, pass an `alternates` prop with one entry per locale.
`<Seo>` emits a `<link rel="alternate">` for every entry plus an
`x-default`, normalizes BCP 47 tags on the way out, and drops entries with
relative or non-http(s) URLs.

```astro
---
import Seo from '@jdevalk/astro-seo-graph/Seo.astro';
---

<Seo
    title="Hello"
    alternates={{
        defaultLocale: 'en',
        entries: [
            { hreflang: 'en',    href: 'https://example.com/hello/' },
            { hreflang: 'fr-CA', href: 'https://example.com/fr-ca/bonjour/' },
            { hreflang: 'nl',    href: 'https://example.com/nl/hallo/' },
        ],
    }}
/>
```

Renders roughly:

```html
<link rel="alternate" hreflang="en" href="https://example.com/hello/" />
<link rel="alternate" hreflang="fr-CA" href="https://example.com/fr-ca/bonjour/" />
<link rel="alternate" hreflang="nl" href="https://example.com/nl/hallo/" />
<link rel="alternate" hreflang="x-default" href="https://example.com/hello/" />
```

### Rules

- **Absolute URLs only.** Relative (`/hello/`), protocol-relative (`//…`), and non-http schemes (`mailto:`) are dropped silently.
- **Include the current page.** Google treats self-referential hreflang as required, not optional.
- **BCP 47 normalization.** `fr-ca` becomes `fr-CA`, `zh-hant-hk` becomes `zh-Hant-HK`. Language subtag lowercase, script subtag title-case, region subtag uppercase.
- **First entry wins.** Duplicate normalized tags are collapsed to the first one.
- **Automatic `x-default`.** Points at `defaultLocale` if it matches an entry; otherwise falls back to the first entry.
- **< 2 entries → nothing emitted.** A single-locale page has no meaningful alternates.
- **`"x-default"` is reserved.** Passing it as an input `hreflang` gets dropped; it's only ever added automatically.

### Feeding `buildAlternateLinks` from other renderers

If you're not using `<Seo>` directly (e.g. you're writing a CMS plugin that
contributes to its own metadata pipeline), import `buildAlternateLinks` from
the main package entry:

```ts
import { buildAlternateLinks } from '@jdevalk/astro-seo-graph';

const links = buildAlternateLinks({
    defaultLocale: 'en',
    entries: [
        { hreflang: 'en', href: siteEn },
        { hreflang: 'fr', href: siteFr },
    ],
});
// → [{ rel: 'alternate', hreflang: 'en', href: ... }, ..., { hreflang: 'x-default', ... }]
```

The main package entry is pure TypeScript — importing `buildAlternateLinks`
does not pull in any Astro runtime, so it's safe to use from non-Astro
contexts.

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
