---
status: complete
phase: 50-slide-management-bulk-delete-provenance
source: [50-VERIFICATION.md]
started: "2026-08-10T22:38:02Z"
updated: "2026-08-10T22:52:00Z"
---

## Current Test

number: 2
name: Live multi-image PPTX round-trip (R108)
expected: All tests passed — UAT complete.
awaiting: none — all tests passed

## Tests

### 1. Post-deploy cache refresh + asset immutability (R109)
expected: |
  (a) `/` and a SPA deep link both re-fetch index.html fresh after a deploy (no manual
      cache-clear), showing the new bundle immediately.
  (b) `/assets/*` responses keep the long/immutable Cache-Control (not no-cache).
  Config is `source:"**"` no-cache + `source:"/assets/**"` immutable, correct under Firebase's
  last-match-wins header precedence. If assets come back no-cache in production, reorder so
  `/assets/**` wins. (See PENDING-VERIFICATION 50.1; the /index.html-only header was widened
  per code-review WR-01 + owner decision 2026-08-10.)
why_human: Deploy-gated per the standing v1.5 NO-DEPLOYS grant.
result: passed — VERIFIED IN PRODUCTION 2026-08-10 (automated header inspection by Claude, after
  owner-authorized `firebase deploy --only hosting,functions`). `curl -D-` against
  https://worship-planner-bc515.web.app returned: `/` → `Cache-Control: no-cache, no-store,
  must-revalidate` (text/html); `/index.html` → same; `/services/verify-test` (SPA deep link) →
  same (text/html shell); `/assets/index-PNUhzbF4.js` → `public, max-age=31536000, immutable`.
  Both (a) shell-no-cache-on-all-routes and (b) assets-still-immutable confirmed; the last-match-wins
  precedence assumption held in production. (The residual nuance — a browser that had the OLD bundle
  cached now re-fetching — follows directly from the confirmed `no-cache, no-store` header.)

### 2. Live multi-image PPTX round-trip (R108)
expected: |
  Import a real multi-image PPTX deck (a source slide with >1 image, so parsed-slide count
  ≠ rendered-page count) into a group, hand-add one of its slides into another (non-imported)
  group, and once the render pipeline finishes it shows the CORRECT rendered page image — not
  a perpetual "Rendering" placeholder.
why_human: R108's resolution logic is proven by unit tests over synthetic fixtures; a live
  upload → parse (Cloud Function) → render-service → Storage → client round-trip has not been
  exercised. This is the multi-image defect from 2026-08-10 that R108 closes.
result: passed — OWNER-VERIFIED 2026-08-10 against the production deploy. A real multi-image PPTX
  deck imported through the live UI; a hand-added slide resolves to the correct rendered page (no
  perpetual "Rendering" placeholder). Confirms `renderedPage` round-trips through the live
  parse -> render-service -> Storage -> client cycle, not just unit fixtures.

## Summary

total: 2
passed: 2
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps
