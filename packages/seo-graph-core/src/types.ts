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
