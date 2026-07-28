# Phase 23: Presentation Preview Mode - Research

**Researched:** 2026-07-25
**Domain:** Full-screen presentation viewer integrating existing slideshow-assembly and media-playback pieces (Vue 3 + TypeScript + Tailwind v4)
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

No `## Decisions` section exists in `23-CONTEXT.md` — this phase's CONTEXT.md instead
carries direct migrated-spec content (Goal, Requirements, Error Handling Strategy, Risks,
Technical Constraints, Integration Points, Testing Requirements, Acceptance), reproduced
verbatim below since it functions equivalently to locked decisions for planning purposes:

- **Error Handling Strategy — graceful degradation on missing media:** if media fails to
  load (deleted, network error), the preview shows the slide's text/content and skips the
  media rather than blocking or breaking the slideshow. Includes the case where a media
  file was cleaned up by the 2-week retention policy.
- **Risks and Unknowns — browser media autoplay:** audio/video auto-play behavior varies
  across browsers and may require a user interaction to start. The preview must handle
  browsers that block autoplay until the user interacts.
- **Technical Constraints:** Browser auto-play policies may require user interaction for
  media — the preview needs graceful handling for this.
- **Integration Points:** Firebase Firestore (reads the assembled service slideshow),
  Firebase Storage (serves media URLs for playback), reuses the audio/video playback
  components produced in Phase 22.
- **Testing Requirements:** Manual browser verification of presentation preview with media
  playback; verification of graceful degradation when media is missing/deleted.
- **Acceptance:** A user can open a full-screen preview of the complete service slideshow,
  advance through all slide types, and see/hear media playback.

### Claude's Discretion

No explicit `## Claude's Discretion` section in CONTEXT.md. However, `23-UI-SPEC.md`
(already written and authoritative per the task's `files_to_read`) resolves nearly every
visual/interaction decision this phase would otherwise leave to discretion — see that
document for Design System, Typography, Color, Copywriting, and Component-Specific Notes.
Two items UI-SPEC itself leaves as explicit planner discretion (marked "unresolved"/
"backstop" there): the congregational-scripture empty-`sections` fallback behavior, and
whether long-text/many-exchange overflow needs a shrink-to-fit treatment (see Open
Questions below).

### Deferred Ideas (OUT OF SCOPE)

None listed in `23-CONTEXT.md` directly. Related but explicitly out-of-scope-for-this-phase
items recorded in `STATE.md`'s "Deferred UI Follow-up" section (a separate future Phase 24
candidate, NOT this phase): moving `SlideshowPreview` into its own tab, showing empty
section headers, rendering formatted (not just text) slide previews in the editor, and
allowing slide decks/media to be inserted at any point in the service. None of these affect
the full-screen presentation viewer itself — do not action them in this phase's plan.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-------------------|
| R016 | Presentation preview mode with full-screen view, manual advance, and media playback — volunteers preview the complete slideshow before Sunday. | Architecture Patterns (Patterns 1-4), Code Examples, Common Pitfalls 1-4, Validation Architecture's R016 test rows — full-screen enter/exit mechanics, keyboard navigation, imperative media play/pause driving, graceful degradation on missing media, autoplay-blocked affordances all traced to existing `AudioPlayer`/`VideoPlayer`/`useSlideshowAssembly` contracts. |
| R018 | Polished, intuitive UX reusing existing app design patterns (supporting, cross-cutting). | `23-UI-SPEC.md` (authoritative, already written) governs all visual/copy decisions; this research's Architecture Patterns section documents reuse of `CongregationalEditor.vue`'s Leader/Congregation convention, `SlideshowPreview.vue`'s empty/loading copy, and the project's existing Teleport/dark-theme/spinner conventions rather than inventing new patterns. |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

`./CLAUDE.md` exists and contains two directives, both operationally relevant to this
phase's planning even though neither blocks the feature itself:

1. **graphify usage:** Query `.planning/graphs/graph.json` before grepping raw source for
   codebase questions. **Applied and found stale for this phase** — `gsd-tools graphify
   status` reports the graph is 171 commits behind HEAD (built 2026-07-22, before Phases
   20-23 existed); a query for "presentation" returned only an unrelated Phase 06 doc
   reference. This research relied on direct source reads (`useSlideshowAssembly.ts`,
   `slideshowAssembler.ts`, `slide.ts`, `AudioPlayer.vue`, `VideoPlayer.vue`, etc.) instead,
   which produced complete, current, and load-bearing findings. The planner should run
   `/gsd:graphify build` after this phase's code lands, per CLAUDE.md's own instruction to
   keep the graph current after modifying code — but should NOT rely on the graph query
   during planning for this phase.
2. **`.env.local` requirement:** Required in every worktree; the canonical copy lives in
   the main checkout. **Not a blocker for this phase** — per `STATE.md`, execution runs in
   the MAIN worktree (no git worktree isolation, branch `milestone/M001`), and `.env.local`
   is confirmed present there. No setup step needed in the plan.

## Summary

This phase is a pure integration phase: every data source and playback primitive it needs already exists and was purpose-built for this moment. `useSlideshowAssembly` (Phase 20) already returns a flat `AssembledSlide[]` via its `assembledSlideshow` computed (currently unused by `ServiceEditorView`, which only destructures `assembledSections`); `AudioPlayer`/`VideoPlayer` (Phase 22) already expose imperative `play()`/`pause()` plus a `play`/`autoplay-blocked` event contract explicitly documented in their own source comments as "Phase 23's presentation driver calls the exposed `play()` on slide entry." The only genuinely new code is `PresentationViewer.vue` (or whatever name the planner assigns): a Teleport-mounted, keyboard-and-Fullscreen-API-driven index walker over the flat slide array, reusing every visual convention already established (dark theme, Leader/Congregation colors from `CongregationalEditor.vue`, spinner from the same, `data-testid` conventions, Teleport test pattern from `PptxImportModal.test.ts`).

