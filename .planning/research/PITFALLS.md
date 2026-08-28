# Pitfalls Research

**Domain:** Browser-driven multi-monitor live presentation (church "Run the Service" mode)
**Researched:** 2026-08-28
**Confidence:** MEDIUM-HIGH — Window Management/Fullscreen/Wake Lock/BroadcastChannel *mechanics* are
HIGH confidence (MDN, Chrome for Developers, W3C spec, official Chromium intent threads). Live-operation
and non-technical-UX pitfalls are MEDIUM — synthesized from web-platform behavior plus this project's own
existing single-window `PresentationViewer.vue` code (read directly, not assumed) rather than from a
specific published post-mortem of church presentation software.

**Grounding note:** WorshipPlanner already ships a single-window presenter (`src/components/PresentationViewer.vue`)
that establishes real precedent this milestone must either reuse or deliberately diverge from:
- `requestFullscreen()` wrapped in try/catch with a silent CSS-overlay fallback on rejection (no toast, no retry loop).
- A `fullscreenchange` listener that **calls `exitPresentation()` the instant `document.fullscreenElement` becomes
  null while `isTrueFullscreen` was true** — i.e. today's single window already auto-exits the whole presentation
  on ANY fullscreen loss. This exact handler, reused naively per-window in a 2-3-window world, is Critical
  Pitfall #6 below.
- CSS `background-image` on a plain div, chosen specifically so a failed image load "paints nothing" rather than
  breaking the slide — but there is **no preload/decode step**, which is directly relevant to Critical Pitfall #16.
- A bounded, `Promise.race`-guarded font-load gate (`FONT_LOAD_TIMEOUT_MS`) before first paint — the right pattern,
  but it exists in exactly one window today and must be replicated (not desynced) across three.
