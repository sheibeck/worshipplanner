// Pure projection builder (Phase 125, R377) — assembles the frozen, PII-safe
// rehearseAccess doc a magic-link volunteer's Firestore read is scoped to.
// No Firestore/Pinia/store imports (types only), mirroring the same
// "pure function in utils/" convention as serviceRoles.ts/messagingRecipients.ts.
// Doc shape is authoritative per 125-01-PLAN.md and enforced by firestore.rules.

import type { Service, ServiceSlot, SongSlot } from '@/types/service'
import type { Quarter, Role, Person, RoleGroup } from '@/types/roster'
import type { Song, SongAttachmentKind, SongAttachmentLinkSource } from '@/types/song'
import type { PublicStageMarker } from '@/stores/services'
import { resolveServiceRoleAssignments } from '@/utils/serviceRoles'
import { mapOrderedSlots, mapStageMarkers, resolvePersonName } from '@/utils/serviceProjection'
import { orderSlotsBySection } from '@/utils/slotTypes'

export interface RehearseAttachment {
  id: string
  name: string
  kind: SongAttachmentKind
  downloadUrl?: string
  href?: string
  /** Link attachments only (Phase 127, R390) — selects the correct
   *  LINK_SOURCE_LABELS entry (YouTube/Drive/Dropbox/Link) so an external
   *  link renders its real source instead of a generic "Link" label. Not
   *  PII: one of 4 fixed, non-personal enum values already inferred
   *  client-side (songLinks.ts) from the link's own host. */
  linkSource?: SongAttachmentLinkSource
}

export interface RehearseSong {
  id: string
  title: string
  keyOrArrangement?: string
  /** Resolved arrangement tempo (Phase 127, R385/R386) — same resolution
   *  `buildServiceSnapshot` uses (arrangement matching `keyOrArrangement`,
   *  else the first arrangement, else `null`). Always present (never a
   *  bare "bpm" literal downstream) so the meta-line join can graceful-omit
   *  a genuinely null value rather than concatenate a partial string. */
  bpm?: number | null
  attachments: RehearseAttachment[]
}

/** "Who's Serving" projection (Phase 127, R392) — names-only via nameById,
 *  mirrors `buildServiceSnapshot`'s own `roleAssignments` map
 *  (services.ts:155-160): no `personId`/email, ever. */
export interface RehearseRoleAssignment {
  roleId: string
  roleName: string
  group: RoleGroup
  personNames: string[]
}

/** organizations/{orgId}/rehearseAccess/{serviceId} — see 125-01-PLAN.md artifacts
 *  section for the authoritative schema this must match exactly. `updatedAt` is
 *  added by the store's setDoc call, not by this builder. */
export interface RehearseAccessDoc {
  serviceId: string
  orgId: string
  /** Org's public display name (Phase 130, R403/R404) — PII-safe, already
   *  public via the orgSlugs registry. Lets a zero-membership volunteer label
   *  churches without reading organizations/{orgId} (membership-gated).
   *  Optional: pre-Phase-130 docs lack it until re-projected. */
  orgName?: string
  serviceDate: string
  title: string
  status: string
  assignedEmailsLower: string[]
  /** R381 (Phase 126, My Schedule): per-email role names, mirrors
   *  functions/src/serviceRoles.ts's roleNamesByPerson map, keyed by
   *  lowercased email instead of personId. PII-safe: role-name strings
   *  only, no person names/ids — a strictly smaller disclosure than the
   *  already-projected songs[]/attachment URLs. Empty-email persons are
   *  skipped entirely (mirrors assignedEmailsLower's own empty-email skip). */
  rolesByEmailLower: Record<string, string[]>
  /** Phase 133 (R410/R412) — the RULES-check sibling of
   *  roleAssignmentsByEmailLower below: role IDS only, keyed by lowercased
   *  email. firestore.rules' confirmations write rule does a flat `in`
   *  check against this (cheaper/simpler than matching a list-of-maps —
   *  133-RESEARCH.md Assumption A2). Same empty-email-skip, lowercased-key
   *  discipline as rolesByEmailLower. Deduped role ids per email. */
  roleIdsByEmailLower: Record<string, string[]>
  /** Phase 133 (R410/R412) — the CLIENT-render sibling of
   *  roleIdsByEmailLower above: role id+name pairs, keyed by lowercased
   *  email. Gives a volunteer's own client the roleId it needs to render a
   *  per-role "I've got it" control and to build a confirmation doc's key
   *  (`${roleId}_${emailLower}`). Same empty-email-skip, lowercased-key
   *  discipline as rolesByEmailLower. */
  roleAssignmentsByEmailLower: Record<string, { roleId: string; roleName: string }[]>
  songs: RehearseSong[]
  /** Read-only running order (Phase 127, R392) — the EXACT per-kind
   *  allowlist `buildServiceSnapshot` enforces (shared via
   *  `mapOrderedSlots`, src/utils/serviceProjection.ts), section-ordered
   *  the same way (`orderSlotsBySection`). No per-slot free-text
   *  `notes`/`body` ever reaches this array. */
  orderOfService: ServiceSlot[]
  /** "Who's Serving" (Phase 127, R392) — see {@link RehearseRoleAssignment}. */
  roleAssignments: RehearseRoleAssignment[]
  /** The v2.7 stage diagram (Phase 127, R393), note-stripped
   *  (`PublicStageMarker`, the SAME allowlist `toPublicServiceSnapshot`
   *  enforces for the public share-link path). ABSENT (never an empty
   *  array, never `undefined`) when the service has zero markers —
   *  conditional-spread at the return, mirroring
   *  `buildServiceSnapshot`'s own `stageLayout?.length` omission pattern. */
  stageLayout?: { elements: PublicStageMarker[] }
}

