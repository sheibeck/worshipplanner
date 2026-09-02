// Pure service-lock diff + slide-group fingerprint (Phase 62, R146/R147).
// See .planning/codebase/CONCERNS.md (Utils Concern Notes — src/utils/serviceLockDiff.ts)

import type { SlideGroup, GroupSlideEntry, SourceRef } from '@/types/slideGroup'
import type { RoleGroup } from '@/types/roster'
import type { ServiceSnapshot } from '@/stores/services'

/** A deterministic { [slotId]: hash } map over each in-service group's ordered
 *  sourceRef identities. Imported by 62-04's lock hook (replacing the Phase 61
 *  `slideGroupsFingerprint: null` stub) and compared here by diffServiceSnapshots. */
export type SlideFingerprint = Record<string, string>

/**
 * One detected change between two locked ServiceSnapshots.
 * - `type` is the coarse change class the change-notice modal (62-03) groups by.
 * - `affectedTeams` follows R147: a ROLE entry tags EXACTLY the changed role's
 *   group (narrow); SONG/ORDER/NOTES/SLIDES tag broad = every RoleGroup with at
 *   least one assigned person on the CURRENT snapshot.
 * Imported by the modal (62-03) and the lock hook (62-04).
 */
export interface ChangeEntry {
  type: 'SONG' | 'ORDER' | 'ROLE' | 'NOTES' | 'SLIDES'
  description: string
  affectedTeams: RoleGroup[]
}

// ---------------------------------------------------------------------------
// Fingerprint
// ---------------------------------------------------------------------------

/**
 * Serialize the DISCRIMINATING identity of a single sourceRef. Optional leaves
 * are coalesced to '' so a missing field is stable across runs/machines. Covers
 * every current SourceRef member (slideGroup.ts:165-186) explicitly.
 */
function refKey(ref: SourceRef): string {
  switch (ref.kind) {
    case 'lyric':
      return `lyric:${ref.songId}:${ref.sectionId}`
    case 'copyright':
      return `copyright:${ref.songId}`
    case 'scripture':
      return `scripture:${ref.speaker ?? ''}:${ref.text ?? ''}:${ref.verseRange ?? ''}:${ref.scriptureReadingId ?? ''}`
    case 'imported':
      return `imported:${ref.importId}:${ref.innerSlideId}:${ref.renderedPage ?? ''}`
    case 'text':
      return `text:${ref.title ?? ''}:${ref.body ?? ''}`
    case 'video':
      return `video:${ref.videoSrc}`
    default:
      // Exhaustiveness guard — a new SourceRef member must add a case above.
      return `unknown:${JSON.stringify(ref)}`
  }
}

/**
 * Dependency-free DJB2 string hash. NON-security (never used for auth/integrity/
 * signing) — a pure change-detector. NO Math.random, NO Date, NO npm package,
 * so the same input string always yields the same base-36 digest.
 */
function djb2(input: string): string {
  let h = 5381
  for (let i = 0; i < input.length; i++) {
    h = ((h << 5) + h + input.charCodeAt(i)) | 0
  }
  return (h >>> 0).toString(36)
}

/**
 * For each group whose serviceId matches, hash its slides — sorted by `.order`
 * (a COPY, so the caller's array is never mutated), each mapped to `refKey` and
 * joined in order. Returns { [slotId]: hash }. Order-independent on the input
 * array and on the pre-sort slides order; order-SENSITIVE on `.order`.
 */
export function fingerprintSlideGroups(groups: SlideGroup[], serviceId: string): SlideFingerprint {
  const out: SlideFingerprint = {}
  for (const g of groups) {
    if (g.serviceId !== serviceId) continue
    const ordered = [...(g.slides ?? [])].sort((a, b) => a.order - b.order)
    const serialized = ordered.map((s: GroupSlideEntry) => refKey(s.sourceRef)).join('|')
    out[g.slotId] = djb2(serialized)
  }
  return out
}

// ---------------------------------------------------------------------------
// Diff
// ---------------------------------------------------------------------------

type RoleAssignment = ServiceSnapshot['roleAssignments'][number]

/**
 * R147 broad default — the distinct `group` values whose CURRENT-snapshot
 * roleAssignments entry has at least one assigned person. A broad change
 * (SONG/ORDER/NOTES/SLIDES) tags every team that actually has someone serving.
 */
