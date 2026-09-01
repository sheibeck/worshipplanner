<template>
  <AppShell>
    <div class="px-6 py-8">
      <!-- Page header -->
      <div class="mb-6 pb-4 border-b border-gray-800">
        <h1 class="text-xl font-semibold text-gray-100">Owner Console</h1>
        <p class="text-sm text-gray-400 mt-1">Platform-level super-admin access and configuration</p>
      </div>

      <!-- See ADR-0217 (docs/adr/0217-roving-tabindex-on-the-tab-bar-above-removes-inactive-tabs-f.md) -->
      <div role="tablist" class="flex items-center gap-1 mb-3 border-b border-gray-800 pb-0" @keydown="handleTabKeydown">
        <button
          id="owner-tab-configuration"
          ref="configurationTabButtonRef"
          role="tab"
          type="button"
          :aria-selected="activeTab === 'configuration'"
          aria-controls="owner-panel-configuration"
          :tabindex="activeTab === 'configuration' ? 0 : -1"
          class="px-4 py-2 text-sm font-medium rounded-t-md transition-colors -mb-px border-b-2"
          :class="activeTab === 'configuration'
            ? 'text-indigo-300 border-indigo-500 bg-gray-900'
            : 'text-gray-400 border-transparent hover:text-gray-200 hover:border-gray-600'"
          @click="setTab('configuration')"
        >
          Configuration
        </button>
        <button
          id="owner-tab-organizations"
          ref="organizationsTabButtonRef"
          role="tab"
          type="button"
          :aria-selected="activeTab === 'organizations'"
          aria-controls="owner-panel-organizations"
          :tabindex="activeTab === 'organizations' ? 0 : -1"
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
      <div
        v-show="activeTab === 'configuration'"
        id="owner-panel-configuration"
        role="tabpanel"
        aria-labelledby="owner-tab-configuration"
        data-testid="configuration-panel"
        class="max-w-4xl"
      >
        <ConfigurationTab />
      </div>
      <div
        v-show="activeTab === 'organizations'"
        id="owner-panel-organizations"
        role="tabpanel"
        aria-labelledby="owner-tab-organizations"
        data-testid="organizations-panel"
      >
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

// See ADR-0218 (docs/adr/0218-useroute-userouter-return-undefined-when-this-view-is-mounte.md)
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

// See ADR-0217 (docs/adr/0217-roving-tabindex-on-the-tab-bar-above-removes-inactive-tabs-f.md)
const TAB_ORDER: OwnerConsoleTab[] = ['configuration', 'organizations']
const configurationTabButtonRef = ref<HTMLButtonElement | null>(null)
const organizationsTabButtonRef = ref<HTMLButtonElement | null>(null)

function tabButtonRef(tab: OwnerConsoleTab) {
  return tab === 'configuration' ? configurationTabButtonRef : organizationsTabButtonRef
}

function focusAndActivateTab(tab: OwnerConsoleTab) {
  setTab(tab)
  tabButtonRef(tab).value?.focus()
}

function handleTabKeydown(event: KeyboardEvent) {
  const currentIndex = TAB_ORDER.indexOf(activeTab.value)
  let nextIndex: number | null = null
  switch (event.key) {
    case 'ArrowRight':
      nextIndex = (currentIndex + 1) % TAB_ORDER.length
      break
    case 'ArrowLeft':
      nextIndex = (currentIndex - 1 + TAB_ORDER.length) % TAB_ORDER.length
      break
    case 'Home':
      nextIndex = 0
      break
    case 'End':
      nextIndex = TAB_ORDER.length - 1
      break
    default:
      return
  }
  event.preventDefault()
  focusAndActivateTab(TAB_ORDER[nextIndex]!)
}
</script>
