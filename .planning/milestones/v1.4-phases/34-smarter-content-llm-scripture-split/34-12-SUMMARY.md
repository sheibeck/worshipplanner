---
phase: 34-smarter-content-llm-scripture-split
plan: 12
subsystem: auth
tags: [vue, pinia, vitest, firestore, planning-center, requirements]

# Dependency graph
requires:
  - phase: 34-smarter-content-llm-scripture-split (plan 07)
    provides: "ServiceEditorView.vue's header action row (Export to PC / Copy for PC), the same container this plan adds a sibling note to"
provides:
  - "A settled, evidence-backed verdict on owner UAT finding F5: the credential gate (authStore.hasPcCredentials) is behaving correctly; the org document genuinely lacking Planning Center credentials is the remaining explanation, not a load-order/reactivity regression"
  - "A hasPcCredentials field-shape matrix (9 cases) and a load-order/reactivity proof in auth.test.ts, pinned so a future edit cannot loosen the gate silently"
  - "R071 in REQUIREMENTS.md: an editor with no PC credentials is told why, beside Copy for PC, with a route to Settings — the export affordance itself stays gated"
  - "The UX fix: a canEditService-gated explanation note in ServiceEditorView.vue linking to the settings route by name"
affects: [34-08]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Diagnosis-before-fix, gated by git diff --exit-code — Task 1 changed zero production files and its acceptance criteria enforced that mechanically, so the fix branch in Task 3 was chosen from a recorded verdict rather than written against an assumed cause"
    - "Deferred-promise reactivity proof — a pending getDoc() promise on the org-document read, with hasPcCredentials asserted false while in flight and true once resolved on the same store instance, to distinguish 'self-heals via Vue reactivity' from 'a lasting regression'"
    - "Credential-safe test fixtures — every pcAppId/pcSecret value in new tests is an obviously-synthetic placeholder string; every assertion is on hasPcCredentials or ref presence/absence, never a value comparison"

key-files:
  created: []
  modified:
    - src/stores/__tests__/auth.test.ts
    - .planning/REQUIREMENTS.md
    - .planning/ROADMAP.md
    - src/views/ServiceEditorView.vue
    - src/views/__tests__/ServiceEditorView.test.ts

key-decisions:
  - "Verdict: cause 1 (org document genuinely lacks credentials), not cause 2 (load-order/reactivity regression). The reactivity test proved hasPcCredentials flips false→true correctly and automatically once loadOrgContext resolves, on the same store instance, with no remount needed — so even though `/services/:id` has no `requiresEditor` guard and never awaits `waitForRole()`, any transient false window self-heals the instant the org document resolves. A regression that self-heals cannot be what produced the owner's *persisting* false gate; the org document's actual field contents (unobservable from this environment) are the remaining explanation."
  - "No fix to auth.ts, hasPcCredentials, or the export gate — Task 3 delivered only the UX half (R071), per Task 1's verdict. Manufacturing a code change to look productive was explicitly prohibited by the plan and not done."
  - "The whitespace-only pcAppId behavior (auth.ts checks `!== ''`, not `.trim()`) was recorded as an OBSERVATION with a passing test, not tightened — the plan named this a deliberately-unresolved assumption out of scope for this diagnosis."

requirements-completed: [R071]

coverage:
  - id: D1
    description: "hasPcCredentials is pinned across every org-document field shape (both present, either absent, either empty string, org doc missing, no org, after logout, whitespace-only observation) via loadOrgContext, driven through the file's existing Firestore mocks — no credential value read, printed, or asserted on"
    requirement: "R071"
    verification:
      - kind: unit
        ref: "src/stores/__tests__/auth.test.ts#hasPcCredentials (34-12 Task 1 — field-shape matrix)"
        status: pass
    human_judgment: false
  - id: D2
    description: "The load-order/reactivity candidate (cause 2) is settled by an executable assertion: hasPcCredentials is false while the org-document read is in flight and true once it resolves, on the same store instance with no remount — proving a load-order regression self-heals and cannot explain a persisting false gate"
    requirement: "R071"
    verification:
      - kind: unit
        ref: "src/stores/__tests__/auth.test.ts#Planning Center credential load order (34-12 Task 1 — reactivity)"
        status: pass
    human_judgment: false
  - id: D3
    description: "R071 is written into REQUIREMENTS.md's Service Lifecycle section (unchecked, Pending traceability row) and ROADMAP's Phase 34 Requirements line, correcting the record that F5 was a misdiagnosis rather than a removal"
    requirement: "R071"
    verification:
      - kind: other
        ref: "grep -c R071 .planning/REQUIREMENTS.md (4) and .planning/ROADMAP.md (4); git diff --stat shows scoped insertions only (single-digit deletions)"
        status: pass
    human_judgment: false
  - id: D4
    description: "An editor with no Planning Center credentials configured sees a plain explanation beside Copy for PC, linking to the settings route by NAME (never a hardcoded path); a viewer never sees it; the Export to PC button's v-if, handler and modal are untouched and never render without credentials at any service status"
    requirement: "R071"
    verification:
      - kind: unit
        ref: "src/views/__tests__/ServiceEditorView.test.ts#ServiceEditorView - Planning Center credentials-missing note (34-12 Task 3, R071)"
        status: pass
    human_judgment: false
  - id: D5
    description: "The org document's actual pcAppId/pcSecret contents cannot be observed from this environment — an owner-run Firebase console check is the remaining unresolved half, to be filed in PENDING-VERIFICATION.md by 34-08 Task 2"
    verification: []
    human_judgment: true
    rationale: "Requires the owner to open the Firebase console for the production organization's document and report presence/absence of pcAppId/pcSecret — no test fixture or session tool can speak for live production data, and this plan is explicitly barred from marking it passed or editing PENDING-VERIFICATION.md itself."

