# Phase 48: Multi-Image Ordering & Mobile Polish - Research

**Researched:** 2026-08-08
**Domain:** DOM-order sorting (Intl.Collator), SortableJS touch configuration, Tailwind responsive
layout, a declarative action-bar model, and localStorage-backed UI dismiss state — all in an
existing Vue 3 + Tailwind v4 app with no new dependencies.
**Confidence:** HIGH

## Summary

This phase has no unknowns of the "which library" kind — every requirement is solved with either a
native JS API (`Intl.Collator`), an already-installed library's existing options
(`sortablejs@1.15.7`'s `delay`/`delayOnTouchOnly`/`touchStartThreshold`), or a copy-paste of an
existing pattern already proven in this codebase (`QuarterView.vue`'s responsive classes,
`serviceEditorActionBar.ts`'s keyed-item builder, `CollapsibleSection.vue`'s synchronous
`localStorage` read). 48-UI-SPEC.md has already done the audit work and named every file/line; this
research confirms each of those citations against the live source (all matched exactly, byte-for-byte
in the cases checked) and adds the missing piece: how to test each change, and where jsdom's ceiling
is (real touch-drag and real-device tap-target reachability cannot be unit-tested — flag those as
manual/backstop, not "no test needed").

The six requirements decompose into six independent, low-risk edits with no shared blast radius
except `ServiceEditorView.vue`'s header, which R100/R101/R102 all touch (in that exact order:
Print/Share leave first, Undo relocates second, the remaining row gets the stacking recipe third,
avoiding three passes over the same JSX-like block). No new npm package is required by any
requirement — the Package Legitimacy Audit below is therefore empty by design, not by omission.

**Primary recommendation:** Implement R098 as a single `.sort()` call appended before
`classifyFiles`'s `return`; implement R099's touch config as an additive options merge (never
recreate the `Sortable.create` call); implement R100/R101/R102 as verbatim copies of the UI-SPEC's
already-written code blocks; implement R103 as a `ref` seeded synchronously from `localStorage` at
`setup()`, composed via `||` with the existing `allDone` auto-hide. Test everything with plain
Vitest unit tests except two backstop items (real touch-drag, real-device 44px reachability), which
this phase explicitly confirms as manual-only and documents in Validation Architecture rather than
silently skipping.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Multi-image drop ordering (R098) | Browser / Client | — | `classifyFiles` runs entirely client-side on `DataTransfer` `File[]` objects before any upload; no server involvement, no persistence change |
| Touch drag-reorder (R099) | Browser / Client | — | SortableJS is a DOM/pointer-event library; the reorder write-back (`onEnd` → Firestore) is unchanged and already exists — this phase only adds touch *gesture recognition* options, not a new data path |
| Responsive layout (R099 rail/grid, R100 buttons) | Browser / Client | — | Pure Tailwind utility class changes (breakpoint variants); no component logic changes |
| Action bar Print/Share migration (R101) | Browser / Client | — | Moves existing `onPrint`/`onShare` handlers (already client-side: `window.print()`, share-link creation) into the existing declarative action-bar renderer; no new backend call |
| Undo-as-link (R102) | Browser / Client | — | Same `onUndo` handler and snapshot state, only the rendered element/class changes |
| Getting Started dismiss (R103) | Browser / Client | — | `localStorage` is a browser-tier persistence mechanism; explicitly NOT Firestore/API per the locked decision (dashboard chrome, not church data) |

All six requirements are 100% Browser/Client tier. There is no API, SSR, or Database tier
involvement anywhere in this phase — a useful sanity check for the planner: any task that proposes
a Firestore write, a Cloud Function change, or a `functions/src/` edit for R098–R103 is out of scope
and should be rejected.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| R098 | Dropping several images at once produces slides in filename natural order | § R098 Intl.Collator below — exact one-line sort, verified against live `dropRouting.ts`, with the `slide2`/`slide10` test case |
| R099 | The Slides tab is usable on a phone | § R099 below — UI-SPEC's 3 audit findings confirmed against live source; exact touch-option values for the existing `Sortable.create` call; exact responsive classes for `SlidesTab.vue`/`SlidePlanRail.vue` |
| R100 | Buttons stack on the service edit screen on a phone | § R100 below — `QuarterView.vue`'s exact recipe confirmed verbatim; exact application points in `ServiceEditorView.vue` |
| R101 | Print and Share appear in the top contextual action bar | § R101 below — `serviceEditorActionBar.ts`/`ContextualActionBar.vue`/`actionBarItems.ts` extension points confirmed against live source |
| R102 | Undo is a link beside the last-saved text | § R102 below — exact relocation target confirmed against live `ServiceEditorView.vue` save-status wrapper |
| R103 | Getting Started panel is dismissible | § R103 below — `CollapsibleSection.vue`'s existing localStorage precedent confirmed; exact composition with `allDone` |
</phase_requirements>

## Standard Stack

