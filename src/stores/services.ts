import { ref } from 'vue'
import { defineStore } from 'pinia'
import {
  collection,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
  query,
  orderBy,
  type Unsubscribe,
} from 'firebase/firestore'
import { db } from '@/firebase'
import { useSongStore } from '@/stores/songs'
import { useRosterStore } from '@/stores/roster'
import { useQuartersStore } from '@/stores/quarters'
import { deriveSlug, claimSlug } from '@/utils/slug'
import { resolveServiceRoleAssignments } from '@/utils/serviceRoles'
import { buildSlots } from '@/utils/slotTypes'
import type { Service, ServiceStatus } from '@/types/service'
import type { SongSlot } from '@/types/service'

type CreateServiceInput = {
  date: string
  name: string
  teams: string[]
}

/**
 * R036 — thrown by the store's draft-only write guard (enforcement layer 2 of 3).
 *
 * The guard is defence-in-depth, NOT the primary enforcement: the Firestore rule
 * added in 31-01 is what actually stops a determined client. This exists so a
 * client-side bug — a control that should have been removed when the service
 * locked, or a handler that forgot its early return — surfaces as a named local
 * error naming R036 and the stored status, instead of an opaque
 * `FirebaseError: Missing or insufficient permissions` from a round trip.
 *
 * It THROWS rather than silently returning (`createService`'s precedent, not
 * `updateService`'s `if (!orgId.value) return`) deliberately. A swallowed write
 * is indistinguishable from a successful one to the caller, which is precisely
 * the "it didn't save" defect class this milestone exists to close. Note this is
 * not a new failure mode for any caller: since 31-01 these same writes already
 * rejected at the rules layer — the guard only makes the rejection immediate and
 * legible.
 */
export class ServiceLockedError extends Error {
  readonly serviceId: string
  readonly storedStatus: ServiceStatus

  constructor(serviceId: string, storedStatus: ServiceStatus, action: string) {
    super(
      `R036: refusing to ${action} service ${serviceId} — its stored status is ` +
        `"${storedStatus}", not "draft". Reopen it for editing first.`,
    )
    this.name = 'ServiceLockedError'
    this.serviceId = serviceId
    this.storedStatus = storedStatus
  }
}

