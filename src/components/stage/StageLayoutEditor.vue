<script setup lang="ts">
/**
 * The AUTHORING half of the visual stage layout (R313/R314, Phase 107),
 * redesigned to the single-room "Nocturne" diagram: a left PALETTE of typed
 * chips, one continuous room CANVAS (StageRoom), and — for editing a marker —
 * the app's existing right-hand slide-over pattern (matching RoleSlideOver /
 * TeamSlideOver: a Teleport modal with a backdrop and a buffered Save/Cancel
 * form). Click a chip to drop a marker, drag it where it stands, click it to
 * edit its label / assigned person / type / note.
 *
 * Placement is FREE (never snapped to a grid): pointerup resolves the exact
 * clamped `xPct/yPct` within the single room rect and derives the stored
 * `zone` from that position. Still native Pointer Events (never
 * Konva/interactjs/HTML5-DnD, which is mouse-only and dead on touch).
 *
 * The parent owns `elements`; this component NEVER mutates the prop array —
 * every change round-trips through an emit (add/update/remove/move) so the
 * parent's single autosave path stays the one source of truth.
 *
 * A marker can be named by picking a PERSON already serving this service (via
 * `assignablePeople`, resolved from the service's role assignments) OR by a
 * free-text LABEL — the label stays editable for a spot with no matching
 * assigned person (a guest, a spare, gear). The kind's TYPE is always shown
 * on the tile alongside the label, so a tile reads as both a name and a type.
 *
 * When `editable` is false (locked service) this renders the SAME shared
 * read-only `StageLayoutView` used by share/print — no third rendering path.
 */
import { ref, computed, onMounted, onUnmounted } from 'vue'
import type { StageMarker, StageMarkerKind } from '@/types/service'
import {
  clampPct,
  zoneFromPosition,
  placementLabel,
  createMarker,
  buildStagePalette,
  stagePaletteSkinClass,
  stageMarkerIcon,
  stageMarkerSkinClass,
  stageTypeLabel,
  isInstrumentKind,
  type StagePaletteItem,
} from '@/utils/stageLayout'

interface ServingAssignment {
  id: string
  name: string
  roleId: string
  roleName: string
}
import StageRoom from '@/components/stage/StageRoom.vue'
import StageMarkerChip from '@/components/stage/StageMarkerChip.vue'
import StageKindIcon from '@/components/stage/StageKindIcon.vue'
import StageLayoutView from '@/components/stage/StageLayoutView.vue'

const props = withDefaults(
  defineProps<{
    elements: StageMarker[]
    editable: boolean
    /** The org's Band roles — the Instruments palette mirrors these so a
     *  marker's instrument lines up with the role a person plays. */
    bandRoles?: { id: string; name: string }[]
    /** One entry per person-in-a-role serving this service (its resolved role
     *  assignments) — the pick-a-person source, shown as "Name - Role". A
     *  person in two roles appears twice. Empty when no one is assigned yet;
     *  the free-text label is always available regardless. */
    assignablePeople?: ServingAssignment[]
  }>(),
  { bandRoles: () => [], assignablePeople: () => [] },
)

const emit = defineEmits<{
  add: [marker: StageMarker]
  update: [marker: StageMarker]
  remove: [id: string]
  move: [payload: { id: string; zone: StageMarker['zone']; xPct: number; yPct: number }]
}>()

const palette = computed(() => buildStagePalette(props.bandRoles))
const roomComp = ref<InstanceType<typeof StageRoom> | null>(null)

// ── Add from palette ────────────────────────────────────────────────────────
// A dropped marker starts with NO free-text label (its type shows on the tile);
// the planner names it or picks a person afterwards. A small deterministic
// cascade off centre keeps back-to-back adds from stacking. The item carries
// either a fixed `kind` or a band `roleId`/`roleName`.
function onAddItem(item: StagePaletteItem) {
  if (!props.editable) return
  const n = props.elements.length
  const marker = createMarker({
    label: '',
    xPct: 47.5 + (n % 4) * 2.5,
    yPct: 30 + (n % 4) * 2.5,
    ...(item.kind ? { kind: item.kind } : {}),
    ...(item.roleId && item.roleName ? { roleId: item.roleId, roleName: item.roleName } : {}),
  })
  emit('add', marker)
}

