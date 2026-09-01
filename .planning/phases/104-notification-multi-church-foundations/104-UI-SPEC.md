---
phase: 104
slug: notification-multi-church-foundations
status: draft
shadcn_initialized: false
preset: none
created: 2026-09-01
---

# Phase 104 — UI Design Contract

> Two surfaces, both generalizing existing, already-shipped patterns — no new component library, no new dependency. (1) `src/stores/toasts.ts` + `ToastHost.vue` generalize into the one system-wide dismissible-message system (severities info/success/warning/error, manual dismiss on every message, transient-vs-sticky lifetimes). (2) The `AppSidebar.vue` user block gains a "switch church" dropdown for multi-org members, reusing `authStore.selectOrg()` + the app's one existing ARIA-menu component (`SlideActionMenu.vue`) as its interaction model, and `TeamView.vue`'s existing role-badge markup for the per-church role pill. All visuals inherit the existing dark Tailwind v4 system (gray-950 body / gray-900+gray-800 surfaces / indigo-600 accent). New this phase: the four-severity color ramp, a unified dismiss-button contract, and the switcher dropdown shape.

---

## Design System

| Property | Value |
|----------|-------|
| Tool | none |
| Preset | not applicable |
| Component library | none — hand-authored Vue 3 SFCs + Tailwind utility classes (no headless-UI/component-library dependency exists anywhere in the codebase) |
| Icon library | none — inline hand-authored `<svg>` paths. This phase standardizes the notification host on the **Heroicons-solid, `viewBox="0 0 20 20"`, single `<path fill-rule="evenodd" clip-rule="evenodd">`** technique already used 4× in `RunControlView.vue`'s amber banners (lines 48–59, 98–109, 131–142, 168–179) — reuse that exact `warning` path verbatim; add `info`/`success`/`error` siblings in the same technique (Heroicons `information-circle`, `check-circle`, `x-circle` solid glyphs). This supersedes `ToastHost.vue`'s current outline/`stroke`, `viewBox="0 0 24 24"` triangle for the `error` variant going forward — a deliberate, minor visual harmonization, not a functional change. |
| Font | Tailwind v4 default sans stack (`ui-sans-serif, system-ui, sans-serif`). `--slide-font-family: 'Inter'…` in `src/assets/main.css` is scoped to rendered presentation slides only and does not apply to app chrome. |

**shadcn gate: not run.** This is a Vue 3 + Vite project (shadcn targets React/Next.js/Vite-React); no `components.json` exists and none should be introduced now — the app already has an established, consistent hand-rolled dark Tailwind design system spanning 100+ prior phases. Introducing shadcn here would fragment that consistency rather than serve it. Registry safety gate: not applicable.

---

## ⚠ Architecture finding that gates R310 (read before planning)

`ToastHost.vue` is mounted inside `AppShell.vue` (`AppShell.vue:60`), and `AppShell.vue` is a per-view wrapper that most views (`MonitorSetupView.vue:2,138`, etc.) opt into — **but `RunControlView.vue` explicitly does not** (its own header comment: *"A full-viewport Nocturne-dark shell (NOT AppShell)"*, confirmed at `RunControlView.vue:1-12`). `App.vue` itself renders only a bare `<RouterView />` (`App.vue:16`) with no shell of its own.

**Consequence:** a notification host mounted only inside `AppShell.vue`, as today, will never render on `RunControlView.vue` — which is exactly where R310's proof case (the monitor-reassign banner, `RunControlView.vue:43-90`, `monitorChanged` ref) lives. **The generalized host must move its mount point from `AppShell.vue` to `App.vue`**, as a sibling of `<RouterView />`, so it renders on every route regardless of whether that route opts into `AppShell`. This is a one-line relocation (`<NotificationHost />`/`<ToastHost />` moves from `AppShell.vue:60` to `App.vue`, alongside removing the now-redundant mount from `AppShell.vue`), not a rewrite — call this out explicitly in the phase plan, it is easy to miss since the component itself doesn't change shape.