export const useServiceStore = defineStore('services', () => {
  const services = ref<Service[]>([])
  const isLoading = ref(true)
  const orgId = ref<string | null>(null)

  // R039 (32-01) — own-write echo classification. `ownWriteEchoIds` is the
  // public signal (a service id in this array means "the most recent
  // snapshot for this document is this client's own write settling, not a
  // genuinely external change"); `pendingWriteIds` is private closure state
  // remembering which ids were mid-flight as of the PREVIOUS snapshot, so
  // the settle edge (pending -> not-pending) can be detected across two
  // consecutive emissions rather than read off a single one.
  const ownWriteEchoIds = ref<string[]>([])
  let pendingWriteIds: string[] = []

  let unsubscribeFn: Unsubscribe | null = null

  function subscribe(orgIdValue: string) {
    if (unsubscribeFn) {
      unsubscribeFn()
    }
    orgId.value = orgIdValue
    const q = query(
      collection(db, 'organizations', orgIdValue, 'services'),
      orderBy('date', 'desc'),
    )
    // The metadata-changes option below is what makes BOTH edges of
    // `hasPendingWrites` observable: without it, the metadata-only emission
    // marking a pending write as settled never reaches this callback at all.
    unsubscribeFn = onSnapshot(q, { includeMetadataChanges: true }, (snap) => {
      // Optional chaining on `d.metadata` is deliberate: a doc without
      // metadata (every pre-32-01 test fixture) must classify as
      // not-pending rather than throw.
      const nowPending = snap.docs
        .filter((d) => d.metadata?.hasPendingWrites === true)
        .map((d) => d.id)
      // The settle edge — a doc that WAS pending as of the previous
      // emission and is no longer pending now — is the server-ack snapshot
      // whose resolved `serverTimestamp()` value is what defeats a naive
      // updatedAt diff. Both edges must classify as an echo, or only half
      // the R039 window closes.
      const justSettled = pendingWriteIds.filter((id) => !nowPending.includes(id))
      ownWriteEchoIds.value = [...nowPending, ...justSettled]
      pendingWriteIds = nowPending

      services.value = snap.docs.map((d) => {
        const data = d.data()
        return { id: d.id, name: '', notes: '', ...data } as Service
      })
      isLoading.value = false
    })
  }

  function unsubscribeAll() {
    unsubscribeFn?.()
    unsubscribeFn = null
    orgId.value = null
    services.value = []
    isLoading.value = true
    ownWriteEchoIds.value = []
    pendingWriteIds = []
  }

  /** R039 — true when `serviceId`'s most recent snapshot is this client's
   *  own write settling (optimistic OR server-ack edge), never a
   *  field-by-field diff. Firestore's `metadata.hasPendingWrites` is local
   *  SDK state a remote writer cannot set, so this cannot be spoofed by a
   *  genuinely external change (T-32-02). */
  function isOwnWriteEcho(serviceId: string): boolean {
    return ownWriteEchoIds.value.includes(serviceId)
  }

  async function createService(data: CreateServiceInput): Promise<string> {
    if (!orgId.value) throw new Error('No orgId set — call subscribe() first')
    const slots = buildSlots('1-2-2-3')
    const ref = await addDoc(collection(db, 'organizations', orgId.value, 'services'), {
      ...data,
      progression: '1-2-2-3',
      slots,
      status: 'draft',
      notes: '',
      sermonPassage: null,
      sermonTopic: '',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
    return ref.id
  }

  // ── R036 draft-only write guard ──────────────────────────────────────────────
  //
  // The three shapes below mirror `firestore.rules`' `/services` `allow update`
  // clause one-for-one. They deliberately do NOT invent a fourth policy: any
  // divergence would either refuse a write the server accepts (a phantom lock)
  // or wave through one the server denies (an opaque round-trip failure).
  //
  //   rule 1  storedStatus() == 'draft'                       → ordinary editing
  //   rule 2  planned → exported carrying export evidence     → D-09
  //   rule 3  → draft, touching only status                   → R037 reopen
  //
  // `updateService` appends `updatedAt` itself, so the caller-supplied key sets
  // checked here are the rules' `affectedKeys()` minus `updatedAt`.

  /** The status as STORED, from the live snapshot — never an incoming value.
   *  `?? 'draft'` matches the rule's own `resource.data.get('status','draft')`
   *  so legacy documents with no status field agree across both layers. */
  function storedStatusOf(id: string): ServiceStatus {
    return services.value.find((s) => s.id === id)?.status ?? 'draft'
  }

  // D-09 — the Planning Center export write, the one mutation that must survive
  // the lock or `exported` becomes unreachable and the primary workflow breaks.
  // ★ Do not "simplify" this carve-out away.
  const EXPORT_WRITE_KEYS = ['status', 'pcExportedAt', 'pcPlanId']
  function isExportWrite(data: Record<string, unknown>): boolean {
    const keys = Object.keys(data)
    return (
      data.status === 'exported' &&
      keys.includes('pcExportedAt') &&
      keys.every((k) => EXPORT_WRITE_KEYS.includes(k))
    )
  }

  // R037 — the reopen write. `status` alone: anything else riding along is the
  // smuggled-edit case the rule's `hasOnly(['status','updatedAt'])` rejects.
  function isReopenWrite(data: Record<string, unknown>): boolean {
    const keys = Object.keys(data)
    return data.status === 'draft' && keys.length === 1 && keys[0] === 'status'
  }

  function assertWritable(id: string, data: Record<string, unknown>): void {
    const stored = storedStatusOf(id)
    if (stored === 'draft') return
    if (stored === 'planned' && isExportWrite(data)) return
    if (isReopenWrite(data)) return
    throw new ServiceLockedError(id, stored, 'update')
  }

  async function updateService(id: string, data: Record<string, unknown>) {
    if (!orgId.value) return
    assertWritable(id, data)
    await updateDoc(doc(db, 'organizations', orgId.value, 'services', id), {
      ...data,
      updatedAt: serverTimestamp(),
    })
  }

  // ── R037 status transitions ──────────────────────────────────────────────────
  //
  // D-02: explicit, named actions — one per legal transition — replacing the
  // deleted `toggleStatus` cycle. There is deliberately NO generic status
  // setter: a `setStatus(id, s)` would re-admit hand-setting `exported` without
  // an export, which is exactly the defect D-03 closes. `exported` is reachable
  // ONLY through the export write above.
  //
  // Both throw on refusal. The caller must AWAIT them and only then reflect the
  // new status in the UI — a status that flips before the write lands is the
  // "it didn't save" defect class this milestone exists to close.

  async function markAsPlanned(id: string): Promise<void> {
    if (!orgId.value) throw new Error('No orgId set — call subscribe() first')
    const stored = storedStatusOf(id)
    if (stored !== 'draft') throw new ServiceLockedError(id, stored, 'mark as planned')
    await updateDoc(doc(db, 'organizations', orgId.value, 'services', id), {
      status: 'planned',
      updatedAt: serverTimestamp(),
    })
  }

  /**
   * R037 — reopen a locked service for editing.
   *
   * ★ The payload is `status` + `updatedAt` and NOTHING ELSE. The rule's
   * `keys().hasOnly(['status','updatedAt'])` reads `affectedKeys()`, so adding
   * `pcExportedAt`/`pcPlanId` here — even to re-write their existing values —
   * can surface in that diff and get the whole write denied. D-11 keeps both
   * fields precisely by NOT touching them: the Planning Center plan stays
   * linked, so a re-export updates it instead of creating a duplicate, and
   * D-04's evidence gate still fires on a second reopen.
   */
  async function reopenService(id: string): Promise<void> {
    if (!orgId.value) throw new Error('No orgId set — call subscribe() first')
    await updateDoc(doc(db, 'organizations', orgId.value, 'services', id), {
      status: 'draft',
      updatedAt: serverTimestamp(),
    })
  }

  // D-15: deliberately NOT guarded. Delete stays available at every status —
  // the UI warns about an orphaned Planning Center plan instead of locking.
  // `firestore.rules`' `allow delete` carries no status condition for the same
  // reason; keep the two in step.
  async function deleteService(id: string) {
    if (!orgId.value) return
    await deleteDoc(doc(db, 'organizations', orgId.value, 'services', id))
  }

  async function assignSongToSlot(
    serviceId: string,
    slotIndex: number,
    song: { id: string; title: string; key: string },
  ) {
    const service = services.value.find((s) => s.id === serviceId)
    if (!service) return

    const updatedSlots = service.slots.map((slot, idx) => {
      if (idx === slotIndex && slot.kind === 'SONG') {
        return {
          ...slot,
          songId: song.id,
          songTitle: song.title,
          songKey: song.key,
        }
      }
      return slot
    })

    await updateService(serviceId, { slots: updatedSlots })

    // Cross-store write: update lastUsedAt on the song document
    const songStore = useSongStore()
    await songStore.updateSong(song.id, { lastUsedAt: serverTimestamp() as never })
  }

  async function clearSongFromSlot(serviceId: string, slotIndex: number) {
    const service = services.value.find((s) => s.id === serviceId)
    if (!service) return

    const updatedSlots = service.slots.map((slot, idx) => {
      if (idx === slotIndex && slot.kind === 'SONG') {
        return {
          ...slot,
          songId: null,
          songTitle: null,
          songKey: null,
        }
      }
      return slot
    })

    await updateService(serviceId, { slots: updatedSlots })
  }

  // Scoped dot-path write — writes ONLY the single roleId's key within
  // roleAssignmentOverrides, never the whole map, mirroring
  // quarters.ts::assignPerson's `calendar.${date}.${roleId}` pattern (D-01). This
  // prevents two editors concurrently overriding different roles on the same
  // service from clobbering each other (T-17-03-02 / STATE.md T-13-09-02
  // precedent). The Quarter/schedule itself is never touched by this write.
  async function setRoleOverride(
    serviceId: string,
    roleId: string,
    personIds: string[],
  ): Promise<void> {
    if (!orgId.value) return
    // ★ R036 — the Roles tab does NOT go through updateService. These two
    // actions carry their own updateDoc, so without their own guard the store
    // layer would not cover the Roles tab at all. The scoped dot-path surfaces
    // in affectedKeys() as the top-level `roleAssignmentOverrides`, which
    // appears in neither rules carve-out, so the server denies it on a locked
    // service — this makes that refusal local and legible.
    const stored = storedStatusOf(serviceId)
    if (stored !== 'draft') {
      throw new ServiceLockedError(serviceId, stored, 'set a role override on')
    }
    await updateDoc(doc(db, 'organizations', orgId.value, 'services', serviceId), {
      [`roleAssignmentOverrides.${roleId}`]: personIds,
      updatedAt: serverTimestamp(),
    })
  }

  // Clears a single role's override via deleteField() on its scoped dot-path key,
  // leaving every sibling role's override entry (and the schedule) untouched.
  async function clearRoleOverride(serviceId: string, roleId: string): Promise<void> {
    if (!orgId.value) return
    // R036 — same reasoning as setRoleOverride above.
    const stored = storedStatusOf(serviceId)
    if (stored !== 'draft') {
      throw new ServiceLockedError(serviceId, stored, 'clear a role override on')
    }
    await updateDoc(doc(db, 'organizations', orgId.value, 'services', serviceId), {
      [`roleAssignmentOverrides.${roleId}`]: deleteField(),
      updatedAt: serverTimestamp(),
    })
  }

  async function createShareToken(service: Service, orgIdValue: string): Promise<string> {
    // Generate cryptographically random 36-char hex token
    const array = new Uint8Array(18)
    crypto.getRandomValues(array)
    const token = Array.from(array, (b) => b.toString(16).padStart(2, '0')).join('')

    // Resolve BPM for each song slot from song store
    const songStore = useSongStore()
    const slotsWithBpm = service.slots.map((slot) => {
      if (slot.kind === 'SONG' && (slot as SongSlot).songId) {
        const songSlot = slot as SongSlot
        const song = songStore.songs.find((s) => s.id === songSlot.songId)
        let bpm: number | null = null
        if (song) {
          const matchingArr = song.arrangements.find((a) => a.key === songSlot.songKey)
          bpm = matchingArr?.bpm ?? song.arrangements[0]?.bpm ?? null
        }
        return { ...slot, bpm }
      }
      return slot
    })

    // Who's-serving snapshot (D-04/D-24 PII guard): resolve personId -> name via a
    // Map ONLY — never embed the raw Person object (no email/phone/pcPersonId).
    // Mirrors quarters.ts::finalizeAndShare's nameById pattern exactly.
    const rosterStore = useRosterStore()
    const quartersStore = useQuartersStore()
    const nameById = new Map(rosterStore.people.map((p) => [p.id, p.name]))
    const resolved = resolveServiceRoleAssignments(service, quartersStore.quarters, rosterStore.roles)
    const roleAssignments = resolved.map((r) => ({
      roleId: r.roleId,
      roleName: r.roleName,
      group: r.group,
      personNames: r.effectivePersonIds.map((id) => nameById.get(id) ?? id),
    }))

    const serviceSnapshot = {
      date: service.date,
      name: service.name,
      progression: service.progression,
      teams: service.teams,
      slots: slotsWithBpm,
      sermonPassage: service.sermonPassage,
      notes: service.notes,
      status: service.status,
      roleAssignments,
    }

    await setDoc(doc(db, 'shareTokens', token), {
      serviceId: service.id,
      orgId: orgIdValue,
      serviceSnapshot,
      createdAt: serverTimestamp(),
    })

    // R-02/D-18: memorable-URL secondary write, mirroring
    // quarters.ts::finalizeAndShare exactly — resolve (or claim, on first share)
    // the org's slug, then overwrite serviceShares/{slug}__service-{date} in
    // place. WR-06: the opaque shareTokens doc above has already succeeded, so
    // this whole step is soft-fail — any error here is logged and swallowed, the
    // token is still returned (T-17-03-03).
    try {
      const orgRef = doc(db, 'organizations', orgIdValue)
      const orgSnap = await getDoc(orgRef)
      const orgData = orgSnap.exists() ? orgSnap.data() : {}
      let slug = orgData.slug as string | undefined
      if (!slug) {
        const derived = deriveSlug((orgData.name as string | undefined) ?? '')
        const base = derived || 'org'
        slug = await claimSlug(base, orgIdValue)
        await updateDoc(orgRef, { slug })
      }

      await setDoc(doc(db, 'serviceShares', `${slug}__service-${service.date}`), {
        orgId: orgIdValue,
        orgSlug: slug,
        serviceSnapshot,
        token,
        updatedAt: serverTimestamp(),
      })
    } catch (err) {
      console.error(
        'createShareToken: memorable-URL slug/serviceShares write failed — the opaque share link above already succeeded',
        err,
      )
    }

    return token
  }

  return {
    services,
    isLoading,
    orgId,
    ownWriteEchoIds,
    isOwnWriteEcho,
    subscribe,
    unsubscribeAll,
    createService,
    updateService,
    markAsPlanned,
    reopenService,
    deleteService,
    assignSongToSlot,
    clearSongFromSlot,
    setRoleOverride,
    clearRoleOverride,
    createShareToken,
  }
})
