import { describe, expect, it } from 'vitest';
import { renderLlmsTxt } from '../src/llms-txt.js';

describe('renderLlmsTxt', () => {
    it('renders title, summary, details, and a section', () => {
        const out = renderLlmsTxt({
            title: 'Example',
            summary: 'A demo site.',
            details: 'Extra context about the site.',
            sections: [
                {
                    name: 'Pages',
                    links: [
                        { url: 'https://ex.com/', title: 'Home', description: 'Landing page' },
                        { url: 'https://ex.com/about', title: 'About' },
                    ],
                },
            ],
        });
        expect(out).toBe(
            '# Example\n\n' +
                '> A demo site.\n\n' +
                'Extra context about the site.\n\n' +
                '## Pages\n\n' +
                '- [Home](https://ex.com/): Landing page\n' +
                '- [About](https://ex.com/about)\n',
        );
    });

    it('omits optional pieces when absent', () => {
        const out = renderLlmsTxt({
            title: 'T',
            sections: [{ name: 'S', links: [{ url: 'https://x/', title: 'X' }] }],
        });
        expect(out).toBe('# T\n\n## S\n\n- [X](https://x/)\n');
    });

    it('skips sections with no links', () => {
        const out = renderLlmsTxt({
            title: 'T',
            sections: [
                { name: 'Empty', links: [] },
                { name: 'Full', links: [{ url: 'https://x/', title: 'X' }] },
            ],
        });
        expect(out).toBe('# T\n\n## Full\n\n- [X](https://x/)\n');
    });

    it('escapes square brackets in link titles', () => {
        const out = renderLlmsTxt({
            title: 'T',
            sections: [{ name: 'S', links: [{ url: 'https://x/', title: '[DRAFT] Post' }] }],
        });
        expect(out).toContain('- [\\[DRAFT\\] Post](https://x/)');
    });

    it('falls back to URL when title is empty', () => {
        const out = renderLlmsTxt({
            title: 'T',
            sections: [{ name: 'S', links: [{ url: 'https://x/', title: '' }] }],
        });
        expect(out).toContain('- [https://x/](https://x/)');
    });
});
