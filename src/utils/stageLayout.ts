import type { StageMarker } from '@/types/service'

/**
 * Pure geometry + factory helpers for the visual stage layout (R313/R314,
 * Phase 107). Deliberately dependency-free — no Vue, no Pinia, no Firebase
 * imports — so this module is safe to call from BOTH the editor's live
 * drag canvas (Plan 02) and the read-only renderer (this plan / Plan 03),
 * which in turn is what keeps StageLayoutView.vue import-free enough to
 * mount on the public, unauthenticated ShareView.
 *
 * Every position in this module is a PERCENTAGE in [0,100] of its zone's
 * bounding box, never a raw pixel — that is what makes a saved marker
 * position resize-stable and reload-exact (R314): a viewport resize just
 * recomputes pixel placement from the same stored percentage on render,
 * with no refetch or recalculation step.
 */

export const MARKER_KINDS = ['instrument', 'mic', 'monitor', 'other'] as const

interface Rect {
  left: number
  top: number
  width: number
  height: number
}

/** Clamps a value to the inclusive [0,100] range. */
export function clampPct(value: number): number {
  return Math.min(100, Math.max(0, value))
}

/**
 * Converts a pointer/client point into its percentage offset within `rect`,
 * each axis clamped to [0,100] independently — a point outside the rect
 * clamps to the nearest edge rather than exceeding the range. Round-trips
 * exactly (within floating tolerance) with the inverse pct->pixel mapping
 * `rect.left + (xPct / 100) * rect.width`, which is the property that keeps
 * reload and resize stable (R314).
 */
export function pctWithinRect(clientX: number, clientY: number, rect: Rect): { xPct: number; yPct: number } {
  const xPct = rect.width === 0 ? 0 : ((clientX - rect.left) / rect.width) * 100
  const yPct = rect.height === 0 ? 0 : ((clientY - rect.top) / rect.height) * 100
  return { xPct: clampPct(xPct), yPct: clampPct(yPct) }
}

function isPointInRect(x: number, y: number, rect: Rect): boolean {
  return x >= rect.left && x <= rect.left + rect.width && y >= rect.top && y <= rect.top + rect.height
}

/**
 * Resolves which zone a point falls inside by bounding-rect containment.
 * A point inside neither zone rect returns `fallbackZone` — this is what
 * lets a drag dropped outside any zone keep the marker's CURRENT zone
 * instead of silently reassigning it.
 */
export function zoneFromPoint(
  clientX: number,
  clientY: number,
  zones: { onstage: Rect; offstage: Rect },
  fallbackZone: StageMarker['zone'],
): StageMarker['zone'] {
  if (isPointInRect(clientX, clientY, zones.onstage)) return 'onstage'
  if (isPointInRect(clientX, clientY, zones.offstage)) return 'offstage'
  return fallbackZone
}

/**
 * Builds a brand-new StageMarker with a fresh id. Omits the `kind` key
 * entirely when not supplied — NEVER `kind: undefined` — matching this
 * codebase's established "absent key, not undefined value" convention for
 * optional fields (see `createSlot` in src/utils/slotTypes.ts).
 */
export function createMarker(input: {
  label: string
  zone: StageMarker['zone']
  xPct: number
  yPct: number
  kind?: StageMarker['kind']
}): StageMarker {
  const { label, zone, xPct, yPct, kind } = input
  return {
    id: crypto.randomUUID(),
    label,
    zone,
    xPct: clampPct(xPct),
    yPct: clampPct(yPct),
    ...(kind ? { kind } : {}),
  }
}

/**
 * Returns a STATIC, complete literal Tailwind class string for a marker's
 * optional `kind` accent, per theme. Every branch is written as a full
 * literal (never built by string concatenation/interpolation) so Tailwind
 * v4's content-scan purge can find every class at build time — the same
 * discipline `kindBadgeClass()` in src/utils/slotTypes.ts already follows.
 * `kind` absent/'other' and any theme both fall back to the neutral gray
 * family, matching 107-UI-SPEC's kind table.
 */
export function markerKindAccentClass(kind: StageMarker['kind'], theme: 'dark' | 'light' = 'dark'): string {
  if (theme === 'light') {
    switch (kind) {
      case 'instrument':
        return 'bg-sky-100 border-sky-300 text-sky-700'
      case 'mic':
        return 'bg-emerald-100 border-emerald-300 text-emerald-700'
      case 'monitor':
        return 'bg-amber-100 border-amber-300 text-amber-700'
      default:
        return 'bg-gray-100 border-gray-300 text-gray-700'
    }
  }
  switch (kind) {
    case 'instrument':
      return 'bg-sky-950 border-sky-800 text-sky-300'
    case 'mic':
      return 'bg-emerald-950 border-emerald-800 text-emerald-300'
    case 'monitor':
      return 'bg-amber-950 border-amber-800 text-amber-300'
    default:
      return 'bg-gray-800 border-gray-600 text-gray-300'
  }
}
