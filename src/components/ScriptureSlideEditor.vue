<template>
  <div class="flex flex-col h-full">
    <!-- Header with status -->
    <div class="flex items-center justify-between gap-3 px-4 py-3 border-b border-gray-800 shrink-0">
      <h3 class="text-sm font-semibold text-gray-100">Scripture Slides</h3>
      <SaveStatusIndicator :surface-id="surfaceId ?? ''" />
    </div>

    <div class="flex-1 overflow-y-auto p-4 space-y-4">
      <!-- Reference input + fetch -->
      <div class="flex gap-2">
        <input
          v-model="referenceText"
          type="text"
          data-testid="reference-input"
          placeholder="e.g. Romans 8:28-39"
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

      <!-- Slide cards -->
      <div v-if="localSlides.length > 0" class="space-y-3" data-testid="slides-container">
        <div
          v-for="(slide, idx) in localSlides"
          :key="slide.id"
          :data-testid="`slide-card-${idx}`"
          class="rounded-lg bg-gray-800/50 border p-4"
          :class="overriddenSlides.has(idx) ? 'border-amber-500/70 border-l-4' : 'border-gray-700/50'"
        >
          <div class="flex items-center justify-between gap-2 mb-2">
            <div class="text-xs font-semibold text-indigo-400 uppercase tracking-wider">
              Slide {{ idx + 1 }}
              <span v-if="slide.verseRange" class="ml-1 text-gray-500 normal-case">
                ({{ slide.verseRange }})
              </span>
            </div>
            <!-- Override marker: closes the Phase 19 UAT gap — manually edited slides get a visible distinction -->
            <span
              v-if="overriddenSlides.has(idx)"
              :data-testid="`edited-badge-${idx}`"
              class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-900/40 text-amber-300 border border-amber-800"
            >Edited</span>
          </div>
          <textarea
            :data-testid="`slide-textarea-${idx}`"
            :value="slide.text"
            class="w-full rounded-md bg-gray-900 border border-gray-700 text-gray-100 text-sm px-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 resize-none font-mono leading-relaxed"
            :rows="Math.max(slide.text.split('\n').length, 2)"
            @input="onSlideInput(idx, ($event.target as HTMLTextAreaElement).value)"
          ></textarea>
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
import type { ScriptureSlide } from '@/types/slide'
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
const localSlides = ref<ScriptureSlide[]>([])
const overriddenSlides = ref<Set<number>>(new Set())
const currentReadingId = ref<string | null>(props.readingId ?? null)
const parsedRef = computed<ScriptureRef | null>(() => parseScriptureInput(referenceText.value))
const canFetch = computed(() => parsedRef.value !== null)
const rawText = ref('')

// 32-06: same stable-id capture as CongregationalEditor.vue — captured ONCE,
// the first time currentReadingId resolves, never re-derived while mounted.
// See that file's comment for the full correctness-risk rationale (32-UI-SPEC
// § UI Considerations E4 `partial`).
const surfaceId = ref<string | null>(null)
watch(
  currentReadingId,
  (id) => {
    if (id && !surfaceId.value) {
      surfaceId.value = `scripture:${id}`
    }
  },
  { immediate: true },
)

async function onFetchPassage() {
  const scriptureRef = parsedRef.value
  if (!scriptureRef) return

  isFetching.value = true
  fetchError.value = false

  const query = formatQuery(scriptureRef)

  try {
    const text = await fetchPassageText(query)
    rawText.value = text
    const slides = splitPassage(text, scriptureRef)
    localSlides.value = slides
    overriddenSlides.value = new Set()

    if (!currentReadingId.value) {
      const id = await store.createReading(props.orgId, {
        reference: scriptureRef,
        displayReference: query,
        rawText: text,
        readingMode: 'normal',
        slides,
      })
      currentReadingId.value = id
    } else {
      await store.updateReading(props.orgId, currentReadingId.value, {
        reference: scriptureRef,
        displayReference: query,
        rawText: text,
        slides,
      })
    }
  } catch {
    fetchError.value = true
  } finally {
    isFetching.value = false
  }
}

function onSlideInput(idx: number, value: string) {
  const slide = localSlides.value[idx]
  if (!slide) return
  localSlides.value[idx] = { ...slide, text: value }
  overriddenSlides.value.add(idx)
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
    slides: localSlides.value,
  })
}

const { status: autoSaveStatus, cleanup: cleanupAutoSave } = useAutoSave(
  localSlides,
  doAutoSave,
)

// Reports status into the shared store; skips entirely while surfaceId is
// unresolved. Same reasoning as CongregationalEditor.vue.
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
      const scriptureRef = reading.reference
      referenceText.value = reading.displayReference
      rawText.value = reading.rawText
      localSlides.value = reading.slides
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
// precedent and CongregationalEditor.vue's identical comment) — needed for
// the E4 `partial` backstop test.
//
// ★ WR-04 (32-REVIEW), CALL-SITE CONTRACT — same as CongregationalEditor.vue:
// `currentReadingId`/`surfaceId`/`referenceText`/`rawText`/`localSlides` are
// all captured/seeded ONCE at mount and are NOT reactive to `props.readingId`
// changing afterward. The caller MUST always mount this component with a
// `:key` tied to `readingId` — swapping the prop in place on a persistent
// instance is not supported and would silently misattribute saves to the
// wrong reading. See CongregationalEditor.vue's identical comment for why a
// partial (surfaceId-only) prop-watcher was considered and rejected.
defineExpose({ currentReadingId })
</script>
