---
'@jdevalk/astro-seo-graph': minor
---

Support Astro 7. Widen the `astro` peer dependency to `^6.0.0 || ^7.0.0` so the integration installs without a peer-dependency warning under Astro 7. No runtime changes: the integration only relies on the stable `astro:config:setup` and `astro:build:done` hooks and the `APIRoute` type, none of which changed in Astro 7. CI now runs the build, typecheck, and tests against both Astro 6 and 7.
