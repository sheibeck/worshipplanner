import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

// The serviceMessages store opens ONE onSnapshot listener on the nested
// services/{id}/messages collection (the songLyrics.ts::subscribeLyrics idiom),
// and issues one-shot getDocs reads for a message's bounced recipients. This
// mock stubs collection/query/orderBy/where/onSnapshot/getDocs and exposes a
// `triggerSnapshot` helper to drive the single collection listener's callback.

type MessageDocLike = { id: string; data: () => Record<string, unknown> }
type SnapshotCallback = (snap: { docs: MessageDocLike[] }) => void

let snapshotCallback: SnapshotCallback | null = null
const unsubscribeSpies: Array<ReturnType<typeof vi.fn>> = []
let getDocsResult: MessageDocLike[] = []

vi.mock('firebase/firestore', () => ({
  collection: vi.fn((_db: unknown, ...segments: string[]) => ({ path: segments.join('/') })),
  query: vi.fn((ref: unknown, ...clauses: unknown[]) => ({ ref, clauses })),
  orderBy: vi.fn((field: string, dir: string) => ({ _t: 'orderBy', field, dir })),
  where: vi.fn((field: string, op: string, value: unknown) => ({ _t: 'where', field, op, value })),
  onSnapshot: vi.fn((_q: unknown, cb: SnapshotCallback) => {
    snapshotCallback = cb
    const unsub = vi.fn()
    unsubscribeSpies.push(unsub)
    return unsub
  }),
  getDocs: vi.fn(() => Promise.resolve({ docs: getDocsResult })),
}))

vi.mock('@/firebase', () => ({ db: {} }))

function docOf(id: string, data: Record<string, unknown>): MessageDocLike {
  return { id, data: () => data }
}

function triggerSnapshot(docs: MessageDocLike[]): void {
  if (!snapshotCallback) throw new Error('no snapshot callback registered')
  snapshotCallback({ docs })
}

