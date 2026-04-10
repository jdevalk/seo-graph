import type { IdFactory } from '../ids.js';
import type { Reference, CreativeWorkFields } from '../types.js';
import { applyCreativeWorkFields } from '../types.js';

export interface ArticleInput extends CreativeWorkFields {
    /** Canonical URL of the article's page. The @id is `${url}#article`. */
    url: string;
    /** Reference to the enclosing WebPage (usually ids.webPage(url)). */
    isPartOf: Reference;
    /** Author reference. May include a `name` alongside the `@id`. */
    author: Reference;
    /** Publisher reference. Usually the same as the author for personal blogs. */
    publisher: Reference;
    headline: string;
    /** Required for articles — overrides the optional inherited field. */
    description: string;
    /** Required for articles — overrides the optional inherited field. Emitted as ISO string. */
    datePublished: Date;
    /** Reference to the primary ImageObject, if any. */
    image?: Reference;
    /** Top-level category, emitted as `articleSection`. */
    articleSection?: string;
    wordCount?: number;
    /**
     * Full or truncated article body, emitted as `articleBody`. Pass from
     * the aggregator / build step; core doesn't derive it from anything.
     */
    articleBody?: string;
    extra?: Record<string, unknown>;
}

/**
 * Concrete Article subtype. `Article` is the default; use `BlogPosting`
 * for blog posts, `NewsArticle` for journalism, `TechArticle` for
 * technical docs, `ScholarlyArticle` for academic papers, or `Report`
 * for data/research reports.
 */
export type ArticleType =
    | 'Article'
    | 'BlogPosting'
    | 'NewsArticle'
    | 'TechArticle'
    | 'ScholarlyArticle'
    | 'Report';

/**
 * Build a schema.org Article piece. The caller is responsible for pre-
 * computing the references (author, publisher, isPartOf, image) using the
 * IdFactory, so core doesn't have to know anything about how the site
 * models its Person/Organization/WebPage entities.
 */
export function buildArticle(
    input: ArticleInput,
    ids: IdFactory,
    type: ArticleType = 'Article',
): Record<string, unknown> {
    const piece: Record<string, unknown> = {
        '@type': type,
        '@id': ids.article(input.url),
        isPartOf: input.isPartOf,
        author: input.author,
        headline: input.headline,
        mainEntityOfPage: { '@id': ids.webPage(input.url) },
        publisher: input.publisher,
    };

    if (input.image !== undefined) piece.image = input.image;
    applyCreativeWorkFields(piece, input);
    if (input.articleSection !== undefined) piece.articleSection = input.articleSection;
    if (input.wordCount !== undefined) piece.wordCount = input.wordCount;
    if (input.articleBody !== undefined) piece.articleBody = input.articleBody;

    return { ...piece, ...input.extra };
}
