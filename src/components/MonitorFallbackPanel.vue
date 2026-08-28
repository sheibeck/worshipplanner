<template>
  <div class="rounded-lg bg-gray-900 border border-gray-800 p-6">
    <h2 class="text-base font-semibold text-gray-100">{{ heading }}</h2>
    <p class="text-sm text-gray-400 mt-1">{{ body }}</p>

    <ol class="text-sm text-gray-300 mt-4 space-y-2 list-decimal list-inside">
      <li>When you click Run on a locked service, two windows will open &mdash; one for the Audience display, one for the Confidence monitor.</li>
      <li>Drag each window onto the correct physical screen.</li>
      <li>Click the Fullscreen button in each window.</li>
    </ol>

    <p class="text-xs text-gray-500 mt-4">You'll do this each time you Run a service on this browser.</p>

    <button
      type="button"
      class="text-xs text-gray-500 hover:text-gray-300 underline underline-offset-2 mt-3"
      @click="$emit('retry')"
    >
      Try automatic detection again
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  reason: 'denied' | 'unavailable'
}>()

defineEmits<{
  retry: []
}>()

const heading = computed(() =>
  props.reason === 'denied'
    ? "No problem — let's set this up by hand"
    : "Your browser can't auto-detect monitors",
)

const body = computed(() =>
  props.reason === 'denied'
    ? 'Your browser blocked automatic detection. You can still get both displays working with a few clicks:'
    : "Chrome or Edge can do this automatically — your browser doesn't support it. No problem, you can still set up both displays by hand:",
)
</script>
