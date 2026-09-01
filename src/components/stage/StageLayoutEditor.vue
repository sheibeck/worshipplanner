<script setup lang="ts">
/**
 * Freeform drag canvas — the AUTHORING half of the visual stage layout
 * (R313/R314, Phase 107). The app's FIRST freeform-drag surface, built
 * deliberately on native Pointer Events (pointerdown/pointermove/pointerup +
 * setPointerCapture) — never Konva/interactjs/SortableJS/HTML5 DnD (STACK /
 * PITFALLS Pitfall 3: HTML5 DnD is mouse-only by spec and silently does not
 * fire on touch, which is exactly the device tech/sound volunteers use).
 *
 * The parent owns `elements` — this component NEVER mutates the prop array
 * in place; every change round-trips through an emit (add/update/remove/move)
 * so the parent's existing single autosave path stays the one source of
 * truth (ServiceEditorView mutates `localService.value.stageLayout` on these
 * events, mirroring `onToggleLoop`/`onSectionChange`).
 *
 * Drag persists on POINTERUP ONLY: pointermove updates a transient pixel
 * delta (`dragState`) for the VISUAL position, never emits, never touches
 * the prop. pointerup resolves the containing zone via bounding-rect
 * containment (`zoneFromPoint`, falling back to the marker's current zone
 * when dropped outside both) and clamped `xPct/yPct` (`pctWithinRect` +
 * defensive `clampPct`), then emits exactly ONE `move` — no per-move write
 * storm (T-107-04). Each zone's `getBoundingClientRect()` is fetched fresh
 * at drag-START (pointerdown), never cached across mount or across a prior
 * drag interaction, so a resize/reflow between drags can never desync the
 * drop math (PITFALLS Pitfall 3).
 *
 * A pointerdown->pointerup with no meaningful movement is a CLICK, not a
 * drag — it opens the edit popover instead of emitting `move`. The editable
 * zone containers deliberately do NOT set `overflow-hidden` (unlike the
 * read-only `StageLayoutView`, which does, for clean print/share framing) —
 * a dragged chip must be able to visually cross from one zone box into the
 * other while the pointer is down, and clipping it at the zone boundary
 * would defeat the entire "drag between zones" interaction.
 *
 * When `editable` is false (locked service), this component renders the
 * SAME shared read-only `StageLayoutView` used by share/print — no third
 * rendering path, no drag handles, no add/edit/delete controls.
 */
import { ref, computed, nextTick, onUnmounted } from 'vue'
import type { StageMarker } from '@/types/service'
import { clampPct, pctWithinRect, zoneFromPoint, createMarker, markerKindAccentClass, MARKER_KINDS } from '@/utils/stageLayout'
import StageLayoutView from '@/components/stage/StageLayoutView.vue'
import StageMarkerChip from '@/components/stage/StageMarkerChip.vue'

const props = defineProps<{
  elements: StageMarker[]
  editable: boolean
}>()

const emit = defineEmits<{
  add: [marker: StageMarker]
  update: [marker: StageMarker]
  remove: [id: string]
  move: [payload: { id: string; zone: StageMarker['zone']; xPct: number; yPct: number }]
}>()

const KIND_LABELS: Record<(typeof MARKER_KINDS)[number], string> = {
  instrument: 'Instrument',
  mic: 'Mic',
  monitor: 'Monitor',
  other: 'Other',
}

const onstageMarkers = computed(() => props.elements.filter((m) => m.zone === 'onstage'))
const offstageMarkers = computed(() => props.elements.filter((m) => m.zone === 'offstage'))

function accentClass(marker: StageMarker): string {
  return markerKindAccentClass(marker.kind, 'dark')
}

// ── Add-marker flow ──────────────────────────────────────────────────────────
const showAddForm = ref(false)
const addForm = ref<{ label: string; kind: StageMarker['kind'] | ''; zone: StageMarker['zone'] }>({
  label: '',
  kind: '',
  zone: 'onstage',
})
const addLabelInputEl = ref<HTMLInputElement | null>(null)
// Defaults the NEXT add-marker form's zone toggle to whichever zone the user
// last interacted with (an add, or a drag/move-zone), falling back to On
// Stage on first open — 107-UI-SPEC's copywriting contract.
const lastInteractedZone = ref<StageMarker['zone']>('onstage')

async function openAddForm() {
  addForm.value = { label: '', kind: '', zone: lastInteractedZone.value }
  showAddForm.value = true
  await nextTick()
  addLabelInputEl.value?.focus()
}

