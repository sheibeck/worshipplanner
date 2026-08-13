import { useAuthStore } from '@/stores/auth'

// ─── Messaging Toggle Guard ─────────────────────────────────────────────────

/**
 * Single shared choke point for the org-level volunteer-email messaging kill
 * switch (`authStore.settings.messaging.enabled`, R130). Every later
 * messaging UI surface (the ✉ button, lock-notify prompt, reminder
 * scheduler UI, later phases) gates on this ONE function — no scattered
 * `settings.messaging.enabled` reads — mirroring
 * `src/utils/claudeApi.ts::isAiEnabled`'s rationale.
 *
 * Unlike `isAiEnabled`, this function makes no network call and this module
 * has no "never throw" contract (yet), so it stays a thin, honest boolean
 * read: `useAuthStore()` throws if called with no active Pinia instance, and
 * that throw is intentionally NOT swallowed here. Callers that need a
 * never-throw guarantee wrap their own call site.
 */
export function isMessagingEnabled(): boolean {
  return useAuthStore().settings.messaging.enabled
}
