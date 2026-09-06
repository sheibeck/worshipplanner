// Pure projection builder (Phase 125, R377) — assembles the frozen, PII-safe
// rehearseAccess doc a magic-link volunteer's Firestore read is scoped to.
// No Firestore/Pinia/store imports (types only), mirroring the same
// "pure function in utils/" convention as serviceRoles.ts/messagingRecipients.ts.
// Doc shape is authoritative per 125-01-PLAN.md and enforced by firestore.rules.

import type { Service, SongSlot } from '@/types/service'
import type { Quarter, Role, Person } from '@/types/roster'
import type { Song, SongAttachmentKind } from '@/types/song'
import { resolveServiceRoleAssignments } from '@/utils/serviceRoles'

export interface RehearseAttachment {
  id: string
  name: string
  kind: SongAttachmentKind
  downloadUrl?: string
  href?: string
}

export interface RehearseSong {
  id: string
  title: string
  keyOrArrangement?: string
  attachments: RehearseAttachment[]
}

/** organizations/{orgId}/rehearseAccess/{serviceId} — see 125-01-PLAN.md artifacts
 *  section for the authoritative schema this must match exactly. `updatedAt` is
 *  added by the store's setDoc call, not by this builder. */
export interface RehearseAccessDoc {
  serviceId: string
  orgId: string
  serviceDate: string
  title: string
  status: string
  assignedEmailsLower: string[]
  songs: RehearseSong[]
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

  const songsById = new Map(songs.map((s) => [s.id, s]))
  const rehearseSongs: RehearseSong[] = distinctSongSlots(service)
    .map((slot): RehearseSong | null => {
      const song = songsById.get(slot.songId as string)
      if (!song) return null
      return {
        id: song.id,
        title: song.title,
        ...(slot.songKey ? { keyOrArrangement: slot.songKey } : {}),
        attachments: (song.attachments ?? []).map((a) => ({
          id: a.id,
          name: a.name,
          kind: a.kind,
          ...(a.downloadUrl ? { downloadUrl: a.downloadUrl } : {}),
          ...(a.href ? { href: a.href } : {}),
        })),
      }
    })
    .filter((s): s is RehearseSong => s !== null)

  return {
    serviceId: service.id,
    orgId,
    serviceDate: service.date,
    title: service.name,
    status: service.status,
    assignedEmailsLower: [...assignedEmailsLower].sort(),
    songs: rehearseSongs,
  }
}