The two things that need genuine new logic (not just wiring) are: (1) the chromeless mode on `AudioPlayer`/`VideoPlayer` — both currently always render native `controls`, and the UI-SPEC requires a `chromeless` prop to omit that for full-screen driving — and (2) autoplay orchestration on slide transition (call `.pause()` on the outgoing media ref before advancing, call `.play()` on the incoming slide's ref after mount, and surface the existing `autoplay-blocked` event as the UI-SPEC's "Tap to play" / "Playing muted — tap to unmute" affordances). Fullscreen itself is a native browser API with a documented promise-rejection fallback path already specified in the UI-SPEC (fall back to a fixed-position overlay). Nothing in this phase requires a new npm package.

**Primary recommendation:** Build `PresentationViewer.vue` as a single new component teleported to `body`, consuming `assembledSlideshow` (flat) from `useSlideshowAssembly`, driving `AudioPlayer`/`VideoPlayer` refs imperatively via a `chromeless` prop added to both, and treating "true fullscreen" as an enhancement over a mandatory CSS-overlay fallback rather than a requirement — the feature must work identically whether or not `requestFullscreen()` succeeds.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Slideshow assembly (ordering, content resolution) | API/Backend-adjacent (composable over Firestore reads) | — | Already owned entirely by `useSlideshowAssembly` (Phase 20); this phase only consumes its `assembledSlideshow` output, never re-derives ordering |
| Full-screen presentation UI (navigation, chrome, keyboard) | Browser/Client | — | Pure client-side view state (current index, fullscreen state, chrome visibility) — no new persistence, no new Firestore writes |
| Media playback orchestration (play/pause/autoplay-blocked) | Browser/Client | — | Driven entirely by imperative calls on existing `AudioPlayer`/`VideoPlayer` component refs; no server involvement |
| Media URL resolution / expiry | Database/Storage (Firebase Storage, Phase 22) | Browser/Client (graceful degrade) | URLs are already resolved onto the assembled slide by the Phase 20/22 assembler; this phase only reacts to a `@error` from the `<audio>`/`<video>` element (URL 404/expired) — it does not re-fetch or validate URLs itself |
| Entry point CTA | Browser/Client (`SlideshowPreview.vue` header, mounted inside `ServiceEditorView`, app-shell tier) | — | Existing dark app-shell zone; no tier change |

## Standard Stack

### Core
No new libraries. This phase uses only what is already installed:

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| vue | ^3.5.29 (installed) [VERIFIED: package.json] | `<script setup>` composition, `Teleport`, `computed`/`ref`/`onMounted`/`onUnmounted` | Already the project's only framework |
| @vue/test-utils | ^2.4.6 (installed) [VERIFIED: package.json] | Component tests, `DOMWrapper`/`enableAutoUnmount` for the teleported viewer | Established project test pattern (see `PptxImportModal.test.ts`) |
| tailwindcss | ^4.0.0 (installed) [VERIFIED: package.json] | Presentation viewer styling (pure-black canvas, chrome overlays) per UI-SPEC | Already the project's only styling system |

### Supporting
None required — no new runtime dependency, no polyfill package. The Fullscreen API (`Element.requestFullscreen`, `document.exitFullscreen`, `fullscreenchange` event) is a native, unprefixed browser API in all evergreen browsers (Chrome/Edge/Firefox/Safari) as of 2024+; no vendor-prefix shim is needed for the target audience (church volunteers on modern desktop/tablet browsers). `[CITED: developer.mozilla.org/en-US/docs/Web/API/Fullscreen_API]`

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Hand-rolled fixed-overlay fallback | A fullscreen polyfill library (e.g. `screenfull`) | Adds a dependency for a ~15-line native-API wrapper the UI-SPEC already fully specifies (try `requestFullscreen()`, catch/reject → CSS overlay fallback). Not justified for this scope. |
| Native `<audio>`/`<video>` imperative control (existing pattern) | A dedicated presentation/slideshow library | The project already has a bespoke unified slide model (D001/D019) with a purpose-built assembler; a generic slideshow library would fight that model, not simplify it. |

**Installation:** None — no `npm install` needed for this phase.

**Version verification:** All versions above read directly from the project's committed `package.json`; no registry lookup needed since nothing new is being added.

## Package Legitimacy Audit

**Not applicable — this phase installs zero external packages.** No `npm install` step exists in this phase's scope; all functionality is built from already-installed Vue 3 + native browser APIs (Fullscreen API, `HTMLMediaElement`, `KeyboardEvent`). The Package Legitimacy Gate is skipped per its own trigger condition ("whenever this phase installs external packages").

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

