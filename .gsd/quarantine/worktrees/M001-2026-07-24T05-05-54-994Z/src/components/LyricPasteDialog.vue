<template>
  <Teleport to="body">
    <!-- Backdrop -->
    <Transition
      enter-active-class="transition-opacity duration-200 ease-out"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition-opacity duration-150 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="open"
        class="fixed inset-0 z-40 bg-black/30"
        @click="onCancel"
      ></div>
    </Transition>

    <!-- Dialog -->
    <Transition
      enter-active-class="transition-all duration-250 ease-out"
      enter-from-class="opacity-0 scale-95"
      enter-to-class="opacity-100 scale-100"
      leave-active-class="transition-all duration-200 ease-in"
      leave-from-class="opacity-100 scale-100"
      leave-to-class="opacity-0 scale-95"
    >
      <div
        v-if="open"
        class="fixed inset-0 z-50 flex items-center justify-center p-4"
      >
        <div
          class="bg-gray-900 border border-gray-800 rounded-xl shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col"
          @click.stop
        >
          <!-- Header -->
          <div class="flex items-center justify-between gap-3 px-5 py-4 border-b border-gray-800 shrink-0">
            <h2 class="text-base font-semibold text-gray-100">
              Paste Lyrics from SongSelect
            </h2>
            <div class="flex items-center gap-2">
              <button
                type="button"
                class="px-3 py-1.5 rounded-md text-sm font-medium text-gray-300 bg-gray-800 hover:bg-gray-700 border border-gray-700 hover:border-gray-600 transition-colors"
                @click="onCancel"
              >
                Cancel
              </button>
              <button
                type="button"
                data-testid="confirm-btn"
                class="px-3 py-1.5 rounded-md text-sm font-medium text-white transition-colors"
                :class="canConfirm
                  ? 'bg-indigo-600 hover:bg-indigo-500'
                  : 'bg-indigo-600/40 cursor-default text-white/50'"
                :disabled="!canConfirm || isSaving"
                @click="onConfirm"
              >
                {{ isSaving ? 'Saving...' : 'Save Lyrics' }}
              </button>
            </div>
          </div>

          <!-- Body -->
          <div class="flex-1 overflow-hidden flex flex-col md:flex-row min-h-0">
            <!-- Left: Textarea -->
            <div class="flex-1 flex flex-col p-4 min-h-0">
              <label class="block text-xs font-medium text-gray-400 mb-1">
                Paste CCLI SongSelect text
              </label>
              <textarea
                ref="textareaRef"
                v-model="rawText"
                placeholder="Paste lyrics from CCLI SongSelect..."
                class="flex-1 w-full rounded-md bg-gray-800 border border-gray-700 text-gray-100 placeholder-gray-500 text-sm px-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 resize-none font-mono"
              ></textarea>
            </div>

            <!-- Right: Preview -->
            <div class="flex-1 flex flex-col border-t md:border-t-0 md:border-l border-gray-800 min-h-0">
              <div class="px-4 pt-4 pb-1">
                <span class="text-xs font-medium text-gray-400">Preview</span>
              </div>
              <div class="flex-1 overflow-y-auto px-4 pb-4 space-y-3">
                <!-- No sections message -->
                <div
                  v-if="rawText.trim() && parsed.sections.length === 0"
                  class="text-sm text-yellow-400 bg-yellow-400/10 rounded-md px-3 py-2"
                >
                  No sections detected — check that you copied the full lyrics from SongSelect
                </div>

                <!-- Empty state -->
                <div
                  v-else-if="!rawText.trim()"
                  class="text-sm text-gray-500 italic"
                >
                  Paste lyrics to see a preview
                </div>

                <!-- Parsed preview -->
                <template v-else>
                  <!-- Title -->
                  <div v-if="parsed.title" class="text-base font-semibold text-gray-100">
                    {{ parsed.title }}
                  </div>

                  <!-- Sections -->
                  <div
                    v-for="section in parsed.sections"
                    :key="section.id"
                    class="space-y-1"
                  >
                    <div class="text-xs font-semibold text-indigo-400 uppercase tracking-wider">
                      {{ section.label }}
                    </div>
                    <div class="text-sm text-gray-300 whitespace-pre-line leading-relaxed">
                      {{ section.lines.join('\n') }}
                    </div>
                  </div>

                  <!-- Copyright -->
                  <div
                    v-if="parsed.copyright.ccliSongNumber"
                    class="border-t border-gray-800 pt-3 mt-3 space-y-0.5"
                  >
                    <div class="text-xs text-gray-500">
                      {{ parsed.copyright.authors.join(', ') }}
                    </div>
                    <div
                      v-for="(line, i) in parsed.copyright.copyrightLines"
                      :key="i"
                      class="text-xs text-gray-500"
                    >
                      {{ line }}
                    </div>
                    <div class="text-xs text-gray-500">
                      CCLI Song # {{ parsed.copyright.ccliSongNumber }}
                    </div>
                  </div>
                </template>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { parseCCLIPaste } from '@/utils/ccliParser'
import { useSongLyricsStore } from '@/stores/songLyrics'
import { useSongStore } from '@/stores/songs'

const props = defineProps<{
  open: boolean
  songId: string
  orgId: string
}>()

const emit = defineEmits<{
  close: []
  saved: []
}>()

const rawText = ref('')
const isSaving = ref(false)
const textareaRef = ref<HTMLTextAreaElement | null>(null)

const songLyricsStore = useSongLyricsStore()
const songStore = useSongStore()

const parsed = computed(() => parseCCLIPaste(rawText.value))
const canConfirm = computed(() => parsed.value.sections.length > 0 && !isSaving.value)

watch(() => props.open, (isOpen) => {
  if (isOpen) {
    rawText.value = ''
    isSaving.value = false
  }
})

async function onConfirm() {
  if (!canConfirm.value) return
  isSaving.value = true
  try {
    const result = parsed.value
    const defaultOrder = result.sections.map((s) => s.id)
    await songLyricsStore.saveLyrics(props.orgId, props.songId, {
      sections: result.sections,
      copyright: result.copyright,
      performanceOrder: defaultOrder,
    })
    await songStore.updateSong(props.songId, {
      performanceOrder: defaultOrder,
    })
    emit('saved')
  } finally {
    isSaving.value = false
  }
}

function onCancel() {
  if (rawText.value.trim()) {
    if (!window.confirm('You have unsaved changes. Discard them?')) return
  }
  emit('close')
}
</script>
