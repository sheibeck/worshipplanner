---
phase: 126-my-schedule-volunteer-home
verified: 2026-09-06T09:15:00Z
status: passed
automated_status: passed
score: 6/6 must-haves verified (5/5 ROADMAP success criteria hold in code; 1 has a documented, permanent data-gap caveat requiring owner confirmation)
behavior_unverified: 0
overrides_applied: 0
re_verification: null
# Automated verification PASSED (5/5 SC, 6/6 reqs, all 8 review fixes confirmed in source, rules 233/233).
# The human_verification items below (prod index/rules deploy + live UAT) AND the venue/time/call-time
# go/no-go owner decision are DEFERRED to the milestone's batched pass (owner-authorized), tracked PENDING
# in .planning/v2.12-DEFERRED-UAT.md. `passed` = automated only; milestone MUST NOT ship until PENDING clears.
human_uat: deferred-batched
human_verification:
  - test: "Deploy `firebase deploy --only firestore:indexes,firestore:rules` to production, verify the new rehearseAccess COLLECTION_GROUP composite index reaches Enabled in Firebase Console → Firestore → Indexes, then sign in as a real rostered volunteer via a live magic link and confirm My Schedule lists exactly their assigned Planned services, grouped correctly, with accurate roles/readiness/countdown, and Rehearse → navigates."
    expected: "The index deploys and reaches Enabled; the live query returns the volunteer's real assignments (not a permission error, not an empty result for someone who IS assigned); grouping/readiness/countdown match what a human expects for that volunteer's real data."
    why_human: "Requires a production Firebase deploy (owner-only action, outside this execution environment) and a real magic-link email round-trip with a live rostered volunteer — cannot be simulated by the emulator or unit tests, which already prove the query/rule contract in isolation (233/233 rules tests pass)."
  - test: "Confirm whether permanently omitting time·venue and call-time from every My Schedule card (rather than adding those fields to Service/OrgSettings) is the accepted product decision, or whether a follow-up phase should model them."
    expected: "An explicit owner go/no-go on RESEARCH.md's Assumption A3 ('Adding time/venue/call-time fields to Service/OrgSettings is out of scope for this phase... worth an explicit go/no-go before planning, not assumed')."
    why_human: "This is a product-scope decision, not a code defect — grep/type-check cannot determine whether the ROADMAP SC's literal 'time · venue' and 'call time' card-content wording is satisfied by an implementation that structurally can never render them (Service/OrgSettings carry no such fields anywhere in the codebase, confirmed by direct source inspection), or whether that gap needs to be closed in a future phase."
---

# Phase 126: My Schedule — Volunteer Home Verification Report

