<template>
  <div
    class="fixed inset-x-4 bottom-4 z-[60] flex flex-col items-stretch gap-2
           sm:inset-x-auto sm:right-6 sm:bottom-6 sm:w-full sm:max-w-sm"
    data-testid="toast-host"
  >
    <div
      v-for="toast in toastStore.toasts"
      :key="toast.id"
      role="alert"
      class="flex items-start gap-2 rounded-md border border-red-800 bg-red-950 px-4 py-3 text-sm text-red-400 shadow-2xl"
      :data-testid="`toast-${toast.id}`"
    >
      <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 flex-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true">
        <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
      </svg>
      <p class="min-w-0 flex-1">
        <span class="font-medium">Save failed.</span> {{ toast.message }}
      </p>
      <button
        type="button"
        class="flex-none text-red-400 hover:text-red-300"
        aria-label="Dismiss"
        @click="toastStore.dismiss(toast.id)"
      >×</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useToasts } from '@/stores/toasts'

// App-level failure alert stack (R041), mounted once in AppShell.vue.
// Each card's alert role already implies an assertive, atomic live region;
// no additional aria-live="assertive" attribute is paired with it.
// No focus trap, no auto-focus — a passive notification, not a modal.
const toastStore = useToasts()
</script>
