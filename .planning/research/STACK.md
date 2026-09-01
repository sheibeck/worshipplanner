# Stack Research: v2.7 Rehearsal, Stage Plans & Presentation Polish

**Domain:** Stack additions for 5 new-feature areas in a mature Vue 3 + Firebase worship-planning app
**Researched:** 2026-08-31
**Confidence:** HIGH

## Bottom Line

**Zero new npm dependencies are required for v2.7.** Every one of the five feature areas is
covered by a native browser API or by extending an existing dependency/pattern already in
`package.json` and `src/`. This is a deliberate, opinionated recommendation, not a default —
each feature below was evaluated against real library alternatives (with current versions) and
rejected in favor of the lower-complexity native/existing option. Where a library genuinely earns
its place, it's called out explicitly; none did.

## Recommended Stack

### Core Technologies (unchanged — no new core deps)

| Technology | Version (existing) | Purpose | Why nothing changes |
|------------|---------------------|---------|----------------------|
| `firebase` (Storage SDK, modular) | `^12.0.0` (already installed) | PDF/MP3 attachment upload for rehearsal media | `uploadBytesResumable` + `getDownloadURL` — the exact API `useMediaUpload.ts`/`useBackgroundUpload.ts` already use. Feature 3 is a straight extension of this pattern, not a new integration. |
| Native `<audio>` element | HTML5, all target browsers | MP3 rehearsal playback on the public share page | Built-in transport controls, buffering, and mobile support (incl. iOS Safari, which requires a user gesture to start — satisfied by a Play tap) with zero JS. |
| Native `<iframe>` (YouTube embed) | HTML5 | YouTube video playback on the public share page | `youtube.com/embed/{videoId}` is the documented, stable embed surface; no SDK needed for simple playback (no need for the heavier `youtube-iframe-api` JS API unless you later want programmatic play/pause sync, which is out of scope). |
| Native `<iframe>` / `target="_blank"` link (browser PDF viewer) | N/A | PDF chord-chart viewing on the public share page | See "PDF viewing" below — every target browser (desktop Chrome/Edge/Firefox/Safari, and modern mobile Chrome/Safari) has a built-in PDF renderer. |
| Pinia | `^3.0.4` (already installed) | System-wide toast/dismissible-message store | Matches every other piece of cross-cutting UI state in this app (auth, org, run-channel state). A toast store is ~40 lines on top of an already-adopted pattern. |
| Native `setInterval`/`clearInterval` (in a composable) | N/A | Loop-a-service-item auto-advance timer | A single-purpose interval with a configurable delay and cleanup on unmount — textbook `setInterval` use case, not a scheduling problem. |
| Native Pointer Events API (`pointerdown`/`pointermove`/`pointerup`, `setPointerCapture`) | Baseline browser API (Chrome/Edge/Firefox/Safari all current) | Freeform drag-and-drop stage-layout canvas | Unifies mouse + touch + pen input in one event model — the touch support the feature explicitly needs comes for free, without a gesture library. |

### Supporting Libraries — evaluated, none added

