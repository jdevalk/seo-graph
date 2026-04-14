---
'@jdevalk/astro-seo-graph': patch
---

Fix two bugs in the 1.1.0 validators.

**`validateInternalLinks` flagged static assets as 404s.** The
built-paths set was constructed only from `*.html` files, so any link
to a file copied from `public/` (images, fonts, downloads,
`favicon.svg`, etc.) came back as `not-found`. The walker now collects
every file produced by the build and includes non-HTML paths verbatim
as link targets. HTML pages still map through `htmlFileToPath` so the
trailing-slash mismatch detection keeps working.

New export: `buildLinkTargetSet(files)` — turns a list of built files
into the valid-link-target set used by `classifyInternalLink`.

**`extractMetaDescription` truncated on apostrophes.** The regex used
`[^"']*` to capture the attribute value, which terminates on _either_
quote — so `content="don't stop"` was captured as `don`, and
`validateMetadataLength` reported absurdly short lengths like "11
chars" for descriptions that were actually 90. The extractor now uses
a backreference on the opening quote, so the capture only terminates
on the quote that opened it. Entity decoding is unchanged; the
returned value is the whitespace-collapsed, entity-decoded text that
Google renders in the SERP.
