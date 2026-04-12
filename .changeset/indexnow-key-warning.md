---
'@jdevalk/seo-graph-core': patch
'@jdevalk/astro-seo-graph': patch
---

Docs: warn that the IndexNow key file must be deployed and reachable
over HTTPS *before* any submissions are sent. Early submissions get
rejected (HTTP 403) and the key is marked invalid, forcing rotation.
