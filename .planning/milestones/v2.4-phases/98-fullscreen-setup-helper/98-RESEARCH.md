# Phase 98: Fullscreen Setup Helper - Research

**Researched:** 2026-08-29
**Domain:** Chromium enterprise browser policy (`AutomaticFullscreenAllowedForUrls`), the Permissions API `fullscreen`/`allowWithoutGesture` descriptor, client-side OS/browser detection, and Blob-based file download — all inside an existing Vue 3 view.
**Confidence:** MEDIUM-HIGH (all core artifact formats and the URL-pattern spec are CITED against current official Chrome Enterprise docs; the one genuinely unresolved point — HKCU-without-admin reliability on an unmanaged Windows PC — is documented below with the best available evidence and flagged for owner confirmation, since the project already holds empirical proof artifacts for it).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
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

### Claude's Discretion
Not explicitly separated in CONTEXT.md beyond the "To verify during research / planning" list below, which
this document resolves. Implementation-level choices (exact component boundaries, exact copy wording beyond
the "honest friction" requirement, whether to add a window-focus re-check listener) are left to planning.

### Deferred Ideas (OUT OF SCOPE)
- **Electron / any desktop wrapper.** Recorded escape-hatch alternative if per-computer setup is later
  judged unacceptable. NOT built in this phase.
- **Presentation API.** Evaluated and rejected 2026-08-29 — forces a browser-owned monitor-picker dialog on
  every launch, incompatible with the saved-mapping model. Do not introduce it.
- **Auto-applying the policy from JavaScript.** Impossible by browser design. The file-download + run-it
  flow is the only mechanism.
- **Deploying the app.** The helper is origin-agnostic by construction; deploy decision stays with the owner.
- **Changing the auto-fullscreen RUNTIME behavior itself** (`useOutputWindow.ts`, shipped Phase 97).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| R285 | Monitor Setup detects/displays ready ✓ / not-ready / unsupported via `navigator.permissions.query({name:'fullscreen', allowWithoutGesture:true})`, with a "Confirm fullscreen support" re-check action. | §Permissions API section below gives the exact return-shape, `state` values, unsupported-browser behavior (throws `TypeError`, not a rejected/denied state), and the minimum Chrome/Edge version (128, confirmed CITED). The three-state UI (ready/not-ready/unsupported) maps directly onto (a) `state === 'granted'`, (b) `state !== 'granted'` after a successful query, (c) the `catch` branch. |
| R286 | One-click download of the correct enablement artifact per OS+browser — Windows `.reg` (HKCU default + HKLM fallback), macOS `.mobileconfig`/plist, Linux managed-policy JSON — origin baked in from `window.location.origin`, with honest per-OS friction copy. | §Windows/macOS/Linux artifact sections give exact, copy-pastable file bodies generalized from the existing localhost `.reg` proof files, the official macOS managed-preferences profile shape, and the official Linux JSON path + body. §OS/Browser Detection gives the `navigator.userAgentData` + UA-string-fallback code. §Blob Download gives the exact MIME types and `<a download>` pattern. §Pitfalls documents the Chrome "may be dangerous" prompt, SmartScreen, and the macOS Ventura+ "approve in System Settings" friction to put in the honest copy. |
| R287 | Self-correcting: flips to "ready ✓" without reload once granted; actionable troubleshooting while not ready; no regression to existing gesture fallbacks. | §Self-Correction Strategy below gives the concrete re-check triggers (button click, `onMounted`, optional `focus`/`visibilitychange` listener) and explains why relying on a live `PermissionStatus` `change` event alone is insufficient here (the browser must fully restart for the registry/profile/JSON change to take effect, which tears down the tab that held the listener) — so re-query-on-return is the mechanism, not a persistent event. §Preserve section confirms `useRunControl.ts`'s `delegateFullscreenToAll` / "Fullscreen displays" button and `useOutputWindow.ts`'s tap-to-fullscreen fallback are untouched call sites this phase must not modify. |
</phase_requirements>

## Summary

Chrome/Edge (Chromium 128+) ship a `fullscreen` Permissions API descriptor —
`navigator.permissions.query({ name: 'fullscreen', allowWithoutGesture: true })` — that reports whether the
current origin may call `requestFullscreen()` without a user gesture. That grant is controlled either by a
per-site content setting the user could theoretically toggle at `chrome://settings/content/automaticFullscreen`
(not realistic for a non-technical projectionist) or by the enterprise policy
`AutomaticFullscreenAllowedForUrls` (a `TYPE_LIST` of URL patterns), which is what this phase automates the
delivery of. The policy is read by the browser from a platform-specific store at every launch: the Windows
registry (`HKCU` or `HKLM`, under `Software\Policies\Google\Chrome` / `...\Microsoft\Edge`), a macOS managed
preferences domain (`com.google.Chrome` / `com.microsoft.Edge`, deliverable as a `.mobileconfig` profile or a
`defaults write`), or a JSON file under `/etc/opt/chrome/policies/managed/` (Chrome; Chromium and Edge have
their own equivalent `/etc/...` paths). None of these can be set by JavaScript — the browser deliberately
gives a page no API to grant itself no-gesture fullscreen. The only lever available to an in-app helper is
generating the *correct artifact* for the detected OS+browser and instructing the operator to apply it once
per computer, then re-checking the Permissions API to confirm.

The URL pattern the policy expects is documented precisely (`chromeenterprise.google/policies/url-patterns/`
and the URL blocklist filter-format doc): `scheme://host[:port][/path]`, case-insensitive host, port required
for non-default ports. `window.location.origin` (e.g. `https://worship-planner-bc515.web.app` or
`http://localhost:5173`) is *already* in exactly this form and needs no transformation before being written
into a generated file.

One genuinely open verification point remains: whether Chrome/Edge honor a **`HKCU`-only, no-admin** registry
write on a **non-domain-joined, unmanaged** Windows PC. Community/official sources are not perfectly
consistent on this (see §Windows below) — but this project already has empirical proof artifacts
(`docs/fullscreen-setup/enable-fullscreen-localhost-HKCU-no-admin.reg`) that the owner locked in as the
default path during the 2026-08-29 discuss-phase conversation, which is the strongest evidence available
(a real test on real target hardware beats a documentation excerpt). Treat the HKCU default as **locked by
the owner's own prior validation**, not as something this research re-litigates — but the in-app self-check
(R285/R287) is exactly the safety net for the case where it silently doesn't apply: if `chrome://policy`
never shows the value after a restart, the UI's "still not ready" state is precisely what should point the
operator at the HKLM (admin) fallback file.

