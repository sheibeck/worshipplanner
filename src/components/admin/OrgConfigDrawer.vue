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

          <!-- Bible API enablement (Phase 101, R295) — mirrors the AI
               enablement section above verbatim: same markup/classes, same
               checkbox/disabled/error shape. Single-leg master gate (no
               settings.* leaf this milestone), per 101-UI-SPEC.md. -->
          <section class="border-t border-gray-800 pt-5">
            <label class="inline-flex items-center gap-2 text-sm text-gray-200">
              <input
                type="checkbox"
                data-testid="org-config-bible-checkbox"
                :checked="org.bibleApiEnabled"
                :disabled="bibleToggling"
                class="rounded border-gray-600 bg-gray-800 text-indigo-600 focus:ring-indigo-500 focus:ring-offset-gray-900"
                @change="emit('toggle-bible')"
              />
              Enable Bible API
            </label>
            <p class="text-xs text-gray-400 mt-1.5">
              {{ bibleToggling
                ? (org.bibleApiEnabled ? 'Disabling Bible API...' : 'Enabling Bible API...')
                : "Allow this church to auto-fetch ESV/NLT scripture text. When off, they use the manual BibleGateway / paste path (no API cost)." }}
            </p>
            <p v-if="bibleError" class="text-red-400 text-xs mt-1.5">{{ bibleError }}</p>
          </section>

          <!-- Active -->
          <section class="border-t border-gray-800 pt-5">
            <div class="flex items-center justify-between gap-3">
              <div>
                <p class="text-sm text-gray-200 font-medium">
                  {{ org.active ? 'Active' : 'Deactivated' }}
                </p>
                <p class="text-xs text-gray-400 mt-1">
                  {{ activeToggling
                    ? (org.active ? 'Deactivating...' : 'Reactivating...')
                    : (org.active
                        ? "Deactivating blocks all members from logging in until it is reactivated."
                        : "Reactivating restores member access immediately.") }}
                </p>
              </div>
              <button
                type="button"
                data-testid="org-config-active-button"
                :disabled="activeToggling"
                class="shrink-0 inline-flex items-center justify-center rounded-md px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                :class="org.active
                  ? 'bg-red-600 hover:bg-red-500 text-white'
                  : 'bg-gray-800 hover:bg-gray-700 text-gray-200'"
                @click="onActiveClick"
              >
                {{ activeToggling
                  ? (org.active ? 'Deactivating...' : 'Reactivating...')
                  : (org.active ? 'Deactivate' : 'Reactivate') }}
              </button>
            </div>
            <p v-if="activeError" class="text-red-400 text-xs mt-1.5">{{ activeError }}</p>
            <p
              v-if="activeFeedback"
              :class="activeFeedbackIsWarning ? 'text-amber-400' : 'text-green-400'"
              class="text-xs mt-1.5"
            >
              {{ activeFeedback }}
            </p>
          </section>

          <!-- Assign admin — moved in from the per-row Actions cell during the
               owner UX follow-up (row is now data-only + trailing chevron).
               Reuses OrganizationsTab's existing startAssign/onConfirmAssign/
               cancelAssign handlers unchanged; this drawer only surfaces the
               expand/collapse toggle + the email input's local value via
               props/emits, matching the AI/Active sections' one-way binding
               convention. -->
          <section class="border-t border-gray-800 pt-5">
            <p class="text-sm text-gray-200 font-medium">Admin access</p>
            <p class="text-xs text-gray-400 mt-1.5">
              Assign an existing account (or invite a new one) as an admin of this church.
            </p>
            <div v-if="assigning" class="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
              <input
                :value="assignEmail"
                type="email"
                aria-label="Admin email"
                placeholder="Admin email"
                class="bg-gray-800 border border-gray-700 text-gray-100 rounded-md px-2 py-1.5 text-xs w-full sm:w-44 focus:outline-none focus:ring-1 focus:ring-indigo-500 placeholder-gray-500"
                @input="emit('update:assign-email', ($event.target as HTMLInputElement).value)"
                @keydown.enter="emit('confirm-assign')"
              />
              <div class="flex gap-2">
                <button
                  type="button"
                  :disabled="isAssigning"
                  class="inline-flex items-center justify-center rounded-md bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-60 disabled:cursor-not-allowed px-3 py-1.5 text-xs font-medium whitespace-nowrap shrink-0 transition-colors"
                  @click="emit('confirm-assign')"
                >
                  {{ isAssigning ? 'Assigning...' : 'Assign' }}
                </button>
                <button
                  type="button"
                  class="inline-flex items-center justify-center rounded-md bg-gray-800 hover:bg-gray-700 text-gray-300 px-3 py-1.5 text-xs font-medium whitespace-nowrap shrink-0 transition-colors"
                  @click="emit('cancel-assign')"
                >
                  Cancel assign
                </button>
              </div>
            </div>
            <button
              v-else
              type="button"
              class="mt-3 inline-flex items-center justify-center rounded-md bg-gray-800 hover:bg-gray-700 text-gray-200 px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors"
              @click="emit('start-assign')"
            >
              Assign admin
            </button>
            <p v-if="assignError" class="text-red-400 text-xs mt-1.5">{{ assignError }}</p>
            <p v-if="assignFeedback" class="text-green-400 text-xs mt-1.5">{{ assignFeedback }}</p>
          </section>

          <!-- Enter church — moved in from the per-row Actions cell during the
               owner UX follow-up. Reuses OrganizationsTab's existing
               onEnterChurch unchanged; enterDisabled covers BOTH "this org is
               entering" and "a different org is entering" (mirrors the row
               button's old cross-row double-submit guard). -->
          <section class="border-t border-gray-800 pt-5">
            <p class="text-sm text-gray-200 font-medium">Enter as this church</p>
            <p class="text-xs text-gray-400 mt-1.5">
              Sign in as a member of this church for support or troubleshooting.
            </p>
            <button
              type="button"
              data-testid="org-config-enter-church-button"
              :disabled="enterDisabled"
              class="mt-3 inline-flex items-center justify-center rounded-md bg-gray-800 hover:bg-gray-700 text-gray-200 disabled:opacity-60 disabled:cursor-not-allowed px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors"
              @click="emit('enter-church')"
            >
              {{ entering ? 'Entering...' : 'Enter church' }}
            </button>
            <p v-if="enterError" class="text-red-400 text-xs mt-1.5">{{ enterError }}</p>
          </section>

          <!-- Delete — rendered only for an already-deactivated org (Phase 77
               gates deletion to deactivated orgs). Moved in from the per-row
               Actions cell during owner testing feedback; irreversible, so no
               inline confirmation here -- clicking emits request-delete and
               the parent opens the existing type-to-confirm
               DeleteOrgConfirmDialog. -->
          <section v-if="!org.active" class="border-t border-gray-800 pt-5">
            <p class="text-sm text-gray-200 font-medium">Delete church</p>
            <p class="text-xs text-gray-400 mt-1.5">
              Permanently deletes this church and all of its data. This cannot be undone.
            </p>
            <button
              type="button"
              data-testid="org-config-delete-button"
              class="mt-3 inline-flex items-center justify-center rounded-md bg-red-600 hover:bg-red-500 text-white px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors"
              @click="emit('request-delete')"
            >
              Delete church
            </button>
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
  bibleApiEnabled?: boolean
}

