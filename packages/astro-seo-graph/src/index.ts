// @jdevalk/astro-seo-graph — Astro integration for agent-ready schema.org SEO.
//
// The `<Seo>` component lives at `./Seo.astro` and must be imported via
// the subpath export: `import Seo from '@jdevalk/astro-seo-graph/Seo.astro'`.
// Its props surface is `SeoProps`, re-exported below.

export { aggregate } from './aggregator.js';
export type { AggregatorOptions, AggregatedGraph } from './aggregator.js';

export { createSchemaEndpoint, createSchemaMap } from './routes.js';
export type { SchemaEndpointOptions, SchemaMapEntry, SchemaMapOptions } from './routes.js';

export { seoSchema, imageSchema } from './content-helpers.js';

export type { SeoProps } from './components/seo-props.js';
export { buildSeoContext, ROBOTS_EXTRAS } from './components/seo-context.js';
export type { SeoContext } from './components/seo-context.js';

export { buildAlternateLinks } from './alternates.js';
export type { AlternateLink, BuildAlternateLinksInput } from './alternates.js';

export { breadcrumbsFromUrl } from './breadcrumbs.js';
export type { BreadcrumbsFromUrlInput } from './breadcrumbs.js';

export { createIndexNowKeyRoute, submitToIndexNow, validateIndexNowKey } from './indexnow.js';
export type { IndexNowKeyRouteOptions, IndexNowSubmitResult } from './indexnow.js';

export { renderLlmsTxt } from './llms-txt.js';
export type { LlmsTxtInput, LlmsTxtSection, LlmsTxtLink } from './llms-txt.js';

export { renderMarkdownAlternate, deriveMdUrl } from './markdown-alternate.js';
export type {
    MarkdownAlternateFrontmatter,
    RenderMarkdownAlternateOptions,
    RenderedMarkdownAlternate,
} from './markdown-alternate.js';

export { createMarkdownEndpoint } from './markdown-routes.js';
export type { MarkdownEndpointOptions } from './markdown-routes.js';

export { gitLastmod } from './git-lastmod.js';
export type { GitLastmodOptions } from './git-lastmod.js';

export { createApiCatalog, CATALOG_PATH } from './api-catalog.js';
export type {
    ApiCatalogOptions,
    ApiCatalogEntry,
    ApiCatalogSchemaEndpointEntry,
    ApiCatalogSchemaMapEntry,
} from './api-catalog.js';
