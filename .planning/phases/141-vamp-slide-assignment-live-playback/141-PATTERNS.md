# Phase 141: Vamp Slide Assignment & Live Playback - Pattern Map

**Mapped:** 2026-09-13
**Files analyzed:** 13
**Analogs found:** 13 / 13 (all have strong, named precedents — RESEARCH.md already did most of this
work at file/line granularity; this document packages it for the planner)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/types/slideGroup.ts` | model | CRUD (additive fields) | same file, `GroupSlideEntry.audioUrl`/`audioLoop` | exact (same interface) |
| `src/components/VampPicker.vue` (new) | component | request-response (list + select) | `src/components/VampTable.vue` (row/search shape) | role-match |
| `src/components/slides/EditSlideDrawer.vue` | component | CRUD (write path) | same file, `attachSlideAudio`/`removeSlideAudio` | exact (same file, sibling function) |
| `src/components/slides/SlideCanvas.vue` | component | streaming (media render gate) | same file, `suppressBackground` | exact (mirror prop) |
| `src/components/output/FullscreenSlideOutput.vue` | component | streaming | same file's existing `SlideCanvas` mounts | exact |
| `src/views/ConfidenceOutputView.vue` | component | streaming | same file's existing `SlideCanvas` mounts | exact |
| `src/composables/useRunControl.ts` | hook/composable | event-driven (watchers on live state) | same file, `reconcileLoop`/`postBlackout` | exact (same file, sibling logic) |
| `src/views/RunControlView.vue` | component | event-driven | same file, `cancelBtnRef` template-ref pattern | exact |
| `src/components/run/RunHeader.vue` | component | request-response (toggle) | same file, `.run-blackout` toggle | exact |
| `src/components/run/RunPreviewPair.vue` | component | streaming (read-only badge) | same file, existing LIVE/Rehearsing tag | exact |
| `src/stores/vamps.ts` | store/service | CRUD + batch scan | `src/stores/services.ts` `resyncRehearseAccessForSong` | role-match (cross-collection scan) |
| `src/components/VampSlideOver.vue` | component | request-response (confirm dialog) | same file, Phase 140 delete-confirm block | exact |
| `src/views/ServiceEditorView.vue` (`initStores`) | provider/init | event-driven (subscribe) | same file, `rosterStore`/`quartersStore`/`teamsStore` gated subscribe | exact |

## Pattern Assignments

### `src/types/slideGroup.ts` (model, CRUD)

**Analog:** same file, `GroupSlideEntry` (lines 55-75)

Add two optional, display-only fields beside the existing `audioUrl`/`audioLoop`:
```typescript
// src/types/slideGroup.ts:69-72 (existing, for context) — add directly below audioLoop
/** Per-slide audio (R030) — audio only, there is no per-slide video layer. */
audioUrl?: string
/** D-04: loop is a per-slide flag only — a group bed never loops. */
audioLoop?: boolean
/** R437 — denormalized vamp assignment (display-only; never live-resolved). */
vampId?: string
vampLabel?: string
```
Follow the file's own doc-comment convention (short comment, rationale in ADR if needed) — see the
`label` field's comment above it for the house style of explaining a field's constraints inline.

---

### `src/components/VampPicker.vue` (new component, request-response)

**Analog:** `src/components/VampTable.vue` (row cell shape: name / mono key chip / tempo, search
filtering) and `src/stores/vamps.ts`'s `filteredVamps` computed (lines 106-112).

**Search/filter pattern to mirror** (`src/stores/vamps.ts:106-112`):
```typescript
const filteredVamps = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  if (!q) return vamps.value
  return vamps.value.filter(
    (v) => v.name.toLowerCase().includes(q) || v.key.toLowerCase().includes(q),
  )
})
```
`VampPicker.vue` should own its own local search string (not reuse the store's global
`searchQuery`, which belongs to the Vamps tab) and run the identical `.name`/`.key` filter locally.

**Markup:** use the exact class strings and `data-testid`s given in `141-UI-SPEC.md` §1 (picker
trigger, panel, enabled row, disabled row, empty states) — these are locked, not discretionary.

**Selection write:** picker does not write Firestore itself; it emits a `select` (vamp) event that
`EditSlideDrawer.vue` handles via `attachVampToSlide` (see next section). Disabled rows (no MP3) are
non-interactive — `aria-disabled="true"`, no click handler, matching the UI-SPEC's disabled-row markup.

---

### `src/components/slides/EditSlideDrawer.vue` (component, CRUD write path)

**Analog:** same file, `attachSlideAudio` (lines 867-874), `removeSlideAudio` (lines 907-918),
`removeSlideBackground` (lines 992-1004).

**Assign pattern** (new function, modeled on `attachSlideAudio`):
```typescript
// Source: EditSlideDrawer.vue:867-874 (attachSlideAudio), narrowed for vamp assignment
async function attachVampToSlide(vamp: Vamp): Promise<void> {
  if (!props.group || !props.entry || !vamp.attachment) return
  const entryId = props.entry.id
  const base = props.group.slides
  const next = base.map((e) =>
    e.id === entryId
      ? { ...e, audioUrl: vamp.attachment!.downloadUrl, audioLoop: true, vampId: vamp.id, vampLabel: `${vamp.name} · ${vamp.key}` }
      : e,
  )
  await slideGroupsStore.replaceGroupSlides(props.orgId, props.group.slotId, next, props.group.sourceSignature, base)
}
```

**Clear pattern** — MUST `delete` keys on a shallow copy (not set `undefined` inline), matching the
established `removeSlideAudio`/`removeSlideBackground` idiom in this exact file:
```typescript
// Source: EditSlideDrawer.vue:907-918 (removeSlideAudio), narrowed for vamp clear
async function clearVampAssignment(): Promise<void> {
  if (!props.group || !props.entry) return
  const entryId = props.entry.id
  const base = props.group.slides
  const next = base.map((e) => {
    if (e.id !== entryId) return e
    const rest = { ...e }
    delete rest.vampId
    delete rest.vampLabel
    delete rest.audioUrl
    delete rest.audioLoop
    return rest
  })
  await slideGroupsStore.replaceGroupSlides(props.orgId, props.group.slotId, next, props.group.sourceSignature, base)
}
```
`replaceGroupSlides` already deep-strips `undefined` via `stripUndefined()` (`src/utils/stripUndefined.ts:6-22`),
so this idiom is followed for file-local consistency, not because it's functionally required.

**Assigned row markup:** use `141-UI-SPEC.md` §2 verbatim (`data-testid="vamp-assigned-row"` /
`vamp-assigned-label` / `vamp-assigned-stale` / `vamp-change` / `vamp-clear`); the existing
`audio-loop-row` checkbox and chromeless `AudioPlayer` row stay unchanged beneath it.

**Stale hint:** compute `vampStale` as `entry.vampId && !vampStore.vamps.find(v => v.id === entry.vampId)`
— same "does this id still resolve in the loaded store list" idiom as any other soft-reference check in
this codebase; do not add a new fetch.

---

### `src/components/slides/SlideCanvas.vue` (component, streaming/render-gate)

**Analog:** same file, `suppressBackground` prop and `currentBackgroundUrl` computed.

**Existing prop declaration** (`SlideCanvas.vue:332-341`):
```typescript
const props = defineProps<{
  slide: AssembledSlide | null
  suppressBackground?: boolean
  interactive?: boolean
}>()
```
**Add** `suppressAudio?: boolean` to this same interface.

**Existing gate to mirror** (`SlideCanvas.vue:403-408`, applied to background):
```typescript
const currentBackgroundUrl = computed<string | null>(() => {
  if (props.slide?.slide.contentKind === 'blackout') return null
  if (props.suppressBackground) return null
  if (currentVideoUrl.value) return null
  return props.slide?.slide.backgroundImageUrl ?? null
})
```
**New audio gate** (currently `SlideCanvas.vue:387`, unconditional):
```typescript
// Before: const currentAudioUrl = computed<string | null>(() => props.slide?.slide.audioUrl ?? null)
const currentAudioUrl = computed<string | null>(() =>
  props.suppressAudio ? null : (props.slide?.slide.audioUrl ?? null),
)
```
This alone also gates the mount at `SlideCanvas.vue:249-264` (`<div v-if="currentAudioUrl && !mediaFailed">`
wrapping `<AudioPlayer>`) — no separate template change needed since it's driven by the same computed.

---

### `src/components/output/FullscreenSlideOutput.vue` / `src/views/ConfidenceOutputView.vue` (streaming)

**Analog:** each file's own existing `<SlideCanvas>` mount sites (no prior `suppressAudio` prop exists
anywhere yet — this is the first consumer).

Hardcode `:suppress-audio="true"` at each of the 4 known call sites (2 in `FullscreenSlideOutput.vue`
for the full-stage + video-banner canvases, 2 in `ConfidenceOutputView.vue` for current + next panes) —
mirroring how `ConfidenceOutputView.vue` already passes `:suppressBackground="true"` on its panes:
```vue
<!-- FullscreenSlideOutput.vue -->
<SlideCanvas ref="slideCanvasRef" :slide="currentSlide" :interactive="false" :suppress-audio="true" />
<SlideCanvas ref="bannerSlideCanvasRef" :slide="currentSlide" :interactive="false" :suppress-audio="true" />

