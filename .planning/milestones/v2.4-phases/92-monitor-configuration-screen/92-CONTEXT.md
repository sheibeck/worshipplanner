# Phase 92: Monitor Configuration Screen - Context

**Gathered:** 2026-08-28
**Status:** Ready for planning
**Mode:** Auto-generated for autonomous run (discuss skipped; distilled from `.planning/research/` — STACK.md, ARCHITECTURE.md, PITFALLS.md, SUMMARY.md, FEATURES.md)

<domain>
## Phase Boundary

Build a standalone, persistent monitor-configuration screen: a projectionist opens it (independent of
any service), sees the connected monitors, assigns Audience/Confidence roles, and the assignment is
remembered per device — with a first-class fallback when the Window Management permission is denied or
the API is unavailable. Requirements: **R267, R268, R269**.

IN SCOPE:
- A new standalone route + view (`/monitor-setup`, `MonitorSetupView.vue`), reachable from the app nav
  (e.g. Settings or a top-level link), independent of any specific service.
- Detect connected monitors via the Window Management API and list them.
- Assign Audience / Confidence roles per monitor; persist via Phase 91's `monitorConfig.ts`
  (`computeFingerprint`/`saveMapping`/`loadMapping`/`matchMapping`) to `localStorage` (device-scoped).
- The permission-denied / API-unavailable **fallback path** as a first-class flow (not an error state):
  clear guidance to open the output window, drag it to the target monitor, and press fullscreen.
- Reuse-silently behavior surfaced here: on load, if a saved mapping still matches the live screens
  (`matchMapping`), show it as already-configured; only prompt to (re)assign when the layout changed.

OUT OF SCOPE (later phases):
- Actually opening the audience/confidence OUTPUT windows and rendering slides → Phases 93–95.
- The Run entry point and the on-Run re-validation wiring → Phase 95 (this phase provides the config +
  `matchMapping` the Run flow will call; it does not itself launch a service).
- Any BroadcastChannel/slide rendering.
</domain>

<decisions>
## Implementation Decisions (from research — verify exact API shapes during plan-phase)

### Window Management API (STACK.md, PITFALLS 1/3/7)
- Enumerate screens with `window.getScreenDetails()` (returns `ScreenDetails` with `.screens[]` of
  `ScreenDetailed`: `label`, `width`, `height`, `left`, `top`, `isPrimary`, `isInternal`, ...). Gate on
  `'getScreenDetails' in window` to detect support.
- The `window-management` permission prompt requires a **user gesture**. The call to
  `getScreenDetails()` (which triggers the prompt on first use) MUST be made **synchronously inside a
  click handler with NO `await` before it** (PITFALLS 1/2 — an intervening await loses user activation).
- Handle all three states explicitly, each a FIRST-CLASS path (not happy-path-vs-error):
  (a) **granted** → enumerate + assign roles;
  (b) **denied** → the manual fallback flow (open output window → drag → fullscreen);
  (c) **unavailable** (Safari/Firefox / API absent) → the same manual fallback flow.
  Query `navigator.permissions.query({ name: 'window-management' })` where available to pre-read state,
  but never rely on it as the gate — always also handle the actual `getScreenDetails()` rejection.
- Listen for `screens`/`currentscreenchange` on the `ScreenDetails` object so a replug updates the list
  (deeper mid-service handling is Phase 96; here just keep the setup list live while open).

### Persistence (consumes Phase 91 `src/utils/monitorConfig.ts`)
- Use `computeFingerprint(screen)` per detected screen, build the Audience/Confidence role→fingerprint
  mapping, `saveMapping(...)` to localStorage (device-scoped, unscoped by uid/org). On load, `loadMapping()`
  + `matchMapping(saved, liveScreens)`; if `matched`, show "configured for this setup"; if
  `needs-reprompt`, invite (re)assignment.
- Do NOT put this config in Firestore (device-specific).

### Routing / access (ARCHITECTURE.md open question resolved by requirements)
- New route `/monitor-setup`, guard `requiresAuth` only (mirroring `/services/:id`). Per R275 the Run
  affordance is open to any org member (editor OR viewer); monitor setup is a device config, likewise
  reachable by any authenticated member — do NOT add a new RBAC tier.
- Add a discoverable entry point (a link/button — Settings page and/or the app nav are both acceptable;
  Claude's discretion, match existing nav conventions).

### UI
- Dark-mode canonical theme (gray-950/900/800), matching the app. A calm, non-technical layout: a card
  per detected monitor showing its label + resolution + a primary badge, with Audience/Confidence role
  selectors; a persistent "Saved for this device" state; and a clearly-separated fallback panel when
  permission is denied/unavailable. Mirror existing view/card/slideover components and button styles.

### Claude's Discretion
Exact nav entry point, component decomposition, and copy are at Claude's discretion — follow the
UI-SPEC produced for this phase and existing conventions (SettingsView, RosterView slideovers, shared
card/button components).
</decisions>

<code_context>
## Existing Code Insights (verify during plan-phase / pattern-mapping)
- `src/utils/monitorConfig.ts` (Phase 91) — the persistence + fingerprint + match API this screen drives.
- `src/router/index.ts` — route table + `requiresAuth` guard pattern.
- `src/views/SettingsView.vue` — a settings-style screen + card conventions; a likely nav entry point.
- `src/views/RosterView.vue` + slideover components — established view/panel conventions.
- Dark-mode palette and shared button/card components used across the app.
</code_context>

<specifics>
## Verification
- Unit tests: mock `window.getScreenDetails` (granted returning fake screens; denied rejecting;
  unavailable = property absent) and assert the three UI paths render; assert role assignment persists
  via `monitorConfig` (mock localStorage) and reloads matched. Assert the permission call is invoked
  synchronously from a click handler (no awaited call before it).
- Gates per CLAUDE.md: `npm run type-check` (vue-tsc --build) and bare `npx vitest run` (baseline
  `src/storage.rules.test.ts` only).
- **Human UAT (expected — will be deferred to milestone end):** real permission grant/deny on Chrome/Edge,
  actual multi-monitor detection, and the drag+fullscreen fallback on real hardware cannot be proven by
  unit tests. The verifier should mark these as `human_needed`; the autonomous run defers them.
</specifics>

<deferred>
## Deferred Ideas
- Opening/positioning the actual output windows + fullscreen-on-a-screen → Phases 93–95.
- Mid-service monitor hot-plug handling + one-click recovery → Phase 96.
- Instant blackout button → out of scope (v2.4).
</deferred>
