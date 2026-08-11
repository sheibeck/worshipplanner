<template>
  <Teleport to="body">
    <!-- Deliberately NO scrim, structurally ported from EditSlideDrawer.vue
         (26-RESEARCH.md Pitfall 7 / R033-era decision) — the settings page
         underneath stays fully clickable while this panel is open. -->
    <Transition
      enter-active-class="transition-transform duration-250 ease-out"
      enter-from-class="translate-x-full"
      enter-to-class="translate-x-0"
      leave-active-class="transition-transform duration-200 ease-in"
      leave-from-class="translate-x-0"
      leave-to-class="translate-x-full"
    >
      <div
        v-if="isOpen"
        class="fixed inset-y-0 right-0 z-50 w-full max-w-[480px] bg-gray-900 border-l border-gray-800 shadow-2xl flex flex-col"
        data-testid="service-template-editor"
      >
        <!-- Header -->
        <div class="flex items-center justify-between gap-3 px-4 py-4 border-b border-gray-800 shrink-0">
          <h2 class="text-sm font-medium text-gray-100" data-testid="service-template-editor-title">Edit Default Template</h2>
          <button
            type="button"
            class="p-1.5 rounded-md text-gray-500 hover:text-gray-300 hover:bg-gray-800 transition-colors"
            aria-label="Close"
            data-testid="service-template-editor-close"
            @click="onClose"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <!-- Body — scrolls on its own; header/footer stay fixed. -->
        <div class="flex-1 overflow-y-auto px-4 py-4">
          <!-- Empty state: a valid state (R087 owner override), not an error —
               Save Template stays enabled below. -->
          <div
            v-if="draft.length === 0"
            class="rounded-lg border border-dashed border-gray-800 p-4 text-center"
            data-testid="template-empty-state"
          >
            <p class="text-sm text-gray-500">No items yet</p>
            <p class="mt-1 text-xs text-gray-600">
              Add items below to build your church's default service, or click Reset to 1-2-3 default
              to start from the standard Vertical Worship flow.
            </p>
          </div>

          <!-- Populated: grouped under the five SERVICE_SECTIONS headers (plus a
               trailing unlabeled bucket for section-less entries), mirroring
               ServiceEditorView.vue's per-section grouping/Sortable pattern. -->
          <div v-else class="space-y-2">
            <!-- The render nonce rides the section v-for key (NOT the container <div> key —
                 Vue forbids :key on a child of <template v-for>). Bumping it in
                 onTemplateSortEnd discards and rebuilds each section fragment from reactive
                 state, reclaiming any DOM node SortableJS orphaned in a cross-section drag
                 (R110). Mirrors ServiceEditorView.vue's slotRenderNonce (51-01). -->
            <template v-for="group in sectionGroups" :key="`${group.key}-${templateRenderNonce}`">
              <div
                v-if="group.label"
                class="section-header flex items-center gap-2 pt-3 pb-1 first:pt-0"
                :data-testid="`template-section-header-${group.key}`"
              >
                <span class="text-[11px] uppercase tracking-[.14em] text-indigo-300/80">{{ group.label }}</span>
                <span class="h-px flex-1 bg-gradient-to-r from-gray-800 to-transparent"></span>
                <span class="text-[11px] text-gray-500">{{ group.entries.length }} {{ group.entries.length === 1 ? 'item' : 'items' }}</span>
              </div>

              <div
                :ref="(el) => setSectionListRef(group.key, el as Element | null)"
                class="space-y-2 rounded-lg transition-colors"
                :class="{ 'bg-indigo-950/20': dragOverSection === group.key }"
                :data-testid="`template-section-list-${group.key}`"
                :data-section="group.label ? group.key : undefined"
                role="list"
                :aria-label="group.label ? `${group.label} items` : 'Unsectioned items'"
              >
                <div
                  v-if="group.entries.length === 0"
                  class="rounded-lg border border-dashed border-gray-800 p-3 text-center"
                  :class="{ 'bg-indigo-950/20': dragOverSection === group.key }"
                  :data-testid="`template-section-empty-${group.key}`"
                >
                  <p class="text-xs text-gray-600">Drag an item here, or set its Section to {{ group.label }}.</p>
                </div>

                <div
                  v-for="entry in group.entries"
                  :key="entry.id"
                  class="template-item rounded-lg bg-gray-900 border border-gray-800 p-3 flex items-start gap-2"
                  data-testid="template-item"
                  :data-entry-id="entry.id"
                >
                  <!-- Drag handle: icon-only, so it carries a text alternative (UI-SPEC accessibility requirement). -->
                  <div
                    class="drag-handle cursor-grab active:cursor-grabbing text-gray-600 hover:text-gray-400 flex-shrink-0 mt-0.5"
                    :aria-label="`Drag to reorder ${kindLabel(entry.kind)}`"
                    role="button"
                    tabindex="0"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M7 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM13 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM7 8a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM13 8a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM7 14a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM13 14a2 2 0 1 0 0 4 2 2 0 0 0 0-4z" />
                    </svg>
                  </div>

                  <div class="flex-1 min-w-0">
                    <p class="text-sm text-gray-200">{{ kindLabel(entry.kind) }}</p>
                  </div>

                  <!-- Section-assignment control — same option set as ServiceEditorView.vue's `section-select`. -->
                  <select
                    data-testid="template-section-select"
                    :value="entry.section ?? ''"
                    class="rounded-md bg-gray-800 border border-gray-700 text-gray-300 text-xs px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-500 flex-shrink-0 mt-0.5"
                    title="Section"
                    aria-label="Section"
                    @change="onSectionChange(entry.id, ($event.target as HTMLSelectElement).value)"
                  >
                    <option value="">No section</option>
                    <option v-for="s in SERVICE_SECTIONS" :key="s" :value="s">{{ SERVICE_SECTION_LABELS[s] }}</option>
                  </select>

                  <!-- Remove: no confirm (UI-SPEC Copywriting Contract — a template row holds no
                       user content, unlike a live service slot). Icon-only, carries a text alternative. -->
                  <button
                    type="button"
                    class="text-gray-600 hover:text-red-400 transition-colors flex-shrink-0 mt-0.5"
                    :aria-label="`Remove ${kindLabel(entry.kind)}`"
                    data-testid="template-item-remove"
                    @click="removeEntry(entry.id)"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
            </template>
          </div>

          <!-- Add-item palette — copied verbatim from ServiceEditorView.vue:1174-1182 (the
               Phase 43 closed six-button set). Deliberately NOT derived from the SlotKind
               union, which would wrongly surface HYMN (palette-retired, R084) and IMPORTED
               (no pre-creation meaning). -->
          <div class="mt-2 flex flex-wrap items-center gap-2 rounded-lg border border-dashed border-gray-700 px-4 py-3" data-testid="template-add-palette">
            <span class="text-[11px] text-indigo-400">＋ Add item</span>
            <button type="button" class="rounded-md border border-gray-700 px-2 py-1 text-[11px] font-medium text-gray-300 hover:bg-gray-800 transition-colors" data-testid="palette-add-song" @click="addEntry('SONG')">Song</button>
            <button type="button" class="rounded-md border border-gray-700 px-2 py-1 text-[11px] font-medium text-gray-300 hover:bg-gray-800 transition-colors" data-testid="palette-add-scripture" @click="addEntry('SCRIPTURE')">Scripture</button>
            <button type="button" class="rounded-md border border-gray-700 px-2 py-1 text-[11px] font-medium text-gray-300 hover:bg-gray-800 transition-colors" data-testid="palette-add-prayer" @click="addEntry('PRAYER')">Prayer</button>
            <button type="button" class="rounded-md border border-gray-700 px-2 py-1 text-[11px] font-medium text-gray-300 hover:bg-gray-800 transition-colors" data-testid="palette-add-message" @click="addEntry('MESSAGE')">Message</button>
            <button type="button" class="rounded-md border border-gray-700 px-2 py-1 text-[11px] font-medium text-gray-300 hover:bg-gray-800 transition-colors" data-testid="palette-add-announcements" @click="addEntry('ANNOUNCEMENTS')">Announcements</button>
            <button type="button" class="rounded-md border border-gray-700 px-2 py-1 text-[11px] font-medium text-gray-300 hover:bg-gray-800 transition-colors" data-testid="palette-add-misc" @click="addEntry('MISC')">Miscellaneous</button>
          </div>
        </div>

        <!-- Footer — Reset + Save, or the Reset-overwrite confirm. -->
        <div class="border-t border-gray-800 px-4 py-4 shrink-0" data-testid="template-editor-footer">
          <div v-if="showResetConfirm" class="rounded-lg bg-red-900/20 border border-red-800 p-4 mb-3" data-testid="template-reset-confirm">
            <p class="text-sm text-gray-200 mb-3">Replace your custom template with the standard 1-2-3 flow? This clears every item you've added.</p>
            <div class="flex gap-2">
              <button
                type="button"
                class="px-3 py-1.5 rounded-md text-sm font-medium text-gray-300 bg-gray-800 hover:bg-gray-700 border border-gray-700 transition-colors"
                data-testid="template-reset-cancel"
                @click="showResetConfirm = false"
              >Cancel</button>
              <button
                type="button"
                class="px-3 py-1.5 rounded-md text-sm font-medium bg-red-900/20 hover:bg-red-900/40 text-red-400 transition-colors"
                data-testid="template-reset-confirm-button"
                @click="applyReset"
              >Replace Template</button>
            </div>
          </div>

          <div v-else class="flex items-center gap-3">
            <button
              type="button"
              class="bg-gray-800 hover:bg-gray-700 text-gray-200 rounded-md px-4 py-2 text-sm font-medium transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              :disabled="!authStore.isEditor"
              data-testid="template-reset"
              @click="onResetClick"
            >Reset to 1-2-3 default</button>
            <button
              type="button"
              class="inline-flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white rounded-md px-4 py-2 text-sm font-medium transition-colors"
              :disabled="isSaving || !authStore.isEditor"
              data-testid="template-save"
              @click="onSave"
            >{{ isSaving ? 'Saving...' : savedFeedback ? 'Saved!' : 'Save Template' }}</button>
          </div>

          <p v-if="saveError" class="text-red-400 text-sm mt-2" data-testid="template-save-error">{{ saveError }}</p>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
