<template>
  <AppShell>
    <div class="px-6 py-8">
      <!-- Page header -->
      <div class="flex items-center justify-between mb-6">
        <div>
          <h1 class="text-xl font-semibold text-gray-100">Roster</h1>
          <p class="text-sm text-gray-400 mt-1">
            {{ rosterStore.isLoading ? 'Loading...' : `${rosterStore.activePeople.length} active volunteer${rosterStore.activePeople.length !== 1 ? 's' : ''}` }}
          </p>
        </div>
        <div class="flex items-center gap-3">
          <button
            @click="importModalOpen = true"
            class="inline-flex items-center gap-2 rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-sm font-medium text-gray-200 hover:bg-gray-700 hover:text-white transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            Import from Planning Center
          </button>
          <button
            @click="onAddVolunteer"
            class="inline-flex items-center gap-2 rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-500 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Add Volunteer
          </button>
        </div>
      </div>

      <!-- Empty state -->
      <div
        v-if="!rosterStore.isLoading && rosterStore.people.length === 0"
        class="flex flex-col items-center justify-center py-20 px-6 text-center rounded-lg border border-gray-800"
      >
        <svg xmlns="http://www.w3.org/2000/svg" class="h-12 w-12 text-gray-600 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
        <h3 class="text-base font-medium text-gray-300 mb-2">No volunteers yet</h3>
        <p class="text-sm text-gray-500 max-w-sm mb-6">
          Import your team from Planning Center or add people one at a time.
        </p>
        <div class="flex flex-col sm:flex-row items-center gap-3">
          <button
            @click="importModalOpen = true"
            class="inline-flex items-center gap-2 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 transition-colors"
          >
            Import from Planning Center
          </button>
          <button
            @click="onAddVolunteer"
            class="text-sm text-indigo-400 hover:text-indigo-300 transition-colors"
          >
            Add person manually
          </button>
        </div>
      </div>

      <template v-else>
        <!-- Search & role filter -->
        <div class="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mb-4">
          <div class="relative flex-1 max-w-sm">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-4.35-4.35M17 10.5A6.5 6.5 0 114 10.5a6.5 6.5 0 0113 0z" />
            </svg>
            <input
              v-model="searchQuery"
              type="text"
              placeholder="Search by name…"
              class="w-full rounded-md bg-gray-800 border border-gray-700 text-gray-100 text-sm pl-9 pr-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
          <select
            v-model="roleFilter"
            class="rounded-md bg-gray-800 border border-gray-700 text-gray-100 text-sm px-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
          >
            <option value="">All roles</option>
            <option v-for="role in rosterStore.rolesSorted" :key="role.id" :value="role.id">{{ role.name }}</option>
          </select>
        </div>

        <!-- Active people table -->
        <div class="rounded-lg border border-gray-800 overflow-hidden">
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b border-gray-800 bg-gray-900/50">
                <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  <button type="button" class="inline-flex items-center gap-1 hover:text-gray-200 transition-colors" @click="toggleSort('name')">
                    Name <span v-if="sortKey === 'name'">{{ sortDir === 'asc' ? '▲' : '▼' }}</span>
                  </button>
                </th>
                <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Email</th>
                <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Phone</th>
                <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  <button type="button" class="inline-flex items-center gap-1 hover:text-gray-200 transition-colors" @click="toggleSort('role')">
                    Roles <span v-if="sortKey === 'role'">{{ sortDir === 'asc' ? '▲' : '▼' }}</span>
                  </button>
                </th>
                <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  <button type="button" class="inline-flex items-center gap-1 hover:text-gray-200 transition-colors" @click="toggleSort('frequency')">
                    Frequency <span v-if="sortKey === 'frequency'">{{ sortDir === 'asc' ? '▲' : '▼' }}</span>
                  </button>
                </th>
                <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-800">
              <template v-for="person in displayedPeople" :key="person.id">
                <tr class="hover:bg-gray-800/50 transition-colors">
                  <td class="px-4 py-3 font-medium text-gray-100">{{ person.name }}</td>
                  <td class="px-4 py-3 text-gray-300">{{ person.email || '—' }}</td>
                  <td class="px-4 py-3 text-gray-300">{{ person.phone || '—' }}</td>
                  <td class="px-4 py-3">
                    <div class="flex flex-wrap gap-1 items-center">
                      <span
                        v-for="badge in personRoleBadges(person)"
                        :key="badge.roleId"
                        class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border"
                        :class="groupBadgeClasses[badge.group]"
                      >{{ badge.name }}</span>
                      <span v-if="personRoleBadges(person).length === 0" class="text-gray-600">&mdash;</span>
                    </div>
                  </td>
                  <td class="px-4 py-3 text-gray-300">{{ nToFrequencyLabel(person.frequencyTargetN) }}</td>
                  <td class="px-4 py-3">
                    <div class="flex items-center gap-3">
                      <button @click="onEditPerson(person)" class="text-xs text-indigo-400 hover:text-indigo-300 transition-colors">Edit</button>
                      <button @click="confirmDeactivateId = person.id" class="text-xs text-red-400 hover:text-red-300 transition-colors">Deactivate</button>
                    </div>
                  </td>
                </tr>
                <tr v-if="confirmDeactivateId === person.id">
                  <td colspan="6" class="px-4 py-3 bg-red-900/20 border-t border-b border-red-800">
                    <p class="text-sm text-red-300">
                      Deactivate {{ person.name }}? They'll be removed from future schedule proposals and pickers. Their history is kept and they can be reactivated anytime.
                    </p>
                    <div class="flex items-center gap-3 mt-3">
                      <button
                        @click="onConfirmDeactivate(person.id)"
                        class="px-3 py-1.5 rounded-md text-xs font-medium text-white bg-red-700 hover:bg-red-600 transition-colors"
                      >Deactivate</button>
                      <button
                        @click="confirmDeactivateId = null"
                        class="px-3 py-1.5 rounded-md text-xs font-medium text-gray-300 bg-gray-800 hover:bg-gray-700 border border-gray-700 transition-colors"
                      >Cancel</button>
                    </div>
                  </td>
                </tr>
              </template>
              <tr v-if="displayedPeople.length === 0">
                <td colspan="6" class="px-4 py-6 text-center text-sm text-gray-500">
                  {{ rosterStore.activePeople.length === 0 ? 'No active volunteers' : 'No volunteers match your search/filter' }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

      </template>

      <!-- Roles config panel -->
      <div class="mt-8">
        <RolesConfigPanel />
      </div>

      <!-- Inactive volunteers section (placed below Roles) -->
      <div v-if="inactivePeople.length > 0" class="mt-8 border border-gray-700 rounded-xl overflow-hidden">
        <div class="px-4 py-3 bg-gray-800 border-b border-gray-700">
          <h2 class="text-sm font-medium text-gray-300">Inactive Volunteers ({{ inactivePeople.length }})</h2>
          <p class="text-xs text-gray-500 mt-0.5">Removed from schedule proposals and pickers. Reactivate to make them available again.</p>
        </div>
        <div class="divide-y divide-gray-800">
          <div
            v-for="person in inactivePeople"
            :key="person.id"
            class="flex items-center justify-between px-4 py-3 hover:bg-gray-800/40"
          >
            <div>
              <p class="text-sm text-gray-400 line-through">{{ person.name }}</p>
              <p class="text-xs text-gray-600">{{ person.email || 'No email' }}</p>
            </div>
            <button
              @click="rosterStore.reactivatePerson(person.id)"
              class="text-xs px-3 py-1.5 rounded-md border border-indigo-700 text-indigo-300 hover:bg-indigo-900/30 transition-colors"
            >
              Reactivate
            </button>
          </div>
        </div>
      </div>

      <!-- Danger zone: permanently clear all volunteers (irreversible) -->
      <div v-if="rosterStore.people.length > 0" class="mt-10 border border-red-900/50 rounded-xl overflow-hidden">
        <div class="px-4 py-3 bg-red-950/30 border-b border-red-900/50">
          <h2 class="text-sm font-medium text-red-300">Danger Zone</h2>
          <p class="text-xs text-gray-500 mt-0.5">Permanently delete every volunteer for this organization — use this to clear a bad import before re-importing selectively. This cannot be undone.</p>
        </div>
        <div class="px-4 py-4">
          <button
            v-if="!clearConfirmOpen"
            @click="clearConfirmOpen = true"
            class="text-xs px-3 py-1.5 rounded-md border border-red-700 text-red-300 hover:bg-red-900/30 transition-colors"
          >
            Clear all volunteers ({{ rosterStore.people.length }})
          </button>
          <div v-else class="space-y-3">
            <p class="text-xs text-gray-400">
              Type <span class="font-mono font-semibold text-red-300">DELETE</span> to permanently remove all {{ rosterStore.people.length }} volunteers.
            </p>
            <div class="flex items-center gap-2">
              <input
                v-model="clearConfirmText"
                placeholder="DELETE"
                class="rounded-md bg-gray-900 border border-gray-700 px-3 py-1.5 text-sm text-gray-200 focus:outline-none focus:border-red-600"
              />
              <button
                :disabled="clearConfirmText !== 'DELETE' || clearing"
                @click="onClearAllVolunteers"
                class="text-xs px-3 py-1.5 rounded-md bg-red-700 text-white hover:bg-red-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {{ clearing ? 'Deleting…' : 'Delete all' }}
              </button>
              <button
                @click="cancelClear"
                :disabled="clearing"
                class="text-xs px-3 py-1.5 rounded-md border border-gray-700 text-gray-400 hover:bg-gray-800 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- PC import modal -->
    <RosterImportModal
      :open="importModalOpen"
      @close="importModalOpen = false"
      @imported="onImported"
    />
  </AppShell>

  <Teleport to="body">
    <!-- Backdrop -->
    <Transition
      enter-active-class="transition-opacity duration-200 ease-out"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition-opacity duration-150 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="formOpen"
        class="fixed inset-0 z-40 bg-black/60"
        @click="closeForm"
      ></div>
    </Transition>

    <!-- Add/Edit Volunteer drawer (right-anchored, mirrors AvailabilityDrawer.vue) -->
    <Transition
      enter-active-class="transition-transform duration-200 ease-out"
      enter-from-class="translate-x-full"
      enter-to-class="translate-x-0"
      leave-active-class="transition-transform duration-150 ease-in"
      leave-from-class="translate-x-0"
      leave-to-class="translate-x-full"
    >
      <div
        v-if="formOpen"
        class="fixed top-0 right-0 bottom-0 z-50 w-full max-w-md bg-gray-900 border-l border-gray-700 shadow-2xl flex flex-col"
      >
        <!-- Header -->
        <div class="flex items-center justify-between px-6 py-4 border-b border-gray-800 shrink-0">
          <h2 class="text-base font-semibold text-gray-100">{{ editingPersonId ? 'Edit Volunteer' : 'Add Volunteer' }}</h2>
          <button
            type="button"
            class="p-1.5 rounded-md text-gray-500 hover:text-gray-300 hover:bg-gray-800 transition-colors"
            @click="closeForm"
            aria-label="Close"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <!-- Scrollable body -->
        <div class="flex-1 overflow-y-auto px-6 py-5">
          <form id="volunteer-form" @submit.prevent="onSaveVolunteer" class="space-y-4">
            <div>
              <label class="block text-xs font-medium text-gray-400 mb-1">Name</label>
              <input
                v-model="formName"
                type="text"
                required
                placeholder="Full name"
                class="w-full rounded-md bg-gray-800 border border-gray-700 text-gray-100 text-sm px-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
            <div>
              <label class="block text-xs font-medium text-gray-400 mb-1">Email</label>
              <input
                v-model="formEmail"
                type="email"
                placeholder="name@example.com"
                class="w-full rounded-md bg-gray-800 border border-gray-700 text-gray-100 text-sm px-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
            <div>
              <label class="block text-xs font-medium text-gray-400 mb-1">
                Phone <span class="text-gray-600">(manual — not synced from Planning Center)</span>
              </label>
              <input
                v-model="formPhone"
                type="tel"
                placeholder="App-only — enter manually"
                class="w-full rounded-md bg-gray-800 border border-gray-700 text-gray-100 text-sm px-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
            <div>
              <label class="block text-xs font-medium text-gray-400 mb-1">Serve frequency</label>
              <select
                v-model.number="formFrequencyN"
                class="w-full rounded-md bg-gray-800 border border-gray-700 text-gray-100 text-sm px-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option v-for="n in [1, 2, 4]" :key="n" :value="n">{{ nToFrequencyLabel(n) }}</option>
              </select>
            </div>
            <div>
              <label class="block text-xs font-medium text-gray-400 mb-2">Roles</label>
              <div class="flex flex-wrap gap-x-4 gap-y-2">
                <label v-for="role in rosterStore.rolesSorted" :key="role.id" class="inline-flex items-center gap-1.5 text-sm text-gray-300">
                  <input
                    type="checkbox"
                    :value="role.id"
                    v-model="formRoles"
                    class="rounded border-gray-600 bg-gray-800 text-indigo-600 focus:ring-indigo-500 focus:ring-offset-gray-900"
                  />
                  {{ role.name }}
                </label>
                <span v-if="rosterStore.roles.length === 0" class="text-sm text-gray-600">No roles configured yet — add roles below.</span>
              </div>
            </div>
          </form>
        </div>

        <!-- Footer actions -->
        <div class="px-6 py-4 border-t border-gray-800 flex items-center gap-3 shrink-0">
          <button
            type="submit"
            form="volunteer-form"
            class="px-4 py-2 rounded-md text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-500 transition-colors"
          >Save Volunteer</button>
          <button
            type="button"
            @click="closeForm"
            class="px-4 py-2 rounded-md text-sm font-medium text-gray-300 bg-gray-800 hover:bg-gray-700 border border-gray-700 transition-colors"
          >Cancel</button>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useRosterStore } from '@/stores/roster'
