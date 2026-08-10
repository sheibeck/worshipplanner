---
status: testing
phase: 50-slide-management-bulk-delete-provenance
source: [50-VERIFICATION.md]
started: "2026-08-10T22:38:02Z"
updated: "2026-08-10T22:38:02Z"
---

## Current Test

number: 1
name: Post-deploy cache refresh + asset immutability (R109)
expected: |
  After a real `firebase deploy --only hosting`, in a browser that previously had the app
  cached and WITHOUT a manual cache-clear:
  (a) Loading the production ROOT url `/` and a deep link (e.g. `/services/<id>`) re-fetches
      `index.html` fresh for both (DevTools Network shows a real document request, not
      `(disk cache)`/`(memory cache)`), and the newly deployed bundle loads immediately.
  (b) A hashed asset under `/assets/` still returns `Cache-Control: public, max-age=31536000,
      immutable` — NOT no-cache.
awaiting: user response

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
why_human: Deploy-gated per the standing v1.5 NO-DEPLOYS grant — no `firebase deploy` was run.
result: [pending]

### 2. Live multi-image PPTX round-trip (R108)
expected: |
  Import a real multi-image PPTX deck (a source slide with >1 image, so parsed-slide count
  ≠ rendered-page count) into a group, hand-add one of its slides into another (non-imported)
  group, and once the render pipeline finishes it shows the CORRECT rendered page image — not
  a perpetual "Rendering" placeholder.
why_human: R108's resolution logic is proven by unit tests over synthetic fixtures; a live
  upload → parse (Cloud Function) → render-service → Storage → client round-trip has not been
  exercised. This is the multi-image defect from 2026-08-10 that R108 closes.
result: [pending]

## Summary

total: 2
passed: 0
issues: 0
pending: 2
skipped: 0
blocked: 0

## Gaps
