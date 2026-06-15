# @jdevalk/astro-seo-graph

[![npm version](https://img.shields.io/npm/v/@jdevalk/astro-seo-graph)](https://www.npmjs.com/package/@jdevalk/astro-seo-graph)
[![license](https://img.shields.io/npm/l/@jdevalk/astro-seo-graph)](https://github.com/jdevalk/seo-graph/blob/main/LICENSE)

Astro integration for [`@jdevalk/seo-graph-core`](../seo-graph-core). Ships a
`<Seo>` component, route factories for agent-ready schema endpoints, a
content-collection aggregator, breadcrumb helpers, a fuzzy 404 redirect
component, and Zod helpers for content schemas.

For detailed usage — including all builder signatures, site-type recipes, and
schema.org best practices — see [AGENTS.md](https://github.com/jdevalk/seo-graph/blob/main/AGENTS.md).

> **Using an AI coding assistant?** The [`astro-seo` skill](https://github.com/jdevalk/skills/tree/main/astro-seo)
> audits and improves the full SEO setup of an Astro site — technical
> foundation, structured data, sitemaps, IndexNow, agent discovery, and
> more — and produces drop-in code routed through this package.

## What you get

| API                            | Purpose                                                                                                                                                                                                                                                                 |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`<Seo>`** (`./Seo.astro`)    | Single head component covering `<title>`, meta description, canonical, Open Graph, Twitter card, hreflang alternates, and optional JSON-LD `@graph`. Wraps [`astro-seo`](https://github.com/jonasmerlin/astro-seo) for the meta tags.                                   |
| **`createSchemaEndpoint`**     | Factory returning an Astro `APIRoute` handler that serves a corpus-wide JSON-LD `@graph` for a content collection.                                                                                                                                                      |
| **`createSchemaMap`**          | Factory returning an `APIRoute` handler that emits a sitemap-style XML listing of your site's schema endpoints — the discovery point for agent crawlers.                                                                                                                |
| **`aggregate`**                | Shared engine behind the endpoint factories. Walks a list of entries, runs a caller-supplied mapper, deduplicates by `@id`.                                                                                                                                             |
| **`seoSchema`, `imageSchema`** | Zod schemas for the `seo` and `image` fields on content collections. Import them into `src/content.config.ts`.                                                                                                                                                          |
| **`buildSeoContext`**          | Pure-TS logic that powers `<Seo>` — returns a flat, normalized projection of `SeoProps` (resolved title, canonical, OG fields, hreflang entries, robots directives). Exported for users who want to render the head themselves.                                         |
| **`buildAlternateLinks`**      | Pure helper that turns a `{ hreflang, href }` entry list into normalized `<link rel="alternate">` tags plus an `x-default`. Used internally by `<Seo>`'s `alternates` prop, and exported for non-Astro callers (e.g. CMS plugins feeding their own metadata pipelines). |
| **`breadcrumbsFromUrl`**       | Derives a breadcrumb trail from an Astro URL. Splits path segments, supports custom display names and segment skipping. Returns `BreadcrumbItem[]` ready to pass to `buildBreadcrumbList`.                                                                              |
| **`<FuzzyRedirect>`**          | Drop-in 404 component. Fetches your sitemap, fuzzy-matches the current URL against known paths, and suggests or auto-redirects to the closest match.                                                                                                                    |
| **`createIndexNowKeyRoute`**   | Factory returning an `APIRoute` that serves the IndexNow key-verification file at `/<key>.txt`. Pair with the `indexNow` option on the integration to auto-submit built URLs on `astro:build:done`.                                                                     |
| **`createMarkdownEndpoint`**   | Factory returning an `APIRoute` that serves a clean markdown version of a content-collection entry (frontmatter + body + token count). Pair with the auto-emitted `<link rel="alternate" type="text/markdown">` on `<Seo>` for AI-agent discovery.                      |
| **`renderMarkdownAlternate`**  | Pure renderer behind the endpoint. Importable from non-Astro code for the same markdown output.                                                                                                                                                                         |
| **`gitLastmod`**               | Reads the committer date of the most recent git commit that touched a file, skipping caller-supplied bulk commits. Use it to derive trustworthy `dateModified` / `<lastmod>` values from git history.                                                                   |
| **`createApiCatalog`**         | Factory returning an `APIRoute` that serves an [RFC 9727](https://www.rfc-editor.org/rfc/rfc9727) API catalog at `/.well-known/api-catalog`. Lists schema endpoints, the schema map, and any additional APIs as `application/linkset+json`.                             |

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

### Props

All props are optional except `title`.

| Prop                  | Type                                            | Default                     | Description                                                                                             |
| --------------------- | ----------------------------------------------- | --------------------------- | ------------------------------------------------------------------------------------------------------- |
| `title`               | `string`                                        | —                           | Page title. **Required.**                                                                               |
| `titleTemplate`       | `string`                                        | raw `title`                 | Template for the full `<title>`; `%s` is replaced with `title` (e.g. `"%s \| Joost.blog"`).             |
| `description`         | `string`                                        | —                           | Meta description.                                                                                       |
| `canonical`           | `string \| URL`                                 | current URL, query stripped | Explicit canonical override. Omitted entirely when `noindex`.                                           |
| `preserveQueryParams` | `boolean`                                       | `false`                     | Keep the query string on the default canonical. No effect when `canonical` is set.                      |
| `ogType`              | `'website' \| 'article' \| 'profile' \| 'book'` | `'website'`                 | Open Graph type.                                                                                        |
| `ogImage`             | `string`                                        | —                           | Absolute URL of the share image.                                                                        |
| `ogImageAlt`          | `string`                                        | —                           | Alt text for the share image.                                                                           |
| `ogImageWidth`        | `number`                                        | —                           | Share image width in pixels.                                                                            |
| `ogImageHeight`       | `number`                                        | —                           | Share image height in pixels.                                                                           |
| `siteName`            | `string`                                        | —                           | Site name shown in OG tags.                                                                             |
| `locale`              | `string`                                        | `'en_US'`                   | OG locale.                                                                                              |
| `twitter`             | `object`                                        | —                           | Twitter card metadata — see [below](#twitter-and-article-sub-objects).                                  |
| `article`             | `object`                                        | —                           | Article OG metadata — see [below](#twitter-and-article-sub-objects). Only when `ogType` is `'article'`. |
| `noindex`             | `boolean`                                       | `false`                     | Emit `noindex` in the robots meta (also drops the canonical).                                           |
| `nofollow`            | `boolean`                                       | `false`                     | Emit `nofollow` in the robots meta.                                                                     |
| `articlePublisher`    | `string`                                        | —                           | Facebook page URL; emitted as `article:publisher` when `ogType` is `'article'`.                         |
| `author`              | `string`                                        | `article.authors[0]`        | Value for `<meta name="author">`.                                                                       |
| `graph`               | `Record<string, unknown> \| null`               | —                           | JSON-LD `@graph` to inject as `<script type="application/ld+json">`. `null`/omit skips it.              |
| `extraLinks`          | `Array<Record<string, string>>`                 | —                           | Extra `<link>` tags (icons, sitemap, RSS alternate, …).                                                 |
| `extraMeta`           | `Array<Record<string, string>>`                 | —                           | Extra `<meta>` tags.                                                                                    |
| `alternates`          | `BuildAlternateLinksInput`                      | —                           | hreflang alternate-language annotations — see [hreflang alternates](#hreflang-alternates).              |

#### `twitter` and `article` sub-objects

`twitter` (all fields optional): `site`, `creator`,
`card` (`'summary' \| 'summary_large_image' \| 'app' \| 'player'`, default
`'summary_large_image'`), `title`, `description`, `image`, `imageAlt`. The four
content fields fall back to their `og:` counterparts when omitted — see the
Twitter tag dedup note below.

`article` (all fields optional; emitted only when `ogType` is `'article'`):
`publishedTime`, `modifiedTime`, `expirationTime` (`Date \| string`), `authors`
(`string[]`), `tags` (`string[]`), `section`.

### `<Seo>` behavior notes

- **Robots defaults.** `max-snippet:-1`, `max-image-preview:large`, and
  `max-video-preview:-1` are always emitted alongside any `noindex` /
  `nofollow` directives, matching the Yoast-style defaults for maximum
  snippet sizes.
- **Canonical + noindex.** When `noindex` is true the canonical link is
  omitted per Google's recommendation.
- **Query params.** Canonical URLs strip query parameters by default. Pass
  `preserveQueryParams` to keep them.
- **Twitter tag dedup.** `twitter:title`, `twitter:description`,
  `twitter:image`, and `twitter:image:alt` are only emitted when the
  caller explicitly overrides them via `twitter.title` / `description` /
  `image` / `imageAlt`. Otherwise Twitter falls back to the `og:`
  counterparts automatically.
- **`og:locale:alternate`.** Emitted automatically from the `alternates`
  prop on multilingual pages.
- **Author / publisher.** Pass `author` for `<meta name="author">` (falls
  back to `article.authors[0]`); pass `articlePublisher` for the
  `article:publisher` Facebook URL.

## Breadcrumbs from URL

Derive a breadcrumb trail from an Astro page URL instead of computing it
manually:

```ts
import { breadcrumbsFromUrl } from '@jdevalk/astro-seo-graph';
import { buildBreadcrumbList, makeIds } from '@jdevalk/seo-graph-core';

const ids = makeIds({ siteUrl: 'https://example.com' });
const url = 'https://example.com/blog/open-source/my-post/';

const items = breadcrumbsFromUrl({
    url: Astro.url, // or any URL / string
    siteUrl: 'https://example.com',
    pageName: 'My Post', // display name for the current page
    // homeName: 'Home',                     // optional, defaults to 'Home'
    // names: { blog: 'Articles' },          // optional, custom segment names
    // skip: ['category'],                   // optional, segments to omit
});

const breadcrumb = buildBreadcrumbList({ url, items }, ids);
// items === [
//   { name: 'Home', url: 'https://example.com/' },
//   { name: 'Blog', url: 'https://example.com/blog/' },
//   { name: 'Open Source', url: 'https://example.com/blog/open-source/' },
//   { name: 'My Post', url: 'https://example.com/blog/open-source/my-post/' },
// ]
```

Segments without a `names` entry are title-cased from their slug
(`open-source` → `Open Source`). Sites with a base path
(e.g. `https://example.com/docs`) are supported — pass the base path as part
of `siteUrl`.

## Fuzzy 404 redirect

When a visitor hits a 404, `<FuzzyRedirect>` fetches your sitemap, compares
the mistyped URL against all known paths, and either suggests the closest
match or auto-redirects. Drop it into your `404.astro` page:

```astro
---
// src/pages/404.astro
import FuzzyRedirect from '@jdevalk/astro-seo-graph/FuzzyRedirect.astro';
---

<html lang="en">
    <head>
        <meta charset="utf-8" />
        <title>Page not found</title>
    </head>
    <body>
        <h1>Page not found</h1>
        <p>Sorry, the page you're looking for doesn't exist.</p>
        <p style="font-size: 1.25em; font-weight: bold;">
            <FuzzyRedirect />
        </p>
        <p><a href="/">Go to the homepage</a></p>
    </body>
</html>
```

When a close match is found, the component renders a message like
**Did you mean [/seo-graph/](/seo-graph/)?** inside the element where
you place it. Style the surrounding element to make it prominent.

### How it works

1. Fetches `/sitemap-index.xml` (follows sitemap index → child sitemaps)
2. Extracts all paths and computes
   [Levenshtein similarity](https://en.wikipedia.org/wiki/Levenshtein_distance)
   against the current URL
3. **0.6–0.85 similarity**: shows "Did you mean /correct-path/?"
4. **Above 0.85**: auto-redirects with `window.location.replace`
5. **Below 0.6 or exact match**: does nothing

### Props

| Prop                    | Default                | Description                                        |
| ----------------------- | ---------------------- | -------------------------------------------------- |
| `threshold`             | `0.6`                  | Minimum similarity for a suggestion to appear      |
| `autoRedirectThreshold` | `0.85`                 | Similarity above which the user is auto-redirected |
| `sitemapUrl`            | `'/sitemap-index.xml'` | URL of the sitemap index or sitemap file           |
| `suggestionText`        | `'Did you mean'`       | Text shown before the suggested link               |

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
                'BlogPosting',
            ),
        ];
    },
});
```

## Markdown alternate

Serve a markdown version of every page at a parallel `.md` URL so AI agents (Claude, ChatGPT, Perplexity, Cloudflare's AI crawlers) can consume your content without HTML parsing. `<Seo>` auto-emits `<link rel="alternate" type="text/markdown" href="…">` on every page so agents discover it.

### 1. Create the endpoint

```ts
// src/pages/blog/[...slug].md.ts
import { getCollection } from 'astro:content';
import { createMarkdownEndpoint } from '@jdevalk/astro-seo-graph';

export const getStaticPaths = async () => {
    const posts = await getCollection('blog');
    return posts.map((p) => ({ params: { slug: p.id } }));
};

export const GET = createMarkdownEndpoint({
    entries: () => getCollection('blog'),
    // The slug-match guard below is required. Without it the first
    // entry whose `mapper` returns non-null wins for *every* URL — a
    // silent bug that produces a 200 with wrong content.
    mapper: (post, slug) =>
        post.id !== slug
            ? null
            : {
                  frontmatter: {
                      title: post.data.title,
                      canonical: `https://example.com/blog/${post.id}/`,
                      pubDate: post.data.publishDate,
                      author: post.data.author,
                      description: post.data.excerpt,
                      tags: post.data.tags,
                  },
                  body: post.body ?? '',
              },
});
```

Response headers:

- `Content-Type: text/markdown; charset=utf-8`
- `Cache-Control: max-age=300`
- `X-Robots-Tag: noindex, follow` — the `.md` is a representation, not a separately indexable page.
- `X-Markdown-Tokens: <n>` — rough estimate (`chars/4`); swap in a real tokenizer via `estimateTokens` for accuracy.
- `Link: <canonical>; rel="canonical"` — points crawlers at the HTML.

### 2. Discovery link (opt-in)

Once the endpoint is in place, enable the discovery link on the integration:

```ts
// astro.config.mjs
seoGraph({ markdownAlternate: true });
```

`<Seo>` then emits `<link rel="alternate" type="text/markdown" href="…">` on every page, with `href` derived from the canonical URL (e.g. `/blog/post/` → `/blog/post.md`). Default is `false` — enable it only after the endpoint is live, or the link will 404.

After the build, the integration walks the output directory and strips any link whose target `.md` isn't on disk, with a per-occurrence `warn` so misconfigured endpoints stay visible. SSR users whose `.md` endpoints aren't prerendered should leave this off and emit the link themselves — the verification will otherwise strip every link.

### 3. `Accept: text/markdown` content negotiation (Cloudflare)

Static sites can still honour `Accept: text/markdown` by adding a **Cloudflare Transform Rule** — no SSR, no middleware, dashboard-configured, and works on the free plan (`regex_replace` is paid-only; the rule below uses `wildcard_replace` instead).

**Rewrite URL rule** (assumes trailing-slash canonical URLs, e.g. `/blog/post/`):

```
When incoming requests match:
  http.request.headers["accept"][0] contains "text/markdown"
  and ends_with(http.request.uri.path, "/")
  and not starts_with(http.request.uri.path, "/_")
  and not starts_with(http.request.uri.path, "/api/")

Then rewrite URI path (dynamic):
  wildcard_replace(http.request.uri.path, "*/", "${1}.md")
```

Turns `/blog/post/` → `/blog/post.md` before the cache lookup, so HTML and markdown end up under different cache keys automatically.

**Do not bother with a `Vary: Accept` response header rule.** Cloudflare strips custom `Vary` values at the edge (they conflict with CF's own cache model), so the rule won't take effect. It's unnecessary anyway — the URL rewrite already separates cache entries per content type.

Sites using extensionless URLs without a trailing slash need a separate rule: match `not ends_with(…, "/")` and rewrite to `concat(http.request.uri.path, ".md")`.

### Using the renderer directly

`renderMarkdownAlternate` is a pure function — importable from non-Astro code (build scripts, EmDash plugins) for the same frontmatter + body + token-count output:

```ts
import { renderMarkdownAlternate } from '@jdevalk/astro-seo-graph';

const { markdown, tokenCount, canonicalHref } = renderMarkdownAlternate({
    frontmatter: { title: 'Hello', canonical: 'https://example.com/hello/' },
    body: '# Hello\n\nWorld.',
});
```

## Last-modified dates from git

`gitLastmod` reads the committer date of the most recent git commit that
touched a file. Use it to feed `dateModified` on JSON-LD pieces or
`<lastmod>` in sitemaps without trusting filesystem `mtime` (which gets
rewritten on every CI checkout).

```ts
import { gitLastmod } from '@jdevalk/astro-seo-graph';

const last = gitLastmod(`src/content/blog/${entry.id}/index.md`, {
    // Hashes of bulk commits (imports, reformats, renames) that
    // shouldn't count as a "real" content update. Short or full SHAs.
    excludeCommits: ['52130a9', '989dc47'],
    // How many commits back to inspect. Default: 10.
    depth: 20,
});
```

Returns `null` when the file has no git history, when git isn't on the
PATH, or when every commit in the inspected window is excluded — callers
should fall back to `publishDate` (or skip the field) in that case.

`excludeCommits` matches on the first 7 characters of the SHA, so short
hashes from `git log --oneline` work directly. Increase `depth` if your
exclusion list could shadow the real last-modified commit; the default
of 10 is enough for most blogs.

A common pattern is to use `gitLastmod` to compute an effective
"updated" date only when it materially differs from the publish date:

```ts
function computeUpdatedDate(filePath: string, publishDate: Date): Date | null {
    const last = gitLastmod(filePath);
    if (!last) return null;
    const ONE_DAY = 24 * 60 * 60 * 1000;
    return last.getTime() - publishDate.getTime() > ONE_DAY ? last : null;
}
```

`gitLastmod` shells out to the `git` binary, so it only works during
build (Node) — not in browser bundles or edge runtimes that lack
`child_process`. Resolve the path relative to your build CWD.

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

## API catalog (RFC 9727)

[RFC 9727](https://www.rfc-editor.org/rfc/rfc9727) defines
`/.well-known/api-catalog` as the standard discovery point for a site's
APIs. `createApiCatalog` returns an `APIRoute` that serves an
`application/linkset+json` document ([RFC 9264](https://www.rfc-editor.org/rfc/rfc9264))
listing each endpoint with its anchor URL, optional documentation
links, and optional type pointers.

```ts
// src/pages/.well-known/api-catalog.ts
import { createApiCatalog } from '@jdevalk/astro-seo-graph';

export const GET = createApiCatalog({
    siteUrl: 'https://example.com',
    schemaEndpoints: [
        { path: '/schema/post.json', schemaType: 'BlogPosting', serviceDoc: '/seo-graph/' },
        { path: '/schema/page.json', schemaType: 'WebPage', serviceDoc: '/seo-graph/' },
    ],
    schemaMap: { path: '/schemamap.xml', serviceDoc: '/seo-graph/' },
    additional: [
        {
            anchor: '/ask',
            serviceDoc: '/ask-docs/',
            type: 'https://schema.org/SearchAction',
        },
    ],
});
```

Three categories of entry:

- **`schemaEndpoints`** — the same set you wired into `createSchemaEndpoint`. Each becomes a linkset entry with `type: [{ href: 'https://schema.org/<schemaType>' }]` filled in for you.
- **`schemaMap`** — the path of the route from `createSchemaMap`. Emitted without a `type` (no standard type exists for the schemamap format).
- **`additional`** — site-specific APIs not covered by the package's own factories. Pass `anchor`, optional `serviceDoc`, and optional `type` (each accepting `string` or `string[]`).

Relative paths in any field are absolutized against `siteUrl`; absolute
URLs pass through unchanged. The trailing slash on `siteUrl` is
stripped, mirroring `createSchemaMap`.

The package also exports a `CATALOG_PATH` constant
(`'/.well-known/api-catalog'`) for callers who want to reference the
catalog from `_headers` files, the schemamap, or documentation links
without duplicating the string.

Response headers:

- `Content-Type: application/linkset+json`
- `Cache-Control: max-age=300` (override or pass `null` to omit)
- `X-Robots-Tag: noindex, follow`

Empty options yield `{ "linkset": [] }` — valid per RFC 9727 §3 and
useful for sites that want to declare "no APIs" explicitly.

## Zod content helpers

```ts
// src/content.config.ts
import { defineCollection, z } from 'astro:content';
import { seoSchema, imageSchema } from '@jdevalk/astro-seo-graph';

const blog = defineCollection({
    schema: ({ image }) =>
        z.object({
            title: z.string(),
            publishDate: z.coerce.date(),
            featureImage: imageSchema(image).optional(),
            seo: seoSchema(image).optional(),
        }),
});
```

`imageSchema` **requires** `alt` — missing alt text is an accessibility
failure and an SEO failure. Decorative images should use `alt: ''`
explicitly. If you want the whole image to be optional, wrap the schema:
`imageSchema(image).optional()`.

## Astro integration

An Astro integration that runs build-time SEO checks and optional post-build
actions. Currently:

- Warns about built pages with zero or more than one `<h1>` element (a
  common SEO and accessibility issue).
- Warns about duplicate `<title>` or meta description values across the
  built corpus.
- Warns about `<img>` tags missing an `alt` attribute. Decorative
  images marked with `alt=""` or `role="presentation"`/`role="none"`
  are respected and not flagged; only a fully missing attribute is.
- Warns about `<title>` and meta description lengths outside
  SERP-friendly bounds (defaults: title 30–65, description 70–200).
  Bounds are configurable.
- Warns about internal `<a href>` links that point to a URL missing a
  trailing slash (or carrying an extra one) relative to the built
  page. Also flags links to paths that aren't in the build (true 404s).
- Optionally submits built URLs to [IndexNow](https://www.indexnow.org)
  after the build completes.
- Optionally generates an [`llms.txt`](https://llmstxt.org) file at the
  root of the build output, summarising the site for LLMs.

```js
// astro.config.mjs
import { defineConfig } from 'astro/config';
import seoGraph from '@jdevalk/astro-seo-graph/integration';

export default defineConfig({
    integrations: [
        seoGraph({
            indexNow: {
                key: process.env.INDEXNOW_KEY!,
                host: 'example.com',
                siteUrl: 'https://example.com',
            },
        }),
    ],
});
```

Options:

| Prop                     | Default | Description                                                                    |
| ------------------------ | ------- | ------------------------------------------------------------------------------ |
| `validateH1`             | `true`  | Warn about pages without exactly one `<h1>`                                    |
| `validateUniqueMetadata` | `true`  | Warn about duplicate `<title>` or meta description across pages                |
| `validateImageAlt`       | `true`  | Warn about `<img>` tags missing an `alt` attribute                             |
| `validateMetadataLength` | `true`  | Warn when title or description length is outside configured bounds (see below) |
| `validateInternalLinks`  | `true`  | Warn on trailing-slash mismatches and links to pages not in the build          |
| `indexNow`               | —       | Submit built URLs to IndexNow. See below for sub-options.                      |
| `llmsTxt`                | —       | Generate `llms.txt` at the build root. See below for sub-options.              |

`indexNow` sub-options: `key` (8–128 chars from `[A-Za-z0-9-]`), `host` (bare host, e.g.
`example.com`), `siteUrl` (absolute origin), `keyLocation?` (defaults to
`https://<host>/<key>.txt`), `endpoint?` (defaults to `api.indexnow.org`),
`filter?` (drop URLs for which the callback returns `false`; composed on
top of the built-in `/404` exclusion).

`validateMetadataLength` accepts `true`/`false` for the defaults, or an
object to override bounds. Length is measured on the whitespace-collapsed,
entity-decoded text — the same thing Google renders in the SERP.

```js
validateMetadataLength: {
    title: { min: 40, max: 60 }, // tighter than the default 30–65
    description: { max: 160 }, // keep description min at its default (70)
},
```

`validateInternalLinks` scans every built page's `<a href>` values and
checks them against the set of paths actually produced by the build.
Catches the common "I linked to `/about-me` but the page is `/about-me/`"
bug (which "works" via redirect but wastes a round-trip). Only checks
same-origin links (via `config.site`) and root-relative `/foo`-style
hrefs; `mailto:`, `tel:`, fragment-only (`#x`), and off-origin URLs are
skipped.

Explicit redirects are honored as valid targets by default. Sources in
`public/_redirects` (Netlify / Cloudflare Pages format) and literal
keys in Astro's `redirects` config are unioned into the built-paths
set, so linking to a redirect source doesn't warn. Dynamic rules
(wildcards, splats, `[slug]` params) are skipped — glob matching is
out of scope; use `skip` for those cases. Set `honorRedirects: false`
to opt out — useful when you're actively eliminating redirect hops and
want to see every internal link that doesn't hit a built page
directly.

Pass a `skip` callback to exclude specific hrefs — useful for SSR-only
routes or paths handled at the host/CDN layer:

```js
validateInternalLinks: {
    skip: (href) => href.startsWith('/api/') || href === '/search',
},
```

The `/404` page is always excluded — no one needs search engines notified
about it, and submitting it wastes daily IndexNow quota. Use `filter` to
exclude site-specific utility pages:

```js
indexNow: {
    key: process.env.INDEXNOW_KEY!,
    host: 'example.com',
    siteUrl: 'https://example.com',
    // Skip paginated archives like /blog/2/, /videos/3/
    filter: (url) => !/^\/(?:blog|videos)\/\d+\/$/.test(new URL(url).pathname),
},
```

`llmsTxt` sub-options: `title` (required H1), `siteUrl` (required, used to
resolve crawled HTML paths), `summary?` (rendered as a blockquote),
`details?` (extra paragraphs), `sections?` (user-supplied sections; when
given, no pages are auto-collected), `filter?` (drop URLs from the
auto-generated section), `autoSectionName?` (defaults to `Pages`),
`outputPath?` (defaults to `llms.txt`).

`index.html` paths are rewritten to their trailing-slash form. Only static
pages are checked/submitted (SSR pages aren't on disk at build time).

## IndexNow key route

Serve the IndexNow key-verification file at `/<key>.txt` so participating
engines can confirm host ownership:

```ts
// src/pages/[your-key-here].txt.ts
import { createIndexNowKeyRoute } from '@jdevalk/astro-seo-graph';

export const GET = createIndexNowKeyRoute({ key: 'your-key-here' });
```

The filename (minus `.txt.ts`) must equal the key. Pair this with the
`indexNow` integration option above, or call `submitToIndexNow` from your
own deploy hook.

> **Deploy the key file first.** IndexNow verifies host ownership by
> fetching `https://<host>/<key>.txt` on every submission. Submissions
> sent before the key file is reachable in production get rejected
> (HTTP 403) and the key is treated as invalid going forward — you'll
> have to rotate it. Ship the route, deploy, confirm the `.txt` loads
> over HTTPS, _then_ enable `indexNow` in the integration.

## Validating your output

The build-time integration checks only catch a narrow set of issues.
After deploying, verify the rendered JSON-LD against:

1. [Google Rich Results Test](https://search.google.com/test/rich-results)
2. [Schema.org Validator](https://validator.schema.org/)

See [AGENTS.md](https://github.com/jdevalk/seo-graph/blob/main/AGENTS.md#validating-your-output)
for details on what to look for.

## License

MIT © Joost de Valk
