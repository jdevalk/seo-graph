#!/usr/bin/env node
import { scanSite } from './scan.js';
import { resolveSitemapUrl } from './sitemap.js';

function parseArgs(argv: readonly string[]) {
    const args: {
        target?: string;
        limit?: number;
        json?: boolean;
        noRecommend?: boolean;
        reportSpurious?: boolean;
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
        } else if (a && !a.startsWith('-')) {
            args.target = a;
        }
    }
    return args;
}

async function main() {
    const { target, limit, json, noRecommend, reportSpurious } = parseArgs(process.argv.slice(2));
    if (!target) {
        console.error(
            'Usage: seo-graph-scan <sitemap-url-or-origin> [--limit N] [--json] [--no-recommend] [--report-spurious]',
        );
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
        },
    });

    if (json) {
        console.log(JSON.stringify(report, null, 2));
        return;
    }

    const { summary } = report;
    console.log(`\nScanned ${summary.pagesScanned} pages from ${report.sitemapUrl}`);
    console.log(`  with JSON-LD:    ${summary.pagesWithJsonLd}`);
    console.log(`  without JSON-LD: ${summary.pagesWithoutJsonLd}`);
    console.log(`  fetch errors:    ${summary.pagesWithErrors}`);
    console.log(
        `Findings: ${summary.totalFindingsBySeverity.error} errors, ${summary.totalFindingsBySeverity.warning} warnings\n`,
    );

    for (const page of report.pages) {
        if (page.findings.length === 0) continue;
        console.log(`${page.url}`);
        for (const f of page.findings) {
            console.log(`  [${f.severity}] ${f.code}: ${f.message}`);
        }
    }
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
