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
        <span class="ml-3 text-sm font-semibold text-gray-100">WorshipPlanner</span>
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
import AppSidebar from '@/components/AppSidebar.vue'

const sidebarOpen = ref(false)
</script>
