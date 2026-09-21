# Phase 142: Slides Tab panel UX from Claude Design - Pattern Map

**Mapped:** 2026-09-19
**Files analyzed:** 7 (1 new, 6 modified)
**Analogs found:** 7 / 7

> Note: `142-UI-SPEC.md` already contains exact, copy-pasteable template markup for every new/changed
> surface (Component Specifications §1-§7). This document maps that markup to its closest **behavioral**
> precedent in the codebase — the open/close, focus, click-outside, write-ownership, and testid-migration
> patterns the UI-SPEC assumes but doesn't re-derive. Use the UI-SPEC for exact markup/classes/copy; use
> this file for "which existing component's script logic to imitate."

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/components/slides/SlideGroupSetupStrip.vue` (NEW) | component (composing wrapper) | request-response (emit-only) | `src/components/slides/SlideActionMenu.vue` (open/close+overlay) + `src/components/VampPickerSlideOver.vue` (Esc lifecycle) | role-match (composite of two) |
| `src/components/slides/SlideGrid.vue` (panel gate + mount site) | component (container/write-owner) | CRUD (Firestore writes via store) | itself (existing file, in-place edit) | exact |
| `src/components/slides/SlideGroupMusicControl.vue` (restyle + audioTab) | component | request-response (emit-only) | itself (existing file, in-place edit); `VampPicker.vue` fill mode for the inline Vamp tab | exact |
| `src/components/slides/BackgroundControl.vue` (new `variant` branch) | component | request-response (emit-only) | itself (existing file, in-place edit, additive branch) | exact |
| `src/components/slides/SlotVideoOutputControl.vue` (restyle) | component | request-response (emit-only) | itself (existing file, in-place edit) | exact |
| `src/components/VampPicker.vue` (new `allowUnattached` prop) | component | request-response (emit-only) | itself (existing file, additive prop) | exact |
| `src/stores/slideGroups.ts::setGroupBedMedia` (bug fix — 3rd patch branch) | store/service | CRUD (Firestore write) | itself (existing function, in-place edit) | exact |

## Pattern Assignments

### `src/components/slides/SlideGroupSetupStrip.vue` (NEW — component, request-response)

**Analog A — open/close + click-outside:** `src/components/slides/SlideActionMenu.vue`
**Analog B — Esc lifecycle:** `src/components/VampPickerSlideOver.vue`

**Open/close overlay pattern** (`SlideActionMenu.vue` lines 1-21, 90-96):
```html
<div class="relative" data-testid="slide-action-menu">
  <button :aria-haspopup="'menu'" :aria-expanded="open ? 'true' : 'false'" @click.stop="onTriggerClick">...</button>
  <div v-if="open" class="fixed inset-0 z-10" @click="close" />
  <div v-if="open" ...>...</div>
</div>
```
```typescript
function onTriggerClick(): void { emit('toggle', props.entryId) }
function close(): void { emit('toggle', props.entryId) }
```
UI-SPEC's chip toggle (`toggle(id)` sets `openChip = openChip === id ? null : id`) is the single-ref
generalization of this exact `open`/`toggle` shape — one ref (`openChip`) instead of N booleans, since
only one popover may be open. The mockup's own `open-chip-and-close-others` behavior is literally this
component's per-item pattern collapsed to a shared parent ref.

**Escape lifecycle pattern** (`VampPickerSlideOver.vue` lines 87-103):
```typescript
function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') emit('close')
}
watch(() => props.open, (isOpen) => {
  if (isOpen) window.addEventListener('keydown', onKeydown)
  else window.removeEventListener('keydown', onKeydown)
}, { immediate: true })
onUnmounted(() => window.removeEventListener('keydown', onKeydown))
```
UI-SPEC's Accessibility Contract calls for a document-level `pointerdown` listener with the identical
lifecycle shape (add on open, remove on close, remove on unmount) — copy this `watch(open) → add/remove`
skeleton verbatim, swapping `keydown`/`Escape` for `pointerdown`/outside-target-check, and reuse
`onKeydown`'s `Escape` branch too (the popover needs both listeners, unlike the slide-over which only
needs Escape since it already has a backdrop div for click-outside).

**Group-switch reset precedent** (`SlideGrid.vue` — cited in RESEARCH.md, confirms existing convention):
`SlideGrid.vue` already resets `openMenuEntryId` via `watch(() => props.selectedSlot?.id, ...)`. Add the
identical watcher for `openChip` inside `SlideGroupSetupStrip.vue`:
```typescript
watch(() => props.selectedSlot?.id, () => { openChip.value = null })
```

**Write-ownership / emit contract** — do NOT call any store function from this component. It bubbles six
passthrough emits exactly as `SlideGroupMusicControl.vue`/`BackgroundControl.vue`/`SlotVideoOutputControl.vue`
already do individually — `SlideGroupSetupStrip.vue` re-exposes their own emits under the UI-SPEC's naming
(`attach-music`, `remove-music`, `attach-vamp`, `attach-background`, `remove-background`,
`video-output-change`), the same "emit-only, SlideGrid owns the write" comment convention seen at
`SlideGroupMusicControl.vue:3` (`// 260918-nm2 — group-level vamp bed; emit-only, SlideGrid owns the write`).

