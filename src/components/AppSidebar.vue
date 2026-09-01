<template>
  <!-- Sidebar: overlay on mobile, fixed on desktop -->
  <aside
    class="fixed inset-y-0 left-0 z-30 flex flex-col bg-gray-900 border-r border-gray-800 transition-transform duration-200 w-64 lg:static lg:z-auto lg:flex lg:w-64 lg:shrink-0"
    :class="sidebarOpen ? 'translate-x-0' : 'max-lg:-translate-x-full'"
  >
    <!-- Brand -->
    <div class="flex items-center h-14 px-5 border-b border-gray-800 shrink-0">
      <div>
        <span class="text-sm font-semibold text-gray-100 tracking-tight">Worship Planner</span>
        <p class="text-[10px] text-gray-600 leading-none">v{{ appVersion }}</p>
      </div>
    </div>

    <!-- Org name / super-admin location indicator -->
    <div
      v-if="authStore.orgName || authStore.superAdminOutsideOwnChurch"
      class="px-5 py-2 border-b border-gray-800"
    >
      <template v-if="authStore.orgName">
        <p class="text-xs text-gray-500 truncate">{{ authStore.orgName }}</p>
        <!-- Quick 260823: make it clear this church is being viewed as a
             super-admin, not the super-admin's own church. -->
        <p v-if="authStore.viewingAsSuperAdmin" class="text-[10px] text-amber-400 truncate">
          viewing as super-admin
        </p>
      </template>
      <!-- Super-admin sitting at the Owner Console with no active church. -->
      <p v-else class="text-xs text-amber-400 truncate">Super Admin · not in a church</p>
    </div>

    <!-- Nav -->
    <nav class="flex-1 overflow-y-auto py-4 px-3 space-y-0.5">
      <template v-for="item in navItems" :key="item.to">
        <div v-if="item.separatorBefore" class="my-2 border-t border-gray-800" aria-hidden="true" />
        <router-link
          :to="item.to"
          @click="$emit('close')"
          class="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors group"
          :class="isActive(item.to)
            ? 'bg-indigo-600/20 text-indigo-300'
            : 'text-gray-400 hover:bg-gray-800 hover:text-gray-100'"
        >
          <span class="shrink-0" :class="isActive(item.to) ? 'text-indigo-400' : 'text-gray-500 group-hover:text-gray-300'" v-html="item.icon"></span>
          {{ item.label }}
        </router-link>
      </template>
    </nav>

    <!-- User + Sign out -->
    <div class="border-t border-gray-800 p-3 shrink-0">
      <div class="relative">
        <!-- Static user block (single-org, or super-admin viewing-as — R311
             gate keeps zero visual change here for both cases). -->
        <div v-if="!hasSwitcher" class="flex items-center gap-3 px-2 py-2 mb-1">
          <!-- Avatar with initials -->
          <div class="w-7 h-7 rounded-full bg-indigo-600/30 flex items-center justify-center shrink-0">
            <span class="text-xs font-semibold text-indigo-300 uppercase">{{ userInitials }}</span>
          </div>
          <div class="flex-1 min-w-0">
            <p class="text-xs font-medium text-gray-200 truncate">{{ displayName }}</p>
            <p class="text-xs text-gray-500 truncate">{{ userEmail }}</p>
          </div>
        </div>

        <!-- Church switcher (R311/R312, Phase 104): multi-org member, not
             currently viewing another church as super-admin. -->
        <template v-else>
          <button
            ref="switcherTriggerRef"
            type="button"
            aria-haspopup="menu"
            :aria-expanded="switcherOpen ? 'true' : 'false'"
            data-testid="church-switcher-trigger"
            class="w-full flex items-center gap-3 px-2 py-2 mb-1 rounded-lg hover:bg-gray-800 transition-colors"
            @click="toggleSwitcher"
          >
            <div class="w-7 h-7 rounded-full bg-indigo-600/30 flex items-center justify-center shrink-0">
              <span class="text-xs font-semibold text-indigo-300 uppercase">{{ userInitials }}</span>
            </div>
            <div class="flex-1 min-w-0 text-left">
              <p class="text-xs font-medium text-gray-200 truncate">{{ displayName }}</p>
              <p class="text-xs text-gray-500 truncate">{{ userEmail }}</p>
            </div>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-3.5 w-3.5 text-gray-600 shrink-0 transition-transform"
              :class="switcherOpen ? 'rotate-180' : ''"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              stroke-width="2"
            >
              <path stroke-linecap="round" stroke-linejoin="round" d="M5 15l7-7 7 7" />
            </svg>
          </button>

          <div v-if="switcherOpen" class="fixed inset-0 z-10" @click="closeSwitcher" />

          <Transition
            enter-active-class="transition duration-100 ease-out"
            enter-from-class="opacity-0 scale-95"
            enter-to-class="opacity-100 scale-100"
            leave-active-class="transition duration-75 ease-in"
            leave-from-class="opacity-100 scale-100"
            leave-to-class="opacity-0 scale-95"
          >
            <div
              v-if="switcherOpen"
              ref="switcherPanelRef"
              role="menu"
              data-testid="church-switcher-panel"
              class="absolute inset-x-3 bottom-full mb-2 rounded-lg border border-gray-700 bg-gray-800 shadow-xl z-20 max-h-64 overflow-y-auto"
              @keydown="onSwitcherKeydown"
            >
              <p class="text-xs font-medium uppercase tracking-wide text-gray-500 px-3 pt-2 pb-1">
                Switch church
              </p>
              <template v-for="m in authStore.memberships" :key="m.id">
                <!-- Current active church: non-interactive row -->
                <div
                  v-if="m.id === authStore.orgId"
                  role="menuitem"
                  aria-current="true"
                  data-testid="church-switcher-current"
                  class="flex items-center justify-between gap-2 px-3 py-2 text-sm cursor-default bg-indigo-600/20 text-indigo-300"
                >
                  <span class="flex items-center gap-2 min-w-0">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      class="h-3.5 w-3.5 shrink-0"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      stroke-width="2"
                    >
                      <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    <span class="truncate">{{ m.name }}</span>
                  </span>
                  <span
                    class="px-1.5 py-0.5 text-xs rounded shrink-0"
                    :class="m.role === 'editor' ? 'bg-indigo-900/50 text-indigo-300' : 'bg-gray-700 text-gray-300'"
                  >
                    {{ m.role === 'editor' ? 'Editor' : 'Viewer' }}
                  </span>
                </div>

                <!-- Other church: real menu item -->
                <button
                  v-else
                  type="button"
                  role="menuitem"
                  data-testid="church-switcher-option"
                  :disabled="switchingId === m.id || m.active === false"
                  class="w-full flex items-center justify-between gap-2 px-3 py-2 text-sm text-gray-200 hover:bg-gray-700 transition-colors text-left disabled:cursor-not-allowed"
                  :class="m.active === false ? 'opacity-50' : ''"
                  @click="handleSwitch(m.id)"
                >
                  <span class="truncate">
                    {{ m.name }}
                    <span v-if="m.active === false" class="text-gray-500 text-xs ml-1">(deactivated)</span>
                  </span>
                  <svg
                    v-if="switchingId === m.id"
                    xmlns="http://www.w3.org/2000/svg"
                    class="h-3.5 w-3.5 animate-spin text-indigo-400 shrink-0"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                  </svg>
                  <span
                    v-else
                    class="px-1.5 py-0.5 text-xs rounded shrink-0"
                    :class="m.role === 'editor' ? 'bg-indigo-900/50 text-indigo-300' : 'bg-gray-700 text-gray-300'"
                  >
                    {{ m.role === 'editor' ? 'Editor' : 'Viewer' }}
                  </span>
                </button>
              </template>
            </div>
          </Transition>
        </template>
      </div>
      <button
        @click="handleSignOut"
        class="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium text-gray-500 hover:bg-gray-800 hover:text-gray-300 transition-colors"
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
import { computed, nextTick, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useToasts } from '@/stores/toasts'

