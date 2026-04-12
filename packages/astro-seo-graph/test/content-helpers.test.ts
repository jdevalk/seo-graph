import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { imageSchema, seoSchema } from '../src/content-helpers.js';

// Astro's content-collection `image()` returns a Zod schema for a
// processed image asset. For unit testing we substitute a plain Zod
// schema that accepts any object — we're testing our wrappers, not
// Astro's image pipeline.
const fakeImage = () => z.object({ src: z.string(), width: z.number().optional() });

describe('imageSchema', () => {
    it('accepts an object with src and alt', () => {
        const schema = imageSchema(fakeImage);
        const parsed = schema.parse({ src: { src: 'x.png' }, alt: 'A thing' });
        expect(parsed.alt).toBe('A thing');
    });

    it('requires alt', () => {
        const schema = imageSchema(fakeImage);
        expect(() => schema.parse({ src: { src: 'x.png' } })).toThrow();
    });

    it('accepts empty alt for decorative images', () => {
        const schema = imageSchema(fakeImage);
        const parsed = schema.parse({ src: { src: 'decorative.png' }, alt: '' });
        expect(parsed.alt).toBe('');
    });
});

describe('seoSchema', () => {
    it('defaults pageType to website', () => {
        const schema = seoSchema(fakeImage);
        const parsed = schema.parse({});
        expect(parsed.pageType).toBe('website');
    });

    it('accepts pageType=article', () => {
        const schema = seoSchema(fakeImage);
        const parsed = schema.parse({ pageType: 'article' });
        expect(parsed.pageType).toBe('article');
    });

    it('rejects unknown pageType values', () => {
        const schema = seoSchema(fakeImage);
        expect(() => schema.parse({ pageType: 'blog' })).toThrow();
    });

    it('enforces title length bounds', () => {
        const schema = seoSchema(fakeImage);
        expect(() => schema.parse({ title: 'hi' })).toThrow(); // too short
        expect(() => schema.parse({ title: 'x'.repeat(121) })).toThrow(); // too long
        expect(() => schema.parse({ title: 'A perfectly fine title' })).not.toThrow();
    });

    it('enforces description length bounds', () => {
        const schema = seoSchema(fakeImage);
        expect(() => schema.parse({ description: 'too short' })).toThrow();
        expect(() => schema.parse({ description: 'x'.repeat(161) })).toThrow();
        expect(() =>
            schema.parse({ description: 'This is a perfectly fine meta description.' }),
        ).not.toThrow();
    });

    it('accepts a nested image with alt', () => {
        const schema = seoSchema(fakeImage);
        const parsed = schema.parse({
            title: 'A perfectly fine title',
            image: { src: { src: 'og.png' }, alt: 'Share image' },
        });
        expect(parsed.image?.alt).toBe('Share image');
    });
});