**Popover shell markup and positioning:** use `142-UI-SPEC.md` Component Spec §2 verbatim (exact classes,
`getBoundingClientRect()` edge-flip logic) — no closer codebase analog exists for the edge-flip computation
since no other popover in this codebase does it; this is genuinely new logic, not a copy.

---

### `src/components/slides/SlideGrid.vue` (MODIFIED — panel gate + strip mount)

**Analog:** itself (existing panel section, lines ~139-263 template / ~679-800 handlers)

**Gate simplification** (current, `SlideGrid.vue:518-521` per RESEARCH.md Code Examples):
```html
<!-- before -->
v-if="showGroupMusicControl || showGroupBackgroundControl || showCongregationalControl ||
      showRemoveImportedControl || canLoopSlot || showVideoOutputControl"
<!-- after (142-UI-SPEC.md §7) -->
v-if="Boolean(selectedSlot)"
```

**Write handlers — UNCHANGED, do not touch their bodies** (`SlideGrid.vue:681-693`):
```typescript
async function onAttachGroupMusic(url: string): Promise<void> {
  if (!canWriteGroupMedia.value) return
  if (!props.selectedSlot) return
  try {
    await slideGroupsStore.setGroupBedMedia(props.orgId, props.selectedSlot.id, {
      serviceId: props.serviceId,
      bedAudioUrl: url,
    })
  } catch (err) {
    console.error('Failed to attach group music:', err)
  }
}
```
Only the wiring source changes — from three separately-mounted controls' emits to
`SlideGroupSetupStrip.vue`'s six passthrough emits. Keep the `console.error`-only failure handling
(no visible error surface) — this is a deliberate, pre-existing pattern per UI-SPEC's error/backstop row,
not something to "fix" in this phase.

**Retired gates:** `showGroupMusicControl`, `showGroupBackgroundControl` are deleted (chip existence is now
unconditional). `canWriteGroupMedia` survives unchanged and now controls editability (button-vs-span) only.
`canLoopSlot`, `showCongregationalControl`, `showRemoveImportedControl`, `showVideoOutputControl` (as an
editability check passed to the Display popover, not as a mount gate) are unchanged.

---

### `src/components/slides/SlideGroupMusicControl.vue` (MODIFIED — restyle + audioTab derivation)

**Analog:** itself, full current file already read (228 lines)

**The exact gate this phase removes and why** (current, lines 4, 80):
```html
<template v-if="audioUrl"> ... </template>
<template v-else-if="isEditor"> ... </template>
```
This is the Pitfall 2 bug: falls through to the "add" empty state when `bedVampId` is set but `audioUrl`
is absent. Replace with the UI-SPEC's `audioTab` computed (`'none'` when neither set, `'vamp'` when
`bedVampId` set regardless of `audioUrl`, else `'track'`) driving a `v-if="audioTab === 'x'"` chain per
UI-SPEC Component Spec §5's exact template.

**Existing `isVampBed` computed must NOT be reused for tab selection** (current, line 210):
```typescript
const isVampBed = computed(() => !!props.audioUrl && !!props.bedVampId)
```
This still requires `audioUrl` truthy — correct for "should I show the ▶ preview button" (needs a real
URL) but wrong for tab selection. Keep this computed for preview-button gating; add the new `audioTab`
computed as a separate, independent derivation.

**Emit contract — unchanged, reuse verbatim** (lines 157-161):
```typescript
const emit = defineEmits<{
  attach: [url: string]
  remove: []
  'attach-vamp': [vamp: Vamp]
}>()
```

