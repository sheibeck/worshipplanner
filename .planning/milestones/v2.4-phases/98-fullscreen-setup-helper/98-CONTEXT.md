# Phase 98: Fullscreen Setup Helper - Context

**Gathered:** 2026-08-29
**Status:** Ready for planning
**Mode:** Owner UAT-driven (v2.4 held open on the one auto-fullscreen item; this phase makes it reachable in the field).
**Source:** Interactive design conversation with the owner 2026-08-29 (decisions locked below).

<domain>
## Phase Boundary

Make the R278 promise — both output windows auto-fullscreen on Go-live with no per-window clicking —
actually reachable by a **non-technical projectionist**. On hardware this depends on the Chromium
**"Automatic Fullscreen"** content setting, which the browser will NOT prompt for; it must be enabled
per-computer via the `AutomaticFullscreenAllowedForUrls` browser policy. Editing a registry/policy by
hand is a non-starter for this audience. This phase turns that one-time enablement into a guided,
self-checking flow **inside the existing Monitor Setup screen** (`MonitorSetupView.vue`), so the operator
downloads one correct file, runs it, and the app confirms success on its own.

IN SCOPE:
- **Readiness detection (R285):** a status surface in Monitor Setup that reports whether THIS computer is
  ready for automatic multi-monitor fullscreen, derived from
  `navigator.permissions.query({ name: 'fullscreen', allowWithoutGesture: true })` (the same query
  `useOutputWindow.ts` already uses in `attemptAutoFullscreen`). Three visible states: **ready ✓**,
  **not ready / needs setup**, and **unsupported** (query throws / non-Chromium) — the last explains the
  limitation instead of dead-ending.
- **"Confirm fullscreen support" action (R285):** an explicit button that re-runs the readiness check on
  demand (the operator clicks it after running the file + restarting the browser) and updates the state.
- **Per-OS enablement download (R286):** when not ready, a one-click download of the CORRECT artifact for
  the operator's detected OS + browser, with the app's **real origin baked in from
  `window.location.origin`** (so it is correct on localhost during dev AND on the deployed domain in prod):
  - **Windows:** a `.reg` file. Default = **per-user `HKCU` (NO admin/UAC)**; a secondary "admin version"
    link provides the machine-wide **`HKLM`** file as fallback. Covers Chrome AND Edge policy paths.
  - **macOS:** a **configuration profile (`.mobileconfig`)** and/or a `defaults`/plist snippet for the
    `com.google.Chrome` (and Edge) managed-preferences domain. (Researcher confirms the current exact
    format/keys.)
  - **Linux:** a **managed-policy JSON** for `/etc/opt/chrome/policies/managed/` (and the Chromium/Edge
    equivalents). (Researcher confirms exact paths.)
  - Each download ships with **per-OS step-by-step instructions** that set HONEST expectations (see
    Decisions: the Windows "this file may be dangerous" browser prompt; macOS/Linux need admin/sudo).
- **Self-correcting, embedded UX (R287):** the helper lives in the monitor-assignment flow; once the grant
  is detected it flips to "ready ✓" **without a page reload**; while still not ready it shows actionable
  troubleshooting (fully quit + reopen the browser, try the admin/sudo variant, unsupported browser/OS).

OUT OF SCOPE (record, do not build here):
- **Electron / any desktop wrapper.** This is the recorded escape-hatch alternative (zero per-computer
  policy, but becomes an installed/updated app) if per-computer setup is later judged unacceptable. NOT
  built in this phase — browser-policy helper only.
- **Presentation API.** Evaluated and rejected 2026-08-29: it forces a browser-owned monitor-picker dialog
  on every launch and cannot preset a monitor or be reduced to a confirm click — a regression from the
  saved-mapping model we already have. Do not introduce it.
- **Auto-applying the policy from JavaScript.** Impossible by browser design (a page cannot write browser
  policy / cannot prompt for Automatic Fullscreen). The file-download + run-it flow is the mechanism.
- **Deploying** the app. Real users need the deployed origin, but the deploy decision stays with the owner
  (v2.4 is client/hosting-only; confirm before deploying). The helper is origin-agnostic by construction.
- Changing the auto-fullscreen RUNTIME behavior itself (that shipped in Phase 97 / `useOutputWindow.ts`).

## Preserve (do NOT regress)
- The existing **gesture fallbacks** stay exactly as they are for computers where the setting is absent:
  capability delegation on Go-live, the header **"Fullscreen displays"** button, and tap-anywhere-to-
  fullscreen on an output window (`useOutputWindow.ts` / `useRunControl.ts`). Nothing in this phase may
  make auto-fullscreen WORSE when the policy is not set.
- `MonitorSetupView.vue`'s existing detection/assignment/fallback machinery (Phase 92): the three
  permission paths, device-scoped persistence, `MonitorCard`, `MonitorFallbackPanel`. The new helper is an
  ADDITIVE surface on this screen, not a rewrite.
- Client-only invariant: **no new Firestore document, no `firestore.rules`/`storage.rules` change, no Cloud
  Function, no new npm dependency** (matches the whole v2.4 milestone). The `.mobileconfig`/`.reg`/JSON are
  generated as in-browser strings and handed to the user via a Blob download — nothing server-side.
</domain>

<decisions>
## Locked decisions (from the 2026-08-29 owner conversation)

