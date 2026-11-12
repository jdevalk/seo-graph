---
'@jdevalk/astro-seo-graph': patch
---

Submit IndexNow URLs in the form Astro's `trailingSlash` setting makes canonical.

The integration always submitted directory pages with a trailing slash (`/web/page/`), even on sites configured with `trailingSlash: 'never'`, whose canonical URLs and sitemap use `/web/page`. It now reads `trailingSlash` in `astro:config:setup`: `'never'` drops the trailing slash, `'always'` adds one, and `'ignore'` (the default) keeps the built form. The site root keeps its slash in every mode.

Sites using `trailingSlash: 'never'` with `indexNow.incremental` will see their pages as added once, on the first build after upgrading, because the manifest keys change to the new URL form.
