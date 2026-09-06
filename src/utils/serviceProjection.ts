// Shared, store-free PII-safe allowlist helpers (R346/SEC-S-04, WR-01) — the
// SINGLE copy of the per-kind slot field-allowlist and the stage-marker
// field-allowlist that BOTH `buildServiceSnapshot` (src/stores/services.ts,
// the public share-link projection) and `buildRehearseAccess`
// (src/utils/rehearseAccess.ts, the volunteer rehearse projection, Phase 127)
// call. Extracted so the two PII boundaries can never drift independently —
// see 127-RESEARCH.md Pitfall 2. No Firestore/Pinia imports (types only),
// matching the "pure function in utils/" convention.

import type { ServiceSlot, StageMarker } from '@/types/service'
import { clampPct } from '@/utils/stageLayout'

/**
 * Per-kind slot field-allowlist: only the structured display fields any
 * consumer (ShareView.vue, the Volunteer Order of Service tab) actually
 * reads survive — free-text `notes`/`body` are dropped for every kind,
 * unconditionally (no raw spread). `resolveBpm`, when given, lets a SONG
 * slot carry a resolved `bpm` without this helper importing any store —
 * `buildServiceSnapshot` resolves via `useSongStore()` inside its callback;
 * `buildRehearseAccess` resolves via its own already-loaded `songsById` map.
 */
export function mapSlotAllowlist(
  slot: ServiceSlot,
  resolveBpm?: (slot: Extract<ServiceSlot, { kind: 'SONG' }>) => number | null,
): ServiceSlot {
  switch (slot.kind) {
    case 'SONG': {
      const base = {
        id: slot.id,
        kind: 'SONG' as const,
        position: slot.position,
        requiredVwType: slot.requiredVwType,
        songId: slot.songId,
        songTitle: slot.songTitle,
        songKey: slot.songKey,
      }
      if (!slot.songId || !resolveBpm) return base
      const bpm = resolveBpm(slot)
      // `bpm` is a display-only field not declared on `SongSlot` itself —
      // the resolved arrangement tempo the share page's/rehearse meta
      // line's song line reads.
      return { ...base, bpm } as ServiceSlot
    }
    case 'SCRIPTURE':
      return {
        id: slot.id,
        kind: 'SCRIPTURE',
        position: slot.position,
        book: slot.book,
        chapter: slot.chapter,
        verseStart: slot.verseStart,
        verseEnd: slot.verseEnd,
      }
    case 'HYMN':
      return {
        id: slot.id,
        kind: 'HYMN',
        position: slot.position,
        hymnName: slot.hymnName,
        hymnNumber: slot.hymnNumber,
        verses: slot.verses,
      }
    case 'IMPORTED':
      return { id: slot.id, kind: 'IMPORTED', position: slot.position, importId: slot.importId }
    case 'PRAYER':
    case 'MESSAGE':
    case 'ANNOUNCEMENTS':
    case 'MISC':
      return {
        id: slot.id,
        kind: slot.kind,
        position: slot.position,
        ...(slot.kind === 'MISC' && slot.label ? { label: slot.label } : {}),
      }
    // WR-02 (118-REVIEW): the switch above is exhaustive over the
    // compile-time `ServiceSlot` union, but a runtime slot whose `kind`
    // falls outside it (corrupt/legacy/future data crossing the Firestore
    // boundary) must still map to a value — falling off the end returns
    // `undefined`, which throws whichever write consumes this array
    // (Firestore rejects `undefined` at any depth). Keep the slot's
    // identity/position as a structured stand-in rather than propagate
    // `undefined`.
    default: {
      // `slot` narrows to `never` here because the switch is exhaustive
      // over the compile-time union — this branch only exists for a
      // runtime value outside it, so read defensively through an unknown
      // cast.
      const unknownSlot = slot as unknown as { id: string; kind: string; position: number }
      return { id: unknownSlot.id, kind: unknownSlot.kind, position: unknownSlot.position } as ServiceSlot
    }
  }
}

/** Maps a whole ordered slot array through {@link mapSlotAllowlist}. */
export function mapOrderedSlots(
  slots: ServiceSlot[],
  resolveBpm?: (slot: Extract<ServiceSlot, { kind: 'SONG' }>) => number | null,
): ServiceSlot[] {
  return slots.map((slot) => mapSlotAllowlist(slot, resolveBpm))
}

/**
 * Stage-marker field-allowlist to EXACTLY the display fields, defensively
 * re-clamped (IN-03) as the last line of defense before a client outside the
 * planner's own session renders these values — free-text `note` is NEVER
 * included here (WR-01, 118-REVIEW); this is the `PublicStageMarker` shape
 * (`Omit<StageMarker, 'note'>`, see src/stores/services.ts). Callers that
 * need `note` on their OWN return (only `buildServiceSnapshot`'s
 * org-internal `ServiceSnapshot`, for the `lockSnapshots/current` re-lock
 * diff) add it back on top of this allowlist's output themselves — `note`
 * is never re-derived, only conditionally re-attached by the one caller
 * that still needs it.
 */
export function mapStageMarkerAllowlist(marker: StageMarker): Omit<StageMarker, 'note'> {
  return {
    id: marker.id,
    label: marker.label,
    ...(marker.kind ? { kind: marker.kind } : {}),
    zone: marker.zone,
    xPct: clampPct(marker.xPct),
    yPct: clampPct(marker.yPct),
    // Band-role instrument: project the display role NAME (needed for the
    // tile's type/icon/skin on a read-only page), never the internal roleId.
    ...(marker.roleName ? { roleName: marker.roleName } : {}),
    // Assigned person: project only the display NAME, never the internal
    // personId.
    ...(marker.personName ? { personName: marker.personName } : {}),
    // The "player also sings" flag is a boolean display cue (no PII).
    ...(marker.withVocal ? { withVocal: true } : {}),
  }
}

/** Maps a whole marker array through {@link mapStageMarkerAllowlist}. */
export function mapStageMarkers(markers: StageMarker[]): Omit<StageMarker, 'note'>[] {
  return markers.map(mapStageMarkerAllowlist)
}

/**
 * Neutral placeholder for a `roleAssignments.personNames` entry whose
 * `personId` no longer resolves via `nameById` (WR-04, 127-REVIEW) — the
 * person was removed from the roster after being scheduled/overridden.
 * Both `buildServiceSnapshot` (src/stores/services.ts) and
 * `buildRehearseAccess` (src/utils/rehearseAccess.ts) share this constant so
 * they can't drift, matching the shared-allowlist precedent above.
 */
export const REMOVED_PERSON_NAME = '(removed)'

/**
 * Resolves a scheduled person's display name for `roleAssignments`, falling
 * back to {@link REMOVED_PERSON_NAME} rather than the raw internal
 * `personId` (WR-04) — a Firestore doc id has no business reaching an
 * external volunteer's rehearse view or a public share link.
 */
export function resolvePersonName(nameById: Map<string, string>, personId: string): string {
  return nameById.get(personId) ?? REMOVED_PERSON_NAME
}
