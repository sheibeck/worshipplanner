<template>
  <div class="rounded-lg bg-gray-900 border border-gray-800 p-4">
    <!-- Row 1: nickname-first heading + Primary badge -->
    <div class="flex items-center gap-2">
      <h3 class="flex-1 min-w-0 truncate text-base font-semibold text-gray-100">{{ heading }}</h3>
      <span
        v-if="screen.isPrimary"
        class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-800 text-gray-300 border border-gray-700 shrink-0"
      >
        Primary
      </span>
    </div>

    <!-- Row 2: resolution -->
    <p class="text-xs text-gray-500 mt-0.5">{{ screen.width }} &times; {{ screen.height }}</p>

    <!-- Row 3: nickname input (R338) -->
    <input
      type="text"
      :value="nickname"
      placeholder="Nickname (optional)"
      :data-testid="`monitor-nickname-${fingerprint}`"
      class="mt-2 w-full rounded-md bg-gray-800 border border-gray-700 text-gray-200 text-xs px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500"
      @input="$emit('update-nickname', ($event.target as HTMLInputElement).value)"
    />

    <!-- Row 4: role selector -->
    <div
      class="mt-3 flex items-center gap-2"
      role="radiogroup"
      :aria-label="`Role for ${screen.label || 'Unlabeled display'}`"
    >
      <button
        v-for="role in roles"
        :key="role.testKey"
        type="button"
        role="radio"
        :aria-checked="selectedRole === role.value"
        :data-testid="`monitor-role-${fingerprint}-${role.testKey}`"
        class="rounded-md px-3 py-2 text-xs font-medium border transition-colors focus:outline-none focus:ring-1 focus:ring-indigo-500"
        :class="selectedRole === role.value
          ? 'bg-indigo-600/20 text-indigo-300 border-indigo-600'
          : 'bg-gray-800 text-gray-400 border-gray-700 hover:bg-gray-700'"
        @click="$emit('select-role', role.value)"
      >
        {{ role.label }}
      </button>
    </div>

    <!-- Row 5: static caption -->
    <p class="text-xs text-gray-500 mt-1.5">
      Audience &mdash; what the congregation sees &middot; Confidence &mdash; what your team sees
    </p>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { MonitorRole, ScreenLike } from '@/utils/monitorConfig'

const props = defineProps<{
  screen: ScreenLike
  fingerprint: string
  selectedRole: MonitorRole | null
  nickname: string
}>()

defineEmits<{
  'select-role': [role: MonitorRole | null]
  'update-nickname': [value: string]
}>()

// None is a real, first-class selection (R325 — no monitor is forced to hold a role),
// not the absence of a click; testKey avoids `null` string-coercion in data-testid/:key.
const roles: { value: MonitorRole | null; label: string; testKey: string }[] = [
  { value: null, label: 'None', testKey: 'none' },
  { value: 'audience', label: 'Audience', testKey: 'audience' },
  { value: 'confidence', label: 'Confidence', testKey: 'confidence' },
]

// Nickname-first heading; blank stays blank in storage, this fallback is render-time only.
const heading = computed(() => props.nickname || props.screen.label || 'Unknown')
</script>
