import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import {
  collection,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  deleteField,
  doc,
  getDocs,
  getDoc,
  serverTimestamp,
  query,
  orderBy,
  type Unsubscribe,
} from 'firebase/firestore'
import { ref as storageRef, deleteObject } from 'firebase/storage'
import { db, storage } from '@/firebase'
import { todayYmd } from '@/utils/myScheduleGrouping'
import type { Vamp, VampAttachment, UpsertVampInput, VampAssignmentScan } from '@/types/vamp'
import type { SlideGroup } from '@/types/slideGroup'
import type { Service } from '@/types/service'

/** R435/R436 — org-scoped Vamps library store. Narrowed mirror of
 * songs.ts: no legacy-field normalization, no tag/VW-type/import machinery,
 * and a single-slot attachment write (no arrayUnion) — see 140-PATTERNS.md. */
export const useVampStore = defineStore('vamps', () => {
  const vamps = ref<Vamp[]>([])
  const isLoading = ref(true)
  const orgId = ref<string | null>(null)
  const searchQuery = ref('')

  let unsubscribeFn: Unsubscribe | null = null

  function subscribe(orgIdValue: string) {
    if (unsubscribeFn) {
      unsubscribeFn()
    }
    orgId.value = orgIdValue
    const q = query(
      collection(db, 'organizations', orgIdValue, 'vamps'),
      orderBy('name'),
    )
    unsubscribeFn = onSnapshot(q, (snap) => {
      vamps.value = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Vamp)
      isLoading.value = false
    })
  }

  function unsubscribeAll() {
    unsubscribeFn?.()
    unsubscribeFn = null
    orgId.value = null
    vamps.value = []
    isLoading.value = true
  }

  // Firestore rejects `undefined` field values (no ignoreUndefinedProperties),
  // and the editor sends `tempo: undefined` for a blank optional BPM.
  function withoutUndefined<T extends object>(data: T): Partial<T> {
    return Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined)) as Partial<T>
  }

  async function addVamp(data: UpsertVampInput): Promise<string | undefined> {
    if (!orgId.value) return undefined
    const docRef = await addDoc(collection(db, 'organizations', orgId.value, 'vamps'), {
      ...withoutUndefined(data),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
    return docRef.id
  }

  // An explicit `undefined` on update means "clear it" → deleteField(); an
  // absent key means "leave it alone".
  async function updateVamp(id: string, data: Partial<UpsertVampInput>) {
    if (!orgId.value) return
    const payload = Object.fromEntries(
      Object.entries(data).map(([k, v]) => [k, v === undefined ? deleteField() : v]),
    )
    await updateDoc(doc(db, 'organizations', orgId.value, 'vamps', id), {
      ...payload,
      updatedAt: serverTimestamp(),
    })
  }

  // Single-slot write. The superseded Storage object is deleted best-effort
  // AFTER the doc write (logged, never blocking) — mirrors removeSongAttachment.
  async function setAttachment(id: string, attachment: VampAttachment | null) {
    if (!orgId.value) return
    const previousPath = vamps.value.find((v) => v.id === id)?.attachment?.storagePath
    await updateVamp(id, { attachment })
    if (previousPath && previousPath !== attachment?.storagePath) {
      try {
        await deleteObject(storageRef(storage, previousPath))
      } catch (err) {
        console.error(`setAttachment: failed to delete Storage object ${previousPath}:`, err)
      }
    }
  }

  function removeAttachment(id: string) {
    return setAttachment(id, null)
  }

  // R440 — mirrors services.ts resyncRehearseAccessForSong: best-effort,
  // advisory, never blocks the delete. One scan, two derived values (never
  // conflate the upcoming-only count with the any-assignment keep decision).
  async function countAssignments(vampId: string): Promise<VampAssignmentScan | null> {
    const org = orgId.value
    if (!org) return null
    try {
      const groupsSnap = await getDocs(collection(db, 'organizations', org, 'slideGroups'))
      const serviceIds = new Set<string>()
      for (const d of groupsSnap.docs) {
        const data = d.data() as SlideGroup
        if (
          (data.bedVampId === vampId || data.slides?.some((e) => e.vampId === vampId)) &&
          data.serviceId
        ) {
          serviceIds.add(data.serviceId)
        }
      }
      if (serviceIds.size === 0) return { assignedAnywhere: false, upcomingServiceCount: 0 }
      const today = todayYmd()
      const snaps = await Promise.all(
        [...serviceIds].map((sid) => getDoc(doc(db, 'organizations', org, 'services', sid))),
      )
      const upcomingServiceCount = snaps.filter(
        (s) => s.exists() && ((s.data() as Service).date ?? '') >= today,
      ).length
      return { assignedAnywhere: true, upcomingServiceCount }
    } catch (err) {
      console.error('countAssignments: scan failed:', err)
      return null
    }
  }

  // Single-step hard delete (locked decision — no soft-delete/restore). The
  // Storage cascade is best-effort: a failed deleteObject is logged and
  // never aborts the doc delete, mirroring hardDeleteSong's convention.
  async function deleteVamp(id: string) {
    if (!orgId.value) return
    const vamp = vamps.value.find((v) => v.id === id)
    // R440 — assigned slides keep their denormalized audioUrl, so the object
    // must outlive the doc; a failed scan keeps it too (fail-safe).
    const scan = await countAssignments(id)
    const keepAttachment = scan === null || scan.assignedAnywhere
    if (!keepAttachment && vamp?.attachment?.storagePath) {
      try {
        await deleteObject(storageRef(storage, vamp.attachment.storagePath))
      } catch (err) {
        console.error(`deleteVamp: failed to delete attachment ${vamp.attachment.storagePath}:`, err)
      }
    }
    await deleteDoc(doc(db, 'organizations', orgId.value, 'vamps', id))
  }

  const filteredVamps = computed(() => {
    const q = searchQuery.value.trim().toLowerCase()
    if (!q) return vamps.value
    return vamps.value.filter(
      (v) => v.name.toLowerCase().includes(q) || v.key.toLowerCase().includes(q),
    )
  })

  return {
    vamps,
    isLoading,
    orgId,
    searchQuery,
    filteredVamps,
    subscribe,
    unsubscribeAll,
    addVamp,
    updateVamp,
    setAttachment,
    removeAttachment,
    deleteVamp,
    countAssignments,
  }
})
