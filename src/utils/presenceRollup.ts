// Pure filter/shape util (Phase 135 Plan 03, R418) — the dashboard's
// read-only editor-presence roll-up. No Firestore/Pinia imports, mirroring
// unconfirmedAssignments.ts's "pure function in utils/" convention. Reuses
// isPresenceStale verbatim (never re-derives the TTL comparison).

import { isPresenceStale } from '@/utils/presence'

export interface PresenceRollupRow {
  serviceId: string
  serviceName: string
  uid: string
  displayName: string
  lastSeenMs: number | null
}

/**
 * Filters a flat list of per-service presence rows down to the non-stale
 * ones, per isPresenceStale(lastSeenMs, nowMs, ttlMs). Preserves every input
 * field on kept rows and the caller's input order.
 */
export function activePresenceRows(
  rows: PresenceRollupRow[],
  nowMs: number,
  ttlMs: number,
): PresenceRollupRow[] {
  return rows.filter((row) => !isPresenceStale(row.lastSeenMs, nowMs, ttlMs))
}