/**
 * Phase 44 Plan 02 — the Settings "Services" slide-out template editor
 * (R086/R087). Structural port of `EditSlideDrawer.vue`'s panel shell
 * (Teleport/Transition/no-scrim) wrapped around Phase 43's finalized
 * add-item palette and `ServiceEditorView.vue`'s per-section SortableJS
 * reorder pattern, generalized from `ServiceSlot[]` to the smaller
 * `ServiceTemplateEntry[]` shape (`{ id, kind, section? }` only — never
 * chosen content, never a computed VW type).
 */
import { ref, computed, watch, onUnmounted } from 'vue'
import { doc, updateDoc } from 'firebase/firestore'
import Sortable from 'sortablejs'
import { db } from '@/firebase'
import { useAuthStore } from '@/stores/auth'
import { buildSlots, createSlot, slotLabel, groupBySection, flattenBySection } from '@/utils/slotTypes'
import { stripUndefined } from '@/utils/stripUndefined'
import { SERVICE_SECTIONS, SERVICE_SECTION_LABELS } from '@/types/service'
import type { SlotKind, ServiceSection } from '@/types/service'
import type { ServiceTemplateEntry } from '@/types/organization'

const props = defineProps<{ isOpen: boolean }>()
const emit = defineEmits<{ close: [] }>()