**Primary recommendation:** Build one small module (`src/utils/fullscreenPolicy.ts` or similar) that (1)
detects OS + browser via `navigator.userAgentData` with a UA-string fallback, (2) generates the three artifact
bodies as plain strings from `window.location.origin`, (3) triggers Blob-based downloads with correct MIME
types/filenames, and pair it with a composable that owns the `fullscreen`/`allowWithoutGesture` permission
query + three-state (`ready` / `not-ready` / `unsupported`) reactive state, re-queried on demand. Render both
as an additive card inside `MonitorSetupView.vue`, styled to match `MonitorFallbackPanel.vue`'s existing
dark-theme idiom (green-400 for ready, amber-900/20+amber-300 for warning/needs-setup, gray for unsupported).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Fullscreen-readiness detection (Permissions API query) | Browser / Client | — | Pure client-side browser API; no server round-trip possible or needed. |
| OS + browser detection | Browser / Client | — | `navigator.userAgentData`/UA-string are client-only signals; nothing to look up server-side. |
| Policy-artifact generation (`.reg`/`.mobileconfig`/JSON text) | Browser / Client | — | Pure string templating from `window.location.origin`, already known client-side; explicitly barred from any backend per the phase's client-only invariant. |
| File download (Blob/`<a download>`) | Browser / Client | — | Native browser download mechanism; no server endpoint involved. |
| UI state / self-correction | Frontend (Vue component/composable) | — | Lives inside `MonitorSetupView.vue`'s existing Vue 3 + Composition API surface, alongside the Phase 92 monitor-detection state machine it must not disturb. |
| Applying the downloaded artifact to the OS | OS / User (outside the app) | — | By design, no browser API lets a page write registry/profile/policy state — this is the one step that must leave the browser, which is exactly why the phase generates a file rather than attempting anything programmatic. |

## Standard Stack