const props = defineProps<{
  sidebarOpen: boolean
}>()

defineEmits<{
  close: []
}>()

const route = useRoute()
const router = useRouter()
declare const __APP_VERSION__: string
const appVersion = __APP_VERSION__

const authStore = useAuthStore()
const toasts = useToasts()

// Phase 104 (R311) — the switcher only ever renders for a genuine multi-org
// member who is NOT currently viewing another church via
// enterOrgAsSuperAdmin(). The two switch mechanisms (this one and the
// existing "viewing as super-admin" banner/exit affordance) must never stack
// in the same UI (T-104-06).
const hasSwitcher = computed(
  () => authStore.memberships.length > 1 && !authStore.viewingAsSuperAdmin,
)

const switcherOpen = ref(false)
// Which membership id is currently mid-selectOrg() — null when no switch is
// in flight. Distinguishes the row-scoped in-flight state (spinner + that
// row's own disabled attribute) from switcherOpen (whether the panel itself
// is shown at all).
const switchingId = ref<string | null>(null)
const switcherTriggerRef = ref<HTMLButtonElement | null>(null)
const switcherPanelRef = ref<HTMLElement | null>(null)

// SlideActionMenu.vue's ARIA-menu pattern, reused verbatim: opening the
// panel moves focus to its first menuitem.
watch(switcherOpen, async (isOpen) => {
  if (!isOpen) return
  await nextTick()
  switcherPanelRef.value?.querySelector<HTMLElement>('[role="menuitem"]')?.focus()
})

function toggleSwitcher(): void {
  switcherOpen.value = !switcherOpen.value
}

function closeSwitcher(): void {
  switcherOpen.value = false
}

