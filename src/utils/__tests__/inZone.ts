import { expect } from 'vitest'

/** Zones 11h behind, level with, and 14h ahead of UTC, with their getTimezoneOffset minutes. */
export const TZ_ZONES: ReadonlyArray<readonly [string, number]> = [
  ['Pacific/Pago_Pago', 660],
  ['UTC', 0],
  ['Pacific/Kiritimati', -840],
]

/**
 * Run fn with process.env.TZ switched in process; awaits it before restoring.
 * The offset canary fails the test when the runtime ignored the new zone.
 */
export async function inZone<T>(tz: string, expectedOffsetMin: number, fn: () => T | Promise<T>): Promise<T> {
  const prior = process.env.TZ
  process.env.TZ = tz
  try {
    expect(new Date(2026, 10, 8).getTimezoneOffset()).toBe(expectedOffsetMin)
    return await fn()
  } finally {
    if (prior === undefined) delete process.env.TZ
    else process.env.TZ = prior
  }
}