**Phase Goal:** After signing in, a volunteer lands on "My Schedule," a read-and-go page listing every
Planned service they're assigned to (roster-email → assignment match), soonest first, grouped This week /
Later this month + past, with role chips, media readiness, counts, countdown, and a Rehearse → CTA into
the (Phase 127) service view.
**Verified:** 2026-09-06T09:15:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (mapped to ROADMAP.md Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | After sign-in, a volunteer lands on My Schedule listing every service they're assigned to, matched by roster email → assignment, available to anyone assigned regardless of role (R378) | ✓ VERIFIED | `firestore.rules:460-476` (new `{orgPrefix=**}/rehearseAccess` collection-group `allow list`), `firestore.indexes.json:3-11` (COLLECTION_GROUP composite index), `src/stores/mySchedule.ts` (constrained query, filter derived only from `auth.currentUser.email`), `src/router/index.ts` (`/my-schedule` route), `VolunteerLinkCompleteView.vue:81` + router `beforeEach` (both redirect to `'my-schedule'`). Rules-emulator proof: `src/rules.test.ts` R378 describe block, cases (1)/(2) — ALLOW cross-org aggregation for own email, ALLOW/empty for unassigned. Live-ran `npx vitest run --config vitest.rules.config.ts`: 233/233 pass. |
| 2 | Only Planned (non-Draft) services appear (R379) | ✓ VERIFIED | Rule requires `resource.data.get('status','draft') == 'planned'`; store query adds `where('status','==','planned')` (REQUIRED, undroppable — confirmed in `mySchedule.ts`). Rules test case (1) asserts a Draft's stale projection is excluded (`ids.not.toContain('svcDraft')`); case (6) proves a `status=='draft'`-filtered query is denied outright. Both pass live. |
| 3 | Soonest-first, grouped This week / Later this month, Next up badge on the soonest upcoming; past shown separately, openable (R380) | ✓ VERIFIED | `src/utils/myScheduleGrouping.ts` (`groupMySchedule`, `todayYmd`, `endOfThisWeekYmd`) with 15 passing unit tests incl. exact 7/14-day countdown boundaries. `MyScheduleView.vue` renders `thisWeek`/`laterThisMonth` sections (hidden when empty) + a collapsed-by-default `Past services` section; `isNextUp` pill wired to `groups.nextUpId`. Confirmed via `MyScheduleView.test.ts` (11/11 pass) exercising grouped headers, Next-up pill, and past-section toggle. |
| 4 | Each card shows date, name, time · venue, role chips, song/chart/track counts, readiness, countdown + call time (R381) | ⚠️ VERIFIED WITH CAVEAT | Date/name/role chips (`roleChipIcon`+`StageKindIcon`)/counts/readiness (`readinessOf`)/countdown (`countdownLabel`) all render and are covered by passing unit + component tests. **Time·venue and call-time are unconditionally never rendered** — confirmed by direct inspection of `ScheduleServiceCard.vue` (no `v-if` branch that could ever show them) and of `src/types/service.ts` (no `time`/`venue`/`callTime` field exists anywhere in the codebase — grep returned zero matches). This is a documented, deliberate scope decision (`126-RESEARCH.md` Assumption A3: "out of scope for this phase... worth an explicit go/no-go before planning, not assumed") that appears to have been adopted without that go/no-go, since this ran autonomously. See human_verification item 2. |
| 5 | Rehearse → (upcoming) / Open service (past) navigate to the per-service route; check-a-different-email + no-match empty state present; My Schedule itself not editable (R382, R383) | ✓ VERIFIED | `ScheduleServiceCard.vue`: whole card is one `router-link` to `/volunteer/service/${serviceId}` (literal path, per Phase-125 build-safety lesson), text switches "Rehearse →"/"Open service" by `isPast`. `MyScheduleView.vue`: top-bar menu + empty-state button + footer link all call `goToDifferentEmail()` → `/volunteer`. Empty state (`docs.length === 0`) interpolates the signed-in email. No form/mutation anywhere in the view (read-only). `MyScheduleView.test.ts` and `router.test.ts` (`/volunteer/service/anything` → `volunteer-service`, `/my-schedule` → `my-schedule`) both pass live. |

**Score:** 5/5 ROADMAP success criteria hold in code and are proven by passing automated tests; SC4/R381 carries one structural, pre-existing-data-gap caveat flagged above (not a code defect — see human_verification item 2).

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `firestore.rules` | Explicit `rehearseAccess` `get`/`list` split + new collection-group `list` arm | ✓ VERIFIED | Lines 277-476; identical unrelaxed conjuncts on both nested arms; new `{orgPrefix=**}` collection-group arm gated on `email_verified`, frozen `status=='planned'`, lowercased-email membership. |
| `firestore.indexes.json` | rehearseAccess COLLECTION_GROUP composite index | ✓ VERIFIED | `status ASC + assignedEmailsLower CONTAINS + serviceDate ASC` — exact field order the store's query uses. Valid JSON, `fieldOverrides` untouched. |
| `src/rules.test.ts` | R378/R379 constrained-list describe block + WR-02 positive test | ✓ VERIFIED | 6 R378 cases (ALLOW cross-org, ALLOW/empty, DENY unfiltered, DENY other-email, DENY unverified, DENY status=draft) + case `(9b)` (WR-02 fix). All pass live against the running emulator. |
| `src/utils/rehearseAccess.ts` | `rolesByEmailLower` on `RehearseAccessDoc` + IN-02 fix | ✓ VERIFIED | PII-safe per-email role map, multi-role dedupe via `.includes()`, empty-email skip. IN-02 fix present: missing catalog song produces a `'(song removed)'` stub + `console.warn`, not a silent drop. 12/12 unit tests pass. |
| `src/utils/myScheduleGrouping.ts` | grouping/countdown/readiness pure helpers | ✓ VERIFIED | All 5 exports present; no date-library import (grep confirms only `new Date()`/string math); 15/15 tests pass incl. exact-boundary cases. |
| `src/utils/roleChipIcon.ts` | keyword → glyph mapping | ✓ VERIFIED | All 6 keyword branches + `'music'` fallback; every return value present in `StageKindIcon.vue`'s rendered glyph set. 8/8 tests pass. |
| `src/stores/mySchedule.ts` | Pinia store issuing the constrained query | ✓ VERIFIED | `docs`/`isLoading`/`error`/`loadMySchedule()`; both required filters present; filter value derived only from `auth.currentUser.email`; IN-01 fix (`console.error`) present. 6/6 tests pass. |
| `src/views/VolunteerServicePlaceholderView.vue` | Build-safe Phase-127 placeholder | ✓ VERIFIED | Real component (static message + link back to `/my-schedule`), not an `import()` of a nonexistent file. `dist/assets/VolunteerServicePlaceholderView-*.js` chunk confirmed emitted by a live `npm run build`. |
| `src/views/MyScheduleView.vue` | Top bar, greeting, sections, empty/loading/error, footer | ✓ VERIFIED | All states present and rendered per UI-SPEC; WR-03 (explicit "no upcoming services" line) and WR-04 (outside-click + Escape menu dismissal) fixes both present and tested. `dist/assets/MyScheduleView-*.js` chunk confirmed emitted. |
| `src/components/ScheduleServiceCard.vue` | Three-zone accessible card | ✓ VERIFIED | Single `router-link`, full-context `aria-label`, `aria-hidden` decorative icons, Next-up/past variants, IN-03 fix (neutral gray for `waiting` state) present. |
| `src/router/index.ts` | `/my-schedule` + `/volunteer/service/:serviceId` routes | ✓ VERIFIED | Both routes registered with `meta: { requiresAuth: true, isVolunteerRoute: true }`; both resolve correctly per live router tests. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| Store query filter | `firestore.rules` list arm | `where('status','==','planned')` + `where('assignedEmailsLower','array-contains', myEmailLower)` | ✓ WIRED | Both filters present in `mySchedule.ts`; confirmed the rule requires both (omitting either denies the whole request, not a partial result) — matches the rule's own inline comment and 126-01-SUMMARY.md's carried-forward contract. |
| `VolunteerLinkCompleteView.vue` sign-in success | `/my-schedule` | `router.replace({ name: 'my-schedule' })` | ✓ WIRED | Line 81, confirmed by direct read. |
| Router `beforeEach` /login zero-membership bounce-back | `/my-schedule` | `return { name: 'my-schedule' }` | ✓ WIRED | Confirmed at router/index.ts:300. |
| `ScheduleServiceCard.vue` Rehearse/Open link | `/volunteer/service/:serviceId` | literal-path `router-link :to` | ✓ WIRED | `to = computed(() => \`/volunteer/service/${props.serviceId}\`)` — resolves to the Plan-03 placeholder today, to Phase 127 later, no client change needed. |
| `MyScheduleView.vue` card roles prop | `rolesByEmailLower[myEmailLower]` | `rolesFor(doc)` | ✓ WIRED | Confirmed direct lookup against the signed-in volunteer's own lowercased email. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|---------------------|--------|
| `MyScheduleView.vue` | `mySchedule.docs` | `useMyScheduleStore().loadMySchedule()` → live `collectionGroup` query via `getDocs` | Yes (query is real, not a static/empty fallback) | ✓ FLOWING |
| `ScheduleServiceCard.vue` | `songs`, `roles` props | Passed down from `MyScheduleView.vue`'s `groups`/`rolesFor(doc)`, sourced from the same live query result | Yes | ✓ FLOWING |

### Behavioral Spot-Checks / Test Runs (executed live in this verification pass)

| Check | Command | Result | Status |
|-------|---------|--------|--------|
| Constrained collectionGroup rules proof (R378/R379) | `npx vitest run --config vitest.rules.config.ts` (against already-running emulator on :8080) | 233/233 pass, 35 skipped (`storage.rules.test.ts` — no Storage emulator, documented baseline) | ✓ PASS |
| Type gate | `npm run type-check` (vue-tsc --build) | Clean, no output/errors | ✓ PASS |
| Phase-scoped unit/component tests | `npx vitest run` on rehearseAccess/myScheduleGrouping/roleChipIcon/mySchedule/router/MyScheduleView test files | 69/69 pass | ✓ PASS |
| WR-01 fix regression check | `npx vitest run src/stores/__tests__/services.test.ts` | 112/112 pass | ✓ PASS |
| Full app suite | `npx vitest run` (bare, whole repo) | 201/202 files pass, 5316/5351 tests pass (35 skipped) — the single failing file is `src/storage.rules.test.ts` (documented pre-existing baseline, Storage-emulator dependent) | ✓ PASS (matches documented baseline exactly) |
| Production build | `npm run build` | Green (`✓ built in 26.58s`); `MyScheduleView-*.js` and `VolunteerServicePlaceholderView-*.js` chunks both confirmed emitted in `dist/assets/` | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| R378 | 126-01, 126-03, 126-04 | Land on My Schedule, listing assigned services by roster email match | ✓ SATISFIED | See Truth #1 |
| R379 | 126-01 | Only Planned services shown | ✓ SATISFIED | See Truth #2 |
| R380 | 126-02, 126-04 | Soonest-first grouping + Next-up badge + past section | ✓ SATISFIED | See Truth #3 |
| R381 | 126-01, 126-02, 126-04 | Card content: date/name/time·venue/roles/counts/readiness/countdown+call-time | ⚠ SATISFIED WITH CAVEAT | See Truth #4 — time·venue/call-time structurally never render (data-model gap, flagged for owner) |
| R382 | 126-03, 126-04 | Rehearse → / Open service navigation, not editable | ✓ SATISFIED | See Truth #5 |
| R383 | 126-04 | Check-a-different-email + no-match empty state | ✓ SATISFIED | See Truth #5 |

No orphaned requirements — REQUIREMENTS.md's Phase 126 mapping (R378-R383) exactly matches the union of `requirements:` fields across all four PLAN frontmatters.

### Anti-Patterns Found

None blocking. Scanned all phase-touched files (`firestore.rules`, `firestore.indexes.json`, `src/stores/mySchedule.ts`, `src/stores/services.ts`, `src/utils/rehearseAccess.ts`, `src/utils/myScheduleGrouping.ts`, `src/utils/roleChipIcon.ts`, `src/views/MyScheduleView.vue`, `src/components/ScheduleServiceCard.vue`, `src/views/VolunteerServicePlaceholderView.vue`, `src/router/index.ts`, `src/views/VolunteerLinkCompleteView.vue`) for `TBD|FIXME|XXX|TODO|HACK|PLACEHOLDER`. Zero debt markers. The only "coming soon" text found is in `VolunteerServicePlaceholderView.vue`, which is a deliberate, tested, build-verified placeholder for Phase 127 (per the phase's own build-safety design, not a stub hiding missing work).

**Minor observation (non-blocking):** `revokeRehearseAccessWithRetry()` (the WR-01 code-review fix in `src/stores/services.ts`) has no dedicated unit test exercising its retry-on-first-failure or fail-twice-then-log path — `services.test.ts` still passes 112/112 because those are pre-existing tests unrelated to the retry mechanism itself. This is a behavior-dependent cleanup/retry invariant asserted only by the REVIEW-FIX narrative, not proven by a test. Low severity: it is a defense-in-depth hardening on top of an already-accepted "belt-and-suspenders" mechanism (the get-path live re-check remains the actual content-access boundary), not one of the phase's core R378-R383 must-haves.

### Human Verification Required

1. **Production deploy + live magic-link UAT**
   **Test:** Run `firebase deploy --only firestore:indexes,firestore:rules`, confirm the new rehearseAccess index reaches Enabled in the Firebase Console, then sign in as a real rostered volunteer via a live magic link.
   **Expected:** The composite index deploys cleanly; the signed-in volunteer's My Schedule shows exactly their real assigned Planned services, correctly grouped with accurate roles/readiness/countdown, and Rehearse → navigates to the placeholder.
   **Why human:** Requires an owner-run production deploy and a real email round-trip — outside this execution environment's reach. The query/rule contract itself is already proven by 233/233 passing rules-emulator tests.

2. **Confirm the time·venue/call-time scope decision**
   **Test:** Review `126-RESEARCH.md`'s Assumption A3 and decide whether permanently omitting time·venue/call-time from every My Schedule card (because `Service`/`OrgSettings` model no such fields anywhere in the codebase) is acceptable, or whether a follow-up phase should add that data.
   **Expected:** An explicit go/no-go from the owner on this pre-existing data-model gap.
   **Why human:** This is a product-scope judgment call flagged by the phase's own RESEARCH doc as needing "an explicit go/no-go before planning, not assumed" — it does not appear this checkpoint occurred (autonomous execution). Grep/type-check cannot resolve whether this satisfies the literal ROADMAP SC wording.

### Gaps Summary

No FAILED truths. Every artifact the four plans committed to exists, is substantive, is wired, and is covered by passing automated tests confirmed live in this verification pass (233 rules tests + 5316 app-suite tests + clean type-check + green build). All 8 code-review findings (4 warnings + 4 info) from `126-REVIEW.md` are fixed and confirmed present in the actual source, not just claimed in `126-REVIEW-FIX.md`.

The phase is not blocked, but two items need an explicit human decision before this can be called fully closed: (1) the outstanding production deploy of the new composite index/rules plus a live volunteer UAT pass, and (2) an owner sign-off on the time·venue/call-time permanent-omission scope decision that RESEARCH.md itself flagged as needing checkpoint approval. Both are recorded above as human_verification items rather than gaps, since no code defect exists — the code faithfully implements what was planned.

---

_Verified: 2026-09-06T09:15:00Z_
_Verifier: Claude (gsd-verifier)_