# Metrics
duration: 35min
completed: 2026-08-03
status: complete
---

# Phase 34 Plan 12: Diagnose and Explain the No-Credentials Export State (UAT F5) Summary

**Diagnosed owner UAT finding F5 as a misdiagnosis (Export to PC was never removed — `hasPcCredentials` behaves correctly), wrote R071 for the real defect (a silent, unexplained button swap), and shipped only the UX fix: a `canEditService`-gated note beside Copy for PC that names the missing-credentials reason and links to Settings by route name — the export affordance itself stays exactly as gated as it was.**

## Performance

- **Duration:** ~35 min
- **Started:** 2026-08-03T21:03:00-04:00
- **Completed:** 2026-08-03T21:38:00-04:00
- **Tasks:** 3
- **Files modified:** 5

## Accomplishments

- **The diagnosis is settled by evidence, not assumption.** Task 1 extended `auth.test.ts` with a `hasPcCredentials` field-shape matrix (9 cases: both fields present, `pcAppId` absent, `pcSecret` absent, either empty string, org document missing, user in no organization, after logout, and a whitespace-only observation) and a dedicated load-order/reactivity case that defers the org-document `getDoc()` read and asserts `hasPcCredentials` is false while it is in flight and true once it resolves — on the **same store instance**, with no remount. It changed zero production files, enforced mechanically by `git diff --exit-code -- src/stores/auth.ts src/views/ServiceEditorView.vue src/views/SettingsView.vue` in its own acceptance criteria.
- **Verdict: cause 1, not cause 2.** The reactivity test proved `hasPcCredentials` self-heals correctly the instant `loadOrgContext` resolves — Vue's computed reactivity does exactly what it should, even though `/services/:id`'s route meta has no `requiresEditor` and never awaits `waitForRole()` before the view renders. A regression that self-heals within one promise resolution cannot be what produced the owner's **persisting** false gate. The org document genuinely lacking `pcAppId`/`pcSecret` is the remaining explanation — the code is behaving correctly.
- **The unobservable half is written down, not guessed at.** The org document's actual production contents cannot be checked from this environment (or any test fixture). Recorded as `D5` above, marked `human_judgment: true`, with the exact owner-run check (open the Firebase console for the organization's document, report only presence/absence of `pcAppId`/`pcSecret`) — handed to 34-08 Task 2 for filing in `PENDING-VERIFICATION.md`, not marked passed here.
- **R071 corrects the record.** Written into `REQUIREMENTS.md`'s Service Lifecycle section (unchecked, `Pending` traceability row) and `ROADMAP.md`'s Phase 34 `Requirements` line, with the planning-corrections note extended to state plainly: Export to PC was never removed, it is credential-gated, and 34-12's diagnosis found the gate itself behaving correctly.
- **The real defect — the silent substitution — is fixed.** Since Task 1's verdict was cause 1 ("no fix" is the legitimate diagnosis outcome), Task 3 delivered only the UX half the plan required regardless of verdict: a `canEditService && !authStore.hasPcCredentials`-gated `<span data-testid="pc-credentials-missing-note">` beside Copy for PC, naming Planning Center credentials as the reason and linking to `{ name: 'settings' }` — never a hardcoded `/settings` string. The Export to PC button's `v-if`, `:disabled`, handler and modal are byte-unchanged.
- **The export affordance is never ungated.** A dedicated regression test asserts `[data-testid="export-pc-btn"]` does not exist for a `planned` service when `hasPcCredentials` is false — the status at which it would otherwise be enabled — so a future edit that loosens the gate fails here.

## Task Commits

Each task was committed atomically:

1. **Task 1: DIAGNOSIS — settle which cause is live, with a written verdict. No fix in this task.** - `3fd90bc` (test)
2. **Task 2: Write the missing requirement for the no-credentials state** - `c4c4a76` (docs)
3. **Task 3: Tell an editor with no Planning Center credentials why, with a route to fix it — and never ungate the export** - `c822272` (feat)

**Plan metadata:** (this commit) `docs(34-12): complete diagnose-and-explain-no-credentials-export-state plan`

## Files Created/Modified