<!-- ConfidenceOutputView.vue -->
<SlideCanvas ref="currentCanvasRef" :slide="currentSlide" :suppressBackground="true" :interactive="false" :suppress-audio="true" />
<SlideCanvas :slide="nextSlide" :suppressBackground="true" :interactive="false" :suppress-audio="true" />
```
`AudienceOutputView.vue`/`VideoOutputView.vue` are unchanged — they delegate entirely to
`FullscreenSlideOutput.vue`, so the two edits there cover all three outputs.

---

### `src/composables/useRunControl.ts` (composable, event-driven)

**Analog:** same file's `reconcileLoop`/`postBlackout` blackout-aware watcher pattern
(`useRunControl.ts:169-174, 191-200`), and the existing `cancelBtnRef` template-ref-owned-by-composable
pattern (bound in `RunControlView.vue:255`).

**New refs + arm toggle:**
```typescript
const audioElRef = ref<InstanceType<typeof AudioPlayer> | null>(null)
const armed = ref(false)
const audioBlocked = ref(false)
const audioUnavailable = ref(false)

function toggleArmed() {
  armed.value = !armed.value
  if (armed.value) void audioElRef.value?.play()
  else audioElRef.value?.pause()
}
```

**Blackout/slide-change-aware watchers** (mirrors `reconcileLoop`'s blackout-awareness):
```typescript
watch(current, async () => {
  audioBlocked.value = false
  audioUnavailable.value = false
  audioElRef.value?.pause()
  await nextTick()
  if (armed.value && !blackout.value) void audioElRef.value?.play()
})

