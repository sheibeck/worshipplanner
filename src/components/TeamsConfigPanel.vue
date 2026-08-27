<template>
  <div class="rounded-lg border border-gray-800 overflow-hidden">
    <div class="px-4 py-3 bg-gray-900/50 border-b border-gray-800 flex items-center justify-between gap-3">
      <div>
        <h2 class="text-sm font-medium text-gray-300">Teams</h2>
        <p class="text-xs text-gray-500 mt-0.5">
          Teams your church uses for service planning.
        </p>
      </div>
      <button
        type="button"
        @click="emit('add')"
        class="shrink-0 px-3 py-1.5 rounded-md text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-500 transition-colors"
      >
        + Add team
      </button>
    </div>

    <!-- Column headers -->
    <div
      v-if="teamsStore.teams.length > 0"
      data-testid="teams-columns"
      class="flex items-center gap-3 px-7 py-2 text-[11px] font-semibold uppercase tracking-wide text-gray-500 border-b border-gray-800 bg-gray-900/30"
    >
      <span class="flex-1">Name</span>
      <span>Schedule</span>
      <span class="w-4 shrink-0" aria-hidden="true"></span>
    </div>

    <div class="divide-y divide-gray-800">
      <div class="px-4 py-4">
        <div class="space-y-1">
          <button
            v-for="team in teamsStore.teams"
            :key="team.id"
            type="button"
            :aria-label="`Edit ${team.name} team`"
            class="w-full flex items-center gap-3 px-3 py-2 rounded-md text-left hover:bg-gray-800/50 transition-colors"
            @click="emit('edit', team)"
          >
            <span class="flex-1 text-sm font-medium text-gray-100">{{ team.name }}</span>
            <span class="text-xs text-gray-500">{{ formatRecurrence(team.recurrence?.ordinals) }}</span>
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-gray-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
          <div v-if="teamsStore.teams.length === 0" class="text-xs text-gray-600 px-3">
            <p>No teams yet.</p>
            <p>Add your first team above.</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useTeamsStore } from '@/stores/teams'
import type { Team } from '@/types/team'

const teamsStore = useTeamsStore()

const emit = defineEmits<{ edit: [team: Team]; add: [] }>()

const ORDINAL_LABELS: Record<number, string> = { 1: '1st', 2: '2nd', 3: '3rd', 4: '4th', 5: '5th' }

// Formats a team's recurring-Sunday ordinals into a compact summary, e.g.
// [1,3] -> '1st & 3rd Sun', [1,2,3] -> '1st, 2nd & 3rd Sun'. Absent/empty -> '—'.
function formatRecurrence(ordinals?: number[]): string {
  if (!ordinals || ordinals.length === 0) return '—'
  const sorted = Array.from(new Set(ordinals)).sort((a, b) => a - b)
  const labels = sorted.map((o) => ORDINAL_LABELS[o] ?? `${o}th`)
  if (labels.length === 1) return `${labels[0]} Sun`
  return `${labels.slice(0, -1).join(', ')} & ${labels[labels.length - 1]} Sun`
}
</script>
