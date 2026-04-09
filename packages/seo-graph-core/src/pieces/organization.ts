import type { Organization } from 'schema-dts';

import type { IdFactory } from '../ids.js';

export interface OrganizationInput<T extends Organization = Organization> {
    /** Stable slug used for the @id. */
    slug: string;
    name: string;
    url?: string;
    description?: string;
    /** Logo URL (raw string) or reference to an ImageObject. */
    logo?: string | { '@id': string };
    sameAs?: readonly string[];
    /**
     * Escape hatch for schema.org properties specific to a subtype. Typed
     * as `Partial<T>` so callers that pass a concrete subtype (e.g.
     * `OrganizationInput<Hotel>`) get schema-dts autocomplete for that
     * subtype's fields — `checkinTime`, `numberOfRooms`, etc. — instead
     * of an untyped `Record<string, unknown>`.
     */
    extra?: Partial<T>;
}

/**
 * Build a schema.org Organization piece, or any of its subtypes. Pass the
 * concrete @type as the third argument and the matching schema-dts type as
 * the generic parameter to get autocomplete for that subtype's fields:
 *
 * ```ts
 * import type { Hotel } from 'schema-dts';
 * const hotel = buildOrganization<Hotel>(
 *   {
 *     slug: 'la-limonaia',
 *     name: 'La Limonaia',
 *     extra: { checkinTime: '16:00' }, // <-- typed against Hotel
 *   },
 *   ids,
 *   'Hotel',
 * );
 * ```
 *
 * The generic defaults to `Organization`, so call sites that don't need
 * subtype typing (`buildOrganization({ slug, name }, ids)`) continue to
 * work without specifying `<T>`.
 */
export function buildOrganization<T extends Organization = Organization>(
    input: OrganizationInput<T>,
    ids: IdFactory,
    subtype: string = 'Organization',
): Record<string, unknown> {
    const piece: Record<string, unknown> = {
        '@type': subtype,
        '@id': ids.organization(input.slug),
        name: input.name,
    };
    if (input.url !== undefined) piece.url = input.url;
    if (input.description !== undefined) piece.description = input.description;
    if (input.logo !== undefined) piece.logo = input.logo;
    if (input.sameAs !== undefined) piece.sameAs = input.sameAs;
    return { ...piece, ...input.extra };
}
