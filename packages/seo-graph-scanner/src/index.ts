// @jdevalk/seo-graph-scanner — scan a live site's JSON-LD against seo-graph conventions.

export { scanSite } from './scan.js';
export type { ScanOptions, ScanReport, PageReport, RecommendOptions } from './scan.js';

export { discoverFromSitemap, resolveSitemapUrl } from './sitemap.js';
export type { DiscoverOptions, DiscoveredUrl } from './sitemap.js';

export { fetchHtml } from './fetcher.js';
export type { FetchOptions, FetchResult } from './fetcher.js';

export { extractFromHtml } from './extract.js';
export type { ExtractedPage, ExtractedJsonLd } from './extract.js';

export { validateBlock } from './validate.js';
export type { Finding, FindingSeverity, ValidatedBlock } from './validate.js';

export { inferFromHtml } from './infer.js';
export type {
    InferredFacts,
    Fact,
    FactSource,
    PersonOrOrgFact,
    ImageFact,
    BreadcrumbFact,
    MicrodataItem,
} from './infer.js';

export { classifyPage, recommend } from './recommend.js';
export type { RecommendedGraph, PageClassification } from './recommend.js';

export { diffRecommendedVsLive, flattenLiveEntities } from './diff.js';
export type { DiffOptions } from './diff.js';

export { formatReport } from './format.js';
export type { FormatOptions } from './format.js';
