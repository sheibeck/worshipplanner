// Pure presence schema (Phase 134, R422/R423) — the shared vocabulary the
// useServicePresence composable (Plan 02) and the firestore.rules presence
// match block both depend on. No Firestore/Pinia/store imports (types only),
// following the same "pure function in utils/" convention as
// confirmations.ts/serviceRoles.ts.
//
// organizations/{orgId}/services/{serviceId}/presence/{uid}

import type { Timestamp } from 'firebase/firestore'

/** Exactly the fields on a presence doc — this IS the write-rule field
 *  allowlist (`hasOnly(['uid', 'displayName', 'lastSeen'])` in
 *  firestore.rules), so keep this interface and that allowlist in lockstep. */
export interface PresenceDoc {
  uid: string
  /** Denormalized so readers need no user-doc lookup to render "who's here". */
  displayName: string
  lastSeen: Timestamp
}

/** Coarse heartbeat interval (~25-30s) — the v1.8 cost-hardening discipline
 *  against uncapped recurring writes. Paused while the tab is hidden. */
export const PRESENCE_HEARTBEAT_MS = 30000

/** Client-side staleness window (~60s). Firestore has no onDisconnect(), so a
 *  crashed/closed tab leaves a stale doc; this is the real-time correctness
 *  mechanism that hides it in the UI immediately (the cleanup cron removes it
 *  eventually). */
export const PRESENCE_STALE_TTL_MS = 60000

/**
 * Returns true when a presence doc's lastSeen is stale relative to nowMs — a
 * null/NaN lastSeenMs (no heartbeat observed yet, or a malformed value) is
 * always treated as stale.
 */
export function isPresenceStale(lastSeenMs: number | null, nowMs: number, ttlMs: number): boolean {
  if (lastSeenMs === null || Number.isNaN(lastSeenMs)) return true
  return nowMs - lastSeenMs > ttlMs
}
