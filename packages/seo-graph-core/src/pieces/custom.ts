import type { Thing } from 'schema-dts';

/**
 * Build an arbitrary schema.org piece from a raw object.
 *
 * Pass a `schema-dts` type as the generic parameter to get autocomplete.
 * The `@type` value in your input narrows the union to the matching leaf
 * type, so `buildPiece<Product>` with `'@type': 'Product'` gives you
 * full ProductLeaf autocomplete — no need to import Leaf types.
 *
 * ```ts
 * import type { Product } from 'schema-dts';
 * buildPiece<Product>({
 *     '@type': 'Product',
 *     '@id': `${url}#product`,
 *     name: 'Running Shoe',
 *     color: 'Black',           // ← autocomplete from schema-dts
 *     sku: 'ABC123',            // ← autocomplete from schema-dts
 * });
 * ```
 *
 * Without a generic, the input is untyped — any properties are accepted.
 */
export function buildPiece<T extends Thing, TType extends string = string>(
    raw: Partial<Extract<T, { '@type': TType }>> & {
        '@type': TType;
        '@id'?: string;
    },
): Record<string, unknown>;
export function buildPiece(
    raw: Record<string, unknown> & {
        '@type': string | readonly string[];
        '@id'?: string;
    },
): Record<string, unknown>;
export function buildPiece(raw: Record<string, unknown>): Record<string, unknown> {
    return raw;
}
