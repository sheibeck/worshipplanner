<template>
  <div class="space-y-2">
    <!-- AI Scripture Search (only for reading slots) -->
    <div v-if="showAiSuggest" class="space-y-2">
      <div class="flex gap-2">
        <input
          v-model="aiQuery"
          type="text"
          placeholder="Search passages... e.g. 'comfort in suffering'"
          class="flex-1 rounded-md bg-gray-800 border border-gray-700 text-gray-100 placeholder-gray-500 text-sm px-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          @keydown.enter.prevent="onAiSearch"
        />
        <button
          type="button"
          @click="onAiSearch"
          :disabled="!canAiSearch || aiLoading"
          class="inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-colors border"
          :class="canAiSearch && !aiLoading
            ? 'text-indigo-400 bg-gray-800 border-gray-700 hover:bg-gray-700'
            : 'text-gray-600 bg-gray-900 border-gray-800 cursor-not-allowed'"
        >
          <!-- Spinner when loading -->
          <svg v-if="aiLoading" class="h-3.5 w-3.5 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
          </svg>
          <!-- Search icon when idle -->
          <svg v-else xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          {{ aiLoading ? 'Searching...' : 'Search' }}
        </button>
      </div>

      <!-- "Suggest Scripture" button (when no query typed but sermon context exists) -->
      <button
        v-if="!aiQuery && hasSermonContext && aiResults.length === 0 && !aiLoading"
        type="button"
        @click="onAiSuggest"
        class="inline-flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
      >
        <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
        </svg>
        Suggest scripture based on sermon
      </button>

      <!-- AI Error state -->
      <div v-if="aiError" class="text-xs text-gray-500">
        Suggestions unavailable.
        <button @click="onAiRetry" class="text-indigo-400 hover:text-indigo-300 ml-1">Retry</button>
      </div>

      <!-- AI Results list -->
      <div v-if="aiResults.length > 0" class="space-y-1">
        <div
          v-for="(result, ri) in aiResults"
          :key="ri"
          class="rounded-md text-sm border transition-colors"
          :class="expandedPreview === ri
            ? 'bg-gray-800/80 border-gray-700'
            : 'border-transparent hover:bg-gray-800/80 hover:border-gray-700'"
        >
          <button
            type="button"
            @click="togglePreview(ri)"
            class="w-full text-left px-3 py-2"
          >
            <div class="flex items-center justify-between gap-2">
              <span class="font-medium text-gray-100">
                {{ result.book }} {{ result.chapter }}:{{ result.verseStart }}-{{ result.verseEnd }}
              </span>
              <span v-if="result.recentlyUsed" class="text-xs text-amber-400 shrink-0">
                Used {{ result.weeksAgoUsed }}w ago
              </span>
            </div>
            <p class="text-xs text-indigo-400/80 mt-0.5">{{ result.reason }}</p>
            <p
              v-if="aiResultOverlapsSermon(result)"
              class="text-xs text-amber-400 mt-0.5"
            >
              Overlaps with sermon passage
            </p>
          </button>

          <!-- Expanded preview -->
          <div v-if="expandedPreview === ri" class="px-3 pb-3 space-y-2">
            <div v-if="aiPreviewLoading" class="flex items-center gap-2 text-xs text-gray-400">
              <svg class="h-3 w-3 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
              </svg>
              Loading passage...
            </div>
            <div
              v-else-if="aiPreviewText"
              class="text-sm text-gray-300 bg-gray-900/50 border border-gray-700/50 rounded px-3 py-2 whitespace-pre-line leading-relaxed max-h-48 overflow-y-auto"
            >
              {{ aiPreviewText }}
            </div>
            <div v-else-if="aiPreviewError" class="text-xs text-red-400">
              Could not load preview.
            </div>
            <button
              type="button"
              @click="onSelectAiScripture(result)"
              class="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-500 transition-colors"
            >
              Select this passage
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Freeform scripture text input -->
    <input
      v-model="localText"
      type="text"
      :placeholder="label === 'Sermon Passage' ? 'e.g. Romans 8:28' : 'e.g. Isaiah 53:1-6'"
      class="w-full rounded-md bg-gray-800 border border-gray-700 text-gray-100 placeholder-gray-500 text-sm px-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-500"
      :class="parseError ? 'border-red-700 focus:ring-red-500' : ''"
      @input="onTextInput"
    />
    <p v-if="parseError" class="text-xs text-red-400 mt-1">{{ parseError }}</p>

    <!-- ESV link (shown when book and chapter are filled) -->
    <a
      v-if="canPreview"
      :href="esvUrl"
      target="_blank"
      rel="noopener"
      class="inline-flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
    >
      <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
        <path stroke-linecap="round" stroke-linejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
      </svg>
      View on ESV.org
    </a>

    <!-- Preview passage button -->
    <button
      v-if="showPreviewButton || previewLoading"
      @click="fetchPreview"
      :disabled="previewLoading"
      type="button"
      class="inline-flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 transition-colors disabled:opacity-50 disabled:cursor-wait"
    >
      <svg v-if="!previewLoading" xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
        <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        <path stroke-linecap="round" stroke-linejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
      </svg>
      <svg v-else class="h-3 w-3 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
      </svg>
      {{ previewLoading ? 'Loading...' : 'Preview passage' }}
    </button>

    <!-- Passage text panel -->
    <div
      v-if="previewText"
      class="flex items-start gap-2 bg-gray-800/50 border border-gray-700 rounded-md px-3 py-2"
    >
      <div class="flex-1 text-sm text-gray-300 whitespace-pre-line leading-relaxed max-h-48 overflow-y-auto">
        {{ previewText }}
      </div>
      <button
        type="button"
        @click="dismissPreview"
        aria-label="Close preview"
        class="shrink-0 text-gray-500 hover:text-gray-300 transition-colors text-xs leading-none mt-0.5"
      >
        &times;
      </button>
    </div>

    <!-- Preview error -->
    <div
      v-if="previewError"
      class="text-xs text-red-400 bg-red-950/50 border border-red-800/50 rounded px-2 py-1"
    >
      {{ previewError }}
    </div>

    <!-- Overlap warning -->
    <div
      v-if="showOverlapWarning && hasOverlap"
      class="text-xs text-amber-400 bg-amber-950/50 border border-amber-800/50 rounded px-2 py-1"
    >
      This passage overlaps with the sermon passage
    </div>

  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { esvLink, scripturesOverlap, parseScriptureInput } from '@/utils/scripture'
