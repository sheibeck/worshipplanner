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

vi.mock('firebase/firestore', () => ({
  collectionGroup: (...args: unknown[]) => mockCollectionGroup(...(args as [unknown, string])),
  query: (...args: unknown[]) => mockQuery(...args),
  where: (...args: unknown[]) => mockWhere(...(args as [string, string, unknown])),
  orderBy: (...args: unknown[]) => mockOrderBy(...(args as [string, string])),
  getDocs: (...args: unknown[]) => mockGetDocs(...args),
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

describe('mySchedule store — loadMySchedule', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    mockAuth.currentUser = null
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
