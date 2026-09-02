import type { StageMarker, StageMarkerKind } from '@/types/service'

/**
 * Pure geometry + kind-registry helpers for the visual stage layout (R313/R314,
 * Phase 107). Dependency-free (no Vue/Pinia/Firebase).
 * See .planning/codebase/STACK.md (Utils Stack Notes — src/utils/stageLayout.ts)
 */

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
 * each axis clamped to [0,100] independently. Round-trips exactly (within
 * floating tolerance) with the inverse pct->pixel mapping, the property that
 * keeps reload and resize stable (R314).
 */
export function pctWithinRect(clientX: number, clientY: number, rect: Rect): { xPct: number; yPct: number } {
  const xPct = rect.width === 0 ? 0 : ((clientX - rect.left) / rect.width) * 100
  const yPct = rect.height === 0 ? 0 : ((clientY - rect.top) / rect.height) * 100
  return { xPct: clampPct(xPct), yPct: clampPct(yPct) }
}

// The stage platform occupies the inset top band of the room (matches the
// trapezoid drawn in StageRoom: left 10%–right 90%, top 5%–edge 65%).
export const STAGE_BAND = { minX: 11, maxX: 89, maxY: 64 } as const

/** Derives a marker's stored zone from its single-space position. */
export function zoneFromPosition(xPct: number, yPct: number): StageMarker['zone'] {
  const onStage = xPct > STAGE_BAND.minX && xPct < STAGE_BAND.maxX && yPct < STAGE_BAND.maxY
  return onStage ? 'onstage' : 'offstage'
}

/** Human-readable placement label for the inspector drawer. */
export function placementLabel(xPct: number, yPct: number): string {
  if (zoneFromPosition(xPct, yPct) === 'onstage') return 'On stage'
  if (yPct >= STAGE_BAND.maxY) return 'In front of the stage'
  return 'Off stage · in the wing'
}

// ── Kind registry (fixed kinds only) ─────────────────────────────────────────
// Instruments here are the two EXTRAS (Orchestra, Instrument) that don't follow
// a Band role — the per-org band-role instrument chips are built dynamically in
// `buildStagePalette`. `gear` splits neutral gear tiles from accent performer
// tiles; `icon` names a glyph in StageKindIcon.vue.

export interface StageKindMeta {
  label: string
  group: 'Vocals' | 'Instruments' | 'Mics & DI' | 'Gear'
  icon: string
  gear: boolean
}

export const STAGE_KIND_META: Record<StageMarkerKind, StageKindMeta> = {
  lead: { label: 'Lead vocal', group: 'Vocals', icon: 'mic-stage', gear: false },
  vocal: { label: 'Vocal', group: 'Vocals', icon: 'mic', gear: false },
  choir: { label: 'Choir', group: 'Vocals', icon: 'users', gear: false },
  orchestra: { label: 'Orchestra', group: 'Instruments', icon: 'strings', gear: false },
  instrument: { label: 'Instrument', group: 'Instruments', icon: 'music', gear: false },
  mic: { label: 'Microphone', group: 'Mics & DI', icon: 'mic', gear: true },
  di: { label: 'DI box', group: 'Mics & DI', icon: 'plug', gear: true },
  monitor: { label: 'Monitor', group: 'Gear', icon: 'speaker', gear: true },
  amp: { label: 'Amp', group: 'Gear', icon: 'speaker', gear: true },
  stand: { label: 'Music stand', group: 'Gear', icon: 'music', gear: true },
  power: { label: 'Power drop', group: 'Gear', icon: 'bolt', gear: true },
  tv: { label: 'TV', group: 'Gear', icon: 'tv', gear: true },
  misc: { label: 'Miscellaneous', group: 'Gear', icon: 'box', gear: true },
  communion: { label: 'Communion', group: 'Gear', icon: 'cup', gear: true },
}

export const STAGE_KINDS = Object.keys(STAGE_KIND_META) as StageMarkerKind[]
export const STAGE_KIND_GROUPS = ['Vocals', 'Instruments', 'Mics & DI', 'Gear'] as const

/** True when the fixed kind is neutral "gear". Unknown/absent → gear-neutral. */
export function isGearKind(kind: StageMarker['kind']): boolean {
  return kind ? STAGE_KIND_META[kind]?.gear !== false : true
}

/** True when the fixed kind is in the Instruments group. */
export function isInstrumentKind(kind: StageMarker['kind']): boolean {
  return kind ? STAGE_KIND_META[kind]?.group === 'Instruments' : false
}

/** A best-effort glyph for a band-role instrument, keyed off the role name. */
export function roleInstrumentIcon(roleName: string): string {
  const n = roleName.toLowerCase()
  if (/bass|guitar|gtr|uke/.test(n)) return 'guitar'
  if (/key|piano|synth|organ|rhodes/.test(n)) return 'piano'
  if (/drum|perc|cajon|kit/.test(n)) return 'drum'
  if (/violin|viola|cello|string|orchestra|fiddle/.test(n)) return 'strings'
  if (/vocal|sing|vox|lead|choir/.test(n)) return 'mic-stage'
  return 'music'
}

// ── Marker-level display helpers (kind OR band role) ─────────────────────────

/** A band-role instrument OR an Instruments-group kind — the markers that can
 *  carry the "player also sings" flag and take the accent (performer) tile. */
export function markerIsInstrument(marker: Pick<StageMarker, 'kind' | 'roleName'>): boolean {
  return marker.roleName ? true : isInstrumentKind(marker.kind)
}

/** Gear (neutral tile) vs performer (accent tile). A role-instrument marker is
 *  always a performer; otherwise it follows the fixed kind's gear flag. */