**Flag for the executor:** the notification host's fixed bottom-right position (`fixed … bottom-4 sm:right-6 sm:bottom-6`) has never been tested against `RunControlView.vue`'s own bottom transport bar/filmstrip chrome. Verify at build time that a sticky notification card doesn't visually collide with Run-screen bottom controls at common viewport sizes; if it does, the fix is a scoped CSS bottom-offset for that one route (a CSS custom property the host already reads), never a second host component.

---

## Spacing Scale

Declared values (must be multiples of 4) — reconfirmed against `ToastHost.vue`, `RunControlView.vue`'s banners, `AppSidebar.vue`, `SlideActionMenu.vue`, `TeamView.vue`:

| Token | Value | Usage |
|-------|-------|-------|
| xs | 4px | `gap-1`/`mt-0.5` icon-to-text offsets; dismiss-button hit-area padding (new, see below) |
| sm | 8px | `gap-2` (banner icon-to-text gap), `gap-1.5` (avatar-to-text gap in `AppSidebar.vue`), `mt-2` action-row spacing |
| md | 16px | `p-4`/`m-4` (banner outer margin, existing), `px-4` (dropdown menu item padding) |
| lg | 24px | not newly introduced this phase |
| xl | 32px | not newly introduced this phase |
| 2xl | 48px | not newly introduced this phase |
| 3xl | 64px | not newly introduced this phase |

Exceptions (both pre-existing, reused verbatim, not new inventions):
- Role badge padding `px-1.5 py-0.5` (6px/2px) — copied verbatim from `TeamView.vue:72` for the switcher's per-church role pill.
- Dismiss-button hit area: add `p-1 -m-1` (4px, within the `xs` token) around the existing bare `×` glyph in `ToastHost.vue:20-25` — a minor touch-target improvement, not a new spacing value.

---

## Typography

| Role | Size | Weight | Line Height |
|------|------|--------|-------------|
| Body | 14px (`text-sm`) | 400 (regular) | 1.5 (default Tailwind leading) — notification message/detail lines, switcher church-name rows |
| Label | 12px (`text-xs`) | 500 (`font-medium`) | 1.5 — role badge text, "Switch church" section header, dismiss-button visually-hidden label |
| Heading | 14px (`text-sm`, `font-medium`) | 500 | 1.2 — notification card heading line (e.g. "Your monitor setup changed") |
| Display | not introduced this phase | — | — |

Exactly 2 weights used across this phase's new UI: 400 (message/body text) and 500 (headings, labels, role badges, dismiss button). No bold (700) is introduced.

---

## Color

| Role | Value | Usage |
|------|-------|-------|
| Dominant (60%) | `#030712` (`bg-gray-950`) | App/page background (`src/assets/main.css:7`) |
| Secondary (30%) | `#111827` (`bg-gray-900`) / `#1f2937` (`bg-gray-800`), borders `border-gray-800`/`border-gray-700` | Sidebar, switcher dropdown panel, menu-item hover state |
| Accent (10%) | `#4f46e5` (`bg-indigo-600`/`text-indigo-300`/`ring-indigo-500`) | **Reserved for:** the active church's checkmark + row tint in the switcher (`bg-indigo-600/20 text-indigo-300`, matching `AppSidebar.vue`'s existing active-nav-item treatment verbatim); the Editor role badge (`bg-indigo-900/50 text-indigo-300`, `TeamView.vue:74`); focus rings on the switcher trigger, menu items, and every dismiss button. Nothing else. |
| Destructive | `#991b1b`/`#450a0a` (`border-red-800`/`bg-red-950`) | Error-severity notifications only. No new destructive *actions* are introduced this phase (switcher has no delete; sign-out is unchanged, unconfirmed, as today). |

