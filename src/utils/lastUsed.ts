/**
 * Canonical last-used-date derivation (R247/R248, Phase 84). Pure and
 * framework-free — NO firebase, NO vue imports — so this module can be
 * copied verbatim into `functions/src/backfillLastUsed.ts` (84-02).
 * See .planning/codebase/ARCHITECTURE.md (Utils Behavioral Notes — src/utils/lastUsed.ts)
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

/** See ADR-0009 (docs/adr/0009-the-single-shared-calendar-date-parse-convention-for-a-servi.md) */
export function serviceDateToMillis(date: string): number {
  const parts = date.split('-')
  const year = Number(parts[0])
  const month = Number(parts[1])
  const day = Number(parts[2])
  return Date.UTC(year, month - 1, day)
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
