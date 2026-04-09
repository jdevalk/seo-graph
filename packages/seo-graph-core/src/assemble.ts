import type { GraphEntity } from './types.js';
import { deduplicateByGraphId } from './dedupe.js';

/**
 * Wrap a list of pieces in a `@context + @graph` envelope. Pieces are
 * deduplicated by `@id` before assembly; first occurrence wins.
 */
export function assembleGraph<T extends GraphEntity>(
    pieces: readonly T[],
): { '@context': 'https://schema.org'; '@graph': T[] } {
    return {
        '@context': 'https://schema.org',
        '@graph': deduplicateByGraphId(pieces),
    };
}