Accent reserved for: active-church indicator + Editor role badge + focus rings — nothing else.

### Notification severity ramp (new this phase — the core visual deliverable)

One consistent 4-shade ramp per severity, applied uniformly across both the existing compact toast shape and the richer sticky-banner shape (see Component Contract below):

| Severity | Border | Background | Icon | Text (heading + body, single shade) |
|----------|--------|------------|------|--------------------------------------|
| info (new) | `border-blue-800` `#1e40af` | `bg-blue-950` `#172554` | `text-blue-400` `#60a5fa` | `text-blue-200` `#bfdbfe` |
| success (new) | `border-green-800` `#166534` | `bg-green-950` `#052e16` | `text-green-400` `#4ade80` | `text-green-200` `#bbf7d0` |
| warning (existing, reused verbatim) | `border-amber-800` `#92400e` | `bg-amber-950` `#451a03` | `text-amber-400` `#fbbf24` | `text-amber-200` `#fde68a` |
| error (harmonized) | `border-red-800` `#991b1b` | `bg-red-950` `#450a0a` | `text-red-400` `#f87171` | `text-red-200` `#fecaca` |

**Deliberate, noted change:** today's `ToastHost.vue` renders error text at `text-red-400` (`ToastHost.vue:11`). This contract moves it to `text-red-200`, matching the single-shade convention every other severity (and the pre-existing amber banners) already use — icon stays `-400`, container text becomes `-200`. This is the one visual delta from current production behavior; call it out in the PR/changelog as intentional, not a regression.

`success` and `info` are new colors (green, blue) — chosen because `green` is already this codebase's established "good/confirmed" signal (`MonitorSetupView.vue`'s "Saved for this device" success line, `text-green-400`; `RunPreflightPanel.vue`'s "All N rendered" readiness line, `text-green-300`), and `blue` is a safe, unused-elsewhere standard Tailwind color for the lowest-severity tier.

---

## Component Contract — Notification Host (R309, R310)

Generalizes `src/stores/toasts.ts` in place (widen `push`/`dismiss`; existing call sites keep working with `variant: 'error'`, `autoDismissMs: 6000` defaults). Renders through the existing `ToastHost.vue` file (kept, not renamed, per the locked CONTEXT.md decision), mounted at the new `App.vue` root location described above.

