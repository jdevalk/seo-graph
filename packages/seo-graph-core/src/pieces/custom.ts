/**
 * Escape hatch: build an arbitrary schema.org piece from a raw object.
 *
 * Use this when the built-in piece builders don't cover what you need —
 * e.g. a Recipe, Event, Product, or a LocalBusiness subtype that needs
 * a specific shape not captured by `buildOrganization`.
 *
 * Note: the built piece is returned as-is. It's the caller's responsibility
 * to supply a valid `@type` and (if cross-referenced) a stable `@id`.
 */
export function buildCustomPiece<T extends Record<string, unknown>>(raw: T): T {
    return raw;
}
