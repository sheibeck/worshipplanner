<template>
  <div class="space-y-2">
    <!-- 4 fields in a row -->
    <div class="flex gap-2">
      <!-- Book dropdown -->
      <select
        v-model="localBook"
        @change="onFieldChange"
        class="flex-1 rounded-md bg-gray-800 border border-gray-700 text-gray-100 text-sm px-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-500"
      >
        <option value="">Select book...</option>
        <option v-for="book in BIBLE_BOOKS" :key="book" :value="book">{{ book }}</option>
      </select>

      <!-- Chapter -->
      <input
        v-model.number="localChapter"
        @input="onFieldChange"
        type="number"
        min="1"
        placeholder="Ch"
        class="w-16 rounded-md bg-gray-800 border border-gray-700 text-gray-100 placeholder-gray-500 text-sm px-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-500"
      />

      <!-- Verse start -->
      <input
        v-model.number="localVerseStart"
        @input="onFieldChange"
        type="number"
        min="1"
        placeholder="From"
        class="w-20 rounded-md bg-gray-800 border border-gray-700 text-gray-100 placeholder-gray-500 text-sm px-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-500"
      />

      <!-- Verse end -->
      <input
        v-model.number="localVerseEnd"
        @input="onFieldChange"
        type="number"
        min="1"
        placeholder="To"
        class="w-20 rounded-md bg-gray-800 border border-gray-700 text-gray-100 placeholder-gray-500 text-sm px-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-500"
      />
    </div>

    <!-- ESV link (shown when all fields are filled) -->
    <a
      v-if="isComplete"
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
import { BIBLE_BOOKS, esvLink, scripturesOverlap } from '@/utils/scripture'
import type { ScriptureRef } from '@/types/service'

const props = defineProps<{
  modelValue: ScriptureRef | null
  sermonPassage: ScriptureRef | null
  showOverlapWarning?: boolean
  label: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: ScriptureRef | null]
}>()

// ── Local state ────────────────────────────────────────────────────────────────

const localBook = ref<string>(props.modelValue?.book ?? '')
const localChapter = ref<number | ''>(props.modelValue?.chapter ?? '')
const localVerseStart = ref<number | ''>(props.modelValue?.verseStart ?? '')
const localVerseEnd = ref<number | ''>(props.modelValue?.verseEnd ?? '')

// Keep in sync when modelValue changes externally
watch(
  () => props.modelValue,
  (val) => {
    localBook.value = val?.book ?? ''
    localChapter.value = val?.chapter ?? ''
    localVerseStart.value = val?.verseStart ?? ''
    localVerseEnd.value = val?.verseEnd ?? ''
  },
)

// ── Computed ───────────────────────────────────────────────────────────────────

const isComplete = computed(() => {
  return (
    !!localBook.value &&
    !!localChapter.value &&
    !!localVerseStart.value &&
    !!localVerseEnd.value
  )
})

const esvUrl = computed(() => {
  if (!isComplete.value) return ''
  return esvLink(localBook.value as string, localChapter.value as number)
})

const currentRef = computed<ScriptureRef | null>(() => {
  if (!isComplete.value) return null
  return {
    book: localBook.value as string,
    chapter: localChapter.value as number,
    verseStart: localVerseStart.value as number,
    verseEnd: localVerseEnd.value as number,
  }
})

const hasOverlap = computed(() => {
  if (!currentRef.value || !props.sermonPassage) return false
  return scripturesOverlap(currentRef.value, props.sermonPassage)
})

// ── Emit on field change ───────────────────────────────────────────────────────

function onFieldChange() {
  emit('update:modelValue', currentRef.value)
}
</script>
