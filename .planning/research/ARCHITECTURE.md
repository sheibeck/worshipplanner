# Architecture Research — v2.7 Feature Integration

**Domain:** Vue 3 + Firebase worship-service planning app (mature codebase, Phase 104+)
**Researched:** 2026-08-31
**Confidence:** HIGH (every integration point below is cited against real files read in this pass, not inferred)

This is **integration research**, not greenfield architecture. All eight v2.7 features are analyzed
against the actual code paths they must slot into. No new framework/library choices are proposed —
every feature reuses an existing mechanism (BroadcastChannel run protocol, org-scoped Firestore/Storage
rules, the slide-group pool/order model, the frozen share-snapshot pattern, the multi-org custom claim).

## System Overview (as it exists today)

```
┌────────────────────────────────────────────────────────────────────────────┐
│  AUTHENTICATED APP (Vue 3 SPA, Pinia stores, Firestore onSnapshot)          │
│                                                                              │
│  ServiceEditorView.vue ── tabs: Service Order | Slides | Roles (slideout)   │
│    └─ SongLyricEditor.vue (Sections list = slide order, D-01/D-03)         │
│    └─ SlideGrid.vue / slideGroupMaterializer.ts / slideshowAssembler.ts    │
│                                                                              │
│  RunControlView.vue ── SINGLE WRITER of wp-run-{serviceId} BroadcastChannel │
│    useRunControl.ts (index/seq/blackout/live/rehearsing state)             │
│    useServiceAssembly.ts (read-only assembled slideshow, shared)           │
│                                                                              │
│  AudienceOutputView.vue / ConfidenceOutputView.vue ── receive-only          │
│    useOutputWindow.ts (onState → index/blackout; NEVER postState)          │
│                                                                              │
│  AppSidebar.vue ── user-menu block (displayName/logout today)              │
└────────────────────────────────────────────────────────────────────────────┘
                          │ Firestore (org-scoped, firestore.rules)
                          │ Storage (org-scoped, storage.rules — claim-only membership)
                          ▼
┌────────────────────────────────────────────────────────────────────────────┐
│  UNAUTHENTICATED PUBLIC SURFACE                                            │
│  ShareView.vue ── reads a FROZEN ServiceSnapshot doc (shareTokens/          │
│    {token} or serviceShares/{slug}__service-{date}), never the live         │
│    org-scoped collections. buildServiceSnapshot() (src/stores/services.ts) │
│    is the ONE place that decides what's in that frozen payload.            │
└────────────────────────────────────────────────────────────────────────────┘
```

Two facts drive almost every design decision below:

1. **The run protocol is a single-writer BroadcastChannel** (`src/utils/runChannel.ts`): control posts
   `{type:'state', index, blackout, seq}`; both output windows apply the *same* `RunState` object. There
   is currently no per-output targeting.
2. **The public share page never touches org-scoped Firestore/Storage rules.** `ShareView.vue` does a
   single `getDoc` against a *pre-built, frozen* snapshot document that is publicly readable by rule
   (`allow read: if true` on `shareTokens/{token}` and `serviceShares/{shareId}`). Everything the public
   page can show must already be denormalized into that snapshot at share-write time — this is the
   existing precedent (`roleAssignments` is a PII-safe name-only projection, not the raw `Person` docs).

---

## Feature 1 — Song rehearsal attachments (PDF/MP3/YouTube)

**Where it lives:** on the `Song` document (`src/types/song.ts`), not the service item — reusable across
every service that uses the song, exactly like `Arrangement`/`themes`/`tags` already are.

### Data model

```ts
// src/types/song.ts — additive field on Song
export interface SongAttachment {
  id: string                                   // crypto.randomUUID()
  kind: 'pdf' | 'mp3' | 'youtube'
  label: string                                 // "Chord Chart", "Reference Track"
  url: string                                   // Storage download-token URL (pdf/mp3) or raw YouTube URL
  storagePath?: string                          // orgs/{orgId}/attachments/{songId}/{attachmentId}/{filename} — pdf/mp3 only, lets a delete revoke the file
  createdAt: Timestamp
}

// Song gains: attachments: SongAttachment[]
```

Mirrors the existing `Arrangement[]` embedded-array-on-Song shape exactly — no new subcollection, no
new store. `useSongStore` (`src/stores/songs.ts`) already owns the full `Song` document lifecycle;
attachments are just another field on the same upsert path.

### Storage

New path `orgs/{orgId}/attachments/{songId}/{attachmentId}/{filename}`, parallel to the existing
`orgs/{orgId}/media/{allPaths=**}` block in `storage.rules`. **Do not reuse the `media/` path** — that
one carries a 50MB cap sized for slide audio/video beds (R014); PDFs/MP3 rehearsal attachments want
their own, smaller cap (recommend 15MB — a chord-chart PDF and a reference MP3 are both well under
this). Add a third `match` block in `storage.rules`, same `isOrgMember(orgId)` read/write gate as the
other two — **no rules change for authenticated in-app access**, this is a pure copy of the existing
pattern (`storage.rules:95-112`).

