<template>
  <div class="rounded-lg border border-gray-800 overflow-hidden">
    <div class="px-4 py-3 bg-gray-900/50 border-b border-gray-800 flex items-center justify-between gap-3">
      <div>
        <h2 class="text-sm font-medium text-gray-300">Roles</h2>
        <p class="text-xs text-gray-500 mt-0.5">
          Schedulable roles grouped by Band, Tech, and Other. Default count is the number of volunteers the
          scheduler auto-fills for this role each service.
        </p>
      </div>
      <button
        type="button"
        @click="emit('add')"
        class="shrink-0 px-3 py-1.5 rounded-md text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-500 transition-colors"
      >
        + Add role
      </button>
    </div>

    <!-- Column headers (grid tracks MUST match the row grid below) -->
    <div data-testid="roles-columns" class="grid grid-cols-[minmax(0,1fr)_5rem_5rem_1rem] items-center gap-3 px-7 py-2 text-[11px] font-semibold uppercase tracking-wide text-gray-500 border-b border-gray-800 bg-gray-900/30">
      <span>Role</span>
      <span class="text-center">Positions</span>
      <span class="text-center">Multi-role</span>
      <span aria-hidden="true"></span>
    </div>

    <div class="divide-y divide-gray-800">
      <div v-for="group in groupOrder" :key="group" class="px-4 py-4">
        <div class="flex items-center gap-2 mb-3">
          <span
            class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border"
            :class="groupBadgeClasses[group]"
          >
            {{ groupLabels[group] }}
          </span>
        </div>

        <div class="space-y-1">
          <button
            v-for="role in groupedRoles[group]"
            :key="role.id"
            type="button"
            :aria-label="`Edit ${role.name} role`"
            class="w-full grid grid-cols-[minmax(0,1fr)_5rem_5rem_1rem] items-center gap-3 px-3 py-2 rounded-md text-left hover:bg-gray-800/50 transition-colors"
            @click="emit('edit', role)"
          >
            <span class="truncate text-sm font-medium text-gray-100">{{ role.name }}</span>
            <span class="text-center text-xs text-gray-500">{{ role.defaultCount }}</span>
            <span class="text-center text-xs">
              <span v-if="role.multiRole" class="font-medium text-indigo-300">Yes</span>
              <span v-else class="text-gray-600">—</span>
            </span>
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-gray-500 justify-self-end shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
          <div v-if="groupedRoles[group].length === 0" class="text-xs text-gray-600 px-3">No roles in this group yet.</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRosterStore } from '@/stores/roster'
import type { Role, RoleGroup } from '@/types/roster'

const rosterStore = useRosterStore()

const emit = defineEmits<{ edit: [role: Role]; add: [] }>()

const groupOrder: RoleGroup[] = ['band', 'tech', 'other']
const groupLabels: Record<RoleGroup, string> = { band: 'Band', tech: 'Tech', other: 'Other' }

// Static class map — never dynamically constructed Tailwind class strings, so
// classes survive Tailwind v4 purge (mirrors SongBadge.vue / TeamTagPill.vue).
const groupBadgeClasses: Record<RoleGroup, string> = {
  band: 'bg-blue-900/50 text-blue-300 border-blue-800',
  tech: 'bg-purple-900/50 text-purple-300 border-purple-800',
  other: 'bg-gray-800 text-gray-400 border-gray-700',
}

const groupedRoles = computed(() => ({
  band: rosterStore.roles.filter((r) => r.group === 'band'),
  tech: rosterStore.roles.filter((r) => r.group === 'tech'),
  other: rosterStore.roles.filter((r) => r.group === 'other'),
}))
</script>