function cancelAddForm() {
  showAddForm.value = false
}

function submitAdd() {
  const label = addForm.value.label.trim()
  if (!label) return
  const marker = createMarker({
    label,
    zone: addForm.value.zone,
    xPct: 50,
    yPct: 50,
    ...(addForm.value.kind ? { kind: addForm.value.kind } : {}),
  })
  emit('add', marker)
  lastInteractedZone.value = addForm.value.zone
  showAddForm.value = false
}

// ── Edit popover (label/kind/move-zone/remove-confirm) ─────────────────────
const editingMarkerId = ref<string | null>(null)
const editForm = ref<{ label: string; kind: StageMarker['kind'] | '' }>({ label: '', kind: '' })
const showRemoveConfirm = ref(false)

const editingMarker = computed(() => props.elements.find((m) => m.id === editingMarkerId.value) ?? null)

function openEditPopover(marker: StageMarker) {
  editingMarkerId.value = marker.id
  editForm.value = { label: marker.label, kind: marker.kind ?? '' }
  showRemoveConfirm.value = false
}

/** The chip's own delete icon jumps straight to the confirm row inside the
 *  same popover — a shortcut into the same single remove flow the popover's
 *  own trigger uses, not a second implementation. */
function openRemoveConfirmDirect(marker: StageMarker) {
  openEditPopover(marker)
  showRemoveConfirm.value = true
}

function closeEditPopover() {
  editingMarkerId.value = null
  showRemoveConfirm.value = false
}

function saveEdit() {
  const current = editingMarker.value
  if (!current) return
  const label = editForm.value.label.trim()
  if (!label) return
  const updated: StageMarker = {
    id: current.id,
    label,
    zone: current.zone,
    xPct: current.xPct,
    yPct: current.yPct,
    ...(editForm.value.kind ? { kind: editForm.value.kind } : {}),
  }
  emit('update', updated)
  closeEditPopover()
}

function otherZone(marker: StageMarker): StageMarker['zone'] {
  return marker.zone === 'onstage' ? 'offstage' : 'onstage'
}

function otherZoneLabel(marker: StageMarker): string {
  return otherZone(marker) === 'onstage' ? 'On Stage' : 'Off Stage (Side)'
}

function onMoveZone() {
  const current = editingMarker.value
  if (!current) return
  const zone = otherZone(current)
  emit('move', { id: current.id, zone, xPct: clampPct(current.xPct), yPct: clampPct(current.yPct) })
  lastInteractedZone.value = zone
  closeEditPopover()
}

function confirmRemove() {
  const current = editingMarker.value
  if (!current) return
  emit('remove', current.id)
  closeEditPopover()
}

// ── Drag (native Pointer Events, drop-only persist) ─────────────────────────
interface DragState {
  markerId: string
  pointerId: number
  startClientX: number
  startClientY: number
  currentClientX: number
  currentClientY: number
  movedEnough: boolean
  onstageRect: DOMRect
  offstageRect: DOMRect
}

const DRAG_THRESHOLD_PX = 4

const dragState = ref<DragState | null>(null)
const onstageZoneEl = ref<HTMLElement | null>(null)
const offstageZoneEl = ref<HTMLElement | null>(null)

/** A resize/orientation-change or a scroll happening strictly BETWEEN
 *  pointerdown and pointerup (mid-drag) would leave `dragState`'s
 *  pointerdown-time `onstageRect`/`offstageRect` stale against the DOM's
 *  actual on-screen geometry, producing a wrong-zone or off-by-N% drop.
 *  Rather than re-measuring on every pointermove (expensive, and drop
 *  math only ever runs at pointerup), treat a reflow mid-drag exactly like
 *  `pointercancel` — the platform changed the ground out from under the
 *  gesture, so abort with no emit. Listeners are only ever live WHILE a
 *  drag is in flight (registered in `onChipPointerDown`, torn down as soon
 *  as the drag ends by any path), so this never manipulates the actual
 *  editor position and stays cheap to poll indefinitely. `scroll` is
 *  registered in the capture phase because a scroll on an ancestor
 *  container (not just `window`) does not bubble by default. */
function onWindowReflow() {
  if (!dragState.value) return
  dragState.value = null
  stopReflowGuard()
}

function startReflowGuard() {
  window.addEventListener('resize', onWindowReflow)
  window.addEventListener('scroll', onWindowReflow, true)
}

function stopReflowGuard() {
  window.removeEventListener('resize', onWindowReflow)
  window.removeEventListener('scroll', onWindowReflow, true)
}

