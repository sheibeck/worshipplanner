<template>
  <!-- "Sent on this service" delivery-history card (R142/R143). A PURE
       props-driven read-only list (the LyricVersionHistory.vue idiom): the
       parent owns the store subscription and passes messages + the lazily-read
       bounced recipients down, and handles expand/fixAddress/newMessage. Card
       shell + header verbatim from the neighbouring messaging-defaults-panel. -->
  <div class="rounded-lg bg-gray-900 border border-gray-800 p-3" data-testid="service-message-history">
    <!-- Header -->
    <div class="flex items-center justify-between gap-2">
      <h2 :id="titleId" class="text-xs font-semibold text-gray-400 uppercase tracking-wider">
        Sent on this service
      </h2>
      <button
        type="button"
        data-testid="new-message-btn"
        class="text-xs font-medium text-indigo-400 hover:text-indigo-300"
        @click="emit('newMessage')"
      >
        ✉ New message
      </button>
    </div>

    <!-- Loading (first snapshot) -->
    <div
      v-if="loading"
      data-testid="history-loading"
      class="py-6 flex flex-col items-center justify-center gap-2"
      aria-live="polite"
    >
      <div class="h-8 w-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" aria-hidden="true"></div>
      <p class="text-xs text-gray-500">Loading message history…</p>
    </div>

    <!-- Error -->
    <p v-else-if="error" data-testid="history-error" class="text-red-400 text-sm py-4">
      Couldn't load message history. Please refresh.
    </p>

    <!-- Empty -->
    <div v-else-if="messages.length === 0" data-testid="history-empty" class="py-6 text-center">
      <p class="text-sm text-gray-300">Nothing sent yet</p>
      <p class="text-xs text-gray-500 mt-1">Messages you send for this service will appear here.</p>
    </div>

    <!-- Populated list -->
    <div
      v-else
      role="list"
      :aria-labelledby="titleId"
      class="mt-3 divide-y divide-gray-800"
      aria-live="polite"
    >
      <div
        v-for="message in messages"
        :key="message.id"
        role="listitem"
        data-testid="message-row"
        class="py-2 flex flex-col sm:flex-row sm:items-start gap-3"
      >
        <!-- Left cluster: type badge + subject -->
        <div class="flex items-start gap-2 min-w-0">
          <span
            data-testid="type-badge"
            class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border bg-gray-800 text-gray-300 border-gray-700 shrink-0"
          >
            {{ typeLabel(message.type) }}
          </span>
          <span class="text-sm text-gray-200 break-words">{{ message.subject || defaultLabel(message.type) }}</span>
        </div>

        <!-- Right cluster: counts / send time / status pill / bounce indicator -->
        <div class="sm:ml-auto sm:text-right flex flex-col gap-1 shrink-0">
          <p data-testid="count-line" class="text-xs text-gray-500">
            <span v-if="message.status !== 'scheduled'">{{ message.deliveryCounts.sent }} sent</span>
            <span :class="message.status !== 'scheduled' ? 'ml-1' : ''">{{ sendTimeLabel(message) }}</span>
          </p>

          <div class="flex items-center gap-2 sm:justify-end flex-wrap">
            <span
              v-if="statusPill(message)"
              data-testid="status-pill"
              class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border"
              :class="statusPill(message)!.classes"
            >
              <span
                v-if="statusPill(message)!.spinner"
                class="inline-block h-3 w-3 border-2 border-gray-500 border-t-transparent rounded-full animate-spin"
                aria-hidden="true"
              ></span>
              {{ statusPill(message)!.label }}
            </span>

            <button
              v-if="message.deliveryCounts.bounced > 0"
              type="button"
              data-testid="bounce-indicator"
              :aria-expanded="isExpanded(message.id) ? 'true' : 'false'"
              :aria-controls="`bounced-${message.id}`"
              class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border bg-red-900/50 text-red-300 border-red-800 hover:bg-red-900/70"
              @click="toggleExpand(message.id)"
            >
              {{ message.deliveryCounts.bounced }} bounced
              <span class="transition-transform" :class="isExpanded(message.id) ? 'rotate-90' : ''" aria-hidden="true">▸</span>
            </button>
          </div>

          <!-- Bounced-recipients sublist (expanded, read-only) -->
          <div
            v-if="isExpanded(message.id)"
            :id="`bounced-${message.id}`"
            class="mt-2 pl-3 border-l-2 border-red-800/50 space-y-2 text-left"
          >
            <div
              v-for="recipient in (recipientsByMessage && recipientsByMessage[message.id]) || []"
              :key="recipient.personId"
              data-testid="bounced-recipient"
              class="text-xs"
            >
              <span class="text-gray-200">{{ recipient.name }}</span>
              <span class="text-gray-500"> · {{ recipient.email }}</span>
              <span class="text-red-400"> · {{ recipient.bounceReason || 'Address rejected' }}</span>
              <RouterLink
                data-testid="fix-email-link"
                class="ml-2 text-xs font-medium text-indigo-400 hover:text-indigo-300"
                :to="{ name: 'volunteers', query: { edit: recipient.personId } }"
                title="Update this volunteer's email in the roster"
                @click="emit('fixAddress', recipient.personId)"
              >
                Fix email →
              </RouterLink>
            </div>
            <p v-if="!recipientsByMessage || !recipientsByMessage[message.id]" class="text-xs text-gray-500">Loading…</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import type { ServiceMessageDoc, ServiceMessageType, BouncedRecipient } from '@/stores/serviceMessages'

