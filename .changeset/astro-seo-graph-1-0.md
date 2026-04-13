---
'@jdevalk/astro-seo-graph': major
---

`<Seo>` is now a first-party component. Removes the `astro-seo` dependency
and renders every `<head>` tag directly. Net result: cleaner output, two
silent bugs fixed, lighter install.

### Bug fixes (behavior changes that fix wrong output)

- **`articlePublisher` now actually renders.** Previously the prop typechecked
  but was silently dropped — `astro-seo`'s `OpenGraphArticleTags` doesn't
  destructure `publisher`, and its `openGraph.article` type doesn't include
  the field. Anyone using `articlePublisher` was getting no output. `<Seo>`
  now emits `<meta property="article:publisher" content="…">` as documented.
  Filed upstream: [jonasmerlin/astro-seo#110](https://github.com/jonasmerlin/astro-seo/issues/110).
- **`<link rel="canonical">` no longer leaks on `noindex` pages.** The
  intent ("omit canonical on noindex" per Google recommendation) was
  defeated by `astro-seo`'s built-in canonical fallback that reconstructs
  the tag from `Astro.url` when the prop is undefined. `<Seo>` now omits
  the tag cleanly. Tracked upstream:
  [jonasmerlin/astro-seo#107](https://github.com/jonasmerlin/astro-seo/issues/107).
- **Single `og:image` tag instead of `og:image` + `og:image:url`.** The
  `astro-seo` path emitted both with the same value — synonymous, harmless,
  but noise. `<Seo>` emits just `og:image`.
- **Single `<meta name="robots">` tag.** The `astro-seo` path always
  emitted its own default `index, follow` tag that couldn't be suppressed,
  while we needed our own to add `max-snippet:-1, max-image-preview:large,
  max-video-preview:-1`. Result was two robots tags per page. `<Seo>` now
  emits one merged tag with all directives.

### Cosmetic changes (HTML diff but equivalent meaning)

The byte-for-byte head output differs from 0.x in tag ordering. Search engines
treat these as identical, but consumers running snapshot tests against
`<Seo>` output will see diffs.

- **Tag grouping by concern**: title → canonical → description → robots →
  OG basic → OG optional → OG image meta → OG article → twitter →
  hreflang → author → extras → JSON-LD. Previously the order was driven
  by `astro-seo`'s sub-components.
- **Twitter overrides** follow the same field order as their OG counterparts
  (card / site / creator / title / description / image / imageAlt). The
  legacy order was card / site / title / image / imageAlt / description / creator.
- **Hreflang link attribute order**: `rel` → `hreflang` → `href`.
  The legacy order was `rel` → `href` → `hreflang`.

### Breaking API changes

- **Removed `buildAstroSeoProps`**. Replaced by `buildSeoContext`, which
  returns a flat, render-ready normalization (`SeoContext`) rather than the
  nested `astro-seo`-shaped adapter. Migration:

  ```diff
  - import { buildAstroSeoProps } from '@jdevalk/astro-seo-graph';
  - const props = buildAstroSeoProps(seo, Astro.url.href);
  - props.openGraph.basic.title // nested
  + import { buildSeoContext } from '@jdevalk/astro-seo-graph';
  + const ctx = buildSeoContext(seo, Astro.url.href);
  + ctx.og.title // flat
  ```

- **Removed `AstroSeoProps` type export**. The intermediate shape no
  longer exists. Use `SeoContext` (the new normalized shape) or `SeoProps`
  (the public input shape) depending on which side of the boundary you're on.
- **Removed `astro-seo` from dependencies**. If you imported it transitively
  through this package, install it directly: `pnpm add astro-seo`.

### New exports

- `buildSeoContext(props, url): SeoContext` — pure-TS normalization.
- `SeoContext` type — flat render-ready shape.
- `ROBOTS_EXTRAS` constant — the `max-snippet:-1, max-image-preview:large,
  max-video-preview:-1` directives `<Seo>` always appends to the robots tag.