function groupsWithAssignments(roleAssignments: RoleAssignment[]): RoleGroup[] {
  const seen = new Set<RoleGroup>()
  for (const ra of roleAssignments) {
    if (ra.personNames.length > 0) seen.add(ra.group)
  }
  return [...seen]
}

/** Order-insensitive equality of two person-name lists. */
function sameNames(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false
  const sa = [...a].sort()
  const sb = [...b].sort()
  return sa.every((name, i) => name === sb[i])
}

/** True if any key is added/removed or any shared key's value changed. `null` is treated as an empty map. */
function fingerprintsDiffer(prev: SlideFingerprint | null, curr: SlideFingerprint | null): boolean {
  const p = prev ?? {}
  const c = curr ?? {}
  const keys = new Set([...Object.keys(p), ...Object.keys(c)])
  for (const k of keys) {
    if (p[k] !== c[k]) return true
  }
  return false
}

/**
 * PURE diff of two locked ServiceSnapshots plus their two slide fingerprint
 * maps (R147 affected-teams tagging). Both `slots` arrays are ALREADY
 * section-major — this function must NOT re-sort them.
 * See .planning/codebase/ARCHITECTURE.md (Utils Behavioral Notes — src/utils/serviceLockDiff.ts)
 */
export function diffServiceSnapshots(
  previous: ServiceSnapshot,
  current: ServiceSnapshot,
  prevFingerprint: SlideFingerprint | null,
  currFingerprint: SlideFingerprint | null,
): ChangeEntry[] {
  const entries: ChangeEntry[] = []
  const broad = groupsWithAssignments(current.roleAssignments)

  const prevById = new Map(previous.slots.map((s) => [s.id, s]))
  const currById = new Map(current.slots.map((s) => [s.id, s]))

  // SONG — a shared slot id, both SONG, songId/songTitle changed; plus a SONG
  // slot added or removed (present in only one snapshot).
  let songChanged = false
  for (const [id, cur] of currById) {
    const prior = prevById.get(id)
    if (prior && prior.kind === 'SONG' && cur.kind === 'SONG') {
      if (prior.songId !== cur.songId || prior.songTitle !== cur.songTitle) songChanged = true
    } else if (!prior && cur.kind === 'SONG') {
      songChanged = true
    }
  }
  for (const [id, prior] of prevById) {
    if (!currById.has(id) && prior.kind === 'SONG') songChanged = true
  }
  if (songChanged) {
    entries.push({ type: 'SONG', description: 'Song changed', affectedTeams: broad })
  }

  // ORDER — the sequence of shared slot ids moved, OR the slot-id set changed
  // (an add/remove). Do NOT re-sort — both arrays are already section-major.
  const prevIds = previous.slots.map((s) => s.id)
  const currIds = current.slots.map((s) => s.id)
  const currIdSet = new Set(currIds)
  const prevIdSet = new Set(prevIds)
  const setChanged =
    prevIds.length !== currIds.length ||
    prevIds.some((id) => !currIdSet.has(id)) ||
    currIds.some((id) => !prevIdSet.has(id))
  const sharedPrevOrder = prevIds.filter((id) => currIdSet.has(id))
  const sharedCurrOrder = currIds.filter((id) => prevIdSet.has(id))
  const sequenceMoved = sharedPrevOrder.some((id, i) => id !== sharedCurrOrder[i])
  if (setChanged || sequenceMoved) {
    entries.push({ type: 'ORDER', description: 'Service order changed', affectedTeams: broad })
  }

  // ROLE — a roleAssignments[roleId].personNames change tags EXACTLY that role's
  // group (the one narrow tag, R147 — never broad).
  for (const cur of current.roleAssignments) {
    const prior = previous.roleAssignments.find((ra) => ra.roleId === cur.roleId)
    const priorNames = prior ? prior.personNames : []
    if (!sameNames(priorNames, cur.personNames)) {
      entries.push({
        type: 'ROLE',
        description: `${cur.roleName} assignment changed`,
        affectedTeams: [cur.group],
      })
    }
  }

  // NOTES — service-level notes string inequality (broad).
  if (previous.notes !== current.notes) {
    entries.push({ type: 'NOTES', description: 'Service notes changed', affectedTeams: broad })
  }

  // SLIDES — the two fingerprint maps differ by any key or value (broad, coarse).
  if (fingerprintsDiffer(prevFingerprint, currFingerprint)) {
    entries.push({ type: 'SLIDES', description: 'Slides changed', affectedTeams: broad })
  }

  return entries
}
