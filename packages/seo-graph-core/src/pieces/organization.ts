import type { IdFactory } from '../ids.js';

export interface OrganizationInput {
    /** Stable slug used for the @id. */
    slug: string;
    name: string;
    url?: string;
    description?: string;
    /** Logo URL (raw string) or reference to an ImageObject. */
    logo?: string | { '@id': string };
    sameAs?: readonly string[];
    /** Escape hatch for schema.org properties specific to a subtype. */
    extra?: Record<string, unknown>;
}

/**
 * Build a schema.org Organization piece, or any of its subtypes. Pass the
 * concrete @type as the third argument to set the subtype:
 *
 * ```ts
 * import type { Hotel } from 'schema-dts';
 * const hotel = buildOrganization<Hotel>(
 *   { slug: 'la-limonaia', name: 'La Limonaia', extra: { checkinTime: '16:00' } },
 *   ids,
 *   'Hotel',
 * );
 * ```
 *
 * The generic type parameter is advisory — it flows schema-dts autocomplete
 * into the `extra` field at call sites when you give it a concrete subtype.
 */
export function buildOrganization(
    input: OrganizationInput,
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