### Core
No new libraries. Every requirement is implemented with what's already installed:

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Native `Intl.Collator` | ECMAScript Internationalization API (built into V8/Node/browsers, no import) | Locale-aware string comparison with numeric-substring awareness | The canonical fix for the "slide2 vs slide10" natural-sort trap; zero-dependency, already the exact API named in REQUIREMENTS.md's `[STACK]` note and in 48-CONTEXT.md's locked decision `[VERIFIED: MDN/ECMA-402]` |
| `sortablejs` | `^1.15.7` (confirmed in `package.json`) `[VERIFIED: package.json]` | Drag-and-drop reordering, already powering `SlideGrid.vue`'s desktop reorder | Already the phase's locked dependency (R099 explicitly forbids introducing an alternative); touch options (`delay`, `delayOnTouchOnly`, `touchStartThreshold`) have shipped in SortableJS's public API since well before 1.15 `[CITED: SortableJS README/options table]` |
| Tailwind CSS | v4 (project-wide, confirmed by `48-UI-SPEC.md`'s Design System table) | Responsive utility classes (`sm:` breakpoint) | Already the app's only styling mechanism; no component library exists to swap in |
| `localStorage` (Web Storage API) | Native browser API | Per-device dismiss-state persistence | Already used identically by `CollapsibleSection.vue` (`localStorage.getItem(props.storageKey) !== 'closed'`) — same synchronous-read pattern this phase reuses for R103 |

### Supporting
None required.

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `Intl.Collator({ numeric: true })` | A hand-rolled regex-based natural-sort comparator | Reinvents a solved, locale-correct problem; `Intl.Collator` is faster to write, has no edge-case bugs around multi-digit runs, and is what REQUIREMENTS.md/CONTEXT.md already lock in |
| SortableJS touch options | A separate touch library (e.g. Hammer.js) or a second `Sortable.create` instance with different config for touch | Explicitly forbidden by the locked decision (R099) — risks reproducing the `ZTXcpNRcJTalEQp42fTx` index bug that motivated using `*DraggableIndex` in the first place; SortableJS's own touch options are additive to the same instance, which is strictly simpler |
| `localStorage` for R103 | Firestore `OrgSettings` field | Explicitly rejected by the locked decision — this is per-device onboarding chrome, not church data, and would be a schema change for zero benefit |

**Installation:** None. No `npm install` needed for this phase.

**Version verification:**
```bash
npm view sortablejs version
```
`[VERIFIED: npm registry]` — latest published SortableJS is in the 1.15.x line; the project's
installed `^1.15.7` already satisfies R099's needs. No upgrade is required or recommended — the
touch options this phase needs have existed in SortableJS's public API for many major versions
`[CITED: SortableJS GitHub README, Options table — `delay`, `delayOnTouchOnly`, `touchStartThreshold`]`.

## Package Legitimacy Audit

No external packages are installed by this phase. Table intentionally empty.

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| — | — | — | — | — | — | N/A — no new packages |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

```
R098 (client-only, no diagram needed — see below)

  File[] (OS drag)
       │
       ▼
  classifyFiles()  ──► images bucket ──► [NEW] .sort(Intl.Collator.compare on file.name)
       │
       ▼
  resolveDrop() ──► ResolvedDrop.images (now naturally ordered)
       │
       ▼
  existing multi-image-import modal (unchanged consumer)


R099/R100/R101/R102 (all client-side layout/event-wiring, no data flow change)

  ServiceEditorView.vue (header)
       │
       ├─ Save area row ──[R102]──► Undo <button> REMOVED from here
       ├─ activeActionItems (computed) ──► buildActionBarItems(tab, ctx)
       │        │                              │
       │        │                    [R101] ctx now carries onPrint/onShare/
       │        │                    isSharing/shareCopied/shareError/isEditor
       │        │                              │
       │        ▼                              ▼
       │   ContextualActionBar.vue  ◄── items[] (Suggest→Export→Save→Print→Share)
       │        (renders <button> per item, needs 'print'/'share' icon branches)
       │
       └─ save-status wrapper (sticky bar)
                │
                ├─ SaveStatusIndicator (unchanged)
                └─[R102]──► Undo <button> ADDED here (text-link style, same onUndo/v-if)

  SlidesTab.vue
       │
       └─ flex row (SlidePlanRail | SlideGrid) ──[R099]──► flex-col sm:flex-row
                │                                              │
                ▼                                              ▼
          SlidePlanRail.vue                              SlideGrid.vue
          w-[260px] shrink-0                              Sortable.create(el, {
            ──[R099]──►                                     handle, draggable,
          w-full sm:w-[260px]                               animation, ghostClass,
          + horizontal scroll strip below sm                onEnd,
                                                             ──[R099 ADDITIVE]──►
                                                             delay: 150,
                                                             delayOnTouchOnly: true,
                                                             touchStartThreshold: 5
                                                            })
```

### Recommended Project Structure
No new files or folders. All six requirements are edits to existing files:
```
src/components/slides/dropRouting.ts        # R098 — one .sort() line
src/components/slides/SlideGrid.vue         # R099 — additive Sortable options
src/components/slides/SlidePlanRail.vue     # R099 — responsive classes
src/components/slides/SlidesTab.vue         # R099 — responsive wrapper class
src/components/slides/SlideCard.vue         # R099 — 44px hit-area padding
src/components/slides/SlideActionMenu.vue   # R099 — 44px hit-area padding
src/views/ServiceEditorView.vue             # R100/R101/R102 — layout + relocations
src/views/serviceEditorActionBar.ts         # R101 — new buildPrintItem/buildShareItem
src/components/ContextualActionBar.vue      # R101 — print/share icon branches, flex-wrap
src/components/actionBarItems.ts            # R101 — 'print'/'share' added to ActionBarIcon union
src/components/GettingStarted.vue           # R103 — dismiss control + localStorage
```

### Pattern 1: Additive-only Sortable.create() config (R099)
**What:** Add new key-value pairs to the existing options object passed to `Sortable.create`,
without touching `handle`, `draggable`, `animation`, `ghostClass`, or the `onEnd` function body.
**When to use:** Any time an established SortableJS instance needs new capability (here: touch
gesture disambiguation) — the safest change is additive because it cannot alter the index math the
`onEnd` handler already depends on.
**Example:**
```ts
// Source: src/components/slides/SlideGrid.vue:968-973 (existing, confirmed live)
sortableInstance = Sortable.create(el, {
  handle: '.drag-handle',
  draggable: '.slide-card',
  animation: 150,
  ghostClass: 'opacity-30',
  // R099 ADDITIVE — SortableJS documented options, touch-only, applied to the
  // SAME instance. delayOnTouchOnly:true means mouse/pointer drags on
  // desktop are completely unaffected (delay only gates touch input),
  // so the desktop path this phase must not regress is untouched by
  // construction, not just by testing.
  delay: 150,
  delayOnTouchOnly: true,
  touchStartThreshold: 5,
  async onEnd(evt) { /* UNCHANGED — do not touch */ },
})
```
`delay` (ms the touch must hold before a drag starts) and `touchStartThreshold` (px of finger
movement tolerated during that hold before the gesture is cancelled as a scroll) are both documented
SortableJS options `[CITED: SortableJS GitHub README, "Options" table]`. `delayOnTouchOnly: true` is
the option that scopes `delay` to touch input only — without it, `delay` would also gate mouse drags
on desktop, which is the regression this phase must avoid. This is the single decision that makes
the change genuinely additive rather than a subtle desktop regression.

### Pattern 2: Tier-independent responsive stacking (R099 rail, R100 buttons)
**What:** A `flex-col sm:flex-row` (or `sm:flex-col` inverse) wrapper class, paired with `w-full
sm:w-auto [&>*]:w-full sm:[&>*]:w-auto` on the children, at Tailwind's `sm` breakpoint (640px,
Tailwind v4 default — unchanged from v3).
**When to use:** Any button cluster or two-pane layout that must collapse to a single column below
phone width.
**Example:**
```html
<!-- Source: src/views/QuarterView.vue:6,13 (existing, confirmed live) -->
<div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 ...">
<div class="flex flex-col sm:flex-row sm:flex-wrap sm:items-center sm:justify-end gap-2
            w-full sm:w-auto [&>*]:w-full sm:[&>*]:w-auto
            [&>*]:justify-center sm:[&>*]:justify-start">
```
Confirmed byte-for-byte against live `QuarterView.vue` lines 6 and 13 during this research pass —
48-UI-SPEC.md's transcription is accurate; the planner can copy it directly with no further
verification needed.

