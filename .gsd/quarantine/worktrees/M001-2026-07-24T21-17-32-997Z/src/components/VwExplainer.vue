<template>
  <div class="relative inline-block normal-case tracking-normal font-normal">
    <button
      type="button"
      class="text-gray-500 hover:text-gray-300"
      title="How the 1-2-3 method works"
      aria-label="How the 1-2-3 method works"
      @click.stop="open = !open"
    >
      <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
        <path stroke-linecap="round" stroke-linejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    </button>

    <template v-if="open">
      <!-- Transparent backdrop to close on outside click -->
      <div class="fixed inset-0 z-30" @click.stop="open = false"></div>

      <div class="absolute z-40 left-0 mt-1 w-80 rounded-md bg-gray-900 border border-gray-800 shadow-xl p-4 text-left">
        <h3 class="text-sm font-semibold text-gray-100 mb-2">Vertical Worship</h3>
        <p class="text-xs text-gray-400 mb-2">
          This app supports Vertical Worship which plans a service as a journey from gathering
          together toward pure adoration of God — moving from the horizontal (us, our testimony)
          to the vertical (God alone).
        </p>
        <ul class="text-xs text-gray-400 space-y-1.5 mb-2 list-disc list-inside">
          <li>
            <span class="font-medium text-gray-200">Type 1 — Call to Worship (Gather):</span>
            bright, inviting songs that gather the congregation.
          </li>
          <li>
            <span class="font-medium text-gray-200">Type 2 — Intimate (Testimony):</span>
            reflective songs that voice our shared response.
          </li>
          <li>
            <span class="font-medium text-gray-200">Type 3 — Ascription (Arrive):</span>
            songs of pure ascription and adoration directed to God.
          </li>
        </ul>
        <p class="text-xs text-gray-400">
          A common flow is 1 → 2 → 2 → 3, ending on a Type 3 so the service arrives at undivided
          worship. You can turn this methodology off anytime in Settings.
        </p>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const open = ref(false)
</script>
