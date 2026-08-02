<template>
  <div
    class="text-xs"
    aria-live="polite"
    aria-atomic="true"
    data-testid="save-status"
  >
    <span v-if="entry.status === 'pending'" class="italic text-gray-400">Saving soon…</span>
    <span v-else-if="entry.status === 'saving'" class="italic text-gray-400">Saving…</span>
    <span v-else-if="entry.status === 'saved'" class="text-green-400">Saved {{ formattedSavedAt }}</span>
    <span
      v-else-if="entry.status === 'error'"
      class="text-red-400"
      data-testid="save-status-error"
    >{{ entry.errorText }}</span>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useSaveStatus } from '@/stores/saveStatus'

// One shared status component (R040). No variant prop, no per-surface
// wrapper — the four call sites differ only in which surfaceId they pass.
// idle deliberately has no branch above: rendering nothing, with no
// placeholder box and no reserved layout height, is the idle state.
const props = defineProps<{ surfaceId: string }>()

const saveStatus = useSaveStatus()

// entryFor() already returns a fresh idle object for an unknown key, so an
// unrecognized surfaceId renders idle rather than throwing.
const entry = computed(() => saveStatus.entryFor(props.surfaceId))

// Wall-clock, not relative time — 'en-US' matches the locale already used
// elsewhere in this codebase for wall-clock formatting (e.g.
// ServiceEditorView.vue's formattedDate).
const formattedSavedAt = computed(() =>
  entry.value.savedAt?.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
)
</script>