```
match /orgs/{orgId}/attachments/{allPaths=**} {
  allow read: if isOrgMember(orgId);
  allow write: if isOrgMember(orgId) && request.resource.size < 15728640; // 15MB
}
```

`firestore.rules` needs **no change** — `songs/{songId}` is already `allow read, write: if isOrgEditor(orgId)`
(`firestore.rules:433-444`), and `attachments` is just a new field on that same document, not a new
collection.

### Components / composables

- **New:** `useAttachmentUpload.ts` — a near-verbatim clone of `useMediaUpload.ts`
  (`src/composables/useMediaUpload.ts`), swapping the validate() MIME allow-list (`application/pdf`,
  `audio/*`) and the path/cap constants. Reuse the resumable-upload + `getDownloadURL()` pattern exactly.
- **New:** `SongAttachments.vue` (or a section inside `SongSlideOver.vue`, the song editor slideout) —
  list existing attachments, upload PDF/MP3, add a YouTube URL (no upload, just a validated link field),
  remove (deletes the Storage object via `storagePath` when present).
- **Modified:** `src/stores/songs.ts` gains `addAttachment`/`removeAttachment` actions mirroring the
  existing arrangement CRUD actions already there.

### Where it surfaces (this milestone)

Only inside the app's song editor (attach/manage) and — critically — inside the public Rehearse mode
(Feature 2). **Not** surfaced inside `ServiceEditorView.vue`'s Slides tab — attachments are rehearsal
aids, not presentation content, and stay out of the slide-group model entirely (D001/D002 precedent:
songs are canonical, slides mirror the service order, and this milestone's own decision log says
attachments live "on the Song (stable), reusable across services").

---

## Feature 2 — Rehearse mode on the PUBLIC share page (the trickiest integration)

### The core problem

`ShareView.vue` (`src/views/ShareView.vue:165-188`) does exactly one `getDoc` against a **frozen**
snapshot — it has no Firebase Auth context, no org-scoped store, and firestore.rules would deny it read
access to `organizations/{orgId}/songs/{songId}` even if it tried (`songs` is editor-tier only,
`firestore.rules:433`). There is no live path from the public page to the Song stable at all.

**The share snapshot must therefore carry everything Rehearse mode needs, denormalized, at share-write
time** — this is not a new pattern, it is the *same* pattern `buildServiceSnapshot()`
(`src/stores/services.ts:111-161`) already uses for `roleAssignments` (resolves `personId → name`, embeds
names only, never the raw `Person` doc) and for `bpm` (resolves the song's arrangement BPM into the slot
at snapshot-build time, never re-reads the Song live).

### Design: extend `buildServiceSnapshot()` to carry attachment refs per song slot

```ts
// ServiceSnapshot (src/stores/services.ts) gains, per SONG slot with a songId:
slots: ServiceSlot[]   // SongSlot gains an optional `attachments?: SongAttachment[]` in the SNAPSHOT
                        // ONLY — never on the live ServiceSlot type, mirroring how `bpm` is added to
                        // slotsWithBpm in buildServiceSnapshot without touching ServiceSlot itself.
```

`buildServiceSnapshot()`'s existing `slotsWithBpm` map (`services.ts:122-134`) already does a per-SONG-slot
`songStore.songs.find(...)` lookup — extend that same map to also spread `attachments: song?.attachments ?? []`
onto the slot. Zero new Firestore reads (the song store is already subscribed and consulted for `bpm`).

### The Storage-read problem for an anonymous visitor

Even with attachment metadata inside the snapshot, the PDF/MP3 **file bytes** live under
`orgs/{orgId}/attachments/...`, gated by `isOrgMember(orgId)` in `storage.rules` — an anonymous Rehearse
visitor has no auth token at all, let alone an org claim. Two structurally different fixes exist:

1. **Change storage.rules to allow public read on that one path.** Rejected: this project has a
   documented incident (CLAUDE.md, 2026-08-06) about a mis-scoped Storage rule silently denying/allowing
   the wrong population, and a same-service `firestore.exists()`-gated "is this a valid share" check is
   the exact pattern (`firestore.exists()` inert in the Storage emulator, `storage.rules:8-14`) that
   already burned this project once. A rules-level "is there a live, non-revoked share token for this
   org" check is unverifiable in the emulator for the same documented reason.
2. **Rely on the Storage download-token URL as the capability, and store that URL — not a rules-gated
   reference — inside the frozen snapshot.** This is the recommended path, and it requires **no
   storage.rules change at all**. `getDownloadURL()` (already used verbatim by `useMediaUpload.ts:109`)
   returns a URL carrying a `token` query parameter; Firebase Storage serves that URL to any requester
   holding the URL, independent of `storage.rules`, by design (rules govern the SDK/API surface used to
   *obtain* access; the token URL itself is a bearer capability once minted — the same mechanism this
   app already relies on for the authenticated in-app upload/preview flow). Storing that URL string
   verbatim in the `SongAttachment.url` field (Feature 1) and copying it unmodified into the public
   snapshot (Feature 2) means the Rehearse page just renders `<a :href>`/`<audio :src>` against a plain
   string — no auth, no rules evaluation, no new Cloud Function.

