import { describe, expect, it } from 'vitest';
import { buildAlternateLinks } from '../src/alternates.js';

describe('buildAlternateLinks', () => {
    describe('short-circuit behaviour', () => {
        it('returns [] when entries is empty', () => {
            expect(buildAlternateLinks({ entries: [] })).toEqual([]);
        });

        it('returns [] when only one entry is provided', () => {
            expect(
                buildAlternateLinks({
                    entries: [{ hreflang: 'en', href: 'https://example.com/' }],
                }),
            ).toEqual([]);
        });

        it('returns [] when all entries are dropped during validation', () => {
            expect(
                buildAlternateLinks({
                    entries: [
                        { hreflang: 'en', href: '/relative' },
                        { hreflang: 'fr', href: 'not-a-url' },
                        { hreflang: '', href: 'https://example.com/' },
                    ],
                }),
            ).toEqual([]);
        });
    });

    describe('x-default resolution', () => {
        it('appends x-default pointing at the first entry when defaultLocale is not provided', () => {
            const out = buildAlternateLinks({
                entries: [
                    { hreflang: 'en', href: 'https://example.com/' },
                    { hreflang: 'fr', href: 'https://example.com/fr/' },
                ],
            });
            expect(out).toHaveLength(3);
            expect(out[2]).toEqual({
                rel: 'alternate',
                hreflang: 'x-default',
                href: 'https://example.com/',
            });
        });

        it('points x-default at the defaultLocale entry when it exists', () => {
            const out = buildAlternateLinks({
                defaultLocale: 'fr',
                entries: [
                    { hreflang: 'en', href: 'https://example.com/' },
                    { hreflang: 'fr', href: 'https://example.com/fr/' },
                    { hreflang: 'nl', href: 'https://example.com/nl/' },
                ],
            });
            expect(out[3]).toEqual({
                rel: 'alternate',
                hreflang: 'x-default',
                href: 'https://example.com/fr/',
            });
        });

        it('falls back to the first entry when defaultLocale has no matching entry', () => {
            const out = buildAlternateLinks({
                defaultLocale: 'de',
                entries: [
                    { hreflang: 'en', href: 'https://example.com/' },
                    { hreflang: 'fr', href: 'https://example.com/fr/' },
                ],
            });
            expect(out[2]).toEqual({
                rel: 'alternate',
                hreflang: 'x-default',
                href: 'https://example.com/',
            });
        });

        it('matches defaultLocale case-insensitively', () => {
            const out = buildAlternateLinks({
                defaultLocale: 'EN',
                entries: [
                    { hreflang: 'fr', href: 'https://example.com/fr/' },
                    { hreflang: 'en', href: 'https://example.com/' },
                ],
            });
            // x-default should match the 'en' entry even though
            // defaultLocale was given as 'EN'.
            expect(out[2]?.href).toBe('https://example.com/');
        });
    });

    describe('order preservation', () => {
        it('preserves entry order in the output', () => {
            const out = buildAlternateLinks({
                entries: [
                    { hreflang: 'nl', href: 'https://example.com/nl/' },
                    { hreflang: 'en', href: 'https://example.com/' },
                    { hreflang: 'fr', href: 'https://example.com/fr/' },
                ],
            });
            expect(out.slice(0, 3).map((e) => e.hreflang)).toEqual(['nl', 'en', 'fr']);
        });
    });

    describe('BCP 47 normalization', () => {
        it('lowercases plain language tags', () => {
            const out = buildAlternateLinks({
                entries: [
                    { hreflang: 'EN', href: 'https://example.com/' },
                    { hreflang: 'FR', href: 'https://example.com/fr/' },
                ],
            });
            expect(out[0]?.hreflang).toBe('en');
            expect(out[1]?.hreflang).toBe('fr');
        });

        it('normalizes language-region to lowercase-UPPERCASE (fr-ca → fr-CA)', () => {
            const out = buildAlternateLinks({
                entries: [
                    { hreflang: 'fr-ca', href: 'https://example.com/fr-ca/' },
                    { hreflang: 'fr-fr', href: 'https://example.com/fr-fr/' },
                ],
            });
            expect(out[0]?.hreflang).toBe('fr-CA');
            expect(out[1]?.hreflang).toBe('fr-FR');
        });

        it('normalizes language-script-region (zh-hant-hk → zh-Hant-HK)', () => {
            const out = buildAlternateLinks({
                entries: [
                    { hreflang: 'zh-hant-hk', href: 'https://example.com/zh-hant-hk/' },
                    { hreflang: 'zh-hans-cn', href: 'https://example.com/zh-hans-cn/' },
                ],
            });
            expect(out[0]?.hreflang).toBe('zh-Hant-HK');
            expect(out[1]?.hreflang).toBe('zh-Hans-CN');
        });
    });

    describe('validation', () => {
        it('drops entries with relative hrefs', () => {
            const out = buildAlternateLinks({
                entries: [
                    { hreflang: 'en', href: 'https://example.com/' },
                    { hreflang: 'fr', href: '/fr/' },
                    { hreflang: 'nl', href: 'https://example.com/nl/' },
                ],
            });
            expect(out).toHaveLength(3); // 2 valid + x-default
            expect(out.map((e) => e.hreflang)).toEqual(['en', 'nl', 'x-default']);
        });

        it('drops entries with protocol-relative hrefs', () => {
            const out = buildAlternateLinks({
                entries: [
                    { hreflang: 'en', href: 'https://example.com/' },
                    { hreflang: 'fr', href: '//example.com/fr/' },
                    { hreflang: 'nl', href: 'https://example.com/nl/' },
                ],
            });
            expect(out.map((e) => e.hreflang)).toEqual(['en', 'nl', 'x-default']);
        });

        it('drops entries with mailto: or other non-http(s) schemes', () => {
            const out = buildAlternateLinks({
                entries: [
                    { hreflang: 'en', href: 'https://example.com/' },
                    { hreflang: 'fr', href: 'mailto:foo@example.com' },
                    { hreflang: 'nl', href: 'https://example.com/nl/' },
                ],
            });
            expect(out.map((e) => e.hreflang)).toEqual(['en', 'nl', 'x-default']);
        });

        it('drops entries with empty or whitespace-only hreflang', () => {
            const out = buildAlternateLinks({
                entries: [
                    { hreflang: 'en', href: 'https://example.com/' },
                    { hreflang: '', href: 'https://example.com/empty/' },
                    { hreflang: '   ', href: 'https://example.com/spaces/' },
                    { hreflang: 'fr', href: 'https://example.com/fr/' },
                ],
            });
            expect(out.map((e) => e.hreflang)).toEqual(['en', 'fr', 'x-default']);
        });

        it('drops entries whose input hreflang is the literal "x-default"', () => {
            const out = buildAlternateLinks({
                entries: [
                    { hreflang: 'en', href: 'https://example.com/' },
                    { hreflang: 'x-default', href: 'https://example.com/default/' },
                    { hreflang: 'fr', href: 'https://example.com/fr/' },
                ],
            });
            // The "x-default" entry should NOT leak its href into the
            // rendered list; only en and fr + the synthesized x-default
            // (which points at 'en' as the first surviving entry).
            expect(out.map((e) => e.hreflang)).toEqual(['en', 'fr', 'x-default']);
            expect(out[2]?.href).toBe('https://example.com/');
        });

        it('dedupes by normalized hreflang, first entry wins', () => {
            const out = buildAlternateLinks({
                entries: [
                    { hreflang: 'en', href: 'https://example.com/' },
                    { hreflang: 'EN', href: 'https://example.com/duplicate/' },
                    { hreflang: 'fr', href: 'https://example.com/fr/' },
                ],
            });
            expect(out).toHaveLength(3); // en, fr, x-default
            expect(out[0]?.href).toBe('https://example.com/'); // first wins
        });
    });

    describe('URL object handling', () => {
        it('accepts URL objects and stringifies them', () => {
            const out = buildAlternateLinks({
                entries: [
                    { hreflang: 'en', href: new URL('https://example.com/') },
                    { hreflang: 'fr', href: new URL('https://example.com/fr/') },
                ],
            });
            expect(out[0]?.href).toBe('https://example.com/');
            expect(out[1]?.href).toBe('https://example.com/fr/');
        });
    });
});
