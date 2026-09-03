# Phase 114: Multi-Monitor Assignment Rework - Research

**Researched:** 2026-09-02
**Domain:** Browser Window Management API (`getScreenDetails`), client-side persistence model rework, Vue role-assignment UI
**Confidence:** MEDIUM-HIGH — the codebase itself is the primary source (all claims about current behavior are `[VERIFIED: codebase]`); the macOS-placement fix technique is `[CITED: Chrome for Developers / MDN]` since it is new to this codebase, not yet proven against the owner's real 3-monitor Mac.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Monitor identity & the false "monitors changed" prompt (R326, R328)**
- Stable fingerprint: identify a monitor by `label + WxH` only; **drop the volatile `left,top`
  position and `isPrimary`** from the fingerprint — those flip between macOS re-detects and are the
  root cause of the false "monitors changed" reprompt and the roles-not-sticking symptom.
- Delta-only reprompt: when a monitor is added/removed vs the saved mapping, **keep the matching
  assignments and prompt only for the delta** — never wipe the whole mapping and force a full
  reconfigure.
- Identical monitors (same label+resolution): disambiguate with a **stable index by sorted
  position captured at save time**, tolerant to small coordinate drift.
- Migration: bump the storage key (`wp:runMonitorConfig:v1` → `v2`); the old mapping is ignored
  with a one-time reconfigure rather than a risky in-place migrate.

**Role model — any role to any monitor, multiple Audience (R324, R325)**
- Cardinality: each monitor holds **one role or none**; the **same role may repeat** — multiple
  Audience AND multiple Confidence monitors are both allowed. No monitor is forced to hold a role.
- Interaction: a **per-monitor role selector** (None / Audience / Confidence). Changing one
  monitor's role **never mutates another monitor** — this is what kills the reported "select
  Audience on one and it clears on the other" bug (a UI/state bug; the `MonitorAssignment[]` model
  already supports it).
- Minimum to Run: require **≥1 Audience**; Confidence is optional; Run is allowed with Audience
  only.
- Single screen / nothing assigned (dev): keep the existing pop-out-window + per-window "Go
  fullscreen" fallback path.

**Output-window launch across N displays incl. macOS (R327)**
- One output window per assignment: N Audience windows each mirror the same AudienceOutputView;
  each Confidence window renders ConfidenceOutputView.
- macOS placement: **re-run `getScreenDetails()` at launch** for live coordinates, open the window
  then `moveTo`/`resizeTo` onto the target screen and `requestFullscreen()` there; if the Window
  Management API or its permission is unavailable, fall back to the existing per-window "Go
  fullscreen" button.
- Coords source: always taken **live at launch**; the saved mapping supplies only role-by-identity,
  never stale coordinates.

**Monitor nicknames (R338 — owner-added)**
- A user can type a **nickname per detected monitor**, persisted alongside that monitor's identity
  (fingerprint) in the v2 mapping and shown on the setup/assignment UI (and reused wherever a
  monitor is labeled). Nickname persistence follows the same stable-identity rule so it survives
  re-detects; a blank nickname falls back to the OS label (or "Unknown").

### Claude's Discretion
- Exact selector control (segmented buttons vs dropdown), nickname edit affordance, and the precise
  delta-reprompt copy are at Claude's discretion, consistent with existing MonitorSetupView
  patterns.

### Deferred Ideas (OUT OF SCOPE)
- Audio (vamps, canned music) — deferred to the backlog 999.13 storage cluster (out of milestone
  scope).
- Live-output font auto-scaling, thumbnail sizing, "end" marker — Phase 115.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| R324 | Detect and list every connected display, no cap at two | `matchMapping`/`computeFingerprint` already iterate `ScreenLike[]` with no length assumption — see Architecture Patterns § Fingerprint v2. No change needed to detection itself (`getScreenDetails()` already returns all screens); the cap-at-two behavior lives entirely in the UI/model layer being reworked below. |
| R325 | Any role to any monitor, incl. multiple Audience, independent per-monitor selection | `MonitorAssignment[]` already supports repeated roles (verified — no uniqueness constraint in `isValidMapping`/`saveMapping`). The bug is isolated to `MonitorSetupView.vue`'s `audienceFingerprint`/`confidenceFingerprint` singleton refs and `onSelectRole`'s mutual-exclusion logic — see Architecture Patterns § Role-Selector Rework. |
| R326 | Assignments persist and stay stuck on 3+ monitors | Root-caused to fingerprint volatility (`left,top,isPrimary`) in `computeFingerprint` + `matchMapping`'s all-or-nothing bidirectional set-equality — see Architecture Patterns § Fingerprint v2 and § Delta Match. |
| R327 | Output windows land on assigned display on macOS/Chrome | Root-caused to `openWindow`'s window-feature-string + `moveTo` positioning in `useRunControl.ts`, which the CONTEXT.md field report says fails on macOS. New technique found: `requestFullscreen({screen})` — see Architecture Patterns § macOS Placement Fix (Pattern 3). |
| R328 | No false "monitors changed" reprompt on unchanged layout | Same root cause as R326 — the fingerprint volatility. Delta-match logic (Pattern 2) additionally means even a genuine layout change no longer reprompts for monitors that ARE unchanged. |
| R338 | Per-monitor nickname, persisted with identity, shown on setup + assignment UI | New field on `MonitorAssignment` (or a parallel `nicknames: Record<string,string>` — see Data Model below); no existing precedent in this codebase, greenfield addition. |
</phase_requirements>

## Summary

