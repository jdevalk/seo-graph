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

export { buildAstroSeoProps } from './components/seo-props.js';
export type { SeoProps, AstroSeoProps } from './components/seo-props.js';

export { buildAlternateLinks } from './alternates.js';
export type { AlternateLink, BuildAlternateLinksInput } from './alternates.js';

export { breadcrumbsFromUrl } from './breadcrumbs.js';
export type { BreadcrumbsFromUrlInput } from './breadcrumbs.js';

export { createIndexNowKeyRoute, submitToIndexNow, validateIndexNowKey } from './indexnow.js';
export type { IndexNowKeyRouteOptions, IndexNowSubmitResult } from './indexnow.js';

export { renderLlmsTxt } from './llms-txt.js';
export type { LlmsTxtInput, LlmsTxtSection, LlmsTxtLink } from './llms-txt.js';
