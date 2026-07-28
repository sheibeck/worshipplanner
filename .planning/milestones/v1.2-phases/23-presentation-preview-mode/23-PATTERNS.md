# Phase 23: Presentation Preview Mode - Pattern Map

**Mapped:** 2026-07-25
**Files analyzed:** 7 (2 new, 5 modified)
**Analogs found:** 7 / 7

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|--------------------|------|-----------|-----------------|----------------|
| `src/components/PresentationViewer.vue` (NEW) | component (full-screen overlay/viewer) | event-driven (keyboard nav, imperative media control) | `src/components/PptxImportModal.vue` (Teleport shell) + `src/components/SlideshowPreview.vue` (per-slide-kind rendering) + `src/components/CongregationalEditor.vue` (Leader/Congregation) + `AudioPlayer.vue`/`VideoPlayer.vue` (media driving) | role-match (composite — no single existing full-screen viewer exists) |
| `src/components/AudioPlayer.vue` (MODIFIED — add `chromeless` prop) | component | request-response (imperative play/pause) | itself (additive change) | exact |
| `src/components/VideoPlayer.vue` (MODIFIED — add `chromeless` prop + muted accessor) | component | request-response (imperative play/pause) | itself (additive change) | exact |
| `src/components/SlideshowPreview.vue` (MODIFIED — add "Present Slideshow" CTA) | component | request-response (button → emit/toggle) | `src/components/PptxImportModal.vue` (disabled-button Tailwind idiom, line 196-198) | role-match |
| `src/views/ServiceEditorView.vue` (MODIFIED — destructure `assembledSlideshow`, mount viewer, own `presenting` ref) | view/container | CRUD (existing) + event-driven (new keydown/mount wiring) | itself (existing destructure site line 1381; existing keydown lifecycle lines 1676-1691) | exact |
| `src/components/__tests__/PresentationViewer.test.ts` (NEW) | test | component test (Teleport + media mocks) | `src/components/__tests__/PptxImportModal.test.ts` (Teleport/DOMWrapper pattern) + `src/components/__tests__/VideoPlayer.test.ts` (media mocking) + `src/components/__tests__/SlideshowPreview.test.ts` (`AssembledSlide` fixture builders) | role-match (composite) |
| `src/components/__tests__/AudioPlayer.test.ts` / `VideoPlayer.test.ts` (MODIFIED — chromeless assertions) | test | component test | themselves (existing files, additive test cases) | exact |

## Pattern Assignments

### `src/components/PresentationViewer.vue` (NEW component, event-driven)

**Analog 1 — Teleport-to-body overlay structure:** `src/components/PptxImportModal.vue`

**Teleport + layered overlay pattern** (lines 1-29):
```vue
<template>
  <Teleport to="body">
    ...
    <div class="fixed inset-0 z-40 bg-black/60"> <!-- backdrop layer -->
    ...
    <div class="fixed inset-0 z-50 flex items-center justify-center p-4"> <!-- content layer -->
```
For `PresentationViewer.vue`, per UI-SPEC this collapses to a single `fixed inset-0 z-50 bg-black` layer (no separate backdrop — it IS the fullscreen canvas), used as the CSS-overlay fallback when `requestFullscreen()` rejects. Wrap the whole template in `<Teleport to="body">` exactly like this file does.

**Analog 2 — per-`contentKind` slide rendering branches:** `src/components/SlideshowPreview.vue` (lines 30-81)

