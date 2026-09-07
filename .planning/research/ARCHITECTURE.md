# Architecture Research — v2.14 Integration

**Domain:** Subsequent-milestone integration into a shipped Vue 3 + Firebase worship-planning SPA
**Researched:** 2026-09-07
**Confidence:** HIGH (all findings verified against real source files in this repo, not general patterns)

This is not greenfield ecosystem research. Every recommendation below cites the existing file(s) it
integrates with or replaces, and the "new vs modified" split is explicit per file. Confidence is HIGH
throughout because every claim was checked against the current `src/` tree in this session
(`useOutputWindow.ts`, `useRunControl.ts`, `monitorConfig.ts`, `services.ts`, `stageLayout.ts`,
`StageLayoutEditor.vue`, `firestore.rules`, `service.ts`, `slide.ts`), not inferred from the domain in
general.

---

## 1. Video output — third output role

### Current shape (verified)

The two existing outputs are **not** one parameterized route — they are two structurally identical
sibling files with two static router entries:

- `src/utils/monitorConfig.ts` — `export type MonitorRole = 'audience' | 'confidence'` is the single
  source of truth for the role enum. `MonitorAssignment { fingerprint, role, nickname? }` and
  `MonitorMapping { assignments: MonitorAssignment[] }` are persisted to **`localStorage`** (key
  `wp:runMonitorConfig:v2`), device-scoped, never Firestore (ADR-0183 — deliberate, a monitor
  assignment describes "the physical cable plugged into this device," not shared state).
- `src/views/MonitorSetupView.vue` — role assignment UI; `roleLabel()` hardcodes `'Audience'`/
  `'Confidence'`; `canSave` gates on "at least one Audience assignment."
- `src/composables/useOutputWindow.ts` — the **shared lifecycle core** every output window mounts
  (`role?: MonitorRole` option, fullscreen delegation, wake lock, font-load gate, receive-only
  `RunChannel` binding). `AudienceOutputView.vue` and `ConfidenceOutputView.vue` are thin templates
  over it, diverging only in rendering (single pane vs current+next split, background suppression).
- `src/composables/useRunControl.ts` — the control-side single writer. `windowNameFor()`,
  `urlForAssignment()` (builds `/present/${assignment.role}/${serviceId}?org=...`), `openAllPlaced`/
  `openAllUnplaced`/`openMixed`, the `≥1-Audience` go-live gate (`canGoLive`), the per-role aggregate
  dot (`roleOpen()` — already N-assignment-aware since v2.9, i.e. multiple *same-role* monitors, not
  multiple *role types*).
- `src/router/index.ts` — **two separate static routes**, `/present/audience/:serviceId` →
  `AudienceOutputView.vue` and `/present/confidence/:serviceId` → `ConfidenceOutputView.vue`. There is
  no single dynamic `/present/:role/:serviceId` despite `urlForAssignment` building the role into the
  path — each role is its own route record today.

### Integration plan

**Video is a third value threaded through the existing `MonitorRole` enum, not a parallel system.**
Every file above generalizes the same way v2.9 generalized "audience/confidence" from a fixed pair to
an N-assignment list — this is additive, not a rewrite.

| File | Change |
|---|---|
| `src/utils/monitorConfig.ts` | **Modify.** `MonitorRole = 'audience' \| 'confidence' \| 'video'`. `isValidMapping`'s role check (`'audience' \| 'confidence'`) must widen or the persisted-mapping validator silently drops every Video assignment (T-91-01 untrusted-localStorage-read guard). |
| `src/views/MonitorSetupView.vue` | **Modify.** `roleLabel()` → 3-way switch. `canSave`'s "≥1 Audience" gate is unaffected (Video is optional, same as Confidence today). |
| `src/views/VideoOutputView.vue` | **New.** Sibling of `AudienceOutputView.vue`/`ConfidenceOutputView.vue`, built on the same `useOutputWindow({ role: 'video' })`. Diverges in template only — see banner/fullscreen render below. |
| `src/composables/useOutputWindow.ts` | **Unchanged** (already role-agnostic — `role` only affects `reportFullscreenState`'s postMessage payload). |
| `src/composables/useRunControl.ts` | **Modify, narrowly.** `evaluateOpenResults`'s "audience must open" success gate stays audience-only (unchanged — Video, like Confidence, is optional to go live). `roleOpen('video')` works for free (it's already generic over `MonitorRole`). No structural change needed beyond the type widening. |
| `src/router/index.ts` | **New route.** `/present/video/:serviceId` → `VideoOutputView.vue`, `requiresAuth` only, mirroring the other two — literal third entry, not a dynamic `:role` param (matches existing pattern). |

