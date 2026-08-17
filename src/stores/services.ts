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
  getDocs,
  setDoc,
  serverTimestamp,
  query,
  orderBy,
  where,
  runTransaction,
  type Unsubscribe,
} from 'firebase/firestore'
import { db } from '@/firebase'
import { useSongStore } from '@/stores/songs'
import { useRosterStore } from '@/stores/roster'
import { useQuartersStore } from '@/stores/quarters'
import { useAuthStore } from '@/stores/auth'
import { deriveSlug, claimSlug } from '@/utils/slug'
import { resolveServiceRoleAssignments } from '@/utils/serviceRoles'
import { buildSlotsFromTemplate, buildSuggestedTemplateEntries, orderSlotsBySection } from '@/utils/slotTypes'
import { stripUndefined } from '@/utils/stripUndefined'
import { mintShareToken, pickAdoptableToken, type ShareTokenCandidate } from '@/utils/shareTokens'
import type { Service, ServiceStatus, Progression, ScriptureRef, ServiceSlot } from '@/types/service'
import type { SongSlot } from '@/types/service'
import type { RoleGroup } from '@/types/roster'

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

/**
 * The public payload shape `shareTokens/{token}` and `serviceShares/{slug}...`
 * both carry as their `serviceSnapshot` field. Everything in here is published
 * to anyone holding the URL — see the D-04/D-24 PII guard on `roleAssignments`
 * below.
 */
export interface ServiceSnapshot {
  date: string
  name: string
  progression: Progression
  teams: string[]
  slots: ServiceSlot[]
  sermonPassage: ScriptureRef | null
  notes: string
  status: ServiceStatus
  roleAssignments: {
    roleId: string
    roleName: string
    group: RoleGroup
    personNames: string[]
  }[]
}

/**
 * Extracted from the old inline `createShareToken` body (41-03) so the create
 * path and Plan 04's refresh path share exactly ONE snapshot builder — two
 * copies would drift, and one of them would be the one that leaks a raw
 * `Person`. Runs inside a store action with an active Pinia, exactly as the
 * inline code did before extraction.
 */
