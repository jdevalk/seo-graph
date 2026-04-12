import { readFile, readdir } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { submitToIndexNow } from '@jdevalk/seo-graph-core';

// Narrow shape of the Astro integration hook we use. We don't import
// Astro types here to keep this package installable without `astro`
// present at type-check time (it's a peer dep).
interface BuildDoneHook {
    dir: URL;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    logger: { warn: (msg: string) => void; info: (msg: string) => void; [key: string]: any };
}

interface AstroIntegrationLike {
    name: string;
    hooks: {
        'astro:build:done'?: (args: BuildDoneHook) => void | Promise<void>;
    };
}

export interface IndexNowIntegrationOptions {
    /** IndexNow key (8–128 hex chars). Required to enable submission. */
    key: string;
    /** Bare host, e.g. `example.com`. */
    host: string;
    /**
     * Absolute site origin used to resolve built HTML paths into URLs
     * for submission. E.g. `https://example.com`. Trailing slash is
     * tolerated.
     */
    siteUrl: string;
    /**
     * Optional absolute URL to the key file. Defaults to
     * `https://<host>/<key>.txt`.
     */
    keyLocation?: string;
    /**
     * Override the IndexNow endpoint. Defaults to the neutral aggregator
     * at `api.indexnow.org`.
     */
    endpoint?: string;
    /**
     * Filter the list of URLs before submission. Return `false` to skip
     * a URL. Useful for excluding 404 pages, drafts, etc.
     */
    filter?: (url: string) => boolean;
}

export interface SeoGraphIntegrationOptions {
    /**
     * Warn when a built page has zero or more than one `<h1>` element.
     * Defaults to `true`. Only static pages are checked (SSR pages are
     * not present on disk at build time).
     */
    validateH1?: boolean;
    /**
     * Submit built URLs to IndexNow after the build completes. Omit to
     * disable. Only URLs on `host` are submitted; URLs with trailing
     * `index.html` are rewritten to their directory form.
     */
    indexNow?: IndexNowIntegrationOptions;
}

/**
 * Turn a built HTML file path (relative to the outDir, e.g.
 * `blog/post/index.html`) into an absolute URL on `siteUrl`. Rewrites
 * `index.html` to a trailing slash and strips other `.html` extensions
 * — matching Astro's default `trailingSlash: 'ignore'` output layout.
 */
export function htmlFileToUrl(relativePath: string, siteUrl: string): string {
    const origin = siteUrl.replace(/\/+$/, '');
    const normalized = relativePath.split(/[\\/]/).join('/');
    let pathname: string;
    if (normalized === 'index.html' || normalized === '/index.html') {
        pathname = '/';
    } else if (normalized.endsWith('/index.html')) {
        pathname = '/' + normalized.slice(0, -'index.html'.length);
    } else if (normalized.endsWith('.html')) {
        pathname = '/' + normalized.slice(0, -'.html'.length);
    } else {
        pathname = '/' + normalized;
    }
    return `${origin}${pathname}`;
}

/**
 * Count `<h1>` elements in an HTML string. Matches the opening tag only;
 * tolerant of attributes and whitespace. Doesn't parse — good enough for
 * a lint warning.
 */
export function countH1s(html: string): number {
    const matches = html.match(/<h1[\s>]/gi);
    return matches ? matches.length : 0;
}

async function collectHtmlFiles(dir: string, base: string = dir): Promise<string[]> {
    const entries = await readdir(dir, { withFileTypes: true });
    const files: string[] = [];
    for (const entry of entries) {
        const fullPath = join(dir, entry.name);
        if (entry.isDirectory()) {
            files.push(...(await collectHtmlFiles(fullPath, base)));
        } else if (entry.isFile() && entry.name.endsWith('.html')) {
            files.push(relative(base, fullPath));
        }
    }
    return files;
}

/**
 * Astro integration for `@jdevalk/astro-seo-graph`.
 *
 * Currently:
 * - Warns about built pages with zero or more than one `<h1>` element
 *   (a common SEO and accessibility issue).
 *
 * ```js
 * // astro.config.mjs
 * import { defineConfig } from 'astro/config';
 * import seoGraph from '@jdevalk/astro-seo-graph/integration';
 *
 * export default defineConfig({
 *     integrations: [seoGraph()],
 * });
 * ```
 */
export default function seoGraph(options: SeoGraphIntegrationOptions = {}): AstroIntegrationLike {
    const { validateH1 = true, indexNow } = options;

    return {
        name: '@jdevalk/astro-seo-graph',
        hooks: {
            'astro:build:done': async ({ dir, logger }) => {
                const buildDir = fileURLToPath(dir);
                const htmlFiles =
                    validateH1 || indexNow ? await collectHtmlFiles(buildDir) : [];

                if (validateH1) {
                    const missing: string[] = [];
                    const multiple: Array<{ file: string; count: number }> = [];

                    for (const file of htmlFiles) {
                        const content = await readFile(join(buildDir, file), 'utf8');
                        const count = countH1s(content);
                        if (count === 0) missing.push(file);
                        else if (count > 1) multiple.push({ file, count });
                    }

                    if (missing.length === 0 && multiple.length === 0) {
                        logger.info(
                            `H1 validation: ${htmlFiles.length} pages checked, all good.`,
                        );
                    } else {
                        for (const file of missing) {
                            logger.warn(`H1 validation: ${file} has no <h1>.`);
                        }
                        for (const { file, count } of multiple) {
                            logger.warn(
                                `H1 validation: ${file} has ${count} <h1> elements (expected 1).`,
                            );
                        }
                    }
                }

                if (indexNow) {
                    const urls = htmlFiles
                        .map((f) => htmlFileToUrl(f, indexNow.siteUrl))
                        .filter((u) => (indexNow.filter ? indexNow.filter(u) : true));

                    if (urls.length === 0) {
                        logger.info('IndexNow: no URLs to submit.');
                    } else {
                        const results = await submitToIndexNow({
                            host: indexNow.host,
                            key: indexNow.key,
                            keyLocation: indexNow.keyLocation,
                            endpoint: indexNow.endpoint,
                            urls,
                        });
                        for (const r of results) {
                            if (r.ok) {
                                logger.info(
                                    `IndexNow: submitted ${r.submitted} URLs (status ${r.status}).`,
                                );
                            } else {
                                logger.warn(
                                    `IndexNow: submission failed (status ${r.status}): ${r.message}`,
                                );
                            }
                        }
                    }
                }
            },
        },
    };
}
