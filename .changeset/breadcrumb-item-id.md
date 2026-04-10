---
"@jdevalk/seo-graph-core": patch
"@jdevalk/astro-seo-graph": patch
---

`BreadcrumbItem` now accepts an optional `id` field. When set, the ListItem's `item` value uses `{ "@id": id }` instead of the plain URL, allowing breadcrumb items to reference entities in the graph (e.g. linking a "Blog" crumb to a Blog entity).
