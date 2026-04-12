import { readFile, readdir } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

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

export interface SeoGraphIntegrationOptions {
    /**
     * Warn when a built page has zero or more than one `<h1>` element.
     * Defaults to `true`. Only static pages are checked (SSR pages are
     * not present on disk at build time).
     */
    validateH1?: boolean;
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
    const { validateH1 = true } = options;

    return {
        name: '@jdevalk/astro-seo-graph',
        hooks: {
            'astro:build:done': async ({ dir, logger }) => {
                if (!validateH1) return;

                const buildDir = fileURLToPath(dir);
                const htmlFiles = await collectHtmlFiles(buildDir);

                const missing: string[] = [];
                const multiple: Array<{ file: string; count: number }> = [];

                for (const file of htmlFiles) {
                    const content = await readFile(join(buildDir, file), 'utf8');
                    const count = countH1s(content);
                    if (count === 0) missing.push(file);
                    else if (count > 1) multiple.push({ file, count });
                }

                if (missing.length === 0 && multiple.length === 0) {
                    logger.info(`H1 validation: ${htmlFiles.length} pages checked, all good.`);
                    return;
                }

                for (const file of missing) {
                    logger.warn(`H1 validation: ${file} has no <h1>.`);
                }
                for (const { file, count } of multiple) {
                    logger.warn(`H1 validation: ${file} has ${count} <h1> elements (expected 1).`);
                }
            },
        },
    };
}
