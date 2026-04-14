/**
 * Contact-page discovery and organisation-fact extraction.
 *
 * Many sites hide their strongest Organization signals (Chamber of
 * Commerce numbers, VAT IDs, registered office, legal form) on a
 * dedicated contact or impressum page. This module finds that page,
 * fetches it, and extracts structured facts that feed into the
 * publisher Organization entity.
 *
 * Scope: NL, UK, DE, FR, US, CA, AU, NZ. Each locale has a small
 * set of patterns for business registration identifiers and VAT IDs.
 * Patterns are anchored on strong context phrases ("KVK", "Company
 * Number", "HRB", "SIREN", "ABN", etc.) rather than raw digit runs —
 * a plain 9-digit number in body text is meaningless without the
 * label.
 */
import * as cheerio from 'cheerio';

/** What we learn about the organisation from the contact/about page. */
export interface OrganizationFacts {
    /** Absolute URL of the page we extracted facts from. */
    sourceUrl: string;
    /** Business registration identifiers, with locale tag. */
    identifiers: OrganizationIdentifier[];
    /** VAT / sales-tax IDs. */
    vatIds: string[];
    /** Phone numbers from `tel:` links (most reliable extraction surface). */
    telephones: string[];
    /** Detected legal form suffix (GmbH, BV, Inc, Pty Ltd, e.V., …). */
    legalForm?: string;
    /** True when a non-profit keyword is present (Foundation, Stichting, e.V., etc.). */
    isNonProfit: boolean;
    /**
     * `sameAs` URLs to public registries (Companies House, ABN Lookup,
     * NZBN, annuaire-entreprises, etc.) — populated when the registry
     * exposes a canonical lookup URL per-identifier.
     */
    registrySameAs: string[];
}

/** One identifier with enough context for `schema.org/PropertyValue`. */
export interface OrganizationIdentifier {
    /**
     * Locale-specific register kind. Used as `propertyID` on the emitted
     * `PropertyValue`.
     */
    kind:
        | 'KvK' // Netherlands — Kamer van Koophandel
        | 'CompaniesHouse' // UK — Companies House
        | 'HRB' // Germany — Handelsregister B
        | 'HRA' // Germany — Handelsregister A
        | 'SIREN' // France — 9-digit enterprise identifier
        | 'SIRET' // France — 14-digit establishment identifier
        | 'EIN' // US — Employer Identification Number
        | 'BN' // Canada — Business Number
        | 'NEQ' // Canada — Numéro d'entreprise du Québec
        | 'ABN' // Australia — Australian Business Number
        | 'ACN' // Australia — Australian Company Number
        | 'NZBN'; // New Zealand — New Zealand Business Number
    value: string;
}

// --- Pattern library ---------------------------------------------------
//
// Every pattern anchors on a context phrase. We deliberately avoid
// matching bare digit runs — a random 9-digit number on a blog post is
// far more likely to be a PostgreSQL autoincrement id than a SIREN.

/** Strip whitespace from an identifier capture (AU formats them with spaces). */
const compact = (s: string): string => s.replace(/\s+/g, '');

