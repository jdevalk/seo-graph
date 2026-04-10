---
"@jdevalk/seo-graph-core": major
"@jdevalk/astro-seo-graph": major
---

**Breaking changes:**

- **`extra` removed from all builders.** All schema.org properties are now accepted at the top level with full autocomplete from `schema-dts`. Builders use `Partial<*Leaf>` intersections for typing and `spreadRemainingProperties` for emission.
- **`buildCustomPiece` renamed to `buildPiece`.** The deprecated alias has been removed.
- **`buildPerson` removed.** Use `buildPiece<Person>({ '@type': 'Person', '@id': ids.person, ... })`.
- **`buildOrganization` removed.** Use `buildPiece<Organization>({ '@type': 'Organization', '@id': ids.organization('slug'), ... })` or `buildPiece<Restaurant>({ '@type': 'Restaurant', ... })` for subtypes.

**New features:**

- **`buildPiece<T>` with `@type` narrowing.** Pass a `schema-dts` type as the generic and the `@type` value in your input automatically narrows union types to the matching leaf — `buildPiece<Product>` with `'@type': 'Product'` gives full ProductLeaf autocomplete. No need to import Leaf types.
- **Dangling reference validation.** `assembleGraph(pieces, { warnOnDanglingReferences: true })` warns when `{ '@id': '...' }` references don't resolve to any entity in the graph.
- **`spreadRemainingProperties` and `CREATIVE_WORK_KEYS` exported** for third-party builders.
