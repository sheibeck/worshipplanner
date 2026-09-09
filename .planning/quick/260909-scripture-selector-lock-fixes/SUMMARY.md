---
quick_id: 260909-scripture-selector-lock-fixes
slug: scripture-selector-lock-fixes
status: complete
date: 2026-09-09
---

# Summary

Four changes (one requested feature, three from live production console errors):

- **A** — AI scripture suggestions show an "Open in BibleGateway" deep-link when
  the org's Bible API is off (`ScriptureInput.vue`). Commit `2bd7e625`.
- **B** — the per-item ESV/NLT selector is hidden when the Bible API is off
  (`ServiceEditorView.vue` `#version` slot). Commit `d3cd92da`.
- **Thread 2** — fixed `ServiceLockedError` on Mark-as-Planned: `await nextTick()`
  between the R420 stage-seed and `autoSave.flush()` so the seed persists while
  draft instead of a debounce racing the lock. CR-01 test updated. Commit `d3cd92da`.
- **Thread 3.3** — quieted the expected `permission-denied` on slide-group writes
  that race the lock to a `console.warn` (via `isPermissionDenied`); genuine
  failures still error. Commit `e0877b4e`.

No-code triage: **BloomFilterError** = benign Firestore SDK noise; the
**`reportAllChanges`/`startTime`** error = a browser extension (web-vitals not in
app code). Neither is ours.

## Verification

`npm run type-check` clean; affected suites green (ScriptureInput +2,
ServiceEditorView selector-off +1 and CR-01 updated, useSlideshowAssembly +1);
full app suite at the storage.rules-only baseline.

## Deploy

Client-only. ✅ **DEPLOYED to production 2026-09-09** — `firebase deploy --only
hosting` (owner permission). Tagged **v2.13.1** (production hotfixes on top of
v2.13; v2.14 remains in progress). This session's full hotfix set also live:
260908-pca (PC 401), 260909-ai-multichurch-gate (AI/Bible active-church gate),
and this batch.
