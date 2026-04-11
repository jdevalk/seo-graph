---
"@jdevalk/astro-seo-graph": patch
---

FuzzyRedirect now detects out-of-bounds pagination URLs (e.g. `/blog/page/99/`) and redirects to the base path (`/blog/`) before attempting fuzzy matching.