```
ServiceEditorView.vue (Music tab)
   │
   │  useSlideshowAssembly(localService, orgIdRef)
   │  ──> { assembledSlideshow, assembledSections, isLoading }
   │
   ├─ SlideshowPreview.vue (existing, inline card list — unchanged)
   │      header row: "Present Slideshow" CTA (NEW)
   │      disabled when assembledSlideshow.length === 0
   │
   └─ [click] ──> togglePresentation(true)
                     │
                     ▼
          <Teleport to="body">
            <PresentationViewer
              v-if="presenting"
              :slides="assembledSlideshow"     <!-- flat array, index-based nav -->
              @exit="togglePresentation(false)"
            />
          </Teleport>
                     │
                     ▼
     ┌───────────────────────────────────────────────────────┐
     │ PresentationViewer.vue (NEW)                           │
     │                                                         │
     │  onMounted: viewerRootEl.requestFullscreen()            │
     │     .then(ok) / .catch(fall back to fixed inset-0 overlay) │
     │  addEventListener('fullscreenchange') → sync exit       │
     │  keydown on viewer root: →/Space=next, ←/Backspace=prev,│
     │     Esc=exit                                            │
     │                                                         │
     │  currentIndex (ref) ──> currentSlide = slides[currentIndex] │
     │     │                                                   │
     │     ├─ renders slide content by contentKind              │
     │     │    (lyric/copyright/scripture/text/image)         │
     │     │    - congregational scripture: reuse Leader/       │
     │     │      Congregation block pattern from               │
     │     │      CongregationalEditor.vue                      │
     │     │                                                   │
     │     ├─ if slide.videoUrl: <VideoPlayer chromeless        │
     │     │      ref="mediaRef" @autoplay-blocked=.../>        │
     │     ├─ if slide.audioUrl: <AudioPlayer chromeless         │
     │     │      ref="mediaRef" @autoplay-blocked=.../>        │
     │     │      on @error: hide media, show "Media unavailable"│
     │     │                                                   │
     │     └─ watch(currentIndex): outgoingRef?.pause();        │
     │             nextTick(); incomingRef?.play()               │
     │                                                         │
     │  bottom chrome bar: progress pill "{section} · N / M",  │
     │     prev/next chevrons (disabled at ends, no wrap),     │
     │     auto-hide after 3s idle (mousemove/keydown resets)  │
     └───────────────────────────────────────────────────────┘
```

### Recommended Project Structure
```
src/
├── components/
│   ├── PresentationViewer.vue     # NEW — full-screen viewer, teleported
│   ├── SlideshowPreview.vue       # MODIFIED — add "Present Slideshow" CTA to header
│   ├── AudioPlayer.vue            # MODIFIED — add `chromeless` prop
│   └── VideoPlayer.vue            # MODIFIED — add `chromeless` prop
├── views/
│   └── ServiceEditorView.vue      # MODIFIED — destructure assembledSlideshow, own `presenting` ref, mount PresentationViewer
└── components/__tests__/
    ├── PresentationViewer.test.ts # NEW
    ├── AudioPlayer.test.ts        # MODIFIED — chromeless assertions
    └── VideoPlayer.test.ts        # MODIFIED — chromeless assertions
```

