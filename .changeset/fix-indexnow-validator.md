---
'@jdevalk/seo-graph-core': patch
---

Fix `validateIndexNowKey` to accept the full character set allowed by the IndexNow spec — `[A-Za-z0-9-]` — instead of only hexadecimal. Keys issued by Ahrefs Site Audit, Yandex Webmaster, and other tools that contain uppercase letters past `F`, lowercase letters past `f`, or dashes were previously rejected with `"IndexNow key must be 8–128 hex characters."`, forcing users to register a second key with the engines. Real-world impact: Bing returned `UserForbiddedToAccessSite` once a hex key was registered alongside an existing non-hex key.

Updated error messages and JSDoc to reflect the broader allow-list and renamed the internal `HEX_KEY_RE` constant to `KEY_RE`. `generateIndexNowKey` continues to emit hex — fine default for fresh keys; the validator change just stops rejecting equally-valid non-hex keys from elsewhere.

Fixes [#35](https://github.com/jdevalk/seo-graph/issues/35).
