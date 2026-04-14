import { describe, expect, it } from 'vitest';
import { extractOrganizationFactsFromHtml, pickContactUrl } from '../src/contact.js';

const URL = 'https://example.com/contact/';

/** Wrap a text body in minimal HTML so the extractor's cheerio parse works. */
function htmlWithBody(body: string): string {
    return `<html><body>${body}</body></html>`;
}

describe('pickContactUrl', () => {
    it('prefers an exact /contact path', () => {
        expect(
            pickContactUrl([
                'https://example.com/about/',
                'https://example.com/contact/',
                'https://example.com/posts/hello',
            ]),
        ).toBe('https://example.com/contact/');
    });

    it('recognises English / NL / DE / FR / ES variants', () => {
        expect(pickContactUrl(['https://example.com/contact-us/'])).toBe(
            'https://example.com/contact-us/',
        );
        expect(pickContactUrl(['https://example.com/contactgegevens/'])).toBe(
            'https://example.com/contactgegevens/',
        );
        expect(pickContactUrl(['https://example.com/kontakt/'])).toBe(
            'https://example.com/kontakt/',
        );
        expect(pickContactUrl(['https://example.com/contacto/'])).toBe(
            'https://example.com/contacto/',
        );
        expect(pickContactUrl(['https://example.com/contactez-nous/'])).toBe(
            'https://example.com/contactez-nous/',
        );
    });

    it('matches imprint / impressum / mentions-legales / colofon', () => {
        expect(pickContactUrl(['https://example.com/impressum'])).toBe(
            'https://example.com/impressum',
        );
        expect(pickContactUrl(['https://example.com/mentions-legales'])).toBe(
            'https://example.com/mentions-legales',
        );
    });

    it('falls back to about pages when nothing stronger matches', () => {
        expect(pickContactUrl(['https://example.com/about-us/'])).toBe(
            'https://example.com/about-us/',
        );
    });

    it('prefers contact over about when both exist', () => {
        expect(pickContactUrl(['https://example.com/about/', 'https://example.com/contact/'])).toBe(
            'https://example.com/contact/',
        );
    });

    it('returns undefined when no candidate matches', () => {
        expect(pickContactUrl(['https://example.com/posts/', 'https://example.com/blog/'])).toBe(
            undefined,
        );
    });
});

describe('extractOrganizationFactsFromHtml — identifier patterns', () => {
    describe('Netherlands', () => {
        it('extracts KVK number with context', () => {
            const out = extractOrganizationFactsFromHtml(
                htmlWithBody('KVK-nummer: 12345678 en BTW NL123456789B01'),
                URL,
            );
            expect(out.identifiers).toEqual([{ kind: 'KvK', value: '12345678' }]);
            expect(out.vatIds).toEqual(['NL123456789B01']);
        });

        it('handles "Kamer van Koophandel" prose form', () => {
            const out = extractOrganizationFactsFromHtml(
                htmlWithBody('Kamer van Koophandel nummer 12345678'),
                URL,
            );
            expect(out.identifiers).toEqual([{ kind: 'KvK', value: '12345678' }]);
        });
    });

    describe('United Kingdom', () => {
        it('extracts Companies House number from prose', () => {
            const out = extractOrganizationFactsFromHtml(
                htmlWithBody(
                    'Registered in England and Wales. Company No. 12345678. VAT GB 123 4567 89',
                ),
                URL,
            );
            expect(out.identifiers).toEqual([{ kind: 'CompaniesHouse', value: '12345678' }]);
            expect(out.vatIds).toContain('GB123456789');
            expect(out.registrySameAs).toEqual([
                'https://find-and-update.company-information.service.gov.uk/company/12345678',
            ]);
        });
    });

    describe('Germany', () => {
        it('extracts HRB and USt-IdNr', () => {
            const out = extractOrganizationFactsFromHtml(
                htmlWithBody('HRB 12345 USt-IdNr: DE123456789'),
                URL,
            );
            expect(out.identifiers).toEqual([{ kind: 'HRB', value: '12345' }]);
            expect(out.vatIds).toEqual(['DE123456789']);
        });

        it('extracts HRA', () => {
            const out = extractOrganizationFactsFromHtml(htmlWithBody('HRA 54321'), URL);
            expect(out.identifiers).toEqual([{ kind: 'HRA', value: '54321' }]);
        });
    });

    describe('France', () => {
        it('extracts SIREN and SIRET, normalising separators', () => {
            const out = extractOrganizationFactsFromHtml(
                htmlWithBody('SIREN: 123 456 789 — SIRET 123 456 789 00012 — TVA FR12123456789'),
                URL,
            );
            expect(out.identifiers).toEqual([
                { kind: 'SIREN', value: '123456789' },
                { kind: 'SIRET', value: '12345678900012' },
            ]);
            expect(out.vatIds).toEqual(['FR12123456789']);
            expect(out.registrySameAs).toContain(
                'https://annuaire-entreprises.data.gouv.fr/entreprise/123456789',
            );
        });
    });

    describe('United States', () => {
        it('extracts EIN with required dash format', () => {
            const out = extractOrganizationFactsFromHtml(htmlWithBody('EIN: 12-3456789'), URL);
            expect(out.identifiers).toEqual([{ kind: 'EIN', value: '12-3456789' }]);
        });

        it('ignores bare 9-digit numbers with no EIN context', () => {
            const out = extractOrganizationFactsFromHtml(
                htmlWithBody('Order number 123456789 will ship soon.'),
                URL,
            );
            expect(out.identifiers).toEqual([]);
        });
    });

    describe('Canada', () => {
        it('extracts Business Number', () => {
            const out = extractOrganizationFactsFromHtml(htmlWithBody('BN: 123456789RC0001'), URL);
            expect(out.identifiers).toEqual([{ kind: 'BN', value: '123456789RC0001' }]);
        });

        it('extracts NEQ (Quebec)', () => {
            const out = extractOrganizationFactsFromHtml(htmlWithBody('NEQ: 1234567890'), URL);
            expect(out.identifiers).toEqual([{ kind: 'NEQ', value: '1234567890' }]);
        });
    });

    describe('Australia', () => {
        it('extracts ABN with spaces, normalising to 11 digits', () => {
            const out = extractOrganizationFactsFromHtml(htmlWithBody('ABN 12 345 678 901'), URL);
            expect(out.identifiers).toEqual([{ kind: 'ABN', value: '12345678901' }]);
            expect(out.registrySameAs).toContain(
                'https://abr.business.gov.au/ABN/View?id=12345678901',
            );
        });

        it('extracts ACN', () => {
            const out = extractOrganizationFactsFromHtml(htmlWithBody('ACN 123 456 789'), URL);
            expect(out.identifiers).toEqual([{ kind: 'ACN', value: '123456789' }]);
        });
    });

    describe('New Zealand', () => {
        it('extracts NZBN', () => {
            const out = extractOrganizationFactsFromHtml(htmlWithBody('NZBN: 9429031234567'), URL);
            expect(out.identifiers).toEqual([{ kind: 'NZBN', value: '9429031234567' }]);
            expect(out.registrySameAs).toContain(
                'https://www.nzbn.govt.nz/mynzbn/nzbndetails/9429031234567/',
            );
        });
    });
});