// ── Edit slide-over (buffered form, matching RoleSlideOver) ──────────────────
interface EditForm {
  label: string
  kind: StageMarkerKind | ''
  roleId: string
  roleName: string
  note: string
  personId: string
  personName: string
  withVocal: boolean
}

const editingId = ref<string | null>(null)
const editForm = ref<EditForm>({ label: '', kind: '', roleId: '', roleName: '', note: '', personId: '', personName: '', withVocal: false })
const showDeleteConfirm = ref(false)
const editingMarker = computed(() => props.elements.find((m) => m.id === editingId.value) ?? null)
const drawerOpen = computed(() => editingMarker.value !== null)
const placement = computed(() =>
  editingMarker.value ? placementLabel(editingMarker.value.xPct, editingMarker.value.yPct) : '',
)

// Whether the current type is an instrument (band role OR an Instruments-group
// kind) — gates the "player also sings" checkbox and the "+ Vocal" label.
const editIsInstrument = computed(() => !!editForm.value.roleId || isInstrumentKind(editForm.value.kind || undefined))

// The Type <select> encodes a fixed kind as its key and a band role as
// `role:<roleId>`, so one control offers both.
const editTypeValue = computed<string>({
  get: () => (editForm.value.roleId ? `role:${editForm.value.roleId}` : editForm.value.kind),
  set: (value: string) => {
    if (value.startsWith('role:')) {
      const roleId = value.slice(5)
      const role = props.bandRoles.find((r) => r.id === roleId)
      editForm.value.roleId = roleId
      editForm.value.roleName = role?.name ?? ''
      editForm.value.kind = ''
    } else {
      editForm.value.kind = value as StageMarkerKind | ''
      editForm.value.roleId = ''
      editForm.value.roleName = ''
    }
  },
})

// Header preview marker (icon + skin) reflecting the buffered form.
const headerMarker = computed(() => ({ kind: editForm.value.kind || undefined, roleName: editForm.value.roleName || undefined }))

// Person picker: people serving this service, shown "Name - Role", with those
// assigned to THIS marker's band role floated to the front (lining people up
// with the instrument they play).
const orderedPeople = computed<ServingAssignment[]>(() => {
  const roleId = editForm.value.roleId
  if (!roleId) return props.assignablePeople
  const match = props.assignablePeople.filter((p) => p.roleId === roleId)
  const rest = props.assignablePeople.filter((p) => p.roleId !== roleId)
  return [...match, ...rest]
})

function openEdit(marker: StageMarker) {
  editingId.value = marker.id
  editForm.value = {
    label: marker.label,
    kind: marker.kind ?? '',
    roleId: marker.roleId ?? '',
    roleName: marker.roleName ?? '',
    note: marker.note ?? '',
    personId: marker.personId ?? '',
    personName: marker.personName ?? '',
    withVocal: marker.withVocal ?? false,
  }
  showDeleteConfirm.value = false
}

function closeDrawer() {
  editingId.value = null
  showDeleteConfirm.value = false
}

function selectPerson(person: ServingAssignment) {
  editForm.value.personId = person.id
  editForm.value.personName = person.name
  // The person's name is the marker's name now — clear the free-text label so
  // it isn't shown redundantly alongside them.
  editForm.value.label = ''
}
function clearPerson() {
  editForm.value.personId = ''
  editForm.value.personName = ''
  // Back to unassigned: fall the label back to the type (the band role name, or
  // the fixed kind's label) so the marker still reads as something.
  editForm.value.label = editForm.value.roleName || stageTypeLabel(editForm.value.kind || undefined)
}

/** Builds the persisted marker from the buffered form, keeping optional keys
 *  ABSENT (never `undefined`/`''`) when empty — the codebase's absent-not-
 *  undefined convention and what the stripUndefined save path expects. */