const authStore = useAuthStore()

/**
 * The six kinds a church can add here — a closed set, never derived from the
 * `SlotKind` union (which also contains HYMN, palette-retired in Phase 43/R084,
 * and IMPORTED, which has no pre-creation meaning). Kept only as the palette's
 * click targets in the template above; this array itself is not iterated to
 * build the markup, matching this plan's "verbatim, not derived" requirement.
 */

/** Human-readable label for a kind, reusing `slotLabel`'s existing exhaustive
 *  switch via a throwaway `createSlot` rather than duplicating that switch here. */
function kindLabel(kind: SlotKind): string {
  return slotLabel(createSlot(kind))
}

// ── Draft state (Pitfall #3 — critical) ─────────────────────────────────────
// Cloned fresh from the store every time the drawer opens. Every mutation below
// (add/remove/reorder/section-change/reset) touches ONLY this local array —
// nothing reaches Firestore or the store until Save Template is clicked. This
// is what keeps a draft edit from mutating DEFAULT_ORG_SETTINGS's shared array
// instance in place for every org that has never configured a template.
const draft = ref<ServiceTemplateEntry[]>([])

/** Reset/save UI state — declared here (ahead of the `immediate` open-watcher
 *  below, which resets them) rather than further down near their own action
 *  handlers, so the watcher never references a `ref` before its declaration. */