import type { Person, RoleGroup } from '@/types/roster'
import { nToFrequencyLabel } from '@/utils/volunteerCsv'
import AppShell from '@/components/AppShell.vue'
import RolesConfigPanel from '@/components/RolesConfigPanel.vue'
import RosterImportModal from '@/components/RosterImportModal.vue'

const authStore = useAuthStore()
const rosterStore = useRosterStore()

const inactivePeople = computed(() => rosterStore.people.filter((p) => !p.active))

// ── Import modal ─────────────────────────────────────────────────────────────
const importModalOpen = ref(false)
function onImported(count: number) {
  importModalOpen.value = false
  console.log(`[RosterView] imported ${count} people`)
}

// ── Danger zone: clear all volunteers ────────────────────────────────────────
const clearConfirmOpen = ref(false)
const clearConfirmText = ref('')
const clearing = ref(false)
function cancelClear() {
  clearConfirmOpen.value = false
  clearConfirmText.value = ''
}
async function onClearAllVolunteers() {
  if (clearConfirmText.value !== 'DELETE') return
  clearing.value = true
  try {
    const n = await rosterStore.deleteAllPeople()
    console.log(`[RosterView] cleared ${n} volunteers`)
  } finally {
    clearing.value = false
    clearConfirmOpen.value = false
    clearConfirmText.value = ''
  }
}

