# Pitfalls Research — v2.7 Rehearsal, Stage Plans & Presentation Polish

**Domain:** Adding 8 features to a mature Vue 3 + Firebase (Blaze) worship-planning app — public rehearsal
media, per-org Storage rules, freeform drag-and-drop, live-presentation timers, slide-model changes,
app-wide notifications, and multi-org context switching.
**Researched:** 2026-08-31
**Confidence:** HIGH for codebase-grounded findings (read directly from `storage.rules`, `firestore.rules`,
`src/stores/auth.ts`, `src/stores/orgScopedStores.ts`, `src/stores/toasts.ts`, `src/types/slide.ts`,
`src/types/songLyrics.ts`, `src/utils/songSectionOrder.ts`, `src/composables/useMediaUpload.ts`,
`src/views/ShareView.vue`, `src/views/RunControlView.vue`); LOW for the four general web-search findings
(unverified single-source, cited inline) used only as supporting context for the public-share and a11y
pitfalls.

## Critical Pitfalls

### Pitfall 1: Rehearse mode makes the whole org's Storage bucket world-readable

**What goes wrong:**
`storage.rules` today gates `orgs/{orgId}/media/**` and `orgs/{orgId}/{allPaths=**}` purely on
`isOrgMember(orgId)` (a signed-in claim check) — there is currently **no unauthenticated read path at
all**. The Rehearse feature requires the opposite: an anonymous visitor with only a share-link token must
read specific song attachments. The naive fix — `allow read: if true;` on the existing `orgs/{orgId}/**`
match, or widening the existing media match — makes **every** file under that org's Storage prefix
(PPTX source decks, slide background images, other songs' unreleased chord charts, anything ever
uploaded) world-readable to anyone who enumerates or guesses a path, not just the attachments the
planner intended to share. Firebase Storage has no native path-listing protection once `read` is `true`,
and `getDownloadURL()` tokens are themselves durable, unrevocable-from-client bearer tokens once minted
(LOW-confidence web finding) — so a leaked or logged URL keeps working indefinitely even after the
service is no longer being rehearsed.

**Why it happens:**
The existing membership pattern (`isOrgMember`) is the *only* read gate in the file — there is no
precedent in this codebase for a partial-public-read rule, so the fastest-looking fix is to relax the
existing broad match rather than add a narrow new one.

**How to avoid:**
- Give rehearsal attachments their **own dedicated Storage path** distinct from `orgs/{orgId}/media/**`
  (e.g. `orgs/{orgId}/rehearsalAttachments/{songId}/{attachmentId}/...`), with its **own** `match` block —
  mirroring how the existing `orgs/{orgId}/media/**` block already gets its own higher size cap
  independent of the generic `orgs/{orgId}/{allPaths=**}` fallback (Cloud Storage rules do **not**
  cascade between sibling matches, and this codebase's own comment on that media block already proves it
  with a dedicated test).
- Public read on that path must be scoped to **attachments belonging to a currently-shared service's
  songs only**, not "public read of every attachment the org has ever uploaded" — e.g. gate on a
  Firestore cross-check to the song being attached to a service with a live `shareTokens`/`serviceShares`
  doc, or simplest/safest: make public read conditional on the attachment doc itself carrying a
  `publiclyShareable` flag set only when the attachment is actually referenced from a service that has
  an active share link. Do not make ALL of a song's attachments public just because ANY one service using
  that song is shared.
- Never widen the pre-existing `orgs/{orgId}/{allPaths=**}` or `orgs/{orgId}/media/**` matches themselves
  — those must stay member-only for PPTX sources, backgrounds, and non-rehearsal media.
- Prefer short-lived signed URLs (minted server-side, e.g. by a Cloud Function the Rehearse view calls) over
  a public `allow read` + long-lived `getDownloadURL()` token, especially for MP3s that may carry licensed
  practice-track content — this also solves cost capping (Pitfall 8) and revocation together.

**Warning signs:**
- Any diff to `storage.rules` that adds `allow read: if true;` to an existing match block instead of a
  new, narrowly-scoped one.
- A rules test that only proves "an anonymous user can read *an* attachment" without also proving "an
  anonymous user CANNOT read a background image / PPTX source / another song's un-shared attachment."
- `src/storage.rules.test.ts` growing an allow-case for the new path without a paired deny-case against
  the pre-existing `orgs/{orgId}/media/**` and `orgs/{orgId}/{allPaths=**}` blocks.

**Phase to address:**
The phase that introduces rehearsal-attachment Storage upload/storage rules (before the Rehearse UI phase
that consumes them). This is the single highest-severity item in the whole milestone — it should be its
own reviewed phase with a dedicated threat model (STRIDE), not a line item inside a UI phase.

---

### Pitfall 2: The cross-service `firestore.exists()` blind spot repeats for the new attachment path

