# Stack Research

**Domain:** Browser-based live worship-service presentation/projection ("Run the Service") — multi-monitor delivery from a single Chrome/Edge tab
**Researched:** 2026-08-28
**Confidence:** MEDIUM-HIGH (all core APIs verified against MDN, Chrome for Developers, and the W3C `window-management` spec repo; two facts — long-run `id` persistence across browser *restarts*, and exact Edge version parity — could not be pinned to a single authoritative sentence and are flagged below)

## Recommended Stack

### Core Technologies — all native browser APIs, zero new npm dependencies

| Technology | Version / Support | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| **Window Management API** (`window.getScreenDetails()`, `ScreenDetails`, `ScreenDetailed`, `screen.isExtended`) | Chromium 100+ (Chrome & Edge; Edge policy docs confirm control as of Edge 123, API itself ships wherever Chromium 100+ ships since Edge tracks Chromium releases). **Not Baseline** — Chromium-only, no Firefox/Safari support. `caniuse.com/mdn-api_window_getscreendetails` is the live source of truth. | Enumerate every connected monitor (position, size, `isPrimary`, `label`, `id`) so the monitor-config screen can list real displays and place output windows on the correct one | This is the *only* web API that exposes multi-screen topology at all. The project's constraint (Chrome/Edge only, per PROJECT.md) removes the "not Baseline" objection — it's a hard requirement here, not a nice-to-have polyfilled elsewhere |
| **`window-management` permission** | Same Chromium 100+ gate | Gates `getScreenDetails()`; user sees a one-time OS-level "Know when windows are open on other displays / manage windows" prompt | Required — `getScreenDetails()` throws `NotAllowedError` if not granted. Chrome **persists the grant per-origin across sessions** (visible/revocable in the site's lock-icon → Site settings → "Additional permissions"), so the "remembered per device" requirement (R: persistent monitor config) is satisfied by the browser itself, not just app storage |
| **Fullscreen API with `screen` option** (`element.requestFullscreen({ screen })`) | Chromium 100+ alongside Window Management (Fullscreen API core is Baseline widely-available since ~2018; the `screen` option is the new, Chromium-only part, spec'd together with Window Management) | Puts the audience/confidence `<div>` into true chrome-free fullscreen **on a specific monitor**, in one call, without first moving/resizing a windowed popup | Avoids the flicker/race of "open window → moveTo → resize → requestFullscreen" — `requestFullscreen({screen: targetScreen})` is spec'd to open directly full-screen on that screen. This is the single biggest quality win over the old drag-then-F11 pattern |
| **`window.open()` with `left/top/width/height`** | Universal (all browsers, all versions) | Fallback/bootstrap: opens the two output windows as ordinary popups, positioned onto a target screen's coordinates (from `ScreenDetailed.left/top/availWidth/availHeight`) before fullscreening them | Needed regardless of Window Management support — it's how you get *any* second window open at all (Window Management only tells you *where* screens are; it doesn't open windows). Also the entire fallback path when permission is denied: user manually drags the popup to the second monitor, then presses F11 |
| **BroadcastChannel** | Baseline **widely available** since March 2022 (all evergreen browsers) | Cross-window state sync: control window → audience window + confidence window, "go to slide N / blank / next" | See "Cross-window sync" analysis below — this is the correct primitive for this job, not Firestore and not a shared Pinia store |
| **Screen Wake Lock API** (`navigator.wakeLock.request('screen')`) | Baseline **2025** (shipped across evergreen browsers as of March 2025; secure-context/HTTPS required) | Keep the audience and confidence displays from sleeping/dimming during a 60–90 min service | Native, zero-dependency, exactly matches the need. Must be re-acquired per output window on `visibilitychange` (see gotchas) |

### Supporting Libraries — none required

| Library | Verdict |
|---------|---------|
| screenfull.js / any fullscreen-shim | **Do not add.** Its entire purpose is normalizing vendor-prefixed Fullscreen API calls across Safari/Firefox/old-Chrome. This project is Chromium-only by explicit constraint (PROJECT.md: "Chrome/Edge target confirmed"), and the native unprefixed API has covered Chromium fully since Chrome 71+ — a shim adds a dependency to solve a problem that doesn't exist for this target |
| Any "multi-window state management" package (e.g. broadcast-channel npm wrapper, workbox-broadcast-update) | **Do not add.** The native `BroadcastChannel` constructor is ~10 lines to wrap in a composable; a wrapper library buys nothing extra here (no IE11 need, no cross-tab-without-BroadcastChannel fallback need since target is evergreen Chromium) |
| A "presentation remote control" framework (e.g. reveal.js's multiplex plugin) | **Do not add.** Those solve *networked* remote-control (phone controls a projector over the internet); this milestone is same-machine, same-origin, same-browser-profile — BroadcastChannel already solves it for free |

## Installation

```bash
# No installation required — every recommended technology is a native
# browser API already available in the project's target browsers
# (Chrome/Edge, Chromium 100+). Zero new npm dependencies for this milestone.
```

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|--------------------------|
| Window Management API + fullscreen `screen` option | Manual drag + F11 only (no Window Management API at all) | If the app ever needs to support Firefox/Safari — those browsers have **no** multi-screen enumeration API at all as of 2026. Since PROJECT.md fixes the target to Chrome/Edge, this alternative is only the *fallback path within* Chrome/Edge (permission denied), not a parallel primary path |
| BroadcastChannel for control→output sync | Firestore `onSnapshot` (already used elsewhere in the app for real-time cross-device sync) | Firestore is the right tool when sync must cross **devices/networks** (e.g., a phone remote from another room). It is the *wrong* tool here: same-machine same-origin windows going through a server round-trip adds 100–300ms+ of network latency and a Firestore write-quota cost *per slide change*, for zero benefit — BroadcastChannel delivers synchronously in the same process with no network hop. Firestore may still be worth it later only for a genuinely remote control device, out of scope this milestone |
| BroadcastChannel | `window.postMessage()` with retained window references | Only if the control window needs guaranteed delivery to windows it does NOT still hold a reference to (e.g. a reopened window after the original reference was lost), or needs per-recipient targeting/handshake. Here the control window opens and owns both output windows, but BroadcastChannel is still simpler: no `targetOrigin` bookkeeping, and if an output window is closed and reopened it just resubscribes to the same channel name with no re-wiring needed on the sender side |
| BroadcastChannel | A shared Pinia store | Pinia state does **not** cross `window.open()` boundaries — each popup window loads its own JS bundle and gets its own isolated Pinia instance (separate JS realm). A shared store only works within one window/tab; it cannot be the sync primitive across 3 physical windows. (Pinia is still fine, even ideal, as the *local* state container inside each window, fed by BroadcastChannel messages) |
| Native `requestFullscreen({screen})` | Moving a fullscreen window with `moveTo` + refullscreen | The moved-then-fullscreened pattern is the *only* option in browsers without the `screen` fullscreen option (i.e., permission denied / API unsupported) — that's exactly the fallback path, not a general alternative |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|--------------|
| **Presentation API** (`navigator.presentation`, `PresentationRequest`) | This is a *wireless casting* API (Chromecast/DIAL/Miracast-style "second screen" presentation to a separate device), not a local multi-monitor windowing API. It solves a different problem (no browser window exists on the receiving display at all) and doesn't apply when both outputs are ordinary monitors cabled/HDMI'd into the same machine running the browser | Window Management API + `requestFullscreen({screen})` |
| **Relying on `ScreenDetailed.id` as a long-term stable device fingerprint across browser reinstalls/profile resets** | The W3C spec text (confirmed via MDN/spec documentation) describes `id` as a **per-origin, session-scoped identifier that resets when the user clears cookies/site data** — it is *not* a hardware serial number. It IS stable across ordinary reloads and browser restarts within the same profile (that's the common case for a church's dedicated projection laptop), but a cache-clear or new browser profile invalidates it silently | Persist the mapping keyed by `id`, but always **re-validate against `label` + `left/top/width/height` on load**, and gracefully fall back to "re-detect and ask" (see Pitfalls flag below) rather than assuming a saved `id` will always resolve |
| **`window.open()` calls made asynchronously (after an `await`, inside a `setTimeout`, or inside a Firestore `.then()`)** | Chromium's popup blocker requires the call to be synchronous within the original user-gesture call stack (a trusted `click` event). An `await` before the second `window.open()` call breaks that chain and the second popup is silently blocked | Resolve all data needed (screen list, service data) **before** the button click if possible, or open both popups synchronously in direct response to the click and only *then* do async work (fetch/position) inside each already-open window |
| **A generic fullscreen-shim / cross-browser polyfill library** | Solves Safari/Firefox vendor prefixing, which this Chromium-only target does not need | Native unprefixed `element.requestFullscreen()` |
| **IndexedDB for the monitor→role mapping** | Massive overkill for a single small per-device key/value record (which screen `id`/label plays Audience vs Confidence) | `localStorage` — see Persistence section below |

## Cross-Window State Sync — the decision in detail

The control window needs to push, with minimum latency and zero flicker: **go to slide N, blank/black, next/prev**, to two dependent windows it opened and (normally) still holds live references to.

**Recommended: `BroadcastChannel`, same-origin, one named channel (e.g. `"worship-run-service"`), JSON messages `{ type: 'goto', slideIndex } | { type: 'blank' } | { type: 'sync-state', ... }`.**

Rationale:
- **Latency:** in-process, same-origin, no network — effectively synchronous (microtask-scheduled), the lowest latency available to web content. Firestore `onSnapshot` round-trips through the network even on localhost-adjacent setups and is not designed for sub-100ms UI-critical fan-out.
- **No flicker:** because it doesn't depend on a server ack, the output window can apply the new slide index the instant the message arrives — no loading/pending state needed for the common case (all slide images are already resident, per the app's existing `slideshowAssembler`/render-pending model).
- **No new infrastructure:** doesn't touch Firestore reads/writes or quota (the run window shouldn't burn a Firestore write on every keypress a projectionist makes — a nervous operator hitting Next/Prev/Next/Prev rapidly during a live service should not be metered against the app's Firestore/Functions cost controls, which v1.8's cost-hardening milestone specifically built to prevent runaway spend).
- **Resilience to a reopened output window:** if the confidence monitor's window is accidentally closed and reopened (e.g. crashed or the projectionist fat-fingered it), it just needs to subscribe to the same channel name again — no handshake or reference re-wiring on the control window's side. (It will, however, miss whatever slide is "current" until the next change event — mitigate by having the control window periodically rebroadcast full state, or by having a newly-opened output window request a "hello, what's current" message and having the control window answer it once on `message` receipt — a tiny request/response layered on top of the same channel.)
- **Direct `window.open()`-returned references + `postMessage`** remains a reasonable secondary/defense-in-depth channel (e.g., to push an initial full-state payload immediately after `open()` returns, before the new window's own `BroadcastChannel` listener has necessarily attached) but should not replace BroadcastChannel as the primary channel, since it requires the sender to track live references and re-wire if a window is closed/reopened.
- **Firestore `onSnapshot`** remains the right tool if this milestone later needs a genuinely remote control surface (e.g. a phone on the church Wi-Fi acting as a clicker from across the room) — explicitly out of scope for this milestone's three-window-same-machine model, but worth flagging as the natural extension point if "remote clicker" becomes a future requirement.

## Screen Wake Lock — integration detail

- Request `navigator.wakeLock.request('screen')` **separately in each output window** (audience and confidence), not just the control window — a wake lock only keeps *that document's* screen awake; it does not prevent a different browsing context's display from sleeping.
- Chromium releases the lock automatically when a document becomes hidden/inactive (`document.visibilityState !== 'visible'`) — for an unattended fullscreen output window this is rarely triggered by the user, but can happen from OS-level display-sleep policy interactions; re-acquire on the `visibilitychange` listener as MDN's documented pattern shows.
- Secure context (HTTPS) required — already satisfied (Firebase Hosting serves HTTPS).
- Cheap to add defensively; no reason to omit it given the milestone's explicit goal is an unattended multi-hour live service.

## Persistence of the Monitor → Role Mapping (per-device "remembered" config)

- **Use `localStorage`**, keyed to the app's origin (already per-device/per-browser-profile, which is exactly the desired scope — "remembered per device" per PROJECT.md, not per-user-account/synced). A single small JSON blob is sufficient: `{ screens: [{ id, label, left, top, width, height, role: 'audience'|'confidence' }], savedAt }`.
- **Do not rely on `id` alone to resolve the saved mapping on next launch.** Per the "What NOT to Use" row above, `id` is stable across page reloads/restarts within the same browser profile — the expected common case for a fixed projection laptop — but is not guaranteed permanently stable (cookie/site-data clear resets it). The robust re-detect algorithm on the monitor-config screen's load:
  1. Call `getScreenDetails()` (or fall back to the permission-denied flow) and get the current live screen list.
  2. Try to match each saved entry by `id` first; if no match, fall back to matching by `(left, top, width, height)` (a monitor plugged into the same port at the same resolution reports identical bounds even after an `id` reset).
  3. If neither matches (monitor count/arrangement genuinely changed — a cable was moved, a new display attached), **surface the "physical layout changed, please reassign" prompt** the milestone description already anticipates ("re-prompt only if the physical monitor layout changed") rather than silently guessing.
- No IndexedDB needed — this is not blob/file storage and there is no query requirement beyond a lookup by device.

## Stack Patterns by Variant

**If `window-management` permission is granted (the primary path):**
- On the monitor-config screen: call `getScreenDetails()`, render each `ScreenDetailed` (label/position/size) as a clickable card, let the user assign Audience/Confidence, persist to `localStorage`.
- On Run: open two `window.open()` popups (audience, confidence) positioned via each target screen's `left/top/availWidth/availHeight`, immediately synchronously (same click handler, no `await` between the two calls), then in each popup call `element.requestFullscreen({ screen: targetScreenDetailed })`.
- Because `ScreenDetailed` objects are only valid within the `ScreenDetails` instance/session they came from, **pass screen identity (not the live object) across the `window.open()` boundary** — e.g. via a query string or `localStorage` read on the new window's own load, then re-resolve to a live `ScreenDetailed` by calling `getScreenDetails()` again inside that new window and matching by `id`/bounds, since a raw JS object reference cannot cross to the new window's separate realm anyway.

**If permission is denied, the API is unavailable, or `screen.isExtended === false` (single-display machine, e.g. testing/dev):**
- Fall back to plain `window.open()` positioned with `left`/`top` offset (best-effort, using `screen.availWidth` heuristics since no second-screen bounds are knowable) and instruct the operator to drag the popup to the correct physical monitor, then press F11 (native browser fullscreen) or trigger `requestFullscreen()` without the `screen` option (fullscreens whichever screen the window is currently on — validated, non-Chromium-only baseline behavior).
- Detect this path via the standard feature-detect: `if (!('getScreenDetails' in window)) { /* single-screen/manual fallback */ }` combined with a `try/catch` around the `getScreenDetails()` call itself for the denied-permission case (`NotAllowedError`).

## Version Compatibility

| Package/API | Compatible With | Notes |
|---|---|---|
| Window Management API | Chrome/Edge 100+ | Project already targets modern evergreen Chrome/Edge; no lower bound concern given the constraint is "Chrome/Edge" generally, not a pinned old version |
| `requestFullscreen({screen})` | Same Chromium 100+ gate as Window Management (shipped together as part of the same spec effort) | Do not call with the `screen` option unless `getScreenDetails()` already succeeded — passing a `ScreenDetailed` from a stale/mismatched session is undefined; always fetch fresh before use |
| BroadcastChannel | All evergreen browsers since ~2022, far below this project's Chrome/Edge 100+ floor | No compatibility risk |
| Screen Wake Lock | Baseline 2025, HTTPS required | Firebase Hosting already serves HTTPS in this project — no gap |
| Vue 3 + Pinia (existing stack) | Each `window.open()`'d popup is a separate JS realm/bundle load — Pinia store instances do NOT share state across windows automatically | Feed each window's local Pinia store via BroadcastChannel message handlers, not by assuming shared reactivity |

## Integration Points With Existing Code

- **`src/components/PresentationViewer.vue`** — the existing single-window in-app preview (`Teleport to="body"`, `fixed inset-0 z-50 bg-black`, background layer + scrim, keyboard nav, loading/render-pending states) is the template for the **audience output window's** slide-rendering logic. The new audience output route/component should reuse this rendering core (background image + scrim + slide canvas) but strip all chrome (no exit button, no counters) since "zero chrome" is an explicit requirement. Likely refactor path: extract the pure slide-canvas rendering (background + content, no controls) into a shared composable/sub-component consumed by both the existing in-app preview and the new fullscreen-output windows, rather than duplicating the background/scrim/typography logic.
- **`src/utils/slideshowAssembler.ts`** (`assembleSlideshow(service, inputs): AssembledSlide[]`) — this is the existing single source of truth for the ordered slide array (including PPTX-rendered images, backgrounds resolved at slide/group/song level, scripture congregational splits). The Run/control window should call this exactly as `PresentationViewer` does today to build the slide list once, then broadcast **only the current index** (and derived current/next slide data) to the output windows over `BroadcastChannel` — not the whole assembled array repeatedly. The confidence monitor's "current + upcoming" requirement is a pure derivation (`slides[index]`, `slides[index+1]`) from data the control window already holds.
- **Background suppression on the confidence monitor** — reuse the same background-resolution output from `slideshowAssembler`/`PresentationViewer`'s existing per-slide background logic, but the confidence-monitor renderer simply never applies the `backgroundImage` style (render text-only on black) — no new background-resolution logic needed, only a rendering-mode flag.

## Biggest Feasibility Risk — flag for roadmap

**Permission UX + the synchronous-popup constraint are the two risks a phase should explicitly own:**

1. **Permission prompt UX**: `getScreenDetails()` triggers a real, one-time-per-origin OS-style permission prompt that a non-technical projectionist must accept. If they dismiss/deny it (common for unfamiliar prompts), the app must gracefully degrade to the drag+F11 fallback described above — this fallback path is not optional polish, it is a required primary flow for any church volunteer who clicks "block" by reflex. Budget explicit UAT time for both the granted and denied paths on the monitor-config screen.
2. **Two windows, one click, zero `await` in between**: opening both the audience and confidence windows must happen synchronously within the same click handler (see "What NOT to Use" — async `window.open()` gets silently blocked). Any pre-flight async work (permission checks, screen resolution, Firestore reads for the service data) must complete **before** the "Run" button's click handler fires the two `window.open()` calls, or be restructured so both calls happen first and data loads inside the already-open windows afterward.
3. **Screen `id` instability across data/cookie clears** (see "What NOT to Use") is a secondary, lower-probability risk — mitigated by the bounds-matching fallback described in Persistence above, but should still be explicitly tested by clearing site data and confirming the re-prompt flow behaves per the milestone's stated "re-prompt only if physical layout changed" intent.

## Sources

- MDN — [Window Management API](https://developer.mozilla.org/en-US/docs/Web/API/Window_Management_API) — HIGH confidence (official docs; verified overview, interfaces, permission name, experimental/non-Baseline status)
- MDN — [ScreenDetailed](https://developer.mozilla.org/en-US/docs/Web/API/ScreenDetailed) — HIGH confidence (property definitions: label, left, top, isPrimary, isInternal, devicePixelRatio)
- MDN — [Fullscreen API](https://developer.mozilla.org/en-US/docs/Web/API/Fullscreen_API) — HIGH confidence (core `requestFullscreen()`/`exitFullscreen()`/events, Baseline status)
- MDN — [Screen Wake Lock API](https://developer.mozilla.org/en-US/docs/Web/API/Screen_Wake_Lock_API) — HIGH confidence (request/release lifecycle, visibilitychange re-acquire pattern, Baseline 2025, HTTPS requirement)
- MDN — [BroadcastChannel](https://developer.mozilla.org/en-US/docs/Web/API/BroadcastChannel) — HIGH confidence (same-origin cross-context messaging, Baseline widely available since March 2022, sender-excluded-from-own-message behavior)
- Chrome for Developers — [Manage several displays with the Window Management API](https://developer.chrome.com/docs/capabilities/web-apis/window-management) — HIGH confidence (Chrome 100+ ship version, permission-prompt-on-first-use behavior, feature-detect shim example)
- W3C `window-management` spec repo — [HOWTO.md](https://github.com/w3c/window-management/blob/main/HOWTO.md) and [EXPLAINER.md](https://github.com/w3c/window-management/blob/main/EXPLAINER.md) — HIGH confidence (canonical code patterns for `getScreenDetails()`, window placement onto a specific screen, `requestFullscreen({screen})`, feature-detection with `try/catch` fallback)
- W3C `window-management` GitHub Issue #80 ("Does getScreenDetails() always resolve with the same object?") — MEDIUM confidence (confirms `id`/object-identity stability was an open spec-clarity question during standardization; used as corroboration, not as the sole source, for the `id`-instability caution)
- caniuse.com — [`mdn-api_window_getscreendetails`](https://caniuse.com/mdn-api_window_getscreendetails) — cited as the live/current source of truth for exact per-browser support percentages; treat as authoritative over any single snapshot captured during this research pass
- Cross-checked web search (MEDIUM confidence, multiple corroborating results per claim): Edge Chromium-parity/policy documentation (Edge 123 `DefaultWindowManagementSetting` policy existing confirms the underlying API ships in that Edge generation, consistent with Chrome 100+ parity); synchronous-vs-asynchronous `window.open()` popup-blocker behavior within a single click handler; `window-management` permission grant persistence across sessions via Chrome's per-site "Additional permissions"
- Existing codebase, read directly (HIGH confidence — primary source): `src/components/PresentationViewer.vue` (single-window slide-canvas rendering pattern: Teleport-to-body, background layer + scrim, keyboard nav, loading/render-pending states) and `src/utils/slideshowAssembler.ts` (`assembleSlideshow(service, inputs): AssembledSlide[]` — existing ordered-slide data source to reuse, not rebuild)

---
*Stack research for: browser-based live worship-service presentation/projection mode (v2.4 "Run the Service")*
*Researched: 2026-08-28*
