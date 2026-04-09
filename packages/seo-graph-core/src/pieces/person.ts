import type { IdFactory } from '../ids.js';

/**
 * Input for a Person piece. All fields except `name` are optional, and
 * any field not explicitly supported here can be passed via `extra`.
 *
 * This intentionally mirrors schema.org's Person vocabulary. We don't
 * re-type every field; the shape is a `Record<string, unknown>` so
 * consumers can pass arbitrary schema.org properties without a version
 * upgrade of this package.
 */
export interface PersonInput {
    name: string;
    familyName?: string;
    birthDate?: string;
    gender?: string;
    nationality?: { '@id': string };
    description?: string;
    jobTitle?: string;
    knowsLanguage?: readonly string[];
    url?: string;
    image?: { '@id': string };
    sameAs?: readonly string[];
    worksFor?: ReadonlyArray<Record<string, unknown>>;
    spouse?: Record<string, unknown>;
    children?: ReadonlyArray<Record<string, unknown>>;
    extra?: Record<string, unknown>;
}

/**
 * Build a schema.org Person piece using the site-wide Person @id.
 */
export function buildPerson(input: PersonInput, ids: IdFactory): Record<string, unknown> {
    const { extra, ...rest } = input;
    return {
        '@type': 'Person',
        '@id': ids.person,
        ...rest,
        ...extra,
    };
}
