// Ambient declaration so `tsc` accepts `.astro` imports in tests.
// Astro's component types live in its own language-server (`astro check`),
// not in the bundled `.d.ts`. Tests render via `experimental_AstroContainer`,
// which only needs the imported value to be `unknown`.
declare module '*.astro' {
    const Component: unknown;
    export default Component;
}
