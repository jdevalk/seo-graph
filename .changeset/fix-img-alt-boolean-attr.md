---
'@jdevalk/astro-seo-graph': patch
---

Fix `validateImageAlt` false-positives on `alt=""` after HTML minification.

Astro's build pipeline (via Vite's HTML minifier) implements HTML5 §2.3.2 and drops the value from empty boolean-form attributes, so `<img alt="">` in source becomes `<img ... alt ...>` in the rendered output. The previous regex (`/\balt\s*=/i`) required a literal `=`, so it missed the minified form and warned on every decorative image marked with `alt=""` — defeating the documented decorative-image escape hatch for any consumer using `astro:assets`.

The new regex (`/\salt(?:\s*=|\s|\/?>|$)/i`) accepts both `alt="..."` and bare-boolean `alt`. The leading whitespace anchor also closes a latent false-skip on attribute names like `data-alt` (which the old regex matched as an `alt` attribute).
