---
'@jdevalk/astro-seo-graph': minor
---

Three new build-time validators on the `seoGraph()` integration.

**`validateImageAlt`** (default `true`) — warns about `<img>` tags
missing an `alt` attribute. Common SEO and accessibility miss that's
easy to overlook while drafting. Respects both WCAG decorative-image
patterns: `alt=""` (the canonical form) and
`role="presentation"`/`role="none"` (removes the image from the
accessibility tree). Only a tag with neither is flagged. Warnings
identify each page and list the first few `src` values so offenders
are findable without reopening the file.

**`validateMetadataLength`** (default `true`) — warns when `<title>` or
`<meta name="description">` length falls outside SERP-friendly bounds.
Defaults: title 30–65 characters, description 70–200. Pass `false` to
disable or an object to override per-field — e.g.
`{ title: { max: 60 }, description: { min: 120 } }` applies the
overrides and keeps defaults for the rest. Length is measured on the
whitespace-collapsed, entity-decoded text (the same thing Google
renders in the SERP).

**`validateInternalLinks`** (default `true`) — warns when an internal
`<a href>` points to a URL that doesn't match a built page. Catches two
common bugs: trailing-slash mismatches (e.g. linking to `/about-me`
when the built page is `/about-me/` — "works" via redirect but wastes
a round-trip on every click) and true 404s. Only same-origin (via
`config.site`) and root-relative links are checked; external URLs,
`mailto:`/`tel:`, and fragment-only links are skipped. Explicit
redirects are honored as valid targets by default: literal sources in
`public/_redirects` (Netlify / Cloudflare Pages format) and literal
keys in Astro's `redirects` config are unioned into the built-paths
set. Set `honorRedirects: false` to opt out when auditing for redirect
hops. Dynamic rules (wildcards, splats, `[slug]` params) are skipped;
use `skip` for those. Pass `{ skip: (href) => boolean }` to exclude
additional hrefs (e.g. SSR-only routes).

New exports on `@jdevalk/astro-seo-graph/integration`:
`findImagesWithoutAlt`, `resolveMetadataLengthBounds`,
`MetadataLengthBounds`, `DEFAULT_METADATA_LENGTH_BOUNDS`,
`classifyInternalLink`, `extractAnchorHrefs`, `htmlFileToPath`,
`parseNetlifyRedirects`, `collectAstroRedirectSources`,
`ValidateInternalLinksOptions` — for callers running the same checks
in their own pipelines (pre-commit hooks, CI scripts, etc.).
