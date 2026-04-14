// @jdevalk/seo-graph-scanner — scan a live site's JSON-LD against seo-graph conventions.

export { scanSite } from './scan.js';
export type { ScanOptions, ScanReport, PageReport } from './scan.js';

export { discoverFromSitemap, resolveSitemapUrl } from './sitemap.js';
export type { DiscoverOptions, DiscoveredUrl } from './sitemap.js';

export { fetchHtml } from './fetcher.js';
export type { FetchOptions, FetchResult } from './fetcher.js';

export { extractFromHtml } from './extract.js';
export type { ExtractedPage, ExtractedJsonLd } from './extract.js';

export { validateBlock } from './validate.js';
export type { Finding, FindingSeverity, ValidatedBlock } from './validate.js';