const props = defineProps<{
  org: OrgSummary | null
  aiToggling: boolean
  aiError: string | null
  // Bible API enablement (Phase 101, R295) — mirrors aiToggling/aiError.
  bibleToggling: boolean
  bibleError: string | null
  activeToggling: boolean
  activeError: string | null
  activeFeedback: string | null
  activeFeedbackIsWarning: boolean
  // Assign admin (owner UX follow-up, moved in from the row) — mirrors
  // OrganizationsTab's assigningOrgId/assignEmail/isAssigning/assignError/
  // assignFeedback state exactly, scoped to whichever org this drawer is
  // currently showing.
  assigning: boolean
  assignEmail: string
  isAssigning: boolean
  assignError: string | null
  assignFeedback: string | null
  // Enter church (owner UX follow-up, moved in from the row) — entering is
  // true only when THIS org is being entered; enterDisabled also covers "a
  // different org is currently being entered" (cross-row double-submit
  // guard, mirrored from the old row button).
  entering: boolean
  enterDisabled: boolean
  enterError: string | null
}>()

const emit = defineEmits<{
  close: []
  'toggle-ai': []
  'toggle-bible': []
  'request-deactivate': []
  reactivate: []
  'request-delete': []
  'start-assign': []
  'cancel-assign': []
  'update:assign-email': [email: string]
  'confirm-assign': []
  'enter-church': []
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

// Owner testing feedback (follow-up to quick 260824): Active is an ACTION,
// not a setting, so it is a button (not a checkbox) -- clicking it never
// toggles state itself, it only signals INTENT. Deactivating (currently
// active) routes through the parent's confirm dialog; reactivating (currently
// inactive) applies directly. The parent derives the desired boolean from
// current state, so no payload is needed on either emit (this plan's
// key_links). Because there is no local checked state to get out of sync,
// cancelling the deactivate confirm leaves no stuck UI state behind.
function onActiveClick(): void {
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