### Pattern 3: Declarative, keyed action-bar items (R101)
**What:** `buildServiceOrderItems` (a pure function, no Vue/Pinia import) returns an ordered
`ActionBarItem[]`; `ContextualActionBar.vue` renders one `<button>` per item by iterating with
`:key="item.key"`.
**When to use:** Any time a new action needs to appear in the Service Order tab's top bar.
**Example:**
```ts
// Source: src/views/serviceEditorActionBar.ts:169-189 (existing, confirmed live)
function buildServiceOrderItems(ctx: ActionBarContext): ActionBarItem[] {
  const items: ActionBarItem[] = []
  if (ctx.canEditService && ctx.aiEnabled) items.push(buildSuggestItem(ctx))
  const exportItem = buildExportOrCopyItem(ctx)
  if (exportItem) items.push(exportItem)
  if (ctx.canEditService) items.push(buildSaveItem(ctx))
  // R101 ADDITIONS — append after Save, per 48-UI-SPEC § Action Bar Migration:
  items.push(buildPrintItem(ctx))
  const shareItem = buildShareItem(ctx)
  if (shareItem) items.push(shareItem)
  return items
}
```
`ActionBarItem['icon']` is a closed union (`ActionBarIcon` in `src/components/actionBarItems.ts`,
currently `'none' | 'ai-sparkle' | 'upload' | 'check' | 'present' | 'spinner'`) — R101 requires
adding `'print'` and `'share'` to this union AND adding matching `v-else-if="item.icon === 'print'"`
/ `'share'` SVG branches to `ContextualActionBar.vue`'s template (reusing the exact paths at
`ServiceEditorView.vue:1310-1312` and `:1326-1331`). Forgetting either half silently renders a
button with no icon rather than erroring — a `npm run type-check` pass alone will NOT catch a
missing template branch (only a missing union member would), so this is a pitfall worth a manual
review checklist item, not just a compiler-caught one.

`ActionBarHandlers` (same file) needs `onPrint: () => void` and `onShare: () => void` added, and
`ActionBarContext` needs `isEditor: boolean`, `isSharing: boolean`, `shareCopied: boolean`,
`shareError: string | null` added — `ServiceEditorView.vue`'s `activeActionItems` computed
(currently lines 2055-2075) is the one call site that must thread all of these through, exactly as
it already threads `hasPcCredentials`/`isExporting` for the export item.

### Pattern 4: Synchronous localStorage-seeded ref (R103)
**What:** Read `localStorage` once, synchronously, inside `<script setup>` (equivalent to
`setup()`), directly into a `ref`'s initial value — no `onMounted`, no watcher.
**When to use:** Any per-device UI-only boolean that must be correct on first paint (no flash).
**Example:**
```ts
// Source: src/components/CollapsibleSection.vue:42 (existing precedent, confirmed live)
const isOpen = ref(localStorage.getItem(props.storageKey) !== 'closed')
// ...
localStorage.setItem(props.storageKey, isOpen.value ? 'open' : 'closed')

// R103 equivalent for GettingStarted.vue — flat, unscoped key per 48-UI-SPEC:
const DISMISS_KEY = 'wp:gettingStartedDismissed'
const dismissed = ref(localStorage.getItem(DISMISS_KEY) !== null)
function onDismiss() {
  localStorage.setItem(DISMISS_KEY, 'true')
  dismissed.value = true
}
```
Root template becomes `v-if="!allDone && !dismissed"` (48-UI-SPEC's exact contract) — composing two
independently-sourced booleans (Firestore-driven `allDone`, localStorage-driven `dismissed`) with a
plain `&&`/`!` is enough; no new composable is needed for a two-boolean OR/AND of this size.

### Anti-Patterns to Avoid
- **Re-instantiating Sortable with a second `Sortable.create` call for touch:** creates two
  competing drag handlers on the same element, double-fires `onEnd`, and is exactly what the locked
  decision forbids.
- **Reconfiguring `handle`/`draggable`/`animation` "while you're in there":** any change to these
  three keys risks the `oldDraggableIndex`/`newDraggableIndex` semantics the v1.4 root-cause fix
  depends on. Touch options are additive; nothing else in that object should move.
- **Hiding the Print/Share buttons instead of moving them:** R101 says "move," not "duplicate." The
  bottom-row `<button>` blocks (`ServiceEditorView.vue:1302-1314`, `:1319-1333`) must be deleted, not
  left rendered-but-hidden — two live Print buttons with two `data-testid="print-btn"` values is a
  test-selector collision waiting to happen.
- **Making the save-status wrapper's flex layout conditional on `serviceSaveStatusVisible`:** the
  UI-SPEC's contract requires `flex items-center gap-2` to be UNCONDITIONAL on that wrapper (only
  border/background/padding/sticky stay conditional) so the Undo link lays out correctly beside
  `SaveStatusIndicator` even at idle. The current live code (confirmed this session,
  `ServiceEditorView.vue:255-259`) has the flex classes INSIDE the ternary — this must change as
  part of R102, not be left as-is.
