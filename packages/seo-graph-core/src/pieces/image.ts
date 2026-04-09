import type { IdFactory } from '../ids.js';

export interface ImageObjectInput {
    /**
     * Canonical URL of the page this image belongs to. The @id is
     * `${pageUrl}#primaryimage` — to build a site-wide image with a
     * friendly fragment (e.g. the Person logo), use the `id` override.
     */
    pageUrl?: string;
    /** Explicit @id override; takes precedence over `pageUrl`. */
    id?: string;
    /** Public URL of the image file. Used for both `url` and `contentUrl`. */
    url: string;
    width: number;
    height: number;
    inLanguage?: string;
    caption?: string;
    extra?: Record<string, unknown>;
}

/**
 * Build a schema.org ImageObject piece. Pass `pageUrl` for a page's
 * primary image (id = `${pageUrl}#primaryimage`), or `id` for a site-
 * wide image like a personal logo.
 */
export function buildImageObject(input: ImageObjectInput, ids: IdFactory): Record<string, unknown> {
    const id =
        input.id ?? (input.pageUrl !== undefined ? ids.primaryImage(input.pageUrl) : undefined);
    if (id === undefined) {
        throw new Error('buildImageObject: either `id` or `pageUrl` is required');
    }

    const piece: Record<string, unknown> = {
        '@type': 'ImageObject',
        '@id': id,
        url: input.url,
        contentUrl: input.url,
        width: input.width,
        height: input.height,
    };
    if (input.caption !== undefined) piece.caption = input.caption;
    piece.inLanguage = input.inLanguage ?? 'en-US';

    return { ...piece, ...input.extra };
}