/** One SongSlot per distinct songId, first-occurrence order — mirrors
 *  ADR-0160's dedupe-via-Set precedent (songIdsInService in stores/services.ts). */
function distinctSongSlots(service: Service): SongSlot[] {
  const seen = new Set<string>()
  const result: SongSlot[] = []
  for (const slot of service.slots) {
    if (slot.kind !== 'SONG' || !slot.songId) continue
    if (seen.has(slot.songId)) continue
    seen.add(slot.songId)
    result.push(slot)
  }
  return result
}

/**
 * Builds the RehearseAccessDoc written at lock time (markAsPlanned). Resolves
 * "assigned" via resolveServiceRoleAssignments -> effectivePersonIds, matching
 * resolveRecipients' exact email lookup/lowercase/empty-skip logic (the "assigned
 * == who gets the reminder email" parity 125-RESEARCH.md calls for). Songs are a
 * frozen, PII-safe projection: title/keyOrArrangement + attachment id/name/kind/
 * downloadUrl/href only — no notes, no other SongAttachment/Service fields.
 */
export function buildRehearseAccess(
  service: Service,
  orgId: string,
  orgName: string | undefined,
  quarters: Quarter[],
  roles: Role[],
  people: Person[],
  songs: Song[],
): RehearseAccessDoc {
  const assignments = resolveServiceRoleAssignments(service, quarters, roles)
  const peopleById = new Map(people.map((p) => [p.id, p]))
  const assignedPersonIds = new Set<string>()
  for (const a of assignments) {
    for (const pid of a.effectivePersonIds) assignedPersonIds.add(pid)
  }

  // Lowercased, deduped, empty-email skipped — matches messagingRecipients.ts'
  // resolveRecipients empty-email skip, plus firestore.rules' `.lower()` compare.
  const assignedEmailsLower = new Set<string>()
  for (const pid of assignedPersonIds) {
    const person = peopleById.get(pid)
    if (!person || person.email === '') continue
    assignedEmailsLower.add(person.email.toLowerCase())
  }

  // rolesByEmailLower (R381) — mirrors functions/src/serviceRoles.ts's
  // roleNamesByPerson map-building loop (resolveMessageRecipients:124-144),
  // keyed by lowercased email instead of personId. Iterates assignments
  // directly (not assignedPersonIds) so each role name is attributed to the
  // correct person; empty-email persons are skipped, matching the
  // assignedEmailsLower loop above; role names are deduped via `includes`.
  // roleIdsByEmailLower / roleAssignmentsByEmailLower (Phase 133, R410/R412)
  // — built in the SAME loop, mirroring rolesByEmailLower's PII-safe,
  // empty-email-skip discipline exactly. roleIdsByEmailLower exists
  // specifically so firestore.rules can do a flat `in` check (A2
  // resolution, 133-RESEARCH.md) instead of matching a list-of-maps.
  const rolesByEmailLower: Record<string, string[]> = {}
  const roleIdsByEmailLower: Record<string, string[]> = {}
  const roleAssignmentsByEmailLower: Record<string, { roleId: string; roleName: string }[]> = {}
  for (const a of assignments) {
    for (const pid of a.effectivePersonIds) {
      const person = peopleById.get(pid)
      if (!person || person.email === '') continue
      const emailLower = person.email.toLowerCase()
      const names = (rolesByEmailLower[emailLower] ??= [])
      if (!names.includes(a.roleName)) names.push(a.roleName)

      const ids = (roleIdsByEmailLower[emailLower] ??= [])
      if (!ids.includes(a.roleId)) ids.push(a.roleId)

      const roleAssignmentsForEmail = (roleAssignmentsByEmailLower[emailLower] ??= [])
      if (!roleAssignmentsForEmail.some((r) => r.roleId === a.roleId)) {
        roleAssignmentsForEmail.push({ roleId: a.roleId, roleName: a.roleName })
      }
    }
  }

  const songsById = new Map(songs.map((s) => [s.id, s]))
  const rehearseSongs: RehearseSong[] = distinctSongSlots(service).map((slot): RehearseSong => {
    const song = songsById.get(slot.songId as string)
    if (!song) {
      // IN-02 (126-REVIEW): a slot referencing a deleted/missing catalog song
      // used to be silently filtered out, understating the song count/list a
      // volunteer sees versus what the leader actually built, with no signal
      // anywhere. Keep a visible stub (rather than dropping) so the count
      // stays accurate, and log so a leader investigating a report can find
      // the cause.
      console.warn(
        `buildRehearseAccess: song ${slot.songId} referenced by service ${service.id} is missing from the catalog — showing a stub entry`,
      )
      return {
        id: slot.songId as string,
        title: '(song removed)',
        ...(slot.songKey ? { keyOrArrangement: slot.songKey } : {}),
        // No catalog song to resolve an arrangement bpm from — null, never
        // a partial "bpm" literal downstream.
        bpm: null,
        attachments: [],
      }
    }
    // Bpm resolution (R385/R386) — mirrors buildServiceSnapshot's
    // arrangement lookup (services.ts, via the shared songStore.songs.find
    // idiom) exactly, but through the already-loaded `songsById`/`song`
    // this pure builder already has — no useSongStore, no I/O.
    const bpm = song.arrangements.find((a) => a.key === slot.songKey)?.bpm ?? song.arrangements[0]?.bpm ?? null
    return {
      id: song.id,
      title: song.title,
      ...(slot.songKey ? { keyOrArrangement: slot.songKey } : {}),
      bpm,
      attachments: (song.attachments ?? []).map((a) => ({
        id: a.id,
        name: a.name,
        kind: a.kind,
        ...(a.downloadUrl ? { downloadUrl: a.downloadUrl } : {}),
        ...(a.href ? { href: a.href } : {}),
        ...(a.linkSource ? { linkSource: a.linkSource } : {}),
      })),
    }
  })

  // orderOfService (R392) — SAME per-kind allowlist buildServiceSnapshot
  // enforces (mapOrderedSlots, src/utils/serviceProjection.ts), in the same
  // section-major running order (R112 parity) the editor/ShareView agree on.
  // Bpm is resolved via the already-loaded `songsById` map — no useSongStore,
  // keeping this builder store-free/pure.
  const orderOfService = mapOrderedSlots(orderSlotsBySection(service.slots), (s) => {
    const song = songsById.get(s.songId as string)
    return song ? (song.arrangements.find((a) => a.key === s.songKey)?.bpm ?? song.arrangements[0]?.bpm ?? null) : null
  })

  // roleAssignments (R392, "Who's Serving") — names-only via nameById,
  // mirrors buildServiceSnapshot's own roleAssignments map exactly; no
  // personId/email ever reaches this array. WR-04 (127-REVIEW): a person
  // removed from the roster after being scheduled falls back to the shared
  // REMOVED_PERSON_NAME placeholder, not their raw internal personId.
  const nameById = new Map(people.map((p) => [p.id, p.name]))
  const roleAssignments: RehearseRoleAssignment[] = assignments.map((a) => ({
    roleId: a.roleId,
    roleName: a.roleName,
    group: a.group,
    personNames: a.effectivePersonIds.map((id) => resolvePersonName(nameById, id)),
  }))

  // stageLayout (R393) — SAME PublicStageMarker allowlist (note stripped) as
  // toPublicServiceSnapshot() enforces for the public share-link path
  // (mapStageMarkers, src/utils/serviceProjection.ts). Conditional-spread at
  // the return keeps the key ABSENT (never undefined) when there are zero
  // markers, mirroring buildServiceSnapshot's own omission pattern.
  const stageLayoutElements = mapStageMarkers(service.stageLayout?.elements ?? [])

  return {
    serviceId: service.id,
    orgId,
    ...(orgName ? { orgName } : {}),
    serviceDate: service.date,
    title: service.name,
    status: service.status,
    assignedEmailsLower: [...assignedEmailsLower].sort(),
    rolesByEmailLower,
    roleIdsByEmailLower,
    roleAssignmentsByEmailLower,
    songs: rehearseSongs,
    orderOfService,
    roleAssignments,
    ...(stageLayoutElements.length > 0 ? { stageLayout: { elements: stageLayoutElements } } : {}),
  }
}