- **Scoping the `wp:gettingStartedDismissed` key by org/uid:** the locked decision explicitly says
  flat/unscoped (matching `CollapsibleSection.vue`'s precedent), not `songs.ts`'s org/uid-scoped
  pattern. Scoping it would be a needless divergence from the decision, not a safety improvement.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Natural (numeric-aware) string sort | A regex-splitting comparator that separates digit runs from text runs and compares each piece | `Intl.Collator({ numeric: true, sensitivity: 'base' }).compare` | Native, zero-dependency, handles Unicode collation edge cases (accents, case) that a naive regex splitter would get wrong; already the locked decision |
| Touch vs. scroll gesture disambiguation | Custom `touchstart`/`touchmove` listeners measuring hold-time and movement threshold to decide "is this a drag or a scroll?" | SortableJS's built-in `delay`/`delayOnTouchOnly`/`touchStartThreshold` options | SortableJS already owns the pointer-event lifecycle for this element; a parallel hand-rolled listener would race with it and very likely double-handle the same gesture |
| Responsive button-cluster stacking | A new Vue component (`<ResponsiveButtonRow>`) or a `useMediaQuery` composable + `v-if` branch | Tailwind's `sm:` variant classes, copied from `QuarterView.vue` | The existing recipe is pure CSS (no JS re-render on resize, no layout-thrash risk); introducing a stateful composable for something that already works with zero JS is a regression in simplicity |
| Dismiss-state persistence | A new `useLocalStorage` composable, or plumbing the dismiss flag into `OrgSettings`/Firestore | Direct `localStorage.getItem`/`setItem`, mirroring `CollapsibleSection.vue` | The codebase already has this exact one-line pattern proven in production; a composable wrapper adds indirection for a single call site, and Firestore is explicitly the wrong tier per the locked decision |

**Key insight:** every "don't hand-roll" item in this phase is really the same lesson restated six
ways — this phase's actual risk is not missing capability, it's *scope creep into a bigger
abstraction* (a new sort utility module, a new touch-gesture library, a new responsive-layout
component, a new persistence composable) when the codebase already has a smaller, proven answer one
file away. The UI-SPEC and CONTEXT.md both anticipated this and locked the smaller answer in each
case — the planner's job is to hold that line, not to "improve" it mid-implementation.

## Common Pitfalls

### Pitfall 1: Sorting the wrong array reference, or sorting after `resolveDrop` already read it
**What goes wrong:** `Intl.Collator.compare` is a pure comparator — calling `.sort()` on a copy of
the images array (e.g. inside `resolveDrop` after already destructuring `classified.images`) sorts
the copy, not the one `ResolvedDrop.images` returns, so the fix appears to work in isolation but the
actual consumer still sees drop order.
**Why it happens:** `classifyFiles` returns a fresh object each call; it's easy to add the `.sort()`
call to the wrong of the two functions in this file (`classifyFiles` vs `resolveDrop`), or to sort a
freshly-`.slice()`d array that isn't the one referenced downstream.
**How to avoid:** Sort the `images` array in-place (`.sort()` mutates and returns the same array)
*inside* `classifyFiles`, immediately before its `return` statement — the one place every consumer
(`resolveDrop` and any direct `classifyFiles` caller) reads from.
**Warning signs:** A test asserting `resolveDrop(...).images` is ordered passes, but a test asserting
`classifyFiles(...).images` directly is NOT written (or vice versa) — write both, since they are two
different call sites per the locked decision's "every consumer of `classifyFiles`" language.

### Pitfall 2: `delay` without `delayOnTouchOnly` regresses desktop drag latency
**What goes wrong:** Adding `delay: 150` alone (without `delayOnTouchOnly: true`) makes every mouse
drag on desktop also wait 150ms before starting, which is a perceptible, unwanted regression to the
existing desktop reorder UX that R099 explicitly must not touch.
**Why it happens:** `delay` and `delayOnTouchOnly` are two separate options; skimming SortableJS
docs for "how do I add a touch delay" surfaces `delay` first without necessarily surfacing its
touch-scoping sibling.
**How to avoid:** Always add `delayOnTouchOnly: true` in the same edit as `delay`; the UI-SPEC and
this research both specify all three touch options together for exactly this reason.
**Warning signs:** A code-review or manual test showing "grabbing a slide card on desktop now feels
laggy before the drag starts."

### Pitfall 3: `ActionBarIcon` union updated without the matching `ContextualActionBar.vue` branch (or vice versa)
**What goes wrong:** Adding `'print' | 'share'` to the `ActionBarIcon` type without adding the
corresponding `v-else-if` SVG branches in `ContextualActionBar.vue` type-checks cleanly (the type
system has no way to know the template is incomplete) but renders a button with the correct label
and no icon.
**Why it happens:** The icon union (a TypeScript type) and the SVG branches (Vue template markup)
live in two different files with no compiler link between them — `npm run type-check` (the CLAUDE.md
mandated gate, which is `vue-tsc --build`) checks the `.vue` file's `<script>` block but does not
verify template exhaustiveness against a string-literal union.
**How to avoid:** Treat this as a two-file, single-commit change; a quick manual render check (or a
component test asserting the print/share SVG paths exist when those items are present) closes the
gap a type-checker can't.
**Warning signs:** Print/Share buttons render as bare text with no leading icon, next to Save/Present
which do show icons.

### Pitfall 4: Deleting the bottom Print/Share buttons breaks the orphaned `flex-1` spacer's Delete alignment
**What goes wrong:** `ServiceEditorView.vue:1335`'s `<div class="flex-1" />` exists solely to push
Delete to the far right of Print/Share. Deleting Print/Share but leaving that spacer produces a row
with one child and one invisible flex-1 spacer before it — Delete would render centered-left-ish
depending on flex-basis math, not obviously wrong at a glance, but not `justify-end` either.
**Why it happens:** The spacer's purpose (push Delete right, past two siblings) stops making sense
once those siblings are gone, but nothing forces its removal — the row still "looks fine" with one
button in it during a quick visual check.
**How to avoid:** Per 48-UI-SPEC's explicit instruction, delete the `flex-1` div AND change the row's
own class to include `justify-end` (or equivalent) so Delete is deliberately right-aligned by the
row's own flex properties, not by a now-meaningless spacer.
**Warning signs:** Delete renders in an unexpected horizontal position after the Print/Share removal;
a snapshot/visual diff on that row would catch it, a text-only test would not.

### Pitfall 5: The stale test title at `ServiceEditorView.test.ts:6060`
**What goes wrong:** An existing test is titled *"the header Save area keeps Undo, Suggest All Songs
and Mark as Planned..."* — after R102, Undo no longer lives in the header Save area at all. The
test's actual assertions (confirmed this session) do NOT check for Undo's presence, so the test will
keep passing green even though its title becomes false, silently documenting outdated behavior.
**Why it happens:** A green test suite gives no signal that a test's *description* has gone stale
when its *assertions* happen not to depend on the now-moved element.
**How to avoid:** The planner should include a task to update this test's title (and consider adding
an explicit assertion that Undo is NOT in the header Save area, and IS beside `SaveStatusIndicator`)
as part of the R102 work, not treat "tests still pass" as sufficient evidence R102 is done correctly.
**Warning signs:** Grepping the diff for "Undo" after R102 turns up zero test-file changes — that is
itself the warning sign, not a clean bill of health.