This phase reworks four tightly-coupled pieces that all sit on top of one pure module,
`src/utils/monitorConfig.ts`: the fingerprint/persistence model, the `MonitorSetupView.vue`
role-assignment UI, the N-window launch/placement path in `useRunControl.ts`, and the two
fixed-cardinality display panels (`RunDisplaysPanel.vue`, `RunPreflightPanel.vue`). All four are
currently hard-coded to **exactly two roles, one monitor each** — `audienceFingerprint`/
`confidenceFingerprint` singleton refs, `wp-audience`/`wp-confidence` fixed window names,
`audienceUrl()`/`confidenceUrl()`, `audienceClosed`/`confidenceClosed` booleans, two fixed
`<MonitorCard>`/preflight-card slots. None of this is Firestore-backed — it is all pure,
device-scoped `localStorage`, and it must stay that way (ADR-0183, ARCHITECTURE.md Anti-Pattern 3).

The good news: `MonitorAssignment[]` already has no cardinality constraint (multiple entries can
share `role: 'audience'` today — nothing in `monitorConfig.ts` rejects it). The "select Audience on
one monitor clears it on another" bug is **purely** `MonitorSetupView.vue`'s two singleton refs, not
the data model. The "roles don't stick on 3 monitors" and "false monitors-changed" bugs are **purely**
`computeFingerprint`'s inclusion of `left,top,isPrimary` (which macOS re-detects with drift/reordering)
combined with `matchMapping`'s all-or-nothing bidirectional set-equality (any single delta invalidates
the WHOLE mapping). Fixing those two root causes, generalizing the singleton refs to arrays, and
generalizing the two-fixed-window launch path to an N-window loop is the entire phase. No new
external package is needed — everything is native browser API (`getScreenDetails`,
`requestFullscreen`) plus this project's own pure utils.

**Primary recommendation:** Rework `monitorConfig.ts` first (pure, unit-testable, zero Vue/DOM
dependency) with a v2 fingerprint (`label:WxH` + a stable same-model disambiguation index) and a
delta-aware `matchMapping` that returns which assignments survive vs. which are new/missing, THEN
propagate the array-based model up through `MonitorSetupView.vue` (fix the per-monitor selector),
`useRunControl.ts` (generalize `openPlaced`/`openWindow`/the closed-poll from 2 fixed roles to N
assignments), and the two display panels (dynamic lists). Add the macOS placement fix
(`requestFullscreen({screen})`, called from inside each popup once it has independently confirmed
Window Management permission) as an additional per-window step alongside the existing
`moveTo`/`resizeTo`, not a replacement for it.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Monitor fingerprint/identity + role/nickname persistence | Browser / Client (localStorage, `monitorConfig.ts`) | — | Device-scoped by design (ADR-0183) — never Firestore; a monitor setup belongs to the physical machine, not the user account. |
| Role-assignment UI (detect, select roles, save) | Browser / Client (`MonitorSetupView.vue`) | — | Pure client-side state machine over `getScreenDetails()` + `monitorConfig.ts`; no server round-trip. |
| Output-window open/place/fullscreen orchestration | Browser / Client (`useRunControl.ts`, opener window) | — | `window.open`/`moveTo`/`getScreenDetails` are opener-window-only APIs; no backend involvement. |
| Per-window self-fullscreen-on-assigned-screen | Browser / Client (inside each popup, via `useOutputWindow.ts` or a new sibling) | — | `requestFullscreen({screen})` must be called from the window that owns the element being fullscreened — the popup, not the opener. |
| Slide content rendering (Audience/Confidence views) | Browser / Client (`AudienceOutputView.vue`/`ConfidenceOutputView.vue`) | — | Unchanged by this phase — already role-parameterized and window-count-agnostic; N windows to the same URL work today with zero changes. |

## Standard Stack

### Core
No new libraries. This phase is 100% native browser API + existing in-repo pure utilities.

| API/Module | Version/Spec | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `Window.getScreenDetails()` / `ScreenDetailed` | Window Management API (W3C, Chromium-only) | Enumerate connected displays with label/resolution/position | Already the sole detection mechanism in this codebase (Phase 91/92); no alternative exists for this capability in a browser context |
| `Element.requestFullscreen({ screen })` | Window Management API extension to Fullscreen API | Request fullscreen ON a specific `ScreenDetailed`, not just "wherever this window currently is" | `[CITED: developer.chrome.com/docs/capabilities/web-apis/window-management]` — documented, spec-backed mechanism for landing fullscreen on a non-primary/non-current screen without relying on `moveTo` positioning alone |
| `src/utils/monitorConfig.ts` | in-repo | Fingerprint, persistence, match logic | This IS the module being reworked — no substitute |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `crypto.randomUUID()` (built-in, no import) | Web platform | Generate a stable-enough per-window handle key if fingerprints prove awkward as object keys (they contain `:` — usable as JS object/Map keys as-is, so this is a fallback, not a requirement) | Only if a plan step needs an opaque id decoupled from the fingerprint string itself |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Hand-rolled fingerprint disambiguation index | A UUID assigned to each monitor by the OS | Not available — neither `ScreenDetailed` nor any Web API exposes a persistent hardware id for a display; `label`/`id`-style properties are **not** guaranteed stable across replugs or reboots (confirmed via Chrome docs research below) |
| `moveTo`/`resizeTo` alone for macOS placement | `requestFullscreen({screen})` from inside the popup | `moveTo` positioning is exactly what CONTEXT.md's field report says fails on macOS; `requestFullscreen({screen})` is the documented, more robust alternative — see Pitfall 1 |

**Installation:** None — no `npm install` needed for this phase.

**Version verification:** N/A — no npm packages added. `getScreenDetails`/`requestFullscreen({screen})`
are runtime browser APIs, feature-detected at call time exactly as the existing code already does
(`'getScreenDetails' in window`).

## Package Legitimacy Audit

**Not applicable — this phase installs no external packages.** Every capability used
(`getScreenDetails`, `ScreenDetailed`, `requestFullscreen({screen})`, `localStorage`) is a native
browser API already available to the app; all persistence/matching logic is hand-written in
`src/utils/monitorConfig.ts`, which is the file this phase reworks, not a new dependency.

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

