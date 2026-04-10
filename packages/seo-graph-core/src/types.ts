import type { Thing, WithContext } from 'schema-dts';

/**
 * A reference to another entity in the @graph, by its @id.
 *
 * Most schema.org entities link to each other via `{ '@id': string }`.
 * Some consumers (notably joost.blog's Article.author) include the `name`
 * alongside the id, which is redundant but valid schema.org. The optional
 * `name` field lets callers opt into that pattern.
 */
export interface Reference {
    '@id': string;
    name?: string;
}

/**
 * The assembled @graph produced by `assembleGraph`.
 */
export type SchemaGraph<T extends Thing = Thing> = WithContext<Thing> & {
    '@context': 'https://schema.org';
    '@graph': T[];
};

/**
 * A single entity in the graph, as returned by a piece builder.
 * All entities should carry an `@id` so they can be cross-referenced.
 */
export interface GraphEntity {
    '@type': string | readonly string[];
    '@id'?: string;
    [key: string]: unknown;
}

/**
 * Optional schema.org CreativeWork properties shared across WebSite,
 * WebPage, and Article builders. Extend your input interface from this
 * to inherit the fields.
 */
export interface CreativeWorkFields {
    /** Short description / summary of this entity. */
    description?: string;
    /** What this entity is about — e.g. a Person, Organization, or other entity. */
    about?: Reference;
    /** Content language, e.g. 'en-US'. */
    inLanguage?: string;
    /** Publish date — emitted as ISO string. */
    datePublished?: Date;
    /** Update date — emitted as ISO string. */
    dateModified?: Date;
    /** Who holds the copyright — typically a Person or Organization reference. */
    copyrightHolder?: Reference;
    /** Year copyright was first asserted. */
    copyrightYear?: number;
    /** Human-readable copyright text, e.g. '© 2026 Jane Doe. All rights reserved.' */
    copyrightNotice?: string;
    /** License URL or CreativeWork reference (e.g. a Creative Commons URL). */
    license?: string;
    /** Whether the content is free to access. */
    isAccessibleForFree?: boolean;
}

/**
 * Apply shared CreativeWork fields to a piece under construction.
 * Call from any builder whose input extends `CreativeWorkFields`.
 */
export function applyCreativeWorkFields(
    piece: Record<string, unknown>,
    input: CreativeWorkFields,
): void {
    if (input.description !== undefined) piece.description = input.description;
    if (input.about !== undefined) piece.about = input.about;
    if (input.inLanguage !== undefined) piece.inLanguage = input.inLanguage;
    if (input.datePublished !== undefined) piece.datePublished = input.datePublished.toISOString();
    if (input.dateModified !== undefined) piece.dateModified = input.dateModified.toISOString();
    if (input.copyrightHolder !== undefined) piece.copyrightHolder = input.copyrightHolder;
    if (input.copyrightYear !== undefined) piece.copyrightYear = input.copyrightYear;
    if (input.copyrightNotice !== undefined) piece.copyrightNotice = input.copyrightNotice;
    if (input.license !== undefined) piece.license = input.license;
    if (input.isAccessibleForFree !== undefined)
        piece.isAccessibleForFree = input.isAccessibleForFree;
}

/** Keys that `applyCreativeWorkFields` handles. */
export const CREATIVE_WORK_KEYS = new Set<string>([
    'description',
    'about',
    'inLanguage',
    'datePublished',
    'dateModified',
    'copyrightHolder',
    'copyrightYear',
    'copyrightNotice',
    'license',
    'isAccessibleForFree',
]);

/**
 * Spread all properties from `input` into `piece`, skipping keys that
 * the builder handles specially. Call after all explicit field handling.
 */
export function spreadRemainingProperties(
    piece: Record<string, unknown>,
    input: object,
    handledKeys: ReadonlySet<string>,
): void {
    for (const [key, value] of Object.entries(input)) {
        if (!handledKeys.has(key) && value !== undefined) {
            piece[key] = value;
        }
    }
}