### Per-item Banner \| Fullscreen routing flag — where it lives

The milestone's own vocabulary ("slide item," matching the Run rail's "item" = one `ServiceSlot`) and
the existing precedent — `MediaAttachableSlot.loop` (`{ enabled, intervalSeconds }`) is already a
**per-slot** field threaded into `RunRow.loop` for the Run rail's loop indicator — point to the same
placement for the new flag:

```typescript
// src/types/service.ts — MediaAttachableSlot, alongside the existing `loop?` field
videoOutput?: {
  mode: 'banner' | 'fullscreen'
}
```

Absent = "not routed to Video" (Video output shows nothing for that item — see open question below).
This is a **slot-level** flag (one item, every slide within it inherits the same mode), not a per-slide
flag — there is no product requirement for a song's slide 3 to be Banner while slide 4 is Fullscreen,
and modeling it any finer would need a UI control per-slide in `SlidesTab`, not per-item.

**Thread path**, mirroring `loop`'s exact precedent:

1. **Authoring** — a control beside the existing per-item Loop checkbox in `SlidesTab.vue` (or its
   item-settings sub-component), editable only in `canEditService.value` (Draft), guarded exactly like
   `onToggleLoop`/`onStageMarkerAdd` in `ServiceEditorView.vue`. Writes `slot.videoOutput` directly on
   `localService.value`, riding the existing single `useAutoSave(localService, ...)` deep-watch — **no
   new save call, no new store, no new rules surface** (same "ride the existing autosave" pattern the
   Phase 107 stage-layout comment documents explicitly).
2. **Rail derivation** — `useRunControl.ts`'s `railRows` computed already maps `item.slot.loop?.enabled`
   into `RailRow.loop`; add `videoOutput: item.slot.videoOutput` the same way, so the Run screen can show
   a small "→ Video (Banner)" chip per item (operator visibility — was this item supposed to show on the
   video feed?).
3. **Output window resolution** — `VideoOutputView.vue` mounts `useOutputWindow({ role: 'video' })`,
   which already exposes `assembledSlideshow` and (via `useServiceAssembly`) the full read-only
   `localService` ref. `AssembledSlide` only carries `slotIndex` (not the slot object itself), so
   `VideoOutputView` resolves the routing flag the same way `useRunControl`'s `currentLoopSlot()` does:
   `localService.value.slots[currentSlide.value.slotIndex]?.videoOutput`. No new wiring needed —
   `useServiceAssembly` already gives every output window the full slot array for free.

### Banner render vs Fullscreen render — compositing model

**This is the one place a naive implementation will silently fail against real hardware, and it is
worth stating plainly even though this file's job is architecture, not pitfalls.**

`Fullscreen` mode is a non-issue: it is the *existing* `AudienceOutputView` render (the canonical
1280×720 stage via `useContainScale`, `SlideCanvas` with background shown) reused verbatim for the
`video` role — same component, same `REFERENCE_WIDTH`/`REFERENCE_HEIGHT` contract already shared by
Audience and Confidence (R329).

`Banner` mode is a **new composition**, not a smaller version of Fullscreen:

- Reuse `useContainScale` (already the shared "fit a fixed-ratio stage into an arbitrary region"
  primitive both existing outputs use) but scope its target container to a **bottom strip** of the
  viewport (e.g. the bottom ~20–25%) rather than the whole screen, and mount `SlideCanvas` into that
  strip only.