**Upload pattern — reuse verbatim** (lines 163, 186-201): `useMediaUpload()` composable, try/catch around
`uploadMedia()`, deliberately does NOT emit `attach` on failure (comment at line 196-199 explains why —
copy this comment's reasoning for the Track-tab's Replace/Upload affordance too).

**Vamp picker — swap from slide-over to inline `VampPicker` fill mode.** Current (line 104-111, 209,
215-227) opens `VampPickerSlideOver`; UI-SPEC's Audio popover instead mounts `VampPicker` directly with
`fill allow-unattached` (Component Spec §5). Reuse `onVampSelected`'s emit shape (`emit('attach-vamp', vamp)`)
verbatim; drop the `vampPickerOpen` ref and `openVampPicker`/`closeVampPicker` functions since the popover's
own `openChip` state now gates visibility instead.

**Testid retirement (Testid Contract table):** `group-music-add`, `group-music-choose-vamp`,
`group-music-filename`, `group-music-scope`, `group-music-vamp-change`, `group-music-vamp-clear`,
`group-music-vamp-label`, `group-music-vamp-stale`, `group-music-remove` are all retired — replaced by
`group-music-audio-tab-*`, `group-music-track-*`, `group-music-vamp-warning`. `group-music-preview` and
`slide-group-music-control` (root) are preserved verbatim.

---

### `src/components/slides/BackgroundControl.vue` (MODIFIED — additive `variant` branch)

**Analog:** itself, full current file already read (152 lines)

**Existing `flush` boolean-prop precedent to imitate for the new `variant` prop** (lines 103-110, current
prop doc comment):
```typescript
/**
 * Owner follow-up (merged group-media panel): when true, drops this
 * control's own border/background/rounding/padding so it can render flush
 * inside a shared panel wrapper that supplies its own chrome instead.
 * Defaults false so both pre-existing call sites (...) are visually unchanged.
 */
flush?: boolean
```
Same shape/doc-comment style for the new `variant?: 'panel' | 'chip-popover'` prop (default `'panel'`) —
default preserves `SongLyricEditor.vue`'s call site byte-for-byte, exactly as `flush` did for its own
introduction. Branch the whole template (`v-if="variant === 'chip-popover'"` vs the existing content) at
the top level rather than threading `variant` checks through every existing `v-if`.

**Emit contract, upload composable, error pattern — unchanged, reuse verbatim** (lines 115-150):
```typescript
const emit = defineEmits<{ attach: [url: string]; remove: [] }>()
const { progress, error, isUploading, uploadBackground, reset } = useBackgroundUpload()
```

**`inheritedFrom` no-override precedent — reuse the exact same guard for the new branch** (lines 40-46
comment + line 48 `v-if="isEditor && !inheritedFrom"`): the new chip-popover branch's inherited-song case
(UI-SPEC Component Spec §4, "Managed on the song…" explainer) must gate on the same `inheritedFrom` prop
with the same "no override affordance" rule — don't invent a second inheritance flag.

**Testids preserved for `variant="panel"` (default) only:** `background-control`, `-image`, `-filename`,
`-remove`, `-add`, `-input`, `-caption`, `-inherited`, `-upload-progress`, `-upload-error`. New testids for
`variant="chip-popover"` only: `background-control-swatch-none`, `-swatch-recent`, `-swatch-upload`,
`-chip-caption`, `-inherited-explainer`.

---

### `src/components/slides/SlotVideoOutputControl.vue` (MODIFIED — restyle in place)

**Analog:** itself, full current file already read (57 lines)

**Script — unchanged, reuse verbatim** (lines 1-21):
```typescript
const mode = computed(() => props.slot.videoOutput?.mode ?? 'fullscreen')
function select(next: 'banner' | 'fullscreen') {
  if (!props.editable) return
  if (next === mode.value) return
  emit('change', { mode: next })
}
```
UI-SPEC Component Spec §3 confirms only the template/caption change (tiles instead of pill buttons, dynamic
`sizeHint` instead of the static "Video output only" string) — `select()`, `mode`, and the `change` emit
shape are all reused as-is.

**Testids preserved:** `slot-video-output-row`, `-fullscreen-btn`, `-banner-btn`, `-caption` (same elements,
new visual treatment — caption text becomes dynamic).

