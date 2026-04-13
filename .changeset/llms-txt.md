---
'@jdevalk/astro-seo-graph': minor
---

Add `llmsTxt` option to the Astro integration. When enabled, writes an
[`llms.txt`](https://llmstxt.org) file at the root of the build output.
Pages are auto-collected from crawled HTML (`<title>` + meta description)
into a single section; callers can supply `sections` explicitly to skip
auto-collection, or use `filter` / `autoSectionName` / `outputPath` to
tune the auto-generated output.

Exports `renderLlmsTxt` and related types (`LlmsTxtInput`,
`LlmsTxtSection`, `LlmsTxtLink`) for callers that want to render
`llms.txt` outside the integration hook.
