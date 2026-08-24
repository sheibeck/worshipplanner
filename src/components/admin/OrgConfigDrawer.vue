<template>
  <Teleport to="body">
    <!-- Backdrop -->
    <Transition
      enter-active-class="transition-opacity duration-200 ease-out"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition-opacity duration-150 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="org"
        class="fixed inset-0 z-40 bg-black/60"
        @click="onClose"
      ></div>
    </Transition>

    <!-- Right drawer -->
    <Transition
      enter-active-class="transition-transform duration-200 ease-out"
      enter-from-class="translate-x-full"
      enter-to-class="translate-x-0"
      leave-active-class="transition-transform duration-150 ease-in"
      leave-from-class="translate-x-0"
      leave-to-class="translate-x-full"
    >
      <div
        v-if="org"
        ref="panelRef"
        class="fixed top-0 right-0 bottom-0 z-50 w-full max-w-lg bg-gray-900 border-l border-gray-700 shadow-2xl flex flex-col"
        data-testid="org-config-drawer"
        tabindex="-1"
      >
        <!-- Header -->
        <div class="flex items-center justify-between gap-3 px-6 py-4 border-b border-gray-800 shrink-0">
          <h2 class="text-base font-semibold text-gray-100 truncate">{{ org.name }}</h2>
          <button
            type="button"
            class="p-1.5 rounded-md text-gray-500 hover:text-gray-300 hover:bg-gray-800 transition-colors"
            aria-label="Close"
            @click="onClose"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <!-- Scrollable body -->
        <div class="flex-1 overflow-y-auto px-6 py-5 space-y-6">

          <!-- AI enablement -->
          <section>
            <label class="inline-flex items-center gap-2 text-sm text-gray-200">
              <input
                type="checkbox"
                data-testid="org-config-ai-checkbox"
                :checked="org.aiMasterEnabled"
                :disabled="aiToggling"
                class="rounded border-gray-600 bg-gray-800 text-indigo-600 focus:ring-indigo-500 focus:ring-offset-gray-900"
                @change="emit('toggle-ai')"
              />
              Enable AI features
            </label>
            <p class="text-xs text-gray-400 mt-1.5">
              {{ aiToggling
                ? (org.aiMasterEnabled ? 'Disabling AI...' : 'Enabling AI...')
                : "Turns this church's AI-powered features on or off." }}
            </p>
            <p v-if="aiError" class="text-red-400 text-xs mt-1.5">{{ aiError }}</p>
          </section>

          <!-- Active -->
          <section class="border-t border-gray-800 pt-5">
            <label class="inline-flex items-center gap-2 text-sm text-gray-200">
              <input
                type="checkbox"
                data-testid="org-config-active-checkbox"
                :checked="org.active"
                :disabled="activeToggling"
                class="rounded border-gray-600 bg-gray-800 text-indigo-600 focus:ring-indigo-500 focus:ring-offset-gray-900"
                @change="onActiveChange"
              />
              Active
            </label>
            <p class="text-xs text-gray-400 mt-1.5">
              {{ activeToggling
                ? (org.active ? 'Deactivating...' : 'Reactivating...')
                : "Unchecking deactivates the church — members can't log in until it is reactivated." }}
            </p>
            <p v-if="activeError" class="text-red-400 text-xs mt-1.5">{{ activeError }}</p>
            <p
              v-if="activeFeedback"
              :class="activeFeedbackIsWarning ? 'text-amber-400' : 'text-green-400'"
              class="text-xs mt-1.5"
            >
              {{ activeFeedback }}
            </p>
          </section>

        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
// Quick task 260824 — per-org configuration slideout. Shell copied from
// AvailabilityDrawer.vue (Teleport, backdrop/panel Transitions, right-side
// panel layout); Escape + focus handling copied from EditSlideDrawer.vue
// (remember document.activeElement on open, focus the panel via
// tabindex="-1" after nextTick, restore on close/unmount). Purely
// presentational — OrganizationsTab.vue owns every callable and all
// in-flight/error state; this component only emits intent.
import { nextTick, ref, watch, onUnmounted } from 'vue'

// Mirrors OrganizationsTab.vue's own OrgSummary interface (Phase 74/82) —
// kept as a local, structurally-identical interface rather than importing
// from the tab, matching how DeleteOrgConfirmDialog/other admin dialogs stay
// standalone with their own prop-shaped types.
interface OrgSummary {
  orgId: string
  name: string
  createdAt: unknown
  memberCount: number
  pendingCount: number
  active: boolean
  aiMasterEnabled?: boolean
}

const props = defineProps<{
  org: OrgSummary | null
  aiToggling: boolean
  aiError: string | null
  activeToggling: boolean
  activeError: string | null
  activeFeedback: string | null
  activeFeedbackIsWarning: boolean
}>()

const emit = defineEmits<{
  close: []
  'toggle-ai': []
  'request-deactivate': []
  reactivate: []
}>()

const panelRef = ref<HTMLElement | null>(null)
let previouslyFocused: HTMLElement | null = null

function onClose(): void {
  emit('close')
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') {
    emit('close')
  }
}

// The Active checkbox never toggles state itself (one-way :checked binding
// driven by org.active) — it only signals INTENT. Deactivating (currently
// active, box unchecked) routes through the parent's confirm dialog;
// reactivating (currently inactive, box checked) applies directly. The
// parent derives the desired boolean from current state, so no payload is
// needed on either emit (this plan's key_links).
function onActiveChange(): void {
  if (!props.org) return
  if (props.org.active) {
    emit('request-deactivate')
  } else {
    emit('reactivate')
  }
}

watch(
  () => props.org,
  async (org) => {
    if (org) {
      previouslyFocused = (document.activeElement as HTMLElement | null) ?? null
      window.addEventListener('keydown', onKeydown)
      await nextTick()
      panelRef.value?.focus()
    } else {
      window.removeEventListener('keydown', onKeydown)
      previouslyFocused?.focus?.()
      previouslyFocused = null
    }
  },
  { immediate: true },
)

onUnmounted(() => {
  window.removeEventListener('keydown', onKeydown)
})
</script>