```text
┌─────────────────────────────── MonitorSetupView.vue (opener/setup) ───────────────────────────────┐
│                                                                                                      │
│  getScreenDetails() ──▶ liveScreens[] ──▶ computeFingerprint()/groupAndIndex() ──▶ per-screen        │
│                                                        │                          fingerprint (v2)   │
│                                                        ▼                                             │
│                                        loadMapping() (v2 key) ──▶ matchMapping()                     │
│                                                        │                                              │
│                            ┌───────────────────────────┴───────────────────────────┐                 │
│                            ▼                                                       ▼                 │
│                    'matched' (silent reuse,                              'partial' (keep matched      │
│                     no reprompt — R328)                                   assignments, prompt ONLY    │
│                            │                                              for new/missing — R326)     │
│                            └───────────────────────────┬───────────────────────────┘                 │
│                                                        ▼                                              │
│              Per-monitor role selector (None/Audience/Confidence) — INDEPENDENT per card (R325)      │
│              + nickname text input per card (R338)                                                    │
│                                                        │                                              │
│                                                        ▼                                              │
│                              saveMapping() ──▶ localStorage `wp:runMonitorConfig:v2`                  │
└──────────────────────────────────────────────────────┬───────────────────────────────────────────────┘
                                                         │  (device-scoped, read at Run go-live)
┌────────────────────────────────────────────────────── ▼ ─────────────────────────────────────────────┐
│                                     useRunControl.ts (opener/control window)                          │
│                                                                                                        │
│  openOutputs() ──▶ getScreenDetails() [FRESH, live coords] ──▶ loadMapping() ──▶ matchMapping()        │
│                                                        │                                               │
│                              for each assignment in mapping.assignments:                               │
│                                  resolveScreen(assignment, liveScreens) ──▶ openWindow(url, name,       │
│                                  screen) [window.open + best-effort moveTo/resizeTo]                    │
│                                                        │                                               │
│                                        (name is now per-ASSIGNMENT, e.g. wp-output-<fp-hash>,           │
│                                         not the fixed 'wp-audience'/'wp-confidence')                    │
└────────────────────────────────────────────────────────┬─────────────────────────────────────────────┘
                                                           │  window.open() — new browsing context, SAME
                                                           │  origin, permission already granted
┌──────────────────────────────────────────────────────── ▼ ─────────────────────────────────────────────┐
│                     Each output popup (AudienceOutputView.vue / ConfidenceOutputView.vue)               │
│                                                                                                          │
│  useOutputWindow({ role, targetFingerprint }) on mount:                                                 │
│    1. Render content immediately (unchanged — never blocks on placement)                                │
│    2. permissions.query({name:'window-management'}) → if granted, own getScreenDetails()  ◀── NEW       │
│    3. find ScreenDetailed matching targetFingerprint (passed via URL query, e.g. &screen=...)  ◀── NEW  │
│    4. document.documentElement.requestFullscreen({ screen: matchedScreen })  ◀── macOS fix (Pattern 3)  │
│    5. on failure/unavailable → existing plain requestFullscreen() + per-window                          │
│       "Go fullscreen" manual button fallback (UNCHANGED)                                                 │
└──────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

### Recommended Project Structure
No new top-level files are required — this is a targeted rework of existing files, not a new
subsystem:

```
src/
├── utils/
│   ├── monitorConfig.ts            # REWORK: fingerprint v2, nickname field, delta matchMapping
│   └── __tests__/monitorConfig.test.ts   # EXTEND: fingerprint stability, delta match, nickname round-trip
├── views/
│   ├── MonitorSetupView.vue        # REWORK: N-card array state, independent per-monitor role select
│   └── __tests__/MonitorSetupView.test.ts
├── components/
│   ├── MonitorCard.vue             # EXTEND: nickname input, add "None" role option
│   ├── run/
│   │   ├── RunDisplaysPanel.vue    # REWORK: dynamic N-row list instead of fixed 2-row
│   │   └── RunPreflightPanel.vue   # REWORK: dynamic list or count summary instead of 2 fixed cards
│   └── __tests__/MonitorCard.test.ts
├── composables/
│   ├── useRunControl.ts            # REWORK: N-assignment open/place/poll loop, replaces 2 fixed roles
│   ├── useOutputWindow.ts          # EXTEND: per-window requestFullscreen({screen}) self-placement
│   └── __tests__/
└── views/
    ├── AudienceOutputView.vue      # UNCHANGED (already role-parameterized, window-count-agnostic)
    └── ConfidenceOutputView.vue    # UNCHANGED
```

### Pattern 1: Fingerprint v2 — drop volatile fields, add a stable disambiguation index
**What:** Split the fingerprint into two parts: an **identity** component (`label:WxH`, per CONTEXT
decision — drops `left,top,isPrimary`) and a **disambiguation index** for when two-or-more monitors
share an identical identity (e.g., two of the same model). The index is assigned by sorting the
group's screens by position (`left`, then `top`) at the moment of computation — both at save time
and at every subsequent match/reprompt — so it stays consistent as long as the physical left-to-right
ordering of same-model monitors doesn't change.
**When to use:** Every place the old `computeFingerprint` is called (`MonitorSetupView.vue`,
`useRunControl.ts`, tests).
**Example:**
```typescript
// monitorConfig.ts — identity ignores left/top/isPrimary; index restores per-model uniqueness
function identityKey(screen: ScreenLike): string {
  const label = screen.label && screen.label.length > 0 ? screen.label : UNLABELED_PLACEHOLDER
  return `${label}:${screen.width}x${screen.height}`
}

