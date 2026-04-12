---
'@jdevalk/seo-graph-core': minor
'@jdevalk/astro-seo-graph': minor
---

Add IndexNow protocol support.

`seo-graph-core` ships new runtime-agnostic helpers:
`submitToIndexNow`, `generateIndexNowKey`, `validateIndexNowKey`, and
`getIndexNowKeyFileContent`. URLs are filtered to the target host,
deduplicated, and chunked at 10,000 per request. Network errors never
throw — each chunk returns a `{ status, ok, message }` result.

`astro-seo-graph` adds `createIndexNowKeyRoute` (serves the
`/<key>.txt` verification file) and an `indexNow` option on the Astro
integration that submits built URLs to IndexNow on
`astro:build:done`. `index.html` paths are rewritten to their
trailing-slash form before submission.
