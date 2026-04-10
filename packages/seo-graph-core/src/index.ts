// @jdevalk/seo-graph-core — agent-ready schema.org JSON-LD graph builders.

export type { GraphEntity, Reference, SchemaGraph, CreativeWorkFields } from './types.js';
export { applyCreativeWorkFields, spreadRemainingProperties, CREATIVE_WORK_KEYS } from './types.js';
export type { IdFactory, MakeIdsOptions } from './ids.js';
export { makeIds } from './ids.js';
export { deduplicateByGraphId } from './dedupe.js';
export { assembleGraph } from './assemble.js';
export type { AssembleGraphOptions } from './assemble.js';

// Piece builders
export { buildWebSite } from './pieces/website.js';
export type { WebSiteInput } from './pieces/website.js';

export { buildSiteNavigationElement } from './pieces/navigation.js';
export type { NavigationItem, SiteNavigationInput } from './pieces/navigation.js';

export { buildWebPage } from './pieces/webpage.js';
export type { WebPageInput, WebPageType } from './pieces/webpage.js';

export { buildArticle } from './pieces/article.js';
export type { ArticleInput, ArticleType } from './pieces/article.js';

export { buildBreadcrumbList } from './pieces/breadcrumb.js';
export type { BreadcrumbItem, BreadcrumbListInput } from './pieces/breadcrumb.js';

export { buildImageObject } from './pieces/image.js';
export type { ImageObjectInput } from './pieces/image.js';

export { buildVideoObject } from './pieces/video.js';
export type { VideoObjectInput } from './pieces/video.js';

export { buildPiece } from './pieces/custom.js';
