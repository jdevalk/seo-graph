---
'@jdevalk/astro-seo-graph': major
---

**Breaking:** drop Astro 5 from peer deps; require Astro 6 and zod 4.

Why: Astro 5.x ships zod 3 and Astro 6.x ships zod 4. Supporting both Astro majors meant shipping zod 3 as a runtime dep while users on Astro 6 had zod 4 from `astro:content`. zod brands schemas with version-specific symbols, so `seoSchema(image)` (returned as a zod 3 schema) couldn't compose cleanly into a user's `z.object({ ... })` from `astro:content` (zod 4) — composition produced TS type errors and worked at runtime only by accident.

**What changed:**

- `peerDependencies.astro` is now `^6.0.0` (was `^5.0.0 || ^6.0.0`).
- `dependencies.zod` is now `^4.4.3` (was `^3.24.0`).

**What didn't change:**

- The exported API surface (`<Seo>`, `createSchemaEndpoint`, `createSchemaMap`, `createApiCatalog`, `createMarkdownEndpoint`, `createIndexNowKeyRoute`, `seoSchema`, `imageSchema`, `buildAlternateLinks`, `breadcrumbsFromUrl`, `gitLastmod`, `aggregate`, `renderLlmsTxt`, `renderMarkdownAlternate`, all types) — all unchanged.
- Our zod usage is core surface only (`z.object`, `z.string`, `z.enum`, `.min`, `.max`, `.optional`, `.default`) — no zod 4-specific syntax.

**Migration:**

If you're already on Astro 6, install: `pnpm add @jdevalk/astro-seo-graph@2`. Your `seo` and `featureImage` collection fields will start composing without the silent type drift they had under 1.x.

If you're still on Astro 5, stay on `@jdevalk/astro-seo-graph@1.4.1`. The 1.x line gets bug fixes only — no new features ship to it.
