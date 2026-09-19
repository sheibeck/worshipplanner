<script setup lang="ts">
// See .planning/codebase/ARCHITECTURE.md (§ Component & Composable Behavioral Notes (R318) -> src/components/slides/SlotVideoOutputControl.vue)
import { computed } from 'vue'
import type { ServiceSlot } from '@/types/service'

type SlotVideoOutput = NonNullable<ServiceSlot['videoOutput']>

const props = defineProps<{
  slot: ServiceSlot
  editable: boolean
}>()

const emit = defineEmits<{ change: [videoOutput: SlotVideoOutput] }>()

const mode = computed(() => props.slot.videoOutput?.mode ?? 'fullscreen')

const sizeHint = computed(() =>
  mode.value === 'banner'
    ? 'Lower third over the live camera feed. Video output only.'
    : 'Fills the screen on every output.',
)

function select(next: 'banner' | 'fullscreen') {
  if (!props.editable) return
  if (next === mode.value) return
  emit('change', { mode: next })
}
</script>

<template>
  <!-- Display popover tiles (142-UI-SPEC.md §3). -->
  <div class="flex flex-col gap-2" data-testid="slot-video-output-row">
    <div class="flex gap-2" role="radiogroup" aria-label="Video output display mode">
      <button
        type="button"
        role="radio"
        :aria-checked="mode === 'fullscreen'"
        :disabled="!editable"
        data-testid="slot-video-output-fullscreen-btn"
        class="flex-1 flex flex-col gap-1.5 rounded-md border p-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
        :class="mode === 'fullscreen' ? 'border-indigo-600 bg-indigo-950/30' : 'border-gray-700 bg-gray-900 hover:border-gray-600'"
        @click="select('fullscreen')"
      >
        <div class="relative h-9 rounded border border-gray-700 bg-gray-950 overflow-hidden">
          <div class="absolute inset-1 rounded-sm bg-indigo-900/60"></div>
        </div>
        <span class="text-[11px] text-gray-200">Full-screen</span>
      </button>
      <button
        type="button"
        role="radio"
        :aria-checked="mode === 'banner'"
        :disabled="!editable"
        data-testid="slot-video-output-banner-btn"
        class="flex-1 flex flex-col gap-1.5 rounded-md border p-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
        :class="mode === 'banner' ? 'border-indigo-600 bg-indigo-950/30' : 'border-gray-700 bg-gray-900 hover:border-gray-600'"
        @click="select('banner')"
      >
        <div class="relative h-9 rounded border border-gray-700 bg-gray-950 overflow-hidden">
          <div class="absolute inset-x-1 bottom-1 h-2.5 rounded-sm bg-indigo-900/60"></div>
        </div>
        <span class="text-[11px] text-gray-200">Banner</span>
      </button>
    </div>
    <p class="text-[10.5px] leading-[1.45] text-gray-500" data-testid="slot-video-output-caption">{{ sizeHint }}</p>
  </div>
</template>