**Call out explicitly as a risk to confirm at implementation time, not now:** a download-token URL is a
bearer secret — anyone who obtains it (by viewing the public Rehearse page's page source, same as any
public share link already exposes the whole `ServiceSnapshot`) can fetch that one file indefinitely,
even after the share link is later revoked (revoking `shareTokens/{token}` stops new snapshot reads, but
does not invalidate an already-issued Storage token). This is an accepted, low-severity residual —
rehearsal PDFs/MP3s are not sensitive content, and it mirrors the same "signed URL as capability"
pattern the project's own `render-service` and PPTX pipeline already lean on. Do not attempt to "fix" it
by rotating tokens on revoke; that is out of scope and unnecessary for this content class.

YouTube attachments need no Storage consideration at all — the raw URL is embedded directly and rendered
as a link/iframe.

### Rehearse UI

- **New:** a "Rehearse" button on `ShareView.vue`, gated on `serviceSnapshot.value.slots.some(s => s.kind === 'SONG' && s.attachments?.length)`.
- **New:** `RehearseView.vue` (or an in-`ShareView` panel, `showRehearse` toggle) — a per-song list
  (song title, attachment chips: PDF opens in new tab, MP3 plays inline `<audio>`, YouTube embeds or
  links out). Reads `serviceSnapshot.value.slots` filtered to `kind === 'SONG'`, exactly the data
  already loaded by `ShareView.vue`'s existing `onMounted` fetch — **no second network round-trip.**
- **Router:** add `/share/:token/rehearse` and `/:slug/service-:date/rehearse` as sibling routes to the
  existing `share`/`service-memorable-share` routes (`src/router/index.ts:148-170`), or keep it a
  same-component toggle (`showRehearse` ref) to avoid a second `getDoc` entirely — **prefer the toggle**,
  since a second route would re-fetch the same snapshot for no benefit and complicate the "share a direct
  Rehearse link" case that isn't a stated requirement this milestone.

### Freshness

The existing "frozen snapshot, refreshed on next editor save via `maybeRefreshShareLink`" cadence
(`services.ts:924, 1001-1004`) applies unchanged — attachments a planner adds after a service was last
shared won't appear in Rehearse until the next share-link refresh, exactly like a role reassignment or a
song swap doesn't appear until then either. No new staleness class is introduced.

---

## Feature 3 — Visual stage layout per service

### Where it lives

A new tab on `ServiceEditorView.vue`, alongside the existing `service-order` / `slides` / `roles` tabs
(`src/views/ServiceEditorView.vue:712-770` — the `role="tablist"` block driven by `activeTab` string ref
and `handleTabKeydown`). Add `svc-tab-stage` following the exact same button/`v-show` panel pattern.

### Data model

**One document per service**, keyed by `serviceId` (mirrors `serviceShareLinks/{serviceId}` and the
1:1 `slideGroups` pattern), **not** nested under `services/{docId}` — a nested subcollection two levels
deep would fall through every existing rules block and hit the global deny (the exact class of bug the
`firestore.rules` comments repeatedly warn about for `slideGroups`/`pptxRenders`). A top-level org-scoped
collection referencing `serviceId` by field is the established, proven-safe shape.

```ts
// src/types/stageLayout.ts (new file)
export interface StageElement {
  id: string
  kind: 'instrument' | 'mic' | 'monitor' | 'diBox' | 'other'
  label: string        // "Acoustic Guitar", "Extra Mic 1", "Podium Mic"
  zone: 'stage' | 'off-stage-left' | 'off-stage-right'   // R: "on-stage and off-stage (side) zones"
  x: number             // 0-100, percent within the zone's canvas
  y: number
  notes?: string
}

export interface StageLayout {
  id: string             // == serviceId
  serviceId: string
  elements: StageElement[]
  createdAt: Timestamp
  updatedAt: Timestamp
}
```

### firestore.rules

Add a dedicated `match /stageLayouts/{serviceId}` block, modeled **exactly** on the existing
`slideGroups/{groupId}` block (`firestore.rules:378-430`): member read, editor write, gated on the
**parent service's stored status being draft** (`parentDraft(serviceId)`) — this keeps Stage locking in
lockstep with Service Order/Slides/Roles, consistent with the v1.4 "a service is editable only while in
Draft" decision already logged in `PROJECT.md`'s Key Decisions table. Unlike `slideGroups`, this is a
single document per service (not one per slot), so the create/update/delete conditions are simpler —
no `hasAll(['serviceId'])` per-entry bookkeeping needed, just the same `parentDraft`/`parentGone` guards.

### Components