defineProps<{
  messages: ServiceMessageDoc[]
  recipientsByMessage?: Record<string, BouncedRecipient[]>
  loading?: boolean
  error?: boolean
}>()

const emit = defineEmits<{
  expand: [messageId: string]
  fixAddress: [personId: string]
  newMessage: []
}>()

// A stable id for the aria-labelledby / aria-controls wiring — unique per mount
// so multiple cards on a page never collide.
const titleId = `smh-title-${Math.random().toString(36).slice(2, 9)}`

// Which message rows are currently expanded (only bounced rows are toggleable).
const expanded = ref<Set<string>>(new Set())

function isExpanded(messageId: string): boolean {
  return expanded.value.has(messageId)
}

function toggleExpand(messageId: string): void {
  const next = new Set(expanded.value)
  if (next.has(messageId)) {
    next.delete(messageId)
  } else {
    next.add(messageId)
    // Ask the parent to lazily resolve this message's bounced recipients.
    emit('expand', messageId)
  }
  expanded.value = next
}

/** Type → badge label (unknown/future auto types collapse to "Automatic"). */
function typeLabel(type: ServiceMessageType): string {
  switch (type) {
    case 'oneoff':
      return 'One-off'
    case 'reminder':
      return 'Reminder'
    case 'share-link':
      return 'Share link'
    default:
      // lock-notification / relock-notification / any future auto type
      return 'Automatic'
  }
}

/** A type-derived fallback label when a message has no subject. */
function defaultLabel(type: ServiceMessageType): string {
  return type === 'share-link' ? 'Service link' : typeLabel(type)
}

interface StatusPill {
  label: string
  classes: string
  spinner: boolean
}

/**
 * The status pill per the UI-SPEC § Color table. A clean `sent` returns null
 * (no pill — the count carries it), keeping the list quiet so the red bounce
 * indicator is the only loud element.
 */
function statusPill(message: ServiceMessageDoc): StatusPill | null {
  switch (message.status) {
    case 'scheduled':
      return { label: 'Scheduled', classes: 'bg-indigo-900/50 text-indigo-300 border-indigo-800', spinner: false }
    case 'partial':
      return { label: 'Partial', classes: 'bg-amber-900/50 text-amber-300 border-amber-800', spinner: false }
    case 'failed':
      return { label: 'Failed', classes: 'bg-red-900/50 text-red-300 border-red-800', spinner: false }
    case 'queued':
    case 'sending':
      return { label: 'Sending…', classes: 'bg-gray-800 text-gray-300 border-gray-700', spinner: true }
    default:
      return null
  }
}

/** Format an absolute send time like the composer's service-date subline. */
function formatInstant(ms: number): string {
  return new Date(ms).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

/**
 * The send-time label: "Scheduled for {date}" when scheduled, "Sending…" while
 * in flight, else the formatted `sentAt`. Empty when nothing is available.
 */
function sendTimeLabel(message: ServiceMessageDoc): string {
  if (message.status === 'scheduled') {
    if (!message.scheduledFor) return 'Scheduled'
    const ms = Date.parse(message.scheduledFor)
    return Number.isNaN(ms) ? 'Scheduled' : `Scheduled for ${formatInstant(ms)}`
  }
  if (message.status === 'sending' || message.status === 'queued') {
    return 'Sending…'
  }
  const sentAt = message.sentAt
  if (sentAt && typeof sentAt.toMillis === 'function') {
    return formatInstant(sentAt.toMillis())
  }
  return ''
}
</script>
