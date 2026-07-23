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
import type { Service } from '@/types/service'
import type { SongSlot } from '@/types/service'

type CreateServiceInput = {
  date: string
  name: string
  teams: string[]
}

export const useServiceStore = defineStore('services', () => {
  const services = ref<Service[]>([])
  const isLoading = ref(true)
  const orgId = ref<string | null>(null)

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
    unsubscribeFn = onSnapshot(q, (snap) => {
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

  async function updateService(id: string, data: Record<string, unknown>) {
    if (!orgId.value) return
    await updateDoc(doc(db, 'organizations', orgId.value, 'services', id), {
      ...data,
      updatedAt: serverTimestamp(),
    })
  }

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
    await updateDoc(doc(db, 'organizations', orgId.value, 'services', serviceId), {
      [`roleAssignmentOverrides.${roleId}`]: personIds,
      updatedAt: serverTimestamp(),
    })
  }

  // Clears a single role's override via deleteField() on its scoped dot-path key,
  // leaving every sibling role's override entry (and the schedule) untouched.
  async function clearRoleOverride(serviceId: string, roleId: string): Promise<void> {
    if (!orgId.value) return
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
    subscribe,
    unsubscribeAll,
    createService,
    updateService,
    deleteService,
    assignSongToSlot,
    clearSongFromSlot,
    setRoleOverride,
    clearRoleOverride,
    createShareToken,
  }
})
