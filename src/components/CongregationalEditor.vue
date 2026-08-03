<template>
  <div class="flex flex-col h-full">
    <!-- Header with status -->
    <div class="flex items-center justify-between gap-3 px-4 py-3 border-b border-gray-800 shrink-0">
      <h3 class="text-sm font-semibold text-gray-100">Congregational Reading</h3>
      <SaveStatusIndicator :surface-id="surfaceId ?? ''" />
    </div>

    <div class="flex-1 overflow-y-auto p-4 space-y-4">
      <!-- Reference input + fetch -->
      <div class="flex gap-2">
        <input
          v-model="referenceText"
          type="text"
          data-testid="reference-input"
          placeholder="e.g. Psalm 136:1-9"
          class="flex-1 rounded-md bg-gray-800 border border-gray-700 text-gray-100 placeholder-gray-500 text-sm px-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
        <button
          type="button"
          data-testid="fetch-btn"
          :disabled="!canFetch || isFetching"
          @click="onFetchPassage"
          class="inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-colors border"
          :class="canFetch && !isFetching
            ? 'text-indigo-400 bg-gray-800 border-gray-700 hover:bg-gray-700'
            : 'text-gray-600 bg-gray-900 border-gray-800 cursor-not-allowed'"
        >
          <svg v-if="isFetching" class="h-3.5 w-3.5 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
          </svg>
          {{ isFetching ? 'Fetching...' : 'Fetch Passage' }}
        </button>
      </div>

      <!-- Fetch error -->
      <div
        v-if="fetchError"
        data-testid="fetch-error"
        class="text-xs text-red-400 bg-red-950/50 border border-red-800/50 rounded px-2 py-1"
      >
        Could not load passage. Check your connection and try again.
      </div>

      <!-- Section assignment -->
      <div v-if="sections.length > 0" class="space-y-3" data-testid="sections-container">
        <div
          v-for="(section, idx) in sections"
          :key="idx"
          class="rounded-lg border p-4"
          :class="section.speaker === 'LEADER'
            ? 'bg-gray-800/50 border-indigo-700/50'
            : 'bg-gray-800/30 border-gray-700/50'"
        >
          <div class="flex items-center justify-between mb-2">
            <span class="text-xs text-gray-500" v-if="section.verseRange">
              {{ section.verseRange }}
            </span>
            <button
              type="button"
              :data-testid="`speaker-toggle-${idx}`"
              @click="toggleSpeaker(idx)"
              class="text-xs font-semibold uppercase tracking-wider px-2 py-1 rounded transition-colors"
              :class="section.speaker === 'LEADER'
                ? 'text-indigo-300 bg-indigo-900/50'
                : 'text-amber-300 bg-amber-900/50'"
            >
              {{ section.speaker === 'LEADER' ? 'Leader' : 'Congregation' }}
            </button>
          </div>
          <p
            class="text-sm leading-relaxed"
            :class="section.speaker === 'LEADER'
              ? 'text-gray-100 font-semibold'
              : 'text-gray-300 font-normal pl-4'"
          >
            {{ section.text }}
          </p>
        </div>
      </div>

      <!-- Preview panel -->
      <div v-if="sections.length > 0" data-testid="preview-panel" class="mt-6 rounded-lg bg-gray-900/50 border border-gray-700/30 p-4">
        <h4 class="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Preview</h4>
        <div class="space-y-2">
          <div
            v-for="(section, idx) in sections"
            :key="`preview-${idx}`"
            :data-testid="`preview-section-${idx}`"
          >
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
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { parseScriptureInput } from '@/utils/scripture'
import { fetchPassageText } from '@/utils/esvApi'
import { splitPassage } from '@/utils/scriptureSplitter'
import { useAutoSave } from '@/composables/useAutoSave'
import { useScriptureSlides } from '@/stores/scriptureSlides'
import { useSaveStatus } from '@/stores/saveStatus'
import SaveStatusIndicator from './SaveStatusIndicator.vue'
import type { CongregationalSection } from '@/types/slide'
import type { ScriptureRef } from '@/types/service'

const props = defineProps<{
  orgId: string
  readingId?: string
}>()

const store = useScriptureSlides()
const saveStatus = useSaveStatus()

const referenceText = ref('')
const isFetching = ref(false)
const fetchError = ref(false)
const sections = ref<CongregationalSection[]>([])
const currentReadingId = ref<string | null>(props.readingId ?? null)
const parsedRef = computed<ScriptureRef | null>(() => parseScriptureInput(referenceText.value))
const canFetch = computed(() => parsedRef.value !== null)
const rawText = ref('')

// 32-06: the surface id is captured ONCE, the first time currentReadingId
// resolves to a non-null value, and never re-derived while mounted. Reading
// it reactively at render time would be wrong: onFetchPassage sets
// `sections.value` (which arms useAutoSave's watcher) BEFORE the awaited
// `createReading` resolves and assigns `currentReadingId`, so a naive
// binding would transition from a `congregational:null`-suffixed key to a
// real-id key while the save that key's mutation armed is still pending
// (32-UI-SPEC.md § UI Considerations E4 `partial`). While unresolved,
// nothing is registered in the store at all, and the indicator is bound to
// an empty string, which `entryFor` resolves to idle.
const surfaceId = ref<string | null>(null)
watch(
  currentReadingId,
  (id) => {
    if (id && !surfaceId.value) {
      surfaceId.value = `congregational:${id}`
    }
  },
  { immediate: true },
)