- **New:** `StageLayoutEditor.vue` — a freeform absolute-positioned canvas (draggable chips, percentage
  x/y, drop into one of the two/three zones). No new drag library needed if simple pointer-drag suffices;
  SortableJS (already a dependency, used by `SongLyricEditor.vue`/`ServiceEditorView.vue`/`SlideGrid.vue`)
  is list-reorder-shaped, not freeform-canvas-shaped, so this is genuinely new interaction code, not a
  Sortable reuse — flag this as the one sub-feature likely to need its own phase-level design pass
  (drag math, palette of element kinds, zone boundaries) rather than a straight port of an existing
  pattern.
- **New:** `src/stores/stageLayouts.ts` — mirrors `src/stores/slideGroups.ts`'s org-scoped
  subscribe/CRUD shape (see `src/stores/orgScopedStores.ts` for the reset-on-org-switch registration
  every org-scoped store must join).

### Read-only rendering on share/print

Same trickiest-integration shape as Feature 2, at smaller scale: the public `ShareView.vue` cannot read
`stageLayouts/{serviceId}` directly (editor-tier-adjacent rules). **Denormalize into `ServiceSnapshot`**
exactly like `roleAssignments` and (Feature 2's) `attachments` — `buildServiceSnapshot()` gains a
`stageLayout?: { elements: StageElement[] }` field, populated from the already-subscribed stage-layout
store at snapshot-build time. This gives ONE rendering path for both the public share page and any
future in-app print view — no second data shape to maintain. Render as a simple absolute-positioned
`<div>` grid reading the same `x`/`y`/`zone` percentages the editor wrote; genuinely read-only, no drag
code needed on this side.

Note: the app's existing "print" surface (`ServiceEditorView.vue`, `ServiceCard.vue` — `window.print`/
`@media print`, text-only order-of-service) does not currently render any visual/slide content at all.
Extending it to show the stage diagram is a straightforward `@media print` CSS addition once the
snapshot-driven read-only renderer exists — treat it as the same component reused in two contexts, not
two components.

---

## Feature 4 — Inline black slide in the lyric editor

### The exact reuse target

`SongLyricEditor.vue`'s "Sections" list **is** the slide order (D-01/D-03) — a pool
(`LyricSection[]`) plus an ordered reference list (`performanceOrder: string[]`), edited via
`songSectionOrder.ts`'s pure helpers (`addSection`, `moveRow`, `duplicateRow`, `removeRow`). A black
slide is just another **row in that same list** — not a new `ServiceSlot`, not a new service section,
exactly matching the requirement ("without introducing a new blank service section").

### Data model — additive, non-breaking

```ts
// src/types/songLyrics.ts — LyricSection gains:
export interface LyricSection {
  id: string
  label: string
  lines: string[]
  slideBreaks?: number[]
  /** NEW — additive, absent = 'lyric' (every existing section). 'blackout' marks
   *  an inline black/interlude slide: no lyric text, rendered pure black. */
  kind?: 'lyric' | 'blackout'
}
```

No `SourceRef` change needed in `src/types/slideGroup.ts` — a black-slide section is still referenced
via the existing `{ kind: 'lyric', songId, sectionId }` ref shape; only the **resolved content** differs,
decided from `section.kind` at slide-build time.

```ts
// src/types/slide.ts — new Slide variant + widened union
export interface BlackoutSlide extends SlideBase {
  contentKind: 'blackout'
}
export type SlideContentKind = 'lyric' | 'scripture' | 'imported' | 'text' | 'image' | 'video' | 'blackout'
export type Slide = LyricSlide | CopyrightSlide | ScriptureSlide | TextSlide | ImageSlide | VideoSlide | BlackoutSlide
```

### Exact resolution touch points (verified against real code)

`src/utils/slideshowAssembler.ts` builds `LyricSlide` content from a resolved `LyricSection` in **three**
places — all three need the identical one-line branch (`section.kind === 'blackout' → { contentKind:
'blackout' }` instead of the lyric-content object):

1. `resolveEntryContent()`'s `case 'lyric'` branch (~line 179-190) — the stored-group resolution path
   used by Run/Audience/Confidence.
2. The fallback derivation's per-group-split loop (~line 534-545).
3. The fallback derivation's non-split loop (~line 583-591).

### Editor UI

- `SongLyricEditor.vue`'s `ADD_SECTION_KINDS` chip row (`songSectionOrder.ts`, consumed at
  `SongLyricEditor.vue:254-260`) gains a `'Black Slide'` chip calling `onAddSection('BLACKOUT')`, which
  `songSectionOrder.ts::addSection` must special-case to mint a section with `kind: 'blackout'`, empty
  `lines: []`, and an auto label like `"Black Slide"` (numbered on collision, same as other
  auto-labelled sections already are).
- The row rendering (`SongLyricEditor.vue:104-239`) needs one branch: a `kind === 'blackout'` row shows
  a black swatch preview instead of the lyric textarea/split-divider UI — everything else (drag handle,
  position number, Duplicate, Remove, expand/collapse) is unchanged, since those all operate on
  `performanceOrder`/`orderSlotIds`, agnostic to section content.

### Downstream consumption — free by construction

