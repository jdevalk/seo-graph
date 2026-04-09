# Spec: hreflang alternates for `<Seo>`

Status: draft
Owner: `@jdevalk/astro-seo-graph`
Target version: `0.2.x` (additive, non-breaking)
New files: `src/alternates.ts`, `test/alternates.test.ts`
Modified files: `src/components/seo-props.ts`, `src/components/Seo.astro`, `src/index.ts`

## Problem

`<Seo>` currently covers `<title>`, meta description, canonical, Open Graph, Twitter cards, and JSON-LD `@graph`. It does not emit `<link rel="alternate" hreflang="…">` tags. A site author who wants hreflang annotations today has to thread them through `extraLinks` by hand, which is error-prone in the two places that matter most:

1. **URL correctness.** Every hreflang URL must be absolute and must match the target page's own canonical exactly. A trailing-slash mismatch silently invalidates the annotation.
2. **`x-default`.** Easy to forget; Google treats its absence as a missed signal.
3. **Self-reference.** Every page's hreflang set must include itself. Also easy to forget.

`<Seo>` is the natural home for this. The `<Seo>` component already owns canonical, so colocating hreflang with it guarantees the rendered URLs come from the same place.

A secondary driver: `@jdevalk/emdash-plugin-seo` needs to emit hreflang for multilingual EmDash sites from within EmDash's `page:metadata` hook. That plugin can't use the `<Seo>` component (EmDash contributes metadata through hooks, not through templates), but it _can_ import a pure helper. So the work splits into a prop on `<Seo>` plus an exported pure function.

## Goal

Add an `alternates` prop to `<Seo>` and an exported pure helper `buildAlternateLinks` that:

- Emits one `<link rel="alternate" hreflang="…" href="…">` per configured locale.
- Emits an `x-default` entry.
- Enforces absolute URLs.
- Normalizes BCP 47 tags to conventional casing on output (`fr-ca` → `fr-CA`, `en` → `en`).
- Dedupes by hreflang code.
- Validates shape defensively (drops malformed entries rather than throwing).

The helper must be callable from non-Astro TypeScript so that `@jdevalk/emdash-plugin-seo` can use it via EmDash's `page:metadata` hook.

## Non-goals

- **Sourcing translation data.** The caller provides `entries`. This spec does not cover content-collection walking, i18n config lookup, or URL construction from slugs.
- **Sitemap hreflang** (`<xhtml:link rel="alternate" hreflang="…">` inside `sitemap.xml`). Separate concern; may share the same helper later.
- **Emitting `rel="alternate"` for non-locale uses** (RSS feeds, mobile pages). Those continue to go through `extraLinks`.
- **Inferring locales from `Astro.preferredLocale` / `Accept-Language`**. hreflang output is deterministic per page, not negotiated per request.

## API

### New prop on `SeoProps`

```ts
// src/components/seo-props.ts

/**
 * hreflang alternate-language annotations.
 *
 * Emits `<link rel="alternate" hreflang="…">` for every entry, plus an
 * `x-default` entry pointing at the default-locale sibling.
 *
 * All `href` values MUST be absolute URLs. Relative or protocol-relative
 * URLs are dropped silently (hreflang requires absolute URLs per Google's
 * guidelines).
 *
 * The set should include the current page itself — Google treats
 * self-referential hreflang as required, not optional.
 */
alternates?: {
    /**
     * BCP 47 locale tag of the default sibling, used for the `x-default`
     * entry. Must match one of the `entries[].hreflang` values exactly
     * (case-insensitive). If omitted, or if no matching entry is found,
     * the first entry is used as the default.
     */
    defaultLocale?: string;

    /**
     * Per-locale URL entries. Order is preserved in the output.
     */
    entries: ReadonlyArray<{
        /** BCP 47 locale tag, e.g. `"en"`, `"fr"`, `"fr-CA"`. */
        hreflang: string;
        /** Absolute URL for this locale's version of the page. */
        href: string | URL;
    }>;
};
```

### New pure helper

