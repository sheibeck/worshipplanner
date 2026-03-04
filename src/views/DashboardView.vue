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

      <!-- Getting started checklist -->
      <GettingStarted />
    </div>
  </AppShell>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '@/firebase'
import { useAuthStore } from '@/stores/auth'
import { useSongStore } from '@/stores/songs'
import AppShell from '@/components/AppShell.vue'
import GettingStarted from '@/components/GettingStarted.vue'

const authStore = useAuthStore()
const songStore = useSongStore()

const displayName = computed(() => {
  return authStore.user?.displayName || authStore.user?.email?.split('@')[0] || ''
})

// Subscribe to songs on dashboard so GettingStarted step 2 is reactive
// Guard: if SongsView already subscribed (orgId already set), this is a no-op
onMounted(async () => {
  if (songStore.orgId) return // already subscribed by SongsView

  const user = authStore.user
  if (!user) return

  const userSnap = await getDoc(doc(db, 'users', user.uid))
  const orgIds: string[] = userSnap.data()?.orgIds ?? []
  if (orgIds[0]) {
    songStore.subscribe(orgIds[0])
  }
})
</script>
