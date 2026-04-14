import { describe, expect, it } from 'vitest';
import type { InferredFacts } from '../src/infer.js';
import { classifyPage, inferOrganizationType, recommend } from '../src/recommend.js';

/** Build an `InferredFacts` with a handful of overrides. */
function facts(overrides: Partial<InferredFacts> = {}): InferredFacts {
    return {
        url: 'https://example.com/posts/hello/',
        allImages: [],
        breadcrumbs: [],
        microdata: [],
        ...overrides,
    };
}

/** Extract entities by `@type` for compact assertions. */
function typesOf(entities: Array<Record<string, unknown>>): string[] {
    return entities.map((e) => String(e['@type']));
}

/** Find the first entity of a given type. */
function entityOfType(
    entities: Array<Record<string, unknown>>,
    type: string,
): Record<string, unknown> | undefined {
    return entities.find((e) => e['@type'] === type);
}

describe('classifyPage', () => {
    it('defaults to WebPage when og:type is absent', () => {
        expect(classifyPage(facts())).toBe('WebPage');
    });

    it('returns BlogPosting for og:type="article"', () => {
        expect(classifyPage(facts({ ogType: { value: 'article', source: 'og' } }))).toBe(
            'BlogPosting',
        );
    });

    it('returns NewsArticle for article:section that reads newsworthy', () => {
        expect(
            classifyPage(
                facts({
                    ogType: { value: 'article', source: 'og' },
                    articleSection: { value: 'News & Politics', source: 'og' },
                }),
            ),
        ).toBe('NewsArticle');
    });

    it('returns ProfilePage for og:type="profile"', () => {
        expect(classifyPage(facts({ ogType: { value: 'profile', source: 'og' } }))).toBe(
            'ProfilePage',
        );
    });

    it('returns CollectionPage for og:type="website" on the site root', () => {
        expect(
            classifyPage(
                facts({
                    url: 'https://example.com/',
                    ogType: { value: 'website', source: 'og' },
                }),
            ),
        ).toBe('CollectionPage');
    });

    it('returns WebPage for og:type="website" on a non-root URL', () => {
        expect(
            classifyPage(
                facts({
                    url: 'https://example.com/posts/hello/',
                    ogType: { value: 'website', source: 'og' },
                }),
            ),
        ).toBe('WebPage');
    });

    it('returns Product when a Product microdata island is present', () => {
        expect(
            classifyPage(
                facts({
                    microdata: [{ itemtype: 'https://schema.org/Product', props: { name: 'W' } }],
                }),
            ),
        ).toBe('Product');
    });

    it('returns Product when og:type="product"', () => {
        expect(classifyPage(facts({ ogType: { value: 'product', source: 'og' } }))).toBe('Product');
    });
});

