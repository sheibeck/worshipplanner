<template>
  <AppShell>
    <div class="px-6 py-8 max-w-3xl">
      <!-- Page header -->
      <div class="mb-6">
        <h1 class="text-xl font-semibold text-slate-900">Dashboard</h1>
        <p class="text-sm text-slate-500 mt-1">
          Welcome{{ displayName ? `, ${displayName}` : '' }}
        </p>
      </div>

      <!-- Getting started checklist -->
      <GettingStarted />
    </div>
  </AppShell>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useAuthStore } from '@/stores/auth'
import AppShell from '@/components/AppShell.vue'
import GettingStarted from '@/components/GettingStarted.vue'

const authStore = useAuthStore()

const displayName = computed(() => {
  return authStore.user?.displayName || authStore.user?.email?.split('@')[0] || ''
})
</script>