onUnmounted(stopReflowGuard)

/** Guards against a SECOND pointer starting a drag while one is already in
 *  flight — without this, a second finger landing on another chip (or the
 *  same chip) reassigns `dragState` mid-drag, which orphans the first
 *  chip's `setPointerCapture` (its own pointerup/pointercancel then no
 *  longer match `ds.markerId` and bail before releasing capture) and
 *  silently abandons the first drag. Ignoring the second pointerdown
 *  entirely — never calling `setPointerCapture` for it — means the first
 *  drag runs to completion untouched and the second pointer's own
 *  move/up/cancel events simply no-op below (`ds.markerId !== marker.id`). */
function onChipPointerDown(event: PointerEvent, marker: StageMarker) {
  if (!props.editable) return
  if (dragState.value) return // a drag is already in progress — ignore additional pointers
  const target = event.currentTarget as HTMLElement
  target.setPointerCapture?.(event.pointerId)
  // Recomputed fresh at the START of every drag — never cached across mount
  // or across a prior interaction (PITFALLS Pitfall 3).
  dragState.value = {
    markerId: marker.id,
    pointerId: event.pointerId,
    startClientX: event.clientX,
    startClientY: event.clientY,
    currentClientX: event.clientX,
    currentClientY: event.clientY,
    movedEnough: false,
    onstageRect: onstageZoneEl.value!.getBoundingClientRect(),
    offstageRect: offstageZoneEl.value!.getBoundingClientRect(),
  }
  startReflowGuard()
}

function onChipPointerMove(event: PointerEvent, marker: StageMarker) {
  const ds = dragState.value
  if (!ds || ds.markerId !== marker.id) return
  ds.currentClientX = event.clientX
  ds.currentClientY = event.clientY
  if (
    Math.abs(ds.currentClientX - ds.startClientX) > DRAG_THRESHOLD_PX ||
    Math.abs(ds.currentClientY - ds.startClientY) > DRAG_THRESHOLD_PX
  ) {
    ds.movedEnough = true
  }
}

function onChipPointerUp(event: PointerEvent, marker: StageMarker) {
  const ds = dragState.value
  if (!ds || ds.markerId !== marker.id) return
  // Sync from the pointerup event itself (not just the last pointermove) so
  // a click/drag with no interposed pointermove is still classified
  // correctly, and the drop math always reflects the FINAL pointer position.
  ds.currentClientX = event.clientX
  ds.currentClientY = event.clientY
  if (
    Math.abs(ds.currentClientX - ds.startClientX) > DRAG_THRESHOLD_PX ||
    Math.abs(ds.currentClientY - ds.startClientY) > DRAG_THRESHOLD_PX
  ) {
    ds.movedEnough = true
  }
  dragState.value = null
  stopReflowGuard()
  const target = event.currentTarget as HTMLElement
  if (target.hasPointerCapture?.(event.pointerId)) target.releasePointerCapture(event.pointerId)

  if (!ds.movedEnough) {
    openEditPopover(marker)
    return
  }

  const zone = zoneFromPoint(
    ds.currentClientX,
    ds.currentClientY,
    { onstage: ds.onstageRect, offstage: ds.offstageRect },
    marker.zone,
  )
  const targetRect = zone === 'onstage' ? ds.onstageRect : ds.offstageRect
  const { xPct, yPct } = pctWithinRect(ds.currentClientX, ds.currentClientY, targetRect)
  emit('move', { id: marker.id, zone, xPct: clampPct(xPct), yPct: clampPct(yPct) })
  lastInteractedZone.value = zone
}

/** pointercancel means the platform took the gesture away (e.g. the browser
 *  recognized a scroll) — abort the drag entirely: no move emit, no edit
 *  popover, just drop the transient visual state so the chip snaps back to
 *  its last PERSISTED (prop) position. */
function onChipPointerCancel(event: PointerEvent, marker: StageMarker) {
  const ds = dragState.value
  if (!ds || ds.markerId !== marker.id) return
  dragState.value = null
  stopReflowGuard()
  const target = event.currentTarget as HTMLElement
  if (target.hasPointerCapture?.(event.pointerId)) target.releasePointerCapture(event.pointerId)
}

/** Base position is ALWAYS the stored percentage (never a measured pixel) —
 *  this is what keeps a saved marker resize-stable and reload-exact (R314)
 *  by construction, exactly like StageLayoutView's own markerStyle. While
 *  actively dragging past the click threshold, a raw pointer-delta pixel
 *  offset is layered on top purely for the visual follow — it is never
 *  persisted; only the pointerup-resolved zone + percentage is emitted. */