// ── Add/Edit form ────────────────────────────────────────────────────────────
const formOpen = ref(false)
const editingPersonId = ref<string | null>(null)
const formName = ref('')
const formEmail = ref('')
const formPhone = ref('')
const formFrequencyN = ref(4)
const formRoles = ref<string[]>([])

function onAddVolunteer() {
  editingPersonId.value = null
  formName.value = ''
  formEmail.value = ''
  formPhone.value = ''
  formFrequencyN.value = 4
  formRoles.value = []
  formOpen.value = true
}

function onEditPerson(person: Person) {
  editingPersonId.value = person.id
  formName.value = person.name
  formEmail.value = person.email
  formPhone.value = person.phone
  formFrequencyN.value = person.frequencyTargetN
  formRoles.value = [...person.roles]
  formOpen.value = true
}

function closeForm() {
  formOpen.value = false
  editingPersonId.value = null
}

async function onSaveVolunteer() {
  const input = {
    name: formName.value.trim(),
    email: formEmail.value.trim(),
    phone: formPhone.value.trim(),
    roles: formRoles.value,
    frequencyTargetN: formFrequencyN.value,
  }
  if (editingPersonId.value) {
    await rosterStore.updatePerson(editingPersonId.value, input)
  } else {
    await rosterStore.addPerson(input)
  }
  closeForm()
}

