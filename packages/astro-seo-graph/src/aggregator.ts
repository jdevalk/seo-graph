import { deduplicateByGraphId, type GraphEntity } from '@jdevalk/seo-graph-core';

export interface AggregatorOptions<Entry> {
    /** Content entries to walk, typically from Astro's `getCollection`. */
    entries: readonly Entry[];
    /**
     * Map a single entry to an array of schema.org pieces. Return an
     * empty array to skip the entry entirely (e.g. drafts). Pieces
     * returned here are concatenated across entries; the aggregator
     * deduplicates by `@id` with first-occurrence-wins semantics.
     */
    mapper: (entry: Entry) => ReadonlyArray<GraphEntity>;
}

export interface AggregatedGraph {
    '@context': 'https://schema.org';
    '@graph': GraphEntity[];
}

/**
 * Walk a list of content entries, run the caller-supplied mapper over
 * each one, concatenate all resulting pieces, and deduplicate by
 * `@id`. Returns a ready-to-serialize `@graph` envelope.
 *
 * This is the shared engine behind `createSchemaEndpoint` — use it
 * directly if you need custom wrapping, caching, or multiple-collection
 * merging that the endpoint factories don't expose.
 */
export function aggregate<Entry>(options: AggregatorOptions<Entry>): AggregatedGraph {
    const pieces: GraphEntity[] = [];
    for (const entry of options.entries) {
        for (const piece of options.mapper(entry)) {
            pieces.push(piece);
        }
    }
    return {
        '@context': 'https://schema.org',
        '@graph': deduplicateByGraphId(pieces),
    };
}
