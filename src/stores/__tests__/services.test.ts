import { describe, it, expect, vi, beforeEach } from 'vitest'
import { reactive } from 'vue'
import { setActivePinia, createPinia } from 'pinia'
import type { Service } from '@/types/service'
import type { ServiceTemplateEntry } from '@/types/organization'

// Mock crypto.getRandomValues for deterministic token generation, and
// crypto.randomUUID (Phase 24, D-01) so createSlot()/buildSlots()'s slot-id
// minting doesn't throw "crypto.randomUUID is not a function" now that
// createService's buildSlots() call requires it.
let uuidCounter = 0
vi.stubGlobal('crypto', {
  getRandomValues: vi.fn((arr: Uint8Array) => {
    for (let i = 0; i < arr.length; i++) arr[i] = i + 1
    return arr
  }),
  randomUUID: vi.fn(() => `mock-uuid-${++uuidCounter}`),
})

// Track onSnapshot callbacks and unsubscribe fns
type SnapshotDoc = { id: string; data: () => Record<string, unknown>; metadata?: { hasPendingWrites: boolean } }
let snapshotCallback: ((snap: { docs: SnapshotDoc[] }) => void) | null = null
let snapshotOptions: { includeMetadataChanges?: boolean } | undefined
const mockUnsubscribe = vi.fn()

// ── 41-03 Task 1 (Wave 0 blocker, RESEARCH.md Pitfall 4) ──────────────────────
// This phase introduces the first FILTERED Firestore query in the codebase
// (`ensureShareLink`'s adoption scan over `shareTokens`). Nothing before this
// used `where`/`getDocs`/`limit`/`runTransaction`, so the hand-maintained mock
// below had none of them — every R078 adoption test would fail to load with a
// "not a function" TypeError before asserting anything. The transaction's
// `get`/`set` spies are declared here, at module scope (mirroring the existing
// `mockUnsubscribe` pattern), so a test can assert on them after import.
const mockTxGet = vi.fn(() => Promise.resolve({ exists: () => false, data: () => ({}) }))
const mockTxSet = vi.fn()

// Mock firebase/firestore module
vi.mock('firebase/firestore', () => {
  return {
    getFirestore: vi.fn(() => ({})),
    collection: vi.fn((db, ...segments) => ({ path: segments.join('/') })),
    doc: vi.fn((db, ...segments) => ({ id: segments[segments.length - 1] ?? 'mock-id', path: segments.join('/') })),
    // R039 (32-01): widened to accept BOTH the pre-existing two-argument
    // form (query, callback) and the new three-argument form
    // (query, options, callback) — whichever of argument 2/3 is a function
    // is the real callback, so every existing call site in this file keeps
    // working unmodified.
    onSnapshot: vi.fn(
      (
        _query: unknown,
        optionsOrCallback: unknown,
        maybeCallback?: (snap: { docs: SnapshotDoc[] }) => void,
      ) => {
        if (typeof optionsOrCallback === 'function') {
          snapshotOptions = undefined
          snapshotCallback = optionsOrCallback as (snap: { docs: SnapshotDoc[] }) => void
        } else {
          snapshotOptions = optionsOrCallback as { includeMetadataChanges?: boolean } | undefined
          snapshotCallback = maybeCallback ?? null
        }
        return mockUnsubscribe
      },
    ),
    addDoc: vi.fn(() => Promise.resolve({ id: 'new-service-id' })),
    updateDoc: vi.fn(() => Promise.resolve()),
    deleteDoc: vi.fn(() => Promise.resolve()),
    getDoc: vi.fn(() =>
      Promise.resolve({
        exists: () => true,
        data: () => ({ name: 'Grace Church', slug: 'grace-church' }),
      }),
    ),
    setDoc: vi.fn(() => Promise.resolve()),
    deleteField: vi.fn(() => '__DELETE_FIELD_SENTINEL__'),
    query: vi.fn((ref) => ref),
    orderBy: vi.fn(),
    // `where` returns a plain descriptor so a test can assert the field, op
    // and value the adoption query filtered on.
    where: vi.fn((field: string, op: string, value: unknown) => ({ field, op, value })),
    // `limit` is not called anywhere in this phase — it exists so a stray
    // future call doesn't get silently swallowed, and so a test can assert
    // it was NOT called (part of the no-composite-index guarantee).
    limit: vi.fn((n: number) => ({ limit: n })),
    // Defaults to an empty result: "no pre-existing tokens" is the ordinary
    // first-share path. Adoption tests override per-call with
    // mockResolvedValueOnce.
    getDocs: vi.fn(() => Promise.resolve({ empty: true, docs: [] })),
    // Invokes the callback with a transaction stand-in whose get/set are the
    // module-scope spies above (so their calls are assertable from a test),
    // plus inert update/delete members so a stray call doesn't throw an
    // unhelpful error.
    runTransaction: vi.fn(
      async (_db: unknown, updateFunction: (tx: { get: typeof mockTxGet; set: typeof mockTxSet; update: () => void; delete: () => void }) => unknown) => {
        return updateFunction({ get: mockTxGet, set: mockTxSet, update: () => {}, delete: () => {} })
      },
    ),
    serverTimestamp: vi.fn(() => ({ seconds: 1000000, nanoseconds: 0 })),
  }
})

// Mock @/firebase module
vi.mock('@/firebase', () => ({
  auth: {},
  db: {},
}))

// Mock the useSongStore for cross-store writes
const mockUpdateSong = vi.fn(() => Promise.resolve())
vi.mock('@/stores/songs', () => ({
  useSongStore: vi.fn(() => ({
    updateSong: mockUpdateSong,
    songs: [
      {
        id: 'song-abc',
        title: 'Amazing Grace',
        ccliNumber: '12345',
        arrangements: [
          { key: 'G', bpm: 120 },
          { key: 'C', bpm: 110 },
        ],
      },
    ],
  })),
}))

// Mock useRosterStore — people (for name resolution) + roles (for resolveServiceRoleAssignments)
vi.mock('@/stores/roster', () => ({
  useRosterStore: vi.fn(() => ({
    people: [
      { id: 'person-1', name: 'Alice Smith', email: 'alice@example.com', phone: '555-1234' },
      { id: 'person-2', name: 'Bob Jones', email: 'bob@example.com', phone: '555-5678' },
    ],
    roles: [
      { id: 'role-guitar', name: 'Guitar', group: 'band', defaultCount: 1, order: 1 },
      { id: 'role-sound', name: 'Sound', group: 'tech', defaultCount: 1, order: 2 },
    ],
  })),
}))

// Mock useQuartersStore — quarters array consumed by resolveServiceRoleAssignments
vi.mock('@/stores/quarters', () => ({
  useQuartersStore: vi.fn(() => ({
    quarters: [
      {
        id: 'quarter-1',
        serviceDates: ['2026-03-08'],
        calendar: {
          '2026-03-08': {
            'role-guitar': ['person-1'],
            'role-sound': ['person-2'],
          },
        },
      },
    ],
  })),
}))

// 44-01 (Pitfall #1, 44-RESEARCH.md) — createService now reads
// authStore.settings.defaultServiceTemplate/vwModeEnabled. No prior art in
// this file; mockAuthState.settings shape copies ServiceEditorView.test.ts's
// established `vi.mock('@/stores/auth', ...)` pattern (lines 352-377 there).
// A `reactive()` object so a test can mutate `mockAuthState.settings...`
// between calls without re-mocking.
const mockAuthState = reactive<{
  settings: { aiEnabled: boolean; pcEnabled: boolean; vwModeEnabled: boolean; defaultServiceTemplate: ServiceTemplateEntry[] }
}>({
  settings: { aiEnabled: true, pcEnabled: true, vwModeEnabled: true, defaultServiceTemplate: [] },
})

vi.mock('@/stores/auth', () => ({
  useAuthStore: () => mockAuthState,
}))

function makeService(overrides: Partial<{
  id: string
  date: string
  name: string
  progression: '1-2-2-3' | '1-2-3-3'
  teams: string[]
  status: 'draft' | 'planned' | 'exported'
  slots: unknown[]
  sermonPassage: null
  notes: string
  createdAt: { seconds: number; nanoseconds: number }
  updatedAt: { seconds: number; nanoseconds: number }
}> = {}) {
  return {
    id: 'service-1',
    date: '2026-03-08',
    name: 'Sunday Service',
    progression: '1-2-2-3' as '1-2-2-3' | '1-2-3-3',
    teams: [],
    status: 'draft' as 'draft' | 'planned' | 'exported',
    slots: [],
    sermonPassage: null,
    notes: '',
    createdAt: { seconds: 1000000, nanoseconds: 0 },
    updatedAt: { seconds: 1000000, nanoseconds: 0 },
    ...overrides,
  }
}

// R039 (32-01): `pendingIds` names which of `services`' ids this emission
// reports as `metadata.hasPendingWrites === true` — omitted/empty means
// every doc in this snapshot reports no pending write (the everyday case
// every pre-32-01 test below already exercises).
function triggerSnapshot(services: ReturnType<typeof makeService>[], pendingIds: string[] = []) {
  if (snapshotCallback) {
    snapshotCallback({
      docs: services.map((s) => ({
        id: s.id,
        data: () => {
          const { id: _id, ...rest } = s
          return rest
        },
        metadata: { hasPendingWrites: pendingIds.includes(s.id) },
      })),
    })
  }
}

