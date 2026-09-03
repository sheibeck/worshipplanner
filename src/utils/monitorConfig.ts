// Per-device monitor -> role (Audience/Confidence) persistence for Run mode
// (Phase 91, consumed by Phases 92-96). Pure and framework-free — no Vue,
// Firebase, or Pinia imports — mirroring `lastUsed.ts`'s loosely-typed,
// dependency-free style so the module stays trivially unit-testable.
//
// Persisted to `localStorage`, NOT Firestore (ARCHITECTURE.md Anti-Pattern 3):
// See ADR-0183 (docs/adr/0183-this-describes-the-physical-cable-plugged-into-this-device-n.md)

/** Minimal structural shape this module needs from a live screen object. */
export interface ScreenLike {
  label?: string
  width: number
  height: number
  left: number
  top: number
  isPrimary: boolean
}

/** The two roles a monitor can be assigned in Run mode. */
export type MonitorRole = 'audience' | 'confidence'

/** One persisted screen-fingerprint -> role assignment. */
export interface MonitorAssignment {
  fingerprint: string
  role: MonitorRole
}

/** The full persisted mapping — every assignment plus a save timestamp. */
export interface MonitorMapping {
  assignments: MonitorAssignment[]
  savedAt: number
}

/**
 * The outcome of comparing a saved mapping against the CURRENT live screens —
 * delta-aware (R326/R328): a partial change keeps the still-live assignments
 * and reports only the delta, instead of invalidating the whole mapping.
 */
export type MatchResultV2 =
  | { status: 'matched' }
  | { status: 'partial'; kept: MonitorAssignment[]; newScreens: ScreenLike[] }
  | { status: 'no-mapping' }

/**
 * The ONE fixed localStorage key this module ever reads or writes.
 * Deliberately carries no uid/org interpolation — see module doc comment.
 * Bumped v1 -> v2 for the fingerprint/delta-match rework; a v1 value is
 * simply invisible to v2 code (no migration — one-time reconfigure).
 */
export const MONITOR_CONFIG_STORAGE_KEY = 'wp:runMonitorConfig:v2'

/** Opener->popup fingerprint hand-off contract (URL query param name). */
export const SCREEN_QUERY_PARAM = 'screen'

/** A screen with no label at all degrades to this placeholder rather than throwing. */
const UNLABELED_PLACEHOLDER = 'unlabeled'

/** Identity ignores left/top/isPrimary (see ARCHITECTURE.md — those are macOS-volatile). */
function identityKey(screen: ScreenLike): string {
  const label = screen.label && screen.label.length > 0 ? screen.label : UNLABELED_PLACEHOLDER
  return `${label}:${screen.width}x${screen.height}`
}

/**
 * Groups `screens` by identity key, sorts each group by ascending (left, top),
 * and assigns each screen a fingerprint of `identityKey#index` — the 0-based
 * position of that screen within its group. See ARCHITECTURE.md.
 */
export function computeFingerprints(screens: ScreenLike[]): Map<ScreenLike, string> {
  const byIdentity = new Map<string, ScreenLike[]>()
  for (const screen of screens) {
    const key = identityKey(screen)
    const group = byIdentity.get(key) ?? []
    group.push(screen)
    byIdentity.set(key, group)
  }
  const result = new Map<ScreenLike, string>()
  for (const [key, group] of byIdentity) {
    const sorted = [...group].sort((a, b) => a.left - b.left || a.top - b.top)
    sorted.forEach((screen, index) => result.set(screen, `${key}#${index}`))
  }
  return result
}

/**
 * Computes one screen's v2 fingerprint. When `allScreens` is provided, the
 * disambiguation index reflects that screen's sorted-position rank within its
 * identity group; when absent, the screen is treated as a lone group (`#0`) —
 * kept for call sites that only have one screen in hand. See ARCHITECTURE.md.
 */
