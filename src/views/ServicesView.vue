<template>
  <AppShell>
    <div class="px-6 py-8">

      <!-- Tab bar -->
      <div class="flex items-center gap-1 mb-6 border-b border-gray-800 pb-0">
        <button
          type="button"
          class="px-4 py-2 text-sm font-medium rounded-t-md transition-colors -mb-px border-b-2"
          :class="activeTab === 'services'
            ? 'text-indigo-300 border-indigo-500 bg-gray-900'
            : 'text-gray-400 border-transparent hover:text-gray-200 hover:border-gray-600'"
          @click="activeTab = 'services'"
        >
          Services
        </button>
        <button
          type="button"
          class="px-4 py-2 text-sm font-medium rounded-t-md transition-colors -mb-px border-b-2"
          :class="activeTab === 'rotation'
            ? 'text-indigo-300 border-indigo-500 bg-gray-900'
            : 'text-gray-400 border-transparent hover:text-gray-200 hover:border-gray-600'"
          @click="activeTab = 'rotation'"
        >
          Rotation
        </button>
        <div class="flex-1" />
        <!-- New Service button (always visible) -->
        <button
          type="button"
          class="inline-flex items-center gap-2 rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-500 transition-colors mb-1"
          @click="dialogOpen = true"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          New Service
        </button>
      </div>

      <!-- Services Tab -->
      <template v-if="activeTab === 'services'">

        <!-- Loading -->
        <div v-if="serviceStore.isLoading" class="text-sm text-gray-400 py-8 text-center">
          Loading services...
        </div>

        <template v-else>
          <!-- Upcoming section -->
          <section class="mb-8">
            <h2 class="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-3">
              Upcoming
            </h2>

            <div v-if="upcomingServices.length === 0" class="rounded-lg border border-dashed border-gray-700 py-10 text-center">
              <p class="text-sm text-gray-400 mb-3">No upcoming services. Create your first service to get started.</p>
              <button
                type="button"
                class="inline-flex items-center gap-2 rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-500 transition-colors"
                @click="dialogOpen = true"
              >
                New Service
              </button>
            </div>

            <div v-else class="space-y-2">
              <ServiceCard
                v-for="service in upcomingServices"
                :key="service.id"
                :service="service"
              />
            </div>
          </section>

          <!-- Past services section -->
          <section v-if="pastServices.length > 0">
            <button
              type="button"
              class="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-gray-500 hover:text-gray-300 transition-colors mb-3"
              @click="showPast = !showPast"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="h-3.5 w-3.5 transition-transform"
                :class="showPast ? 'rotate-90' : ''"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                stroke-width="2"
              >
                <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
              </svg>
              Past Services ({{ pastServices.length }})
            </button>

            <div v-if="showPast" class="space-y-2">
              <ServiceCard
                v-for="service in pastServices"
                :key="service.id"
                :service="service"
              />
            </div>
          </section>
        </template>
      </template>

      <!-- Rotation Tab -->
      <template v-else-if="activeTab === 'rotation'">
        <RotationTable :services="serviceStore.services" />
      </template>
    </div>

    <!-- New Service Dialog -->
    <NewServiceDialog
      :open="dialogOpen"
      @close="dialogOpen = false"
      @create="onCreateService"
    />
  </AppShell>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '@/firebase'
import { useAuthStore } from '@/stores/auth'
import { useServiceStore } from '@/stores/services'
import AppShell from '@/components/AppShell.vue'
import ServiceCard from '@/components/ServiceCard.vue'
import NewServiceDialog from '@/components/NewServiceDialog.vue'
import RotationTable from '@/components/RotationTable.vue'

const router = useRouter()
const authStore = useAuthStore()
const serviceStore = useServiceStore()

const activeTab = ref<'services' | 'rotation'>('services')
const dialogOpen = ref(false)
const showPast = ref(false)

// Compute today's ISO date string for comparison
const todayStr = computed(() => {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
})

// Upcoming: date >= today, sorted ascending
const upcomingServices = computed(() =>
  serviceStore.services
    .filter((s) => s.date >= todayStr.value)
    .sort((a, b) => a.date.localeCompare(b.date)),
)

// Past: date < today, sorted descending (most recent first)
const pastServices = computed(() =>
  serviceStore.services
    .filter((s) => s.date < todayStr.value)
    .sort((a, b) => b.date.localeCompare(a.date)),
)

// Subscribe to Firestore services collection once orgId is resolved
async function initStore() {
  const user = authStore.user
  if (!user) return

  const userSnap = await getDoc(doc(db, 'users', user.uid))
  const orgIds: string[] = userSnap.data()?.orgIds ?? []
  if (orgIds[0]) {
    serviceStore.subscribe(orgIds[0])
  }
}

onMounted(async () => {
  await initStore()
})

onUnmounted(() => {
  serviceStore.unsubscribeAll()
})

async function onCreateService(data: { date: string; teams: string[] }) {
  dialogOpen.value = false
  const id = await serviceStore.createService(data)
  await router.push(`/services/${id}`)
}
</script>