function buildAlternatingSections(text: string, scriptureRef: ScriptureRef): CongregationalSection[] {
  const slides = splitPassage(text, scriptureRef)
  return slides.map((slide, idx) => ({
    speaker: (idx % 2 === 0 ? 'LEADER' : 'CONGREGATION') as 'LEADER' | 'CONGREGATION',
    text: slide.text,
    verseRange: slide.verseRange,
  }))
}

async function onFetchPassage() {
  const scriptureRef = parsedRef.value
  if (!scriptureRef) return

  isFetching.value = true
  fetchError.value = false

  const query = formatQuery(scriptureRef)

  try {
    const text = await fetchPassageText(query)
    rawText.value = text
    sections.value = buildAlternatingSections(text, scriptureRef)

    if (!currentReadingId.value) {
      const id = await store.createReading(props.orgId, {
        reference: scriptureRef,
        displayReference: query,
        rawText: text,
        readingMode: 'congregational',
        slides: [],
        congregationalSections: sections.value,
      })
      currentReadingId.value = id
    } else {
      await store.updateReading(props.orgId, currentReadingId.value, {
        readingMode: 'congregational',
        congregationalSections: sections.value,
      })
    }
  } catch {
    fetchError.value = true
  } finally {
    isFetching.value = false
  }
}

function toggleSpeaker(idx: number) {
  const section = sections.value[idx]
  if (!section) return
  sections.value[idx] = {
    ...section,
    speaker: section.speaker === 'LEADER' ? 'CONGREGATION' : 'LEADER',
  }
}

function formatQuery(scriptureRef: ScriptureRef): string {
  const base = `${scriptureRef.book} ${scriptureRef.chapter}`
  if (scriptureRef.verseStart != null && scriptureRef.verseEnd != null) {
    return `${base}:${scriptureRef.verseStart}-${scriptureRef.verseEnd}`
  }
  if (scriptureRef.verseStart != null) {
    return `${base}:${scriptureRef.verseStart}`
  }
  return base
}

async function doAutoSave() {
  if (!currentReadingId.value) return
  await store.updateReading(props.orgId, currentReadingId.value, {
    readingMode: 'congregational',
    congregationalSections: sections.value,
  })
}

const { status: autoSaveStatus, cleanup: cleanupAutoSave } = useAutoSave(
  sections,
  doAutoSave,
)

// Reports useAutoSave's status into the shared store, keyed by the captured
// surfaceId, skipping entirely while it is unresolved (nothing to attribute
// a status to yet). The generic failure sentence is the only error copy
// this editor ever uses — it has no reorder concept, so a caught error's
// own message never reaches this text (T-32-17).
watch(
  () => autoSaveStatus.value,
  (status) => {
    if (!surfaceId.value) return
    if (status === 'saved') {
      saveStatus.set(surfaceId.value, { status: 'saved', savedAt: new Date() })
      return
    }
    if (status === 'error') {
      saveStatus.set(surfaceId.value, {
        status: 'error',
        errorText: "Couldn't save your changes — they're still here. Try again.",
      })
      return
    }
    saveStatus.set(surfaceId.value, { status })
  },
)

onMounted(async () => {
  if (props.readingId) {
    store.subscribeReadings(props.orgId)
    const reading = await store.getReading(props.orgId, props.readingId)
    if (reading) {
      referenceText.value = reading.displayReference
      rawText.value = reading.rawText
      if (reading.congregationalSections?.length) {
        sections.value = reading.congregationalSections
      } else if (reading.slides.length > 0) {
        sections.value = reading.slides.map((slide, idx) => ({
          speaker: (idx % 2 === 0 ? 'LEADER' : 'CONGREGATION') as 'LEADER' | 'CONGREGATION',
          text: slide.text,
          verseRange: slide.verseRange,
        }))
      }
    }
  }
})

onUnmounted(() => {
  cleanupAutoSave()
  if (surfaceId.value) saveStatus.clear(surfaceId.value)
  if (props.readingId) {
    store.unsubscribeReadings()
  }
})

// Test-only seam (matches PptxImportModal.vue's existing defineExpose
// precedent): currentReadingId has no reactive prop-watcher wired to it in
// production — it is set once at ref-init and once more inside
// onFetchPassage — so the E4 `partial` backstop test needs a way to force
// the id-resolution race described above without re-implementing internal
// timing. No other internal state is exposed.
//
// ★ WR-04 (32-REVIEW), CALL-SITE CONTRACT — read before wiring this
// component up anywhere (Phase 34): `currentReadingId` (and everything
// seeded from it — `surfaceId`, `sections`, `referenceText`, `rawText`) is
// captured ONCE at mount and is NOT reactive to `props.readingId` changing
// afterward. Reusing one mounted instance across different `readingId`
// values (e.g. a parent that swaps the prop in place instead of remounting)
// silently misattributes every later save's status to the FIRST reading
// this instance ever saw. The caller MUST always mount this component with
// a `:key` tied to `readingId` (forcing a fresh instance, and therefore a
// fresh onMounted load, per reading) — swapping `readingId` in place on a
// persistent instance is not a supported usage. A prop-watcher that resets
// `currentReadingId`/`surfaceId` alone was considered and rejected as a
// fix: `sections`/`referenceText`/`rawText` are ALSO seeded only in
// onMounted, so a partial reset would leave those stale while surfaceId
// looked correct — a worse, more subtly wrong state than today's
// unreactive-but-consistent one. A correct fix needs the whole onMounted
// load path to re-run reactively, which is a real (if currently unreachable
// and untestable, since nothing mounts this component yet) design change
// for whoever wires this up, not a one-line watch.
defineExpose({ currentReadingId })
</script>
