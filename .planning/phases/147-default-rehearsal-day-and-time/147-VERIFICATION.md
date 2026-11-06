---
phase: 147-default-rehearsal-day-and-time
verified: 2026-11-06T22:50:00Z
status: passed
score: 5/5 roadmap success criteria verified; 6 human checks passed by the owner 2026-11-06 in the local emulator
behavior_unverified: 0
overrides_applied: 0
gaps: []
deferred: []
human_verification:
  - test: "Real-app date change in the local emulator (147-05 human-check). Share a draft service, change its date in the editor, wait for autosave, reload, then open the new public page, the old public page and the regular share link."
    expected: "The new date and the moved auto-added rehearsal survive the reload. The new date page and the regular link open and show the new date. The old date page no longer opens."
    why_human: "Needs real Firestore and the public share page. The unit suite mocks both. Also exercises the real serviceShares delete rule, the slug lookup and the cold/warm cache branch."
  - test: "Settings select at phone width. Open Settings at roughly 360px wide and look at the Rehearsal & Report Defaults card."
    expected: "The Default rehearsal day select sits inside the card, with no horizontal overflow, for both an editor and a viewer (disabled)."
    why_human: "UI-SPEC overflow backstop. The select has no width utility, so overflow is unlikely, but jsdom cannot lay it out."
  - test: "null in the dot-path write settings.rehearsalDefaultWeekday against real Firestore. In Settings pick a day, Save defaults, reload, then pick None, Save defaults, reload."
    expected: "Each choice saves and survives a reload. None reads back as None (not Sunday, not an error) and a new service made afterwards has no rehearsal."
    why_human: "Tests mock updateDoc. Only real Firestore proves null in a dot-path update is stored and read back as null, and that the org rules accept the write."
  - test: "Judgment-tier prohibition 147-02: the auto-added marker is not published on any share link or read-only view. Read the wording and confirm it holds."
    expected: "No share page, volunteer page, My Schedule, card, dashboard or Times tab view shows or carries a marker. Automated LLM-judge verdict: holds (non-authoritative)."
    why_human: "Judgment tier. Flagged unverified-prohibition, human review recommended. Strong evidence exists (see Prohibitions), but the verdict is not authoritative."
  - test: "Judgment-tier prohibition 147-03: never remove a page recorded to another service, or remove this service's old page before the new date's page exists and records it."
    expected: "Holds apart from the owner-accepted AC-RHD-68 gap. Automated LLM-judge verdict: holds (non-authoritative)."
    why_human: "Judgment tier. Flagged unverified-prohibition, human review recommended."
  - test: "Judgment-tier prohibition 147-05: never move, remove or overwrite a rehearsal a planner added or changed, on a date change or a Settings default change."
    expected: "Holds. Only marker-carrying rows move; any date or time edit drops the marker; Settings writes touch no service. Automated LLM-judge verdict: holds (non-authoritative)."
    why_human: "Judgment tier. Flagged unverified-prohibition, human review recommended."
---

# Phase 147: Default Rehearsal Day and Time Verification Report

**Phase Goal:** A church sets one default rehearsal weekday, and every new service starts with its rehearsal already on it, while existing services stay as they are and public views show nothing new. Built spec-first as the pilot for the Phase 146 standard.
**Verified:** 2026-11-06
**Status:** passed (owner ran the real-app checks in the local emulator and approved the wording on 2026-11-06)
**Re-verification:** No, initial verification

R459-R465 are deliberately left unticked in REQUIREMENTS.md for the orchestrator to close. Not reported as a gap.

## Goal Achievement

