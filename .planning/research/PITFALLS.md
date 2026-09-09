# Pitfalls Research

**Domain:** Adding Vamps live audio, rehearsal/report times, service-link emails, and a church-picker
fix to the shipped WorshipPlanner Vue 3 + Firebase app (v2.15)
**Researched:** 2026-09-09
**Confidence:** HIGH (every pitfall below is grounded in the actual v2.14 source — file/line citations
included — not generic advice)

## Critical Pitfalls

### Pitfall 1: Vamp audio silently fails on the live output because `interactive="false"` strips the ONLY existing recovery affordance

**What goes wrong:**
`AudioPlayer.vue` already has correct autoplay-rejection handling: `play()` catches
`NotAllowedError` and emits `autoplay-blocked`, and `SlideCanvas.vue` renders a "Tap to play audio"
button on that event (`presentation-audio-affordance`, SlideCanvas.vue:279-287). But that button is
gated `v-if="audioBlocked && props.interactive"` — and every live output window renders `SlideCanvas`
with **`:interactive="false"`** (`FullscreenSlideOutput.vue:36`, `FullscreenSlideOutput.vue:62`,
`ConfidenceOutputView.vue:40`, `ConfidenceOutputView.vue:72`). So on the one surface where a vamp
actually needs to play — the unattended Audience/Confidence/Video output window — the existing
tap-to-retry UI is deliberately suppressed by design (Phase 90's own comment: "so a non-interactive
preview... shows none of them"). If the browser's autoplay policy blocks the vamp's `play()` call in
that window, the MP3 **never plays and nothing on screen indicates why** — there's no button, no
error text, nothing. The operator running the service has no way to know from the projector/monitor
itself that the vamp failed.

**Why it happens:** The `interactive` gate was written for *video/audio-on-a-slide* as a general
mechanism, at a time when the outputs mostly showed lyrics/scripture with occasional background
video — a failed autoplay was a minor cosmetic loss. Vamps invert that: the MP3 **is** the slide's
entire purpose. Reusing the mechanism as-is (as PROJECT.md's "reuses the already-shipped… audioUrl +
AudioPlayer" framing implies) silently inherits a UX gap that was tolerable for background video but
is not tolerable for a feature whose entire job is "make sound happen at this exact moment."

**How to avoid:**
- **Arm audio with a real user gesture on the Run/control screen before any output window opens.**
  Add a one-time "Enable Audio" (or fold into an existing "Go fullscreen"/preflight click) affordance
  on `RunControlView`/`RunPreflightPanel` that, on click, plays and immediately pauses/mutes a
  throwaway `<audio>` element **in the control window's own document**. This does not itself unlock
  the *separate* output windows (autoplay permission is per-document, not per-tab-group), but it is
  the natural place to also fire the delegated-gesture pattern the codebase already uses for
  fullscreen (`wp-fullscreen-delegate` postMessage, `useOutputWindow.ts:100-113`) — extend that same
  channel with a `wp-audio-unlock` message that each output window's `onMounted` listens for and uses
  to do its own `document.documentElement`-scoped or first-`<audio>`-element `play()+pause()` primed
  by the delegated activation, mirroring the exact precedent `handleDelegationMessage` sets for
  `requestFullscreen()`.
- **Propagate failure back to the control screen.** Extend `FullscreenSlideOutput.vue`'s existing
  `onAudioAutoplayBlocked`/SlideCanvas `autoplay-blocked` event with a `window.opener?.postMessage`
  call parallel to `reportFullscreenState()` (`useOutputWindow.ts:80-89`) — e.g.
  `{ type: 'wp-audio-blocked', role }`. Surface it as a visible warning banner on
  `RunControlView`/`RunDisplaysPanel` (the codebase already has a dismissible-notification store from
  v2.7 for exactly this class of thing). **Without this, a blocked vamp is invisible until the
  congregation notices silence.**
- **Test on real hardware, not just jsdom.** The existing `AudioPlayer.test.ts`/`SlideCanvas.test.ts`
  mock `HTMLMediaElement.play()`, which never exercises Chrome's actual autoplay heuristic (Media
  Engagement Index, per-origin, accumulated from real interaction). The reason today's video/audio
  slides "mostly work" in production is almost certainly that the operator's browser profile already
  has a high MEI score for the app's origin from ordinary daily use — **a fresh browser profile, a new
  booth laptop, an Edge/Chrome update that resets engagement data, or an incognito/guest profile will
  behave differently.** Explicitly UAT this on the real multi-monitor Chrome setup described in
  `docs/run-fullscreen-setup.md`, on a machine that has *not* been used for other WorshipPlanner
  browsing that session.

**Warning signs:** the vamp is silent in Run mode but audible when previewed inside the (interactive)
service editor; no error surfaces anywhere; works during development (long-lived profile, lots of
interaction) but not on a freshly imaged/kiosk machine.

**Phase to address:** the Vamps live-playback phase itself (not deferred) — this is not an edge case,
it is the headline risk PROJECT.md already flags ("Verify audible output under browser autoplay policy
in the non-interactive Run outputs"). Build the arm-gesture + propagate-failure plumbing in the same
phase that wires vamp→slide assignment, and require a real-hardware UAT pass (not just unit tests)
before calling it done.

---

### Pitfall 2: The SAME vamp plays from THREE independent output windows at once — an audible echo, not a design choice

**What goes wrong:** `AudienceOutputView` → `FullscreenSlideOutput` → `SlideCanvas`,
`ConfidenceOutputView` → `SlideCanvas` directly, and `VideoOutputView` → `FullscreenSlideOutput` →
`SlideCanvas` are **three separate popup windows, each mounting its own `SlideCanvas` instance, each
independently calling `.play()` on the same `currentSlide.slide.audioUrl`** (confirmed at
`FullscreenSlideOutput.vue:225-229`, `ConfidenceOutputView.vue:190-194`, and `SlideCanvas.vue:495-497`
`playCurrentMedia()` — there is no existing "only one output owns audio" concept anywhere in this
code). All three windows typically run on the **same physical machine** (one booth laptop driving
Audience/Confidence/Video via separate external displays) and HTML `<audio>` elements have no
per-window audio-routing — they all go to the OS's single default output device. The result: **the
same MP3 starts three times, a few hundred milliseconds apart** (each window's own font-gate/
BroadcastChannel race), audibly phasing/echoing over the same speakers. Today this is latent — video
slides are rare and background audio is presumably rare too — vamps make it load-bearing, because a
vamp's entire purpose is to be heard.

**Why it happens:** `audioUrl`/`AudioPlayer` were built as "whatever this slide carries plays wherever
this slide renders" (Phase 24's `D-04` framing) — a reasonable default when the only degraded-fidelity
concern was the *confidence monitor's background image*, which is explicitly suppressed
(`suppressBackground` on `ConfidenceOutputView.vue:39,71`), but nobody suppressed *audio* on that same
monitor. Nobody needed to before, because no feature made audio matter until now.

**How to avoid:**
- **Decide, explicitly, which output(s) own audio for a vamp** before implementing — this is a product
  decision, not just an engineering one, likely: Audience only (the congregation should hear it, the
  band already hears the room), with Confidence and Video suppressed via the same `suppressBackground`-
  style mechanism (e.g., a `suppressAudio` prop on `SlideCanvas`, threaded exactly like
  `suppressBackground` already is on `ConfidenceOutputView.vue:39,71`).
- Symmetrically, decide whether **Video** output (feeding OBS/vMix per v2.14) should carry vamp audio
  at all — a software compositor may want the *video room's own* sound feed, not a duplicate copy from
  the browser; muting audio there is the safer default until an owner decision says otherwise.
- Add this to the same UAT pass as Pitfall 1 — echo is only audible with real speakers on real
  hardware; unit tests mocking `play()` will never catch it.

**Warning signs:** vamp audio sounds "flangey"/echoey/robotic when Audience + Confidence (or Video)
monitors are both configured on one machine; sounds fine when only one output role is active.

**Phase to address:** same Vamps live-playback phase as Pitfall 1 — this is a direct consequence of
the same reuse decision and must be scoped alongside it, not discovered in UAT.

---

### Pitfall 3: A vamp's denormalized `audioUrl` on a slide goes stale when the vamp is re-uploaded or deleted

**What goes wrong:** Per PROJECT.md, a vamp is "assigned to a slide" by copying its data onto the
slide the same way a Song's slide content is materialized — meaning the slide will carry a
**denormalized copy** of the vamp's Storage `downloadUrl` (the same `getDownloadURL()`-with-embedded-
token pattern `useSongFileUpload.ts:192-199` already uses for song files). Firebase Storage download
tokens don't expire on a timer, but they **do change** whenever the underlying object is replaced
(re-uploading a vamp's MP3 to fix a bad take mints a new token/URL), and the object **disappears
entirely** if the vamp is deleted. Any slide that copied the old URL keeps pointing at a dead or
superseded file — the vamp silently fails to play (or plays the wrong file, if some other object now
occupies a similar-looking path) in every service that had already assigned it, with no error until
someone runs the service live.

**Why it happens:** Song attachments (v2.11) accepted this exact tradeoff for PDFs/MP3s viewed
on-demand from a Files tab — "removing it removes it everywhere, past services included" is the
documented, deliberate behavior there. Vamps are different: they are pre-assigned to a *specific
slide* well before the service runs, so staleness has a much longer window to go unnoticed (a vamp
edited on Tuesday silently breaks a slide assignment made three weeks ago for a service that hasn't
run yet).

**How to avoid:**
- Store a **reference (vamp id), not just the resolved URL,** on the slide, and re-resolve the URL at
  slide-assembly/materialize time (mirroring `slideGroupMaterializer.ts`'s existing pattern for
  resolving a song's current data onto its slides) rather than freezing the URL at assignment time.
  If a live-URL-only field is unavoidable for a specific consumer (e.g. a frozen public projection),
  re-resolve on every edit that touches the vamp, exactly as `buildServiceSnapshot`/
  `buildRehearseAccess` already re-project on other field changes.
- On vamp delete, treat it like the song-attachment precedent: either block deletion while it's
  assigned to any *upcoming, not-yet-run* service, or proactively null out/flag the assignment on
  every affected slide (a Cloud Function or client-side sweep) so the gap is visible in the editor
  before Run night, not discovered live.
- Reuse `mediaFailed`/`onMediaError` (`SlideCanvas.vue:541-543`) as the safety net either way — a 404
  on the audio element must degrade to "Media unavailable" text, never a console error or a stuck
  loading state, matching the existing two-week-retention-cleanup precedent this handler already
  covers.

**Warning signs:** a vamp that plays fine when first assigned goes silent weeks later with no code
change to the service itself; the only change was editing/deleting the vamp record.

**Phase to address:** the Vamps data-model/assignment phase — decide reference-vs-frozen-URL before
building the assignment UI, since it changes the slide schema.

---

### Pitfall 4: Vamp MP3s inherit the `firestore.exists()`-in-Storage-emulator blind spot — a broken editor gate can ship untested

**What goes wrong:** PROJECT.md's own scope explicitly plans to reuse "the shipped v2.11 storage
pattern (…, editor-gated `storage.rules`)" for vamp MP3s. The existing `song-files/` rule
(`storage.rules:76-137`) gates on `firestore.exists()` against the org's `members` doc, and per
CLAUDE.md this **is inert in the Storage emulator** — `src/storage.rules.test.ts` already carries 2
permanently-failing allow-cases for exactly this reason, previously mislabeled "not a defect" until a
real prod outage proved the rule was denying everyone. Copy-pasting the same rule shape for a new
`orgs/{orgId}/vamp-files/{...}` (or similar) prefix inherits the identical local-test blind spot: the
emulator will happily report "PASS" on deny-cases while the allow-cases silently fail for the same
structural reason, and there is **no local signal that the new rule is correct** — only production
traffic (or a manual `gcloud`/console check) would reveal it.

**Why it happens:** The rule-writing pattern is a natural, reasonable copy from `song-files/` — the
bug is not in the copy, it's in trusting the local rules-test suite as evidence the copy works.

**How to avoid:**
- Write the vamp storage rule as a **structural near-duplicate** of the `song-files/` block (same
  editor-tier gate, same org-scoping) so it inherits the *known-good production behavior* (the
  Cloud IAM `Firebase Rules Firestore Service Agent` grant that made `song-files/` actually work in
  prod), not just the same source text.
- Do **not** treat a green `npx vitest run --config vitest.rules.config.ts` as proof the vamp upload
  path works — explicitly flag the vamp allow-cases as "expected local failure, verify live" in the
  test file itself (as `storage.rules.test.ts` now does), and confirm the actual upload in a real
  deployed environment (or against the Berean prod org in a controlled test) before considering the
  phase done.
- If this rule ships to prod for the first time (a *new* prefix, like the original `song-files/`
  first-deploy did), expect the same `storage/unauthorized` failure mode observed 2026-08-05 and be
  ready to re-verify the IAM grant applies (it's project-wide, not per-prefix, so it likely already
  covers a new prefix — but confirm rather than assume).

**Warning signs:** local `npm run test:rules` shows the vamp allow-cases failing (expected, not a
regression, per the corrected 2026-08-06 lesson) but a *real* upload from a real editor account also
fails in a deployed environment (that IS a defect, unlike the local-only failure).

**Phase to address:** the Vamps storage/rules phase — write the rules test with the two expected-local-
failure allow-cases explicitly annotated from day one (don't repeat the "explained away as an
environment quirk" mistake); verify the real upload in a deployed/staging pass before ship.

---

### Pitfall 5: Rehearsal/report times computed or compared in the browser's local timezone instead of the org's IANA `timezone`

**What goes wrong:** `Service.date` is a bare `date: string` (`src/types/service.ts:221`, `YYYY-MM-DD`,
no time, no zone) and `OrgSettings.timezone` is a separate IANA string field defaulting to
`'America/Chicago'` (`src/types/organization.ts:98-101,177`). Adding rehearsal/report **times** means
combining a date string with a time string and rendering/comparing it correctly. The classic failure:
constructing `new Date('2026-09-13T18:30')` and letting the JS runtime interpret it in **the browser's
own local timezone** (which is whatever timezone the volunteer's or projectionist's device is set to —
not necessarily the church's timezone) rather than explicitly parsing/formatting against
`org.timezone`. A report time entered as "6:30 PM" by the planner (who is in the church's own
timezone) can render as a different wall-clock time to a volunteer traveling, or on a misconfigured
device — or, more subtly, a date+time near midnight can roll to the **wrong calendar day** entirely
when combined with an implicit UTC/local interpretation mismatch.

**Why it happens:** The codebase has never needed to reason about a specific time-of-day before —
`date` has been purely a calendar string used for display/sorting, so there is no existing "combine
date+time+timezone correctly" utility to reuse. This is greenfield in this codebase, which is exactly
when timezone bugs get introduced.

**How to avoid:**
- Store and treat every rehearsal/report time as **local wall-clock time in the org's own timezone**,
  never as a UTC `Timestamp` derived via `new Date()`'s local-timezone assumption. Store the date and
  time as **separate plain strings** (`date: 'YYYY-MM-DD'`, `time: 'HH:mm'`), exactly like the
  existing `Service.date` convention, rather than a single `Date`/`Timestamp` value — this sidesteps
  the whole implicit-timezone-conversion class of bug because there is never an implicit conversion.
- When *displaying* "in 3 days" / relative countdowns (My Schedule already has this per v2.12's
  "countdown + call time"), do the date-math using `org.timezone` explicitly (e.g. via `Intl` APIs
  with an explicit `timeZone` option), never the bare device-local `Date` object.
- Add a unit test that asserts a report time renders identically regardless of the *testing machine's*
  system timezone (CI runners are commonly UTC while local dev machines are not — a real, easy way to
  catch this class of bug before it reaches a volunteer's phone).

**Warning signs:** a report/rehearsal time looks correct in local dev but is off by several hours in
CI or on a colleague's machine; a time near midnight sometimes shows the wrong date.

**Phase to address:** the Rehearsal/report-times data-model phase — decide the storage shape
(plain date+time strings, not a Timestamp) before any UI or projection work builds on top of it.

---

### Pitfall 6: Multiple dated rehearsals rendered/sorted in storage order instead of chronological order

**What goes wrong:** The feature explicitly allows **multiple dated rehearsals** per service, each
with its own date+time, stored as an array. Firestore array fields have no inherent guaranteed order
beyond "whatever order they were written in" — if the UI appends a new rehearsal to the end on add,
and an editor later inserts one "in between" two existing rehearsals (a common real edit: "oh, we need
one more session before that one"), the array's storage order no longer matches chronological order.
Every consumer that renders the list (org settings defaults, per-service editor, dashboard, My
Schedule, share view) must independently re-sort — and if even one consumer forgets, that surface
shows rehearsals out of order, which for a schedule feature is a genuinely confusing bug (a volunteer
sees "Rehearsal 2" listed before "Rehearsal 1" and shows up to the wrong one, or misses the first one
entirely because it visually reads as "already happened").

**Why it happens:** It's easy to write the sort once at the point of *creation* (or in the primary
editor) and forget every *other* read site needs the same sort — this codebase's precedent
(`orderSlotsBySection` in `slotTypes.ts`, used by both `buildServiceSnapshot` and
`buildRehearseAccess` per `rehearseAccess.ts:13`) already shows the pattern of "one shared sort
function, called everywhere" being the fix for exactly this class of drift.

**How to avoid:**
- Write **one shared, pure sort function** (e.g. `sortRehearsals(rehearsals): Rehearsal[]`, sorting by
  `date` then `time` ascending) in `utils/`, and have every render site — org settings defaults list,
  service editor, dashboard, My Schedule, share/rehearse projections — call it, never rely on array
  storage order.
- Never assume "the last item is the most recent" or "the first item is the next upcoming one" without
  running that sort first, including in the report-time/rehearsal-times-shown-everywhere-the-date-
  shows requirement.

**Warning signs:** rehearsals display out of order after an editor inserts one between two existing
ones (not just appends to the end) — this won't show up if testing only ever appends.

**Phase to address:** the Rehearsal/report-times data-model phase — define the shared sort utility
alongside the array shape itself, then every UI phase built after just calls it.

---

### Pitfall 7: Changing the org-level rehearsal/report-time defaults retroactively (or invisibly) changes existing services

**What goes wrong:** PROJECT.md specifies org-settings **defaults** that "pre-fill" a new service's
rehearsal/report fields. Two distinct failure modes here, both plausible given this codebase's
`updateOrgSettings(patch)` merge-write pattern (`src/stores/services.ts`'s `createService` and
`src/stores/auth.ts:420` `updateOrgSettings`):
1. **Retroactive mutation** — if a service's rehearsal times are ever implemented as a *live read* of
   the org default (rather than a value copied onto the service at creation time), changing the org
   default later silently changes the displayed times on every *existing* service that hadn't
   explicitly overridden it — including services that are already Planned/locked and have already
   been emailed to volunteers.
2. **Invisible pre-fill** — the inverse bug: a *new* service created after an org-default change
   doesn't actually pick up the new default because some cached/stale settings object was read (this
   codebase's `settings.value = { ...DEFAULT_ORG_SETTINGS }` reset-then-reload pattern at multiple
   auth.ts call sites, e.g. lines 332/657/903, shows settings do get reset/reloaded around org-switch
   boundaries — a service-creation code path that doesn't go through that same freshly-loaded
   `authStore.settings` risks reading a stale copy).

**Why it happens:** "Org defaults pre-fill a per-service field, with per-service override" is a classic
snapshot-vs-live-join ambiguity, and this codebase's existing `OrgSettings` (slide typography,
messaging config, etc.) has generally been a **live-read** settings object by design (it's meant to
apply everywhere going forward) — copying that same mental model onto rehearsal defaults without
noticing they're conceptually different (a *default for new records*, not an *ambient setting*) is an
easy, natural mistake.

**How to avoid:**
- Explicitly **copy** the org defaults into the new service's `rehearsals`/`reportTime` fields at
  `createService` time (or an explicit "reset to org default" action in the per-service editor), never
  read them live from `authStore.settings` at render/display time. This is the same pattern already
  needed to avoid Pitfall 5's timezone drift — do it once, in one place.
- Write a test that changes the org default, then asserts an **already-created** service's stored
  rehearsal/report fields are unchanged.
- Write a test that creates a service **after** an org-default change and asserts the new service picks
  up the *new* default (catches the inverse staleness bug).

**Warning signs:** editing the org's default rehearsal schedule changes the displayed schedule on a
service that was locked and shared weeks ago; or a brand-new service still shows an old default after
the org setting was changed.

**Phase to address:** the Rehearsal/report-times data-model + org-settings phase — this must be
decided and tested before the per-service editor phase builds "pre-fill from org default" on top of
whatever shape gets chosen.

---

### Pitfall 8: New rehearsal/report-time fields never reach `ServiceSnapshot`/`rehearseAccess` — volunteer surfaces show stale or empty times

**What goes wrong:** This codebase has **two independent, allowlist-based, PII-safe public
projections** — `buildServiceSnapshot` (the share-link page) and `buildRehearseAccess`
(the My-Schedule/Rehearse volunteer surface) — that deliberately do **not** spread the full `Service`
document; they hand-pick exactly the fields each consumer needs, via shared helpers in
`src/utils/serviceProjection.ts` (`mapSlotAllowlist`, `mapStageMarkers`, etc., explicitly documented as
existing "so the two PII boundaries can never drift independently"). `RehearseAccessDoc` currently
carries `serviceDate: string` as its only date-shaped field (`rehearseAccess.ts:63`) — there is no
existing rehearsal/report-time field on either projection today. If the new fields are added to the
`Service` type and the per-service editor, but **not** explicitly added to both
`buildServiceSnapshot`'s output shape and `RehearseAccessDoc`/`buildRehearseAccess`, every volunteer-
facing surface this milestone explicitly promises ("dashboard, My Schedule, the volunteer service
view, and the share/plan views") will keep showing the *old* bare date only — the times will exist in
the planner's editor and nowhere else, and there is no compile error or obvious runtime error to catch
it (the allowlist pattern fails silently by omission, that's its whole design).

**Why it happens:** These are **frozen, write-time snapshots**, not live joins (per their own doc
comments — `RehearseAccessDoc` is written once and re-read as-is by a scoped-permission volunteer
client that cannot read the real `Service` doc). It is easy to update the primary `Service`
document/editor and forget the two secondary projection builders even exist, especially since they
live in `src/utils/` (pure, no-Firestore-import files) rather than being obviously wired into whatever
UI PR touches the editor.

**How to avoid:**
- Grep-audit `src/utils/serviceProjection.ts`, `src/stores/services.ts` (`buildServiceSnapshot`), and
  `src/utils/rehearseAccess.ts` (`buildRehearseAccess`/`RehearseAccessDoc`) as a **required checklist
  item** in the same phase that adds the rehearsal/report-time fields to `Service` — add the new
  field(s) to all three call sites together, not sequentially across phases.
- Because both projections are frozen snapshots, also confirm the **re-projection trigger**: whatever
  causes `buildServiceSnapshot`/`buildRehearseAccess` to re-run after a locked/shared service is
  edited (this codebase already has this machinery for other fields — e.g. the R421 "idempotent
  share-link self-heal" and lock/re-lock diff paths) must also fire when only the rehearsal/report
  time changes, or an edit to just the time on an already-shared service silently doesn't propagate.
- Add a test mirroring the existing `services.sharePii.test.ts` pattern that asserts the new time
  field(s) actually appear in both projections' output.

**Warning signs:** the rehearsal time shows correctly in the service editor but is missing/blank on
the public share page or in My Schedule.

**Phase to address:** the phase that threads times "everywhere the date already shows" — make updating
both projection builders an explicit, checked step of that phase, not an assumed side effect of adding
the field to the `Service` type.

---

### Pitfall 9: A service-update email goes out with `{{service_link}}` resolving to an empty string

**What goes wrong:** `resolveServiceLink` (`functions/src/index.ts:1990-2012`) explicitly returns `''`
when no `shareTokens` doc exists for the service yet (the "A1 empty substitution" behavior, tested at
`functions/src/index.test.ts:6024`) — this is intentional, documented behavior, not a bug in the
resolver itself. v2.14 added best-effort **auto-generation** of a share link on service creation
(`src/stores/services.ts:490`, "auto share-link generation failed (non-blocking)"), but that call is
explicitly non-blocking — if it fails, or for any service created **before** v2.14 shipped that never
had "Share Link" manually clicked, `resolveServiceLink` still legitimately returns `''`. If the
milestone's "always link to the plan" wiring simply drops `{{service_link}}` into the update-email
template and trusts it, a real email can go out reading something like `"View the plan: "` with
nothing after the colon — worse than not mentioning a link at all, because it reads as broken.

**Why it happens:** The token substitution behaves correctly by its own contract (empty string, not a
placeholder or a crash) — the gap is at the *call site* that builds the email, which must decide what
"no link exists yet" means for THIS specific promise ("emails always link to the plan").

**How to avoid:**
- Before sending an update/reminder email, actively call the existing `ensureShareLink`-style path (or
  equivalent get-or-create) rather than only reading whatever `resolveServiceLink` already finds —
  make link-existence a precondition of "sending an update email," not an afterthought substitution.
- If link creation can still fail (base URL unconfigured, transient Firestore error), the email-sending
  code should **detect the empty-string case explicitly** and either withhold sending, log/alert, or
  render a template variant without the dangling label — never let `{{service_link}}` blank out
  silently inside sent copy.
- Add a test asserting that the specific update/reminder email flow this milestone wires never sends
  with an empty resolved link for a *newly created* service (covering both the "already has a token"
  and "must mint one first" cases) — the existing `messageTokens.test.ts` proves the token behavior in
  isolation but not this call site's obligation.

**Warning signs:** a volunteer/team member's inbox shows an update email with a dangling "Plan:" or
"View here:" and no URL after it.

**Phase to address:** the service-update-emails phase — wire the ensure-link-exists step as part of
the same change that adds `{{service_link}}` to the update/reminder send path, not as a follow-up fix.

---

### Pitfall 10: Moving the active-org choice to localStorage silently changes the deliberate per-tab isolation, or reintroduces the stale-membership bug it just avoided

**What goes wrong:** The current `sessionStorage`-based mechanism (`src/stores/auth.ts:65-98`) is
explicitly documented as a **deliberate design choice**: "kept in sessionStorage (NOT localStorage) so
it survives a page refresh but a full logout clears it — matching 'log out and back in to switch
churches'." It's also already keyed by uid and already re-validated on every read: the router only
honors the remembered choice if `ids.includes(remembered)` (`src/router/index.ts:527`) — i.e. the
user must *still* be a member of that org, protecting against a stale org id for a membership that was
since revoked. Fixing the new-tab bug by switching the storage layer to `localStorage` **must
preserve every one of those three properties**, and each is easy to drop by accident:
1. **Losing the `ids.includes(remembered)` re-validation** — if the localStorage-restore code path is
   written fresh instead of reusing `readRememberedOrg`'s validation, a user removed from an org after
   the value was persisted could get silently routed into an org they can no longer access (the router
   guard would then correctly reject them further downstream, but the intermediate state/flash is a
   regression from today's clean behavior).
2. **Never clearing on sign-out** — `clearRememberedOrg()` (`auth.ts:92-98`, wired at `auth.ts:893`,
   presumably in the sign-out path) removes the *sessionStorage* key on logout. If a parallel
   localStorage value is added, that same sign-out path must clear it too, or a shared/public computer
   retains the last-selected org indefinitely across sessions and users — a real, if low-severity, data
   exposure (org name leak) on shared hardware, and a straightforward-to-miss omission since it's a
   *second* storage write path, not automatically covered by the existing sessionStorage-clear call.
3. **Unintended cross-tab live sync** — `localStorage` writes fire a `storage` event in *other* open
   tabs of the same origin. If any code listens for that (or if the org context re-reads localStorage
   reactively), a user with two tabs open — one deliberately parked on Church A, one switched to Church
   B — could see tab A's context silently flip to Church B mid-use, an actual UX regression from
   today's genuine per-tab independence. Decide explicitly whether the new mechanism should support
   only *new-tab initial load* (read once at mount, matching the sessionStorage read pattern) versus
   *live cross-tab sync* (react to `storage` events) — don't let it happen as an accidental side effect
   of switching storage APIs.

**Why it happens:** `sessionStorage` → `localStorage` looks like a one-line change (same
getItem/setItem/removeItem API), which makes it easy to treat as a drop-in swap and miss that three
separate pieces of *behavior* (validation, sign-out cleanup, tab isolation) were built around the old
API's specific properties, not incidental to it.

**How to avoid:**
- Reuse `readRememberedOrg`'s existing `ids.includes(remembered)` guard verbatim for the new
  localStorage-backed read path — don't re-implement the validation.
- Add the localStorage-key removal to the exact same sign-out call site that already calls
  `clearRememberedOrg()` (`auth.ts:893`) — one function, two storage backends cleared together, not two
  independently-maintained call sites.
- Explicitly decide and document (a one-line comment matching the existing style at `auth.ts:65-69`)
  whether cross-tab live sync is in scope; if not, read the value once on mount/route-guard only, the
  same way the sessionStorage version currently behaves, so no new `storage`-event listener is added
  unless it was a deliberate decision.
- Consider the "restore from the deep-link target" alternative PROJECT.md itself floats as a
  fallback for links that already encode an org — it sidesteps the shared-computer/cross-tab questions
  entirely for that subset of cases, at the cost of not fixing a bare `/dashboard` deep link with no
  org hint. A hybrid (localStorage as the fallback restore source, deep-link-encoded org id taking
  priority when present) is worth scoping explicitly rather than picking one implicitly.

**Warning signs:** a QA pass that only tests "single user, single tab" won't catch any of these three —
test explicitly with (a) a user removed from an org after selecting it, (b) sign-out on a shared
profile followed by a different user signing in, and (c) two tabs open simultaneously with a
deliberate org switch in one.

**Phase to address:** the church-picker-fix phase — treat this as three explicit acceptance criteria
(stale-membership re-validation preserved, sign-out clears both storages, cross-tab behavior is a
stated decision not an accident), not just "make new-tab deep links work."

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|-----------------|------------------|
| Freezing a vamp's resolved Storage URL onto the slide at assignment time instead of storing a vamp-id reference | Simpler assembly code, no extra lookup at Run time | Silent staleness on vamp edit/delete (Pitfall 3) | Never for vamps specifically (unlike v2.11 song attachments, vamps are pre-assigned long before use) |
| Reading org rehearsal/report defaults live instead of copying at service-creation time | Less code, "just works" like other OrgSettings fields | Retroactive mutation of locked/shared services (Pitfall 7) | Never |
| Treating `sessionStorage`→`localStorage` as a drop-in API swap | Fast fix, unblocks the deep-link bug quickly | Silently drops sign-out cleanup / stale-membership guard / tab isolation (Pitfall 10) | Never — budget the extra care, it's a security/UX-relevant store, not incidental state |
| Sending the update email with a bare `{{service_link}}` substitution and no ensure-link-exists step | Fastest way to "wire the token in" | Blank/broken-looking emails for legacy or auto-generation-failure services (Pitfall 9) | Only acceptable once auto-share-link generation is verified non-fallible for every code path that creates a service (it currently is not — it's explicitly non-blocking) |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|-----------------|-------------------|
| Firebase Storage rules for vamp MP3s | Trusting a green local `storage.rules.test.ts` run as proof the editor-upload gate works | Copy the `song-files/` rule shape (known-good in prod via the existing IAM grant), and explicitly annotate the vamp allow-cases as expected-local-failures the way `storage.rules.test.ts` now documents (per CLAUDE.md) |
| Cloud Functions (`functions/src/index.ts`) | Adding a new vamp-related function (cascade-delete on vamp removal, upload post-processing, etc.) without adding it to the `export { ... }` block at `index.ts:2872` | Add the re-export in the same commit as the handler; `firebase deploy` silently skips unexported functions (no error, just "No function matches the filter") |
| `/api/*` proxy (if a vamp or rehearsal-time flow adds a new proxy call) | Omitting `getAppAuthHeaders()`/`X-App-Auth` on the fetch | Attach it on every proxy call — it works in dev (Vite proxy, no guard) but 401s in prod (this was the exact root cause of the PC-401 prod bug, quick/260908-pca) |
| Messaging tokens (`{{service_link}}`) | Assuming the token always resolves to a real URL because it "already exists" | Actively ensure a share link exists before sending (Pitfall 9) — the token's own empty-substitution behavior is correct, but is not itself a guarantee the feature promise ("always link to the plan") is met |
| Public projections (`ServiceSnapshot`, `rehearseAccess`) | Adding a field to `Service`/the editor and assuming it "flows through" | It does not — both projections are explicit allowlists in `src/utils/serviceProjection.ts` / `src/utils/rehearseAccess.ts`; add the field to both builders by hand (Pitfall 8) |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|-----------------|
| Vamp MP3s stored with no per-org quota or egress monitoring (SEED-003 deferred, per CLAUDE.md) | Storage/egress cost grows unboundedly per org, same gap song attachments (v2.11) and rehearsal media (v2.12) already accepted | Track it explicitly as a known, accepted gap for this milestone (it already is, per PROJECT.md/CLAUDE.md) — don't silently let vamps look "done" while amplifying an already-flagged, already-deferred cost risk | Becomes visible once several orgs each accumulate many multi-MB vamp files with no cleanup path (vamps are explicitly reusable/permanent, unlike transient service media) |
| Re-sorting the rehearsals array on every render instead of once at the store/projection layer | Minor, but compounds across dashboard + My Schedule + share view all independently re-deriving order | Compute the sorted order once per data load (in the store or projection builder), expose it sorted, don't re-sort per component | Not a hard scale wall — just avoidable duplicate work worth catching in review |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Reusing the `firestore.exists()`-gated storage-rules pattern for vamp uploads without the matching IAM grant already applied to `song-files/` | A vamp upload silently 403s for every real editor in production, exactly like the 2026-08-05 `storage/unauthorized` incident | Confirm (don't assume) the existing `Firebase Rules Firestore Service Agent` IAM grant covers the new prefix, or re-grant explicitly; verify with a real deployed upload, not just local rules tests |
| Persisting the active org id in a longer-lived client store (localStorage) without re-validating org membership on every read | A revoked member briefly appears routed toward an org they no longer belong to before the router guard catches it | Keep the exact `ids.includes(remembered)` re-validation from `router/index.ts:527` on every read of the new storage value, never trust a persisted value at face value |
| An update email exposing `{{service_link}}` for a service whose share token was never meant to be sent this widely | Low, but worth noting: an "always link to the plan" promise increases how often a share link leaves the app via email — the link itself carries no new PII beyond what ShareView already exposes (already reviewed/hardened in v2.8's SEC-S-01 fix), so this is not a new exposure, just a wider distribution of an already-reviewed surface | No new mitigation needed beyond confirming the v2.8 share-token access-control fix still applies; just aware, not urgent |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|--------------|-------------------|
| A vamp fails to autoplay live with zero on-screen indication (Pitfall 1) | Dead silence during a planned musical moment, discovered by the congregation before the operator | Arm audio via an explicit control-screen gesture + propagate autoplay-blocked state back to the operator's screen |
| Rehearsal times shown in the planner's timezone but read by a volunteer in a different one | A volunteer shows up at the wrong wall-clock time | Always format using `org.timezone` explicitly, never the device's local zone (Pitfall 5) |
| An org-default rehearsal-time edit silently changes a service that was already locked and shared | A team member who already saw/printed the original time now sees a different one with no visible edit history | Copy defaults at creation time only; treat later edits to a specific service as an explicit, visible action (Pitfall 7) |
| An update email with a broken/blank service-link | Recipient can't reach the plan the email claims to link to, erodes trust in future emails | Ensure a share link exists before sending, never rely on best-effort substitution (Pitfall 9) |

## "Looks Done But Isn't" Checklist

- [ ] **Vamp live playback:** Often missing a visible failure state when autoplay is blocked in the Run
      output — verify by testing on a *fresh* browser profile with zero prior interaction with the app,
      not the developer's own long-lived profile.
- [ ] **Vamp assigned to a slide:** Often missing verification that Audience, Confidence, and Video
      outputs don't all independently play the same MP3 simultaneously — verify with all three output
      windows open on real, separate monitors driven from one machine, with real speakers.
- [ ] **Rehearsal/report times "everywhere the date shows":** Often missing one or more of the four
      named surfaces (dashboard, My Schedule, volunteer service view, share/plan view) because two of
      them (My Schedule, share view) are fed by the frozen `rehearseAccess`/`ServiceSnapshot`
      projections, not a live `Service` read — verify each surface individually, don't assume the
      editor showing it correctly means every consumer does.
- [ ] **Service-update email link:** Often missing the case where the service has no share token yet
      (a legacy pre-v2.14 service, or a service where auto-generation's non-blocking call failed) —
      verify by sending an update email for a service created before the auto-share-link feature
      existed, or by forcing the auto-generation call to fail.
- [ ] **Church-picker deep-link fix:** Often missing the sign-out cleanup of the *new* storage
      mechanism (only the old sessionStorage key gets cleared) — verify by signing out on a shared
      profile and confirming no org-selection artifact survives for the next person to sign in.

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|-----------------|-------------------|
| Vamp echoes across Audience/Confidence/Video (Pitfall 2) | LOW | Add a `suppressAudio` prop to `SlideCanvas`, mirroring the existing `suppressBackground` wiring; no data-model change needed |
| Vamp URL stale after edit/delete (Pitfall 3) | MEDIUM | Migrate slide assignments from a frozen URL field to a vamp-id reference resolved at materialize time; requires touching every service that already has a vamp assigned |
| Retroactive org-default mutation already shipped and already affected live services (Pitfall 7) | MEDIUM–HIGH | Requires a one-time backfill to "freeze" whatever value each existing service was implicitly displaying at the time of the bugfix, mirroring the last-used-date backfill precedent from v2.3 (R247/R248) |
| Update emails already sent with blank links (Pitfall 9) | LOW | Fix the send-path going forward; past emails can't be recalled — consider a follow-up "here's the plan" resend for any batch known to have gone out broken |
| localStorage org-selection leak on shared computer (Pitfall 10) | LOW | Ship the sign-out-clears-both-storages fix; no data migration needed, it's a forward-looking behavior fix |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|--------------------|-----------------|
| 1. Silent autoplay-block on live output | Vamps live-playback phase | Real-hardware UAT on a fresh browser profile; control-screen shows a visible warning when blocked |
| 2. Triple-window audio playback | Vamps live-playback phase (same phase as #1) | Real-hardware UAT with all three output roles open on real speakers |
| 3. Stale denormalized vamp URL | Vamps data-model/assignment phase | Test: edit/delete a vamp already assigned to a slide, assert the slide degrades gracefully (or is proactively flagged), not silently broken |
| 4. storage.rules blind spot for vamp uploads | Vamps storage/rules phase | Rules test explicitly annotates expected-local-failure allow-cases; a real deployed-environment upload check before ship |
| 5. Timezone mishandling in rehearsal/report times | Rehearsal/report-times data-model phase | Test asserting identical rendered output regardless of the CI/dev machine's system timezone |
| 6. Rehearsal array ordering | Rehearsal/report-times data-model phase | Shared `sortRehearsals` utility, called from every consumer; test an out-of-order insert renders sorted |
| 7. Org-default retroactive drift | Rehearsal/report-times data-model + org-settings phase | Test: change org default, assert existing service unaffected; create new service after, assert it picks up new default |
| 8. Projections not threaded (ServiceSnapshot/rehearseAccess) | Phase that threads times "everywhere the date shows" | Test mirroring `services.sharePii.test.ts` asserting the new field appears in both projection outputs |
| 9. Null service-link in update emails | Service-update-emails phase | Test: send an update email for a service with no existing share token, assert a link is minted first, never an empty substitution reaching the sent body |
| 10. localStorage org-selection regressions | Church-picker-fix phase | Three explicit tests: stale-membership re-validation, sign-out clears the new storage too, deliberate statement of cross-tab sync behavior |

## Sources

- Direct source inspection (HIGH confidence, primary source — this is an existing, shipped codebase,
  not third-party documentation): `src/components/AudioPlayer.vue`, `src/components/slides/
  SlideCanvas.vue`, `src/components/output/FullscreenSlideOutput.vue`, `src/views/
  ConfidenceOutputView.vue`, `src/views/VideoOutputView.vue`, `src/composables/useOutputWindow.ts`,
  `src/stores/auth.ts`, `src/router/index.ts`, `src/types/service.ts`, `src/types/organization.ts`,
  `src/types/slideGroup.ts`, `src/utils/serviceProjection.ts`, `src/utils/rehearseAccess.ts`,
  `src/composables/useSongFileUpload.ts`, `storage.rules`, `functions/src/index.ts`,
  `functions/src/messageTokens.ts`, `functions/src/messageTokens.test.ts`.
- `CLAUDE.md` (project landmines: `firestore.exists()`-in-Storage-emulator blind spot, Cloud Functions
  re-export requirement, `/api/*` proxy auth header requirement, `.env.local` worktree requirement).
- `.planning/PROJECT.md` (v2.15 scope section, and the v2.11/v2.12/v2.14 shipped-milestone records this
  milestone explicitly builds on).
- Chrome/browser autoplay-policy behavior (Media Engagement Index, per-origin accumulation, popup-from-
  gesture exceptions) is standard, widely-documented browser platform behavior (MEDIUM confidence as
  applied here — the general mechanism is well established, but this project's exact real-hardware
  behavior under it has not yet been empirically verified in this research pass; Pitfall 1 explicitly
  calls for that verification as part of the phase, not as a research-time claim).

---
*Pitfalls research for: WorshipPlanner v2.15 (Vamps, rehearsal/report times, service-link emails,
church-picker fix)*
*Researched: 2026-09-09*
