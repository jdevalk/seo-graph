/**
 * Human-readable report rendering. Used by the CLI for both live scans
 * and for replaying a saved JSON report. Kept separate from `cli.ts` so
 * it's unit-testable without a terminal.
 */
import type { PageReport, ScanReport } from './scan.js';
import type { Finding } from './validate.js';

export interface FormatOptions {
    /**
     * Max number of individual page rows in the "Top offenders" list.
     * Defaults to 10. Set to 0 to skip the list entirely.
     */
    topPages?: number;
    /**
     * Max number of per-page finding lines in the "Details" section.
     * Pages with more findings are truncated with a "+ N more" line.
     * Defaults to 5.
     */
    detailsPerPage?: number;
    /** Include a per-page details section. Defaults to true. */
    includeDetails?: boolean;
}

interface CodeBucket {
    code: string;
    severity: Finding['severity'];
    count: number;
    sampleMessage: string;
}

/** Aggregate all findings across pages by `code` for the summary table. */
function bucketByCode(pages: readonly PageReport[]): CodeBucket[] {
    const byCode = new Map<string, CodeBucket>();
    for (const page of pages) {
        for (const f of page.findings) {
            const existing = byCode.get(f.code);
            if (existing) {
                existing.count += 1;
            } else {
                byCode.set(f.code, {
                    code: f.code,
                    severity: f.severity,
                    count: 1,
                    sampleMessage: f.message,
                });
            }
        }
    }
    return [...byCode.values()].sort((a, b) => b.count - a.count);
}

const SEVERITY_ORDER: Record<Finding['severity'], number> = {
    error: 0,
    warning: 1,
    info: 2,
};

/** Pages sorted by finding count, most first. Ties broken by URL. */
function topOffenders(pages: readonly PageReport[], limit: number): PageReport[] {
    return [...pages]
        .filter((p) => p.findings.length > 0)
        .sort((a, b) => b.findings.length - a.findings.length || a.url.localeCompare(b.url))
        .slice(0, limit);
}

/** Right-pad a string to `width` spaces for aligned columns. */
function padRight(s: string, width: number): string {
    return s.length >= width ? s : s + ' '.repeat(width - s.length);
}

/** Left-pad a string (used for right-aligned numeric columns). */
function padLeft(s: string, width: number): string {
    return s.length >= width ? s : ' '.repeat(width - s.length) + s;
}

/**
 * Render a `ScanReport` into the text format the CLI prints by default.
 * Returns a string so callers can also write it to a file or tee it.
 */
export function formatReport(report: ScanReport, options: FormatOptions = {}): string {
    const { topPages = 10, detailsPerPage = 5, includeDetails = true } = options;
    const { summary, pages } = report;
    const lines: string[] = [];

    // --- Header ---
    lines.push('');
    lines.push(`Scanned ${summary.pagesScanned} pages from ${report.sitemapUrl}`);
    lines.push(`  with JSON-LD:    ${summary.pagesWithJsonLd}`);
    lines.push(`  without JSON-LD: ${summary.pagesWithoutJsonLd}`);
    lines.push(`  fetch errors:    ${summary.pagesWithErrors}`);
    const sev = summary.totalFindingsBySeverity;
    lines.push(`Findings: ${sev.error} errors, ${sev.warning} warnings, ${sev.info} info`);

    // --- By-code summary ---
    const buckets = bucketByCode(pages);
    if (buckets.length > 0) {
        lines.push('');
        lines.push('By code');
        const codeWidth = Math.max(...buckets.map((b) => b.code.length), 4);
        const countWidth = Math.max(...buckets.map((b) => String(b.count).length), 3);
        // Stable order: by severity first, then by count descending.
        const ordered = [...buckets].sort(
            (a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] || b.count - a.count,
        );
        for (const b of ordered) {
            lines.push(
                `  ${padLeft(String(b.count), countWidth)}  ${padRight(`[${b.severity}]`, 9)} ` +
                    `${padRight(b.code, codeWidth)}  ${b.sampleMessage}`,
            );
        }
    }

    // --- Top offenders ---
    if (topPages > 0) {
        const top = topOffenders(pages, topPages);
        if (top.length > 0) {
            lines.push('');
            lines.push(`Top pages by finding count (first ${top.length})`);
            const countWidth = Math.max(...top.map((p) => String(p.findings.length).length), 3);
            for (const p of top) {
                lines.push(`  ${padLeft(String(p.findings.length), countWidth)}  ${p.url}`);
            }
        }
    }

    // --- Per-page details ---
    if (includeDetails) {
        const withFindings = pages.filter((p) => p.findings.length > 0);
        if (withFindings.length > 0) {
            lines.push('');
            lines.push('Details');
            for (const page of withFindings) {
                lines.push('');
                lines.push(
                    `  ${page.url}${page.classification ? `  (${page.classification})` : ''}`,
                );
                const shown = page.findings.slice(0, detailsPerPage);
                for (const f of shown) {
                    const path = f.path ? `  ← ${f.path}` : '';
                    lines.push(`    [${f.severity}] ${f.code}: ${f.message}${path}`);
                }
                if (page.findings.length > shown.length) {
                    lines.push(
                        `    + ${page.findings.length - shown.length} more (use --json to see all)`,
                    );
                }

                // When a page has no JSON-LD, render the recommended
                // graph as a copy-paste-ready <script> block. This is
                // the actionable artefact — the finding above tells
                // you there's nothing, this shows what to emit.
                if (
                    page.blocks.length === 0 &&
                    page.recommended &&
                    page.recommended.entities.length > 0
                ) {
                    const graph = {
                        '@context': 'https://schema.org',
                        '@graph': page.recommended.entities,
                    };
                    lines.push('');
                    lines.push('    Recommended JSON-LD:');
                    lines.push('    <script type="application/ld+json">');
                    for (const line of JSON.stringify(graph, null, 2).split('\n')) {
                        lines.push(`    ${line}`);
                    }
                    lines.push('    </script>');
                }
            }
        }
    }

    lines.push('');
    return lines.join('\n');
}