import { fetchPassageText } from '@/utils/esvApi'
import { getScriptureSuggestions, type AiScriptureSuggestion } from '@/utils/claudeApi'
import type { ScriptureRef } from '@/types/service'

const props = defineProps<{
  modelValue: ScriptureRef | null
  sermonPassage: ScriptureRef | null
  showOverlapWarning?: boolean
  showAiSuggest?: boolean
  sermonTopic?: string
  recentScriptures?: ScriptureRef[]
  label: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: ScriptureRef | null]
}>()

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatRef(scriptureRef: ScriptureRef | null): string {
  if (!scriptureRef) return ''
  const { book, chapter, verseStart, verseEnd } = scriptureRef
  if (verseStart !== undefined && verseEnd !== undefined) {
    return `${book} ${chapter}:${verseStart}-${verseEnd}`
  }
  if (verseStart !== undefined) {
    return `${book} ${chapter}:${verseStart}`
  }
  return `${book} ${chapter}`
}

// ── Local state ────────────────────────────────────────────────────────────────

const localText = ref<string>(formatRef(props.modelValue))
const parseError = ref<string>('')

// Flag to prevent the watch from overwriting localText when the change came from
// the user typing (onTextInput emits → parent updates prop → watch fires → would
// reset the field mid-edit). Only external changes (e.g. AI suggestion selection
// in the parent) should re-sync the text field.
let skipNextWatchSync = false

// Keep in sync when modelValue changes externally (e.g. AI selection from parent)
watch(
  () => props.modelValue,
  (val) => {
    if (skipNextWatchSync) {
      skipNextWatchSync = false
      return
    }
    // Don't overwrite user's text if it already parses to the same value.
    // This guards against timing races where the flag alone isn't sufficient.
    const currentParsed = parseScriptureInput(localText.value)
    const sameValue =
      val === null && currentParsed === null
        ? true
        : val !== null &&
          currentParsed !== null &&
          val.book === currentParsed.book &&
          val.chapter === currentParsed.chapter &&
          val.verseStart === currentParsed.verseStart &&
          val.verseEnd === currentParsed.verseEnd
    if (sameValue) return
    localText.value = formatRef(val)
    parseError.value = ''
  },
)

// ── AI state ──────────────────────────────────────────────────────────────────

const aiQuery = ref('')
const aiLoading = ref(false)
const aiError = ref(false)
const aiResults = ref<AiScriptureSuggestion[]>([])
const expandedPreview = ref<number | null>(null)
const aiPreviewText = ref('')
const aiPreviewLoading = ref(false)
const aiPreviewError = ref(false)

// ── Computed ───────────────────────────────────────────────────────────────────

const currentRef = computed<ScriptureRef | null>(() => {
  return parseScriptureInput(localText.value)
})

const canPreview = computed(() => currentRef.value !== null)

const esvUrl = computed(() => {
  if (!currentRef.value) return ''
  return esvLink(currentRef.value.book, currentRef.value.chapter)
})