**What goes wrong:**
This exact codebase already shipped a deny-everyone Storage rule once (documented in `CLAUDE.md` and in
`storage.rules`'s own header comments) because a rule tried to call `firestore.exists()` from
`storage.rules` to check org membership — and `firestore.exists()` is **permanently inert** in the Storage
emulator (`firebase-js-sdk#6803`), so the rule *looked* correct in every local test while denying every
real user in production. The natural instinct for Rehearse's "is this attachment actually shared" check
(Pitfall 1) is exactly that shape: `storage.rules` reaching into Firestore to check
`shareTokens`/`serviceShares`/song-attachment metadata. Repeating that pattern reintroduces the identical
blind spot — a rule that tests GREEN locally and denies (or, worse, allows) everyone in production, with
no local signal either way.

**Why it happens:**
Firestore already holds the "is this service publicly shared" truth (`shareTokens` read:true,
`serviceShares` read:true), so reaching for `firestore.get()`/`exists()` from `storage.rules` is the most
natural-looking way to condition a Storage read on it. The emulator gives no error and no warning when
this happens — it just silently evaluates false.

**How to avoid:**
- `storage.rules` must **never** call `firestore.get()`/`exists()`/`firestore.exists()` for the new
  rehearsal-attachment path, full stop — this codebase's own `isOrgMemberByClaim`/`isOrgDeactivatedForCaller`
  functions are the established precedent: cross-service truth is pushed onto a **custom auth claim**
  (for signed-in users) instead.
- Because Rehearse visitors are **unauthenticated** (no claim to carry truth on), the "is this attachment
  publicly readable" decision cannot depend on live Firestore state read from `storage.rules` at all. Two
  workable patterns, both avoiding the cross-service read:
  1. **Denormalize the flag onto the Storage object itself** at upload/share time (e.g. custom metadata
     `publiclyReadable: 'true'` set only when a Cloud Function confirms the song is attached to a
     currently-shared service) and gate the rule on `resource.metadata` — fully emulator-verifiable, no
     cross-service call.
  2. **Route all Rehearse reads through a Cloud Function / signed URL** instead of a client-side
     `storage.rules` read at all — the Function (Admin SDK) does the Firestore check server-side, mints a
     short-lived signed URL, and `storage.rules` never has to answer "is this shared" itself. This is also
     the stronger answer to Pitfall 1 and Pitfall 8 simultaneously.
- Either way, add a rules test in `src/storage.rules.test.ts` for the new path and require it to prove
  something **beyond** "the emulator returns allow/deny" — e.g. an admin-SDK-seeded fixture the rule can
  actually see, the same discipline this repo's `CLAUDE.md` demands after the 2026-08-06 incident.

**Warning signs:**
- Any new line in `storage.rules` containing `firestore.get(` or `firestore.exists(`.
- A new rules test that passes in the emulator but was never manually verified against the deployed rule
  in a real (non-emulator) environment before shipping — exactly the gap that let the original incident
  reach production undetected for a full milestone.

**Phase to address:**
Same phase as Pitfall 1 (rehearsal-attachment Storage rules). Code review for that phase should explicitly
grep the diff for `firestore.` inside `storage.rules` as a blocking check.

---

### Pitfall 3: Stage-layout canvas drag-and-drop repeats the app's own reordering-corruption history

**What goes wrong:**
This app has a **documented, repeated** history of drag-and-drop corrupting state — v1.4's phantom
duplicate items stuck at "No Section," v1.6's drag-into-section bugs sequenced first in that milestone
specifically because it "blocks trust in every other editing surface." The stage-layout canvas is a new
*freeform x/y* drag surface (not a reorder-a-list drag, which is what every existing draggable component
in this codebase does — `SlideGrid`, `SongLyricEditor`'s section rows, `ServiceEditorView`'s slot list, the
service template editor). None of the app's existing drag code is freeform-position code; there is no
precedent to reuse, so this is genuinely new surface area, with new failure modes:
- Native HTML5 Drag and Drop (`dragstart`/`dragover`/`drop`) is **mouse-only by spec** — no major mobile
  browser fires DnD events from touch (LOW-confidence web finding), so a stage layout built on it would
  silently not work on a phone/tablet, which is exactly the device tech/sound volunteers are likely to use
  backstage.
- Coordinates saved as absolute pixels (rather than percentages of the canvas) break the moment the canvas
  is resized (window resize, different monitor, print/export) — items drift or overlap.
- A print/export view of the stage layout is an entirely different rendering context than the live
  drag-canvas; if position data isn't captured in a resolution-independent unit, print output won't match
  what was arranged on screen.

**Why it happens:**
Freeform canvas positioning "looks like" the existing list drag-and-drop the team has already built
several times, so it's tempting to reach for the same library/pattern — but list reordering (swap index N
and M) and freeform placement (store x,y) are different problems with different corruption modes.

**How to avoid:**
- Build on **Pointer Events** (`pointerdown`/`pointermove`/`pointerup`), not native HTML5 DnD — one code
  path across mouse, touch, and pen (LOW-confidence web finding, but consistent with why every serious
  freeform-canvas library — interact.js, etc. — uses pointer events instead of native DnD).
- Store position as a **percentage or normalized 0–1 coordinate** relative to the canvas bounding box, not
  raw pixels — recompute pixel placement from the normalized value on every render, including for
  print/export, so resize/different-viewport never desyncs the visual from the saved data.
- Recompute `getBoundingClientRect()` on drag-start and on resize — never cache it across the drag
  interaction or across mount.
- Disable default touch scrolling on the draggable surface (`touch-action: none` on drag handles) so a
  touch-drag doesn't fight the page's own scroll.