function buildFrom(marker: StageMarker, offsetX = 0): StageMarker {
  const note = editForm.value.note.trim()
  return {
    id: marker.id,
    label: editForm.value.label.trim(),
    zone: marker.zone,
    xPct: clampPct(marker.xPct + offsetX),
    yPct: marker.yPct,
    ...(editForm.value.roleId && editForm.value.roleName
      ? { roleId: editForm.value.roleId, roleName: editForm.value.roleName }
      : editForm.value.kind
        ? { kind: editForm.value.kind }
        : {}),
    ...(note ? { note } : {}),
    ...(editForm.value.personId ? { personId: editForm.value.personId, personName: editForm.value.personName } : {}),
    // Only persist the vocal flag when it's on AND the type is an instrument —
    // so switching away from an instrument can't strand a stale "+ Vocal".
    ...(editForm.value.withVocal && editIsInstrument.value ? { withVocal: true } : {}),
  }
}

function onSave() {
  const marker = editingMarker.value
  if (!marker || !props.editable) return
  emit('update', buildFrom(marker))
  closeDrawer()
}

function onDuplicate() {
  const marker = editingMarker.value
  if (!marker || !props.editable) return
  // Duplicate carries the (possibly edited) buffered form, offset to the side
  // with a fresh id.
  const base = buildFrom(marker, 6)
  const copy: StageMarker = { ...base, id: createMarker({ label: '', xPct: 0, yPct: 0 }).id }
  emit('add', copy)
  closeDrawer()
}

function onDelete() {
  const marker = editingMarker.value
  if (!marker || !props.editable) return
  emit('remove', marker.id)
  closeDrawer()
}

// ── Drag (native Pointer Events, drop-only persist, free placement) ─────────
interface DragState {
  markerId: string
  pointerId: number
  startClientX: number
  startClientY: number
  currentClientX: number
  currentClientY: number
  movedEnough: boolean
  roomRect: DOMRect
}

const DRAG_THRESHOLD_PX = 4
const dragState = ref<DragState | null>(null)

/** A resize/scroll mid-drag would stale the pointerdown-time room rect; treat
 *  it like pointercancel (abort, no emit). Listeners live only while dragging.
 *  `scroll` is captured because an ancestor scroll doesn't bubble to window. */
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