Because Run/Audience/Confidence/print all render through the same `AssembledSlide` → `SlideCanvas.vue` /
`src/components/slides/slideDisplay.ts` pipeline, **no changes are needed in `useRunControl.ts`,
`useOutputWindow.ts`, `RunControlView.vue`, `AudienceOutputView.vue`, or `ConfidenceOutputView.vue`** —
they already iterate `assembledSlideshow` generically. Two small additions are needed at the rendering
leaf:

- `src/components/slides/slideDisplay.ts` — `cardKindFor()`-equivalent narrowing (`:397-400`) needs a
  `contentKind === 'blackout'` branch (today it special-cases only `'lyric'` for the
  LyricSlide/CopyrightSlide split).
- `src/components/slides/SlideCanvas.vue` — one new render branch: pure black fill, no text, honoring
  `audioUrl`/`audioLoop` exactly like every other slide kind already does (so a black interlude slide
  can still carry a bed track — free reuse of `SlideBase.audioUrl`).

The print/text-only order-of-service surface never renders slide *content*, so it needs no change here.

---

## Feature 5 — Loop a service item (per-item flag + interval, auto-advance)

### Where the flag lives

On the `ServiceSlot` itself — every slot kind already shares `MediaAttachableSlot` (`src/types/service.ts:39-61`)
for cross-kind optional fields (`notes`). Add loop config there, same pattern:

```ts
// MediaAttachableSlot gains:
loop?: {
  enabled: boolean
  intervalSeconds: number   // default 10, per the milestone's stated default; dropdown + custom value
}
```

Optional, absent-safe, no migration — identical lifecycle to `notes`/`label` (`stripUndefined` before
Firestore write, per the established pattern noted on those fields).

### Editor UI

A checkbox + interval control next to each item in `ServiceEditorView.vue`'s Service Order tab (same
row real-estate class as the existing per-item notes field, R122/Phase 54) — editor-only, draft-locked
like every other Service Order field (the `firestore.rules` `services/{docId}` `storedStatus() ==
'draft'` gate already covers this; it is a field on the existing `slots` array, no new rules surface).

### Driving the auto-advance without breaking manual nav — the design decision

The loop timer must live in **exactly one place: the control window** (`useRunControl.ts`), because that
composable is the documented single writer of the run channel (`RunControlView.vue`'s own header
comment: "This view is the SINGLE WRITER of wp-run-{serviceId}"). The output windows are receive-only by
design (`useOutputWindow.ts` — "NEVER post state ourselves") and must stay that way; a timer in an output
window would violate that architecture and could race two output windows independently advancing.

Concretely, in `useRunControl.ts`:

- A `watch(currentSlotIndex)` (the composable already derives this) checks whether the *current item's*
  `ServiceSlot.loop?.enabled` is true. If so, arm a `setInterval(() => goBySlide(1) — with wraparound to
  the item's FIRST slide instead of falling through to the next item, not `goByItem`)` at
  `loop.intervalSeconds * 1000`.
- **Manual navigation must disarm/rearm cleanly, not fight the timer.** The existing `postIndex()` choke
  point (every navigation call, keyboard or click, already routes through it — `useRunControl.ts:111-115`)
  is the correct place to reset the interval's clock: any call to `postIndex` while a loop is armed
  restarts the interval from zero, so a manual arrow-key press never fights a stale timer tick landing a
  moment later. This reuses the existing single-choke-point discipline already documented in that file
  ("The ONE place run state is written") rather than adding a second.
- Leaving the item (via `goByItem`/`jumpToSlot` to a different slot) must clear the interval — a `watch`
  on `currentSlotIndex` (not `index`) is the right granularity, since looping is scoped to "this item's
  slides," matching the existing `filmstrip` computed's own item-scoping (`useRunControl.ts:1041-1052`).
- Rehearse mode (`rehearse()`, no output windows opened) should still honor loop for on-screen preview
  parity — the timer logic is agnostic to whether outputs are open, since it only calls `postIndex`.

No `runChannel.ts` protocol change is needed — looping is entirely a control-side navigation decision;
from the channel's perspective it is indistinguishable from the operator pressing the right-arrow key
repeatedly. This is the cleanest possible integration: zero wire-protocol changes, one new composable
concern inside `useRunControl.ts`.

---

## Feature 6 — "Go to black" — Audience-only

### Today's shape

`RunState` (`src/utils/runChannel.ts:26-30`) carries one shared `blackout: boolean` field, applied
identically by both `AudienceOutputView.vue` and `ConfidenceOutputView.vue` via the shared
`useOutputWindow.ts` composable (`blackout` ref set from `state.blackout` in `onState`, rendered as a
full-bleed black overlay in both views — confirmed at `AudienceOutputView.vue:26-35` and
`ConfidenceOutputView.vue:69-77`, both driven by the identical `v-if="blackout"` pattern).

### Two ways to scope it — recommend the smaller one

