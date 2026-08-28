<template>
  <div class="rounded-lg bg-gray-900 border border-gray-800 p-4">
    <!-- Row 1: label + Primary badge -->
    <div class="flex items-center gap-2">
      <h3 class="flex-1 min-w-0 truncate text-base font-semibold text-gray-100">{{ screen.label || 'Unlabeled display' }}</h3>
      <span
        v-if="screen.isPrimary"
        class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-800 text-gray-300 border border-gray-700 shrink-0"
      >
        Primary
      </span>
    </div>

    <!-- Row 2: resolution -->
    <p class="text-xs text-gray-500 mt-0.5">{{ screen.width }} &times; {{ screen.height }}</p>

    <!-- Row 3: role selector -->
    <div
      class="mt-3 flex items-center gap-2"
      role="radiogroup"
      :aria-label="`Role for ${screen.label || 'Unlabeled display'}`"
    >
      <button
        v-for="role in roles"
        :key="role.value"
        type="button"
        role="radio"
        :aria-checked="selectedRole === role.value"
        :data-testid="`monitor-role-${fingerprint}-${role.value}`"
        class="rounded-md px-3 py-2 text-xs font-medium border transition-colors focus:outline-none focus:ring-1 focus:ring-indigo-500"
        :class="selectedRole === role.value
          ? 'bg-indigo-600/20 text-indigo-300 border-indigo-600'
          : 'bg-gray-800 text-gray-400 border-gray-700 hover:bg-gray-700'"
        @click="$emit('select-role', role.value)"
      >
        {{ role.label }}
      </button>
    </div>

    <!-- Row 4: static caption -->
    <p class="text-xs text-gray-500 mt-1.5">
      Audience &mdash; what the congregation sees &middot; Confidence &mdash; what your team sees
    </p>
  </div>
</template>

<script setup lang="ts">
import type { MonitorRole, ScreenLike } from '@/utils/monitorConfig'

defineProps<{
  screen: ScreenLike
  fingerprint: string
  selectedRole: MonitorRole | null
}>()

defineEmits<{
  'select-role': [role: MonitorRole]
}>()

const roles: { value: MonitorRole; label: string }[] = [
  { value: 'audience', label: 'Audience' },
  { value: 'confidence', label: 'Confidence' },
]
</script>