watch(blackout, (v) => {
  if (v) audioElRef.value?.pause()
  else if (armed.value) void audioElRef.value?.play()
})
```
Reset `armed.value = false` and `audioElRef.value?.pause()` inside the existing
`endServiceTeardown()`/`endRehearsal()` functions, alongside their existing `live.value = false` /
`blackout.value = false` lines.

**Vamp-label lookup for the badge** (new — bypasses the assembler entirely, per RESEARCH.md Pattern 4):
```typescript
import { useSlideGroups } from '@/stores/slideGroups'
const slideGroupsStore = useSlideGroups()

function vampLabelFor(slide: AssembledSlide | null): string | null {
  if (!slide) return null
  const group = slideGroupsStore.groupsBySlotId.get(slide.groupId)
  const entry = group?.slides.find((e) => e.id === slide.groupSlideId)
  return entry?.vampLabel ?? null
}
const currentVampLabel = computed(() => vampLabelFor(current.value))
const nextVampLabel = computed(() => vampLabelFor(next.value))
```
Do **not** read `current.value?.slide.vampLabel` — that field does not exist on `AssembledSlide`/`Slide`
(CONTEXT.md deliberately keeps the assembler unaware of vamps).

**Error handling to reuse (not re-derive):** `AudioPlayer.vue`'s existing `play()` (lines 79-102)
already distinguishes `NotAllowedError` (→ emit `autoplay-blocked`) from `AbortError` (swallowed per
ADR-0061) from any other rejection (re-thrown) — bind `@autoplay-blocked="audioBlocked = true"` and
`@error="audioUnavailable = true"` on the new mount; do not write a new try/catch.

---

### `src/views/RunControlView.vue` (component, event-driven)

**Analog:** same file, `cancelBtnRef` binding at line 255 (composable-owned ref, bound via
`ref="cancelBtnRef"` in the template).

**New mount** (chromeless, matching `EditSlideDrawer.vue:299`'s own chromeless `AudioPlayer` usage):
```vue
<AudioPlayer
  v-if="current?.slide.audioUrl"
  ref="audioElRef"
  chromeless
  :src="current.slide.audioUrl"
  :loop="current.slide.audioLoop"
  @autoplay-blocked="audioBlocked = true"
  @error="audioUnavailable = true"