/** Groups by identity, sorts each group by (left, top), assigns 0-based index within group. */
export function computeFingerprints(screens: ScreenLike[]): Map<ScreenLike, string> {
  const byIdentity = new Map<string, ScreenLike[]>()
  for (const s of screens) {
    const key = identityKey(s)
    const group = byIdentity.get(key) ?? []
    group.push(s)
    byIdentity.set(key, group)
  }
  const result = new Map<ScreenLike, string>()
  for (const [key, group] of byIdentity) {
    const sorted = [...group].sort((a, b) => a.left - b.left || a.top - b.top)
    sorted.forEach((s, i) => result.set(s, `${key}#${i}`))
  }
  return result
}
```
This is a genuine behavior change from a pure per-screen `computeFingerprint(screen)` to a
whole-array `computeFingerprints(screens)` — callers that only had one screen in hand (`resolveScreen`
in `useRunControl.ts`, matching a saved fingerprint against a specific live screen) need the full live
array to compute a correct index, not just that one screen. **Keep a single-screen
`computeFingerprint(screen, allScreens)` overload** for call sites that only have one screen but do
have the full live array in scope, to minimize call-site churn.

### Pattern 2: Delta-aware `matchMapping` — never wipe the whole mapping on a partial change
**What:** Replace the current binary `{status:'matched'} | {status:'needs-reprompt'}` with a
three-way result that separates "still-present" assignments (kept silently) from "new" screens
(need a role choice) and "missing" fingerprints (dropped, no prompt needed — they're just gone).
**When to use:** `MonitorSetupView.vue`'s `resolveGrantedBranch`/`applyDetectedScreens`, and
`useRunControl.ts`'s `onScreensChange` (mid-service unplug detection) and `openOutputs`'s go-live
match check.
**Example:**
```typescript
export type MatchResultV2 =
  | { status: 'matched' }                                                    // R328: silent reuse
  | { status: 'partial'; kept: MonitorAssignment[]; newScreens: ScreenLike[] } // R326: delta reprompt
  | { status: 'no-mapping' }

export function matchMapping(saved: MonitorMapping, liveScreens: ScreenLike[]): MatchResultV2 {
  const fpByScreen = computeFingerprints(liveScreens)
  const liveFps = new Set(fpByScreen.values())
  const savedFps = new Set(saved.assignments.map((a) => a.fingerprint))
  const kept = saved.assignments.filter((a) => liveFps.has(a.fingerprint))
  const newScreens = liveScreens.filter((s) => !savedFps.has(fpByScreen.get(s)!))
  if (kept.length === saved.assignments.length && newScreens.length === 0) return { status: 'matched' }
  return { status: 'partial', kept, newScreens }
}
```
The UI consumes `partial` by pre-populating the N kept assignments (role + nickname already
selected, matching `MonitorSetupView.vue`'s existing "editable grid with pre-selection" pattern for
the B2→"Reassign roles" flow) and only rendering role selectors for `newScreens` — this is the exact
mechanism that turns "your monitor setup changed, reassign everything" into "we found 1 new
display, assign it or leave it unassigned" (R326/R328).

### Pattern 3: macOS placement fix — `requestFullscreen({screen})` from inside the popup
**What:** `document.documentElement.requestFullscreen({ screen: targetScreen })` is a documented
extension of the Fullscreen API added by the Window Management API spec — it requests fullscreen
**on a specific `ScreenDetailed`**, not merely "wherever the calling document currently is."
`[CITED: developer.chrome.com/docs/capabilities/web-apis/window-management]`, `[CITED:
developer.mozilla.org/en-US/docs/Web/API/ScreenDetailed]`. This is a materially different mechanism
from the current code's plain `requestFullscreen()` (which the existing `attemptAutoFullscreen`
comment explicitly assumes is safe because "the window is already positioned on its monitor" — an
assumption the CONTEXT.md field report says is FALSE on macOS).
**When to use:** Inside each output popup, once it has confirmed the Window Management permission is
already granted (it is, at the same origin, the moment the opener has it — no new user prompt).
**Example:**
```typescript
// useOutputWindow.ts — self-placement, additive to the existing attemptAutoFullscreen
async function attemptScreenTargetedFullscreen(targetFingerprint: string | null) {
  if (!targetFingerprint || !('getScreenDetails' in window)) return false
  try {
    const status = await navigator.permissions.query({ name: 'window-management' } as PermissionDescriptor)
    if (status.state !== 'granted') return false
    const details = await (window as any).getScreenDetails()
    const fpByScreen = computeFingerprints(details.screens)
    const match = [...fpByScreen.entries()].find(([, fp]) => fp === targetFingerprint)?.[0]
    if (!match) return false
    await document.documentElement.requestFullscreen({ screen: match } as any)
    return true
  } catch {
    return false // falls through to existing plain requestFullscreen() + manual button
  }
}
```
The `targetFingerprint` must reach the popup — simplest path is a URL query param on the existing
`audienceUrl()`/`confidenceUrl()` builders (e.g. `?org=...&screen=<encodeURIComponent(fingerprint)>`),
read via `useRoute().query.screen` exactly as `org` already is. **Keep the existing
`openWindow`'s window-feature-string + `moveTo`/`resizeTo`** as the first, immediate best-effort
placement (per CONTEXT.md's explicit decision) — the screen-targeted `requestFullscreen` is an
ADDITIVE second step that corrects the final resting screen if the first step landed wrong, not a
replacement.

### Pattern 4: N-assignment window orchestration (replaces fixed audience/confidence pair)
**What:** `useRunControl.ts`'s `openPlaced`/`openUnplaced`/`reopenOutput`/the closed-poll/
`outputWindows` record all assume exactly 2 named roles. Generalize to iterate
`mapping.assignments` (which may be any length ≥1, with repeated roles).
**When to use:** The entire go-live/reopen/close code path in `useRunControl.ts`.
**Example (shape, not full code):**
```typescript
// Window name MUST be stable across a reopen of the SAME assignment (so browser window-name
// reuse works) but UNIQUE across assignments sharing a role (so two Audience windows don't
// collide on window.open's name-reuse semantics).
function windowNameFor(assignment: MonitorAssignment): string {
  return `wp-output-${assignment.fingerprint.replace(/[^a-zA-Z0-9]/g, '_')}`
}

