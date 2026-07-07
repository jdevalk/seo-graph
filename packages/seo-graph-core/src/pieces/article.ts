import type { ArticleLeaf } from 'schema-dts';

import type { IdFactory } from '../ids.js';
import type { Reference, CreativeWorkFields, GraphEntity } from '../types.js';
import {
    applyCreativeWorkFields,
    spreadRemainingProperties,
    CREATIVE_WORK_KEYS,
} from '../types.js';

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

interface ArticleCoreFields extends CreativeWorkFields {
    /** Canonical URL of the article's page. The @id is `${url}#article`. */
    url: string;
    /**
     * Reference to the enclosing entity, usually the WebPage
     * (`ids.webPage(url)`). Pass an array to link the Article to more than
     * one parent — e.g. both its WebPage and a Blog
     * (`[{ '@id': ids.webPage(url) }, { '@id': blogId }]`).
     */
    isPartOf: Reference | Reference[];
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
    articleBody?: string;
}

export type ArticleInput = ArticleCoreFields &
    Omit<Partial<ArticleLeaf>, keyof ArticleCoreFields | '@type'>;

const HANDLED_KEYS = new Set<string>([
    ...CREATIVE_WORK_KEYS,
    'url',
    'isPartOf',
    'author',
    'publisher',
    'headline',
    'image',
    'articleSection',
    'wordCount',
    'articleBody',
]);

/**
 * Build a schema.org Article piece.
 */
export function buildArticle(
    input: ArticleInput,
    ids: IdFactory,
    type: ArticleType = 'Article',
): GraphEntity {
    const piece: GraphEntity = {
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
    spreadRemainingProperties(piece, input, HANDLED_KEYS);

    return piece;
}
