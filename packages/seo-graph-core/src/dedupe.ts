import type { GraphEntity } from './types.js';

/**
 * Deduplicate entities by their `@id`. First occurrence wins. Entities
 * without an `@id` are always kept.
 */
export function deduplicateByGraphId<T extends GraphEntity>(entities: readonly T[]): T[] {
    const seen = new Set<string>();
    const result: T[] = [];
    for (const entity of entities) {
        const id = entity['@id'];
        if (id !== undefined) {
            if (seen.has(id)) continue;
            seen.add(id);
        }
        result.push(entity);
    }
    return result;
}
