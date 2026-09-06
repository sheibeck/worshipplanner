---
phase: 127-volunteer-service-view-rehearse-order-of-service-stage-layout
verified: 2026-09-06T12:36:41Z
status: passed
automated_status: passed
score: 10/10 must-haves verified
behavior_unverified: 0
overrides_applied: 0
# Automated verification PASSED 10/10 (R384–R393). human_verification items below (real-device PDF/audio +
# mobile reflow; cross-browser native PDF page-nav) are DEFERRED to the batched pass (owner-authorized),
# tracked PENDING in .planning/v2.12-DEFERRED-UAT.md. The magic-link-delivery gap + the member "My Schedule"
# nav entry are being FIXED as a milestone follow-up (see v2.12-DEFERRED-UAT.md). `passed` = automated only.
human_uat: deferred-batched
human_verification:
  - test: "End-to-end: on a phone and on desktop, open a real magic-link volunteer session, tap a service on My Schedule, and use Rehearse — view/print a real PDF chart, play a real MP3 with speed change and loop, open an external link."
    expected: "PDF opens/prints correctly (desktop inline iframe with native page nav; mobile link-first Open/Download), MP3 plays and responds to 1x/0.9x/0.75x/1.25x speed and Loop, external links open in a new tab, and the drill-down (list→detail→reader) plus the persistent bottom player behave correctly on a real small viewport."
    why_human: "Native browser PDF viewer rendering/pagination, native <audio> playback, and small-viewport touch/reflow behavior cannot be exercised in jsdom; the phase's own PLAN verification sections mark this Manual-Only (127-VALIDATION.md)."
  - test: "Confirm the native browser PDF viewer's page-navigation controls (Page X of Y, prev/next) actually render and work identically across the churches' target browsers (Chrome, Safari/iOS, Edge)."
    expected: "Every target browser's built-in PDF viewer inside the <iframe> exposes usable page navigation; none silently falls back to a scroll-only view with no page indicator."
    why_human: "Native/OS-level PDF viewer chrome varies by browser and cannot be probed from an automated test; flagged during planning as a cross-browser risk (127-RESEARCH.md)."
  - test: "Confirm a rostered volunteer can actually receive and use the {{rehearse_link}} magic-link token in a real email."
    expected: "A volunteer gets an email (reminder, share, or auto-lock notification) containing a working sign-in link that lands them on My Schedule."
    why_human: "Cross-phase integration gap identified below (not an R384–R393 defect) — needs an owner decision on which template(s) should carry the token before this can be tested end-to-end."
---

# Phase 127: Volunteer Service View — Rehearse, Order of Service & Stage Layout Verification Report

