import type { VideoObjectLeaf } from 'schema-dts';

import type { IdFactory } from '../ids.js';
import type { Reference, GraphEntity } from '../types.js';
import { spreadRemainingProperties } from '../types.js';

interface VideoObjectCoreFields {
    url: string;
    name: string;
    description: string;
    isPartOf: Reference;
    youtubeId?: string;
    thumbnailUrl?: string;
    embedUrl?: string;
    uploadDate?: Date;
    duration?: string;
    transcript?: string;
}

export type VideoObjectInput = VideoObjectCoreFields &
    Omit<Partial<VideoObjectLeaf>, keyof VideoObjectCoreFields | '@type'>;

const HANDLED_KEYS = new Set<string>([
    'url',
    'name',
    'description',
    'isPartOf',
    'youtubeId',
    'thumbnailUrl',
    'embedUrl',
    'uploadDate',
    'duration',
    'transcript',
]);

/**
 * Build a schema.org VideoObject piece.
 */
export function buildVideoObject(input: VideoObjectInput, ids: IdFactory): GraphEntity {
    const piece: GraphEntity = {
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
    spreadRemainingProperties(piece, input, HANDLED_KEYS);

    return piece;
}
