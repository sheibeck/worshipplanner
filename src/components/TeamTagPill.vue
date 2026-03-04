<template>
  <span
    class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-800 text-gray-400 border border-gray-700"
  >
    {{ tag }}
  </span>
</template>

<script setup lang="ts">
defineProps<{
  tag: string
}>()
</script>
