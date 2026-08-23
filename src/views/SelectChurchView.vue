<template>
  <div class="min-h-screen bg-gray-950 flex items-center justify-center px-4">
    <div class="w-full max-w-sm">
      <!-- Brand -->
      <div class="text-center mb-8">
        <h1 class="text-2xl font-semibold text-white tracking-tight">Worship Planner</h1>
        <p class="text-sm text-gray-400 mt-1">
          {{ hasChurches ? 'Choose a church to continue' : 'No church yet' }}
        </p>
      </div>

      <div class="bg-gray-900 border border-gray-800 rounded-xl shadow-xl p-6 space-y-4">
        <!-- R213 (Phase 76) — store-driven deactivation message, distinct
             from this view's own selectOrg-try/catch errorMessage below. -->
        <p
          v-if="authStore.deactivatedOrgMessage"
          data-testid="deactivated-message"
          class="text-sm text-amber-400 bg-amber-950 border border-amber-800 rounded-lg px-3 py-2"
        >
          {{ authStore.deactivatedOrgMessage }}
        </p>

        <!-- Church picker (multi-org user) -->
        <template v-if="hasChurches">
          <button
            v-for="m in authStore.memberships"
            :key="m.id"
            type="button"
            @click="choose(m.id)"
            :disabled="isSelecting || m.active === false"
            data-testid="church-option"
            class="w-full flex items-center justify-between gap-3 px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-sm font-medium text-gray-100 hover:bg-gray-700 hover:border-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-left"
          >
            <span class="truncate">
              {{ m.name }}
              <span v-if="m.active === false" class="text-gray-500 text-xs ml-1">(deactivated)</span>
            </span>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-4 w-4 shrink-0 text-gray-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              stroke-width="2"
            >
              <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </template>

        <!-- Empty state (no membership, no invite) -->
        <p v-else data-testid="no-church" class="text-sm text-gray-400 text-center leading-relaxed">
          You haven't been added to a church yet. Ask your administrator to invite you by email, then
          sign in again.
        </p>

        <!-- Error -->
        <p
          v-if="errorMessage"
          class="text-sm text-red-400 bg-red-950 border border-red-800 rounded-lg px-3 py-2"
        >
          {{ errorMessage }}
        </p>

        <div class="pt-2 border-t border-gray-800">
          <button
            type="button"
            @click="handleLogout"
            data-testid="logout"
            class="w-full px-4 py-2 text-sm font-medium text-gray-300 hover:text-white transition-colors"
          >
            Log out
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const authStore = useAuthStore()

const isSelecting = ref(false)
const errorMessage = ref('')

const hasChurches = computed(() => authStore.memberships.length > 0)

async function choose(orgId: string) {
  if (isSelecting.value) return
  isSelecting.value = true
  errorMessage.value = ''
  try {
    await authStore.selectOrg(orgId)
    await router.push('/')
  } catch (err) {
    console.error('[SelectChurch] selectOrg failed:', err)
    errorMessage.value = 'Could not open that church. Please try again.'
    isSelecting.value = false
  }
}

async function handleLogout() {
  await authStore.logout()
  await router.push('/login')
}
</script>
