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

// ── Auto-populate (R420) ──────────────────────────────────────────────────
// Fixed column count for the seeded grid; a small, readable default that
// wraps to additional rows as the roster grows (Claude's discretion, plan 131-01).
const AUTO_POPULATE_COLS = 4
// Inset a few percent inside STAGE_BAND on every edge so seeded markers never
// sit flush against the band boundary (keeps them strictly onstage).
const AUTO_POPULATE_INSET_X = 8
const AUTO_POPULATE_START_Y = 20
const AUTO_POPULATE_END_Y = STAGE_BAND.maxY - 4

/** One serving assignment fed to the stage-layout auto-seed. `withVocal` is set
 *  by foldPlayAndSing for an instrument assignment whose person also sings. */
export interface SeedAssignment {
  id: string
  name: string
  roleId: string
  roleName: string
  withVocal?: boolean
}

/**
 * True when a role's NAME reads as a singing role (so a band member assigned it
 * "also sings"). Matches vocal/vox/choir/sing; deliberately NOT "lead", so
 * "Lead Guitar" is not misclassified as vocals. Pure — name-only, no store.
 */
export function isVocalRoleName(roleName: string): boolean {
  return /vocal|vox|choir|sing/i.test(roleName)
}

/**
 * Folds a person's play-and-sing assignments (260908-cou): for anyone holding
 * BOTH an instrument (non-vocal Band) role AND a vocal role the same service,
 * keep their instrument assignment(s) with `withVocal: true` and DROP their
 * vocal assignment(s) — so they seed as one "Guitar + Vocal" chit, not two.
 * A pure vocalist keeps their vocal assignment as-is; an instrument-only player
 * is unchanged. Order-preserving and non-mutating (mirrors the input contract of
 * autoPopulateMarkers). Callers pass Band-group assignments only.
 */
export function foldPlayAndSing(assignments: SeedAssignment[]): SeedAssignment[] {
  const byPerson = new Map<string, SeedAssignment[]>()
  for (const a of assignments) {
    const list = byPerson.get(a.id)
    if (list) list.push(a)
    else byPerson.set(a.id, [a])
  }
  const out: SeedAssignment[] = []
  for (const a of assignments) {
    const roleIsVocal = isVocalRoleName(a.roleName)
    const personRoles = byPerson.get(a.id) ?? [a]
    const hasInstrument = personRoles.some((p) => !isVocalRoleName(p.roleName))
    if (roleIsVocal) {
      if (hasInstrument) continue // fold: the vocal is carried on the instrument chit
      out.push(a) // pure vocalist keeps a Vocals chit
    } else {
      const singsToo = personRoles.some((p) => isVocalRoleName(p.roleName))
      out.push(singsToo || a.withVocal ? { ...a, withVocal: true } : a)
    }
  }
  return out
}

/**
 * Seeds one StageMarker per (person, role) serving assignment, laid out
 * deterministically in a non-overlapping grid inside the on-stage band. Pure
 * and store-free: the caller (ServiceEditorView's one-time seed trigger) owns
 * the empty-canvas / non-clobber guard — this function never reads or wipes
 * existing state (R420, non-clobber invariant is load-bearing there, not here).
 * A truthy per-assignment `withVocal` rides onto the marker (260908-cou).
 */
export function autoPopulateMarkers(
  servingAssignments: SeedAssignment[]
): StageMarker[] {
  const count = servingAssignments.length
  if (count === 0) return []

  const cols = AUTO_POPULATE_COLS
  const rows = Math.ceil(count / cols)
  const xStart = STAGE_BAND.minX + AUTO_POPULATE_INSET_X
  const xEnd = STAGE_BAND.maxX - AUTO_POPULATE_INSET_X
  const colStep = cols > 1 ? (xEnd - xStart) / (cols - 1) : 0
  const rowStep = rows > 1 ? (AUTO_POPULATE_END_Y - AUTO_POPULATE_START_Y) / (rows - 1) : 0

  return servingAssignments.map((assignment, index) => {
    const row = Math.floor(index / cols)
    const col = index % cols
    const xPct = xStart + col * colStep
    const yPct = AUTO_POPULATE_START_Y + row * rowStep
    const marker = createMarker({
      label: assignment.roleName,
      xPct,
      yPct,
      roleId: assignment.roleId,
      roleName: assignment.roleName,
    })
    marker.personId = assignment.id
    marker.personName = assignment.name
    if (assignment.withVocal) marker.withVocal = true
    return marker
  })
}

