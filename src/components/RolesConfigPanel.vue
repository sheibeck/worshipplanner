<template>
  <div class="rounded-lg border border-gray-800 overflow-hidden">
    <div class="px-4 py-3 bg-gray-900/50 border-b border-gray-800">
      <h2 class="text-sm font-medium text-gray-300">Roles</h2>
      <p class="text-xs text-gray-500 mt-0.5">
        Schedulable roles grouped by Band, Tech, and Other. Default count is a soft planning target, not a hard cap.
      </p>
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

        <div class="space-y-2">
          <div v-for="row in rowsForGroup(group)" :key="row.role.id">
            <template v-if="row.draft">
              <div class="flex items-center gap-3">
                <input
                  v-model="row.draft.name"
                  type="text"
                  class="flex-1 rounded-md bg-gray-800 border border-gray-700 text-gray-100 text-sm px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                />
                <input
                  v-model.number="row.draft.defaultCount"
                  type="number"
                  min="1"
                  class="w-20 rounded-md bg-gray-800 border border-gray-700 text-gray-100 text-sm px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                />
                <button
                  type="button"
                  @click="onSaveRole(row.role.id)"
                  class="text-xs px-3 py-1.5 rounded-md font-medium text-white bg-indigo-600 hover:bg-indigo-500 transition-colors"
                >Save Role</button>
                <button
                  type="button"
                  @click="confirmDeleteId = row.role.id"
                  class="text-xs text-red-400 hover:text-red-300 transition-colors"
                >Delete</button>
              </div>

              <div v-if="confirmDeleteId === row.role.id" class="mt-2 rounded-md bg-red-900/20 border border-red-800 p-3">
                <p class="text-sm text-red-300">
                  Delete the '{{ row.role.name }}' role? Existing assignments to this role across all quarters will be cleared. This cannot be undone.
                </p>
                <div class="flex items-center gap-3 mt-2">
                  <button
                    type="button"
                    @click="onConfirmDelete(row.role.id)"
                    class="px-3 py-1.5 rounded-md text-xs font-medium text-white bg-red-700 hover:bg-red-600 transition-colors"
                  >Delete Role</button>
                  <button
                    type="button"
                    @click="confirmDeleteId = null"
                    class="px-3 py-1.5 rounded-md text-xs font-medium text-gray-300 bg-gray-800 hover:bg-gray-700 border border-gray-700 transition-colors"
                  >Cancel</button>
                </div>
              </div>
            </template>
          </div>
          <div v-if="groupedRoles[group].length === 0" class="text-xs text-gray-600">No roles in this group yet.</div>
        </div>
      </div>

      <!-- Add Role row -->
      <div class="px-4 py-4">
        <h3 class="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">Add Role</h3>
        <div class="flex items-center gap-3">
          <input
            v-model="newRoleName"
            type="text"
            placeholder="Role name"
            class="flex-1 rounded-md bg-gray-800 border border-gray-700 text-gray-100 text-sm px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
          />
          <select
            v-model="newRoleGroup"
            class="rounded-md bg-gray-800 border border-gray-700 text-gray-100 text-sm px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
          >
            <option value="band">Band</option>
            <option value="tech">Tech</option>
            <option value="other">Other</option>
          </select>
          <input
            v-model.number="newRoleCount"
            type="number"
            min="1"
            class="w-20 rounded-md bg-gray-800 border border-gray-700 text-gray-100 text-sm px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
          />
          <button
            type="button"
            :disabled="!newRoleName.trim()"
            @click="onAddRole"
            class="px-4 py-2 rounded-md text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >Save Role</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useRosterStore } from '@/stores/roster'
import type { Role, RoleGroup } from '@/types/roster'

const rosterStore = useRosterStore()

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

// ── Per-row edit drafts ──────────────────────────────────────────────────────
// Local editable copies, committed to the store only on "Save Role" click —
// keeps the Firestore-driven roles list from clobbering in-progress edits.
const roleDrafts = ref<Record<string, { name: string; defaultCount: number }>>({})

watch(
  () => rosterStore.roles,
  (roles) => {
    for (const role of roles) {
      if (!roleDrafts.value[role.id]) {
        roleDrafts.value[role.id] = { name: role.name, defaultCount: role.defaultCount }
      }
    }
    for (const id of Object.keys(roleDrafts.value)) {
      if (!roles.some((r) => r.id === id)) delete roleDrafts.value[id]
    }
  },
  { immediate: true, deep: true },
)

interface RoleRow {
  role: Role
  draft: { name: string; defaultCount: number } | undefined
}

function rowsForGroup(group: RoleGroup): RoleRow[] {
  return groupedRoles.value[group].map((role) => ({ role, draft: roleDrafts.value[role.id] }))
}

async function onSaveRole(roleId: string) {
  const draft = roleDrafts.value[roleId]
  if (!draft) return
  await rosterStore.updateRole(roleId, {
    name: draft.name.trim(),
    defaultCount: draft.defaultCount,
  })
}

// ── Delete ───────────────────────────────────────────────────────────────────
const confirmDeleteId = ref<string | null>(null)

async function onConfirmDelete(roleId: string) {
  await rosterStore.deleteRole(roleId)
  confirmDeleteId.value = null
}

// ── Add role ─────────────────────────────────────────────────────────────────
const newRoleName = ref('')
const newRoleGroup = ref<RoleGroup>('band')
const newRoleCount = ref(1)

async function onAddRole() {
  const name = newRoleName.value.trim()
  if (!name) return
  const maxOrder = rosterStore.roles.reduce((max, r) => Math.max(max, r.order), -1)
  await rosterStore.addRole({
    name,
    group: newRoleGroup.value,
    defaultCount: newRoleCount.value || 1,
    order: maxOrder + 1,
  })
  newRoleName.value = ''
  newRoleGroup.value = 'band'
  newRoleCount.value = 1
}
</script>