```ts
// src/alternates.ts

export interface AlternateLink {
    /** Always `"alternate"`. */
    rel: 'alternate';
    /** BCP 47 tag, normalized (e.g. `"fr-CA"`, `"x-default"`). */
    hreflang: string;
    /** Absolute URL string. */
    href: string;
}

export interface BuildAlternateLinksInput {
    defaultLocale?: string;
    entries: ReadonlyArray<{
        hreflang: string;
        href: string | URL;
    }>;
}

/**
 * Build a deduplicated, normalized set of hreflang alternate links
 * including an x-default entry.
 *
 * Pure function; does not touch the DOM, fetch, or require an Astro
 * runtime. Safe to import from non-Astro TypeScript.
 */
export function buildAlternateLinks(input: BuildAlternateLinksInput): AlternateLink[];
```

### Exports

Add to `src/index.ts`:

```ts
export { buildAlternateLinks } from './alternates.js';
export type { AlternateLink, BuildAlternateLinksInput } from './alternates.js';
```

## Behaviour spec

### 1. Empty / single-entry short-circuit

If `entries.length < 2`, return `[]`. A single-locale page has no alternates; emitting one hreflang tag alone is noise and, in the single-entry case, the only "alternate" would be the page itself. Let callers avoid the work.

This is also what `<Seo>` relies on to safely accept `alternates={{ entries: [] }}` without emitting tags.

### 2. Validation — absolute URL requirement

For each entry:

1. Coerce `href` to string via `toString()` if it's a `URL`.
2. Parse through `new URL(href)`. If parsing throws (relative path, malformed), **drop the entry**.
3. If the parsed URL's protocol is not `http:` or `https:`, **drop the entry**. Protocol-relative (`//example.com`), `mailto:`, etc., are not valid hreflang targets.

Dropped entries are silent — this is an SEO convenience, not a validator. Callers that want strictness can validate before passing in.

### 3. Locale tag normalization

Normalize every `hreflang` value on the way in:

1. Trim.
2. Lowercase the language subtag; uppercase the region subtag. `fr-ca` → `fr-CA`, `EN-us` → `en-US`, `en` → `en`, `zh-Hant` → `zh-Hant` (script subtag title-case is correct BCP 47; see §3a).
3. Reject empty strings. Drop the entry.
4. Reject the literal `"x-default"` in input — that's reserved for the synthesized entry. Drop and warn in dev.

### 3a. Script subtag handling

BCP 47 tags can include a script subtag between language and region: `zh-Hant-HK`. Convention is language lowercase, script title-case, region uppercase. The helper handles at most three subtags (lang, script?, region?). Anything longer is passed through as-is after lowercasing the first subtag — we don't try to be clever about extended tags (variants, private-use), but we also don't corrupt them.

Implementation: regex `/^([a-z]{2,3})(-[A-Za-z]{4})?(-[A-Za-z]{2,3})?$/i`, normalize each group, reassemble. Tags that don't match the regex get only the first subtag lowercased and the rest left alone.

### 4. Dedup by hreflang

After normalization, if two entries share the same hreflang tag, **the first one wins**. The helper doesn't merge, warn, or throw — same "first contribution wins" rule the rest of `<Seo>` uses.

### 5. `x-default` resolution

After dedup:

1. If `defaultLocale` is provided, normalize it with the same rules as entry hreflangs, then find the matching entry by exact tag match.
2. If no match (or `defaultLocale` not provided), use the first entry.
3. Append `{ rel: "alternate", hreflang: "x-default", href: <matched entry's href> }` to the output.

The `x-default` entry is always last in the output array. Order of the other entries matches `entries` order (after dedup/drops).

### 6. Output shape

```ts
[
    { rel: 'alternate', hreflang: 'en', href: 'https://site.com/hello/' },
    { rel: 'alternate', hreflang: 'fr', href: 'https://site.com/fr/bonjour/' },
    { rel: 'alternate', hreflang: 'nl', href: 'https://site.com/nl/hallo/' },
    { rel: 'alternate', hreflang: 'x-default', href: 'https://site.com/hello/' },
];
```

## `<Seo>` integration

### `buildAstroSeoProps`

