<template>
  <div class="rounded-lg border border-gray-800 overflow-hidden">
    <div class="px-4 py-3 bg-gray-900/50 border-b border-gray-800">
      <h2 class="text-sm font-medium text-gray-300">Teams</h2>
      <p class="text-xs text-gray-500 mt-0.5">
        Teams your church uses for service planning. Attach a song-tag filter to constrain AI suggestions when that team is selected.
      </p>
    </div>

    <div class="divide-y divide-gray-800">
      <div class="px-4 py-4">
        <div class="space-y-2">
          <div v-for="row in rows" :key="row.team.id">
            <template v-if="row.draft">
              <div class="flex items-center gap-3">
                <input
                  v-model="row.draft.name"
                  type="text"
                  :aria-label="`Team name for ${row.team.name}`"
                  class="flex-1 rounded-md bg-gray-800 border border-gray-700 text-gray-100 text-sm px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                />
                <select
                  v-model="row.draft.songFilterTag"
                  :aria-label="`Song-tag filter for ${row.team.name}`"
                  class="w-40 sm:w-48 rounded-md bg-gray-800 border border-gray-700 text-gray-100 text-sm px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                >
                  <option value="">No filter</option>
                  <option v-for="tag in songStore.allUserTags" :key="tag" :value="tag">{{ tag }}</option>
                </select>
                <button
                  type="button"
                  @click="onSaveTeam(row.team.id)"
                  :disabled="savingTeamId === row.team.id"
                  class="text-xs px-3 py-1.5 rounded-md font-medium text-white transition-colors disabled:opacity-80"
                  :class="savedTeamId === row.team.id ? 'bg-emerald-600' : 'bg-indigo-600 hover:bg-indigo-500'"
                >{{ savingTeamId === row.team.id ? 'Saving…' : savedTeamId === row.team.id ? 'Saved ✓' : 'Save Team' }}</button>
                <button
                  type="button"
                  @click="confirmDeleteId = row.team.id"
                  class="text-xs text-red-400 hover:text-red-300 transition-colors"
                >Delete</button>
              </div>

              <div v-if="confirmRenameId === row.team.id" class="mt-2 rounded-md bg-amber-900/20 border border-amber-800 p-3">
                <p class="text-sm text-amber-300">
                  Rename the '{{ row.team.name }}' team to '{{ row.draft.name.trim() }}'? Any service that already
                  selected '{{ row.team.name }}' will no longer show it as checked. This cannot be undone.
                </p>
                <div class="flex items-center gap-3 mt-2">
                  <button
                    type="button"
                    @click="onSaveTeam(row.team.id)"
                    class="px-3 py-1.5 rounded-md text-xs font-medium text-white bg-amber-700 hover:bg-amber-600 transition-colors"
                  >Rename Team</button>
                  <button
                    type="button"
                    @click="confirmRenameId = null"
                    class="px-3 py-1.5 rounded-md text-xs font-medium text-gray-300 bg-gray-800 hover:bg-gray-700 border border-gray-700 transition-colors"
                  >Cancel</button>
                </div>
              </div>

              <div v-if="confirmDeleteId === row.team.id" class="mt-2 rounded-md bg-red-900/20 border border-red-800 p-3">
                <p class="text-sm text-red-300">
                  Delete the '{{ row.team.name }}' team? It will no longer appear as a choice for new or edited services, but any service that already selected it keeps that reference. This cannot be undone.
                </p>
                <div class="flex items-center gap-3 mt-2">
                  <button
                    type="button"
                    @click="onConfirmDelete(row.team.id)"
                    class="px-3 py-1.5 rounded-md text-xs font-medium text-white bg-red-700 hover:bg-red-600 transition-colors"
                  >Delete Team</button>
                  <button
                    type="button"
                    @click="confirmDeleteId = null"
                    class="px-3 py-1.5 rounded-md text-xs font-medium text-gray-300 bg-gray-800 hover:bg-gray-700 border border-gray-700 transition-colors"
                  >Cancel</button>
                </div>
              </div>
            </template>
          </div>
          <div v-if="teamsStore.teams.length === 0" class="text-xs text-gray-600">
            <p>No teams yet.</p>
            <p>Add your first team below.</p>
          </div>
        </div>
      </div>

      <!-- Add Team row -->
      <div class="px-4 py-4">
        <h3 class="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">Add Team</h3>
        <div class="flex items-center gap-3">
          <input
            v-model="newTeamName"
            type="text"
            placeholder="Team name"
            aria-label="New team name"
            class="flex-1 rounded-md bg-gray-800 border border-gray-700 text-gray-100 text-sm px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
          />
          <select
            v-model="newTeamSongFilterTag"
            aria-label="Song-tag filter for new team"
            class="w-40 sm:w-48 rounded-md bg-gray-800 border border-gray-700 text-gray-100 text-sm px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
          >
            <option value="">No filter</option>
            <option v-for="tag in songStore.allUserTags" :key="tag" :value="tag">{{ tag }}</option>
          </select>
          <button
            type="button"
            :disabled="adding || !newTeamName.trim()"
            @click="onAddTeam"
            class="px-4 py-2 rounded-md text-sm font-medium text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            :class="teamAdded ? 'bg-emerald-600' : 'bg-indigo-600 hover:bg-indigo-500'"
          >{{ adding ? 'Saving…' : teamAdded ? 'Added ✓' : 'Save Team' }}</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onUnmounted } from 'vue'
import { useTeamsStore } from '@/stores/teams'
import { useSongStore } from '@/stores/songs'
import { useToasts } from '@/stores/toasts'
import type { Team } from '@/types/team'