- Persist position writes debounced/on-drop (mirroring the codebase's existing autosave pattern), never on
  every `pointermove` tick, to avoid a write storm and to keep the "one autosave path" invariant this app
  already leans on elsewhere.
- Add an explicit round-trip test: save a position, reload the page, assert the same normalized coordinate
  comes back — this is the class of bug ("saving positions that don't round-trip") the milestone brief
  specifically flags, and it is cheap to test directly without any drag simulation.

**Warning signs:**
- The stage-layout implementation reaches for `@vueuse/core`'s `useDraggable` or a `dragstart`/`drop`-based
  Vue directive without first confirming it fires under `pointercancel`/touch in a real mobile browser test
  (not just desktop Chrome devtools' touch emulation, which does not always match real-device behavior).
- Position fields stored as raw `left`/`top` pixel numbers rather than a percentage/ratio.
- No test exercises print/export of the stage layout at a different viewport width than it was authored at.

**Phase to address:**
The stage-layout phase itself — flag it for an execution-time gate that manually drag-tests on a real
touch device (or at minimum real-device Chrome DevTools remote debugging, not emulated touch) before
calling the feature done, given this app's specific track record with drag corruption.

---

### Pitfall 4: Loop/auto-advance timer leaks or fights manual navigation across output windows

**What goes wrong:**
"Run the Service" already runs a non-trivial cross-window coordination system (`runChannel.ts` /
`BroadcastChannel`, `useOutputWindow.ts`, `useRunControl.ts` with its own `setInterval`-based polling and
explicit `clearInterval`/`onUnmounted` teardown discipline for monitor-reassignment detection). A per-item
loop timer is new state layered on top of that same control surface, and the specific ways it can go wrong
in *this* system are:
- A timer armed in the control window is not, by itself, visible to the Audience/Confidence output windows
  — if the loop only advances local component state instead of broadcasting through `runChannel` the same
  way manual navigation does, the outputs stop following the control window (silent desync, only visible
  once someone is watching the actual projector).
- Route-away or item-change while a loop is armed must stop the timer — an interval left running against a
  now-unmounted or now-irrelevant item will keep firing `advance()` calls against stale state (or worse,
  against the *next* item the projectionist manually navigated to, making manual clicks appear to "jump"
  unpredictably a few seconds later).
- Manual navigation (arrow keys, click-to-jump — both already implemented in `RunControlView`) must
  **disarm or reset** the loop, not race it — a manual "previous slide" immediately followed by the loop's
  own scheduled auto-advance would appear to overrule the projectionist's own input.
- "Go to black" (a new v2.7 feature, scoped to Audience-only per this milestone) must stop the loop from
  continuing to auto-advance slides that are no longer visible to the congregation, or the loop keeps
  ticking behind a black screen and lands on an unexpected slide when black is lifted.
- Drift: `setInterval` accumulates drift over a long-running interval (a 10s-default loop running for a
  30-minute rehearsal segment); if precision matters for sync with music, a `setInterval`-based
  auto-advance will visibly drift.

**Why it happens:**
The loop is easy to prototype as "a local `setInterval` that calls the same `advance()` function manual
nav uses" without threading it through the *same* broadcast/teardown discipline `useRunControl.ts` already
established for every other state change — because it's tempting to treat it as "just another way to
trigger next slide" rather than as a new, independently-lifecycled timer that needs its own arm/disarm
rules interacting with every existing navigation input.

**How to avoid:**
- Route every loop-triggered advance through the **exact same** `runChannel` broadcast path manual
  navigation already uses, not a parallel local-only state mutation — so outputs never desync from control.
- Scope the timer's lifetime to the **service-item**, not the component: arm on entering the item (if its
  loop flag is set), disarm on leaving it (manual nav to a different item, item change via any input,
  unmount) — mirror the existing `onUnmounted`/`clearInterval` discipline already in `useRunControl.ts`
  rather than inventing a second pattern.
- Any manual navigation input (keyboard, click-to-jump) must explicitly disarm/reset the current loop timer
  as its first effect, before applying the navigation itself — otherwise a stale timer can fire moments
  later.
- "Go to black" must pause (not just visually hide) the loop's auto-advance — decide explicitly whether
  black pauses the loop or lets it keep advancing behind the scenes, and make that a documented, tested
  decision rather than an accident of whatever the black-slide implementation happens to touch.
- Prefer scheduling successive `setTimeout` calls (each one re-armed after the previous fires) over a bare
  `setInterval` if any drift-sensitive behavior is expected — simpler to cancel cleanly on unmount too.

**Warning signs:**
- A loop implementation that calls `setInterval` inside a component's `<script setup>` without a matching
  `onUnmounted`/route-guard teardown, or without going through `runChannel`.
- Manually navigating during an active loop produces a slide that "jumps back" a few seconds later.
- The output windows (Audience/Confidence) show a different slide than the control window after a loop has
  been running for more than one cycle.

**Phase to address:**
The loop/auto-advance phase, with its verification explicitly including: (1) manual-nav-during-loop, (2)
item-change-during-loop, (3) "Go to black"-during-loop, (4) route-away-during-loop, each checked against
both output windows, not just the control window.

---

### Pitfall 5: Black slide corrupts the song's pooled-section slide model or its position-based numbering

**What goes wrong:**
This app's lyric model (`src/types/songLyrics.ts`, `src/utils/songSectionOrder.ts`) is **not** a flat list
of slides — it is a pooled set of `LyricSection`s (`sections`, each with a unique id) referenced by an
ordered `performanceOrder` array of ids, where a **repeated id is a reference to the same pooled section**
(editing it edits every occurrence), and section numbering (e.g. "Verse 3") is derived *positionally* per
`deriveSectionKind()` — stripped from the label and re-numbered among same-kind sections at render time,
never stored. A black "interlude" slide inserted naively into this model risks several distinct corruptions:
- If represented as an ordinary `LyricSection` with empty `lines`, it will be swept into the same-kind
  positional numbering logic (`ADD_SECTION_KINDS` currently has no "Interlude"/"Black" kind) — either
  crashing the numbering derivation, or worse, silently mislabeling it as e.g. "Verse 4" if it's tagged
  with an existing kind just to make the type-checker happy.
  section pool invariant `songSectionOrder.ts` enforces ("every pooled section is referenced at least
  once, every id in `performanceOrder` resolves to a pooled entry") should be assumed to
  still hold after a black slide is added and removed — but only if implemented as a first-class pool
  member, not a special-cased injection into `performanceOrder` alone.
- If the black slide is meant to be a one-off (this specific occurrence only), the existing pooled/
  reference semantics are wrong for it by design — the pool model assumes repeats are *intentional shared
  content* (edit once, reflect everywhere), but a black interlude inserted at one point in one song has no
  reason to be "the same slide" as a black interlude inserted elsewhere. Reusing the pool mechanism for it
  invites an accidental repeat-edit bug (editing one black slide's duration/behavior changes another).
- Export/print and the read-only `ShareView.vue` currently render service slots by `slot.kind` with a
  `[not assigned]` fallback for anything unrecognized — a black slide slipped through as an ordinary lyric
  section could either print as a blank/confusing row, or (if filtered out entirely) silently disappear
  from the printed order of service, which is exactly the "corrupting the export" risk called out in the
  question.
- `AssembledSlide`/`Slide` (`src/types/slide.ts`) is a discriminated union on `contentKind`
  (`lyric | scripture | imported | text | image | video`) consumed by `PresentationViewer.vue`,
  `SlideGrid.vue`, and the Audience/Confidence output views — none of which currently have a branch for
  "render nothing, just black." Reusing `contentKind: 'lyric'` with empty `lines` risks every one of those
  consumers rendering an empty box with the section's UI chrome (label, numbering, edit affordances) rather
  than a clean black frame — the "mistaken for an empty/broken slide" failure mode the milestone brief
  explicitly names.

**Why it happens:**
The lyric editor's existing "Add Section" UX (`ADD_SECTION_KINDS` = Verse/Chorus/Pre-Chorus/Bridge/Tag/
Ending) is the closest existing pattern to "insert something into a song's slide order," so it's tempting
to bolt a black slide on as an ADD_SECTION_KINDS entry rather than treat it as what it actually is: a
distinct content kind, closer to `TextSlide`/`ImageSlide` than to `LyricSlide`.

**How to avoid:**
- Give the black slide its **own `contentKind`** (e.g. `'black'`) in the `Slide` discriminated union,
  rather than overloading `'lyric'` with empty content — every consumer (`PresentationViewer`,
  `SlideGrid`, output views, print/export, `ShareView`) then gets an explicit, exhaustive branch to handle
  it (a plain black `<div>`, no label, no numbering) instead of an accidental fallthrough.
  reflects "content that renders nothing," not a section that gets numbered/labeled/referenced.
- If it must live inside a song's slide sequence for editor UX reasons, make it explicitly **excluded**
  from `deriveSectionKind`/position-numbering (it has no "kind" to number) and explicitly **not**
  pool-referenced (each insertion is its own entry, never shared across occurrences) — both need to be
  deliberate, tested exclusions in `songSectionOrder.ts`, not assumed side effects of adding a new kind
  string.
- Add a `normalizeLyricOrder`-equivalent invariant test: insert a black slide, duplicate the section,
  delete it, reorder around it — assert `performanceOrder`/`sections` stay internally consistent the same
  way the existing pool invariant is tested today.
- Decide and test explicitly what print/export/`ShareView` do with a black slide (skip it entirely in the
  printed order of service is the most likely correct answer, since "black" has no print equivalent) —
  don't let it fall through to a generic `[not assigned]` row.

**Warning signs:**
- A black slide implemented as `contentKind: 'lyric'` with `lines: []`.
- `ADD_SECTION_KINDS` grows a `'Black'`/`'Interlude'` entry that flows through the same positional-numbering
  code path as Verse/Chorus.
- No new test in `songSectionOrder.test.ts`/`slideshowAssembler.test.ts` covering insert/duplicate/delete/
  reorder around a black slide.
- The printed/exported order of service shows an unexpected blank row, or silently omits an item that
  should have printed as "(instrumental interlude)" or similar.

**Phase to address:**
The inline-black-slide phase. This is a data-model decision, not a UI decision — get the `contentKind`
question settled in that phase's plan before any editor UI is built on top of it, since retrofitting the
type later means migrating any black slides already saved.

---

### Pitfall 6: A generic "system-wide dismissible messages" surface is retrofitted onto a deliberately narrow existing toast store

**What goes wrong:**
`src/stores/toasts.ts` already exists and is explicitly documented as "a minimal, single-purpose
failure-toast store... deliberately NOT a general notification system: no priorities, no categories, no
positions, no hover-to-pause, no success/info variants" — it always renders as a red "Save failed."
banner, and **always** auto-dismisses after a fixed 6 seconds via a `setTimeout` armed inside the store.
Meanwhile the specific bug this milestone wants fixed — the "monitors not configured" warning that gets
stuck — lives as its own **separate, ad-hoc inline banner** in `RunControlView.vue` ("Your monitor setup
changed" / "Open monitor setup"), not routed through `toasts.ts` at all. Two distinct failure modes are
easy to fall into:
1. Reusing `toasts.ts` as-is for the monitor warning: a 6-second auto-dismiss is **wrong** for a
   "monitors not configured" warning, which needs to persist **until the underlying condition is actually
   resolved** (monitors get configured), not disappear on a timer while the problem is still real — this
   would trade "stuck forever" for "silently vanishes while still broken," arguably worse.
2. Building the new "system-wide dismissible" mechanism from scratch without first generalizing/replacing
   `toasts.ts`, leaving the app with **two parallel notification systems** (the old red-only failure toast,
   and the new general one) — inconsistent look, inconsistent dismiss behavior, and the exact ad-hoc
   pattern (like `RunControlView`'s inline banner) that the milestone is trying to eliminate likely
   persists in other screens that were never touched.

**Why it happens:**
`toasts.ts`'s narrow scope was a deliberate, documented design choice at the time (R041) — it was never
meant to be the app's general notification system, so extending it without revisiting that decision (or
explicitly retiring it in favor of a new general store) produces exactly this collision.

**How to avoid:**
- Treat this as a **design decision to make explicitly**, not an incremental patch: either (a) generalize
  `toasts.ts`/`ToastHost.vue` into the one system-wide store (adding severity/category, a `persistent: true`
  flag that suppresses the auto-dismiss timer, and a real dismiss button already present today), and migrate
  every ad-hoc warning banner (starting with `RunControlView`'s monitor-changed banner) onto it — or (b)
  build a new store and formally deprecate/replace `toasts.ts`. Do not let both coexist past this milestone.
- A message must be able to be **conditionally re-armed/cleared by its owning feature**, not just by a
  timer or a click — the monitor warning specifically needs to clear itself the instant monitors ARE
  configured (an app-state-driven dismiss), in addition to being manually dismissible. Model this as the
  message carrying an optional "auto-clear condition" or simply having the owning composable call
  `dismiss(id)` itself when the condition resolves, on top of (not instead of) manual dismiss.
  banners.
- Every message should default to `aria-live="polite"`/`role="status"` (never `assertive`) per accessible-
  toast conventions (LOW-confidence web finding, consistent with `ToastHost.vue`'s existing `role="alert"`
  posture which — note — is technically `assertive`-equivalent and should be reconsidered for non-error
  informational messages under the new general system).
- Persistent/unresolved-condition warnings should not carry ANY auto-dismiss timer at all — only condition-
  resolution or explicit user dismissal should clear them (LOW-confidence web finding).

**Warning signs:**
- A PR that adds a new store/component for "system-wide messages" while `src/stores/toasts.ts` and
  `ToastHost.vue` remain untouched and still separately mounted.
- The monitor-not-configured banner in `RunControlView.vue` still lives as bespoke inline template markup
  after this milestone ships, rather than being migrated onto the new/generalized system.
- Any new message type inherits the unconditional 6-second `setTimeout` without an opt-out for
  persistent/condition-driven messages.

**Phase to address:**
The dismissible-messages phase — scope it explicitly to include (1) generalizing or replacing `toasts.ts`,
and (2) migrating at least the `RunControlView` monitor-warning banner onto the new system as its proof
case, not just building the mechanism in isolation.

---

### Pitfall 7: Church switcher bypasses (or only partially reuses) the already-hardened multi-org reset path

**What goes wrong — the good news first:**
This is the pitfall with the **best existing foundation** in the milestone: `src/stores/auth.ts` already
has a working, documented, bug-fixed multi-org switch primitive — `selectOrg(targetOrgId)` — used by the
existing multi-org login picker, and a super-admin equivalent `enterOrgAsSuperAdmin`/`exitSuperAdminView`.
Both call a shared `resetOrgScopedStores()` (`src/stores/orgScopedStores.ts`) that explicitly unsubscribes
**every** org-scoped Pinia store's Firestore listener (services, songs, roster, teams, quarters,
slideGroups, scriptureSlides, importedSlides, pptxRenders, serviceMessages, songLyrics) *before* the new
org's data loads — a fix the codebase's own comments trace to a real, previously-shipped bug ("quick
260823-switch-church-cache": stale prior-org data flashing on screen because Vue Router mounts the
destination view before the source view unmounts). The risk for v2.7 is **not** designing this from
scratch — it's regressing the fix that already exists:
- A new user-menu "Switch Church" UI that calls Firestore/claim logic directly instead of reusing
  `selectOrg()` would skip `resetOrgScopedStores()` entirely, reintroducing the exact stale-data flash bug
  that was already found and fixed once.
- Any **new** org-scoped Pinia store this milestone adds (rehearsal-attachments store, stage-layout store)
  will **not** be included in `resetOrgScopedStores()`'s hard-coded call list unless someone remembers to
  add it — a switch would leave the previous org's stage layout or attachment list visible/stale after
  switching to a different church, silently, with no error.
- `selectOrg()` itself only proceeds if `memberships.value.some((m) => m.id === targetOrgId)` — i.e. it
  already assumes the caller is a genuine multi-org member. The user-menu entry point must not expose
  "switch" to a single-org user (no-op looks like a bug) and must source its list from the same
  `memberships` the picker already uses, not a fresh query.
- The org **claim** (`orgId`/`role` on the JWT) only ever tracks the user's **primary** org
  (`orgIds[0]`) per the codebase's own documented "Known limitation (D-01/D-04)" comment — a non-primary
  org switch is served by the Firestore-membership arm alone, which is fine for Firestore reads but means
  `storage.rules`' claim-only `isOrgMemberByClaim` may not reflect the just-switched-to org for a
  non-primary org until the claim is later refreshed. If the church switcher is used to reach a non-primary
  org and the user then tries a Storage-touching action (upload a rehearsal attachment, view a stage-layout
  asset), the claim-vs-active-org mismatch could deny Storage access even though the Firestore-side switch
  succeeded.

**Why it happens:**
The multi-org reset machinery lives inside `auth.ts`/`orgScopedStores.ts`, not in an obviously-named
"how to add org switching" doc — a developer building the new user-menu entry point who doesn't first read
those two files could easily reimplement a shallower version (e.g. just setting `orgId.value` and
re-navigating) that looks correct in casual testing but reintroduces the stale-data bug.

**How to avoid:**
- The user-menu church switcher must call the **existing** `selectOrg(targetOrgId)` — not a new,
  parallel implementation — for any multi-org member (mirroring what the current login-time picker
  already does).
- Any new org-scoped store this milestone introduces (rehearsal attachments, stage layout) must be added to
  `resetOrgScopedStores()`'s call list as part of that store's own phase, not deferred to "whoever builds
  the switcher notices it's missing."
- Verify (with a test, not just manual click-through) that switching orgs via the new user-menu entry point
  clears rehearsal-attachment and stage-layout state from the previously active org, the same way the
  existing "quick 260823" regression test presumably covers the pre-existing stores.
- If the church switcher is expected to work for a non-primary org, explicitly decide whether to call
  `refreshOrgClaim(targetOrgId, true)` (the awaited-claim-refresh path `auth.ts` already exposes) after
  `selectOrg()`, or document/verify that Storage access on a non-primary org load correctly falls through to
  Firestore-membership-equivalent behavior — do not leave this as an untested assumption for the new
  Storage-touching features (attachments, stage layout) added in this same milestone.

**Warning signs:**
- The new church-switcher component contains its own Firestore query or `orgId.value = ...` assignment
  instead of calling `authStore.selectOrg()`.
- `orgScopedStores.ts`'s `resetOrgScopedStores()` function is not touched by the phases that add the
  rehearsal-attachments or stage-layout stores.
- After switching churches via the user menu, briefly seeing the previous church's stage layout or
  attachment list before the new church's data loads.
- Uploading a rehearsal attachment or saving a stage layout immediately after switching to a non-primary
  org intermittently fails Storage rules while Firestore writes succeed.

**Phase to address:**
The church-switcher phase itself (reuse verification), plus a checklist item on the rehearsal-attachments
and stage-layout phases to register their new stores with `resetOrgScopedStores()`.

---

### Pitfall 8: Storage/egress cost blast radius from user-uploaded rehearsal media on the Blaze plan

**What goes wrong:**
v1.8 was an entire milestone dedicated to capping runaway Blaze-plan costs (AI proxy rate limits, Storage
retention sweeps, Resend send caps, Cloud Run instance ceilings) — this app's owner has already paid real
money for an uncapped cost surface once. Rehearsal attachments introduce a **new, and larger**, cost
surface than anything capped so far:
- MP3s and PDFs are materially larger than the media already gated by `useMediaUpload.ts`'s existing
  50MB cap, and — unlike that existing media path — they are now being read by **anonymous public
  visitors** (volunteers via the share link), not just signed-in org members. Storage **egress** (bytes
  served, not just bytes stored) scales with every rehearsal play, and a popular/frequently-rehearsed song
  attached across many services multiplies reads with no natural ceiling.
- Public unauthenticated `getDownloadURL()` links, once minted, keep serving egress-billed bytes for as
  long as the object exists and the token is valid — there's no login wall to slow down casual sharing of
  the link beyond its intended volunteers (a shared rehearse link forwarded well beyond the team, or
  indexed/crawled, could serve MP3 bytes to strangers indefinitely).
- No existing retention sweep (`cleanupOrphanBackgrounds`, `cleanupPptxSources`, the v1.8 media sweep)
  targets rehearsal attachments — they'd need their own orphan/age detection or they accumulate forever,
  the same "unbounded storage growth" pattern v1.8 already had to retrofit for backgrounds/PPTX sources.
- YouTube links (no Storage cost at all) are the cheap option and should be the **preferred** path for
  video content the milestone brief explicitly allows as an alternative to uploaded media — but nothing in
  the current design prevents a planner from uploading a video-sized file to the MP3/PDF attachment slot
  instead of linking YouTube, if the upload validation only checks `audio/*`/`application/pdf` MIME types
  loosely.

**Why it happens:**
v1.8's cost hardening covered every cost surface that existed *at the time* — a brand-new public read path
on new, larger media types is exactly the kind of surface that wasn't and couldn't have been anticipated,
and it's easy to treat "we already solved cost" as covering this too.

**How to avoid:**
- Set an explicit, conservative per-attachment size cap **smaller than convenience would suggest** —
  distinct from (and likely smaller than) the existing 50MB media cap, enforced both client-side
  (mirroring `useMediaUpload.ts`'s pre-upload `validate()`) and server-side in `storage.rules`
  (`request.resource.size < N`), the same two-layer pattern the codebase already uses everywhere else.
- Strongly steer toward **YouTube links over uploaded video/large-audio** in the attachment UI — this
  feature already supports YouTube per the milestone brief; make it the path of least resistance so most
  attachments cost the org nothing in Storage/egress.
- Prefer signed URLs with a short expiry (minted per Rehearse-page-load, not once and cached) over a
  permanent public `getDownloadURL()` token — this bounds how long a leaked/over-shared link keeps costing
  egress, and doubles as the Pitfall 1/2 security fix.
- Add rehearsal attachments to the retention-sweep family (or explicitly, consciously decide they're
  exempt and document why) rather than leaving them as a new unswept accumulation surface — mirror
  `cleanupOrphanBackgrounds`'s dry-run-first, reference-detection pattern from v1.8.
- Consider a per-org or per-attachment play-count/egress budget or alert threshold, given this is now
  **unauthenticated public** egress rather than authenticated in-app usage — the cost profile is
  structurally different from every other Storage path in the app (all of which require org membership
  today).

**Warning signs:**
- The new attachment upload composable copies `MEDIA_MAX_BYTES` (50MB) verbatim rather than choosing a
  cap appropriate to the new, larger and now-public asset class.
- No corresponding `storage.rules` size cap on the new attachment path (client-only validation, mirroring
  the exact gap the existing `orgs/{orgId}/media/**` and generic paths both correctly avoid today).
- Rehearsal attachments are never added to any retention-sweep discussion or explicitly marked "exempt,
  because X" in `PROJECT.md`/roadmap.
- No mechanism differentiates "public egress via the share link" from "in-app authenticated reads" in any
  cost dashboard/log the owner already relies on from v1.8.

**Phase to address:**
The rehearsal-attachment upload/Storage-rules phase (cap + rules) and, separately, a cost-review checkpoint
before this milestone ships to production — given this app's history (v1.8 existed specifically because an
earlier surface shipped uncapped), do not let this ship without an explicit owner-visible cost decision,
mirroring the Pitfall 1 security review.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|--------------------|-----------------|------------------|
| Reusing `toasts.ts` unmodified for the monitor warning (accepting its 6s auto-dismiss) | Fastest path to "something is dismissible" | Warning vanishes while the underlying problem (no monitors configured) is still real — worse than today's stuck-forever bug in a different way | Never — this is the exact bug class the milestone exists to fix |
| Widening `orgs/{orgId}/{allPaths=**}` read to `if true` instead of a new scoped match | Fastest path to "the share link can read the MP3" | Every file the org has ever uploaded becomes world-readable, permanently, with no way to audit who accessed what | Never |
| Skipping `resetOrgScopedStores()` registration for a new store "just for this milestone" | Saves one line per new store | Silent stale-org-data leak the next time anyone switches churches, hard to reproduce/debug later | Never — the fix is one line, there's no scenario where skipping it is worth the risk |
| Native HTML5 drag-and-drop for the stage canvas because it's less code to write | Faster initial desktop-only implementation | Silently broken on touch devices (the ones tech volunteers likely use), discovered late via a real complaint, not a test | Only if the stage-layout feature is explicitly scoped desktop-only for v2.7 — must be a stated decision, not a default |
| `setInterval`-based loop without routing through `runChannel` | Simplest possible loop prototype | Output windows visibly desync from the control window; a real projector shows the wrong slide | Never for anything beyond a local dev spike |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|-----------------|-------------------|
| Firebase Storage (public rehearse reads) | Minting a permanent `getDownloadURL()` token and treating it as revocable | Use short-lived signed URLs (Admin SDK) minted per page-load, or accept the token is effectively permanent and scope/size it accordingly |
| `firestore.rules`/`storage.rules` cross-service checks | Calling `firestore.get()`/`exists()` from `storage.rules` for the new attachment path | Denormalize the needed truth onto Storage custom metadata, or route the read through a server-side Cloud Function that checks Firestore itself |
| YouTube embeds on the public Rehearse page | Eagerly rendering a live `<iframe>` for every attached video on page load | Click-to-load facade/thumbnail that only loads the iframe (ideally `youtube-nocookie.com`) on explicit user interaction |
| Multi-org custom claim | Assuming `selectOrg()`'s claim state is immediately consistent for a non-primary org | The claim only ever tracks the primary org (documented D-01/D-04 limitation) — verify Storage-touching new features against a non-primary-org switch explicitly |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|-----------------|
| `setInterval`-based loop timer drift | Auto-advance timing slowly diverges from the configured interval over a long rehearsal | Prefer chained `setTimeout` re-arming, or accept drift as out of scope for a rehearsal-timing (not music-sync) feature | Noticeable after tens of minutes of continuous looping |
| Public egress with no per-attachment cap | A single popular rehearsal MP3 racks up disproportionate Storage egress billing | Size cap + YouTube-preferred UX + signed URLs with short expiry | As soon as the share link is used by more than a handful of volunteers regularly |
| Freeform canvas writing position on every `pointermove` | Excessive Firestore writes, autosave contention with the rest of the service editor | Debounce persistence to drag-end (mirror the app's existing autosave debounce pattern) | Immediately, at even light usage — this is a correctness/cost issue, not a scale one |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Public read scoped to "org" instead of "the specific shared song/attachment" | Anonymous visitors can read every attachment/background/PPTX source the org has ever stored, not just what's shared | Dedicated, narrowly-scoped Storage path + rule for rehearsal attachments only |
| `storage.rules` reaching into Firestore for the share-check | Repeats the exact deny-everyone-undetectable-locally bug this codebase already shipped once | Denormalized metadata flag or server-side signed-URL issuance instead |
| Long-lived public tokens for potentially copyrighted practice tracks | A leaked/forwarded link keeps serving licensed audio indefinitely, with no revocation path from the client | Short-lived signed URLs, or explicit owner acknowledgment that tokens are effectively permanent for this content class |
| Church switcher UI reimplementing org-context logic ad hoc | Reopens the stale-cross-org-data class of bug, or a claim/Firestore inconsistency, in a NEW code path outside the already-hardened one | Always call the existing `selectOrg()`/`resetOrgScopedStores()` primitives |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|--------------|-------------------|
| Black slide renders as an empty/blank-looking editor row | Planner thinks the insert failed or the song is broken | Give the black slide explicit, distinct chrome in the editor ("Black / Interlude" label) even though it's blank in presentation |
| Loop auto-advance keeps running behind "Go to black" | Slides quietly change while blacked out; lifting black shows an unexpected slide | Explicitly pause the loop while black is active (or document/test the alternative choice deliberately) |
| Monitor-warning auto-clears on a timer instead of on resolution | Warning disappears while monitors are still misconfigured, projectionist unaware | Auto-clear only when the underlying condition resolves; timer-based auto-dismiss is for transient failures, not persistent setup state |
| Stage-layout canvas unusable on the touch device tech volunteers actually carry backstage | Feature effectively unshippable for its real users | Pointer-Events-based implementation, tested on a real touch device before calling the phase done |

## "Looks Done But Isn't" Checklist

- [ ] **Rehearse public read:** Often missing a deny-case proving the SAME anonymous request cannot read a
      background image, PPTX source, or an attachment NOT belonging to a currently-shared service — verify
      with a paired allow/deny test in `src/storage.rules.test.ts`, not just the allow case.
- [ ] **Church switcher:** Often missing registration of any NEW org-scoped store (rehearsal attachments,
      stage layout) in `resetOrgScopedStores()` — verify by switching orgs and confirming the new stores'
      data is empty/reloaded, not stale.
- [ ] **Loop timer:** Often missing a route-away/manual-nav/black-slide interaction test — verify the loop
      stops or disarms correctly, checked in an OUTPUT window, not just the control window.
- [ ] **Black slide:** Often missing an export/print pass-through check — verify the printed order of
      service and the public `ShareView` handle it sensibly (skip, or a clean labeled line), not a blank
      `[not assigned]`-style fallback.
- [ ] **Cost cap:** Often missing a server-side `storage.rules` size cap that mirrors client-side
      validation — verify by attempting an oversized upload directly against the emulator/rules, not just
      through the UI's own validation.

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|-----------------|------------------|
| Storage rule accidentally makes the whole org bucket public | HIGH | Immediately redeploy a corrected `storage.rules`; rotate/replace exposed Storage objects if any contain sensitive content (treat as a real incident, mirroring the 2026-08-06 deny-everyone response posture in reverse — an ALLOW-everyone incident is worse) |
| Church switcher ships without full store reset | MEDIUM | Add the missing store(s) to `resetOrgScopedStores()`, no data migration needed — this is a pure client-state bug, not a data-integrity one |
| Black slide implemented inside the pooled-section model, later found to corrupt numbering | MEDIUM–HIGH | Requires a data migration for any songs that already saved a black slide the wrong way, plus a type change — cheaper to get right the first time (see Pitfall 5) |
| Loop timer desyncs outputs from control | LOW | Client-side bug fix only, no data corruption — reload the output windows to resync |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|-------------------|----------------|
| 1. Public rehearse media exposure | Rehearsal-attachment Storage/rules phase | `storage.rules.test.ts` allow+deny pairs proving scope is limited to shared-song attachments only |
| 2. `firestore.exists()` blind spot repeat | Same phase as (1) | Code review greps the diff for `firestore.` inside `storage.rules`; no cross-service call present |
| 3. Stage-layout drag corruption | Stage-layout canvas phase | Manual/real-device touch drag test; position round-trip test; resize/print consistency test |
| 4. Loop timer leaks/races | Loop/auto-advance phase | Manual-nav-during-loop, item-change, black-slide, and route-away tests checked against BOTH output windows |
| 5. Black slide model corruption | Inline black slide phase | `songSectionOrder`/slideshow-assembler tests for insert/duplicate/delete/reorder; export/print/ShareView pass-through test |
| 6. Notification system collision | Dismissible-messages phase | `toasts.ts`/`ToastHost.vue` generalized or replaced; `RunControlView` monitor banner migrated as proof case |
| 7. Church switcher reset regression | Church-switcher phase | Reuses `selectOrg()`; new stores registered in `resetOrgScopedStores()`; switch-and-verify-cleared test |
| 8. Storage/egress cost blast radius | Rehearsal-attachment upload phase + a pre-ship cost review | Server-side size cap present; YouTube steered as default; signed-URL/expiry decision documented; retention-sweep decision documented |

## Sources

- `.planning/PROJECT.md` — milestone scope, v1.8 cost-hardening history, v1.4/v1.6 drag-and-drop
  corruption history, storage.rules incident record, key decisions log (HIGH — primary project record).
- `storage.rules`, `firestore.rules` — direct read of the current rules, including the documented
  `firestore.exists()`-in-Storage-emulator incident and the claim-only membership pattern (HIGH — primary
  source, current state).
- `CLAUDE.md` — the 2026-08-06 deny-everyone incident writeup and testing-command guidance (HIGH — primary
  source).
- `src/stores/auth.ts`, `src/stores/orgScopedStores.ts` — `selectOrg`/`enterOrgAsSuperAdmin`/
  `resetOrgScopedStores` and the documented "quick 260823-switch-church-cache" bug fix (HIGH — primary
  source, current state).
- `src/stores/toasts.ts`, `src/components/ToastHost.vue` — documented scope-narrowing decision (R041) and
  current auto-dismiss behavior (HIGH — primary source, current state).
- `src/types/slide.ts`, `src/types/songLyrics.ts`, `src/utils/songSectionOrder.ts` — the pooled-section /
  positional-numbering slide model (HIGH — primary source, current state).
- `src/composables/useMediaUpload.ts`, `src/views/ShareView.vue`, `src/views/RunControlView.vue`,
  `src/utils/runChannel.ts`, `src/composables/useRunControl.ts` — existing upload cap pattern, public
  share-page shape, and run-control timer/broadcast discipline (HIGH — primary source, current state).
- [A guide to Firebase Storage download URLs and tokens](https://www.sentinelstand.com/article/guide-to-firebase-storage-download-urls-tokens) — LOW confidence, single web source, supporting context for Pitfall 1/8.
- [Firebase Storage READ security rules: almost pointless, as currently implemented (firebase-js-sdk#5342)](https://github.com/firebase/firebase-js-sdk/issues/5342) — LOW confidence, supporting context for Pitfall 1.
- [What Is youtube-nocookie.com?](https://swarmify.com/blog/what-is-youtube-nocookie/) — LOW confidence, supporting context for Pitfall 1 (YouTube embed risk).
- [Stop Building Silent Toasts: A 5-Minute Guide to aria-live](https://medium.com/@andrescoronel1209/accessible-toast-notifications-with-aria-live-1619ac6f25ba) — LOW confidence, supporting context for Pitfall 6.
- [Defining "Toast" Messages — Adrian Roselli](https://adrianroselli.com/2020/01/defining-toast-messages.html) — LOW confidence, supporting context for Pitfall 6.
- [HTML5 Drag & Drop — Not the API You're Looking For](https://www.sam.today/blog/html5-dnd-the-api-that-is-gaslighting-you) — LOW confidence, supporting context for Pitfall 3.
- [drag-drop-touch-js/dragdroptouch polyfill](https://github.com/drag-drop-touch-js/dragdroptouch) — LOW confidence, supporting context for Pitfall 3.

---
*Pitfalls research for: WorshipPlanner v2.7 (Rehearsal, Stage Plans & Presentation Polish)*
*Researched: 2026-08-31*