- **Two lifetimes, one list.** Transient items (`autoDismissMs` set) and sticky items (`autoDismissMs: undefined`, keyed via `setSticky(key, …)`/`clearSticky(key)`) render in the same fixed-position stack (`fixed inset-x-4 bottom-4 z-[60] flex flex-col gap-2 sm:inset-x-auto sm:right-6 sm:bottom-6 sm:w-full sm:max-w-sm` — existing container, unchanged). **Sticky items render first in DOM order** (top of the stack) so a persistent warning is never buried under a newer transient toast.
- **Two card sizes within the one host** — do not force every message into the compact single-line shape:
  - **Compact (transient toast, existing shape):** `flex items-start gap-2 rounded-md border px-4 py-3 text-sm` — icon `h-4 w-4`, one message line, dismiss `×` at the end. This is `ToastHost.vue`'s current markup, just re-themed per the severity table above.
  - **Rich (sticky notification, new shape — ports `RunControlView.vue`'s existing amber-banner markup verbatim into the host):** `flex items-start gap-3 rounded-md border px-4 py-3` — icon `h-5 w-5`, a `font-medium` heading line, an optional `mt-1 text-sm` body line, an optional `mt-2` action row (button and/or link — needed because the monitor-reassign banner carries a real "Reopen & replace {role}" primary button and an "Open monitor setup" link that must not be lost in the migration, `RunControlView.vue:69-87`), and the same dismiss `×` at top-right of the card.
- **Manual dismiss is mandatory and identical across both shapes and all four severities (R309):** a real `<button type="button">`, `aria-label="Dismiss"` (or a more specific `` `Dismiss: ${heading}` `` when a heading exists), class `flex-none p-1 -m-1 rounded text-{severity}-400 hover:text-{severity}-300 focus:outline-none focus:ring-2 focus:ring-{severity}-500`. Dismissing is independent of whether the underlying condition has cleared — it always works immediately (`toasts.ts`'s existing `dismiss()` idempotent-filter behavior carries forward unchanged).
- **Condition-cleared auto-dismiss (R310):** a sticky item is removed when its owning view calls `clearSticky(key)` — no manual action required. Adding the same key twice replaces in place (no duplicate stacking) — this is the one genuinely new store mechanic this phase adds (no existing precedent), per ARCHITECTURE.md.
- **Accessibility (per CONTEXT.md, explicit requirement):** `warning`/`error` severities keep `role="alert"` (existing, assertive by implication — unchanged). `info`/`success` severities use `role="status"` + `aria-live="polite"` (new — today's host has no polite-tier message type at all). The outer stack container itself carries no `aria-live` of its own (avoid double-announcing); live-region semantics live on each individual message.
- **Migration proof cases (both required this phase, per ARCHITECTURE.md):**
  1. `RunControlView.vue`'s `run-reassign-banner` (`monitorChanged`, lines 43-90) → `notifications.setSticky('monitor-reassign', { variant: 'warning', heading: 'Your monitor setup changed', body: …, action: { label: 'Reopen & replace {role}', onClick: reopenReassignedOutputs }, link: { label: 'Open monitor setup in a new tab', href: '/monitor-setup' } })`, cleared from the same two places that already clear `monitorChanged` today, **plus** the new manual dismiss.
  2. `MonitorSetupView.vue`'s `saveOutcome === 'not-persisted-warning'` (line 131) → the same `setSticky`/`clearSticky` treatment, `warning` severity, cleared on a successful save.
- **Opportunistic sweep (not exhaustive — per CONTEXT.md's explicit scope note):** if a quick pass surfaces other obvious ad-hoc `v-if`-gated banners with no dismiss path, route them through the new store too; note any left unmigrated as follow-up rather than silently leaving them stuck.

---

## Component Contract — Church Switcher (R311, R312)

Lives in `AppSidebar.vue`'s existing user block (`AppSidebar.vue:51-72`) — **not** a new top-bar element; this app's "user menu" is the sidebar footer avatar/name/email row, not a header bar, and the switcher extends that existing block rather than inventing a new location.

- **Single-org users: zero visual change.** The block stays exactly as it renders today — static, no button semantics, no dropdown. The switcher only activates when `authStore.memberships.length > 1`.
- **Multi-org gate also excludes super-admin "enter any church" mode:** `v-if="authStore.memberships.length > 1 && !authStore.viewingAsSuperAdmin"` — while a super-admin is viewing a church via `enterOrgAsSuperAdmin()`, the existing "viewing as super-admin" banner + exit affordance (`AppShell.vue:38-53`) is the only switch mechanism shown; the two must never stack in the same UI (CONTEXT.md, explicit requirement).
- **Trigger:** the existing avatar+name+email row (`AppSidebar.vue:52-61`) becomes a `<button type="button" aria-haspopup="menu" :aria-expanded="open">` wrapping that exact same row markup, unchanged visually except for a `hover:bg-gray-800 rounded-lg` affordance and a small chevron icon appended (`h-3.5 w-3.5 text-gray-600`, rotates 180° when open) so it reads as interactive.
- **Panel — reuses `SlideActionMenu.vue`'s ARIA-menu pattern verbatim** (this codebase's only existing `role="menu"` implementation): `role="menu"`, items `role="menuitem"`, a `fixed inset-0 z-10` click-outside overlay, the same 100ms-in/75ms-out scale+fade `Transition`, `Escape` closes and refocuses the trigger, opening moves focus to the first menu item. Positioned `absolute inset-x-3 bottom-full mb-2` (opens **upward** — the trigger sits at the bottom of a fixed sidebar, so there is no room below it), `rounded-lg border border-gray-700 bg-gray-800 shadow-xl`.
- **Panel contents, top to bottom:**
  1. Section label `"Switch church"` — `text-xs font-medium uppercase tracking-wide text-gray-500 px-3 pt-2 pb-1` (Label typography row).
  2. One row per `authStore.memberships` entry:
     - **Church name** (`truncate`, matching `SelectChurchView.vue:34`) + a **role badge** reusing `TeamView.vue:71-78`'s exact markup: `px-1.5 py-0.5 text-xs rounded`, `bg-indigo-900/50 text-indigo-300` for Editor / `bg-gray-700 text-gray-300` for Viewer, text `"Editor"`/`"Viewer"` (this app's two membership-role display labels — never "Admin", matching `TeamView.vue`'s established copy).
     - **Current active church:** rendered as a non-interactive row (`role="menuitem" disabled aria-current="true"`, `cursor-default`), with a small check icon + `bg-indigo-600/20 text-indigo-300` row tint (the exact active-nav-item treatment `AppSidebar.vue:41-42` already uses) — not a round-trip click target.
     - **Other churches:** a real `role="menuitem"` `<button>` calling `authStore.selectOrg(id)` on click, `hover:bg-gray-700` row hover.
     - **Deactivated churches** (`active === false`): `disabled`, `opacity-50 cursor-not-allowed`, name suffixed `(deactivated)` in `text-gray-500 text-xs` — reuses `SelectChurchView.vue:36` verbatim.
  3. **Sign out stays exactly where and how it is today** (`AppSidebar.vue:62-71`, its own separate button below the trigger row) — unchanged, no confirmation, out of scope for this phase.
- **In-flight state:** clicking a church row disables that row (and only that row) and swaps its role badge for a small `h-3.5 w-3.5 animate-spin text-indigo-400` spinner (same spinner markup already used in `App.vue:9-11`), mirroring `SelectChurchView.vue`'s `isSelecting` guard. On success the menu closes automatically (the app re-renders under the new org via the existing `resetOrgScopedStores()`/`onSnapshot` re-subscription path — no page reload, no extra loading screen needed). On failure, the menu stays open, the row re-enables, and the error surfaces through this phase's own new notification store — `notifications.push('Could not switch churches. Please try again.', { variant: 'error' })`, adapting `SelectChurchView.vue:102`'s existing wording — a direct dogfood of the Phase 104 primitive rather than a bespoke inline error box (there's no room for one in the sidebar footer).
- **Overflow (new pattern, no existing precedent for a scrolling menu in this app):** panel gets `max-h-64 overflow-y-auto` so a user in many churches doesn't push the menu off-screen.
- **Data dependency, flagged for the planner (not a UI decision):** `authStore.memberships` today is `{id, name, active}[]` (`auth.ts:148`) — it carries **no role**. The per-org role is already resolvable from the claim read at `auth.ts:519` (`claimOrgs: Record<orgId, role>`) but is currently discarded after computing `ids`. The store needs to thread that role onto each membership entry (e.g. `memberships.value = […, role: claimOrgs[id] ?? 'viewer']`) for this contract's role badge to have data to render. This is store-shape work for the plan, not a visual decision — the badge markup above assumes it lands.

---

## Copywriting Contract

| Element | Copy |
|---------|------|
| Notification dismiss control | `aria-label="Dismiss"` (generic) or `` `Dismiss: ${heading}` `` when the card has a heading — never a bare unlabeled `×` |
| Sticky monitor-reassign notification (R310 proof case) | Heading: **"Your monitor setup changed"** / Body: *"A display was unplugged or rearranged, so we can't place the {role} output on its old screen. Your service is still live — reopen the {role} display below to keep going without losing your place."* (verbatim, `RunControlView.vue:62-68`) / Action: **"Reopen & replace {role}"** / Link: **"Open monitor setup in a new tab"** |
| Switcher primary action | **"Switch church"** (section label; selecting a row is the action, not a separate CTA button) |
| Switcher error state | *"Could not switch churches. Please try again."* (surfaced via the new notification store, `error` severity) |
| Switcher empty state | Not applicable — the switcher renders nothing at all for single-org users (an intentional absence, not an empty-state message) |
| Destructive confirmation | Not applicable — this phase introduces no destructive actions; Sign out remains unconfirmed and unchanged |

---

## UI Considerations

Applicable state considerations resolved: 12 covered, 2 backstop, 1 unresolved.

| Category | Element(s) | Status | Resolution / Reason |
|----------|------------|--------|---------------------|
| empty | Notification host (list-collection, zero active messages) | ✅ covered | Renders nothing — identical to today's `ToastHost.vue` when `toasts.value === []`; no empty-state markup needed for a passive overlay |
| populated | Notification host (list-collection, mixed severities + lifetimes) | ✅ covered | Sticky items render first (top of stack), transient toasts follow in push order; both card shapes coexist in one list |
| long-text | Notification message/body (static-content) | ✅ covered | Existing responsive container (`inset-x-4` full-width mobile / `sm:max-w-sm` desktop) already wraps long text; unchanged |
| overflow | Notification host at high simultaneous-message count | ⚠ unresolved | No visual cap on stack height this phase (matches the explicit anti-feature "no notification history/log" — a bounded, low-probability edge case on a very small viewport with many simultaneous stickies is accepted, not solved) |
| zero-one-many | Notification host, severities mixed | ✅ covered | Same list rendering regardless of count/severity mix; no special-casing needed |
| race condition | Sticky notification: manual dismiss vs. programmatic `clearSticky` at the same moment | ✅ covered | `dismiss()`'s existing idempotent filter-of-absent-id behavior (`toasts.ts:31-37`) makes either order harmless — carries forward unchanged |
| empty | Church switcher (single-org user) | ✅ covered | Renders nothing — the existing static block, unchanged (explicit decision, not a rendered empty state) |
| loading | Church switcher row (mid-`selectOrg()`) | ✅ covered | Clicked row disables + shows a spinner in place of its role badge; other rows stay interactive |
| error | Church switcher (`selectOrg()` throws) | 🧪 backstop | Surfaced via the new notification store (`error` severity); held as backstop since this is the first consumer of the new store from outside Run/Monitor-Setup — a wired test should assert the toast actually fires, not assume parity |
| populated | Church switcher list (2-5 churches, typical) | ✅ covered | Flat list, no scroll needed at typical volumes |
| overflow | Church switcher list (many churches) | 🧪 backstop | `max-h-64 overflow-y-auto` — new pattern, no existing precedent for a scrolling menu in this app; needs a real test at high membership count |
| zero-one-many | Role badge per church | ✅ covered | Exactly one role per membership (auth model has one role per org) — no multi-badge case exists |
| partial | Church switcher — deactivated church in the list | ✅ covered | Disabled + `(deactivated)` suffix, non-selectable — reuses `SelectChurchView.vue:36` verbatim |
| long-text | Church name in switcher row | ✅ covered | `truncate` class, matching `SelectChurchView.vue:34` |

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|--------------|
| shadcn official | none | not applicable — shadcn not initialized (Vue project, established hand-rolled Tailwind system) |
| third-party | none | not applicable |

---

## Checker Sign-Off

- [ ] Dimension 1 Copywriting: PASS
- [ ] Dimension 2 Visuals: PASS
- [ ] Dimension 3 Color: PASS
- [ ] Dimension 4 Typography: PASS
- [ ] Dimension 5 Spacing: PASS
- [ ] Dimension 6 Registry Safety: PASS

**Approval:** pending
