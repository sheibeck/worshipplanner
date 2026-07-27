# Phase 25: Slides Tab Shell — Pattern Map

**Mapped:** 2026-07-26
**Files analyzed:** 8 (planner's discretion on exact decomposition; this maps the expected surfaces)
**Analogs found:** 8 / 8

## File Classification

| New/Modified File (expected) | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/views/ServiceEditorView.vue` (modified: 3rd tab) | view/host | request-response | itself — existing `'music'`/`'roles'` tab bar (lines 397-420, 422, 1007, 1182) | exact (in-place extension) |
| `src/components/SlidesTab.vue` (or split rail/grid — planner's call) | component (panel) | request-response | `ServiceEditorView.vue`'s `v-show="activeTab === 'roles'"` panel (line 1007+) | role-match |
| `src/components/SlidePlanRail.vue` | component (list, non-draggable) | CRUD (read-only nav) | `TeamTagPill.vue` / `SongBadge.vue` for badge styling; `ServiceEditorView.vue` slot-list markup (lines 513-536) for row shape minus drag | role-match (badges exact, list-row partial) |
| `src/components/SlideGrid.vue` | component (list, drag-reorderable) | CRUD + event-driven (drag) | `ServiceEditorView.vue`'s `slotContainerRef` + SortableJS block (lines 1483-1513) and `.slot-item`/`.drag-handle` markup (lines 527-536) | exact (drag pattern), role-match (grid vs. list) |
| `src/components/SlideCard.vue` | component (presentational) | CRUD | `SongBadge.vue` (static class-map badge) + `.slot-item` row markup | role-match |
| `src/components/SlideGroupMusicControl.vue` (the "Music for this group" control) | component (file upload + preview) | CRUD + file-I/O | `src/components/SlotMediaAttachment.vue` (entire file) | exact — D-15/context calls this out directly |
| `src/components/SlideDropTarget.vue` (drop tile + whole-grid dragover) | component (file-I/O, drag-and-drop) | file-I/O + event-driven | `SlotMediaAttachment.vue` (upload composable wiring) + `PptxImportModal.vue` (file-type branching, `<input type="file">` + drag) | role-match (no existing dragover-highlight precedent — flagged below) |
| Reused as-is: `src/components/PptxImportModal.vue` | modal | file-I/O | n/a — reused directly per D-15, not re-implemented | exact (reuse, not new) |
| Corresponding `__tests__/*.test.ts` for each new component | test | — | `src/components/__tests__/SlotMediaAttachment.test.ts`, `src/components/__tests__/PptxImportModal.test.ts`, `src/stores/__tests__/slideGroups.test.ts` | exact |

## Pattern Assignments

### `src/views/ServiceEditorView.vue` — third tab (modified, not new)

**Analog:** itself (in-file precedent) — this is an extension of existing code, not a new-file analog.

**Tab bar pattern** (lines 397-420):
```vue
<div class="flex items-center gap-1 mb-3 border-b border-gray-800 pb-0">
  <button
    type="button"
    class="px-4 py-2 text-sm font-medium rounded-t-md transition-colors -mb-px border-b-2"
    :class="activeTab === 'music'
      ? 'text-indigo-300 border-indigo-500 bg-gray-900'
      : 'text-gray-400 border-transparent hover:text-gray-200 hover:border-gray-600'"
    @click="activeTab = 'music'"
  >
    Music
  </button>
  <button v-if="authStore.isEditor" ... @click="activeTab = 'roles'">Roles</button>
</div>
```
Add a third button identically shaped, `@click="activeTab = 'slides'"`, no `v-if="authStore.isEditor"` gate (Slides tab is not editor-only per CONTEXT — verify against R031 if in doubt, but nothing in CONTEXT restricts it). Per UI-SPEC correction #5, the button label stays `Slides` — do not rename to "Service Order" yet (that's Phase 27).

**Panel show/hide pattern** (lines 422, 1007):
```vue
<div v-show="activeTab === 'music'"> ... </div>
<div v-show="activeTab === 'roles'"> ... </div>
```
Add `<div v-show="activeTab === 'slides'"> ... </div>` as a third sibling panel, hosting the new `SlidesTab.vue` (or rail+grid components directly).

**State widen** (line 1182):
```typescript
const activeTab = ref<'music' | 'roles'>('music')
```
→ `const activeTab = ref<'music' | 'roles' | 'slides'>('music')`. D-05 requires auto-selecting the first plan-order group when this tab opens — wire a `watch(activeTab, ...)` or an `onMounted`-style guard scoped to the new panel component, not a change to this ref's default.

**Store subscription integration point:** `useSlideGroups().groupsBySlotId` (a `computed<Map<string, SlideGroup>>` keyed by `slot.id`) is already available; the rail iterates `localService.value.slots` (already sorted by `position` — see the existing `v-for="(slot, index) in localService.slots"` at line 515) and looks each up via `groupsBySlotId.get(slot.id)`. Do NOT re-sort or re-fetch — reuse the existing `localService.slots` ordering as-is.

---

### `src/components/SlidePlanRail.vue` (new)

**Analog for row/list shape:** `ServiceEditorView.vue` slot-list container + row (lines 513-536), stripped of the drag handle per D-06.

**Row shape to copy (minus drag-handle div, D-06 explicitly forbids the handle/cursor-grab affordance):**
```vue
<div class="slot-item rounded-lg bg-gray-900 border border-gray-800 p-3 flex items-start gap-2" :data-testid="`slot-${index}`">
  <!-- no drag-handle div here — D-06 -->
  <div class="flex-1 min-w-0"> ... row content ... </div>
</div>
```
Use `hover:bg-gray-800/60` for the row hover per UI-SPEC (a *color* hover only, never `cursor-grab`).

**Kind badge — copy `SongBadge.vue`'s static class-map pattern exactly** (avoids the Tailwind v4 dynamic-class purge bug called out twice already in this codebase):
```typescript
// src/components/SongBadge.vue lines 40-45
const badgeClasses = {
  1: 'bg-blue-900/50 text-blue-300 border-blue-800',
  2: 'bg-purple-900/50 text-purple-300 border-purple-800',
  3: 'bg-amber-900/50 text-amber-300 border-amber-800',
} as const
```
Build an equivalent static map keyed by `SlotKind` using the exact classes UI-SPEC's "Kind badge color map" table specifies (SONG/HYMN → indigo, SCRIPTURE → teal exactly like `TeamTagPill`'s `theme` variant, PRAYER → gray like `TeamTagPill`'s `team` variant, MESSAGE → pink like `TeamTagPill`'s `user` variant, IMPORTED → amber like `SongBadge`'s type-3). `TeamTagPill.vue` (22 lines) is the smallest, most literal template for this — its whole `variantClasses` object is directly reusable in spirit:
```typescript
// src/components/TeamTagPill.vue lines 17-21
const variantClasses = {
  team:  'bg-gray-800 text-gray-400 border-gray-700',
  theme: 'bg-teal-900/50 text-teal-300 border-teal-800',
  user:  'bg-pink-900/50 text-pink-300 border-pink-800',
} as const
```

**Empty state (D-07):** no existing component renders an empty-rail state; author fresh copy per UI-SPEC's Copywriting Contract (`Nothing planned yet` / body pointing at Service Order tab). No analog exists for this exact shape — treat as new UI, not a gap requiring escalation.

**Eyebrow header:** reuse the *exact* existing "Teams" eyebrow class from `ServiceEditorView.vue` line 426: `text-xs font-semibold text-gray-400 uppercase tracking-wider` for the `SERVICE PLAN` label.

---

### `src/components/SlideGrid.vue` (new)

**Analog:** `ServiceEditorView.vue`'s SortableJS wiring (lines 1483-1513) — this is the exact pattern to replicate for D-11 (slide drag-reorder within a group), scoped from `.slot-item`/`slotContainerRef` to a `.slide-card`/grid-container equivalent:

```typescript
// ServiceEditorView.vue lines 1483-1513 (adapt container ref name + selectors)
const slotContainerRef = ref<HTMLElement | null>(null)
let sortableInstance: Sortable | null = null

watch(slotContainerRef, (el) => {
  if (el && !sortableInstance) {
    sortableInstance = Sortable.create(el, {
      handle: '.drag-handle',
      draggable: '.slot-item',   // → '.slide-card' in the new component
      animation: 150,
      ghostClass: 'opacity-30',
      async onEnd(evt) {
        if (evt.oldIndex == null || evt.newIndex == null) return
        if (evt.oldIndex === evt.newIndex) return
        // revert SortableJS's DOM move so Vue's reactive render is the single source of truth
        const parent = evt.item.parentNode
        if (parent) {
          const ref = parent.children[evt.oldIndex]
          parent.insertBefore(evt.item, evt.oldIndex < evt.newIndex ? ref?.nextSibling ?? null : ref ?? null)
        }
        // splice + reindex, then persist
      },
    })
  }
})
```
Critical detail worth preserving verbatim: the DOM-revert-then-let-Vue-re-render trick (prevents the SortableJS snap-back bug, MEM008-adjacent). Persistence for the new grid must call `useSlideGroups().replaceGroupSlides(orgId, slotId, slides, sourceSignature)` — NOT the `localService` deep-watch autosave (CONTEXT explicitly forbids that path for slide mutations).

**Drag-handle markup to copy** (lines 532-536), moved to the card's footer per D-11 ("to the LEFT of the label text"):
```vue
<div class="cursor-grab active:cursor-grabbing text-gray-600 hover:text-gray-400 drag-handle flex-shrink-0" aria-label="Reorder slide">
  <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
    <path d="M7 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4z..." />
  </svg>
</div>
```
UI-SPEC calls for a `⣿`-style grip icon rather than this exact 6-dot glyph — keep the class treatment (`text-gray-600 hover:text-gray-400 cursor-grab`), swap only the SVG path.

**Grid layout:** no existing CSS-grid analog in this codebase (all prior list surfaces are single-column flex/`space-y`); this is new. Use the UI-SPEC's literal directive: `grid-template-columns: repeat(auto-fill, minmax(200px, 1fr))`, `gap: 16px`.

---

### `src/components/SlideCard.vue` (new)

**Analog:** `.slot-item` row styling (`rounded-lg bg-gray-900 border border-gray-800 p-3`) + `SongBadge.vue`'s static class-map for the kind badge (same map as the rail — share one module/constants file between rail and card per D-10's shared `SlotKind`/card-kind vocabulary, avoid duplicating the class map twice).

**Selection accent (D-12):** no existing "selected card" pattern in this codebase to copy verbatim; closest precedent is the active-tab treatment already in `ServiceEditorView.vue` (`text-indigo-300 border-indigo-500 bg-gray-900`) — reuse the same indigo-500 border + indigo-950 tint combination for consistency with the rest of the accent system (UI-SPEC Color section already specifies this explicitly, so this is confirmatory, not a gap).

---

### `src/components/SlideGroupMusicControl.vue` (new — the "Music for this group" control)

**Analog:** `src/components/SlotMediaAttachment.vue` (entire 122-line file) — CONTEXT explicitly calls this out ("`SlotMediaAttachment.vue` was retargeted at the group bed in 24-06... the 'Music for this group' control should build on it").

**Imports pattern** (lines 76-78):
```typescript
import { useMediaUpload } from '@/composables/useMediaUpload'
import AudioPlayer from './AudioPlayer.vue'
```
(no `VideoPlayer` needed here — group music is audio-only per D-14.)

**Props/emits pattern** (lines 80-89) — adapt from `update:audioUrl` (v-model style, persisted by the *parent's* deep-watch autosave) to a **direct store-action call** instead, because CONTEXT forbids riding the `localService` autosave for slide-group data:
```typescript
const props = defineProps<{ audioUrl?: string; orgId: string }>()
const emit = defineEmits<{ 'update:audioUrl': [url: string | undefined] }>()
```
The parent (`ServiceEditorView.vue`, see its existing usage at lines 917-923, 1437-1450) already demonstrates the correct integration: `SlotMediaAttachment`'s emitted url is intercepted and written via `slideGroupsStore.setGroupBedMedia(orgId, slot.id, { serviceId, bedAudioUrl, clearAudio })` — a deliberately separate write path from `replaceGroupSlides`. Copy this exact interception pattern rather than wiring the new control directly to a v-model on `localService`:
```typescript
// ServiceEditorView.vue lines 1425-1451 (paraphrased pattern)
async function onGroupBedAudioUpdate(slot: ServiceSlot, url: string | undefined): Promise<void> {
  await slideGroupsStore.setGroupBedMedia(authStore.orgId, slot.id, {
    serviceId: localService.value!.id,
    bedAudioUrl: url,
    clearAudio: url === undefined,
  })
}
```

**Upload progress/error copy** (lines 29-34) — reuse verbatim, do not author new copy (UI-SPEC's Copywriting Contract explicitly requires this):
```vue
<p v-if="isUploading" class="mt-1 text-indigo-400">Uploading... {{ Math.round(progress) }}%</p>
<p v-if="error" class="mt-1 text-red-400">{{ error }}</p>
```

**Remove-media pattern** (lines 38-46) — matches UI-SPEC's "Group-bed removal" destructive-but-unconfirmed convention exactly:
```vue
<button
  type="button"
  class="mt-1 text-gray-500 hover:text-red-400 transition-colors"
  @click="removeAudio"
>
  Remove audio
</button>
```
Adapt label to `✕` icon-only per UI-SPEC with `aria-label="Remove group music"`, and add a `▶` preview button (`aria-label="Preview group music"`) — no analog exists for a play-only preview button; `AudioPlayer.vue`'s existing rendered player (already used here for preview) may suffice instead of a separate icon-button; confirm against `AudioPlayer.vue`'s own controls at plan time.

**No-bed-yet state:** `SlotMediaAttachment.vue` has no equivalent (it always shows the file input, never a "＋ Add music" button) — this is new UI per UI-SPEC's Mockup Correction #7; author fresh, no existing analog to copy.

---

### `src/components/SlideDropTarget.vue` (new — drop tile + whole-grid dragover highlight)

**Analog (upload mechanics):** `SlotMediaAttachment.vue`'s `useMediaUpload` wiring (lines 91-113) for the audio/video/image upload call shape; `PptxImportModal.vue`'s file-input pattern (lines 62-74) for the `.pptx` branch — reuse `PptxImportModal.vue` directly per D-15 rather than reimplementing PPTX parsing here.

**No existing drag-and-drop (`dragenter`/`dragover`/`drop` event) analog exists anywhere in this codebase** — every current file-attach flow (`SlotMediaAttachment.vue`, `PptxImportModal.vue`) uses a plain `<input type="file">` + `@change`, never native HTML5 drag events. This is genuinely new interaction code for the app. Build it directly against the UI-SPEC's literal requirements (`dragenter`/`dragover` → `border-indigo-500/50 bg-indigo-950/10` on the grid container; `drop` → branch by MIME/extension to PPTX-modal / image-append / video-append / audio-bed). Flag this in `## No Analog Found` below — the planner should budget explicit test coverage here (UI-SPEC's own "backstop" row on unsupported-file-type rejection already calls this out).

---

## Shared Patterns

### Static class-map for dynamic-looking styles (Tailwind v4 purge gotcha)
**Source:** `src/components/SongBadge.vue` lines 40-45, `src/components/TeamTagPill.vue` lines 17-21
**Apply to:** `SlidePlanRail.vue`'s kind badge, `SlideCard.vue`'s kind badge — both MUST use a static, fully-spelled-out class-map object keyed by the discriminant (`SlotKind` / content-kind). Never interpolate a color name into a class string (`` `bg-${kind}-900` `` is silently purged in production builds — hit twice already in this codebase).

### SortableJS drag-reorder
**Source:** `src/views/ServiceEditorView.vue` lines 1483-1513 (setup) and 527-536 (markup)
**Apply to:** `SlideGrid.vue` only (D-11) — NOT `SlidePlanRail.vue` (D-06 forbids any drag affordance on the rail). Preserve the DOM-revert-before-Vue-re-render trick in `onEnd` verbatim; it is a specific fix for a snap-back bug, not incidental code.

### Icon style (hand-inlined SVG, Heroicons-outline convention)
**Source:** Any existing icon in `ServiceEditorView.vue` (e.g. lines 391-393, 533-535, `PptxImportModal.vue` lines 45-47)
**Apply to:** All new icons this phase (drag-grip, ✕, ▶, ＋, ⇪) — `24×24 viewBox`, `stroke="currentColor"`, `stroke-width="2"`, rounded caps (`stroke-linecap="round" stroke-linejoin="round"`) for line icons; `viewBox="0 0 20 20" fill="currentColor"` for solid glyphs like the existing drag-grip. No icon font, no npm icon package.

### Group-scoped Firestore write path (never the `localService` deep-watch)
**Source:** `src/stores/slideGroups.ts` (`setGroupBedMedia`, `replaceGroupSlides`) and its existing call sites in `ServiceEditorView.vue` (lines 1425-1451)
**Apply to:** Every slide/bed mutation this phase introduces (`＋ Add slide`, `⇪ Import into this group`, drag-reorder persistence, group-music attach/remove, drop-target appends). All must call `useSlideGroups()` actions directly — never mutate `localService.value` for slide-group data, since that would silently ride the whole-document autosave and race with `slideGroups.ts`'s own scoped writes.

### Modal teleport + test pattern
**Source:** `src/components/PptxImportModal.vue` lines 1-2 (`<Teleport to="body">`), `src/components/__tests__/PptxImportModal.test.ts` lines 1-2, 59-60 comment
**Apply to:** If any new component this phase introduces a modal/overlay (unlikely beyond reusing `PptxImportModal.vue` itself) — teleported content requires `DOMWrapper` over `document.body` plus `enableAutoUnmount(afterEach)` in tests, and `stubs: { teleport: false }` under `shallowMount` (per 24-06 finding already recorded in CONTEXT).

---

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| `src/components/SlideDropTarget.vue` (dragover/drop handling specifically) | component | file-I/O + event-driven | No native HTML5 drag-and-drop (`dragenter`/`dragover`/`drop`) exists anywhere in this codebase — every prior file-attach flow uses `<input type="file">` + `@change`. Build fresh against UI-SPEC's literal spec; the UI-SPEC itself flags this row as a "backstop" needing explicit test verification, not a silent pass. |
| Rail empty state (D-07) / grid empty state (D-08) copy blocks | component (presentational) | — | No existing empty-state component precedent to copy structurally in this app (searched `ServiceEditorView.vue`, `ServicesView.vue` — neither has a dedicated empty-state block); author fresh from UI-SPEC's Copywriting Contract. |
| CSS Grid layout (`repeat(auto-fill, minmax(200px, 1fr))`) | layout | — | Every existing list surface in this codebase (`slot-item` list, `SongTable`, etc.) uses flex/`space-y`, not CSS Grid — this is the first grid-layout surface in the app; follow UI-SPEC's literal values, no in-repo precedent to reconcile against. |

## Metadata

**Analog search scope:** `src/views/ServiceEditorView.vue`, `src/views/ServicesView.vue`, `src/components/*.vue` (SlotMediaAttachment, PptxImportModal, SongSlideOver, SongBadge, TeamTagPill, ImportedSlideEditor, ScriptureSlideEditor), `src/stores/slideGroups.ts`, `src/components/__tests__/*.test.ts`, `src/stores/__tests__/slideGroups.test.ts`
**Files scanned:** ~14 source files + 3 test files read directly; ~158 test files enumerated for structure confirmation
**Pattern extraction date:** 2026-07-26