describe('useServiceStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    snapshotCallback = null
    snapshotOptions = undefined
    // Reset the mutable authStore mock between tests — otherwise a
    // createService test that sets a template would leak into the next test.
    mockAuthState.settings.aiEnabled = true
    mockAuthState.settings.pcEnabled = true
    mockAuthState.settings.vwModeEnabled = true
    mockAuthState.settings.defaultServiceTemplate = []
  })

  describe('initial state', () => {
    it('starts with empty services array', async () => {
      const { useServiceStore } = await import('../services')
      const store = useServiceStore()
      expect(store.services).toEqual([])

      // Regression guard for the Wave 0 mock gap (RESEARCH.md Pitfall 4):
      // without these four exports, every R078 adoption test would fail to
      // load with a "not a function" TypeError before asserting anything.
      // Folded into this existing test (rather than a new `it(...)`) so the
      // pre-existing 55-test baseline count is undisturbed.
      const { where, getDocs, limit, runTransaction } = await import('firebase/firestore')
      expect(typeof where).toBe('function')
      expect(typeof getDocs).toBe('function')
      expect(typeof limit).toBe('function')
      expect(typeof runTransaction).toBe('function')
    })

    it('starts with isLoading true', async () => {
      const { useServiceStore } = await import('../services')
      const store = useServiceStore()
      expect(store.isLoading).toBe(true)
    })
  })

  describe('subscribe / onSnapshot', () => {
    it('subscribe calls onSnapshot on the org services collection', async () => {
      const { onSnapshot } = await import('firebase/firestore')
      const { useServiceStore } = await import('../services')
      const store = useServiceStore()
      store.subscribe('org-1')
      expect(onSnapshot).toHaveBeenCalledOnce()
    })

    it('populates services from snapshot with { id, ...data } mapping', async () => {
      const { useServiceStore } = await import('../services')
      const store = useServiceStore()
      store.subscribe('org-1')
      const service = makeService()
      triggerSnapshot([service])
      expect(store.services).toHaveLength(1)
      expect(store.services[0]!.id).toBe('service-1')
      expect(store.services[0]!.date).toBe('2026-03-08')
    })

    it('sets isLoading to false after first snapshot', async () => {
      const { useServiceStore } = await import('../services')
      const store = useServiceStore()
      store.subscribe('org-1')
      triggerSnapshot([])
      expect(store.isLoading).toBe(false)
    })

    it('unsubscribeAll calls the unsubscribe fn and resets state', async () => {
      const { useServiceStore } = await import('../services')
      const store = useServiceStore()
      store.subscribe('org-1')
      const service = makeService()
      triggerSnapshot([service])
      expect(store.services).toHaveLength(1)
      store.unsubscribeAll()
      expect(mockUnsubscribe).toHaveBeenCalled()
      expect(store.services).toEqual([])
      expect(store.isLoading).toBe(true)
    })

    it('calling subscribe again unsubscribes previous listener first', async () => {
      const { useServiceStore } = await import('../services')
      const store = useServiceStore()
      store.subscribe('org-1')
      store.subscribe('org-2')
      expect(mockUnsubscribe).toHaveBeenCalledOnce()
    })

    // ── R039 (32-01): own-write echo classification ─────────────────────────

    it('subscribes with includeMetadataChanges: true — without it, the settle edge never reaches this callback', async () => {
      const { useServiceStore } = await import('../services')
      const store = useServiceStore()
      store.subscribe('org-1')
      expect(snapshotOptions).toEqual({ includeMetadataChanges: true })
    })

    it('a snapshot reporting a pending write puts that doc id in ownWriteEchoIds and isOwnWriteEcho', async () => {
      const { useServiceStore } = await import('../services')
      const store = useServiceStore()
      store.subscribe('org-1')
      triggerSnapshot([makeService()], ['service-1'])
      expect(store.ownWriteEchoIds).toEqual(['service-1'])
      expect(store.isOwnWriteEcho('service-1')).toBe(true)
    })

    it('the following snapshot with no pending write for that doc STILL classifies it as an echo (the settle edge)', async () => {
      const { useServiceStore } = await import('../services')
      const store = useServiceStore()
      store.subscribe('org-1')
      triggerSnapshot([makeService()], ['service-1'])
      expect(store.isOwnWriteEcho('service-1')).toBe(true)

      // Server-ack snapshot: no longer pending. This is the emission whose
      // resolved serverTimestamp() value is what defeats a naive updatedAt
      // diff — it must classify as an echo too, or only half the window closes.
      triggerSnapshot([makeService()], [])
      expect(store.ownWriteEchoIds).toEqual(['service-1'])
      expect(store.isOwnWriteEcho('service-1')).toBe(true)
    })

    it('a third snapshot with no pending writes anywhere leaves ownWriteEchoIds empty — a genuinely external change is not misclassified', async () => {
      const { useServiceStore } = await import('../services')
      const store = useServiceStore()
      store.subscribe('org-1')
      triggerSnapshot([makeService()], ['service-1']) // optimistic edge
      triggerSnapshot([makeService()], []) // settle edge — still an echo
      expect(store.isOwnWriteEcho('service-1')).toBe(true)

      // A later, unrelated snapshot — nothing pending anywhere.
      triggerSnapshot([makeService()], [])
      expect(store.ownWriteEchoIds).toEqual([])
      expect(store.isOwnWriteEcho('service-1')).toBe(false)
    })

    // WR-03 (41-REVIEW): shareLinkCache is private closure state, asserted
    // behaviorally — see the deleteService WR-03 test above for the same
    // technique. Without the fix, unsubscribeAll left the previous org's
    // cached token in place, so a same-session, same-id refresh after
    // switching orgs would reuse a token that belongs to the WRONG org
    // (harmless only because Firestore ids don't collide across orgs in
    // practice, but a real gap in the store's otherwise-full reset).
    it('WR-03: unsubscribeAll drops the shareLinkCache entry — a same-id refresh after re-subscribing re-reads instead of reusing the stale cached token', async () => {
      const { getDoc, setDoc } = await import('firebase/firestore')
      const { useServiceStore } = await import('../services')
      const store = useServiceStore()
      store.subscribe('org-1')
      triggerSnapshot([makeService()])

      vi.mocked(getDoc).mockResolvedValueOnce({
        exists: () => true,
        data: () => ({ token: 'tok-old', orgId: 'org-1', serviceId: 'service-1' }),
      } as never)
      await store.updateService('service-1', { notes: 'first edit' })
      const firstDocRef = vi.mocked(setDoc).mock.calls[0]![0] as { id: string }
      expect(firstDocRef.id).toBe('tok-old')

      store.unsubscribeAll()
      store.subscribe('org-2')
      triggerSnapshot([makeService()])

      vi.mocked(getDoc).mockResolvedValueOnce({
        exists: () => true,
        data: () => ({ token: 'tok-new', orgId: 'org-2', serviceId: 'service-1' }),
      } as never)
      vi.mocked(setDoc).mockClear()
      await store.updateService('service-1', { notes: 'second edit' })

      const secondDocRef = vi.mocked(setDoc).mock.calls[0]![0] as { id: string }
      expect(secondDocRef.id).toBe('tok-new')
    })

    it('unsubscribeAll empties ownWriteEchoIds', async () => {
      const { useServiceStore } = await import('../services')
      const store = useServiceStore()
      store.subscribe('org-1')
      triggerSnapshot([makeService()], ['service-1'])
      expect(store.ownWriteEchoIds).toEqual(['service-1'])
      store.unsubscribeAll()
      expect(store.ownWriteEchoIds).toEqual([])
    })

    // ── WR-02 (32-REVIEW): the multi-document case ───────────────────────────
    //
    // Every test above exercises exactly one document. These prove the
    // pending/settle-edge computation is derived independently per document,
    // never cross-contaminated, for the two shapes the review specifically
    // flagged as needing coverage.

    it('two documents whose own-writes overlap and settle on different snapshots are each classified independently', async () => {
      const { useServiceStore } = await import('../services')
      const store = useServiceStore()
      store.subscribe('org-1')
      const svcA = makeService({ id: 'service-a' })
      const svcB = makeService({ id: 'service-b' })

      // Both writes go pending in the same snapshot.
      triggerSnapshot([svcA, svcB], ['service-a', 'service-b'])
      expect(store.ownWriteEchoIds.sort()).toEqual(['service-a', 'service-b'])
      expect(store.isOwnWriteEcho('service-a')).toBe(true)
      expect(store.isOwnWriteEcho('service-b')).toBe(true)

      // A settles first — B is still pending. A's settle edge must not leak
      // onto B, and B's continued pending state must not be lost.
      triggerSnapshot([svcA, svcB], ['service-b'])
      expect(store.ownWriteEchoIds.sort()).toEqual(['service-a', 'service-b'])
      expect(store.isOwnWriteEcho('service-a')).toBe(true) // settle edge
      expect(store.isOwnWriteEcho('service-b')).toBe(true) // still pending

      // B settles on the NEXT snapshot, one full emission after A. A is no
      // longer anywhere near pending/settling — it must drop out cleanly,
      // proving the settle edge doesn't linger past its own single emission.
      triggerSnapshot([svcA, svcB], [])
      expect(store.ownWriteEchoIds).toEqual(['service-b']) // B's settle edge only
      expect(store.isOwnWriteEcho('service-a')).toBe(false)
      expect(store.isOwnWriteEcho('service-b')).toBe(true)
    })

    it('a snapshot mixing one document\'s settle edge with a second, genuinely external document\'s change classifies only the settling one as an echo', async () => {
      const { useServiceStore } = await import('../services')
      const store = useServiceStore()
      store.subscribe('org-1')
      const svcA = makeService({ id: 'service-a', name: 'A original' })
      const svcB = makeService({ id: 'service-b', name: 'B original' })

      // Only A has an own write in flight.
      triggerSnapshot([svcA, svcB], ['service-a'])
      expect(store.isOwnWriteEcho('service-a')).toBe(true)
      expect(store.isOwnWriteEcho('service-b')).toBe(false)

      // A's write settles in the SAME emission that a different writer's
      // genuinely external change to B arrives — B is never pending here at
      // all, so it must never be misclassified as an echo despite the
      // simultaneous settle edge on A.
      const svcBExternallyChanged = makeService({ id: 'service-b', name: 'B changed by another editor' })
      triggerSnapshot([svcA, svcBExternallyChanged], [])
      expect(store.ownWriteEchoIds).toEqual(['service-a'])
      expect(store.isOwnWriteEcho('service-a')).toBe(true)
      expect(store.isOwnWriteEcho('service-b')).toBe(false)
      expect(store.services.find((s) => s.id === 'service-b')?.name).toBe('B changed by another editor')
    })
  })

  describe('createService (44-01 — template-driven, empty-by-default)', () => {
    it('calls addDoc with correct shape including serverTimestamp, progression, and status draft', async () => {
      const { addDoc, serverTimestamp } = await import('firebase/firestore')
      const { useServiceStore } = await import('../services')
      const store = useServiceStore()
      store.subscribe('org-1')

      await store.createService({
        date: '2026-03-08',
        name: '',
        teams: [],
      })

      expect(addDoc).toHaveBeenCalledOnce()
      const callArgs = vi.mocked(addDoc).mock.calls[0]!
      const data = callArgs[1] as Record<string, unknown>
      expect(data.date).toBe('2026-03-08')
      expect(data.progression).toBe('1-2-2-3')
      expect(data.status).toBe('draft')
      expect(data.createdAt).toBeDefined()
      expect(data.updatedAt).toBeDefined()
      expect(serverTimestamp).toHaveBeenCalled()
    })

    it('an empty/unset defaultServiceTemplate produces a new service with 0 slots (owner override 2026-08-07 — EMPTY, never buildSlots)', async () => {
      const { addDoc } = await import('firebase/firestore')
      const { useServiceStore } = await import('../services')
      const store = useServiceStore()
      store.subscribe('org-1')

      // mockAuthState.settings.defaultServiceTemplate defaults to [] (beforeEach)
      await store.createService({
        date: '2026-03-08',
        name: '',
        teams: [],
      })

      const callArgs = vi.mocked(addDoc).mock.calls[0]!
      const data = callArgs[1] as Record<string, unknown>
      const slots = data.slots as unknown[]
      expect(slots).toHaveLength(0)
    })

    it('a non-empty template produces slots matching kind/section/order exactly', async () => {
      const { addDoc } = await import('firebase/firestore')
      const { useServiceStore } = await import('../services')
      const store = useServiceStore()
      store.subscribe('org-1')

      mockAuthState.settings.defaultServiceTemplate = [
        { id: 't-1', kind: 'SONG', section: 'worship' },
        { id: 't-2', kind: 'SCRIPTURE', section: 'worship' },
        { id: 't-3', kind: 'SONG', section: 'sending' },
        { id: 't-4', kind: 'MESSAGE', section: 'message' },
      ]
      mockAuthState.settings.vwModeEnabled = false

      await store.createService({
        date: '2026-03-08',
        name: '',
        teams: [],
      })

      const callArgs = vi.mocked(addDoc).mock.calls[0]!
      const data = callArgs[1] as Record<string, unknown>
      const slots = data.slots as Array<{ kind: string; section?: string; position: number }>
      expect(slots.map((s) => s.kind)).toEqual(['SONG', 'SCRIPTURE', 'SONG', 'MESSAGE'])
      expect(slots.map((s) => s.section)).toEqual(['worship', 'worship', 'sending', 'message'])
      expect(slots.map((s) => s.position)).toEqual([0, 1, 2, 3])
    })

    it('VW mode ON: SONG entries in the template receive requiredVwType from the ordinal 1-2-2-3 sequence', async () => {
      const { addDoc } = await import('firebase/firestore')
      const { useServiceStore } = await import('../services')
      const store = useServiceStore()
      store.subscribe('org-1')

      mockAuthState.settings.defaultServiceTemplate = [
        { id: 't-1', kind: 'SONG' },
        { id: 't-2', kind: 'PRAYER' },
        { id: 't-3', kind: 'SONG' },
        { id: 't-4', kind: 'SONG' },
      ]
      mockAuthState.settings.vwModeEnabled = true

      await store.createService({
        date: '2026-03-08',
        name: '',
        teams: [],
      })

      const callArgs = vi.mocked(addDoc).mock.calls[0]!
      const data = callArgs[1] as Record<string, unknown>
      const slots = data.slots as Array<{ kind: string; requiredVwType?: number }>
      const songSlots = slots.filter((s) => s.kind === 'SONG')
      expect(songSlots.map((s) => s.requiredVwType)).toEqual([1, 2, 2])
    })

    it('VW mode OFF: SONG slots are present, carrying createSlot default requiredVwType, not an ordinal-derived value', async () => {
      const { addDoc } = await import('firebase/firestore')
      const { useServiceStore } = await import('../services')
      const store = useServiceStore()
      store.subscribe('org-1')

      mockAuthState.settings.defaultServiceTemplate = [
        { id: 't-1', kind: 'SONG' },
        { id: 't-2', kind: 'SONG' },
      ]
      mockAuthState.settings.vwModeEnabled = false

      await store.createService({
        date: '2026-03-08',
        name: '',
        teams: [],
      })

      const callArgs = vi.mocked(addDoc).mock.calls[0]!
      const data = callArgs[1] as Record<string, unknown>
      const slots = data.slots as Array<{ kind: string; requiredVwType?: number }>
      const songSlots = slots.filter((s) => s.kind === 'SONG')
      expect(songSlots).toHaveLength(2)
      expect(songSlots.every((s) => s.requiredVwType === 2)).toBe(true)
    })

    it('createService returns the new document id', async () => {
      const { useServiceStore } = await import('../services')
      const store = useServiceStore()
      store.subscribe('org-1')

      const id = await store.createService({
        date: '2026-03-08',
        name: '',
        teams: [],
      })

      expect(id).toBe('new-service-id')
    })
  })

  describe('updateService', () => {
    it('calls updateDoc with serverTimestamp for updatedAt', async () => {
      const { updateDoc, serverTimestamp } = await import('firebase/firestore')
      const { useServiceStore } = await import('../services')
      const store = useServiceStore()
      store.subscribe('org-1')

      await store.updateService('service-1', { notes: 'Updated notes' })

      expect(updateDoc).toHaveBeenCalledOnce()
      const callArgs = vi.mocked(updateDoc).mock.calls[0]!
      const data = callArgs[1] as unknown as Record<string, unknown>
      expect(data.notes).toBe('Updated notes')
      expect(data.updatedAt).toBeDefined()
      expect(serverTimestamp).toHaveBeenCalled()
    })

    // R111 (51-03): moving an item back to "No Section" via the dropdown sets
    // `slot.section = undefined` (an explicit own key, per onSectionChange('')),
    // which rides through onSave into the updateService payload. The funnel MUST
    // strip raw `undefined` before it reaches Firestore's updateDoc — otherwise
    // the write throws "Unsupported field value: undefined (found in ... slots)".
    // RED baseline: current code spreads `...data` unmodified, so the recorded
    // updateDoc payload still carries `section: undefined` on the moved slot.
    it('R111: strips raw undefined from the slots payload when an item is moved to "No Section"', async () => {
      const { updateDoc } = await import('firebase/firestore')
      const { useServiceStore } = await import('../services')
      const store = useServiceStore()
      store.subscribe('org-1')
      // A draft service so assertWritable permits the write.
      triggerSnapshot([makeService({ id: 'service-1', status: 'draft' })])

      // Mirror onSectionChange('') for a "No Section" move: an explicit own
      // `section: undefined` key on the moved slot.
      await store.updateService('service-1', {
        slots: [
          { kind: 'SONG', position: 0, section: undefined },
          { kind: 'PRAYER', position: 1, section: 'Worship' },
        ],
      })

      expect(updateDoc).toHaveBeenCalledOnce()
      const written = vi.mocked(updateDoc).mock.calls[0]![1] as unknown as Record<string, unknown>

      // The moved slot must carry NO `section` key (omission reads back as
      // "No Section"); the other slot's real section value survives.
      const writtenSlots = written.slots as Array<Record<string, unknown>>
      expect('section' in writtenSlots[0]!).toBe(false)
      expect(writtenSlots[1]!.section).toBe('Worship')

      // Belt-and-braces: a deep scan of the whole written payload finds no
      // value strictly equal to `undefined` — the exact thing Firestore rejects.
      const hasRawUndefined = (v: unknown): boolean => {
        if (v === undefined) return true
        if (Array.isArray(v)) return v.some(hasRawUndefined)
        if (v !== null && typeof v === 'object') {
          return Object.values(v as Record<string, unknown>).some(hasRawUndefined)
        }
        return false
      }
      expect(hasRawUndefined(written)).toBe(false)
    })
  })

  describe('deleteService', () => {
    it('calls deleteDoc with the correct doc reference', async () => {
      const { deleteDoc } = await import('firebase/firestore')
      const { useServiceStore } = await import('../services')
      const store = useServiceStore()
      store.subscribe('org-1')

      await store.deleteService('service-1')

      expect(deleteDoc).toHaveBeenCalledOnce()
    })

    // WR-03 (41-REVIEW): shareLinkCache is private closure state, so this is
    // asserted behaviorally rather than by inspecting the Map directly. A
    // fresh getDoc-backed lookup (not the stale cached token) after delete
    // is exactly what proves the entry was actually removed, not merely that
    // deleteDoc was called.
    it('WR-03: deleting a service drops its shareLinkCache entry — a later same-id refresh re-reads instead of reusing the stale cached token', async () => {
      const { getDoc, setDoc } = await import('firebase/firestore')
      const { useServiceStore } = await import('../services')
      const store = useServiceStore()
      store.subscribe('org-1')
      triggerSnapshot([makeService()])

      // Populate the cache for service-1 with tok-old via an ordinary refresh.
      vi.mocked(getDoc).mockResolvedValueOnce({
        exists: () => true,
        data: () => ({ token: 'tok-old', orgId: 'org-1', serviceId: 'service-1' }),
      } as never)
      await store.updateService('service-1', { notes: 'first edit' })
      const firstDocRef = vi.mocked(setDoc).mock.calls[0]![0] as { id: string }
      expect(firstDocRef.id).toBe('tok-old')

      await store.deleteService('service-1')

      // Simulate the id being reused (or simply re-verify against a fresh
      // lookup): a DIFFERENT link doc is queued. If the cache entry survived
      // delete, maybeRefreshShareLink would short-circuit on the stale
      // 'tok-old' string and never call getDoc again — this proves it did.
      vi.mocked(getDoc).mockResolvedValueOnce({
        exists: () => true,
        data: () => ({ token: 'tok-new', orgId: 'org-1', serviceId: 'service-1' }),
      } as never)
      vi.mocked(setDoc).mockClear()
      triggerSnapshot([makeService()])
      await store.updateService('service-1', { notes: 'second edit' })

      const secondDocRef = vi.mocked(setDoc).mock.calls[0]![0] as { id: string }
      expect(secondDocRef.id).toBe('tok-new')
    })
  })

  describe('assignSongToSlot', () => {
    it('calls updateService with updated slots when assigning a song', async () => {
      const { updateDoc } = await import('firebase/firestore')
      const { useServiceStore } = await import('../services')
      const store = useServiceStore()
      store.subscribe('org-1')

      // Set up a service in the store with slots
      const slots = [
        { kind: 'SONG', position: 0, requiredVwType: 1, songId: null, songTitle: null, songKey: null },
        { kind: 'SCRIPTURE', position: 1, book: null, chapter: null, verseStart: null, verseEnd: null },
        { kind: 'SONG', position: 2, requiredVwType: 2, songId: null, songTitle: null, songKey: null },
        { kind: 'PRAYER', position: 3 },
        { kind: 'SCRIPTURE', position: 4, book: null, chapter: null, verseStart: null, verseEnd: null },
        { kind: 'SONG', position: 5, requiredVwType: 2, songId: null, songTitle: null, songKey: null },
        { kind: 'SONG', position: 6, requiredVwType: 3, songId: null, songTitle: null, songKey: null },
        { kind: 'MESSAGE', position: 7 },
        { kind: 'SONG', position: 8, requiredVwType: 3, songId: null, songTitle: null, songKey: null },
      ]
      triggerSnapshot([makeService({ id: 'service-1', slots })])

      await store.assignSongToSlot('service-1', 0, {
        id: 'song-abc',
        title: 'Amazing Grace',
        key: 'G',
      })

      expect(updateDoc).toHaveBeenCalledOnce()
      const callArgs = vi.mocked(updateDoc).mock.calls[0]!
      const data = callArgs[1] as unknown as Record<string, unknown>
      const updatedSlots = data.slots as Array<{ kind: string; position: number; songId?: string; songTitle?: string; songKey?: string }>
      const slot0 = updatedSlots.find((s) => s.position === 0)
      expect(slot0?.songId).toBe('song-abc')
      expect(slot0?.songTitle).toBe('Amazing Grace')
      expect(slot0?.songKey).toBe('G')
    })

    it('calls useSongStore().updateSong with lastUsedAt serverTimestamp (cross-store link)', async () => {
      const { useServiceStore } = await import('../services')
      const store = useServiceStore()
      store.subscribe('org-1')

      const slots = [
        { kind: 'SONG', position: 0, requiredVwType: 1, songId: null, songTitle: null, songKey: null },
      ]
      triggerSnapshot([makeService({ id: 'service-1', slots })])

      await store.assignSongToSlot('service-1', 0, {
        id: 'song-abc',
        title: 'Amazing Grace',
        key: 'G',
      })

      expect(mockUpdateSong).toHaveBeenCalledOnce()
      const [songId, data] = mockUpdateSong.mock.calls[0] as unknown as [string, Record<string, unknown>]
      expect(songId).toBe('song-abc')
      expect((data as Record<string, unknown>).lastUsedAt).toBeDefined()
    })
  })

  describe('clearSongFromSlot', () => {
    it('calls updateService with null fields on the target slot', async () => {
      const { updateDoc } = await import('firebase/firestore')
      const { useServiceStore } = await import('../services')
      const store = useServiceStore()
      store.subscribe('org-1')

      const slots = [
        { kind: 'SONG', position: 0, requiredVwType: 1, songId: 'song-abc', songTitle: 'Amazing Grace', songKey: 'G' },
      ]
      triggerSnapshot([makeService({ id: 'service-1', slots })])

      await store.clearSongFromSlot('service-1', 0)

      expect(updateDoc).toHaveBeenCalledOnce()
      const callArgs = vi.mocked(updateDoc).mock.calls[0]!
      const data = callArgs[1] as unknown as Record<string, unknown>
      const updatedSlots = data.slots as Array<{ kind: string; position: number; songId?: null; songTitle?: null; songKey?: null }>
      const slot0 = updatedSlots.find((s) => s.position === 0)
      expect(slot0?.songId).toBeNull()
      expect(slot0?.songTitle).toBeNull()
      expect(slot0?.songKey).toBeNull()
    })
  })

  describe('setRoleOverride', () => {
    it('writes only the scoped roleAssignmentOverrides.{roleId} dot-path key, plus updatedAt', async () => {
      const { updateDoc, serverTimestamp } = await import('firebase/firestore')
      const { useServiceStore } = await import('../services')
      const store = useServiceStore()
      store.subscribe('org-1')

      await store.setRoleOverride('service-1', 'role-guitar', ['person-1', 'person-2'])

      expect(updateDoc).toHaveBeenCalledOnce()
      const callArgs = vi.mocked(updateDoc).mock.calls[0]!
      const data = callArgs[1] as unknown as Record<string, unknown>
      expect(data['roleAssignmentOverrides.role-guitar']).toEqual(['person-1', 'person-2'])
      expect(data.updatedAt).toBeDefined()
      expect(serverTimestamp).toHaveBeenCalled()
      // Exactly the one scoped key + updatedAt — never the bare whole-map key.
      expect(Object.keys(data).sort()).toEqual(['roleAssignmentOverrides.role-guitar', 'updatedAt'])
      expect(data.roleAssignmentOverrides).toBeUndefined()
    })

    it('no-ops when orgId is unset', async () => {
      const { updateDoc } = await import('firebase/firestore')
      const { useServiceStore } = await import('../services')
      const store = useServiceStore()
      // No subscribe() call — orgId stays null.

      await store.setRoleOverride('service-1', 'role-guitar', ['person-1'])

      expect(updateDoc).not.toHaveBeenCalled()
    })
  })

  describe('clearRoleOverride', () => {
    it('sets the single scoped roleId key to the deleteField sentinel, leaving sibling keys untouched', async () => {
      const { updateDoc, deleteField, serverTimestamp } = await import('firebase/firestore')
      const { useServiceStore } = await import('../services')
      const store = useServiceStore()
      store.subscribe('org-1')

      await store.clearRoleOverride('service-1', 'role-guitar')

      expect(updateDoc).toHaveBeenCalledOnce()
      const callArgs = vi.mocked(updateDoc).mock.calls[0]!
      const data = callArgs[1] as unknown as Record<string, unknown>
      expect(deleteField).toHaveBeenCalled()
      expect(data['roleAssignmentOverrides.role-guitar']).toBe('__DELETE_FIELD_SENTINEL__')
      expect(serverTimestamp).toHaveBeenCalled()
      expect(Object.keys(data).sort()).toEqual(['roleAssignmentOverrides.role-guitar', 'updatedAt'])
    })

    it('no-ops when orgId is unset', async () => {
      const { updateDoc } = await import('firebase/firestore')
      const { useServiceStore } = await import('../services')
      const store = useServiceStore()

      await store.clearRoleOverride('service-1', 'role-guitar')

      expect(updateDoc).not.toHaveBeenCalled()
    })
  })

  describe('createShareToken', () => {
    // ensureShareLink's FIRST getDoc call (41-03) is the serviceShareLinks/{id}
    // read, which precedes the org-document read these tests were originally
    // written against. Runs AFTER the outer beforeEach's vi.clearAllMocks(),
    // so it survives that reset. Without this, the mock's shared default
    // (exists: () => true, data: () => ({ name: 'Grace Church', slug:
    // 'grace-church' })) would make ensureShareLink think a link document
    // already exists and try to read a nonexistent `.token` off org data,
    // resolving to `undefined` for every token below.
    beforeEach(async () => {
      const { getDoc } = await import('firebase/firestore')
      vi.mocked(getDoc).mockResolvedValueOnce({
        exists: () => false,
        data: () => ({}),
      } as never)
    })

    it('createShareToken returns a 36-character hex string', async () => {
      const { useServiceStore } = await import('../services')
      const store = useServiceStore()
      store.subscribe('org-1')

      const service = makeService() as unknown as Service
      const token = await store.createShareToken(service, 'org-1')

      expect(token).toHaveLength(36)
      expect(token).toMatch(/^[0-9a-f]{36}$/)
    })

    it('createShareToken calls setDoc with token as document ID', async () => {
      const { setDoc, doc } = await import('firebase/firestore')
      const { useServiceStore } = await import('../services')
      const store = useServiceStore()
      store.subscribe('org-1')

      const service = makeService() as unknown as Service
      const token = await store.createShareToken(service, 'org-1')

      // createShareToken now also writes the serviceShares memorable-URL doc
      // (Phase 17 Plan 03) — the opaque shareTokens/{token} write is still first.
      expect(setDoc).toHaveBeenCalledTimes(2)
      const [docRef, data] = vi.mocked(setDoc).mock.calls[0]!
      expect((docRef as { id: string }).id).toBe(token)
      const writeData = data as Record<string, unknown>
      expect(writeData.serviceId).toBe(service.id)
      expect(writeData.orgId).toBe('org-1')
      expect(writeData.serviceSnapshot).toBeDefined()
      const snapshot = writeData.serviceSnapshot as Record<string, unknown>
      expect(snapshot.date).toBe(service.date)
      expect(snapshot.notes).toBe(service.notes)
    })

    it('createShareToken embeds BPM from song store into song slots', async () => {
      const { setDoc } = await import('firebase/firestore')
      const { useServiceStore } = await import('../services')
      const store = useServiceStore()
      store.subscribe('org-1')

      const slots = [
        { kind: 'SONG', position: 0, requiredVwType: 1, songId: 'song-abc', songTitle: 'Amazing Grace', songKey: 'G' },
      ]
      const service = makeService({ slots }) as unknown as Service
      await store.createShareToken(service, 'org-1')

      // createShareToken now also writes the serviceShares memorable-URL doc
      // (Phase 17 Plan 03) — the opaque shareTokens/{token} write is still first.
      expect(setDoc).toHaveBeenCalledTimes(2)
      const [, data] = vi.mocked(setDoc).mock.calls[0]!
      const writeData = data as Record<string, unknown>
      const snapshot = writeData.serviceSnapshot as Record<string, unknown>
      const snapshotSlots = snapshot.slots as Array<{ kind: string; position: number; bpm?: number | null }>
      const songSlot = snapshotSlots.find((s) => s.position === 0)
      expect(songSlot?.bpm).toBe(120)
    })

    it('embeds roleAssignments with names-only personNames, resolved from resolveServiceRoleAssignments', async () => {
      const { setDoc } = await import('firebase/firestore')
      const { useServiceStore } = await import('../services')
      const store = useServiceStore()
      store.subscribe('org-1')

      const service = makeService() as unknown as Service
      await store.createShareToken(service, 'org-1')

      // First setDoc call is the opaque shareTokens/{token} write.
      const [, data] = vi.mocked(setDoc).mock.calls[0]!
      const writeData = data as Record<string, unknown>
      const snapshot = writeData.serviceSnapshot as Record<string, unknown>
      const roleAssignments = snapshot.roleAssignments as Array<{
        roleId: string
        roleName: string
        group: string
        personNames: string[]
      }>
      expect(roleAssignments).toBeDefined()
      const guitar = roleAssignments.find((r) => r.roleId === 'role-guitar')
      const sound = roleAssignments.find((r) => r.roleId === 'role-sound')
      expect(guitar?.personNames).toEqual(['Alice Smith'])
      expect(sound?.personNames).toEqual(['Bob Jones'])
    })

    it('written payload contains no email/phone/pcPersonId keys anywhere (PII guard)', async () => {
      const { setDoc } = await import('firebase/firestore')
      const { useServiceStore } = await import('../services')
      const store = useServiceStore()
      store.subscribe('org-1')

      const service = makeService() as unknown as Service
      await store.createShareToken(service, 'org-1')

      const [, data] = vi.mocked(setDoc).mock.calls[0]!
      const serialized = JSON.stringify(data)
      expect(serialized).not.toMatch(/email/i)
      expect(serialized).not.toMatch(/phone/i)
      expect(serialized).not.toMatch(/pcPersonId/i)
    })

    it('writes a memorable-URL serviceShares/{slug}__service-{date} doc after the opaque token write', async () => {
      const { setDoc } = await import('firebase/firestore')
      const { useServiceStore } = await import('../services')
      const store = useServiceStore()
      store.subscribe('org-1')

      const service = makeService() as unknown as Service
      await store.createShareToken(service, 'org-1')

      expect(setDoc).toHaveBeenCalledTimes(2)
      const [docRef, data] = vi.mocked(setDoc).mock.calls[1]!
      expect((docRef as { path: string }).path).toContain('serviceShares')
      const writeData = data as Record<string, unknown>
      expect(writeData.orgId).toBe('org-1')
      expect(writeData.orgSlug).toBe('grace-church')
      expect(writeData.token).toBeDefined()
      expect(writeData.serviceSnapshot).toBeDefined()
    })

    it('soft-fails: still returns the token when the serviceShares write rejects', async () => {
      const { setDoc } = await import('firebase/firestore')
      vi.mocked(setDoc).mockImplementationOnce(() => Promise.resolve()) // shareTokens write succeeds
      vi.mocked(setDoc).mockImplementationOnce(() => Promise.reject(new Error('serviceShares write failed')))
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      const { useServiceStore } = await import('../services')
      const store = useServiceStore()
      store.subscribe('org-1')

      const service = makeService() as unknown as Service
      const token = await store.createShareToken(service, 'org-1')

      expect(token).toHaveLength(36)
      expect(token).toMatch(/^[0-9a-f]{36}$/)
      expect(consoleErrorSpy).toHaveBeenCalled()
      consoleErrorSpy.mockRestore()
    })
  })

  // ── R112 — buildServiceSnapshot serializes slots in section-major order ──────
  //
  // The public share snapshot is one of the two read surfaces that render the
  // RAW persisted slot array; a service created in template/insertion order was
  // never `orderSlotsBySection`'d, so an empty-bodied item sinks to the bottom
  // until a normalizing save fires. The snapshot must route slots through the
  // editor's ordering contract so all three surfaces agree with no edit.
  describe('buildServiceSnapshot slot ordering (R112)', () => {
    it('serializes slots in orderSlotsBySection (section-major) order, including empty-bodied items', async () => {
      const { buildServiceSnapshot } = await import('../services')

      // Raw array is NOT section-major: a sending MISC (slot-b) precedes a
      // worship MISC (slot-c), and the MESSAGE trails both. Section-major order
      // is worship [a, c], message [d], sending [b] → ['a','c','d','b'].
      const service = makeService({
        slots: [
          {
            kind: 'SONG',
            id: 'slot-a',
            position: 0,
            requiredVwType: 1,
            songId: 'song-abc',
            songTitle: 'Amazing Grace',
            songKey: 'G',
            section: 'worship',
          },
          { kind: 'MISC', id: 'slot-b', position: 1, section: 'sending' },
          { kind: 'MISC', id: 'slot-c', position: 2, section: 'worship' },
          { kind: 'MESSAGE', id: 'slot-d', position: 3, section: 'message' },
        ],
      }) as unknown as Service

      const snapshot = buildServiceSnapshot(service)
      const orderedIds = snapshot.slots.map((s) => s.id)

      expect(orderedIds).toEqual(['slot-a', 'slot-c', 'slot-d', 'slot-b'])
    })
  })

  // ── R076/R078 — ensureShareLink stability, adoption and convergence ─────────
  //
  // getDoc responses are queued in CALL ORDER: ensureShareLink's link-document
  // read is always first; writeSharePayload's memorable-URL org read is
  // second (and defaults to the mock's shared exists:true/grace-church value
  // unless a case overrides it). No local beforeEach here (unlike the
  // sibling createShareToken describe above) — full control per case.
  describe('ensureShareLink', () => {
    it('first share on a virgin service mints exactly one token and records it once', async () => {
      const { getDoc, getDocs, setDoc } = await import('firebase/firestore')
      const { useServiceStore } = await import('../services')
      const store = useServiceStore()
      store.subscribe('org-1')
      const service = makeService() as unknown as Service

      vi.mocked(getDoc).mockResolvedValueOnce({ exists: () => false, data: () => ({}) } as never)
      // getDocs default (empty result) applies — no pre-existing tokens.

      const token = await store.ensureShareLink(service, 'org-1')

      expect(token).toHaveLength(36)
      expect(token).toMatch(/^[0-9a-f]{36}$/)
      expect(mockTxSet).toHaveBeenCalledTimes(1)
      const [, txSetPayload] = mockTxSet.mock.calls[0]!
      const payload = txSetPayload as Record<string, unknown>
      expect(payload.token).toBe(token)
      expect(payload.orgId).toBe('org-1')
      expect(payload.serviceId).toBe('service-1')
      expect(setDoc).toHaveBeenCalledTimes(2) // shareTokens payload, then serviceShares memorable-URL
      expect(getDocs).toHaveBeenCalledTimes(1)
    })

    it('repeat share returns the same token and mints nothing (R076 idempotency edge)', async () => {
      const { getDoc, getDocs } = await import('firebase/firestore')
      const { useServiceStore } = await import('../services')
      const store = useServiceStore()
      store.subscribe('org-1')
      const service = makeService() as unknown as Service

      vi.mocked(getDoc).mockResolvedValueOnce({ exists: () => false, data: () => ({}) } as never)
      const token1 = await store.ensureShareLink(service, 'org-1')

      // Do NOT prove stability by comparing two returned strings alone — the
      // suite's deterministic crypto.getRandomValues stub means every mint
      // returns the identical string, so a naive equality assertion would
      // pass even when a fresh mint occurred. The load-bearing assertions
      // are the call counts below.
      vi.mocked(getDoc).mockResolvedValueOnce({
        exists: () => true,
        data: () => ({ token: token1, orgId: 'org-1', serviceId: 'service-1' }),
      } as never)
      const token2 = await store.ensureShareLink(service, 'org-1')

      expect(token2).toBe(token1)
      expect(mockTxSet).toHaveBeenCalledTimes(1) // still 1 across both calls
      expect(getDocs).toHaveBeenCalledTimes(1) // no re-adoption scan on the second call
    })

    it('adoption picks the most recent of three pre-existing tokens and mints none (R078)', async () => {
      const { getDoc, getDocs, setDoc } = await import('firebase/firestore')
      const { useServiceStore } = await import('../services')
      const store = useServiceStore()
      store.subscribe('org-1')
      const service = makeService() as unknown as Service

      vi.mocked(getDoc).mockResolvedValueOnce({ exists: () => false, data: () => ({}) } as never)
      // Newest candidate ('token-newest') is deliberately neither first nor last.
      vi.mocked(getDocs).mockResolvedValueOnce({
        empty: false,
        docs: [
          { id: 'token-mid', data: () => ({ serviceId: 'service-1', orgId: 'org-1', createdAt: { seconds: 500 } }) },
          { id: 'token-newest', data: () => ({ serviceId: 'service-1', orgId: 'org-1', createdAt: { seconds: 900 } }) },
          { id: 'token-oldest', data: () => ({ serviceId: 'service-1', orgId: 'org-1', createdAt: { seconds: 100 } }) },
        ],
      } as never)

      const token = await store.ensureShareLink(service, 'org-1')

      expect(token).toBe('token-newest')
      const [firstSetDocRef] = vi.mocked(setDoc).mock.calls[0]!
      expect((firstSetDocRef as { id: string }).id).toBe('token-newest')
      const [, txSetPayload] = mockTxSet.mock.calls[0]!
      expect((txSetPayload as Record<string, unknown>).token).toBe('token-newest')
    })

    it('adoption over exactly one candidate adopts it and mints none; over zero candidates mints exactly one (R078 empty edge)', async () => {
      const { getDoc, getDocs } = await import('firebase/firestore')
      const { useServiceStore } = await import('../services')
      const store = useServiceStore()
      store.subscribe('org-1')

      // Zero candidates: mints exactly one.
      const virginService = makeService({ id: 'service-1' }) as unknown as Service
      vi.mocked(getDoc).mockResolvedValueOnce({ exists: () => false, data: () => ({}) } as never)
      // getDocs default (empty) applies.
      const mintedToken = await store.ensureShareLink(virginService, 'org-1')
      expect(mintedToken).toHaveLength(36)
      expect(mintedToken).toMatch(/^[0-9a-f]{36}$/)

      // Exactly one candidate: adopts it, mints none. Captured mintedToken
      // above is the value the deterministic mint stub would produce — the
      // meaningful comparison below proves this path did NOT mint.
      const otherService = makeService({ id: 'service-2' }) as unknown as Service
      vi.mocked(getDoc).mockResolvedValueOnce({ exists: () => false, data: () => ({}) } as never)
      vi.mocked(getDocs).mockResolvedValueOnce({
        empty: false,
        docs: [
          { id: 'the-only-candidate', data: () => ({ serviceId: 'service-2', orgId: 'org-1', createdAt: { seconds: 1 } }) },
        ],
      } as never)
      const adoptedToken = await store.ensureShareLink(otherService, 'org-1')

      expect(adoptedToken).toBe('the-only-candidate')
      expect(adoptedToken).not.toBe(mintedToken)
    })

    it('an adopted token is used verbatim as the document id (R077 encoding edge)', async () => {
      const { getDoc, getDocs, setDoc } = await import('firebase/firestore')
      const { useServiceStore } = await import('../services')
      const store = useServiceStore()
      store.subscribe('org-1')
      const service = makeService() as unknown as Service

      const mixedCaseId = 'AbC-123_XyZ.legacyToken'
      vi.mocked(getDoc).mockResolvedValueOnce({ exists: () => false, data: () => ({}) } as never)
      vi.mocked(getDocs).mockResolvedValueOnce({
        empty: false,
        docs: [{ id: mixedCaseId, data: () => ({ serviceId: 'service-1', orgId: 'org-1', createdAt: { seconds: 1 } }) }],
      } as never)

      const token = await store.ensureShareLink(service, 'org-1')

      // Any case-folding, trimming or normalization on the write path shows
      // up here as an inequality — and would break ShareView's read path,
      // which uses the route parameter verbatim.
      expect(token).toBe(mixedCaseId)
      const [docRef] = vi.mocked(setDoc).mock.calls[0]!
      expect((docRef as { id: string }).id).toBe(mixedCaseId)
    })

    it('the adoption query is equality-only (no composite index)', async () => {
      const { getDoc, where, orderBy, limit } = await import('firebase/firestore')
      const { useServiceStore } = await import('../services')
      const store = useServiceStore()
      store.subscribe('org-1') // legitimately calls orderBy once for the services listener
      vi.mocked(orderBy).mockClear()

      const service = makeService() as unknown as Service
      vi.mocked(getDoc).mockResolvedValueOnce({ exists: () => false, data: () => ({}) } as never)
      // getDocs default (empty) applies.

      await store.ensureShareLink(service, 'org-1')

      expect(where).toHaveBeenCalledWith('serviceId', '==', 'service-1')
      expect(orderBy).not.toHaveBeenCalled()
      expect(limit).not.toHaveBeenCalled()
    })

    it('no write is ever issued against the service document (T-41-01)', async () => {
      const { getDoc, updateDoc, setDoc } = await import('firebase/firestore')
      const { useServiceStore } = await import('../services')
      const store = useServiceStore()
      store.subscribe('org-1')
      const service = makeService() as unknown as Service
      vi.mocked(getDoc).mockResolvedValueOnce({ exists: () => false, data: () => ({}) } as never)

      await store.ensureShareLink(service, 'org-1')

      // Assert the ABSENCE, not merely the presence of the two forward
      // writes — a write-back that also performed the forward writes would
      // pass a presence-only assertion.
      for (const [ref] of vi.mocked(updateDoc).mock.calls) {
        expect((ref as { path?: string }).path ?? '').not.toContain('services')
      }
      for (const [ref] of vi.mocked(setDoc).mock.calls) {
        expect((ref as { path?: string }).path ?? '').not.toContain('services')
      }
    })

    it('the PII guard holds on the create path (T-41-03, ROADMAP criterion 5)', async () => {
      const { getDoc, setDoc } = await import('firebase/firestore')
      const { useServiceStore } = await import('../services')
      const store = useServiceStore()
      store.subscribe('org-1')
      const service = makeService() as unknown as Service
      vi.mocked(getDoc).mockResolvedValueOnce({ exists: () => false, data: () => ({}) } as never)

      await store.ensureShareLink(service, 'org-1')

      // The roster mock deliberately carries email and phone on both people,
      // so this fails loudly if buildServiceSnapshot ever starts embedding a
      // raw Person.
      const [, data] = vi.mocked(setDoc).mock.calls[0]!
      const serialized = JSON.stringify(data)
      expect(serialized).not.toMatch(/email/i)
      expect(serialized).not.toMatch(/phone/i)
      expect(serialized).not.toMatch(/pcPersonId/i)
    })

    it('concurrent first-share convergence: a link created mid-flight wins over the local mint (backstop)', async () => {
      const { getDoc, setDoc } = await import('firebase/firestore')
      const { useServiceStore } = await import('../services')
      const store = useServiceStore()
      store.subscribe('org-1')
      const service = makeService() as unknown as Service

      vi.mocked(getDoc).mockResolvedValueOnce({ exists: () => false, data: () => ({}) } as never)
      // getDocs default (empty) applies — the local mint happens before the
      // transaction runs. The other client's write landing between the outer
      // read and the transaction is simulated by overriding the
      // transaction's OWN get spy, not the outer getDoc.
      mockTxGet.mockResolvedValueOnce({
        exists: () => true,
        data: () => ({ token: 'winner-token', orgId: 'org-1', serviceId: 'service-1' }),
      } as never)

      const token = await store.ensureShareLink(service, 'org-1')

      expect(token).toBe('winner-token')
      expect(mockTxSet).not.toHaveBeenCalled()
      const [docRef] = vi.mocked(setDoc).mock.calls[0]!
      expect((docRef as { id: string }).id).toBe('winner-token')
    })
  })

  // ── R077 (41-04) — share-link auto-refresh on updateService/setRoleOverride/
  // clearRoleOverride ───────────────────────────────────────────────────────
  //
  // getDoc responses are queued in CALL ORDER: maybeRefreshShareLink's own
  // serviceShareLinks/{id} read is queued explicitly per case (shared vs.
  // unshared). The NEXT getDoc call is writeSharePayload's memorable-URL org
  // read, which is left to the mock's shared default (exists: true,
  // { name: 'Grace Church', slug: 'grace-church' }) unless a case says
  // otherwise — so it needs no explicit queuing for the ordinary shared cases.
  describe('share-link auto-refresh (R077)', () => {
    const EXISTING_LINK = { exists: () => true, data: () => ({ token: 'tok-existing', orgId: 'org-1', serviceId: 'service-1' }) }
    const NO_LINK = { exists: () => false, data: () => ({}) }

    it('updateService refreshes the payload with the new data (ROADMAP criterion 2)', async () => {
      const { getDoc, setDoc } = await import('firebase/firestore')
      const { useServiceStore } = await import('../services')
      const store = useServiceStore()
      store.subscribe('org-1')
      triggerSnapshot([makeService({ notes: 'original notes' })])

      vi.mocked(getDoc).mockResolvedValueOnce(EXISTING_LINK as never)

      await store.updateService('service-1', { notes: 'a different value' })

      const [docRef, data] = vi.mocked(setDoc).mock.calls[0]!
      expect((docRef as { id: string }).id).toBe('tok-existing')
      const snapshot = (data as Record<string, unknown>).serviceSnapshot as Record<string, unknown>
      expect(snapshot.notes).toBe('a different value')
    })

    it("setRoleOverride refreshes the payload with the new override (R077)", async () => {
      const { getDoc, setDoc } = await import('firebase/firestore')
      const { useServiceStore } = await import('../services')
      const store = useServiceStore()
      store.subscribe('org-1')
      triggerSnapshot([makeService()])

      vi.mocked(getDoc).mockResolvedValueOnce(EXISTING_LINK as never)

      await store.setRoleOverride('service-1', 'role-guitar', ['person-2'])

      const [, data] = vi.mocked(setDoc).mock.calls[0]!
      const snapshot = (data as Record<string, unknown>).serviceSnapshot as Record<string, unknown>
      const roleAssignments = snapshot.roleAssignments as Array<{ roleId: string; personNames: string[] }>
      const guitar = roleAssignments.find((r) => r.roleId === 'role-guitar')
      expect(guitar?.personNames).toEqual(['Bob Jones'])
    })

    it('clearRoleOverride refreshes the payload back to the schedule, with no sentinel leaking through', async () => {
      const { getDoc, setDoc } = await import('firebase/firestore')
      const { useServiceStore } = await import('../services')
      const store = useServiceStore()
      store.subscribe('org-1')
      triggerSnapshot([
        makeService({ roleAssignmentOverrides: { 'role-guitar': ['person-2'] } } as never),
      ])

      vi.mocked(getDoc).mockResolvedValueOnce(EXISTING_LINK as never)

      await store.clearRoleOverride('service-1', 'role-guitar')

      const [, data] = vi.mocked(setDoc).mock.calls[0]!
      const snapshot = (data as Record<string, unknown>).serviceSnapshot as Record<string, unknown>
      const roleAssignments = snapshot.roleAssignments as Array<{ roleId: string; personNames: string[] }>
      const guitar = roleAssignments.find((r) => r.roleId === 'role-guitar')
      // role-guitar's schedule for 2026-03-08 is ['person-1'] -> Alice Smith.
      expect(guitar?.personNames).toEqual(['Alice Smith'])
      expect(JSON.stringify(data)).not.toContain('__DELETE_FIELD_SENTINEL__')
    })

    it('T-41-02: the only services write is the user\'s own save — no write-back — while the two forward share writes DO happen', async () => {
      const { getDoc, updateDoc, setDoc } = await import('firebase/firestore')
      const { useServiceStore } = await import('../services')
      const store = useServiceStore()
      store.subscribe('org-1')
      triggerSnapshot([makeService()])

      vi.mocked(getDoc).mockResolvedValueOnce(EXISTING_LINK as never)

      await store.updateService('service-1', { notes: 'edited' })

      // The forward writes happened — this case must not pass by the
      // refresh silently doing nothing.
      expect(setDoc).toHaveBeenCalledTimes(2) // shareTokens + serviceShares

      // The ONLY services write is the user's own save.
      expect(updateDoc).toHaveBeenCalledTimes(1)
      const [updateDocRef] = vi.mocked(updateDoc).mock.calls[0]!
      expect((updateDocRef as { path: string }).path).toContain('services')

      // Neither setDoc call targeted a services path.
      for (const [ref] of vi.mocked(setDoc).mock.calls) {
        expect((ref as { path?: string }).path ?? '').not.toContain('organizations/org-1/services')
      }
    })

    it('T-41-03: the PII guard holds on the REFRESH path (ROADMAP criterion 5)', async () => {
      const { getDoc, setDoc } = await import('firebase/firestore')
      const { useServiceStore } = await import('../services')
      const store = useServiceStore()
      store.subscribe('org-1')
      triggerSnapshot([makeService()])

      vi.mocked(getDoc).mockResolvedValueOnce(EXISTING_LINK as never)

      await store.updateService('service-1', { notes: 'edited' })

      // First setDoc call is the refresh's shareTokens write.
      const [, data] = vi.mocked(setDoc).mock.calls[0]!
      const serialized = JSON.stringify(data)
      expect(serialized).not.toMatch(/email/i)
      expect(serialized).not.toMatch(/phone/i)
      expect(serialized).not.toMatch(/pcPersonId/i)
    })

    it('empty-service edge: empty slots and zero roles/people still write a valid snapshot with no throw', async () => {
      const { getDoc, setDoc } = await import('firebase/firestore')
      const { useRosterStore } = await import('@/stores/roster')
      const { useServiceStore } = await import('../services')
      vi.mocked(useRosterStore).mockReturnValueOnce({ people: [], roles: [] } as never)

      const store = useServiceStore()
      store.subscribe('org-1')
      triggerSnapshot([makeService({ slots: [] })])

      vi.mocked(getDoc).mockResolvedValueOnce(EXISTING_LINK as never)

      await expect(store.updateService('service-1', { notes: 'edited' })).resolves.not.toThrow()

      const [, data] = vi.mocked(setDoc).mock.calls[0]!
      const snapshot = (data as Record<string, unknown>).serviceSnapshot as Record<string, unknown>
      expect(snapshot.slots).toEqual([])
      expect(snapshot.roleAssignments).toEqual([])
    })

    it('idempotency edge: two consecutive refreshes with no intervening change write the same serviceSnapshot content', async () => {
      const { getDoc, setDoc } = await import('firebase/firestore')
      const { useServiceStore } = await import('../services')
      const store = useServiceStore()
      store.subscribe('org-1')
      triggerSnapshot([makeService()])

      vi.mocked(getDoc).mockResolvedValueOnce(EXISTING_LINK as never)
      await store.updateService('service-1', {})
      const [, data1] = vi.mocked(setDoc).mock.calls[0]!
      const payload1 = data1 as Record<string, unknown>

      // Second refresh: the token is now cached, so no second serviceShareLinks
      // read is queued — the cached path is exercised here.
      await store.updateService('service-1', {})
      const [, data2] = vi.mocked(setDoc).mock.calls[2]! // 0,1 = first refresh's two writes; 2 = second refresh's shareTokens write
      const payload2 = data2 as Record<string, unknown>

      expect(payload2.serviceSnapshot).toEqual(payload1.serviceSnapshot)
      expect(payload1.updatedAt).toBeDefined()
      expect(payload2.updatedAt).toBeDefined()
    })

    it('single-write / atomicity edge: exactly one setDoc targets shareTokens and exactly one targets serviceShares per refresh', async () => {
      const { getDoc, setDoc } = await import('firebase/firestore')
      const { useServiceStore } = await import('../services')
      const store = useServiceStore()
      store.subscribe('org-1')
      triggerSnapshot([makeService()])

      vi.mocked(getDoc).mockResolvedValueOnce(EXISTING_LINK as never)

      await store.updateService('service-1', { notes: 'edited' })

      expect(setDoc).toHaveBeenCalledTimes(2)
      const paths = vi.mocked(setDoc).mock.calls.map(([ref]) => (ref as { path?: string }).path ?? '')
      expect(paths.filter((p) => p.includes('shareTokens'))).toHaveLength(1)
      expect(paths.filter((p) => p.includes('serviceShares'))).toHaveLength(1)
    })

    it('an unshared service pays nothing per write: no share write, and getDoc is called at most once across two calls', async () => {
      const { getDoc, setDoc } = await import('firebase/firestore')
      const { useServiceStore } = await import('../services')
      const store = useServiceStore()
      store.subscribe('org-1')
      triggerSnapshot([makeService()])

      vi.mocked(getDoc).mockResolvedValueOnce(NO_LINK as never)

      await store.updateService('service-1', { notes: 'first edit' })
      await store.updateService('service-1', { notes: 'second edit' })

      expect(setDoc).not.toHaveBeenCalled()
      expect(vi.mocked(getDoc).mock.calls.length).toBeLessThanOrEqual(1)
    })

    it('an ordinary edit never creates a share link — the transaction set spy is never called', async () => {
      const { getDoc } = await import('firebase/firestore')
      const { useServiceStore } = await import('../services')
      const store = useServiceStore()
      store.subscribe('org-1')
      triggerSnapshot([makeService()])

      vi.mocked(getDoc).mockResolvedValueOnce(NO_LINK as never)

      await store.updateService('service-1', { notes: 'edited' })

      expect(mockTxSet).not.toHaveBeenCalled()
    })

    // Split into two independent cases, each with its own fresh Pinia
    // instance: after a refresh failure, maybeRefreshShareLink deliberately
    // caches `false` for that service (T-41-13, unbounded-retry guard), so a
    // second refresh attempt on the SAME store instance would short-circuit
    // before ever calling setDoc or console.error again — that's the correct
    // production behavior, but it would make a shared-store version of this
    // test pass or fail for the wrong reason.
    it('soft-fail (WR-06): a rejected refresh write still lets updateService resolve, and logs console.error', async () => {
      const { getDoc, setDoc } = await import('firebase/firestore')
      const { useServiceStore } = await import('../services')
      const store = useServiceStore()
      store.subscribe('org-1')
      triggerSnapshot([makeService()])

      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      vi.mocked(getDoc).mockResolvedValueOnce(EXISTING_LINK as never)
      vi.mocked(setDoc).mockImplementationOnce(() => Promise.reject(new Error('shareTokens write failed')))

      const resolvedValue = await store.updateService('service-1', { notes: 'edited' })
      expect(resolvedValue).toBeUndefined() // resolved, not rejected
      expect(consoleErrorSpy).toHaveBeenCalled()

      consoleErrorSpy.mockRestore()
    })

    it('soft-fail (WR-06): a rejected refresh write still lets setRoleOverride resolve, and logs console.error', async () => {
      setActivePinia(createPinia())
      vi.clearAllMocks()
      snapshotCallback = null
      snapshotOptions = undefined

      const { getDoc, setDoc } = await import('firebase/firestore')
      const { useServiceStore } = await import('../services')
      const store = useServiceStore()
      store.subscribe('org-1')
      triggerSnapshot([makeService()])

      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      vi.mocked(getDoc).mockResolvedValueOnce(EXISTING_LINK as never)
      vi.mocked(setDoc).mockImplementationOnce(() => Promise.reject(new Error('shareTokens write failed')))

      const roleResolvedValue = await store.setRoleOverride('service-1', 'role-guitar', ['person-2'])
      expect(roleResolvedValue).toBeUndefined()
      expect(consoleErrorSpy).toHaveBeenCalled()

      consoleErrorSpy.mockRestore()
    })

    // WR-02 (41-REVIEW): before this fix, ANY refresh error — transient or
    // permanent — permanently cached `false` for the service, so a single
    // network blip disabled refresh for the rest of the session. Now only a
    // genuine `permission-denied` does that; a transient error (no `.code`,
    // like a plain network Error) must NOT poison the cache, so the very
    // next edit gets a fresh retry instead of being silently skipped.
    it('WR-02: a TRANSIENT refresh failure (no permission-denied code) does not permanently disable refresh — the next edit retries', async () => {
      const { getDoc, setDoc } = await import('firebase/firestore')
      const { useServiceStore } = await import('../services')
      const store = useServiceStore()
      store.subscribe('org-1')
      triggerSnapshot([makeService()])

      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      // First attempt: link lookup succeeds, but the payload write itself
      // rejects with a plain (code-less) Error — a stand-in for a transient
      // network failure, not an authorization denial.
      vi.mocked(getDoc).mockResolvedValueOnce(EXISTING_LINK as never)
      vi.mocked(setDoc).mockImplementationOnce(() => Promise.reject(new Error('network blip')))

      await store.updateService('service-1', { notes: 'first edit' })
      expect(consoleErrorSpy).toHaveBeenCalledTimes(1)

      // Second attempt: the write succeeds this time. If the transient
      // failure above had (incorrectly) cached `false`, this second call
      // would short-circuit before ever reaching setDoc — asserting a
      // successful write here proves the cache was NOT poisoned.
      vi.mocked(setDoc).mockClear()

      await store.updateService('service-1', { notes: 'second edit' })
      expect(setDoc).toHaveBeenCalled()
      const [, data] = vi.mocked(setDoc).mock.calls[0]!
      const snapshot = (data as Record<string, unknown>).serviceSnapshot as Record<string, unknown>
      expect(snapshot.notes).toBe('second edit')

      consoleErrorSpy.mockRestore()
    })

    it('WR-02: a permission-denied refresh failure DOES permanently disable refresh for the session — a second edit does not retry', async () => {
      const { getDoc, setDoc } = await import('firebase/firestore')
      const { useServiceStore } = await import('../services')
      const store = useServiceStore()
      store.subscribe('org-1')
      triggerSnapshot([makeService()])

      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      vi.mocked(getDoc).mockResolvedValueOnce(EXISTING_LINK as never)
      const denied = Object.assign(new Error('Missing or insufficient permissions'), { code: 'permission-denied' })
      vi.mocked(setDoc).mockImplementationOnce(() => Promise.reject(denied))

      await store.updateService('service-1', { notes: 'first edit' })
      expect(consoleErrorSpy).toHaveBeenCalledTimes(1)

      vi.mocked(setDoc).mockClear()
      vi.mocked(getDoc).mockClear()

      await store.updateService('service-1', { notes: 'second edit' })
      // Cached `false` short-circuits BEFORE the write (and before another
      // getDoc lookup) — neither should have been called this time.
      expect(setDoc).not.toHaveBeenCalled()
      expect(getDoc).not.toHaveBeenCalled()

      consoleErrorSpy.mockRestore()
    })

    it('status-only transitions (markAsPlanned, reopenService) do NOT refresh the share payload', async () => {
      const { setDoc } = await import('firebase/firestore')
      const { useServiceStore } = await import('../services')
      const store = useServiceStore()
      store.subscribe('org-1')
      triggerSnapshot([makeService({ status: 'draft' })])

      await store.markAsPlanned('service-1')
      expect(setDoc).not.toHaveBeenCalled()

      triggerSnapshot([makeService({ status: 'planned' })])
      await store.reopenService('service-1')
      expect(setDoc).not.toHaveBeenCalled()
    })
  })

  // ── R036 / R037 — the store's draft-only write guard + status transitions ────
  //
  // Layer 2 of 3. These assertions deliberately mirror the `/services`
  // `allow update` clause in firestore.rules shape-for-shape: the guard exists
  // to make a client-side bug legible locally, so if it ever drifts from the
  // rule it becomes either a phantom lock or an opaque round-trip failure.
  //
  // Every "refused" case asserts `updateDoc` was NOT called, not merely that
  // the promise rejected — a guard that throws AFTER writing is no guard.
  describe('draft-only write guard (R036)', () => {
    async function storeAtStatus(status: 'draft' | 'planned' | 'exported', extra = {}) {
      const { useServiceStore } = await import('../services')
      const store = useServiceStore()
      store.subscribe('org-1')
      triggerSnapshot([makeService({ status, ...extra })])
      return store
    }

    it('allows an ordinary update while the stored status is draft', async () => {
      const { updateDoc } = await import('firebase/firestore')
      const store = await storeAtStatus('draft')

      await store.updateService('service-1', { notes: 'edited' })

      expect(updateDoc).toHaveBeenCalledOnce()
    })

    for (const status of ['planned', 'exported'] as const) {
      it(`refuses an ordinary update locally when the stored status is ${status}`, async () => {
        const { updateDoc } = await import('firebase/firestore')
        const store = await storeAtStatus(status)

        await expect(store.updateService('service-1', { notes: 'edited' })).rejects.toThrow(
          /R036/,
        )
        expect(updateDoc).not.toHaveBeenCalled()
      })
    }

    // The status is read from the STORED snapshot, never from the payload —
    // otherwise any write that also sets `status: 'draft'` would edit a locked
    // service, which is precisely the payload an attacker would send. The
    // reopen carve-out is why `{ status: 'draft' }` ALONE is allowed; adding a
    // second key must not inherit that permission.
    it('refuses a locked update that smuggles other fields alongside status: draft', async () => {
      const { updateDoc } = await import('firebase/firestore')
      const store = await storeAtStatus('exported')

      await expect(
        store.updateService('service-1', { status: 'draft', slots: [] }),
      ).rejects.toThrow(/R036/)
      expect(updateDoc).not.toHaveBeenCalled()
    })

    it('allows the reopen-shaped update (status alone) at planned and exported', async () => {
      const { updateDoc } = await import('firebase/firestore')
      const store = await storeAtStatus('exported')

      await store.updateService('service-1', { status: 'draft' })

      expect(updateDoc).toHaveBeenCalledOnce()
    })

    // ★ D-09 — if this ever fails, `exported` has become unreachable and the
    // primary Planning Center workflow is broken.
    it('allows the Planning Center export write from planned (D-09)', async () => {
      const { updateDoc } = await import('firebase/firestore')
      const store = await storeAtStatus('planned')

      await store.updateService('service-1', {
        pcExportedAt: { seconds: 1, nanoseconds: 0 },
        pcPlanId: 'plan-1',
        status: 'exported',
      })

      expect(updateDoc).toHaveBeenCalledOnce()
    })

    it('refuses an export-shaped write from an already-exported service', async () => {
      const { updateDoc } = await import('firebase/firestore')
      const store = await storeAtStatus('exported')

      await expect(
        store.updateService('service-1', {
          pcExportedAt: { seconds: 1, nanoseconds: 0 },
          pcPlanId: 'plan-2',
          status: 'exported',
        }),
      ).rejects.toThrow(/R036/)
      expect(updateDoc).not.toHaveBeenCalled()
    })

    // D-15 — delete stays available at every status; the UI warns instead.
    // Keep in step with firestore.rules' unconditional `allow delete`.
    for (const status of ['draft', 'planned', 'exported'] as const) {
      it(`allows delete while the stored status is ${status} (D-15)`, async () => {
        const { deleteDoc } = await import('firebase/firestore')
        const store = await storeAtStatus(status)

        await store.deleteService('service-1')

        expect(deleteDoc).toHaveBeenCalledOnce()
      })
    }

    // ★ The Roles tab does not go through updateService. Without these two the
    // store layer does not cover it at all.
    it('refuses setRoleOverride on a locked service', async () => {
      const { updateDoc } = await import('firebase/firestore')
      const store = await storeAtStatus('planned')

      await expect(store.setRoleOverride('service-1', 'role-1', ['p1'])).rejects.toThrow(/R036/)
      expect(updateDoc).not.toHaveBeenCalled()
    })

    it('refuses clearRoleOverride on a locked service', async () => {
      const { updateDoc } = await import('firebase/firestore')
      const store = await storeAtStatus('exported')

      await expect(store.clearRoleOverride('service-1', 'role-1')).rejects.toThrow(/R036/)
      expect(updateDoc).not.toHaveBeenCalled()
    })

    it('still allows setRoleOverride and clearRoleOverride on a draft service', async () => {
      const { updateDoc } = await import('firebase/firestore')
      const store = await storeAtStatus('draft')

      await store.setRoleOverride('service-1', 'role-1', ['p1'])
      await store.clearRoleOverride('service-1', 'role-1')

      expect(updateDoc).toHaveBeenCalledTimes(2)
    })
  })

  describe('status transitions (R037)', () => {
    async function storeAtStatus(status: 'draft' | 'planned' | 'exported', extra = {}) {
      const { useServiceStore } = await import('../services')
      const store = useServiceStore()
      store.subscribe('org-1')
      triggerSnapshot([makeService({ status, ...extra })])
      return store
    }

    it('markAsPlanned writes status and updatedAt, and nothing else', async () => {
      const { updateDoc } = await import('firebase/firestore')
      const store = await storeAtStatus('draft')

      await store.markAsPlanned('service-1')

      const data = vi.mocked(updateDoc).mock.calls[0]![1] as unknown as Record<string, unknown>
      expect(Object.keys(data).sort()).toEqual(['status', 'updatedAt'])
      expect(data.status).toBe('planned')
    })

    for (const status of ['planned', 'exported'] as const) {
      it(`markAsPlanned refuses when the stored status is already ${status}`, async () => {
        const { updateDoc } = await import('firebase/firestore')
        const store = await storeAtStatus(status)

        await expect(store.markAsPlanned('service-1')).rejects.toThrow(/R036/)
        expect(updateDoc).not.toHaveBeenCalled()
      })
    }

    // ★ D-11 — the rule's hasOnly(['status','updatedAt']) reads affectedKeys().
    // Re-writing pcExportedAt/pcPlanId here, even to their existing values, can
    // surface in that diff and get the whole reopen denied. The fields survive
    // by being left alone, which is also what keeps the Planning Center plan
    // linked for a re-export and what D-04's evidence gate reads on a SECOND
    // reopen. This test is the guard against a future "let's also clear the
    // export fields" edit.
    it('reopenService writes ONLY status and updatedAt — never pcExportedAt/pcPlanId', async () => {
      const { updateDoc } = await import('firebase/firestore')
      const store = await storeAtStatus('exported', {
        pcExportedAt: { seconds: 5, nanoseconds: 0 },
        pcPlanId: 'plan-9',
      })

      await store.reopenService('service-1')

      const data = vi.mocked(updateDoc).mock.calls[0]![1] as unknown as Record<string, unknown>
      expect(Object.keys(data).sort()).toEqual(['status', 'updatedAt'])
      expect(data.status).toBe('draft')
      expect(data).not.toHaveProperty('pcExportedAt')
      expect(data).not.toHaveProperty('pcPlanId')
    })

    it('reopenService works from planned as well as exported', async () => {
      const { updateDoc } = await import('firebase/firestore')
      const store = await storeAtStatus('planned')

      await store.reopenService('service-1')

      expect(updateDoc).toHaveBeenCalledOnce()
    })

    it('there is no generic status setter on the store (D-03)', async () => {
      const { useServiceStore } = await import('../services')
      const store = useServiceStore()
      // `exported` must be reachable ONLY through a real Planning Center
      // export. A setStatus/toggleStatus escape hatch would re-admit the
      // hand-set "Exported" defect D-01 deletes.
      expect(store).not.toHaveProperty('setStatus')
      expect(store).not.toHaveProperty('toggleStatus')
    })
  })
})