### Observable Truths (ROADMAP success criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Spec exists before any test or code; R459-R465 each trace to numbered criteria; the Phase 146 check is red from the spec commit and green at the end | VERIFIED | `1446b42e` touches only `docs/specs/default-rehearsal.md` (178 insertions, 1 file). Every commit between the end of Phase 146 and it touches only `.planning/`. It is an ancestor of the first test commit `fc111d48` (16:05, spec 16:01). `6fa2435c` (17:13) precedes `6f7a7162`/`662a9129`; `ababec4a` (17:28) precedes `435e9ed1`/`44d6baa9`. Spec criteria per requirement: R459 9, R460 10, R461 4, R462 26, R463 4, R464 9, R465 7. See "Pilot loop" below. |
| 2 | Admin picks one default weekday or none and it survives reload (R459); Wed + 18:30 gives a Sunday service a Wednesday-before rehearsal at 18:30, a Wednesday service the same day, in any timezone (R460); either default missing gives none (R461) | VERIFIED | `SettingsView.vue:555` select (None, Sunday-Saturday), `:1396` writes `settings.rehearsalDefaultWeekday`; `auth.ts:400` merges over `DEFAULT_ORG_SETTINGS` (null). `rehearsalTimes.ts` UTC-only maths; `createService` (`services.ts:481`) calls `buildAutoRehearsal`. Tests AC-RHD-12..24, 66 pass, incl. 3-zone tests with an offset canary (`inZone.ts`). Mutation: switching `getUTCDay` to `getDay` fails AC-RHD-12/13/14/15/17/18/20/21. Reload survival for real Firestore is in human items. |
| 3 | A move moves an auto-added rehearsal nobody changed, keeping its weekday and time after a Settings change; a changed one stays (R462); Settings change alters no service, no migration (R463) | VERIFIED | `moveAutoRehearsals` moves only `autoAdded` rows from the row's own weekday; `onRehearsalDateChange`/`TimeChange` `delete rehearsal.autoAdded`; `onDateChange` guarded by `canEditService`, `isRealYmd`, one synchronous mutation. `date` is in the `onSave` payload (`ServiceEditorView.vue:4771`, after `name`) and in the mirror (`:4818`, after `name`), same position. Mutations: removing `date` from the payload fails AC-RHD-37/38/63/64; removing it from the mirror fails AC-RHD-63/64. AC-RHD-09/10/11 prove no service write and no add on open or save. |
| 4 | Add form opens with the default date when the service has no rehearsal there; blank when it has one | VERIFIED | `ServiceTimesPanel.vue:71-104`: `newDateOverride` + computed `newDate`, `defaultDate` returns `''` when a rehearsal already sits on it, override reset after Add. Tests AC-RHD-40..48 pass. |
| 5 | ADR supersedes the reversed parts of ADR-0245; auto-added rehearsal looks like any other on read-only views; marker in neither public payload | VERIFIED | ADR-0249 "Accepted; supersedes ADR-0245 (b) and the reversed parts of (a)". ADR-0245 status reads "(a) in part and (b) superseded by ADR-0249"; README row for 0245 mentions 0249; row for 0249 exists. Guard test AC-RHD-55 passes. Both projections end `.map(toPublicRehearsal)` (`services.ts:211`, `rehearseAccess.ts:281`). Mutation: removing the narrowing in `buildServiceSnapshot` fails AC-RHD-49/51/52/10. |

**Score:** 5/5 truths verified, 0 present-but-behavior-unverified. All plan must-have truths (01-05) also verified against code and tests; the two `backstop` truths (select at phone width; emulator move) are routed to human verification, not counted as passed.

### Plan-level truths worth a note

- Old page retirement (AC-RHD-56..62, 68): `retireOldServiceShare` (`services.ts:1307`) runs after the service write and the share refresh, only on a real date change, only when the new date page exists and records this service, only deletes an old page whose `serviceId` is this service, and soft-fails. Cold cache does one direct read before the write (`readStoredServiceDate`). `firestore.rules:702-712` allow an org editor to delete `serviceShares`. Tests run over an in-memory document store, so they assert stored documents, not call shapes.
- Marker confinement: non-test `autoAdded` appears only in `rehearsalTimes.ts`, `types/service.ts`, `ServiceEditorView.vue` (the two `delete` lines) and an unrelated `autoAddedTeams` in `NewServiceDialog.vue`. It is absent from `ServiceTimesPanel`, `ServiceCard`, `DashboardView`, `ShareView`, `VolunteerServiceView`, `ScheduleServiceCard`, `functions/src` and `firestore.rules`. No other code path writes `rehearsals` into a public document: `buildServiceSnapshot` and `buildRehearseAccess` are the only builders, and the re-lock diff at `ServiceEditorView.vue:3374` consumes the narrowed snapshot.