- `src/stores/__tests__/auth.test.ts` — `hasPcCredentials` field-shape matrix (9 cases) and a load-order/reactivity describe block, all driven through `loadOrgContext` via the file's existing path-aware Firestore mocks; every fixture is an obviously-synthetic placeholder, every assertion is on `hasPcCredentials`/ref presence
- `.planning/REQUIREMENTS.md` — R071 added to the Service Lifecycle section (unchecked); Traceability row (`Pending`); coverage counts updated (35 → 36 requirements)
- `.planning/ROADMAP.md` — Phase 34's `Requirements` line extended to `R064, R070, R071`; planning-corrections note extended with the F5 misdiagnosis correction
- `src/views/ServiceEditorView.vue` — new `canEditService && !authStore.hasPcCredentials`-gated note, `data-testid="pc-credentials-missing-note"`, linking to the `settings` route by name; no other line touched
- `src/views/__tests__/ServiceEditorView.test.ts` — new describe block covering the note's presence/absence, the settings-route link, the never-ungated export gate at `planned` status, and the viewer exclusion

## Decisions Made

- **Verdict: cause 1 (org document genuinely lacks credentials), settled by the reactivity self-heal test** — see `key-decisions` in frontmatter for the full reasoning.
- **No production change to `auth.ts`** — the plan explicitly named "cause 1 → no code change" as a legitimate outcome and prohibited manufacturing a fix to look productive; that instruction was followed exactly.
- **Whitespace-only credential behavior recorded as an observation, not tightened** — `auth.ts` checks `!== ''`, not `.trim()`; a test exercises and records the current (permissive) behavior with a comment naming it an observation, per the plan's explicit instruction not to change it here.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Plan-text correction] One acceptance-criterion phrasing didn't match verified code behavior**
- **Found during:** Task 3, while designing the Copy-for-PC regression test
- **Issue:** The plan's acceptance criteria asked for "a test asserts `copy-pc-btn` still renders... for a draft service with credentials configured." Task 1's own diagnosis (and re-verification against the live template) confirmed the button pair is gated purely on `authStore.hasPcCredentials` — with credentials configured, Export to PC renders regardless of service status; Copy for PC never renders in that state. The phrase appears to describe the export button's stale in-template comment ("shown when NO credentials OR service is draft"), not the actual `v-if`/`v-else`, which has no status condition at all.
- **Fix:** Wrote the regression test against the verified, actual behavior instead: Copy for PC renders and is clickable for a draft service with **no** credentials configured (the case it has always served, unaffected by this plan's note, which lives entirely in the `v-else` branch's sibling markup). Did not touch the export/copy buttons' gate to make the literal plan phrasing true — that would have been an unauthorized behavior change to logic this plan was explicitly told not to touch.
- **Files modified:** `src/views/__tests__/ServiceEditorView.test.ts`
- **Verification:** The written test passes against real, unmodified button behavior; `export-pc-btn`/`copy-pc-btn` gating is provably unchanged (same `v-if="authStore.hasPcCredentials"` as before, `grep -c` unchanged).
- **Committed in:** `c822272` (Task 3 commit)

---

**Total deviations:** 1 (a plan-text/verified-code mismatch, resolved by trusting the verified code and Task 1's own diagnosis over an imprecise acceptance-criterion phrasing).
**Impact on plan:** No scope creep, no behavior change beyond what the plan authorized. The export/copy button pair's gate is byte-identical to before this plan.

## Issues Encountered

None beyond the one item documented above.

## User Setup Required

None — no external service configuration required. One owner-run verification step is deferred to `PENDING-VERIFICATION.md` via 34-08 Task 2 (not this plan): open the Firebase console for the organization's document and confirm whether `pcAppId`/`pcSecret` fields exist and are non-empty, reporting presence/absence only.

## Next Phase Readiness

- **The record is corrected.** Owner UAT finding F5 is documented as a misdiagnosis in both `34-UAT.md` (pre-existing) and now `ROADMAP.md`'s planning-corrections note — Export to PC was never removed, it is credential-gated, and the gate is proven to behave correctly.
- **R071 exists and is unimplemented-but-delivered** — its traceability row reads `Pending`, matching the convention that only 34-08's phase gate flips statuses to `Complete`.
- **34-08** (the phase gate, still incomplete per `init.execute-phase`) will need to fold this plan's verdict and the D5 owner-run check into `PENDING-VERIFICATION.md` and mark R071 complete once the phase gate runs.
- No credential value appears anywhere in this plan's commits, tests, or this SUMMARY — verified by `grep -cE "console\.(log|info|warn|error|debug)"` (0 in both touched source files, unchanged in `ServiceEditorView.vue`) and a manual scan of `git log -p` across this plan's three commits.
- Full-suite regression check (`npx vitest run --dir src`): 2410 passing, 9 failing — all 9 match the documented pre-existing baseline (`src/storage.rules.test.ts` needs the Storage emulator; `src/views/__tests__/RosterView.test.ts` has a stale assertion). Zero new failures introduced by this plan.
- `npm run type-check` (`vue-tsc --build`) exits 0.
- No blockers.

---
*Phase: 34-smarter-content-llm-scripture-split*
*Completed: 2026-08-03*

## Self-Check: PASSED

All 5 modified files verified present on disk; all 3 task commits (`3fd90bc`, `c4c4a76`, `c822272`) verified present in git log.
</content>