function onSwitcherKeydown(event: KeyboardEvent): void {
  if (event.key !== 'Escape') return
  switcherOpen.value = false
  switcherTriggerRef.value?.focus()
}

// Switches active church via authStore.selectOrg() ONLY — never a parallel
// org-context path, never enterOrgAsSuperAdmin() (T-104-04). selectOrg()
// itself routes through resetOrgScopedStores() before loading the new org,
// so no prior-church data survives the switch (R312). A guard against
// overlapping switches: a second click while one is already in flight is a
// harmless no-op (mirrors SelectChurchView.vue's isSelecting guard), even
// though only the clicked row's own disabled attribute reflects in-flight
// state per the UI-SPEC.
async function handleSwitch(targetOrgId: string): Promise<void> {
  if (switchingId.value !== null) return
  switchingId.value = targetOrgId
  try {
    await authStore.selectOrg(targetOrgId)
    switcherOpen.value = false
  } catch (err) {
    console.error('[AppSidebar] church switch failed:', err)
    toasts.push('Could not switch churches. Please try again.', { variant: 'error' })
  } finally {
    switchingId.value = null
  }
}

const navItems = computed(() => {
  const items = []

  if (authStore.isEditor) {
    items.push({
      label: 'Dashboard',
      to: '/',
      icon: `<svg xmlns="http://www.w3.org/2000/svg" class="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
        <path stroke-linecap="round" stroke-linejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>`,
    })
  }

  // Group A: Services (visible for all roles), Songs — but only when there is
  // an active church context. Quick 260823: previously pushed unconditionally,
  // which left a stray "Services" link at the Owner Console after a super-admin
  // exited a visited church (userRole null hid every isEditor item but not this
  // one). Gate it on orgId so a super-admin with no active church sees only the
  // Owner Console.
  if (authStore.orgId) {
    items.push({
      label: 'Services',
      to: '/services',
      icon: `<svg xmlns="http://www.w3.org/2000/svg" class="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
        <path stroke-linecap="round" stroke-linejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>`,
    })
  }

  // R267/R275 — deliberately gated on authStore.orgId ONLY, matching the
  // Services item above, NOT authStore.isEditor like the adjacent Group C
  // Settings item below. Monitor setup is a device config screen reachable
  // by any authenticated org member (editor or viewer) — do not tighten this
  // to isEditor.
  if (authStore.orgId) {
    items.push({
      label: 'Monitor Setup',
      to: '/monitor-setup',
      icon: `<svg xmlns="http://www.w3.org/2000/svg" class="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
        <path stroke-linecap="round" stroke-linejoin="round" d="M3 5a2 2 0 012-2h14a2 2 0 012 2v10a2 2 0 01-2 2h-6l1 3h1a1 1 0 010 2H9a1 1 0 010-2h1l1-3H5a2 2 0 01-2-2V5z" />
      </svg>`,
    })
  }

  if (authStore.isEditor) {
    items.push({
      label: 'Songs',
      to: '/songs',
      icon: `<svg xmlns="http://www.w3.org/2000/svg" class="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
        <path stroke-linecap="round" stroke-linejoin="round" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
      </svg>`,
    })
  }

  // Group B: Schedule, Volunteers
  if (authStore.isEditor) {
    items.push({
      label: 'Schedule',
      to: '/schedule',
      separatorBefore: true,
      icon: `<svg xmlns="http://www.w3.org/2000/svg" class="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
        <path stroke-linecap="round" stroke-linejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        <path stroke-linecap="round" stroke-linejoin="round" d="M8 14h.01M12 14h.01M16 14h.01M8 17h.01M12 17h.01" />
      </svg>`,
    })
  }

  if (authStore.isEditor) {
    items.push({
      label: 'Volunteers',
      to: '/volunteers',
      icon: `<svg xmlns="http://www.w3.org/2000/svg" class="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
        <path stroke-linecap="round" stroke-linejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
      </svg>`,
    })
  }

  // Group C: Admins, Settings
  if (authStore.isEditor) {
    items.push({
      label: 'Admins',
      to: '/admins',
      separatorBefore: true,
      icon: `<svg xmlns="http://www.w3.org/2000/svg" class="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
        <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
      </svg>`,
    })
  }

  if (authStore.isEditor) {
    items.push({
      label: 'Settings',
      to: '/settings',
      icon: `<svg xmlns="http://www.w3.org/2000/svg" class="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
        <path stroke-linecap="round" stroke-linejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>`,
    })
  }

  // Group D: Owner Console — platform-level, super-admin-only (R177). Separated
  // from Group C's per-org "Admins"/"Settings" to make clear this is a
  // different, higher-privilege surface, not a per-org role.
  if (authStore.isSuperAdmin) {
    items.push({
      label: 'Owner Console',
      to: '/owner-console',
      separatorBefore: true,
      icon: `<svg xmlns="http://www.w3.org/2000/svg" class="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
        <path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
      </svg>`,
    })
  }

  return items
})

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