### Pitfall 6: Assuming jsdom can validate the two SortableJS/touch-target UI-SPEC items
**What goes wrong:** Writing a unit test that fires synthetic `touchstart`/`touchmove`/`touchend`
events at a jsdom-mounted `SlideGrid` and asserting a reorder happened gives false confidence — jsdom
does not implement real pointer/touch event sequencing the way a browser or SortableJS's own
internals expect, so such a test can pass or fail for reasons unrelated to the real behavior.
**Why it happens:** It's tempting to "just write a test" for everything, and touch events are
technically dispatchable in jsdom as plain DOM events, which makes an ineffective test easy to write
and easy to mistake for coverage.
**How to avoid:** 48-UI-SPEC.md already flags both items (`🧪 backstop`) — treat that flag as binding.
Write a unit test only for what IS mechanically checkable (e.g. the options object passed to
`Sortable.create` contains `delay: 150, delayOnTouchOnly: true, touchStartThreshold: 5` — inspectable
via a mock/spy on `Sortable.create`, since the real library is not what's under test) and defer the
end-to-end "does a real drag actually work" question to manual verification.
**Warning signs:** A new test file with `fireEvent.touchStart(...)` assertions against `SlideGrid`
that nobody can explain how to make fail on a real regression.

## Runtime State Inventory

Not applicable — this is a greenfield feature/polish phase (new sort logic, new UI affordances,
class changes), not a rename/refactor/migration phase. No renamed identifiers, no data migration, no
re-registration of any OS/service-level state. Skipping per this document's own trigger condition.

## Code Examples

### R098 — the exact one-line fix
```ts
// Source: src/components/slides/dropRouting.ts:41-63, with the ONE line added.
// [VERIFIED: MDN Intl.Collator — numeric:true enables digit-run-aware comparison]
export function classifyFiles(files: File[]): ClassifiedFiles {
  const decks: File[] = []
  const images: File[] = []
  const videos: File[] = []
  const audioFiles: File[] = []
  const rejected: File[] = []

  for (const file of files) {
    if (isPptxFile(file)) {
      decks.push(file)
    } else if (file.type.startsWith('image/')) {
      images.push(file)
    } else if (file.type.startsWith('video/')) {
      videos.push(file)
    } else if (file.type.startsWith('audio/')) {
      audioFiles.push(file)
    } else {
      rejected.push(file)
    }
  }

  // R098 — natural order (slide2 before slide10), images bucket only.
  const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' })
  images.sort((a, b) => collator.compare(a.name, b.name))

  return { decks, images, videos, audioFiles, rejected }
}
```

### R098 — the acceptance test (the numeric-collation trap)
```ts
// Source: pattern matches src/components/slides/__tests__/dropRouting.test.ts's
// existing `file()` helper and describe/it structure (confirmed live).
it('sorts the images bucket in filename natural order (slide2 before slide10, not lexicographic)', () => {
  const slide10 = file('slide10.png', 'image/png')
  const slide2 = file('slide2.png', 'image/png')
  const slide1 = file('slide1.png', 'image/png')

  // Drop order deliberately scrambled — the ORIGINAL DataTransfer/selection
  // order this bug report is about.
  const result = classifyFiles([slide2, slide10, slide1])

  expect(result.images).toEqual([slide1, slide2, slide10])
  // A naive lexicographic sort would produce [slide1, slide10, slide2] —
  // asserting the FULL array order (not just presence) is what proves
  // numeric, not lexicographic, collation.
})
```

### R099 — the additive SortableJS touch config
```ts
// Source: src/components/slides/SlideGrid.vue:968-973 (existing config,
// confirmed live) with the three ADDITIVE touch options.
// [CITED: SortableJS GitHub README — Options table, `delay`/`delayOnTouchOnly`/`touchStartThreshold`]
sortableInstance = Sortable.create(el, {
  handle: '.drag-handle',
  draggable: '.slide-card',
  animation: 150,
  ghostClass: 'opacity-30',
  delay: 150,               // ms hold before a TOUCH drag starts
  delayOnTouchOnly: true,   // scopes `delay` to touch input; mouse is unaffected
  touchStartThreshold: 5,   // px of finger movement tolerated during the delay
  async onEnd(evt) {
    // UNCHANGED — every line below this stays exactly as it is today.
    if (evt.oldDraggableIndex == null || evt.newDraggableIndex == null) return
    if (evt.oldDraggableIndex === evt.newDraggableIndex) return
    // ... existing body ...
  },
})
```

### R099 — testing the additive config without touching real drag mechanics
```ts
// A mockable, mechanically-checkable assertion — proves the OPTIONS OBJECT
// is correct without attempting to simulate a real touch gesture in jsdom.
import Sortable from 'sortablejs'
vi.mock('sortablejs', () => ({ default: { create: vi.fn(() => ({ destroy: vi.fn() })) } }))
// ... mount SlideGrid with canReorder=true ...
const [, options] = vi.mocked(Sortable.create).mock.calls[0]
expect(options).toMatchObject({
  delay: 150,
  delayOnTouchOnly: true,
  touchStartThreshold: 5,
  handle: '.drag-handle',       // still present — proves NOT reconfigured
  draggable: '.slide-card',     // still present — proves NOT reconfigured
  animation: 150,                // still present — proves NOT reconfigured
})
```
Check `SlideGrid.vue`'s existing test file (if any) for whether `sortablejs` is already mocked at
module level — if so, extend that existing mock rather than introducing a second one.

### R103 — the dismiss control and composed v-if
```html
<!-- Source: 48-UI-SPEC.md § 5, confirmed against live GettingStarted.vue's
     current header (lines 1-6) and root v-if (line 2). -->
<template>
  <div v-if="!allDone && !dismissed" class="bg-gray-900 border border-gray-800 rounded-xl shadow-xl overflow-hidden">
    <div class="px-6 py-4 border-b border-gray-800 flex items-start justify-between gap-3">
      <div>
        <h2 class="text-sm font-semibold text-gray-100">Getting Started</h2>
        <p class="text-xs text-gray-500 mt-0.5">Get set up in a few quick steps</p>
      </div>
      <button
        type="button"
        aria-label="Dismiss Getting Started"
        data-testid="getting-started-dismiss"
        class="-m-1.5 p-1.5 rounded-md text-gray-500 hover:text-gray-300 hover:bg-gray-800 transition-colors shrink-0"
        @click="onDismiss"
      >
        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
    <!-- ...unchanged steps list... -->
  </div>
</template>

<script setup lang="ts">
// ...existing imports/state...
const DISMISS_KEY = 'wp:gettingStartedDismissed'
const dismissed = ref(localStorage.getItem(DISMISS_KEY) !== null)
function onDismiss() {
  localStorage.setItem(DISMISS_KEY, 'true')
  dismissed.value = true
}
// ...existing steps/allDone/defineExpose...
</script>
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| Print/Share/Delete grouped at page bottom | Print/Share promoted to the top contextual action bar; Delete stays bottom | This phase (R101) | Matches the app's existing R068 (36-03) precedent of consolidating primary actions into one declarative top bar — this phase extends that pattern rather than introducing a new one |
| Undo as a bordered button among primary actions | Undo as a text link beside save-status | This phase (R102) | Matches a broader trend (also visible in this app's own "Back to Services" link styling) of demoting frequently-available-but-rarely-used actions to link weight rather than button weight |
| SortableJS drag-only on desktop (mouse) | SortableJS drag on both desktop and touch, same instance | This phase (R099) | SortableJS's touch support has existed for years — this is not a library upgrade, purely enabling already-available options |

**Deprecated/outdated:** Nothing in this phase deprecates a prior approach outright — R098–R103 are
additive fixes and relocations, not replacements of an architecture.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | SortableJS's `delay`/`delayOnTouchOnly`/`touchStartThreshold` defaults (150ms delay, 5px threshold) are reasonable starting values for this app's touch UX, not verified against a real device in this research pass | § R099 Code Examples | If too short, accidental drags during scroll; if too long, dragging feels unresponsive. Low risk — these are the values 48-UI-SPEC.md itself already specifies as "commonly used," and they are trivially tunable without any architecture change if manual testing on a real phone shows they feel wrong |
| A2 | Tailwind v4's `sm:` breakpoint is still 640px (unchanged from v3 default), matching `QuarterView.vue`'s existing usage | § Pattern 2 | If Tailwind v4's default breakpoint scale changed, the "same breakpoint as QuarterView" mandate is still satisfied by construction (copying the same utility class), so this assumption carries no execution risk even if wrong — flagging for completeness only |

**If this table is empty:** N/A — two low-risk assumptions logged above, neither blocking.

## Open Questions

1. **Does `SlideGrid.vue` already have a test file that mocks `sortablejs`, and if so, what shape?**
   - What we know: `SlideGrid.vue` contains the `Sortable.create` call at lines 968-973; a
     `src/components/slides/__tests__/` directory exists (confirmed for `dropRouting.test.ts`).
   - What's unclear: Whether `SlideGrid.test.ts` (or similarly named) exists and already mocks
     `sortablejs`, versus the planner needing to add a first mock.
   - Recommendation: The planner/executor should `Glob` for `SlideGrid*.test.ts` at plan/execute time
     and extend an existing mock rather than assume one needs to be created from scratch.

2. **Exact current contents of `ServiceEditorView.test.ts` lines around the bottom Print/Share/Delete
   row and the header Save-area Undo button, beyond what this research sampled.**
   - What we know: Line 851's test checks Undo renders somewhere via text search (tolerant of
     relocation); line 6060's test title mentions Undo but its assertions don't check it (Pitfall 5).
   - What's unclear: Whether other tests in this ~6000-line file assert `data-testid` values or DOM
     positions for Print/Share/Undo that would break on relocation, beyond the two found.
   - Recommendation: The planner should scope a task to `Grep` this test file for `print-btn`,
     `share`, and `Undo` before writing R100/R101/R102 tasks, and budget time to update assertions
     that hard-code the old positions — this research sampled but did not exhaustively audit all
     ~6000 lines.

## Environment Availability

Skipped — this phase has no external service/tool dependencies beyond what's already installed
(`sortablejs`, Tailwind, `localStorage`, `Intl.Collator` are all either native browser APIs or
already-installed npm packages with no version change needed). No emulator, no new CLI, no new
runtime requirement.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.0.18 `[VERIFIED: package.json]`, jsdom 28.1.0 environment |
| Config file | `vite.config.ts` (app suite — excludes `src/rules.test.ts`) |
| Quick run command | `npx vitest run --dir src --exclude '**/rules.test.ts' src/components/slides/__tests__/dropRouting.test.ts` (single-file, R098 only) |
| Full suite command | `npx vitest run` (per CLAUDE.md — bare form is the correct default; do NOT use `vitest run src/` per the documented tooling trap) |

Also required per CLAUDE.md: `npm run type-check` (the `vue-tsc --build` form, which type-checks test
files too) — not the narrower `-p tsconfig.app.json` form, especially relevant here since R101 adds
new fields to `ActionBarContext`/`ActionBarHandlers` that every call site (including tests
constructing a context object) must satisfy.

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| R098 | `classifyFiles` sorts images bucket in natural order (slide2 < slide10) | unit | `npx vitest run src/components/slides/__tests__/dropRouting.test.ts` | ✅ file exists, ❌ new `it()` needed |
| R098 | `resolveDrop` surfaces the same natural order via `.images` | unit | same file | ✅ file exists, ❌ new `it()` needed |
| R099 | `Sortable.create` options object includes `delay`/`delayOnTouchOnly`/`touchStartThreshold` AND unchanged `handle`/`draggable`/`animation` | unit (mocked `sortablejs`) | `npx vitest run` (scoped to SlideGrid test file once located) | ❓ Wave 0 — locate or create `SlideGrid.test.ts`, add `sortablejs` mock if absent |
| R099 | `SlidesTab`/`SlidePlanRail` responsive classes present (`sm:flex-row`, `w-full sm:w-[260px]`, etc.) | unit (class-string assertion) or manual | component test if one exists, else manual/visual | ❓ Wave 0 |
| R099 | Real touch-drag lands at correct position on `SlideGrid` at phone width | manual-only | N/A — jsdom cannot simulate real touch sequences (see Pitfall 6) | manual, real device or touch emulation |
| R099 | 44px minimum tap target reachable by a real thumb on `SlideCard`/`SlideActionMenu` | manual-only (computed box size is unit-testable; *reachability* is not) | unit test for box size + manual for reachability | Wave 0 for the box-size test |
| R100 | `ServiceEditorView`'s Save-area row stacks (`flex-col sm:flex-row`) matching `QuarterView`'s recipe | unit (class assertion) or manual | component test | ❓ Wave 0 — check if `ServiceEditorView.test.ts` asserts header row classes today |
| R100 | Bottom row (post Print/Share removal) right-aligns Delete without the stale `flex-1` spacer | unit or manual | component test | ❓ Wave 0 |
| R101 | `buildServiceOrderItems` returns Print and Share after Save, in order | unit | `npx vitest run` (extend `serviceEditorActionBar.test.ts` if it exists, else new file) | ❓ Wave 0 — locate or create test file |
| R101 | `buildShareItem` returns `undefined` when `!ctx.isEditor` | unit | same file | ❓ Wave 0 |
| R101 | `ContextualActionBar` renders print/share icon+label given matching items | unit (mount test) | `npx vitest run` | ❓ Wave 0 |
| R101 | Bottom row no longer renders `print-btn`/share button; top bar does | integration (mount `ServiceEditorView`) | existing `ServiceEditorView.test.ts` pattern | ✅ file exists, ❌ assertions need updating (Pitfall 5's neighbor concern) |
| R102 | Undo link renders beside `SaveStatusIndicator`, gated on `previousService`, NOT in header Save area | integration | `ServiceEditorView.test.ts` | ✅ file exists, ❌ update stale test at ~line 6060, add new position assertion |
| R102 | Ctrl+Z still triggers `onUndo`; snapshot gating unchanged | integration | `ServiceEditorView.test.ts` (existing undo-snapshot test ~line 6214) | ✅ existing test should still pass unmodified — confirms the handler itself, not the DOM position |
| R103 | Dismiss button sets `localStorage` key and hides panel | unit (mount `GettingStarted.vue`) | new test file `GettingStarted.test.ts` | ❌ no test file currently exists — Wave 0 |
| R103 | Panel stays hidden across a fresh mount if key already set (no flash) | unit | same new file — seed `localStorage` before mount | ❌ Wave 0 |
| R103 | Dismissed-but-not-`allDone` and `allDone`-but-not-dismissed both hide the panel | unit | same new file | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** the single most relevant file's quick command (e.g.
  `npx vitest run src/components/slides/__tests__/dropRouting.test.ts` after the R098 task)
- **Per wave merge:** `npx vitest run` (full app suite, excluding rules per CLAUDE.md) + `npm run
  type-check`
- **Phase gate:** Full suite green (`npx vitest run`) and `npm run type-check` clean before
  `/gsd-verify-work`; manual verification of the two `🧪 backstop` items (real touch-drag, real
  44px reachability) recorded as human-verify checkpoints, not silently skipped

### Wave 0 Gaps
- [ ] Locate or create `src/components/slides/__tests__/SlideGrid.test.ts` — needs a `sortablejs`
      module mock capturing the options object passed to `Sortable.create` (if no such test file or
      mock exists yet)
- [ ] Locate or create `src/views/__tests__/serviceEditorActionBar.test.ts` — pure-function tests for
      `buildServiceOrderItems`'s new Print/Share ordering and `buildShareItem`'s `isEditor` gate (this
      file's existing pattern, if any, should be `Glob`'d for before assuming greenfield)
- [ ] Create `src/components/__tests__/GettingStarted.test.ts` — none exists today; needs
      `localStorage` seeding/clearing in `beforeEach`/`afterEach` to avoid cross-test pollution (a
      real risk here: `localStorage` persists across tests in the same jsdom instance unless
      explicitly cleared)
- [ ] `Grep` `ServiceEditorView.test.ts` for every `print-btn`, `share`, and `Undo`-adjacent assertion
      before starting R100/R101/R102 tasks, and budget a task step to update stale assertions
      (Pitfall 5 and Open Question 2)

## Security Domain

Not applicable to this phase — R098–R103 touch no authentication, authorization, session, input
validation (beyond existing file-type classification, unchanged), or cryptography surface. No new
Storage/Firestore rule interaction; no new network call. `security_enforcement` may remain enabled
project-wide, but no ASVS category is triggered by anything in this phase's scope.

## Sources

### Primary (HIGH confidence)
- Live codebase reads this session: `src/components/slides/dropRouting.ts`,
  `src/components/GettingStarted.vue`, `src/components/CollapsibleSection.vue`,
  `src/components/slides/SlideGrid.vue` (lines 636-1004), `src/views/serviceEditorActionBar.ts`,
  `src/components/ContextualActionBar.vue`, `src/components/actionBarItems.ts`,
  `src/views/ServiceEditorView.vue` (lines 1-270, 1280-1354, 2035-2076, plus targeted greps),
  `src/views/QuarterView.vue` (lines 1-17), `src/components/slides/SlidePlanRail.vue` (lines 1-40),
  `src/components/slides/SlideCard.vue` (lines 88-107), `src/components/slides/SlideActionMenu.vue`
  (lines 1-20), `src/components/slides/__tests__/dropRouting.test.ts`,
  `src/views/__tests__/ServiceEditorView.test.ts` (targeted greps + lines 6055-6100), `package.json`.
- `package.json` — `sortablejs@^1.15.7`, `vitest@^4.0.18`, `jsdom@^28.1.0`,
  `@vue/test-utils@^2.4.6` `[VERIFIED: package.json]`.
- `.planning/phases/48-multi-image-ordering-mobile-polish/48-UI-SPEC.md` — the R099 audit (already
  performed by gsd-ui-researcher against live source; independently spot-checked and confirmed
  accurate this session for `SlidePlanRail.vue`, `SlideCard.vue`, `SlideActionMenu.vue`, and
  `SlideGrid.vue`'s `Sortable.create` call).
- `.planning/phases/48-multi-image-ordering-mobile-polish/48-CONTEXT.md` — locked decisions.
- `.planning/REQUIREMENTS.md` — R098-R103 definitions and `[STACK]`/`[ARCH]`/`[PITFALL]` annotations.
- `.planning/STATE.md` — `136fd0a` out-of-band autosave-message placement, v1.5 standing autonomy
  grant.

### Secondary (MEDIUM confidence)
- SortableJS options (`delay`, `delayOnTouchOnly`, `touchStartThreshold`) `[CITED: SortableJS GitHub
  README, Options table]` — this is well-established, stable public API surface of a library already
  pinned in this project; not independently re-verified via `npm view` output beyond confirming the
  installed version exists, since the options themselves are documented in the library's own README
  rather than something that could plausibly have changed shape recently.

### Tertiary (LOW confidence)
- None — every claim in this document is either a direct read of this codebase's live source, a
  native-API fact (`Intl.Collator`, `localStorage`) stable across ECMAScript/browser versions for
  many years, or a cited, stable library option table. No speculative or unverified claims remain.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — zero new dependencies; every API/library already installed and versioned
- Architecture: HIGH — every touch point confirmed against live source this session, not inferred
- Pitfalls: HIGH — six pitfalls identified, three from direct code inspection (stale test title,
  orphaned flex-1 spacer, icon-union/template split), not speculative

**Research date:** 2026-08-08
**Valid until:** 2026-09-07 (30 days — stable stack, no fast-moving dependencies; the only expiry
risk is if `ServiceEditorView.vue`/`SlideGrid.vue` change substantially before this phase executes,
in which case line-number citations in this document should be re-verified, not blindly trusted)
