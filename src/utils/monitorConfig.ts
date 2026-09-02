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

/** The outcome of comparing a saved mapping against the CURRENT live screens. */
export type MatchResult = { status: 'matched' } | { status: 'needs-reprompt' }

/**
 * The ONE fixed localStorage key this module ever reads or writes.
 * Deliberately carries no uid/org interpolation — see module doc comment.
 */
export const MONITOR_CONFIG_STORAGE_KEY = 'wp:runMonitorConfig:v1'

/** A screen with no label at all degrades to this placeholder rather than throwing. */
const UNLABELED_PLACEHOLDER = 'unlabeled'

/**
 * Synthesizes a stable fingerprint from label + resolution + position +
 * isPrimary (STACK.md/ARCHITECTURE.md). A missing label degrades to a fixed
 * placeholder token instead of throwing or producing `undefined` in the string.
 */
export function computeFingerprint(screen: ScreenLike): string {
  const label = screen.label && screen.label.length > 0 ? screen.label : UNLABELED_PLACEHOLDER
  return `${label}:${screen.width}x${screen.height}:${screen.left},${screen.top}:${screen.isPrimary}`
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
 * live screens, or whether a genuine layout change requires re-prompting
 * (R268). BIDIRECTIONAL set-equality, not a one-way subset check.
 * See .planning/codebase/ARCHITECTURE.md (Utils Behavioral Notes — src/utils/monitorConfig.ts)
 */
export function matchMapping(savedMapping: MonitorMapping, liveScreens: ScreenLike[]): MatchResult {
  const liveFingerprints = new Set(liveScreens.map((screen) => computeFingerprint(screen)))
  const savedFingerprints = new Set(savedMapping.assignments.map((assignment) => assignment.fingerprint))
  const allSavedFound = savedMapping.assignments.every((assignment) => liveFingerprints.has(assignment.fingerprint))
  const allLiveKnown = liveScreens.every((screen) => savedFingerprints.has(computeFingerprint(screen)))
  return allSavedFound && allLiveKnown ? { status: 'matched' } : { status: 'needs-reprompt' }
}