**Option A (wire-protocol change):** widen `RunState.blackout` to `{ audience: boolean }` or add a second
field, threading it through `runChannel.ts`'s message shape guard, `useRunControl.ts`'s `postBlackout`,
and both output composables. More "correct" long-term if a future feature ever needs confidence-only
blackout too, but touches the shared channel contract, its tests (`RunControlView.output.test.ts`,
`AudienceOutputView.test.ts`, `ConfidenceOutputView.test.ts`, `useOutputWindow.test.ts` all assert on
today's flat shape), and both output views.

**Option B (recommended — minimal, matches the stated requirement exactly):** the requirement is
literally "leave the confidence monitor visible" — a **permanent** product decision, not a per-toggle
choice the operator makes. So `ConfidenceOutputView.vue` simply **stops consuming `blackout` for its
overlay** — delete/guard the `v-if="blackout"` block at `ConfidenceOutputView.vue:69-77` (or gate it
`false` outright), while `useOutputWindow.ts` keeps returning `blackout` unchanged (still needed by
`AudienceOutputView.vue`, and harmless to leave wired for Confidence in case a future milestone wants a
per-output toggle). `RunHeader.vue`'s blackout control (`@toggle-blackout="postBlackout(!blackout)"`,
`RunControlView.vue:27`) gets a relabel ("Blackout audience") for operator clarity but its wiring is
unchanged.

This is the lower-risk, smaller-diff choice — one view loses three lines of template, zero composable/
channel/type changes, zero test-shape changes to the channel contract. Recommend Option B unless a
later milestone actually needs independent per-output blackout.

---

## Feature 7 — System-wide dismissible messages

### What exists today (two divergent, incompatible mechanisms)

1. **`useToasts` (`src/stores/toasts.ts`)** — a real Pinia store, but deliberately narrow ("NOT a general
   notification system," per its own header comment): one array, auto-dismiss after 6s, no manual
   dismiss UI, no priorities/categories.
2. **Ad-hoc `v-if`-gated inline banners with no store at all** — e.g. the `run-reassign-banner`
   ("Your monitor setup changed…", `RunControlView.vue:43-90`), driven by `monitorChanged` (a plain
   composable `ref` in `useRunControl.ts`), cleared **only** by a successful `reopenReassignedOutputs()`
   call — there is no manual dismiss path today, which is precisely the "gets stuck on screen" defect
   the milestone names. `MonitorSetupView.vue`'s `saveOutcome === 'not-persisted-warning'` banner
   (`MonitorSetupView.vue:131`) is the same shape: a local `ref`, no store, no dismiss.

### Design: generalize `useToasts` into the one message store; retire ad-hoc `ref`-gated banners

```ts
// src/stores/toasts.ts → rename/extend to src/stores/notifications.ts (or widen in place)
export interface Notification {
  id: string
  message: string
  variant: 'info' | 'warning' | 'error'
  autoDismissMs?: number      // undefined = sticky until manually dismissed or condition clears
  dismissible: boolean        // true for every toast; true for every banner too, per this milestone's requirement
}
```

Keep the existing `push`/`dismiss` shape (already used across the app for toasts) — widen it to accept
`variant`/`autoDismissMs`/`dismissible`, defaulting to today's toast behavior (`variant:'error'`,
`autoDismissMs:6000`, `dismissible:true`) so every existing `toasts.push(msg)` call site keeps working
unchanged. Add a second call shape for a **state-driven, condition-cleared** notification (the
monitor-warning class): `notifications.setSticky(key, message, variant)` / `notifications.clearSticky(key)`
— a keyed slot (not a growing array) so the SAME banner is replaced/cleared in place rather than
accumulating duplicates on every re-check, and a manual dismiss (`X` button) always works immediately
regardless of whether the underlying condition (e.g. `monitorChanged`) has cleared yet — the two are
independent: dismissing hides it now; the condition clearing prevents it from being re-raised.

### Migration of the two known stuck-banner cases

- `RunControlView.vue`'s `run-reassign-banner`: replace the local `monitorChanged` ref-driven `v-if`
  with `notifications.setSticky('monitor-reassign', ...)` set from `useRunControl.ts`'s
  `onScreensChange()` (where `monitorChanged.value = true` is set today), cleared from the same two
  places that already clear it (`reopenReassignedOutputs`, and a still-matching benign refresh in
  `onScreensChange`) **plus** a manual dismiss button routed through `notifications.dismiss()`.
- `MonitorSetupView.vue`'s `saveOutcome === 'not-persisted-warning'`: same treatment — becomes a sticky
  notification cleared either by a successful save or a manual dismiss.

### Rendering

A single new `NotificationHost.vue` (sibling of/replacing the current toast host, if one exists — check
for `ToastHost.vue` at execution time) mounted once at the app shell, rendering both the auto-dismiss
toast list and any active sticky notifications with a uniform dismiss (`×`) affordance and `variant`
styling. **This is the one feature in this milestone that should ship FIRST** among the "supporting
infrastructure" work — see Build Order below — because Feature 7 is a pure prerequisite for making
Feature 6/monitor-warning fix land cleanly, not the reverse.