- The **rest of the frame** ("alpha transparency…so the video room can composite live video behind")
  cannot be literal browser-window alpha — a Chromium/Edge window handed to an HDMI/SDI capture path
  (Blackbird) always renders as fully opaque pixels; there is no OS-level API this app can call to make
  a browser window's rendered surface carry a real per-pixel alpha channel to external capture hardware.
  The only two implementations that actually work with a hardware keyer are:
  1. **Chroma-key fill** — paint the non-banner region a single, configurable solid color (pure green
     `#00FF00` or magenta, the two hardware-safe choices — not from `SLIDE_FONTS`/typography config,
     a dedicated new setting) and let Blackbird's own chroma-key input do the keying. This is almost
     certainly what "alpha transparency" means in practice for a hardware compositor, and is the
     industry-standard pattern (ProPresenter/vMix/OBS "green screen out" mode).
  2. **Alpha-aware capture path** (e.g. a browser flag / OS window with a punched-out region reported
     via a capture-card driver that understands per-app alpha) — exists on some professional
     video-switcher software but is not something a Chromium tab can opt into; out of scope for a
     browser-based app.
- **Recommendation:** build (1). Add a Video-output config field (Settings or Monitor Setup, org- or
  device-scoped — device-scoped fits the "physical cable" precedent `monitorConfig.ts` already
  established for Audience/Confidence) for the chroma-key color, default a saturated green. This keeps
  the "app-side only, Blackbird is external and verified separately" scope line the owner already drew
  (PROJECT.md v2.14) intact: the app emits a solid, known, capture-safe color; the physical keying is
  Blackbird's job, unchanged from today.
- **Open question for the roadmap/spec phase:** what does the Video output show for an item with no
  `videoOutput` flag at all (most items, in the common case where only a handful of items — e.g. lower
  thirds during a testimony — ever route to Video)? Two candidates: (a) full chroma-key fill (nothing
  shown — the video room sees pure live camera the whole time except flagged items), or (b) black.
  (a) is almost certainly correct given the feature's purpose, but this is a product decision, not an
  architecture one — flag it for `discuss-phase`.

### Build-order dependency (Video output)

`MonitorRole` type widening → `monitorConfig.ts` validator widening → `MonitorSetupView.vue` 3-way UI →
`VideoOutputView.vue` (Fullscreen render, reusing existing patterns — low risk) → per-item
`videoOutput` flag (schema + `SlidesTab` UI + autosave, independent of the output window existing) →
Banner render (the new bottom-strip `useContainScale` region + chroma-key fill — the one genuinely new
piece of rendering code) → `useRunControl.ts` rail-chip wiring (cosmetic, can land any time after the
flag exists). The **flag** and the **output role** are independently shippable and can be built in
parallel by two workstreams; only the Banner *render* strictly needs both.

---

## 2. Editor presence ("who else is viewing")

### Current shape (verified — the absence that matters)

There is **no Realtime Database usage anywhere in this project** (`grep` for `getDatabase`/
`firebase/database`/`onDisconnect` across `src/` and `functions/src/` returned nothing) — Firestore is
the sole data layer, per `.env.local`'s Firebase config and every store in `src/stores/`. This matters
because **Firestore has no `onDisconnect()` primitive** (that is an RTDB-only feature) — a presence
design here cannot rely on "the server notices the socket dropped." It must be a client-driven
heartbeat with client-side staleness filtering, exactly the constraint every Firestore-based presence
implementation (this is a very well-trodden problem outside this codebase too) has to accept.

Two existing precedents in this codebase are directly reusable:

- **Denormalization on write** — `StageMarker` carries `personId` **and** `personName` side by side so
  a read-only renderer (share/print) never needs a join (`src/types/service.ts`). A presence doc should
  denormalize the viewer's `displayName` the same way, since `organizations/{orgId}/members/{uid}`
  already carries `displayName` at invite time (`src/stores/auth.ts` — `patch.displayName =
  user.value!.displayName`) — no new join, no new store subscription just to label the indicator.
