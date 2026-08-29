---
phase: 98-fullscreen-setup-helper
verified: 2026-08-29T22:32:40Z
status: human_needed
score: 4/4 must-haves verified
behavior_unverified: 0
overrides_applied: 0
human_verification:
  - test: "On a real Windows computer with no admin rights: download the HKCU .reg file from the not-ready state, double-click it, click through the Chrome/Windows 'this file may be dangerous' and SmartScreen prompts, fully quit and reopen Chrome (or Edge), then click 'Confirm fullscreen support' in Monitor Setup."
    expected: "chrome://policy shows AutomaticFullscreenAllowedForUrls with this origin, navigator.permissions.query({name:'fullscreen',allowWithoutGesture:true}) resolves 'granted', and the panel flips to the ready state without a page reload."
    why_human: "Requires an actual OS registry write, a real browser restart, and the live Automatic Fullscreen content-setting grant — none of which jsdom/unit tests can produce. Unit tests mock the readiness composable and downloadTextFile by design (98-02-SUMMARY D5)."
  - test: "Same computer, on Go-live with two monitors assigned: confirm both the Audience and Confidence output windows now auto-fullscreen with zero per-window clicking."
    expected: "Both output windows fullscreen themselves automatically, matching the R278 promise this phase exists to make reachable."
    why_human: "End-to-end hardware behavior (multi-monitor placement + no-gesture requestFullscreen) is outside what a browser-less test runner can observe."
  - test: "If a no-admin (HKCU) install does not register (e.g. corporate GPO overrides HKCU), download the HKLM admin file, run it as administrator, restart the browser, and confirm."
    expected: "The HKLM fallback flips the same computer to ready when HKCU alone did not take effect."
    why_human: "Requires a real Windows registry/GPO precedence scenario and admin elevation; cannot be simulated in jsdom."
  - test: "On a real macOS computer: open the downloaded .mobileconfig, install it via System Settings -> Profiles (approving the unsigned-profile warning), restart Chrome or Edge, and confirm readiness flips to ready."
    expected: "The generated .mobileconfig's AutomaticFullscreenAllowedForUrls managed preference actually takes effect for com.google.Chrome / com.microsoft.Edge on a real Mac."
    why_human: "The exact .mobileconfig nesting is flagged in fullscreenPolicyFiles.ts itself as RESEARCH Assumption A1 (LOW confidence, community-sourced, not independently confirmed against a current first-party Apple/Google template) — only a real macOS install proves the shape is actually accepted by the OS."
  - test: "On a real Linux computer running Chrome/Chromium: place the downloaded JSON under /etc/opt/chrome/policies/managed/ (or the Chromium/Edge equivalent) via sudo, restart the browser, and confirm readiness flips to ready."
    expected: "The managed-policy JSON is accepted at the real path and the grant appears in chrome://policy."
    why_human: "Requires real filesystem write under /etc with sudo and a live policy reload; the exact path may vary by distro (RESEARCH Pitfall 6 / OQ2, called out in the panel's own Linux caveat copy)."
---

# Phase 98: Fullscreen Setup Helper Verification Report

