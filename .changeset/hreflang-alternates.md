---
'@jdevalk/astro-seo-graph': minor
---

Add hreflang alternate-language support to `<Seo>`.

A new `alternates` prop on `<Seo>` accepts a list of `{ hreflang, href }` entries plus an optional `defaultLocale` hint, and emits one `<link rel="alternate" hreflang="…" href="…">` per entry along with an automatically-resolved `x-default` entry. The underlying `buildAlternateLinks` helper is exported from the package's main entry so non-Astro callers (notably `@jdevalk/emdash-plugin-seo`) can use it to feed their own metadata pipelines.

Behaviour:

- BCP 47 tags are normalized on output: `fr-ca` → `fr-CA`, `zh-hant-hk` → `zh-Hant-HK`.
- Absolute `http(s)://` URLs are required; relative, protocol-relative, and non-http schemes are dropped silently.
- Duplicate tags are deduped (first entry wins after normalization).
- `x-default` is resolved against the `defaultLocale` hint when provided, falling back to the first surviving entry.
- When fewer than two entries survive validation, no tags are emitted — a single-locale page has no meaningful alternates.
- The literal `"x-default"` is reserved as an input value and dropped if passed.

Additive and non-breaking: sites that don't pass `alternates` render identical head output.