const outputWindows: Record<string, Window | null> = {}       // keyed by windowNameFor(assignment)
const closedFlags = ref<Record<string, boolean>>({})           // one per assignment, not 2 fixed refs

function openAllPlaced(assignments: MonitorAssignment[], screens: ScreenLike[]) {
  const opened: { assignment: MonitorAssignment; win: Window | null }[] = []
  for (const a of assignments) {
    const screen = resolveScreen(a, screens)
    const url = a.role === 'audience' ? audienceUrl(a.fingerprint) : confidenceUrl(a.fingerprint)
    opened.push({ assignment: a, win: openWindow(url, windowNameFor(a), screen) })
  }
  // "≥1 Audience required, Confidence optional" (CONTEXT decision) — the go/no-go check is now
  // "at least one audience window opened", not "both fixed windows opened" (bothOpened rework).
}
```
`RunDisplaysPanel.vue`'s fixed two-`OutputCard` props and `RunPreflightPanel.vue`'s two fixed
display cards both need the equivalent generalization — from `{audience, confidence}` props to an
`assignments: {role, nickname, label, open, fullscreen}[]` prop, rendered with `v-for`.

### Anti-Patterns to Avoid
- **Re-adding `left,top,isPrimary` to the fingerprint "for safety":** this is the exact bug being
  fixed (R326/R328) — those fields are the ones macOS returns with drift/reordering across
  re-detects. Resist the temptation to "improve accuracy" by including position data in identity.
- **Migrating v1 data in place:** CONTEXT.md is explicit — bump the key to `v2` and let v1 go
  unread. Writing a v1→v2 converter is unnecessary risk for a device-local, one-time-setup value
  (re-running Monitor Setup takes under a minute).
- **Treating a `null`/absent nickname as a stored empty string that then displays blank:** per
  R338, a blank nickname must fall back to the OS label at render time (or "Unknown" if the label is
  also empty) — do not persist a placeholder string that could stale-drift from the real label.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Cross-window screen targeting | A custom postMessage protocol that ships full `ScreenDetailed` objects (position/resolution) from opener to popup | Re-call `getScreenDetails()` **inside** the popup itself and match by fingerprint | `ScreenDetailed` objects are not structured-cloneable in a meaningful way across `postMessage`, and permission is already granted at the origin — a second in-popup call is free and gets LIVE coordinates for that window's own placement, exactly matching CONTEXT.md's "coords source: always taken live at launch" decision |
| Stable per-monitor unique ID | A synthetic hash the app invents and hopes stays stable | The v2 fingerprint (identity + sorted-position index), openly flagged as heuristic | No Web API provides a persistent hardware display id (verified via research below) — any "solution" here is inherently a heuristic; don't over-engineer one that pretends otherwise |

**Key insight:** every "hand-roll" temptation in this phase is really "the Window Management API
doesn't give us a perfect answer, so don't pretend a home-grown ID system will either" — the
correct scope is a best-effort heuristic (openly documented as such, mitigated by nicknames) not a
from-scratch identity system.

## Common Pitfalls

### Pitfall 1: Assuming window.open's feature-string positioning is sufficient on macOS
**What goes wrong:** `openWindow`'s `left=X,top=Y` feature string plus `moveTo`/`resizeTo` is the
CURRENT mechanism and is exactly what the owner's real-hardware test found broken on macOS/Chrome
(CONTEXT.md, "Manual dragging is explicitly NOT an acceptable answer for macOS").
**Why it happens:** macOS's window server can reject/ignore JS-requested absolute window positions
for security/UX reasons (this is a long-standing, widely-reported Chrome-on-macOS limitation, not a
bug in this codebase) — confirmed by community reports found during research (Apple Community,
MacRumors, Chrome support forums all describe Chrome popups landing on the wrong macOS display).
**How to avoid:** Layer `requestFullscreen({screen})` (Pattern 3) as a corrective SECOND step,
called from inside the popup once it independently re-resolves its assigned screen — this bypasses
JS-level window positioning entirely in favor of the browser's own screen-aware fullscreen
placement.
**Warning signs:** A window opens but visually appears on the wrong physical display even though
`openWindow`'s features string had the "right" coordinates for that screen.

### Pitfall 2: Losing "which physical monitor is this" when two are identical
**What goes wrong:** Two identical-model monitors (same `label` + resolution) produce the same
identity fingerprint; the sorted-position disambiguation index (Pattern 1) is a best-effort
heuristic, not a guarantee — if macOS reports the two monitors' `left` coordinates in a different
relative order on a later boot (a real possibility after a cable/dock reconnect), the index could
flip, silently reassigning roles between the two.
**Why it happens:** No Web API exposes a persistent per-display hardware ID (confirmed — see
Sources).
**How to avoid:** This is exactly why R338 (nicknames) was added mid-discuss — surface the nickname
prominently on both the setup grid and the Run pre-flight/displays panel so a projectionist can spot
a flipped assignment at a glance and re-save. Document this residual risk explicitly rather than
promising perfect identical-monitor disambiguation.
**Warning signs:** Roles swap between two identically-modeled monitors after a reboot/replug, with
no genuine layout change.

### Pitfall 3: Window-name collisions across multiple Audience windows
**What goes wrong:** `window.open(url, name, ...)` with a REUSED `name` navigates the EXISTING
window with that name instead of opening a new one. The current code's fixed `'wp-audience'` name
works because there is exactly one Audience window; N Audience windows need N DISTINCT names, but
each name must stay STABLE across a reopen of that SAME assignment (so `reopenOutput` targets the
right window, not a fresh duplicate).
**Why it happens:** Easy to overlook when generalizing from "2 fixed roles" to "N assignments" —
the natural first draft is `wp-audience-${i}` keyed by array index, which is NOT stable if the array
order changes between saves (e.g., after a reconfigure).
**How to avoid:** Key the window name off the assignment's FINGERPRINT (Pattern 4's
`windowNameFor`), not its array position — fingerprints are the stable identity across reconfigures
of the SAME physical arrangement.
**Warning signs:** Reopening a "closed" display opens a duplicate window instead of reusing/
recreating the named one; or two Audience windows overwrite each other.

### Pitfall 4: The permission-gesture ADRs already flag this class of bug
**What goes wrong:** `getScreenDetails()`/fullscreen-without-gesture calls have strict rules about
when a user activation is required vs. when an already-granted permission allows a gestureless
call. This codebase has THREE existing ADRs about exactly this fragility class (ADR-0214 "monotonic
token guarding a stale getScreenDetails", ADR-0216 "the single most gesture-sensitive line in this
phase", ADR-0125 "only a synchronous in-window gesture can re-enter fullscreen").
**Why it happens:** Adding a NEW `getScreenDetails()` call site inside each popup (Pattern 3) is a
second gesture-sensitive call site, in a NEW context (a popup window, not the original
user-clicked opener) — it is not obviously covered by the existing ADRs' reasoning.
**How to avoid:** Reference those three ADRs directly when writing the popup-side permission check;
do not assume "permission granted" behaves identically for a call originating in a popup vs. the
top-level opener without verifying (fold this into the plan's verification step, not merely the
Common Pitfalls list).
**Warning signs:** The popup-side `getScreenDetails()` call silently rejects/hangs in a way the
opener-side call never did.

## Code Examples

### v1→v2 storage key bump (mechanical, per CONTEXT.md decision)
```typescript
// monitorConfig.ts
export const MONITOR_CONFIG_STORAGE_KEY = 'wp:runMonitorConfig:v2' // was ':v1'
// No reader for the old key is added — a v1 mapping is simply invisible to v2 code,
// producing the same "nothing saved yet" first-run UX as a brand-new device.
```

### Nickname field on the mapping (data model addition for R338)
```typescript
export interface MonitorAssignment {
  fingerprint: string
  role: MonitorRole
  nickname?: string   // user-entered; blank/absent falls back to the live screen's OS label at render
}
```
Keeping `nickname` on the SAME `MonitorAssignment` record (rather than a separate
`Record<fingerprint, nickname>` map) means a nickname naturally travels with its assignment through
`saveMapping`/`loadMapping`/`matchMapping`'s existing round-trip — no new storage shape to reconcile,
and the `isValidMapping` guard only needs one added optional-string check.

### "None" role — allowing a monitor to hold no assignment (supports R325's "no monitor forced")
```typescript
// MonitorSetupView.vue's per-card selector needs a 3rd option beyond Audience/Confidence.
// The data model itself needs no "none" role value — a screen with NO entry in
// mapping.assignments simply has no role, which is the existing default (a screen not in the
// array today already means "not assigned to anything"). Selecting "None" for a previously-
// assigned monitor means REMOVING its entry from the assignments array, not writing a sentinel role.
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| `fullscreen` window-open feature flag / Fullscreen Popups origin trial (Chrome 119-122) | `Permissions.query({name:'fullscreen', allowWithoutGesture:true})` + plain `requestFullscreen()` | Origin trial ended/superseded March 2024, per Chrome's own explainer (`[CITED: github.com/w3c/window-management/blob/main/EXPLAINER_fullscreen_popups.md]`) | This codebase's existing `attemptAutoFullscreen` (`useOutputWindow.ts`) already uses the MODERN replacement — no change needed there, only the addition of the `{screen}` option (Pattern 3) is new |
| Position-only window placement (`moveTo`/`resizeTo`) | `requestFullscreen({ screen })` targeting a specific `ScreenDetailed` | Available since the Window Management API's `ScreenDetailed`/fullscreen extension shipped in Chromium (current stable, verified by Chrome for Developers docs) | Directly addresses the R327 macOS bug — see Pattern 3 |