export function buildServiceSnapshot(service: Service): ServiceSnapshot {
  // R112 — serialize slots in the editor's section-major ordering contract, not
  // the raw persisted array, so the public share link agrees with the editor
  // (and the listing card) even for a service never normalized by a save. This
  // reorders WHAT is serialized only; it does NOT change WHEN/WHETHER the
  // snapshot is written, so the Phase 41 maybeRefreshShareLink/ensureShareLink
  // cadence is untouched. orderSlotsBySection is identity-preserving.
  const orderedSlots = orderSlotsBySection(service.slots)

  // Resolve BPM for each song slot from song store
  const songStore = useSongStore()
  const slotsWithBpm = orderedSlots.map((slot) => {
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
  }) as ServiceSlot[]

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

  return {
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
    // WR-03 (41-REVIEW): shareLinkCache is subscription-scoped state exactly
    // like everything else reset above, but was missed — clear it on org
    // switch too, so a cached token/false from the previous org's services
    // can never leak into the newly-subscribed org's resolution.
    shareLinkCache.clear()
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
    // R115 (52-01, supersedes the 2026-08-07 EMPTY override): every new service
    // starts from a template. When the church has a stored default template we
    // use it verbatim; when it is empty/unset we seed from the Suggested
    // Template (`buildSuggestedTemplateEntries()`, the 1-2-2-3-derived preset —
    // the SAME preset the template editor's "Suggested Template" button uses).
    // The empty→suggested resolution is the CALLER's decision, made here;
    // `buildSlotsFromTemplate` stays pure (`[]` → `[]`) and never reinstates a
    // fallback of its own. VW types are still applied at creation via the
    // ordinal walk inside `buildSlotsFromTemplate` when `vwModeEnabled`.
    const authStore = useAuthStore()
    const stored = authStore.settings.defaultServiceTemplate
    const effectiveTemplate = stored.length > 0 ? stored : buildSuggestedTemplateEntries()
    const slots = buildSlotsFromTemplate(
      effectiveTemplate,
      authStore.settings.vwModeEnabled,
    )
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

    // Auto-generate the share link at creation so EVERY service always has one
    // (owner request 2026-08-17): a volunteer message's {{service_link}} resolves
    // server-side from the newest shareTokens doc for the service, so without this
    // a never-"Shared" service silently emails an empty link. ensureShareLink mints
    // the opaque token + serviceShareLinks identity doc + payload; from here on
    // maybeRefreshShareLink keeps it current on every edit. Soft-fail (mirrors the
    // Phase 41 share writes): a share problem must never fail the user's create.
    try {
      const created: Service = {
        ...(data as object),
        id: ref.id,
        progression: '1-2-2-3',
        slots,
        status: 'draft',
        notes: '',
        sermonPassage: null,
        sermonTopic: '',
      } as Service
      await ensureShareLink(created, orgId.value)
    } catch (err) {
      console.error('createService: auto share-link generation failed (non-blocking)', err)
    }

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
    // R111 (51-03): a "No Section" move sets slot.section = undefined, which
    // rides through onSave into this payload. Firestore rejects raw `undefined`
    // at any depth ("Unsupported field value: undefined"), so strip the plain
    // payload here — the single funnel every live-plan write path uses. Add the
    // serverTimestamp() FieldValue sentinel AFTER stripping (stripUndefined's
    // contract). assertWritable ran on the ORIGINAL data above, so the lock
    // contract is unchanged.
    await updateDoc(doc(db, 'organizations', orgId.value, 'services', id), {
      ...stripUndefined(data),
      updatedAt: serverTimestamp(),
    })
    // R077 (41-04) — keep a previously-shared service's public payload
    // current without a second Share press. The refresh hook is defined
    // further down this file, below ensureShareLink.
    await maybeRefreshShareLink(id, data as Partial<Service>)
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
    // WR-03 (41-REVIEW): drop the deleted service's shareLinkCache entry so
    // it cannot accumulate as a dead entry, and so a same-session, same-org
    // serviceId reuse (however unlikely with Firestore's random doc ids)
    // never resolves against a stale cached token/false for a service that
    // no longer exists.
    shareLinkCache.delete(id)
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
    // R077 (41-04) — the Roles tab bypasses updateService's funnel entirely,
    // so it carries its own refresh hook. The next override map is built
    // locally (mirroring the scoped dot-path write above) because the
    // refresh hook's overrides argument must be a real JS object, not a
    // Firestore dot-path key.
    const service = services.value.find((s) => s.id === serviceId)
    const nextOverrides = { ...(service?.roleAssignmentOverrides ?? {}), [roleId]: personIds }
    await maybeRefreshShareLink(serviceId, { roleAssignmentOverrides: nextOverrides })
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
    // R077 (41-04) — same reasoning as setRoleOverride above. `deleteField()`
    // is a Firestore wire sentinel, not a JS deletion: the key must be
    // GENUINELY removed from the merged map here, or
    // resolveServiceRoleAssignments would treat the sentinel string as a
    // present override instead of falling back to the schedule.
    const service = services.value.find((s) => s.id === serviceId)
    const nextOverrides = { ...(service?.roleAssignmentOverrides ?? {}) }
    delete nextOverrides[roleId]
    await maybeRefreshShareLink(serviceId, { roleAssignmentOverrides: nextOverrides })
  }

  // Scoped dot-path write — writes ONLY the changed messaging.<key> leaves,
  // never the whole `messaging` map, mirroring setRoleOverride/
  // clearRoleOverride's roleAssignmentOverrides.${roleId} idiom immediately
  // above (D-01 precedent). A `null` leaf means "inherit the org-level
  // OrgSettings.messaging default" (Service.messaging?'s documented
  // contract in src/types/service.ts). Deliberately NOT hooked into
  // maybeRefreshShareLink — messaging overrides are an admin-only per-
  // service setting, never rendered into buildServiceSnapshot's public
  // ShareView payload, so there is nothing to refresh.
  async function setServiceMessagingDefaults(
    serviceId: string,
    patch: Partial<{
      lockNotifyEnabled: boolean | null
      reminderEnabled: boolean | null
      reminderDaysBefore: number | null
    }>,
  ): Promise<void> {
    if (!orgId.value) return
    // ★ R036 — this action does NOT go through updateService. It carries its
    // own updateDoc, so without its own guard the store layer would not
    // cover it at all. The scoped dot-path surfaces in affectedKeys() as the
    // top-level `messaging`, which appears in no rules carve-out, so the
    // server denies it on a locked service — this makes that refusal local
    // and legible (58-PATTERNS.md).
    const stored = storedStatusOf(serviceId)
    if (stored !== 'draft') {
      throw new ServiceLockedError(serviceId, stored, 'set messaging defaults on')
    }
    const updates: Record<string, unknown> = { updatedAt: serverTimestamp() }
    for (const [key, value] of Object.entries(patch)) {
      updates[`messaging.${key}`] = value
    }
    await updateDoc(doc(db, 'organizations', orgId.value, 'services', serviceId), updates)
    // Mirror the applied patch into the local services.value entry, same
    // pattern as setRoleOverride's local mirror above — so a read-only
    // summary line or a follow-up select reflects the write immediately,
    // without waiting on the onSnapshot round trip (the mocked firestore
    // module in the unit suite never fires onSnapshot at all).
    const service = services.value.find((s) => s.id === serviceId)
    if (service) {
      service.messaging = {
        lockNotifyEnabled: null,
        reminderEnabled: null,
        reminderDaysBefore: null,
        reminderSentAt: null,
        ...service.messaging,
        ...patch,
      }
    }
  }

  // R076/R078 (41-03) — resolved once per Pinia instance, so a fresh store
  // (and so each test) gets a fresh cache. A stored string is the resolved
  // token for that service; `false` means "known to have no share link this
  // session" — Plan 04's refresh hook reads this to skip both the write and
  // the read for a never-shared service, so an ordinary autosave costs
  // nothing after the first lookup. Declared here (not module scope) so it
  // cannot leak across Pinia instances/tests.
  const shareLinkCache = new Map<string, string | false>()

  /**
   * The `shareTokens/{token}` payload write plus the soft-fail memorable-URL
   * `serviceShares/{slug}__service-{date}` write. Runs on EVERY
   * `ensureShareLink` path, including adoption, so a link already emailed to
   * a congregation starts showing current data immediately rather than
   * waiting for the next edit.
   *
   * This is an unconditional full-document `setDoc`, not a partial update —
   * deliberately. That makes the write idempotent and self-healing (a token
   * document that was deleted is recreated rather than silently failing).
   * `shareTokens` is a payload surface, not the authoritative creation
   * record — that lives on `serviceShareLinks/{serviceId}` — so re-stamping
   * `createdAt` here is harmless and keeps the live token sorting first if
   * adoption ever runs again.
   *
   * The token is used VERBATIM as the document id: no case-folding, no
   * whitespace trimming, no Unicode normalization. `ShareView.vue` resolves
   * `/share/:token` by using the route parameter verbatim as the document
   * id, and any asymmetry here breaks every adopted mixed-case legacy token.
   */
  async function writeSharePayload(service: Service, orgIdValue: string, token: string): Promise<void> {
    const serviceSnapshot = buildServiceSnapshot(service)

    await setDoc(doc(db, 'shareTokens', token), {
      serviceId: service.id,
      orgId: orgIdValue,
      serviceSnapshot,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
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
        'writeSharePayload: memorable-URL slug/serviceShares write failed — the opaque share link above already succeeded',
        err,
      )
    }
  }

  /**
   * R076/R078 — resolves THE one stable token for a service: reading the
   * `serviceShareLinks/{serviceId}` identity doc if it exists, else adopting
   * the most recent compatible already-circulated `shareTokens` document, else
   * minting a fresh one — then always writing the current payload in place.
   *
   * `createShareToken` is a thin wrapper around this; both are exposed on the
   * store so a future caller can distinguish "resolve the link" from "share
   * and get the token", though today they're the same operation.
   */
  async function ensureShareLink(service: Service, orgIdValue: string): Promise<string> {
    const linkRef = doc(db, 'serviceShareLinks', service.id)

    // 1. Steady-state path: the link already exists. This is why repeat
    //    shares return the same string, and it is the ordinary case after
    //    the first share.
    const existingLinkSnap = await getDoc(linkRef)
    if (existingLinkSnap.exists()) {
      const token = existingLinkSnap.data().token as string
      await writeSharePayload(service, orgIdValue, token)
      shareLinkCache.set(service.id, token)
      return token
    }

    // 2. No link doc yet — adopt an already-circulated token if one exists
    //    for this service, else mint a fresh one. Equality filter ONLY: no
    //    orderBy, no limit. Ordering is pickAdoptableToken's job (client-side)
    //    and a server-side sort here would need a composite index this
    //    project's firestore.indexes.json does not declare, and the emulator
    //    would not catch the gap — it would only surface in production, on
    //    exactly the multi-token services this adoption path exists to
    //    rescue.
    const adoptionQuery = query(collection(db, 'shareTokens'), where('serviceId', '==', service.id))
    const candidatesSnap = await getDocs(adoptionQuery)
    const candidates: ShareTokenCandidate[] = candidatesSnap.docs.map((d) => ({
      id: d.id,
      orgId: d.data().orgId,
      createdAt: d.data().createdAt,
    }))
    const adopted = pickAdoptableToken(candidates, orgIdValue)
    const candidateToken = adopted ?? mintShareToken()

    // 3. Persist the link through a transaction, not a bare setDoc. Re-read
    //    the link ref INSIDE the transaction: if another client's first-share
    //    of the same never-shared service landed between step 1's read and
    //    this transaction, the loser here adopts the winner's already-recorded
    //    token and never writes its own locally-minted/adopted value to the
    //    index at all — that's what makes two concurrent first-shares of the
    //    same service converge on one token instead of racing to overwrite
    //    each other's index entry.
    const token = await runTransaction(db, async (tx) => {
      const txLinkSnap = await tx.get(linkRef)
      if (txLinkSnap.exists()) {
        return txLinkSnap.data().token as string
      }
      tx.set(linkRef, {
        token: candidateToken,
        orgId: orgIdValue,
        serviceId: service.id,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
      return candidateToken
    })

    // 4. Write the current payload in place on EVERY path, including
    //    adoption, so an already-circulated link starts showing current data
    //    immediately.
    await writeSharePayload(service, orgIdValue, token)

    // 5. Cache and return.
    shareLinkCache.set(service.id, token)
    return token
  }

  /**
   * Thin delegating wrapper. The name and the two-argument signature are
   * preserved verbatim because `ServiceEditorView.vue:3509` and
   * `ServiceCard.vue:209` call `createShareToken(service, orgId)` and must
   * not change — if a caller ever needed to change, the wrapper signature
   * would be wrong, not the caller.
   */
  async function createShareToken(service: Service, orgIdValue: string): Promise<string> {
    return ensureShareLink(service, orgIdValue)
  }

  /**
   * R077 (41-04) — keeps a previously-shared service's public payload
   * current after ANY of the three write paths below, without a second
   * Share press. Hooked into exactly three write paths and no others:
   *
   *   - `updateService` (also covers `assignSongToSlot`, `clearSongFromSlot`,
   *     the editor's autosave and slot reorder — all route through it)
   *   - `setRoleOverride`
   *   - `clearRoleOverride`
   *
   * Deliberately NOT hooked: `markAsPlanned` and `reopenService` are
   * status-only writes and `ShareView.vue` never renders `status`;
   * `deleteService` uses `deleteDoc` and is not a refresh trigger.
   * `createService` now generates the link at creation via `ensureShareLink`
   * (so every service always has one); subsequent edits refresh through here.
   *
   * Loop safety (T-41-02): the store's only `onSnapshot` subscribes to
   * `organizations/{orgId}/services` (see `subscribe()` above). Nothing
   * subscribes to `shareTokens` or `serviceShareLinks`, so a write to either
   * has no path back into the editor's remote-merge watcher or autosave —
   * PROVIDED this function itself never writes to `services/{docId}`, which
   * it does not: it calls `writeSharePayload` only, never `updateDoc`/`setDoc`
   * against a services path.
   *
   * Never rejects — the whole body is one try/catch (WR-06 soft-fail,
   * mirroring `writeSharePayload`'s memorable-URL catch above). A share
   * problem must never fail the user's save.
   */
  async function maybeRefreshShareLink(id: string, overrides: Partial<Service> = {}): Promise<void> {
    try {
      if (!orgId.value) return
      const localService = services.value.find((s) => s.id === id)
      if (!localService) return

      const cached = shareLinkCache.get(id)
      if (cached === false) return // known unshared this session — skip both the write and the read

      let token: string
      if (typeof cached === 'string' && cached.length > 0) {
        token = cached
      } else {
        const linkSnap = await getDoc(doc(db, 'serviceShareLinks', id))
        const linkToken = linkSnap.exists() ? (linkSnap.data().token as string | undefined) : undefined
        if (!linkSnap.exists() || !linkToken) {
          shareLinkCache.set(id, false)
          return
        }
        token = linkToken
        shareLinkCache.set(id, token)
      }

      // `overrides` merged over the LOCAL pre-write state: at the moment this
      // hook runs, `services.value` still holds the pre-write snapshot.
      // Firestore's latency compensation usually closes that window in
      // production, but the unit suite's mocked `firebase/firestore` never
      // fires `onSnapshot` at all — without this explicit merge, every
      // "the payload reflects the new value" assertion would read stale
      // state and pass even if the refresh had done nothing.
      const effectiveService: Service = { ...localService, ...overrides }
      // Call writeSharePayload, NEVER ensureShareLink — the refresh path
      // must be structurally incapable of taking the adopt-or-create branch,
      // or an ordinary edit to a never-shared service would publish it.
      await writeSharePayload(effectiveService, orgId.value, token)
    } catch (err) {
      // WR-02 (41-REVIEW): only a genuine `permission-denied` is treated as
      // permanent-for-session. Before this distinction, ANY error — including
      // a transient network blip or a brief rules-propagation delay —
      // permanently disabled refresh for the service for the rest of the
      // Pinia instance's lifetime, silently drifting an already-public
      // service out of sync with no way to recover short of a page reload.
      // Caching `false` on permission-denied specifically is still
      // deliberate: before the owner deploys Plan 01's rules, every attempt
      // is denied, and retrying on every keystroke would flood the console
      // for no benefit. Any other error code (or no code at all — e.g. a
      // plain network Error) leaves the cache untouched, so the very next
      // edit gets a fresh attempt instead of being silently skipped forever.
      const code = (err as { code?: string } | undefined)?.code
      const isPermanent = code === 'permission-denied'
      console.error(
        `services.ts share-link auto-refresh: failed for service ${id} — the user's own save already succeeded; ` +
          (isPermanent
            ? 'disabling share refresh for this service for the remainder of the session (permission denied)'
            : 'this looks transient — refresh will be retried on the next edit'),
        err,
      )
      if (isPermanent) {
        shareLinkCache.set(id, false)
      }
    }
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
    setServiceMessagingDefaults,
    createShareToken,
    ensureShareLink,
  }
})