/** Patterns for country-specific business identifiers. */
const IDENTIFIER_PATTERNS: Array<{
    kind: OrganizationIdentifier['kind'];
    re: RegExp;
    normalize?: (match: string) => string;
}> = [
    // --- Netherlands ---
    {
        kind: 'KvK',
        // `KVK-nummer: 12345678`, `Kamer van Koophandel 12345678`, `KVK: 12345678`
        re: /(?:KVK(?:[-\s]?(?:nummer|number))?|Kamer\s+van\s+Koophandel(?:\s+nummer)?)\s*[:.\s]*\s*(\d{8})\b/gi,
    },

    // --- United Kingdom ---
    {
        kind: 'CompaniesHouse',
        // `Company No. 12345678`, `Company Number: 1234567`, "Registered in England and Wales No. 12345678"
        re: /(?:Company\s+(?:No|Number)\.?|Registered\s+in\s+(?:England|Wales|Scotland|Northern\s+Ireland)[^\d]{0,40}?No\.?)\s*[:.\s]+\s*(\d{5,8})\b/gi,
    },

    // --- Germany ---
    {
        kind: 'HRB',
        // `HRB 12345`, `HRB: 12345678`
        re: /\bHRB\s*[:.\s]*(\d{3,7})\b/gi,
    },
    {
        kind: 'HRA',
        re: /\bHRA\s*[:.\s]*(\d{3,7})\b/gi,
    },

    // --- France ---
    {
        kind: 'SIREN',
        // `SIREN 123 456 789`, `SIREN: 123456789`
        re: /\bSIREN\s*[:.\s]*\s*((?:\d[\s.]*){9})\b/gi,
        normalize: (s) => s.replace(/[\s.]/g, ''),
    },
    {
        kind: 'SIRET',
        // `SIRET 123 456 789 00012`, 14 digits with optional separators.
        re: /\bSIRET\s*[:.\s]*\s*((?:\d[\s.]*){14})\b/gi,
        normalize: (s) => s.replace(/[\s.]/g, ''),
    },

    // --- United States ---
    {
        kind: 'EIN',
        // `EIN: 12-3456789`, `Employer Identification Number: 12-3456789`, `Federal Tax ID 12-3456789`
        re: /(?:EIN|Employer\s+Identification\s+Number|Federal\s+Tax\s+ID|Tax\s+ID)\s*[:.\s#]+\s*(\d{2}-\d{7})\b/gi,
    },

    // --- Canada ---
    {
        kind: 'BN',
        // `Business Number: 123456789`, `BN: 123456789RC0001`
        re: /(?:Business\s+Number|\bBN)\s*[:.\s]+\s*(\d{9}(?:[A-Z]{2}\d{4})?)\b/gi,
    },
    {
        kind: 'NEQ',
        // Quebec — 10 digits.
        re: /\bNEQ\s*[:.\s]+\s*(\d{10})\b/gi,
    },

    // --- Australia ---
    {
        kind: 'ABN',
        // `ABN 12 345 678 901` or `ABN: 12345678901`.
        re: /\bABN\s*[:.\s]*\s*((?:\d[\s.]*){11})\b/gi,
        normalize: compact,
    },
    {
        kind: 'ACN',
        re: /\bACN\s*[:.\s]*\s*((?:\d[\s.]*){9})\b/gi,
        normalize: compact,
    },

    // --- New Zealand ---
    {
        kind: 'NZBN',
        re: /\bNZBN\s*[:.\s]*\s*(\d{13})\b/gi,
    },
];

/** Patterns for VAT / sales-tax identifiers. */
const VAT_PATTERNS: RegExp[] = [
    // EU VAT — country prefix + digits/letters. Labeled with BTW/VAT/USt/TVA/IVA etc.
    /\b(?:BTW|VAT|USt(?:-IdNr)?|TVA|IVA|MwSt)\s*[:.\s#-]*\s*([A-Z]{2}[0-9A-Z]{8,12})\b/gi,
    // UK VAT — `VAT GB 123 4567 89` or `GB 123456789`.
    /\b(?:VAT\s*(?:No|Number|Reg)?\.?\s*)?(GB\s?\d{3}\s?\d{4}\s?\d{2,5})\b/gi,
];

/**
 * Legal-form suffixes we map to Corporation. Ordered by specificity —
 * multi-word forms first so `Pty Ltd` isn't truncated to `Ltd` by the
 * generic English pattern.
 */
const CORPORATION_SUFFIXES: RegExp[] = [
    // Australian / NZ — multi-word, must run before the English group.
    /\bPty\.?\s*Ltd\.?\b/i,
    // English
    /\b(?:Inc|LLC|LLP|Corp|Corporation|PLC|Ltd|Limited|Co\.|Company)\.?\b/,
    // Dutch
    /\b(?:BV|B\.V\.|NV|N\.V\.)\b/,
    // German
    /\b(?:GmbH|AG|UG|OHG|KG|GbR|e\.G\.)\b/,
    // French
    /\b(?:SA|SAS|SASU|SARL|EURL|SNC|SCA|SCS)\b/,
    // Italian / Spanish (common enough to add while we're here)
    /\b(?:SpA|SRL|S\.L\.|S\.A\.)\b/,
];

/** Legal-form / explicit keyword signals for non-profits. */
const NONPROFIT_SIGNALS: RegExp[] = [
    /\bFoundation\b/i,
    /\bCharity\b/i,
    /\b(?:Non-?profit|Not-for-profit)\b/i,
    /501\(c\)\(3\)/,
    /\bStichting\b/i,
    /\bVereniging\b/i,
    /\bgemeinn(?:ü|u)tzig\b/i,
    // `\b` after a trailing dot doesn't fire at end-of-string (dot is
    // non-word, so both sides of the boundary are non-word). Use a
    // negative lookahead for an alphanumeric char instead.
    /\be\.V\.(?!\w)/,
    /\bStiftung\b/i,
    /\b(?:Association|ASBL)\b/,
];

// --- Discovery ---------------------------------------------------------

/** Path-segment keywords that identify a contact/imprint/about page. */
const CONTACT_PATH_KEYWORDS: Array<{ pattern: RegExp; score: number }> = [
    // Strongest: pages whose purpose is contact info.
    {
        pattern: /^\/?(?:contact|contact-us|contactus|contact[-_]ons|contactgegevens)\/?$/i,
        score: 10,
    },
    { pattern: /^\/?(?:kontakt|contacto|contato|contactez-nous)\/?$/i, score: 10 },
    // Imprint / legal pages — strong for DE/AT/CH; sometimes elsewhere.
    { pattern: /^\/?(?:impressum|imprint|mentions-legales|colofon)\/?$/i, score: 9 },
    // About pages usually have org info but less registry detail.
    {
        pattern:
            /^\/?(?:about|about-us|over-ons|ueber-uns|uber-uns|a-propos|chi-siamo|sobre-nosotros)\/?$/i,
        score: 5,
    },
];

/**
 * Pick the best contact-page URL from a list of candidate URLs
 * (typically sitemap entries). Returns `undefined` when no reasonable
 * candidate is found.
 */
export function pickContactUrl(urls: readonly string[]): string | undefined {
    let best: { url: string; score: number } | undefined;
    for (const url of urls) {
        let pathname: string;
        try {
            pathname = new URL(url).pathname;
        } catch {
            continue;
        }
        for (const { pattern, score } of CONTACT_PATH_KEYWORDS) {
            if (pattern.test(pathname)) {
                if (!best || score > best.score) best = { url, score };
                break;
            }
        }
    }
    return best?.url;
}

// --- Extraction --------------------------------------------------------

/** Pull `tel:` hrefs (the most reliable phone source on a contact page). */
function extractTelephones($: cheerio.CheerioAPI): string[] {
    const out = new Set<string>();
    $('a[href^="tel:"]').each((_, el) => {
        const href = $(el).attr('href');
        if (!href) return;
        const num = href.replace(/^tel:/i, '').trim();
        if (num) out.add(num);
    });
    return [...out];
}

/**
 * Apply every identifier pattern to a text blob; returns one entry per
 * (kind, value) pair, deduped across multiple mentions of the same
 * value.
 */
function extractIdentifiers(text: string): OrganizationIdentifier[] {
    const seen = new Set<string>();
    const out: OrganizationIdentifier[] = [];
    for (const { kind, re, normalize } of IDENTIFIER_PATTERNS) {
        // Global regex — must reset lastIndex per invocation even though
        // we use matchAll (which ignores it) to be safe against mutation.
        re.lastIndex = 0;
        for (const match of text.matchAll(re)) {
            const raw = match[1];
            if (!raw) continue;
            const value = normalize ? normalize(raw) : raw;
            const key = `${kind}:${value}`;
            if (seen.has(key)) continue;
            seen.add(key);
            out.push({ kind, value });
        }
    }
    return out;
}

/** Apply VAT patterns, deduping across them. */
function extractVatIds(text: string): string[] {
    const seen = new Set<string>();
    for (const re of VAT_PATTERNS) {
        re.lastIndex = 0;
        for (const match of text.matchAll(re)) {
            const raw = match[1];
            if (!raw) continue;
            seen.add(raw.replace(/\s+/g, ''));
        }
    }
    return [...seen];
}

/** Detect a corporate suffix in the given text; returns the matched literal. */
function detectLegalForm(text: string): string | undefined {
    for (const re of CORPORATION_SUFFIXES) {
        const m = text.match(re);
        if (m) return m[0];
    }
    return undefined;
}

/** True when any non-profit keyword fires. */
function detectNonProfit(text: string): boolean {
    return NONPROFIT_SIGNALS.some((re) => re.test(text));
}

/**
 * Build public-registry `sameAs` URLs from identifiers where such URLs
 * are stable and canonical. Registries without a deep-link lookup (DE
 * Handelsregister, US EIN, CA BN) are omitted — we still keep the
 * identifier as a PropertyValue on the Organization.
 */
function registrySameAs(ids: readonly OrganizationIdentifier[]): string[] {
    const out: string[] = [];
    for (const id of ids) {
        switch (id.kind) {
            case 'CompaniesHouse':
                out.push(
                    `https://find-and-update.company-information.service.gov.uk/company/${id.value}`,
                );
                break;
            case 'SIREN':
                out.push(`https://annuaire-entreprises.data.gouv.fr/entreprise/${id.value}`);
                break;
            case 'ABN':
                out.push(`https://abr.business.gov.au/ABN/View?id=${id.value}`);
                break;
            case 'NZBN':
                out.push(`https://www.nzbn.govt.nz/mynzbn/nzbndetails/${id.value}/`);
                break;
            default:
                // No public deep-link for KvK/HRB/HRA/SIRET/EIN/BN/NEQ/ACN —
                // they're still emitted as PropertyValue identifiers.
                break;
        }
    }
    return out;
}

/**
 * Extract organisation facts from an HTML document. Scope: the page's
 * entire `<body>` text, plus `tel:` hrefs. No heuristics on the header
 * or navigation — we assume the caller handed us a contact/about page.
 */
export function extractOrganizationFactsFromHtml(
    html: string,
    sourceUrl: string,
): OrganizationFacts {
    const $ = cheerio.load(html);
    // Collapse whitespace to make regexes tolerant of line breaks in
    // postal-address-style blocks.
    const bodyText = $('body').text().replace(/\s+/g, ' ').trim();

    const identifiers = extractIdentifiers(bodyText);
    const vatIds = extractVatIds(bodyText);
    const telephones = extractTelephones($);
    const legalForm = detectLegalForm(bodyText);
    const isNonProfit = detectNonProfit(bodyText);
    const regSameAs = registrySameAs(identifiers);

    return {
        sourceUrl,
        identifiers,
        vatIds,
        telephones,
        ...(legalForm ? { legalForm } : {}),
        isNonProfit,
        registrySameAs: regSameAs,
    };
}