**Deprecated/outdated:**
- The `fullscreen` `window.open()` feature-string flag for auto-fullscreen popups: superseded, do
  not reintroduce it even though the existing `openWindow` features string still uses the word
  `fullscreen` as a hint — that particular usage predates this deprecation and its effect (if any)
  is incidental; do not build NEW logic that depends on it.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `requestFullscreen({screen})`, called from inside a same-origin popup that independently confirms Window Management permission is already granted, works WITHOUT a fresh user gesture in that popup's context, mirroring how `MonitorSetupView.vue`'s own `onMounted` gestureless re-call already behaves for the opener. | Architecture Patterns § Pattern 3 | If a popup context requires its OWN fresh gesture (unlike the opener), the whole macOS-placement fix technique needs a fallback path built in from the start rather than as an edge case — verify this against real Chrome/macOS behavior early in execution (a spike/smoke-test before committing to the full plan), not assumed from docs alone. |
| A2 | The sorted-position disambiguation index for identical monitors (Pattern 1) is "tolerant to small coordinate drift" as CONTEXT.md specifies, because sort order is preserved even when exact left/top values shift slightly between re-detects — but is NOT tolerant to macOS reporting the two monitors in a genuinely different relative left-to-right order after a reconnect. | Architecture Patterns § Pattern 1, Pitfall 2 | Two identical monitors could have roles silently swapped after a replug; mitigated by R338 nicknames but not eliminated — flag to the owner as a known, documented residual risk, not a promise of perfect identical-monitor stability. |
| A3 | No production dependency needs to change for the URL-based `screen` query param approach (Pattern 3) to pass a target fingerprint into each popup — `useRoute().query` already reads `org` this way in the output views. | Architecture Patterns § Pattern 3 | Low risk — this is a minimal, already-precedented mechanism (see `AudienceOutputView.vue`'s existing `route.query.org` pattern via `useServiceAssembly`). |

**If this table is empty:** N/A — see rows above.

## Open Questions

1. **Does `requestFullscreen({screen})` require the SAME transient-activation rules as plain
   `requestFullscreen()`, when called from a popup that never received a direct click (it was
   `window.open`'d by the opener's click)?**
   - What we know: the existing `attemptAutoFullscreen` already successfully calls PLAIN
     `requestFullscreen()` gesturelessly from inside a freshly-opened popup, gated on the
     `{name:'fullscreen', allowWithoutGesture:true}` permission descriptor being granted. `{screen}`
     is documented as an additional OPTION to the same method, not a different API.
   - What's unclear: whether adding the `screen` option changes the gesture-requirement semantics
     Chrome enforces (i.e., does targeting a non-current screen re-introduce a gesture requirement
     that the same-screen case waives?).
   - Recommendation: treat this as a plan-time verification step — a small manual smoke test against
     real Chrome (ideally on the owner's actual macOS 3-monitor rig) before the full R327 build is
     considered done, not merely a unit-test-mocked assertion.

2. **Should the "≥1 Audience required to Run" gate (CONTEXT decision) block Go-live entirely, or
   allow Go-live with a warning?**
   - What we know: CONTEXT.md says "require ≥1 Audience; Confidence is optional; Run is allowed
     with Audience only" — this reads as a hard requirement (no Audience = cannot Run), mirroring
     today's `canSave` gate in `MonitorSetupView.vue` which already disables Save until both roles
     are chosen.
   - What's unclear: the exact UX for the "0 Audience assigned" case at Run time specifically (vs.
     at Setup time) — does `RunPreflightPanel`'s Go-live button disable, or does clicking it route to
     Monitor Setup?
   - Recommendation: mirror the existing `MonitorFallbackPanel`/`canSave`-disables-Save precedent —
     disable Go-live with an inline explanation, offering a link to Monitor Setup, consistent with
     `openManage()`'s existing `/monitor-setup` new-tab pattern.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Chromium-based browser (Chrome/Edge) with Window Management API | `getScreenDetails()`, `requestFullscreen({screen})` (R324-R328, R327) | ✓ (owner's church Mac runs Chrome, per CONTEXT.md/CLAUDE.md field notes) | Chrome/Edge current stable (feature has shipped for several stable releases) | Existing `MonitorFallbackPanel.vue` denied/unavailable manual-setup path (unchanged by this phase) |