// ── Deactivate ───────────────────────────────────────────────────────────────
const confirmDeactivateId = ref<string | null>(null)

async function onConfirmDeactivate(id: string) {
  await rosterStore.deactivatePerson(id)
  confirmDeactivateId.value = null
}

// ── Role badges ──────────────────────────────────────────────────────────────
// Static class map — never dynamically constructed Tailwind class strings, so
// classes survive Tailwind v4 purge (mirrors SongBadge.vue / TeamTagPill.vue).
const groupBadgeClasses: Record<RoleGroup, string> = {
  band: 'bg-blue-900/50 text-blue-300 border-blue-800',
  tech: 'bg-purple-900/50 text-purple-300 border-purple-800',
  other: 'bg-gray-800 text-gray-400 border-gray-700',
}

function personRoleBadges(person: Person): Array<{ roleId: string; name: string; group: RoleGroup }> {
  return person.roles
    .map((roleId) => rosterStore.roles.find((r) => r.id === roleId))
    .filter((r): r is NonNullable<typeof r> => r !== undefined)
    .map((r) => ({ roleId: r.id, name: r.name, group: r.group }))
}

// ── Search, filter & sort (active people table) ─────────────────────────────
const searchQuery = ref('')
const roleFilter = ref('')
type SortKey = 'name' | 'role' | 'frequency'
const sortKey = ref<SortKey>('name')
const sortDir = ref<'asc' | 'desc'>('asc')

