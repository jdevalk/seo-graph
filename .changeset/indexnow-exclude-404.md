---
'@jdevalk/astro-seo-graph': patch
---

IndexNow: exclude `/404` (and `/404/`) from submission by default. Search
engines don't need to be notified about a site's 404 page, and submitting
it wastes daily IndexNow quota. The exclusion is applied before any
caller-supplied `filter` runs, so callers don't need to re-exclude it
themselves.

Also documents the `filter` option alongside common patterns (e.g.
excluding paginated archives like `/blog/2/`), and exposes
`isDefaultExcludedFromIndexNow(url)` for callers building their own
submission pipelines.

Closes #26.