```vue
<template v-if="cardKind(assembled.slide) === 'lyric'">
  ... lyric ...
</template>
<template v-else-if="cardKind(assembled.slide) === 'copyright'">
  ... copyright/title+authors ...
</template>
<template v-else-if="cardKind(assembled.slide) === 'scripture'">
  ... scripture reference + text ...
</template>
<template v-else-if="cardKind(assembled.slide) === 'image'">
  <img :src="(assembled.slide as ImageSlide).imageUrl" ... />
</template>
<template v-else>
  <!-- TextSlide fallback -->
</template>

<!-- Attached media, rendered below slide content, only when URL present -->
<div v-if="assembled.slide.videoUrl" data-testid="preview-slide-video" class="mt-2">
  <VideoPlayer :src="assembled.slide.videoUrl" />
</div>
<div v-if="assembled.slide.audioUrl" data-testid="preview-slide-audio" class="mt-2">
  <AudioPlayer :src="assembled.slide.audioUrl" />
</div>
```
The `cardKind()` helper (lines 128-133) — distinguishes `LyricSlide` from `CopyrightSlide` (both carry `contentKind: 'lyric'`) via `'sectionId' in slide` — must be reused/reimplemented identically in the viewer since the same discriminated-union ambiguity applies to `AssembledSlide.slide`. Import types the same way (lines 100-108): `import type { AssembledSection, Slide, LyricSlide, CopyrightSlide, ScriptureSlide, TextSlide, ImageSlide } from '@/types/slide'`.

**Analog 3 — Leader/Congregation visual convention:** `src/components/CongregationalEditor.vue` (lines 102-121, preview panel)

