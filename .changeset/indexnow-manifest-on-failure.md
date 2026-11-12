---
'@jdevalk/astro-seo-graph': patch
---

Keep the previous IndexNow manifest when a submission is refused.

With `indexNow.incremental`, the new manifest was written to the build output before the submission and shipped even when IndexNow refused it (for example the `403 SiteVerificationNotCompleted` a new key returns for its first minute). The next build then diffed against URLs that were never accepted and submitted nothing for them.

The new manifest now ships only when every batch is accepted. After a refused submission the previous manifest ships unchanged, so the next build sees the same URLs as changed and retries them. When the previous manifest could not be read and `onError: 'full'` submitted everything without success, no manifest ships, so the next build reads a `404` and submits everything again.
