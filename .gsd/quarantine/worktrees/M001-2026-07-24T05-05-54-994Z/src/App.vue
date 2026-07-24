<template>
  <div>
    <!-- Full-screen loading state while auth initializes -->
    <div
      v-if="!authStore.isReady"
      class="min-h-screen bg-gray-950 flex flex-col items-center justify-center gap-3"
    >
      <p class="text-sm font-semibold text-gray-200 tracking-tight">Worship Planner</p>
      <svg class="w-5 h-5 animate-spin text-indigo-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
      </svg>
    </div>

    <!-- App content once auth is ready -->
    <RouterView v-else />
  </div>
</template>

<script setup lang="ts">
import { useAuthStore } from '@/stores/auth'

const authStore = useAuthStore()
</script>