**Locked-state precedent, with one caveat (Finding 2):** current uses `:disabled="!editable"` on native
`<button>`s (lines 38, 48). UI-SPEC's locked/non-editor chip is a `<span>` at the `SlideGroupSetupStrip`
level, so the popover (and therefore this control) never mounts when locked — meaning `editable` can be
passed through as unconditionally `true` from inside the popover (per UI-SPEC's own template, which passes
no `:disabled` at all). Do not duplicate the lockedness check inside this component when called from the
new strip; keep `:disabled="!editable"` only as defensive/unused-in-practice plumbing, matching UI-SPEC's
Open Question 2 resolution.

---

### `src/components/VampPicker.vue` (MODIFIED — new `allowUnattached` prop)

**Analog:** itself, full current file already read (143 lines)

**Exact branch point the new prop must guard** (lines 48-49, 80-81):
```html
<button v-if="vamp.attachment?.downloadUrl" ... data-testid="vamp-picker-row" @click="emit('select', vamp)">
<div v-else aria-disabled="true" data-testid="vamp-picker-row-disabled" ...>
```
Change the condition to `v-if="vamp.attachment?.downloadUrl || props.allowUnattached"` — the enabled row
keeps `data-testid="vamp-picker-row"` and stays clickable; only the disabled/`aria-disabled` branch is
skipped for a no-MP3 vamp when `allowUnattached` is true. Add the amber "No MP3" tag (already built at
lines 92-109 in the disabled branch) into the now-enabled row's markup so the warning persists even though
the row is clickable — reuse that exact SVG+text markup, don't rebuild it.

