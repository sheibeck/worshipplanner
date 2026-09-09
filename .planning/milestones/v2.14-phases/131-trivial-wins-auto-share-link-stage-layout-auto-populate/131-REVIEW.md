---
phase: 131-trivial-wins-auto-share-link-stage-layout-auto-populate
reviewed: 2026-09-07T00:00:00Z
depth: standard
files_reviewed: 7
files_reviewed_list:
  - src/utils/stageLayout.ts
  - src/utils/__tests__/stageLayout.test.ts
  - src/views/ServiceEditorView.vue
  - src/views/__tests__/ServiceEditorView.stage.test.ts
  - src/stores/services.ts
  - src/stores/__tests__/services.test.ts
  - functions/seed-emulator-data.mjs
findings:
  critical: 0
  warning: 1
  info: 2
  total: 3
status: issues_found
---

# Phase 131: Code Review Report

**Reviewed:** 2026-09-07
**Depth:** standard
**Files Reviewed:** 7
**Status:** issues_found

## Summary

Reviewed Phase 131's two trivial-wins slices: (1) `autoPopulateMarkers()` plus its
one-time empty-canvas seed wiring in `ServiceEditorView.vue`, and (2) the fail-closed
`ensureShareLink` self-heal added to `markAsPlanned`, plus the seed script's
deterministic share-token mint.

The core load-bearing invariant — auto-populate must never touch a non-empty canvas —
holds correctly: `onAutoPopulateStageLayout()` gates on `existing.length > 0` read
fresh from `localService.value.stageLayout` on every call, so a populated canvas
(seeded, manually built, or partially edited) is never regenerated, wiped, or
duplicated, including across roster changes prior to lock. `canEditService` (editor +
unlocked) additionally gates every seed attempt, so a locked service never seeds. The
`watch(activeTab, ...)` trigger is safe against a false-negative on first mount because
`activeTab` always initializes to `'service-order'`, never `'stage'` — the watcher is
guaranteed at least one real transition before any seed attempt.

`autoPopulateMarkers()` itself is pure, deterministic, and geometrically sound: the
(row, col) → (x, y) mapping is injective given the fixed 4-column grid and multi-row
step math, so no two seeded markers ever collide, and every marker lands strictly
inside `STAGE_BAND` regardless of roster size. Confirmed via `npx vitest run` (168/168
passing across the three touched test files) and a clean `npm run type-check`.

The `markAsPlanned` share-link self-heal is genuinely fail-closed (its own try/catch,
logged and swallowed, never rethrown — the status transition has already committed by
the time it runs) and genuinely idempotent (`ensureShareLink`'s identity-doc-first read
plus transaction-guarded mint, unchanged by this phase, is what a lock → reopen →
relock cycle rides). `createService`'s creation-time mint is untouched.

One real gap surfaced in the auto-populate wiring's persistence story (see WR-01
below): the "already seeded" guard is an in-memory `Set`, not a persisted flag, so it
only holds "in the same session" — exactly as the code's own comments and the test
suite's test titles admit. A user who deletes every seeded marker and then reloads the
page gets them all back. Two lower-severity items were also found in the seed script's
new share-token payload (fields that don't match the real public snapshot shape, and a
narrow overwrite-orphan scenario on repeated seeding against persisted emulator data).

## Warnings

### WR-01: Auto-populate's "already seeded" guard does not survive a page reload — deleting all seeded markers is not durable

**File:** `src/views/ServiceEditorView.vue:2351-2363`
**Issue:**
`stageAutoPopulateSeededServiceIds` is a plain in-memory `Set` declared inside
`<script setup>`, so it is reset to empty on every fresh component mount (page
reload, or navigating away from and back to the editor). The primary non-clobber
guard — `existing.length > 0` — correctly reads live Firestore-backed state, so it
does hold across reloads for the "canvas has markers" case. But when a user deletes
every seeded marker, `onStageMarkerRemove` (line 2330-2339) sets
`localService.value.stageLayout = undefined`, and `updateService` persists that as a
literal `stageLayout: null` (per the existing remove test at
`ServiceEditorView.stage.test.ts:427-448`). At that point the canvas is genuinely
empty by both guards' own definition.

If the user then reloads the page (or the component is otherwise remounted) and
revisits the Stage Layout tab, `stageAutoPopulateSeededServiceIds` is a fresh empty
`Set`, `existing.length` is `0`, and `autoPopulateMarkers()` regenerates the exact
same seeded layout the user just explicitly deleted. There is no persisted flag (no
`stageLayoutSeeded`/`stageLayoutSeededAt` field on the `Service` doc, confirmed absent
from `src/types/service.ts`) recording that this service was already auto-populated
once.

