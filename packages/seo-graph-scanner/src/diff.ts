/**
 * Compare a recommended graph (what we think the page should have
 * emitted, based on HTML inference) against the page's actual JSON-LD
 * entities. Returns a `Finding[]` in the same shape `validate.ts`
 * produces, so CLI output stays uniform.
 *
 * The diff is deliberately strict: every recommended entity that isn't
 * present in the live graph is flagged, and every recommended property
 * that's missing or differs on a matched entity is flagged. The
 * recommender is already conservative (it only emits entities it has
 * clear evidence for), so a strict diff should surface real gaps
 * rather than noise.
 *
 * Two common sources of false positives that we intentionally accept
 * for now (per "start strict, annotate noise later"):
 *
 * - Reference `@id` values differ between recommended and live when
 *   the site uses a different id scheme than seo-graph-core. That
 *   produces "property mismatch" findings for every reference field.
 *   Users with stable non-core id schemes will want to filter these
 *   by code or suppress them in a later pass.
 * - Entities that exist live but weren't recommended (e.g. FAQPage,
 *   HowTo, Recipe) are reported as "spurious" only when
 *   `reportSpurious` is true.
 */
import type { ExtractedJsonLd } from './extract.js';
import type { RecommendedGraph } from './recommend.js';
import type { Finding } from './validate.js';

export interface DiffOptions {
    /**
     * When true, emit `info` findings for live entities whose `@type`
     * wasn't in the recommended set. Defaults to `false` — we can't
     * know the full universe of legitimate schema.org types a site
     * might use (FAQPage, HowTo, Recipe, etc.), so calling those out
     * is noisy unless you're actively auditing for overreach.
     */
    reportSpurious?: boolean;
}

/** Keys that don't participate in property-level comparison. */
const STRUCTURAL_KEYS = new Set(['@id', '@type', '@context']);

/**
 * Extract the type string(s) from an entity's `@type`. Handles string,
 * array, and missing forms. Returns an empty array when no type is set.
 */
function typesOf(entity: Record<string, unknown>): string[] {
    const t = entity['@type'];
    if (typeof t === 'string') return [t];
    if (Array.isArray(t)) return t.filter((x): x is string => typeof x === 'string');
    return [];
}

/**
 * Walk a JSON-LD payload (which may be an object with `@graph`, a bare
 * entity, or an array of entities) and return a flat list of entity
 * objects. Non-entity junk (primitives, arrays-of-arrays) is skipped.
 */
export function flattenLiveEntities(
    blocks: readonly ExtractedJsonLd[],
): Array<Record<string, unknown>> {
    const entities: Array<Record<string, unknown>> = [];
    for (const block of blocks) {
        if (block.parseError) continue;
        walk(block.payload);
    }
    return entities;

    function walk(value: unknown): void {
        if (value === null || typeof value !== 'object') return;
        if (Array.isArray(value)) {
            for (const item of value) walk(item);
            return;
        }
        const obj = value as Record<string, unknown>;
        if (Array.isArray(obj['@graph'])) {
            for (const item of obj['@graph']) walk(item);
            // An envelope with @context + @graph doesn't itself count
            // as an entity unless it also has @type.
            if (obj['@type'] !== undefined) entities.push(obj);
            return;
        }
        if (obj['@type'] !== undefined) {
            entities.push(obj);
        }
    }
}

/**
 * Compare two property values. Returns `true` when they should be
 * considered equivalent for diff purposes.
 *
 *  - References (`{@id}`): compared by `@id` only.
 *  - Arrays: compared as sets of stringified items (order-insensitive).
 *  - Primitives: strict equality after trimming strings.
 *  - Nested objects without `@id`: too noisy to compare — treated as
 *    equivalent (the diff focuses on top-level scalars and references).
 */
