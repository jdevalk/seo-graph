---
'@jdevalk/astro-seo-graph': minor
---

Add markdown-alternate support: serve clean markdown versions of pages at parallel `.md` URLs so AI agents (Claude, ChatGPT, Perplexity, Cloudflare's AI crawlers) can consume content without HTML parsing.

**`createMarkdownEndpoint`** — factory returning an Astro `APIRoute` that serves a markdown entry: YAML frontmatter (title, canonical, pubDate, updatedDate, author, description, tags, categories) + body. Ships with `Content-Type: text/markdown; charset=utf-8`, `X-Robots-Tag: noindex, follow`, `X-Markdown-Tokens: <n>`, and `Link: <canonical>; rel="canonical"` pointing crawlers at the HTML. Token count defaults to a rough `chars/4` estimate; swap in `gpt-tokenizer` or `@anthropic-ai/tokenizer` via `estimateTokens` for accuracy.

**`renderMarkdownAlternate`** — pure renderer behind the endpoint. Importable from non-Astro code for the same frontmatter + body + token-count output.

**Auto-emitted discovery link (opt-in)** — new `markdownAlternate?: boolean` option on the `seoGraph()` integration. When `true`, `<Seo>` emits `<link rel="alternate" type="text/markdown" href="…">` on every page with `href` derived from the canonical (e.g. `/blog/post/` → `/blog/post.md`). Default is `false` — enable only after wiring up `createMarkdownEndpoint` at the matching path, or the link will 404. Implemented via a Vite `define` that replaces a sentinel in the compiled `<Seo>` component at build time — no runtime cost.

**Cloudflare content negotiation** — README gains a recipe for honouring `Accept: text/markdown` on static sites via CF Transform Rules (URL rewrite + `Vary: Accept` response header), no SSR or middleware required.

No breaking changes. Existing `<Seo>` consumers render byte-identical output unless they opt into `markdownAlternate: true`.
