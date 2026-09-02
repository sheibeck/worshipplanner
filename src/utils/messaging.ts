import { useAuthStore } from '@/stores/auth'

// ─── Messaging Toggle Guard ─────────────────────────────────────────────────

/**
 * Single shared choke point for the org-level volunteer-email messaging kill
 * switch (R130) — mirrors `claudeApi.ts::isAiEnabled`'s rationale.
 * See .planning/codebase/STACK.md (Utils Stack Notes — src/utils/messaging.ts)
 */
export function isMessagingEnabled(): boolean {
  return useAuthStore().settings.messaging.enabled
}