function chipStyle(marker: StageMarker): Record<string, string> {
  const style: Record<string, string> = { left: `${marker.xPct}%`, top: `${marker.yPct}%` }
  const ds = dragState.value
  if (ds && ds.markerId === marker.id && ds.movedEnough) {
    const dx = ds.currentClientX - ds.startClientX
    const dy = ds.currentClientY - ds.startClientY
    style.transform = `translate(-50%, -50%) translate(${dx}px, ${dy}px)`
    style.zIndex = '20'
  } else {
    style.transform = 'translate(-50%, -50%)'
  }
  return style
}
</script>

<template>
  <div data-testid="stage-layout-editor">
    <template v-if="editable">
      <div v-if="elements.length === 0" class="mb-4">
        <h3 class="text-sm font-semibold text-gray-200">No stage layout yet</h3>
        <p class="mt-1 text-sm text-gray-400">
          Add a marker to show your tech team where each instrument, mic, or monitor goes — on stage
          or off to the side.
        </p>
      </div>

      <div class="mb-6 flex items-center justify-between">
        <button
          type="button"
          data-testid="add-marker-button"
          class="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-indigo-500"
          @click="openAddForm"
        >
          Add marker
        </button>
      </div>

      <div
        v-if="showAddForm"
        data-testid="add-marker-form"
        class="mb-4 space-y-3 rounded-lg border border-gray-700 bg-gray-900 p-4"
      >
        <div>
          <label class="mb-1 block text-xs font-medium text-gray-400">Label</label>
          <input
            ref="addLabelInputEl"
            v-model="addForm.label"
            type="text"
            data-testid="add-marker-label-input"
            placeholder="e.g. Lead Vocal, Drums, Guest speaker mic"
            class="w-full rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            @keyup.enter="submitAdd"
          />
        </div>
        <div>
          <label class="mb-1 block text-xs font-medium text-gray-400">Kind (optional)</label>
          <select
            v-model="addForm.kind"
            data-testid="add-marker-kind-select"
            class="w-full rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="">No kind</option>
            <option v-for="k in MARKER_KINDS" :key="k" :value="k">{{ KIND_LABELS[k] }}</option>
          </select>
        </div>
        <div>
          <label class="mb-1 block text-xs font-medium text-gray-400">Zone</label>
          <div class="flex gap-2">
            <button
              type="button"
              data-testid="add-marker-zone-onstage"
              class="rounded-md px-3 py-1.5 text-xs font-medium transition-colors"
              :class="addForm.zone === 'onstage' ? 'bg-indigo-600 text-white' : 'border border-gray-700 bg-gray-800 text-gray-300'"
              @click="addForm.zone = 'onstage'"
            >
              On Stage
            </button>
            <button
              type="button"
              data-testid="add-marker-zone-offstage"
              class="rounded-md px-3 py-1.5 text-xs font-medium transition-colors"
              :class="addForm.zone === 'offstage' ? 'bg-indigo-600 text-white' : 'border border-gray-700 bg-gray-800 text-gray-300'"
              @click="addForm.zone = 'offstage'"
            >
              Off Stage (Side)
            </button>
          </div>
        </div>
        <div class="flex items-center gap-2 pt-1">
          <button
            type="button"
            data-testid="add-marker-submit"
            class="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-indigo-500 disabled:opacity-50"
            :disabled="!addForm.label.trim()"
            @click="submitAdd"
          >
            Add
          </button>
          <button
            type="button"
            data-testid="add-marker-cancel"
            class="rounded-md border border-gray-700 bg-gray-800 px-3 py-1.5 text-sm font-medium text-gray-300 transition-colors hover:bg-gray-700"
            @click="cancelAddForm"
          >
            Cancel
          </button>
        </div>
      </div>

      <div class="grid grid-cols-1 gap-4 md:grid-cols-[2fr_1fr]">
        <div>
          <h3 class="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">ON STAGE</h3>
          <div
            ref="onstageZoneEl"
            data-testid="stage-zone-onstage"
            class="relative aspect-video w-full touch-none rounded-lg border border-gray-800 bg-gray-900"
          >
            <p
              v-if="onstageMarkers.length === 0"
              class="pointer-events-none absolute inset-0 flex items-center justify-center text-sm italic text-gray-500"
            >
              Drop markers here
            </p>
            <StageMarkerChip
              v-for="marker in onstageMarkers"
              :key="marker.id"
              :marker="marker"
              :accent-class="accentClass(marker)"
              :chip-style="chipStyle(marker)"
              @pointerdown="onChipPointerDown($event, marker)"
              @pointermove="onChipPointerMove($event, marker)"
              @pointerup="onChipPointerUp($event, marker)"
              @pointercancel="onChipPointerCancel($event, marker)"
              @edit="openEditPopover(marker)"
              @remove="openRemoveConfirmDirect(marker)"
            />
          </div>
        </div>

        <div>
          <h3 class="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">OFF STAGE (SIDE)</h3>
          <div
            ref="offstageZoneEl"
            data-testid="stage-zone-offstage"
            class="relative aspect-video w-full touch-none rounded-lg border border-dashed border-gray-700 bg-gray-950"
          >
            <p
              v-if="offstageMarkers.length === 0"
              class="pointer-events-none absolute inset-0 flex items-center justify-center text-sm italic text-gray-500"
            >
              Drop markers here
            </p>
            <StageMarkerChip
              v-for="marker in offstageMarkers"
              :key="marker.id"
              :marker="marker"
              :accent-class="accentClass(marker)"
              :chip-style="chipStyle(marker)"
              @pointerdown="onChipPointerDown($event, marker)"
              @pointermove="onChipPointerMove($event, marker)"
              @pointerup="onChipPointerUp($event, marker)"
              @pointercancel="onChipPointerCancel($event, marker)"
              @edit="openEditPopover(marker)"
              @remove="openRemoveConfirmDirect(marker)"
            />
          </div>
        </div>
      </div>

      <div
        v-if="editingMarker"
        data-testid="marker-edit-popover"
        class="mt-4 max-w-sm space-y-3 rounded-lg border border-gray-700 bg-gray-900 p-4"
      >
        <template v-if="!showRemoveConfirm">
          <div>
            <label class="mb-1 block text-xs font-medium text-gray-400">Label</label>
            <input
              v-model="editForm.label"
              type="text"
              data-testid="edit-marker-label-input"
              class="w-full rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label class="mb-1 block text-xs font-medium text-gray-400">Kind (optional)</label>
            <select
              v-model="editForm.kind"
              data-testid="edit-marker-kind-select"
              class="w-full rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="">No kind</option>
              <option v-for="k in MARKER_KINDS" :key="k" :value="k">{{ KIND_LABELS[k] }}</option>
            </select>
          </div>
          <button
            type="button"
            data-testid="move-zone-button"
            class="text-sm text-indigo-400 transition-colors hover:text-indigo-300"
            @click="onMoveZone"
          >
            Move to {{ otherZoneLabel(editingMarker) }}
          </button>
          <div class="flex items-center gap-2 pt-1">
            <button
              type="button"
              data-testid="marker-edit-save"
              class="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-indigo-500 disabled:opacity-50"
              :disabled="!editForm.label.trim()"
              @click="saveEdit"
            >
              Save
            </button>
            <button
              type="button"
              data-testid="marker-edit-cancel"
              class="rounded-md border border-gray-700 bg-gray-800 px-3 py-1.5 text-sm font-medium text-gray-300 transition-colors hover:bg-gray-700"
              @click="closeEditPopover"
            >
              Cancel
            </button>
          </div>
          <div class="border-t border-gray-800 pt-2">
            <button
              type="button"
              data-testid="marker-edit-remove-trigger"
              class="text-sm text-red-400 transition-colors hover:text-red-300"
              @click="showRemoveConfirm = true"
            >
              Remove marker
            </button>
          </div>
        </template>
        <template v-else>
          <p class="text-sm text-red-300">Remove this marker? This can't be undone.</p>
          <div data-testid="marker-remove-confirm" class="flex items-center gap-2">
            <button
              type="button"
              data-testid="marker-remove-confirm-button"
              class="rounded-md bg-red-700 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-red-600"
              @click="confirmRemove"
            >
              Remove
            </button>
            <button
              type="button"
              data-testid="marker-remove-cancel-button"
              class="rounded-md border border-gray-700 bg-gray-800 px-3 py-1.5 text-xs font-medium text-gray-300 transition-colors hover:bg-gray-700"
              @click="showRemoveConfirm = false"
            >
              Cancel
            </button>
          </div>
        </template>
      </div>
    </template>

    <StageLayoutView v-else :elements="elements" theme="dark" />
  </div>
</template>
