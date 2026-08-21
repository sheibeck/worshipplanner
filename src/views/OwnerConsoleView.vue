<template>
  <AppShell>
    <div class="px-6 py-8 max-w-4xl">
      <!-- Page header -->
      <div class="mb-6 pb-4 border-b border-gray-800">
        <h1 class="text-xl font-semibold text-gray-100">Owner Console</h1>
        <p class="text-sm text-gray-400 mt-1">Platform-level super-admin access and configuration</p>
      </div>

      <!-- Tab bar: Configuration / Organizations (Phase 72). Mirrors
           ServiceEditorView.vue's tab-strip pattern exactly — plain buttons,
           no ARIA tab roles (UI-SPEC "Component Spec: Tab Strip"). -->
      <div class="flex items-center gap-1 mb-3 border-b border-gray-800 pb-0">
        <button
          type="button"
          class="px-4 py-2 text-sm font-medium rounded-t-md transition-colors -mb-px border-b-2"
          :class="activeTab === 'configuration'
            ? 'text-indigo-300 border-indigo-500 bg-gray-900'
            : 'text-gray-400 border-transparent hover:text-gray-200 hover:border-gray-600'"
          @click="setTab('configuration')"
        >
          Configuration
        </button>
        <button
          type="button"
          class="px-4 py-2 text-sm font-medium rounded-t-md transition-colors -mb-px border-b-2"
          :class="activeTab === 'organizations'
            ? 'text-indigo-300 border-indigo-500 bg-gray-900'
            : 'text-gray-400 border-transparent hover:text-gray-200 hover:border-gray-600'"
          @click="setTab('organizations')"
        >
          Organizations
        </button>
      </div>

      <!-- Panes: v-show (NEVER v-if) — ConfigurationTab's roster onSnapshot
           and appConfigStore subscribe()/unsubscribe() are not
           idempotency-guarded, so it must stay permanently mounted for the
           life of this console regardless of which tab is active. -->
      <div v-show="activeTab === 'configuration'" data-testid="configuration-panel">
        <ConfigurationTab />
      </div>
      <div v-show="activeTab === 'organizations'" data-testid="organizations-panel">
        <OrganizationsTab />
      </div>
    </div>
  </AppShell>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppShell from '@/components/AppShell.vue'
import ConfigurationTab from '@/components/admin/ConfigurationTab.vue'
import OrganizationsTab from '@/components/admin/OrganizationsTab.vue'

type OwnerConsoleTab = 'configuration' | 'organizations'

function normalizeTab(raw: unknown): OwnerConsoleTab {
  return raw === 'organizations' ? 'organizations' : 'configuration'
}

// `useRoute()`/`useRouter()` return undefined when this view is mounted
// without a router (existing OwnerConsoleView.test.ts harness) — every read
// below is optional-chained (RosterView.vue precedent, RESEARCH Pitfall 2).
const route = useRoute()
const router = useRouter()

const activeTab = ref<OwnerConsoleTab>(normalizeTab(route?.query.tab))

// Tracks external query changes (e.g. browser back/forward) so activeTab
// stays in sync with the URL, not just on initial load.
watch(
  () => route?.query.tab,
  (v) => {
    activeTab.value = normalizeTab(v)
  },
)

function setTab(tab: OwnerConsoleTab) {
  if (activeTab.value === tab) return
  activeTab.value = tab
  router?.replace({ query: { ...route?.query, tab } })
}
</script>