describe('inferOrganizationType', () => {
    it('returns Organization for a generic .com URL with no other signals', () => {
        expect(inferOrganizationType(facts({ url: 'https://example.com/' }))).toBe('Organization');
    });

    it('returns GovernmentOrganization for a .gov TLD', () => {
        expect(inferOrganizationType(facts({ url: 'https://whitehouse.gov/' }))).toBe(
            'GovernmentOrganization',
        );
    });

    it('returns GovernmentOrganization for country-code government TLDs (.gov.uk)', () => {
        expect(inferOrganizationType(facts({ url: 'https://example.gov.uk/page/' }))).toBe(
            'GovernmentOrganization',
        );
    });

    it('returns EducationalOrganization for a .edu TLD', () => {
        expect(inferOrganizationType(facts({ url: 'https://mit.edu/' }))).toBe(
            'EducationalOrganization',
        );
    });

    it('picks up a LocalBusiness subtype from page microdata', () => {
        expect(
            inferOrganizationType(
                facts({
                    url: 'https://example.com/',
                    microdata: [
                        { itemtype: 'https://schema.org/Restaurant', props: { name: 'X' } },
                    ],
                }),
            ),
        ).toBe('Restaurant');
    });

    it('preserves a live Organization subtype over inference', () => {
        // Even though the URL is .com (would default to Organization),
        // the live JSON-LD declares NewsMediaOrganization. We must not
        // downgrade what the site already says.
        expect(
            inferOrganizationType(facts({ url: 'https://news.example.com/' }), [
                { '@type': 'NewsMediaOrganization', '@id': 'x' },
            ]),
        ).toBe('NewsMediaOrganization');
    });

    it('ignores a live plain Organization when a stronger signal exists', () => {
        // Live says `Organization` (the default); TLD says `.gov`.
        // The live type is too weak to preserve against a stronger
        // inference.
        expect(
            inferOrganizationType(facts({ url: 'https://example.gov/' }), [
                { '@type': 'Organization', '@id': 'x' },
            ]),
        ).toBe('GovernmentOrganization');
    });

    it('honors the first array-typed Organization entry', () => {
        expect(
            inferOrganizationType(facts({ url: 'https://example.com/' }), [
                { '@type': ['Organization', 'LocalBusiness'], '@id': 'x' },
            ]),
        ).toBe('Organization');
    });

    describe('extended government host patterns', () => {
        it.each([
            ['https://army.mil/', 'GovernmentOrganization'],
            ['https://www.gouv.fr/', 'GovernmentOrganization'],
            ['https://canada.gc.ca/', 'GovernmentOrganization'],
            ['https://www.mofa.go.jp/', 'GovernmentOrganization'],
            ['https://www.bund.de/', 'GovernmentOrganization'],
            ['https://www.overheid.nl/', 'GovernmentOrganization'],
            ['https://www.gob.mx/', 'GovernmentOrganization'],
        ])('%s → %s', (url, expected) => {
            expect(inferOrganizationType(facts({ url }))).toBe(expected);
        });

        it('does not match near-misses like .gob alone in the middle of a host', () => {
            expect(inferOrganizationType(facts({ url: 'https://gob.example.com/' }))).toBe(
                'Organization',
            );
        });
    });

    describe('extended academic host patterns', () => {
        it.each([
            ['https://www.ox.ac.uk/', 'EducationalOrganization'],
            ['https://u-tokyo.ac.jp/', 'EducationalOrganization'],
            ['https://www.sydney.edu.au/', 'EducationalOrganization'],
        ])('%s → %s', (url, expected) => {
            expect(inferOrganizationType(facts({ url }))).toBe(expected);
        });
    });

    describe('news host patterns', () => {
        it('returns NewsMediaOrganization for a `news.` subdomain', () => {
            expect(inferOrganizationType(facts({ url: 'https://news.bbc.co.uk/article' }))).toBe(
                'NewsMediaOrganization',
            );
        });

        it('returns NewsMediaOrganization for the .news gTLD', () => {
            expect(inferOrganizationType(facts({ url: 'https://examplepaper.news/' }))).toBe(
                'NewsMediaOrganization',
            );
        });

        it('government host outranks news subdomain (stronger signal wins)', () => {
            // e.g. news.gov.uk would be gov-first.
            expect(inferOrganizationType(facts({ url: 'https://news.gov.uk/release' }))).toBe(
                'GovernmentOrganization',
            );
        });
    });

    describe('microdata LocalBusiness props signal', () => {
        it('returns LocalBusiness when a bare Organization island has telephone', () => {
            expect(
                inferOrganizationType(
                    facts({
                        url: 'https://example.com/',
                        microdata: [
                            {
                                itemtype: 'https://schema.org/Organization',
                                props: { name: 'X', telephone: '+31-24-1234567' },
                            },
                        ],
                    }),
                ),
            ).toBe('LocalBusiness');
        });

        it('returns LocalBusiness when address is set', () => {
            expect(
                inferOrganizationType(
                    facts({
                        url: 'https://example.com/',
                        microdata: [
                            {
                                itemtype: 'https://schema.org/Organization',
                                props: { address: 'Somewhere 1, Wijchen' },
                            },
                        ],
                    }),
                ),
            ).toBe('LocalBusiness');
        });

        it('does NOT override an explicit microdata subtype with LocalBusiness', () => {
            // Restaurant is more specific and comes from step 2; step 3
            // shouldn't downgrade it to LocalBusiness.
            expect(
                inferOrganizationType(
                    facts({
                        url: 'https://example.com/',
                        microdata: [
                            {
                                itemtype: 'https://schema.org/Restaurant',
                                props: { telephone: '+1 555 0100' },
                            },
                        ],
                    }),
                ),
            ).toBe('Restaurant');
        });

        it('does not fire when the bare-Organization island has no relevant props', () => {
            expect(
                inferOrganizationType(
                    facts({
                        url: 'https://example.com/',
                        microdata: [
                            {
                                itemtype: 'https://schema.org/Organization',
                                props: { name: 'X' }, // no telephone/address/openingHours
                            },
                        ],
                    }),
                ),
            ).toBe('Organization');
        });
    });

    describe('contact-page signals', () => {
        const facts = (url = 'https://example.com/') => ({
            url,
            allImages: [],
            breadcrumbs: [],
            microdata: [],
        });

        it('upgrades to NGO when non-profit keywords are present', () => {
            expect(
                inferOrganizationType(facts(), [], {
                    sourceUrl: 'https://example.com/contact',
                    identifiers: [],
                    vatIds: [],
                    telephones: [],
                    isNonProfit: true,
                    registrySameAs: [],
                }),
            ).toBe('NGO');
        });

        it('upgrades to Corporation when a business id is present and no phone', () => {
            expect(
                inferOrganizationType(facts(), [], {
                    sourceUrl: 'https://example.com/contact',
                    identifiers: [{ kind: 'KvK', value: '12345678' }],
                    vatIds: [],
                    telephones: [],
                    isNonProfit: false,
                    registrySameAs: [],
                }),
            ).toBe('Corporation');
        });

        it('upgrades to LocalBusiness when business id + phone co-occur', () => {
            expect(
                inferOrganizationType(facts(), [], {
                    sourceUrl: 'https://example.com/contact',
                    identifiers: [{ kind: 'KvK', value: '12345678' }],
                    vatIds: [],
                    telephones: ['+31 24 1234567'],
                    isNonProfit: false,
                    registrySameAs: [],
                }),
            ).toBe('LocalBusiness');
        });

        it('upgrades to LocalBusiness on phone alone (weaker but still findable)', () => {
            expect(
                inferOrganizationType(facts(), [], {
                    sourceUrl: 'https://example.com/contact',
                    identifiers: [],
                    vatIds: [],
                    telephones: ['+1 555 0100'],
                    isNonProfit: false,
                    registrySameAs: [],
                }),
            ).toBe('LocalBusiness');
        });

        it('still preserves a live NewsMediaOrganization over contact signals', () => {
            // Live subtype wins over anything downstream.
            expect(
                inferOrganizationType(facts(), [{ '@type': 'NewsMediaOrganization', '@id': 'x' }], {
                    sourceUrl: 'https://example.com/contact',
                    identifiers: [{ kind: 'KvK', value: '12345678' }],
                    vatIds: [],
                    telephones: [],
                    isNonProfit: false,
                    registrySameAs: [],
                }),
            ).toBe('NewsMediaOrganization');
        });
    });

    describe('NewsArticle classification tiebreaker', () => {
        it('falls back to NewsMediaOrganization when the page is classified as NewsArticle', () => {
            expect(
                inferOrganizationType(
                    facts({
                        url: 'https://generic.example.com/',
                        ogType: { value: 'article', source: 'og' },
                        articleSection: { value: 'Breaking News', source: 'og' },
                    }),
                ),
            ).toBe('NewsMediaOrganization');
        });

        it('does not override a stronger TLD signal', () => {
            // .gov.uk wins even if the page is news-flavored.
            expect(
                inferOrganizationType(
                    facts({
                        url: 'https://example.gov.uk/news/breaking',
                        ogType: { value: 'article', source: 'og' },
                        articleSection: { value: 'Breaking News', source: 'og' },
                    }),
                ),
            ).toBe('GovernmentOrganization');
        });
    });
});

