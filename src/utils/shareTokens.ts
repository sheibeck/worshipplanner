// R078 — share-token minting and adoption selection, extracted into a pure
// module so both decisions can be proven exhaustively without a Firestore mock.
// See .planning/codebase/STACK.md (Utils Stack Notes — src/utils/shareTokens.ts)

/**
 * The minimal shape this module needs from a `shareTokens` document. `orgId` and `createdAt`
 * are `unknown` on purpose: they arrive from an untyped `d.data()` call on a Firestore snapshot,
 * and typing them as something narrower would just move a runtime shape surprise into a crash
 * inside whatever soft-fail catch calls this module.
 */
export interface ShareTokenCandidate {
  id: string
  orgId?: unknown
  createdAt?: unknown
}

/**
 * Mints a fresh share token: 36 lowercase hex characters from 18 bytes (144 bits) of
 * `crypto.getRandomValues` output. Byte-for-byte the existing generator at
 * `services.ts:354-357` (also duplicated in `quarters.ts:404-406`) — token entropy is
 * unchanged by this phase.
 */
export function mintShareToken(): string {
  const array = new Uint8Array(18)
  crypto.getRandomValues(array)
  return Array.from(array, (b) => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Coerces any timestamp shape a `shareTokens` document can carry into
 * milliseconds — never throws, never returns `NaN` (every unrecognized shape
 * returns `0` instead, so a leaking `NaN` never silently destroys sort order).
 * See .planning/codebase/ARCHITECTURE.md (Utils Behavioral Notes — src/utils/shareTokens.ts)
 */
export function shareTokenCreatedAtMillis(value: unknown): number {
  if (value == null) return 0

  if (typeof value === 'object') {
    const maybeToMillis = (value as { toMillis?: unknown }).toMillis
    if (typeof maybeToMillis === 'function') {
      const millis = Number((maybeToMillis as () => number).call(value))
      return Number.isFinite(millis) ? millis : 0
    }

    const seconds = (value as { seconds?: unknown }).seconds
    if (typeof seconds === 'number' && Number.isFinite(seconds)) {
      const nanoseconds = (value as { nanoseconds?: unknown }).nanoseconds
      const nanosPart = typeof nanoseconds === 'number' && Number.isFinite(nanoseconds) ? nanoseconds / 1e6 : 0
      const millis = seconds * 1000 + nanosPart
      return Number.isFinite(millis) ? millis : 0
    }
  }

  if (value instanceof Date) {
    const millis = value.getTime()
    return Number.isFinite(millis) ? millis : 0
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  return 0
}

/**
 * Selects which already-circulated `shareTokens` document to adopt for a
 * service, or `null` when there is nothing adoptable (the caller mints
 * instead). Order matters: org-scope filter (T-41-07) BEFORE the newest-first
 * sort with an id tiebreak.
 * See .planning/codebase/ARCHITECTURE.md (Utils Behavioral Notes — src/utils/shareTokens.ts)
 */
export function pickAdoptableToken(candidates: ShareTokenCandidate[], orgId: string): string | null {
  const scoped = candidates.filter((candidate) => candidate.orgId === orgId)
  if (scoped.length === 0) return null

  const sorted = scoped.slice().sort((a, b) => {
    const diff = shareTokenCreatedAtMillis(b.createdAt) - shareTokenCreatedAtMillis(a.createdAt)
    if (diff !== 0) return diff
    return b.id.localeCompare(a.id)
  })

  return sorted[0]?.id ?? null
}