This is not a violation of the stated primary invariant ("never regenerate over a
non-empty canvas" — the canvas here genuinely is empty), and the code's own comments
(`ServiceEditorView.vue:2345`, "so delete-all-then-revisit **in the same session**
doesn't re-seed") and the test suite's own test title
(`ServiceEditorView.stage.test.ts:599`, "...in the same session") show this limitation
was known at implementation time, not missed. It is still a real UX correctness gap
worth fixing before this ships as a "one-time" feature: a planner's explicit "delete
all, I don't want auto layout" action currently only survives until the next reload.

**Fix:** Persist the seeded-guard alongside the data it protects, e.g. a boolean/flag
field on the service (`stageLayoutAutoSeeded: true`, written in the same
`localService.value.stageLayout = { elements: seeded }` mutation so it rides the
existing autosave) that `onAutoPopulateStageLayout` checks instead of (or in addition
to) the session-only `Set`:
```ts
function onAutoPopulateStageLayout() {
  if (!canEditService.value) return
  if (!localService.value) return
  const existing = localService.value.stageLayout?.elements ?? []
  if (existing.length > 0) return
  if (localService.value.stageLayoutAutoSeeded) return // NEW: persisted, survives reload
  const seeded = autoPopulateMarkers(stageServingAssignments.value)
  if (seeded.length === 0) return
  localService.value.stageLayout = { elements: seeded }
  localService.value.stageLayoutAutoSeeded = true // NEW
}
```
At minimum, if the session-only scope is an accepted trade-off for this "trivial win"
phase, promote the comment out of an inline aside into something more visible (e.g. a
`STATE.md`/backlog note) so it isn't rediscovered as a surprise later, since a
page-reload-resurrects-deleted-data pattern is easy to mistake for a real bug report
from an owner/volunteer.

## Info

### IN-01: Seed script's share-token payload doesn't match the real public snapshot shape

**File:** `functions/seed-emulator-data.mjs:421-434`
**Issue:** The new `shareTokens/{token}` document's `serviceSnapshot` is hand-built
with `{ name, date, progression, slots, sermonPassage, sermonTopic }`. The real
runtime path (`buildServiceSnapshot` + `toPublicServiceSnapshot`,
`src/stores/services.ts:122-250`) produces `{ date, name, progression, teams, slots,
sermonPassage, status, roleAssignments, stageLayout? }` — i.e. the seed payload is
missing `teams` and `roleAssignments` (and includes `sermonTopic`, which isn't part of
`ServiceSnapshot`/`PublicServiceSnapshot` at all). `ShareView.vue` gracefully degrades
for both — `teams` falls back to `'Standard Band'` (line 196-197) and the "Who's
Serving" section is simply omitted when `roleAssignments` is absent (line 113) — so
this doesn't crash, but the seeded service's team (`['Choir']`, set on the Firestore
service doc itself) never shows on its own public share page, and the "Who's Serving"
section — one of the more interesting parts of the page to eyeball during manual
testing — is silently never exercised by this seed data, despite the commit message's
claim to "mirror what `ensureShareLink()`/`writeSharePayload()` write for a
UI-created service."
**Fix:** Either accept the current partial mirror (it's dev-only tooling, not a
correctness bug) and tighten the comment to say so explicitly, or extend the seed
payload to include `teams: ['Choir']` and a hand-built `roleAssignments` entry or two
so the seeded share page actually exercises every section `ShareView.vue` renders.

### IN-02: Re-seeding against persisted emulator data can orphan a previously real-minted share token

**File:** `functions/seed-emulator-data.mjs:413-420`
**Issue:** `serviceShareLinks/{serviceId}` and `shareTokens/{deterministicToken}` are
both written unconditionally via `.set()` on every seed run, keyed off the
deterministic `serviceId`. This is correctly idempotent for repeated runs of the seed
script alone. But if the emulator's Firestore data persists across restarts (e.g. via
`--import`/`--export-on-exit`, common local dev practice) and, between two seed runs,
the app itself called `ensureShareLink` for this same service (e.g. an owner manually
clicking "Share Link", which — since `serviceShareLinks/service-1` already existed
from the first seed — would just refresh the payload, not mint a new token, so this
specific case is actually fine)... the risk narrows to: if a developer ever deletes
just the `serviceShareLinks/{serviceId}` doc (or the identity doc is missing for any
other reason) between seed runs while `shareTokens/{oldToken}` from a prior real mint
still exists, the next seed run's unconditional `.set()` on `serviceShareLinks`
silently repoints the service at the new deterministic token, leaving the old
`shareTokens/{oldToken}` doc as permanent dev-emulator clutter no code path cleans up.
**Fix:** Low priority given this is dev-only tooling with no real-data exposure — a
short comment noting the identity doc is unconditionally overwritten (not read-then-skip
like `ensureShareLink`'s own steady-state path) would be enough to prevent a future
maintainer from assuming full parity with the real idempotent-adoption logic.

---

_Reviewed: 2026-09-07_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