describe('useServiceMessagesStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    snapshotCallback = null
    unsubscribeSpies.length = 0
    getDocsResult = []
  })

  describe('subscribeServiceMessages', () => {
    it('opens exactly one onSnapshot listener on services/{id}/messages ordered createdAt desc', async () => {
      const { collection, orderBy, onSnapshot } = await import('firebase/firestore')
      const { useServiceMessagesStore } = await import('../serviceMessages')
      const store = useServiceMessagesStore()

      store.subscribeServiceMessages('orgA', 'svc1')

      expect(onSnapshot).toHaveBeenCalledOnce()
      expect(collection).toHaveBeenCalledWith(
        {},
        'organizations',
        'orgA',
        'services',
        'svc1',
        'messages',
      )
      expect(orderBy).toHaveBeenCalledWith('createdAt', 'desc')
    })

    it('re-subscribing (new serviceId) unsubscribes the previous listener first', async () => {
      const { onSnapshot } = await import('firebase/firestore')
      const { useServiceMessagesStore } = await import('../serviceMessages')
      const store = useServiceMessagesStore()

      store.subscribeServiceMessages('orgA', 'svc1')
      const firstUnsub = unsubscribeSpies[0]!

      store.subscribeServiceMessages('orgA', 'svc2')

      expect(firstUnsub).toHaveBeenCalledOnce()
      expect(onSnapshot).toHaveBeenCalledTimes(2)
    })

    it('maps snapshot docs newest-first into the messages ref', async () => {
      const { useServiceMessagesStore } = await import('../serviceMessages')
      const store = useServiceMessagesStore()

      store.subscribeServiceMessages('orgA', 'svc1')
      triggerSnapshot([
        docOf('m2', { type: 'reminder', status: 'sent', subject: 'B', deliveryCounts: { sent: 3, failed: 0, bounced: 0 } }),
        docOf('m1', { type: 'oneoff', status: 'sent', subject: 'A', deliveryCounts: { sent: 1, failed: 0, bounced: 0 } }),
      ])

      expect(store.messages.map((m) => m.id)).toEqual(['m2', 'm1'])
      expect(store.messages[0]!.type).toBe('reminder')
      expect(store.messages[0]!.subject).toBe('B')
    })

    it('treats a message doc missing deliveryCounts.bounced as bounced 0', async () => {
      const { useServiceMessagesStore } = await import('../serviceMessages')
      const store = useServiceMessagesStore()

      store.subscribeServiceMessages('orgA', 'svc1')
      triggerSnapshot([
        // Older Phase-59 doc: deliveryCounts has no `bounced` leaf.
        docOf('m1', { type: 'oneoff', status: 'sent', deliveryCounts: { sent: 5, failed: 1 } }),
        // Even-older doc: no deliveryCounts at all.
        docOf('m0', { type: 'oneoff', status: 'sent' }),
      ])

      expect(store.messages[0]!.deliveryCounts).toEqual({ sent: 5, failed: 1, bounced: 0 })
      expect(store.messages[1]!.deliveryCounts).toEqual({ sent: 0, failed: 0, bounced: 0 })
    })

    it('flips isLoading true until the first snapshot resolves, then false', async () => {
      const { useServiceMessagesStore } = await import('../serviceMessages')
      const store = useServiceMessagesStore()

      store.subscribeServiceMessages('orgA', 'svc1')
      expect(store.isLoading).toBe(true)

      triggerSnapshot([])
      expect(store.isLoading).toBe(false)
    })
  })

  describe('unsubscribeServiceMessages', () => {
    it('tears down the listener and clears state', async () => {
      const { useServiceMessagesStore } = await import('../serviceMessages')
      const store = useServiceMessagesStore()

      store.subscribeServiceMessages('orgA', 'svc1')
      triggerSnapshot([docOf('m1', { type: 'oneoff', status: 'sent' })])
      expect(store.messages).toHaveLength(1)
      const unsub = unsubscribeSpies[0]!

      store.unsubscribeServiceMessages()

      expect(unsub).toHaveBeenCalledOnce()
      expect(store.messages).toHaveLength(0)
      expect(store.isLoading).toBe(true)
    })
  })

  describe('fetchBouncedRecipients', () => {
    it('reads messages/{id}/recipients where status==bounced and maps the rows', async () => {
      const { collection, where, getDocs } = await import('firebase/firestore')
      const { useServiceMessagesStore } = await import('../serviceMessages')
      const store = useServiceMessagesStore()

      getDocsResult = [
        docOf('p1', { personId: 'p1', name: 'Micah T.', email: 'micah@example.com', bounceReason: 'address rejected' }),
        docOf('p2', { personId: 'p2', name: 'Dana R.', email: 'dana@example.com', bounceReason: null }),
      ]

      const rows = await store.fetchBouncedRecipients('orgA', 'svc1', 'm1')

      expect(collection).toHaveBeenCalledWith(
        {},
        'organizations',
        'orgA',
        'services',
        'svc1',
        'messages',
        'm1',
        'recipients',
      )
      expect(where).toHaveBeenCalledWith('status', '==', 'bounced')
      expect(getDocs).toHaveBeenCalledOnce()
      expect(rows).toEqual([
        { personId: 'p1', name: 'Micah T.', email: 'micah@example.com', bounceReason: 'address rejected' },
        { personId: 'p2', name: 'Dana R.', email: 'dana@example.com', bounceReason: null },
      ])
    })

    it('falls back personId to the doc id when the field is absent', async () => {
      const { useServiceMessagesStore } = await import('../serviceMessages')
      const store = useServiceMessagesStore()

      getDocsResult = [docOf('p9', { name: 'No Field', email: 'x@example.com', bounceReason: null })]

      const rows = await store.fetchBouncedRecipients('orgA', 'svc1', 'm1')

      expect(rows[0]!.personId).toBe('p9')
    })
  })
})
