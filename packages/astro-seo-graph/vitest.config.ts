/// <reference types="vitest" />
import { getViteConfig } from 'astro/config';

// Bridge Astro's Vite plugin into vitest so .astro files can be imported
// from tests (needed for experimental_AstroContainer rendering tests).
// All existing pure-TypeScript tests work unchanged.
export default getViteConfig({
    test: {
        include: ['test/**/*.test.ts'],
    },
});
