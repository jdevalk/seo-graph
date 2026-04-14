import { describe, expect, it } from 'vitest';
import { validateBlock } from '../src/validate.js';

describe('validateBlock', () => {
    it('flags a parse error', () => {
        const result = validateBlock({
            payload: '{ bad json',
            scriptIndex: 1,
            parseError: 'Unexpected token b',
        });
        expect(result.shape).toBe('invalid');
        expect(result.findings[0]?.code).toBe('invalid-json');
    });

    it('accepts a valid @graph with resolved references', () => {
        const result = validateBlock({
            scriptIndex: 1,
            payload: {
                '@context': 'https://schema.org',
                '@graph': [
                    { '@type': 'Organization', '@id': 'https://example.com/#org', name: 'Example' },
                    {
                        '@type': 'WebSite',
                        '@id': 'https://example.com/#site',
                        publisher: { '@id': 'https://example.com/#org' },
                    },
                ],
            },
        });
        expect(result.shape).toBe('graph');
        expect(result.entities).toHaveLength(2);
        expect(result.findings).toEqual([]);
    });

    it('flags a dangling reference', () => {
        const result = validateBlock({
            scriptIndex: 1,
            payload: {
                '@graph': [
                    {
                        '@type': 'WebSite',
                        '@id': 'https://example.com/#site',
                        publisher: { '@id': 'https://example.com/#missing' },
                    },
                ],
            },
        });
        expect(result.findings.some((f) => f.code === 'dangling-reference')).toBe(true);
    });

    it('warns on entity missing @id', () => {
        const result = validateBlock({
            scriptIndex: 1,
            payload: { '@type': 'Article', headline: 'Hello' },
        });
        expect(result.findings.some((f) => f.code === 'missing-id')).toBe(true);
    });

    it('errors on entity missing @type', () => {
        const result = validateBlock({
            scriptIndex: 1,
            payload: { '@id': 'https://example.com/#x', name: 'anon' },
        });
        expect(result.findings.some((f) => f.code === 'missing-type')).toBe(true);
    });
});
