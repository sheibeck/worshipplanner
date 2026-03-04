<template>
  <span
    v-if="type !== null"
    class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border"
    :class="badgeClasses[type]"
  >
    Type {{ type }}
  </span>
  <span
    v-else
    class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-800 text-gray-500 border border-gray-700"
  >
    &mdash;
  </span>
</template>

<script setup lang="ts">
import type { VWType } from '@/types/song'

defineProps<{
  type: VWType | null
}>()

// Static map prevents Tailwind v4 purge of dynamic class strings
const badgeClasses = {
  1: 'bg-blue-900/50 text-blue-300 border-blue-800',
  2: 'bg-purple-900/50 text-purple-300 border-purple-800',
  3: 'bg-amber-900/50 text-amber-300 border-amber-800',
} as const
</script>
