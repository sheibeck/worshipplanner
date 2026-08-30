# Requirements: WorshipPlanner — v2.4 Run the Service (Live Presentation)

**Defined:** 2026-08-28
**Core Value:** Smart weekly service planning that follows the Vertical Worship methodology while rotating through the full song stable and respecting team configurations.
**Milestone goal:** Give a non-technical projectionist a clean, standalone way to *run* a locked service's slide deck live during a church service — driving a fullscreen audience projector and a band confidence monitor from one Chrome/Edge browser.

> REQ-ID numbering continues the project's global `R###` sequence from v2.3 (last: R260). This milestone: **R261–R275**.

## v1 Requirements

Requirements for this milestone. Each maps to exactly one roadmap phase (see Traceability).

### Run Entry & Control Screen

- [x] **R261**: A projectionist can start running a **locked** service via a **Run** button that opens a dedicated standalone Run/control screen (not the service editor); the button is absent/disabled on draft services.
- [x] **R262**: On the Run/control screen, the projectionist sees the **order of service** as a list with the item containing the current slide clearly highlighted as "you are here."
- [x] **R263**: The projectionist can **click an order-of-service item to jump** the live output to that item's first slide.
- [x] **R264**: The Run/control screen shows a **large current-slide preview** (what the audience sees) alongside a smaller **next-slide** preview.
- [x] **R265**: The projectionist can navigate with **standard keyboard keys**: Right Arrow / Space = next slide, Left Arrow = previous slide, Down / Up Arrow = next / previous order-of-service item, Escape = exit run mode (with a confirmation so a stray Escape cannot tear down a live service).
- [x] **R266**: The Run/control screen uses a **single-selection model** — the current/selected slide **is** what is live, with no separate "push to live" step.

### Monitor Configuration (standalone & persistent)

- [x] **R267**: A projectionist can open a **standalone monitor-setup screen** (its own route, separate from the Run flow) that detects the connected monitors and lets them assign **Audience** and **Confidence** roles.
- [x] **R268**: The monitor→role assignment is **saved and remembered per device**, so running a service is effectively one click once configured; on each Run the app re-validates the saved mapping against the live screens and only re-prompts when the physical monitor layout has actually changed.
- [x] **R269**: When the browser's screen-management permission is denied or unavailable, the projectionist gets a **first-class fallback** path (open the output window, drag it to the target monitor, go fullscreen) — never a dead end.

### Audience Output

- [x] **R270**: The audience output opens on the assigned monitor as a **fullscreen slide with its background image and zero operator chrome** (no arrows, slide counts, organizational labels, or visible cursor).
- [x] **R271**: The audience display **stays awake for the duration of the service** (Screen Wake Lock) and **recovers gracefully if it loses fullscreen** (offers to re-enter fullscreen; never tears down the running session or the other output).

### Confidence Monitor Output

- [x] **R272**: The confidence output opens on the assigned monitor showing the **current slide and the upcoming slide**, with **background images suppressed to a plain black background** and no operator chrome.

### Live-Operation Robustness

- [x] **R273**: The Run/control screen is the **single source of truth**; the audience and confidence outputs stay **in sync** with the operator's navigation with no perceptible lag.
- [x] **R274**: If an output window is **closed** or a monitor is **unplugged mid-service**, the control screen detects it and offers **one-click recovery** (reopen/reassign) without losing the current slide position.

### Authorization

- [x] **R275**: **Any authenticated member** of the service's organization (editor **or** viewer) can Run a locked service; running is presentation-only and requires no new RBAC role tier and no ability to edit the plan.

## Future Requirements

Acknowledged but deferred — not in this milestone's roadmap.

### Confidence Monitor Enhancements

- **R-future**: Show the current slide's **section label** (e.g. "Verse 2") on the confidence monitor — trivial reuse of existing `section` / `SERVICE_SECTION_LABELS` data; add once the core confidence view is validated with a real projectionist.
- **R-future**: A **countdown / elapsed timer** on the confidence monitor — no slide-model dependency, purely additive.

## Out of Scope

