---
'@jdevalk/astro-seo-graph': patch
---

Use direct re-export syntax for `submitToIndexNow`, `validateIndexNowKey`,
and `IndexNowSubmitResult` from `@jdevalk/seo-graph-core`. Fixes a Vite
warning about imported-but-unused symbols in the built module.
