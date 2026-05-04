---
'@jdevalk/astro-seo-graph': minor
---

Add `gitLastmod` helper: reads the committer date of the most recent git commit that touched a file, with configurable `excludeCommits` (skip bulk imports / reformats / renames) and `depth`. Use it to feed trustworthy `dateModified` / `<lastmod>` values from git history instead of filesystem `mtime`, which gets rewritten on every CI checkout.

Returns `null` when the file has no git history, git isn't on the PATH, or every commit in the inspected window is excluded — callers should fall back to `publishDate` (or skip the field) in that case. `excludeCommits` matches on the first 7 characters of the SHA, so short hashes from `git log --oneline` work directly.

Build-time only — shells out to the `git` binary via `execFileSync` (no shell parsing, so file paths containing quotes or `$` are safe).
