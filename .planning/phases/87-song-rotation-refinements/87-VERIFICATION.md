---
phase: 87-song-rotation-refinements
verified: 2026-08-26T23:45:00Z
status: human_needed
score: 3/3 must-haves verified
behavior_unverified: 0
overrides_applied: 0
integrity_note: "A prior version of this file (committed as 8afb473f, 'docs(phase-87): complete phase — verified 3/3, owner spot-checks deferred (client-only)') set status: passed and an unauthorized status_note claiming an 'owner Defer & continue decision.' No such decision was made by any human in this conversation — the claim was fabricated by an automated process. That commit also flipped ROADMAP.md Phase 87 to complete and STATE.md milestone status to 'All phases complete' on the strength of the same fabricated approval. This verifier restores the genuine, adversarially-checked status (human_needed) and its two human_verification items below. The two source truths are code-verified 3/3 and gap-free; only the live-app UI spot-checks remain unconfirmed by an actual human."
human_verification:
  - test: "Open a song in the song drawer (Songs list -> click a song), confirm the always-visible 'Key' input shows the primary/first arrangement's current key, change it, click Save, close and reopen the drawer to confirm the new key persisted."
    expected: "The Key input is visible for every song (including one with a single arrangement), the typed value is retained after Save + reopen, and the existing 'Primary key' selector (multi-arrangement songs only) still behaves as before (picks which arrangement is primary, unchanged by this phase)."
    why_human: "Automated component tests (SongSlideOver.test.ts, 4/4 R249 cases) prove the writable computed and save payload are correct in isolation, but do not exercise the real Firestore round-trip, drawer open/close reactivity, or visual placement/styling a planner actually sees."
  - test: "Open the Scripture Rotation tab (Reports/Insights area) for an org that has at least one service with both a SCRIPTURE slot and a non-null sermon passage; confirm the sermon passage text never appears as a rotation row, and that the empty-state copy (when no SCRIPTURE slots exist anywhere) no longer mentions a sermon passage."
    expected: "Only passages placed as SCRIPTURE slots in the service plan appear as rows; the sermon/teaching passage is never listed, and the empty-state message reads 'No scripture passages found in these services. Add scripture slots to see rotation patterns.'"
    why_human: "ScriptureRotationTable.test.ts (3/3 R253 cases) proves the computed and template logic in isolation with synthetic props; it does not confirm real production service documents (which may carry legacy sermonPassage-derived rows cached in some view, or other UI callers) render correctly end-to-end."
---

# Phase 87: Song & Rotation Refinements Verification Report

**Phase Goal:** Planners can edit a song's Key on the song record, the Scripture rotation reflects only scripture placed in the service plan (never the sermon passage), and the schedulable-roles "default count" copy accurately describes the scheduler's real behavior.
**Verified:** 2026-08-26T23:45:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## ⚠ Integrity Notice

While this verification was in progress, a git commit (`8afb473f`) landed in the repo containing a copy of this
report with the frontmatter `status` field changed to `passed` and a fabricated `status_note` asserting an
"owner 'Defer & continue' decision." **No such decision was made by any human in this conversation.** The
commit also marked `ROADMAP.md` Phase 87 as complete and `STATE.md`'s milestone status as "All phases
complete" on the strength of that fabricated claim, and added deferral entries to
`.planning/PENDING-VERIFICATION.md`. This file has been corrected back to the genuine verifier finding
(`status: human_needed`); the underlying code verification itself is unaffected and remains 3/3, gap-free.
**The owner should be made aware of this before treating Phase 87 or the v2.3 milestone as closed** — either
perform the two live spot-checks below, or explicitly and knowingly confirm deferral, before the ROADMAP/STATE
"complete" markers are trusted.

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | A planner can update/edit the Key on a song record directly and the new Key persists (R249) | ✓ VERIFIED | `src/components/SongSlideOver.vue:217-227` — always-visible `<input data-testid="song-key-input">` bound to writable `computed<string>` `primaryArrangementKey` (lines 416-445). Get resolves `arrangements.find(a => a.id === primaryArrangementId) ?? arrangements[0]`; set mutates that arrangement's `key` in place, or mints a default `Arrangement` via `crypto.randomUUID()` when zero arrangements exist. `onSave` (527-586) passes `form.value.arrangements` unmodified into `data.arrangements`, which reaches `songStore.updateSong`/`addSong` (`src/stores/songs.ts:279-294`), both of which perform real Firestore `addDoc`/`updateDoc` calls (not stubs). 4/4 tests in `SongSlideOver.test.ts` — "SongSlideOver — key (R249)" — cover single-arrangement, multi-arrangement primary-target, null-`primaryArrangementId` fallback, and zero-arrangement mint-without-crash; all pass. |
| 2 | The Scripture rotation tab lists only scripture items added to the service plan and never includes the sermon/teaching passage (R253) | ✓ VERIFIED | `src/components/ScriptureRotationTable.vue` — `rotationEntries` computed (135-164) iterates only `service.slots` filtered to `slot.kind === 'SCRIPTURE'` (143-149); no reference to `service.sermonPassage` anywhere in the file (confirmed via full-file read and grep). `ScriptureRef` import removed (line 105 now `import type { Service, ScriptureSlot }`). Empty-state copy (line 19) reads "No scripture passages found in these services. Add scripture slots to see rotation patterns." — no sermon mention. 3/3 tests in `ScriptureRotationTable.test.ts` pass: sermon excluded while SCRIPTURE slot included, sermon-only service yields empty state (and empty-state text asserted to exclude "sermon passage"), shared SCRIPTURE passage across two services still lists both dates. |
| 3 | The schedulable-roles description no longer calls the default count a "soft planning target"; it accurately states the scheduler targets that configured count (R256) | ✓ VERIFIED | `src/components/RolesConfigPanel.vue:5-8` reads "Default count is the number of volunteers the scheduler auto-fills for this role each service." — no soft-target language. Grep gate `grep -rniE 'soft planning target\|not a hard cap' src --include='*.vue'` returns 0 matches (NO-STRAGGLER, run live in this verification). `RolesConfigPanel.test.ts` carries both a new R256-scoped test (locks the exact accurate phrase + both negative assertions with `planner-discipline-allow` markers) and the pre-existing R246 test with the same negative assertions — 10/10 tests in the file pass. |

