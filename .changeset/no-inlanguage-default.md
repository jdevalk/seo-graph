---
'@jdevalk/seo-graph-core': minor
---

**`inLanguage` no longer defaults to `'en-US'`** on any piece builder. Previously, `buildWebSite`, `buildWebPage`, `buildArticle`, and `buildImageObject` silently stamped `inLanguage: 'en-US'` onto their output when the caller didn't pass one. That's wrong: silently assuming every unspecified site is American English is exactly the kind of default that produces bad metadata for the rest of the world, and schema.org treats `inLanguage` as optional everywhere it appears.

After this change, all four piece builders simply omit `inLanguage` from the output when the caller doesn't pass one. Callers that want an explicit language should pass it — and they should, because accurate language metadata matters for SEO, accessibility, and agent-ready discovery.

**This is a behaviour change and will affect the output of existing consumers.** If you were relying on the implicit default, your rendered JSON-LD will no longer include `inLanguage` unless you add it to your call sites. The fix is a one-line addition per piece call: `inLanguage: 'en-US'` (or whatever is actually correct for your site).

joost.blog's integration test was updated to pass `inLanguage: 'en-US'` explicitly on `buildWebPage`, `buildArticle`, and `buildImageObject` — the fixture still matches byte-for-byte because joost.blog really is an `en-US` site, it just now says so out loud.