- **`route.params`-driven per-service subscription with explicit teardown on change** —
  `ServiceEditorView.vue`'s `watch(serviceId, (newId, oldId) => { if (oldId && oldId !== newId)
  saveStatus.clear(...) })` and the sibling `watch([serviceId, () => authStore.isEditor], () =>
  serviceMessagesStore.subscribeServiceMessages(...), { immediate: true })` are the load-bearing idiom
  to copy. **This is not optional plumbing**: `ServiceEditorView` reads `serviceId` from
  `route.params.id` reactively (line 2543), meaning Vue Router **reuses the mounted component instance**
  when navigating from one service's editor to another's (same route record, different param) —
  `onUnmounted` does **not** fire on that navigation. A presence composable that only cleans up in
  `onUnmounted` will leave a stale "still viewing" ghost on the service the user just left. It must
  `watch(serviceId, ...)` and explicitly delete the *old* service's presence doc before writing the new
  one, exactly like the `saveStatus.clear` precedent above.

### Data model

```
organizations/{orgId}/services/{serviceId}/presence/{uid}
  displayName: string   // denormalized from members/{uid}, avoids a join
  lastSeenAt: Timestamp // serverTimestamp(), refreshed on every heartbeat
```

This is a **true nested subcollection** under `services/{serviceId}`, not a top-level collection with a
`serviceId` field (the `slideGroups` pattern). The precedent for true nesting under `services/{docId}`
already exists: `match /organizations/{orgId}/services/{serviceId}/lockSnapshots/{snapshotId}`
(`firestore.rules`) — presence is a direct sibling of `lockSnapshots`, same shape of rule.

**Doc id = uid**, not an auto-id — one presence doc per (service, person), so a heartbeat is always an
idempotent `setDoc(..., { merge: true })` and a second tab from the same person never creates a
duplicate "ghost viewer."

### Firestore rules

```
match /organizations/{orgId}/services/{serviceId}/presence/{uid} {
  allow read: if isOrgMember(orgId);
  allow write: if isOrgMember(orgId) && request.auth.uid == uid;
}
```

Mirrors `isOrgMember`/`isOrgEditor`'s existing shape exactly (`firestore.rules:18-47`) — every org
member (viewer or editor) can **see** who else is viewing (the feature's whole point — "race-condition
awareness," not an editor-only privilege), but can only **write their own** presence doc. No new helper
function needed.

### Client lifecycle (composable, not a Pinia store)

Recommend `src/composables/useServicePresence.ts`, **not** a new Pinia store registered in
`orgScopedStores.ts`. Rationale: presence is scoped to exactly one mounted view
(`ServiceEditorView.vue`'s header), has no cross-route reactivity requirement, and every comparable
per-view lifecycle concern in this codebase (`useOutputWindow`, `useRunControl`, `useLoopTimer`) is
already a composable, not a store — a new store would be the first `orgScopedStores.ts` registration
whose only consumer is a single view, breaking that file's existing pattern of "stores that outlive
one component."

```typescript
export function useServicePresence(serviceId: Ref<string>, orgId: Ref<string | null>) {
  // onSnapshot(presence subcollection) → otherViewers ref, filtered client-side:
  //   only docs where lastSeenAt is within a soft-TTL window (e.g. 45s) AND uid !== own uid.
  //   A doc that stopped heartbeating (crashed tab, no unmount fired) simply ages out of this
  //   filter — the SAME staleness-tolerant idiom the monitor-reassign delta-match already uses
  //   (matchMapping's 'partial' status), just applied to time instead of screen fingerprints.
  //
  // heartbeat: setDoc({merge:true}) every ~20s while the tab is visible (skip while
  //   document.visibilityState === 'hidden' — mirrors useOutputWindow's handleVisibilityChange
  //   re-acquire-on-return idiom, applied in reverse: pause while hidden, not just resume).
  //
  // watch(serviceId, (newId, oldId) => { if (oldId) deleteDoc(old presence doc); write new },
  //   { immediate: true }) — REQUIRED, see the component-reuse note above.
  //
  // onUnmounted: deleteDoc (final navigation away from any service editor).
  // beforeunload: best-effort deleteDoc (fire-and-forget, mirrors useRunControl's own
  //   beforeunload listener — cannot await inside the handler, but Firestore's SDK will
  //   attempt the write before the tab closes on a fast enough connection; this is
  //   best-effort ONLY, which is why the soft-TTL client-side filter above is the real
  //   correctness backstop, not this handler).
}
```

**Cleanup for docs that never get an explicit delete** (crashed tab, killed process, offline device):
the soft-TTL client-side filter above already makes stale docs invisible to other viewers immediately —
correctness does not depend on deletion. But the docs will accumulate in Firestore indefinitely without
a sweep. This codebase already has the exact infrastructure for that: the `*_CLEANUP_ENABLED`
Cloud Functions retention-cron family (`cleanupExpiredMedia`, `cleanupOrphanBackgrounds`,
`cleanupPptxSources`, all `onSchedule` in `functions/src/index.ts`, all dry-run-by-default, all gated
through the v1.9 Owner Console's Firestore-backed config doc). Add a `cleanupStalePresence` sibling
(e.g. delete anything older than 24h via a `collectionGroup('presence')` query) rather than inventing a
new cleanup mechanism — this is pure hygiene, not correctness, and can ship in the same milestone or be
deferred to backlog without blocking the feature (the client-side filter is what makes the indicator
correct; the cron is what keeps Firestore tidy).

### Where it renders

`ServiceEditorView.vue`'s header (near the date/title, `lines 37-58` region) — small avatar-initial
chips or a "· 2 others viewing" text, one composable call, no new tab/panel. This is a header-only
concern; it does not touch `SlidesTab`, `StageLayoutEditor`, or any other tab content.

### Build-order dependency (Presence)

Firestore rule (new subcollection block) → `useServicePresence.ts` composable (heartbeat + snapshot +
teardown) → `ServiceEditorView.vue` header wiring (one composable call + a small chip component) →
`cleanupStalePresence` cron (independent, can land any time, does not block the feature going live).
No dependency on any other v2.14 feature.

---

## 3. Stage Layout auto-populate from roster

### Current shape (verified)

This is the **best-understood** integration point of the four — the exact data this feature needs
already exists as a computed in `ServiceEditorView.vue`:

```typescript
// ServiceEditorView.vue, already shipped (Phase 107)
const stageBandRoles = computed(() =>
  rosterStore.roles.filter((r) => r.group === 'band').map((r) => ({ id: r.id, name: r.name })))

