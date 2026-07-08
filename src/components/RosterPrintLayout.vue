<template>
  <div class="hidden print:block bg-white text-gray-900 font-sans text-sm p-8">
    <!-- Header -->
    <div class="border-b border-gray-300 pb-3 mb-4">
      <h1 class="text-lg font-bold text-gray-900">{{ quarter.label }}</h1>
      <p class="text-xs text-gray-600">Volunteer Schedule</p>
    </div>

    <!-- Date blocks -->
    <div>
      <div
        v-for="date in quarter.serviceDates"
        :key="date"
        data-date-row
        class="py-3 border-b border-gray-100 break-inside-avoid"
      >
        <p class="text-sm font-semibold text-gray-900 mb-1.5">{{ formatDateLabel(date) }}</p>
        <div v-for="role in sortedRoles" :key="role.id" class="py-0.5">
          <span class="text-xs text-gray-500 uppercase tracking-wider">{{ role.name }}</span>
          <span class="text-gray-500"> -- </span>
          <template v-if="peopleFor(date, role.id).length > 0">
            <span class="text-gray-900">{{ peopleFor(date, role.id).join(', ') }}</span>
          </template>
          <span v-else class="text-gray-400 italic">[not assigned]</span>
        </div>
      </div>
      <p v-if="quarter.serviceDates.length === 0" class="text-gray-400 italic text-sm">
        No service dates
      </p>
    </div>

    <!-- Footer -->
    <p class="text-xs text-gray-400 mt-6 pt-2 border-t border-gray-200">
      Generated from WorshipPlanner
    </p>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRosterStore } from '@/stores/roster'
import type { Quarter, Role, RoleGroup } from '@/types/roster'

const props = defineProps<{
  quarter: Quarter
  roles: Role[]
}>()

const rosterStore = useRosterStore()

// ── Static class-safe ordering (never dynamically constructed) ──────────────
const GROUP_ORDER: RoleGroup[] = ['band', 'tech', 'other']

// ── Roles grouped Band/Tech/Other, ordered within group (mirrors QuarterGrid) ──
const sortedRoles = computed<Role[]>(() => {
  return [...props.roles].sort((a, b) => {
    const groupDiff = GROUP_ORDER.indexOf(a.group) - GROUP_ORDER.indexOf(b.group)
    if (groupDiff !== 0) return groupDiff
    return a.order - b.order
  })
})

function peopleFor(date: string, roleId: string): string[] {
  const ids = props.quarter.calendar[date]?.[roleId] ?? []
  return ids.map((id) => rosterStore.people.find((p) => p.id === id)?.name ?? '(unknown)')
}

function formatDateLabel(date: string): string {
  const d = new Date(`${date}T00:00:00`)
  return d.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })
}
</script>
