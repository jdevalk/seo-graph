---
'@jdevalk/astro-seo-graph': minor
---

Verify markdown-alternate links against the build output.

When `seoGraph({ markdownAlternate: true })` is enabled, the integration now walks the build output after every build, finds each auto-emitted `<link rel="alternate" type="text/markdown">`, checks whether the referenced `.md` file is actually on disk, and strips any link whose target is missing — with a `warn` per occurrence so misconfigured endpoints stay visible.

Mirrors the existence check in `astro-markdown-alternate`. Previously `<Seo>` derived the markdown URL optimistically from the canonical and could ship a link pointing at a 404 (collection entries that didn't get prerendered, routes that don't cover this page).

New exports for callers building their own pipelines: `findMarkdownAlternateLink`, `stripMarkdownAlternateLink`, `resolveMarkdownAlternatePath`.

SSR users whose `.md` endpoints aren't prerendered should leave `markdownAlternate` off and emit the discovery link themselves — the on-disk verification will otherwise strip every link.