Explicitly excluded this milestone. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Instant **blackout / clear / logo-cut** button | Explicitly deferred by owner for v2.4. Reserve a UI slot + spare key (e.g. `B`) so a later retrofit is additive, but build no blackout logic now. |
| **Slide transitions / fades** on the audience output | Not table stakes (reference tools default to hard cuts, which the app already does); conflicts with the existing `goToIndex` instant-swap media-lifecycle invariant (T-23-08). Revisit only with a dedicated future phase. |
| **Non-Chromium** monitor auto-detection (Safari/Firefox) | Explicitly deferred; the project targets Chrome/Edge, where the Window Management API is available. Other browsers get the manual pop-out + fullscreen fallback only. |
| Full **Preview / Live two-pane** operator model (à la ProPresenter/EasyWorship) | Adds a staged-then-push concept that fights the non-technical single-operator target; the single-selection model (R266) is the deliberate simpler choice. |
| **Rich, customizable stage-display** layouts (widgets/messages/objects) | The confidence-monitor need is narrow and fully specified (current + next, black background); a general layout editor is a much larger, unrequested surface. |
| **Remote / mobile companion** control app | Materially larger scope (second client, second-device real-time sync, responsive layout) than v2.4's single-browser-window, two-monitor model. |
| **Auto-advance / timed** slide progression for the live service | A live worship service is human-paced; auto-advance fights the operator. (Out of scope; unrelated pre-service loops are a different feature.) |

## Traceability

Which phase covers which requirement. Populated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| R261 | Phase 95 | Complete |
| R262 | Phase 95 | Complete |
| R263 | Phase 95 | Complete |
| R264 | Phase 95 | Complete |
| R265 | Phase 95 | Complete |
| R266 | Phase 95 | Complete |
| R267 | Phase 92 | Complete |
| R268 | Phase 92 | Complete |
| R269 | Phase 92 | Complete |
| R270 | Phase 93 | Complete |
| R271 | Phase 93 | Complete |
| R272 | Phase 94 | Complete |
| R273 | Phase 96 | Complete |
| R274 | Phase 96 | Complete |
| R275 | Phase 95 | Complete |
| R285 | Phase 98 | Removed — superseded 2026-08-30 |
| R286 | Phase 98 | Removed — superseded 2026-08-30 |
| R287 | Phase 98 | Removed — superseded 2026-08-30 |

**Coverage:**

- v1 requirements: 15 total (R261–R275)
- Mapped to phases: 15/15 ✓
- Unmapped: 0 ✓

**Note:** Phases 90 (SlideCanvas Extraction) and 91 (Config + Channel Utilities) carry no directly-mapped
requirement by design — both are enabling refactor/infrastructure work every requirement above depends on
(see `.planning/ROADMAP.md` § v2.4 Basis note), not user-facing requirements in themselves.

## v2.4 Addendum — Run Service Redesign (Phase 97)

Owner hardware-UAT feedback (2026-08-28) drove an approved redesign of the live Run experience
(Claude Design `Run Service.dc.html`). These refine/extend R261–R274; all map to Phase 97.

- [x] **R276**: The Run/control screen matches the approved design — a **pre-flight** state (centered "Ready when you are" with display readiness + a Go-live action, not a corner button) and a **live** state (program/next-up preview split, in-item slide filmstrip, transport bar with keyboard legend + progress).
- [x] **R277**: The live status is **honest** — displays read "not open" (muted/amber) before go-live and turn **green** once actually live; no alarming red live indicator before the operator is live.
- [x] **R278**: The audience and confidence output windows **default to fullscreen** on their assigned monitors without the operator clicking a per-window "Re-enter fullscreen" (which remains only as a fallback).
- [x] **R279**: The confidence monitor shows the current and next slide **side-by-side (left/right)** instead of top/bottom, backgrounds still suppressed to black.
- [x] **R280**: The operator can **blackout / clear** the outputs from the control screen (and the `B` key), driven by the run channel's existing `blackout` field.
- [x] **R281**: The control screen shows a **clock and an elapsed-since-go-live timer**.
- [x] **R282**: The control screen shows an **in-item slide filmstrip** with click-to-jump within the current item.
- [x] **R283**: The operator can **rehearse without screens** — drive the service on the control screen without opening the output windows.
- [x] **R284**: A **Run** affordance appears on each locked service row in the **service listing**, beside the existing row actions, for any authenticated member.

