// Pure service-lock diff + slide-group fingerprint (Phase 62, R146/R147). No
// Firestore/Pinia/store imports (types only), so both functions are testable
// with plain fixtures and zero app/store setup — the same "pure function in
// utils/" convention as src/utils/serviceRoles.ts and
// src/utils/messagingRecipients.ts. Every ServiceSnapshot/SlideGroup value is
// passed IN; nothing here reads a store, a Firestore doc, or resolved slide
// text.
//
// LIMITATION A1 (v1.7, deliberate): fingerprintSlideGroups hashes each group's
// ordered sourceRef IDENTITIES (kind + the ids/authored fields that live on the
// group doc) — NEVER the resolved slide TEXT. Slide text is not stored on the
// group document; it resolves LIVE from the canonical song/scripture/imported
// record via sourceRef (slideGroup.ts invariant 3). Consequence: editing a
// song's LYRICS in place, with no change to which song/section the group points
// at, does NOT change the hash and is therefore NOT flagged as a SLIDES change.
// This is accepted scope for v1.7's coarse SLIDES change-notice — broadening it
// would re-couple the lock hook to live text resolution, which is deliberately
// avoided. Add/remove/reorder of slides and any authored text/scripture/video
// field edit ARE caught, because those change a sourceRef identity.

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