### Core
No new libraries. This phase is built entirely on native browser APIs already available in the project's
target runtime (Chrome/Edge 126+, per the project's existing Run-mode baseline) and Vue 3 Composition API
already in use throughout `src/composables/` and `src/views/`.

| API/Feature | Availability | Purpose | Why no library needed |
|---------|---------|---------|--------------|
| `navigator.permissions.query({name:'fullscreen', allowWithoutGesture:true})` | Chrome/Edge 128+ [CITED: chromeos.dev] | Readiness detection (R285) | Native Permissions API descriptor; `useOutputWindow.ts` already uses the identical call. |
| `navigator.userAgentData` (`.platform`, `.brands`) | Chromium-only (Chrome/Edge/Opera); absent in Firefox/Safari [CITED: MDN] | OS + browser detection | Native Client Hints API; a UA-string regex fallback covers non-Chromium (which the R285 "unsupported" state already needs to handle). |
| `Blob` + `URL.createObjectURL` + `<a download>` | Universal | Client-side file generation/download | Standard File API pattern; no server, no CSP restriction in this app (verified: no CSP meta tag in `index.html`, no CSP header config found in repo). |

### Supporting
None — no supporting packages required.

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Manual UA-string parsing for OS/browser | A UA-parsing library (e.g. `ua-parser-js`) | Rejected — violates the phase's "no new npm dependency" invariant (CONTEXT.md line 66-67) for a problem solvable in ~20 lines with `userAgentData` + a 3-branch regex fallback. |
| `Blob`+`<a download>` | `file-saver` npm package | Rejected — same no-new-dependency constraint; `file-saver` is itself a thin wrapper around this exact pattern. |

**Installation:** None — no new dependencies.

**Version verification:** N/A — no packages to verify. `navigator.userAgentData` and the `fullscreen`
permission descriptor are runtime browser features, not npm packages; their availability is confirmed via
feature-detection at runtime (see Code Examples), not a registry lookup.

## Package Legitimacy Audit

**Not applicable — this phase installs no external packages.** All functionality is built on native
browser APIs (`Blob`, `URL.createObjectURL`, `navigator.permissions`, `navigator.userAgentData`) already
available in the project's target Chromium runtime, consistent with the CONTEXT.md client-only / no-new-
dependency invariant (line 66-67: "no new npm dependency"). The planner does not need a
`checkpoint:human-verify` package-install task for this phase.

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│ MonitorSetupView.vue (existing Phase 92 screen)                     │
│                                                                       │
│  [NEW] Fullscreen Readiness Card ─────────────────────────────────┐ │
│  │                                                                  │ │
│  │  onMounted / "Confirm fullscreen support" click                 │ │
│  │        │                                                        │ │
│  │        ▼                                                        │ │
│  │  useFullscreenReadiness()  ──► navigator.permissions.query(     │ │
│  │        │                        {name:'fullscreen',             │ │
│  │        │                         allowWithoutGesture:true})     │ │
│  │        │                                                        │ │
│  │        ├─ resolves state:'granted'   → state = 'ready'          │ │
│  │        ├─ resolves state:'denied'/   → state = 'not-ready'      │ │
│  │        │  'prompt'                                              │ │
│  │        └─ query() throws (TypeError  → state = 'unsupported'    │ │
│  │           / API absent)                (non-Chromium browser)   │ │
│  │        │                                                        │ │
│  │        ▼ (state = 'not-ready')                                  │ │
│  │  detectOsAndBrowser()  ──► navigator.userAgentData               │ │
│  │        │                    .platform / .brands                 │ │
│  │        │                   (UA-string fallback if absent)        │ │
│  │        ▼                                                        │ │
│  │  generateArtifact(os, browser, window.location.origin)          │ │
│  │        │                                                        │ │
│  │        ├─ Windows → .reg text (HKCU default + HKLM fallback)    │ │
│  │        ├─ macOS   → .mobileconfig XML (+ optional plist snippet)│ │
│  │        └─ Linux   → managed-policy JSON                         │ │
│  │        │                                                        │ │
│  │        ▼                                                        │ │
│  │  downloadFile(text, filename, mimeType)  ──► Blob + <a download>│ │
│  │        │                                                        │ │
│  │        ▼ (operator applies it OUTSIDE the browser, restarts)    │ │
│  │  "Confirm fullscreen support" click  ──► re-query ─────────────┐│ │
│  └──────────────────────────────────────────────────────────────┘│ │
│                                                                     │ │
└─────────────────────────────────────────────────────────────────────┘
                            │ (unchanged — Preserve section)
                            ▼
          useOutputWindow.ts attemptAutoFullscreen() at Run-mode Go-live
          (same permission query; the CONSUMER of the grant this phase creates)
```

The operator-facing loop that leaves the browser (apply file → restart browser → return to Monitor Setup)
is the one hop no in-app code can shortcut — every arrow inside the browser is what this phase builds; the
one arrow that exits the box is inherent to how browser policy works everywhere (Chrome/Edge give no page
any API to self-grant this).

### Recommended Project Structure
```
src/
├── utils/
│   ├── fullscreenPolicy.ts     # NEW — pure functions: detectOs(), detectBrowser(),
│   │                           #   generateRegFile(origin), generateMobileconfig(origin),
│   │                           #   generateLinuxPolicyJson(origin). Framework-free, unit-
│   │                           #   testable with plain string assertions (mirrors
│   │                           #   monitorConfig.ts's "no Vue/Firebase" style).
│   └── downloadFile.ts         # NEW — tiny Blob + <a download> helper, reusable if other
│                                 #   phases ever need client-side downloads.
├── composables/
│   └── useFullscreenReadiness.ts  # NEW — owns the permission query + 3-state
│                                     #   ('ready'|'not-ready'|'unsupported') ref, exposes
│                                     #   a `check()` function for the Confirm button + onMounted.
├── components/monitor/
│   └── FullscreenReadinessCard.vue  # NEW — renders the 3 states + download buttons +
│                                       #   per-OS instructions, styled like MonitorFallbackPanel.vue.
└── views/
    └── MonitorSetupView.vue    # MODIFIED (additive) — mounts FullscreenReadinessCard,
                                   #   independent of the existing detect/assign phase machine.
```

### Pattern 1: Three-state readiness via query-then-classify
**What:** Wrap the permission query in try/catch; classify `state === 'granted'` as ready,
any other resolved `state` as not-ready, and a thrown/rejected query as unsupported.
**When to use:** Any UI that must distinguish "the browser understands this permission but
hasn't granted it" from "this browser has no concept of this permission at all" — exactly R285's
ready/not-ready/unsupported three-way split.
**Example:**
```typescript
// Source: pattern generalized from src/composables/useOutputWindow.ts's
// existing attemptAutoFullscreen() (same query, already in this codebase)
// and https://github.com/explainers-by-googlers/html-fullscreen-without-a-gesture
export type FullscreenReadiness = 'ready' | 'not-ready' | 'unsupported'

export async function checkFullscreenReadiness(): Promise<FullscreenReadiness> {
  try {
    const status = await navigator.permissions.query(
      { name: 'fullscreen', allowWithoutGesture: true } as unknown as PermissionDescriptor,
    )
    return status.state === 'granted' ? 'ready' : 'not-ready'
  } catch {
    // TypeError from an unknown descriptor name, or the Permissions API being
    // absent entirely (non-Chromium) — both collapse to 'unsupported'.
    return 'unsupported'
  }
}
```

### Pattern 2: OS + browser detection with graceful UA-string fallback
**What:** Prefer `navigator.userAgentData` (Chromium-only, low-entropy, synchronous) and fall
back to `navigator.userAgent` regex matching when absent (Firefox/Safari, and defensively any
future browser that drops UA-CH).
**When to use:** Picking which of the three generated artifacts to offer as the primary
download.
**Example:**
```typescript
// Source: pattern combining MDN NavigatorUAData.platform/.brands docs and
// community-documented brand-detection idiom (see Sources).
export type DetectedOs = 'windows' | 'macos' | 'linux' | 'other'
export type DetectedBrowser = 'chrome' | 'edge' | 'chromium-other' | 'non-chromium'

export function detectOs(): DetectedOs {
  const uaData = (navigator as any).userAgentData as
    | { platform?: string } | undefined
  const platform = uaData?.platform ?? navigator.platform ?? navigator.userAgent
  if (/win/i.test(platform)) return 'windows'
  if (/mac/i.test(platform)) return 'macos'
  if (/linux/i.test(platform) && !/android/i.test(navigator.userAgent)) return 'linux'
  return 'other'
}

export function detectBrowser(): DetectedBrowser {
  const uaData = (navigator as any).userAgentData as
    | { brands?: Array<{ brand: string }> } | undefined
  if (uaData?.brands) {
    const brands = uaData.brands.map((b) => b.brand)
    if (brands.some((b) => b.includes('Microsoft Edge'))) return 'edge'
    if (brands.some((b) => b.includes('Google Chrome'))) return 'chrome'
    if (brands.some((b) => b.includes('Chromium'))) return 'chromium-other'
    return 'non-chromium'
  }
  // UA-string fallback (Firefox/Safari never populate userAgentData at all).
  const ua = navigator.userAgent
  if (/Edg\//.test(ua)) return 'edge'          // NB: new Edge token is "Edg/", not "Edge/"
  if (/Chrome\//.test(ua)) return 'chrome'      // Chrome/ also appears in Edge's UA — check Edg first
  return 'non-chromium'
}
```

### Pattern 3: Blob-based text file download
**What:** Build a `Blob` from generated text, create an object URL, click a synthetic
`<a download>`, then revoke the URL.
**When to use:** Every artifact download (`.reg`, `.mobileconfig`, `.json`).
**Example:**
```typescript
// Source: standard MDN Blob/URL.createObjectURL pattern — no library needed.
export function downloadTextFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
```
MIME types: `.reg` → `text/plain` (Windows does not register a specific web MIME type for
`.reg`; the browser's download-type detection is filename/extension based, so `text/plain` is
safe and standard), `.mobileconfig` → `application/x-apple-aspen-config` (the type macOS/Safari
uses to trigger "Open in System Preferences"; `text/plain` also works for a manual
double-click-to-install flow and avoids any browser-specific handling surprises — recommend
`application/x-apple-aspen-config` since it is the documented Apple MIME type for this format,
falling back to `text/plain` if any browser mishandles it), `.json` → `application/json`.

### Anti-Patterns to Avoid
- **Hardcoding the origin string anywhere in the generated artifacts:** always interpolate
  `window.location.origin` at generation time (locked decision #2) — a hardcoded
  `worship-planner-bc515.web.app` would silently produce a wrong file on `localhost` or a future
  custom domain.
- **Treating a thrown/rejected permission query as "not ready" instead of "unsupported":** these
  are semantically different states per R285 and must render different copy (not-ready implies
  "download and apply the file"; unsupported implies "this browser can't do this at all, use the
  gesture fallbacks").
- **Polling the permission query on an interval:** unnecessary complexity — see
  §Self-Correction Strategy below for why click-triggered + `onMounted` re-checks are sufficient
  and a `setInterval` adds no real reliability.
- **Attempting to auto-apply the artifact (e.g. via a `file://` protocol trick or auto-triggering
  the registry import):** explicitly out of scope (CONTEXT.md line 51) and not technically
  possible — no browser API lets a page write to the registry, filesystem outside its sandbox,
  or a macOS managed-preferences domain.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| UA parsing/browser sniffing beyond a 3-branch check | A general-purpose UA-parser | The minimal `userAgentData`/UA-string check in Pattern 2 | The only decision needed is "which of 3 files to offer" — a full parser is unneeded surface area and a new dependency the phase explicitly forbids. |
| File download | A file-saver library | Native `Blob`+`<a download>` (Pattern 3) | Same no-new-dependency constraint; the native pattern is ~10 lines and has no edge cases this phase's plain-text files trigger. |
| macOS profile signing | Attempting to self-sign the `.mobileconfig` in-browser | Ship it unsigned with honest "yellow warning, approve in System Settings" copy | Signing requires a certificate + private key, which cannot live in a client-side web app; Apple's own unsigned-profile flow (System Settings → Privacy & Security → Profiles) is a supported, documented path — just not a silent one. |

**Key insight:** Every "hand-roll" temptation in this phase (parsing UA strings exhaustively,
reimplementing `file-saver`, trying to make the profile look "trusted") is solvable with either a
tiny amount of first-party code or by accepting the platform's own honest friction — which is
exactly what locked decision #5 already commits to.

## Common Pitfalls

### Pitfall 1: Assuming HKCU registry writes always apply without domain/MDM enrollment
**What goes wrong:** A `.reg` file written to `HKEY_CURRENT_USER\...\AutomaticFullscreenAllowedForUrls`
may not be picked up by Chrome/Edge on some machine configurations, leaving the operator stuck at
"not ready" after doing everything right.
**Why it happens:** Chromium's own developer documentation is not fully consistent on this point.
`chromium.org`'s "Complex policies on Windows" page states plainly that "Chrome only loads
policies directly from the registry on AD enrolled machines" [CITED: chromium.org], which would
suggest HKCU/HKLM registry policy requires AD domain membership. But `textslashplain.com` (a
well-regarded, historically accurate source on Chromium/Edge policy internals) states the
opposite for the general case: "The vast majority of policies will work on any computer, even if
it's just your home PC and you're poking the policy into the registry directly" — with only a
small documented set of "protected" policies (visible via a machine's `about:management` page)
requiring detected management status [CITED: textslashplain.com]. `AutomaticFullscreenAllowedForUrls`
does not appear in any documented "sensitive/protected policy" list found during this research.
**How to avoid:** (1) Ship BOTH the HKCU (no-admin) and HKLM (admin) `.reg` files, exactly as
locked in CONTEXT.md decision #3. (2) Make the in-app "Confirm fullscreen support" re-check the
actual arbiter of success — never claim success from the download alone. (3) In the per-OS
instructions, explicitly tell the operator to check `chrome://policy` (or `edge://policy`) after
restarting the browser, and if `AutomaticFullscreenAllowedForUrls` is absent there, use the
HKLM/admin file instead. This is precisely why the project's own proof artifacts ship BOTH
variants — this pitfall is already designed around.
**Warning signs:** The readiness card stays "not ready" after the operator reports having run
the `.reg` file and restarted; the troubleshooting copy should proactively suggest "try the
admin version" as the very next step (R287's "actionable troubleshooting").

### Pitfall 2: Losing user activation between the Confirm click and the permission query
**What goes wrong:** None expected here specifically — `permissions.query()` does NOT require a
user gesture (unlike `requestFullscreen()` itself), so an `await` before it is harmless. This
pitfall is called out only to explicitly rule it out: do not copy `useOutputWindow.ts`'s
"no-await-before-the-call" gesture-preservation pattern into this composable — it does not apply
here and adding it would be needless complexity. Contrast with `MonitorSetupView.vue`'s own
`getScreenDetails()` call, which genuinely does require the synchronous-first-statement discipline
(see that file's comment above `onDetectClick`) — a different API with a real gesture requirement.
**Why it happens:** Pattern-matching too eagerly from a neighboring composable in the same file.
**How to avoid:** Keep the permission query freely `await`-able anywhere, including inside
`onMounted`, a `focus` listener, or the Confirm button handler — no special sequencing needed.
**Warning signs:** N/A — this is a preventive note, not an observed failure mode.

### Pitfall 3: Treating the Windows `.reg` download as the finish line
**What goes wrong:** A downloaded-but-unapplied file, or an applied file whose browser was never
FULLY restarted (not just the tab reloaded — the whole browser process, all windows), leaves the
policy un-read. Chrome/Edge read policy stores at process launch; a mid-session change to the
registry is not guaranteed to be picked up without a relaunch.
**Why it happens:** "Restart the browser" is easy to under-communicate as "reload the page."
**How to avoid:** Instructions must say "fully quit and reopen Chrome/Edge (not just this tab)" —
exactly the wording the existing `docs/run-fullscreen-setup.md` and the localhost `.reg` files
already use; carry that exact phrasing into the generated in-app copy.
**Warning signs:** Operator reports "I ran it and it's still not ready" — the troubleshooting copy
(R287) should ask "did you fully quit and reopen the browser?" before suggesting the admin variant.

### Pitfall 4: Chrome's Safe Browsing "may be dangerous" download block on `.reg` files
**What goes wrong:** Chrome's Safe Browsing may flag the downloaded `.reg` file (registry files
are a known malware vector) and hide it behind a "Keep dangerous file" click in the Downloads
tray, or under Enhanced Safe Browsing block it entirely with no visible "Keep" option [CITED:
chromestory.com / textslashplain.com "Download Blocking by File Type"].
**Why it happens:** Chrome's file-type reputation heuristics apply to `.reg` regardless of the
file's actual content or the hosting origin's trustworthiness.
**How to avoid:** This is explicitly accepted, not fixable — locked decision #5 requires the
in-app copy to state this friction honestly UP FRONT ("your browser may warn this file could be
dangerous — click the three-dot menu next to the download and choose Keep"), rather than
promising a clean download.
**Warning signs:** N/A — expected behavior to document, not a bug to chase.

### Pitfall 5: macOS Ventura+ unsigned profile installation is a two-step, easy-to-miss flow
**What goes wrong:** Double-clicking a `.mobileconfig` on macOS 13 (Ventura) and later does NOT
open an installer dialog the way it did on older macOS — nothing visibly happens. The profile is
staged, and the operator must separately open **System Settings → Privacy & Security → Profiles**
(or "Profiles & Device Management") to actually approve and install it [CITED: community
documentation corroborated across multiple sources — see Sources]. An unsigned profile additionally
shows a yellow "Profile Is Not Signed" warning during that approval step.
**Why it happens:** Apple tightened profile installation specifically to prevent silent/drive-by
profile installs.
**How to avoid:** The macOS instructions must spell out this exact two-step flow, not just
"double-click to install" — matching locked decision #4's honest-friction requirement for
macOS/Linux.
**Warning signs:** Operator says "I double-clicked it and nothing happened" — that IS the expected
first step; the fix is directing them to System Settings.

### Pitfall 6: Linux distro packaging fragments the managed-policy path
**What goes wrong:** The canonical Chrome path (`/etc/opt/chrome/policies/managed/`) is correct
for Google's official `.deb`/`.rpm` Chrome build, but Chromium (distro-packaged, e.g. via `apt` on
Debian/Ubuntu) commonly uses `/etc/chromium/policies/managed/` or, on some distros/snap builds,
`/etc/chromium-browser/policies/managed/`. Edge's Linux path is also not perfectly consistent
across sources found in this research (`/etc/opt/edge/policies/managed/` appears in a Microsoft
Q&A thread; some community docs use `/etc/opt/microsoft/msedge/policies/managed/`) — **mark this
UNVERIFIED** and flag for the planner/executor to confirm the exact live path against
`edge://policy` on the target Linux install, or ship the JSON to a couple of the most likely paths
with copy noting "path may vary by how Edge was installed."
**Why it happens:** No single vendor controls how every downstream Linux packager lays out `/etc`.
**How to avoid:** Chrome's own path is the one to lead with (it is CITED and unambiguous
[support.google.com/chrome/a/answer/7517525]); Chromium/Edge get secondary, explicitly-labeled
"if you're on Chromium/Edge instead" guidance rather than a single confident path.
**Warning signs:** `chrome://policy` (or the equivalent) shows the policy as absent even though
the JSON file was written and the file's JSON is valid — almost always a path mismatch for the
specific browser build installed.

## Code Examples

### Windows `.reg` file body (generalized from the existing localhost proof files)
```
// Source: generalized from docs/fullscreen-setup/enable-fullscreen-localhost-HKCU-no-admin.reg
// (already in this repo) — same Chrome+Edge key shape, origin templated instead of hardcoded.
Windows Registry Editor Version 5.00

; WorshipPlanner — enable Automatic Fullscreen for ${ORIGIN}.
; PER-USER (HKCU): double-click this file, click "Yes", then FULLY quit and reopen
; Chrome/Edge (not just reload the tab). No administrator rights required.
; If chrome://policy does NOT show the value after this, use the admin (HKLM) file instead.

[HKEY_CURRENT_USER\SOFTWARE\Policies\Google\Chrome\AutomaticFullscreenAllowedForUrls]
"1"="${ORIGIN}"

[HKEY_CURRENT_USER\SOFTWARE\Policies\Microsoft\Edge\AutomaticFullscreenAllowedForUrls]
"1"="${ORIGIN}"
```
The HKLM variant is byte-identical except `HKEY_CURRENT_USER` → `HKEY_LOCAL_MACHINE` (see the
existing `enable-fullscreen-localhost-HKLM-admin.reg` for the exact header-comment wording to
reuse — "right-click → Merge while running as administrator").
List-policy registry encoding note [CITED: chromium.org "Complex policies on Windows" +
textslashplain.com]: a list value is a **subkey** named after the policy, containing consecutively
NUMBERED STRING values (`"1"`, `"2"`, ...) — exactly the shape both existing proof files already
use. This is correct and needs no change even though this project only ever needs a single-entry
list (one origin).

### macOS `.mobileconfig` (community-documented MCX-nested shape — see Pitfall/Open Questions)
```xml
<!-- Source: pattern generalized from public macOS Chrome-policy .mobileconfig examples
     (see Sources) — UNVERIFIED against an official current Google template; the nested
     com.apple.ManagedClient.preferences shape is the one consistently found in circulation. -->
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>PayloadContent</key>
  <array>
    <dict>
      <key>PayloadType</key>
      <string>com.apple.ManagedClient.preferences</string>
      <key>PayloadIdentifier</key>
      <string>com.worshipplanner.fullscreen.chrome</string>
      <key>PayloadUUID</key>
      <string>REPLACE-WITH-GENERATED-UUID-1</string>
      <key>PayloadEnabled</key>
      <true/>
      <key>PayloadVersion</key>
      <integer>1</integer>
      <key>PayloadContent</key>
      <dict>
        <key>com.google.Chrome</key>
        <dict>
          <key>Forced</key>
          <array>
            <dict>
              <key>mcx_preference_settings</key>
              <dict>
                <key>AutomaticFullscreenAllowedForUrls</key>
                <array>
                  <string>${ORIGIN}</string>
                </array>
              </dict>
            </dict>
          </array>
        </dict>
      </dict>
    </dict>
  </array>
  <key>PayloadDisplayName</key>
  <string>WorshipPlanner — Enable Automatic Fullscreen</string>
  <key>PayloadIdentifier</key>
  <string>com.worshipplanner.fullscreen</string>
  <key>PayloadUUID</key>
  <string>REPLACE-WITH-GENERATED-UUID-2</string>
  <key>PayloadType</key>
  <string>Configuration</string>
  <key>PayloadVersion</key>
  <integer>1</integer>
</dict>
</plist>
```
Generate the two `PayloadUUID` values with `crypto.randomUUID()` at download time (uppercase per
Apple convention is cosmetic only; lowercase is accepted). Repeat the same `Forced` block for
`com.microsoft.Edge` as a second `PayloadContent` array entry to cover Edge in one profile, or
ship two separate profiles — either is valid; a single combined profile matches the Windows
`.reg` file's "cover Chrome+Edge in one artifact" precedent.
The equivalent `defaults write` form (useful for a self-administered single Mac, no profile
install needed, but overwritten by any later MDM-pushed profile):
```bash
# Source: pattern from support.google.com/chrome/a/answer/7532419 (URLAllowlist example,
# same defaults-write mechanism applies to any list policy)
defaults write com.google.Chrome AutomaticFullscreenAllowedForUrls -array "${ORIGIN}"
defaults write com.microsoft.Edge AutomaticFullscreenAllowedForUrls -array "${ORIGIN}"
```
Both require the operator to fully quit and reopen the browser afterward, same as Windows.

### Linux managed-policy JSON
```json
{
  "AutomaticFullscreenAllowedForUrls": ["${ORIGIN}"]
}
```
[CITED: support.google.com/chrome/a/answer/7517525] Chrome (official Google build): write to
`/etc/opt/chrome/policies/managed/worshipplanner-fullscreen.json` (any filename ending `.json`
inside that directory; Chrome merges all files in the folder). Requires root/sudo — the directory
is under `/etc` and per Google's own guidance must not be writable by non-admin users. Chromium
(distro-packaged) commonly uses `/etc/chromium/policies/managed/` instead — UNVERIFIED which
exact path a given distro uses; direct the operator to try both if unsure. Edge's Linux path is
UNVERIFIED with full confidence in this session — community sources disagree between
`/etc/opt/edge/policies/managed/` and `/etc/opt/microsoft/msedge/policies/managed/`; ship the
same JSON body to both directories in the instructions rather than picking one, or have the
in-app copy say "the exact folder can vary — check `edge://policy` after; if the value is
missing, try `/etc/opt/microsoft/msedge/policies/managed/` as well."

### Blob download with per-artifact MIME types
```typescript
// Source: standard Blob/File API pattern — no external reference needed.
const ARTIFACT_MIME: Record<'reg' | 'mobileconfig' | 'json', string> = {
  reg: 'text/plain',
  mobileconfig: 'application/x-apple-aspen-config',
  json: 'application/json',
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| Un-gestured `requestFullscreen()` call at output-window mount (pre-Phase-97) | Fullscreen Capability Delegation (gesture-based, best-effort, one window at a time) + the Automatic Fullscreen content setting (zero-gesture, all windows) | Phase 97 (delegation) / this phase makes the content-setting path reachable | This phase does not change runtime behavior — it makes the ALREADY-SHIPPED `attemptAutoFullscreen()` code path (which silently does nothing when the policy isn't set) actually reachable for a non-technical operator. |
| Manual doc-only setup instructions (`docs/run-fullscreen-setup.md`, admin-only Windows reg commands) | In-app, self-detecting, per-OS, HKCU-first generated download | This phase (R285-R287) | Turns a docs page a projectionist would never find/follow into a guided, self-verifying in-product flow. |

**Deprecated/outdated:** None — this is new functionality layered on an existing, currently-shipping
mechanism (`AutomaticFullscreenAllowedForUrls` / `attemptAutoFullscreen()`), not a replacement of
anything.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The macOS `.mobileconfig` shape shown (nested `com.apple.ManagedClient.preferences` → `com.google.Chrome` → `Forced` → `mcx_preference_settings`) is the current, correct format Chrome actually parses for local/manual (non-MDM) profile installs, rather than a simpler flat `PayloadType: com.google.Chrome` form some newer tooling may use. | Windows/macOS/Linux artifact section, Code Examples | If wrong, the generated `.mobileconfig` installs (Profile shows in System Settings) but Chrome does not actually pick up the policy — the in-app "Confirm fullscreen support" re-check would correctly surface this as still-not-ready, so the blast radius is "macOS path doesn't work yet," not a silent false-positive. Should be spot-checked by the executor against a real macOS machine or the current `google/chrome-enterprise-templates`-equivalent source before shipping as the sole macOS path — the `defaults write` alternative is a good secondary offering precisely because it's simpler and less likely to be stale. |
| A2 | Edge's Linux managed-policy directory is either `/etc/opt/edge/policies/managed/` or `/etc/opt/microsoft/msedge/policies/managed/` — genuinely unresolved between two disagreeing sources found this session. | Pitfall 6, Code Examples (Linux) | Low risk to the app (the JSON content is identical either way) but could mean the Edge-on-Linux path silently doesn't apply until the operator/executor confirms the live path via `edge://policy`. Copy should hedge ("try both locations") rather than assert one. |
| A3 | HKCU (no-admin) registry policy reliably applies on a non-domain-joined, non-Intune-enrolled Windows PC for a non-"protected" policy like `AutomaticFullscreenAllowedForUrls`. | Summary, Pitfall 1 | This is the single highest-impact assumption in the whole phase, since it's the DEFAULT path (locked decision #3). Documentation is genuinely split (chromium.org says AD-enrollment is required for registry policy to load at all; textslashplain.com and general community practice — including this project's own existing localhost proof-of-concept files — say most non-protected policies work from a plain registry write on any PC). The owner's locked decision already treats this as validated via the existing proof artifacts; this research surfaces the documentation ambiguity for completeness but does not override the lock. The HKLM fallback plus the in-app "Confirm fullscreen support" check together bound the risk regardless of which way this resolves. |
| A4 | `.reg` files download-block behavior (Safe Browsing "Keep dangerous file") is a per-file-type heuristic that always leaves a "Keep" affordance under Standard Safe Browsing, only fully blocking under Enhanced Safe Browsing / org policy. | Pitfall 4 | If Chrome's blocking is stricter than described for some configurations, the operator could hit a dead end with no visible download at all. The in-app copy should mention checking the Downloads page / bottom-of-window download tray explicitly, and, as a defensive fallback, consider also rendering the file content in a `<textarea>`/code block the operator can copy-paste into a manually-created `.reg` file as a last resort — a cheap addition worth flagging to the planner. |

**None of these assumptions block building the phase** — R285/R287's self-check mechanism is
specifically designed to catch a false "should be ready now" outcome and route the operator to the
next fallback (HKLM, alternate Linux path, manual copy-paste), so the phase is robust to any single
one of A1-A4 being wrong in practice.

## Open Questions

1. **Exact current macOS `.mobileconfig` format Google ships/recommends today**
   - What we know: The MCX-nested shape (A1) is consistently found across community-maintained
     example repos and matches the general Apple Configuration Profile spec for managed
     preferences; `defaults write com.google.Chrome <key> ...` is confirmed as the simpler
     equivalent for a single already-logged-in user [CITED: support.google.com/chrome/a/answer/7532419].
   - What's unclear: Whether Google's own current official template generator (Admin console /
     Chrome Enterprise policy templates bundle) still emits exactly this nested shape, or a newer
     flatter one, for a *manually installable* (non-MDM-pushed) profile specifically.
   - Recommendation: Ship the MCX-nested `.mobileconfig` as primary AND the `defaults write` command
     as a documented alternative in the same instructions — if one format doesn't parse on a given
     macOS version, the other is a low-effort fallback the operator can run from Terminal.

2. **Exact live Linux policy directory for Edge and for distro-packaged Chromium**
   - What we know: Chrome's official path (`/etc/opt/chrome/policies/managed/`) is confirmed CITED.
   - What's unclear: The Edge path (two candidates found, A2) and whether Chromium builds on the
     target distro use `/etc/chromium/policies/managed/` vs `/etc/chromium-browser/policies/managed/`.
   - Recommendation: In-app copy for Linux should list Chrome's confirmed path as primary and note
     "Chromium/Edge users: check `edge://policy` or `chrome://policy` after — if the value doesn't
     appear, your browser may expect a different `/etc/...` folder; try `/etc/chromium/policies/managed/`
     or `/etc/opt/microsoft/msedge/policies/managed/`." This is honest-friction-appropriate (matches
     locked decision #5's spirit) rather than asserting false precision.

3. **Whether `PermissionStatus` fires a `change` event for this specific descriptor when the
   underlying enterprise policy changes mid-session (without a full browser restart)**
   - What we know: The general Permissions API does support `PermissionStatus.onchange`/
     `addEventListener('change', ...)` for permissions whose state can change live (e.g. camera/mic
     revoked via OS settings) [CITED: MDN Permissions API].
   - What's unclear: Whether Chrome's policy subsystem re-evaluates and fires this event for a
     registry/profile/JSON policy change without the browser fully restarting — the project's own
     existing docs (`docs/run-fullscreen-setup.md`) and the `.reg` file comments already say "fully
     quit and reopen the browser" is required, which suggests the live-update path (if it exists at
     all) is not the one to depend on.
   - Recommendation: Do NOT build the self-correction mechanism (R287) around a `change` listener as
     the primary signal. Use explicit re-check triggers instead: the "Confirm fullscreen support"
     button (required by R285 regardless), a query on `onMounted` (which naturally fires "without a
     reload" the next time the operator navigates back to Monitor Setup after restarting the
     browser — satisfying R287's "no reload" language via ordinary SPA navigation, not a raw F5), and
     optionally a `window.addEventListener('focus', recheck)` as a low-cost defensive extra for the
     rare case a live update does occur. This is a planning-level decision the research flags but
     does not lock — Claude's Discretion per the CONTEXT.md framing.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Chrome/Edge (Chromium) | `navigator.permissions.query({name:'fullscreen',...})`, `navigator.userAgentData` | N/A — this is a target-browser requirement for the END USER's computer, not a build/dev-environment dependency | 128+ for the permission query [CITED: chromeos.dev]; project's existing baseline states 126+ for the broader Run-mode multi-monitor feature set [existing docs/run-fullscreen-setup.md] — use feature-detection (try/catch), never a hardcoded version gate, since the two cited minimums are close but not identical | Firefox/Safari and pre-126 Chromium fall into the `unsupported` state (R285) and see the existing gesture-fallback copy (`MonitorFallbackPanel.vue` idiom) — already a first-class path, not a dead end |

No build-time or dev-environment tool dependencies are introduced by this phase (no new npm
packages, no new CLI tools, no emulator requirement). Standard `npm run dev` / `npm run build` /
`npx vitest run` continue to apply unchanged.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest ^4.0.18 (root config), jsdom environment |
| Config file | `vite.config.ts` (root suite excludes `src/rules.test.ts` and `render-service/**`) |
| Quick run command | `npx vitest run src/utils/__tests__/fullscreenPolicy.test.ts src/composables/__tests__/useFullscreenReadiness.test.ts` (once authored) |
| Full suite command | `npx vitest run` (bare command per CLAUDE.md — excludes rules/render-service by design) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| R285 | `checkFullscreenReadiness()` returns `'ready'` when `state==='granted'`, `'not-ready'` for `'denied'`/`'prompt'`, `'unsupported'` when `query()` throws or `navigator.permissions` is absent | unit | `npx vitest run src/composables/__tests__/useFullscreenReadiness.test.ts` | ❌ Wave 0 |
| R285 | "Confirm fullscreen support" button re-invokes the check and updates the rendered state | component | `npx vitest run src/components/monitor/__tests__/FullscreenReadinessCard.test.ts` | ❌ Wave 0 |
| R286 | `generateRegFile(origin)` / `generateMobileconfig(origin)` / `generateLinuxPolicyJson(origin)` interpolate the given origin verbatim into the correct artifact shape (assert exact string content, mirroring `monitorConfig.ts`'s plain-object-fixture testing style) | unit | `npx vitest run src/utils/__tests__/fullscreenPolicy.test.ts` | ❌ Wave 0 |
| R286 | `detectOs()`/`detectBrowser()` correctly classify a mocked `navigator.userAgentData` for Windows/macOS/Linux × Chrome/Edge, and correctly fall back to UA-string parsing when `userAgentData` is absent (jsdom's default state — no mock needed for the fallback branch) | unit | `npx vitest run src/utils/__tests__/fullscreenPolicy.test.ts` | ❌ Wave 0 |
| R286 | Clicking the OS-appropriate download button triggers a Blob download with the correct filename/MIME (mock `URL.createObjectURL`/`document.createElement('a')` per the standard jsdom testing pattern) | component | `npx vitest run src/components/monitor/__tests__/FullscreenReadinessCard.test.ts` | ❌ Wave 0 |
| R287 | Re-checking after a previously-"not-ready" query now resolves `'ready'` flips the rendered UI state without a `wrapper.unmount()`/remount (proves "no reload" behavior at the component level) | component | `npx vitest run src/components/monitor/__tests__/FullscreenReadinessCard.test.ts` | ❌ Wave 0 |
| R287 | No change to `useRunControl.ts`'s `delegateFullscreenToAll` / "Fullscreen displays" button or `useOutputWindow.ts`'s tap-to-fullscreen fallback (regression guard) | existing suite | `npx vitest run src/composables/__tests__/useRunControl.test.ts src/composables/__tests__/useOutputWindow.test.ts` (exact filenames TBD by executor — confirm via `Glob` before referencing) | ✅ (pre-existing, per Phase 96/94/97 work) |

### Sampling Rate
- **Per task commit:** the relevant new unit/component test file(s) above.
- **Per wave merge:** `npx vitest run` (bare command — full root suite baseline is currently 1
  known-failing file, `src/storage.rules.test.ts`, unrelated to this phase; confirm no new failures).
- **Phase gate:** Full suite green (modulo the pre-existing `storage.rules.test.ts` baseline
  failure) before `/gsd-verify-work`; `npm run type-check` (the `vue-tsc --build` form, not the
  narrower `-p tsconfig.app.json` form) must also be clean per CLAUDE.md.

### Wave 0 Gaps
- [ ] `src/utils/__tests__/fullscreenPolicy.test.ts` — covers R286 (artifact generation, OS/browser
  detection)
- [ ] `src/composables/__tests__/useFullscreenReadiness.test.ts` — covers R285 (three-state query
  classification)
- [ ] `src/components/monitor/__tests__/FullscreenReadinessCard.test.ts` — covers R285/R286/R287
  (button interactions, download triggering, self-correction re-render)
- [ ] No framework install needed — Vitest ^4.0.18 and `@vue/test-utils` (already a project
  dependency per `MonitorSetupView.test.ts`'s existing usage) cover everything this phase needs.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | This phase adds no auth surface — Monitor Setup is already reachable only by an authenticated org member per existing app routing; unchanged here. |
| V3 Session Management | No | No session state introduced. |
| V4 Access Control | No | No new authorization boundary; the generated files are client-local, not org/user-scoped data. |
| V5 Input Validation | Marginal | The only "input" flowing into generated file content is `window.location.origin` — a browser-computed value, not user-supplied text, so classic injection-into-a-config-file risk (e.g. an attacker-controlled string breaking out of the `.reg`/JSON/XML structure) does not apply in the normal case. Still, treat it defensively: `window.location.origin` is always a well-formed `scheme://host[:port]` string per the URL spec and can never contain quote characters, newlines, or registry/XML-special characters that would break the generated artifact's syntax — no additional escaping/sanitization logic is needed beyond direct string interpolation. |
| V6 Cryptography | No | No secrets, tokens, or cryptographic material are generated or handled by this phase. |

### Known Threat Patterns for this phase's stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| A malicious page tricking the operator into downloading/running a LOOK-ALIKE `.reg`/`.mobileconfig`/JSON file that grants automatic-fullscreen (or worse) to an attacker origin | Spoofing | Not a new risk this phase introduces — it's the existing, well-understood risk profile of ANY enterprise-policy `.reg`/profile file, and it's why the browser itself shows the "may be dangerous" download friction (Pitfall 4) as a built-in mitigation. This phase's generated files are scoped to exactly ONE origin (`window.location.origin`, always this app's own real origin) and grant nothing beyond the Automatic Fullscreen content setting — no broader policy surface (e.g. no `ExtensionInstallForcelist`, no `URLAllowlist` bypass) is ever generated, keeping the blast radius of a misapplied file minimal. |
| Client-side download of a file whose content an attacker could influence (e.g. via a crafted `?origin=` query param) | Tampering | The origin is read directly from `window.location.origin` (the actual browser-computed origin of the loaded page), never from a URL query parameter, request body, or any other attacker-influenceable input — so there is no injection surface for a crafted URL to alter the generated file's target origin. Confirm during planning that no implementation path threads a URL param into the generator instead of the live `window.location.origin`. |

## Sources

### Primary (HIGH confidence)
- Existing codebase: `docs/run-fullscreen-setup.md`, `docs/fullscreen-setup/enable-fullscreen-localhost-{HKCU-no-admin,HKLM-admin}.reg`, `src/composables/useOutputWindow.ts` (`attemptAutoFullscreen`), `src/views/MonitorSetupView.vue`, `src/utils/monitorConfig.ts`, `src/components/MonitorFallbackPanel.vue` — read in full this session.

### Secondary (CITED — official documentation, MEDIUM confidence)
- [Chrome Enterprise Policy URL Pattern Format](https://chromeenterprise.google/policies/url-patterns/) — exact `scheme://host:port/path` filter syntax, port/wildcard rules.
- [URL Blocklist Filter Format](https://support.google.com/chrome/a/answer/9942583?hl=en) — corroborating filter-format spec, exact-origin example.
- [Manage Chrome policies with Windows registry](https://support.google.com/chrome/a/answer/9131254?hl=en) — HKLM registry policy setup for non-domain-joined PCs.
- [Complex policies on Windows — chromium.org](https://www.chromium.org/administrators/complex-policies-on-windows/) — list-policy registry encoding (numbered subkey values); the "AD enrolled machines" caveat (see Pitfall 1).
- [Set Chrome app and extension policies (Linux)](https://support.google.com/chrome/a/answer/7517525?hl=en) — `/etc/opt/chrome/policies/managed/` path, JSON format, root/sudo requirement.
- [Allow or block access to websites — macOS `defaults write` example](https://support.google.com/chrome/a/answer/7532419?hl=en) — `com.google.Chrome` preference domain, `defaults write ... -array` form.
- [Edge/Chrome Policy Registry Entries — textslashplain.com](https://textslashplain.com/2022/03/22/edge-chrome-policy-registry-entries/) — HKCU/HKLM behavior on unmanaged PCs, "protected policies" concept, list-value registry encoding without brackets.
- [HTML Fullscreen Without A Gesture — explainer](https://github.com/explainers-by-googlers/html-fullscreen-without-a-gesture/blob/main/README.md) — `navigator.permissions.query({name:'fullscreen', allowWithoutGesture:true})` shape, `TypeError` on unsupported descriptor.
- [Using the Fullscreen API without gestures — chromeos.dev](https://chromeos.dev/en/posts/using-the-fullscreen-api-without-gestures) — Chrome 128 minimum version, `state==='granted'` code pattern, try/catch fallback idiom.
- [NavigatorUAData.platform — MDN](https://developer.mozilla.org/en-US/docs/Web/API/NavigatorUAData/platform) — return values, browser support caveat (Chromium-only, experimental/limited-availability tag).
- macOS Ventura+ unsigned-profile install flow — corroborated across multiple community/support sources (Ntiva, Inventive HQ, NIST macOS Security Compliance Project) describing the double-click-then-approve-in-System-Settings two-step flow and the "Profile Is Not Signed" warning.
- Chrome Safe Browsing download-blocking behavior for `.reg`/uncommon file types — chromestory.com, textslashplain.com "Download Blocking by File Type".

### Tertiary (LOW confidence — WebSearch-summarized, community sources, not independently cross-verified)
- Exact macOS `.mobileconfig` PayloadType nesting (`com.apple.ManagedClient.preferences` wrapper) — pattern consistently found across several community GitHub repos of Chrome `.mobileconfig` examples, but not independently confirmed against a current official Google-published template this session (see Open Question 1 / Assumption A1).
- Edge's Linux managed-policy directory path — two disagreeing candidates found, neither independently confirmed against Microsoft's own current deployment docs (see Open Question 2 / Assumption A2).
- Chromium (distro-packaged, non-Google-build) Linux policy path variants (`/etc/chromium/policies/managed/` vs `/etc/chromium-browser/policies/managed/`) — community-sourced, not independently confirmed.

## Metadata

**Confidence breakdown:**
- Standard stack (native browser APIs, no packages): HIGH — no ecosystem/version-drift risk since nothing is installed; feature-detection is the correct and only gate.
- URL pattern format / Windows registry shape: HIGH — directly CITED against `chromeenterprise.google` and `support.google.com` official pages, and cross-checked against the project's own already-working localhost `.reg` proof artifacts.
- Permissions API (`fullscreen`/`allowWithoutGesture`) shape and Chrome 128 minimum: HIGH — CITED against the official Googler explainer and chromeos.dev, and matches the pattern already live in `useOutputWindow.ts`.
- macOS artifact exact shape: MEDIUM — CITED official docs confirm the `com.google.Chrome` preference domain and `defaults write` form, but the precise `.mobileconfig` XML nesting for a *manually installed, non-MDM* profile is community-sourced, not verified against a current first-party Google template (Assumption A1).
- Linux Edge/Chromium exact paths: LOW-MEDIUM — Chrome's own path is HIGH confidence (official doc); Edge/Chromium variants are genuinely unresolved between disagreeing sources (Assumption A2, Pitfall 6).
- The HKCU-no-admin-on-unmanaged-PC reliability question: MEDIUM — documentation is split, but the project's own empirical proof artifacts plus the owner's locked decision are the deciding evidence; the in-app self-check (R285/R287) is the designed safety net regardless.

**Research date:** 2026-08-29
**Valid until:** 2026-09-28 (30 days — Chrome Enterprise policy semantics and macOS profile-install UX are the fastest-moving pieces here; re-verify the Linux/macOS artifact shapes if this phase is revisited after that window, since Chrome ships every ~4 weeks and Apple's profile-approval UX has changed across recent macOS majors).