### Pattern 1: Teleport + DOMWrapper test pattern (established, Phase 21)
**What:** Modal/overlay components render via `<Teleport to="body">`; tests use `DOMWrapper(document.body)` + `enableAutoUnmount(afterEach)` instead of asserting against the mount wrapper directly (Teleport content is not a descendant of the mounted component's own root in the test DOM tree).
**When to use:** `PresentationViewer.vue`, since it teleports to body per the UI-SPEC's stated mounting mechanic.
**Example:**
```typescript
// Source: src/components/__tests__/PptxImportModal.test.ts (existing project pattern)
import { mount, flushPromises, DOMWrapper, enableAutoUnmount } from '@vue/test-utils'

// The component renders via <Teleport to="body">, so all assertions
// go through body(), a DOMWrapper over document.body. Auto-unmount clears
// document.body before the next test mounts.
enableAutoUnmount(afterEach)
function body() {
  return new DOMWrapper(document.body)
}
```

### Pattern 2: Imperative media-ref driving (established, Phase 22 — designed for this phase)
**What:** `AudioPlayer`/`VideoPlayer` expose `play()`/`pause()` via `defineExpose`; they never set the native `autoplay` attribute themselves. The presentation driver holds a `ref` to the current slide's player and calls `.play()` after mount / `.pause()` before navigating away.
**When to use:** Every slide transition in `PresentationViewer.vue`.
**Example:**
```typescript
// Source: src/components/VideoPlayer.vue (existing, doc comment states this explicitly)
// "Never loops (stop-at-end), no `autoplay` attribute — Phase 23's
//  presentation driver calls the exposed `play()` on slide entry."
const mediaRef = ref<InstanceType<typeof VideoPlayer> | InstanceType<typeof AudioPlayer> | null>(null)

watch(currentIndex, async (_new, _old) => {
  // pause the OUTGOING element first (captured before currentIndex changes
  // re-renders the template and swaps mediaRef to the new slide's element)
  await nextTick()
  mediaRef.value?.play?.()
})
```

### Pattern 3: Autoplay-blocked affordance (established contract, Phase 22)
**What:** Both players catch `NotAllowedError` from `play()`, emit `autoplay-blocked`, and show their own internal "Play audio"/"Play video" affordance button (a user-gesture retry). `VideoPlayer` additionally retries once muted before giving up (muted autoplay is broadly permitted by browser policy) and emits `autoplay-blocked` in BOTH the muted-success and muted-failure cases — **the driving layer must distinguish these two cases by checking the video element's `.muted` state, not a second event** (this is an explicit locked decision recorded in STATE.md: *"VideoPlayer autoplay-fallback: muted-retry success and muted-retry failure both emit 'autoplay-blocked'; driving layer distinguishes by element muted state, not a second event"*).
**When to use:** `PresentationViewer.vue`'s `@autoplay-blocked` handler on the video ref.
**Example:**
```typescript
// Source: src/components/VideoPlayer.vue (play() implementation)
function onAutoplayBlocked() {
  const el = mediaRef.value?.$refs?.videoEl as HTMLVideoElement | undefined
  // If the element's own .muted became true, the muted retry SUCCEEDED
  // (it IS playing, silently) -> show "Playing muted — tap to unmute" chip.
  // If .muted is still false, both attempts failed -> show full "Tap to play video" overlay.
}
```
Note: `VideoPlayer` does not currently `defineExpose` its internal `muted` ref or the raw element — the planner should add an exposed `isMuted` computed (or expose the element ref) so the driving layer can distinguish the two cases without reaching into internals.

### Pattern 4: Congregational Leader/Congregation rendering (established, Phase 19/20)
**What:** `CongregationalEditor.vue`'s preview panel renders `ScriptureSlide.sections` (when `readingMode === 'congregational'`) as alternating blocks: Leader lines bold/indigo (`text-indigo-300`/`text-indigo-400`, font-semibold), Congregation lines regular/amber, indented (`pl-4` in the editor, UI-SPEC scales to `pl-8` at presentation size).
**When to use:** Rendering a `ScriptureSlide` in `PresentationViewer.vue` when `sections` is present and non-empty.
**Example:**
```vue
<!-- Source: src/components/CongregationalEditor.vue lines 102-121, scaled per UI-SPEC -->
<span :class="section.speaker === 'LEADER' ? 'text-indigo-300' : 'text-amber-300'">
  {{ section.speaker === 'LEADER' ? 'Leader:' : 'Congregation:' }}
</span>
<span :class="section.speaker === 'LEADER' ? 'text-gray-100 font-semibold' : 'text-gray-300 font-normal pl-8'">
  {{ section.text }}
</span>
```

### Anti-Patterns to Avoid
- **Re-deriving slide order/content in the viewer:** Do not re-implement any part of `assembleSlideshow`'s ordering logic inside `PresentationViewer.vue`. It must consume `assembledSlideshow` (already ordered, already resolved) as a flat prop and do nothing but walk an index.
- **Setting the native `autoplay` attribute on `<audio>`/`<video>`:** Both components deliberately omit it; autoplay is always driven imperatively so the presentation driver has full control over timing and pause-on-navigate-away.
- **Binding `keydown` on `window`:** The UI-SPEC explicitly calls for binding on the viewer root element, not `window`/`document`, "to avoid leaking listeners when the viewer isn't mounted." (Contrast with the existing `document.addEventListener('keydown', ...)` pattern in `ServiceEditorView.vue`'s undo-shortcut handler — that one is acceptable there because the view itself is always mounted for the component's whole lifetime; a modal/overlay component should scope more tightly.)
- **Wrapping index navigation:** UI-SPEC explicitly requires stop-at-ends (no wrap from last slide back to first) — this differs from a typical carousel and must not default to wrap-around.
- **Treating `requestFullscreen()` rejection as an error state:** It is an expected, common outcome (embedding context, missing user gesture in some browsers' interpretation, iOS Safari restrictions) — the UI-SPEC treats the CSS-overlay fallback as an equally valid, fully-functional presentation mode, not a degraded error path.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Cross-browser fullscreen vendor prefixing | Custom `webkitRequestFullscreen`/`mozRequestFullScreen` detection shims | Bare `element.requestFullscreen()` + `document.exitFullscreen()` + `document.fullscreenElement` | All evergreen target browsers (Chrome/Edge/Firefox/Safari 16.4+) support the unprefixed API; the church-volunteer audience is not running legacy browsers that need vendor prefixes. Only iOS Safari has documented full-page Fullscreen API restrictions on some element types — the UI-SPEC's CSS-overlay fallback already covers this case, so no shim is needed, just the fallback path. `[CITED: developer.mozilla.org/en-US/docs/Web/API/Fullscreen_API]` |
| Autoplay-blocked detection | Custom heuristics (timers, `canplay` checks) to guess if autoplay will be blocked | Attempt `play()`, catch `DOMException` with `.name === 'NotAllowedError'` | This is exactly what `AudioPlayer`/`VideoPlayer` already do — the only correct way to detect an autoplay block is to attempt the play and inspect the rejection, since browser autoplay policies are heuristic/per-site and not synchronously queryable. |
| Media playback UI (scrubber, play/pause controls) | A custom scrubber component | Existing `AudioPlayer`/`VideoPlayer` native `<audio controls>`/`<video controls>`, now with a new `chromeless` prop to omit `controls` when driven imperatively | Building a second media-UI component would duplicate the error-handling/autoplay-retry logic already proven in Phase 22; extending with a boolean prop is strictly additive and non-breaking for `SlideshowPreview.vue`'s existing inline usage. |
| Idle-detection for chrome auto-hide | A custom debounce/interval library | `setTimeout`/`clearTimeout` reset on `mousemove`/`keydown`, cleared in `onUnmounted` | ~10 lines of vanilla logic; no library needed for a single 3-second idle timer. |

**Key insight:** Every "hard" problem in this phase (autoplay detection, media error handling, unified slide rendering, Leader/Congregation styling) was already solved in Phases 18-22 specifically so that Phase 23 would be pure composition. The highest-risk mistake a plan could make here is re-solving one of those problems inside the new component instead of reusing the existing contract.

## Common Pitfalls

### Pitfall 1: Forgetting to pause the outgoing slide's media before advancing
**What goes wrong:** Holding →/Space to rapidly advance through several media-carrying slides leaves audio/video from a skipped slide playing silently under the new slide's content (two audio tracks overlapping, or a video still playing off-screen).
**Why it happens:** Vue's reactive re-render swaps which DOM element `mediaRef` points to, but the OLD `<audio>`/`<video>` element is unmounted, not explicitly paused first — if the unmount happens synchronously it may be fine, but if any transition/keep-alive wrapper is added later, or if the ref swap races the async `play()` promise from the previous slide, playback can persist.
**How to avoid:** Explicitly call `mediaRef.value?.pause()` (via the exposed method) on the OUTGOING slide's ref BEFORE updating `currentIndex`, not just relying on unmount. Capture the outgoing ref into a local variable before the index change if using a single shared ref.
**Warning signs:** Two audio streams audible after rapid key-repeat during manual QA; UI-SPEC flags this explicitly as a "backstop" (not fully specified) navigation-edge case requiring planner attention.

### Pitfall 2: Missing-media slide silently rendering blank instead of degrading
**What goes wrong:** A slide's `audioUrl`/`videoUrl` points to Storage media deleted by Phase 22's 2-week retention cleanup (a documented, expected state per R015) — if the `<audio>`/`<video>` element's `@error` isn't wired to hide the element and show the "Media unavailable" notice, the viewer either shows a broken native media-player error icon or (worse) blocks navigation waiting on a load event that will never fire.
**Why it happens:** `AudioPlayer`/`VideoPlayer` already emit `error` on the native `@error` event, but nothing currently CONSUMES that emission — `SlideshowPreview.vue`'s inline usage doesn't listen for it either. This is new wiring, not reused wiring.
**How to avoid:** In `PresentationViewer.vue`, listen for `@error` on the mounted player and set a per-slide `mediaFailed` flag that (a) hides the player element and (b) shows the gray-500 "Media unavailable" corner notice, while leaving the slide's own text/image content rendering normally.
**Warning signs:** A manual test against a service with a deliberately-deleted/expired media URL shows a broken video icon or a stuck loading spinner instead of graceful text-only fallback.

### Pitfall 3: Fullscreen rejection or unsupported-context assumed to be a hard error
**What goes wrong:** Treating a rejected `requestFullscreen()` promise as something to alert/log/retry, when it is a normal, expected outcome (e.g. some sandboxed iframe embeds, some in-app browser webviews, or contexts where the click handler's user-activation already expired by the time the async call runs).
**Why it happens:** Developers often assume `requestFullscreen()` should "just work" since it was called from a click handler, but iOS Safari and various embedding contexts have additional restrictions beyond simple "was this a user gesture" (iOS Safari, notably, does not support `Element.requestFullscreen()` on arbitrary elements in the same way desktop browsers do — it has historically required `<video>`'s own native fullscreen API instead, or is entirely restricted). `[CITED: developer.mozilla.org/en-US/docs/Web/API/Element/requestFullscreen]`
**How to avoid:** Always wrap `requestFullscreen()` in `.then()/.catch()` (or try/catch with await), and on rejection, simply proceed with the `fixed inset-0 z-50 bg-black` overlay fallback per the UI-SPEC — no error toast, no retry loop, no console noise beyond a dev-only debug log if desired.
**Warning signs:** The presentation mode fails to open at all (rather than degrading to the overlay) when tested on iOS Safari or inside any sandboxed preview/embed context.

### Pitfall 4: Listening for the browser's native Esc-to-exit-fullscreen but not syncing component state
**What goes wrong:** The user presses their browser's own fullscreen-exit affordance (native Esc handling that the browser itself intercepts before your `keydown` listener in some browsers, or an on-screen browser-chrome exit button) — the browser exits fullscreen, but `PresentationViewer.vue`'s own `presenting`/mounted state doesn't know, so the component keeps rendering full-screen chrome inside a now-normal browser window, or worse, the next attempt to enter fullscreen silently no-ops because the DOM element the promise resolves against is stale.
**Why it happens:** There are two independent ways fullscreen exits: (1) your own `keydown` Esc handler + exit button (component-driven), and (2) the browser's native fullscreen-exit UI (browser-driven, fires only `fullscreenchange`, not your keydown listener).
**How to avoid:** Always attach a `document.addEventListener('fullscreenchange', ...)` handler (in addition to the component's own Esc/click handlers) that checks `document.fullscreenElement === null` and, if so, unmounts/exits the viewer component in sync — this is explicitly called out in the UI-SPEC's Component-Specific Notes.
**Warning signs:** After pressing the OS/browser's own Esc-to-exit-fullscreen (as opposed to the on-screen × button), the app's dark full-screen chrome remains visible in a normal-sized window, or subsequent "Present Slideshow" clicks fail silently.

### Pitfall 5: `assembledSlideshow` not yet destructured/exposed from `ServiceEditorView`
**What goes wrong:** `ServiceEditorView.vue` currently only pulls `assembledSections` out of `useSlideshowAssembly` (line 1381: `const { assembledSections } = useSlideshowAssembly(...)`) — a plan that forgets to also destructure `assembledSlideshow` will either crash on an undefined prop or force the planner to awkwardly flatten `assembledSections` back into a flat array (re-deriving something the composable already exposes).
**Why it happens:** Easy to miss since only one of the two return values is currently used at the call site.
**How to avoid:** Explicitly change the destructure to `const { assembledSections, assembledSlideshow } = useSlideshowAssembly(...)` and pass `assembledSlideshow` (not `assembledSections`) into the new viewer, per the UI-SPEC's explicit instruction: "Consumes the flat `assembledSlideshow` array (not the section-grouped `assembledSections`) for sequential index-based navigation."
**Warning signs:** Type errors on `assembledSlideshow` being undefined, or a plan proposing to write new flattening logic instead of using the existing return value.

## Code Examples

### Full-screen enter with fallback (native API, no library)
```typescript
// Source: MDN Fullscreen_API guide (developer.mozilla.org/en-US/docs/Web/API/Fullscreen_API/Guide)
// combined with this project's UI-SPEC fallback requirement.
async function enterPresentation(rootEl: HTMLElement) {
  try {
    await rootEl.requestFullscreen()
    isTrueFullscreen.value = true
  } catch {
    // Promise rejects when: document not fully active, element not in a
    // document, feature-policy denial, or (notably) some embedding contexts
    // and iOS Safari restrictions. Fall back — do NOT surface an error.
    isTrueFullscreen.value = false
  }
}

function handleFullscreenChange() {
  if (document.fullscreenElement === null) {
    // Browser's own Esc/exit-fullscreen UI was used — sync component state.
    exitPresentation()
  }
}

onMounted(() => document.addEventListener('fullscreenchange', handleFullscreenChange))
onUnmounted(() => document.removeEventListener('fullscreenchange', handleFullscreenChange))
```

### Keyboard navigation scoped to the viewer root (not window)
```vue
<!-- Source: UI-SPEC Component-Specific Notes, combined with existing project
     keydown-lifecycle convention (ServiceEditorView.vue's undo shortcut, adapted
     to bind on a local root ref instead of document, per UI-SPEC's isolation requirement) -->
<template>
  <div ref="viewerRoot" tabindex="-1" @keydown="handleKeydown" class="fixed inset-0 z-50 bg-black outline-none">
    <!-- slide content -->
  </div>
</template>

<script setup lang="ts">
function handleKeydown(e: KeyboardEvent) {
  switch (e.key) {
    case 'ArrowRight':
    case ' ':
      e.preventDefault() // avoid incidental page-scroll in the CSS-overlay fallback path
      goNext()
      break
    case 'ArrowLeft':
    case 'Backspace':
      goPrev()
      break
    case 'Escape':
      exitPresentation()
      break
  }
}

onMounted(() => viewerRoot.value?.focus()) // element needs focus to receive its own keydown events
</script>
```

### Chromeless prop addition (non-breaking extension of AudioPlayer/VideoPlayer)
```vue
<!-- Source: extends src/components/AudioPlayer.vue's existing template -->
<audio
  ref="audioEl"
  :src="src"
  :controls="!chromeless"
  preload="none"
  ...
/>

<script setup lang="ts">
defineProps<{
  src: string
  label?: string
  chromeless?: boolean   // NEW — default false, existing SlideshowPreview.vue usage unaffected
}>()
</script>
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| Vendor-prefixed fullscreen APIs (`webkitRequestFullscreen`, `mozRequestFullScreen`, `msRequestFullscreen`) | Unprefixed `Element.requestFullscreen()` | Standardized across Chrome/Firefox/Edge for several years; Safari desktop unprefixed since Safari 16.4 (2023) | No vendor-prefix branching needed for this codebase's target browsers; only the promise-rejection fallback path matters |

**Deprecated/outdated:**
- `document.webkitIsFullScreen` / prefixed fullscreen change events: not needed given the target browser matrix (evergreen Chrome/Edge/Firefox, Safari 16.4+). If manual QA reveals an older Safari/embedded-webview target, the fallback overlay path already covers it without any prefix-detection code.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | iOS Safari has meaningful restrictions on `Element.requestFullscreen()` for arbitrary (non-`<video>`) elements, beyond the general promise-rejection contract | Common Pitfalls (Pitfall 3), State of the Art | Low — the UI-SPEC's fallback overlay path already handles ANY rejection reason uniformly, so this claim doesn't gate any specific code branch; it only informs why the fallback matters and should be human-verified during the manual browser QA this phase already calls for |
| A2 | `VideoPlayer.vue` needs a new exposed `isMuted`/element-ref accessor for the driving layer to distinguish muted-retry-success from muted-retry-failure (both currently emit the same `autoplay-blocked` event) | Architecture Patterns (Pattern 3) | Medium — if the planner doesn't add this exposed accessor, the "Playing muted — tap to unmute" vs. full "Tap to play video" UI states (both required by the UI-SPEC) cannot be distinguished from outside the component; must be added as an explicit task |

**If this table is empty:** N/A — see above; both items are low/medium risk and don't block planning, only need explicit tasks/verification.

## Open Questions

1. **Congregational scripture slide with empty/undefined `sections` (UI-SPEC "unresolved" row)**
   - What we know: `ScriptureSlide.readingMode` can be `'congregational'` while `sections` is optional/absent per the type contract (`src/types/slide.ts`).
   - What's unclear: No CONTEXT.md decision or existing code path defines the fallback behavior for this specific combination.
   - Recommendation: Follow the UI-SPEC's own stated planner assumption — fall back to rendering the slide as normal (non-congregational) Body text using `.text`, rather than a blank/broken slide. Plan should include this as an explicit conditional branch with a unit test.

2. **Long lyric/imported-text overflow and multi-exchange congregational stacking (both UI-SPEC "backstop" rows)**
   - What we know: No dynamic auto-shrink-to-fit is specified; text simply wraps/may clip at the 48px Body size for unusually long content.
   - What's unclear: Whether this is acceptable for real-world PPTX-imported text slides and congregational readings with many exchanges (both flagged by the UI-SPEC as needing planner verification against real fixture content, e.g. `docs/example.pptx`).
   - Recommendation: Planner should treat this as a manual-verification item using the real `docs/example.pptx` fixture already present in the repo (per STATE.md: "docs/example.pptx (real user-provided deck) used as the mixed.pptx integration fixture") rather than inventing an auto-shrink algorithm speculatively; only add shrink logic if manual QA surfaces an actual overflow problem.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Fullscreen API (browser-native) | True full-screen presentation | Assumed available in evergreen target browsers [ASSUMED] | N/A (native API, not a package) | CSS fixed-overlay fallback (already specified in UI-SPEC, mandatory regardless) |
| Firebase Storage (media URLs) | Audio/video slide playback | Already integrated (Phase 22) | — | Graceful degradation (`@error` → hide media, show "Media unavailable") — already the phase's own error-handling strategy, not a new fallback |
| Firestore emulator (ports 8080/9199) | NOT required for this phase's own verification | N/A | — | This phase's safe verification commands are `type-check`/`build`/`test:unit` only — do not touch the emulator (constraint from STATE.md, a live user session may hold it) |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** Fullscreen API — CSS overlay fallback is mandatory regardless of browser support, so this is not actually a blocking gap, just documented behavior.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest ^4.0.18 + @vue/test-utils ^2.4.6 [VERIFIED: package.json] |
| Config file | `vite.config.ts` (`test: { environment: 'jsdom', exclude: [...] }`) — no separate `vitest.config.ts` for the main app; no global `setupFiles` (media-element stubs are set per-test in `beforeEach`, see `VideoPlayer.test.ts`) |
| Quick run command | `npx vitest run src/components/__tests__/PresentationViewer.test.ts` |
| Full suite command | `npm run test:unit` (interactive watch by default — use `npx vitest run` for a single non-interactive pass) |

### Phase Requirement → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| R016 | "Present Slideshow" CTA disabled with 0 slides, enabled otherwise | component (Vue Test Utils) | `npx vitest run src/components/__tests__/SlideshowPreview.test.ts` | ❌ Wave 0 — new test cases in existing file |
| R016 | Viewer opens teleported to body, renders first slide by index | component | `npx vitest run src/components/__tests__/PresentationViewer.test.ts` | ❌ Wave 0 |
| R016 | →/Space/←/Backspace/Esc navigate/exit; stop-at-ends (no wrap) | component (`trigger('keydown', {...})` on viewer root) | `npx vitest run src/components/__tests__/PresentationViewer.test.ts` | ❌ Wave 0 |
| R016 | Progress indicator text format ("{section} · N / M" / "N / M" for ungrouped) | component | `npx vitest run src/components/__tests__/PresentationViewer.test.ts` | ❌ Wave 0 |
| R016 | Outgoing slide's media `.pause()` called before advancing | component (spy on exposed `pause`/mock `HTMLMediaElement.prototype.pause`) | `npx vitest run src/components/__tests__/PresentationViewer.test.ts` | ❌ Wave 0 |
| R016 | `@error` on media → hides player, shows "Media unavailable" notice, slide text still renders | component (`wrapper.find('video').trigger('error')`) | `npx vitest run src/components/__tests__/PresentationViewer.test.ts` | ❌ Wave 0 |
| R016 | Autoplay-blocked audio/video → correct affordance shown ("Tap to play" vs "Playing muted — tap to unmute") | component (mock `HTMLMediaElement.prototype.play` rejecting with `NotAllowedError`, per existing `VideoPlayer.test.ts` pattern) | `npx vitest run src/components/__tests__/PresentationViewer.test.ts` | ❌ Wave 0 |
| R016 | `chromeless` prop omits native `controls` attribute on `AudioPlayer`/`VideoPlayer` | component | `npx vitest run src/components/__tests__/AudioPlayer.test.ts src/components/__tests__/VideoPlayer.test.ts` | ⚠ modify existing files |
| R016 | Congregational scripture slide renders Leader/Congregation blocks correctly (incl. empty/undefined `sections` fallback) | component | `npx vitest run src/components/__tests__/PresentationViewer.test.ts` | ❌ Wave 0 |
| R016 (manual-only) | Real browser fullscreen enter/exit, native Esc-to-exit sync, iOS Safari behavior | **human-verify** | N/A — real browser required | manual |
| R016 (manual-only) | Real unmuted audio/video autoplay behavior across actual browser autoplay policies | **human-verify** | N/A — real browser + real media files required | manual |
| R018 | Chrome auto-hides after ~3s idle, reappears on activity | component (fake timers: `vi.useFakeTimers()`, advance, assert opacity class) OR **human-verify** for the visual "feel" | `npx vitest run src/components/__tests__/PresentationViewer.test.ts` (mechanism) + manual (feel) | ❌ Wave 0 (mechanism) |

### Sampling Rate
- **Per task commit:** `npx vitest run <changed test file(s)>`
- **Per wave merge:** `npx vitest run` (full unit suite, non-watch) — do NOT run `npm run test:rules` (emulator constraint) or restart the Firestore/Storage emulator (a live user session may hold ports 8080/9199)
- **Phase gate:** Full `npx vitest run` green + `npm run type-check` clean + `npm run build` green, before any human-verify checkpoint

### Wave 0 Gaps
- [ ] `src/components/__tests__/PresentationViewer.test.ts` — new file, covers all component-testable R016 behaviors above
- [ ] Extend `src/components/__tests__/AudioPlayer.test.ts` and `VideoPlayer.test.ts` — assert `chromeless` prop omits `controls`
- [ ] Extend `src/components/__tests__/SlideshowPreview.test.ts` — assert CTA disabled/enabled state and click emits the expected open-viewer event/prop
- [ ] No new shared fixture file strictly required — `SlideshowPreview.test.ts`'s existing `copyrightSlide()`/`lyricSlide()`/`scriptureSlide()` builder functions are directly reusable as `AssembledSlide` fixtures for the new viewer's tests (same shape, same file's pattern can be copied or the helpers extracted to a shared test-fixture module if the planner prefers DRY over duplication)
- [ ] Framework install: none needed — Vitest/@vue/test-utils already fully configured

**Human-verify items this phase MUST flag as manual-only (not achievable via component test):**
- Real `requestFullscreen()` success/failure and native Esc-driven fullscreen exit, across real browsers (jsdom does not implement the Fullscreen API at all — `Element.prototype.requestFullscreen` must be manually mocked in tests, e.g. `Element.prototype.requestFullscreen = vi.fn().mockRejectedValue(new Error('not supported'))`, to unit-test the fallback branch; the TRUE fullscreen success path cannot be verified in jsdom and is human-verify only) `[CITED: npmjs.com/package/jsdom-testing-mocks; vitest.dev/guide/environment]`
- Real unmuted audio/video autoplay policy behavior in an actual browser session (jsdom's `HTMLMediaElement.play`/`pause` are unimplemented stubs already mocked per-test in this project's existing suite — see `VideoPlayer.test.ts`'s `beforeEach`; the mocked rejection/resolution path is what's testable, not real-world autoplay-policy variance)
- Visual "feel" of the auto-hiding chrome fade timing and the projection-scale typography against a real projector/large screen

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-------------------|
| V2 Authentication | No | Viewer is mounted inside `ServiceEditorView`, which is already behind the app's existing route/auth guards — no new auth surface |
| V3 Session Management | No | No new session state; presentation mode is transient client-side UI state only |
| V4 Access Control | No | No new data access — consumes the same `assembledSlideshow` the already-authorized editor session already reads via `useSlideshowAssembly` |
| V5 Input Validation | N/A | No new user-input surface in this phase (no forms, no free text entry) — slide content is read-only display of already-validated/stored data |
| V6 Cryptography | No | No new crypto surface |

### Known Threat Patterns for this stack
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|----------------------|
| XSS via unsanitized slide text (lyric/scripture/imported text) rendered as HTML | Tampering/Info Disclosure | Vue's `{{ }}` text interpolation already HTML-escapes by default across the whole codebase (no `v-html` is used for slide content anywhere in `SlideshowPreview.vue`) — `PresentationViewer.vue` must follow the same convention: interpolate slide text/lines/body as text, never `v-html` |
| Fullscreen API used for UI-redressing / clickjacking-style attacks | Spoofing | Not applicable here — the presentation viewer is a legitimate first-party feature entered via an explicit user click on an authenticated page, not a hidden/attacker-controlled iframe context |

No new threat surface is introduced by this phase beyond the standard Vue text-interpolation-escaping convention already followed everywhere else in the codebase.

## Sources

### Primary (HIGH confidence)
- `src/composables/useSlideshowAssembly.ts` — verified return shape (`assembledSlideshow`, `assembledSections`, `isLoading`)
- `src/utils/slideshowAssembler.ts` — verified media-propagation-onto-first-slide mechanism, `DistributiveOmit` pattern, copyright-slide-twice-per-song behavior
- `src/types/slide.ts` — verified `Slide`/`AssembledSlide`/`AssembledSection` discriminated union and `contentKind` values
- `src/types/service.ts` — verified `SERVICE_SECTIONS`/`SERVICE_SECTION_LABELS`/`ServiceSection` and slot media fields
- `src/components/AudioPlayer.vue`, `src/components/VideoPlayer.vue` — verified exposed `play()`/`pause()`, emitted events, muted-retry fallback logic (read in full)
- `src/components/SlideshowPreview.vue`, `src/views/ServiceEditorView.vue` — verified current mounting/destructure of `useSlideshowAssembly`, existing keydown-lifecycle precedent
- `src/components/CongregationalEditor.vue` — verified Leader/Congregation visual convention to reuse
- `src/components/__tests__/PptxImportModal.test.ts`, `VideoPlayer.test.ts`, `SlideshowPreview.test.ts` — verified established Teleport test pattern and media-mock pattern
- `package.json`, `vite.config.ts` — verified installed versions and test environment config
- `.planning/phases/23-presentation-preview-mode/23-CONTEXT.md`, `23-UI-SPEC.md`, `.planning/milestones/v1.2-REQUIREMENTS.md`, `.planning/STATE.md` — verified locked decisions, requirement text, and prior-phase constraints

### Secondary (MEDIUM confidence)
- [MDN: Fullscreen API](https://developer.mozilla.org/en-US/docs/Web/API/Fullscreen_API) — promise-rejection reasons, `fullscreenchange` event contract
- [MDN: Element.requestFullscreen()](https://developer.mozilla.org/en-US/docs/Web/API/Element/requestFullscreen) — user-gesture requirement, rejection conditions
- [vitest.dev/guide/environment](https://vitest.dev/guide/environment) — jsdom limitations, Browser Mode alternative

### Tertiary (LOW confidence)
- [npmjs.com/package/jsdom-testing-mocks](https://www.npmjs.com/package/jsdom-testing-mocks) — general confirmation that `requestFullscreen` is unimplemented in jsdom (not itself recommended for adoption; the project's existing per-test manual-mock convention, e.g. `VideoPlayer.test.ts`'s `HTMLMediaElement.prototype.play` stubbing, is the better fit and should be applied identically to `Element.prototype.requestFullscreen`)
- iOS Safari-specific `requestFullscreen()` element-type restrictions (A1 in Assumptions Log) — based on general training knowledge of historical Safari behavior, not verified against current Safari release notes this session

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependencies; every primitive already exists in the verified codebase
- Architecture: HIGH — directly grounded in read source files (`useSlideshowAssembly.ts`, `slideshowAssembler.ts`, `slide.ts`, `service.ts`, `AudioPlayer.vue`, `VideoPlayer.vue`) plus the authoritative UI-SPEC
- Pitfalls: HIGH for codebase-grounded items (Pitfalls 1, 2, 4, 5 — all traced to specific existing code/UI-SPEC text); MEDIUM for Pitfall 3 (iOS Safari specifics are `[ASSUMED]`, flagged in Assumptions Log)

**Research date:** 2026-07-25
**Valid until:** 2026-08-24 (30 days — stable domain, no fast-moving external dependency; re-verify sooner only if Phase 20/21/22 code changes after this date)

**Graph note:** `.planning/graphs/graph.json` is stale (171 commits behind HEAD, built before Phases 20-23 existed — a query for "presentation" returned only an unrelated Phase 06 CONTEXT.md reference). Graph queries were skipped in favor of direct source reads, which were more complete and current for this integration-heavy phase.