| Library | Current version | Purpose it would serve | Verdict |
|---------|------------------|-------------------------|---------|
| `vue-konva` / `konva` | `vue-konva` 3.4.0 (npm, Vue 3-only; requires `konva` peer) | Canvas-based freeform stage layout with drag/resize/snap | **Not warranted.** Konva is a full 2D canvas scene-graph library (shapes, layers, hit-testing, transforms) built for rich graphics editors. Placing a fixed set of instrument/mic icons at arbitrary x/y inside two rectangular zones needs none of that — it's DOM positioning, not scene-graph rendering. Konva also renders to `<canvas>`, which means re-implementing accessibility/hover/click affordances that free HTML elements get natively, and it pulls in a canvas render loop for what is a mostly-static authoring surface. |
| `interactjs` | 1.10.27 (last published ~2 yrs ago per npm/GitHub) | Drag, resize, multi-touch gesture library | **Not warranted**, and mildly stale (last release ~2 years old, though still functional). It's a general gesture engine (inertia, snapping, resizable/rotatable elements) — this feature only needs "pick up an icon, drop it inside a zone," which the native Pointer Events API does directly with less code and no library update-cadence risk. |
| `vue-draggable-plus` / `vuedraggable` (SortableJS Vue wrapper) | N/A (not currently used — app calls `sortablejs` directly, `^1.15.7`) | Drag-and-drop | **Wrong tool for this feature.** SortableJS-family libraries are built for *reordering lists* (the exact job they already do in this app for song lyric slides, roster rows, etc. — see `src/components/SongLyricEditor.vue`, `src/components/slides/SlideGrid.vue`). Stage-layout placement is *free x/y positioning inside a zone*, not a sortable list — there is no natural "index" to reorder. Do not reach for the existing SortableJS pattern here; it doesn't fit the interaction. |
| `vue-toastification` | v2.x line (Vue 3-compatible; ~2.4k GitHub stars) | Toast/notification system | **Not warranted.** Full-featured (positions, transitions, pause-on-hover, icons) but that featureset is aimed at ephemeral auto-dismissing toasts — the opposite of what R-level v2.7 asks for ("no warning/error that gets stuck on screen… every message is manually dismissible"). This app's own Key Decisions log already recorded moving *away* from toast-style notifications toward persistent, explicitly-dismissed inline status (`Autosave` decision, v1.4) — a purpose-built store keeps that precedent instead of reintroducing toast semantics wholesale. Also ships its own CSS that would need auditing against the Tailwind v4 dark-mode canonical theme. |
| `vue3-toastify` | 0.2.9 (last published ~6 months ago) | Toast/notification system | Same verdict as `vue-toastification` — lighter-weight but still an auto-dismiss-first toast library fighting the "manually dismissible, no auto-clear-until-condition-met" requirement (the "monitors not configured" warning must clear on a *state change*, not a timer — that's app logic no toast library provides anyway). |
| `pdfjs-dist` (Mozilla PDF.js) | 6.3.289 (actively maintained, canvas-based renderer) | In-app PDF rendering with custom UI | **Not warranted for this use case.** PDF.js earns its place when a product needs annotations, custom toolbars, or PDF manipulation as a core UX (dashboards, markup tools). Viewing a static chord-chart PDF is exactly the case where "use the browser's native renderer" is the documented right call — every target browser has one, it needs zero bundle weight, and it works identically whether the PDF opens in an `<iframe>` or a new tab. |
| `youtube-iframe-api` (YouTube's official JS Player API) | N/A | Programmatic control of the embedded YouTube player | Not needed for "play a rehearsal video" — a plain `<iframe src="…/embed/{id}">` is sufficient. Only reach for the JS Player API if a later milestone needs cross-window playback sync (e.g., pausing video when advancing Run slides), which is out of scope here. |

## Feature-by-Feature Detail

### 1. Public shared-link rehearsal media playback (MP3 / YouTube / PDF)

**No new dependency.**

- **MP3:** `<audio controls :src="downloadUrl" preload="metadata">`. Works unauthenticated because
  the file is fetched by URL, not through the Firestore/Storage SDK read path — the only
  requirement is that the Storage **download URL is publicly fetchable** (see Integration Points
  below; this is a `storage.rules` concern, not a stack concern).
- **YouTube:** store just the video ID (parsed once at attach-time from any pasted YouTube URL
  format — `youtu.be/…`, `youtube.com/watch?v=…`, `youtube.com/shorts/…`) and render
  `<iframe :src="\`https://www.youtube-nocookie.com/embed/${id}\`" allowfullscreen>`. Prefer the
  `-nocookie` embed domain for a public, unauthenticated page — it doesn't set tracking cookies
  until the visitor interacts with the player, which is the appropriate default for a page with no
  login and no consent flow.
- **PDF:** two-tier approach, no library:
  1. Primary: a plain link (`<a :href="downloadUrl" target="_blank" rel="noopener">Open chord chart</a>`)
     — guaranteed to work on every device because it hands off to whatever the OS/browser's native
     PDF handler is (desktop browsers open their built-in viewer tab; mobile browsers either render
     inline or offer a share/save sheet). This is the one to lead with for reliability across the
     unpredictable mix of mobile browsers/webviews volunteers will use.
  2. Enhancement: an inline `<iframe :src="downloadUrl" class="w-full h-[70vh]">` for desktop/larger
     viewports, since Chrome/Edge/Firefox/Safari desktop all render PDFs inline in an iframe with no
     extra code. Don't invest more than that — this is a "view it" feature, not a PDF-editing one.

### 2. Freeform stage-layout canvas

**No new dependency.** Recommended approach: **plain absolute-positioned DOM + native Pointer
Events**, not SVG and not a canvas library.

- Container: two `position: relative` zones (on-stage, off-stage/side) with Tailwind utility
  classes for the zone boundaries; each instrument/mic is an absolutely-positioned `<div>` (or a
  small icon component) inside whichever zone it belongs to, positioned with `left`/`top` stored as
  **percentages of the zone's bounding box** (not raw pixels) so the layout stays coherent across
  different screen sizes/orientations without a resize-recalculation step.
- Drag interaction: `pointerdown` on an icon → `el.setPointerCapture(e.pointerId)` → track
  `pointermove` deltas → on `pointerup`, compute which zone the icon's center falls in (a simple
  bounding-rect containment check) and persist `{ zone, xPct, yPct }` to Firestore on the service
  document (debounced, mirroring the existing autosave pattern already used elsewhere in the
  editor).
- Why not SVG: SVG buys you scalable vector icons and easy transforms, but this app already renders
  icons as regular images/inline SVG *elements* inside HTML elsewhere; there's no need to move the
  whole canvas into an SVG coordinate system just to place a fixed icon set — plain DOM keeps
  Tailwind classes, existing icon components, and Vue's reactivity/event model working exactly as
  they do everywhere else in the app.
- Why not Konva/interactjs: see the Supporting Libraries table above. Both are justified when you
  need arbitrary shape drawing, resize handles, rotation, snapping, or hundreds of interactive
  nodes — none of which this feature asks for (a bounded palette of instrument/mic icons dropped
  into two zones, once per service, mostly authored by one planner at a time).
- Touch support: Pointer Events cover touch natively (a `pointerdown` from a touchscreen fires the
  same handler as from a mouse) — this is precisely why Pointer Events (not the older separate
  `mousedown`/`touchstart` handler pairs) is the right primitive to reach for; it eliminates an
  entire class of "works on desktop, broken on tablet" bugs without a library.

### 3. Rehearsal-attachment upload (PDF + MP3) to Firebase Storage

**No new dependency.** Extend the existing upload composable pattern
(`src/composables/useMediaUpload.ts`, `src/composables/useBackgroundUpload.ts`) rather than
building a new mechanism:

- New composable (e.g. `useAttachmentUpload.ts`) mirroring the same `uploadBytesResumable` +
  `getDownloadURL` + `customMetadata.createdAt` shape, diverging only on:
  - **MIME allow-list:** `application/pdf` and `audio/mpeg` (+ `audio/mp3` sent by some browsers/OS
    file pickers for the same format) instead of `audio/*`/`video/*` or `image/*`.
  - **Size cap:** pick a cap appropriate to chord-chart PDFs and rehearsal MP3s (a few MB for a
    scanned PDF, tens of MB for an MP3) — same client-pre-validate-then-server-enforces pattern as
    `MEDIA_MAX_BYTES`/`BACKGROUND_MAX_BYTES`; needs a matching `storage.rules` cap for whatever new
    path prefix these attachments live under (this is a rules decision for the phase, not a library
    choice).
  - **Storage path:** attachments live on the **Song** (per PROJECT.md decision), reusable across
    services — so the natural path is org- and song-scoped, e.g.
    `orgs/{orgId}/songs/{songId}/attachments/{attachmentId}/{sanitizedFileName}`, distinct from the
    existing `media/` (14-day cleanup sweep target) and `backgrounds/` prefixes so the existing
    `cleanupExpiredMedia` function's `MEDIA_PATH_GUARD` regex does **not** accidentally sweep
    rehearsal attachments that are meant to be durable, reusable song assets, not ephemeral service
    media.
- YouTube "attachments" aren't uploads at all — just a URL string field on the song record, parsed
  to a video ID at save time (see Feature 1). No Storage interaction, no library.

### 4. System-wide dismissible toast/notification mechanism

**No new dependency — build a tiny in-house Pinia store**, sized roughly:

```ts
// src/stores/notifications.ts (illustrative shape, not final API)
interface AppNotification {
  id: string
  level: 'info' | 'warning' | 'error'
  message: string
  // optional: a stable `key` so a producer (e.g. "monitors not configured")
  // can push once and later call clear(key) itself when the condition
  // resolves, rather than relying on a timer
  key?: string
}
```

- One `<NotificationHost>` component mounted once in `App.vue` (or the top-level layout), reading
  the store and rendering a small stack of dismissible banners/cards with Tailwind classes matching
  the app's existing gray-950/900 dark-mode palette — no separate CSS bundle to reconcile with
  Tailwind v4, unlike every toast library evaluated.
- This directly satisfies both stated v2.7 requirements that toast libraries don't: (a) a message
  can be **cleared by the producing code** when its condition resolves (the "monitors not
  configured" warning auto-clearing once monitors are set up — no toast library's timer-based
  auto-dismiss models "clear when X becomes true"), and (b) **every** message is manually
  dismissible, with no forced-must-read-fast auto-expiry.
- Store the "monitors not configured" case as a keyed notification (`key: 'monitors-not-configured'`)
  so the Run-flow code can `dismiss('monitors-not-configured')` the moment monitor config is
  detected, independent of whether the user manually dismissed it too.

### 5. Loop-a-service-item auto-advance timer

**No new dependency.** A small composable, e.g.:

```ts
// src/composables/useLoopTimer.ts (illustrative)
function useLoopTimer(advance: () => void, intervalMs: Ref<number>) {
  let handle: ReturnType<typeof setInterval> | null = null
  function start() {
    stop()
    handle = setInterval(advance, intervalMs.value)
  }
  function stop() {
    if (handle) clearInterval(handle)
    handle = null
  }
  watch(intervalMs, () => { if (handle) start() }) // restart on interval change
  onUnmounted(stop)
  return { start, stop }
}
```

- Default 10s per PROJECT.md, with an interval dropdown + custom value — just changes the argument
  passed to `setInterval`, no scheduling library needed.
- Looping back to the item's start on reaching its last slide is app logic (index math against the
  existing slide-array model already used by Run), not a timer concern.