const showResetConfirm = ref(false)
const isSaving = ref(false)
const savedFeedback = ref(false)
const saveError = ref<string | null>(null)

watch(
  () => props.isOpen,
  (open) => {
    if (!open) return
    draft.value = authStore.settings.defaultServiceTemplate.map((entry) => ({ ...entry }))
    showResetConfirm.value = false
    saveError.value = null
    savedFeedback.value = false
  },
  { immediate: true },
)

function onClose(): void {
  emit('close')
}

// ── Add / remove / section-change ───────────────────────────────────────────

function addEntry(kind: SlotKind): void {
  draft.value.push({ id: crypto.randomUUID(), kind, section: undefined })
}

function removeEntry(id: string): void {
  draft.value = draft.value.filter((entry) => entry.id !== id)
}

function onSectionChange(id: string, value: string): void {
  const entry = draft.value.find((e) => e.id === id)
  if (!entry) return
  entry.section = value === '' ? undefined : (value as ServiceSection)
}

// ── Grouping for render — reuses slotTypes.ts's generic groupBySection/flattenBySection
//    (RESEARCH Pattern 4), the same bucketing rule ServiceEditorView.vue uses for its
//    live Service Order list. A section-less entry (`section: undefined`) lands in the
//    trailing unlabeled bucket, rendered only when non-empty. ──

const sectionGroups = computed(() => {
  const grouped = groupBySection(draft.value, (entry) => entry.section)
  const groups: Array<{ key: ServiceSection | 'ungrouped'; label: string | null; entries: ServiceTemplateEntry[] }> =
    SERVICE_SECTIONS.map((section) => ({
      key: section,
      label: SERVICE_SECTION_LABELS[section],
      entries: grouped.sections[section],
    }))
  if (grouped.legacy.length > 0) {
    groups.push({ key: 'ungrouped', label: null, entries: grouped.legacy })
  }
  return groups
})

// ── Drag-reorder — one SortableJS instance per section container, mirroring
//    ServiceEditorView.vue's `sectionSortables` map (the proven-correct
//    per-section precedent from the v1.4 drag-bug hunt). `v-for` above is
//    keyed on each entry's own stable `id` — never array index or a derived
//    position (the exact Phase-29-era bug class this codebase already fixed
//    once). ──

const dragOverSection = ref<ServiceSection | 'ungrouped' | null>(null)
// Container render nonce (R110): bumped after a drag to force Vue to rebuild the
// Sortable-mutated section containers from state. Mirrors ServiceEditorView.vue's
// slotRenderNonce and SlideGrid.vue's gridRenderNonce.
const templateRenderNonce = ref(0)
const sectionListEls = ref(new Map<ServiceSection | 'ungrouped', HTMLElement>())
const sectionSortables = new Map<ServiceSection | 'ungrouped', Sortable>()

function setSectionListRef(key: ServiceSection | 'ungrouped', el: Element | null): void {
  const htmlEl = el as HTMLElement | null
  if (htmlEl) {
    sectionListEls.value.set(key, htmlEl)
  } else {
    sectionListEls.value.delete(key)
  }
}

function destroySectionSortables(): void {
  for (const instance of sectionSortables.values()) {
    instance.destroy()
  }
  sectionSortables.clear()
}

function bucketForKey(
  grouped: { sections: Record<ServiceSection, ServiceTemplateEntry[]>; legacy: ServiceTemplateEntry[] },
  key: ServiceSection | 'ungrouped',
): ServiceTemplateEntry[] {
  return key === 'ungrouped' ? grouped.legacy : grouped.sections[key]
}

