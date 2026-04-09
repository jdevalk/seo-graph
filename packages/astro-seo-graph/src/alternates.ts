/**
 * hreflang alternate-language link builder.
 *
 * Pure function: no DOM, no fetch, no Astro runtime. Safe to import from
 * non-Astro TypeScript (in particular, from `@jdevalk/emdash-plugin-seo`'s
 * EmDash `page:metadata` hook).
 *
 * Callers provide a set of `{ hreflang, href }` entries; this module
 * normalizes BCP 47 tags, validates URLs, dedupes, and appends an
 * `x-default` entry. It does NOT source translation data, construct URLs
 * from slugs, or know about any particular CMS.
 */

/** Output shape: a single rendered `<link rel="alternate" hreflang="…" href="…">` tag. */
export interface AlternateLink {
    /** Always `"alternate"`. */
    rel: 'alternate';
    /** Normalized BCP 47 tag (e.g. `"fr-CA"`) or the literal `"x-default"`. */
    hreflang: string;
    /** Absolute `http(s)://` URL string. */
    href: string;
}

/** Input shape accepted by `buildAlternateLinks`. */
export interface BuildAlternateLinksInput {
    /**
     * BCP 47 locale tag of the default sibling, used for the `x-default`
     * entry. Matched case-insensitively against the normalized
     * `entries[].hreflang` values. If omitted (or no match), the first
     * surviving entry is used as the default.
     */
    defaultLocale?: string;

    /**
     * Per-locale URL entries. Order is preserved in the output. The
     * caller MUST include the current page itself — Google treats
     * self-referential hreflang as required, not optional.
     */
    entries: ReadonlyArray<{
        /** BCP 47 tag, e.g. `"en"`, `"fr"`, `"fr-CA"`. */
        hreflang: string;
        /** Absolute URL. Relative or non-http(s) values are dropped. */
        href: string | URL;
    }>;
}

/** BCP 47 subtag structure we handle: language-[script]-[region]. */
const BCP47_RE = /^([a-z]{2,3})(?:-([a-z]{4}))?(?:-([a-z]{2,3}))?$/i;

/**
 * Normalize a BCP 47 locale tag to conventional casing:
 * language subtag lowercase, script subtag title-case, region subtag
 * uppercase. Returns `null` for empty / whitespace-only input.
 *
 * For tags that don't match the language-script-region pattern
 * (variants, extended tags, private-use, grandfathered), this falls
 * back to lowercasing the entire tag. hreflang rarely uses those.
 */
function normalizeLocaleTag(raw: string): string | null {
    const trimmed = raw.trim();
    if (trimmed.length === 0) return null;

    const match = BCP47_RE.exec(trimmed);
    if (match === null) return trimmed.toLowerCase();

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [, lang, script, region] = match;
    let out = lang!.toLowerCase();
    if (script !== undefined) {
        out += '-' + script.charAt(0).toUpperCase() + script.slice(1).toLowerCase();
    }
    if (region !== undefined) {
        out += '-' + region.toUpperCase();
    }
    return out;
}

/**
 * Validate that a URL-ish value is absolute http(s). Returns the
 * stringified URL on success, `null` on failure.
 */
function validateAbsoluteUrl(href: string | URL): string | null {
    try {
        const str = typeof href === 'string' ? href : href.toString();
        const parsed = new URL(str);
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
            return null;
        }
        return parsed.toString();
    } catch {
        return null;
    }
}

/**
 * Build a deduplicated, normalized set of hreflang alternate links,
 * including an `x-default` entry.
 *
 * Behaviour:
 * - Returns `[]` when fewer than 2 entries survive validation (a
 *   single-locale page has no meaningful alternates).
 * - Drops entries with malformed / non-http(s) URLs.
 * - Drops entries with empty hreflang.
 * - Drops entries whose input hreflang is the literal `"x-default"` —
 *   that's reserved and added automatically.
 * - On duplicate normalized hreflang, the first entry wins.
 * - Preserves input order for per-locale entries.
 * - Appends `x-default` as the final entry, pointing at the
 *   `defaultLocale` match (or the first entry as fallback).
 *
 * @param input Entries plus optional default locale hint.
 * @returns     Deduped, normalized link tags. Never throws.
 */
export function buildAlternateLinks(input: BuildAlternateLinksInput): AlternateLink[] {
    const seen = new Set<string>();
    const validated: AlternateLink[] = [];

    for (const entry of input.entries) {
        const normalized = normalizeLocaleTag(entry.hreflang);
        if (normalized === null) continue;
        if (normalized === 'x-default') continue; // reserved
        if (seen.has(normalized)) continue;

        const href = validateAbsoluteUrl(entry.href);
        if (href === null) continue;

        seen.add(normalized);
        validated.push({ rel: 'alternate', hreflang: normalized, href });
    }

    // Short-circuit: one (or zero) surviving entries is not a meaningful
    // hreflang set. Emit nothing rather than a self-referential single
    // tag. Callers who want that behaviour can skip the helper.
    if (validated.length < 2) return [];

    // Pick the x-default target. defaultLocale is matched
    // case-insensitively against the normalized tags.
    let defaultEntry = validated[0]!;
    if (input.defaultLocale !== undefined) {
        const normalizedDefault = normalizeLocaleTag(input.defaultLocale);
        if (normalizedDefault !== null) {
            const match = validated.find((v) => v.hreflang === normalizedDefault);
            if (match !== undefined) defaultEntry = match;
        }
    }

    return [...validated, { rel: 'alternate', hreflang: 'x-default', href: defaultEntry.href }];
}
