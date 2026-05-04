---
'@jdevalk/astro-seo-graph': minor
---

Add `createApiCatalog` route factory: serves an [RFC 9727](https://www.rfc-editor.org/rfc/rfc9727) API catalog at `/.well-known/api-catalog` as `application/linkset+json` ([RFC 9264](https://www.rfc-editor.org/rfc/rfc9264)). Accepts three categories of entry — schema.org JSON endpoints (auto-typed as `https://schema.org/<schemaType>`), the schema map (no type field, no standard type exists), and free-form `additional` APIs. Relative paths are absolutized against `siteUrl`; absolute URLs pass through unchanged.

Also exports a `CATALOG_PATH` constant (`'/.well-known/api-catalog'`) so callers can reference the path from `_headers` files, the schemamap, or documentation links without duplicating the string.

Pairs with the existing `createSchemaEndpoint` and `createSchemaMap` factories: schemas are listed once in catalog config, the catalog auto-fills `type` URLs, and the wire format is fixed by RFC 9727 so there's no ambiguity for agent crawlers.
