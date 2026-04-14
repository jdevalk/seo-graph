# @jdevalk/seo-graph-scanner

Sitemap-driven scanner that audits a live site's JSON-LD against seo-graph conventions. No crawling — the sitemap is the URL list.

**Status:** Prototype. MVP slice is sitemap → fetch → existing-JSON-LD validation. Recommendation/inference layer is not built yet.

## CLI

```sh
# Point at a sitemap directly
npx seo-graph-scan https://example.com/sitemap.xml --limit 50

# Or at an origin; it probes /sitemap_index.xml then /sitemap.xml
npx seo-graph-scan https://example.com --limit 50

# JSON output for piping into other tools
npx seo-graph-scan https://example.com --json > report.json
```

## Library

```ts
import { scanSite } from '@jdevalk/seo-graph-scanner';

const report = await scanSite('https://example.com/sitemap.xml', {
    sitemap: { limit: 100 },
    fetch: { concurrency: 4, intervalMs: 250 },
});

for (const page of report.pages) {
    for (const finding of page.findings) {
        console.log(page.url, finding.severity, finding.code, finding.message);
    }
}
```

## What it checks today

Per JSON-LD block on each page:

- JSON parseability
- Valid shape (`@graph`, entity, or array of entities)
- Every entity has `@type`
- Every entity has `@id` (warning — references won't resolve otherwise)
- Every `{ "@id": "..." }` reference resolves to an entity in the same block

Per page:

- No JSON-LD at all → warning
- Fetch failure → error

## What it does NOT do yet

- Infer recommended entities from HTML (author bylines, OG, microdata)
- Call seo-graph-core piece builders to produce a "recommended graph"
- Diff recommended vs. live
- Cross-block / cross-page reference resolution
- Required-property checks per schema.org type

That's the next slice.
