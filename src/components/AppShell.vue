<template>
  <div class="flex h-screen bg-gray-950 overflow-hidden">
    <!-- Mobile sidebar overlay backdrop -->
    <div
      v-if="sidebarOpen"
      class="fixed inset-0 z-20 bg-black/50 lg:hidden"
      @click="sidebarOpen = false"
    ></div>

    <!-- Sidebar -->
    <AppSidebar
      :sidebar-open="sidebarOpen"
      @close="sidebarOpen = false"
    />

    <!-- Main content area -->
    <div class="flex-1 flex flex-col min-w-0 overflow-hidden">
      <!-- Mobile header with hamburger -->
      <div class="lg:hidden flex items-center h-14 px-4 bg-gray-900 border-b border-gray-800 shrink-0">
        <button
          @click="sidebarOpen = true"
          class="p-1.5 rounded-md text-gray-400 hover:text-gray-200 hover:bg-gray-800 transition-colors"
          aria-label="Open sidebar"
        >
          <!-- Hamburger icon -->
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <span class="ml-3 text-sm font-semibold text-gray-100">Worship Planner</span>
      </div>

      <!-- R227 (Phase 78) — persistent "viewing as super-admin" mode
           indicator. Visible above <main> regardless of sidebar state, on
           both mobile and desktop. This banner is the ENTIRE R227 UX
           contract, so it uses a visually distinct (amber) treatment rather
           than ordinary chrome. -->
      <div
        v-if="authStore.viewingAsSuperAdmin"
        class="flex flex-wrap items-center justify-between gap-2 px-4 py-2 bg-amber-900/40 border-b border-amber-700/60 text-amber-200 text-sm shrink-0"
      >
        <span>
          Viewing <strong class="font-semibold">{{ authStore.orgName || authStore.viewingAsSuperAdmin }}</strong>
          as super-admin
        </span>
        <button
          type="button"
          @click="onExitSuperAdminView"
          class="text-xs font-medium text-amber-100 hover:text-white underline underline-offset-2 transition-colors"
        >
          Exit to owner console
        </button>
      </div>

      <!-- Page content -->
      <main class="flex-1 overflow-y-auto">
        <slot />
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import AppSidebar from '@/components/AppSidebar.vue'
import { useAuthStore } from '@/stores/auth'

const sidebarOpen = ref(false)

const router = useRouter()
const authStore = useAuthStore()

async function onExitSuperAdminView(): Promise<void> {
  // Quick 260823: exitSuperAdminView is now async (it reloads the super-admin's
  // own church context). Await it so the nav has settled before we navigate.
  await authStore.exitSuperAdminView()
  router?.push('/owner-console')
}
</script>
