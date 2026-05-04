# AGENTS.md — seo-graph

> This file is for AI coding agents (Claude Code, Cursor, Copilot, etc.)
> building sites that use `@jdevalk/seo-graph-core` and/or
> `@jdevalk/astro-seo-graph`. It explains what the library does, how the
> pieces fit together, and which schema.org entities to use for every
> common site type.

## What this library does

seo-graph builds valid, linked schema.org JSON-LD `@graph` arrays from typed
inputs. Instead of hand-writing JSON-LD (error-prone) or copying snippets
from schema.org docs (inconsistent), you call piece builders that return
strongly-typed entities, then wrap them in a `@graph` envelope.

Two packages:

- **`@jdevalk/seo-graph-core`** — Pure TypeScript, no framework dependency.
  Piece builders, ID factory, graph assembler, deduplication. Use this from
  any runtime.
- **`@jdevalk/astro-seo-graph`** — Astro integration. `<Seo>` component,
  route factories for schema endpoints, schema map for agent discovery,
  Zod content helpers.

---

## Contents

**Schema core** — concepts and builders for the JSON-LD graph:

- [Architecture](#architecture)
- [Installation](#installation)
- [The @id system](#the-id-system)
- [Piece builders reference](#piece-builders-reference)

**Recipes and patterns** — how to model real sites:

- [Site type recipes](#site-type-recipes)
- [Trust and credibility signals](#trust-and-credibility-signals)
- [Choosing the right Article subtype](#choosing-the-right-article-subtype)
- [Actions: telling agents what they can do](#actions-telling-agents-what-they-can-do)
- [Multi-type entities](#multi-type-entities)
- [Rich Organization patterns](#rich-organization-patterns)
- [Rich Person patterns](#rich-person-patterns)
- [Reference implementations](#reference-implementations)

**Astro integration** — runtime component and build-time checks:

- [Astro integration guide](#astro-integration-guide) — the `<Seo>` component, hreflang, schema endpoints
- [Build-time integration](#build-time-integration) — `seoGraph()` hook, H1 validation, metadata uniqueness, IndexNow, `llms.txt`
- [Complete integration example](#complete-integration-example)
- [Advanced patterns](#advanced-patterns)
- [Common mistakes](#common-mistakes)
- [Validating your output](#validating-your-output)
- [Repository structure](#repository-structure)

---

## Architecture

```
┌───────────────────────────────────────────────────┐
│  @jdevalk/seo-graph-core                          │
│                                                   │
│  makeIds()                     IdFactory          │
│  buildWebSite()                buildWebPage()     │
│  buildArticle()                buildPiece()       │
│  buildBreadcrumbList()                            │
│  buildImageObject()            buildVideoObject() │
│  buildSiteNavigationElement()                     │
│  assembleGraph()                                  │
│  deduplicateByGraphId()                           │
└──────────────┬────────────────────────────────────┘
               │ used by
    ┌──────────┴──────────┐
    │                     │
    ▼                     ▼
┌────────────────┐  ┌───────────────────┐
│ astro-seo-graph│  │ Any other runtime │
│                │  │ (EmDash, Next.js, │
│ <Seo>          │  │  SvelteKit, etc.) │
│ createSchema   │  │                   │
│   Endpoint()   │  │ Use core directly │
│ createSchema   │  └───────────────────┘
│   Map()        │
│ aggregate()    │
│ seoSchema()    │
│ imageSchema()  │
└────────────────┘
```

**Key principle:** Core has no opinions about your content model, routing, or
page types. It gives you piece builders. _You_ decide which pieces to assemble
for each page. This file tells you which pieces to pick.

---

## Installation

```sh
# Astro projects — install both
npm install @jdevalk/seo-graph-core @jdevalk/astro-seo-graph

# Non-Astro projects — core only
npm install @jdevalk/seo-graph-core
```

---

## The @id system

Every entity in a JSON-LD `@graph` can have an `@id`. Other entities reference
it by `{ "@id": "..." }`. This is how the graph becomes _linked_ rather than
flat.

`makeIds()` creates an `IdFactory` that generates stable, deterministic `@id`
URIs for all entity types:

```ts
import { makeIds } from '@jdevalk/seo-graph-core';

const ids = makeIds({
    siteUrl: 'https://example.com',
    personUrl: 'https://example.com/about/', // optional, defaults to siteUrl + '/'
});
```

### Available IDs

| Property/Method          | Returns                                                  | Use for                              |
| ------------------------ | -------------------------------------------------------- | ------------------------------------ |
| `ids.person`             | `https://example.com/about/#/schema.org/Person`          | Site-wide Person entity              |
| `ids.personImage`        | `https://example.com/about/#/schema.org/Person/image`    | Person's profile image               |
| `ids.website`            | `https://example.com/#/schema.org/WebSite`               | Site-wide WebSite entity             |
| `ids.navigation`         | `https://example.com/#/schema.org/SiteNavigationElement` | Main navigation                      |
| `ids.organization(slug)` | `https://example.com/#/schema.org/Organization/{slug}`   | Named organization                   |
| `ids.country(code)`      | `https://example.com/#/schema.org/Country/{code}`        | Country entity (ISO 3166)            |
| `ids.webPage(url)`       | The URL itself                                           | WebPage entity (canonical URL = @id) |
| `ids.breadcrumb(url)`    | `{url}#breadcrumb`                                       | BreadcrumbList for a page            |
| `ids.article(url)`       | `{url}#article`                                          | Article entity for a page            |
| `ids.videoObject(url)`   | `{url}#video`                                            | VideoObject for a page               |
| `ids.primaryImage(url)`  | `{url}#primaryimage`                                     | Primary image for a page             |

### How entities reference each other

Entities form a tree of references:

```
WebSite
  ├── publisher → Person or Organization
  ├── hasPart → SiteNavigationElement
  │
  ├── Blog (optional, for sites with a blog)
  │     └── publisher → Person or Organization
  │
  └── WebPage (one per URL)
        ├── isPartOf → WebSite
        ├── breadcrumb → BreadcrumbList
        ├── primaryImage → ImageObject
        │
        ├── BlogPosting or Article (if blog post)
        │     ├── isPartOf → WebPage, Blog
        │     ├── author → Person
        │     ├── publisher → Person or Organization
        │     └── image → ImageObject
        │
        └── VideoObject (if video page)
              └── isPartOf → WebPage
```

**Blog vs. Article hierarchy:** `Blog` is a `CreativeWork` that represents the
blog as a publication. `BlogPosting` is a subtype of `Article`. A `BlogPosting`
can be `isPartOf` both its `WebPage` and the `Blog`. This lets agents understand
that a post belongs to a specific blog, not just a website. Use `Blog` when the
site has a distinct blog section; skip it for single-purpose blogs where the
blog _is_ the site.

**Rule:** Always use `{ '@id': ids.xxx }` to reference another entity. Never
inline the full entity inside another entity. The graph structure handles
resolution.

---

## Piece builders reference

Every builder takes an input object and returns a `GraphEntity` (a plain object
with `@type` and usually `@id`). The specialized builders (`buildWebSite`,
`buildWebPage`, `buildArticle`, etc.) also take the `IdFactory` as a second
parameter. The generic `buildPiece` builder takes only the input object — you
set the `@id` directly in the input.

### buildWebSite

Creates the site-wide `WebSite` entity. Include exactly once per graph.

```ts
buildWebSite(
    {
        url: 'https://example.com/', // required — site root URL
        name: 'My Site', // required — site name
        description: 'A site about...', // optional
        publisher: { '@id': ids.person }, // required — Person or Organization ref
        about: { '@id': ids.person }, // optional — what this site is about
        inLanguage: 'en-US', // optional — default content language
        hasPart: { '@id': ids.navigation }, // optional — navigation ref
        // ...additional schema-dts properties accepted at top level
    },
    ids,
);
```

**Adding a SearchAction** (recommended for sites with search):

Add a `potentialAction` with a `SearchAction` directly at the top level. This
tells search engines and agents how to search your site:

```ts
buildWebSite(
    {
        url: 'https://example.com/',
        name: 'My Site',
        publisher: { '@id': ids.person },
        potentialAction: {
            '@type': 'SearchAction',
            target: {
                '@type': 'EntryPoint',
                urlTemplate: 'https://example.com/?s={search_term_string}',
            },
            'query-input': {
                '@type': 'PropertyValueSpecification',
                valueRequired: true,
                valueName: 'search_term_string',
            },
        },
    },
    ids,
);
```

This is the pattern used by most WordPress sites and many other CMSes.

### buildWebPage

Creates a `WebPage`, `ProfilePage`, or `CollectionPage` entity.

```ts
buildWebPage(
    {
        url: 'https://example.com/my-page/', // required — canonical URL (becomes @id)
        name: 'My Page', // required — page title
        isPartOf: { '@id': ids.website }, // required — WebSite ref
        breadcrumb: { '@id': ids.breadcrumb(url) }, // optional — BreadcrumbList ref
        inLanguage: 'en-US', // optional
        datePublished: new Date('2026-01-15'), // optional — emitted as ISO string
        dateModified: new Date('2026-03-01'), // optional
        primaryImage: { '@id': ids.primaryImage(url) }, // optional — ImageObject ref
        about: { '@id': ids.person }, // optional — for ProfilePage/homepage
        copyrightHolder: { '@id': ids.person }, // optional — who holds the copyright
        copyrightYear: 2026, // optional
        copyrightNotice: '© 2026 Jane Doe.', // optional — human-readable copyright text
        license: 'https://creativecommons.org/licenses/by/4.0/', // optional — license URL
        isAccessibleForFree: true, // optional
        potentialAction: [], // optional — defaults to ReadAction
        // ...additional schema-dts properties accepted at top level
    },
    ids,
    'WebPage',
); // third param: 'WebPage' | 'ProfilePage' | 'CollectionPage'
```

**When to use which type:**

- `WebPage` — Default. Blog posts, regular pages, product pages.
- `ProfilePage` — About pages, author profiles.
- `CollectionPage` — Blog listing, category archives, tag pages, portfolios.

### buildArticle

Creates an `Article` or any Article subtype (`BlogPosting`, `NewsArticle`,
etc.). Use for blog posts, news articles, tutorials.

```ts
buildArticle(
    {
        url: 'https://example.com/my-post/', // required — canonical URL
        isPartOf: { '@id': ids.webPage(url) }, // required — enclosing WebPage ref
        author: { '@id': ids.person }, // required — Person ref
        publisher: { '@id': ids.person }, // required — Person or Organization ref
        headline: 'My Post Title', // required
        description: 'A brief summary...', // required
        inLanguage: 'en-US', // optional
        datePublished: new Date('2026-01-15'), // required
        dateModified: new Date('2026-03-01'), // optional
        image: { '@id': ids.primaryImage(url) }, // optional — ImageObject ref
        about: { '@id': ids.person }, // optional — what this article is about
        articleSection: 'Technology', // optional — top-level category
        wordCount: 1500, // optional
        articleBody: 'The full text...', // optional — plain text, max ~10K chars
        // ...additional schema-dts properties accepted at top level
    },
    ids,
    'Article',
); // third param: 'Article' | 'BlogPosting' | 'NewsArticle' | 'TechArticle' | 'ScholarlyArticle' | 'Report'
```

**The `type` parameter:** Pass the schema.org type name as the third argument.
Defaults to `'Article'`. Use `'BlogPosting'` for blog posts, `'NewsArticle'`
for journalism, `'TechArticle'` for technical docs, `'ScholarlyArticle'` for
academic papers, or `'Report'` for data/research reports.

````

### buildBreadcrumbList

Creates a `BreadcrumbList` with nested `ListItem` entries.

```ts
buildBreadcrumbList({
    url: 'https://example.com/blog/my-post/', // required — page this belongs to
    items: [                                   // required — ordered root-first
        { name: 'Home', url: 'https://example.com/' },
        { name: 'Blog', url: 'https://example.com/blog/' },
        { name: 'My Post', url: 'https://example.com/blog/my-post/' },
    ],
    // ...additional schema-dts properties accepted at top level
}, ids);
````

**Rules:**

- First item should be the homepage.
- Last item should be the current page.
- Order is root → leaf.

### buildImageObject

Creates an `ImageObject` entity.

```ts
// Page-specific image (e.g. blog post feature image)
buildImageObject(
    {
        pageUrl: 'https://example.com/my-post/', // one of pageUrl or id required
        url: 'https://example.com/images/post.jpg', // required — image file URL
        width: 1200, // required
        height: 630, // required
        inLanguage: 'en-US', // optional
        caption: 'A photo of...', // optional
        // ...additional schema-dts properties accepted at top level
    },
    ids,
);

// Site-wide image (e.g. person photo, logo)
buildImageObject(
    {
        id: ids.personImage, // explicit @id override
        url: 'https://example.com/joost.jpg',
        width: 400,
        height: 400,
    },
    ids,
);
```

### buildVideoObject

Creates a `VideoObject` entity. Has built-in YouTube support.

```ts
buildVideoObject(
    {
        url: 'https://example.com/videos/my-talk/', // required — page URL
        name: 'My Conference Talk', // required
        description: 'A talk about...', // required
        isPartOf: { '@id': ids.webPage(url) }, // required — enclosing WebPage ref
        youtubeId: 'dQw4w9WgXcQ', // optional — auto-derives thumbnail + embed URLs
        thumbnailUrl: '...', // optional — explicit override
        embedUrl: '...', // optional — explicit override
        uploadDate: new Date('2026-01-15'), // optional
        duration: 'PT30M', // optional — ISO 8601
        transcript: 'Full transcript text...', // optional
        // ...additional schema-dts properties accepted at top level
    },
    ids,
);
```

**YouTube convenience:** When `youtubeId` is provided:

- `thumbnailUrl` defaults to `https://img.youtube.com/vi/{id}/maxresdefault.jpg`
- `embedUrl` defaults to `https://www.youtube-nocookie.com/embed/{id}`

### buildSiteNavigationElement

Creates a `SiteNavigationElement` with nested items.

```ts
buildSiteNavigationElement(
    {
        name: 'Main navigation', // required
        isPartOf: { '@id': ids.website }, // required — WebSite ref
        items: [
            // required — navigation links
            { name: 'Home', url: 'https://example.com/' },
            { name: 'Blog', url: 'https://example.com/blog/' },
            { name: 'About', url: 'https://example.com/about/' },
        ],
        // ...additional schema-dts properties accepted at top level
    },
    ids,
);
```

### buildPiece

The generic typed builder for any schema.org type. This is the go-to builder
for `Person`, `Organization`, `Blog`, `Product`, `Recipe`, `Event`, `Course`,
`SoftwareApplication`, `VacationRental`, `FAQPage`, `PodcastSeries`,
`PodcastEpisode`, and any other schema.org type not covered by the specialized
builders (`buildWebSite`, `buildWebPage`, `buildArticle`, etc.).

Pass a `schema-dts` type as the generic parameter for full autocomplete.
The `@type` value in the input narrows union types to the matching leaf — so
`buildPiece<Product>` with `'@type': 'Product'` gives `ProductLeaf` autocomplete.
No need to import Leaf types separately.

Callers are responsible for setting `@id` using the `IdFactory` (e.g.
`ids.person`, `ids.organization('slug')`) or a custom ID string.

```ts
import type { Person, Organization, Restaurant, Blog, Product, Recipe, Event } from 'schema-dts';

// Person (site-wide)
buildPiece<Person>({
    '@type': 'Person',
    '@id': ids.person,
    name: 'Jane Doe',
    url: 'https://example.com/about/',
    image: { '@id': ids.personImage },
    sameAs: ['https://twitter.com/janedoe', 'https://github.com/janedoe'],
    jobTitle: 'Lead Engineer',
    worksFor: [
        {
            '@type': 'EmployeeRole',
            roleName: 'Lead Engineer',
            startDate: '2022-01-01',
            worksFor: { '@id': ids.organization('acme') },
        },
    ],
});

// Organization
buildPiece<Organization>({
    '@type': 'Organization',
    '@id': ids.organization('acme'),
    name: 'Acme Corp',
    url: 'https://acme.com/',
    logo: 'https://acme.com/logo.png',
    sameAs: ['https://twitter.com/acme'],
});

// Organization subtype (e.g. Restaurant) — use the subtype directly as the generic
buildPiece<Restaurant>({
    '@type': 'Restaurant',
    '@id': ids.organization('chez-example'),
    name: 'Chez Example',
    url: 'https://chezexample.com/',
    servesCuisine: 'French',
    priceRange: '$$$',
    address: {
        '@type': 'PostalAddress',
        streetAddress: '123 Rue de la Paix',
        addressLocality: 'Paris',
        addressCountry: 'FR',
    },
});

// Product
buildPiece<Product>({
    '@type': 'Product',
    '@id': `${url}#product`,
    name: 'Running Shoe',
    brand: 'Nike',
    sku: 'ABC123',
    offers: { '@type': 'Offer', price: 99.99, priceCurrency: 'USD' },
});

// Blog
buildPiece<Blog>({
    '@type': 'Blog',
    '@id': `${siteUrl}/blog/#blog`,
    name: 'My Blog',
    url: `${siteUrl}/blog/`,
    publisher: { '@id': ids.person },
    inLanguage: 'en-US',
});

// Recipe
buildPiece<Recipe>({
    '@type': 'Recipe',
    '@id': `${url}#recipe`,
    name: 'Simple Pasta',
    author: { '@id': ids.person },
    prepTime: 'PT10M',
    cookTime: 'PT20M',
    totalTime: 'PT30M',
    recipeYield: '4 servings',
    recipeCategory: 'Main course',
    recipeCuisine: 'Italian',
    recipeIngredient: ['400g spaghetti', '200g guanciale', '4 egg yolks'],
    recipeInstructions: [
        { '@type': 'HowToStep', text: 'Boil the spaghetti.' },
        { '@type': 'HowToStep', text: 'Fry the guanciale.' },
    ],
});

// Event
buildPiece<Event>({
    '@type': 'Event',
    '@id': 'https://example.com/events/conf/#event',
    name: 'JavaScript Conference 2026',
    startDate: '2026-09-15T09:00:00+02:00',
    endDate: '2026-09-17T18:00:00+02:00',
    location: {
        '@type': 'Place',
        name: 'Congress Center',
    },
});
```

Without a generic, the input is untyped — any properties are accepted:

```ts
buildPiece({
    '@type': 'Event',
    '@id': 'https://example.com/events/conf/#event',
    name: 'JavaScript Conference 2026',
});
```

**Always prefer the typed generic** (`buildPiece<Event>`) over the
untyped form. The generic gives you autocomplete for every property on the
chosen type, making it much harder to miss recommended fields like
`potentialAction`, `geo`, or `offers`.

### Overriding `@id`

Every dedicated builder computes an `@id` from the `IdFactory` (e.g.
`ids.website`, `ids.article(url)`). You can override it by passing `'@id'`
directly — the explicit value wins:

```ts
buildBreadcrumbList(
    {
        url,
        items: [
            { name: 'Home', url: siteUrl },
            { name: 'Blog', url: blogUrl },
        ],
        '@id': `${blogUrl}#breadcrumb`, // overrides ids.breadcrumb(url)
    },
    ids,
);
```

This works on all builders: `buildWebSite`, `buildWebPage`, `buildArticle`,
`buildBreadcrumbList`, `buildImageObject`, `buildVideoObject`, and
`buildSiteNavigationElement`.

### assembleGraph

Wraps pieces in a `{ "@context": "https://schema.org", "@graph": [...] }`
envelope with first-wins deduplication by `@id`.

```ts
import { assembleGraph } from '@jdevalk/seo-graph-core';

const graph = assembleGraph([
    websitePiece,
    personPiece,
    webPagePiece,
    articlePiece,
    breadcrumbPiece,
]);
```

**Always call this last.** It handles deduplication: if multiple pages produce
the same `WebSite` or `Person` entity (same `@id`), the first occurrence wins.

**Dangling reference validation:** Pass `warnOnDanglingReferences: true` to
validate that every `{ '@id': '...' }` reference in the graph resolves to an
actual entity. This helps catch broken links — for example, a `WebSite`
referencing a `Person` that was never included in the pieces array.

```ts
const graph = assembleGraph(pieces, { warnOnDanglingReferences: true });
// Warns: [seo-graph] Dangling reference in WebSite: { "@id": "..." } does not match any entity in the graph.
```

### deduplicateByGraphId

The dedup engine on its own, for custom assembly workflows.

```ts
import { deduplicateByGraphId } from '@jdevalk/seo-graph-core';

const unique = deduplicateByGraphId(allPieces);
```

---

## Site type recipes

Each recipe shows which pieces to include for a given page type. Copy the
pattern, adjust the data. Every recipe assumes you've already created an
`IdFactory` with `makeIds()`.

### Personal blog

The most common case. A single-author blog with posts, categories, and an
about page.

**For every page** (site-wide entities):

- `buildWebSite` — publisher points to Person
- `buildPiece<Person>` — the blog author
- `buildImageObject` — person's profile photo (use `id: ids.personImage`)
- `buildPiece<Blog>` — a `Blog` entity representing the blog as a publication

The `Blog` entity is a `CreativeWork` that represents the blog as a whole,
separate from the `WebSite`. Individual `BlogPosting` entries reference the
Blog via `isPartOf`. This is the pattern used by jonoalderson.com.

```ts
import type { Blog } from 'schema-dts';

const blogId = `${siteUrl}/blog/#blog`;

// Include on every page as a site-wide entity
buildPiece<Blog>({
    '@type': 'Blog',
    '@id': blogId,
    name: 'My Blog',
    description: 'Thoughts on web development and the open web.',
    url: `${siteUrl}/blog/`,
    publisher: { '@id': ids.person },
    inLanguage: 'en-US',
}),
```

**Blog post** (`/blog/my-post/`):

Use `BlogPosting` instead of `Article` and link it to the Blog:

```ts
import type { Person, Blog } from 'schema-dts';

const blogId = `${siteUrl}/blog/#blog`;

const pieces = [
    buildWebSite({ url: siteUrl, name: 'My Blog', publisher: { '@id': ids.person } }, ids),
    buildPiece<Person>({ '@type': 'Person', '@id': ids.person, name: 'Jane Doe', url: aboutUrl, image: { '@id': ids.personImage }, sameAs: [...] }),
    buildImageObject({ id: ids.personImage, url: profilePhotoUrl, width: 400, height: 400 }, ids),
    buildPiece<Blog>({
        '@type': 'Blog',
        '@id': blogId,
        name: 'My Blog',
        url: `${siteUrl}/blog/`,
        publisher: { '@id': ids.person },
    }),
    buildWebPage({ url, name: title, isPartOf: { '@id': ids.website }, breadcrumb: { '@id': ids.breadcrumb(url) }, datePublished, dateModified, primaryImage: { '@id': ids.primaryImage(url) } }, ids),
    buildArticle({
        url,
        headline: title,
        description,
        datePublished,
        dateModified,
        author: { '@id': ids.person },
        publisher: { '@id': ids.person },
        isPartOf: [{ '@id': ids.webPage(url) }, { '@id': blogId }],
        image: { '@id': ids.primaryImage(url) },
        articleSection: category,
        wordCount,
    }, ids, 'BlogPosting'),
    buildBreadcrumbList({ url, items: [{ name: 'Home', url: siteUrl }, { name: 'Blog', url: blogUrl }, { name: title, url }] }, ids),
    buildImageObject({ pageUrl: url, url: featureImageUrl, width: 1200, height: 630 }, ids),
];
const graph = assembleGraph(pieces);
```

**Note:** The `isPartOf` array links the posting to both the `WebPage` and the
`Blog`. If you don't need the `Blog` link, just use
`isPartOf: { '@id': ids.webPage(url) }` directly.

**Blog listing** (`/blog/`):

```ts
const pieces = [
    // ...site-wide entities (including Blog)...
    buildWebPage(
        {
            url,
            name: 'Blog',
            isPartOf: { '@id': ids.website },
            breadcrumb: { '@id': ids.breadcrumb(url) },
            about: { '@id': blogId },
        },
        ids,
        'CollectionPage',
    ),
    buildBreadcrumbList(
        {
            url,
            items: [
                { name: 'Home', url: siteUrl },
                { name: 'Blog', url },
            ],
        },
        ids,
    ),
];
```

**Category archive** (`/blog/category/tech/`):

```ts
const pieces = [
    // ...site-wide entities...
    buildWebPage(
        {
            url,
            name: 'Technology',
            isPartOf: { '@id': ids.website },
            breadcrumb: { '@id': ids.breadcrumb(url) },
        },
        ids,
        'CollectionPage',
    ),
    buildBreadcrumbList(
        {
            url,
            items: [
                { name: 'Home', url: siteUrl },
                { name: 'Blog', url: blogUrl },
                { name: 'Technology', url },
            ],
        },
        ids,
    ),
];
```

**About page** (`/about/`):

```ts
const pieces = [
    // ...site-wide entities...
    buildWebPage(
        { url, name: 'About Jane', isPartOf: { '@id': ids.website }, about: { '@id': ids.person } },
        ids,
        'ProfilePage',
    ),
];
```

**Homepage** (`/`):

```ts
const pieces = [
    // ...site-wide entities...
    buildWebPage(
        {
            url: siteUrl,
            name: 'Jane Doe — My Blog',
            isPartOf: { '@id': ids.website },
            about: { '@id': ids.person },
        },
        ids,
        'CollectionPage',
    ),
];
```

---

### Business / company blog

A multi-author blog owned by a company.

**Key difference from personal blog:** The `WebSite` publisher is an
`Organization`, not a `Person`. Individual authors are separate `Person`
entities.

```ts
import type { Organization, Blog, Person } from 'schema-dts';

const ids = makeIds({ siteUrl: 'https://acme.com' });

// Site-wide
const blogId = 'https://acme.com/blog/#blog';
const siteEntities = [
    buildPiece<Organization>({ '@type': 'Organization', '@id': ids.organization('acme'), name: 'Acme Corp', url: 'https://acme.com/', logo: logoUrl, sameAs: [...] }),
    buildWebSite({ url: 'https://acme.com/', name: 'Acme Blog', publisher: { '@id': ids.organization('acme') } }, ids),
    buildPiece<Blog>({
        '@type': 'Blog',
        '@id': blogId,
        name: 'The Acme Blog',
        url: 'https://acme.com/blog/',
        publisher: { '@id': ids.organization('acme') },
    }),
];

// Per blog post — author is a separate Person (not site-wide ids.person)
const authorId = 'https://acme.com/team/jane/#person';
const postPieces = [
    ...siteEntities,
    buildPiece<Person>({ '@type': 'Person', '@id': authorId, name: 'Jane Doe', url: 'https://acme.com/team/jane/' }),
    buildWebPage({ url, name: title, isPartOf: { '@id': ids.website }, datePublished }, ids),
    buildArticle({
        url,
        headline: title,
        description,
        datePublished,
        author: { '@id': authorId },
        publisher: { '@id': ids.organization('acme') },
        isPartOf: [{ '@id': ids.webPage(url) }, { '@id': blogId }],
    }, ids, 'BlogPosting'),
    buildBreadcrumbList({ url, items: [{ name: 'Home', url: siteUrl }, { name: 'Blog', url: blogUrl }, { name: title, url }] }, ids),
];
```

---

### E-commerce / product page

Use `buildPiece<Product>` for `Product` and `buildPiece<ProductGroup>` for `ProductGroup` entities.

**Simple product (single variant):**

```ts
import type { Organization, Product } from 'schema-dts';

const ids = makeIds({ siteUrl: 'https://shop.example.com' });

const pieces = [
    buildPiece<Organization>({
        '@type': 'Organization',
        '@id': ids.organization('shop'),
        name: 'Example Shop',
        url: siteUrl,
        logo: logoUrl,
    }),
    buildWebSite(
        { url: siteUrl, name: 'Example Shop', publisher: { '@id': ids.organization('shop') } },
        ids,
    ),
    buildWebPage(
        {
            url,
            name: productName,
            isPartOf: { '@id': ids.website },
            breadcrumb: { '@id': ids.breadcrumb(url) },
        },
        ids,
    ),
    buildBreadcrumbList(
        {
            url,
            items: [
                { name: 'Home', url: siteUrl },
                { name: 'Shoes', url: categoryUrl },
                { name: productName, url },
            ],
        },
        ids,
    ),
    buildPiece<Product>({
        '@type': 'Product',
        '@id': `${url}#product`,
        name: productName,
        description: productDescription,
        brand: 'Nike',
        sku: 'ABC123',
        offers: {
            '@type': 'Offer',
            price: 99.99,
            priceCurrency: 'USD',
            availability: 'https://schema.org/InStock',
            url,
            seller: { '@id': ids.organization('shop') },
        },
        aggregateRating: {
            '@type': 'AggregateRating',
            ratingValue: 4.5,
            reviewCount: 42,
        },
        potentialAction: {
            '@type': 'BuyAction',
            target: {
                '@type': 'EntryPoint',
                urlTemplate: 'https://shop.example.com/cart/add/{sku}',
            },
            seller: { '@id': ids.organization('shop') },
        },
        image: productImageUrl,
    }),
];
```

**Product with variants** (sizes, colors — see meta.com for a live example):

When a product has multiple variants (e.g. sizes, colors), use `ProductGroup`
as the parent and individual `Product` entities for each variant:

```ts
import type { Product, ProductGroup } from 'schema-dts';

const variants = [
    {
        sku: 'SHOE-BLK-10',
        name: 'Running Shoe — Black, Size 10',
        color: 'Black',
        size: '10',
        price: 99.99,
        inStock: true,
    },
    {
        sku: 'SHOE-WHT-10',
        name: 'Running Shoe — White, Size 10',
        color: 'White',
        size: '10',
        price: 99.99,
        inStock: true,
    },
    {
        sku: 'SHOE-BLK-11',
        name: 'Running Shoe — Black, Size 11',
        color: 'Black',
        size: '11',
        price: 99.99,
        inStock: false,
    },
];

const pieces = [
    // ...site-wide + WebPage + BreadcrumbList...
    buildPiece<ProductGroup>({
        '@type': 'ProductGroup',
        '@id': `${url}#product`,
        name: 'Running Shoe',
        description: productDescription,
        brand: 'Nike',
        url,
        productGroupID: 'running-shoe',
        variesBy: ['https://schema.org/color', 'https://schema.org/size'],
        hasVariant: variants.map((v) => ({ '@id': `${url}#product-${v.sku}` })),
    }),
    ...variants.map((v) =>
        buildPiece<Product>({
            '@type': 'Product',
            '@id': `${url}#product-${v.sku}`,
            name: v.name,
            sku: v.sku,
            offers: {
                '@type': 'Offer',
                price: v.price,
                priceCurrency: 'USD',
                availability: v.inStock
                    ? 'https://schema.org/InStock'
                    : 'https://schema.org/OutOfStock',
                url,
                hasMerchantReturnPolicy: {
                    '@type': 'MerchantReturnPolicy',
                    merchantReturnDays: 30,
                    returnMethod: 'https://schema.org/ReturnByMail',
                    returnFees: 'https://schema.org/FreeReturn',
                },
                shippingDetails: {
                    '@type': 'OfferShippingDetails',
                    shippingRate: { '@type': 'MonetaryAmount', value: 0, currency: 'USD' },
                    shippingDestination: { '@type': 'DefinedRegion', addressCountry: 'US' },
                },
            },
            color: v.color,
            size: v.size,
            image: [productImageUrl],
        }),
    ),
];
```

---

### Local business

A restaurant, dentist, shop, or any business with a physical location.

```ts
import type { Restaurant } from 'schema-dts';

const ids = makeIds({ siteUrl: 'https://chezexample.com' });

const pieces = [
    buildPiece<Restaurant>({
        '@type': 'Restaurant',
        '@id': ids.organization('chez-example'),
        name: 'Chez Example',
        url: 'https://chezexample.com/',
        logo: logoUrl,
        sameAs: ['https://instagram.com/chezexample'],
        address: {
            '@type': 'PostalAddress',
            streetAddress: '123 Rue de la Paix',
            addressLocality: 'Paris',
            postalCode: '75002',
            addressCountry: 'FR',
        },
        telephone: '+33-1-23-45-67-89',
        priceRange: '$$$',
        servesCuisine: 'French',
        geo: {
            '@type': 'GeoCoordinates',
            latitude: 48.8698,
            longitude: 2.3311,
        },
        openingHoursSpecification: [
            {
                '@type': 'OpeningHoursSpecification',
                dayOfWeek: ['Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
                opens: '12:00',
                closes: '14:30',
            },
            {
                '@type': 'OpeningHoursSpecification',
                dayOfWeek: ['Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
                opens: '19:00',
                closes: '22:30',
            },
        ],
    }),
    buildWebSite(
        {
            url: siteUrl,
            name: 'Chez Example',
            publisher: { '@id': ids.organization('chez-example') },
        },
        ids,
    ),
    buildWebPage(
        {
            url: siteUrl,
            name: 'Chez Example — French Restaurant in Paris',
            isPartOf: { '@id': ids.website },
        },
        ids,
    ),
];
```

---

### Portfolio / agency

A freelancer or agency showcasing work.

```ts
import type { Person } from 'schema-dts';

const ids = makeIds({ siteUrl: 'https://janedoe.design' });

// Homepage — CollectionPage showcasing work
const pieces = [
    buildPiece<Person>({
        '@type': 'Person',
        '@id': ids.person,
        name: 'Jane Doe',
        jobTitle: 'Product Designer',
        url: siteUrl,
        image: { '@id': ids.personImage },
        sameAs: [dribbble, linkedin],
    }),
    buildImageObject({ id: ids.personImage, url: headshot, width: 400, height: 400 }, ids),
    buildWebSite({ url: siteUrl, name: 'Jane Doe Design', publisher: { '@id': ids.person } }, ids),
    buildWebPage(
        {
            url: siteUrl,
            name: 'Jane Doe — Product Designer',
            isPartOf: { '@id': ids.website },
            about: { '@id': ids.person },
        },
        ids,
        'CollectionPage',
    ),
];

// Individual project page
const projectPieces = [
    // ...site-wide entities...
    buildWebPage(
        {
            url,
            name: projectTitle,
            isPartOf: { '@id': ids.website },
            breadcrumb: { '@id': ids.breadcrumb(url) },
            datePublished,
        },
        ids,
    ),
    buildArticle(
        {
            url,
            isPartOf: { '@id': ids.webPage(url) },
            author: { '@id': ids.person },
            publisher: { '@id': ids.person },
            headline: projectTitle,
            description,
            datePublished,
        },
        ids,
    ),
    buildBreadcrumbList(
        {
            url,
            items: [
                { name: 'Home', url: siteUrl },
                { name: 'Work', url: workUrl },
                { name: projectTitle, url },
            ],
        },
        ids,
    ),
];
```

---

### Documentation site

A docs site for a software project or API.

```ts
import type { Organization } from 'schema-dts';

const ids = makeIds({ siteUrl: 'https://docs.example.com' });

const pieces = [
    buildPiece<Organization>({
        '@type': 'Organization',
        '@id': ids.organization('example'),
        name: 'Example Inc',
        url: 'https://example.com/',
        logo: logoUrl,
    }),
    buildWebSite(
        {
            url: siteUrl,
            name: 'Example Docs',
            publisher: { '@id': ids.organization('example') },
            description: 'Documentation for Example SDK',
        },
        ids,
    ),
    buildWebPage(
        {
            url,
            name: pageTitle,
            isPartOf: { '@id': ids.website },
            breadcrumb: { '@id': ids.breadcrumb(url) },
            dateModified,
        },
        ids,
    ),
    buildBreadcrumbList(
        {
            url,
            items: [
                { name: 'Docs', url: siteUrl },
                { name: 'Guides', url: guidesUrl },
                { name: pageTitle, url },
            ],
        },
        ids,
    ),
];
```

For docs, `Article` is optional. Many documentation pages are better served by
just `WebPage` + `BreadcrumbList`. Add `Article` only for tutorial-style content
with a clear author and publish date.

---

### Podcast / video site

Just as `Blog` is a container for `BlogPosting`, `PodcastSeries` is a
container for `PodcastEpisode`. Include the series as a site-wide entity.

**Video podcast (YouTube-based):**

```ts
import type { Person, PodcastSeries } from 'schema-dts';

const ids = makeIds({ siteUrl: 'https://podcast.example.com' });
const seriesId = `${siteUrl}#podcast-series`;

// Episode page
const pieces = [
    buildPiece<Person>({
        '@type': 'Person',
        '@id': ids.person,
        name: 'Host Name',
        url: aboutUrl,
        image: { '@id': ids.personImage },
    }),
    buildImageObject({ id: ids.personImage, url: hostPhotoUrl, width: 400, height: 400 }, ids),
    buildWebSite({ url: siteUrl, name: 'My Podcast', publisher: { '@id': ids.person } }, ids),
    buildPiece<PodcastSeries>({
        '@type': 'PodcastSeries',
        '@id': seriesId,
        name: 'My Podcast',
        description: 'A weekly show about...',
        url: siteUrl,
        author: { '@id': ids.person },
        publisher: { '@id': ids.person },
        inLanguage: 'en-US',
        webFeed: `${siteUrl}feed.xml`,
    }),
    buildWebPage(
        {
            url,
            name: episodeTitle,
            isPartOf: { '@id': ids.website },
            breadcrumb: { '@id': ids.breadcrumb(url) },
            datePublished,
        },
        ids,
    ),
    buildVideoObject(
        {
            url,
            name: episodeTitle,
            description: episodeDescription,
            isPartOf: { '@id': ids.webPage(url) },
            youtubeId,
            uploadDate: publishDate,
            duration: 'PT45M',
            transcript,
        },
        ids,
    ),
    buildBreadcrumbList(
        {
            url,
            items: [
                { name: 'Home', url: siteUrl },
                { name: 'Episodes', url: episodesUrl },
                { name: episodeTitle, url },
            ],
        },
        ids,
    ),
];
```

**Audio-only podcast:**

Use `PodcastEpisode` linked to the `PodcastSeries`:

```ts
import type { PodcastEpisode } from 'schema-dts';

const seriesId = `${siteUrl}#podcast-series`;

const pieces = [
    // ...site-wide entities including PodcastSeries...
    buildWebPage({ url, name: episodeTitle, isPartOf: { '@id': ids.website }, datePublished }, ids),
    buildPiece<PodcastEpisode>({
        '@type': 'PodcastEpisode',
        '@id': `${url}#episode`,
        name: episodeTitle,
        description: episodeDescription,
        url,
        datePublished: publishDate.toISOString(),
        duration: 'PT45M',
        episodeNumber: 42,
        partOfSeries: { '@id': seriesId },
        associatedMedia: {
            '@type': 'MediaObject',
            contentUrl: mp3Url,
            encodingFormat: 'audio/mpeg',
            duration: 'PT45M',
        },
        author: { '@id': ids.person },
    }),
    buildBreadcrumbList(
        {
            url,
            items: [
                { name: 'Home', url: siteUrl },
                { name: 'Episodes', url: episodesUrl },
                { name: episodeTitle, url },
            ],
        },
        ids,
    ),
];
```

**Podcast listing page** (`/episodes/`):

```ts
const pieces = [
    // ...site-wide entities...
    buildWebPage(
        { url, name: 'Episodes', isPartOf: { '@id': ids.website }, about: { '@id': seriesId } },
        ids,
        'CollectionPage',
    ),
];
```

---

### Vacation rental / accommodation

```ts
import type { Person, VacationRental } from 'schema-dts';

const ids = makeIds({ siteUrl: 'https://myhouse.example.com' });

const pieces = [
    buildPiece<Person>({ '@type': 'Person', '@id': ids.person, name: 'Owner Name', url: siteUrl }),
    buildWebSite({ url: siteUrl, name: 'Villa Example', publisher: { '@id': ids.person } }, ids),
    buildWebPage(
        {
            url: siteUrl,
            name: 'Villa Example — Holiday Home in Tuscany',
            isPartOf: { '@id': ids.website },
        },
        ids,
    ),
    buildPiece<VacationRental>({
        '@type': 'VacationRental',
        '@id': `${siteUrl}#rental`,
        name: 'Villa Example',
        description: 'A beautiful villa...',
        url: siteUrl,
        image: [heroImageUrl],
        address: {
            '@type': 'PostalAddress',
            addressLocality: 'Lucca',
            addressRegion: 'Tuscany',
            addressCountry: 'IT',
        },
        geo: {
            '@type': 'GeoCoordinates',
            latitude: 43.84,
            longitude: 10.5,
        },
        numberOfRooms: 4,
        occupancy: {
            '@type': 'QuantitativeValue',
            maxValue: 8,
        },
        amenityFeature: [
            { '@type': 'LocationFeatureSpecification', name: 'Pool', value: true },
            { '@type': 'LocationFeatureSpecification', name: 'WiFi', value: true },
        ],
        potentialAction: {
            '@type': 'RentAction',
            target: {
                '@type': 'EntryPoint',
                urlTemplate:
                    'https://myhouse.example.com/book?checkin={checkin}&checkout={checkout}&guests={guests}',
            },
            landlord: { '@id': ids.person },
            priceSpecification: {
                '@type': 'UnitPriceSpecification',
                price: 250,
                priceCurrency: 'EUR',
                unitCode: 'DAY',
            },
        },
    }),
];
```

---

### Recipe site

```ts
import type { Recipe } from 'schema-dts';

const ids = makeIds({ siteUrl: 'https://recipes.example.com' });

const pieces = [
    // ...site-wide entities...
    buildWebPage(
        {
            url,
            name: recipeName,
            isPartOf: { '@id': ids.website },
            breadcrumb: { '@id': ids.breadcrumb(url) },
            datePublished,
        },
        ids,
    ),
    buildBreadcrumbList(
        {
            url,
            items: [
                { name: 'Home', url: siteUrl },
                { name: 'Italian', url: categoryUrl },
                { name: recipeName, url },
            ],
        },
        ids,
    ),
    buildPiece<Recipe>({
        '@type': 'Recipe',
        '@id': `${url}#recipe`,
        name: recipeName,
        author: { '@id': ids.person },
        prepTime: 'PT15M',
        cookTime: 'PT45M',
        totalTime: 'PT1H',
        recipeYield: '4 servings',
        recipeCategory: 'Main course',
        recipeCuisine: 'Italian',
        nutrition: {
            '@type': 'NutritionInformation',
            calories: '450 calories',
        },
        recipeIngredient: [
            '400g spaghetti',
            '200g guanciale',
            '4 egg yolks',
            '100g pecorino romano',
        ],
        recipeInstructions: [
            { '@type': 'HowToStep', text: 'Boil the spaghetti in salted water.' },
            { '@type': 'HowToStep', text: 'Fry the guanciale until crispy.' },
            { '@type': 'HowToStep', text: 'Mix egg yolks with pecorino.' },
            { '@type': 'HowToStep', text: 'Combine and serve immediately.' },
        ],
        description: recipeDescription,
        image: recipeImageUrl,
        datePublished: publishDate.toISOString(),
    }),
];
```

---

### Event page

```ts
import type { Event } from 'schema-dts';

buildPiece<Event>({
    '@type': 'Event',
    '@id': `${url}#event`,
    name: 'JavaScript Conference 2026',
    description: 'Annual JavaScript conference...',
    startDate: '2026-09-15T09:00:00+02:00',
    endDate: '2026-09-17T18:00:00+02:00',
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    eventStatus: 'https://schema.org/EventScheduled',
    location: {
        '@type': 'Place',
        name: 'Congress Center',
        address: {
            '@type': 'PostalAddress',
            addressLocality: 'Amsterdam',
            addressCountry: 'NL',
        },
    },
    organizer: { '@id': ids.organization('organizer-slug') },
    offers: {
        '@type': 'Offer',
        price: 299,
        priceCurrency: 'EUR',
        availability: 'https://schema.org/InStock',
        url: ticketUrl,
        validFrom: '2026-01-01T00:00:00+01:00',
    },
    image: eventImageUrl,
}),
```

---

### SaaS / software product landing page

```ts
import type { Organization, SoftwareApplication } from 'schema-dts';

const pieces = [
    buildPiece<Organization>({
        '@type': 'Organization',
        '@id': ids.organization('myapp'),
        name: 'MyApp Inc',
        url: siteUrl,
        logo: logoUrl,
    }),
    buildWebSite(
        { url: siteUrl, name: 'MyApp', publisher: { '@id': ids.organization('myapp') } },
        ids,
    ),
    buildWebPage(
        {
            url: siteUrl,
            name: 'MyApp — Project Management for Teams',
            isPartOf: { '@id': ids.website },
        },
        ids,
    ),
    buildPiece<SoftwareApplication>({
        '@type': 'SoftwareApplication',
        '@id': `${siteUrl}#app`,
        name: 'MyApp',
        description: 'Project management for distributed teams.',
        url: siteUrl,
        applicationCategory: 'BusinessApplication',
        operatingSystem: 'Web',
        offers: {
            '@type': 'Offer',
            price: 0,
            priceCurrency: 'USD',
            description: 'Free tier available',
        },
        aggregateRating: {
            '@type': 'AggregateRating',
            ratingValue: 4.7,
            ratingCount: 1200,
        },
        potentialAction: {
            '@type': 'BuyAction',
            target: {
                '@type': 'EntryPoint',
                url: `${siteUrl}signup/`,
            },
            price: 0,
            priceCurrency: 'USD',
            description: 'Start free trial',
        },
    }),
];
```

---

### FAQ page

Combine `WebPage` with a `FAQPage` custom piece:

```ts
import type { FAQPage } from 'schema-dts';

const pieces = [
    // ...site-wide entities...
    buildWebPage(
        { url, name: 'Frequently Asked Questions', isPartOf: { '@id': ids.website } },
        ids,
    ),
    buildPiece<FAQPage>({
        '@type': 'FAQPage',
        '@id': `${url}#faq`,
        mainEntity: [
            {
                '@type': 'Question',
                name: 'How do I install seo-graph?',
                acceptedAnswer: {
                    '@type': 'Answer',
                    text: 'Run npm install @jdevalk/seo-graph-core',
                },
            },
            {
                '@type': 'Question',
                name: 'Does it work with Next.js?',
                acceptedAnswer: {
                    '@type': 'Answer',
                    text: 'Yes. Use @jdevalk/seo-graph-core directly. The Astro integration is Astro-only.',
                },
            },
        ],
    }),
];
```

---

### Course / educational content

```ts
import type { Course } from 'schema-dts';

buildPiece<Course>({
    '@type': 'Course',
    '@id': `${url}#course`,
    name: 'Introduction to TypeScript',
    description: 'Learn TypeScript from scratch...',
    provider: { '@id': ids.organization('school-slug') },
    instructor: { '@id': ids.person },
    courseCode: 'TS-101',
    hasCourseInstance: {
        '@type': 'CourseInstance',
        courseMode: 'online',
        startDate: '2026-06-01',
        endDate: '2026-08-01',
    },
    offers: {
        '@type': 'Offer',
        price: 49,
        priceCurrency: 'USD',
    },
}),
```

---

### News / magazine site

Same as a company blog, but consider using `NewsArticle` instead of `Article`:

```ts
buildArticle({
    url,
    headline: title,
    description: excerpt,
    datePublished: publishDate,
    dateModified: modifiedDate,
    author: { '@id': authorPersonId },
    publisher: { '@id': ids.organization('newsroom') },
    isPartOf: { '@id': ids.webPage(url) },
    articleSection: section,
    image: { '@id': ids.primaryImage(url) },
}, ids, 'NewsArticle'),
```

---

## Trust and credibility signals

### publishingPrinciples

The `publishingPrinciples` property links to a document describing editorial
policies. It can be applied to `Organization`, `Person`, or `CreativeWork`
(including `Blog`). This is one of the strongest trust signals you can give
search engines and AI agents about your content's credibility.

```ts
import type { Person, Blog, Organization } from 'schema-dts';

// On a Person entity (personal blog)
buildPiece<Person>({
    '@type': 'Person',
    '@id': ids.person,
    name: 'Jane Doe',
    url: aboutUrl,
    publishingPrinciples: `${siteUrl}/editorial-policy/`,
}),

// On a Blog entity
buildPiece<Blog>({
    '@type': 'Blog',
    '@id': blogId,
    name: 'My Blog',
    url: `${siteUrl}/blog/`,
    publisher: { '@id': ids.person },
    publishingPrinciples: `${siteUrl}/editorial-policy/`,
}),

// On an Organization (news site, company blog)
buildPiece<Organization>({
    '@type': 'Organization',
    '@id': ids.organization('newsroom'),
    name: 'The Daily Example',
    publishingPrinciples: `${siteUrl}/ethics/`,
}),
```

### Specialized policy sub-properties

For news and media organizations, schema.org has more specific sub-properties
of `publishingPrinciples`:

```ts
import type { Organization } from 'schema-dts';

buildPiece<Organization>({
    '@type': 'Organization',
    '@id': ids.organization('newsroom'),
    name: 'The Daily Example',
    url: siteUrl,
    publishingPrinciples: `${siteUrl}/editorial-policy/`,
    correctionsPolicy: `${siteUrl}/corrections/`,
    verificationFactCheckingPolicy: `${siteUrl}/fact-checking/`,
    actionableFeedbackPolicy: `${siteUrl}/feedback/`,
    unnamedSourcesPolicy: `${siteUrl}/sources-policy/`,
    ownershipFundingInfo: `${siteUrl}/about/ownership/`,
    diversityStaffingReport: `${siteUrl}/diversity-report/`,
    masthead: `${siteUrl}/team/`,
}),
```

### When to use which

| Site type                          | Recommended properties                                                        |
| ---------------------------------- | ----------------------------------------------------------------------------- |
| Personal blog                      | `publishingPrinciples` on Person or Blog                                      |
| Company blog                       | `publishingPrinciples` on Organization                                        |
| News / magazine                    | All sub-properties (corrections, fact-checking, sources, ownership, masthead) |
| Documentation site                 | `publishingPrinciples` on Organization (link to contribution guidelines)      |
| Any site with AI-generated content | `publishingPrinciples` (link to AI usage disclosure)                          |

**Practical advice:** You don't need all of these. Start with
`publishingPrinciples` on your primary entity (Person or Organization). Add
the sub-properties if you actually have those policy pages. Don't create empty
policy pages just to fill the properties.

### Copyright, licensing, and access

`WebPage` (and all `CreativeWork` types, including `Article`, `BlogPosting`,
`Blog`, and `Product`) supports copyright and licensing properties. These are
increasingly important as AI agents need to understand what they can and can't
do with your content.

**On WebPage:**

```ts
buildWebPage({
    url,
    name: title,
    isPartOf: { '@id': ids.website },
    datePublished,
    copyrightHolder: { '@id': ids.person },
    copyrightYear: 2026,
    copyrightNotice: '© 2026 Jane Doe. All rights reserved.',
    license: 'https://creativecommons.org/licenses/by/4.0/',
    isAccessibleForFree: true,
    creditText: 'Jane Doe / janedoe.com',
}, ids),
```

**On Article or BlogPosting:**

```ts
buildArticle({
    url,
    headline: title,
    // ...other article properties...
    copyrightHolder: { '@id': ids.person },
    copyrightYear: 2026,
    license: 'https://creativecommons.org/licenses/by-sa/4.0/',
}, ids, 'BlogPosting'),
```

**On WebSite (site-wide default):**

```ts
buildWebSite({
    url: siteUrl,
    name: 'My Site',
    publisher: { '@id': ids.person },
    copyrightHolder: { '@id': ids.person },
    license: 'https://creativecommons.org/licenses/by/4.0/',
}, ids),
```

### Copyright and licensing properties reference

| Property              | Type                   | Use for                                             |
| --------------------- | ---------------------- | --------------------------------------------------- |
| `copyrightHolder`     | Person or Organization | Who holds the copyright                             |
| `copyrightYear`       | Number                 | Year copyright was first asserted                   |
| `copyrightNotice`     | Text                   | Human-readable copyright text                       |
| `license`             | URL or CreativeWork    | License that applies (CC, MIT, custom)              |
| `acquireLicensePage`  | URL                    | Where to buy/request a license for reuse            |
| `creditText`          | Text                   | How to credit when reusing (e.g. "Photo: Jane Doe") |
| `isAccessibleForFree` | Boolean                | Whether the content is free to access               |
| `conditionsOfAccess`  | Text                   | Access conditions in natural language               |

### When to use what

| Scenario                            | Properties to include                                                            |
| ----------------------------------- | -------------------------------------------------------------------------------- |
| Personal blog (all rights reserved) | `copyrightHolder`, `copyrightYear`                                               |
| Blog with Creative Commons license  | `copyrightHolder`, `copyrightYear`, `license`                                    |
| Paywalled content                   | `isAccessibleForFree: false`, `conditionsOfAccess: 'Requires paid subscription'` |
| Stock photography site              | `copyrightHolder`, `license`, `acquireLicensePage`, `creditText`                 |
| Open source docs (MIT/Apache)       | `license` pointing to the license URL                                            |
| News with free + premium tiers      | `isAccessibleForFree` per-article (true for free, false for premium)             |
| AI training opt-out signal          | `copyrightNotice` + `license` with restrictive terms                             |

**Note on AI and licensing:** While `license` and `copyrightNotice` don't
legally prevent AI training (that's what robots.txt, TDM headers, and
contracts are for), they give agents clear metadata about your content's
terms. An agent that respects licensing can check these properties before
deciding how to use your content.

---

## Choosing the right Article subtype

`buildArticle` defaults to `@type: Article`, which is correct for most content.
Pass a subtype as the third argument for more precise semantics:

| Type               | When to use                                               | Example                         |
| ------------------ | --------------------------------------------------------- | ------------------------------- |
| `Article`          | Default. General articles, tutorials, guides.             | "How to set up ESLint"          |
| `BlogPosting`      | Personal blog posts, opinion pieces, diary-style entries. | "Why I switched to Astro"       |
| `NewsArticle`      | News reporting, journalism, press releases.               | "Google announces new protocol" |
| `TechArticle`      | Technical documentation, API guides, spec write-ups.      | "WebSocket protocol deep dive"  |
| `ScholarlyArticle` | Academic papers, research publications.                   | "Effects of caching on TTFB"    |
| `Report`           | Data reports, annual reviews, research findings.          | "State of CSS 2026"             |

```ts
buildArticle(
    {
        url,
        headline: title,
        description: excerpt,
        datePublished: publishDate,
        dateModified: modifiedDate,
        author: { '@id': ids.person },
        publisher: { '@id': ids.person },
        isPartOf: { '@id': ids.webPage(url) },
        image: { '@id': ids.primaryImage(url) },
        articleSection: category,
        wordCount,
        articleBody: plainTextBody,
    },
    ids,
    'BlogPosting',
);
```

jonoalderson.com uses `BlogPosting` for all blog content. Most SEO plugins
default to `Article`. Both are valid; `BlogPosting` is more semantically
precise for personal blogs.

---

## Actions: telling agents what they can do

The `potentialAction` property on any entity tells search engines and AI agents
_what actions can be performed_ and _where to go to perform them_. This is the
mechanism that makes your schema truly agent-ready: an agent can read your
graph, find a `BuyAction` on a Product, and navigate to the checkout URL.

### The TradeAction family

All commerce-related actions inherit from `TradeAction`:

| Action           | Use for                                | Key extra property            |
| ---------------- | -------------------------------------- | ----------------------------- |
| `BuyAction`      | Direct purchase (add to cart, buy now) | `seller`                      |
| `OrderAction`    | Order for delivery                     | `deliveryMethod`              |
| `PreOrderAction` | Not yet available, reserve now         | —                             |
| `RentAction`     | Vacation rentals, equipment, cars      | `landlord`, `realEstateAgent` |
| `QuoteAction`    | Custom pricing, request a quote        | —                             |
| `SellAction`     | Marketplace listings (seller-side)     | `buyer`                       |
| `PayAction`      | Payment processing                     | —                             |
| `TipAction`      | Donations, tips, support               | —                             |

### The pattern

Every action uses `target` with an `EntryPoint` to specify the URL where the
action can be performed. The `urlTemplate` variant supports parameters:

```ts
potentialAction: {
    '@type': 'BuyAction',
    target: {
        '@type': 'EntryPoint',
        urlTemplate: 'https://shop.example.com/cart/add/{sku}',
        // or just: url: 'https://shop.example.com/cart/add/ABC123',
    },
}
```

### Buying a product

Add to the `Product` or `ProductGroup` entity:

```ts
import type { Product } from 'schema-dts';

buildPiece<Product>({
    '@type': 'Product',
    '@id': `${url}#product`,
    name: productName,
    // ...other product properties...
    potentialAction: {
        '@type': 'BuyAction',
        target: {
            '@type': 'EntryPoint',
            urlTemplate: `https://shop.example.com/cart/add/{sku}`,
        },
        seller: { '@id': ids.organization('shop') },
    },
}),
```

### Pre-ordering a product

For products not yet available:

```ts
potentialAction: {
    '@type': 'PreOrderAction',
    target: {
        '@type': 'EntryPoint',
        url: 'https://shop.example.com/pre-order/new-gadget',
    },
    description: 'Pre-order — ships March 2027',
},
```

### Ordering with delivery

When you need to specify how the product will be delivered:

```ts
potentialAction: {
    '@type': 'OrderAction',
    target: {
        '@type': 'EntryPoint',
        url: `${url}checkout/`,
    },
    deliveryMethod: 'https://schema.org/ParcelService',
},
```

`deliveryMethod` values: `ParcelService`, `OnSitePickup`, `LockerDelivery`.

### Renting (vacation rental, equipment, cars)

Add to the `VacationRental`, `Product`, or `Car` entity:

```ts
import type { VacationRental } from 'schema-dts';

buildPiece<VacationRental>({
    '@type': 'VacationRental',
    '@id': `${siteUrl}#rental`,
    name: 'Villa Example',
    // ...other rental properties...
    potentialAction: {
        '@type': 'RentAction',
        target: {
            '@type': 'EntryPoint',
            urlTemplate: 'https://myhouse.example.com/book?checkin={checkin}&checkout={checkout}',
        },
        landlord: { '@id': ids.person },
        priceSpecification: {
            '@type': 'UnitPriceSpecification',
            price: 250,
            priceCurrency: 'EUR',
            unitCode: 'DAY',
        },
    },
}),
```

**URL template variables for rentals:** `{checkin}`, `{checkout}`, `{guests}`
are conventional but not standardized. Use names that match your booking form's
query parameters.

For rentals through an agency:

```ts
potentialAction: {
    '@type': 'RentAction',
    target: {
        '@type': 'EntryPoint',
        url: 'https://bookingagency.com/listing/villa-example',
    },
    landlord: { '@id': ids.person },
    realEstateAgent: {
        '@type': 'RealEstateAgent',
        name: 'Tuscany Villas Agency',
        url: 'https://bookingagency.com/',
    },
},
```

### Requesting a quote

For services or products with custom pricing (B2B, consulting, configured
products):

```ts
potentialAction: {
    '@type': 'QuoteAction',
    target: {
        '@type': 'EntryPoint',
        url: 'https://agency.example.com/contact',
    },
    description: 'Request a project quote',
},
```

### Marketplace listings

Marketplaces often need both buy and make-offer actions:

```ts
potentialAction: [
    {
        '@type': 'BuyAction',
        target: {
            '@type': 'EntryPoint',
            url: buyNowUrl,
        },
        seller: { '@id': sellerPersonId },
        price: 499,
        priceCurrency: 'USD',
    },
    {
        '@type': 'QuoteAction',
        target: {
            '@type': 'EntryPoint',
            url: makeOfferUrl,
        },
        description: 'Make an offer',
    },
],
```

### Donations and tips

For open source projects, creators, or nonprofits:

```ts
potentialAction: {
    '@type': 'TipAction',
    target: {
        '@type': 'EntryPoint',
        url: 'https://example.com/donate',
    },
    description: 'Support this project',
    recipient: { '@id': ids.person },
},
```

### Combining actions with SearchAction

Many entities benefit from multiple actions. A WebSite typically has a
`SearchAction`; the entities within it have trade actions:

```ts
import type { Product } from 'schema-dts';

// WebSite: how to search
buildWebSite({
    url: siteUrl,
    name: 'My Shop',
    publisher: { '@id': ids.organization('shop') },
    potentialAction: {
        '@type': 'SearchAction',
        target: {
            '@type': 'EntryPoint',
            urlTemplate: `${siteUrl}search?q={search_term_string}`,
        },
        'query-input': {
            '@type': 'PropertyValueSpecification',
            valueRequired: true,
            valueName: 'search_term_string',
        },
    },
}, ids),

// Product: how to buy
buildPiece<Product>({
    '@type': 'Product',
    '@id': `${url}#product`,
    name: productName,
    potentialAction: {
        '@type': 'BuyAction',
        target: { '@type': 'EntryPoint', url: addToCartUrl },
        seller: { '@id': ids.organization('shop') },
    },
}),
```

### When to use which action

| Scenario                        | Action                                                  | Why                             |
| ------------------------------- | ------------------------------------------------------- | ------------------------------- |
| E-commerce product, buy now     | `BuyAction`                                             | Direct purchase, immediate      |
| E-commerce product, add to cart | `BuyAction`                                             | Still a buy intent              |
| Product not yet released        | `PreOrderAction`                                        | Signals future availability     |
| Physical goods with shipping    | `OrderAction` + `deliveryMethod`                        | Delivery is part of the action  |
| Vacation rental booking         | `RentAction` + `landlord`                               | Temporal use, not ownership     |
| Car rental                      | `RentAction`                                            | Temporal use                    |
| Equipment rental                | `RentAction`                                            | Temporal use                    |
| Custom/B2B pricing              | `QuoteAction`                                           | Price not fixed                 |
| Consulting services             | `QuoteAction`                                           | Scope-dependent pricing         |
| Marketplace: fixed price        | `BuyAction` + `seller`                                  | Direct from seller              |
| Marketplace: negotiable         | `BuyAction` + `QuoteAction`                             | Both options available          |
| SaaS free trial                 | `BuyAction` with `price: 0`                             | Free is still a transaction     |
| Donations / support             | `TipAction` + `recipient`                               | Voluntary, no product exchanged |
| Subscription                    | `BuyAction` + `priceSpecification` with `billingPeriod` | Recurring purchase              |

---

## Multi-type entities

An entity can have multiple `@type` values. This is useful when an entity
legitimately belongs to more than one type:

```ts
buildPiece({
    '@type': ['Organization', 'Brand'],
    '@id': ids.organization('acme'),
    name: 'Acme',
    url: 'https://acme.com/',
    logo: {
        /* ... */
    },
});
```

This is appropriate for companies that are also consumer-facing brands.

Common multi-type combinations:

- `['Organization', 'Brand']` — Company with brand identity
- `['LocalBusiness', 'Restaurant']` — Specific local business type
- `['Person', 'Patient']` — Context-specific
- `['WebPage', 'ItemPage']` — Product detail pages
- `['WebPage', 'FAQPage']` — FAQ pages (alternative to separate FAQPage entity)

**Note:** With `buildPiece`, pass the `@type` array directly:

```ts
buildPiece({
    '@type': ['Organization', 'Brand'],
    '@id': ids.organization('acme'),
    name: 'Acme',
    url: 'https://acme.com/',
});
```

---

## Rich Organization patterns

For established businesses, a richer Organization entity improves knowledge
graph representation. Here's the full pattern:

```ts
import type { Organization } from 'schema-dts';

buildPiece<Organization>({
    '@type': 'Organization',
    '@id': ids.organization('acme'),
    name: 'Acme Corp',
    url: 'https://acme.com/',
    logo: 'https://acme.com/logo.png',
    description: 'We build developer tools.',
    sameAs: [
        'https://twitter.com/acme',
        'https://linkedin.com/company/acme',
        'https://github.com/acme',
        'https://en.wikipedia.org/wiki/Acme_Corp',
    ],
    legalName: 'Acme Corp B.V.',
    foundingDate: '2015-03-01',
    founder: {
        '@type': 'Person',
        name: 'Jane Doe',
        sameAs: 'https://en.wikipedia.org/wiki/Jane_Doe',
    },
    numberOfEmployees: 45,
    slogan: 'Tools for the modern web',
    parentOrganization: {
        '@type': 'Organization',
        name: 'Parent Holdings Inc',
        url: 'https://parent.com/',
    },
    memberOf: {
        '@type': 'Organization',
        name: 'World Wide Web Consortium (W3C)',
        url: 'https://w3.org/',
    },
    address: {
        '@type': 'PostalAddress',
        streetAddress: '123 Tech Lane',
        addressLocality: 'Amsterdam',
        addressCountry: 'NL',
    },
});
```

Include as much as is factually accurate. Don't fabricate data. Properties like
`numberOfEmployees`, `foundingDate`, and `founder` are especially valuable for
knowledge graph matching.

---

## Rich Person patterns

For personal sites, a detailed Person entity establishes identity and
credibility. jonoalderson.com uses 80+ entities. Here's the extended pattern:

```ts
import type { Person } from 'schema-dts';

buildPiece<Person>({
    '@type': 'Person',
    '@id': ids.person,
    name: 'Jane Doe',
    familyName: 'Doe',
    birthDate: '1990-01-15',
    gender: 'female',
    nationality: { '@id': ids.country('US') },
    description: 'Software engineer and technical writer.',
    jobTitle: 'Lead Engineer',
    knowsLanguage: ['en', 'es', 'pt'],
    url: 'https://janedoe.com/about/',
    image: { '@id': ids.personImage },
    sameAs: [
        'https://twitter.com/janedoe',
        'https://github.com/janedoe',
        'https://linkedin.com/in/janedoe',
        'https://bsky.app/profile/janedoe.com',
        'https://mastodon.social/@janedoe',
        'https://en.wikipedia.org/wiki/Jane_Doe',
    ],
    worksFor: [
        {
            '@type': 'EmployeeRole',
            roleName: 'Lead Engineer',
            startDate: '2022-01',
            worksFor: { '@id': ids.organization('acme') },
        },
        {
            '@type': 'EmployeeRole',
            roleName: 'Advisor',
            startDate: '2024-06',
            worksFor: { '@id': ids.organization('startup') },
        },
    ],
    spouse: {
        '@type': 'Person',
        '@id': `${siteUrl}/#/schema.org/Person/john`,
        name: 'John Doe',
    },
    knowsAbout: ['TypeScript', 'Schema.org', 'Search Engine Optimization', 'Web Performance'],
    honorificPrefix: 'Dr.',
    alumniOf: {
        '@type': 'EducationalOrganization',
        name: 'MIT',
        url: 'https://mit.edu/',
    },
    award: ['Best Developer Blog 2025', 'Open Source Contributor of the Year 2024'],
});
```

**Practical advice:**

- `sameAs` is the most impactful property after name and url. It helps search
  engines connect your entity to external profiles and knowledge bases.
- `worksFor` with `EmployeeRole` is better than plain Organization references
  because it captures role and tenure.
- `knowsAbout` helps topical authority signals.
- Include a Wikipedia `sameAs` link if one exists; it strongly anchors the
  entity in the knowledge graph.

---

## Reference implementations

Study these live sites for schema.org graph patterns. View any page's graph
by searching the page source for `application/ld+json`.

### jonoalderson.com

An extensively structured personal site by Jono Alderson (former Head of SEO
at Yoast, one of the foremost schema.org experts). Uses `BlogPosting` for
articles and has one of the richest Person schemas on the web:

**Notable patterns:**

- 80+ entities on the homepage, 12+ on article pages
- `BlogPosting` instead of `Article` for blog content
- Person entity with `birthDate`, `birthPlace`, `nationality`, `award`,
  `spouse`, `pronouns`, employment history via `EmployeeRole`
- Organization entities for every company in work history
- Separate `Blog` entity as part of the WebSite
- `SearchAction` with `EntryPoint` and `PropertyValueSpecification` on WebSite

### meta.com (product pages)

Meta's product pages (e.g. `/ai-glasses/ray-ban-meta-wayfarer-gen-2/`) are
an excellent reference for e-commerce schema:

**Notable patterns:**

- `ProductGroup` with `hasVariant` array pointing to individual `Product` entities
- 14 product variants, each with their own `sku`, `color`, `size`, and `Offer`
- `MerchantReturnPolicy` with return window, method, and shipping cost
- `OfferShippingDetails` with delivery cost and shipping destination
- `BreadcrumbList` for product category navigation
- `ItemPage` (WebPage subtype) for product detail pages
- `Organization` with `legalName` ("Meta Platforms, Inc.") and social profiles
- Dual brand references (Ray-Ban + Meta)

**Key takeaway for e-commerce:** Use `ProductGroup` when a product has variants
(sizes, colors). Each variant gets its own `Product` entity with a unique `sku`.
The `ProductGroup` ties them together.

### joost.blog

This library's own reference consumer. Astro site using `<Seo>` from
`@jdevalk/astro-seo-graph`. Source code at
[github.com/jdevalk/joost.blog](https://github.com/jdevalk/joost.blog).

**Notable patterns:**

- Schema endpoints at `/schema/post.json`, `/schema/video.json`,
  `/schema/page.json` with full article bodies (markdown-stripped, max 10K chars)
- Schema map at `/schemamap.xml` for agent discovery
- Person entity with 7 Organization references via `EmployeeRole`
- Country entity for nationality
- Family members (spouse, children) on homepage/about page
- `ProfilePage` for about, `CollectionPage` for listings

### Validating against these references

When building a new site, compare your JSON-LD output against one of these
references for the same page type. Use Google's Rich Results Test
(https://search.google.com/test/rich-results) and check that:

1. Every `@id` reference resolves to an entity in the graph
2. The entity relationship tree is complete (WebSite → WebPage → Article)
3. The publisher chain is correct (Article.publisher and WebSite.publisher match)

---

## Astro integration guide

### The `<Seo>` component

Single component for all head metadata. Import from the Astro package:

```astro
---
import Seo from '@jdevalk/astro-seo-graph/Seo.astro';
---

<html>
<head>
    <Seo
        title="Page Title | Site Name"
        description="Page description for search engines."
        canonical="https://example.com/page/"
        ogType="article"
        ogImage="https://example.com/og/page.jpg"
        ogImageAlt="Description of the image"
        ogImageWidth={1200}
        ogImageHeight={675}
        siteName="Site Name"
        locale="en_US"
        twitter={{ card: 'summary_large_image', site: '@handle', creator: '@handle' }}
        article={{
            publishedTime: new Date('2026-01-15'),
            modifiedTime: new Date('2026-03-01'),
            authors: ['https://example.com/about/'],
            tags: ['TypeScript', 'SEO'],
            section: 'Technology',
        }}
        graph={graph}
        noindex={false}
        extraLinks={[
            { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
            { rel: 'sitemap', href: '/sitemap-index.xml' },
            { rel: 'alternate', type: 'application/rss+xml', href: '/feed.xml', title: 'RSS' },
        ]}
        extraMeta={[
            { name: 'author', content: 'Jane Doe' },
        ]}
    />
</head>
<body>...</body>
</html>
```

### `<Seo>` props reference

| Prop            | Type                                                                            | Required | Default          | Purpose                              |
| --------------- | ------------------------------------------------------------------------------- | -------- | ---------------- | ------------------------------------ |
| `title`         | `string`                                                                        | Yes      | —                | Full page title                      |
| `titleTemplate` | `string`                                                                        | No       | —                | Template with `%s` placeholder       |
| `description`   | `string`                                                                        | No       | —                | Meta description                     |
| `canonical`     | `string \| URL`                                                                 | No       | Current page URL | Canonical URL                        |
| `ogType`        | `'website' \| 'article' \| 'profile' \| 'book'`                                 | No       | `'website'`      | Open Graph type                      |
| `ogImage`       | `string`                                                                        | No       | —                | OG image (absolute URL)              |
| `ogImageAlt`    | `string`                                                                        | No       | —                | OG image alt text                    |
| `ogImageWidth`  | `number`                                                                        | No       | —                | OG image width (px)                  |
| `ogImageHeight` | `number`                                                                        | No       | —                | OG image height (px)                 |
| `siteName`      | `string`                                                                        | No       | —                | Site name for OG                     |
| `locale`        | `string`                                                                        | No       | `'en_US'`        | OG locale                            |
| `twitter`       | `{ card?, site?, creator? }`                                                    | No       | —                | Twitter card settings                |
| `article`       | `{ publishedTime?, modifiedTime?, expirationTime?, authors?, tags?, section? }` | No       | —                | Article OG metadata                  |
| `noindex`       | `boolean`                                                                       | No       | `false`          | Emit `robots: noindex`               |
| `graph`         | `object \| null`                                                                | No       | —                | JSON-LD graph from `assembleGraph()` |
| `alternates`    | `{ defaultLocale?, entries[] }`                                                 | No       | —                | hreflang alternate links             |
| `extraLinks`    | `Array<Record<string, string>>`                                                 | No       | —                | Additional `<link>` elements         |
| `extraMeta`     | `Array<Record<string, string>>`                                                 | No       | —                | Additional `<meta>` elements         |

### hreflang alternates

For multilingual sites:

```astro
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

**Rules:**

- Absolute URLs only. Relative, protocol-relative, and non-http schemes are dropped.
- Include the current page (self-referential hreflang is required by Google).
- BCP 47 tags are auto-normalized (fr-ca becomes fr-CA).
- `x-default` is added automatically, pointing at `defaultLocale`.
- If fewer than 2 entries survive validation, nothing is emitted.

### Schema endpoints

Expose a corpus-wide JSON-LD graph as an API endpoint:

```ts
// src/pages/schema/post.json.ts
import { createSchemaEndpoint } from '@jdevalk/astro-seo-graph';
import { getCollection } from 'astro:content';
import { makeIds, buildWebPage, buildArticle } from '@jdevalk/seo-graph-core';

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
    cacheControl: 'max-age=300', // optional, defaults to 5 minutes
    indent: 2, // optional, defaults to 2
});
```

**Options:**
| Option | Type | Default | Purpose |
|---|---|---|---|
| `entries` | `() => Promise<Entry[]>` | — | Async content source |
| `mapper` | `(entry: Entry) => GraphEntity[]` | — | Convert entry to schema pieces |
| `cacheControl` | `string \| null` | `'max-age=300'` | Cache-Control header. `null` to omit. |
| `contentType` | `string` | `'application/ld+json'` | Response content type |
| `indent` | `number` | `2` | JSON indentation. `0` for compact. |

### Schema map discovery

Provide a sitemap-style XML document listing your schema endpoints:

```ts
// src/pages/schemamap.xml.ts
import { createSchemaMap } from '@jdevalk/astro-seo-graph';

export const GET = createSchemaMap({
    siteUrl: 'https://example.com',
    entries: [
        { path: '/schema/post.json', lastModified: new Date('2026-04-10') },
        { path: '/schema/video.json', lastModified: new Date('2026-03-15') },
        { path: '/schema/page.json', lastModified: new Date('2026-02-01') },
    ],
});
```

**Schema map entry options:**
| Field | Type | Default | Purpose |
|---|---|---|---|
| `path` | `string` | — | Relative path to schema endpoint |
| `lastModified` | `Date` | — | Last modification date |
| `changeFreq` | Sitemap frequency string | `'daily'` | Update frequency hint |
| `priority` | `number` | `0.8` | Priority hint (0.0-1.0) |

### API catalog (RFC 9727)

Serve a standards-compliant API catalog at `/.well-known/api-catalog`
([RFC 9727](https://www.rfc-editor.org/rfc/rfc9727)) so agent crawlers
can discover the site's APIs in one fetch:

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
        { anchor: '/ask', serviceDoc: '/ask-docs/', type: 'https://schema.org/SearchAction' },
    ],
});
```

Output is `application/linkset+json` ([RFC 9264](https://www.rfc-editor.org/rfc/rfc9264)).
`schemaEndpoints` get auto-typed as `https://schema.org/<schemaType>`;
`schemaMap` is emitted without a `type` (no standard one exists);
`additional` accepts free-form `anchor`/`serviceDoc`/`type` (each
either `string` or `string[]`). Relative paths are absolutized against
`siteUrl`; absolute URLs pass through unchanged.

The package also exports a `CATALOG_PATH` constant
(`'/.well-known/api-catalog'`) so callers can reference the canonical
location without duplicating the string.

**Options:**
| Option | Type | Default | Purpose |
|---|---|---|---|
| `siteUrl` | `string` | — | Canonical origin. Trailing slash stripped. |
| `schemaEndpoints` | `ApiCatalogSchemaEndpointEntry[]` | — | Schema.org JSON endpoints with `path` + `schemaType`. |
| `schemaMap` | `ApiCatalogSchemaMapEntry` | — | Path of the `createSchemaMap` route. |
| `additional` | `ApiCatalogEntry[]` | — | Site-specific APIs not covered by the package factories. |
| `cacheControl` | `string \| null` | `'max-age=300'` | Cache-Control header. `null` to omit. |
| `contentType` | `string` | `'application/linkset+json'` | Override only with reason. |
| `indent` | `number` | `2` | JSON indentation. `0` for compact. |

### Last-modified dates from git

`gitLastmod` reads the committer date of the most recent git commit
that touched a file, with configurable `excludeCommits` (skip bulk
imports / reformats / renames) and `depth` (how many commits to
inspect). Use it to feed `dateModified` on JSON-LD pieces or
`<lastmod>` in sitemaps without trusting filesystem `mtime` (which
gets rewritten on every CI checkout):

```ts
import { gitLastmod } from '@jdevalk/astro-seo-graph';

const last = gitLastmod(`src/content/blog/${entry.id}/index.md`, {
    excludeCommits: ['52130a9', '989dc47'],
    depth: 20,
});
```

Returns `null` when the file has no git history, git isn't on the
PATH, or every commit in the inspected window is excluded — fall back
to `publishDate` in that case. `excludeCommits` matches on the first 7
characters of the SHA, so short hashes from `git log --oneline` work
directly. Build-time only — shells out to the `git` binary via
`execFileSync`.

### The `aggregate` function

The engine behind `createSchemaEndpoint`. Use directly when you need custom
assembly, caching, or multi-collection merging:

```ts
import { aggregate } from '@jdevalk/astro-seo-graph';

const result = aggregate({
    entries: await getCollection('blog'),
    mapper: (post) => [...buildPiecesForPost(post)],
});
// result = { '@context': 'https://schema.org', '@graph': [...] }
```

### Zod content helpers

Use in `src/content.config.ts` to validate SEO fields on content collections:

```ts
import { defineCollection, z } from 'astro:content';
import { seoSchema, imageSchema } from '@jdevalk/astro-seo-graph';

const blog = defineCollection({
    schema: ({ image }) =>
        z.object({
            title: z.string(),
            publishDate: z.coerce.date(),
            excerpt: z.string().optional(),
            featureImage: imageSchema(image).optional(),
            seo: seoSchema(image).optional(),
        }),
});
```

**`seoSchema(image)` shape:**

```ts
{
    title: z.string().min(5).max(120).optional(),
    description: z.string().min(15).max(160).optional(),
    image: imageSchema(image).optional(),
    pageType: z.enum(['website', 'article']).default('website'),
}
```

**`imageSchema(image)` shape:**

```ts
{
    src: image(),
    alt: z.string().optional(),
}
```

### `buildSeoContext`

Pure-TS function that powers `<Seo>` internally. Returns a flat,
render-ready normalization of `SeoProps` (resolved title, canonical, OG
fields, hreflang entries, robots directives, twitter overrides). Use when
you want to render the head yourself:

```ts
import { buildSeoContext } from '@jdevalk/astro-seo-graph';

const ctx = buildSeoContext(mySeoProps, Astro.url.href);
// ctx.title, ctx.canonical, ctx.og.*, ctx.twitter, ctx.hreflangs, ...
```

The companion constant `ROBOTS_EXTRAS` exposes the
`max-snippet:-1, max-image-preview:large, max-video-preview:-1`
directives that `<Seo>` always appends to the robots tag.

### `buildAlternateLinks`

Pure helper for hreflang link generation. No Astro runtime needed — safe
to use from non-Astro contexts:

```ts
import { buildAlternateLinks } from '@jdevalk/astro-seo-graph';

const links = buildAlternateLinks({
    defaultLocale: 'en',
    entries: [
        { hreflang: 'en', href: 'https://example.com/hello/' },
        { hreflang: 'fr', href: 'https://example.com/fr/bonjour/' },
    ],
});
// → [{ rel: 'alternate', hreflang: 'en', href: '...' }, ..., { hreflang: 'x-default', ... }]
```

---

## Build-time integration

`@jdevalk/astro-seo-graph/integration` exports a default `seoGraph()`
function that returns an Astro integration. It hooks `astro:build:done`
to run cross-page SEO checks and optional post-build actions against the
static HTML output. SSR pages aren't on disk at build time, so they're
not checked.

```js
// astro.config.mjs
import { defineConfig } from 'astro/config';
import seoGraph from '@jdevalk/astro-seo-graph/integration';

export default defineConfig({
    site: 'https://example.com',
    integrations: [
        seoGraph({
            // All options below are optional; listed with defaults.
            validateH1: true,
            validateUniqueMetadata: true,
            validateImageAlt: true,
            validateMetadataLength: true, // or { title: { max: 60 }, ... }
            validateInternalLinks: true, // or { skip: (href) => href.startsWith('/api/') }
            // indexNow: { ... },
            // llmsTxt: { ... },
        }),
    ],
});
```

### Options

| Option                   | Default | Purpose                                                                                                                                           |
| ------------------------ | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `validateH1`             | `true`  | Warn when a page has zero or >1 `<h1>` elements.                                                                                                  |
| `validateUniqueMetadata` | `true`  | Warn when two pages share the same `<title>` or meta description.                                                                                 |
| `validateImageAlt`       | `true`  | Warn when a page has `<img>` tags missing an `alt` attribute.                                                                                     |
| `validateMetadataLength` | `true`  | Warn when `<title>` or description length falls outside SERP-friendly bounds (title 30–65, description 70–200 by default; overridable per-field). |
| `validateInternalLinks`  | `true`  | Warn on trailing-slash mismatches and links to pages not in the build. Accepts `{ skip }` to exclude SSR-only routes.                             |
| `indexNow`               | —       | Submit built URLs to IndexNow. Omit to disable.                                                                                                   |
| `llmsTxt`                | —       | Generate `llms.txt` at the root of the build output. Omit to disable.                                                                             |

### H1 and metadata validation

`validateH1` flags pages with missing or duplicate `<h1>` elements — the
most common on-page SEO/accessibility miss. `validateUniqueMetadata`
flags `<title>` or `<meta name="description">` values that repeat across
pages; duplicates hurt Google's ability to pick a canonical result and
can only be spotted across the whole corpus. `validateImageAlt` flags
`<img>` tags missing an `alt` attribute. WCAG-sanctioned decorative
markers are respected: `alt=""` (the canonical pattern) and
`role="presentation"`/`role="none"` (removes the image from the
accessibility tree) are not flagged. Only a tag with neither triggers a
warning.

`validateMetadataLength` flags `<title>` and `<meta name="description">`
values outside the configured bounds. Pass `true` for the defaults
(title 30–65, description 70–200) or an object to override per-field:

```ts
validateMetadataLength: {
    title: { min: 40, max: 60 },
    description: { max: 160 },
},
```

`validateInternalLinks` scans `<a href>` values across every built page
and flags two classes of issue: trailing-slash mismatches (e.g. linking
to `/about-me` when the built page is `/about-me/` — "works" via
redirect but wastes a round-trip on every click) and true 404s (links
to paths not in the build). Only same-origin (via `config.site`) and
root-relative links are checked; external URLs, `mailto:`, `tel:`, and
fragment-only links are skipped.

Explicit redirects are honored by default: sources in
`public/_redirects` (Netlify / Cloudflare Pages format) and literal
keys in Astro's `redirects` config are treated as valid link targets.
Dynamic rules (`*`, `:splat`, `[slug]` params) are skipped — use
`skip` for those cases. Set `honorRedirects: false` to opt out (useful
when auditing for redirect hops).

Pass `{ skip: (href) => boolean }` to exclude SSR-only routes or paths
handled at the host/CDN layer.

The extractors, helpers, and the length resolver are exported for reuse:

```ts
import {
    classifyInternalLink,
    collectAstroRedirectSources,
    countH1s,
    DEFAULT_METADATA_LENGTH_BOUNDS,
    extractAnchorHrefs,
    extractTitle,
    extractMetaDescription,
    findImagesWithoutAlt,
    htmlFileToPath,
    parseNetlifyRedirects,
    resolveMetadataLengthBounds,
} from '@jdevalk/astro-seo-graph/integration';
```

### IndexNow submission

```js
seoGraph({
    indexNow: {
        key: process.env.INDEXNOW_KEY!, // 8–128 hex chars
        host: 'example.com',
        siteUrl: 'https://example.com',
        // keyLocation?: defaults to https://<host>/<key>.txt
        // endpoint?: defaults to api.indexnow.org
        // filter?: (url) => boolean — composed on top of the built-in
        //   /404 exclusion. Example skipping paginated archives:
        //   filter: (url) => !/^\/blog\/\d+\/$/.test(new URL(url).pathname),
    },
});
```

Only URLs on `host` are submitted. `index.html` paths are rewritten to
their trailing-slash form. `/404` (and `/404/`) are always excluded —
search engines don't need to be notified about the 404 page and
submitting it wastes daily IndexNow quota.

**Deploy the key file first.** IndexNow verifies ownership by fetching
`https://<host>/<key>.txt` on every submission. Submissions sent before
the key is reachable in production get rejected (HTTP 403) and the key
is treated as invalid — you'll have to rotate it. Serve the key via
`createIndexNowKeyRoute` (see below), deploy, confirm the `.txt` loads
over HTTPS, _then_ enable `indexNow` in the integration.

```ts
// src/pages/[your-key-here].txt.ts
import { createIndexNowKeyRoute } from '@jdevalk/astro-seo-graph';

export const GET = createIndexNowKeyRoute({ key: 'your-key-here' });
```

The filename (minus `.txt.ts`) must equal the key.

### llms.txt generation

Generates an [`llms.txt`](https://llmstxt.org) file — a markdown summary
of the site that LLMs can use as a concise entry point.

```js
seoGraph({
    llmsTxt: {
        title: 'Example Site',
        siteUrl: 'https://example.com',
        summary: 'A demo site about X, Y, and Z.',
        // details?: extra paragraphs between summary and sections
        // sections?: user-supplied sections (skips auto-collection)
        // filter?: (url) => boolean — drop URLs from auto-section
        // autoSectionName?: defaults to 'Pages'
        // outputPath?: defaults to 'llms.txt'
    },
});
```

By default, one "Pages" section is auto-generated from every built HTML
file's `<title>` + meta description. Supply `sections` to take full
control of the structure:

```js
llmsTxt: {
    title: 'Example Site',
    siteUrl: 'https://example.com',
    sections: [
        {
            name: 'Docs',
            links: [
                { url: 'https://example.com/docs/intro/', title: 'Intro', description: 'Start here' },
            ],
        },
        { name: 'Blog', links: [/* ... */] },
    ],
}
```

The renderer is also exported for non-Astro contexts:

```ts
import { renderLlmsTxt } from '@jdevalk/astro-seo-graph';

const markdown = renderLlmsTxt({
    title: 'Example',
    summary: 'A demo site.',
    sections: [{ name: 'Pages', links: [{ url: 'https://x/', title: 'Home' }] }],
});
```

---

## Complete integration example

Here's how joost.blog wires everything together. Use this as a reference
for a full personal blog setup.

### 1. Content config (`src/content.config.ts`)

```ts
import { defineCollection, z } from 'astro:content';
import { seoSchema, imageSchema } from '@jdevalk/astro-seo-graph';

const blog = defineCollection({
    schema: ({ image }) =>
        z.object({
            title: z.string(),
            excerpt: z.string().optional(),
            publishDate: z.coerce.date(),
            updatedDate: z.coerce.date().optional(),
            featureImage: imageSchema(image).optional(),
            featureImageAlt: z.string().optional(),
            categories: z.array(z.string()).optional(),
            draft: z.boolean().default(false),
            seo: seoSchema(image).optional(),
        }),
});
```

### 2. Schema utility (`src/utils/schema/index.ts`)

```ts
import {
    makeIds,
    assembleGraph,
    buildWebSite,
    buildPiece,
    buildWebPage,
    buildArticle,
    buildBreadcrumbList,
    buildImageObject,
    buildSiteNavigationElement,
} from '@jdevalk/seo-graph-core';
import type { Person } from 'schema-dts';

const SITE_URL = 'https://example.com';
export const ids = makeIds({ siteUrl: SITE_URL, personUrl: `${SITE_URL}/about/` });

// Site-wide entities — included on every page
function siteWideEntities() {
    return [
        buildWebSite(
            { url: `${SITE_URL}/`, name: 'My Blog', publisher: { '@id': ids.person } },
            ids,
        ),
        buildPiece<Person>({
            '@type': 'Person',
            '@id': ids.person,
            name: 'Jane Doe',
            url: `${SITE_URL}/about/`,
            image: { '@id': ids.personImage },
            sameAs: ['...'],
        }),
        buildImageObject(
            { id: ids.personImage, url: `${SITE_URL}/jane.jpg`, width: 400, height: 400 },
            ids,
        ),
        buildSiteNavigationElement(
            {
                name: 'Main navigation',
                isPartOf: { '@id': ids.website },
                items: [
                    { name: 'Home', url: `${SITE_URL}/` },
                    { name: 'Blog', url: `${SITE_URL}/blog/` },
                    { name: 'About', url: `${SITE_URL}/about/` },
                ],
            },
            ids,
        ),
    ];
}

// Page-specific graph builder
export function buildSchemaGraph(opts: {
    pageType: string;
    url: string;
    title: string;
    description: string;
    publishDate?: Date;
    updatedDate?: Date;
    featureImageUrl?: string;
    category?: string;
}) {
    const pieces = [...siteWideEntities()];
    const { url, title, description, publishDate, updatedDate, featureImageUrl, category } = opts;

    switch (opts.pageType) {
        case 'blogPost':
            pieces.push(
                buildWebPage(
                    {
                        url,
                        name: title,
                        isPartOf: { '@id': ids.website },
                        breadcrumb: { '@id': ids.breadcrumb(url) },
                        datePublished: publishDate,
                        dateModified: updatedDate,
                        primaryImage: featureImageUrl
                            ? { '@id': ids.primaryImage(url) }
                            : undefined,
                    },
                    ids,
                ),
                buildArticle(
                    {
                        url,
                        isPartOf: { '@id': ids.webPage(url) },
                        author: { '@id': ids.person },
                        publisher: { '@id': ids.person },
                        headline: title,
                        description,
                        datePublished: publishDate!,
                        dateModified: updatedDate,
                        image: featureImageUrl ? { '@id': ids.primaryImage(url) } : undefined,
                        articleSection: category,
                    },
                    ids,
                ),
                buildBreadcrumbList(
                    {
                        url,
                        items: [
                            { name: 'Home', url: `${SITE_URL}/` },
                            { name: 'Blog', url: `${SITE_URL}/blog/` },
                            { name: title, url },
                        ],
                    },
                    ids,
                ),
            );
            if (featureImageUrl) {
                pieces.push(
                    buildImageObject(
                        { pageUrl: url, url: featureImageUrl, width: 1200, height: 630 },
                        ids,
                    ),
                );
            }
            break;
        case 'blogListing':
            pieces.push(
                buildWebPage(
                    { url, name: title, isPartOf: { '@id': ids.website } },
                    ids,
                    'CollectionPage',
                ),
            );
            break;
        case 'about':
            pieces.push(
                buildWebPage(
                    {
                        url,
                        name: title,
                        isPartOf: { '@id': ids.website },
                        about: { '@id': ids.person },
                    },
                    ids,
                    'ProfilePage',
                ),
            );
            break;
        default:
            pieces.push(buildWebPage({ url, name: title, isPartOf: { '@id': ids.website } }, ids));
    }

    return assembleGraph(pieces);
}
```

### 3. Head component (`src/components/BaseHead.astro`)

```astro
---
import Seo from '@jdevalk/astro-seo-graph/Seo.astro';
import { buildSchemaGraph } from '../utils/schema';

const { title, description, pageType = 'page', publishDate, categories } = Astro.props;

const graph = buildSchemaGraph({
    pageType,
    url: Astro.url.href,
    title,
    description,
    publishDate,
    category: categories?.[0],
});

const ogImage = new URL(`/og/${Astro.url.pathname.replace(/\//g, '') || 'index'}.jpg`, Astro.site).toString();
---

<Seo
    title={`${title} | My Blog`}
    description={description}
    canonical={Astro.url.href}
    ogType={pageType === 'blogPost' ? 'article' : 'website'}
    ogImage={ogImage}
    ogImageAlt={title}
    ogImageWidth={1200}
    ogImageHeight={675}
    siteName="My Blog"
    twitter={{ card: 'summary_large_image', site: '@handle' }}
    article={pageType === 'blogPost' && publishDate ? { publishedTime: publishDate, tags: categories } : undefined}
    graph={graph}
    extraLinks={[
        { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
        { rel: 'sitemap', href: '/sitemap-index.xml' },
    ]}
/>
```

### 4. Schema endpoint (`src/pages/schema/post.json.ts`)

```ts
import { createSchemaEndpoint } from '@jdevalk/astro-seo-graph';
import { getCollection } from 'astro:content';
import { ids } from '../../utils/schema';
import { buildWebPage, buildArticle, buildBreadcrumbList } from '@jdevalk/seo-graph-core';

const SITE_URL = 'https://example.com';

export const GET = createSchemaEndpoint({
    entries: async () => {
        const posts = await getCollection('blog');
        return posts.filter((p) => !p.data.draft);
    },
    mapper: (post) => {
        const url = `${SITE_URL}/${post.id}/`;
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
                    dateModified: post.data.updatedDate,
                },
                ids,
            ),
            buildBreadcrumbList(
                {
                    url,
                    items: [
                        { name: 'Home', url: `${SITE_URL}/` },
                        { name: 'Blog', url: `${SITE_URL}/blog/` },
                        { name: post.data.title, url },
                    ],
                },
                ids,
            ),
        ];
    },
});
```

### 5. Schema map (`src/pages/schemamap.xml.ts`)

```ts
import { createSchemaMap } from '@jdevalk/astro-seo-graph';

export const GET = createSchemaMap({
    siteUrl: 'https://example.com',
    entries: [{ path: '/schema/post.json', lastModified: new Date() }],
});
```

---

## Advanced patterns

### Multiple organizations

When a person works for several companies, create an organization for each:

```ts
import type { Organization, Person } from 'schema-dts';

const orgs = [
    { slug: 'acme', name: 'Acme Corp', url: 'https://acme.com/' },
    { slug: 'side-project', name: 'Side Project Inc', url: 'https://sideproject.com/' },
];

const orgPieces = orgs.map((org) =>
    buildPiece<Organization>({
        '@type': 'Organization',
        '@id': ids.organization(org.slug),
        name: org.name,
        url: org.url,
    }),
);

const personPiece = buildPiece<Person>({
    '@type': 'Person',
    '@id': ids.person,
    name: 'Jane Doe',
    worksFor: [
        {
            '@type': 'EmployeeRole',
            roleName: 'CEO',
            startDate: '2020',
            worksFor: { '@id': ids.organization('acme') },
        },
        {
            '@type': 'EmployeeRole',
            roleName: 'Advisor',
            startDate: '2023',
            worksFor: { '@id': ids.organization('side-project') },
        },
    ],
});
```

### Organization subtypes

Use the schema.org subtype directly as the `buildPiece` generic for full type safety:

```ts
import type { Dentist, Hotel } from 'schema-dts';

buildPiece<Dentist>({
    '@type': 'Dentist',
    '@id': ids.organization('clinic'),
    name: 'Smile Dental',
    medicalSpecialty: 'Dentistry',
});
buildPiece<Hotel>({
    '@type': 'Hotel',
    '@id': ids.organization('hotel'),
    name: 'Grand Hotel',
    starRating: { '@type': 'Rating', ratingValue: 4 },
    checkinTime: '15:00',
    checkoutTime: '11:00',
});
```

### Multi-author blogs

When different posts have different authors, use `buildPiece<Person>` with a
custom `@id` for each author (reserving `ids.person` for the site-wide person):

```ts
import type { Person } from 'schema-dts';

const authorId = `${siteUrl}/authors/${authorSlug}/#person`;
const authorPiece = buildPiece<Person>({
    '@type': 'Person',
    '@id': authorId,
    name: authorName,
    url: `${siteUrl}/authors/${authorSlug}/`,
    image: authorAvatarUrl,
});
const articlePiece = buildArticle(
    {
        url,
        isPartOf: { '@id': ids.webPage(url) },
        author: { '@id': authorId },
        publisher: { '@id': ids.organization('company') },
        headline: title,
        description,
        datePublished,
    },
    ids,
);
```

### Non-Astro usage (Next.js, SvelteKit, etc.)

Use `@jdevalk/seo-graph-core` directly. Build your graph, then inject it as a
`<script type="application/ld+json">` tag:

```tsx
// Next.js example
import {
    makeIds,
    assembleGraph,
    buildWebSite,
    buildWebPage,
    buildArticle,
} from '@jdevalk/seo-graph-core';

const ids = makeIds({ siteUrl: 'https://example.com' });

export default function BlogPost({ post }) {
    const url = `https://example.com/blog/${post.slug}`;
    const graph = assembleGraph([
        buildWebSite(
            { url: 'https://example.com/', name: 'My Site', publisher: { '@id': ids.person } },
            ids,
        ),
        buildWebPage(
            {
                url,
                name: post.title,
                isPartOf: { '@id': ids.website },
                datePublished: new Date(post.date),
            },
            ids,
        ),
        buildArticle(
            {
                url,
                isPartOf: { '@id': ids.webPage(url) },
                author: { '@id': ids.person },
                publisher: { '@id': ids.person },
                headline: post.title,
                description: post.excerpt,
                datePublished: new Date(post.date),
            },
            ids,
        ),
    ]);

    return (
        <>
            <Head>
                <title>{post.title} | My Site</title>
                <script
                    type="application/ld+json"
                    dangerouslySetInnerHTML={{ __html: JSON.stringify(graph) }}
                />
            </Head>
            <article>{post.content}</article>
        </>
    );
}
```

---

## Common mistakes

1. **Forgetting to link entities.** Every `Article` needs `isPartOf` pointing to
   its `WebPage`. Every `WebPage` needs `isPartOf` pointing to the `WebSite`.
   Missing links produce valid JSON-LD but an unconnected graph that search
   engines can't walk.

2. **Duplicating site-wide entities.** `WebSite` and `Person` should appear once
   in the graph. `assembleGraph` deduplicates by `@id` (first wins), so it's
   safe to include them in every page's piece array.

3. **Using wrong WebPage subtype.** Archive/listing pages should be
   `CollectionPage`, not `WebPage`. About pages should be `ProfilePage`.

4. **Relative URLs.** All URLs in the graph must be absolute
   (`https://example.com/page/`, not `/page/`).

5. **Missing trailing slashes.** Be consistent. If your site uses trailing
   slashes, use them everywhere in the graph. Mismatched URLs create
   duplicate entities.

6. **Inlining entities instead of referencing.** Don't put a full Person object
   inside an Article's `author` field. Use `{ '@id': ids.person }` and let the
   graph resolver connect them.

7. **Not including the graph in the page head.** Building the graph is step one.
   You still need to render it as `<script type="application/ld+json">` in
   your page. The `<Seo>` component handles this via the `graph` prop. In
   non-Astro setups, inject it manually.

8. **Omitting `@context`.** Always use `assembleGraph()` to wrap your pieces.
   It adds `"@context": "https://schema.org"` automatically. Don't build the
   envelope by hand.

---

## Validating your output

After building a graph, validate it:

1. **Google Rich Results Test:** https://search.google.com/test/rich-results
2. **Schema.org Validator:** https://validator.schema.org/
3. **Check `@id` resolution:** Every `{ "@id": "..." }` reference in the graph
   should have a matching entity with that `@id`. If not, the reference is
   broken.

---

## Repository structure

```
seo-graph/
├── packages/
│   ├── seo-graph-core/     # @jdevalk/seo-graph-core
│   │   └── src/
│   │       ├── index.ts     # All exports
│   │       ├── ids.ts       # makeIds, IdFactory
│   │       ├── assemble.ts  # assembleGraph, deduplicateByGraphId
│   │       ├── builders/    # One file per piece builder
│   │       └── types.ts     # GraphEntity, Reference, SchemaGraph
│   └── astro-seo-graph/     # @jdevalk/astro-seo-graph
│       └── src/
│           ├── index.ts          # All exports
│           ├── Seo.astro         # <Seo> component
│           ├── routes.ts         # createSchemaEndpoint, createSchemaMap
│           ├── aggregator.ts     # aggregate
│           ├── alternates.ts     # buildAlternateLinks
│           ├── content.ts        # seoSchema, imageSchema
│           └── components/
│               ├── seo-props.ts    # SeoProps interface
│               └── seo-context.ts  # buildSeoContext
├── AGENTS.md          # This file
├── README.md          # Project overview
└── pnpm-workspace.yaml
```