---

## Feature 8 — User-menu church switcher

### The two existing mechanisms — reuse both, expose only one

`src/stores/auth.ts` already has everything needed:

- **Regular multi-org member path:** `selectOrg(targetOrgId)` (`auth.ts:674-685`) — validates
  `memberships.value.some(m => m.id === targetOrgId)`, remembers the choice
  (`rememberOrg`/`readRememberedOrg`), resets every org-scoped store
  (`resetOrgScopedStores()`, imported dynamically to avoid an auth↔store import cycle — follow this same
  dynamic-import pattern for any new caller), and reloads org context. Today this is **only** reachable
  from `SelectChurchView.vue`, itself only reached via the router's org-selection gate when there's no
  remembered org. It has never been exposed as a live, in-context switch — this milestone's whole job for
  Feature 8 is exposing it from the user menu instead of leaving it router-gated.
- **Super-admin path:** `enterOrgAsSuperAdmin(targetOrgId)` (`auth.ts:706-718`) — already used from the
  Owner Console's "enter any church" per-row action, sets no membership doc, surfaces a "viewing as
  super-admin" banner (`viewingAsSuperAdmin`), exited via `exitSuperAdminView`. **Already shipped in
  v2.1** — this feature does not touch it; it just needs to keep being the super-admin's route, not
  `selectOrg`.

### Where regular-member and super-admin paths differ (must branch correctly)

`selectOrg` requires the target org to be in the caller's own `memberships` list (a real membership doc
or claim entry) — it is **not** usable for "enter a church I don't belong to." `enterOrgAsSuperAdmin` is
the opposite: it deliberately creates no membership doc and is gated purely on the `superAdmin` custom
claim. The new church-switcher UI must therefore branch on `authStore.isSuperAdmin` /
`authStore.viewingAsSuperAdmin`:

- **Regular member, `memberships.length > 1`:** show "Switch church" in the user menu, listing
  `authStore.memberships` (already the exact `{id, name, active}[]` shape `SelectChurchView.vue`
  renders), calling `selectOrg(id)` on selection.
- **Super-admin already viewing a church via `enterOrgAsSuperAdmin`:** the existing "viewing as
  super-admin" banner + `exitSuperAdminView` affordance is unchanged; the new user-menu entry should
  either be suppressed while `viewingAsSuperAdmin` is true (avoid two competing switch mechanisms
  stacked in the UI) or, if the super-admin ALSO holds real memberships elsewhere, list those via the
  same `selectOrg` path — the two are not mutually exclusive but the UI must not conflate them.

### Component

- **New:** `ChurchSwitcherMenu.vue` (or inline addition to `AppSidebar.vue`'s existing user-menu block —
  `AppSidebar.vue` lines ~58 (`displayName`) / ~221-239 (`logout`) are the exact insertion point: a new
  menu item between the account info and Log out, dropdown/submenu listing `memberships`).
- **Modified:** `AppSidebar.vue` — add the menu entry, gated `v-if="authStore.memberships.length > 1"`.

No Firestore/Storage rules change — this feature is pure client-side reuse of already-shipped,
already-secured mechanisms (the security boundary is the custom claim checked server-side on every
subsequent read/write, exactly as it is today for `SelectChurchView.vue`).

---

## Cross-Cutting Patterns This Milestone Reuses (do not reinvent)

| Pattern | Precedent | Reused by |
|---|---|---|
| Denormalize into the frozen public snapshot rather than granting new public rules access | `roleAssignments` in `buildServiceSnapshot()` | Features 2, 3 |
| Storage download-token URL as a bearer capability, not a rules grant | `useMediaUpload.ts`'s `getDownloadURL()` | Feature 2 |
| Additive optional field on an existing shared interface, absent = old behavior, no migration | `MediaAttachableSlot.notes`, `LyricSection.slideBreaks` | Features 1, 4, 5 |
| One document per service, keyed by `serviceId`, org-scoped top-level collection (not nested) | `serviceShareLinks/{serviceId}` | Feature 3 |
| A brand-new rules block modeled on `slideGroups`' parent-draft gate | `firestore.rules:378-430` | Feature 3 |
| Single-writer BroadcastChannel; outputs stay receive-only | `useRunControl.ts` / `useOutputWindow.ts` | Features 5, 6 |
| One choke-point function for every state mutation (`postIndex`) | `useRunControl.ts:111-115` | Feature 5 |
| Org-scoped store reset on org switch, dynamic import to avoid a cycle | `resetOrgScopedStores()` in `selectOrg`/`enterOrgAsSuperAdmin` | Feature 8 |
| Keyed/sticky store slot vs. growing auto-dismiss array | New for Feature 7 — no existing precedent, first of its kind in this codebase | Feature 7 |

## Anti-Patterns To Avoid In This Milestone

- **Do not** grant `storage.rules` a new public/anonymous read arm for attachments or stage-layout media.
  This codebase has one documented production incident from a cross-service Storage rule
  (CLAUDE.md, 2026-08-06); the download-token-URL approach (Feature 2) sidesteps rules entirely and is
  provably safe by the same mechanism the app's authenticated flows already depend on.
