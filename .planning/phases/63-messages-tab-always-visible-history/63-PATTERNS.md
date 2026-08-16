# Phase 63: Messages Tab & Always-Visible History - Pattern Map

**Mapped:** 2026-08-15
**Files analyzed:** 2 (1 modified source + 1 modified test)
**Analogs found:** 6 / 6 (all in-file — this is a self-referential restructure)

## File Classification

| Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---------------|------|-----------|----------------|---------------|
| `src/views/ServiceEditorView.vue` | component (view) | request-response (tabbed UI state) | itself — the Roles tab button/panel + service-order panel | exact (in-file) |
| `src/views/__tests__/ServiceEditorView.test.ts` | test | request-response | itself — Roles tab-switch tests + messaging/history mount tests | exact (in-file) |

All analogs are **inside the same file** being edited. This is a UI restructure that copies established in-file idioms; there is no external analog to import.

---

## Pattern Assignments

### Change 1 — New "Messages" tab button (`src/views/ServiceEditorView.vue`)

**Analog:** the **Roles** tab button, `ServiceEditorView.vue:721-731` (editor-only), styled identically to the Service Order button (`:699-705`) and Slides button (`:711-720`).

**Copy-vs-change:** COPY the Roles button markup verbatim, swap the literal `'roles'` → `'messages'`, the label `Roles` → `Messages`, and widen the `v-if` gate. Append it **after** the Roles button (before the closing `</div>` at `:732`) so tab order is Service Order · Slides · Roles · Messages.

Roles button to mirror (`:721-731`):
```html
<button
  v-if="authStore.isEditor"
  type="button"
  class="px-4 py-2 text-sm font-medium rounded-t-md transition-colors -mb-px border-b-2"
  :class="activeTab === 'roles'
    ? 'text-indigo-300 border-indigo-500 bg-gray-900'
    : 'text-gray-400 border-transparent hover:text-gray-200 hover:border-gray-600'"
  @click="activeTab = 'roles'"
>
  Roles
</button>
```

