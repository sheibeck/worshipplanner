<template>
  <span
    class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border"
    :class="variantClasses[props.variant ?? 'team']"
  >
    {{ tag }}
  </span>
</template>

<script setup lang="ts">
const props = defineProps<{
  tag: string
  variant?: 'team' | 'theme' | 'user'
}>()

// Static map prevents Tailwind v4 purge of dynamic class strings
const variantClasses = {
  team:  'bg-gray-800 text-gray-400 border-gray-700',
  theme: 'bg-teal-900/50 text-teal-300 border-teal-800',
  user:  'bg-pink-900/50 text-pink-300 border-pink-800',
} as const
</script>
