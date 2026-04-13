import { readFile, readdir, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { submitToIndexNow } from '@jdevalk/seo-graph-core';
import { renderLlmsTxt, type LlmsTxtSection } from './llms-txt.js';

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

export interface LlmsTxtIntegrationOptions {
    /** H1 of the generated `llms.txt`. */
    title: string;
    /** Absolute site origin used to resolve built HTML paths into URLs. */
    siteUrl: string;
    /** Optional blockquote summary shown under the title. */
    summary?: string;
    /** Optional paragraphs of context between summary and sections. */
    details?: string;
    /**
     * User-supplied sections. When provided, these are used verbatim and
     * no pages are auto-collected from the build output. When omitted, a
     * single "Pages" section is generated from all built HTML files.
     */
    sections?: LlmsTxtSection[];
    /**
     * Filter which crawled URLs end up in the auto-generated section.
     * Ignored when `sections` is supplied.
     */
    filter?: (url: string) => boolean;
    /**
     * Section name used for auto-generated pages. Defaults to `Pages`.
     * Ignored when `sections` is supplied.
     */
    autoSectionName?: string;
    /**
     * Output file path relative to the build output directory. Defaults
     * to `llms.txt`.
     */
    outputPath?: string;
}

export interface SeoGraphIntegrationOptions {
    /**
     * Warn when a built page has zero or more than one `<h1>` element.
     * Defaults to `true`. Only static pages are checked (SSR pages are
     * not present on disk at build time).
     */
    validateH1?: boolean;
    /**
     * Warn when two or more built pages share the same `<title>` or
     * meta description. Duplicate metadata is an SEO smell that can only
     * be detected across the whole corpus. Defaults to `true`.
     *
     * Pages without a title or description are reported separately by
     * the H1 validator's siblings — this check only compares values that
     * are present on multiple pages.
     */
    validateUniqueMetadata?: boolean;
    /**
     * Submit built URLs to IndexNow after the build completes. Omit to
     * disable. Only URLs on `host` are submitted; URLs with trailing
     * `index.html` are rewritten to their directory form.
     */
    indexNow?: IndexNowIntegrationOptions;
    /**
     * Generate an `llms.txt` file at the root of the build output. Omit
     * to disable.
     */
    llmsTxt?: LlmsTxtIntegrationOptions;
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

const HTML_ENTITIES: Record<string, string> = {
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&apos;': "'",
    '&#39;': "'",
    '&nbsp;': ' ',
};

function decodeHtmlEntities(value: string): string {
    return value.replace(/&(?:amp|lt|gt|quot|apos|#39|nbsp);/g, (m) => HTML_ENTITIES[m] ?? m);
}

/**
 * Extract the first `<title>` element's text content. Returns `null` when
 * no title tag is found. Whitespace-collapsed and entity-decoded so
 * duplicate-detection compares rendered text, not raw HTML.
 */
export function extractTitle(html: string): string | null {
    const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    if (!match) return null;
    const text = decodeHtmlEntities(match[1]!).replace(/\s+/g, ' ').trim();
    return text.length > 0 ? text : null;
}

/**
 * Extract the `content` attribute of the first `<meta name="description">`
 * tag. Returns `null` when absent. Entity-decoded for duplicate detection.
 */
export function extractMetaDescription(html: string): string | null {
    const re =
        /<meta\s+[^>]*name\s*=\s*["']description["'][^>]*content\s*=\s*["']([^"']*)["'][^>]*>|<meta\s+[^>]*content\s*=\s*["']([^"']*)["'][^>]*name\s*=\s*["']description["'][^>]*>/i;
    const match = html.match(re);
    if (!match) return null;
    const raw = (match[1] ?? match[2] ?? '').trim();
    if (!raw) return null;
    return decodeHtmlEntities(raw);
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
    const {
        validateH1 = true,
        validateUniqueMetadata = true,
        indexNow,
        llmsTxt,
    } = options;
    const autoLlmsTxt = llmsTxt && !llmsTxt.sections;

    return {
        name: '@jdevalk/astro-seo-graph',
        hooks: {
            'astro:build:done': async ({ dir, logger }) => {
                const buildDir = fileURLToPath(dir);
                const needsContentScan = validateH1 || validateUniqueMetadata || autoLlmsTxt;
                const htmlFiles =
                    needsContentScan || indexNow || llmsTxt
                        ? await collectHtmlFiles(buildDir)
                        : [];
                const autoLinks: Array<{ url: string; title: string; description?: string }> = [];

                const h1Missing: string[] = [];
                const h1Multiple: Array<{ file: string; count: number }> = [];
                const titlesByValue = new Map<string, string[]>();
                const descriptionsByValue = new Map<string, string[]>();

                if (needsContentScan) {
                    for (const file of htmlFiles) {
                        const content = await readFile(join(buildDir, file), 'utf8');

                        if (validateH1) {
                            const count = countH1s(content);
                            if (count === 0) h1Missing.push(file);
                            else if (count > 1) h1Multiple.push({ file, count });
                        }

                        const title =
                            validateUniqueMetadata || autoLlmsTxt ? extractTitle(content) : null;
                        const description =
                            validateUniqueMetadata || autoLlmsTxt
                                ? extractMetaDescription(content)
                                : null;

                        if (validateUniqueMetadata) {
                            if (title) {
                                const list = titlesByValue.get(title) ?? [];
                                list.push(file);
                                titlesByValue.set(title, list);
                            }
                            if (description) {
                                const list = descriptionsByValue.get(description) ?? [];
                                list.push(file);
                                descriptionsByValue.set(description, list);
                            }
                        }

                        if (autoLlmsTxt && llmsTxt) {
                            const url = htmlFileToUrl(file, llmsTxt.siteUrl);
                            if (!llmsTxt.filter || llmsTxt.filter(url)) {
                                autoLinks.push({
                                    url,
                                    title: title ?? url,
                                    description: description ?? undefined,
                                });
                            }
                        }
                    }
                }

                if (validateH1) {
                    if (h1Missing.length === 0 && h1Multiple.length === 0) {
                        logger.info(
                            `H1 validation: ${htmlFiles.length} pages checked, all good.`,
                        );
                    } else {
                        for (const file of h1Missing) {
                            logger.warn(`H1 validation: ${file} has no <h1>.`);
                        }
                        for (const { file, count } of h1Multiple) {
                            logger.warn(
                                `H1 validation: ${file} has ${count} <h1> elements (expected 1).`,
                            );
                        }
                    }
                }

                if (validateUniqueMetadata) {
                    const dupTitles = [...titlesByValue.entries()].filter(
                        ([, files]) => files.length > 1,
                    );
                    const dupDescriptions = [...descriptionsByValue.entries()].filter(
                        ([, files]) => files.length > 1,
                    );

                    if (dupTitles.length === 0 && dupDescriptions.length === 0) {
                        logger.info(
                            `Metadata uniqueness: ${htmlFiles.length} pages checked, all good.`,
                        );
                    } else {
                        for (const [title, files] of dupTitles) {
                            logger.warn(
                                `Metadata uniqueness: title ${JSON.stringify(title)} appears on ${files.length} pages: ${files.join(', ')}`,
                            );
                        }
                        for (const [description, files] of dupDescriptions) {
                            const preview =
                                description.length > 80
                                    ? description.slice(0, 77) + '…'
                                    : description;
                            logger.warn(
                                `Metadata uniqueness: description ${JSON.stringify(preview)} appears on ${files.length} pages: ${files.join(', ')}`,
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

                if (llmsTxt) {
                    const sections =
                        llmsTxt.sections ??
                        [{ name: llmsTxt.autoSectionName ?? 'Pages', links: autoLinks }];
                    const rendered = renderLlmsTxt({
                        title: llmsTxt.title,
                        summary: llmsTxt.summary,
                        details: llmsTxt.details,
                        sections,
                    });
                    const outPath = join(buildDir, llmsTxt.outputPath ?? 'llms.txt');
                    await writeFile(outPath, rendered, 'utf8');
                    const linkCount = sections.reduce((n, s) => n + s.links.length, 0);
                    logger.info(
                        `llms.txt: wrote ${relative(buildDir, outPath)} with ${linkCount} link(s).`,
                    );
                }
            },
        },
    };
}