### Pilot loop (R457's first real run)

Ran `runSpecCoverage` myself, two ways, using a copy of `src/__tests__/specCoverage.ts` run through `node --experimental-strip-types`:

| Tree | Result |
|------|--------|
| `git archive 1446b42e src` plus the spec at that commit | 68 problems: `AC-RHD-01 (default-rehearsal.md) has no test citing it` ... all 68 uncited. Red from the spec commit. |
| Current working tree | 0 problems. Green. |

The spec grew from 68 to 69 criteria (AC-RHD-69, via `ababec4a`), and 0 are uncited. Spec status is `Active`.

### Test sampling (each read, and mutation-killed where noted)

| Criterion | Citing test | Assertion would fail if behaviour broke? |
|-----------|-------------|-----------------------------------------|
| AC-RHD-15 | `rehearsalTimes.test.ts:183`, `it.each(TZ_ZONES)` inside `inZone` with a `getTimezoneOffset` canary | Yes. Killed by the local-`getDay` mutation (fails in Pacific/Pago_Pago). |
| AC-RHD-21 | `services.rehearsalDefaults.test.ts:207`, create under each zone, awaited | Yes. Same mutation. |
| AC-RHD-37 | `ServiceEditorView.timesSection.test.ts:712`, `lastSaved().date` after autosave | Yes. Killed by removing `date` from the payload. |
| AC-RHD-38 | same file `:720`, date and moved row `{date:'2026-03-11', autoAdded:true}` in one `updateService` call | Yes. Killed by the same mutation. |
| AC-RHD-51 | `services.publicDocs.test.ts:211`, asserts the stored shareTokens/serviceShares docs exist and hold the row before `not.toContain('autoAdded')` | Yes (non-vacuous). Killed by removing narrowing. |
| AC-RHD-52 | same file, rewrite after edit | Yes. Killed by removing narrowing. |
| AC-RHD-56 | same file `:269`, old doc undefined and new doc present | Yes. Real in-memory store. |
| AC-RHD-58 | same file `:290`/`:306`, call order of `setDoc` before `deleteDoc`; failed new write leaves the old page and calls no delete | Yes. |
| AC-RHD-63 | editor test `:738`, `isDirty` false and no second save | Yes. Killed by removing `date` from the mirror. |
| AC-RHD-67 | `SettingsView.test.ts:510, 542, 575` (switch with shared weekday; settings arriving late; Save writes the new church's values) | Yes. Asserts the three inputs and the exact `updateOrgSettings` payload. |
| AC-RHD-69 | `SettingsView.defaultsWrites.test.ts:153-190`, real auth store, edit after save leaves store at `['19:00']` | Yes. Killed by reverting the array copy (both tests fail). |
| AC-RHD-09 | same file `:119`, real store, every write path is `organizations/org-1` with `settings.` keys | Yes. |
| AC-RHD-10 | `services.publicDocs.test.ts:479`, defaults changed then an unrelated save; no `rehearsals` key in the service write | Yes. |
| AC-RHD-50 | `services.rehearsalProjection.test.ts:223`, exact key set on `buildRehearseAccess` rows | Yes. |
| AC-RHD-53 | `ServiceTimesPanel.test.ts:500`, marked and unmarked `html()` identical for editor and viewer | Yes. |
| AC-RHD-48 | `ServiceTimesPanel.test.ts:492`, Date field HTML identical with and without a default, text is `Date` | Yes. |

No `.skip`, `.only`, `.todo` or debt marker (`TBD`/`FIXME`/`XXX`/`TODO`/`HACK`) was added by the phase.

### Required Artifacts

| Artifact | Status | Details |
|----------|--------|---------|
| `docs/specs/default-rehearsal.md` | VERIFIED | Code RHD, Status Active, 69 criteria, every one cited |
| `src/utils/rehearsalTimes.ts` | VERIFIED | `StoredRehearsal`, `toPublicRehearsal`, `normalizeWeekday`, `mostRecentWeekdayOnOrBefore`, `buildAutoRehearsal`, `moveAutoRehearsals`; imported by services, rehearseAccess, panel, editor, settings |
| `src/types/organization.ts` | VERIFIED | `rehearsalDefaultWeekday: number \| null`, default `null` |
| `src/stores/services.ts` | VERIFIED | `buildAutoRehearsal` in `createService`; `retireOldServiceShare` in `updateService` |
| `src/views/SettingsView.vue` | VERIFIED | Select, save, rollback, reseed watch; markup matches UI-SPEC |
| `src/components/ServiceTimesPanel.vue` | VERIFIED | `defaultWeekday` prop, `newDateOverride`; no marker reference |
| `src/views/ServiceEditorView.vue` | VERIFIED | `moveAutoRehearsals`, marker clearing, `date` in payload and mirror, `:default-weekday` passed |
| `docs/adr/0249-*.md`, `src/__tests__/defaultRehearsalAdr.test.ts` | VERIFIED | See truth 5 |

### Key Links

| From | To | Status |
|------|----|--------|
| `buildServiceSnapshot` / `buildRehearseAccess` | `toPublicRehearsal` | WIRED (`.map(toPublicRehearsal)`) |
| `createService` | `buildAutoRehearsal` | WIRED (`services.ts:481`) |
| `updateService` | `retireOldServiceShare` | WIRED, after `maybeRefreshShareLink`, only on a real change |
| `onSaveRehearsalDefaults` | `updateOrgSettings` with `settings.rehearsalDefaultWeekday` | WIRED |
| `ServiceTimesPanel` | `mostRecentWeekdayOnOrBefore` | WIRED |
| `onDateChange` | `moveAutoRehearsals` | WIRED (one synchronous mutation) |
| `onSave` payload | mirror comparison | WIRED (`date` at the same key position) |
| editor | panel `default-weekday` prop | WIRED (`ServiceEditorView.vue:1759`) |

### Behavioral Spot-Checks (run by me, this session)

| Check | Command | Result | Status |
|-------|---------|--------|--------|
| Full app suite | `npx vitest run` (bare) | 255 files passed, 1 failed (`src/storage.rules.test.ts`, fetch failed ECONNREFUSED 127.0.0.1:8080, the known Storage-emulator baseline). 6442 tests passed, 43 skipped. `src/__tests__/specCoverage.test.ts` passed (167 tests). | PASS (baseline) |
| Type-check including test files | `npm run type-check` | exit 0 | PASS |
| Spec coverage | `runSpecCoverage` | 68 problems at `1446b42e`; 0 now | PASS |
| Mutation: local `getDay` | edited, ran 2 test files, restored with `git checkout` | 8 failures incl. AC-RHD-15/21 | PASS (tests can fail) |
| Mutation: drop `date` from payload / mirror | same | 4 / 2 failures | PASS |
| Mutation: drop projection narrowing | same | 4 failures | PASS |
| Mutation: revert AC-RHD-69 array copy | same | 2 failures | PASS |

Working tree after the mutations shows no `src` changes (`git status` lists only the four `.planning/graphs/*` files that were already modified).

### Requirements Coverage

Requirement IDs declared across the five plans: 01 {R459-R465}; 02 {R459, R460, R462, R465}; 03 {R460-R463, R465}; 04 {R459, R463, R464, R465}; 05 {R462, R463, R464}. Union is R459-R465. REQUIREMENTS.md maps exactly R459-R465 to Phase 147, so there are no orphaned requirements.

| Requirement | Plans | Status | Evidence |
|-------------|-------|--------|----------|
| R459 default weekday in Settings | 01, 02, 04 | SATISFIED (reload on real Firestore in human items) | AC-RHD-01..07, 67, 69 |
| R460 auto-added rehearsal on most recent weekday, any timezone | 01, 02, 03 | SATISFIED | AC-RHD-12..21 |
| R461 no rehearsal unless both defaults set | 01, 03 | SATISFIED | AC-RHD-22..24, 66 |
| R462 move auto-added rehearsal, keep weekday/time, date saved, old page retired | 01, 02, 03, 05 | SATISFIED (emulator check in human items) | AC-RHD-25..39, 56..65, 68 |
| R463 Settings change touches no service | 01, 03, 04, 05 | SATISFIED | AC-RHD-08..11 |
| R464 add form pre-fills the default date | 01, 04, 05 | SATISFIED | AC-RHD-40..48 |
| R465 ADR, marker never public | 01, 02, 03, 04 | SATISFIED | AC-RHD-49..55 |

### CONTEXT decisions honored

One weekday only; editor gate; creation-only with no migration; PC export untouched; a removed rehearsal stays gone (AC-RHD-32); same date and time keeps one row, a different time keeps both (AC-RHD-33/34); an edit ends auto-moving even when set back (AC-RHD-29); a past date is still added (AC-RHD-20); `date` in both payload and mirror at the same position; old page retired with the ownership guard, only once the new page exists, soft-failing; two services on one date recorded as AC-RHD-68; Undo restores the whole snapshot including the marker (AC-RHD-64/65, no extra `onUndo` code); help text verbatim; no visible marker; ADR-0249 supersedes ADR-0245 (a)/(b) in part. The planned (stricter) ordering of retirement, only once the new page exists, goes beyond CONTEXT and is consistent with it.

### Prohibitions (judgment tier, non-authoritative LLM-judge verdicts)

| Plan | Prohibition | Verdict | Flag |
|------|-------------|---------|------|
| 147-02 | MUST NOT publish the marker or any default-origin hint on a share link or read-only view | Holds. Narrowed in both builders; tests for payloads, stored docs and rendered HTML; marker absent from every display component, `functions/src` and rules | unverified-prohibition, human review recommended |
| 147-03 | MUST NOT remove another service's page, or this service's old page before the new page exists and records it | Holds. Ownership check on the old doc; the new-page existence and owner gate; AC-RHD-58, 61, 62, 68 | unverified-prohibition, human review recommended |
| 147-05 | MUST NOT move, remove or overwrite a rehearsal a planner added or changed | Holds. Only marked rows move; a marked row losing a collision is the dropped one; hand-added rows never get the marker; edits delete it | unverified-prohibition, human review recommended |

All three are carried as human-verification items above. None is silently passed.

### Anti-Patterns Found

None blocking. No debt markers, no skipped tests, no stubs. Informational notes only:

| Note | Severity | Impact |
|------|----------|--------|
| Two quick date changes before the local snapshot arrives (A to B, then B to C) would read a stale cached old date A, leaving the page for B in place | Info | Extends the already-recorded "no later save retries" residual in ADR-0249; within the soft-fail design, not a goal failure |
| `HM_RE` accepts `25:99`; AC-RHD-66 says "not in HH:mm form" | Info | Shape check only, matching the rest of the Times tab (pre-existing guard) |
| Owner-accepted behaviours (Undo restores the marker; a same-date sibling loses its date page until next save; cold cache may leave the old page; a past date is still added; stale second tab, recorded in ADR-0249) | Info | Not gaps, per the owner |

### Human Verification Required

See the frontmatter `human_verification` list. Concrete steps:

1. **Emulator date change.** Start the emulator and app, open a draft service with an auto-added rehearsal and share it. Change the date, wait for autosave, reload. Expected: new date and moved rehearsal persist; new page and the regular link show the new date; the old page no longer opens.
2. **Phone-width Settings.** In devtools at about 360px, open Settings. Expected: the select stays inside the card, both as editor and as viewer.
3. **None in real Firestore.** Choose a day, Save defaults, reload; choose None, Save defaults, reload. Expected: it persists as None and a new service then has no rehearsal.
4. **Three judgment prohibitions** (markers, old-page removal, planner-owned rows): read each wording against the evidence above and accept or reject.

### Gaps Summary

No gaps. All five roadmap criteria and all plan truths hold in code and in tests that, where I mutated the code, failed as they should. The one failing test file is the documented baseline. Status is `human_needed` only because real-Firestore, layout and judgment-tier items need a person.

---

_Verified: 2026-11-06_
_Verifier: Claude (gsd-verifier)_