function toggleSort(key: SortKey) {
  if (sortKey.value === key) {
    sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc'
  } else {
    sortKey.value = key
    sortDir.value = 'asc'
  }
}

// Alphabetically-first role name among the person's assigned roles — used both
// as the "Roles" column sort key and tie-break-free comparator input.
function firstRoleName(person: Person): string {
  const names = personRoleBadges(person).map((b) => b.name).sort((a, b) => a.localeCompare(b))
  return names[0] ?? ''
}

const displayedPeople = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  let list = rosterStore.activePeople.filter((p) => {
    if (q !== '' && !p.name.toLowerCase().includes(q)) return false
    if (roleFilter.value !== '' && !p.roles.includes(roleFilter.value)) return false
    return true
  })

  list = [...list].sort((a, b) => {
    let cmp = 0
    if (sortKey.value === 'name') {
      cmp = a.name.localeCompare(b.name)
    } else if (sortKey.value === 'role') {
      cmp = firstRoleName(a).localeCompare(firstRoleName(b))
    } else {
      cmp = a.frequencyTargetN - b.frequencyTargetN
    }
    return sortDir.value === 'asc' ? cmp : -cmp
  })

  return list
})

// ── Lifecycle ────────────────────────────────────────────────────────────────
let stopSeedWatch: (() => void) | null = null

function initStore() {
  const orgId = authStore.orgId
  if (!orgId) return
  rosterStore.subscribe(orgId)
  // seedDefaultRolesIfEmpty() checks roles.value.length synchronously, but
  // Firestore's onSnapshot always resolves asynchronously — calling it
  // immediately after subscribe() would race with an org that already has
  // roles and duplicate-seed the defaults. Wait for the first roles snapshot.
  stopSeedWatch = watch(
    () => rosterStore.roles,
    () => {
      rosterStore.seedDefaultRolesIfEmpty()
      stopSeedWatch?.()
      stopSeedWatch = null
    },
  )
}

onMounted(() => {
  initStore()
})

onUnmounted(() => {
  stopSeedWatch?.()
  stopSeedWatch = null
  rosterStore.unsubscribeAll()
})
</script>
