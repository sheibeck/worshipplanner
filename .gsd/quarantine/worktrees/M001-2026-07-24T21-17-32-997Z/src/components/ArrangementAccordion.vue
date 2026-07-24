<template>
  <div class="border border-gray-700 rounded-lg overflow-hidden">
    <!-- Header / collapsed bar -->
    <div
      class="flex items-center justify-between gap-3 px-4 py-3 bg-gray-800 cursor-pointer select-none"
      @click="isOpen = !isOpen"
    >
      <div class="flex items-center gap-2 min-w-0">
        <!-- Chevron -->
        <svg
          xmlns="http://www.w3.org/2000/svg"
          class="h-4 w-4 shrink-0 text-gray-400 transition-transform duration-150"
          :class="isOpen ? 'rotate-90' : ''"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          stroke-width="2"
        >
          <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
        </svg>

        <!-- Summary info -->
        <span class="text-sm font-medium text-gray-100 truncate">
          {{ local.name || 'Untitled Arrangement' }}
        </span>
        <span v-if="local.key" class="text-xs text-gray-400 shrink-0">{{ local.key }}</span>
        <span v-if="local.bpm" class="text-xs text-gray-500 shrink-0">{{ local.bpm }} bpm</span>
      </div>

      <!-- Remove button -->
      <button
        type="button"
        class="shrink-0 text-xs text-red-400 hover:text-red-300 transition-colors px-2 py-1 rounded hover:bg-red-900/20"
        @click.stop="$emit('remove')"
      >
        Remove
      </button>
    </div>

    <!-- Expanded body -->
    <div v-if="isOpen" class="bg-gray-800 border-t border-gray-700 px-4 py-4 space-y-4">
      <!-- Name -->
      <div>
        <label class="block text-xs font-medium text-gray-400 mb-1">Name</label>
        <input
          v-model="local.name"
          type="text"
          placeholder="e.g. Original, Acoustic, Live"
          class="w-full rounded-md bg-gray-700 border border-gray-600 text-gray-100 placeholder-gray-500 text-sm px-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
          @input="emitUpdate"
        />
      </div>

      <!-- Key + BPM row -->
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="block text-xs font-medium text-gray-400 mb-1">Key</label>
          <select
            v-model="local.key"
            class="w-full rounded-md bg-gray-700 border border-gray-600 text-gray-100 text-sm px-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
            @change="emitUpdate"
          >
            <option value="">No key</option>
            <optgroup label="Major">
              <option v-for="k in majorKeys" :key="k" :value="k">{{ k }}</option>
            </optgroup>
            <optgroup label="Minor">
              <option v-for="k in minorKeys" :key="k" :value="k">{{ k }}</option>
            </optgroup>
          </select>
        </div>
        <div>
          <label class="block text-xs font-medium text-gray-400 mb-1">BPM</label>
          <input
            v-model.number="local.bpm"
            type="number"
            placeholder="120"
            min="40"
            max="300"
            class="w-full rounded-md bg-gray-700 border border-gray-600 text-gray-100 placeholder-gray-500 text-sm px-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
            @input="emitUpdate"
          />
        </div>
      </div>

      <!-- Length + Chord Chart row -->
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="block text-xs font-medium text-gray-400 mb-1">
            Length <span class="text-gray-600 font-normal">(seconds)</span>
          </label>
          <div class="relative">
            <input
              v-model.number="local.lengthSeconds"
              type="number"
              placeholder="240"
              min="0"
              class="w-full rounded-md bg-gray-700 border border-gray-600 text-gray-100 placeholder-gray-500 text-sm px-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
              @input="emitUpdate"
            />
            <span v-if="local.lengthSeconds" class="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-500 pointer-events-none">
              {{ formatLength(local.lengthSeconds) }}
            </span>
          </div>
        </div>
        <div>
          <label class="block text-xs font-medium text-gray-400 mb-1">Chord Chart URL</label>
          <input
            v-model="local.chordChartUrl"
            type="url"
            placeholder="https://..."
            class="w-full rounded-md bg-gray-700 border border-gray-600 text-gray-100 placeholder-gray-500 text-sm px-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
            @input="emitUpdate"
          />
        </div>
      </div>

      <!-- Notes -->
      <div>
        <label class="block text-xs font-medium text-gray-400 mb-1">Notes</label>
        <textarea
          v-model="local.notes"
          rows="2"
          placeholder="Arrangement-specific notes..."
          class="w-full rounded-md bg-gray-700 border border-gray-600 text-gray-100 placeholder-gray-500 text-sm px-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 resize-none"
          @input="emitUpdate"
        ></textarea>
      </div>

      <!-- Team Tags -->
      <div v-if="availableTags.length > 0">
        <label class="block text-xs font-medium text-gray-400 mb-2">Team Tags</label>
        <div class="flex flex-wrap gap-2">
          <button
            v-for="tag in availableTags"
            :key="tag"
            type="button"
            class="px-3 py-1 rounded-full text-xs font-medium border transition-colors"
            :class="local.teamTags.includes(tag)
              ? 'bg-indigo-600 border-indigo-500 text-white'
              : 'bg-gray-700 border-gray-600 text-gray-400 hover:border-gray-500 hover:text-gray-300'"
            @click="toggleTag(tag)"
          >
            {{ tag }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import type { Arrangement } from '@/types/song'

const props = defineProps<{
  arrangement: Arrangement
  availableTags: string[]
}>()

const emit = defineEmits<{
  update: [arrangement: Arrangement]
  remove: []
}>()

const isOpen = ref(false)

// Local mutable copy — changes are emitted up, not auto-saved
const local = ref<Arrangement>({ ...props.arrangement, teamTags: [...props.arrangement.teamTags] })

watch(
  () => props.arrangement,
  (newVal) => {
    local.value = { ...newVal, teamTags: [...newVal.teamTags] }
  },
  { deep: true },
)

const majorKeys = ['C', 'C#', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B']
const minorKeys = ['Cm', 'C#m', 'Dm', 'Ebm', 'Em', 'Fm', 'F#m', 'Gm', 'Abm', 'Am', 'Bbm', 'Bm']

function formatLength(seconds: number | null): string {
  if (!seconds || seconds <= 0) return ''
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

function toggleTag(tag: string) {
  const idx = local.value.teamTags.indexOf(tag)
  if (idx >= 0) {
    local.value.teamTags.splice(idx, 1)
  } else {
    local.value.teamTags.push(tag)
  }
  emitUpdate()
}

function emitUpdate() {
  emit('update', { ...local.value, teamTags: [...local.value.teamTags] })
}
</script>
