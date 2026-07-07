---
'@jdevalk/astro-seo-graph': minor
---

**Incremental IndexNow submission via a published content-hash manifest.**

The `indexNow` integration option submitted every URL on the site on every
build. The IndexNow spec asks senders to submit only added/updated/deleted
URLs, and full resubmits can trip per-host rate limits (HTTP 429).

New opt-in `indexNow.incremental` (`true` or an options object). When enabled,
each build hashes every eligible page into a manifest, fetches the previously
published manifest from the live site, diffs them, and submits only the URLs
that changed (added + updated + deleted) — then writes the new manifest into
the build output so it ships with the deploy and becomes the next baseline.

The previous state lives on the live site, so this works identically whether
you build locally or in CI and needs no external store. A clean `404` is
treated as a first run (baseline); any other fetch/parse failure is handled by
`onError` (`'skip'` by default, so a transient blip can't trigger a full
resubmit; `'full'` to fall back to submitting everything). A `normalize` hook
lets you strip per-build volatile markup (nonces, timestamps) before hashing.

Default behavior is unchanged — without `incremental`, the integration still
submits the full set.

Also exports the underlying pure helpers (`buildUrlManifest`, `diffManifests`,
`changedUrls`, `hashContent`, `serializeManifest`, `parseManifest`) for callers
who want to compute the changed set themselves.
