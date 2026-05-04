import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gitLastmod } from '../src/git-lastmod.js';

describe('gitLastmod', () => {
    let repoDir: string;
    let originalCwd: string;
    let oldHash: string;
    let bulkHash: string;
    let newestHash: string;

    function commit(message: string, content: string, isoDate: string): string {
        writeFileSync(join(repoDir, 'a.md'), content);
        execFileSync('git', ['add', 'a.md'], { cwd: repoDir });
        execFileSync('git', ['commit', '-q', '-m', message], {
            cwd: repoDir,
            env: {
                ...process.env,
                GIT_AUTHOR_DATE: isoDate,
                GIT_COMMITTER_DATE: isoDate,
            },
        });
        return execFileSync('git', ['rev-parse', 'HEAD'], {
            cwd: repoDir,
            encoding: 'utf-8',
        }).trim();
    }

    beforeAll(() => {
        originalCwd = process.cwd();
        repoDir = mkdtempSync(join(tmpdir(), 'git-lastmod-test-'));

        execFileSync('git', ['init', '-q', '-b', 'main'], { cwd: repoDir });
        execFileSync('git', ['config', 'user.email', 'test@example.com'], { cwd: repoDir });
        execFileSync('git', ['config', 'user.name', 'Test'], { cwd: repoDir });
        execFileSync('git', ['config', 'commit.gpgsign', 'false'], { cwd: repoDir });

        oldHash = commit('initial', 'first\n', '2024-01-01T00:00:00Z');
        newestHash = commit('real edit', 'second\n', '2024-06-01T00:00:00Z');
        bulkHash = commit('reformat (bulk)', 'second\n\n', '2024-12-01T00:00:00Z');

        process.chdir(repoDir);
    });

    afterAll(() => {
        process.chdir(originalCwd);
        rmSync(repoDir, { recursive: true, force: true });
    });

    it('returns the most recent commit date by default', () => {
        expect(gitLastmod('a.md')).toEqual(new Date('2024-12-01T00:00:00Z'));
    });

    it('skips a full-SHA exclusion and returns the next commit', () => {
        expect(gitLastmod('a.md', { excludeCommits: [bulkHash] })).toEqual(
            new Date('2024-06-01T00:00:00Z'),
        );
    });

    it('matches short SHAs (7-char form) in excludeCommits', () => {
        expect(
            gitLastmod('a.md', {
                excludeCommits: [bulkHash.slice(0, 7), newestHash.slice(0, 7)],
            }),
        ).toEqual(new Date('2024-01-01T00:00:00Z'));
    });

    it('returns null when every commit in the window is excluded', () => {
        expect(gitLastmod('a.md', { excludeCommits: [oldHash, newestHash, bulkHash] })).toBeNull();
    });

    it('returns null for a file with no git history', () => {
        expect(gitLastmod('does-not-exist.md')).toBeNull();
    });

    it('respects depth — excluded commit outside the window cannot be skipped past', () => {
        // depth=1 inspects only the newest commit; excluding it leaves nothing.
        expect(gitLastmod('a.md', { depth: 1, excludeCommits: [bulkHash] })).toBeNull();
    });
});
