import { describe, expect, it } from 'vitest';
import { aggregate } from '../src/aggregator.js';

interface FakeEntry {
    id: string;
    title: string;
}

const entries: FakeEntry[] = [
    { id: 'a', title: 'Post A' },
    { id: 'b', title: 'Post B' },
];

function mapper(entry: FakeEntry) {
    return [
        {
            '@type': 'WebSite' as const,
            '@id': 'https://example.com/#website',
            name: 'Example',
        },
        {
            '@type': 'Article' as const,
            '@id': `https://example.com/${entry.id}/#article`,
            headline: entry.title,
        },
    ];
}

describe('aggregate', () => {
    it('wraps pieces in a @context / @graph envelope', () => {
        const graph = aggregate({ entries, mapper });
        expect(graph['@context']).toBe('https://schema.org');
        expect(Array.isArray(graph['@graph'])).toBe(true);
    });

    it('deduplicates site-wide entities across entries', () => {
        const graph = aggregate({ entries, mapper });
        const website = graph['@graph'].filter((e) => e['@type'] === 'WebSite');
        expect(website).toHaveLength(1);
    });

    it('keeps one entry per unique per-entry entity', () => {
        const graph = aggregate({ entries, mapper });
        const articles = graph['@graph'].filter((e) => e['@type'] === 'Article');
        expect(articles).toHaveLength(2);
    });

    it('handles an empty entry list', () => {
        const graph = aggregate({ entries: [], mapper });
        expect(graph['@graph']).toEqual([]);
    });

    it('handles a mapper that returns an empty list', () => {
        const graph = aggregate({ entries, mapper: () => [] });
        expect(graph['@graph']).toEqual([]);
    });

    it('preserves insertion order for unique entities (first wins on dedup)', () => {
        const graph = aggregate({ entries, mapper });
        const ids = graph['@graph'].map((e) => e['@id']);
        expect(ids).toEqual([
            'https://example.com/#website',
            'https://example.com/a/#article',
            'https://example.com/b/#article',
        ]);
    });
});