New button = same three parts changed:
- `:class` active expr → `activeTab === 'messages'`
- `@click` → `activeTab = 'messages'`
- gate → `v-if="authStore.isEditor && isMessagingEnabled()"` (Roles' `isEditor` gating **plus** the messaging kill-switch — `isMessagingEnabled()` is the same gate the history mount uses at `:909`).

**Trap:** the button must be hidden for viewers (keep `authStore.isEditor`) AND when messaging is off (add `isMessagingEnabled()`). Do not gate on `canEditService` — a locked editor must still see the tab.

---

### Change 2 — New `v-show="activeTab === 'messages'"` panel

**Analog:** the Roles panel wrapper `ServiceEditorView.vue:1398` (`<div v-show="activeTab === 'roles'">` … closes at `:1395`? — the roles block runs `:1398-1476`) and the service-order panel opener `:734` (`<div v-show="activeTab === 'service-order'" data-testid="service-order-panel">`). The Slides panel `:1485` is the same idiom.

**Copy-vs-change:** COPY the `<div v-show="activeTab === 'roles'">` wrapper shape, swap `'roles'` → `'messages'`. Place the new panel `<div>` adjacent to the other panels (e.g. after the Slides panel closes, or after Roles). Give it a `data-testid` (e.g. `messages-panel`) mirroring `service-order-panel`'s testid convention at `:734`. Inside, stack the two moved blocks (defaults on top, history below) per their current vertical order.

**Trap:** panels use `v-show` (kept mounted), not `v-if`. Match that so the moved messaging-defaults selects keep their state across tab switches, consistent with the sibling panels.

---

### Change 3 — MOVE the messaging-defaults panel + `ServiceMessageHistory` into the new panel

**Source blocks (pure MOVES, cut from the service-order panel):**
- Messaging-defaults panel: `ServiceEditorView.vue:838-902` (`data-testid="messaging-defaults-panel"` opens `:844`, closes `:902`). Includes the Draft-editable `<template v-if="canEditService">` branch (`:848-887`), the locked-read-only `<p v-else-if="authStore.isEditor && isLocked">` (`:892-894`), the viewer `<p v-else>` (`:896-898`), and the save-error line (`:901`).
- History mount: `ServiceEditorView.vue:904-918` (`<ServiceMessageHistory … />`).

**Copy-vs-change:** CUT both blocks out of the `service-order` panel (which opens at `:734`) and PASTE them, in the same order, inside the new `activeTab === 'messages'` panel. **Behavior byte-for-byte unchanged** except Change 4 below. The `mb-3` / `mt-3` spacing and all `data-testid`s carry over unchanged.

**Trap:** these are moves, not rewrites. Do not touch the internal `canEditService` / `isLocked` branch logic of the defaults panel (that Draft-editable vs locked-read-only structure is the shipped 58-05/62 behavior). The ONLY logic edit is on the history's mount gate (Change 4) — do not accidentally drop the history's `mt-3`, its `data-testid="service-message-history"`, or any of its bound props (`:messages`, `:recipients-by-message`, `:loading`, `:error`) / events (`@new-message`, `@expand`) when relocating.

---

### Change 4 — R150 gate fix on the history mount (`ServiceEditorView.vue:909`)

**Line to change (`:908-909`):**
```html
<ServiceMessageHistory
  v-if="isMessagingEnabled() && canEditService"
```
→ drop `canEditService`:
```html
<ServiceMessageHistory
  v-if="isMessagingEnabled() && authStore.isEditor"
```

`canEditService` is defined at `ServiceEditorView.vue:1951` as `computed(() => authStore.isEditor && !isLocked.value)`, and `isLocked` at `:1949` (`status !== 'draft'`). So `canEditService` collapses the history the moment the service leaves draft — the R150 defect. Gating on `authStore.isEditor` (or, since the new tab already gates `isEditor && isMessagingEnabled()`, rendering unconditionally / with a defensive `isMessagingEnabled()`) keeps it visible on locked services. It is read-only (Phase 60), so showing it while locked is safe.

**Trap:** this gate fix is the whole point of the phase — do not let the relocation (Change 3) silently re-introduce `canEditService`. Because the parent tab already enforces `isEditor && isMessagingEnabled()`, the inner `v-if` could be reduced further, but must NOT be widened to include a lock term.

---

### Change 5 — `activeTab` type union (`ServiceEditorView.vue:1649`)

**Line:**
```ts
const activeTab = ref<'service-order' | 'roles' | 'slides'>('service-order')
```
**Change:** add `| 'messages'` →
```ts
const activeTab = ref<'service-order' | 'roles' | 'slides' | 'messages'>('service-order')
```

**Trap (hard fail):** if the union is not widened, every `activeTab === 'messages'` / `activeTab = 'messages'` (Changes 1–2) is a `TS2367`/assignment error. Also note `buildActionBarItems(activeTab.value, …)` at `:2399` receives `activeTab.value` — verify its signature accepts the widened union (check `buildActionBarItems`' param type; may need `'messages'` added there too). Use `npm run type-check` (vue-tsc --build) as the gate per CLAUDE.md — the narrower `-p tsconfig.app.json` form will not catch test-file fallout.

---

### Change 6 — Tests (`src/views/__tests__/ServiceEditorView.test.ts`)

**Analog A — tab-switch pattern** (`:1516-1518`, repeated at `:1545`, `:1566`, `:1575`, `:6520`):
```ts
const rolesTabBtn = wrapper.findAll('button').find((b) => b.text() === 'Roles')
expect(rolesTabBtn?.exists()).toBe(true)
await rolesTabBtn!.trigger('click')
// …assert panel content now visible
```
Viewer-hidden assertion analog (`:1566-1567`, `:3999-4001`):
```ts
const rolesTabBtn = wrapper.findAll('button').find((b) => b.text() === 'Roles')
expect(rolesTabBtn).toBeUndefined()
```

**Analog B — messaging-defaults + history mount assertions** (`describe` at `:8239`, mount helper `:8240-8258`, `beforeEach` `:8260-8270`, cases `:8272-8299`):
```ts
expect(wrapper.find('[data-testid="service-message-history"]').exists()).toBe(true)
expect(wrapper.find('[data-testid="messaging-defaults-panel"]').exists()).toBe(true)
// messaging OFF → false; non-editor → false
```
Messaging-defaults locked/viewer read-only cases: `:8201-8216`.

**Copy-vs-change:**
- COPY the Roles tab-switch idiom, swap `'Roles'` → `'Messages'`, to assert the Messages tab button exists for an editor+messaging-on, is `undefined` for a viewer, and is `undefined` when messaging is off.
- The existing mount tests at `:8272` / `:8226` currently find the panels on the **default** (`service-order`) tab with no click. After the move, they must **first click the Messages tab** (Analog A) before asserting `messaging-defaults-panel` / `service-message-history` presence — otherwise `v-show` keeps them in DOM (so a bare `.exists()` may still pass), but the panels have moved out of `service-order-panel`. Update these blocks to click Messages first, and their comment headers (`:8232-8238` "Service Order tab mounts…") to say Messages tab.
- **New R150 test (the point of the phase):** add a case that mounts a **locked** service (`status: 'planned'`, per the `:8201` helper), clicks the Messages tab, and asserts `service-message-history` **still exists** — the regression guard that `canEditService` is gone.

**Trap:** with `v-show` panels, `.exists()` is true regardless of active tab, so tests that mean "visible on the Messages tab" should either click the tab and assert content, or assert `isVisible()`. The viewer/messaging-off cases correctly still assert the *history* `v-if` (`:8284`, `:8292`) resolves false — keep those, but re-point the ON case to click Messages.

---

## Shared Patterns

### Tab button + panel idiom
**Source:** `ServiceEditorView.vue:696-731` (buttons) and `:734`, `:1398`, `:1485` (panels).
**Apply to:** the new Messages button + panel. Each button carries its own full class string + `:class` active-state ternary + `@click="activeTab = X"`; each panel is `<div v-show="activeTab === X">`.

### Messaging kill-switch gate
**Source:** `isMessagingEnabled()` from `src/utils/messaging.ts`, used at `ServiceEditorView.vue:909`.
**Apply to:** the Messages tab button `v-if` (and optionally a defensive guard inside the panel).

### Editor gating
**Source:** `authStore.isEditor` (Roles button `:722`) and `canEditService` computed (`:1951` = `isEditor && !isLocked`).
**Apply to:** tab button uses `isEditor` (lock-independent); R150 fix drops `canEditService` from the history. Distinguishing these two is the core of the phase.

---

## No Analog Found

None. Every change maps 1:1 to an existing in-file idiom.

---

## Metadata

**Analog search scope:** `src/views/ServiceEditorView.vue`, `src/views/__tests__/ServiceEditorView.test.ts` (self-referential restructure — CONTEXT explicitly scopes to one file + its test).
**Files scanned:** 2
**Pattern extraction date:** 2026-08-15