1. **Base approach = Solution 1 (Window Management), unchanged.** We already save the Audience/Confidence
   monitor mapping and auto-place windows on Go-live. The ONLY missing piece is no-gesture fullscreen,
   whose sole in-browser enabler is the Automatic Fullscreen content setting. This phase delivers the
   friendly enablement of exactly that — it does not change placement or the run protocol.

2. **Generate the policy file client-side from `window.location.origin`.** Never hardcode the origin. The
   downloaded file must always target wherever the app is actually served, so the same button is correct on
   `http://localhost:5173` (dev/test) and the deployed HTTPS origin.

3. **Windows: HKCU (no-admin) is the default; HKLM (admin) is the fallback.** Lead with the no-privilege
   path. `docs/fullscreen-setup/enable-fullscreen-localhost-{HKCU-no-admin,HKLM-admin}.reg` already exist
   as the localhost proof artifacts and are the shape to generalize (Chrome + Edge keys in one file).

4. **All three OSes.** Windows `.reg`, macOS `.mobileconfig`/plist, Linux managed-policy JSON. Detect OS +
   browser in-app and hand over the right one. HONEST caveat to surface in-UI: only Windows has a true
   no-admin path; macOS/Linux realistically need admin/sudo (profile install or writing under `/etc`).

5. **Honest friction, stated up front.** A downloaded `.reg` triggers Chrome's "this file may be
   dangerous — Keep" and possibly Windows SmartScreen. The instructions walk the user past those. Do NOT
   claim zero-friction; claim "one-time, click through the safety prompt(s)."

6. **Self-checking + self-correcting is the heart of the feature.** The app already KNOWS the grant state
   via the permission query. Use it: show ready/not-ready, offer the download only when needed, and flip to
   the confirmed green state the moment the grant appears (re-query on the "Confirm fullscreen support"
   click and, where cheap/reliable, on window focus) — no reload required.

7. **Live inside the monitor-assignment flow**, not a separate page — it is part of "set up this computer
   to run services."

## To verify during research / planning (not yet locked)
- Exact CURRENT Chrome/Edge policy artifact formats + install locations for macOS (`.mobileconfig` payload
  keys vs `defaults write` to `com.google.Chrome`) and Linux (`/etc/opt/chrome/policies/managed/*.json`,
  Chromium/Edge equivalents). Do not trust memory for shipped files — the researcher confirms against
  current Chrome Enterprise policy docs.
- Whether `navigator.permissions.query({name:'fullscreen', allowWithoutGesture:true})` reliably reflects
  the policy grant across Chrome/Edge versions, and its behavior when unsupported (throw vs `state`).
- OS/browser detection approach (`navigator.userAgentData` with a UA-string fallback) and the correct
  `.reg`/`.mobileconfig`/JSON MIME + `Blob` + `<a download>` download in the real Vue app (the artifact
  CSP download caveat is for Artifacts, not our app — real app downloads work).
- The exact URL-filter pattern the policy expects for an origin (e.g. `https://host` / `http://localhost:5173`).
</decisions>

<canonical_refs>
- `src/composables/useOutputWindow.ts` — `attemptAutoFullscreen()`: the permission query to reuse for
  readiness detection; the fire-and-forget `requestFullscreen()` it gates.
- `src/views/MonitorSetupView.vue` — the screen this helper is added to (Phase 92).
- `src/components/monitor/MonitorCard.vue`, `MonitorFallbackPanel.vue` — existing Monitor Setup UI idiom to
  match (dark theme, Tailwind v4).
- `src/composables/monitorConfig.ts` — device-scoped persistence pattern (fingerprint/localStorage) if any
  per-device "dismissed the helper" state is wanted.
- `docs/run-fullscreen-setup.md` — the manual write-up whose steps this UI automates.
- `docs/fullscreen-setup/enable-fullscreen-localhost-HKCU-no-admin.reg` and `…-HKLM-admin.reg` — existing
  localhost proof `.reg` files; the exact key shape to generate (generalized to the live origin).
- `src/composables/useRunControl.ts` — the gesture fallbacks (`delegateFullscreenToAll`, "Fullscreen
  displays") that must remain intact.
</canonical_refs>

<success_criteria>
1. Monitor Setup shows an honest **ready ✓ / not-ready / unsupported** state for automatic fullscreen on
   the current computer (from the `allowWithoutGesture: 'fullscreen'` permission query), and a **"Confirm
   fullscreen support"** control re-checks on demand. (R285)
2. When not ready, the operator can download the CORRECT enablement file for their OS + browser — Windows
   `.reg` (HKCU default + HKLM fallback), macOS `.mobileconfig`/plist, Linux managed-policy JSON — with the
   real `window.location.origin` baked in, plus clear per-OS steps incl. the honest friction caveats. (R286)
3. The helper is embedded in the monitor-assignment flow and self-corrects to "ready ✓" once the grant is
   detected without a reload, and shows actionable troubleshooting while not ready. (R287)
4. No auto-fullscreen path regresses when the setting is absent — the gesture fallbacks remain; client-only
   (no Firestore/rules/functions/dependency change).
</success_criteria>

<scope_fence>
Browser-policy enablement helper ONLY. No Electron, no Presentation API, no deploy, no change to the run
protocol or output-window fullscreen runtime. No backend. If planning surfaces a need for any of these,
STOP and raise it rather than expanding scope.
</scope_fence>