`AstroSeoProps` (the shape consumed by `astro-seo`'s `<SEO>`) does not have a first-class `alternates` field — `astro-seo` only exposes `extend.link`. The cleanest integration is to map the helper's output into `extend.link` entries inside `buildAstroSeoProps`:

```ts
// Inside buildAstroSeoProps, after existing extraLinks handling:
if (props.alternates && props.alternates.entries.length >= 2) {
    const alternates = buildAlternateLinks(props.alternates);
    const altLinks = alternates.map((a) => ({
        rel: a.rel,
        href: a.href,
        hreflang: a.hreflang,
    }));
    extend.link = [...(extend.link ?? []), ...altLinks];
}
```

### `Seo.astro`

No changes required — the `.astro` file is a thin template that calls `buildAstroSeoProps` and forwards to `<SEO>`. All the work happens in the pure TS layer.

## Tests

File: `test/alternates.test.ts`.

Unit tests for `buildAlternateLinks`:

1. **Empty entries → `[]`.**
2. **Single entry → `[]`.** No point.
3. **Two entries, no `defaultLocale`** → 2 per-locale entries + `x-default` pointing at first entry.
4. **Two entries, `defaultLocale: "en"`, `en` in entries** → `x-default` points at `en`.
5. **Two entries, `defaultLocale: "en"`, `en` NOT in entries** → `x-default` falls back to first entry.
6. **Case-insensitive `defaultLocale` match** — `defaultLocale: "EN"` matches entry `"en"`.
7. **Three entries, order preserved.**
8. **`fr-ca` in input → `fr-CA` in output.** Language lowercase, region uppercase.
9. **`zh-hant-hk` in input → `zh-Hant-HK` in output.** Script title-case, region uppercase.
10. **Relative href → dropped.** `href: "/hello"` parses against no base and throws → drop.
11. **Protocol-relative href → dropped.** `href: "//example.com/"`.
12. **`mailto:` href → dropped.**
13. **Malformed hreflang → dropped.** Empty string, whitespace only.
14. **Literal `"x-default"` in input → dropped.** Reserved.
15. **Duplicate hreflang → first wins.**
16. **URL object in href → stringified.**
17. **All entries dropped → `[]`.** Even though input was non-empty, if nothing survives validation, return empty rather than emitting a malformed set.

Integration tests for `<Seo>` via `buildAstroSeoProps`:

18. **`alternates` prop with 3 entries** → `extend.link` contains 4 link tags (3 locales + x-default), all with `rel`, `href`, `hreflang`.
19. **`alternates` combined with `extraLinks`** → both appear in `extend.link`, alternates after extras.
20. **`alternates.entries.length < 2`** → no `extend.link` mutation from alternates.

## Known limitations (document in README)

1. **Self-reference is the caller's responsibility.** The helper does not add the current page to the entries list. Callers who want self-referential hreflang (which they should — Google expects it) must include the current page in `entries`. The `<Seo>` prop docs and the README should say this explicitly.

2. **No locale fallback chain.** The helper treats each entry as an independent translation. It does not interpret "fr fallback: en" relationships. That's a caller-side concern.

3. **Lowercase language subtag assumption.** `"EN"` normalizes to `"en"`. If a site genuinely needs uppercase-only tags (they don't — BCP 47 is case-insensitive), they'll be disappointed.

4. **No grandfathered-tag support.** Tags like `i-klingon` or `art-lojban` aren't normalized — they'll pass through the regex fallback branch with the first subtag lowercased. In practice these don't appear in hreflang.

## Acceptance criteria

- [ ] `src/alternates.ts` exists and exports `buildAlternateLinks`, `AlternateLink`, `BuildAlternateLinksInput`.
- [ ] `src/index.ts` re-exports the helper and types.
- [ ] `SeoProps` has an `alternates` field, documented in JSDoc.
- [ ] `buildAstroSeoProps` maps `alternates` into `extend.link`.
- [ ] All 20 tests above pass.
- [ ] README gains a "hreflang alternates" section with a usage example and the four known limitations.
- [ ] Existing `<Seo>` consumers (joost.blog, limonaia.house, emdash-plugin-seo) continue to render byte-identical output when `alternates` is not set. Lock this with a snapshot test against the existing fixtures.

## Downstream impact

- **joost.blog**: can adopt whenever it goes multilingual. No-op today.
- **limonaia.house**: likely immediate adopter. Vacation rentals almost always need `en` + `it` hreflang.
- **`@jdevalk/emdash-plugin-seo`**: gains a new dep on `@jdevalk/astro-seo-graph` (currently depends only on `@jdevalk/seo-graph-core` + `emdash`). The plugin imports `buildAlternateLinks` as a pure function and contributes the result through EmDash's `page:metadata` hook. See `emdash-plugin-seo/SPEC-hreflang.md`.