**Phase Goal:** From a My Schedule service card, a volunteer reaches a standalone, read-only service view (not the planner editor) with Rehearse (song list, detail, PDF reader, audio player with speed/loop, external links) + read-only Order of Service + Stage Layout tabs, reliably on mobile.
**Verified:** 2026-09-06T12:36:41Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Opening a service from My Schedule reaches a standalone, read-only view — NOT `ServiceEditorView` — with Rehearse/Order of Service/Stage Layout tabs, Rehearse default (R384) | VERIFIED | `ScheduleServiceCard.vue:101` links `to=/volunteer/service/${serviceId}`; `src/router/index.ts:191-192` resolves that route to `VolunteerServiceView.vue` (path/name/meta unchanged); the Phase 126 placeholder file is deleted (`ls` confirms not found); `VolunteerServiceView.vue` never imports `ServiceEditorView` (grep confirms zero references); tablist defaults `activeTab='rehearse'`; 18/18 `VolunteerServiceView.test.ts` cases pass including tab default + click/arrow-key switching |
| 2 | Rehearse tab lists songs with key/PDF count/MP3 count/now-playing indicator, selectable (R385) | VERIFIED | `RehearseSongList.vue` implemented per spec; 6/6 unit tests pass (row/header counts, key rendering, PDF/MP3 counts incl. zero, `aria-current`, `select` event, `● Playing` conditional, empty-list copy) |
| 3 | Song detail lists PDFs (Print+Download), Recordings (Play+Download), optional note omitted gracefully (R386) | VERIFIED | `RehearseSongDetail.vue`; 10/10 unit tests pass (grouping, Print/Download/Play actions, cross-origin-safe fetch→blob download pattern verbatim from `SongFilesTab.vue`, graceful meta-line omission) |
| 4 | PDF reader shows page nav via native browser viewer + Print, no pdf.js/custom paginator (R387) | VERIFIED | `RehearseFileReader.vue` mounts `<iframe :src=downloadUrl tabindex=-1>`, no pdf.js/pdfjs-dist import (`package.json` diff empty across all task commits), Print via `window.open(...,'noopener,noreferrer')`; 10/10 unit tests pass including the Pitfall-3 reset-on-attachment-change case |
| 5 | Audio player: play/pause, seekable progress, elapsed/total time (R388) | VERIFIED | `RehearseAudioPlayerBar.vue` mounts exactly one native `<audio class=sr-only>`; 10/10 unit tests pass (single-element invariant, track replacement, play/pause+aria-label, seek/time formatting) |
| 6 | Whole-track speed (1/0.9/0.75/1.25×) + Loop toggle (R389) | VERIFIED | Same component; SPEEDS array `[1, 0.9, 0.75, 1.25]` cycles `audioEl.playbackRate`; Loop toggle sets `audioEl.loop` + `aria-pressed`; covered by the same 10/10 passing test file |
| 7 | External media links open in a new tab, no in-app embed (R390) | VERIFIED | `RehearseSongDetail.vue` renders `<a target=_blank rel="noopener noreferrer">` with `LINK_SOURCE_LABELS`; covered by `RehearseSongDetail.test.ts` |
| 8 | Order of Service tab shows the read-only running order, reusing existing read-only render (R392) | VERIFIED | `VolunteerOrderOfService.vue` re-themes `ShareView.vue`'s per-kind slot branching field-for-field (dark tokens); fed from the Plan-01-extended `orderOfService`/`roleAssignments` projection built via the SAME shared `serviceProjection.ts` allowlist `buildServiceSnapshot` uses; 10/10 unit tests pass, including a fixture that tries to smuggle a stray notes/body field and asserts it is NOT rendered |
| 9 | Stage Layout tab shows the v2.7 read-only stage diagram (R393) | VERIFIED | `VolunteerStageLayoutTab.vue` embeds `StageLayoutView.vue` verbatim (`theme="dark" :print="false"`), zero marker-position remapping (v2.7 WYSIWYG-bug avoidance); `StageLayoutView.vue`/`ShareView.vue` are both unmodified (git diff confirms); 4/4 unit tests pass |
| 10 | Mobile-friendly: PDFs link-first on phones, audio plays on mobile, whole flow reflows (R391) | VERIFIED | `RehearseFileReader.vue`'s `mobileLinkFirst` branch renders no iframe (Open PDF + Download buttons instead); `VolunteerServiceView.vue` renders a `sm:hidden` drill-down (`mobileScreen` state machine: list→detail→reader) and a `hidden sm:flex` 3-column desktop layout, with exactly ONE `RehearseAudioPlayerBar` instance rendered OUTSIDE both conditional branches so playback survives screen/tab navigation — confirmed by dedicated test cases in `VolunteerServiceView.test.ts` |

