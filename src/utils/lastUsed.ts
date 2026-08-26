/**
 * Canonical last-used-date derivation (R247/R248, Phase 84).
 *
 * Pure and framework-free — NO firebase, NO vue imports — so this module can
 * be copied verbatim into `functions/src/backfillLastUsed.ts` (84-02). The
 * functions package cannot import from `src/` (separate tsconfig/build, a
 * different `Timestamp` class), so `computeLastUsedDate` and
 * `serviceDateToMillis` are MIRRORED there rather than shared by import.
 * Both sides carry their own unit tests, so drift between the copies breaks
 * a test instead of silently diverging.
 *
 * Semantics (84-CONTEXT.md Area 1, owner-refined):
 * - A service counts toward a song's `lastUsedAt` ONLY when it is LOCKED —
 *   `status !== 'draft'` (i.e. `'planned'` or `'exported'`). Draft services
 *   never contribute; assigning a song to a draft plan must not stamp a date
 *   (this is the fix for the root-cause bug — see `services.ts`).
 * - The value is `MAX(service.date)` over every locked service that contains
 *   the song in a SONG slot. Adding the song to a later-dated locked service
 *   advances the date; an earlier locked service never regresses it.
 * - `null` means "no locked service contains this song" — a valid,
 *   intentional result, never an error. It must not be conflated with "song
 *   is in no service at all" — that case is handled by the caller (the live
 *   store only recomputes songs it knows are affected; the 84-02 backfill's
 *   conservative skip rule leaves untouched songs alone).
 */

/** Timestamp-agnostic shape a `Service` is reduced to before derivation. */
export interface LastUsedServiceInput {
  status: string
  date: string
  songIds: string[]
}

/** Locked === not draft. Covers `'planned'` and `'exported'`. */
export function isLockedStatus(status: string): boolean {
  return status !== 'draft'
}

/**
 * MAX `"YYYY-MM-DD"` over every service that is locked AND contains
 * `songId`. Dates are zero-padded ISO strings, so a plain string comparison
 * yields the correct calendar MAX — no `Date` parsing needed here. Returns
 * `null` (never throws) when no locked service contains the song, including
 * when `services` is empty.
 */
export function computeLastUsedDate(songId: string, services: LastUsedServiceInput[]): string | null {
  let max: string | null = null
  for (const service of services) {
    if (!isLockedStatus(service.status)) continue
    if (!service.songIds.includes(songId)) continue
    if (max === null || service.date > max) {
      max = service.date
    }
  }
  return max
}

/**
 * The single shared calendar-date parse convention for a `Service.date`
 * `"YYYY-MM-DD"` string (local midnight). BOTH the live store adapter
 * (`services.ts`) and the 84-02 backfill must use this exact expression so
 * the `Timestamp` each environment writes is identical.
 */
export function serviceDateToMillis(date: string): number {
  return new Date(`${date}T00:00:00`).getTime()
}

/**
 * Client-side mapper: a `Service` -> `LastUsedServiceInput`. Extracts
 * `songId`s from `SONG` slots only. Deliberately loosely typed — this keeps
 * the pure module decoupled from the full `Service`/`ServiceSlot` union so
 * it stays copyable into the functions package without pulling client types
 * along.
 */
export function serviceToLastUsedInput(service: {
  status: string
  date: string
  slots: Array<{ kind: string; songId?: string | null }>
}): LastUsedServiceInput {
  const songIds = service.slots
    .filter((slot) => slot.kind === 'SONG' && !!slot.songId)
    .map((slot) => slot.songId as string)
  return { status: service.status, date: service.date, songIds }
}
