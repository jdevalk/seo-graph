/**
 * Build an `llms.txt` file — a markdown document that gives LLMs a
 * concise, structured map of a site. Spec: https://llmstxt.org
 *
 * Shape:
 *
 * ```
 * # Title
 *
 * > Summary (optional blockquote)
 *
 * Details paragraph(s) (optional)
 *
 * ## Section name
 *
 * - [Link title](url): optional description
 * ```
 *
 * Callers can supply sections explicitly or let the integration
 * auto-generate a single "Pages" section from crawled HTML.
 */

export interface LlmsTxtLink {
    /** Absolute URL. */
    url: string;
    /** Link label. Usually the page `<title>`. */
    title: string;
    /** Optional short description. Usually the meta description. */
    description?: string;
}

export interface LlmsTxtSection {
    /** Section heading (rendered as `## name`). */
    name: string;
    links: LlmsTxtLink[];
}

export interface LlmsTxtInput {
    /** H1 of the document. Required. */
    title: string;
    /** Short blockquote summary shown under the title. */
    summary?: string;
    /** Extra paragraphs of context between summary and sections. */
    details?: string;
    sections: LlmsTxtSection[];
}

function escapeLinkTitle(title: string): string {
    return title.replace(/\[/g, '\\[').replace(/\]/g, '\\]');
}

/**
 * Render an `LlmsTxtInput` to a markdown string. Pure.
 *
 * Empty sections are omitted. A trailing newline is included so the file
 * ends cleanly on disk.
 */
export function renderLlmsTxt(input: LlmsTxtInput): string {
    const parts: string[] = [`# ${input.title.trim()}`];

    if (input.summary?.trim()) {
        parts.push(`> ${input.summary.trim()}`);
    }

    if (input.details?.trim()) {
        parts.push(input.details.trim());
    }

    for (const section of input.sections) {
        if (section.links.length === 0) continue;
        parts.push(`## ${section.name.trim()}`);
        const lines = section.links.map((link) => {
            const label = escapeLinkTitle(link.title.trim() || link.url);
            const base = `- [${label}](${link.url})`;
            const desc = link.description?.trim();
            return desc ? `${base}: ${desc}` : base;
        });
        parts.push(lines.join('\n'));
    }

    return parts.join('\n\n') + '\n';
}
