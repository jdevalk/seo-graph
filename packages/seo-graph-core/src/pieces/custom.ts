import type { Thing } from 'schema-dts';

/**
 * Escape hatch: build an arbitrary schema.org piece from a raw object.
 *
 * Use this when the built-in piece builders don't cover what you need —
 * e.g. a Recipe, Event, Product, or a LocalBusiness subtype that needs
 * a specific shape not captured by `buildOrganization`.
 *
 * Pass a `schema-dts` type as the generic parameter to get autocomplete
 * for that type's properties:
 *
 * ```ts
 * import type { VacationRental } from 'schema-dts';
 * buildCustomPiece<VacationRental>({
 *     '@type': 'VacationRental',
 *     '@id': `${siteUrl}#rental`,
 *     name: 'Villa Example',
 *     numberOfRooms: 4,         // ← autocomplete from schema-dts
 *     petsAllowed: true,        // ← autocomplete from schema-dts
 * });
 * ```
 *
 * Without a generic, the input is untyped — any `@type` + properties
 * are accepted. This keeps simple call sites (`buildCustomPiece({...})`)
 * working without extra ceremony.
 */
export function buildCustomPiece<T extends Thing>(
    raw: Partial<T> & { '@type': string | readonly string[]; '@id'?: string },
): Record<string, unknown>;
export function buildCustomPiece(
    raw: Record<string, unknown> & {
        '@type': string | readonly string[];
        '@id'?: string;
    },
): Record<string, unknown>;
export function buildCustomPiece(raw: Record<string, unknown>): Record<string, unknown> {
    return raw;
}
