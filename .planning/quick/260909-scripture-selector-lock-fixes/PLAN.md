---
quick_id: 260909-scripture-selector-lock-fixes
slug: scripture-selector-lock-fixes
status: complete
date: 2026-09-09
---

# Quick task: Bible-API-off UX + mark-planned lock races

Owner-requested feature + production console errors surfaced during live testing.

## A. Open in BibleGateway on AI suggestions when Bible API off (requested)

When the org's Bible API is off there is no in-app passage preview, so each AI
scripture suggestion now shows an "Open in BibleGateway" deep-link next to its
reference (`ScriptureInput.vue`, `aiSuggestionBibleGatewayLink` → existing
`bibleGatewayLink` helper + `effectiveVersion`). Hidden when the API is on.

## B. Hide ESV/NLT selector when Bible API off (requested)

The per-item Scripture version `<select>` (`ServiceEditorView.vue` `#version`
slot) is now `v-if="authStore.isBibleApiEnabled"` — it only governs the
auto-fetch translation, inert when the API is off.

## Thread 2. ServiceLockedError on "Mark as Planned"

Owner: exported plan → reopened → Mark as Planned → `autosave failed:
ServiceLockedError (R036)`. Regression from R420 (quick 260908-cou), which seeds
the Stage Layout at lock. The seed mutates `localService`, but the autosave
watcher arms `'pending'` asynchronously; `onMarkAsPlanned`'s immediate
`autoSave.flush()` ran its "nothing pending" check first → no-op, so the seed's
~800ms debounce fired AFTER the lock (during `markAsPlanned`'s round-trip) and
was rejected — losing the seed too. Fix: `await nextTick()` between the seed and
`flush()`. Updated the CR-01 regression test (a single full-doc seed-flush write
may ride along; ME-02 re-expressed as "slots unchanged").

## Thread 3. Three more production console messages

1. **`@firebase/firestore BloomFilterError`** — benign Firestore SDK internal
   (listener-resync bloom-filter false-positive → full requery). Not ours. No change.
2. **`Cannot read properties of undefined (reading 'startTime') at
   reportAllChanges`** — `web-vitals` is a transitive dep only (never imported in
   `src/`); injected by a browser extension / perf tool. Not ours. No change.
3. **`[useSlideshowAssembly] group materialization write failed: ... Missing or
   insufficient permissions`** — a fire-and-forget slide-group write issued while
   draft lands just after the service locks; the `/slideGroups` rule rejects it.
   Expected, non-fatal (re-materializes on next draft edit). Fix: recognize the
   `permission-denied` code via `isPermissionDenied` and log a quiet `warn`
   ("skipped — service locked mid-write") instead of `console.error`; genuine
   failures still error. Applied to both materialization + rebuild catch blocks.

## Verification

- `npm run type-check` clean.
- ScriptureInput (+2), ServiceEditorView (selector-off +1, CR-01 updated),
  useSlideshowAssembly (+1) suites green; full app suite at the storage.rules-only baseline.

## Deploy

Client-only (no functions/rules change) → `firebase deploy --only hosting`.
