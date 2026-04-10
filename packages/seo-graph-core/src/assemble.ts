import type { GraphEntity } from './types.js';
import { deduplicateByGraphId } from './dedupe.js';

export interface AssembleGraphOptions {
    /**
     * When `true`, logs a warning for every `{ '@id': '...' }` reference
     * in the graph that doesn't resolve to an entity with a matching
     * `@id`. Helps catch broken links in the graph (e.g. a WebSite
     * referencing a Person that was never included).
     *
     * Defaults to `false`.
     */
    warnOnDanglingReferences?: boolean;
}

/**
 * Walk a value recursively and collect every `{ '@id': string }` reference
 * that is NOT a top-level entity (i.e. doesn't have `@type`).
 */
function collectReferences(value: unknown, refs: Set<string>): void {
    if (value === null || value === undefined || typeof value !== 'object') return;

    if (Array.isArray(value)) {
        for (const item of value) {
            collectReferences(item, refs);
        }
        return;
    }

    const obj = value as Record<string, unknown>;

    // An object with @id but no @type is a reference, not an entity.
    if (typeof obj['@id'] === 'string' && obj['@type'] === undefined) {
        refs.add(obj['@id']);
        return;
    }

    // Recurse into values of entities/nested objects.
    for (const val of Object.values(obj)) {
        collectReferences(val, refs);
    }
}

/**
 * Wrap a list of pieces in a `@context + @graph` envelope. Pieces are
 * deduplicated by `@id` before assembly; first occurrence wins.
 *
 * When `warnOnDanglingReferences` is enabled, logs warnings for any
 * `{ '@id': '...' }` reference that doesn't resolve to an entity in
 * the graph.
 */
export function assembleGraph<T extends GraphEntity>(
    pieces: readonly T[],
    options?: AssembleGraphOptions,
): { '@context': 'https://schema.org'; '@graph': T[] } {
    const graph = deduplicateByGraphId(pieces);

    if (options?.warnOnDanglingReferences) {
        const entityIds = new Set<string>();
        for (const entity of graph) {
            if (typeof entity['@id'] === 'string') {
                entityIds.add(entity['@id']);
            }
        }

        // Map from referenced @id → @type of the entity that references it.
        const refs = new Map<string, string>();
        for (const entity of graph) {
            const sourceType = String(entity['@type']);
            const collected = new Set<string>();
            for (const [key, val] of Object.entries(entity)) {
                if (key === '@id') continue;
                collectReferences(val, collected);
            }
            for (const ref of collected) {
                if (!refs.has(ref)) refs.set(ref, sourceType);
            }
        }

        for (const [ref, sourceType] of refs) {
            if (!entityIds.has(ref)) {
                console.warn(
                    `[seo-graph] Dangling reference in ${sourceType}: { "@id": "${ref}" } does not match any entity in the graph.`,
                );
            }
        }
    }

    return {
        '@context': 'https://schema.org',
        '@graph': graph,
    };
}