export function isGearMarker(marker: Pick<StageMarker, 'kind' | 'roleName'>): boolean {
  return marker.roleName ? false : isGearKind(marker.kind)
}

/** The glyph for a marker: role-based when it carries a band role, else its
 *  fixed kind's glyph, else a neutral dot. */
export function stageMarkerIcon(marker: Pick<StageMarker, 'kind' | 'roleName'>): string {
  if (marker.roleName) return roleInstrumentIcon(marker.roleName)
  return (marker.kind && STAGE_KIND_META[marker.kind]?.icon) || 'dot'
}

/** The TYPE label for a marker tile: the band role name, or the fixed kind's
 *  label, plus "+ Vocal" for an instrument whose player also sings. */
export function stageMarkerTypeLabel(marker: Pick<StageMarker, 'kind' | 'roleName' | 'withVocal'>): string {
  const base = marker.roleName ? marker.roleName : marker.kind ? STAGE_KIND_META[marker.kind]?.label ?? '' : ''
  if (!base) return ''
  return marker.withVocal && markerIsInstrument(marker) ? `${base} + Vocal` : base
}

/** The fixed-kind TYPE label (+ "+ Vocal" for instrument kinds). Used for the
 *  label fallback when a person is unassigned on a fixed-kind marker. */
export function stageTypeLabel(kind: StageMarker['kind'], withVocal = false): string {
  if (!kind) return ''
  const base = STAGE_KIND_META[kind]?.label ?? ''
  return withVocal && isInstrumentKind(kind) ? `${base} + Vocal` : base
}

// ── Tile skin (full literal Tailwind classes, purge-safe) ────────────────────
function skinClass(gear: boolean, theme: 'dark' | 'light', selected: boolean): string {
  if (theme === 'light') {
    if (selected) return gear ? 'bg-gray-100 border-indigo-500 text-gray-700' : 'bg-indigo-50 border-indigo-500 text-indigo-700'
    return gear ? 'bg-gray-100 border-gray-300 text-gray-600' : 'bg-indigo-50 border-indigo-200 text-indigo-700'
  }
  if (selected) return gear ? 'bg-gray-800 border-indigo-400 text-gray-200' : 'bg-indigo-950 border-indigo-400 text-indigo-200'
  return gear ? 'bg-gray-800 border-gray-700 text-gray-300' : 'bg-indigo-950 border-indigo-800 text-indigo-200'
}

/** Skin for a palette chip (fixed kind or role — role chips are performers). */
export function stagePaletteSkinClass(gear: boolean, theme: 'dark' | 'light' = 'dark'): string {
  return skinClass(gear, theme, false)
}
/** Back-compat: skin from a fixed kind. */
export function stageTileSkinClass(kind: StageMarker['kind'], theme: 'dark' | 'light' = 'dark', selected = false): string {
  return skinClass(isGearKind(kind), theme, selected)
}
/** Skin from a whole marker (accounts for band-role instruments). */
export function stageMarkerSkinClass(marker: Pick<StageMarker, 'kind' | 'roleName'>, theme: 'dark' | 'light' = 'dark', selected = false): string {
  return skinClass(isGearMarker(marker), theme, selected)
}

// ── Palette (Instruments mirror the org's Band roles) ────────────────────────
export interface StagePaletteItem {
  /** stable key / testid suffix */
  id: string
  label: string
  icon: string
  gear: boolean
  kind?: StageMarkerKind
  roleId?: string
  roleName?: string
}
export interface StagePaletteGroup {
  name: string
  items: StagePaletteItem[]
}

function kindItems(group: StageKindMeta['group']): StagePaletteItem[] {
  return STAGE_KINDS.filter((k) => STAGE_KIND_META[k].group === group).map((kind) => ({
    id: kind,
    label: STAGE_KIND_META[kind].label,
    icon: STAGE_KIND_META[kind].icon,
    gear: STAGE_KIND_META[kind].gear,
    kind,
  }))
}

/**
 * Builds the palette. The Instruments group is the org's Band roles (each a
 * role chip that lines a marker's instrument up with the role a person plays),
 * followed by the fixed Orchestra & Instrument extras that don't follow a Band
 * role. Vocals / Mics & DI / Gear are the fixed kinds.
 */
export function buildStagePalette(bandRoles: { id: string; name: string }[] = []): StagePaletteGroup[] {
  const roleItems: StagePaletteItem[] = bandRoles.map((r) => ({
    id: `role-${r.id}`,
    label: r.name,
    icon: roleInstrumentIcon(r.name),
    gear: false,
    roleId: r.id,
    roleName: r.name,
  }))
  return [
    { name: 'Vocals', items: kindItems('Vocals') },
    { name: 'Instruments', items: [...roleItems, ...kindItems('Instruments')] },
    { name: 'Mics & DI', items: kindItems('Mics & DI') },
    { name: 'Gear', items: kindItems('Gear') },
  ]
}

/**
 * Builds a brand-new StageMarker with a fresh id, deriving `zone` from the drop
 * position. Carries a fixed `kind` OR a band `roleId`/`roleName`. Omits every
 * optional key it wasn't given (absent, never `undefined`).
 */
export function createMarker(input: {
  label: string
  xPct: number
  yPct: number
  kind?: StageMarker['kind']
  roleId?: string
  roleName?: string
  zone?: StageMarker['zone']
}): StageMarker {
  const { label, xPct, yPct, kind, roleId, roleName } = input
  const x = clampPct(xPct)
  const y = clampPct(yPct)
  return {
    id: crypto.randomUUID(),
    label,
    zone: input.zone ?? zoneFromPosition(x, y),
    xPct: x,
    yPct: y,
    ...(kind ? { kind } : {}),
    ...(roleId && roleName ? { roleId, roleName } : {}),
  }
}
