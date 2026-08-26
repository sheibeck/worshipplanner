/**
 * Canonical last-used-date derivation (R247/R248, Phase 84).
 *
 * Pure and framework-free — NO firebase, NO vue imports — so this module can
 * be copied verbatim into `functions/src/backfillLastUsed.ts` (84-02).
 *
 * STUB — RED phase (Task 1, TDD). Implementation lands in the GREEN commit.
 */

export interface LastUsedServiceInput {
  status: string
  date: string
  songIds: string[]
}

export function isLockedStatus(_status: string): boolean {
  throw new Error('not implemented')
}

export function computeLastUsedDate(_songId: string, _services: LastUsedServiceInput[]): string | null {
  throw new Error('not implemented')
}

export function serviceDateToMillis(_date: string): number {
  throw new Error('not implemented')
}

export function serviceToLastUsedInput(_service: {
  status: string
  date: string
  slots: Array<{ kind: string; songId?: string | null }>
}): LastUsedServiceInput {
  throw new Error('not implemented')
}
