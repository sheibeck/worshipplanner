---
phase: 66-storage-retention
reviewed: 2026-08-20T06:00:00Z
depth: deep
files_reviewed: 2
files_reviewed_list:
  - functions/src/index.ts
  - functions/src/index.test.ts
findings:
  critical: 0
  warning: 1
  info: 1
  total: 2
status: fixed
fixed_at: 2026-08-20T06:30:00Z
fixed_commits:
  - 52f4ac4b # WR-01
  - 9b1e02aa # IN-01
---

# Phase 66: Storage Retention — Code Review Report

**Reviewed:** 2026-08-20T06:00:00Z
**Depth:** deep
**Files Reviewed:** 2
**Status:** issues_found → **all findings fixed** (see per-finding Outcome notes below)

**Fix summary (2026-08-20):** Both findings addressed and committed on top of the reviewed diff.
- WR-01 (Warning) — fixed in `52f4ac4b`.
- IN-01 (Info) — fixed in `9b1e02aa`.

Gates re-run after fixes: `cd functions && npm test` → 348/348 passing (grew from 347 with the new
WR-01 regression test); `cd functions && npm run build` → clean. No deploy performed; all four sweeps
remain dry-run-default and undeployed, per constraint.

## Summary

Reviewed the diff for `ba217abe`, `e1f28d43` (66-01: shared `readDeleteCap()` + hardening of
`cleanupExpiredMediaHandler`/`cleanupOrphanRendersHandler`) and `bee33c42`, `4c32364e` (66-02: new
`cleanupOrphanBackgroundsHandler` and `cleanupPptxSourcesHandler`) in `functions/src/index.ts` and
`functions/src/index.test.ts`. This is destructive code, so the review traced every delete path,
every fail-safe, every guard regex, and every age comparison end-to-end, and cross-checked the
assumptions embedded in code comments (URL shape written by `useBackgroundUpload.ts`, collection
names written by `stores/slideGroups.ts`/`stores/songLyrics.ts`, `createdAt` semantics of
`requestPptxRenderHandler`, importId uniqueness in `pptxUpload.ts`) against the actual writer code,
not just the comments' own claims. Ran the full `functions` test suite (243/243 passing) and
`tsc --noEmit` (clean) to confirm the implementation matches its own tests.

**Verified sound, with no wrong-deletion path found:**
- `readDeleteCap()` correctly floors an invalid/zero/negative/non-integer cap to the 500 default
  (a cap of `"0"` would otherwise silently block every LIVE delete forever, indistinguishable from
  a healthy no-op run — this is defended against).
- All four sweeps compute their cap-vs-dryRun branch, guard-regex test, and age comparison in the
  correct order (guard → age → dry-run branch (never capped) → live cap check → delete), and the
  cap counts only *successful* deletes, never attempts, so a string of delete failures can't
  silently exhaust the cap and let later candidates through uncounted.
- `cleanupOrphanRendersHandler`'s per-doc cap logic (`hitCapThisDoc`) correctly skips the render
  doc's own delete once its rendered objects are only partially cleared — confirmed by both static
  trace and the existing `T-66-01-02` test at a cap-doc boundary.
- `cleanupPptxSourcesHandler`'s `outer:`/`break outer` correctly halts the whole run (not just the
  current import) once the shared cap is hit, and never touches `renderDoc.ref` at all (doc
  lifecycle stays owned by `cleanupOrphanRendersHandler`), confirmed by the "no delete method even
  attached" test.
- `PPTX_SOURCE_GUARD` is structurally unable to match `rendered/` (verified against the regex
  directly, not just the tests) — the anchor requires `source.pptx` or `images/` as the literal
  next path segment after `{importId}/`.
- `extractBackgroundObjectPath()` correctly round-trips every real shape `getDownloadURL()`
  actually produces (verified against `useBackgroundUpload.ts:127`, which is the only writer of
  this field): tokened, `alt=media`-only, no-token, and multi-segment/space-containing paths, since
  Firebase encodes the entire object path as one `/o/{...}` segment with `%2F` for `/`, decoded in
  one `decodeURIComponent()` pass.
- Both R167 fail-safes (`referencesComplete=false` on throw/unparseable-URL, and the floor guard on
  a silently-empty reference Set with nonzero candidates) are computed once, before the per-object
  loop, into a single `effectiveDryRun` — there is no path where a partial scan failure still
  reaches a live delete.
- The `createdAt` age gate `cleanupPptxSourcesHandler` reads is the Firestore server timestamp set
  once at doc creation (`FieldValue.serverTimestamp()`, `functions/src/index.ts:679`) and never
  rewritten by the render-completion write (`docRef.set(..., {merge:true})` at line 858 only
  touches `status`/`renderedCount`/`updatedAt`/`failureReason`), and `generateImportId()` mints a
  fresh UUID per upload session rather than reusing an existing doc — so there is no retry path
  that could re-upload a fresh `source.pptx` under an old `createdAt`, which the age-via-doc-not-
  via-object-timeCreated design depends on.

One real gap in the R167 reference-completeness fail-safe was found (below); it is narrow and
requires malformed Firestore data to trigger, so it is filed as a Warning rather than a Blocker.

