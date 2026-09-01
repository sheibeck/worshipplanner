<template>
  <div
    class="fixed inset-x-4 bottom-4 z-[60] flex flex-col items-stretch gap-2
           sm:inset-x-auto sm:right-6 sm:bottom-6 sm:w-full sm:max-w-sm"
    data-testid="toast-host"
  >
    <div
      v-for="toast in orderedToasts"
      :key="toast.id"
      :role="severity(toast.variant).role"
      :aria-live="severity(toast.variant).role === 'status' ? 'polite' : undefined"
      :class="[
        'rounded-md border shadow-2xl',
        severity(toast.variant).border,
        severity(toast.variant).bg,
        severity(toast.variant).text,
        toast.heading ? 'flex items-start gap-3 px-4 py-3' : 'flex items-start gap-2 px-4 py-3 text-sm',
      ]"
      :data-testid="`toast-${toast.id}`"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 20 20"
        fill="currentColor"
        :class="[toast.heading ? 'mt-0.5 h-5 w-5' : 'h-4 w-4', 'flex-none', severity(toast.variant).icon]"
        aria-hidden="true"
      >
        <path fill-rule="evenodd" clip-rule="evenodd" :d="severity(toast.variant).path" />
      </svg>

      <!-- Rich shape (sticky notifications, ports the RunControlView amber-banner
           markup verbatim): heading + optional body + optional action row. -->
      <div v-if="toast.heading" class="min-w-0 flex-1">
        <p class="font-medium">{{ toast.heading }}</p>
        <p v-if="toast.body" class="mt-1 text-sm">{{ toast.body }}</p>
        <div v-if="toast.action || toast.link" class="mt-2 flex flex-wrap items-center gap-3">
          <button
            v-if="toast.action"
            type="button"
            class="min-h-11 rounded-md bg-indigo-600 hover:bg-indigo-500 px-3 py-1.5 text-sm font-medium text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            @click="toast.action.onClick()"
          >
            {{ toast.action.label }}
          </button>
          <a
            v-if="toast.link"
            :href="toast.link.href"
            target="_blank"
            rel="noopener"
            :class="[severity(toast.variant).text, 'underline']"
          >
            {{ toast.link.label }}
          </a>
        </div>
      </div>

      <!-- Compact shape (transient toasts, existing shape) — the literal
           "Save failed." lead is R041 back-compat: every pre-Phase-104
           push(message) call site defaults to variant 'error' with no
           heading, and this preserves that exact rendered copy. -->
      <p v-else class="min-w-0 flex-1">
        <span v-if="toast.variant === 'error'" class="font-medium">Save failed.</span> {{ toast.message }}
      </p>

      <button
        type="button"
        class="flex-none p-1 -m-1 rounded focus:outline-none focus:ring-2"
        :class="[severity(toast.variant).icon, severity(toast.variant).dismissHover, severity(toast.variant).dismissRing]"
        :aria-label="toast.heading ? `Dismiss: ${toast.heading}` : 'Dismiss'"
        @click="toastStore.dismiss(toast.id)"
      >×</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useToasts, type NotificationVariant, type Toast } from '@/stores/toasts'

// App-level dismissible-message stack (R309/R310), mounted once at the App.vue
// root (moved from AppShell.vue — Phase 104 — so it renders on every route,
// including RunControlView.vue which does not use AppShell).
const toastStore = useToasts()

// Sticky items (carry a `key`) render FIRST — a persistent warning must never
// be buried under a newer transient toast. Relative push order is preserved
// within each group.
const orderedToasts = computed<Toast[]>(() => {
  const stickies = toastStore.toasts.filter((t) => t.key !== undefined)
  const transient = toastStore.toasts.filter((t) => t.key === undefined)
  return [...stickies, ...transient]
})

interface SeverityConfig {
  border: string
  bg: string
  icon: string
  text: string
  dismissHover: string
  dismissRing: string
  role: 'alert' | 'status'
  path: string
}

// Heroicons-solid, viewBox="0 0 20 20", single <path fill-rule="evenodd"
// clip-rule="evenodd"> technique (UI-SPEC). `warning` is the exact path
// already used 4x in RunControlView.vue's amber banners, reused verbatim.
const WARNING_PATH =
  'M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z'
const INFO_PATH =
  'M18 10a8 8 0 11-16 0 8 8 0 0116 0zM9 9a.75.75 0 000 1.5h.253a.25.25 0 01.244.304l-.459 2.066A1.75 1.75 0 0010.747 15H11a.75.75 0 100-1.5h-.253a.25.25 0 01-.244-.304l.459-2.066A1.75 1.75 0 009.253 9H9z'
const SUCCESS_PATH =
  'M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z'
const ERROR_PATH =
  'M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z'

// info/success use role="status" + aria-live="polite" (new — the lowest two
// severities); warning/error keep role="alert" (assertive by implication,
// unchanged). The outer stack container itself carries no aria-live of its
// own — live-region semantics live on each individual message.
const SEVERITY: Record<NotificationVariant, SeverityConfig> = {
  info: {
    border: 'border-blue-800',
    bg: 'bg-blue-950',
    icon: 'text-blue-400',
    text: 'text-blue-200',
    dismissHover: 'hover:text-blue-300',
    dismissRing: 'focus:ring-blue-500',
    role: 'status',
    path: INFO_PATH,
  },
  success: {
    border: 'border-green-800',
    bg: 'bg-green-950',
    icon: 'text-green-400',
    text: 'text-green-200',
    dismissHover: 'hover:text-green-300',
    dismissRing: 'focus:ring-green-500',
    role: 'status',
    path: SUCCESS_PATH,
  },
  warning: {
    border: 'border-amber-800',
    bg: 'bg-amber-950',
    icon: 'text-amber-400',
    text: 'text-amber-200',
    dismissHover: 'hover:text-amber-300',
    dismissRing: 'focus:ring-amber-500',
    role: 'alert',
    path: WARNING_PATH,
  },
  // Deliberate visual delta from pre-Phase-104 production (UI-SPEC): text
  // moves from text-red-400 to text-red-200, matching the single-shade
  // convention every other severity (and the pre-existing amber banners)
  // already use — icon stays -400, container text becomes -200.
  error: {
    border: 'border-red-800',
    bg: 'bg-red-950',
    icon: 'text-red-400',
    text: 'text-red-200',
    dismissHover: 'hover:text-red-300',
    dismissRing: 'focus:ring-red-500',
    role: 'alert',
    path: ERROR_PATH,
  },
}

function severity(variant: NotificationVariant): SeverityConfig {
  return SEVERITY[variant]
}
</script>
