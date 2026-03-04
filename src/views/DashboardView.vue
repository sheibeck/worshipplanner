<template>
  <AppShell>
    <div class="px-6 py-8 max-w-3xl">
      <!-- Page header -->
      <div class="mb-6">
        <h1 class="text-xl font-semibold text-gray-100">Dashboard</h1>
        <p class="text-sm text-gray-400 mt-1">
          Welcome{{ displayName ? `, ${displayName}` : '' }}
        </p>
      </div>

      <!-- Getting started checklist: editor only -->
      <GettingStarted v-if="authStore.isEditor" />
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

// Subscribe to songs and services on dashboard so GettingStarted steps 2 and 3 are reactive
// Guard: if already subscribed (orgId already set), skip to avoid double-subscription
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
