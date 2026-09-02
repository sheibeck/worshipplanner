<script setup lang="ts">
// See .planning/codebase/ARCHITECTURE.md (§ Component & Composable Behavioral Notes (R318) -> src/components/stage/StageRoom.vue)
import { ref } from 'vue'

const props = withDefaults(defineProps<{ theme?: 'dark' | 'light'; print?: boolean }>(), {
  theme: 'dark',
  print: false,
})

const roomEl = ref<HTMLElement | null>(null)
/** Exposed as a method (not the raw ref) so the editor gets an unambiguous
 *  fresh bounding rect for drop math at the moment it asks — never a cached
 *  or ref-unwrapping surprise. */
function getRoomRect(): DOMRect | null {
  return roomEl.value?.getBoundingClientRect() ?? null
}
defineExpose({ roomEl, getRoomRect })

const dark = props.theme === 'dark'

// No grid: markers are placed freely (never snapped). In print mode the stage
// platform is an outline only — no fill (a line, not a filled shape).
const stageFill = props.print ? 'none' : dark ? 'linear-gradient(180deg,#1c1f31,#171a29)' : 'linear-gradient(180deg,#eef0fb,#f7f8fe)'

// In print/share the stage lines and "off stage" wording are DARK GRAY (not
// black) so that any black marker icon/text placed over them still stands out
// and stays legible. Larger label type in print; muted small on screen.
const labelClass = props.print ? 'text-[11px] font-semibold text-gray-500' : dark ? 'text-gray-700' : 'text-gray-400'
</script>

<template>
  <!-- HARD-CODED size (a 16:10 room), fixed — never responsive. On screen it is
       1200×750 so it is comfortably usable while editing and viewing online;
       print stays smaller (960×600) so it fits a landscape page. Editing and the
       locked view are BOTH on-screen, so they share the on-screen size — that
       identical size (plus the single-transform centering fix) is what keeps a
       marker placed off-stage from drifting onto the stage line once locked.
       `mx-auto` centres it; the container scrolls on a narrow viewport rather
       than shrink it. -->
  <div
    ref="roomEl"
    data-testid="stage-room"
    class="relative mx-auto select-none overflow-hidden"
    :class="print ? 'bg-white' : dark ? 'rounded-xl border border-gray-800 bg-[#0d0f1a]' : 'rounded-xl border border-gray-200 bg-white'"
    :style="{ width: print ? '960px' : '1200px', height: print ? '600px' : '750px', flex: 'none' }"
  >
    <!-- Stage platform: a shape at the top; in print/share an OUTLINE (no fill),
         drawn in dark gray so black markers over the line stay legible. -->
    <div
      class="pointer-events-none absolute rounded-t-2xl"
      :class="print ? 'border-2 border-gray-500' : dark ? 'border border-gray-800' : 'border border-gray-200'"
      style="left: 10%; right: 10%; top: 5%; height: 60%; clip-path: polygon(4% 0, 96% 0, 100% 100%, 0 100%)"
      :style="{ background: stageFill }"
    />
    <div class="pointer-events-none absolute inset-x-0 flex justify-center" style="top: calc(5% + 10px)">
      <span class="uppercase tracking-[0.28em]" :class="[print ? 'text-[11px]' : 'text-[10px]', labelClass]">Back of stage</span>
    </div>
    <!-- "Stage edge" label — screen only (owner: not on the printed sheet). -->
    <div v-if="!print" class="pointer-events-none absolute inset-x-0 flex justify-center" style="top: calc(65% - 11px)">
      <span
        class="rounded-full px-2.5 py-0.5 uppercase tracking-[0.28em]"
        :class="dark ? 'bg-[#12141f] text-[10px] text-indigo-400' : 'bg-indigo-50 text-[10px] text-indigo-500'"
      >
        Stage edge
      </span>
    </div>

    <!-- Off-stage wing labels — screen only (owner: not on the printed sheet). -->
    <template v-if="!print">
      <div class="pointer-events-none absolute flex items-end justify-center pb-2" style="left: 0; top: 5%; width: 10%; height: 60%">
        <span class="text-[10px] uppercase tracking-[0.24em] [writing-mode:vertical-rl] [transform:rotate(180deg)]" :class="labelClass">
          Off stage · house left
        </span>
      </div>
      <div class="pointer-events-none absolute flex items-end justify-center pb-2" style="right: 0; top: 5%; width: 10%; height: 60%">
        <span class="text-[10px] uppercase tracking-[0.24em] [writing-mode:vertical-rl]" :class="labelClass">
          Off stage · house right
        </span>
      </div>
    </template>

    <!-- Audience -->
    <div class="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col items-center justify-end gap-1.5 pb-3" style="height: 22%">
      <!-- Audience chairs are decorative on-screen only; the print keeps just
           the "Audience" label so the tech sheet stays clean B&W. -->
      <div v-for="(row, r) in print ? [] : [0, 1, 2]" :key="r" class="flex gap-1" :style="{ opacity: 0.9 - r * 0.25 }">
        <span
          v-for="n in 9 + r"
          :key="`l-${n}`"
          class="h-2 w-3 rounded-[3px]"
          :class="print ? 'border border-gray-400' : dark ? 'bg-gray-800' : 'bg-gray-200'"
        />
        <span class="w-6" />
        <span
          v-for="n in 9 + r"
          :key="`r-${n}`"
          class="h-2 w-3 rounded-[3px]"
          :class="print ? 'border border-gray-400' : dark ? 'bg-gray-800' : 'bg-gray-200'"
        />
      </div>
      <span class="uppercase tracking-[0.28em]" :class="[print ? 'text-[11px]' : 'text-[10px]', labelClass]">Audience</span>
    </div>

    <slot />
  </div>
</template>
