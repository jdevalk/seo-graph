#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { formatReport } from './format.js';
import { scanSite, type ScanReport } from './scan.js';
import { resolveSitemapUrl } from './sitemap.js';

function parseArgs(argv: readonly string[]) {
    const args: {
        target?: string;
        limit?: number;
        json?: boolean;
        noRecommend?: boolean;
        reportSpurious?: boolean;
        /** Path to a previously-saved JSON report to re-render. */
        read?: string;
        /** Override per-page detail line count; 0 to suppress. */
        detailsPerPage?: number;
        /** Override top-pages list size; 0 to suppress. */
        topPages?: number;
        /** Disable contact-page auto-discovery. */
        noContact?: boolean;
        /** Explicit contact page URL. */
        contactUrl?: string;
    } = {};
    for (let i = 0; i < argv.length; i += 1) {
        const a = argv[i];
        if (a === '--limit') {
            const next = argv[i + 1];
            if (next) args.limit = Number.parseInt(next, 10);
            i += 1;
        } else if (a === '--json') {
            args.json = true;
        } else if (a === '--no-recommend') {
            args.noRecommend = true;
        } else if (a === '--report-spurious') {
            args.reportSpurious = true;
        } else if (a === '--read') {
            const next = argv[i + 1];
            if (next) args.read = next;
            i += 1;
        } else if (a === '--details') {
            const next = argv[i + 1];
            if (next !== undefined) args.detailsPerPage = Number.parseInt(next, 10);
            i += 1;
        } else if (a === '--top') {
            const next = argv[i + 1];
            if (next !== undefined) args.topPages = Number.parseInt(next, 10);
            i += 1;
        } else if (a === '--no-contact') {
            args.noContact = true;
        } else if (a === '--contact') {
            const next = argv[i + 1];
            if (next) args.contactUrl = next;
            i += 1;
        } else if (a && !a.startsWith('-')) {
            args.target = a;
        }
    }
    return args;
}

const USAGE =
    'Usage:\n' +
    '  seo-graph-scan <sitemap-url-or-origin> [--limit N] [--json] [--no-recommend] [--report-spurious]\n' +
    '  seo-graph-scan --read <report.json> [--details N] [--top N]';

async function loadReport(path: string): Promise<ScanReport> {
    const raw = await readFile(path, 'utf8');
    return JSON.parse(raw) as ScanReport;
}

async function main() {
    const {
        target,
        limit,
        json,
        noRecommend,
        reportSpurious,
        read,
        detailsPerPage,
        topPages,
        noContact,
        contactUrl,
    } = parseArgs(process.argv.slice(2));

    // --- Replay mode: pretty-print a saved JSON report ---
    if (read) {
        const report = await loadReport(read);
        if (json) {
            console.log(JSON.stringify(report, null, 2));
            return;
        }
        console.log(
            formatReport(report, {
                ...(detailsPerPage !== undefined ? { detailsPerPage } : {}),
                ...(topPages !== undefined ? { topPages } : {}),
            }),
        );
        return;
    }

    // --- Scan mode: fetch + analyse + render ---
    if (!target) {
        console.error(USAGE);
        process.exit(2);
    }

    let sitemapUrl = target;
    if (!target.endsWith('.xml')) {
        const resolved = await resolveSitemapUrl(target);
        if (!resolved) {
            console.error(`Could not find sitemap at ${target}`);
            process.exit(1);
        }
        sitemapUrl = resolved;
    }

    const report = await scanSite(sitemapUrl, {
        sitemap: { limit },
        recommend: {
            enabled: !noRecommend,
            diff: { reportSpurious },
            contact: {
                enabled: !noContact,
                ...(contactUrl ? { url: contactUrl } : {}),
            },
        },
    });

    if (json) {
        console.log(JSON.stringify(report, null, 2));
        return;
    }

    console.log(
        formatReport(report, {
            ...(detailsPerPage !== undefined ? { detailsPerPage } : {}),
            ...(topPages !== undefined ? { topPages } : {}),
        }),
    );
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
