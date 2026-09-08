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

function select(next: 'banner' | 'fullscreen') {
  if (!props.editable) return
  if (next === mode.value) return
  emit('change', { mode: next })
}
</script>

<template>
  <!-- Two-segment pill toggle (137-UI-SPEC.md Surface 1) — a pure either/or
       choice, distinct from Loop's checkbox+select. Visible-but-inert when
       `!editable` (locked service) so a planner still sees the setting. -->
  <div class="flex flex-col gap-1" data-testid="slot-video-output-row">
    <div
      class="inline-flex rounded-md border border-gray-700 overflow-hidden text-xs font-medium"
      role="radiogroup"
      aria-label="Video output display mode"
    >
      <button
        type="button"
        role="radio"
        :aria-checked="mode === 'fullscreen'"
        :disabled="!editable"
        data-testid="slot-video-output-fullscreen-btn"
        class="px-2.5 py-1.5 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500"
        :class="mode === 'fullscreen' ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'"
        @click="select('fullscreen')"
      >Full-screen</button>
      <button
        type="button"
        role="radio"
        :aria-checked="mode === 'banner'"
        :disabled="!editable"
        data-testid="slot-video-output-banner-btn"
        class="border-l border-gray-700 px-2.5 py-1.5 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500"
        :class="mode === 'banner' ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'"
        @click="select('banner')"
      >Banner</button>
    </div>
    <span class="text-[11px] text-gray-500" data-testid="slot-video-output-caption">Video output only</span>
  </div>
</template>
