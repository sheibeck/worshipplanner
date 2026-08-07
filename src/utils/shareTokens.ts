// R078 — share-token minting and adoption selection, extracted into a pure module so both
// decisions ("what does a freshly-minted token look like" and "which of several already-
// circulated tokens is the one to adopt") can be proven exhaustively without a Firestore mock.
//
// The adoption branch this module exists for is built on an equality-only query
// (`where('serviceId','==',id)`, no server-side sort clause) followed by a client-side sort here.
// An equality filter combined with a server-side sort on a different field requires a composite
// Firestore index; this project's firestore.indexes.json has none; and the Firestore emulator does
// not enforce that requirement, so a version that added the server-side sort would pass every
// local test and then throw in production on exactly the services this logic exists to rescue.
// The caller must never add that sort clause to the query that produces the candidates passed
// into pickAdoptableToken — do the ordering here instead.
//
// Deliberately free of Firestore and Pinia imports: no `firebase/firestore`, no `@/firebase`, no
// store. Every candidate is described by the minimal structural shape below, not a Firestore
// snapshot type, so these functions are testable with plain literal fixtures.

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
 * Coerces any timestamp shape a `shareTokens` document can actually carry in this codebase into
 * milliseconds, without ever throwing and without ever returning `NaN` (a `NaN` leaking into a
 * comparator would silently destroy sort order rather than failing loudly, so every branch here
 * returns `0` instead).
 *
 * Recognised shapes, in the order checked:
 * - an object exposing a callable `toMillis` — a server-resolved Firestore `Timestamp`.
 * - an object with a numeric `seconds` (and optionally numeric `nanoseconds`) — the shape
 *   `services.test.ts`'s `serverTimestamp` mock produces, and the shape a raw REST read gives.
 * - a `Date` — its epoch milliseconds.
 * - a finite number — itself.
 * - anything else, including `null`, `undefined`, a non-finite number, and a locally-pending
 *   `serverTimestamp()` that has not yet round-tripped from the server (which reads back as
 *   `null`) — `0`.
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
 * Selects which already-circulated `shareTokens` document to adopt for a service, or `null` when
 * there is nothing adoptable (the caller mints instead).
 *
 * Three steps, in this order — the order matters:
 * 1. Filter to candidates whose `orgId` is a string strictly equal to `orgId` (T-41-07). The
 *    Firestore query that produces these candidates filters on `serviceId` only, so its result
 *    set is NOT org-scoped; without this filter, run BEFORE the sort, an adoption could latch
 *    onto a document belonging to another organisation even when that document happens to be the
 *    newest match.
 * 2. Sort a COPY of the filtered array (the input is never mutated) over a total order:
 *    newest `createdAt` first, and when two candidates' `createdAt` coerce to the identical
 *    millisecond value, the lexicographically greatest document id wins. The tiebreak exists
 *    because Firestore query iteration order is not a guarantee — relying on "whichever came back
 *    first" would make adoption nondeterministic. A locally-pending `serverTimestamp()` reads as
 *    `null`, coerces to `0` via shareTokenCreatedAtMillis, and therefore sorts last
 *    deterministically (via the same id tiebreak) instead of throwing.
 * 3. Return the first element's `id`, or `null` when the filtered list is empty.
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