function onChipPointerDown(event: PointerEvent, marker: StageMarker) {
  if (!props.editable) return
  if (drawerOpen.value) return // editing modal is up (backdrop covers the canvas)
  if (dragState.value) return // a drag is already in progress — ignore extra pointers
  const rect = roomComp.value?.getRoomRect()
  if (!rect) return
  const target = event.currentTarget as HTMLElement
  target.setPointerCapture?.(event.pointerId)
  dragState.value = {
    markerId: marker.id,
    pointerId: event.pointerId,
    startClientX: event.clientX,
    startClientY: event.clientY,
    currentClientX: event.clientX,
    currentClientY: event.clientY,
    movedEnough: false,
    roomRect: rect,
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
  ds.currentClientX = event.clientX
  ds.currentClientY = event.clientY
  if (
    Math.abs(ds.currentClientX - ds.startClientX) > DRAG_THRESHOLD_PX ||
    Math.abs(ds.currentClientY - ds.startClientY) > DRAG_THRESHOLD_PX
  ) {
    ds.movedEnough = true
  }
  const moved = ds.movedEnough
  const rect = ds.roomRect
  dragState.value = null
  stopReflowGuard()
  const target = event.currentTarget as HTMLElement
  if (target.hasPointerCapture?.(event.pointerId)) target.releasePointerCapture(event.pointerId)

  if (!moved) {
    openEdit(marker) // a click opens the editor slide-over
    return
  }

  // Drop EXACTLY where the chip is shown — no jump. The visual follow is the
  // marker's stored position plus the raw pointer delta (see chipStyle), so the
  // persisted position must be that same delta applied to the stored position,
  // NOT the pointer's own coordinate (which would re-centre the chip under the
  // cursor and make it hop by however far from centre you grabbed it). Free
  // placement, no grid, no snap.
  const dxPct = rect.width === 0 ? 0 : ((ds.currentClientX - ds.startClientX) / rect.width) * 100
  const dyPct = rect.height === 0 ? 0 : ((ds.currentClientY - ds.startClientY) / rect.height) * 100
  const cx = clampPct(marker.xPct + dxPct)
  const cy = clampPct(marker.yPct + dyPct)
  emit('move', { id: marker.id, zone: zoneFromPosition(cx, cy), xPct: cx, yPct: cy })
}

function onChipPointerCancel(event: PointerEvent, marker: StageMarker) {
  const ds = dragState.value
  if (!ds || ds.markerId !== marker.id) return
  dragState.value = null
  stopReflowGuard()
  const target = event.currentTarget as HTMLElement
  if (target.hasPointerCapture?.(event.pointerId)) target.releasePointerCapture(event.pointerId)
}

/** Base position is ALWAYS the stored percentage (resize-stable, reload-exact).
 *  While dragging past threshold, a raw pointer-delta pixel offset is layered
 *  on for the visual follow only — never persisted. */
function chipStyle(marker: StageMarker): Record<string, string> {
  const style: Record<string, string> = { left: `${marker.xPct}%`, top: `${marker.yPct}%` }
  const ds = dragState.value
  if (ds && ds.markerId === marker.id && ds.movedEnough) {
    const dx = ds.currentClientX - ds.startClientX
    const dy = ds.currentClientY - ds.startClientY
    style.transform = `translate(-50%, -50%) translate(${dx}px, ${dy}px)`
    style.zIndex = '30'
  } else {
    style.transform = 'translate(-50%, -50%)'
  }
  return style
}

// Escape closes the editor slide-over (modal convention).
function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' && drawerOpen.value) closeDrawer()
}
onMounted(() => window.addEventListener('keydown', onKeydown))
onUnmounted(() => {
  window.removeEventListener('keydown', onKeydown)
  stopReflowGuard()
})
</script>