- No interaction with `runChannel.ts`/`BroadcastChannel` is implied by the timer itself — the loop
  only needs to call whatever the existing "advance slide" action already is in the Run store, so
  it broadcasts exactly like a manual arrow-key advance does today.

## Installation

```bash
# No installation needed — v2.7 adds zero new npm dependencies.
```

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|--------------------------|
| Plain absolute-positioned DOM + Pointer Events for the stage canvas | `vue-konva`/`konva` (3.4.0) | If a later milestone needs freehand drawing, resize/rotate handles, shape layering, or dozens of simultaneously-interactive elements with hit-testing — i.e. the canvas becomes a real diagramming tool rather than icon placement. |
| Plain absolute-positioned DOM + Pointer Events | `interactjs` (1.10.27) | If you need inertia/snapping/multi-finger gesture behavior beyond simple pick-up-and-drop, or resizable/rotatable elements — none of which this feature asks for. |
| In-house Pinia notification store | `vue-toastification` (v2.x) or `vue3-toastify` (0.2.9) | If a future feature genuinely wants classic auto-expiring toast UX (e.g. transient "saved!" confirmations with animation/position options) rather than the "stays until resolved or dismissed" model this milestone specifically asks for. |
| Native `<iframe>`/link PDF viewing | `pdfjs-dist` (6.3.289) | If chord-chart viewing grows into annotation, page thumbnails, search-within-PDF, or any UI beyond "look at the chart" — that's the point PDF.js's extra weight starts paying for itself. |
| Native `<iframe>` YouTube embed | YouTube IFrame Player API | If Run-flow or Rehearse-mode later needs programmatic playback control (auto-pause on tab switch, sync with slide advance, etc.) rather than a self-contained embedded player. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|--------------|
| `vuedraggable`/`vue-draggable-plus` (SortableJS Vue wrapper) for the stage canvas | It's built for reordering lists (index-based), not free x/y placement — forcing it into this feature means fighting its model, not using it as designed. | Native Pointer Events with percentage-based `{zone, xPct, yPct}` coordinates. |
| Any toast library with default auto-dismiss timers as the *only* dismiss mechanism | Directly conflicts with this milestone's explicit requirement ("no warning/error that gets stuck on screen" is about *stuck* messages, but the flip side — "every message is manually dismissible" — means a message must never vanish involuntarily either, and a stateful "clear when the underlying condition resolves" isn't a toast-library primitive). | A keyed, store-driven notification with an explicit `dismiss()`/`clear(key)` API. |
| `pdfjs-dist` for a simple view-only chord chart | Canvas-rendering PDF.js is meaningfully heavier (parsing + render-loop + no built-in toolbar) than what "view a PDF" needs, and every target browser already renders PDFs natively. | `<iframe>`/direct link to the Storage download URL. |
| Reusing the `media/` Storage path prefix for song attachments | The deployed `cleanupExpiredMedia` Cloud Function's `MEDIA_PATH_GUARD` regex (`^orgs/[^/]+/media/`) sweeps that prefix after 14 days — rehearsal attachments are durable, reusable song assets, not ephemeral service media, and would silently vanish. | A distinct prefix, e.g. `orgs/{orgId}/songs/{songId}/attachments/...`, exempt from that sweep (mirrors why `useBackgroundUpload.ts` deliberately uses `backgrounds/`, not `media/`). |

