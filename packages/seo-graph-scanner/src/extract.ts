import * as cheerio from 'cheerio';

export interface ExtractedJsonLd {
    /** Raw JSON.parse'd payload. Can be object or array of objects. */
    payload: unknown;
    /** 1-based index of the <script> tag among JSON-LD scripts on the page. */
    scriptIndex: number;
    /** Parse error if the script body was not valid JSON. */
    parseError?: string;
}

export interface ExtractedPage {
    /** All JSON-LD payloads on the page, in document order. */
    jsonLd: ExtractedJsonLd[];
    /** Canonical URL from <link rel="canonical">, if present. */
    canonical?: string;
    /** <title> text, trimmed. */
    title?: string;
    /** <meta name="description"> content. */
    description?: string;
    /** og:type, if present. Useful as a page-type hint. */
    ogType?: string;
}

/**
 * Parse an HTML document and pull out JSON-LD blocks plus a handful of
 * page-type signals. Does not follow embedded @id references or normalize
 * the graph shape — that's the validator's job.
 */
export function extractFromHtml(html: string): ExtractedPage {
    const $ = cheerio.load(html);

    const jsonLd: ExtractedJsonLd[] = [];
    $('script[type="application/ld+json"]').each((i, el) => {
        const raw = $(el).contents().text().trim();
        if (!raw) return;
        try {
            jsonLd.push({ payload: JSON.parse(raw), scriptIndex: i + 1 });
        } catch (err) {
            jsonLd.push({
                payload: raw,
                scriptIndex: i + 1,
                parseError: err instanceof Error ? err.message : String(err),
            });
        }
    });

    return {
        jsonLd,
        canonical: $('link[rel="canonical"]').attr('href')?.trim(),
        title: $('title').first().text().trim() || undefined,
        description: $('meta[name="description"]').attr('content')?.trim(),
        ogType: $('meta[property="og:type"]').attr('content')?.trim(),
    };
}