const stageServingAssignments = computed(() => {
  // one { id, name, roleId, roleName } per PERSON assigned to a band role for THIS
  // service, resolved from resolvedRoleAssignments.value (the roster→schedule
  // resolution already used by the Roles tab), denormalized with name lookups
  // from rosterStore.people
})
```

`stageServingAssignments` is already passed into `StageLayoutEditor.vue` as `assignablePeople` — it is
the manual "pick a person" source in today's edit-marker drawer (`StageLayoutEditor.vue:124-130`,
`orderedPeople`). Auto-populate does not need any new roster-resolution logic; it needs a **seeding
function** that turns this same list into `StageMarker[]` instead of waiting for a human to drag markers
one at a time.

`src/utils/stageLayout.ts` already has every geometry/creation primitive needed:
`createMarker({ label, xPct, yPct, roleId, roleName, zone? })` (mints a marker with a fresh id, deriving
`zone` from position via `zoneFromPosition`), `buildStagePalette(bandRoles)` (the same role→instrument
mapping the palette already uses).

### Integration plan

**New pure function, `src/utils/stageLayout.ts`:**

```typescript
export function autoPopulateMarkers(
  servingAssignments: { id: string; name: string; roleId: string; roleName: string }[],
): StageMarker[] {
  // One marker per (person, role) pair — mirrors stageServingAssignments' own
  // "a person in two roles appears twice" contract (ServiceEditorView.vue comment,
  // line ~4130) so a person double-booked (e.g. plays bass AND sings) gets two
  // markers, matching how the manual picker already treats that case.
  // Layout: a simple deterministic grid/arc within STAGE_BAND (on-stage), one row
  // per role-group ordering (Vocals, then Instruments), so the auto-fill result
  // looks like a plausible stage plan, not a pile of overlapping markers at
  // center-stage (the manual-add cascade offset in StageLayoutEditor.onAddItem
  // is NOT sufficient for N simultaneous markers — it staggers by 2.5% per add,
  // fine for occasional single drops, not for seeding 6-10 markers at once).
}
```

**Trigger point — `ServiceEditorView.vue`, alongside the existing `onStageMarkerAdd`/`onStageMarkerUpdate`
handlers (lines 2302-2338):**

```typescript
function onAutoPopulateStageLayout() {
  if (!canEditService.value) return
  if (!localService.value) return
  const existing = localService.value.stageLayout?.elements ?? []
  if (existing.length > 0) return // NEVER clobber manual placements — see below
  const markers = autoPopulateMarkers(stageServingAssignments.value)
  if (markers.length === 0) return
  localService.value.stageLayout = { elements: markers }
  // rides the existing useAutoSave deep-watch, identical to onStageMarkerAdd — no new save call.
}
```

**Two design decisions the roadmap/spec phase must pin down, both already implied by the milestone
framing ("seeding an empty canvas without clobbering manual placements"):**

1. **When does this run — automatically or on a button?** The stated requirement ("auto-populates…
   instead of an empty canvas") reads as *automatic on first visit to an empty Stage Layout tab*, not a
   manual "Auto-fill" button. Recommend: `watch` the Stage Layout tab's `active` flag (the same
   `v-show="activeTab === 'stage'"` gate already in the template) and call `onAutoPopulateStageLayout()`
   the first time it becomes active for a service with zero elements. **Never re-run once
   `stageLayout.elements.length > 0`** — this is the load-bearing non-clobber guard, and it is trivial
   to enforce because it is the *exact same guard* `onStageMarkerAdd` already needs (`stageLayout ??
   { elements: [] }` init pattern) — just gated the other direction (skip entirely, rather than init-if-
   absent, when already populated).
2. **What happens when the roster assignment changes AFTER auto-populate ran** (e.g. a volunteer swap
   after the layout was seeded)? The non-clobber rule means the seeded markers do **not** live-update —
   they were a one-time convenience seed, and from that point the canvas is exactly as manually-owned as
   if a human had built it from scratch. This matches the milestone's own framing exactly ("seeding…
   without clobbering manual placements" implies one-shot, not a live binding) and avoids the much
   harder problem of diffing/reconciling a freeform canvas against a changing roster. Worth stating
   explicitly in the phase spec so it is not re-litigated as a bug later.

### Build-order dependency (Stage Layout auto-populate)

No dependency on any other v2.14 feature — `stageServingAssignments` and `stageLayout.ts` are both
already shipped (Phase 107, v2.7). This is the **lowest-risk, most self-contained** of the four
features and a good candidate for an early phase: `autoPopulateMarkers()` pure function + unit tests →
`ServiceEditorView.vue` trigger wiring → UAT on the seeded layout's visual layout quality (this is the
one part that needs a human eye — "does the auto-grid look like a plausible stage plan" is not something
a unit test can verify).

---

## 4. Auto-generate service share link

### Current shape (verified — the exact mechanism, not an approximation)

`src/stores/services.ts` already has **two separate functions with two separate contracts**, and this
feature is a matter of calling the right one from a new call site, not building new minting logic:

- **`ensureShareLink(service, orgId)`** (aliased as `createShareToken` for the two existing call sites,
  `ServiceEditorView.vue:3509` and `ServiceCard.vue:209`, both manual "Share Link" button clicks) — the
  full mint-or-adopt-and-write path: checks `serviceShareLinks/{serviceId}` for an existing token,
  else adopts an already-circulated `shareTokens` doc for that service (multi-token de-dup), else mints
  a fresh 144-bit token (`mintShareToken()`), persists it via a transaction, then writes the public
  `shareTokens/{token}` + `serviceShares/{slug}__service-{date}` payloads. **This is the function that
  creates a share link where none existed.**
- **`maybeRefreshShareLink(id, overrides)`** — called automatically today from `updateService()`
  (every autosave) and from the two role-override write paths. It **only refreshes an already-existing**
  link (reads `serviceShareLinks/{id}`, and if it does not exist, sets an in-memory `false` cache flag
  and returns — deliberately structured so "an ordinary edit to a never-shared service" can never
  accidentally publish it, per the function's own doc comment). **This is explicitly NOT the function to
  change** — widening it to auto-create would invert its own documented safety contract.

The correct integration point is therefore: **call `ensureShareLink` automatically from exactly one
more call site**, not modify `maybeRefreshShareLink`.

### Where — the lifecycle moment

`markAsPlanned(id)` (`services.ts:580`) is the Draft→Planned status transition, and it already
establishes the precedent this feature should follow to the letter: it performs a **best-effort,
fail-closed side write that must never roll back the status transition itself** — the `rehearseAccess`
projection write (R377, Phase 125) sits inside its own `try/catch` *after* the status `updateDoc`
already succeeded, logging on failure but not throwing:

```typescript
// services.ts, markAsPlanned — existing code, shown for the pattern to copy
try {
  const rosterStore = useRosterStore()
  // ...
  await writeRehearseAccessDoc(...)
} catch (err) {
  console.error(`markAsPlanned: rehearseAccess projection write failed for service ${id} — the status transition already succeeded`, err)
}
```

**Add a sibling try/catch calling `ensureShareLink(service, orgId.value)` in the same place**, same
fail-closed shape. This is the right lifecycle moment for three independent reasons, not just
convenience:

1. **Consistency with the existing volunteer-visibility gate.** My Schedule / the volunteer rehearse
   view already only ever shows **Planned** (non-Draft) services (v2.12 decision, reusing "the same
   not-Draft/lock gate Run the Service uses"). A share link auto-created at Draft time would exist
   before the service is meant to be externally visible at all — auto-creating it exactly when the
   service crosses into Planned keeps "shareable" and "volunteer-visible" as the same trigger, not two
   different ones a future maintainer has to keep in sync by hand.
2. **`ensureShareLink` is already idempotent and safe to call speculatively.** It checks
   `serviceShareLinks/{id}` first and returns the existing token unchanged if one already exists (from
   a prior manual Share click, or from a prior Plan→Reopen→Plan cycle) — calling it on every
   `markAsPlanned` transition, including a re-Plan after Reopen, never mints a second token or
   orphans the first. No new guard logic needed beyond "call it here too."
3. **It does not remove the manual button.** The existing "Share Link" click on `ServiceEditorView.vue`
   and `ServiceCard.vue` keeps working exactly as today (still calls `createShareToken` →
   `ensureShareLink`, which will now simply return the already-auto-created token instantly instead of
   minting fresh) — this is purely additive, zero risk to the existing manual flow, and the UI copy can
   evolve at leisure (e.g. showing the link immediately once Planned, rather than requiring the click)
   without any store-layer change beyond this one new call site.

### What does NOT need to change

- `writeSharePayload` (the `shareTokens`/`serviceShares` payload writer) — unchanged, reused verbatim.
- `maybeRefreshShareLink` — unchanged; it continues to be the "keep an already-shared service's public
  payload current after every edit" hook, now simply hit sooner in the lifecycle (right after
  `markAsPlanned` creates the link) rather than needing a first manual click before it starts doing
  anything.
- Firestore rules for `shareTokens`/`serviceShareLinks`/`serviceShares` — unchanged. The write still
  originates from an authenticated editor's client SDK exactly as today (`ensureShareLink` is client-
  side, not a Cloud Function); `markAsPlanned` is already an editor-gated client call, so no new rules
  surface is opened.

### Build-order dependency (Auto share-link)

Zero dependency on any other v2.14 feature or on any new schema. This is a **single new call site**
inside an existing, already-tested function — the smallest, safest, and fastest of the four to build,
and a good candidate to land first or in parallel with anything else (it touches only
`src/stores/services.ts`).

---

## Cross-Feature Build Order (for the roadmap)

None of the four features depend on each other's code, but they cluster into three risk/complexity
tiers worth sequencing deliberately:

1. **Trivial, ship first (de-risk the milestone early):**
   - Auto-generate share link (`markAsPlanned` + `ensureShareLink` call) — single call site, existing
     tested primitives.
   - Stage Layout auto-populate — new pure function + one trigger, all dependencies already shipped.

2. **Medium, independent, needs its own rules + composable:**
   - Editor presence — new Firestore subcollection + rule + composable + header UI. No dependency on
     Video output or Stage Layout. Land the rules-and-composable core before the header UI polish so the
     write-scoping/staleness-filter logic gets its own review pass separate from visual design.

3. **Highest complexity, sequence internally before combining:**
   - Video output — sequence as: (a) `MonitorRole` type widening + `MonitorSetupView` UI + bare
     `VideoOutputView.vue` in **Fullscreen-only** mode first (this alone is low-risk, reusing
     `AudienceOutputView`'s exact pattern and is independently demoable/UAT-able), **then** (b) the
     per-item `videoOutput` schema field + `SlidesTab` authoring UI, **then** (c) the Banner render (new
     bottom-strip `useContainScale` region + chroma-key fill config) as the final, riskiest slice — it is
     the only piece of genuinely new rendering code across all four features and the only one whose
     real-world correctness cannot be fully verified without the actual Blackbird hardware (explicitly
     out of this milestone's ownership per the owner's 2026-09-07 scope decision). Do not let (c) block
     shipping (a)+(b) — a Video output that only does Fullscreen is already a complete, useful slice.

**Suggested phase-level dependency graph:**

```
Auto share-link ──────────────────────────────────────────────────► (ship anytime)
Stage Layout auto-populate ───────────────────────────────────────► (ship anytime)
Editor presence: rules+composable → header UI ────────────────────► (self-contained)
Video: MonitorRole widen → MonitorSetupView UI → VideoOutputView(Fullscreen) ─┐
Video: videoOutput schema → SlidesTab authoring UI ───────────────────────────┼─► Banner render (needs both)
                                                                               ┘
