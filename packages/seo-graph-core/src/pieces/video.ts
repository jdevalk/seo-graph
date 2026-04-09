import type { IdFactory } from '../ids.js';
import type { Reference } from '../types.js';

export interface VideoObjectInput {
    /**
     * Canonical URL of the page the video lives on. The @id is
     * `${url}#video`.
     */
    url: string;
    name: string;
    description: string;
    /** Reference to the enclosing WebPage (usually ids.webPage(url)). */
    isPartOf: Reference;
    /** YouTube video id — used to derive thumbnailUrl and embedUrl. */
    youtubeId?: string;
    /**
     * Explicit thumbnail URL. If omitted and `youtubeId` is set, defaults
     * to `https://img.youtube.com/vi/{id}/maxresdefault.jpg`.
     */
    thumbnailUrl?: string;
    /**
     * Explicit embed URL. If omitted and `youtubeId` is set, defaults to
     * `https://www.youtube-nocookie.com/embed/{id}`.
     */
    embedUrl?: string;
    uploadDate?: Date;
    /** ISO 8601 duration, e.g. 'PT30M'. */
    duration?: string;
    transcript?: string;
    extra?: Record<string, unknown>;
}

/**
 * Build a schema.org VideoObject piece.
 */
export function buildVideoObject(input: VideoObjectInput, ids: IdFactory): Record<string, unknown> {
    const piece: Record<string, unknown> = {
        '@type': 'VideoObject',
        '@id': ids.videoObject(input.url),
        name: input.name,
        description: input.description,
        isPartOf: input.isPartOf,
    };

    const thumbnail =
        input.thumbnailUrl ??
        (input.youtubeId !== undefined
            ? `https://img.youtube.com/vi/${input.youtubeId}/maxresdefault.jpg`
            : undefined);
    if (thumbnail !== undefined) piece.thumbnailUrl = thumbnail;

    const embed =
        input.embedUrl ??
        (input.youtubeId !== undefined
            ? `https://www.youtube-nocookie.com/embed/${input.youtubeId}`
            : undefined);
    if (embed !== undefined) piece.embedUrl = embed;

    if (input.uploadDate !== undefined) piece.uploadDate = input.uploadDate.toISOString();
    if (input.duration !== undefined) piece.duration = input.duration;
    if (input.transcript !== undefined) piece.transcript = input.transcript;

    return { ...piece, ...input.extra };
}