## Integration Points (flagged for requirements/roadmap, not a stack decision)

- **Public read access for rehearsal attachments.** `ShareView.vue`'s existing pattern serves a
  pre-computed Firestore **snapshot** to unauthenticated visitors — it never needs Storage reads
  directly, so there's no existing precedent in this codebase for *unauthenticated* Storage file
  access. `storage.rules` currently gates Storage reads on org membership, and per this project's
  own documented `firestore.exists()`-in-rules limitation, that check cannot be verified against the
  Storage emulator. Song-attachment objects will need either (a) a `storage.rules` allowance scoped
  to a public-readable path (e.g. `allow read: if true` under `orgs/{orgId}/songs/{songId}/attachments/**`,
  accepting that a leaked download URL is world-readable — consistent with how a Firestore share
  snapshot is already effectively public once the link is out), or (b) a Cloud Function proxy that
  streams the file. **Recommend (a)** — it's the direct extension of "the link is the auth" that
  `ShareView.vue` already relies on for the whole shared-plan page, and it needs zero new
  infrastructure. This is a `storage.rules` design decision for the implementation phase, not a
  library choice — flagged here so it isn't missed.
- **`runChannel.ts`/BroadcastChannel** is untouched by any v2.7 stack pick — the loop timer and
  "Go to black" (Audience-only) changes are app-state changes broadcast through the existing
  channel, not new transport.