**Score:** 10/10 truths verified (0 present, behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/utils/serviceProjection.ts` | Shared PII-safe allowlist helper used by both projection builders | VERIFIED | Exists; `mapOrderedSlots`/`mapStageMarkers`/`resolvePersonName` exported and imported by both `rehearseAccess.ts` and `services.ts` |
| `src/utils/rehearseAccess.ts` | Extended `RehearseAccessDoc` (orderOfService/roleAssignments/stageLayout/bpm/linkSource) | VERIFIED | All fields present; 19/19 unit tests pass including no-PII-leak assertions |
| `src/stores/services.ts` | `buildServiceSnapshot` refactored to reuse shared helper, byte-identical output | VERIFIED | `services.test.ts` (132), `services.stageLayout.test.ts` (9), `services.sharePii.test.ts` (5) all pass unchanged |
| `src/composables/useVolunteerServiceDoc.ts` | orgId-from-store resolution + live get-arm re-fetch + 4-state machine | VERIFIED | File exists; 9/9 unit tests pass; WR-02 fix confirmed live (`MaybeRefOrGetter<string>` + `watch(toValue(serviceId))`) |
| `src/components/rehearse/RehearseSongList.vue` | Selectable song list | VERIFIED | Exists, wired, tested (6/6) |
| `src/components/rehearse/RehearseSongDetail.vue` | Song detail with Print/Download/Play/links | VERIFIED | Exists, wired, tested (10/10) |
| `src/components/rehearse/RehearseFileReader.vue` | Native iframe reader + mobile link-first | VERIFIED | Exists, wired, tested (10/10, incl. WR-01 button-not-anchor fix) |
| `src/components/rehearse/RehearseAudioPlayerBar.vue` | Single persistent native audio player | VERIFIED | Exists, wired, tested (10/10) |
| `src/components/rehearse/VolunteerOrderOfService.vue` | Read-only order-of-service tab | VERIFIED | Exists, wired, tested (10/10) |
| `src/components/rehearse/VolunteerStageLayoutTab.vue` | Read-only stage layout tab | VERIFIED | Exists, wired, tested (4/4) |
| `src/views/VolunteerServiceView.vue` | Standalone tri-tab shell | VERIFIED | Exists, wired to router, tested (18/18) |
| `src/router/index.ts` | `/volunteer/service/:serviceId` → `VolunteerServiceView` | VERIFIED | Confirmed via grep; path/name('volunteer-service')/meta unchanged; `router.test.ts` 17/17 pass |
| `src/views/VolunteerServicePlaceholderView.vue` | Deleted | VERIFIED | File confirmed absent (`ls` returns "No such file or directory") |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `buildRehearseAccess` | shared allowlist (`serviceProjection.ts`) | `mapOrderedSlots`/`mapStageMarkers`/`resolvePersonName` imports | WIRED | Confirmed by grep in `rehearseAccess.ts` and `services.ts` — same functions imported by both |
| `markAsPlanned` write | `organizations/{orgId}/rehearseAccess/{serviceId}` | `{ ...rehearseAccess, ... }` spread | WIRED | Plan 01 Task 2; R377 emulator suite (12/12) confirmed green against the extended doc with zero `firestore.rules` change |
| `ScheduleServiceCard` | `VolunteerServiceView` | router `to="/volunteer/service/:id"` | WIRED | `ScheduleServiceCard.vue:101` computed `to`; router resolves to the real view (placeholder gone) |
| `useVolunteerServiceDoc` | `mySchedule.docs[].orgId` | store lookup, never a route param | WIRED | Confirmed in composable source; unit test explicitly asserts orgId sourced from the matched store doc |
| `RehearseSongList @select` | `RehearseSongDetail`/`RehearseFileReader` | shared `selectedSong`/`selectedAttachment` refs in `VolunteerServiceView.vue` | WIRED | Confirmed by grep of the view's template (lines 162-219) and by `VolunteerServiceView.test.ts` wiring assertions |
| `RehearseSongDetail @play` | `RehearseAudioPlayerBar :track` | shared `activeTrack` ref, single player instance | WIRED | Confirmed — exactly one `<RehearseAudioPlayerBar>` mount site outside both mobile/desktop branches |
| `doc.orderOfService/.roleAssignments/.stageLayout` | `VolunteerOrderOfService`/`VolunteerStageLayoutTab` | direct prop bindings | WIRED | `VolunteerServiceView.vue:214,219` |

### Data-Flow Trace (Level 4)

The whole view is fed by a single `getDoc` (`useVolunteerServiceDoc`) against a real Firestore projection (`rehearseAccess/{serviceId}`), not a static/hardcoded value. `RehearseSong[]`, `orderOfService`, `roleAssignments`, and `stageLayout.elements` all trace to `buildRehearseAccess()` in `rehearseAccess.ts`, which derives every field from the service's actual slots/assignments/markers via the shared `serviceProjection.ts` allowlist (no static `[]`/`{}` fallback except the correct empty-state representations). Attachment `downloadUrl`s are real v2.11 Storage download-token URLs, not placeholders.

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|---------------------|--------|
| `VolunteerServiceView.vue` | `doc` (RehearseAccessDoc) | `useVolunteerServiceDoc` → `getDoc(organizations/{orgId}/rehearseAccess/{serviceId})` | Yes | FLOWING |
| `RehearseSongList.vue` | `songs` prop | `doc.value?.songs` computed in the view | Yes | FLOWING |
| `VolunteerOrderOfService.vue` | `orderOfService`/`roleAssignments` props | `doc.orderOfService`/`doc.roleAssignments` (built at lock-time from real service slots) | Yes | FLOWING |
| `VolunteerStageLayoutTab.vue` | `elements` prop | `doc.stageLayout?.elements` (real v2.7 stage markers, PII-stripped) | Yes | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Type-check across the whole project (src + test files) | `npm run type-check` | Clean, 0 errors | PASS |
| Production build succeeds, `VolunteerServiceView` code-split, no placeholder reference | `npm run build` | Succeeded; `dist/assets/VolunteerServiceView-*.js` emitted; only the pre-existing >500kB chunk-size advisory | PASS |
| All phase-127-specific unit/integration test files | `npx vitest run src/components/rehearse src/composables/__tests__/useVolunteerServiceDoc.test.ts src/views/__tests__/VolunteerServiceView.test.ts src/utils/rehearseAccess.test.ts src/router/__tests__/router.test.ts` | 10 files, 113/113 tests passed | PASS |
| Full app test suite (regression check, run once) | `npx vitest run` | 209/210 files, 5402/5436 tests passed — the ONE failing file is `src/storage.rules.test.ts` (2 timeouts against a live Storage emulator), the pre-existing documented baseline per CLAUDE.md (unrelated to this phase; no rules files touched) | PASS (matches documented baseline exactly, no new failures) |
| Real MP3/PDF playback + mobile device reflow | — | Not runnable in this environment | SKIP → routed to human verification |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|--------------|--------|----------|
| R384 | 127-05, 127-06 | Standalone read-only volunteer service view, not the editor, tri-tab (Rehearse default) | SATISFIED | `VolunteerServiceView.vue` + router swap + placeholder deletion; 18/18 view tests |
| R385 | 127-01, 127-02 | Rehearse tab song list with key/PDF/MP3 counts + now-playing | SATISFIED | `RehearseSongList.vue`; 6/6 tests |
| R386 | 127-01, 127-02 | Song detail: Sheet music & chords (Print/Download), Recordings, optional note | SATISFIED | `RehearseSongDetail.vue`; 10/10 tests |
| R387 | 127-03 | PDF reader with page nav + Print | SATISFIED | `RehearseFileReader.vue`; 10/10 tests (incl. WR-01 fix) |
| R388 | 127-03 | Audio player: play/pause, seek, elapsed/total | SATISFIED | `RehearseAudioPlayerBar.vue`; 10/10 tests |
| R389 | 127-03 | Speed (1/0.9/0.75/1.25×) + whole-track Loop | SATISFIED | Same component/tests |
| R390 | 127-02 | External links open in new tab | SATISFIED | `RehearseSongDetail.vue`; covered by tests |
| R391 | 127-03, 127-06 | Mobile-friendly: link-first PDF, native audio, reflow | SATISFIED | `RehearseFileReader.vue` mobileLinkFirst + `VolunteerServiceView.vue` drill-down; tests + real device behavior deferred to human verification |
| R392 | 127-01, 127-04 | Order of Service tab, read-only | SATISFIED | `VolunteerOrderOfService.vue`; 10/10 tests |
| R393 | 127-01, 127-04 | Stage Layout tab, read-only | SATISFIED | `VolunteerStageLayoutTab.vue`; 4/4 tests |

No orphaned requirements: REQUIREMENTS.md's traceability table lists exactly R384-R393 for Phase 127, and all ten IDs appear in at least one plan's `requirements:` frontmatter (cross-checked both directions).

### Anti-Patterns Found

None. Scanned all 11 phase-127 source files for `TBD|FIXME|XXX|TODO|HACK|PLACEHOLDER`, "coming soon"/"not yet implemented", and hollow-render patterns (`return null|{}|[]`, hardcoded empty props). Zero hits beyond benign prose (comments referencing the `(removed)` display placeholder and the deleted `VolunteerServicePlaceholderView` file name, which are not stubs). `127-VALIDATION.md`'s `TBD` entries are pre-existing planning-template markers in the "Per-Task Verification Map" table, not code — they don't gate a code phase's debt-marker check.

### Code Review Fixes — Confirmed Present in Code (not just claimed in REVIEW-FIX.md)

| Finding | Fix | Verified |
|---------|-----|----------|
| WR-01 (Download can navigate the whole SPA away on a cross-origin Storage URL) | Error-fallback anchor replaced with a `<button @click="downloadAttachment">` (fetch→blob→objectURL) | CONFIRMED — `RehearseFileReader.vue:55-57` uses `data-testid="rehearse-reader-error-download"` button wired to `downloadAttachment` |
| WR-02 (non-reactive `serviceId` causes stale data across two rehearse links) | `serviceId` is a `computed()`; composable accepts `MaybeRefOrGetter<string>` and watches it | CONFIRMED — `VolunteerServiceView.vue:258` `computed(...)`; `useVolunteerServiceDoc.ts:80` `watch(() => toValue(serviceId), ...)` |
| WR-04 (`personNames` falls back to raw internal `personId` for a deleted person) | Shared `resolvePersonName()` → `'(removed)'` | CONFIRMED — `serviceProjection.ts:146,154`; both `rehearseAccess.ts:214` and `services.ts:162` call it |
| IN-01 (`ccliNumber` prop is dead code) | Prop and clause removed | CONFIRMED — `RehearseSongDetail.vue` no longer declares `ccliNumber`; comment at line 183 documents why |
| WR-03 (whole-doc email/role exposure to co-scheduled volunteers) | Accepted residual, no code change (explicit owner scope decision, pre-existing since Phase 125/126) | Confirmed unchanged; not a regression introduced by this phase |
| IN-02 (`buildServiceSnapshot`'s public payload silently grows an unread `bpm` field) | No-op by design (non-sensitive, forward-compatible) | Confirmed unchanged; not a security/correctness issue |

### Cross-Phase Gaps Surfaced (NOT phase-127 blockers)

**1. Magic-link delivery gap (against R375, owned by a follow-up, not R384–R393).** The `{{rehearse_link}}` token exists and is fully functional server-side (`functions/src/messageTokens.ts` renders it; `functions/src/index.ts:2198-2202` mints a fresh per-recipient `generateSignInWithEmailLink` and threads it into the token context for every queued send — reminder, share, and scheduled-reminder-cron paths all go through the same `sendQueuedMessage` renderer). **However, no default template references it**: `MessageComposer.vue`'s `tokenChips` palette (lines 371-375) offers `service_date` / `service_link` / `their_roles` / `name` but NOT `rehearse_link`, and the built-in Reminder (`Hi {{name}} — a reminder you're scheduled to serve on {{service_date}}. Here's the plan: {{service_link}}`) and Service-plan/share (`{{service_link}}`) default templates never mention `{{rehearse_link}}` either. A volunteer therefore currently has no way to receive their magic sign-in link unless an org admin manually hand-types the raw token into a custom message body — a real, currently-live delivery gap this phase's UI cannot fix (it lives entirely in the messaging templates/composer, outside phase 127's file set). This blocks the whole R384-R393 volunteer flow from ever being reached organically in production today, even though every R384-R393 truth verifies correctly in isolation.

**2. No in-app "My Schedule" nav entry for signed-in org members.** Grep across `src/components` and `src/views` for the literal nav text "My Schedule" only turns up `VolunteerServiceView.vue`'s own "‹ My Schedule" back-link — there is no entry point in the app's regular navigation (sidebar/top bar) for an already-signed-in member to reach `/my-schedule` on their own; it's reachable only via the magic-link redirect (which, per Gap 1 above, is not currently delivered) or by a bookmarked/typed URL. Not an R384-R393 defect (My Schedule is Phase 126 scope), but worth surfacing since it compounds Gap 1's reachability problem for anyone who already has an app account.

## Human Verification Required

### 1. End-to-end real-device UAT

**Test:** On a phone and on desktop, complete a real magic-link volunteer flow: sign in, tap a service card, use Rehearse — view/print a real PDF chart, play a real MP3 with speed change and loop, open an external link; check the Order of Service and Stage Layout tabs.
**Expected:** PDF opens/prints correctly (desktop inline iframe with working native page nav; mobile link-first Open/Download); MP3 plays and responds to all four speeds and Loop; external links open in a new tab; the mobile drill-down (list→detail→reader) and the single persistent bottom player behave correctly on a real small viewport.
**Why human:** Native browser PDF-viewer rendering, native `<audio>` playback, print dialogs, and small-viewport touch/reflow cannot be exercised in jsdom. This is the phase's own documented Manual-Only item (127-VALIDATION.md).

### 2. Cross-browser native PDF page-navigation confirmation

**Test:** Open a rehearse chart PDF in the Rehearse tab's desktop iframe reader on Chrome, Safari/iOS, and Edge; confirm the native "Page X of Y, prev/next" controls the browser's own PDF viewer supplies actually render and work.
**Expected:** Every target browser exposes usable page navigation inside the iframe; none silently degrades to a scroll-only view with no page indicator (R387's acceptance criterion depends on the OS/browser viewer, which this phase deliberately does not re-implement).
**Why human:** Native/OS PDF viewer chrome differs by browser and cannot be probed by an automated test; flagged as a risk during planning (127-RESEARCH.md).

### 3. Magic-link delivery gap — owner decision needed

**Test:** Confirm whether a rostered volunteer can currently receive a working `{{rehearse_link}}` in any real-world email (reminder, share, or scheduled reminder).
**Expected:** A decision on whether/how to add `rehearse_link` to a default template and the composer's token palette (a follow-up fix, not a re-open of Phase 127).
**Why human:** This is a cross-phase gap (see "Cross-Phase Gaps Surfaced" above) that needs an owner decision on scope/priority, not a code defect this phase's R384-R393 own.

## Gaps Summary

No gaps against this phase's own must-haves. All 10 observable truths (R384-R393) verify against real, wired, tested code — not stubs. All 4 code-review findings selected for fixing (WR-01, WR-02, WR-04, IN-01) are confirmed present in the actual source, not just claimed in REVIEW-FIX.md. `npm run type-check`, `npm run build`, and the full `npx vitest run` suite all pass with zero new failures beyond the pre-existing, documented `storage.rules.test.ts` baseline.

The phase is marked `human_needed` rather than `passed` for two reasons: (1) the phase's own PLAN.md verification sections explicitly defer real-device PDF/audio/mobile-reflow UAT as Manual-Only, and (2) this verification surfaces a real, currently-live cross-phase integration gap (the magic-link token has no delivery path in any default template) that means the R384-R393 volunteer experience — while fully correct in isolation — cannot yet be reached organically by a real volunteer in production. Neither item is a defect in phase 127's own code; both require a human decision/action outside this phase's scope.

---

*Verified: 2026-09-06T12:36:41Z*
*Verifier: Claude (gsd-verifier)*