describe('recommend', () => {
    describe('organization subtype threading', () => {
        it('emits the inferred Organization subtype on the publisher piece', () => {
            const out = recommend(
                facts({ url: 'https://example.gov/', siteName: { value: 'State', source: 'og' } }),
            );
            const org = out.entities.find((e) => e['@id']?.toString().endsWith('publisher'));
            expect(org?.['@type']).toBe('GovernmentOrganization');
            expect(out.organizationType).toBe('GovernmentOrganization');
        });

        it('enriches the Organization entity with identifier / vatID / telephone / sameAs from contact facts', () => {
            const out = recommend(
                facts({
                    url: 'https://example.com/',
                    siteName: { value: 'Example', source: 'og' },
                }),
                {
                    contactFacts: {
                        sourceUrl: 'https://example.com/contact',
                        identifiers: [
                            { kind: 'KvK', value: '12345678' },
                            { kind: 'CompaniesHouse', value: '00000001' },
                        ],
                        vatIds: ['NL123456789B01'],
                        telephones: ['+31 24 1234567'],
                        isNonProfit: false,
                        registrySameAs: [
                            'https://find-and-update.company-information.service.gov.uk/company/00000001',
                        ],
                    },
                },
            );
            const org = out.entities.find((e) => e['@id']?.toString().endsWith('publisher'));
            expect(org?.identifier).toEqual([
                { '@type': 'PropertyValue', propertyID: 'KvK', value: '12345678' },
                {
                    '@type': 'PropertyValue',
                    propertyID: 'CompaniesHouse',
                    value: '00000001',
                },
            ]);
            expect(org?.vatID).toBe('NL123456789B01');
            expect(org?.telephone).toBe('+31 24 1234567');
            expect(org?.sameAs).toEqual([
                'https://find-and-update.company-information.service.gov.uk/company/00000001',
            ]);
        });

        it('merges Twitter sameAs with registry sameAs without duplicates', () => {
            const out = recommend(
                facts({
                    twitterSite: { value: '@example', source: 'twitter' },
                    siteName: { value: 'Example', source: 'og' },
                }),
                {
                    contactFacts: {
                        sourceUrl: 'https://example.com/contact',
                        identifiers: [],
                        vatIds: [],
                        telephones: [],
                        isNonProfit: false,
                        registrySameAs: ['https://twitter.com/example'], // overlap
                    },
                },
            );
            const org = out.entities.find((e) => e['@id']?.toString().endsWith('publisher'));
            expect(org?.sameAs).toEqual(['https://twitter.com/example']); // deduped
        });

        it('honors liveEntities for subtype preservation', () => {
            const out = recommend(facts({ url: 'https://example.com/' }), {
                liveEntities: [{ '@type': 'NewsMediaOrganization', '@id': 'x' }],
            });
            const org = out.entities.find((e) => e['@id']?.toString().endsWith('publisher'));
            expect(org?.['@type']).toBe('NewsMediaOrganization');
        });
    });

    describe('baseline (WebPage only)', () => {
        it('always emits Organization, WebSite, WebPage at minimum', () => {
            const out = recommend(
                facts({
                    title: { value: 'Hello', source: 'og' },
                    siteName: { value: 'Example', source: 'og' },
                }),
            );
            expect(typesOf(out.entities)).toEqual(['Organization', 'WebSite', 'WebPage']);
        });

        it('derives siteUrl from canonical when present', () => {
            const out = recommend(
                facts({
                    canonical: { value: 'https://example.com/canon/', source: 'link' },
                }),
            );
            expect(out.siteUrl).toBe('https://example.com');
        });

        it('falls back publisher name to the hostname when siteName is absent', () => {
            const out = recommend(facts({ url: 'https://example.com/' }));
            const org = entityOfType(out.entities, 'Organization');
            expect(org?.name).toBe('example.com');
        });

        it('adds sameAs with Twitter URL when twitter:site is present', () => {
            const out = recommend(
                facts({
                    twitterSite: { value: '@example', source: 'twitter' },
                    siteName: { value: 'Example', source: 'og' },
                }),
            );
            const org = entityOfType(out.entities, 'Organization');
            expect(org?.sameAs).toEqual(['https://twitter.com/example']);
        });

        it('propagates inLanguage (normalized to hyphens) to WebSite and WebPage', () => {
            const out = recommend(facts({ locale: { value: 'en_US', source: 'og' } }));
            const site = entityOfType(out.entities, 'WebSite');
            const page = entityOfType(out.entities, 'WebPage');
            expect(site?.inLanguage).toBe('en-US');
            expect(page?.inLanguage).toBe('en-US');
        });

        it('carries datePublished/dateModified onto the WebPage when present', () => {
            const out = recommend(
                facts({
                    datePublished: { value: '2026-04-01T00:00:00Z', source: 'og' },
                    dateModified: { value: '2026-04-10T00:00:00Z', source: 'og' },
                }),
            );
            const page = entityOfType(out.entities, 'WebPage');
            expect(page?.datePublished).toBe('2026-04-01T00:00:00.000Z');
            expect(page?.dateModified).toBe('2026-04-10T00:00:00.000Z');
        });

        it('silently drops invalid date strings', () => {
            const out = recommend(facts({ datePublished: { value: 'not a date', source: 'og' } }));
            const page = entityOfType(out.entities, 'WebPage');
            expect(page?.datePublished).toBeUndefined();
        });
    });

    describe('article pages', () => {
        it('emits a BlogPosting when og:type="article" and datePublished is valid', () => {
            const out = recommend(
                facts({
                    title: { value: 'Hello', source: 'og' },
                    description: { value: 'A post', source: 'og' },
                    ogType: { value: 'article', source: 'og' },
                    datePublished: { value: '2026-04-01T00:00:00Z', source: 'og' },
                    author: { name: 'Joost', source: 'og' },
                    siteName: { value: 'Example', source: 'og' },
                }),
            );
            const article = entityOfType(out.entities, 'BlogPosting');
            expect(article).toBeDefined();
            expect(article?.headline).toBe('Hello');
            expect(article?.datePublished).toBe('2026-04-01T00:00:00.000Z');
        });

        it('references an author Person by @id when an author fact exists', () => {
            const out = recommend(
                facts({
                    ogType: { value: 'article', source: 'og' },
                    title: { value: 'T', source: 'og' },
                    description: { value: 'D', source: 'og' },
                    datePublished: { value: '2026-04-01', source: 'og' },
                    author: { name: 'Joost', url: 'https://example.com/about/', source: 'og' },
                }),
            );
            const person = entityOfType(out.entities, 'Person');
            const article = entityOfType(out.entities, 'BlogPosting');
            expect(person?.name).toBe('Joost');
            expect(article?.author).toEqual({ '@id': person?.['@id'], name: 'Joost' });
        });

        it('falls back author to the publisher Organization when no author fact', () => {
            const out = recommend(
                facts({
                    ogType: { value: 'article', source: 'og' },
                    title: { value: 'T', source: 'og' },
                    description: { value: 'D', source: 'og' },
                    datePublished: { value: '2026-04-01', source: 'og' },
                    siteName: { value: 'Example', source: 'og' },
                }),
            );
            const article = entityOfType(out.entities, 'BlogPosting');
            expect(article?.author).toEqual({
                '@id': 'https://example.com/#/schema.org/Organization/publisher',
            });
        });

        it('skips the Article entity entirely when datePublished is missing', () => {
            const out = recommend(
                facts({
                    ogType: { value: 'article', source: 'og' },
                    title: { value: 'T', source: 'og' },
                }),
            );
            expect(typesOf(out.entities)).not.toContain('BlogPosting');
            expect(typesOf(out.entities)).not.toContain('Article');
        });

        it('uses NewsArticle for news-flavored sections', () => {
            const out = recommend(
                facts({
                    ogType: { value: 'article', source: 'og' },
                    title: { value: 'T', source: 'og' },
                    description: { value: 'D', source: 'og' },
                    articleSection: { value: 'Breaking News', source: 'og' },
                    datePublished: { value: '2026-04-01', source: 'og' },
                }),
            );
            expect(typesOf(out.entities)).toContain('NewsArticle');
        });
    });

    describe('breadcrumbs', () => {
        it('emits BreadcrumbList and references it from WebPage', () => {
            const out = recommend(
                facts({
                    breadcrumbs: [
                        {
                            position: 1,
                            name: 'Home',
                            url: 'https://example.com/',
                            source: 'microdata',
                        },
                        {
                            position: 2,
                            name: 'Posts',
                            url: 'https://example.com/posts/',
                            source: 'microdata',
                        },
                    ],
                }),
            );
            const crumbs = entityOfType(out.entities, 'BreadcrumbList');
            expect(crumbs).toBeDefined();
            const page = entityOfType(out.entities, 'WebPage');
            expect(page?.breadcrumb).toEqual({ '@id': crumbs?.['@id'] });
        });

        it('does NOT emit BreadcrumbList when all items lack URLs', () => {
            const out = recommend(
                facts({
                    breadcrumbs: [
                        { position: 1, name: 'Home', source: 'breadcrumb-nav' },
                        { position: 2, name: 'Posts', source: 'breadcrumb-nav' },
                    ],
                }),
            );
            expect(typesOf(out.entities)).not.toContain('BreadcrumbList');
        });
    });

    describe('primary image', () => {
        it('emits ImageObject when width/height are known', () => {
            const out = recommend(
                facts({
                    primaryImage: {
                        url: 'https://cdn.example/og.png',
                        width: 1200,
                        height: 675,
                        alt: 'hero',
                        source: 'og',
                    },
                }),
            );
            const img = entityOfType(out.entities, 'ImageObject');
            expect(img).toBeDefined();
            expect(img?.width).toBe(1200);
            expect(img?.caption).toBe('hero');
            // buildWebPage emits `primaryImageOfPage`, not `primaryImage`
            // (that's the schema.org name; `primaryImage` is only the
            // input field).
            const page = entityOfType(out.entities, 'WebPage');
            expect(page?.primaryImageOfPage).toEqual({ '@id': img?.['@id'] });
        });

        it('does NOT emit ImageObject when dimensions are unknown', () => {
            const out = recommend(
                facts({
                    primaryImage: { url: 'https://cdn.example/og.png', source: 'og' },
                }),
            );
            expect(typesOf(out.entities)).not.toContain('ImageObject');
        });
    });

    describe('product', () => {
        it('emits a Product piece with microdata fields', () => {
            const out = recommend(
                facts({
                    url: 'https://example.com/products/widget/',
                    title: { value: 'Widget', source: 'og' },
                    microdata: [
                        {
                            itemtype: 'https://schema.org/Product',
                            props: {
                                name: 'Widget',
                                sku: 'W-123',
                                brand: 'Acme',
                                image: 'https://cdn.example/w.png',
                            },
                        },
                    ],
                }),
            );
            const product = entityOfType(out.entities, 'Product');
            expect(product).toMatchObject({
                '@type': 'Product',
                name: 'Widget',
                sku: 'W-123',
                brand: 'Acme',
                image: 'https://cdn.example/w.png',
            });
        });
    });

    describe('profile pages', () => {
        it('emits a ProfilePage WebPage subtype', () => {
            const out = recommend(
                facts({
                    url: 'https://example.com/about-me/',
                    ogType: { value: 'profile', source: 'og' },
                    title: { value: 'About', source: 'og' },
                }),
            );
            const page = entityOfType(out.entities, 'ProfilePage');
            expect(page).toBeDefined();
        });
    });
});
