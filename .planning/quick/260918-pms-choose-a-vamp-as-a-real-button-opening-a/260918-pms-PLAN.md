---
phase: quick-260918-pms
quick_id: 260918-pms
slug: add-a-vamp-button-slide-over
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/components/VampPickerSlideOver.vue
  - src/components/__tests__/VampPickerSlideOver.test.ts
  - src/components/slides/SlideGroupMusicControl.vue
  - src/components/slides/__tests__/SlideGroupMusicControl.test.ts
autonomous: true
requirements: [R437]

must_haves:
  truths:
    - "On the Slides-tab group media panel, in BOTH the no-bed state and the uploaded-file state, the vamp affordance is a real `<button type=\"button\">` reading exactly `+ Add a vamp for this group` (ASCII plus) whose class list is byte-identical to the `＋ Add music for this group` label / `+ Add background for this group` button (`inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-gray-700 px-2.5 py-1.5 text-xs font-medium text-gray-300 transition-colors hover:bg-gray-800`), still carrying `data-testid=\"group-music-choose-vamp\"`."
    - "Clicking that button (or `Change` in the assigned-vamp state, whose small-action styling is unchanged) opens a right-hand slide-over that reuses the app's established shell — Teleport to body, `fixed inset-0 z-40 bg-black/30` backdrop, `fixed inset-y-0 right-0 z-50 w-full max-w-[480px] bg-gray-900 border-l border-gray-800 shadow-2xl flex flex-col` panel, `px-5 py-4 border-b border-gray-800` header with the title `Choose a vamp` and the × Close button — and hosts `VampPicker` unchanged in its scrolling body. Nothing renders inline below the control any more."
    - "Escape, a backdrop click, the header ×, and VampPicker's own Cancel all close the slide-over with no emit; selecting a vamp row emits `attach-vamp(vamp)` exactly as today and closes it. SlideGrid's `onAttachGroupVamp` write path, EditSlideDrawer, VampPicker, rules and functions are untouched."
    - "A viewer (isEditor false) never sees the button, Change, or the slide-over."
  artifacts:
    - src/components/VampPickerSlideOver.vue
    - src/components/__tests__/VampPickerSlideOver.test.ts
    - src/components/slides/SlideGroupMusicControl.vue
    - src/components/slides/__tests__/SlideGroupMusicControl.test.ts
  key_links:
    - "SlideGroupMusicControl `vampPickerOpen` ref → `<VampPickerSlideOver :open=\"vampPickerOpen && isEditor\">` → `@select=\"onVampSelected\"` (emits `attach-vamp`, then `closeVampPicker`) / `@close=\"closeVampPicker\"`. The control's props/emits (`attach`, `remove`, `attach-vamp`) are unchanged, so SlideGrid.vue and SlideGrid.test.ts need no edits."
    - "VampPickerSlideOver hosts `<VampPicker :vamps :loading :selected-vamp-id @select @cancel>`; `cancel` → emit `close`; `select` → emit `select(vamp)` only (the parent owns `open` and closes it)."
    - "Escape: `watch(() => props.open, immediate)` adds/removes a `window` keydown listener (mirrors EditSlideDrawer lines 631-662, minus the unsaved-guard/focus bookkeeping); `onUnmounted` removes it."
---

<objective>
UX correction to quick task 260918-nm2 (owner, 2026-09-18, during prod UAT — "We need consistent UX"): on the
Slides-tab group media panel the vamp affordance must be a real button, styled and worded like its neighbours
(`＋ Add music for this group` / `+ Add background for this group`), reading exactly `+ Add a vamp for this group`,
and clicking it must open the vamp picker in the app's standard slide-over rather than inline below the panel.