## Warnings

### WR-01: A non-array `slides` field silently skips Tier-2 scanning instead of tripping the `referencesComplete` fail-safe

**Outcome: FIXED — commit `52f4ac4b`** (`fix(66): WR-01 close R167 gap for non-array slides field`).
Applied the fix exactly as suggested: a present-but-non-array `slides` field now sets
`referencesComplete = false` instead of being silently skipped. Added a new unit test
(`REFERENCES-INCOMPLETE FAIL-SAFE: a slideGroups doc with a non-array slides field forces the whole
run to dry-run`) asserting the malformed doc forces `dryRun: true` and deletes nothing. Functions
suite: 348/348 passing (was 347/347 + 1 new test). `npm run build` clean.

**File:** `functions/src/index.ts:1352-1361`
**Issue:** The stated safety contract for `cleanupOrphanBackgroundsHandler` is: prove a background
is unreferenced across *all three* tiers, and if that proof can't be completed, force the whole run
to dry-run rather than delete. The mechanism for "can't be completed" is explicit for the
`backgroundImageUrl` string itself (`trackUrl` sets `referencesComplete = false` for any
non-empty value that fails to parse), but not for the embedded `slides` array:

```ts
const data = doc.data() as
  | { backgroundImageUrl?: unknown; slides?: Array<{ backgroundImageUrl?: unknown }> }
  | undefined;
trackUrl(data?.backgroundImageUrl);
if (Array.isArray(data?.slides)) {
  for (const slide of data.slides) {
    trackUrl(slide?.backgroundImageUrl);
  }
}
```

If a `slideGroups` doc's `slides` field exists but is not an array (corrupted write, manual console
edit, a future schema migration that stores it differently, or any document written outside the
app's own `slides: []`-initializing code path), `Array.isArray(data?.slides)` is `false` and the
entire Tier-2 scan for that doc is silently skipped — treated identically to "this doc legitimately
has no slides," not "this doc's slide references could not be read." A background referenced only
via that doc's `slides[].backgroundImageUrl` would then look globally unreferenced. If it also
happens to be older than 30 days, and no *other* live doc happens to reference the same path, it
is deleted — the exact "referenced background force-deleted" failure mode the fail-safe exists to
prevent, just reached through a schema-shape gap rather than a URL-parsing gap.

This is a low-probability trigger today — every write path in `stores/slideGroups.ts` always
initializes `slides: []` and writes an array — but it is a real gap relative to the function's own
stated invariant ("under-deletion is always preferred over deleting a live background"), and
malformed documents are exactly the kind of input a destructive sweep should be defensive against
rather than silently trusting.

**Fix:** Treat a present-but-non-array `slides` field the same as a scan failure:
```ts
if (data?.slides !== undefined) {
  if (Array.isArray(data.slides)) {
    for (const slide of data.slides) {
      trackUrl(slide?.backgroundImageUrl);
    }
  } else {
    // Malformed slides field -- can't prove no reference exists in it.
    referencesComplete = false;
  }
}
```

## Info

### IN-01: Deleted-object-count field naming is inconsistent across the four summary interfaces

**Outcome: FIXED — commit `9b1e02aa`** (`fix(66): IN-01 normalize summary field naming to
deletedObjectCount`). Renamed `CleanupSummary.deletedCount` and `OrphanBackgroundSummary.deletedCount`
to `deletedObjectCount`, matching `OrphanCleanupSummary` and `PptxSourceCleanupSummary`, which already
used that name. Note: the two file:line ranges the original finding cited for `OrphanBackgroundSummary`
and `PptxSourceCleanupSummary` (`249-260`, `481-489`) were stale/incorrect — those lines are unrelated
AI-proxy code; the actual interfaces are at `functions/src/index.ts:1288` and `:1525`. This was a clean
mechanical rename with no external consumers: grepped the whole repo, and the only references to
`deletedCount` outside these two interfaces were in historical `.planning/` phase docs (left untouched
as historical record, not live callers). Updated the interface field, local variable, return-object key,
and all matching test assertions in `functions/src/index.test.ts`. `OrphanCleanupSummary.deletedDocCount`
is untouched — it counts a different thing (Firestore docs, not Storage objects) and was never part of
the inconsistency. Functions suite: 348/348 passing. `npm run build` clean.

**File:** `functions/src/index.ts:937-945, 1084-1093, 249-260, 481-489`
**Issue:** `CleanupSummary.deletedCount`, `OrphanCleanupSummary.deletedObjectCount` (+
`deletedDocCount`), `OrphanBackgroundSummary.deletedCount`, and
`PptxSourceCleanupSummary.deletedObjectCount` name the "number of Storage objects removed this run"
field differently across four structurally similar interfaces in the same file, added across two
back-to-back commits. Purely a readability/consistency nit for anyone reading logs or writing a
future sweep against this same shared pattern — no functional impact.
**Fix:** Not urgent; if another sweep is added on this pattern, consider standardizing on
`deletedObjectCount` (the two-part sweeps' name) for the object-count field, reserving `deletedCount`
for single-artifact sweeps only.

---

_Reviewed: 2026-08-20T06:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
