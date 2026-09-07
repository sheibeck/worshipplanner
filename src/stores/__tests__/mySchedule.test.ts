import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

// R378 (126-01-SUMMARY.md) — the collection-group list rule REQUIRES both
// where('status','==','planned') AND
// where('assignedEmailsLower','array-contains', ownEmailLower); either
// filter missing means Firestore denies the whole request. These tests
// inspect the actual where() call args to prove both are present, and that
// the array-contains value is always lowercased (Pitfall 2).
const mockGetDocs = vi.fn()
const mockWhere = vi.fn((field: string, op: string, value: unknown) => ({ field, op, value }))
const mockOrderBy = vi.fn((field: string, direction: string) => ({ field, direction }))
const mockCollectionGroup = vi.fn((_db: unknown, path: string) => ({ path }))
const mockQuery = vi.fn((...args: unknown[]) => ({ args }))
// Phase 130 rework (Change A) — the live subscription path. Each subscribe()
// gets its own unsubscribe spy (pushed in call order) so a test can assert
// exactly which listeners were created and torn down.
const mockUnsubs: ReturnType<typeof vi.fn>[] = []
const mockOnSnapshot = vi.fn(() => {
  const unsub = vi.fn()
  mockUnsubs.push(unsub)
  return unsub
})

vi.mock('firebase/firestore', () => ({
  collectionGroup: (...args: unknown[]) => mockCollectionGroup(...(args as [unknown, string])),
  query: (...args: unknown[]) => mockQuery(...args),
  where: (...args: unknown[]) => mockWhere(...(args as [string, string, unknown])),
  orderBy: (...args: unknown[]) => mockOrderBy(...(args as [string, string])),
  getDocs: (...args: unknown[]) => mockGetDocs(...args),
  onSnapshot: (...args: unknown[]) => mockOnSnapshot(...(args as [])),
}))

const mockAuth = vi.hoisted<{ currentUser: { email: string } | null }>(() => ({ currentUser: null }))
vi.mock('@/firebase', () => ({
  db: {},
  auth: mockAuth,
}))

import { useMyScheduleStore } from '@/stores/mySchedule'

function fakeSnapDoc(data: Record<string, unknown>, orgId: string) {
  return {
    data: () => data,
    ref: { parent: { parent: { id: orgId } } },
  }
}

// Invoke the onNext callback of the Nth onSnapshot() call with a fake snapshot,
// simulating a server push.
function emitSnapshot(callIndex: number, docs: unknown[]): void {
  const call = mockOnSnapshot.mock.calls[callIndex] as unknown as unknown[]
  const onNext = call[1] as (snap: { docs: unknown[] }) => void
  onNext({ docs })
}

function emitError(callIndex: number, err: unknown): void {
  const call = mockOnSnapshot.mock.calls[callIndex] as unknown as unknown[]
  const onError = call[2] as (err: unknown) => void
  onError(err)
}

describe('mySchedule store — loadMySchedule (one-shot getDocs fallback)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    mockUnsubs.length = 0
    mockAuth.currentUser = null
    localStorage.clear()
  })

  it('builds the array-contains filter from a lowercased signed-in email, alongside the required status=="planned" filter', async () => {
    mockAuth.currentUser = { email: 'Dana@Example.com' }
    mockGetDocs.mockResolvedValue({ docs: [] })

    const store = useMyScheduleStore()
    await store.loadMySchedule()

    expect(mockCollectionGroup).toHaveBeenCalledWith({}, 'rehearseAccess')
    expect(mockWhere).toHaveBeenCalledWith('status', '==', 'planned')
    expect(mockWhere).toHaveBeenCalledWith('assignedEmailsLower', 'array-contains', 'dana@example.com')
    expect(mockOrderBy).toHaveBeenCalledWith('serviceDate', 'asc')
    expect(store.error).toBeNull()
  })

  it('an absent/empty signed-in email returns [] without calling getDocs (no throw)', async () => {
    mockAuth.currentUser = null

    const store = useMyScheduleStore()
    await store.loadMySchedule()

    expect(mockGetDocs).not.toHaveBeenCalled()
    expect(store.docs).toEqual([])
    expect(store.isLoading).toBe(false)
    expect(store.error).toBeNull()
    // Zero churches ⇒ selection is null (the only case where it may be null).
    expect(store.selectedChurch).toBeNull()
  })

  it('an empty-string email also short-circuits without calling getDocs', async () => {
    mockAuth.currentUser = { email: '' }

    const store = useMyScheduleStore()
    await store.loadMySchedule()

    expect(mockGetDocs).not.toHaveBeenCalled()
    expect(store.docs).toEqual([])
  })

  it('maps each result doc to its data() plus orgId resolved from ref.parent.parent.id', async () => {
    mockAuth.currentUser = { email: 'dana@example.com' }
    mockGetDocs.mockResolvedValue({
      docs: [
        fakeSnapDoc({ serviceId: 'svc1', serviceDate: '2026-09-10', title: 'Sunday Service' }, 'orgA'),
        fakeSnapDoc({ serviceId: 'svc2', serviceDate: '2026-09-17', title: 'Second Service' }, 'orgB'),
      ],
    })

    const store = useMyScheduleStore()
    await store.loadMySchedule()

    expect(store.docs).toHaveLength(2)
    expect(store.docs[0]).toMatchObject({ serviceId: 'svc1', orgId: 'orgA' })
    expect(store.docs[1]).toMatchObject({ serviceId: 'svc2', orgId: 'orgB' })
  })

  it('a rejected getDocs sets error and leaves docs empty, without rethrowing', async () => {
    mockAuth.currentUser = { email: 'dana@example.com' }
    mockGetDocs.mockRejectedValue(new Error('permission-denied'))

    const store = useMyScheduleStore()
    await expect(store.loadMySchedule()).resolves.toBeUndefined()

    expect(store.docs).toEqual([])
    expect(store.error).toBeTruthy()
    expect(store.isLoading).toBe(false)
  })

  it('isLoading is true only while the query is in flight', async () => {
    mockAuth.currentUser = { email: 'dana@example.com' }
    let resolveGetDocs!: (value: { docs: unknown[] }) => void
    mockGetDocs.mockReturnValue(
      new Promise((resolve) => {
        resolveGetDocs = resolve
      }),
    )

    const store = useMyScheduleStore()
    const loadPromise = store.loadMySchedule()
    expect(store.isLoading).toBe(true)

    resolveGetDocs({ docs: [] })
    await loadPromise

    expect(store.isLoading).toBe(false)
  })
})

