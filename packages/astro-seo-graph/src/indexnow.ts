import type { APIRoute } from 'astro';
import { getIndexNowKeyFileContent } from '@jdevalk/seo-graph-core';

export interface IndexNowKeyRouteOptions {
    /** IndexNow key (8–128 characters from `[A-Za-z0-9-]`). */
    key: string;
    /** Defaults to `public, max-age=86400`. Pass `null` to omit. */
    cacheControl?: string | null;
}

/**
 * Returns an Astro `APIRoute` that serves the IndexNow key verification
 * file. Place this at `src/pages/[key].txt.ts` or `src/pages/<key>.txt.ts`
 * so it resolves to `/<key>.txt` on the deployed site.
 *
 * @example
 * ```ts
 * // src/pages/your-key-here.txt.ts
 * import { createIndexNowKeyRoute } from '@jdevalk/astro-seo-graph';
 *
 * export const GET = createIndexNowKeyRoute({ key: 'your-key-here' });
 * ```
 */
export function createIndexNowKeyRoute(options: IndexNowKeyRouteOptions): APIRoute {
    const body = getIndexNowKeyFileContent(options.key);
    const cacheControl =
        options.cacheControl === undefined ? 'public, max-age=86400' : options.cacheControl;

    return async () => {
        const headers: Record<string, string> = {
            'Content-Type': 'text/plain; charset=utf-8',
        };
        if (cacheControl !== null) headers['Cache-Control'] = cacheControl;
        return new Response(body, { headers });
    };
}

export { submitToIndexNow, validateIndexNowKey } from '@jdevalk/seo-graph-core';
export type { IndexNowSubmitResult } from '@jdevalk/seo-graph-core';