function valuesMatch(a: unknown, b: unknown): boolean {
    if (a === b) return true;
    if (typeof a === 'string' && typeof b === 'string') return a.trim() === b.trim();

    if (isReference(a) && isReference(b)) return a['@id'] === b['@id'];

    if (Array.isArray(a) && Array.isArray(b)) {
        if (a.length !== b.length) return false;
        const sa = a.map(stringifyForCompare).sort();
        const sb = b.map(stringifyForCompare).sort();
        return sa.every((v, i) => v === sb[i]);
    }

    // Non-reference objects without @id: don't flag mismatches (too
    // noisy for a first pass). Callers wanting depth can filter by
    // code or extend this later.
    if (typeof a === 'object' && typeof b === 'object' && a !== null && b !== null) {
        return true;
    }

    return false;
}

function isReference(value: unknown): value is { '@id': string } {
    return (
        typeof value === 'object' &&
        value !== null &&
        typeof (value as Record<string, unknown>)['@id'] === 'string'
    );
}

function stringifyForCompare(value: unknown): string {
    if (isReference(value)) return value['@id'];
    if (typeof value === 'object' && value !== null) return JSON.stringify(value);
    return String(value);
}

/**
 * Produce findings by diffing the recommended graph against live
 * entities extracted from the page's JSON-LD.
 */
export function diffRecommendedVsLive(
    recommended: RecommendedGraph,
    liveEntities: ReadonlyArray<Record<string, unknown>>,
    options: DiffOptions = {},
): Finding[] {
    const findings: Finding[] = [];

    const liveById = new Map<string, Record<string, unknown>>();
    const liveByType = new Map<string, Record<string, unknown>[]>();
    for (const entity of liveEntities) {
        const id = typeof entity['@id'] === 'string' ? entity['@id'] : undefined;
        if (id) liveById.set(id, entity);
        for (const type of typesOf(entity)) {
            const list = liveByType.get(type) ?? [];
            list.push(entity);
            liveByType.set(type, list);
        }
    }

    const matchedLive = new Set<Record<string, unknown>>();

    for (const rec of recommended.entities) {
        const recId = typeof rec['@id'] === 'string' ? rec['@id'] : undefined;
        const recTypes = typesOf(rec);
        const primaryType = recTypes[0] ?? 'Thing';

        // Match by @id first; that's authoritative when both sides use
        // the same id scheme. Fall back to a first-of-type match.
        let match = recId ? liveById.get(recId) : undefined;
        if (!match) {
            for (const type of recTypes) {
                const candidates = liveByType.get(type);
                if (candidates && candidates.length > 0) {
                    // Prefer a candidate we haven't already claimed.
                    const unclaimed = candidates.find((c) => !matchedLive.has(c));
                    match = unclaimed ?? candidates[0];
                    if (match) break;
                }
            }
        }

        if (!match) {
            findings.push({
                severity: 'warning',
                code: 'missing-entity',
                message: `Recommended ${primaryType} is not present in the page's JSON-LD.`,
                path: recId,
            });
            continue;
        }

        matchedLive.add(match);

        // Compare properties the recommender set explicitly. Live entities
        // are allowed to carry extra properties — we only flag missing
        // or mismatched ones.
        for (const [key, recValue] of Object.entries(rec)) {
            if (STRUCTURAL_KEYS.has(key)) continue;
            if (recValue === undefined) continue;
            const liveValue = match[key];
            if (liveValue === undefined) {
                findings.push({
                    severity: 'warning',
                    code: 'missing-property',
                    message: `${primaryType} is missing \`${key}\`.`,
                    path: recId ? `${recId}.${key}` : key,
                });
                continue;
            }
            if (!valuesMatch(recValue, liveValue)) {
                findings.push({
                    severity: 'warning',
                    code: 'property-mismatch',
                    message: `${primaryType} \`${key}\` differs from recommendation.`,
                    path: recId ? `${recId}.${key}` : key,
                });
            }
        }
    }

    if (options.reportSpurious) {
        for (const entity of liveEntities) {
            if (matchedLive.has(entity)) continue;
            const types = typesOf(entity);
            if (types.length === 0) continue;
            const id = typeof entity['@id'] === 'string' ? entity['@id'] : undefined;
            findings.push({
                severity: 'info',
                code: 'spurious-entity',
                message: `Live ${types[0]} was not expected based on the page's HTML.`,
                path: id,
            });
        }
    }

    return findings;
}