function onTemplateSortEnd(evt: Sortable.SortableEvent): void {
  dragOverSection.value = null
  const oldDraggableIndex = evt.oldDraggableIndex
  const newDraggableIndex = evt.newDraggableIndex
  if (oldDraggableIndex == null || newDraggableIndex == null) return

  const fromKey = (evt.from.dataset.section as ServiceSection | undefined) ?? 'ungrouped'
  const toKey = (evt.to.dataset.section as ServiceSection | undefined) ?? 'ungrouped'
  if (fromKey === toKey && oldDraggableIndex === newDraggableIndex) return

  const grouped = groupBySection(draft.value, (entry) => entry.section)
  const fromBucket = bucketForKey(grouped, fromKey)
  const moved = fromBucket.splice(oldDraggableIndex, 1)[0]
  if (!moved) return
  if (toKey !== 'ungrouped') {
    moved.section = toKey
  } else {
    moved.section = undefined
  }
  const toBucket = bucketForKey(grouped, toKey)
  toBucket.splice(newDraggableIndex, 0, moved)

  draft.value = flattenBySection(grouped)

  // R110: the reactive move above is already correct, but SortableJS has physically
  // relocated the dragged row's DOM node into the target container — a node Vue believes
  // it still owns in the source list. Tear down every section Sortable, then bump the
  // nonce so Vue discards and rebuilds all section containers from state; the watcher below
  // (flush: 'post') then re-binds a fresh Sortable onto each rebuilt container. The
  // destroy is REQUIRED, not belt-and-braces: the watcher only creates when
  // `!sectionSortables.has(key)`, so without clearing the map the rebuilt containers would
  // be left drag-dead with a stale instance bound to the discarded element (51-01 lesson).
  destroySectionSortables()
  templateRenderNonce.value += 1
}

watch(
  [sectionListEls, () => props.isOpen],
  ([elsMap, open]) => {
    if (!open) {
      destroySectionSortables()
      return
    }
    const keys: (ServiceSection | 'ungrouped')[] = [...SERVICE_SECTIONS, 'ungrouped']
    for (const key of keys) {
      const el = elsMap.get(key)
      if (el && !sectionSortables.has(key)) {
        sectionSortables.set(
          key,
          Sortable.create(el, {
            handle: '.drag-handle',
            draggable: '.template-item',
            animation: 150,
            ghostClass: 'opacity-30',
            // Shared group name enables cross-section drag. The unlabeled/ungrouped
            // container allows items to be dragged OUT (pull) but never dropped back
            // IN (put: false) — a section-less item can always be re-sectioned, but
            // nothing can be dragged back into limbo, mirroring ServiceEditorView.vue.
            group: key === 'ungrouped' ? { name: 'template-items', pull: true, put: false } : 'template-items',
            onMove(moveEvt) {
              dragOverSection.value = (moveEvt.to.dataset.section as ServiceSection | undefined) ?? null
            },
            onEnd: onTemplateSortEnd,
          }),
        )
      } else if (!el && sectionSortables.has(key)) {
        sectionSortables.get(key)?.destroy()
        sectionSortables.delete(key)
      }
    }
  },
  { deep: true, flush: 'post' },
)

onUnmounted(() => {
  destroySectionSortables()
})

// ── Reset to 1-2-3 default ───────────────────────────────────────────────────
// `buildSlots()`'s 1-2-3 content is repurposed as this preset (44-CONTEXT.md
// Area 1 override) — never an automatic fallback for an unset template.

function onResetClick(): void {
  if (!authStore.isEditor) return
  if (draft.value.length === 0) {
    applyReset()
  } else {
    showResetConfirm.value = true
  }
}

function applyReset(): void {
  if (!authStore.isEditor) return
  draft.value = buildSlots('1-2-2-3').map((slot) => ({
    id: crypto.randomUUID(),
    kind: slot.kind,
    ...(slot.section ? { section: slot.section } : {}),
  }))
  showResetConfirm.value = false
}

// ── Save ─────────────────────────────────────────────────────────────────────
// Mirror-write template, matching SettingsView.vue's onToggleAiEnabled/onToggleVwMode
// shape: a quoted dot-path leaf key (never a whole-map write), then reassign the
// store so every other consumer of authStore.settings.defaultServiceTemplate sees
// the saved value without a reload. An empty draft is a valid, saveable state —
// Save Template is never disabled on an empty draft (R087 owner override).

async function onSave(): Promise<void> {
  if (!authStore.orgId || !authStore.isEditor) return

  saveError.value = null
  isSaving.value = true

  try {
    const payload = stripUndefined(draft.value)
    await updateDoc(doc(db, 'organizations', authStore.orgId), { 'settings.defaultServiceTemplate': payload })
    authStore.settings.defaultServiceTemplate = payload

    savedFeedback.value = true
    setTimeout(() => {
      savedFeedback.value = false
    }, 2000)
  } catch (err) {
    console.error('[ServiceTemplateEditor] save error:', err)
    saveError.value = 'Failed to save. Please try again.'
  } finally {
    isSaving.value = false
  }
}
</script>