const teamsStore = useTeamsStore()
const songStore = useSongStore()
const toasts = useToasts()

// ── Duplicate-name guard (WR-01) ─────────────────────────────────────────────
// Teams are consumed by NAME everywhere a service selects them (checkboxes,
// filterSongsByTeamTags), unlike Roles which key off role.id — so two teams
// sharing a name break checkbox independence and AI-filter matching. Compare
// trimmed + case-insensitive, excluding the row being edited (so saving a row
// without changing its name never collides with itself).
function isDuplicateName(name: string, excludeId?: string): boolean {
  const normalized = name.trim().toLowerCase()
  return teamsStore.teams.some((t) => t.id !== excludeId && t.name.trim().toLowerCase() === normalized)
}

// ── Per-row edit drafts ──────────────────────────────────────────────────────
// Local editable copies, committed to the store only on "Save Team" click —
// keeps the Firestore-driven teams list from clobbering in-progress edits
// (mirrors RolesConfigPanel.vue's roleDrafts pattern exactly).
const teamDrafts = ref<Record<string, { name: string; songFilterTag: string }>>({})

watch(
  () => teamsStore.teams,
  (teams) => {
    for (const team of teams) {
      if (!teamDrafts.value[team.id]) {
        teamDrafts.value[team.id] = { name: team.name, songFilterTag: team.songFilterTag ?? '' }
      }
    }
    for (const id of Object.keys(teamDrafts.value)) {
      if (!teams.some((t) => t.id === id)) delete teamDrafts.value[id]
    }
  },
  { immediate: true, deep: true },
)

interface TeamRow {
  team: Team
  draft: { name: string; songFilterTag: string } | undefined
}

// Teams are a single flat list (no group badges, unlike Roles) — iterate
// teamsStore.teams directly.
const rows = computed<TeamRow[]>(() =>
  teamsStore.teams.map((team) => ({ team, draft: teamDrafts.value[team.id] })),
)

// ── Save feedback (transient "Saving…" → "Saved ✓") ──────────────────────────
const savingTeamId = ref<string | null>(null)
const savedTeamId = ref<string | null>(null)
let savedTimer: ReturnType<typeof setTimeout> | null = null

// ── Rename soft-warn (WR-02) ─────────────────────────────────────────────────
const confirmRenameId = ref<string | null>(null)

async function onSaveTeam(teamId: string) {
  const draft = teamDrafts.value[teamId]
  if (!draft) return
  const team = teamsStore.teams.find((t) => t.id === teamId)
  if (!team) return
  const trimmedName = draft.name.trim()

  // WR-01: reject a save whose name collides with another existing team.
  if (isDuplicateName(trimmedName, teamId)) {
    toasts.push(`A team named "${trimmedName}" already exists. Choose a different name.`)
    return
  }

  // WR-02: renaming orphans the name-keyed reference on every service that
  // already selected the old name (same practical consequence as delete) —
  // require the same soft-warn confirm step before committing the rename.
  // Non-rename saves (song-tag-only edits) skip this and save immediately.
  const isRename = trimmedName !== team.name
  if (isRename && confirmRenameId.value !== teamId) {
    confirmRenameId.value = teamId
    return
  }
  confirmRenameId.value = null

  savingTeamId.value = teamId
  try {
    await teamsStore.updateTeam(teamId, {
      name: trimmedName,
      songFilterTag: draft.songFilterTag,
    })
    savedTeamId.value = teamId
    if (savedTimer) clearTimeout(savedTimer)
    savedTimer = setTimeout(() => {
      if (savedTeamId.value === teamId) savedTeamId.value = null
    }, 1800)
  } finally {
    savingTeamId.value = null
  }
}

// ── Delete (inline soft-warn confirm, NOT a hard block) ─────────────────────
const confirmDeleteId = ref<string | null>(null)

async function onConfirmDelete(teamId: string) {
  await teamsStore.deleteTeam(teamId)
  confirmDeleteId.value = null
}

// ── Add team ─────────────────────────────────────────────────────────────────
const newTeamName = ref('')
const newTeamSongFilterTag = ref('')
const teamAdded = ref(false)
// WR-04: in-flight guard mirroring onSaveTeam's savingTeamId — blocks a fast
// double-click from calling addTeam twice with the same name/order before the
// first request resolves.
const adding = ref(false)
let addedTimer: ReturnType<typeof setTimeout> | null = null

async function onAddTeam() {
  if (adding.value) return
  const name = newTeamName.value.trim()
  if (!name) return

  // WR-01: reject a duplicate name before creating a second team that shares
  // it (breaks checkbox independence + AI-filter matching downstream).
  if (isDuplicateName(name)) {
    toasts.push(`A team named "${name}" already exists. Choose a different name.`)
    return
  }

  adding.value = true
  try {
    const maxOrder = teamsStore.teams.reduce((max, t) => Math.max(max, t.order), -1)
    await teamsStore.addTeam({
      name,
      order: maxOrder + 1,
      songFilterTag: newTeamSongFilterTag.value,
    })
    newTeamName.value = ''
    newTeamSongFilterTag.value = ''
    teamAdded.value = true
    if (addedTimer) clearTimeout(addedTimer)
    addedTimer = setTimeout(() => {
      teamAdded.value = false
    }, 1800)
  } finally {
    adding.value = false
  }
}

onUnmounted(() => {
  if (savedTimer) clearTimeout(savedTimer)
  if (addedTimer) clearTimeout(addedTimer)
})
</script>