describe('extractOrganizationFactsFromHtml — other signals', () => {
    it('collects `tel:` hrefs and dedupes', () => {
        const out = extractOrganizationFactsFromHtml(
            `<body>
                <a href="tel:+31241234567">Call us</a>
                <a href="tel:+31241234567">Also here</a>
                <a href="tel:+31987654321">Sales</a>
            </body>`,
            URL,
        );
        expect(out.telephones).toEqual(['+31241234567', '+31987654321']);
    });

    it('detects a legal-form suffix', () => {
        expect(
            extractOrganizationFactsFromHtml(htmlWithBody('Acme GmbH — Berlin'), URL).legalForm,
        ).toBe('GmbH');
        expect(
            extractOrganizationFactsFromHtml(
                htmlWithBody('Example BV is gevestigd in Wijchen.'),
                URL,
            ).legalForm,
        ).toBe('BV');
        expect(
            extractOrganizationFactsFromHtml(htmlWithBody('Example Pty Ltd based in Sydney'), URL)
                .legalForm,
        ).toBe('Pty Ltd');
    });

    it('flags non-profit via Stichting / e.V. / 501(c)(3)', () => {
        expect(
            extractOrganizationFactsFromHtml(htmlWithBody('Stichting Voorbeeld'), URL).isNonProfit,
        ).toBe(true);
        expect(extractOrganizationFactsFromHtml(htmlWithBody('Verein e.V.'), URL).isNonProfit).toBe(
            true,
        );
        expect(
            extractOrganizationFactsFromHtml(
                htmlWithBody('501(c)(3) nonprofit based in Oakland'),
                URL,
            ).isNonProfit,
        ).toBe(true);
    });

    it('returns empty structures when no signals fire', () => {
        const out = extractOrganizationFactsFromHtml(
            htmlWithBody('Just a regular blog post.'),
            URL,
        );
        expect(out).toEqual({
            sourceUrl: URL,
            identifiers: [],
            vatIds: [],
            telephones: [],
            isNonProfit: false,
            registrySameAs: [],
        });
    });

    it('dedupes repeated KVK mentions to a single identifier entry', () => {
        const out = extractOrganizationFactsFromHtml(
            htmlWithBody('KVK 12345678 — KVK-nummer: 12345678'),
            URL,
        );
        expect(out.identifiers).toEqual([{ kind: 'KvK', value: '12345678' }]);
    });
});