**Phase Goal:** Make the R278 "both output windows auto-fullscreen on Go-live" promise actually reachable by a non-technical projectionist, by turning the one-time Chromium "Automatic Fullscreen" policy grant into a guided, self-checking flow embedded in Monitor Setup.
**Verified:** 2026-08-29T22:32:40Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | R285 — readiness detection reuses the exact `{name:'fullscreen', allowWithoutGesture:true}` descriptor, resolves ready/not-ready/unsupported, exposes a "Confirm fullscreen support" re-check, and is provably read-only (never calls `requestFullscreen`) | VERIFIED | `useFullscreenReadiness.ts:23-24` uses the identical descriptor object literal found in `useOutputWindow.ts:172-173`; `checkReadiness()` maps `state==='granted'` -> `'ready'`, else `'not-ready'`, catch -> `'unsupported'`. Unit test `useFullscreenReadiness.test.ts` "NEVER calls requestFullscreen" explicitly spies `Element.prototype.requestFullscreen` and asserts zero calls across a granted resolution; `FullscreenSetupPanel.test.ts`'s own "never calls requestFullscreen (T-98-06)" test spies `document.documentElement.requestFullscreen` across mount+download+confirm and asserts zero calls. Panel renders `fullscreen-setup-status-checking/ready/not-ready/unsupported` blocks (`FullscreenSetupPanel.vue:10,23,33,130`) and a `fullscreen-setup-confirm-button` in both not-ready and unsupported states, wired to `recheck()`. |
| 2 | R286 — generators bake the injected origin verbatim into Windows `.reg` (HKCU default + HKLM fallback, Chrome+Edge), macOS `.mobileconfig`, and Linux managed JSON; the panel's CTA names detected browser+OS, downloads the right artifact, shows the Windows HKLM fallback link; origin comes from `window.location.origin` only, never hardcoded/URL param; honest per-OS friction copy present | VERIFIED | `fullscreenPolicyFiles.ts` — `buildWindowsRegFile` emits both `HKEY_CURRENT_USER\...\Chrome\AutomaticFullscreenAllowedForUrls` / `...\Edge\...` (HKCU) or `HKEY_LOCAL_MACHINE\...` (HKLM), each `"1"="${origin}"`; `buildMacProfile` emits `com.google.Chrome` + `com.microsoft.Edge` managed-preference blocks with the origin in a `<string>`; `buildLinuxPolicyJson` = `{AutomaticFullscreenAllowedForUrls:[origin]}`. `FullscreenSetupPanel.vue:214` — `buildPolicyArtifact(os, window.location.origin, scope)` inside `triggerDownload()`, called ONLY at click time (no module-scope/computed hoist — verified by reading the full file, origin never appears outside this one call site). CTA text `Download setup file for {{ browserLabelText }} on {{ osLabelText }}` (line 56); Windows-only `fullscreen-setup-admin-download-link` gated on `os === 'windows'` (line 64). Per-OS `stepTwoVerb`/`caveatText` computed blocks (lines 183-207) state the Windows "may be dangerous — click Keep" friction, macOS admin-password + Profiles approval, Linux sudo + path caveat — matching CONTEXT Decision 5's "honest friction" requirement. Unit tests assert origin-in-contents (`fullscreenPolicyFiles.test.ts`) and that clicking download/admin-link calls `downloadTextFile` with the OS-correct filename+contents containing `window.location.origin` (`FullscreenSetupPanel.test.ts` lines 129-168). |
| 3 | R287 — panel mounted once in `MonitorSetupView.vue`, additively, in every phase; self-corrects to ready without remount on successful re-check; troubleshooting appears only on a still-not-ready confirm | VERIFIED | `MonitorSetupView.vue:155` — `<FullscreenSetupPanel class="mt-8" />` is the last child of the outer `div.px-6.py-8.max-w-4xl`, placed AFTER the closing `</div>` of the phase `v-if/v-else-if` chain (confirmed by direct read of lines 3-157) — i.e. outside and unconditional, not one of the mutually exclusive branches. `MonitorSetupView.test.ts` describe block "FullscreenSetupPanel is mounted additively, outside the phase chain" asserts presence in two different phases (default/prompt and `unavailable`) plus `findAll(...).toHaveLength(1)` — exactly one instance. `FullscreenSetupPanel.test.ts` "re-runs the readiness check and flips not-ready -> ready on the SAME wrapper, with no remount" captures the root DOM element reference before/after a confirm click and asserts identity (`toBe(panelElementBefore)`); "does not show troubleshooting on first paint, and shows it only after a still-not-ready confirm" asserts `fullscreen-setup-troubleshooting` absent pre-click and present only after a resolved-still-not-ready `recheck()`. |
| 4 | Scope/regression — client-only (no Firestore/rules/functions/npm dependency), `useOutputWindow.ts`/`useRunControl.ts` untouched, no Electron/Presentation API introduced | VERIFIED | `git diff 50498bf1 24385395 -- src/composables/useOutputWindow.ts src/composables/useRunControl.ts` is empty (zero changes across the entire phase's commit range). `git diff 50498bf1 24385395 -- package.json package-lock.json` is empty (no new dependency). Grep of the phase's new/modified files for `firestore|firebase/firestore|electron|PresentationRequest` finds none. All 8 new files (`osDetect.ts`, `fullscreenPolicyFiles.ts`, `downloadTextFile.ts`, `useFullscreenReadiness.ts`, `FullscreenSetupPanel.vue` + 4 test files) plus the additive `MonitorSetupView.vue` edit are client-side-only (Blob download, permission query, DOM). |
| 5 | Gates — `npm run type-check` clean; bare `npx vitest run` shows only the documented `storage.rules.test.ts` baseline failing, no new failures | VERIFIED | `npm run type-check` (`vue-tsc --build`, includes test files per CLAUDE.md) ran clean with zero output/errors. Full bare `npx vitest run` (run once, not filtered): `Test Files 1 failed | 174 passed (175)`; `Tests 25 failed | 4733 passed (4758)`; the single failing file is `src/storage.rules.test.ts` (all 25 failures are its known Storage-emulator-dependent cases per CLAUDE.md's documented baseline) — matches 98-02-SUMMARY's own reported 174/175 / 4733/4758 exactly. No new failures introduced by this phase. |

**Score:** 4/4 roadmap success criteria verified in-code (0 present-but-behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/utils/osDetect.ts` | OS/browser detection, injected-navigator seam | VERIFIED | `detectOS`/`detectBrowser`/`osLabel`/`browserLabel` exported, bodies read only injected `nav` param, Edge checked before Chrome; 16 passing tests |
| `src/utils/fullscreenPolicyFiles.ts` | Origin-baked policy artifact generators + dispatcher | VERIFIED | `buildWindowsRegFile`, `buildMacProfile`, `buildLinuxPolicyJson`, `buildPolicyArtifact`; 12 passing tests |
| `src/utils/downloadTextFile.ts` | Blob + `<a download>` helper | VERIFIED | Blob/anchor/revoke with `finally` guarantee, injected `doc` param; 3 passing tests |
| `src/composables/useFullscreenReadiness.ts` | Read-only readiness composable | VERIFIED | `status`/`recheck`, onMounted+focus self-correction, never calls requestFullscreen; 10 passing tests |
| `src/components/FullscreenSetupPanel.vue` | Four-state UI panel | VERIFIED | All UI-SPEC testids/copy present and matched; 15 passing tests |
| `src/views/MonitorSetupView.vue` | Additive mount | VERIFIED | Single unconditional mount outside phase chain; existing 10 tests + 3 new presence tests pass |
| `src/utils/__tests__/osDetect.test.ts`, `fullscreenPolicyFiles.test.ts`, `downloadTextFile.test.ts`, `src/composables/__tests__/useFullscreenReadiness.test.ts`, `src/components/__tests__/FullscreenSetupPanel.test.ts`, `src/views/__tests__/MonitorSetupView.test.ts` | Behavioral test coverage | VERIFIED | All present, all green (90 tests across the 7 targeted files run together) |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `FullscreenSetupPanel.vue` | `useFullscreenReadiness.ts` | `const { status, recheck } = useFullscreenReadiness()` | WIRED | Confirmed at `FullscreenSetupPanel.vue:165` |
| `FullscreenSetupPanel.vue` | `osDetect.ts` | `detectOS()`/`detectBrowser()`/`osLabel()`/`browserLabel()` | WIRED | Confirmed at `FullscreenSetupPanel.vue:170-173` |
| `FullscreenSetupPanel.vue` | `fullscreenPolicyFiles.ts` + `downloadTextFile.ts` | `buildPolicyArtifact(os, window.location.origin, scope)` then `downloadTextFile(...)` inside `triggerDownload()` | WIRED | Confirmed at `FullscreenSetupPanel.vue:212-221`; unit tests assert both calls fire with correct args on click |
| `MonitorSetupView.vue` | `FullscreenSetupPanel.vue` | `<FullscreenSetupPanel class="mt-8" />`, unconditional, last child | WIRED | Confirmed at `MonitorSetupView.vue:155`, outside the `v-if`/`v-else-if` phase chain (lines 14-148) |
| `useFullscreenReadiness.ts` | `useOutputWindow.ts` (descriptor reuse, not code coupling) | Identical `{name:'fullscreen',allowWithoutGesture:true}` object literal | VERIFIED (no-regression) | `useFullscreenReadiness.ts:24` vs `useOutputWindow.ts:173` — same descriptor; `useOutputWindow.ts`/`useRunControl.ts` files themselves are unmodified (`git diff` empty) |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| R285 | 98-01, 98-02 | Monitor Setup detects/displays automatic-fullscreen readiness with a re-check control | SATISFIED | Truth #1 above; REQUIREMENTS.md marks R285 Complete |
| R286 | 98-01, 98-02 | One-click download of the correct enablement file, origin-correct, per-OS, honest friction copy | SATISFIED | Truth #2 above; REQUIREMENTS.md marks R286 Complete |
| R287 | 98-02 | Helper embedded in monitor-assignment flow, self-corrects, actionable troubleshooting | SATISFIED | Truth #3 above; REQUIREMENTS.md marks R287 Complete |

No orphaned requirements found for Phase 98 in REQUIREMENTS.md.

### Anti-Patterns Found

None. Grep for `TBD|FIXME|XXX|TODO|HACK|PLACEHOLDER` across all 6 new/modified source files (`osDetect.ts`, `fullscreenPolicyFiles.ts`, `downloadTextFile.ts`, `useFullscreenReadiness.ts`, `FullscreenSetupPanel.vue`, `MonitorSetupView.vue`) returned zero matches. No stub returns (`return null`/`{}`/`[]` used as a hollow implementation), no hardcoded empty props, no console.log-only handlers. The one intentionally-documented low-confidence area — `.mobileconfig` exact nesting (RESEARCH Assumption A1) — is explicitly flagged in the source comment itself, not hidden, and is correctly routed to human verification below rather than silently claimed as certain.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Targeted phase test files (7 files: osDetect, fullscreenPolicyFiles, downloadTextFile, useFullscreenReadiness, FullscreenSetupPanel, MonitorSetupView, useOutputWindow regression guard) | `npx vitest run <7 files>` | 90/90 tests passed | PASS |
| Type-check (includes test files, per CLAUDE.md) | `npm run type-check` | Clean, zero errors | PASS |
| Full bare suite (run once) | `npx vitest run` | 174/175 files, 4733/4758 tests — only `src/storage.rules.test.ts` fails (documented baseline) | PASS (no new failures) |
| Descriptor never triggers fullscreen | Spy assertions in both `useFullscreenReadiness.test.ts` and `FullscreenSetupPanel.test.ts` | `requestFullscreen` never called across granted-resolution, download, and confirm flows | PASS |
| No regression to `useOutputWindow.ts`/`useRunControl.ts` | `git diff 50498bf1 24385395 -- <files>` | Empty diff | PASS |
| No new npm dependency | `git diff 50498bf1 24385395 -- package.json package-lock.json` | Empty diff | PASS |

### Human Verification Required

Genuine hardware/browser-permission items that unit tests structurally cannot cover — this milestone's established pattern (see 92-VERIFICATION.md precedent and 98-02-SUMMARY's own D5 item). Listed in frontmatter `human_verification` above; summarized:

1. **Windows HKCU (no-admin) end-to-end** — download, run, restart browser, confirm flips to ready on real hardware.
2. **Full R278 promise on real multi-monitor hardware** — both output windows actually auto-fullscreen on Go-live once the policy grant is live.
3. **Windows HKLM (admin) fallback** — when HKCU alone doesn't register (e.g. GPO override).
4. **macOS `.mobileconfig` install** — flagged in-code as RESEARCH Assumption A1 (LOW confidence, unconfirmed exact nesting against a first-party template); only a real macOS install proves the artifact is actually accepted.
5. **Linux managed-policy JSON install** — real `/etc/opt/.../policies/managed/` path may vary by distro (RESEARCH Pitfall 6 / OQ2, already surfaced honestly in the panel's own caveat copy).

None of these are coding gaps — they are the inherent boundary between "the code generates and reasons about the correct artifact" (provably true, unit-tested) and "a real OS accepts and enforces that artifact" (only provable on physical hardware). This is exactly the deferred-UAT category this milestone has consistently used (STATE.md's tracked open item: "multi-monitor auto-fullscreen needs the one-time-per-computer Chrome policy").

### Gaps Summary

No gaps. All four ROADMAP success criteria and all three requirements (R285/R286/R287) are implemented, wired, and covered by genuine behavioral unit tests (not placeholder assertions) — confirmed by direct source reading, not SUMMARY.md claims alone. The scope fence held: no Electron, no Presentation API, no backend/Firestore change, no dependency added, and the Phase 97 gesture-fallback runtime (`useOutputWindow.ts`, `useRunControl.ts`) is byte-for-byte untouched across the whole phase's commit range. Type-check and the full test suite are clean against the documented single-file baseline.

The phase cannot be marked fully `passed` because its own explicit design intent — a helper for a real-world, per-computer OS policy grant — has an irreducible hardware-verification tail. That tail is correctly framed by the plan itself (98-02-SUMMARY D5) as owner UAT, not an in-plan automated gate, and is captured here as `human_needed` rather than either a false PASS or an unfair FAIL.

---

_Verified: 2026-08-29T22:32:40Z_
_Verifier: Claude (gsd-verifier)_
