import type { ImageObjectLeaf } from 'schema-dts';

import type { IdFactory } from '../ids.js';
import type { GraphEntity } from '../types.js';
import { spreadRemainingProperties } from '../types.js';

interface ImageObjectCoreFields {
    pageUrl?: string;
    id?: string;
    /** Public URL of the image file. Used for both `url` and `contentUrl`. */
    url: string;
    width: number;
    height: number;
    inLanguage?: string;
    caption?: string;
}

export type ImageObjectInput = ImageObjectCoreFields &
    Omit<Partial<ImageObjectLeaf>, keyof ImageObjectCoreFields | '@type'>;

const HANDLED_KEYS = new Set<string>([
    'pageUrl',
    'id',
    'url',
    'width',
    'height',
    'inLanguage',
    'caption',
]);

/**
 * Build a schema.org ImageObject piece. Pass `pageUrl` for a page's
 * primary image (id = `${pageUrl}#primaryimage`), or `id` for a site-
 * wide image like a personal logo.
 */
export function buildImageObject(input: ImageObjectInput, ids: IdFactory): GraphEntity {
    const resolvedId =
        input.id ?? (input.pageUrl !== undefined ? ids.primaryImage(input.pageUrl) : undefined);
    if (resolvedId === undefined) {
        throw new Error('buildImageObject: either `id` or `pageUrl` is required');
    }

    const piece: GraphEntity = {
        '@type': 'ImageObject',
        '@id': resolvedId,
        url: input.url,
        contentUrl: input.url,
        width: input.width,
        height: input.height,
    };
    if (input.caption !== undefined) piece.caption = input.caption;
    if (input.inLanguage !== undefined) piece.inLanguage = input.inLanguage;
    spreadRemainingProperties(piece, input, HANDLED_KEYS);

    return piece;
}