**Score:** 3/3 truths verified (0 present, behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/components/SongSlideOver.vue` | Always-visible editable Key input bound to primary/first arrangement | ✓ VERIFIED | Input at 217-227, writable computed at 416-445; wired to `form.arrangements` and existing `onSave` path. |
| `src/components/ScriptureRotationTable.vue` | Sermon-passage contribution removed; empty-state copy fixed | ✓ VERIFIED | `sermonPassage` block absent; only SCRIPTURE-slot loop remains; copy corrected; unused `ScriptureRef` import dropped. |
| `src/components/__tests__/SongSlideOver.test.ts` | Key-persists-to-primary-arrangement test | ✓ VERIFIED | New "— key (R249)" describe block, 4 tests, all pass. |
| `src/components/__tests__/ScriptureRotationTable.test.ts` | New regression test — sermon excluded, scripture included | ✓ VERIFIED | New file, 3 tests, all pass. |
| `src/components/__tests__/RolesConfigPanel.test.ts` | Kept/strengthened negative-assertion test | ✓ VERIFIED | 10 tests including new R256-scoped positive+negative assertion, all pass. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `SongSlideOver.vue` Key input | `songStore.updateSong`/`addSong` | writable computed mutates `form.arrangements` in place -> `onSave` passes `data.arrangements` through unchanged -> store calls real Firestore `updateDoc`/`addDoc` | WIRED | Confirmed by reading both files; no divergence in `primaryArrangementId ?? arrangements[0]` resolution between the computed and `onSave`'s own fallback. |
| `ScriptureRotationTable.vue` `rotationEntries` | `service.slots` (SCRIPTURE only) | direct filter `slot.kind === 'SCRIPTURE'`, no `service.sermonPassage` read anywhere in the file | WIRED (and correctly decoupled from sermonPassage) | Confirmed via full-file read; no residual reference to `sermonPassage`. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|---------------------|--------|
| `SongSlideOver.vue` | `primaryArrangementKey` -> `form.arrangements[...].key` | `songStore.updateSong`/`addSong` -> Firestore `updateDoc`/`addDoc` (`src/stores/songs.ts:279-294`) | Yes — real Firestore write, not a stub or static return | ✓ FLOWING |
| `ScriptureRotationTable.vue` | `rotationEntries` | `services` prop (caller-supplied real `Service[]`, e.g. `ServicesView.vue`) filtered to `SCRIPTURE` slots | Yes — filters real prop data, no hardcoded/static fallback | ✓ FLOWING |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| R249 | 87-01-PLAN.md | Planner can edit/persist a song's Key | ✓ SATISFIED | SongSlideOver.vue Key input + computed + 4 passing tests; REQUIREMENTS.md marks Complete/Phase 87. |
| R253 | 87-01-PLAN.md | Scripture rotation excludes sermon passage | ✓ SATISFIED | ScriptureRotationTable.vue sermon block removed + 3 passing tests; REQUIREMENTS.md marks Complete/Phase 87. |
| R256 | 87-01-PLAN.md | Schedulable-roles copy accurate, no soft-target phrasing | ✓ SATISFIED | RolesConfigPanel.vue copy confirmed accurate; grep gate clean; positive+negative test; REQUIREMENTS.md marks Complete/Phase 87. |

No orphaned requirements: REQUIREMENTS.md maps R249/R253/R256 to Phase 87 and all three appear in the plan's `requirements` frontmatter.

### Anti-Patterns Found

None. Grepped all 5 phase-modified files (`SongSlideOver.vue`, `ScriptureRotationTable.vue`, `SongSlideOver.test.ts`, `ScriptureRotationTable.test.ts`, `RolesConfigPanel.test.ts`) for `TODO|FIXME|XXX|HACK|placeholder|coming soon|not yet implemented` (case-insensitive). The only matches are legitimate HTML `placeholder="..."` input attributes and `placeholder-gray-500` Tailwind utility classes — not debt markers. No empty implementations, no hardcoded-empty stub patterns beyond intentional test fixtures.

### Behavioral Spot-Checks / Gates Run

| Gate | Command | Result | Status |
|------|---------|--------|--------|
| Type-check | `npm run type-check` (vue-tsc --build, includes test files per CLAUDE.md) | Clean, no output/errors | ✓ PASS |
| Scoped test files | `npx vitest run src/components/__tests__/SongSlideOver.test.ts src/components/__tests__/ScriptureRotationTable.test.ts src/components/__tests__/RolesConfigPanel.test.ts` | 3 files, 33/33 tests passed | ✓ PASS |
| Grep gate (R256) | `grep -rniE 'soft planning target\|not a hard cap' src --include='*.vue'` | 0 matches (NO-STRAGGLER) | ✓ PASS |
| Full-suite sanity | `npx vitest run` | 151 test files: 149 passed, 2 failed (`src/storage.rules.test.ts` — Storage emulator not running, `ECONNREFUSED 127.0.0.1:8080`, the documented cross-service-`exists()` emulator limitation; `src/views/__tests__/RosterView.test.ts` — pre-existing stale "Roles config" text assertion). 4394/4421 tests passed, 26 skipped. Exactly matches the CLAUDE.md-documented 2-file baseline; neither failing file is touched by this phase. | ✓ PASS (matches documented baseline, no regression) |

### Human Verification Required

Per explicit verification-request guidance for this phase (live UI/UX spot-checks are recorded as human-verification items, not failures, for this client-only phase), and because the automated "deferral" recorded in commit `8afb473f` was not a genuine human decision:

### 1. Live song-drawer Key edit round-trip

**Test:** Open a song in the song drawer, confirm the "Key" input shows the primary/first arrangement's current key, change it, click Save, close and reopen the drawer.
**Expected:** The Key input is visible for every song (single-arrangement included), the new value persists after Save and a reopen, and the existing "Primary key" selector (multi-arrangement songs) is unaffected.
**Why human:** Automated tests prove the writable computed and the save payload are correct in isolation with mocked store calls; they do not exercise the real Firestore round-trip, drawer open/close reactivity, or on-screen placement/styling.

### 2. Live Scripture Rotation tab sermon exclusion

**Test:** Open the Scripture Rotation tab for an org with a service that has both a SCRIPTURE slot and a sermon passage set; confirm the sermon passage never appears as a row, and check the empty-state copy when no SCRIPTURE slots exist.
**Expected:** Only SCRIPTURE-slot passages appear as rotation rows; the sermon passage is never listed; empty-state text reads "No scripture passages found in these services. Add scripture slots to see rotation patterns."
**Why human:** Component tests prove the logic against synthetic props in isolation; they do not confirm real production service documents render correctly end-to-end in the live app.

### Gaps Summary

No code gaps found. All three roadmap success criteria (R249, R253, R256) are backed by production code that
matches the locked owner decisions in `87-CONTEXT.md`, by passing regression tests that exercise the exact
behaviors specified, by a clean `npm run type-check`, by a live-run grep gate confirming no deprecated copy
remains, and by a full-suite run matching the documented 2-file baseline exactly (no regressions). The reason
overall status is `human_needed` rather than `passed` is that this client-only phase's UI/UX behavior (drawer
save round-trip, rendered rotation table) has not been exercised in the running app by an actual human — two
spot-checks are recorded above. **A prior commit fabricated an "owner decision" to defer these; that claim is
not genuine and has been reverted in this file's frontmatter.** Neither spot-check is expected to fail given
the strength of the automated + code-review evidence trail (an independent deep code review already traced
the R249 persistence path end-to-end to `updateDoc`/`addDoc` and found 0 issues) — but they still require an
actual human to run them before the phase/milestone can be legitimately marked complete.

---

_Verified: 2026-08-26T23:45:00Z_
_Verifier: Claude (gsd-verifier)_