// ── Live reconcile (260908-cou fix) — stage band chits mirror band assignments ─
// After a Roles-tab edit the stage should track the roster: add a chit for a
// newly-assigned band member, drop one whose person is no longer assigned that
// role, and fold play+sing. This is the incremental counterpart to the one-time
// seed (autoPopulateMarkers), so it must NOT reflow existing markers — it keeps
// each kept marker's position and only appends new chits into free grid cells.

/** Treat a grid cell as taken when an existing marker sits within this % on both
 *  axes — keeps a newly-placed chit from landing on top of one already there. */
const PLACEMENT_MIN_GAP = 6

/**
 * A stable placement grid (4 columns across the on-stage band, rows stepping
 * down at a fixed pitch) that new chits drop into. Fixed pitch — NOT scaled to
 * the chit count like autoPopulateMarkers — so adding one chit never moves the
 * others.
 */
function placementCells(): { x: number; y: number }[] {
  const xStart = STAGE_BAND.minX + AUTO_POPULATE_INSET_X
  const xEnd = STAGE_BAND.maxX - AUTO_POPULATE_INSET_X
  const colStep = (xEnd - xStart) / (AUTO_POPULATE_COLS - 1)
  const rowStep = 12
  const cells: { x: number; y: number }[] = []
  for (let row = 0; ; row++) {
    const y = AUTO_POPULATE_START_Y + row * rowStep
    if (y > AUTO_POPULATE_END_Y) break
    for (let col = 0; col < AUTO_POPULATE_COLS; col++) cells.push({ x: xStart + col * colStep, y })
  }
  return cells
}

function cellIsFree(cell: { x: number; y: number }, occupied: { x: number; y: number }[]): boolean {
  return !occupied.some((o) => Math.abs(o.x - cell.x) < PLACEMENT_MIN_GAP && Math.abs(o.y - cell.y) < PLACEMENT_MIN_GAP)
}

/** Stable key for a (person, role) band-assignment chit. */
function bandChitKey(personId: string, roleId: string): string {
  return `${personId} ${roleId}`
}

/**
 * Reconcile the stage's Band-assignment chits against the desired folded band
 * assignments. Pure and store-free (the caller owns the empty-canvas guard).
 *
 * - A "managed" marker = one carrying BOTH a personId and a roleId (an assigned
 *   band-role chit, seeded or hand-assigned). Gear, unassigned spots, and
 *   fixed-kind markers have no personId/roleId and are left untouched.
 * - Managed markers whose (person, role) is still desired are KEPT in place, with
 *   `withVocal` updated to match the fold; those no longer desired are DROPPED.
 * - Desired assignments with no managed marker yet are ADDED, each placed in the
 *   first free grid cell (existing markers, including manual ones, are avoided).
 */
export function reconcileBandMarkers(existing: StageMarker[], desired: SeedAssignment[]): StageMarker[] {
  const desiredByKey = new Map<string, SeedAssignment>()
  for (const a of desired) desiredByKey.set(bandChitKey(a.id, a.roleId), a)

  const result: StageMarker[] = []
  const keptKeys = new Set<string>()
  for (const m of existing) {
    const managed = !!m.personId && !!m.roleId
    if (!managed) {
      result.push(m)
      continue
    }
    const key = bandChitKey(m.personId!, m.roleId!)
    const want = desiredByKey.get(key)
    if (!want) continue // stale assignment → drop the chit
    keptKeys.add(key)
    const wantVocal = !!want.withVocal
    if (!!m.withVocal === wantVocal) {
      result.push(m)
    } else if (wantVocal) {
      result.push({ ...m, withVocal: true })
    } else {
      const { withVocal: _drop, ...rest } = m
      result.push(rest)
    }
  }

  const toAdd = desired.filter((a) => !keptKeys.has(bandChitKey(a.id, a.roleId)))
  if (toAdd.length > 0) {
    const cells = placementCells()
    const occupied = result.map((m) => ({ x: m.xPct, y: m.yPct }))
    for (const a of toAdd) {
      const cell =
        cells.find((c) => cellIsFree(c, occupied)) ??
        cells[occupied.length % cells.length] ?? { x: STAGE_BAND.minX + AUTO_POPULATE_INSET_X, y: AUTO_POPULATE_START_Y }
      const marker = createMarker({ label: a.roleName, xPct: cell.x, yPct: cell.y, roleId: a.roleId, roleName: a.roleName })
      marker.personId = a.id
      marker.personName = a.name
      if (a.withVocal) marker.withVocal = true
      result.push(marker)
      occupied.push({ x: cell.x, y: cell.y })
    }
  }
  return result
}
