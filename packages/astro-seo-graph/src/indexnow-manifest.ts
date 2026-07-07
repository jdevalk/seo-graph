import { createHash } from 'node:crypto';

/**
 * Incremental-IndexNow manifest helpers.
 *
 * The integration submits the whole site to IndexNow on every build, which
 * the IndexNow spec discourages (submit only added/updated/deleted URLs) and
 * which can trip per-host rate limits. These pure helpers let a caller compute
 * a content-hash manifest of the built pages, diff it against the previously
 * published manifest, and submit only the URLs that actually changed.
 *
 * The helpers are runtime-agnostic and IO-free: the caller decides how to
 * read the built pages, where to fetch the previous manifest from, and where
 * to publish the new one. The integration wires them to the Astro build
 * output and the live site (see `seoGraph({ indexNow: { incremental } })`).
 */

/** Mapping of each eligible page URL to a short content hash. */
export type UrlManifest = Record<string, string>;

/** A single page's URL plus the content to hash (typically built HTML). */
export interface ManifestEntry {
    url: string;
    content: string;
}

/** Identifier for the default hash, recorded in the serialized manifest. */
export const DEFAULT_HASH_ALGORITHM = 'sha256-16';

/** Current serialized-manifest format version. */
export const MANIFEST_VERSION = 1;

/** The on-disk / over-the-wire manifest shape. */
export interface SerializedManifest {
    version: number;
    algorithm: string;
    urls: UrlManifest;
}

/** SHA-256 of `content` as hex, truncated to 16 chars (64 bits of collision space). */
export function hashContent(content: string): string {
    return createHash('sha256').update(content, 'utf8').digest('hex').slice(0, 16);
}

/**
 * Build a `{ url: hash }` manifest from the eligible page entries.
 *
 * Pass a custom `hash` to normalize volatile markup (per-build nonces,
 * timestamps, build ids) before hashing, so unchanged content doesn't read as
 * "updated". The default hashes the raw content.
 */
export function buildUrlManifest(
    entries: readonly ManifestEntry[],
    hash: (content: string, url: string) => string = (content) => hashContent(content),
): UrlManifest {
    const manifest: UrlManifest = {};
    for (const entry of entries) {
        manifest[entry.url] = hash(entry.content, entry.url);
    }
    return manifest;
}

/** The three change sets produced by comparing two manifests. */
export interface ManifestDiff {
    /** URLs present now but not in the previous manifest. */
    added: string[];
    /** URLs present in both, with a different hash. */
    updated: string[];
    /** URLs present previously but gone now. */
    deleted: string[];
}

/**
 * Diff a previous manifest against the current one. Result arrays are sorted
 * for stable logs and deterministic output.
 */
export function diffManifests(prev: UrlManifest, curr: UrlManifest): ManifestDiff {
    const added: string[] = [];
    const updated: string[] = [];
    const deleted: string[] = [];

    for (const url of Object.keys(curr)) {
        if (!(url in prev)) added.push(url);
        else if (prev[url] !== curr[url]) updated.push(url);
    }
    for (const url of Object.keys(prev)) {
        if (!(url in curr)) deleted.push(url);
    }

    added.sort();
    updated.sort();
    deleted.sort();
    return { added, updated, deleted };
}

/**
 * Flatten a diff into the URL set to submit to IndexNow: added + updated +
 * deleted. IndexNow accepts removed URLs (the engine recrawls and drops the
 * 404/410), so deletions are included.
 */
export function changedUrls(diff: ManifestDiff): string[] {
    return [...diff.added, ...diff.updated, ...diff.deleted];
}

/**
 * Serialize a manifest to stable JSON with sorted keys (so the published file
 * diffs cleanly between deploys).
 */
export function serializeManifest(
    urls: UrlManifest,
    algorithm: string = DEFAULT_HASH_ALGORITHM,
): string {
    const sorted: UrlManifest = {};
    for (const url of Object.keys(urls).sort()) {
        const hash = urls[url];
        if (hash !== undefined) sorted[url] = hash;
    }
    const payload: SerializedManifest = { version: MANIFEST_VERSION, algorithm, urls: sorted };
    return JSON.stringify(payload, null, 2);
}

/**
 * Parse a previously published manifest. Returns the `{ url: hash }` map, or
 * `null` when the input is missing or not a recognizable manifest — the caller
 * decides whether that means "first run" or "fetch failed, skip submission".
 */
export function parseManifest(text: string | null | undefined): UrlManifest | null {
    if (!text) return null;
    let data: unknown;
    try {
        data = JSON.parse(text);
    } catch {
        return null;
    }
    if (typeof data !== 'object' || data === null) return null;
    const urls = (data as Partial<SerializedManifest>).urls;
    if (typeof urls !== 'object' || urls === null) return null;
    const out: UrlManifest = {};
    for (const [url, hash] of Object.entries(urls)) {
        if (typeof hash === 'string') out[url] = hash;
    }
    return out;
}
