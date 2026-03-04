<template>
  <AppShell>
    <div class="px-6 py-8 max-w-4xl">
      <!-- Page header -->
      <div class="mb-6">
        <h1 class="text-xl font-semibold text-gray-100">Dashboard</h1>
        <p class="text-sm text-gray-400 mt-1">
          Welcome{{ displayName ? `, ${displayName}` : '' }}
        </p>
      </div>

      <!-- Getting started checklist: editor only, hides when complete -->
      <GettingStarted v-if="authStore.isEditor" class="mb-6" />

      <!-- Quick stats -->
      <div class="grid grid-cols-3 gap-3">
        <router-link
          to="/songs"
          class="bg-gray-900 border border-gray-800 rounded-lg px-4 py-3 hover:bg-gray-800/50 transition-colors"
        >
          <p class="text-2xl font-bold text-gray-100">{{ songStore.songs.length }}</p>
          <p class="text-xs text-gray-500">Songs</p>
        </router-link>
        <router-link
          to="/services"
          class="bg-gray-900 border border-gray-800 rounded-lg px-4 py-3 hover:bg-gray-800/50 transition-colors"
        >
          <p class="text-2xl font-bold text-gray-100">{{ upcomingServices.length }}</p>
          <p class="text-xs text-gray-500">Upcoming services</p>
        </router-link>
        <router-link
          to="/songs"
          class="bg-gray-900 border border-gray-800 rounded-lg px-4 py-3 hover:bg-gray-800/50 transition-colors"
        >
          <p class="text-2xl font-bold" :class="uncategorizedCount > 0 ? 'text-amber-400' : 'text-gray-100'">{{ uncategorizedCount }}</p>
          <p class="text-xs text-gray-500">Uncategorized songs</p>
        </router-link>
      </div>
    </div>
  </AppShell>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useSongStore } from '@/stores/songs'
import { useServiceStore } from '@/stores/services'
import AppShell from '@/components/AppShell.vue'
import GettingStarted from '@/components/GettingStarted.vue'

const authStore = useAuthStore()
const songStore = useSongStore()
const serviceStore = useServiceStore()

const displayName = computed(() => {
  return authStore.user?.displayName || authStore.user?.email?.split('@')[0] || ''
})

const todayStr = computed(() => {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
})

const upcomingServices = computed(() =>
  serviceStore.services
    .filter((s) => s.date >= todayStr.value)
    .sort((a, b) => a.date.localeCompare(b.date)),
)

const uncategorizedCount = computed(() =>
  songStore.songs.filter((s) => s.vwType === null).length,
)

// Subscribe to songs and services so dashboard data is reactive
onMounted(() => {
  const orgId = authStore.orgId
  if (!orgId) return
  if (!songStore.orgId) {
    songStore.subscribe(orgId)
  }
  if (!serviceStore.orgId) {
    serviceStore.subscribe(orgId)
  }
})
</script>