export function computeFingerprint(screen: ScreenLike, allScreens?: ScreenLike[]): string {
  if (allScreens) return computeFingerprints(allScreens).get(screen) ?? `${identityKey(screen)}#0`
  return `${identityKey(screen)}#0`
}

/**
 * The `typeof localStorage`/global-getter access is wrapped in its OWN
 * try/catch (not just the caller's) because merely REFERENCING the
 * `localStorage` global can itself throw in some browsers (old Safari
 * private-mode getters, storage-partitioned/third-party contexts raising
 * SecurityError) — a throw here must never escape, matching this module's
 * "never throws" guarantee.
 */
function resolveStorage(storage?: Storage): Storage | undefined {
  if (storage) return storage
  try {
    return typeof localStorage !== 'undefined' ? localStorage : undefined
  } catch {
    return undefined
  }
}

function isValidMapping(value: unknown): value is MonitorMapping {
  if (typeof value !== 'object' || value === null) return false
  const v = value as { assignments?: unknown; savedAt?: unknown }
  if (!Array.isArray(v.assignments)) return false
  if (typeof v.savedAt !== 'number') return false
  return v.assignments.every((a) => {
    if (typeof a !== 'object' || a === null) return false
    const assignment = a as { fingerprint?: unknown; role?: unknown }
    return typeof assignment.fingerprint === 'string' && (assignment.role === 'audience' || assignment.role === 'confidence')
  })
}

/**
 * Persists `mapping` under the fixed device-scoped key. ALL storage access is
 * wrapped in try/catch — a private-mode / disabled-storage throw silently
 * no-ops rather than propagating (T-91-04).
 */
export function saveMapping(mapping: MonitorMapping, storageOverride?: Storage): void {
  const storage = resolveStorage(storageOverride)
  if (!storage) return
  try {
    storage.setItem(MONITOR_CONFIG_STORAGE_KEY, JSON.stringify(mapping))
  } catch {
    // Private mode / disabled storage — silent no-op (T-91-04).
  }
}

/**
 * Loads the persisted mapping. Returns `null` when nothing is saved, when the
 * stored value fails to parse, when it does not validate against the expected
 * shape (T-91-01 — untrusted-input treatment of a localStorage read), or when
 * the storage backend itself throws. Never throws.
 */
export function loadMapping(storageOverride?: Storage): MonitorMapping | null {
  const storage = resolveStorage(storageOverride)
  if (!storage) return null
  try {
    const raw = storage.getItem(MONITOR_CONFIG_STORAGE_KEY)
    if (raw === null) return null
    const parsed: unknown = JSON.parse(raw)
    return isValidMapping(parsed) ? parsed : null
  } catch {
    return null
  }
}

/**
 * Decides whether a saved mapping can be silently reused against the CURRENT
 * live screens (R328), or whether a partial layout change should keep the
 * still-live assignments and surface only the delta (R326). Delta-aware —
 * NOT bidirectional set-equality; see .planning/codebase/ARCHITECTURE.md
 * (Utils Behavioral Notes — src/utils/monitorConfig.ts).
 */
export function matchMapping(savedMapping: MonitorMapping, liveScreens: ScreenLike[]): MatchResultV2 {
  if (savedMapping.assignments.length === 0) return { status: 'no-mapping' }
  const fingerprintByScreen = computeFingerprints(liveScreens)
  const liveFingerprints = new Set(fingerprintByScreen.values())
  const savedFingerprints = new Set(savedMapping.assignments.map((assignment) => assignment.fingerprint))
  const kept = savedMapping.assignments.filter((assignment) => liveFingerprints.has(assignment.fingerprint))
  const newScreens = liveScreens.filter((screen) => !savedFingerprints.has(fingerprintByScreen.get(screen)!))
  if (kept.length === savedMapping.assignments.length && newScreens.length === 0) return { status: 'matched' }
  return { status: 'partial', kept, newScreens }
}
