<template>
  <!-- Sidebar: overlay on mobile, fixed on desktop -->
  <aside
    :class="[
      'fixed inset-y-0 left-0 z-30 flex flex-col bg-white border-r border-slate-200 transition-transform duration-200',
      'w-64',
      'lg:translate-x-0 lg:static lg:z-auto lg:flex lg:w-64 lg:shrink-0',
      sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
    ]"
  >
    <!-- Brand -->
    <div class="flex items-center h-14 px-5 border-b border-slate-200 shrink-0">
      <span class="text-sm font-semibold text-slate-900 tracking-tight">WorshipPlanner</span>
    </div>

    <!-- Nav -->
    <nav class="flex-1 overflow-y-auto py-4 px-3 space-y-0.5">
      <router-link
        v-for="item in navItems"
        :key="item.to"
        :to="item.to"
        @click="$emit('close')"
        class="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors group"
        :class="isActive(item.to)
          ? 'bg-indigo-50 text-indigo-700'
          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'"
      >
        <span class="shrink-0" :class="isActive(item.to) ? 'text-indigo-600' : 'text-slate-400 group-hover:text-slate-500'" v-html="item.icon"></span>
        {{ item.label }}
      </router-link>
    </nav>

    <!-- User + Sign out -->
    <div class="border-t border-slate-200 p-3 shrink-0">
      <div class="flex items-center gap-3 px-2 py-2 mb-1">
        <!-- Avatar with initials -->
        <div class="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
          <span class="text-xs font-semibold text-indigo-700 uppercase">{{ userInitials }}</span>
        </div>
        <div class="flex-1 min-w-0">
          <p class="text-xs font-medium text-slate-900 truncate">{{ displayName }}</p>
          <p class="text-xs text-slate-400 truncate">{{ userEmail }}</p>
        </div>
      </div>
      <button
        @click="handleSignOut"
        class="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors"
      >
        <!-- Sign out icon -->
        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
        </svg>
        Sign out
      </button>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const props = defineProps<{
  sidebarOpen: boolean
}>()

defineEmits<{
  close: []
}>()

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()

const navItems = [
  {
    label: 'Dashboard',
    to: '/',
    icon: `<svg xmlns="http://www.w3.org/2000/svg" class="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
      <path stroke-linecap="round" stroke-linejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
    </svg>`,
  },
  {
    label: 'Songs',
    to: '/songs',
    icon: `<svg xmlns="http://www.w3.org/2000/svg" class="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
      <path stroke-linecap="round" stroke-linejoin="round" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
    </svg>`,
  },
  {
    label: 'Services',
    to: '/services',
    icon: `<svg xmlns="http://www.w3.org/2000/svg" class="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
      <path stroke-linecap="round" stroke-linejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>`,
  },
  {
    label: 'Tasks',
    to: '/tasks',
    icon: `<svg xmlns="http://www.w3.org/2000/svg" class="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
      <path stroke-linecap="round" stroke-linejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
    </svg>`,
  },
]

function isActive(path: string): boolean {
  if (path === '/') {
    return route.path === '/'
  }
  return route.path.startsWith(path)
}

const userInitials = computed(() => {
  const name = authStore.user?.displayName || authStore.user?.email || ''
  if (!name) return '?'
  const parts = name.split(/[\s@]/)
  if (parts.length >= 2 && name.includes(' ') && parts[0] && parts[1]) {
    return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase()
  }
  return name.charAt(0).toUpperCase()
})

const displayName = computed(() => {
  return authStore.user?.displayName || authStore.user?.email?.split('@')[0] || 'User'
})

const userEmail = computed(() => {
  return authStore.user?.email || ''
})

async function handleSignOut() {
  await authStore.logout()
  await router.push('/login')
}
</script>