// ── Phase 130 (R403/R405 rework): single-church selection + persistence ──
describe('mySchedule store — churches / single-church selection', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    mockUnsubs.length = 0
    mockAuth.currentUser = { email: 'dana@example.com' }
    localStorage.clear()
  })

  it('churches over docs from two distinct orgIds returns two entries, first-occurrence order', async () => {
    mockGetDocs.mockResolvedValue({
      docs: [
        fakeSnapDoc({ serviceId: 'svc1', serviceDate: '2026-09-10', orgName: 'Grace Church' }, 'orgA'),
        fakeSnapDoc({ serviceId: 'svc2', serviceDate: '2026-09-17', orgName: 'Hope Chapel' }, 'orgB'),
        fakeSnapDoc({ serviceId: 'svc3', serviceDate: '2026-09-24', orgName: 'Grace Church' }, 'orgA'),
      ],
    })

    const store = useMyScheduleStore()
    await store.loadMySchedule()

    expect(store.churches).toEqual([
      { orgId: 'orgA', orgName: 'Grace Church' },
      { orgId: 'orgB', orgName: 'Hope Chapel' },
    ])
  })

  it('churches over one orgId returns one entry; over zero docs returns []', async () => {
    mockGetDocs.mockResolvedValue({
      docs: [fakeSnapDoc({ serviceId: 'svc1', serviceDate: '2026-09-10', orgName: 'Grace Church' }, 'orgA')],
    })

    const single = useMyScheduleStore()
    await single.loadMySchedule()
    expect(single.churches).toEqual([{ orgId: 'orgA', orgName: 'Grace Church' }])

    setActivePinia(createPinia())
    mockGetDocs.mockResolvedValue({ docs: [] })
    const empty = useMyScheduleStore()
    await empty.loadMySchedule()
    expect(empty.churches).toEqual([])
  })

  it('a doc whose orgName is absent still yields a churches entry with orgName undefined — no crash', async () => {
    mockGetDocs.mockResolvedValue({
      docs: [fakeSnapDoc({ serviceId: 'svc1', serviceDate: '2026-09-10' }, 'orgA')],
    })

    const store = useMyScheduleStore()
    await store.loadMySchedule()

    expect(store.churches).toEqual([{ orgId: 'orgA', orgName: undefined }])
  })

  it('selectedChurch DEFAULTS to the first church once docs load (never "all"/null when >=1 church)', async () => {
    mockGetDocs.mockResolvedValue({
      docs: [
        fakeSnapDoc({ serviceId: 'svc1', serviceDate: '2026-09-10' }, 'orgA'),
        fakeSnapDoc({ serviceId: 'svc2', serviceDate: '2026-09-17' }, 'orgB'),
      ],
    })

    const store = useMyScheduleStore()
    await store.loadMySchedule()

    expect(store.selectedChurch).toBe('orgA')
  })

  it('filteredDocs returns ONLY the selected church docs; empty when there are no churches', async () => {
    mockGetDocs.mockResolvedValue({
      docs: [
        fakeSnapDoc({ serviceId: 'svc1', serviceDate: '2026-09-10' }, 'orgA'),
        fakeSnapDoc({ serviceId: 'svc2', serviceDate: '2026-09-17' }, 'orgB'),
      ],
    })

    const store = useMyScheduleStore()
    await store.loadMySchedule()

    // Defaults to orgA — one doc.
    expect(store.filteredDocs).toHaveLength(1)
    expect(store.filteredDocs[0]).toMatchObject({ serviceId: 'svc1', orgId: 'orgA' })

    store.setSelectedChurch('orgB')
    expect(store.filteredDocs).toHaveLength(1)
    expect(store.filteredDocs[0]).toMatchObject({ serviceId: 'svc2', orgId: 'orgB' })
  })

  it('filteredDocs is empty when the volunteer has zero churches', async () => {
    mockGetDocs.mockResolvedValue({ docs: [] })

    const store = useMyScheduleStore()
    await store.loadMySchedule()

    expect(store.selectedChurch).toBeNull()
    expect(store.filteredDocs).toEqual([])
  })

  it('setSelectedChurch sets the selection and persists it to localStorage', async () => {
    mockGetDocs.mockResolvedValue({
      docs: [
        fakeSnapDoc({ serviceId: 'svc1', serviceDate: '2026-09-10' }, 'orgA'),
        fakeSnapDoc({ serviceId: 'svc2', serviceDate: '2026-09-17' }, 'orgB'),
      ],
    })

    const store = useMyScheduleStore()
    await store.loadMySchedule()

    store.setSelectedChurch('orgB')
    expect(store.selectedChurch).toBe('orgB')
    expect(localStorage.getItem('volunteerSelectedChurch')).toBe('orgB')
  })

  it('restores the persisted church on the next load when it is still present, else falls back to the first church', async () => {
    // A previous session persisted orgB.
    localStorage.setItem('volunteerSelectedChurch', 'orgB')
    mockGetDocs.mockResolvedValue({
      docs: [
        fakeSnapDoc({ serviceId: 'svc1', serviceDate: '2026-09-10' }, 'orgA'),
        fakeSnapDoc({ serviceId: 'svc2', serviceDate: '2026-09-17' }, 'orgB'),
      ],
    })

    const store = useMyScheduleStore()
    await store.loadMySchedule()
    expect(store.selectedChurch).toBe('orgB')

    // A persisted church no longer present falls back to the first church.
    localStorage.setItem('volunteerSelectedChurch', 'orgZ')
    setActivePinia(createPinia())
    const store2 = useMyScheduleStore()
    await store2.loadMySchedule()
    expect(store2.selectedChurch).toBe('orgA')
  })

  it('a stale selectedChurch no longer among the reloaded docs resets to the first church (not null)', async () => {
    mockGetDocs.mockResolvedValueOnce({
      docs: [
        fakeSnapDoc({ serviceId: 'svc1', serviceDate: '2026-09-10' }, 'orgA'),
        fakeSnapDoc({ serviceId: 'svc2', serviceDate: '2026-09-17' }, 'orgB'),
      ],
    })

    const store = useMyScheduleStore()
    await store.loadMySchedule()
    store.setSelectedChurch('orgB')
    expect(store.filteredDocs).toHaveLength(1)

    // Reload drops orgB entirely (e.g. that assignment no longer exists).
    mockGetDocs.mockResolvedValueOnce({
      docs: [fakeSnapDoc({ serviceId: 'svc1', serviceDate: '2026-09-10' }, 'orgA')],
    })
    await store.loadMySchedule()

    expect(store.selectedChurch).toBe('orgA')
    expect(store.filteredDocs).toHaveLength(1)
  })

  // 130-REVIEW CR-01: docs are ordered serviceDate asc, so a "first write
  // wins" dedupe locks onto whichever doc for an org is encountered first.
  // A defined orgName must win over an undefined one for the same orgId
  // regardless of which doc arrives first — proven in both doc orders so
  // this isn't accidentally passing on order alone.
  it('CR-01: a later same-org doc with a defined orgName upgrades an earlier doc whose orgName is undefined', async () => {
    mockGetDocs.mockResolvedValue({
      docs: [
        fakeSnapDoc({ serviceId: 'svc1', serviceDate: '2026-09-10' }, 'orgA'),
        fakeSnapDoc({ serviceId: 'svc2', serviceDate: '2026-09-17', orgName: 'Grace Church' }, 'orgA'),
      ],
    })

    const store = useMyScheduleStore()
    await store.loadMySchedule()

    expect(store.churches).toEqual([{ orgId: 'orgA', orgName: 'Grace Church' }])
  })

  it('CR-01: a defined orgName is never overwritten by a later same-org doc with an undefined orgName', async () => {
    mockGetDocs.mockResolvedValue({
      docs: [
        fakeSnapDoc({ serviceId: 'svc1', serviceDate: '2026-09-10', orgName: 'Grace Church' }, 'orgA'),
        fakeSnapDoc({ serviceId: 'svc2', serviceDate: '2026-09-17' }, 'orgA'),
      ],
    })

    const store = useMyScheduleStore()
    await store.loadMySchedule()

    expect(store.churches).toEqual([{ orgId: 'orgA', orgName: 'Grace Church' }])
  })

  it('never imports @/stores/auth or calls selectOrg — selects among already-loaded docs only', async () => {
    const fs = await import('node:fs/promises')
    const path = await import('node:path')
    const source = await fs.readFile(path.resolve(process.cwd(), 'src/stores/mySchedule.ts'), 'utf-8')
    // Match real import/call sites, not this file's own prohibition
    // comments (which name both strings as anti-patterns to avoid).
    expect(/from ['"]@\/stores\/auth['"]/.test(source)).toBe(false)
    expect(/\bselectOrg\s*\(/.test(source)).toBe(false)
  })
})

// ── Phase 130 (Change A): live onSnapshot subscription ──
describe('mySchedule store — subscribe/unsubscribe (live)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    mockUnsubs.length = 0
    mockAuth.currentUser = { email: 'Dana@Example.com' }
    localStorage.clear()
  })

  it('subscribe() opens an onSnapshot listener with both required filters (lowercased email)', () => {
    const store = useMyScheduleStore()
    store.subscribe()

    expect(mockOnSnapshot).toHaveBeenCalledTimes(1)
    expect(mockCollectionGroup).toHaveBeenCalledWith({}, 'rehearseAccess')
    expect(mockWhere).toHaveBeenCalledWith('status', '==', 'planned')
    expect(mockWhere).toHaveBeenCalledWith('assignedEmailsLower', 'array-contains', 'dana@example.com')
    expect(store.isLoading).toBe(true)
  })

  it('the first snapshot populates docs, defaults the selected church, and clears loading', () => {
    const store = useMyScheduleStore()
    store.subscribe()

    emitSnapshot(0, [
      fakeSnapDoc({ serviceId: 'svc1', serviceDate: '2026-09-10', orgName: 'Grace Church' }, 'orgA'),
    ])

    expect(store.docs).toHaveLength(1)
    expect(store.selectedChurch).toBe('orgA')
    expect(store.isLoading).toBe(false)
    expect(store.error).toBeNull()
  })

  it('a SECOND snapshot reflects an editor edit live, without a reload', () => {
    const store = useMyScheduleStore()
    store.subscribe()

    emitSnapshot(0, [fakeSnapDoc({ serviceId: 'svc1', serviceDate: '2026-09-10', title: 'Original' }, 'orgA')])
    expect(store.docs[0]).toMatchObject({ title: 'Original' })

    emitSnapshot(0, [fakeSnapDoc({ serviceId: 'svc1', serviceDate: '2026-09-10', title: 'Edited' }, 'orgA')])
    expect(store.docs).toHaveLength(1)
    expect(store.docs[0]).toMatchObject({ title: 'Edited' })
  })

  it('the onSnapshot error callback sets error, empties docs, and clears loading', () => {
    const store = useMyScheduleStore()
    store.subscribe()

    emitError(0, new Error('missing index'))

    expect(store.docs).toEqual([])
    expect(store.error).toBe('missing index')
    expect(store.isLoading).toBe(false)
  })

  it('subscribe() is idempotent — a second call tears down the prior listener first', () => {
    const store = useMyScheduleStore()
    store.subscribe()
    store.subscribe()

    expect(mockOnSnapshot).toHaveBeenCalledTimes(2)
    // The first listener's unsubscribe was invoked when the second subscribe ran.
    expect(mockUnsubs[0]).toHaveBeenCalledTimes(1)
    expect(mockUnsubs[1]).not.toHaveBeenCalled()
  })

  it('unsubscribe() tears down the active listener', () => {
    const store = useMyScheduleStore()
    store.subscribe()
    store.unsubscribe()

    expect(mockUnsubs[0]).toHaveBeenCalledTimes(1)
  })

  it('subscribe() with no signed-in email returns [] without opening a listener', () => {
    mockAuth.currentUser = null
    const store = useMyScheduleStore()
    store.subscribe()

    expect(mockOnSnapshot).not.toHaveBeenCalled()
    expect(store.docs).toEqual([])
    expect(store.isLoading).toBe(false)
    expect(store.selectedChurch).toBeNull()
  })
})