- Keyboard nav (`Escape`, arrows, space) bound only to the viewer root, not `window`/`document` — the right
  instinct, but the *effect* of `Escape` (exit everything) needs re-scoping once a control window and two output
  windows coexist (Critical Pitfall #24).

## Critical Pitfalls

### Pitfall 1: `window-management` permission is requested at the wrong moment and silently denied

**What goes wrong:**
`getScreenDetails()` must be called from inside a user gesture handler (click), and only in a secure context
(HTTPS or localhost). Call it on page load, from a `then()` callback one tick removed from the click, from an
`async` function after an earlier `await`, or from a non-HTTPS deploy preview, and it either never prompts or
throws — with no visible error to a non-technical volunteer. Chrome also silently returns **less-detailed (or
empty) screen `label`s** depending on OS/browser policy, which the app must not depend on for identity.

**Why it happens:**
Browser gesture-tracking is stricter than it looks — any `await` before the call, or an event handler that fires
asynchronously (e.g. a Pinia action, a router-guard callback), can consume the "recent user activation" the
browser requires. Developers test on the happy path (immediate `onClick`) and never hit the failure.

**How to avoid:**
- Call `getScreenDetails()`/`requestFullscreen()` synchronously, first line, inside the actual DOM click handler
  — no `await` before it, no intermediate store dispatch.
- On the standalone monitor-config screen, gate the "Detect Monitors" button behind an explicit, single click with
  no async work ahead of the call.
- Wrap the call in try/catch and treat *any* rejection (not just `NotAllowedError`) as "no permission" — route to
  the pop-out fallback (Pitfall 3), never a dead end.
- Check `navigator.permissions.query({ name: 'window-management' })` on load to pre-populate UI state (prompt vs.
  granted vs. denied) without itself triggering a prompt.

**Warning signs:** "Detect Monitors" does nothing on click with no console error; works in dev but not on the
deployed HTTPS build (secure-context regressions are common with stale service workers/mixed content); a QA pass
that only ever tests "click detect, permission dialog appears" and never tests denial or a second click after
denial.

**Phase to address:** Monitor Configuration screen (foundation phase) — this is the single riskiest gesture call
in the whole milestone and should be built and manually tested first, isolated from Run/control-screen work.

---

### Pitfall 2: Persisted monitor→role mapping silently points at the wrong physical screen

**What goes wrong:**
The requirement is explicit: "the mapping is saved and remembered per device... re-prompt only if the physical
monitor layout changed." But Chrome's `ScreenDetailed` objects do **not** guarantee a stable identifier across
sessions for the same physical monitor — `label`, position (`left`/`top`), and even ordering in the `screens[]`
array can change on OS driver update, a docking-station reconnect, or simply plugging monitors into different
ports. If the saved mapping keys on array index or an unstable label, a Sunday-morning reconnect (extremely
common — laptops get plugged in fresh each week) silently swaps Audience and Confidence, or points Audience
fullscreen at the laptop's own built-in screen instead of the projector — live, with zero warning.

**Why it happens:**
It's tempting to persist "screen 0 = Audience" because it's the simplest thing that works in the one dev
session where it was built and tested. The instability only shows up across a reboot/reconnect, which developers
rarely repeat during a single build session.

**How to avoid:**
- Persist a **composite fingerprint** per screen — resolution (`width`×`height`), `availWidth`/`availHeight`,
  and position (`left`/`top`) together — not `label` alone and not array index alone. Treat `label` as a
  secondary, best-effort hint, never the sole key.
- On every "Run" launch (not just monitor-config screen entry), **re-fetch `getScreenDetails()` and diff the
  current fingerprint set against the saved one.** If it matches, proceed silently (the "essentially one click"
  requirement). If it doesn't, force the operator back to the monitor-config screen with a clear "your monitor
  setup changed" message — never guess and place a window on the wrong screen.
- Store the mapping **per device**, exactly as the requirement says (e.g. keyed to something durable in
  localStorage on that machine, not synced via Firestore to other machines) — a shared laptop and a dedicated
  booth PC will have different physical layouts.

**Warning signs:** Any code that indexes into `screens[i]` by a fixed number; any persistence keyed only on
`label`; no re-validation step between "load saved config" and "place fullscreen window."

**Phase to address:** Monitor Configuration screen — this is the core design problem the whole screen exists to
solve; get the fingerprint/diff logic right before building the Run flow that depends on it.

---

### Pitfall 3: No fallback plan when the Window Management API is absent or unsupported

**What goes wrong:**
Firefox and Safari do not support `getScreenDetails()`/multi-screen `requestFullscreen({screen})` at all (this
milestone targets Chrome/Edge only, but a volunteer *will* eventually try it in whatever browser is already open
on the booth laptop). If the app has only a "happy path" that assumes the API exists, an unsupported browser
either throws an uncaught error or silently does nothing, stranding a non-technical operator five minutes before
a service starts with no idea what to do.

**Why it happens:**
The API surface (`'getScreenDetails' in window`) is easy to feature-detect but easy to forget to check *before*
offering the "auto-detect monitors" UI at all, rather than after the operator has already clicked it and hit a
dead end.

**How to avoid:**
- Feature-detect on load: `('getScreenDetails' in window)`. If false (or a non-Chromium UA), the monitor-config
  screen should present the **pop-out + drag + fullscreen fallback as the primary path**, not as an error state
  reached after a failure — same UI, different entry point, so the operator never sees a broken automatic flow.
- The fallback itself: `window.open()` two plain windows (Audience, Confidence — clearly labeled in their own
  title bars/content while NOT in fullscreen), let the operator drag each to its physical monitor, and offer a
  "Fullscreen this window" button on each that calls `requestFullscreen()` from a click gesture inside that
  window.
- This fallback is not just Firefox/Safari's path — it is also Chrome's path when the operator denies the
  `window-management` permission (Pitfall 1) or when Chrome's automatic placement misjudges the layout. Build it
  once, and route to it from every failure path, not just "no API."

**Warning signs:** Any code path where "Window Management API unsupported" leads to a component that never
mounts, a blank screen, or a raw thrown-error toast instead of the manual fallback UI.

**Phase to address:** Monitor Configuration screen — the fallback must ship in the SAME phase as the
auto-detect path, not deferred to a later "polish" phase, or the milestone ships a Chrome-only tool with a hard
failure everywhere else including Chrome-with-denied-permission.

---

### Pitfall 4: Monitor unplugged/replugged or resolution changed mid-service

**What goes wrong:**
A loose HDMI cable, a projector power-cycling itself mid-service, or someone bumping the dock — any of these
fires OS-level display topology changes. The `window.screen` object and any previously-fetched `ScreenDetails`
become stale; a fullscreen window on a now-disconnected screen may get relocated by the OS to an unpredictable
position, or the app's in-memory screen list simply no longer matches reality. If the app has no listener for
this, the operator's only signal is "the projector went black" with no on-screen explanation and no obvious fix
mid-song.

**Why it happens:**
Display hot-plug is inherently rare in development (most developers don't unplug their monitor while testing)
and easy to never exercise.

**How to avoid:**
- Listen for `ScreenDetails`'s own `screenschange` event (fired when the set of screens changes) and `window`'s
  `resize`, and on either, **re-validate the current fingerprint mapping (reusing Pitfall 2's diff logic)**
  without necessarily interrupting the live show — surface a small, dismissible "monitor configuration changed"
  banner on the CONTROL window only (never on the audience output) rather than forcing a hard stop.
  - If the target screen for an already-open output window is gone entirely, do not attempt automatic
    re-placement mid-service — that risks a visibly jarring window jump. Show the control-window banner with a
    manual "reconnect" action instead.
- This is explicitly a live-operation robustness concern, not just a config-screen concern — the listener needs
  to be live for the whole Run session, not just during the setup screen.

**Warning signs:** Any monitor-detection code that runs once on config-screen mount and is never revisited once
Run mode is active.

**Phase to address:** Live-Ops Hardening phase — separate from the initial Monitor Configuration build, since it
requires the Run session's listeners to stay active for the session duration, not just the setup flow.

---

### Pitfall 5: `requestFullscreen()` on an output window silently fails because it wasn't the click target

**What goes wrong:**
Only the element/window that directly received the triggering user gesture may call `requestFullscreen()`
successfully. If the flow is "operator clicks Run in the control window" → app programmatically opens two NEW
output windows → app tries to `requestFullscreen()` inside those new windows — that fullscreen call did **not**
originate from a gesture *in that window* and will reject. This is the single most likely reason a "one-click Run"
implementation works in a dev's quick manual test (because dev tooling/extensions sometimes relax this) but fails
for the real operator.

**Why it happens:**
The natural implementation shape ("click Run, orchestrate everything from the control window") directly
conflicts with the API's same-window-gesture requirement.

**How to avoid:**
- Chrome's Fullscreen API **does** support requesting fullscreen on a *different* screen from a single gesture
  when using `element.requestFullscreen({ screen })` together with the Window Management permission already
  granted — this is the sanctioned path for the "essentially one click" experience, and it's exactly why the
  monitor-config screen must obtain that permission ahead of time (Pitfall 1), decoupling the permission grant
  from the Run-time gesture.
- Where that isn't available (permission denied, unsupported browser — Pitfall 3's fallback), each pop-out
  window needs its OWN "Enter fullscreen" affordance the operator clicks once, inside that window, after it
  opens. Do not attempt to auto-fullscreen a popped-out window from the parent's gesture.
- Test the actual deployed flow (not devtools with relaxed gesture rules) before considering this done.

**Warning signs:** `requestFullscreen()` calls wrapped in `.catch(() => {})` that silently no-op — the
existing `PresentationViewer.vue` pattern is correct in intent (never block on rejection) but must not be copied
verbatim without ALSO giving the operator a manual retry affordance per window, since in the new multi-window
world a silent catch has no other UI element yet.

**Phase to address:** Audience Output Window / Confidence Output Window phases — each output window component
owns its own fullscreen affordance and must be built with this constraint in mind from the start.

---

### Pitfall 6: Fullscreen loss auto-exits the whole Run session (reused single-window pattern)

**What goes wrong:**
The existing `PresentationViewer.vue`'s `handleFullscreenChange()` calls `exitPresentation()` — tearing down
the ENTIRE presenter — the instant `document.fullscreenElement` becomes null after having been true. In a
multi-window Run mode, this pattern applied per-window is catastrophic: an OS-level notification popup stealing
focus, a screensaver on ONE monitor, or the operator simply clicking into the control window can knock an OUTPUT
window out of fullscreen — and if that triggers a full session teardown (or even just a full exit of that
output window with no re-enter path), the congregation sees browser chrome or a blank window mid-song, and the
non-technical operator has no idea what happened or how to fix it without restarting everything.

**Why it happens:**
Copy-pasting the proven single-window lifecycle handler into each new output window without reconsidering what
"exit" should mean when there are 2-3 independent windows instead of one.

**How to avoid:**
- Per output window, on `fullscreenchange` → fullscreen lost: **do not exit or tear down.** Instead, re-attempt
  `requestFullscreen()` automatically if a very recent gesture context still exists (rare), and otherwise show a
  minimal, high-contrast, screen-local "click to re-enter fullscreen" affordance **only on that window** — the
  content underneath stays live (slides keep advancing, they're just windowed instead of fullscreen) so a
  distracted operator can recover without losing show state.
- Never let one output window's fullscreen loss cascade to the control window or the other output window.
- Explicitly design what `Escape` should do per window (see Pitfall 24) — it must not be wired to "exit
  everything" the way the single-window `handleKeydown` currently treats it.

**Warning signs:** Any `fullscreenchange` listener whose handler calls something that unmounts/closes/navigates
away from the window it's attached to, rather than something scoped to "offer re-entry."

**Phase to address:** Audience Output Window / Confidence Output Window phases, explicitly called out as a
deliberate DIVERGENCE from the existing single-window `PresentationViewer.vue` pattern — flag this in the
phase's plan so it isn't accidentally inherited via copy-paste.

---

### Pitfall 7: Fullscreen lands on the wrong physical screen

**What goes wrong:**
Without explicit screen targeting, `requestFullscreen()` fullscreens on whichever screen the window currently
occupies — which, for a freshly `window.open()`ed popup, defaults to wherever the browser decides to place new
windows (often the primary/laptop screen), not the projector. The audience sees the operator's own laptop screen
go fullscreen instead of the projector lighting up.

**Why it happens:**
Developers testing on a single-monitor dev machine never encounter this — it only manifests with real second
hardware attached.

**How to avoid:**
- With Window Management permission granted, move the window to the target screen's bounds (`window.moveTo`/
  `window.resizeTo` using the target `ScreenDetailed`'s `left`/`top`/`width`/`height`) **before** calling
  `requestFullscreen({ screen: targetScreen })`, and pass the target screen explicitly rather than relying on
  "wherever the window happens to be."
- In the fallback (no permission), rely on the operator's manual drag as the placement mechanism — the "Enter
  fullscreen" button per window then simply fullscreens wherever the operator dragged it, which is correct by
  construction.
- Test with genuinely different-resolution/DPI monitors (a common church setup: a business laptop + an older
  1024×768 projector) — coordinate math that only accounts for uniform scaling will misplace windows on mixed-DPI
  setups.

**Warning signs:** Fullscreen calls with no `{ screen }` argument in the auto-placement path; any hardcoded
assumption that screen 0 is the laptop and screen 1 is the projector without verifying against the fingerprint
saved in Pitfall 2.

**Phase to address:** Monitor Configuration screen (placement logic) + Audience/Confidence Output Window phases
(the actual `requestFullscreen({screen})` call site).

---

### Pitfall 8: Browser chrome (URL bar, tab strip, OS taskbar) leaks onto the projector

**What goes wrong:**
"Zero chrome" is an explicit requirement. True `requestFullscreen()` removes browser chrome entirely, but every
fallback path (permission denied, unsupported browser, fullscreen rejected, fullscreen lost per Pitfall 6) leaves
a windowed browser with a URL bar, tabs, and — on Windows — a taskbar potentially visible at the screen edge if
the window isn't precisely full-bleed. A congregation seeing a Chrome URL bar during worship undermines the
whole point of the feature.

**Why it happens:**
Fullscreen is treated as binary (on/off) rather than as one layer of several — window chrome, browser chrome, and
OS chrome are three independent things that must each be handled, and only the first two are addressable from
web content at all (OS taskbar auto-hide is a user-side OS setting the app cannot control).

**How to avoid:**
- Whenever true fullscreen is unavailable, the output window itself should still be maximized/borderless as far
  as `window.open()` features allow (`fullscreen` isn't a standard reliable `window.open` feature string, so
  don't depend on it — resize to the target screen's full bounds instead) and the in-page UI must visually fill
  the viewport edge-to-edge with the SAME chrome-free styling used in true fullscreen, so a fallback state still
  looks intentional rather than half-broken.
- Document, as an explicit operational instruction surfaced somewhere in the monitor-config/Run UI (not just a
  README), that the OS taskbar auto-hide should be enabled on the projector output — this is outside the app's
  control and worth a one-line on-screen tip during setup, not a silent assumption.
- Never rely on the fallback path alone for the "no chrome" promise — make true fullscreen the strongly
  preferred path and the windowed fallback a degraded-but-still-usable state, not an equally-supported design.

**Warning signs:** A demo that only ever tests the happy path (permission granted, fullscreen succeeds) and never
screenshots the fallback windowed state to check how much chrome shows.

**Phase to address:** Audience Output Window phase — this is specifically the phase with the "zero chrome"
requirement, so its acceptance criteria should include a screenshot check of the degraded/fallback state, not
just the happy path.

---

### Pitfall 9: Popup blockers silently kill the output windows

**What goes wrong:**
`window.open()` calls not made synchronously inside a trusted user-gesture handler are blocked by the browser's
popup blocker — silently, with only a small, easy-to-miss icon in the address bar. If Run mode opens two windows
via `window.open()` from inside an `async` handler with any `await` before the call (e.g. awaiting a Firestore
lock-check or a Pinia store read first), one or both output windows simply never appear, and a non-technical
operator has no idea a "blocked" indicator even exists, let alone how to allow it.

**Why it happens:**
Same root cause as Pitfall 1/5 — the tendency to do "just one more async thing" before the gesture-gated call,
which invisibly moves the call outside the gesture window from the browser's perspective.

**How to avoid:**
- Call every `window.open()` synchronously, first in the click handler, before any `await`. If pre-flight
  checks are needed (e.g. "is the service still locked?"), do them BEFORE the click is even possible (disable the
  Run button until preconditions are met) rather than inside the handler after the click.
- Detect a blocked popup: `window.open()` returns `null` (or a window whose `closed` property is immediately
  `true`) when blocked. Check this and show an explicit, plain-language instruction ("Your browser blocked a
  popup — click the icon in the address bar and choose Always Allow, then try Run again") rather than a generic
  error or silent nothing.
- Since this is a controlled, single-church-owned booth machine in practice, document (in the monitor-config
  setup flow) a one-time "allow popups for this site" step as part of first-run setup, so it's resolved once,
  not every Sunday.

**Warning signs:** No `null`-check on the return value of `window.open()`; Run flow that awaits ANYTHING between
the click and the `window.open()` calls.

**Phase to address:** Run/Control Screen phase (the button that triggers window opening) — pair with Monitor
Configuration for the one-time popup-allow instruction.

---

### Pitfall 10: Race condition on window open — output window renders before it has service/slide state

**What goes wrong:**
A freshly `window.open()`ed window starts with a blank document and must load its own JS bundle, mount Vue, get
auth/org context (see Pitfall 25), and subscribe to whatever state carries the current slide index before it can
render anything meaningful. If the control window immediately starts pushing "go to slide N" messages the moment
`window.open()` returns (assuming the child is ready), those early messages are lost — the child isn't listening
yet — and the output window opens on the wrong slide (or a blank/loading state) until the NEXT navigation action
finally lands.

**Why it happens:**
`window.open()` returns synchronously with a window handle, which developers naturally treat as "the window is
ready," when in reality it has only started loading.

**How to avoid:**
- Use a ready-handshake: the output window, once mounted and subscribed, sends a "ready" message (via
  `BroadcastChannel` or `postMessage`) that the control window waits for before sending the first navigation
  command — or, simpler and more robust for this app's architecture, make the **output windows pull current
  state themselves** (read the current slide index from the same Firestore-backed run-state document the control
  window writes to) rather than relying on the control window to push an initial state at open time. Pull-based
  state removes the race entirely: whenever the output window finishes mounting, it reads whatever the current
  value already is, regardless of timing.
- If a push channel (BroadcastChannel) is used for LOW-LATENCY slide-advance during the live show (recommended —
  see Pitfall 15), still treat Firestore (or localStorage as a same-device-only alternative) as the source of
  truth for "current state," and have BroadcastChannel messages be advisory nudges to re-read that source, not
  the sole channel of truth. This also makes reload (Pitfall 11) trivial.

**Warning signs:** Any design where the control window's "open windows and immediately send slide 1" logic has no
handshake and no fallback pull; an output window that shows the WRONG slide on first open (works fine on
subsequent navigation) is the exact symptom.

**Phase to address:** Run/Control Screen phase (state architecture decision) — this determines the sync model for
the whole milestone and should be settled before the output-window phases are built on top of it.

---

### Pitfall 11: Reloading (or auto-restarting) one window loses its place

**What goes wrong:**
Browsers reload tabs/windows for many reasons outside the operator's control: an accidental F5/Ctrl-R, a Chrome
background-tab memory-pressure discard-and-reload, a crashed renderer process auto-recovering. If the output
window's current-slide-index is held ONLY in that window's own in-memory Vue state (as the existing single-window
`currentIndex` ref is, in a single-window presenter with no persistence need), a reload snaps it back to slide 0
— potentially DURING a live song, with the confidence monitor and the projector now disagreeing, or the projector
jumping back to the start of the service in front of the congregation.

**Why it happens:**
The existing single-window presenter has no reload-survival requirement (it's opened fresh, presented, closed) —
that assumption breaks once "presented" is a standing state across a whole service that must survive incidental
reloads of any one of three windows.

**How to avoid:**
- Persist the run-state (current slide index / current item) in Firestore (or, for same-device-only recovery,
  localStorage as a same-origin sync mechanism) as the state a window rehydrates FROM on mount, not just a stream
  it listens to going forward. This is the same "pull current state on mount" design as Pitfall 10's fix, and the
  two share one implementation.
- On the control window specifically, treat a reload as recoverable-by-design: reopening the control screen for a
  locked, in-progress service should resume at the last-known slide, not restart the Run flow from scratch.
- Consider `beforeunload` confirmation on the control window (not the output windows, which the operator won't be
  clicking into) to reduce accidental reloads, though this must never be relied on as the only defense — real
  crashes and auto-discards bypass it entirely.

**Warning signs:** Slide-position state that lives only in a Vue `ref`/Pinia store with no Firestore/localStorage
backing; no manual test of "hit F5 on the projector output window mid-service."

**Phase to address:** Run/Control Screen phase (state architecture, same root cause as Pitfall 10).

---

### Pitfall 12: Feedback loop / message storm on a shared sync channel

**What goes wrong:**
If both the control window and the output windows write to the SAME shared channel (e.g. all three windows both
publish AND subscribe to the same Firestore run-state document, or all echo BroadcastChannel messages back out),
a naive implementation can create an update loop: output window A reads a change, "acknowledges" it by writing
back, which triggers output window B to react to what it thinks is a new change, and so on. At best this wastes
Firestore writes/reads (cost — see Security/Cost section); at worst it causes visibly janky slide flicker as
windows repeatedly re-render from their own echoed updates.

**Why it happens:**
A single shared document/channel with no clear single-writer convention is the natural first design, and the
loop risk is invisible until multiple windows are actually running simultaneously against it (easy to miss when
developing/testing one window at a time).

**How to avoid:**
- Enforce a strict single-writer model: **only the control window writes** the run-state (current index, current
  item). Output windows are read-only subscribers — they never write back to that document/channel, period.
- If a local BroadcastChannel is layered on top for low-latency same-device sync, give it the same one-writer
  rule, and make output-window handlers idempotent (setting `currentIndex` to the same value it already is should
  be a no-op re-render, not a cascading side effect).
- Keep operator-facing actions (advance/back/jump) as the ONLY things that mutate run-state, and route them
  exclusively through the control window's UI, never from an output window (which won't have that UI anyway,
  supporting Pitfall 21's chrome-free requirement).

**Warning signs:** Firestore write counts that scale with the number of open windows rather than with operator
actions; any output-window code path that calls a "set current slide" mutation.

**Phase to address:** Run/Control Screen phase (sync architecture) — establish the single-writer rule as an
explicit design decision in the phase plan, not an implicit assumption.

---

### Pitfall 13: An output window closed mid-service has no recovery path

**What goes wrong:**
The operator (or a stray click, or an OS window-manager shortcut like Alt+F4/Cmd+W) closes the projector output
window mid-song. The projector goes to whatever's behind it (desktop, another app) with zero on-screen indication
to the congregation-facing operator's control screen that anything is wrong — or worse, the operator doesn't
notice until someone in the congregation flags it, well after the fact.

**Why it happens:**
`window.open()`-created child windows have no built-in "notify parent when closed" behavior unless explicitly
wired up, and it's easy to build the happy "windows stay open all service" path without building for the
window being closed.

**How to avoid:**
- On the control window, poll (or better, listen via a `beforeunload`/`unload` handler INSIDE the child window
  that posts a "closing" message before it closes, plus a periodic liveness check using `childWindow.closed`)
  the state of both output window handles. The moment either reports closed, show an unmissable, persistent
  banner on the control screen: "Audience display closed — click to reopen" (same for Confidence).
  `childWindow.closed` is reliable and cheap to poll (e.g. every 1-2s) as a backstop even without the `unload`
  message, since `window.open()`'s returned handle survives the child closing.
- Make "reopen" a single click that re-runs the same open+place+fullscreen flow from Pitfall 5/7, targeting the
  SAME saved screen mapping — no need to re-detect monitors, since the layout hasn't changed, just the window.
- This reopen affordance should be reachable without leaving/restarting the whole Run session — the rest of the
  show (song position, etc.) must be untouched by one window's closure, per Pitfall 11's persisted state.

**Warning signs:** No `window.closed` checks anywhere in the control window's lifecycle; a manual test that never
includes "close the projector window on purpose mid-test and see what the operator sees."

**Phase to address:** Run/Control Screen phase — this is squarely a control-screen responsibility (it must own
monitoring + reopening both children) and belongs with the "you are here" / recovery UX work (Pitfall 23).

---

### Pitfall 14: Machine sleep, lid close, or OS screensaver blacks out the projector

**What goes wrong:**
A laptop with default power settings sleeps after idle timeout, or a screensaver kicks in — during a sermon (long
stretch with no mouse/keyboard activity if the operator isn't actively clicking), the projector output goes black
or shows a screensaver/lock screen instead of the current slide. The Screen Wake Lock API prevents the *display*
from sleeping, but only for the tab/window that holds the lock, and **only while that document stays active** —
the lock is automatically released the moment its document becomes hidden/inactive (e.g. the operator alt-tabs
to check something in the control window, which can affect focus/visibility semantics of the output windows
depending on OS/browser).

**Why it happens:**
Wake Lock is easy to acquire once and forget about; its automatic-release-on-visibility-change behavior is exactly
the kind of edge case that doesn't show up in a five-minute manual test but absolutely shows up over a
60-90-minute live service.

**How to avoid:**
- Request `navigator.wakeLock.request('screen')` from EACH output window independently (not just the control
  window) as soon as it mounts, since it's the projector/confidence-monitor displays that must never sleep — the
  control window (which the operator is actively touching) is far less at risk.
- Listen for `visibilitychange` on each output window and **re-acquire the wake lock** whenever the document
  becomes visible again, per MDN's documented requirement that a released lock is not automatically restored.
- Treat this as a MUST-HAVE for the live-ops hardening phase and give it an explicit manual test: leave the app
  running with no interaction for the length of a real sermon (15-30+ min) and confirm the projector never sleeps.
- Feature-detect (`'wakeLock' in navigator`) and, where absent, this is one thing that genuinely has no good web
  fallback — surface it as a one-time setup tip ("disable sleep/screensaver on this machine while running
  service") rather than silently hoping Wake Lock covers it everywhere.

**Warning signs:** Wake lock requested once in `onMounted` with no `visibilitychange` re-acquire logic; no test
longer than a couple of minutes.

**Phase to address:** Live-Ops Hardening phase, though the initial `navigator.wakeLock.request()` call itself
belongs in each Output Window phase (acquire on mount) with the re-acquire robustness layered in Live-Ops
Hardening.

---

### Pitfall 15: Firestore realtime as the ONLY sync channel introduces latency, offline gaps, and cost

**What goes wrong:**
If slide-advance commands travel exclusively through a Firestore `onSnapshot` listener (control window writes a
doc, output windows react to the snapshot), every "next slide" click incurs a network round-trip through Google's
infrastructure even though the control window and the output windows are very likely running IN THE SAME
BROWSER, on the SAME machine, a few feet apart. This adds visible latency to slide-advance (a real UX cost during
a live show where the band/vocalist is watching the confidence monitor for the cue) and makes the whole Run mode
depend on the venue's internet connection — a Wi-Fi blip during a service (not rare in a church building with a
crowd of phones) could delay or drop a slide-advance write.

**Why it happens:**
Firestore realtime is this app's existing, familiar sync primitive for everything else, so it's the natural
default reach for "sync windows too" — but same-device, same-origin windows have a faster, free, local channel
available (`BroadcastChannel`) that this pattern skips past.

**How to avoid:**
- Use **`BroadcastChannel`** (or `localStorage` + `storage` events as an older-browser-compatible variant) as the
  PRIMARY, low-latency channel for slide-advance between windows on the same device — same-origin,
  effectively-instant, zero network cost, works fully offline.
- Reserve Firestore for what actually needs it: persisting run-state for reload-survival (Pitfall 11) and
  reopen-recovery (Pitfall 13) durably, cross-device visibility if ever needed later, and as the reconciliation
  source of truth the pull-on-mount logic (Pitfall 10) reads from — but not as the hot path for every single
  slide-advance click.
- Since `BroadcastChannel` delivers only to currently-open, currently-listening contexts (messages sent while a
  window isn't open/subscribed are simply lost, not queued), always pair it with the Firestore pull-on-mount/
  reload fallback rather than treating it as sufficient on its own.
- This also directly controls Firestore read/write volume: a service with hundreds of slide-advances over 60-90
  minutes, times however many admin dashboards or viewer sessions might also be subscribed, adds up — moving the
  hot path off Firestore keeps the existing app's cost-guardrail posture (see v1.8 Cost & Billing Hardening
  precedent in this project's history) intact rather than reintroducing a new realtime cost surface this
  milestone didn't need to create.

**Warning signs:** A "next slide" click that visibly lags before the projector updates; Firestore write-volume
that scales 1:1 with slide-advances rather than with milestone events (session start/end, reload).

**Phase to address:** Run/Control Screen phase (sync architecture decision, made once, early) — this is the same
architectural decision point as Pitfalls 10-12 and should be resolved together, not per-window.

---

### Pitfall 16: Background image/PPTX PNG not preloaded — flash of empty/wrong slide

**What goes wrong:**
The existing single-window presenter's background is a CSS `background-image` on a plain `<div>`, deliberately
chosen so a FAILED load paints nothing rather than breaking the slide — but there is no PRELOAD step, so on a
normal slide advance to a slide with a new (not-yet-fetched) background or PPTX-rendered PNG, the browser starts
fetching the image only once that slide becomes current. For a moment, the audience sees the slide's text/content
on a black background before the image pops in — or, worse, on a slow connection/large PPTX PNG, several seconds
of the WRONG (previous) background lingering or a jarring pop-in mid-verse. In a chrome-free, "calm" live
presentation, any visible content pop-in reads as broken, not calm.

**Why it happens:**
The single-window presenter's background choice optimized for "never show a broken image," which it does well —
but that's a different problem from "never show a LATE image," which needs preloading, not just graceful-failure
styling.

**How to avoid:**
- Preload the NEXT slide's (and ideally the next 2-3 slides') background image and any PPTX-rendered PNG the
  moment the current slide is shown — a simple `new Image(); img.src = nextUrl` warms the browser's HTTP cache so
  the actual slide-advance paints from cache, not network.
- For PPTX imports specifically (this project's existing render pipeline produces per-page PNGs in Storage),
  apply the same preload-ahead strategy across an entire imported deck's page sequence when a service containing
  one is opened for Run, not just slide-by-slide — a deck can be dozens of pages, and preloading only ±1 slide at
  a time risks the operator navigating (via click-to-jump, an explicit requirement) faster than the preload
  window covers.
- This concern applies independently to the OUTPUT windows, not just the control window's own preview — each
  output window needs its own preload logic since they're separate documents with separate image caches (browser
  HTTP cache is shared per-origin so a fetch in one window DOES warm the others' loads too, but don't rely on
  load-ORDER across windows; each window should still preload proactively for slides it's about to show).

**Warning signs:** Any manual test that only clicks "next" slowly, one at a time, with pauses (which hides the
pop-in) rather than clicking through a whole service quickly, or jumping directly into a slide deep in a large
PPTX import.

**Phase to address:** Audience Output Window phase (background rendering) — pair with the PPTX-heavy service test
scenario explicitly in that phase's verification.

---

### Pitfall 17: Font not resident before first paint, independently, in each new window

**What goes wrong:**
The existing single-window presenter already solves this correctly for itself — a bounded `Promise.race`-guarded
font-load gate before the slide canvas renders (`FONT_LOAD_TIMEOUT_MS`, `waitForSlideFont`, `loadFontCss`). But
that gate is currently local to one component instance. If the new output windows are separate top-level
documents (as `window.open()`-created windows necessarily are, not just separate Vue components sharing one
document), each one must independently load and gate on the curated font face — and if the gate logic isn't
faithfully replicated (or, worse, if one window's gate has a bug the other doesn't), the audience and confidence
monitor could show DIFFERENT fonts for the same moment, or one could flash a fallback font while the other
doesn't.

**Why it happens:**
Multiplying one working component into three separate top-level app instances (control, audience output,
confidence output) is easy to under-scope as "just reuse the component" without checking whether the surrounding
per-document bootstrap (auth, font loading, store hydration) also needs to be duplicated correctly.

**How to avoid:**
- Extract the existing font-load-gate logic (`waitForSlideFont`/`loadFontCss`/`FONT_LOAD_TIMEOUT_MS` from
  `slideTypography.ts`) as a shared, already-tested utility and call it identically from BOTH new output windows'
  mount lifecycle — do not let two independent implementations drift.
  This module already exists (`src/utils/slideTypography.ts`) — reuse it directly rather than reimplementing.
- Keep the SAME bounded-timeout behavior (never hang indefinitely) in both windows — a stalled font load in one
  output window must degrade to "render anyway" exactly as it does today, independently in each window (one
  window's slow network shouldn't block the other's render).

**Warning signs:** Font-loading logic copy-pasted with any divergence between the two output-window
implementations; visual QA that only screenshots one output window and assumes the other matches.

**Phase to address:** Audience Output Window + Confidence Output Window phases — call out explicitly in both
phase plans that they share the existing `slideTypography.ts` utility rather than reimplementing it.

---

### Pitfall 18: The operator can't tell which window is which, or drags the wrong one

**What goes wrong:**
In the pop-out fallback (Pitfall 3), the operator is handed two or three plain browser windows and must manually
drag the right one to the right monitor. If those windows are visually indistinguishable (both just show a black
or loading screen before content loads, or generic browser chrome with a generic tab title), a non-technical
volunteer under time pressure can easily drag the wrong window to the wrong screen — putting the confidence
monitor's black-background+current/next view on the projector, or vice versa.

**Why it happens:**
Developer testing tends to already know which window is which from context (dev tools, code); the actual visual
distinction a first-time user needs is easy to skip.

**How to avoid:**
- Before entering fullscreen, EACH pop-out window's tab title AND on-screen content should carry an unmistakable,
  large, plain-language label — "AUDIENCE DISPLAY — drag to projector, then click Fullscreen" / "CONFIDENCE
  MONITOR — drag to stage monitor, then click Fullscreen" — that disappears the moment fullscreen is actually
  entered (so it never leaks to the congregation, satisfying the "zero chrome" requirement for the FINAL state
  while still being helpful during the SETUP state).
- Give the two windows visually distinct accent colors or icons during this pre-fullscreen labeling state, not
  just text, so the distinction registers at a glance under time pressure.
- The auto-placement (Chrome + granted permission) path sidesteps this entirely by not requiring manual dragging
  — which is one more reason the primary path should be strongly preferred over the fallback (Pitfall 3), with
  the fallback reserved for when auto-placement genuinely isn't available.

**Warning signs:** Pop-out windows that show the SAME loading/blank content before the operator interacts with
them; a "which window is which" question in any UAT session.

**Phase to address:** Run/Control Screen phase (fallback window creation) — this is specifically about the
in-between state before either output window is fully configured, so it belongs with the window-opening logic.

---

### Pitfall 19: The audience sees operator chrome, cursor, or hover states

**What goes wrong:**
Even inside true fullscreen with zero browser chrome, the OS mouse cursor itself remains visible by default
unless explicitly hidden — an idle cursor sitting on the projected slide (or worse, visibly moving as the
operator uses a trackpad to navigate) breaks the "calm, non-technical" presentation the milestone explicitly
wants. Likewise, any hover-triggered UI (a tooltip, a `:hover` CSS state meant for the control window's buttons)
must never exist on the audience/confidence outputs at all, since there's no legitimate reason for a mouse to
ever interact with those windows during a live show.

**Why it happens:**
The existing single-window presenter is deliberately interactive (chrome fades in on `mousemove` via
`registerActivity`, exactly the RIGHT behavior for a single all-in-one presenter window the operator directly
clicks through) — but that exact mousemove-reveals-chrome pattern is precisely wrong for output-only windows that
should have no interactive chrome to reveal at all.

**How to avoid:**
- The audience and confidence OUTPUT windows should render NO interactive chrome whatsoever — no chevrons, no
  progress pill, no exit button — full stop, not "chrome that fades out." Navigation lives exclusively in the
  control window; the output windows are pure, passive renders of current state.
- If the mouse must ever be moved across an output window's screen (rare, but e.g. dragging during initial
  fallback setup), consider CSS `cursor: none` once that window enters its "final," post-setup, fullscreen state
  — applied only after fullscreen is confirmed, never during the setup/drag phase where the cursor is the
  operator's only tool.
- Explicitly design the output windows as a DIFFERENT component tree from the interactive single-window
  `PresentationViewer.vue`, reusing only the presentational (slide-rendering) pieces, not the chrome/
  activity-tracking wrapper.

**Warning signs:** Reusing `PresentationViewer.vue` wholesale (with its exit button, nav chevrons, and
`registerActivity` mousemove handler) as the output-window component instead of building a dedicated, chrome-free
render-only variant.

**Phase to address:** Audience Output Window + Confidence Output Window phases — flag as an explicit "new
component, not a reuse of PresentationViewer.vue" decision in both phase plans.

---

### Pitfall 20: No "you are here" indicator and no obvious recovery path during a live service

**What goes wrong:**
The control screen's requirement is "the order of service down one side with the current item clearly
highlighted... a large current-slide view" — this is explicitly there because a non-technical volunteer, mid-live
-service, with a congregation in front of them and zero second chances, needs to instantly answer "am I on the
right slide? did that click register? is everything actually connected?" without hunting. If the highlight is
subtle, if there's any lag between click and visible confirmation, or if there's no persistent at-a-glance
"projector: connected, confidence: connected" status, the operator's only feedback loop is turning around to look
at the actual projector screen — which they may not have a clear line of sight to from the booth.

**Why it happens:**
"Looks obviously correct in a demo with one developer clicking through it slowly" is a very different bar from
"stays obviously correct under live-service adrenaline, glanced at peripherally while also watching the band and
the pastor."

**How to avoid:**
- Make the current-item highlight and current-slide-number progress indicator large, high-contrast, and updated
  with NO perceptible lag from click to visual confirmation in the control window itself (this is Pitfall 15's
  BroadcastChannel-for-latency argument applying to the control window's OWN feedback too, not just the output
  windows).
- Add a small, persistent, always-visible connection-status indicator for each output window ("Audience: Live" /
  "Confidence: Live", tied directly to the `window.closed` liveness check from Pitfall 13) so the operator never
  has to guess or turn around to check — this single element does double duty as the "you are here" signal and
  the recovery-path entry point (click it to reopen if closed).
- Design and user-test the control screen's information hierarchy explicitly against "a volunteer who has never
  used this before, glancing at it while listening to a song" — this is exactly the UI-research task this
  milestone already calls out (ProPresenter/EasyWorship/Proclaim conventions), and the finding should directly
  shape this screen's layout.

**Warning signs:** A control-screen design that looks clear in isolation (developer testing) but has no dedicated
research/UAT pass simulating actual live-service pressure and peripheral-vision use.

**Phase to address:** Run/Control Screen phase — this is the phase's core UX deliverable, and should be paired
with the milestone's planned UI-research task on live-presentation software conventions.

---

### Pitfall 21: Accidental exit of Run mode mid-service

**What goes wrong:**
The existing single-window presenter binds `Escape` to `exitPresentation()` (a reasonable, standard convention
for a single presenter view). In the new multi-window Run mode, if `Escape` (or any other easily-mis-hit key/
gesture) is bound the same way at the CONTROL window level, an operator innocently pressing Escape to, say,
close a dropdown or dismiss a tooltip could tear down the entire live Run session — closing output windows,
losing state — in front of the congregation, with no confirmation step.

**Why it happens:**
Escape-to-exit is such a strong, universal convention for "close/dismiss" that it's easy to leave wired the same
way when lifting logic from the single-window presenter, without considering that the STAKES of accidentally
triggering it are now much higher (tearing down a live, multi-window session vs. closing one preview overlay).

**How to avoid:**
- Do NOT bind a single-keypress "exit Run mode entirely" anywhere reachable by accident. If a keyboard exit is
  wanted at all, require an explicit, deliberate action — a confirmation dialog, a press-and-hold, or a dedicated
  "End Service" button the operator must click (with a "Are you sure?" step) rather than a key that might be
  pressed for an unrelated reason (dismissing a modal, muscle memory from other software).
- Reserve simple keys (arrows, space) for slide navigation ONLY, per the milestone's own "standard keyboard
  navigation" requirement — navigation and session-teardown must be two clearly different classes of action with
  very different accidental-trigger costs.
- Ending Run mode should not, by itself, need to close the output windows immediately either — consider leaving
  them showing the LAST slide (or fading gracefully) rather than instantly blanking the projector the moment
  "End Service" is confirmed, since the congregation may still be mid-transition (e.g. moving to a spoken
  benediction) when the operator ends the digital run.

**Warning signs:** Any reuse of the existing `handleKeydown`'s `case 'Escape': exitPresentation()` wired directly
into the new control screen without a confirmation gate.

**Phase to address:** Run/Control Screen phase — explicit design decision, flagged as a deliberate divergence
from the single-window Escape-to-exit precedent.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|-----------------|------------------|
| Reuse `PresentationViewer.vue` wholesale as an output window instead of building a dedicated render-only component | Fast to ship, proven rendering logic | Ships interactive chrome (exit button, nav chevrons, cursor-reveal-on-move) to the audience — directly violates the "zero chrome" requirement (Pitfall 19) | Never for the final Audience/Confidence outputs — acceptable only as a throwaway first spike to validate slide-rendering reuse, then must be forked into a chrome-free variant |
| Sync windows purely via Firestore `onSnapshot`, skip `BroadcastChannel` | Reuses the app's one existing sync primitive, less new surface area | Visible slide-advance latency + needless Firestore read/write volume + a network dependency for a same-device operation (Pitfall 15) | Acceptable only for an early spike/prototype to prove the multi-window concept works at all — not for the shipped Run experience |
| Key the persisted monitor mapping on `screens[i]` array index | Trivial to implement | Silently swaps Audience/Confidence on any reconnect/reorder (Pitfall 2) — this is the single highest-consequence shortcut in the whole milestone | Never |
| Skip the `window.closed` liveness polling / reopen affordance for output windows | Simpler control-window code | An accidentally closed projector window has no recovery path except restarting the whole Run session live (Pitfall 13) | Only acceptable for a v1/MVP milestone slice IF the roadmap explicitly schedules the polling+reopen work as a fast-follow before the feature reaches real Sunday use — never ship it permanently missing |
| Skip preloading next-slide backgrounds/PPTX PNGs | Less code, works fine in a quick manual demo | Visible flash/pop-in during a real service, especially with large PPTX decks (Pitfall 16) | Acceptable for an internal dev preview only; not acceptable for the shipped feature given the "calm, non-technical UX" goal |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|-----------------|-------------------|
| Window Management API (`getScreenDetails`) | Calling it after an `await` or outside a direct click handler, so it never prompts or silently rejects | Call synchronously, first line, inside the DOM click handler; pre-check `navigator.permissions.query({name:'window-management'})` for UI state without prompting |
| Fullscreen API on a popped-out window | Trying to `requestFullscreen()` a child window from the PARENT's gesture | Either use `requestFullscreen({screen})` from the ORIGINAL gesture with permission already granted, or give each child window its own in-window fullscreen button click |
| `window.open()` for output windows | Calling it after any `await`, tripping the popup blocker silently | Call synchronously in the click handler; check the returned handle for `null`/immediately-`closed` and surface an explicit "popup blocked" instruction |
| BroadcastChannel | Treating it as a reliable/queued channel — messages sent while a listener isn't open are lost | Use it for low-latency advisory nudges only; back it with a Firestore/localStorage pull-on-mount for the actual source of truth |
| Screen Wake Lock API | Acquiring once on mount and never re-acquiring | Re-request on every `visibilitychange` to `visible`; acquire independently in each output window, not just the control window |
| Firebase Auth / Pinia store in a `window.open()` child | Assuming the child window shares the parent's JS memory/module state | It does NOT — a `window.open()` popup is a fully separate document/JS realm; the child must independently bootstrap Firebase Auth (onAuthStateChanged) and re-hydrate any Pinia state it needs (see Security Mistakes below) |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|-----------------|
| No image preload-ahead for backgrounds/PPTX PNGs | Visible flash-to-black or pop-in on slide advance | Preload next 2-3 slides' images on every slide change, in every output window independently | Any service with a background image or an imported PPTX deck — i.e. most real services, not an edge case |
| Three independent Firestore `onSnapshot` listeners (control + 2 outputs) all subscribed to the same run-state doc for every slide-advance | Elevated Firestore read volume that scales with clicks × open windows; visible sync latency | Move the hot path (slide-advance) to `BroadcastChannel`; keep Firestore for reload-survival/reconciliation only | Noticeable once real services run 60-90+ min with frequent navigation; compounds the existing v1.8 cost-guardrail concerns this project has already had to harden once |
| Font-load gate re-running independently, un-cached, per window on every mount | Slightly longer first paint per window; risk of visible font mismatch between windows if timeouts differ | Share one tested utility (`slideTypography.ts`) across both output windows verbatim | Noticeable mainly during Run session START (all windows mounting near-simultaneously) — a cold-cache first Sunday, not steady state |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Assuming a `window.open()`-created output window inherits the parent's authenticated Firebase session/Pinia store automatically | The child window has no auth context until it independently initializes Firebase and waits for `onAuthStateChanged` — a naive implementation either shows a flash of "not signed in"/empty state, or worse, tries to read org-scoped Firestore data before auth is ready and gets permission-denied errors that silently blank the slide | Bootstrap the child window as a genuinely independent mini-app: initialize Firebase, wait for auth state, THEN subscribe to the run-state/service data — gate all rendering behind that readiness, same pattern the main app already uses for its own initial load |
| Passing org/service context to the child window ONLY via an in-memory reference from `window.open()`'s return value | If the child window is reopened after being closed (Pitfall 13's recovery flow), or navigated/reloaded (Pitfall 11), that in-memory context is gone and there's no way to re-derive which org/service to show | Pass context via the URL (`?serviceId=...&role=audience`), not via JS object references across windows — the URL survives reload and reopen and is the correct mechanism for two independent documents to agree on shared context |
| Output windows reading Firestore documents scoped by client-side org-membership assumption without re-verifying `firestore.rules` coverage for this NEW read pattern | A new document shape (run-state) introduced for this milestone needs its own `firestore.rules` coverage — reusing an existing service-scoped rule may not automatically cover a new subcollection/field, and this project has direct history (`storage.rules`, `firestore.rules` gaps) of shipped features exposing data before rules caught up | Write and test explicit ALLOW/DENY rules for whatever new run-state document(s) this milestone introduces, using this project's own `npm run test:rules` pattern, before any Run-mode read/write path ships |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-------------------|
| Reusing single-window `Escape`-to-exit semantics on the control window | One misplaced keypress tears down a live session in front of a congregation | Require a deliberate, confirmed action to end Run mode; reserve simple keys for navigation only |
| No visible confirmation that a click registered before the output window catches up | Operator double-clicks or panics, losing track of true state | Instant, no-lag visual feedback in the control window itself (via low-latency local sync), independent of output-window round-trip |
| Generic/identical-looking pop-out windows during fallback setup | Operator drags the wrong window to the wrong monitor | Large, unmistakable, distinctly-colored "AUDIENCE" / "CONFIDENCE" setup-state labels that disappear once fullscreen is entered |
| Output windows exposing the SAME interactive chrome (exit button, chevrons) as the internal preview | Congregation sees UI chrome or the operator's mouse activity | Purely presentational, chrome-free output components — a deliberate fork, not a reuse, of the existing interactive presenter |
| Silent failure states (permission denied, popup blocked, fullscreen rejected) with no operator-facing message | Non-technical volunteer stuck with no idea what to try next, minutes before a live service | Every failure path routes to a specific, plain-language instruction and a concrete next action — never a silent no-op |

## "Looks Done But Isn't" Checklist

- [ ] **Monitor auto-detect:** Often missing the fallback for denied permission / unsupported browser — verify by
      explicitly denying the permission prompt and confirming the pop-out+drag flow still works end-to-end.
- [ ] **"One-click Run":** Often missing the re-validation of the saved monitor mapping against the CURRENT screen
      set — verify by unplugging/replugging a monitor (or changing resolution) between two Run sessions and
      confirming a stale mapping is caught, not silently applied.
- [ ] **Zero-chrome audience output:** Often missing chrome-free styling for the FALLBACK (non-fullscreen)
      windowed state — verify by forcing the fallback path and screenshotting it, not just the true-fullscreen
      happy path.
- [ ] **"Remembered per device":** Often actually synced via Firestore/account instead of kept local-to-machine —
      verify by logging into the same account on a second machine and confirming it does NOT inherit the first
      machine's monitor mapping.
- [ ] **Recovery from a closed output window:** Often entirely unbuilt — verify by deliberately closing each
      output window mid-"service" and confirming a one-click reopen exists with no loss of slide position.
- [ ] **Long-running stability:** Often only tested for a few minutes — verify with a real-length (60-90 min)
      idle-heavy run (long sermon-equivalent stretch with minimal clicking) to catch Wake Lock release, sleep,
      or listener-cleanup issues that only surface over time.
- [ ] **Background/PPTX image preloading:** Often missing entirely — verify by rapidly click-jumping through a
      large imported PPTX deck and watching for any flash-to-black or stale-image frame.

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|------------------|
| Stale monitor mapping applied silently | LOW | Force a re-detect on every Run launch (Pitfall 2's fix) rather than only reacting after a visible misplacement; if it's already shipped without this, add the fingerprint diff as a fast-follow patch |
| Output window closed mid-service, no reopen path | MEDIUM | Add `window.closed` polling + a reopen button to the control window; requires the persisted run-state (Pitfall 11) to already exist so reopening resumes at the right slide rather than slide 0 |
| Escape/keypress accidentally tears down Run mode | LOW | Gate the exit action behind a confirmation dialog; low-risk, isolated change to one handler |
| Firestore-only sync causing visible lag | MEDIUM | Introduce `BroadcastChannel` as the low-latency layer alongside the existing Firestore writes (additive, not a rip-and-replace) — the Firestore path can stay as the reconciliation/reload source of truth |
| No image preloading, visible pop-in | LOW-MEDIUM | Add a preload-ahead effect keyed off `currentIndex` changes; purely additive, no architectural change needed |
| Auth/context not bootstrapped correctly in child window | MEDIUM-HIGH | Requires passing context via URL params (Pitfall 25's fix) and rebuilding the child's bootstrap sequence — touches the output window's entry point, best fixed early rather than retrofitted after ship |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|-------------------|----------------|
| Permission never prompts (Pitfall 1) | Monitor Configuration screen | Manually test: deny the prompt, confirm graceful fallback UI appears (not a dead click) |
| Stale monitor→role mapping (Pitfall 2) | Monitor Configuration screen | Unplug/replug or change resolution between two Run launches; confirm stale mapping is detected, not silently applied |
| API absent / unsupported browser (Pitfall 3) | Monitor Configuration screen | Test in a browser without the API (or via feature-detect override); confirm the SAME fallback UI is the entry point, not an error state |
| Monitor changes mid-service (Pitfall 4) | Live-Ops Hardening | Disconnect a monitor while Run mode is active; confirm a control-window banner appears, output windows are not silently misplaced |
| Fullscreen gesture-origin failure (Pitfall 5) | Audience/Confidence Output Window | Test the real deployed build (not devtools-relaxed gestures); confirm fullscreen succeeds via the sanctioned `{screen}` path or a per-window manual button |
| Fullscreen-loss cascades to full exit (Pitfall 6) | Audience/Confidence Output Window | Trigger a focus-stealing event (OS notification) on one output window; confirm it alone shows a re-enter affordance, others and the session are unaffected |
| Wrong-screen fullscreen placement (Pitfall 7) | Monitor Configuration + Output Window phases | Test with genuinely different-resolution/DPI monitors; confirm correct placement, not just single-monitor dev-machine testing |
| Chrome leaking on fallback (Pitfall 8) | Audience Output Window | Screenshot the fallback (non-fullscreen) state explicitly, not just the happy path |
| Popup blocker kills output windows (Pitfall 9) | Run/Control Screen | Confirm every `window.open()` call is synchronous-in-gesture; test with popups blocked by default and confirm the explicit instruction appears |
| Race condition on window open (Pitfall 10) | Run/Control Screen (sync architecture) | Confirm output windows pull current state on mount rather than depending on a push that could arrive before they're ready |
| Reload loses state (Pitfall 11) | Run/Control Screen (sync architecture) | Hit F5 on an output window mid-"service"; confirm it resumes at the correct slide, not slide 0 |
| Feedback loop on shared channel (Pitfall 12) | Run/Control Screen (sync architecture) | Confirm output windows never write back to the sync channel; monitor Firestore write counts stay proportional to operator actions |
| Closed output window has no recovery (Pitfall 13) | Run/Control Screen | Deliberately close each output window; confirm a one-click reopen with preserved slide position |
| Machine sleep / screensaver (Pitfall 14) | Output Window phases (acquire) + Live-Ops Hardening (re-acquire robustness) | Run idle for a realistic sermon-length stretch; confirm the projector never sleeps |
| Firestore-only sync latency/cost (Pitfall 15) | Run/Control Screen (sync architecture) | Measure click-to-projector-update latency; confirm it's near-instant, not a visible round-trip; monitor Firestore volume |
| Un-preloaded backgrounds/PPTX (Pitfall 16) | Audience Output Window | Rapid click-jump through a large imported deck; confirm no flash-to-black or stale frame |
| Font gate not shared across windows (Pitfall 17) | Audience/Confidence Output Window | Confirm both windows import the same `slideTypography.ts` utility with no divergent reimplementation |
| Operator can't tell windows apart (Pitfall 18) | Run/Control Screen (fallback window creation) | UAT with a first-time, non-technical operator on the pop-out fallback path specifically |
| Audience sees chrome/cursor (Pitfall 19) | Audience/Confidence Output Window | Confirm the output components are a distinct, chrome-free build, not a reuse of the interactive `PresentationViewer.vue` |
| No "you are here" / recovery signal (Pitfall 20) | Run/Control Screen | UAT under simulated live-service pressure/peripheral-vision use, informed by the milestone's own ProPresenter/EasyWorship/Proclaim convention research |
| Accidental Run-mode exit (Pitfall 21) | Run/Control Screen | Confirm no single, easily-mis-hit key/gesture can tear down the session without confirmation |
| Auth/org context missing in child window (Security Mistakes) | Audience/Confidence Output Window | Confirm the child window independently bootstraps Firebase Auth and reads org/service context from the URL, not from an in-memory parent reference |
| Firestore rules gap for new run-state doc (Security Mistakes) | Run/Control Screen (data model) | Run `npm run test:rules` with explicit ALLOW/DENY cases for the new run-state document(s) before shipping |

## Sources

**HIGH confidence — official documentation, read directly:**
- [Window Management API — MDN](https://developer.mozilla.org/en-US/docs/Web/API/Window_Management_API)
- [Window: getScreenDetails() method — MDN](https://developer.mozilla.org/en-US/docs/Web/API/Window/getScreenDetails)
- [Manage several displays with the Window Management API — Chrome for Developers](https://developer.chrome.com/docs/capabilities/web-apis/window-management)
- [w3c/window-management HOWTO](https://github.com/w3c/window-management/blob/main/HOWTO.md) and [EXPLAINER](https://github.com/w3c/window-management/blob/main/EXPLAINER.md)
- [Managing several displays with the Multi-Screen Window Placement API — Chrome Developers](https://chrome.jscn.org/articles/multi-screen-window-placement/) (`requestFullscreen({screen})`)
- [Element: requestFullscreen() method — MDN](https://developer.mozilla.org/en-US/docs/Web/API/Element/requestFullscreen)
- [Document: fullscreenchange event — MDN](https://developer.mozilla.org/en-US/docs/Web/API/Document/fullscreenchange_event)
- [Screen Wake Lock API — MDN](https://developer.mozilla.org/en-US/docs/Web/API/Screen_Wake_Lock_API)
- [Stay awake with the Screen Wake Lock API — Chrome for Developers](https://developer.chrome.com/docs/capabilities/web-apis/wake-lock)
- [Screen Wake Lock API — W3C spec](https://www.w3.org/TR/screen-wake-lock/)

**MEDIUM confidence — community/secondary sources cross-checked against the above:**
- [Investigating Multi-Window Browser Applications — Scott Logic](https://blog.scottlogic.com/2020/03/18/Investigating-Multi-Windowed-Apps.html) (BroadcastChannel + `noopener` popup-reference loss)
- [Screen.isExtended, getScreenDetails, and Multi-Display Development — Melin's Blog](https://melin.vercel.app/blog/2026-07-30) (label stability caveats, Firefox/Safari support gap as of mid-2026)
- [Mastering Cross-Window Communication — Medium](https://medium.com/@rgndunes/mastering-cross-window-communication-2c8f65d6ad93) (BroadcastChannel same-origin/transient-message limitations)

**Project-internal (read directly, not assumed):**
- `src/components/PresentationViewer.vue` — existing single-window fullscreen lifecycle, keyboard handling,
  chrome auto-hide, font-load gate, and CSS-background-fail-silent pattern.
- `src/utils/slideshowAssembler.ts` — existing slide assembly and background-resolution model this milestone
  builds on.
- `.planning/PROJECT.md` — v2.4 requirements, constraints, and this project's own recorded history of
  Firestore-cost hardening (v1.8) and `firestore.rules`/`storage.rules` gaps shipping to production before
  being caught (directly informs the Security Mistakes entries above).

---
*Pitfalls research for: browser-driven multi-monitor live presentation (church "Run the Service" mode)*
*Researched: 2026-08-28*
</content>