**Traceability (Phase 97):** R276–R284 → Phase 97. The Next-up smaller-font fix and the overall run/stop
UX refinement are folded into R276. Explicitly omitted (no backing data/system, would be fake UI):
presence/activity, CCLI preflight, Key/BPM, Logo-cut, Stage 3rd output, "Follow me on confidence".

## v2.4 Addendum — Fullscreen Setup Helper (Phase 98) — ⚠ REMOVED / SUPERSEDED 2026-08-30

> **This whole phase was built, then REMOVED on 2026-08-30.** Owner hardware UAT proved its premise false:
> the Chromium Automatic Fullscreen policy does NOT actually permit no-gesture multi-monitor fullscreen —
> with a provably-correct machine-wide policy (`chrome://policy` OK), `requestFullscreen()` still rejected
> `not granted` on BOTH Chrome 151 and Edge, and the `fullscreen`/`allowWithoutGesture` permission query
> returned a **false-positive** `granted`. So R285's readiness check would have lied and R286's download
> would have "fixed" nothing. The real solution shipped instead: **per-display "Go fullscreen" buttons on
> the Run control's Displays panel** (gesture-delegated, one click per display, no registry, no per-computer
> setup, and confirmed working with the policy fully removed). All Phase 98 code (`FullscreenSetupPanel.vue`,
> `useFullscreenReadiness`, `osDetect`, `fullscreenPolicyFiles`, `downloadTextFile`, the `docs/fullscreen-setup/*.reg`
> and `docs/run-fullscreen-setup.md`) was deleted; the planning artifacts are kept as a historical record.
> R285–R287 are **withdrawn**, not delivered.

Owner UAT (2026-08-29) established that R278 auto-fullscreen depends on the Chromium **Automatic
Fullscreen** content setting, which the browser will not prompt for — it is enabled per-computer via a
browser **policy** (`AutomaticFullscreenAllowedForUrls`). Editing a registry/policy by hand is a
non-starter for the non-technical projectionist this milestone targets. This phase makes that one-time
enablement a guided, self-checking flow inside the existing Monitor Setup screen, so the operator never
touches a policy editor. Scope is client-side only (a generated download + a permission-state check); no
Firestore/rules/functions change.

- [x] **R285**: The Monitor Setup screen **detects and displays** whether this computer is ready for
  automatic multi-monitor fullscreen — querying `navigator.permissions.query({name:'fullscreen',
  allowWithoutGesture:true})` — showing a clear **ready ✓ / not-ready** state, with a **"Confirm
  fullscreen support"** action that re-checks on demand and, on Chromium browsers that don't support the
  query or non-Chromium browsers, explains the limitation rather than dead-ending.

- [x] **R286**: When not ready, the screen offers a **one-click download of the correct enablement
  artifact for the operator's OS and browser** — Windows `.reg` (per-user **HKCU, no-admin** default with
  an **HKLM admin** fallback), macOS **configuration profile** (`.mobileconfig`)/plist, and Linux
  **managed-policy JSON** — with the app's real **origin derived from `window.location.origin`** baked in,
  plus per-OS step-by-step instructions that set honest expectations (browser "this file may be dangerous"
  prompt on Windows; admin/sudo needed on macOS/Linux).

- [x] **R287**: The helper lives **inside the monitor-assignment flow** and is **self-correcting** — once
  the grant is detected it flips to the confirmed "ready ✓" state without a reload, and it surfaces
  actionable troubleshooting when still not ready (fully restart the browser, try the admin/sudo variant,
  unsupported browser/OS). No auto-fullscreen behavior regresses when the setting is absent (the existing
  gesture fallbacks remain).

**Traceability (Phase 98):** R285–R287 → Phase 98. Electron packaging (a zero-privilege desktop wrapper)
is explicitly **out of scope** here and recorded as the escape-hatch alternative if per-computer setup is
later judged unacceptable; this phase delivers the browser-policy helper only.

---
*Requirements defined: 2026-08-28*
*Last updated: 2026-08-29 — added v2.4 Phase 98 Fullscreen Setup Helper addendum (R285–R287), owner UAT-driven*