<template>
  <div data-testid="stage-layout-editor">
    <template v-if="editable">
      <!-- Palette on the LEFT, canvas on the right. The room has a HARD-CODED
           width (see StageRoom), so the palette's presence never changes the
           room's size — what you place while editing is exactly what shows when
           the service is locked, on the share link, and in print (WYSIWYG). The
           canvas scrolls horizontally on a narrow viewport rather than squeezing
           the fixed-width room. -->
      <div class="flex flex-col gap-4 lg:flex-row">
        <!-- Palette -->
        <div class="flex-none lg:w-56">
          <div class="mb-2">
            <p class="text-xs font-semibold uppercase tracking-wide text-gray-400">Place on the diagram</p>
            <p class="mt-0.5 text-xs text-gray-500">Click a chip to drop it, then drag it into position.</p>
          </div>
          <div class="flex flex-col gap-3">
            <div v-for="group in palette" :key="group.name">
              <p class="mb-1 pl-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-gray-600">
                {{ group.name }}
              </p>
              <p
                v-if="group.name === 'Instruments' && !group.items.some((i) => i.roleId)"
                class="pl-0.5 text-[11px] italic text-gray-600"
              >
                No band roles yet — add them in the Roles tab.
              </p>
              <div class="flex flex-wrap gap-1.5">
                <button
                  v-for="item in group.items"
                  :key="item.id"
                  type="button"
                  :data-testid="`palette-chip-${item.id}`"
                  class="inline-flex h-8 items-center gap-1.5 rounded-md border px-2 text-[11.5px] transition-colors hover:brightness-125"
                  :class="stagePaletteSkinClass(item.gear, 'dark')"
                  @click="onAddItem(item)"
                >
                  <StageKindIcon :name="item.icon" class="h-3.5 w-3.5" />
                  {{ item.label }}
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Canvas — the room is a fixed width (StageRoom); scroll if the
             viewport is too narrow rather than shrink the room. -->
        <div class="min-w-0 flex-1 overflow-x-auto">
          <StageRoom ref="roomComp" theme="dark">
            <StageMarkerChip
              v-for="marker in props.elements"
              :key="marker.id"
              :marker="marker"
              theme="dark"
              interactive
              :selected="marker.id === editingId"
              :style="chipStyle(marker)"
              @pointerdown="onChipPointerDown($event, marker)"
              @pointermove="onChipPointerMove($event, marker)"
              @pointerup="onChipPointerUp($event, marker)"
              @pointercancel="onChipPointerCancel($event, marker)"
            />
            <div
              v-if="props.elements.length === 0"
              class="pointer-events-none absolute left-1/2 top-[34%] flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1.5 text-center"
            >
              <span class="text-sm text-gray-500">Nothing placed yet</span>
              <span class="text-xs text-gray-600">Pick a chip on the left — vocals, instruments, mics, monitors.</span>
            </div>
          </StageRoom>
        </div>
      </div>

      <!-- Edit slide-over (existing app pattern: Teleport modal + backdrop) -->
      <Teleport to="body">
        <Transition
          enter-active-class="transition-opacity duration-200 ease-out"
          enter-from-class="opacity-0"
          enter-to-class="opacity-100"
          leave-active-class="transition-opacity duration-150 ease-in"
          leave-from-class="opacity-100"
          leave-to-class="opacity-0"
        >
          <div v-if="drawerOpen" class="fixed inset-0 z-40 bg-black/30" @click="closeDrawer" />
        </Transition>

        <Transition
          enter-active-class="transition-transform duration-250 ease-out"
          enter-from-class="translate-x-full"
          enter-to-class="translate-x-0"
          leave-active-class="transition-transform duration-200 ease-in"
          leave-from-class="translate-x-0"
          leave-to-class="translate-x-full"
        >
          <div
            v-if="drawerOpen && editingMarker"
            data-testid="marker-inspector"
            class="fixed inset-y-0 right-0 z-50 flex w-full max-w-[420px] flex-col border-l border-gray-800 bg-gray-900 shadow-2xl"
          >
            <!-- Header -->
            <div class="flex shrink-0 items-center gap-3 border-b border-gray-800 px-5 py-4">
              <div
                class="flex h-9 w-9 flex-none items-center justify-center rounded-lg border"
                :class="stageMarkerSkinClass(headerMarker, 'dark', false)"
              >
                <StageKindIcon :name="stageMarkerIcon(headerMarker)" class="h-4 w-4" />
              </div>
              <div class="min-w-0 flex-1">
                <h2 class="truncate text-base font-semibold text-gray-100">Edit marker</h2>
                <p class="text-[11px] text-gray-500">{{ placement }}</p>
              </div>
              <button
                type="button"
                class="rounded-md border border-gray-700 bg-gray-800 px-3 py-1.5 text-sm font-medium text-gray-300 transition-colors hover:bg-gray-700"
                @click="closeDrawer"
              >
                Cancel
              </button>
              <button
                type="button"
                data-testid="marker-save"
                class="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-indigo-500"
                @click="onSave"
              >
                Save
              </button>
              <button
                type="button"
                data-testid="marker-drawer-close"
                aria-label="Close"
                class="rounded-md p-1.5 text-gray-500 transition-colors hover:bg-gray-800 hover:text-gray-300"
                @click="closeDrawer"
              >
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <!-- Body -->
            <div class="flex-1 space-y-5 overflow-y-auto px-5 py-5">
              <div>
                <label class="mb-1 block text-xs font-medium text-gray-400">Type</label>
                <select
                  v-model="editTypeValue"
                  data-testid="marker-kind-select"
                  class="w-full rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-100 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="">Unspecified</option>
                  <optgroup v-for="group in palette" :key="group.name" :label="group.name">
                    <option v-for="item in group.items" :key="item.id" :value="item.kind ? item.kind : `role:${item.roleId}`">
                      {{ item.label }}
                    </option>
                  </optgroup>
                </select>
                <label
                  v-if="editIsInstrument"
                  class="mt-2 flex items-center gap-2 text-sm text-gray-300"
                >
                  <input
                    v-model="editForm.withVocal"
                    type="checkbox"
                    data-testid="marker-vocal-checkbox"
                    class="rounded border-gray-700 bg-gray-800 text-indigo-600 focus:ring-indigo-500"
                  />
                  Player also sings (add vocal)
                </label>
              </div>

              <div>
                <div class="mb-1 flex items-baseline justify-between">
                  <label class="block text-xs font-medium text-gray-400">Assigned person</label>
                  <span class="text-[11px] text-gray-600">optional</span>
                </div>
                <div v-if="orderedPeople.length" class="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    data-testid="person-pill-unassigned"
                    class="h-7 rounded-full border px-3 text-[11.5px] transition-colors"
                    :class="editForm.personId === '' ? 'border-indigo-600 bg-indigo-900/40 text-indigo-200' : 'border-gray-700 bg-gray-800 text-gray-400 hover:bg-gray-700'"
                    @click="clearPerson"
                  >
                    Unassigned
                  </button>
                  <button
                    v-for="person in orderedPeople"
                    :key="`${person.id}-${person.roleId}`"
                    type="button"
                    :data-testid="`person-pill-${person.id}-${person.roleId}`"
                    class="h-7 rounded-full border px-3 text-[11.5px] transition-colors"
                    :class="editForm.personId === person.id ? 'border-indigo-600 bg-indigo-900/40 text-indigo-200' : 'border-gray-700 bg-gray-800 text-gray-400 hover:bg-gray-700'"
                    @click="selectPerson(person)"
                  >
                    {{ person.name }} - {{ person.roleName }}
                  </button>
                </div>
                <p v-else class="text-[11px] leading-relaxed text-gray-600">
                  No one is serving this service yet. Assign people in the Roles tab to pick them here, or just type a
                  label below.
                </p>
              </div>

              <div>
                <label class="mb-1 block text-xs font-medium text-gray-400">
                  Label
                  <span class="font-normal text-gray-600">(a name, or a note when no one is assigned)</span>
                </label>
                <input
                  v-model="editForm.label"
                  type="text"
                  data-testid="marker-label-input"
                  placeholder="e.g. Front left, Guest speaker"
                  class="w-full rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-100 placeholder-gray-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label class="mb-1 block text-xs font-medium text-gray-400">Note for the tech team</label>
                <textarea
                  v-model="editForm.note"
                  data-testid="marker-note-input"
                  rows="3"
                  placeholder="e.g. XLR run from stage left, needs a boom"
                  class="w-full resize-y rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-100 placeholder-gray-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <button
                type="button"
                data-testid="marker-duplicate"
                class="inline-flex h-9 w-full items-center justify-center gap-2 rounded-md border border-gray-700 text-sm text-gray-300 transition-colors hover:bg-gray-800"
                @click="onDuplicate"
              >
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h6a2 2 0 002-2v-2" />
                </svg>
                Duplicate marker
              </button>

              <!-- Delete (confirm row, mirroring RoleSlideOver) -->
              <div class="border-t border-gray-800 pt-3">
                <button
                  v-if="!showDeleteConfirm"
                  type="button"
                  data-testid="marker-delete-trigger"
                  class="text-sm text-red-400 transition-colors hover:text-red-300"
                  @click="showDeleteConfirm = true"
                >
                  Remove marker
                </button>
                <div v-else data-testid="marker-delete-confirm" class="rounded-md border border-red-800 bg-red-900/20 p-3">
                  <p class="text-sm text-red-300">Remove this marker? This can't be undone.</p>
                  <div class="mt-2 flex items-center gap-3">
                    <button
                      type="button"
                      data-testid="marker-delete"
                      class="rounded-md bg-red-700 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-red-600"
                      @click="onDelete"
                    >
                      Remove
                    </button>
                    <button
                      type="button"
                      data-testid="marker-delete-cancel"
                      class="rounded-md border border-gray-700 bg-gray-800 px-3 py-1.5 text-xs font-medium text-gray-300 transition-colors hover:bg-gray-700"
                      @click="showDeleteConfirm = false"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Transition>
      </Teleport>
    </template>

    <StageLayoutView v-else :elements="elements" theme="dark" />
  </div>
</template>
