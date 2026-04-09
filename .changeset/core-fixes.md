---
'@jdevalk/seo-graph-core': minor
---

Two API improvements resolving long-standing known limitations. Both additive and non-breaking: existing call sites continue to work unchanged.

**`buildOrganization` now accepts a generic type parameter** (`<T extends Organization = Organization>`), with `OrganizationInput.extra` typed as `Partial<T>`. Passing a concrete schema-dts subtype (`buildOrganization<Hotel>({...}, ids, 'Hotel')`) flows autocomplete into the `extra` field, so you get type-checked fields like `checkinTime`, `numberOfRooms`, etc. instead of an untyped `Record<string, unknown>`. The generic defaults to `Organization`, so call sites that don't need subtype typing continue to work without specifying `<T>`. The existing JSDoc example showing `buildOrganization<Hotel>(...)` previously didn't compile (there was no generic parameter); now it does.

**`WebPageInput.breadcrumb` is now optional.** Schema.org treats `breadcrumb` as optional on `WebPage`, so consumers that don't emit `BreadcrumbList` entities can now call `buildWebPage({ url, name, isPartOf }, ids)` without a breadcrumb reference. When provided, output is unchanged. When omitted, the `breadcrumb` key is simply absent from the returned object.
