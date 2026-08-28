# Architecture Research

**Domain:** Multi-window live presentation ("Run the Service") integrated into an existing Vue 3 +
Firebase worship-planning app
**Researched:** 2026-08-28
**Confidence:** HIGH (all claims verified against live source in this repo; the two external-API
claims — Firebase Auth default persistence, Window Management API shape — are well-established,
stable browser/SDK behavior, cited below)

## Standard Architecture

### System Overview

This is **pure integration work on top of an already-correct slide engine** (same posture as the
prior v2.2 ARCHITECTURE.md — see that file's opening line). `slideshowAssembler.ts` is untouched.
`PresentationViewer.vue` is refactored (not forked) to expose its slide-rendering guts as a reusable
piece. Everything new is a thin per-role wrapper plus two small client-only utility modules (a
BroadcastChannel protocol, a localStorage-backed device config) — no new Firebase surface, no new
Firestore collection, no Cloud Function.

```
┌───────────────────────────────────────────────────────────────────────────┐
│  Browser window #1 — RUN CONTROL  (/run/:serviceId)                       │
│  ┌─────────────┐  ┌────────────────────────┐  ┌─────────────────────┐    │
│  │ RunOrderRail│  │ SlideCanvas (current)   │  │ SlideCanvas (next,  │    │
│  │ (highlight, │  │  + keyboard/click nav   │  │  static preview)    │    │
│  │  click-jump)│  └────────────────────────┘  └─────────────────────┘    │
│  └─────────────┘            │  currentIndex / blackout state (owned here) │
│         useSlideshowAssembly(service, orgId, {canWrite:false})            │
│         window.open() → placed via Window Management API + monitorConfig  │
└───────────────────────────────────┬─────────────────────────────────────┘
                                     │ BroadcastChannel('wp-run-{serviceId}')
                                     │  { type:'state', index, blackout, seq }
                    ┌────────────────┴────────────────┐
                    ▼                                  ▼
┌────────────────────────────────────┐  ┌────────────────────────────────────┐
│ Browser window #2 — AUDIENCE        │  │ Browser window #3 — CONFIDENCE     │
│ (/present/audience/:serviceId)      │  │ (/present/confidence/:serviceId)   │
│ SlideCanvas fullscreen, chromeless, │  │ SlideCanvas(current)+SlideCanvas   │
│ background ON                       │  │ (next), suppressBackground=true,   │
│ useSlideshowAssembly (own instance, │  │ chromeless. Own useSlideshowAssembly│
│ read-only) + BroadcastChannel       │  │ instance + BroadcastChannel        │
│ (listener only)                     │  │ (listener only)                    │
└────────────────────────────────────┘  └────────────────────────────────────┘

  Standalone, service-independent:  /monitor-setup  →  MonitorSetupView.vue
  → getScreenDetails() → fingerprint each screen → localStorage (per device,
    NOT Firestore, NOT keyed by uid/orgId)
```

All three windows are **separate JS realms** (separate tabs/windows = separate Pinia instances,
separate Firestore listener sets). They are NOT sharing in-memory state — the only cross-window
wire is the BroadcastChannel. Each independently subscribes to the SAME Firestore-backed
`useSlideshowAssembly(service, orgId)` and therefore independently computes the SAME
`AssembledSlide[]` array from the same underlying documents — this is what keeps "control's slide N"
and "audience's slide N" guaranteed identical without ever transmitting slide content over the wire,
only a cheap integer index.

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| `slideshowAssembler.ts` (UNCHANGED) | Pure `service + content maps → AssembledSlide[]` | Reused verbatim by all three windows via `useSlideshowAssembly` |
| `useSlideshowAssembly` composable (UNCHANGED) | Reactive Firestore wiring around the assembler; already supports `canWrite: false` for read-only consumers | Instantiated once per window (control, audience, confidence), each with `canWrite: false` — the run flow never writes slide groups |
| `SlideCanvas.vue` (NEW — extracted from `PresentationViewer.vue`) | Renders ONE `AssembledSlide`'s content (lyric/copyright/scripture/text/image/video) + owns that slide's own audio/video playback | Presentational; takes `slide`, `suppressBackground?`, `interactive?` (gates autoplay-affordance buttons for a non-interactive "next" preview) |
| `PresentationViewer.vue` (MODIFIED) | Existing single-window "Present" preview — chrome, arrows, counter, fullscreen, keyboard, font gate | Refactored to compose `SlideCanvas` internally; zero behavior change at its one existing call site (`ServiceEditorView.vue`'s Slides tab) |
| `RunOrderRail.vue` (NEW) | Order-of-service list, current-item highlighted, click-to-jump | Consumes `service.slots` + a slot-index↔first-slide lookup (see Pattern 3) |
| `RunControlView.vue` (NEW) | Owns `currentIndex`/`blackout`; composes `SlideCanvas`×2 (current+next) + `RunOrderRail`; opens/positions the two output windows; broadcasts state | New route `/run/:serviceId` |
| `AudienceOutputView.vue` (NEW) | Thin: fullscreen `SlideCanvas`, chromeless, background on, listens only | New route `/present/audience/:serviceId` |
| `ConfidenceOutputView.vue` (NEW) | Thin: `SlideCanvas`×2 (current+next), `suppressBackground` forced true, chromeless, listens only | New route `/present/confidence/:serviceId` |
| `MonitorSetupView.vue` (NEW) | Standalone, service-independent: enumerate screens, assign roles, persist per device | New route `/monitor-setup` |
| `runChannel.ts` (NEW) | Typed `BroadcastChannel` wrapper — the control→output command protocol | `src/utils/runChannel.ts` |
| `monitorConfig.ts` (NEW) | Screen fingerprinting + localStorage read/write, mirroring the existing `wp:tagFilter:v2:...` precedent's try/catch discipline | `src/utils/monitorConfig.ts` |
| `serviceSlots.ts` (NEW) | Slot-ordering + first-assembled-slide-index lookup, shared by the rail and (optionally) the assembler | `src/utils/serviceSlots.ts` |

## Recommended Project Structure

```
src/
├── components/
│   ├── PresentationViewer.vue      # MODIFIED — now composes SlideCanvas
│   ├── slides/
│   │   └── SlideCanvas.vue         # NEW — extracted per-slide render + media
│   └── run/                        # NEW folder — Run-mode-only components
│       ├── RunOrderRail.vue        # NEW
│       └── MonitorScreenPicker.vue # NEW — the assign-role UI used by MonitorSetupView
├── views/
│   ├── RunControlView.vue          # NEW — /run/:serviceId
│   ├── AudienceOutputView.vue      # NEW — /present/audience/:serviceId
│   ├── ConfidenceOutputView.vue    # NEW — /present/confidence/:serviceId
│   └── MonitorSetupView.vue        # NEW — /monitor-setup
├── utils/
│   ├── slideshowAssembler.ts       # UNCHANGED
│   ├── serviceSlots.ts             # NEW — sortedSlotsWithIndex(), firstAssembledIndexBySlot()
│   ├── runChannel.ts               # NEW — BroadcastChannel protocol
│   └── monitorConfig.ts            # NEW — localStorage device config + screen fingerprinting
├── composables/
│   └── useSlideshowAssembly.ts     # UNCHANGED — reused by all 3 Run windows
└── router/
    └── index.ts                    # MODIFIED — 4 new routes
```

### Structure Rationale

- **`components/run/`:** groups the Run-mode-only presentational pieces separately from the
  existing `components/slides/` (which is the Slides-tab editing surface) — nothing in Run mode
  writes, so keeping it visually and physically distinct from the editing components avoids any
  temptation to reach for editor-only stores/composables from a live-projection screen.
- **`SlideCanvas.vue` lives in `components/slides/`, not `components/run/`:** it is consumed by
  BOTH the pre-existing `PresentationViewer.vue` (editor-side "Present" preview) and the three new
  Run views — it belongs with the engine, not with either consumer.
- **`utils/` for `runChannel.ts`/`monitorConfig.ts`/`serviceSlots.ts`:** all three are pure,
  framework-agnostic modules with no Firestore/Pinia dependency, matching the existing convention
  (`slideshowAssembler.ts`, `slotTypes.ts`, `scripture.ts` all live in `utils/` for the same reason)
  — easy to unit test in isolation, exactly as the existing assembler test suite does.

## Architectural Patterns

### Pattern 1: Extract a shared `SlideCanvas` rather than fork `PresentationViewer`

**What:** `PresentationViewer.vue` today is one ~600-line component that inlines both "chrome"
(exit button, prev/next, progress pill, fullscreen, keyboard, font-load gate) and "slide content"
(the six `slideKind` branches, the background layer, the `AudioPlayer`/`VideoPlayer` refs and their
autoplay-blocked/error state). Only the SECOND half is what the three new windows need, and each
needs it in a different chrome: control wants nav+rail+preview, audience wants zero chrome, confidence
wants current+next with the background suppressed. Extract that second half into
`SlideCanvas.vue` — props `slide: AssembledSlide | null`, `suppressBackground?: boolean`,
`interactive?: boolean` (gates the "tap to unmute"/"tap to play" affordances, which make no sense on
a confidence-monitor "next slide" preview nobody touches) — and have `PresentationViewer.vue` keep
everything else, rendering `<SlideCanvas :slide="currentSlide" />` in place of its old inline markup.
**When:** Any time three-plus call sites need the identical "how do I paint one AssembledSlide"
logic with different surrounding chrome.
**Trade-offs:** A one-time refactor risk to the one existing, well-tested call site
(`ServiceEditorView.vue`'s Slides tab) — mitigated by `PresentationViewer.test.ts` already existing
and asserting on the same `data-testid` markers, which the extraction must preserve verbatim. The
payoff is that `slideshowAssembler.ts` (pure) + `SlideCanvas.vue` (presentational) together become
the WHOLE reusable engine — nothing about lyric/scripture/copyright/image/video rendering, media
playback, or the R055–R057 background cascade is ever duplicated.

**Example (shape, not literal diff):**
```vue
<!-- SlideCanvas.vue -->
<script setup lang="ts">
const props = defineProps<{
  slide: AssembledSlide | null
  suppressBackground?: boolean
  interactive?: boolean
}>()
// owns audioRef/videoRef, mediaFailed/audioBlocked/videoBlocked, play/pause —
// verbatim logic moved from PresentationViewer.vue, unchanged.
</script>
```
```vue
<!-- PresentationViewer.vue, after -->
<SlideCanvas :slide="currentSlide" interactive />
<!-- background layer, chrome bar, keyboard/fullscreen handling: unchanged, stay here -->
```

### Pattern 2: The "suppress background → black" transform is ONE prop, not a second render path

**What:** `SlideCanvas`'s background layer (today, `PresentationViewer.vue` lines 27–38) reads
`currentBackgroundUrl` and renders it as a CSS `background-image` behind the slide content, else the
root's own `bg-black` shows through unchanged. The confidence monitor's "current+upcoming... with
background images suppressed to black" requirement is satisfied by making that one computed
conditional on a prop: `const currentBackgroundUrl = computed(() => props.suppressBackground ? null
: (!currentVideoUrl.value ? props.slide?.slide.backgroundImageUrl ?? null : null))`. No separate
"confidence renderer" branch exists anywhere — the confidence window is simply
`<SlideCanvas :slide="current" suppress-background />` + `<SlideCanvas :slide="next"
suppress-background />` side by side.
**When:** Any per-role visual variation that is a strict subset/transform of the base render (never
introduce a new content path for it).
**Trade-offs:** None significant — this is exactly what the existing R070 background-cascade comment
already documents as "the single winning value already sitting on the current slide," which is
naturally prop-gateable.

### Pattern 3: `AssembledSlide.slotIndex` is the load-bearing service-item↔slide join

**What:** `assembleSlideshow` already stamps every emitted slide with `slotIndex` — the **original
array index into `service.slots`, independent of `position`** (verified in
`slideshowAssembler.ts:373–377`: slots are paired with their array index BEFORE being sorted by
`position` for assembly, specifically so `slotIndex` reflects provenance regardless of reorder). This
is the exact join the Run Control rail needs and already exists — no new field, no schema change.
**When:** Any UI that needs to answer "which service item does the on-screen slide belong to" or
"jump to this item's first slide."
**Trade-offs:** The rail must independently re-derive the SAME position-sort the assembler uses
internally (`service.slots` sorted by `.position`, paired with original array index) to render items
in on-screen order while still keying off `slotIndex`. Recommend extracting this sort into a small
shared helper (`serviceSlots.ts`, see Data Flow) rather than re-implementing it a second time and
risking drift between the rail's display order and the assembler's own.

**Example:**
```ts
// serviceSlots.ts
export function sortedSlotsWithIndex(service: Service) {
  return service.slots
    .map((slot, index) => ({ slot, index }))
    .sort((a, b) => a.slot.position - b.slot.position)
}

export function firstAssembledIndexBySlot(slides: AssembledSlide[]): Map<number, number> {
  const map = new Map<number, number>()
  slides.forEach((s, i) => { if (!map.has(s.slotIndex)) map.set(s.slotIndex, i) })
  return map
}
```
The rail renders `sortedSlotsWithIndex(service)`; clicking an item looks up
`firstAssembledIndexBySlot(assembledSlideshow.value).get(index)` and, if present, jumps there (a slot
absent from the map has zero assembled slides — e.g. an empty SONG slot — and renders non-clickable).
Highlighting reads the inverse: `assembledSlideshow.value[currentIndex.value]?.slotIndex` tells the
rail which item is "current."

### Pattern 4: BroadcastChannel as the control→output command bus, one-directional by construction

**What:** A single `BroadcastChannel(\`wp-run-${serviceId}\`)` per running service. The control
window posts `{ type: 'state', index: number, blackout: boolean, seq: number }` on every navigation
change; output windows are pure listeners — **they never post `state` messages**, only an optional
`{ type: 'hello' }` announcement on mount, to which the control window replies with its current
state (so a reloaded/reopened output window re-syncs immediately instead of waiting for the next
nav event). This is not just a convention — `BroadcastChannel` (like `postMessage`) never delivers a
context's own message back to itself, so the control window structurally cannot react to a `state`
message it just sent, which rules out an entire class of self-feedback bugs by platform behavior
rather than by application-level bookkeeping.
**When:** Any same-origin, multi-window, one-owner/many-renderers state fan-out where latency and
simplicity both matter more than durability (this state has zero value once the service ends — it is
never written to Firestore, never needs to survive a full app restart).
**Trade-offs:** BroadcastChannel requires no reference to the target windows (unlike `postMessage`,
which needs a live handle to each output `Window` object — awkward if a monitor's window is closed
and reopened mid-service, since the control window would need to detect that and re-acquire a
reference). Its downside — same-origin-only, in this browser tab's lifetime only — is a non-issue
here: every window in this feature is the same app, same origin, same live session.

## Data Flow

### Live navigation flow (the steady-state loop during a service)

```
Projectionist clicks a rail item, or presses → / space in the control window
    ↓
RunControlView's local currentIndex updates (control OWNS this state)
    ↓
runChannel.postState({ index, blackout, seq: seq++ })  — BroadcastChannel, same-tick, in-process
    ↓                                              ↓
Control's own SlideCanvas re-renders    AudienceOutputView / ConfidenceOutputView receive
(current + next preview)                the message, set THEIR OWN local currentIndex, and
                                          SlideCanvas re-renders from THEIR OWN independently-
                                          assembled `AssembledSlide[]` at that index
```

Crucially, **no slide content crosses the channel** — only two integers and a boolean. Each window
already has the full `AssembledSlide[]` resident (via its own live `useSlideshowAssembly` Firestore
subscription), so "jump to slide 14" is a local array index into data every window already holds
identically.

### Bootstrap flow (opening the three windows)

```
User clicks "Run" on a LOCKED service (ServiceCard.vue / ServiceEditorView.vue header — MODIFIED)
    ↓
router.push('/run/' + serviceId)   — ordinary SPA navigation, same tab, no window.open needed
    ↓
RunControlView.vue mounts:
  - subscribes to the service doc (organizations/{authStore.orgId}/services/{serviceId})
  - guards: redirect back to /services/:id if service.status === 'draft' (Run is locked-only,
    mirroring ServiceEditorView's existing `isLocked` computed)
  - reads monitorConfig from localStorage; calls getScreenDetails() (permission-gated) to test
    whether the saved fingerprints still match currently-connected screens
  - IF matched: window.open() both output URLs with `left`/`top` from the matched screens'
    geometry, THEN calls .moveTo()/.requestFullscreen() on each (Chrome/Edge only, confirmed
    target) — the "one click" path
  - IF NOT matched (no permission, no saved config, or a fingerprint miss): opens both windows
    un-positioned (pop-out fallback) and shows a "make fullscreen" prompt per window, OR routes
    the projectionist to /monitor-setup first
    ↓
window.open('/present/audience/' + serviceId + '?org=' + orgId, 'wp-audience', features)
window.open('/present/confidence/' + serviceId + '?org=' + orgId, 'wp-confidence', features)
```

### Auth/org bootstrap in the two output windows — verified, not assumed

Two independent mechanisms both help here, and the design should not rely on either alone:

1. **Firebase Auth itself needs nothing new.** `src/firebase/index.ts` calls `getAuth(app)` with no
   explicit `setPersistence()` call, so it uses the SDK default —
   `indexedDBLocalPersistence` in a browser context — which is genuinely shared storage across
   **every** same-origin tab/window, not merely ones opened via `window.open`. A signed-in user's
   session is already resolvable via `onAuthStateChanged` the instant a new window loads the app
   bundle, with no network round trip (it is reading local IndexedDB). No code change needed for
   auth itself to "survive" a popped-out window.
2. **Org selection (`authStore.orgId`) is the one piece that is NOT automatically durable across a
   fresh window load in the general case.** `stores/auth.ts` deliberately keys the multi-org "which
   church did I pick" choice in `sessionStorage` (`SELECTED_ORG_STORAGE_KEY`), not `localStorage`
   — by design, so a super-admin viewing two churches in two tabs never leaks one tab's choice into
   the other. Per the HTML living standard, a new browsing context opened via `window.open()`
   receives a **copy of the opener's `sessionStorage`** at open time (this does NOT happen for a
   window opened by typing a URL, a bookmark, or `rel="noopener"`) — so as long as `RunControlView`
   opens the output windows via a plain `window.open(url, name, features)` call (never setting
   `noopener` and never doing it from, e.g., a right-click "open in new window"), the picked org
   rides along automatically. **Do not rely on this alone** — it is a spec-guaranteed snapshot, but
   it is fragile to reason about and invisible when debugging ("why is this window showing the
   wrong church"). **Recommendation:** also pass `?org=<authStore.orgId>` explicitly on both output
   URLs (shown in the bootstrap flow above). Each output view reads `route.query.org` and, if
   present and the signed-in user is actually a member of that org, sets it directly — bypassing the
   `/select-church` picker path entirely and making the org an explicit, debuggable, self-documenting
   part of the URL rather than an implicit inherited side-channel. This is strictly additive to the
   existing `authStore.loadOrgContext` machinery, not a new auth surface.

## Scaling Considerations

Not a scaling concern in the traditional sense — this is a single-service, single-session, local
(same-machine, same-browser) feature with at most 3 windows and no new Firestore read/write pattern
beyond what `useSlideshowAssembly` already does 1–3× concurrently (once per window, each a normal
read-only subscription set — no different in kind from a viewer opening the same service in three
browser tabs today, which the app already supports since `/services/:id` has no editor guard).

| Scale | Architecture Adjustments |
|-------|--------------------------|
| One projectionist, one service, one Sunday | Exactly the design above — no adjustment needed |
| A church running two simultaneous services (rare — e.g. two campuses sharing this org) | The `BroadcastChannel` name is scoped per `serviceId` (`wp-run-{serviceId}`), so two Run sessions never cross-talk even in the same browser profile; two independent `monitorConfig` entries could theoretically be wanted per physical device pair, but a device only has one physical monitor pair, so this is a non-issue |
| Firestore read volume | Each window's `useSlideshowAssembly` opens the same handful of listeners (`slideGroups`, `scriptureSlides`, `importedSlides`, `pptxRenders`) already used everywhere else in the app; running 3 windows for the length of one service (minutes, not hours) is negligible against this app's existing per-org document counts |

## Anti-Patterns

### Anti-Pattern 1: Forking `PresentationViewer.vue` into three near-duplicate components

**What people do:** Copy the ~600-line `PresentationViewer.vue` three times (audience, confidence,
control) and hand-edit each copy's chrome.
**Why it's wrong:** Every future slide-kind change (a new content type, a new background rule, a
media-playback fix) would need to land in three drifting copies instead of one. This is the exact
failure mode the extraction in Pattern 1 exists to prevent, and it is the literal opposite of this
milestone's own framing ("reusing vs forking the slide engine").
**Do this instead:** Extract `SlideCanvas.vue` once; every window composes it with different chrome.

### Anti-Pattern 2: Routing slide content or navigation state through Firestore

**What people do:** Since the app is "already realtime" via Firestore `onSnapshot`, write
`currentSlideIndex`/`blackout` onto the service doc (or a new subcollection) and let every window
subscribe to that field.
**Why it's wrong:** Round-trips to Firestore's servers and back (typically 100s of ms, worse on a
church's guest Wi-Fi) are perceptible lag on a live confidence monitor a musician is timing their cue
off of — the entire point of a dedicated control channel is to beat that latency. It also writes
high-frequency, zero-durability, purely-ephemeral UI state into the same document model used for
real service data, mixing concerns that have never been mixed anywhere else in this codebase,
and risks tripping the write path's rules/lock semantics on a document that is otherwise
correctly treated as read-only once `status !== 'draft'`.
**Instead:** BroadcastChannel (Pattern 4) — in-process, same-tick, and this state is by design
never persisted anywhere; when the browser windows close, it is simply gone, exactly as it should be.

### Anti-Pattern 3: Storing the monitor→role assignment in Firestore

**What people do:** Add a `monitorConfig` field to `OrgSettings` or a per-user preferences doc so it
"syncs" like everything else in this app.
**Why it's wrong:** The assignment describes which PHYSICAL cable is plugged into which PHYSICAL
port on THIS machine — it has no meaning for any other device, and syncing it to the org (or even to
the signed-in user) would actively cause bugs: a different volunteer signing into the same fixed
church laptop next week would see a stale/foreign assignment, and the SAME volunteer signing into a
laptop at home would incorrectly inherit a church-projector layout that doesn't exist there. This
mirrors the milestone brief's own framing precisely ("device-specific, not org-specific — so NOT
Firestore") and the existing `OrgSettings` design discipline already established in the v2.2
research (`OrgSettings` is reserved for org-scoped, not device-scoped, values).
**Instead:** `localStorage`, unscoped by uid/orgId (Pattern in Data Flow / device config below),
mirroring the existing `wp:tagFilter:v2:...`/`wp:songTableColumns:v1:...` client-only-preference
precedent already in `stores/songs.ts`.

### Anti-Pattern 4: Assuming Window Management API `ScreenDetailed` objects have a stable hardware id

**What people do:** Persist the raw object (or an object reference / index) returned by
`getScreenDetails()` across sessions, assuming "screen 2" is always the same physical monitor.
**Why it's wrong:** The API deliberately exposes no persistent hardware identifier (privacy-motivated
— MDN/Chrome docs confirm `ScreenDetailed` carries only `label`, `isPrimary`, `isInternal`, and
geometry, no id), and Chrome's own documentation notes `label` can be empty depending on GPU/driver.
Enumeration ORDER across `getScreenDetails().screens` is also not contractually stable session to
session.
**Instead:** Synthesize a fingerprint from what IS available and reasonably stable for a fixed
church setup — `${label || 'unlabeled'}:${width}x${height}:${isPrimary}` — and treat a fingerprint
MISS on next launch as the explicit, expected trigger to re-prompt via `/monitor-setup`, exactly as
the milestone brief specifies ("re-prompt only if the physical monitor layout changed").

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| Window Management API (`window.getScreenDetails()`) | Chrome/Edge only (confirmed target), permission-gated (`window-management`), must be invoked from a user gesture (transient activation) | No fetch/SDK — plain browser API. `screenschange`/`currentscreenchange` events exist for live reconfiguration but are NOT required for v1 (re-prompt-on-launch is sufficient per the milestone's explicit deferral of "instant... auto-detection" refinements) |
| BroadcastChannel API | Native browser API, same-origin only | No polyfill needed — full support in Chrome/Edge, the confirmed target browsers; not usable cross-origin, irrelevant here since every window is this app |
| Firebase Auth (existing) | No change — default `indexedDBLocalPersistence` already covers cross-window session sharing | See Data Flow's Auth/org bootstrap section |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| `RunControlView` ↔ `AudienceOutputView`/`ConfidenceOutputView` | `BroadcastChannel` (Pattern 4), one-directional `state` broadcast + `hello`/reply handshake | No Pinia/store sharing possible or attempted — separate JS realms |
| `PresentationViewer.vue` ↔ `SlideCanvas.vue` | Parent-owned `currentIndex`/props, unchanged prop contract at the existing call site | `PresentationViewer.vue`'s existing `slides`/`isLoading`/`initialIndex` props and `exit` emit are untouched |
| `RunControlView`/output views ↔ `useSlideshowAssembly` | Each window instantiates its own composable instance with `canWrite: false` | Already-supported option (`UseSlideshowAssemblyOptions.canWrite`, default `false`) — no composable change needed. The composable's dev-mode "single call site" tripwire (`activeSlideshowAssemblyInstances`) is scoped PER JS REALM (per tab), so 3 windows × 1 instance each is safe; the discipline that must hold is still "exactly one `useSlideshowAssembly()` call per window" |
| `RunOrderRail` ↔ service data | Reads `service.slots` + `assembledSlideshow` via the new `serviceSlots.ts` helpers (Pattern 3) | No new store — pure derivation from data already flowing into the view |
| "Run" entry point ↔ router | New button on the locked service surface (`ServiceCard.vue` and/or `ServiceEditorView.vue` header, MODIFIED), gated on the same `status !== 'draft'` predicate `ServiceEditorView.vue`'s `isLocked` already computes | `router.push({ name: 'run', params: { serviceId } })` — ordinary same-tab navigation; the multi-window fan-out only begins once `RunControlView` itself mounts |

## Sources

- Direct source inspection (HIGH — read against the live repo, 2026-08-28): `src/utils/slideshowAssembler.ts`,
  `src/components/PresentationViewer.vue`, `src/composables/useSlideshowAssembly.ts`,
  `src/router/index.ts`, `src/types/slide.ts`, `src/types/service.ts`, `src/stores/auth.ts`,
  `src/firebase/index.ts`, `src/views/ServiceEditorView.vue` (isLocked, PresentationViewer mount,
  orgId/serviceId resolution), `src/stores/songs.ts` (localStorage precedent).
- `C:\projects\worshipplanner\.planning\PROJECT.md` (HIGH — v2.4 milestone scope, owner decisions:
  Chrome/Edge-only target, projectionist role concept, locked-only gate, deferred blackout button
  and non-Chromium detection).
- `C:\projects\worshipplanner\.planning\research\ARCHITECTURE.md` (v2.2, read for codebase-shape
  conventions only — e.g. `OrgSettings` vs subcollection discipline, per-user/org localStorage
  precedent naming).
- [MDN: ScreenDetailed](https://developer.mozilla.org/en-US/docs/Web/API/ScreenDetailed) and
  [ScreenDetailed.isPrimary](https://developer.mozilla.org/en-US/docs/Web/API/ScreenDetailed/isPrimary)
  (HIGH — official browser API reference, confirms `label`/`isPrimary`/no persistent id).
- [Chrome for Developers: Manage several displays with the Window Management API](https://developer.chrome.com/docs/capabilities/web-apis/window-management)
  (HIGH — official vendor docs, confirms permission gating, `label` can be empty, Chrome/Edge scope).
- Firebase Auth default web persistence (`indexedDBLocalPersistence`, shared across all same-origin
  tabs/windows) and the HTML living standard's `sessionStorage`-copy-on-`window.open()` behavior
  (HIGH — stable, well-documented platform/SDK behavior, not project-specific).

---
*Architecture research for: multi-window live presentation mode integration (v2.4 Run the Service)*
*Researched: 2026-08-28*
