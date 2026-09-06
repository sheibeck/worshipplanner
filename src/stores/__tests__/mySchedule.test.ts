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

  // ── Phase 130 (R403/R405): distinct-church derivation + client-side filter ──
  describe('churches / selectedChurch / filteredDocs (Phase 130)', () => {
    it('churches over docs from two distinct orgIds returns two entries, first-occurrence order', async () => {
      mockAuth.currentUser = { email: 'dana@example.com' }
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
      mockAuth.currentUser = { email: 'dana@example.com' }
      mockGetDocs.mockResolvedValue({
        docs: [fakeSnapDoc({ serviceId: 'svc1', serviceDate: '2026-09-10', orgName: 'Grace Church' }, 'orgA')],
      })

      const single = useMyScheduleStore()
      await single.loadMySchedule()
      expect(single.churches).toEqual([{ orgId: 'orgA', orgName: 'Grace Church' }])
      // R405 gate: a single-church volunteer's church count is <= 1.
      expect(single.churches.length).toBeLessThanOrEqual(1)

      setActivePinia(createPinia())
      mockGetDocs.mockResolvedValue({ docs: [] })
      const empty = useMyScheduleStore()
      await empty.loadMySchedule()
      expect(empty.churches).toEqual([])
    })

    it('a doc whose orgName is absent still yields a churches entry with orgName undefined — no crash', async () => {
      mockAuth.currentUser = { email: 'dana@example.com' }
      mockGetDocs.mockResolvedValue({
        docs: [fakeSnapDoc({ serviceId: 'svc1', serviceDate: '2026-09-10' }, 'orgA')],
      })

      const store = useMyScheduleStore()
      await store.loadMySchedule()

      expect(store.churches).toEqual([{ orgId: 'orgA', orgName: undefined }])
    })

    it('filteredDocs returns all docs when selectedChurch is null, else only docs matching the orgId', async () => {
      mockAuth.currentUser = { email: 'dana@example.com' }
      mockGetDocs.mockResolvedValue({
        docs: [
          fakeSnapDoc({ serviceId: 'svc1', serviceDate: '2026-09-10' }, 'orgA'),
          fakeSnapDoc({ serviceId: 'svc2', serviceDate: '2026-09-17' }, 'orgB'),
        ],
      })

      const store = useMyScheduleStore()
      await store.loadMySchedule()

      expect(store.filteredDocs).toHaveLength(2)

      store.selectedChurch = 'orgA'
      expect(store.filteredDocs).toHaveLength(1)
      expect(store.filteredDocs[0]).toMatchObject({ serviceId: 'svc1', orgId: 'orgA' })
    })

    it('a stale selectedChurch that no longer appears among the new docs orgIds is reset to null on reload', async () => {
      mockAuth.currentUser = { email: 'dana@example.com' }
      mockGetDocs.mockResolvedValueOnce({
        docs: [
          fakeSnapDoc({ serviceId: 'svc1', serviceDate: '2026-09-10' }, 'orgA'),
          fakeSnapDoc({ serviceId: 'svc2', serviceDate: '2026-09-17' }, 'orgB'),
        ],
      })

      const store = useMyScheduleStore()
      await store.loadMySchedule()
      store.selectedChurch = 'orgB'
      expect(store.filteredDocs).toHaveLength(1)

      // Reload drops orgB entirely (e.g. that assignment no longer exists).
      mockGetDocs.mockResolvedValueOnce({
        docs: [fakeSnapDoc({ serviceId: 'svc1', serviceDate: '2026-09-10' }, 'orgA')],
      })
      await store.loadMySchedule()

      expect(store.selectedChurch).toBeNull()
      expect(store.filteredDocs).toHaveLength(1)
    })

    it('never imports @/stores/auth or calls selectOrg — filters already-loaded docs only', async () => {
      const fs = await import('node:fs/promises')
      const path = await import('node:path')
      const source = await fs.readFile(path.resolve(process.cwd(), 'src/stores/mySchedule.ts'), 'utf-8')
      // Match real import/call sites, not this file's own prohibition
      // comments (which name both strings as anti-patterns to avoid).
      expect(/from ['"]@\/stores\/auth['"]/.test(source)).toBe(false)
      expect(/\bselectOrg\s*\(/.test(source)).toBe(false)
    })
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
