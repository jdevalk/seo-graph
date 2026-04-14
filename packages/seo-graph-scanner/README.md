# @jdevalk/seo-graph-scanner

Sitemap-driven scanner that audits a live site's JSON-LD against seo-graph conventions. No crawling — the sitemap is the URL list.

**Status:** Prototype. Does two passes per page: structural validation of existing JSON-LD, and HTML inference → recommended-graph → diff against what the page actually emitted.

## CLI

```sh
# Point at a sitemap directly
npx seo-graph-scan https://example.com/sitemap.xml --limit 50

# Or at an origin; it probes /sitemap_index.xml then /sitemap.xml
npx seo-graph-scan https://example.com --limit 50

# JSON output for piping into other tools
npx seo-graph-scan https://example.com --json > report.json

# Skip the HTML-inference/recommendation pass (structural validation only)
npx seo-graph-scan https://example.com --no-recommend

# Also report live JSON-LD entity types the scanner didn't recommend
npx seo-graph-scan https://example.com --report-spurious
```

## Library

```ts
import { scanSite } from '@jdevalk/seo-graph-scanner';

const report = await scanSite('https://example.com/sitemap.xml', {
    sitemap: { limit: 100 },
    fetch: { concurrency: 4, intervalMs: 250 },
    recommend: { enabled: true, diff: { reportSpurious: false } },
});

for (const page of report.pages) {
    for (const finding of page.findings) {
        console.log(page.url, finding.severity, finding.code, finding.message);
    }
}
```

## What it checks today

### Structural validation (per JSON-LD block)

- JSON parseability
- Valid shape (`@graph`, entity, or array of entities)
- Every entity has `@type`
- Every entity has `@id` (warning — references won't resolve otherwise)
- Every `{ "@id": "..." }` reference resolves to an entity in the same block

### Per page

- No JSON-LD at all → warning
- Fetch failure → error

### HTML inference → recommendation → diff

The scanner infers facts from the page's HTML (OpenGraph, microdata, visible bylines, breadcrumb markup, images) and asks `@jdevalk/seo-graph-core`'s piece builders what a well-instrumented graph would look like. It then diffs that recommendation against the page's actual JSON-LD:

- **`missing-entity`** — a recommended type (WebSite, WebPage, Article, BreadcrumbList, ImageObject, Person, Organization, Product) isn't present in the live graph.
- **`missing-property`** — a matched entity is missing a property the recommender set (e.g. `headline`, `datePublished`, `breadcrumb`).
- **`property-mismatch`** — a scalar value or reference `@id` differs from the recommendation.
- **`spurious-entity`** _(opt-in via `--report-spurious`)_ — a live entity whose `@type` the scanner didn't recommend.

Page classification drives which entities get recommended: `og:type=article` → `BlogPosting` (or `NewsArticle` when the section is news-flavored), `og:type=profile` → `ProfilePage`, `og:type=website` on the root → `CollectionPage`, microdata `Product` → `Product`, everything else → `WebPage`. See `src/recommend.ts` for the full rules.

## What it does NOT do yet

- Cross-block / cross-page reference resolution (the structural validator checks within a block only)
- Required-property checks per schema.org type
- Deep comparison of nested objects without `@id` (skipped to avoid noise)
