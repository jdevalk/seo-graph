import type { IdFactory } from '../ids.js';
import type { Reference } from '../types.js';

export interface ArticleInput {
    /** Canonical URL of the article's page. The @id is `${url}#article`. */
    url: string;
    /** Reference to the enclosing WebPage (usually ids.webPage(url)). */
    isPartOf: Reference;
    /** Author reference. May include a `name` alongside the `@id`. */
    author: Reference;
    /** Publisher reference. Usually the same as the author for personal blogs. */
    publisher: Reference;
    headline: string;
    description: string;
    inLanguage?: string;
    datePublished: Date;
    dateModified?: Date;
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
 * Build a schema.org Article piece. The caller is responsible for pre-
 * computing the references (author, publisher, isPartOf, image) using the
 * IdFactory, so core doesn't have to know anything about how the site
 * models its Person/Organization/WebPage entities.
 */
export function buildArticle(input: ArticleInput, ids: IdFactory): Record<string, unknown> {
    const piece: Record<string, unknown> = {
        '@type': 'Article',
        '@id': ids.article(input.url),
        isPartOf: input.isPartOf,
        author: input.author,
        headline: input.headline,
        mainEntityOfPage: { '@id': ids.webPage(input.url) },
        publisher: input.publisher,
        inLanguage: input.inLanguage ?? 'en-US',
        description: input.description,
        datePublished: input.datePublished.toISOString(),
    };

    if (input.dateModified !== undefined) {
        piece.dateModified = input.dateModified.toISOString();
    }
    if (input.image !== undefined) piece.image = input.image;
    if (input.articleSection !== undefined) piece.articleSection = input.articleSection;
    if (input.wordCount !== undefined) piece.wordCount = input.wordCount;
    if (input.articleBody !== undefined) piece.articleBody = input.articleBody;

    return { ...piece, ...input.extra };
}
