import { ref } from 'vue'
import { defineStore } from 'pinia'
import {
  collection,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  setDoc,
  serverTimestamp,
  query,
  orderBy,
  type Unsubscribe,
} from 'firebase/firestore'
import { db } from '@/firebase'
import { useSongStore } from '@/stores/songs'
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
    slotPosition: number,
    song: { id: string; title: string; key: string },
  ) {
    const service = services.value.find((s) => s.id === serviceId)
    if (!service) return

    const updatedSlots = service.slots.map((slot) => {
      if (slot.position === slotPosition && slot.kind === 'SONG') {
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

  async function clearSongFromSlot(serviceId: string, slotPosition: number) {
    const service = services.value.find((s) => s.id === serviceId)
    if (!service) return

    const updatedSlots = service.slots.map((slot) => {
      if (slot.position === slotPosition && slot.kind === 'SONG') {
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

    await setDoc(doc(db, 'shareTokens', token), {
      serviceId: service.id,
      orgId: orgIdValue,
      serviceSnapshot: {
        date: service.date,
        name: service.name,
        progression: service.progression,
        teams: service.teams,
        slots: slotsWithBpm,
        sermonPassage: service.sermonPassage,
        notes: service.notes,
        status: service.status,
      },
      createdAt: serverTimestamp(),
    })

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
    createShareToken,
  }
})