```

## Sources

- `src/composables/useOutputWindow.ts`, `useRunControl.ts` (verified in full — the shared output
  lifecycle + control-side single-writer architecture)
- `src/utils/monitorConfig.ts` (verified in full — MonitorRole/MonitorMapping, localStorage persistence
  rationale, ADR-0183)
- `src/views/AudienceOutputView.vue`, `ConfidenceOutputView.vue` (verified in full — the sibling-template
  pattern Video output extends)
- `src/router/index.ts` (verified — the two static `/present/{role}/:serviceId` route entries)
- `src/types/service.ts`, `src/types/slide.ts` (verified in full — `MediaAttachableSlot.loop` precedent
  for the new `videoOutput` field, `StageMarker`'s denormalization pattern reused for presence)
- `src/utils/stageLayout.ts`, `src/components/stage/StageLayoutEditor.vue` (verified — palette/marker
  creation primitives and the existing `assignablePeople` prop, the exact input the auto-populate
  feature needs)
- `src/views/ServiceEditorView.vue` (verified — `stageBandRoles`/`stageServingAssignments` computeds,
  `onStageMarkerAdd`/`onStageMarkerUpdate` handlers, the `watch(serviceId, ...)` teardown-on-navigate
  idiom, the component-reuse-across-param-change behavior this implies for presence)
- `src/stores/services.ts` (verified in full for the share-link section — `ensureShareLink`,
  `writeSharePayload`, `maybeRefreshShareLink`, `markAsPlanned`'s existing fail-closed side-write
  pattern for `rehearseAccess`)
- `firestore.rules` (verified — `isOrgMember`/`isOrgEditor` helpers, the `lockSnapshots` nested-
  subcollection precedent for the new `presence` subcollection, the `rehearseAccess` block's
  live-parent-status-check idiom)
- `functions/src/index.ts` (verified — the `onSchedule` retention-cron family pattern for the optional
  presence cleanup sweep)
- Confirmed absence: no `firebase/database` / Realtime Database usage anywhere in `src/` or
  `functions/src/` — presence must be Firestore-heartbeat-based, not RTDB-`onDisconnect`-based.
- `.planning/PROJECT.md` (v2.14 target-feature list, v2.4/v2.7/v2.9/v2.12/v2.13 milestone summaries for
  historical context on the multi-monitor and stage-layout features being extended)

---
*Architecture research for: WorshipPlanner v2.14 (Services UX Alignment, Dashboard & Live-Stream Output)*
*Researched: 2026-09-07*
