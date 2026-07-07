# Sitemap features for `@jdevalk/astro-seo-graph`

Proposal to add three sitemap-related features to the integration. Origin:
prototyped in `hosting.nl` (`astro.config.mjs`) on 2026-05-08; copying the
shape here so the work can be productized.

## Motivation

`@astrojs/sitemap` covers the basics but has gaps that bite multilingual
content sites:

1. **No styling.** Browsers render the raw XML — fine for crawlers,
   unfriendly when humans (or you) eyeball it during QA.
2. **`i18n` mode pairs by identical path.** It assumes
   `/foo/` ↔ `/en/foo/`. Sites with translated path segments
   (e.g. `/domeinen/extensies/com/` ↔ `/en/domains/extensions/com/`)
   get no `xhtml:link` annotations at all.
3. **One flat shard.** Output is `sitemap-0.xml` (or numeric splits at the
   45 000 URL ceiling). No semantic grouping, so the index is uninformative
   and you can't expose just-the-knowledge-base or just-the-product-pages
   to crawlers/SEO tools.

This package already owns alternates (`alternates.ts`,
`markdown-alternate.ts`), `llms-txt`, IndexNow, and other "after the build,
emit derived files" workflows. Sitemap polish is an obvious neighbour.

## Scope

Three features, ordered by independence (each can ship without the next).

### 1. `sitemap.xsl` stylesheet

Ship a styled XSL that handles both `<sitemapindex>` and `<urlset>`
documents. Reference it from each generated XML via
`<?xml-stylesheet type="text/xsl" href="/sitemap.xsl"?>`.

Reference implementation: `hosting.nl/public/sitemap.xsl`. Generic except
for the hardcoded "Hosting.NL" header text — that becomes config.

**API sketch**

```ts
seoGraph({
    sitemapStylesheet: {
        siteName: 'Example.com', // header text
        accentColor: '#5b21b6', // header background, link colour
        // omit to disable
    },
});
```

**Behaviour**

- During `astro:build:done`, copy `sitemap.xsl` into `dist/` (or write a
  generated copy with `siteName` substituted).
- Inject `<?xml-stylesheet?>` PI into every `dist/sitemap*.xml` the build
  produced.
- Dev: also serve from a Vite middleware so it works in `astro dev` after
  one prior `npm run build` (mirrors the package's other "needs a build"
  helpers).

**Coupling**

None. Works regardless of who generated the sitemaps. Safe default.

### 2. Hreflang injection from built HTML

For each `<url><loc>X</loc></url>` in the generated sitemap, read the
corresponding `dist/<path>/index.html`, extract its
`<link rel="alternate" hreflang="..." href="...">` tags, and re-emit them
as `<xhtml:link>` children inside the `<url>` block.

Why HTML and not the route map: the on-page tags are ground truth. Sites
using this package emit them via `alternates.ts` already, and pages
_intentionally_ without hreflang (NL-only legal pages, single-language
landing pages) correctly get no annotations in the sitemap either. No
second mapping to keep in sync.

**API sketch**

```ts
seoGraph({
    sitemapHreflang: true, // enable for any sitemap-*.xml in dist/
});
```

**Behaviour**

- After `@astrojs/sitemap` (or whatever generated the sitemaps) finishes,
  walk every `<url>` block, look up the HTML file, parse its `<head>` for
  `<link rel="alternate" hreflang>`, append as `<xhtml:link>`.
- Skip silently if HTML missing (e.g. SSR-only routes — out of scope here).
- Ensure `xmlns:xhtml="http://www.w3.org/1999/xhtml"` is on `<urlset>`
  (`@astrojs/sitemap` already includes it; if we generate our own, add it).

**Coupling**

Reads files from `dist/`. Doesn't care who wrote them, as long as the
format is `<urlset><url><loc>...</loc></url></urlset>`. Independent of the
splitter.

### 3. Sitemap splitting by URL prefix

Replace `sitemap-0.xml` with N grouped sitemaps (`sitemap-pages.xml`,
`sitemap-blog.xml`, etc.) and rewrite `sitemap-index.xml` to point at
them.

**API sketch**

```ts
seoGraph({
    sitemapGroups: [
        { name: 'domains', test: (p) => p.startsWith('/domeinen') || p.startsWith('/en/domains') },
        {
            name: 'knowledge-base',
            test: (p) =>
                p.startsWith('/hulp/kennisbank') || p.startsWith('/en/help/knowledge-base'),
        },
        { name: 'pages', test: () => true }, // catch-all, last
    ],
});
```

**Behaviour**

- Read every `dist/sitemap-N.xml` the build produced.
- Bucket each `<url>` block by the first matching `test()`.
- Emit `dist/sitemap-<name>.xml` per non-empty bucket.
- Rewrite `dist/sitemap-index.xml` to list them.
- Delete the original numeric shards.

**Coupling — the dependency question**

This is where the proposal gets opinionated. Two options:

**Option A: depend on `@astrojs/sitemap`.**
User installs both packages. Our integration runs _after_ `sitemap()` and
post-processes its output. Pro: zero duplication; we get its enumeration,
exclude rules, custom-pages handling for free. Con: implicit ordering
contract (our integration must be listed _after_ `sitemap()` in
`integrations: []`); brittle if `@astrojs/sitemap` changes its output
filenames or schema.

**Option B: build our own sitemap generator.**
Skip `@astrojs/sitemap` entirely. Walk Astro's route manifest at
`astro:build:done`, enumerate emitted HTML files in `dist/`, build the
XML ourselves. Pro: no upstream dependency, no ordering contract, full
control over output (we can group, hreflang, lastmod from git, all in one
pass). Con: more code to own; risk of subtle differences from the
ecosystem default; we re-implement filtering/customPages config surface.

Given that features 2 and 3 already involve reading `dist/` HTML and
rewriting XML, **option B may be the right long-term shape** — at that
point we're already doing 80% of the work, and dropping `@astrojs/sitemap`
removes the ordering footgun. Worth prototyping the file walk to see how
much code it actually is before committing.

If we go A short-term: document the integration order requirement
prominently, and add a runtime check that warns when our integration
runs and finds no `dist/sitemap-*.xml`.

## Open questions

- **Lastmod.** `@astrojs/sitemap` doesn't emit `<lastmod>` by default.
  This package already has `git-lastmod.ts` — wire it into whichever
  sitemap path we end up shipping?
- **Image/news/video extensions.** `@astrojs/sitemap` includes their
  namespaces but doesn't populate them. If we go option B we'd skip them
  entirely unless asked.
- **Per-group config.** Is splitting always by path-prefix `test` enough,
  or do we want per-group settings (changefreq, priority, custom XSL)?
  Probably YAGNI until someone asks.
- **Naming.** `sitemapStylesheet` / `sitemapHreflang` / `sitemapGroups` —
  three top-level options, or nest under `sitemap: { ... }`? Latter is
  cleaner if we end up owning generation (option B).

## Reference implementation

See `hosting.nl` repo, `astro.config.mjs`:

- `splitSitemapIntegration` — features 2 + 3 combined as a post-processor
  over `@astrojs/sitemap` output (option A).
- `sitemapDevPlugin` — Vite middleware serving `dist/sitemap*.xml` and
  `robots.txt` in `astro dev`.
- `public/sitemap.xsl` — feature 1.
- `public/robots.txt` — references `/sitemap-index.xml`.

These are ~150 lines total. Productizing means: parameterize the XSL,
move the post-processor into the integration, decide A vs B for the
splitter, and wire up the dev middleware as the package already does for
other generated files.