const isComplete = computed(() => {
  const r = currentRef.value
  return r !== null && r.verseStart !== undefined && r.verseEnd !== undefined
})

const hasOverlap = computed(() => {
  if (!currentRef.value || !props.sermonPassage) return false
  return scripturesOverlap(currentRef.value, props.sermonPassage)
})

const hasSermonContext = computed(() => {
  return !!(props.sermonTopic?.trim() || props.sermonPassage)
})

const canAiSearch = computed(() => {
  return !!(aiQuery.value.trim() || hasSermonContext.value)
})

// ── Preview state ──────────────────────────────────────────────────────────────

const previewText = ref<string>('')
const previewLoading = ref(false)
const previewError = ref<string>('')
const previewRef = ref<string>('')

const passageQuery = computed(() => {
  const r = currentRef.value
  if (!r) return ''
  const base = `${r.book} ${r.chapter}`
  if (r.verseStart !== undefined && r.verseEnd !== undefined) {
    return `${base}:${r.verseStart}-${r.verseEnd}`
  }
  if (r.verseStart !== undefined) {
    return `${base}:${r.verseStart}`
  }
  return base
})

const showPreviewButton = computed(() => canPreview.value && passageQuery.value !== previewRef.value)

function dismissPreview() {
  previewText.value = ''
  previewRef.value = ''
  previewError.value = ''
}

async function fetchPreview() {
  const query = passageQuery.value
  if (!query) return
  previewLoading.value = true
  previewError.value = ''
  previewText.value = ''
  try {
    const text = await fetchPassageText(query)
    previewText.value = text || 'No passage text found for this reference.'
    previewRef.value = query
  } catch {
    previewError.value = 'Could not load passage. Check your connection and try again.'
  } finally {
    previewLoading.value = false
  }
}

// ── Text input handler ─────────────────────────────────────────────────────────

function onTextInput() {
  const text = localText.value
  if (!text.trim()) {
    skipNextWatchSync = true
    parseError.value = ''
    emit('update:modelValue', null)
    // Clear preview state when input is cleared
    previewText.value = ''
    previewRef.value = ''
    previewError.value = ''
    return
  }
  const parsed = parseScriptureInput(text)
  skipNextWatchSync = true
  if (parsed) {
    parseError.value = ''
    emit('update:modelValue', parsed)
  } else {
    parseError.value = 'Unrecognized reference — try "Book Chapter:Verse-Verse"'
    emit('update:modelValue', null)
  }
  // Clear cached preview when text changes
  if (passageQuery.value !== previewRef.value) {
    previewText.value = ''
    previewRef.value = ''
    previewError.value = ''
  }
}

// ── AI functions ───────────────────────────────────────────────────────────────

async function onAiSearch() {
  aiLoading.value = true
  aiError.value = false
  aiResults.value = []
  try {
    const result = await getScriptureSuggestions({
      sermonTopic: props.sermonTopic ?? null,
      sermonPassage: props.sermonPassage,
      query: aiQuery.value,
      recentScriptures: props.recentScriptures ?? [],
    })
    if (result !== null) {
      aiResults.value = result
    } else {
      aiError.value = true
    }
  } finally {
    aiLoading.value = false
  }
}

function onAiSuggest() {
  aiQuery.value = ''
  onAiSearch()
}

function onAiRetry() {
  aiError.value = false
  onAiSearch()
}

async function togglePreview(index: number) {
  if (expandedPreview.value === index) {
    expandedPreview.value = null
    return
  }
  expandedPreview.value = index
  aiPreviewText.value = ''
  aiPreviewError.value = false
  aiPreviewLoading.value = true
  try {
    const r = aiResults.value[index]
    if (!r) return
    const query = `${r.book} ${r.chapter}:${r.verseStart}-${r.verseEnd}`
    const text = await fetchPassageText(query)
    aiPreviewText.value = text || 'No passage text found.'
  } catch {
    aiPreviewError.value = true
  } finally {
    aiPreviewLoading.value = false
  }
}

function onSelectAiScripture(result: AiScriptureSuggestion) {
  localText.value = formatRef({
    book: result.book,
    chapter: result.chapter,
    verseStart: result.verseStart,
    verseEnd: result.verseEnd,
  })
  onTextInput()
  aiResults.value = []
  aiQuery.value = ''
  expandedPreview.value = null
  aiPreviewText.value = ''
}

function aiResultOverlapsSermon(result: AiScriptureSuggestion): boolean {
  if (!props.sermonPassage) return false
  const ref: ScriptureRef = {
    book: result.book,
    chapter: result.chapter,
    verseStart: result.verseStart,
    verseEnd: result.verseEnd,
  }
  return scripturesOverlap(ref, props.sermonPassage)
}

// Suppress unused warning for isComplete — available for future template use
void isComplete
</script>
