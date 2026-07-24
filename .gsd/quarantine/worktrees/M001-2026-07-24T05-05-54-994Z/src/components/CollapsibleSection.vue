<template>
  <div class="border border-gray-700 rounded-lg overflow-hidden">
    <!-- Header -->
    <div
      data-role="collapsible-header"
      class="flex items-center gap-2 px-4 py-4 bg-gray-800 cursor-pointer select-none"
      @click="toggle"
    >
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

      <span class="text-sm font-semibold text-gray-100 truncate">{{ title }}</span>
    </div>

    <!-- Body -->
    <div v-if="isOpen" class="bg-gray-800 border-t border-gray-700 px-4 py-4 space-y-4">
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const props = defineProps<{
  title: string
  storageKey: string
}>()

// Default expanded (D-17) when no stored value exists — only an explicit 'closed'
// collapses on mount.
const isOpen = ref(localStorage.getItem(props.storageKey) !== 'closed')

function toggle() {
  isOpen.value = !isOpen.value
  localStorage.setItem(props.storageKey, isOpen.value ? 'open' : 'closed')
}
</script>