- **Multi-org custom claim (`orgs:{orgId:role}`)** — the user-menu church switcher (feature not
  covered by this STACK research, since it's pure application logic against already-issued claims)
  needs no new stack pieces either; noted here only to confirm no library gap exists there.

## Version Compatibility

| Package | Compatible With | Notes |
|---------|------------------|-------|
| `firebase@^12.0.0` (Storage SDK) | Vite `^7.3.1`, Vue `^3.5.29` | Already proven in this codebase (`useMediaUpload.ts`, `useBackgroundUpload.ts`, `pptxUpload.ts`) — no version change needed for the new attachment composable. |
| Pointer Events API | All target browsers (Chrome/Edge/Firefox/Safari, current + mobile) | No polyfill needed for this app's supported-browser bar (already Chrome/Edge-first per the v2.4 Run-the-Service milestone). |
| `<iframe>` PDF rendering | Desktop Chrome/Edge/Firefox/Safari: yes, inline. Mobile: inconsistent inline rendering across browsers/webviews. | This is exactly why the recommended approach leads with a plain link (native OS/browser handoff) and treats the inline `<iframe>` as a desktop enhancement, not the only path. |
| `youtube-nocookie.com/embed` | No SDK/version dependency — plain URL contract | Stable, documented embed surface; unaffected by this app's dependency versions. |

## Sources

- npm registry pages for `vue3-toastify`, `vue-toastification`, `interactjs`, `vue-konva`,
  `pdfjs-dist` (version numbers as surfaced via web search, 2026-08-31) — MEDIUM confidence (web
  search summaries of npm listings, not directly fetched npm API responses; version numbers are
  point-in-time and should be re-checked at implementation time via `npm view <pkg> version`).
- Direct codebase read: `package.json`, `src/composables/useMediaUpload.ts`,
  `src/composables/useBackgroundUpload.ts`, `src/views/ShareView.vue` — HIGH confidence (primary
  source, current repo state).
- `.planning/PROJECT.md` — HIGH confidence (primary source; v2.7 feature scope, prior Key Decisions
  including the toast-vs-persistent-status precedent, and the `storage.rules`
  `firestore.exists()`-in-emulator limitation).

---
*Stack research for: v2.7 Rehearsal, Stage Plans & Presentation Polish*
*Researched: 2026-08-31*