**Prop default — follow the same `withDefaults` pattern already used elsewhere in this file's siblings**
(e.g. `SlideGroupMusicControl.vue`'s `withDefaults(defineProps<...>(), { flush: false, ... })`):
```typescript
const props = withDefaults(defineProps<{
  vamps: Vamp[]
  loading?: boolean
  selectedVampId?: string | null
  fill?: boolean
  allowUnattached?: boolean
}>(), { allowUnattached: false })
```
`EditSlideDrawer.vue`'s call site (per RESEARCH.md, passes nothing) is unaffected by the `false` default.

---

### `src/stores/slideGroups.ts::setGroupBedMedia` (MODIFIED — bug fix, 3rd patch branch)

**Analog:** itself, current function already read in full (lines 116-181)

**Exact insertion point — after the `bedAudioUrl !== undefined` branch, inside `existing.exists()`**
(current, lines 143-159):
```typescript
if (existing.exists()) {
  const update: Record<string, unknown> = { updatedAt: serverTimestamp() }
  if (patch.clearAudio) {
    update.bedAudioUrl = deleteField()
    update.bedVampId = deleteField()
    update.bedVampLabel = deleteField()
  } else if (patch.bedAudioUrl !== undefined) {
    update.bedAudioUrl = patch.bedAudioUrl
    if (patch.bedVampId) {
      update.bedVampId = patch.bedVampId
      update.bedVampLabel = patch.bedVampLabel ?? ''
    } else {
      update.bedVampId = deleteField()
      update.bedVampLabel = deleteField()
    }
  }
  // NEW third branch — no-MP3 vamp assignment (Pitfall 1 fix):
  else if (patch.bedVampId) {
    update.bedVampId = patch.bedVampId
    update.bedVampLabel = patch.bedVampLabel ?? ''
    update.bedAudioUrl = deleteField() // clear any stale Track/prior-vamp URL
  }
  await updateDoc(ref, update)
  return
}
```
Must come after the `bedAudioUrl !== undefined` check (so Track uploads and MP3-having vamp assignments,
which both set `bedAudioUrl`, keep taking the existing branch) and must explicitly `deleteField()`
`bedAudioUrl` (a bare `updateDoc` omission leaves a stale URL). The `!existing.exists()` / `setDoc` branch
(lines 164-180) already handles this correctly via `stripUndefined()` — no change needed there.

**Companion fix at the call site:** `SlideGrid.vue`'s `onAttachGroupVamp` currently early-returns on a
missing `downloadUrl` (`if (!downloadUrl) return`) — CONTEXT.md/UI-SPEC both call for removing this guard
so the no-MP3 vamp patch actually reaches `setGroupBedMedia`.

---

## Shared Patterns

### Emit-only child, single write owner
**Source:** `SlideGroupMusicControl.vue:3` comment, `BackgroundControl.vue`, `SlotVideoOutputControl.vue`
— all follow "component emits, `SlideGrid.vue` owns every Firestore call."
**Apply to:** `SlideGroupSetupStrip.vue` and its three composed children — no new store imports in any of
these four files.

### Explicit clear flags, never undefined-means-clear
**Source:** `src/stores/slideGroups.ts:145-149` (`clearAudio`), mirrored pattern for `clearBackground`.
**Apply to:** any new "None" tab / clear affordance in the Audio popover — call the existing
`onRemoveGroupMusic`/`onRemoveGroupBackground` handlers, never emit an empty-string URL.

### Popover/menu open-close lifecycle (watch-driven listener add/remove)
**Source:** `VampPickerSlideOver.vue:87-103` (keydown), generalized in this file above to `openChip` +
`pointerdown`.
**Apply to:** `SlideGroupSetupStrip.vue`'s Esc and click-outside handling.

### `withDefaults` + doc-commented boolean/enum prop for additive, non-breaking template branches
**Source:** `BackgroundControl.vue`'s `flush` prop (lines 103-113), `SlideGroupMusicControl.vue`'s `flush`
prop (lines 140-146).
**Apply to:** `BackgroundControl.vue`'s new `variant` prop, `VampPicker.vue`'s new `allowUnattached` prop.

### Comment convention
Per `CLAUDE.md`/`.planning/codebase/CONVENTIONS.md`: short inline comments only; put rationale in ADRs
(see `ADR-0168` cited at `slideGroups.ts:131` for the `deleteField()` pattern) and behavior narration in
map docs (`.planning/codebase/ARCHITECTURE.md` — every touched component file already carries a one-line
pointer comment to its ARCHITECTURE.md entry, e.g. `SlotVideoOutputControl.vue:2`). New/modified files
should keep or add the same pointer-comment style, not restate rationale inline.

## No Analog Found

None — every file in scope has an exact or near-exact existing-file analog (all but
`SlideGroupSetupStrip.vue` are in-place edits of files already read in full this session).

## Test Pattern Notes (for planner, not exhaustive — see RESEARCH.md Finding 8 for the full migration bill)

**Component test mount + composable-mock convention** (`SlideGroupMusicControl.test.ts:1-48`):
```typescript
vi.mock('@/composables/useMediaUpload', () => ({
  useMediaUpload: () => ({ progress: progressRef, error: errorRef, isUploading: isUploadingRef, uploadMedia: mockUploadMedia, reset: mockReset }),
}))
async function selectFile(wrapper, testid, file) {
  const input = wrapper.find(`[data-testid="${testid}"]`)
  Object.defineProperty(input.element, 'files', { value: [file], configurable: true })
  await input.trigger('change')
}
```
Reuse this exact mock/helper shape for `SlideGroupSetupStrip.test.ts` (new file) and for updated
`SlideGroupMusicControl.test.ts` cases.

**Store test Firestore mock convention** (`slideGroups.test.ts:1-73`):
```typescript
vi.mock('firebase/firestore', () => ({
  getDoc: vi.fn(() => Promise.resolve({ exists: () => false, id: 'mock-id', data: () => undefined })),
  updateDoc: vi.fn(() => Promise.resolve()),
  deleteField: vi.fn(() => '__deleteField__'),
  // ...
}))
```
For the `setGroupBedMedia` no-MP3-vamp regression test, drive `getDoc` to resolve `exists: () => true`
(the realistic/"already has a doc" case Pitfall 1 explicitly flags as the one that must be tested — a
fresh-doc test would pass by accident) and assert `updateDoc` was called with `bedVampId`/`bedVampLabel`
set and `bedAudioUrl: '__deleteField__'`.

## Metadata

**Analog search scope:** `src/components/slides/`, `src/components/` (VampPicker*, AudioPlayer),
`src/stores/`, `src/components/slides/__tests__/`, `src/stores/__tests__/`
**Files scanned/read in full:** `SlideActionMenu.vue`, `VampPickerSlideOver.vue`, `SlotVideoOutputControl.vue`,
`SlotLoopControl.vue`, `SlideGroupMusicControl.vue`, `BackgroundControl.vue`, `VampPicker.vue`,
`slideGroups.ts` (relevant range), `SlideGroupMusicControl.test.ts` (partial), `slideGroups.test.ts` (partial)
**Pattern extraction date:** 2026-09-19