```vue
<div v-for="(section, idx) in sections" :key="`preview-${idx}`" :data-testid="`preview-section-${idx}`">
  <span
    class="text-xs uppercase tracking-wider mr-2"
    :class="section.speaker === 'LEADER' ? 'text-indigo-400' : 'text-amber-400'"
    :data-testid="`preview-label-${idx}`"
  >
    {{ section.speaker === 'LEADER' ? 'Leader:' : 'Congregation:' }}
  </span>
  <span
    :class="section.speaker === 'LEADER'
      ? 'text-gray-100 font-semibold text-sm'
      : 'text-gray-300 font-normal text-sm pl-2'"
  >
    {{ section.text }}
  </span>
</div>
```
UI-SPEC scales this to Body-role (48px/`text-5xl`), Leader `text-indigo-300` font-semibold, Congregation `text-amber-300` font-normal `pl-8` (vs. editor's `pl-2`/`pl-4`). Reuse the exact conditional-class structure, not the sizes. Import `CongregationalSection`/`ScriptureSlide.sections` type the same way CongregationalEditor imports `CongregationalSection` from `@/types/slide` (line 135).

**Analog 4 — media driving contract:** `AudioPlayer.vue` + `VideoPlayer.vue` `defineExpose`/emit shape — see next section (shared with modified-file excerpts below). The viewer must hold a `ref` to the currently-mounted `AudioPlayer`/`VideoPlayer` instance and call `.play()`/`.pause()` imperatively; it must NOT rely on the `autoplay` attribute (neither component sets it).

**Fullscreen enter/exit + keydown-scoped-to-root pattern** — no existing analog in this codebase (native browser API, first use in this project). Use RESEARCH.md's `enterPresentation`/`handleFullscreenChange` and keydown-on-root snippets verbatim (RESEARCH.md "Code Examples" section) — these are new code, not copied from an existing file, but are already fully specified there.

---

### `src/components/AudioPlayer.vue` (MODIFIED — additive `chromeless` prop)

**Full current file is 102 lines; excerpt the exact blocks the planner must extend, not rewrite:**

**Template `<audio>` element** (lines 6-16):
```vue
<audio
  ref="audioEl"
  :src="src"
  controls
  preload="none"
  class="w-full"
  @play="onPlay"
  @pause="onPause"
  @ended="onEnded"
  @error="onError"
/>
```
Additive change: replace `controls` with `:controls="!chromeless"` (per RESEARCH.md's exact Code Examples snippet).

**`defineProps` block** (lines 38-41):
```typescript
defineProps<{
  src: string
  label?: string
}>()
```
Additive change: add `chromeless?: boolean` (default false via `withDefaults` or optional-undefined-is-falsy check in the template).

**`defineExpose` block** (line 100):
```typescript
defineExpose({ play, pause })
```
No change needed here for AudioPlayer (only VideoPlayer needs the muted-state accessor per Pattern 3 of RESEARCH.md).

---

### `src/components/VideoPlayer.vue` (MODIFIED — additive `chromeless` prop + exposed muted accessor)

**Template `<video>` element** (lines 3-16):
```vue
<video
  ref="videoEl"
  :src="src"
  :poster="poster"
  :muted="muted"
  controls
  preload="none"
  playsinline
  class="w-full rounded max-h-48"
  @play="onPlay"
  @pause="onPause"
  @ended="onEnded"
  @error="onError"
/>
```
Additive change: `controls` → `:controls="!chromeless"`.

**`defineProps` block** (lines 40-43):
```typescript
defineProps<{
  src: string
  poster?: string
}>()
```
Additive change: add `chromeless?: boolean`.

**Existing internal `muted` ref** (line 54): `const muted = ref(false)` — already tracks the muted-retry state referenced in RESEARCH.md Pattern 3 (Assumption A2). Currently NOT exposed.

**`defineExpose` block** (line 116):
```typescript
defineExpose({ play, pause })
```
Additive change: expose a read accessor, e.g. `defineExpose({ play, pause, isMuted: computed(() => muted.value) })` (or similar), so `PresentationViewer.vue` can distinguish "muted retry succeeded" (show amber "tap to unmute" chip) from "muted retry also failed" (show full "Tap to play video" overlay) — both currently emit the same `autoplay-blocked` event (lines 99, 102) and must be told apart via this new exposed value, not a second event (per the locked STATE.md decision cited in RESEARCH.md).

---

### `src/components/SlideshowPreview.vue` (MODIFIED — add "Present Slideshow" CTA)

**Current header block to extend** (lines 3-5):
```vue
<div class="px-4 py-3 border-b border-gray-800">
  <h3 class="text-sm font-semibold text-gray-100">Slideshow Preview</h3>
</div>
```
Add the CTA button into this row (flex it) per UI-SPEC copy: `"Present Slideshow"`, disabled when `hasAnySlides` (line 119) is false.

**Disabled-button Tailwind idiom to copy verbatim** — `src/components/PptxImportModal.vue` (lines 196-198):
```vue
<button
  class="px-4 py-2 rounded-md text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
  :disabled="previewSlides.length === 0"
>
```
For `SlideshowPreview.vue` the disabled condition is `!hasAnySlides` (reuse the existing computed at line 119) and per UI-SPEC also needs `title="Add songs or scripture to build a slideshow to present."` when disabled.

Existing `hasAnySlides` computed to reuse as the disabled-guard (line 119):
```typescript
const hasAnySlides = computed(() => nonEmptySections.value.length > 0)
```
Note: the CTA's enabled/disabled state per UI-SPEC and RESEARCH.md is actually keyed off `assembledSlideshow.length === 0` (the flat array, passed down as a new prop from `ServiceEditorView`), not `sections` — `SlideshowPreview.vue` currently only receives `sections` (line 112-114 prop). The planner needs to either add a new prop (`slideCount: number` or pass `assembledSlideshow` directly) or derive disabled-state from the existing `hasAnySlides` computed if `sections`/`assembledSlideshow` counts always agree (verify against `useSlideshowAssembly.ts`).

---

### `src/views/ServiceEditorView.vue` (MODIFIED — destructure `assembledSlideshow`, mount viewer)

**Existing destructure site to extend** (line 1381):
```typescript
const { assembledSections } = useSlideshowAssembly(localService, orgIdRef)
```
Change to:
```typescript
const { assembledSections, assembledSlideshow } = useSlideshowAssembly(localService, orgIdRef)
```

**Existing `SlideshowPreview` mount site** (line 992):
```vue
<SlideshowPreview :sections="assembledSections" />
```
Add `:slideshow="assembledSlideshow"` (or similar new prop) and a `@present="presenting = true"` listener, then mount `<Teleport to="body"><PresentationViewer v-if="presenting" :slides="assembledSlideshow" @exit="presenting = false" /></Teleport>` alongside it (new `presenting` ref).

**Existing keydown add/remove lifecycle precedent** (lines 1676-1692) — NOT the pattern to copy for the viewer's own keydown (RESEARCH.md's Anti-Patterns section explicitly says do NOT bind on `window`/`document` for the viewer), but this IS the project's established add/remove-in-onMounted/onUnmounted idiom to mirror for whatever `ServiceEditorView`-level listeners (if any) the plan adds:
```typescript
onMounted(() => {
  initStores()
  function handleUndoKey(e: KeyboardEvent) { ... }
  document.addEventListener('keydown', handleUndoKey)
  onUnmounted(() => document.removeEventListener('keydown', handleUndoKey))
})
```
`PresentationViewer.vue` itself must instead bind `@keydown` on its own root element ref (see RESEARCH.md Code Examples), not via `document.addEventListener`.

---

### `src/components/__tests__/PresentationViewer.test.ts` (NEW)

**Teleport + DOMWrapper test pattern** — `src/components/__tests__/PptxImportModal.test.ts` (lines 1-2, 59-68):
```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises, DOMWrapper, enableAutoUnmount } from '@vue/test-utils'

// The modal renders its content via <Teleport to="body">, so the mounted
// wrapper's own DOM tree does not contain it — every assertion in this suite
// goes through body(), a DOMWrapper over document.body, per Vue Test Utils'
// documented Teleport testing pattern. Auto-unmount is enabled so each test
// starts clean.
enableAutoUnmount(afterEach)
function body() {
  return new DOMWrapper(document.body)
}
```

**Per-test `HTMLMediaElement.prototype.play`/`pause` mocking pattern** — `src/components/__tests__/VideoPlayer.test.ts` (lines 1-9):
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import VideoPlayer from '../VideoPlayer.vue'

describe('VideoPlayer', () => {
  beforeEach(() => {
    // jsdom does not implement HTMLMediaElement.play/pause — stub per test.
    window.HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined)
    window.HTMLMediaElement.prototype.pause = vi.fn()
  })
```
Rejection-path mocking (lines 31-47, for the "always rejects" / "muted-retry" tests):
```typescript
window.HTMLMediaElement.prototype.play = vi
  .fn()
  .mockRejectedValueOnce(new DOMException('blocked', 'NotAllowedError'))
  .mockResolvedValueOnce(undefined)
```
For `PresentationViewer.test.ts`, also stub `Element.prototype.requestFullscreen = vi.fn().mockRejectedValue(new Error('not supported'))` in `beforeEach` (jsdom has no Fullscreen API at all — per RESEARCH.md's Validation Architecture section, this is the only testable path; true-fullscreen-success is human-verify only).

**`AssembledSlide` fixture builders to reuse/copy** — `src/components/__tests__/SlideshowPreview.test.ts` (lines 6-58):
```typescript
function copyrightSlide(id: string): AssembledSlide {
  return {
    slide: {
      id, position: 0, contentKind: 'lyric',
      title: 'Amazing Grace', authors: ['John Newton'],
      ccliSongNumber: '22025', copyrightLines: ['Public Domain'], ccliLicenseNumber: '12345',
    },
    slotIndex: 0, slotKind: 'SONG', section: 'worship', sourceId: 'song-1',
  }
}

function lyricSlide(id: string): AssembledSlide {
  return {
    slide: {
      id, position: 1, contentKind: 'lyric',
      sectionId: 'verse-1', sectionLabel: 'Verse 1',
      lines: ['Amazing grace, how sweet the sound', 'That saved a wretch like me'],
    },
    slotIndex: 0, slotKind: 'SONG', section: 'worship', sourceId: 'song-1',
  }
}

function scriptureSlide(id: string, section: AssembledSlide['section']): AssembledSlide {
  return {
    slide: {
      id, position: 2, contentKind: 'scripture',
      reference: 'Romans 8:28-30',
      bookRef: { book: 'Romans', chapter: 8, verseStart: 28, verseEnd: 30 },
      text: '...', verseRange: 'vv. 28-29', readingMode: 'normal',
    },
    slotIndex: 1, slotKind: 'SCRIPTURE', section, sourceId: 'reading-1',
  }
}
```
Either import/reuse these three functions directly (if the planner extracts them to a shared test-fixture module) or duplicate the same shape inline in `PresentationViewer.test.ts` — both are acceptable per RESEARCH.md's Wave 0 Gaps note ("same shape, same file's pattern can be copied or the helpers extracted to a shared test-fixture module if the planner prefers DRY over duplication"). A new `videoSlide()`/`audioSlide()`/congregational-`scriptureSlide()` variant (with `sections` populated) will also be needed since none of the three existing builders carry `videoUrl`/`audioUrl`/`sections`.

---

## Shared Patterns

### Media play/pause driving contract (Phase 22, designed for this phase)
**Source:** `src/components/AudioPlayer.vue` lines 70-99, `src/components/VideoPlayer.vue` lines 77-114
**Apply to:** `PresentationViewer.vue`'s slide-transition watcher
```typescript
async function play(): Promise<void> {
  const el = videoEl.value
  if (!el) return
  try {
    await el.play()
    showPlayAffordance.value = false
    emit('play')
    return
  } catch (err) {
    if (!isNotAllowedError(err)) throw err
  }
  // ... muted retry (VideoPlayer only) ...
}
function pause(): void {
  videoEl.value?.pause()
}
defineExpose({ play, pause })
```
Both components already omit the native `autoplay` attribute specifically so this phase's driver has full control (documented in each file's own top-of-`<script setup>` comment, e.g. VideoPlayer.vue lines 32-38). The driver must capture the OUTGOING ref and call `.pause()` on it BEFORE swapping `currentIndex` (Pitfall 1 in RESEARCH.md).

### Discriminated-union slide-kind narrowing
**Source:** `src/components/SlideshowPreview.vue` lines 126-133
```typescript
type CardKind = 'lyric' | 'copyright' | 'scripture' | 'text' | 'image'
function cardKind(slide: Slide): CardKind {
  if (slide.contentKind === 'lyric') {
    return 'sectionId' in slide ? 'lyric' : 'copyright'
  }
  return slide.contentKind as CardKind
}
```
**Apply to:** `PresentationViewer.vue` — must be reused/adapted identically since `LyricSlide` and `CopyrightSlide` share `contentKind: 'lyric'` in the same `AssembledSlide.slide` union.

### Vue text-interpolation-only convention (no `v-html`)
**Source:** Codebase-wide convention, verified in `SlideshowPreview.vue` and `CongregationalEditor.vue` — no `v-html` used anywhere for slide/user content.
**Apply to:** All slide-content rendering in `PresentationViewer.vue` — interpolate with `{{ }}` only, never `v-html`, per RESEARCH.md's Security Domain section.

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| Fullscreen-API enter/exit + fullscreenchange sync logic (inside `PresentationViewer.vue`) | utility/lifecycle | event-driven | No existing component in this codebase uses the Fullscreen API; first use. RESEARCH.md's "Code Examples" section provides ready-to-use, fully-specified snippets (MDN-derived) since no in-repo analog exists. |
| Idle-timer chrome auto-hide (inside `PresentationViewer.vue`) | utility | event-driven | No existing component implements a mousemove/keydown-reset idle timer; ~10 lines of vanilla `setTimeout`/`clearTimeout`, no analog needed per RESEARCH.md's Don't-Hand-Roll table. |

## Metadata

**Analog search scope:** `src/components/`, `src/components/__tests__/`, `src/views/ServiceEditorView.vue`
**Files scanned:** `AudioPlayer.vue`, `VideoPlayer.vue`, `SlideshowPreview.vue`, `PptxImportModal.vue`, `CongregationalEditor.vue`, `ServiceEditorView.vue`, `PptxImportModal.test.ts`, `VideoPlayer.test.ts`, `SlideshowPreview.test.ts`, plus a repo-wide grep for `disabled` button idiom across `src/components/*.vue`
**Pattern extraction date:** 2026-07-25
