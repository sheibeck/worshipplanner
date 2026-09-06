// Pure derivation helpers for My Schedule (Phase 126, R380/R381). No I/O, no
// store, no date library — reuses ServicesView.vue's own zero-padded
// browser-local date-string idiom verbatim (src/views/ServicesView.vue:229-249).
// All functions take an optional `now` so tests can inject a fixed clock.

import type { RehearseAccessDoc, RehearseSong } from '@/utils/rehearseAccess'

export interface MyScheduleGroups {
  thisWeek: RehearseAccessDoc[]
  laterThisMonth: RehearseAccessDoc[]
  past: RehearseAccessDoc[]
  nextUpId: string | null
}

export interface Readiness {
  state: 'ready' | 'partial' | 'waiting'
  missingCount: number
}

/** Source: src/views/ServicesView.vue:229-235 — the exact zero-padded
 *  browser-local date-string idiom this codebase already uses; not
 *  reimplemented with a date library. */
export function todayYmd(now: Date = new Date()): string {
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** "This week" = today through the coming Saturday inclusive (126-UI-SPEC.md §3).
 *  getDay(): 0=Sun..6=Sat. */
export function endOfThisWeekYmd(now: Date = new Date()): string {
  const daysUntilSaturday = 6 - now.getDay()
  const end = new Date(now)
  end.setDate(now.getDate() + daysUntilSaturday)
  return todayYmd(end)
}

/** Buckets rehearseAccess docs into This week / Later this month / Past by
 *  browser-local date, matching ServicesView.vue's own upcoming/past split
 *  convention (src/views/ServicesView.vue:238-249). nextUpId is the soonest
 *  upcoming serviceId, or null when there are no upcoming services. */
export function groupMySchedule(
  docs: RehearseAccessDoc[],
  now: Date = new Date(),
): MyScheduleGroups {
  const today = todayYmd(now)
  const weekEnd = endOfThisWeekYmd(now)
  const upcoming = docs
    .filter((d) => d.serviceDate >= today)
    .sort((a, b) => a.serviceDate.localeCompare(b.serviceDate))
  const past = docs
    .filter((d) => d.serviceDate < today)
    .sort((a, b) => b.serviceDate.localeCompare(a.serviceDate))
  return {
    thisWeek: upcoming.filter((d) => d.serviceDate <= weekEnd),
    laterThisMonth: upcoming.filter((d) => d.serviceDate > weekEnd),
    past,
    nextUpId: upcoming[0]?.serviceId ?? null,
  }
}

/** Parses a `YYYY-MM-DD` string as a browser-local midnight Date (no UTC
 *  drift), matching the ymd string convention used throughout this file. */
function ymdToLocalDate(ymd: string): Date {
  const [y, m, d] = ymd.split('-').map(Number)
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1)
}

/** Countdown copy per 126-UI-SPEC.md's Copywriting Contract boundary table.
 *  Day delta is computed on calendar dates (browser-local midnight-to-midnight),
 *  so time-of-day on `now` never shifts the result. */
export function countdownLabel(serviceDate: string, now: Date = new Date()): string {
  const today = ymdToLocalDate(todayYmd(now))
  const target = ymdToLocalDate(serviceDate)
  const diffDays = Math.round((target.getTime() - today.getTime()) / 86_400_000)

  if (diffDays >= 0) {
    if (diffDays === 0) return 'Today'
    if (diffDays === 1) return 'Tomorrow'
    return `In ${diffDays} days`
  }

  const daysAgo = -diffDays
  if (daysAgo === 1) return 'Yesterday'
  if (daysAgo < 7) return `${daysAgo} days ago`
  if (daysAgo < 14) return 'Last week'
  const weeksAgo = Math.floor(daysAgo / 7)
  return `${weeksAgo} weeks ago`
}

// NOTE (Rule 1 deviation from plan text): the plan/UI-SPEC describe this check
// as `a.kind === 'pdf' || a.kind === 'mp3'`, but SongAttachmentKind
// (src/types/song.ts:23) is actually 'document' | 'audio' | 'link' — 'document'
// is the PDF-family upload, 'audio' is the MP3-family upload. Using the literal
// 'pdf'/'mp3' strings would never match a real attachment and readinessOf would
// report every song as 'waiting' regardless of actual uploads.
function hasMedia(song: RehearseSong): boolean {
  return song.attachments.some((a) => a.kind === 'document' || a.kind === 'audio')
}

/** Three-state readiness (126-UI-SPEC.md §6): ready = every song has at least
 *  one document (PDF-family) or audio (MP3-family) attachment; waiting = zero
 *  songs have media (including the zero-songs edge case); partial = some do,
 *  some don't (missingCount = songs without media). */
export function readinessOf(songs: RehearseSong[]): Readiness {
  const missing = songs.filter((s) => !hasMedia(s))
  if (songs.length === 0 || missing.length === songs.length) {
    return { state: 'waiting', missingCount: missing.length }
  }
  if (missing.length === 0) return { state: 'ready', missingCount: 0 }
  return { state: 'partial', missingCount: missing.length }
}
