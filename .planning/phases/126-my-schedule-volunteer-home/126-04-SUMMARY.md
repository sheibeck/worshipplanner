---
phase: 126-my-schedule-volunteer-home
plan: 04
subsystem: ui
tags: [vue, vue-router, pinia, vitest, volunteer, dark-theme]

# Dependency graph
requires:
  - phase: 126-02
    provides: "groupMySchedule/countdownLabel/readinessOf/roleChipIcon pure helpers"
  - phase: 126-03
    provides: "useMyScheduleStore (docs/isLoading/error/loadMySchedule) and the /volunteer/service/:serviceId placeholder route"
provides:
  - "src/components/ScheduleServiceCard.vue — the three-zone service card (upcoming + past variants, single-link, accessible)"
  - "src/views/MyScheduleView.vue — the volunteer's post-sign-in landing (top bar, greeting, grouped sections, empty/loading/error states, footer note)"
  - "/my-schedule route registered against MyScheduleView.vue"
  - "VolunteerLinkCompleteView + the /login zero-membership bounce-back now land on 'my-schedule'"
affects: ["Phase 127 (Rehearse standalone view reuses the top-bar shell + is the real target the card links to)"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Whole-card-is-one-router-link with a context-carrying aria-label, decorative icons aria-hidden — UI-SPEC's explicit departure from ServiceCard.vue's footer-buttons-outside-the-link convention"
    - "Mobile reflow via duplicate sm:hidden / hidden sm:flex blocks for the date zone, rather than JS-driven layout switching"
    - "Time·venue/call-time fields are never rendered (not merely conditionally hidden) — the data model carries no such fields this phase"

key-files:
  created:
    - src/components/ScheduleServiceCard.vue
    - src/views/MyScheduleView.vue
    - src/views/__tests__/MyScheduleView.test.ts
  modified:
    - src/router/index.ts
    - src/views/VolunteerLinkCompleteView.vue
    - src/router/__tests__/router.test.ts

key-decisions:
  - "Song/chart/track counts use the real SongAttachmentKind values ('document'/'audio'), not the UI-SPEC's literal 'pdf'/'mp3' strings — mirrors the same Rule 1 correction 126-02-SUMMARY.md already made for readinessOf, applied here to chartCount/trackCount for the identical reason (the literal strings never match a real attachment)."
  - "countdownLabel (126-02) is reused unmodified for both upcoming and past cards — its existing past-relative branches ('Yesterday'/'N days ago'/'Last week'/'N weeks ago') already satisfy the UI-SPEC §5 'countdown becomes a past-relative label' requirement with no new code."
  - "Time·venue and call-time are omitted unconditionally (never even conditionally rendered) since Service/RehearseAccessDoc carry no such fields yet — satisfies the UI-SPEC's graceful-omission contract by construction, not by a runtime check."

requirements-completed: [R378, R380, R381, R382, R383]

coverage:
  - id: D1
    description: "ScheduleServiceCard.vue renders the three-zone anatomy (date block, role chips via roleChipIcon+StageKindIcon, song/chart/track counts, readiness, countdown, Rehearse/Open CTA) as a single accessible router-link"
    requirement: R381
    verification:
      - kind: unit
        ref: "src/views/__tests__/MyScheduleView.test.ts#populated state > renders grouped section headers, the Next up pill on the soonest card, and Rehearse links to /volunteer/service/:serviceId"
        status: pass
      - kind: other
        ref: "npm run type-check"
        status: pass
    human_judgment: false
  - id: D2
    description: "MyScheduleView groups docs into This week/Later this month/Past services (sections hidden when empty), with the Next up pill on the single soonest card"
    requirement: R380
    verification:
      - kind: unit
        ref: "src/views/__tests__/MyScheduleView.test.ts#populated state (2 tests: grouped headers + Next-up pill, past-section toggle)"
        status: pass
    human_judgment: false
  - id: D3
    description: "/my-schedule route registered against MyScheduleView.vue, authored in the same commit; VolunteerLinkCompleteView's success redirect and the router's /login zero-membership bounce-back both target 'my-schedule'"
    requirement: R378
    verification:
      - kind: unit
        ref: "src/router/__tests__/router.test.ts#/my-schedule route (R378/R380/R383, 126-04) > resolves /my-schedule to the my-schedule route"
        status: pass
      - kind: other
        ref: "npm run build (MyScheduleView-*.js chunk emitted, exit 0)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Rehearse -> (upcoming) and Open service (past) navigate to /volunteer/service/:serviceId by literal path"
    requirement: R382
    verification:
      - kind: unit
        ref: "src/views/__tests__/MyScheduleView.test.ts (Rehearse href assertion + Open-service href assertion in the past-toggle test)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Empty state renders with the signed-in email interpolated and a Check-a-different-email action (top-bar menu + empty-state button + footer link), replacing greeting/summary/sections"
    requirement: R383
    verification:
      - kind: unit
        ref: "src/views/__tests__/MyScheduleView.test.ts#empty state > renders the empty state with the signed-in email interpolated and a Check a different email control"
        status: pass
    human_judgment: false
  - id: D6
    description: "Greeting uses first-name-only extraction (never displayLabel's 'Dana R.'), loading/error states render per Copywriting Contract, and the roster-built footer note renders in the populated state"
    requirement: R381
    verification:
      - kind: unit
        ref: "src/views/__tests__/MyScheduleView.test.ts (greeting test, loading test, error+Retry test, footer-note test)"
        status: pass
    human_judgment: false
  - id: D7
    description: "Manual, real-magic-link sign-in verification against a live rostered volunteer (per 126-VALIDATION.md) — visual/UX fidelity to the mock, live Firestore query behavior end-to-end"
    verification: []
    human_judgment: true
    rationale: "Requires a deployed COLLECTION_GROUP index/rules (126-01's outstanding owner action) and a real magic-link sign-in flow — outside this execution environment's reach; the code-level contract is fully proven by the unit/component tests above."

duration: ~30min
completed: 2026-09-06
status: complete
---

# Phase 126 Plan 04: My Schedule View + Service Card + Route + Tests Summary

**MyScheduleView.vue + ScheduleServiceCard.vue render a volunteer's grouped assigned Planned services with role chips, readiness, and countdown; `/my-schedule` is now the post-sign-in landing, replacing `/volunteer` (volunteer-home)**

## Performance

- **Duration:** ~30 min
- **Started:** 2026-09-06T07:48:00Z (approx.)
- **Completed:** 2026-09-06T08:04:00Z
- **Tasks:** 3/3
- **Files modified:** 6 (5 new, 3 modified — VolunteerLinkCompleteView and router/index.ts modified, router test extended)

## Accomplishments
- `src/components/ScheduleServiceCard.vue`: the three-zone card (date block / middle / right) as a single `router-link` to `/volunteer/service/:serviceId`, with a full-context `aria-label` and `aria-hidden` decorative icons. Renders role chips (`roleChipIcon` + `StageKindIcon`), the readiness line (`readinessOf`), the countdown (`countdownLabel`), and song/chart/track counts. Next-up accent variant (border/ring/pill/outlined CTA) and past variant (dimmed title, "Open service" CTA) both implemented. Time·venue/call-time are never rendered — Service/RehearseAccessDoc carry no such fields yet.
- `src/views/MyScheduleView.vue`: top bar with a user-chip menu (`role="menu"`, "Check a different email" + "Sign out"), a first-name-only greeting (`Good {time-of-day}, {firstName}`, never the "Dana R." form), a pluralizing summary line, `This week`/`Later this month`/`Past services` sections (rendered only when non-empty, past collapsed by default), the §8 empty state, §10 loading state, an error+Retry state, and the §9 footer roster-built note.
- `/my-schedule` registered against `MyScheduleView.vue` in the same commit that authors the view (build-safety); `VolunteerLinkCompleteView.vue`'s post-sign-in redirect and the router's `/login` zero-membership bounce-back both now target `'my-schedule'` instead of `'volunteer-home'`.
- 25 new tests (8 component + 1 new router test, alongside 16 already-passing router tests) covering empty/populated/loading/error states, the Next-up pill, Rehearse/Open link targets, the first-name greeting, and `/my-schedule` route resolution.
- Full verification: `npm run type-check` clean, `npm run build` green (`MyScheduleView-*.js` chunk emitted), `npx vitest run src/views/__tests__/MyScheduleView.test.ts src/router/__tests__/router.test.ts` (25/25 pass), full app suite `npx vitest run` (5312 passed, 35 skipped, only the documented `src/storage.rules.test.ts` baseline failure — no regressions).

## Task Commits

Each task was committed atomically:

1. **Task 1: ScheduleServiceCard.vue — the three-zone service card** - `7444c21e` (feat)
2. **Task 2: MyScheduleView.vue + /my-schedule route + land on My Schedule** - `1be54401` (feat)
3. **Task 3: Component + router tests for My Schedule** - `cb30dfb2` (test)

**Plan metadata:** (this commit, following SUMMARY.md write)

## Files Created/Modified
- `src/components/ScheduleServiceCard.vue` (NEW) - three-zone accessible service card, upcoming + past variants.
- `src/views/MyScheduleView.vue` (NEW) - the My Schedule landing view (top bar, greeting, sections, states, footer).
- `src/router/index.ts` - added `/my-schedule` route; the `/login` zero-membership bounce-back now targets `'my-schedule'`.
- `src/views/VolunteerLinkCompleteView.vue` - post-sign-in redirect now targets `'my-schedule'`.
- `src/views/__tests__/MyScheduleView.test.ts` (NEW) - 8 component tests.
- `src/router/__tests__/router.test.ts` - added the `/my-schedule` route to the test harness + a resolution test.

## Decisions Made
- Reused `countdownLabel` (126-02) unmodified for both upcoming and past cards — its past-relative branches already satisfy the UI-SPEC §5 "countdown becomes a past-relative label" requirement, so no new past-specific countdown logic was needed.
- Applied the same Rule-1 attachment-kind correction 126-02-SUMMARY.md made for `readinessOf` (`'document'`/`'audio'`, not the plan's literal `'pdf'`/`'mp3'`) to this plan's own chart/track count derivation in `ScheduleServiceCard.vue` — see Deviations.
- Time·venue and call-time are omitted unconditionally in the template (no `v-if` branch that could ever render them) rather than conditionally hidden, since the underlying fields don't exist on `RehearseAccessDoc`/`Service` yet — simpler and can't regress into rendering a placeholder by accident.
- `/volunteer` (`volunteer-home`) is left registered and unchanged — it still serves the not-yet-signed-in guidance and the "check a different email" re-entry flow that My Schedule's top-bar menu and empty state link to.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Chart/track counts used the plan's literal 'pdf'/'mp3' kind strings, which don't exist in the real type**
- **Found during:** Task 1 (ScheduleServiceCard.vue implementation)
- **Issue:** The plan's `<action>` and the UI-SPEC's Data Dependencies section both specify counting `attachments.filter(a => a.kind === 'pdf')` (charts) and `'mp3'` (tracks). `SongAttachmentKind` (`src/types/song.ts`) is actually `'document' | 'audio' | 'link'` — already identified and fixed for `readinessOf` in 126-02-SUMMARY.md. Using the literal `'pdf'`/`'mp3'` strings here would always report 0 charts and 0 tracks regardless of real uploads.
- **Fix:** `chartCount`/`trackCount` check `a.kind === 'document'` / `a.kind === 'audio'` respectively, mirroring 126-02's established correction, with an inline comment cross-referencing it.
- **Files modified:** `src/components/ScheduleServiceCard.vue`
- **Verification:** Component test fixtures use `kind: 'document'`; `npm run type-check` confirms `'document'`/`'audio'` are valid `SongAttachmentKind` values (the literal `'pdf'`/`'mp3'` would have failed type-check outright, since `RehearseAttachment.kind` is typed as `SongAttachmentKind`).
- **Committed in:** `7444c21e` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Necessary for correctness — without this fix every card would permanently show "0 of N charts · 0 tracks" regardless of real attachments. Contained to the two count-derivation computeds; no scope creep.

## Issues Encountered
One test-authoring issue (not a deviation from the plan's shipped code): an initial greeting assertion used a `\b` word-boundary regex against `wrapper.text()`'s space-free concatenation (`...DanaYou're assigned...`), which never matches between two word characters. Fixed by asserting against `wrapper.get('h1').text()` directly instead of the full-page text blob. Test-file-only; no production code affected.

## User Setup Required
None new this plan. The 126-01 COLLECTION_GROUP index/rules deploy requirement (already documented in `126-01-SUMMARY.md` and carried forward through `126-03-SUMMARY.md`) remains the only outstanding external-service action for My Schedule to serve real data in production — this plan's view/card/route are otherwise fully client-side/emulator-independent to verify.

## Next Phase Readiness
- Phase 127 (the standalone Rehearse view) can now replace `VolunteerServicePlaceholderView.vue` at the stable `/volunteer/service/:serviceId` route (path/name/meta unchanged per 126-03's contract) without touching My Schedule.
- My Schedule is feature-complete for R378/R380/R381/R382/R383 at the code level; the only remaining verification is the manual, real-magic-link/live-Firestore pass documented in `126-VALIDATION.md` (D7 above), which depends on the 126-01 index/rules deploy.
- No blockers.

---
*Phase: 126-my-schedule-volunteer-home*
*Completed: 2026-09-06*

## Self-Check: PASSED

- FOUND: src/components/ScheduleServiceCard.vue
- FOUND: src/views/MyScheduleView.vue
- FOUND: src/views/__tests__/MyScheduleView.test.ts
- FOUND: src/router/index.ts (modified)
- FOUND: src/views/VolunteerLinkCompleteView.vue (modified)
- FOUND: src/router/__tests__/router.test.ts (modified)
- FOUND commit: 7444c21e
- FOUND commit: 1be54401
- FOUND commit: cb30dfb2