/>
```
**Blocked banner** — sibling to existing `run-blocked-banner`/`run-partial-banner` Tailwind blocks, use
`141-UI-SPEC.md` §4 markup verbatim (`data-testid="run-audio-blocked-banner"` / `run-audio-blocked-retry`).

**Unavailable indicator** — compact inline span, `141-UI-SPEC.md` §5 verbatim
(`data-testid="run-audio-unavailable"`).

---

### `src/components/run/RunHeader.vue` (component, request-response toggle)

**Analog:** same file's `.run-blackout` toggle (CSS-var scoped-style idiom, 44px min-height touch target).

Use `141-UI-SPEC.md` §3 verbatim for markup, CSS class names (`run-audio-toggle`,
`run-audio-toggle--armed`, `run-audio-toggle--needed`, `run-audio-toggle__dot`), and the amber pulse
keyframes. Placed immediately left of the blackout toggle. `data-testid="run-audio-toggle"`.

---

### `src/components/run/RunPreviewPair.vue` (component, streaming/read-only)

**Analog:** same file's existing LIVE/Rehearsing tag (font-semibold 600) — the new ♪ badge
deliberately uses font-medium (500), one weight lighter, per UI-SPEC.

Use `141-UI-SPEC.md` §6 markup verbatim: `data-testid="run-current-vamp-badge"` (and the equivalent
`next` variant), bound to `currentVampLabel`/`nextVampLabel` from `useRunControl.ts` (not read off the
assembled slide — see Pitfall 3 in RESEARCH.md).

Note (Pitfall 5, optional cleanup): this file's own embedded `<SlideCanvas>` preview mounts
(lines ~58, 103) have no `ref` and never call `.play()` — already inert. Passing `:suppress-audio="true"`
there too is a zero-risk, optional cleanup at the planner's discretion, not required for correctness.

---

### `src/stores/vamps.ts` (store, CRUD + batch scan)

**Analog:** `src/stores/services.ts` `resyncRehearseAccessForSong` (lines 791+) — the cross-collection
`getDocs` scan pattern; `src/utils/myScheduleGrouping.ts:23` `todayYmd()` for the date-comparison idiom.

**Existing `deleteVamp` to branch** (`src/stores/vamps.ts:93-104`, read in full above):
```typescript
async function deleteVamp(id: string) {
  if (!orgId.value) return
  const vamp = vamps.value.find((v) => v.id === id)
  if (vamp?.attachment?.storagePath) {
    try {
      await deleteObject(storageRef(storage, vamp.attachment.storagePath))
    } catch (err) {
      console.error(`deleteVamp: failed to delete attachment ${vamp.attachment.storagePath}:`, err)
    }
  }
  await deleteDoc(doc(db, 'organizations', orgId.value, 'vamps', id))
}
```
Must become conditional on an any-assignment check: only run the `deleteObject` Storage cascade when
NO slide anywhere references this `vampId`; always `deleteDoc` regardless (matches CONTEXT.md's
"deletion is never blocked").

**New best-effort scan** (mirrors `resyncRehearseAccessForSong`'s shape):
```typescript
// Narrow of src/stores/services.ts:791+ (resyncRehearseAccessForSong)'s scan shape
async function countAssignments(vampId: string): Promise<number | null> {
  const org = orgId.value
  if (!org) return null
  try {
    const groupsSnap = await getDocs(collection(db, 'organizations', org, 'slideGroups'))
    const serviceIds = new Set<string>()
    for (const d of groupsSnap.docs) {
      const data = d.data() as SlideGroup
      if (data.slides.some((e) => e.vampId === vampId)) serviceIds.add(data.serviceId)
    }
    if (serviceIds.size === 0) return 0
    const today = todayYmd()
    const results = await Promise.all(
      [...serviceIds].map((sid) => getDoc(doc(db, 'organizations', org, 'services', sid))),
    )
    return results.filter((s) => s.exists() && (s.data() as Service).date >= today).length
  } catch (err) {
    console.error('countAssignments: scan failed:', err)
    return null // caller shows the generic "may be assigned to slides" fallback
  }
}
```
**Task-boundary note:** `countAssignments`'s return (upcoming-only count) is a DIFFERENT signal from
`deleteVamp`'s Storage-keep decision (any assignment, any service — including past). Either run a
second, simpler "has any assignment at all" boolean scan inside `deleteVamp` itself, or refactor the
scan into a shared helper returning both `{ hasAny: boolean, upcomingCount: number }`. Do not conflate
the two by reusing the upcoming-only count as the Storage-keep trigger.

---

### `src/components/VampSlideOver.vue` (component, request-response confirm dialog)

**Analog:** same file's existing Phase 140 delete-confirm block (`rounded-lg bg-red-900/20
border border-red-800 p-4`).

Use `141-UI-SPEC.md` §7 markup verbatim — prepend the warning line (`data-testid="vamp-delete-warning"`
for the N-upcoming case, `vamp-delete-warning-generic` for scan failure) above the unchanged
`Delete "{name}"? This cannot be undone.` body. Call `useVampStore().countAssignments(vamp.id)` when the
delete-confirm state opens (not on every render) to avoid redundant scans.

---

### `src/views/ServiceEditorView.vue` (`initStores`, provider/init, event-driven subscribe)

**Analog:** same file's existing `authStore.isEditor`-gated subscribe block for
`rosterStore`/`quartersStore`/`teamsStore` (`ServiceEditorView.vue:3157-3185`).

```typescript
// Inside the existing `if (authStore.isEditor) { ... }` block in initStores(),
// alongside rosterStore.subscribe(orgId) / quartersStore.subscribe(orgId) / teamsStore.subscribe(orgId):
if (!vampStore.orgId) vampStore.subscribe(orgId)
```
**Must go inside the `isEditor` gate, not alongside the unconditional `songStore.subscribe`** — the
`vamps` Firestore collection has no dedicated rule block and falls through to the generic nested-collection
catch-all (`firestore.rules:508-513`), which requires `isOrgEditor(orgId)` for both read and write. A
viewer never sees the picker (`canMutate`-gated) so nothing is lost by scoping the subscription to
editors only. (See RESEARCH.md Pitfalls 1 & 2 for the full non-obvious rationale — this is NOT
optional, it's the fix for a real functional gap Phase 140 left behind.)

## Shared Patterns

### Fresh-base write for `GroupSlideEntry` mutations
**Source:** `src/components/slides/EditSlideDrawer.vue` (`attachSlideAudio` / `removeSlideAudio` /
`removeSlideBackground`)
**Apply to:** every write in `EditSlideDrawer.vue`/`VampPicker.vue` (`attachVampToSlide`,
`clearVampAssignment`) — read `props.group.slides` as `base`, map a new array, call
`slideGroupsStore.replaceGroupSlides(orgId, slotId, next, sourceSignature, base)`.

### `AudioPlayer.vue`'s autoplay-block/error contract (reused verbatim, not modified)
**Source:** `src/components/AudioPlayer.vue:79-102`
```typescript
async function play(): Promise<void> {
  const el = audioEl.value
  if (!el) return
  try {
    await el.play()
    showPlayAffordance.value = false
    emit('play')
  } catch (err) {
    if (err instanceof DOMException && err.name === 'NotAllowedError') {
      emit('autoplay-blocked')
      showPlayAffordance.value = true
      return
    }
    if (err instanceof DOMException && err.name === 'AbortError') {
      return // pause-interrupted-play, not a real failure — ADR-0061
    }
    throw err
  }
}
```
**Apply to:** `useRunControl.ts`'s new `audioElRef` bindings — listen to `@autoplay-blocked`/`@error`,
never re-derive the NotAllowedError/AbortError distinction.

### Cross-collection best-effort scan (advisory, never blocking)
**Source:** `src/stores/services.ts` `resyncRehearseAccessForSong` (lines 791+)
**Apply to:** `vamps.ts` `countAssignments` — same `getDocs` → filter → `getDoc` each → `todayYmd()`
string-compare shape; wrap in try/catch returning `null` on failure so the caller falls back to generic
copy, never blocking the underlying mutation (delete).

### `suppress*` prop mirroring for render-time gating
**Source:** `src/components/slides/SlideCanvas.vue` `suppressBackground` (added Phase 90/94)
**Apply to:** the new `suppressAudio` prop — identical shape (`computed` returns `null` when the flag
is set, gating both the resolved value and the `v-if` mount that depends on it).

## No Analog Found

None — RESEARCH.md's own investigation (grounded in reading every named file this session) found a
concrete, named precedent for all 13 files/edits. No task in this phase requires inventing a new
architectural shape.

## Metadata

**Analog search scope:** `src/components/`, `src/components/slides/`, `src/components/run/`,
`src/components/output/`, `src/composables/`, `src/stores/`, `src/types/`, `src/views/`
**Files scanned (read this pass):** `slideGroup.ts`, `SlideCanvas.vue`, `vamps.ts`, plus all files
already read and cited with line numbers in `141-RESEARCH.md` (`EditSlideDrawer.vue`, `AudioPlayer.vue`,
`useRunControl.ts`, `RunControlView.vue`, `RunHeader.vue`, `RunPreviewPair.vue`, `VampTable.vue`,
`VampSlideOver.vue`, `services.ts`, `ServiceEditorView.vue`, `slideshowAssembler.ts`,
`FullscreenSlideOutput.vue`, `ConfidenceOutputView.vue`, `firestore.rules`, `myScheduleGrouping.ts`,
`stripUndefined.ts`)
**Pattern extraction date:** 2026-09-13
