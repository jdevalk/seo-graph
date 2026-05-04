import { execFileSync } from 'child_process';

export interface GitLastmodOptions {
    /** Commit hashes (short or full) to skip when searching for the last meaningful change. */
    excludeCommits?: string[];
    /** How many commits to inspect. Defaults to 10. */
    depth?: number;
}

/**
 * Returns the committer date of the most recent git commit that touched
 * `filePath`, skipping any commits listed in `excludeCommits`. Useful for
 * generating accurate `<lastmod>` values in sitemaps when bulk commits (
 * imports, reformats, renames) would otherwise produce misleading dates.
 *
 * Returns `null` when the file has no git history or git is unavailable.
 */
export function gitLastmod(filePath: string, options: GitLastmodOptions = {}): Date | null {
    const { excludeCommits = [], depth = 10 } = options;
    const excluded = new Set(excludeCommits.map((h) => h.slice(0, 7)));
    try {
        const log = execFileSync('git', ['log', `-${depth}`, '--format=%H\t%cI', '--', filePath], {
            encoding: 'utf-8',
        }).trim();
        if (!log) return null;
        for (const line of log.split('\n')) {
            const [hash, date] = line.split('\t') as [string, string | undefined];
            if (!excluded.has(hash.slice(0, 7))) {
                return date ? new Date(date) : null;
            }
        }
        return null;
    } catch {
        return null;
    }
}