- **Do not** let an output window (`AudienceOutputView.vue`/`ConfidenceOutputView.vue`) originate its own
  navigation state (loop timer, blackout scoping). Both composables' own doc comments state the
  receive-only contract explicitly; violating it for Feature 5 or 6 would reintroduce the exact class of
  race the single-writer design exists to prevent.
- **Do not** widen `ServiceSlot`/`SourceRef` with a brand-new discriminated variant for the black slide
  (Feature 4) when the existing `LyricSection.kind` + resolved-`Slide`-variant approach needs zero
  `SourceRef` change and reuses 100% of the existing pool/order/drag machinery.
- **Do not** build Feature 6 by widening the `RunState` wire protocol unless a second, independent
  per-output toggle is actually needed later — the stated requirement is a permanent product decision,
  not a runtime option, and the smaller diff (Option B) is fully sufficient and lower-risk.

## Suggested Build Order (dependency-honoring)

1. **Feature 7 — dismissible message store** (foundation; several later phases, and the existing
   monitor-reassign banner bug, depend on it existing first — build it before touching Run Control at
   all, so Feature 6's header relabel and any Run-side follow-up land against the new store, not the old
   `ref`).
2. **Feature 8 — user-menu church switcher** (fully independent of everything else in this milestone;
   zero data-model or rules dependency; safe to parallelize with #1).
3. **Feature 6 — "Go to black" audience-only** (small, isolated, no dependency on anything else; do it
   early to bank a quick, low-risk win and validate the notification-store integration on the monitor
   banner while the team is already inside `RunControlView.vue`/`useRunControl.ts`).
4. **Feature 4 — inline black slide in the lyric editor** (self-contained within the song-lyrics/
   slideshow-assembler subsystem; no dependency on attachments or stage layout; do before Feature 5 since
   Feature 5's loop logic should be validated against a slideshow that can already contain a black
   interlude slide — the two features are the most likely to interact during a rehearsal-length item).
5. **Feature 5 — loop a service item** (builds inside `useRunControl.ts`, benefits from #1 already being
   in place for any loop-state messaging, and from #4 existing so looping a song with an inline black
   interlude is exercised).
6. **Feature 1 — song rehearsal attachments** (foundational data model + Storage path; **must land before
   Feature 2**, which consumes it).
7. **Feature 2 — Rehearse mode on the public share page** (hard dependency on #1's `SongAttachment` shape
   and Storage path existing first; also the highest-risk feature in the milestone — schedule it with the
   most buffer, and treat the snapshot-denormalization + Storage-token-URL design above as settled before
   planning starts, not re-litigated mid-phase).
8. **Feature 3 — visual stage layout per service** (independent data model/rules/store, but its
   read-only public rendering reuses the exact denormalization pattern Feature 2 establishes — sequencing
   it after #2 means the team applies a now-proven pattern rather than inventing it twice. The freeform
   canvas UI itself has no dependency on any other v2.7 feature and could be built in parallel with #6/#7
   if a second workstream is available; the *snapshot* half should still land after #2).

Features 1→2 and the "snapshot denormalization" thread through 2→3 are the only hard sequencing
constraints; everything else can be reordered or parallelized by workstream capacity.

## Sources

All findings are grounded in the following files, read in full or in the cited ranges during this
research pass (2026-08-31): `.planning/PROJECT.md`; `src/utils/runChannel.ts`;
`src/composables/useRunControl.ts`; `src/composables/useOutputWindow.ts`; `src/views/RunControlView.vue`;
`src/views/AudienceOutputView.vue`; `src/views/ConfidenceOutputView.vue`;
`src/components/run/RunPreflightPanel.vue`; `src/components/run/RunDisplaysPanel.vue`; `storage.rules`;
`firestore.rules`; `src/types/song.ts`; `src/types/service.ts`; `src/types/slide.ts`;
`src/types/slideGroup.ts`; `src/types/songLyrics.ts`; `src/views/ShareView.vue`;
`src/utils/shareTokens.ts`; `src/stores/services.ts` (`buildServiceSnapshot`, `writeSharePayload`);
`src/stores/toasts.ts`; `src/stores/auth.ts` (`selectOrg`, `enterOrgAsSuperAdmin`, `memberships`);
`src/components/SongLyricEditor.vue`; `src/composables/useMediaUpload.ts`;
`src/utils/slideGroupMaterializer.ts`; `src/utils/slideshowAssembler.ts`;
`src/components/slides/slideDisplay.ts`; `src/router/index.ts`; `src/components/AppSidebar.vue`.

No external/ecosystem research was performed — this is a pure internal-integration analysis per the
milestone context, and every recommendation traces to an existing, already-shipped pattern in this
codebase rather than a third-party library choice.

---
*Architecture research for: v2.7 Rehearsal, Stage Plans & Presentation Polish*
*Researched: 2026-08-31*