Purpose: one consistent affordance row and one consistent picker surface on the group media panel.
Output: a small dedicated `VampPickerSlideOver.vue` (the app's slide-over shell wrapping `VampPicker`), the
control's two text links replaced by the neighbour-styled button, the inline picker replaced by the slide-over,
updated control tests plus a new slide-over test file. TDD (RED then GREEN commits, tag `260918-pms`).
</objective>

<execution_context>
@$HOME/.claude/gsd-core/workflows/execute-plan.md
@$HOME/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@./CLAUDE.md
@.planning/quick/260918-nm2-group-level-vamp-bed-choose-a-vamp-on-th/260918-nm2-SUMMARY.md
@src/components/slides/SlideGroupMusicControl.vue
@src/components/VampPicker.vue
@src/components/RoleSlideOver.vue
</context>

## Design (locked by the owner/orchestrator — implement exactly)

1. **Button, not link (design point 1 + owner copy update).** In the no-bed state AND the uploaded-file
   state, the affordance is `<button type="button" data-testid="group-music-choose-vamp">` with the label
   `+ Add a vamp for this group` — ASCII `+` U+002B, then a single space. This is the owner's literal copy and
   matches the `+ Add background for this group` / congregational buttons in SlideGrid.vue (lines 213, 232);
   the music label's fullwidth `&#65291;` is a pre-existing glyph inconsistency — leave it alone, do not
   "harmonise" it. Class string copied VERBATIM from the `group-music-add` label (SlideGroupMusicControl.vue
   line 83): `inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-gray-700 px-2.5 py-1.5
   text-xs font-medium text-gray-300 transition-colors hover:bg-gray-800`. In the assigned-vamp state,
   `Change` (`group-music-vamp-change`) keeps its current `text-xs font-medium text-indigo-400
   hover:text-indigo-300 shrink-0` styling and now opens the slide-over.
2. **Slide-over, not inline (design point 2).** New dedicated component `src/components/VampPickerSlideOver.vue`
   (every slide-over in this app is a dedicated component that inlines the shell — there is no shared wrapper;
   `src/components/` is where `RoleSlideOver.vue` / `VampSlideOver.vue` / `VampPicker.vue` live). Shell =
   RoleSlideOver.vue lines 1-63 (dismissing backdrop + panel + header + ×), header content = title + × only
   (no Cancel/Save buttons — VampPicker has its own Cancel in the body). **Overlay title: `Choose a vamp`**
   (chosen over "Add a vamp for this group" so the component stays group-agnostic and matches the per-slide
   wording in EditSlideDrawer). Escape closes (EditSlideDrawer's window-keydown pattern). Body =
   `<VampPicker>` unchanged.
3. **No behavioural change elsewhere (design point 3).** SlideGroupMusicControl props/emits unchanged;
   SlideGrid.vue, SlideGrid.test.ts, EditSlideDrawer.vue, VampPicker.vue, rules, functions, deps untouched.
4. **TDD (design point 4).** Per task: RED commit `test(260918-pms): …` then GREEN `feat(260918-pms): …`.
   Teleported markup is asserted the way VampSlideOver.test.ts (lines 64-74) / RoleSlideOver.test.ts (line 38)
   / SongSlideOver.test.ts do it: `global: { stubs: { Teleport: { template: '<div><slot /></div>' } } }` —
   this IS the established convention in this repo (not `attachTo: document.body`), so use it.
5. **Gates (design point 5).** Per task `npx vitest run <touched test files>`; plan-final `npm run type-check`
   (vue-tsc --build — NOT `-p tsconfig.app.json`). Do NOT run the bare full `npx vitest run` (~9 min; the
   orchestrator does). Do NOT deploy.
6. Comments short (CLAUDE.md convention); a one-line `260918-pms —` tag where the prior task's `260918-nm2 —`
   tags sit is enough. No new dependencies.

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: VampPickerSlideOver — the app's slide-over shell hosting VampPicker</name>
  <files>src/components/VampPickerSlideOver.vue, src/components/__tests__/VampPickerSlideOver.test.ts</files>
  <read_first>
    - src/components/RoleSlideOver.vue lines 1-63 (the shell to mirror: Teleport, backdrop Transition classes + `@click="onCancel"` dismiss, panel Transition classes, panel class string, header `flex items-center justify-between gap-3 px-5 py-4 border-b border-gray-800 shrink-0`, the × button `p-1.5 rounded-md text-gray-500 hover:text-gray-300 hover:bg-gray-800 transition-colors` with `aria-label="Close"` and its SVG)
    - src/components/VampSlideOver.vue lines 66-68 (body wrapper `flex-1 overflow-y-auto px-5 py-5`)
    - src/components/slides/EditSlideDrawer.vue lines 631-662 (Escape: `onKeydown` checks `event.key === 'Escape'`; `watch(open, immediate)` adds the `window` keydown listener when opening and removes it when closing; `onUnmounted` removes it)
    - src/components/VampPicker.vue lines 116-130 (props `vamps: Vamp[]`, `loading?: boolean`, `selectedVampId?: string | null`; emits `select: [vamp]`, `cancel: []`; testids `vamp-picker-panel`, `vamp-picker-cancel`, `vamp-picker-row`)
    - src/components/__tests__/VampSlideOver.test.ts lines 46-74 (`makeVamp` fixture shape and the Teleport-stub mount helper to copy)
    - src/components/slides/__tests__/EditSlideDrawer.test.ts lines 371-392 (how Escape is dispatched: `window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))`, and the unmount-does-not-throw idiom)
  </read_first>
  <behavior>
    Mount with `global.stubs.Teleport = { template: '<div><slot /></div>' }` and a `makeVamp` fixture (attachment with a downloadUrl so its row is selectable; a second vamp with `attachment: null` for the disabled row).
    - `open: false` → no `[data-testid="vamp-picker-slide-over"]`, no `[data-testid="vamp-picker-slide-over-backdrop"]`, `findComponent(VampPicker).exists()` is false.
    - `open: true` → `[data-testid="vamp-picker-slide-over"]` exists; `[data-testid="vamp-picker-slide-over-title"]` text is `Choose a vamp`; `[data-testid="vamp-picker-slide-over-close"]` has `aria-label="Close"`; `findComponent(VampPicker)` exists with `props('vamps')` equal to the passed list, `props('loading')` equal to the passed `loading`, `props('selectedVampId')` equal to the passed `selectedVampId`; `[data-testid="vamp-picker-panel"]` is a DOM descendant of `[data-testid="vamp-picker-slide-over"]` (the picker is hosted in the body, not beside the panel).
    - Clicking `[data-testid="vamp-picker-row"]` (or `findComponent(VampPicker).vm.$emit('select', vamp)`) → `emitted('select')` equals `[[vamp]]` and `emitted('close')` is undefined (the parent owns `open`).
    - `findComponent(VampPicker).vm.$emit('cancel')` → `emitted('close')` equals `[[]]`, no `select`.
    - Clicking `[data-testid="vamp-picker-slide-over-close"]` → `emitted('close')` equals `[[]]`.
    - Clicking `[data-testid="vamp-picker-slide-over-backdrop"]` → `emitted('close')` equals `[[]]`.
    - `window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))` while `open: true` → `emitted('close')` equals `[[]]`; a non-Escape key (e.g. `Enter`) emits nothing.
    - After `setProps({ open: false })`, an Escape keydown emits nothing further (listener removed on close).
    - After `wrapper.unmount()`, dispatching Escape on `window` does not throw and nothing is emitted (listener removed on unmount).
  </behavior>
  <action>
    RED: write `src/components/__tests__/VampPickerSlideOver.test.ts` covering every bullet above (import the component from `@/components/VampPickerSlideOver.vue` and `VampPicker` from `@/components/VampPicker.vue`; no Pinia, no store mocks — the component is props-only). Run it; it fails (module missing). Commit `test(260918-pms): failing tests — VampPickerSlideOver open/close/select pass-through`.

    GREEN: create `src/components/VampPickerSlideOver.vue` (`<script setup lang="ts">`):
    - Props: `open: boolean`, `vamps: Vamp[]`, `loading?: boolean`, `selectedVampId?: string | null` (import `Vamp` from `@/types/vamp`). Emits: `select: [vamp: Vamp]`, `close: []`.
    - Template: `<Teleport to="body">`; backdrop `<Transition>` with RoleSlideOver's exact enter/leave classes wrapping `<div v-if="open" class="fixed inset-0 z-40 bg-black/30" data-testid="vamp-picker-slide-over-backdrop" @click="emit('close')">`; panel `<Transition>` with RoleSlideOver's exact classes wrapping `<div v-if="open" class="fixed inset-y-0 right-0 z-50 w-full max-w-[480px] bg-gray-900 border-l border-gray-800 shadow-2xl flex flex-col" data-testid="vamp-picker-slide-over">`.
    - Header: `<div class="flex items-center justify-between gap-3 px-5 py-4 border-b border-gray-800 shrink-0">` containing `<h2 class="text-base font-semibold text-gray-100" data-testid="vamp-picker-slide-over-title">Choose a vamp</h2>` and the × button copied from RoleSlideOver (same class string, `aria-label="Close"`, same SVG) with `data-testid="vamp-picker-slide-over-close"` and `@click="emit('close')"`.
    - Body: `<div class="flex-1 overflow-y-auto px-5 py-5">` hosting `<VampPicker :vamps="vamps" :loading="loading" :selected-vamp-id="selectedVampId ?? null" @select="(vamp) => emit('select', vamp)" @cancel="emit('close')" />`. VampPicker itself is NOT modified (its `mt-2` root margin and `max-h-56` list are accepted as-is per design point 2).
    - Escape: `function onKeydown(event: KeyboardEvent)` emits `close` when `event.key === 'Escape'`; `watch(() => props.open, (isOpen) => { isOpen ? window.addEventListener('keydown', onKeydown) : window.removeEventListener('keydown', onKeydown) }, { immediate: true })`; `onUnmounted(() => window.removeEventListener('keydown', onKeydown))`. No focus management, no `role="dialog"` (parity with the other shells).
    - One short head comment naming the precedent (RoleSlideOver shell + EditSlideDrawer Escape) — no long narration.
    Run the test file; all green. Commit `feat(260918-pms): VampPickerSlideOver — slide-over shell hosting VampPicker`.
  </action>
  <verify>
    <automated>npx vitest run src/components/__tests__/VampPickerSlideOver.test.ts</automated>
  </verify>
  <done>Two commits (RED then GREEN) exist; `VampPickerSlideOver.test.ts` passes with every `<behavior>` bullet covered; the component's template uses the RoleSlideOver backdrop/panel/header class strings verbatim, the title reads `Choose a vamp`, and VampPicker is rendered inside the panel body with all three props passed through.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: SlideGroupMusicControl — `+ Add a vamp for this group` button + slide-over picker; type-check gate</name>
  <files>src/components/slides/SlideGroupMusicControl.vue, src/components/slides/__tests__/SlideGroupMusicControl.test.ts</files>
  <read_first>
    - src/components/slides/SlideGroupMusicControl.vue lines 28-64 (uploaded-file / vamp-state action cluster: `group-music-vamp-change`, `group-music-vamp-clear`, `group-music-choose-vamp`, `group-music-remove`), lines 80-111 (empty-state row with the `group-music-add` label whose class string at line 83 is the one to copy, the second `group-music-choose-vamp` link, and the inline `<VampPicker v-if="vampPickerOpen && isEditor">` to replace), lines 122-130 (imports) and lines 207-226 (`vampPickerOpen` / `openVampPicker` / `closeVampPicker` / `onVampSelected` — keep all four as-is)
    - src/components/slides/__tests__/SlideGroupMusicControl.test.ts lines 256-462 (the `260918-nm2` describe: `vamp1` fixture, the choose-vamp/Change tests at lines 282-294, 296-310, 390-448 to update)
    - src/components/__tests__/VampSlideOver.test.ts lines 64-74 (Teleport-stub mount option to add)
    - src/components/slides/SlideGrid.vue lines 200-236 (the neighbouring `+ Add background for this group` add-label and the congregational button — confirms the shared class string and the ASCII `+` convention; do NOT edit this file)
  </read_first>
  <behavior>
    Define `const NEIGHBOUR_BUTTON_CLASSES = ['inline-flex','cursor-pointer','items-center','gap-1.5','rounded-md','border','border-gray-700','px-2.5','py-1.5','text-xs','font-medium','text-gray-300','transition-colors','hover:bg-gray-800']` and a `mountControl(props)` helper in the 260918 describe block that passes `global: { stubs: { Teleport: { template: '<div><slot /></div>' } } }`.
    - No bed, isEditor true: `group-music-choose-vamp` exists, `element.tagName` is `BUTTON`, `attributes('type')` is `button`, `text()` is exactly `+ Add a vamp for this group`, `classes()` toEqual `NEIGHBOUR_BUTTON_CLASSES` AND toEqual `wrapper.get('[data-testid="group-music-add"]').classes()` (identical to the neighbour). isEditor false: absent (existing assertion kept).
    - Uploaded bed (audioUrl, no bedVampId), isEditor true: `group-music-choose-vamp` is a `BUTTON` with the same exact text and `classes()` toEqual `NEIGHBOUR_BUTTON_CLASSES`; `group-music-filename` and `group-music-remove` still render; `group-music-vamp-label` absent (existing).
    - Vamp bed, isEditor true: `group-music-vamp-change` text is `Change` and its `classes()` still contain `text-indigo-400` and do NOT contain `border-gray-700` (small-action styling unchanged); `group-music-vamp-clear` text `Clear` (existing).
    - Before any click: `[data-testid="vamp-picker-slide-over"]` absent and `findComponent(VampPicker).exists()` is false (nothing inline).
    - Click `group-music-choose-vamp` (no-bed state, vamps `[vamp1]`, vampsLoading false) → `[data-testid="vamp-picker-slide-over"]` exists; `[data-testid="vamp-picker-slide-over-title"]` text `Choose a vamp`; `wrapper.get('[data-testid="vamp-picker-slide-over"]').find('[data-testid="vamp-picker-panel"]').exists()` true; `findComponent(VampPicker).props('vamps')` equals `[vamp1]`, `props('loading')` false, `props('selectedVampId')` null.
    - Then `findComponent(VampPicker).vm.$emit('select', vamp1)` → `emitted('attach-vamp')` equals `[[vamp1]]` and the slide-over is gone.
    - Reopen → click `[data-testid="vamp-picker-cancel"]` → slide-over gone, `emitted('attach-vamp').length` still 1.
    - Reopen → click `[data-testid="vamp-picker-slide-over-backdrop"]` → gone, no new emit.
    - Reopen → click `[data-testid="vamp-picker-slide-over-close"]` → gone, no new emit.
    - Reopen → `window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))` + `await nextTick()` → gone, no new emit.
    - Uploaded-bed state: clicking `group-music-choose-vamp` opens the slide-over with `selectedVampId` null.
    - Vamp bed (bedVampId `vamp-1`): clicking `group-music-vamp-change` opens the slide-over with `findComponent(VampPicker).props('selectedVampId')` equal to `vamp-1`.
    - Viewer (isEditor false) with a vamp bed: no `group-music-choose-vamp`, no `group-music-vamp-change`, no `vamp-picker-slide-over` (existing viewer test extended with the slide-over assertion).
    - All pre-existing tests in the file (both describe blocks) stay green; `remove`/`attach` emit tests unchanged.
  </behavior>
  <action>
    RED: update `src/components/slides/__tests__/SlideGroupMusicControl.test.ts` per `<behavior>` — rewrite the two `Choose a vamp` text assertions (lines 287, 390-408 context) to the new button label/tag/classes, replace the "mounts VampPicker … unmounts" test (lines 410-429) and the Change test (431-448) with the slide-over versions, add the no-inline-before-click, Cancel/backdrop/×/Escape close cases and the uploaded-state open case. Import `nextTick` from `vue` for the Escape case. Run the file; the new/changed cases fail against the current inline implementation. Commit `test(260918-pms): failing tests — "+ Add a vamp for this group" button + slide-over picker on the group music control`.

    GREEN: edit `src/components/slides/SlideGroupMusicControl.vue`:
    - Empty-state row (lines 95-100): replace the text-link button with `<button type="button" class="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-gray-700 px-2.5 py-1.5 text-xs font-medium text-gray-300 transition-colors hover:bg-gray-800" data-testid="group-music-choose-vamp" @click="openVampPicker">+ Add a vamp for this group</button>` — class string copied verbatim from the `group-music-add` label directly above it; ASCII `+`.
    - Uploaded-file action cluster (lines 45-51): same replacement (same class string, same text, same testid, `v-if="isEditor"` kept). Leave `group-music-vamp-change` (lines 29-35) and `group-music-vamp-clear` untouched except that Change already calls `openVampPicker`.
    - Replace the inline `<VampPicker v-if="vampPickerOpen && isEditor" …>` block (lines 104-111) with `<VampPickerSlideOver :open="vampPickerOpen && isEditor" :vamps="vamps" :loading="vampsLoading" :selected-vamp-id="bedVampId ?? null" @select="onVampSelected" @close="closeVampPicker" />` (unconditional mount; `open` gates rendering).
    - Imports: swap `import VampPicker from '../VampPicker.vue'` for `import VampPickerSlideOver from '../VampPickerSlideOver.vue'` (the unused import would otherwise fail the type-check gate).
    - Script block: `vampPickerOpen`, `openVampPicker` (keeps its `isEditor` guard), `closeVampPicker`, `onVampSelected` (emit `attach-vamp`, then close) are unchanged. Props/emits unchanged. Update the `260918-nm2 — group-level vamp bed` comment at line 3 / line 151 only if it names "inline" (make it say the picker opens in `VampPickerSlideOver`); keep comments one line.
    Run the control test file plus `src/components/slides/__tests__/SlideGrid.test.ts` (regression: it mounts the real control and drives `attach-vamp` via `vm.$emit`) and `src/components/__tests__/VampPicker.test.ts` (proves VampPicker untouched); all green. Then run `npm run type-check` (vue-tsc --build) — must be clean. Commit `feat(260918-pms): group music control — real "+ Add a vamp for this group" button opening the vamp picker slide-over`.
  </action>
  <verify>
    <automated>npx vitest run src/components/slides/__tests__/SlideGroupMusicControl.test.ts src/components/slides/__tests__/SlideGrid.test.ts src/components/__tests__/VampPicker.test.ts src/components/__tests__/VampPickerSlideOver.test.ts && npm run type-check</automated>
  </verify>
  <done>Two commits (RED then GREEN) exist; the four test files pass; `npm run type-check` is clean; `git diff --stat` for the GREEN commit touches only `SlideGroupMusicControl.vue` and its test (SlideGrid.vue, SlideGrid.test.ts, EditSlideDrawer.vue, VampPicker.vue, firestore.rules, storage.rules, functions/, package.json all unchanged); the control's template contains no `<VampPicker` element of its own and both `group-music-choose-vamp` buttons carry the neighbour class string and the exact label `+ Add a vamp for this group`.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| editor client → `attach-vamp` emit → SlideGrid `onAttachGroupVamp` → Firestore `slideGroups` scoped write | Unchanged from 260918-nm2; this task only changes which surface (slide-over vs inline) raises the same emit |
| document `window` keydown → slide-over close | New global listener, scoped to the open lifetime of the slide-over |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-pms-01 | Elevation of privilege | viewer reaching the picker via the new button / Change | low | mitigate | Button and Change are `v-if="isEditor"`, `openVampPicker` early-returns for non-editors, and `:open="vampPickerOpen && isEditor"` gates the overlay; SlideGrid's `canWriteGroupMedia` gate and the server-side `isOrgEditor` rule are unchanged (test-proven viewer case in Task 2). |
| T-pms-02 | Denial of service | leaked `window` keydown listener swallowing Escape for other panels after the slide-over closes/unmounts | low | mitigate | Listener added only while `open` is true, removed on close and in `onUnmounted`; the handler only emits `close` (never `preventDefault`/`stopPropagation`); test-proven in Task 1 (closed + unmounted cases). |
| T-pms-03 | Tampering | picker selection writing something other than what 260918-nm2 wrote | low | accept | The slide-over re-emits the untouched `VampPicker` `select` payload; the control's `onVampSelected` and SlideGrid's write are byte-unchanged (SlideGrid.test.ts still green). |
| T-pms-SC | Tampering | npm/pip/cargo installs | low | accept | Zero new dependencies. |
</threat_model>

<verification>
- Per task: the task's `<automated>` command green; RED commit precedes GREEN commit for each task.
- Plan-final: `npm run type-check` clean (vue-tsc --build, per CLAUDE.md). The orchestrator runs the bare `npx vitest run` afterwards (expected: only the documented `src/storage.rules.test.ts` baseline failure).
- Human UAT (batched by the orchestrator, dev build — not deployed): Slides tab → group media panel on a no-bed group shows `＋ Add music for this group` and a visually identical `+ Add a vamp for this group` button side by side; click it → a right-hand slide-over titled `Choose a vamp` with the searchable list; Escape / backdrop / × / Cancel each close it; picking a vamp closes it and the panel shows `Vamp: {name · key}`; `Change` reopens it with the current vamp highlighted; with an uploaded MP3 the same button appears in the row and opens the same slide-over; nothing appears inline under the panel any more.
</verification>

<success_criteria>
- All four `must_haves.truths` are demonstrated by the new/updated tests in `VampPickerSlideOver.test.ts` and `SlideGroupMusicControl.test.ts`, with every pre-existing test in the control file still green and `SlideGrid.test.ts` / `VampPicker.test.ts` untouched and green.
- No changes to SlideGrid.vue, EditSlideDrawer.vue, VampPicker.vue, VampSlideOver.vue, firestore.rules, storage.rules, functions/, or dependencies; `npm run type-check` clean; nothing deployed.
</success_criteria>

<output>
Create `.planning/quick/260918-pms-choose-a-vamp-as-a-real-button-opening-a/260918-pms-SUMMARY.md` when done.
</output>
