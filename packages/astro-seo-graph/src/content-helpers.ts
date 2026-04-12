import { z } from 'zod';

/**
 * Astro content-collection `image` function signature, captured as `any`
 * to avoid importing from the `astro:content` virtual module (which
 * only resolves inside an Astro project, not in a standalone package).
 * Users pass through their own `image` from Astro's schema callback.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AstroImageFunction = any;

/**
 * Zod schema for an image field on a content entry. Pair with Astro's
 * `image()` from the collection schema factory so the image is processed
 * through Astro's asset pipeline.
 *
 * `alt` is **required** — missing alt text is an accessibility failure
 * and an SEO failure. Decorative images should use `alt: ''` explicitly.
 * If you want to make the whole image optional, wrap the schema:
 * `imageSchema(image).optional()`.
 *
 * @example
 * ```ts
 * import { defineCollection, z } from 'astro:content';
 * import { imageSchema } from '@jdevalk/astro-seo-graph';
 *
 * const blog = defineCollection({
 *   schema: ({ image }) =>
 *     z.object({
 *       title: z.string(),
 *       featureImage: imageSchema(image).optional(),
 *     }),
 * });
 * ```
 */
export function imageSchema(image: AstroImageFunction) {
    return z.object({
        src: image(),
        alt: z.string(),
    });
}

/**
 * Zod schema for a nested `seo` field holding per-entry SEO overrides:
 * title, description, share image, and page type. Enforces reasonable
 * length limits (5–120 chars for title, 15–160 for description) as a
 * lint.
 *
 * @example
 * ```ts
 * const blog = defineCollection({
 *   schema: ({ image }) =>
 *     z.object({
 *       title: z.string(),
 *       seo: seoSchema(image).optional(),
 *     }),
 * });
 * ```
 */
export function seoSchema(image: AstroImageFunction) {
    return z.object({
        title: z.string().min(5).max(120).optional(),
        description: z.string().min(15).max(160).optional(),
        image: imageSchema(image).optional(),
        pageType: z.enum(['website', 'article']).default('website'),
    });
}