| Firefox / Safari | N/A — same fallback | ✗ (Window Management API is Chromium-only) | — | Same `MonitorFallbackPanel.vue` fallback (already the production behavior; unaffected by this phase) |
| jsdom (test environment) | Unit/component tests | ✗ (`getScreenDetails` absent by default, confirmed by `MonitorSetupView.test.ts`'s own doc comment) | — | Tests install a `vi.fn()` stub on `window.getScreenDetails`/`Element.prototype.requestFullscreen`, per existing pattern in `MonitorSetupView.test.ts`/`RunControlView.output.test.ts` — new tests must do the same for the `{screen}` option and the popup-side call |

**Missing dependencies with no fallback:** none — every gap already has a working, tested fallback
in production code today.

**Missing dependencies with fallback:** Firefox/Safari/jsdom, as above — all pre-existing, unaffected
by this phase's scope.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest ^4.0.18 (`@vue/test-utils` for component mounts) |
| Config file | `vite.config.ts` (root app suite) — excludes `src/rules.test.ts` and `render-service/**` |
| Quick run command | `npx vitest run src/utils/__tests__/monitorConfig.test.ts` (fastest — pure module, no DOM mount) |
| Full suite command | `npx vitest run` (per CLAUDE.md — the bare command is now correctly scoped; do NOT use `--dir src`) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| R324 | N (3+) monitors all detected/listed, no cap | unit + component | `npx vitest run src/views/__tests__/MonitorSetupView.test.ts -t "3"` (new cases) | ✅ file exists, extend with a 3+ screen fixture |
| R325 | Independent per-monitor role select, repeated roles allowed | component | `npx vitest run src/views/__tests__/MonitorSetupView.test.ts` | ✅ extend |
| R326 | Assignments persist/stick on 3+ monitors (delta match) | unit | `npx vitest run src/utils/__tests__/monitorConfig.test.ts` | ✅ extend — add partial-match cases |
| R327 | Output windows land on assigned display incl. macOS (`{screen}` fullscreen) | unit (composable) | `npx vitest run src/composables/__tests__/useOutputWindow.test.ts` | ✅ extend — mock `getScreenDetails` + `requestFullscreen` inside the popup-side test |
| R328 | No false reprompt on unchanged layout | unit | `npx vitest run src/utils/__tests__/monitorConfig.test.ts` | ✅ extend — the existing `matchMapping` describe block is the direct precedent |
| R338 | Nickname round-trip + display fallback to OS label | unit + component | `npx vitest run src/utils/__tests__/monitorConfig.test.ts src/views/__tests__/MonitorSetupView.test.ts` | ✅ extend both |
| (cross-cutting) | N-window open/place/reopen/close loop in Run mode | component | `npx vitest run src/views/__tests__/RunControlView.output.test.ts` | ✅ extend — this file already asserts `moveTo`/`requestFullscreen` spies per window; generalize its fixtures from 2 fixed windows to N |

### Sampling Rate
- **Per task commit:** `npx vitest run <touched test file>` (fast, scoped)
- **Per wave merge:** `npx vitest run` (full app suite; CLAUDE.md-documented single known-failing
  baseline file, `src/storage.rules.test.ts`, is unrelated to this phase and must not be chased)
- **Phase gate:** Full suite green (modulo the documented baseline) before `/gsd-verify-work`; also
  run `npm run type-check` (NOT `-p tsconfig.app.json`) per CLAUDE.md, since this phase touches
  shared types (`MonitorAssignment`, `MatchResultV2`) consumed by both `src/` and `src/**/__tests__`.

### Wave 0 Gaps
None — every touched file already has a `__tests__` counterpart with an established mocking
pattern for `getScreenDetails`/`requestFullscreen` (see `MonitorSetupView.test.ts`'s
`installGetScreenDetails` helper and `RunControlView.output.test.ts`'s window-spy fixtures). The
gap to close is EXTENDING these existing suites with 3+-monitor and popup-side-fullscreen fixtures,
not standing up new test infrastructure.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Unaffected — this phase touches no auth surface |
| V3 Session Management | no | Unaffected |
| V4 Access Control | no | Unaffected — monitor config is device-local, not org/user-scoped data |
| V5 Input Validation | yes | `isValidMapping`'s untrusted-`localStorage`-read guard (T-91-01 precedent) must be extended to validate the new `nickname` field (reject non-string, cap length) exactly as it already validates `fingerprint`/`role` — this is the ONE genuinely new input-validation surface this phase adds |
| V6 Cryptography | no | Unaffected |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Malformed/oversized nickname string written directly to `localStorage` (e.g. via devtools, or a stale/corrupted write) later rendered unescaped into the DOM | Tampering / (minor) Information Disclosure | Vue's default text interpolation (`{{ nickname }}`) already HTML-escapes — no `v-html` should ever be used for the nickname; additionally extend `isValidMapping` to reject non-string/overlong nickname values on read, mirroring the existing fingerprint/role validation (never trust a localStorage read — T-91-01 precedent already established in this file) |
| Cross-window `postMessage` spoofing a target-screen fingerprint to make a popup fullscreen on the wrong display | Spoofing | Not applicable to the recommended design (Pattern 3 passes the fingerprint via same-origin URL query param the popup itself constructed/received at `window.open` time, not via a later cross-window message an attacker could forge); if execution instead chooses a `postMessage`-based handoff, it MUST reuse this codebase's existing origin-check pattern (`event.origin !== window.location.origin` — see `useOutputWindow.ts`'s `handleDelegationMessage`) |

## Sources

### Primary (HIGH confidence)
- `C:\projects\worshipplanner\src\utils\monitorConfig.ts` + `__tests__\monitorConfig.test.ts` — read
  in full, current fingerprint/persistence/match implementation
- `C:\projects\worshipplanner\src\views\MonitorSetupView.vue` + `__tests__\MonitorSetupView.test.ts`
  — read in full, current role-selector bug location
- `C:\projects\worshipplanner\src\composables\useRunControl.ts` — read in full, current N=2 window
  orchestration
- `C:\projects\worshipplanner\src\composables\useOutputWindow.ts` — read in full, current fullscreen/
  wake-lock/delegation lifecycle
- `C:\projects\worshipplanner\src\components\run\RunDisplaysPanel.vue`,
  `RunPreflightPanel.vue`, `MonitorCard.vue`, `MonitorFallbackPanel.vue` — read in full
- `C:\projects\worshipplanner\src\views\AudienceOutputView.vue`, `ConfidenceOutputView.vue` — read
  in full, confirmed window-count-agnostic
- `.planning/phases/114-multi-monitor-assignment-rework/114-CONTEXT.md`,
  `.planning/REQUIREMENTS.md`, `.planning/STATE.md` (grep), `.planning/codebase/ARCHITECTURE.md`,
  `.planning/codebase/CONVENTIONS.md`

### Secondary (MEDIUM confidence)
- [Manage several displays with the Window Management API | Chrome for Developers](https://developer.chrome.com/docs/capabilities/web-apis/window-management) — `[CITED]`, fetched in full: `ScreenDetailed` property list, `window.open`+`moveTo` pattern, `requestFullscreen({screen})` example
- [ScreenDetailed - Web APIs | MDN](https://developer.mozilla.org/en-US/docs/Web/API/ScreenDetailed) — `[CITED]`, property definitions (`label`, `isPrimary`)
- [Window: getScreenDetails() method | MDN](https://developer.mozilla.org/en-US/docs/Web/API/Window/getScreenDetails) — `[CITED]`
- [EXPLAINER fullscreen popups (w3c/window-management)](https://github.com/w3c/window-management/blob/main/EXPLAINER_fullscreen_popups.md) — `[CITED]`, confirms the `fullscreen` window-open-flag origin trial was superseded by gestureless-fullscreen (already the pattern this codebase uses)

### Tertiary (LOW confidence)
- Community reports (Apple Community, MacRumors forums, Chrome support forum threads found in
  WebSearch results) describing Chrome-on-macOS popup mis-placement across displays — `[ASSUMED]`
  corroborating evidence for the CONTEXT.md field report, not independently re-verified; treat as
  qualitative confirmation the bug class is well-known, not as a specification of the fix.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new packages; existing code fully read and understood
- Architecture (fingerprint/delta-match rework): HIGH — root causes directly verified against the
  actual `monitorConfig.ts` implementation and its test suite
- Architecture (macOS placement fix): MEDIUM — the `requestFullscreen({screen})` technique is
  well-documented but UNPROVEN against this specific codebase/owner's hardware; flagged in Open
  Questions as needing an early smoke-test
- Pitfalls: HIGH for the codebase-internal ones (window-name collisions, fingerprint volatility);
  MEDIUM for the macOS-specific ones (corroborated by community reports, not lab-reproduced here)

**Research date:** 2026-09-02
**Valid until:** 30 days (stable browser API surface; re-verify `requestFullscreen({screen})` browser
support if execution slips past a Chrome major-version boundary)
