import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import type { Service } from '@/types/service'

// ── 139-01 Task 3 — R433 dual-builder projection (Pitfall 2/8) ──────────────
//
// buildServiceSnapshot (src/stores/services.ts) AND buildRehearseAccess
// (src/utils/rehearseAccess.ts) must BOTH carry rehearsals/reportTime, or
// ShareView/My Schedule/VolunteerServiceView silently show nothing with no
// compile error. Mirrors services.sharePii.test.ts's mock scaffold exactly.

vi.mock('firebase/firestore', () => ({
  getFirestore: vi.fn(() => ({})),
  collection: vi.fn(),
  doc: vi.fn(),
  onSnapshot: vi.fn(),
  addDoc: vi.fn(),
  updateDoc: vi.fn(),
  deleteDoc: vi.fn(),
  getDoc: vi.fn(),
  getDocs: vi.fn(),
  setDoc: vi.fn(),
  deleteField: vi.fn(),
  query: vi.fn(),
  orderBy: vi.fn(),
  where: vi.fn(),
  limit: vi.fn(),
  runTransaction: vi.fn(),
  serverTimestamp: vi.fn(),
  Timestamp: { fromMillis: vi.fn() },
}))

vi.mock('@/firebase', () => ({
  auth: {},
  db: {},
}))

vi.mock('@/stores/songs', () => ({
  useSongStore: vi.fn(() => ({
    songs: [],
  })),
}))

vi.mock('@/stores/roster', () => ({
  useRosterStore: vi.fn(() => ({
    people: [],
    roles: [],
  })),
}))

vi.mock('@/stores/quarters', () => ({
  useQuartersStore: vi.fn(() => ({
    quarters: [],
  })),
}))

function makeService(overrides: Partial<Service> = {}): Service {
  return {
    id: 'service-1',
    date: '2026-09-06',
    name: 'Sunday Service',
    progression: '1-2-2-3',
    teams: [],
    status: 'planned',
    slots: [],
    sermonPassage: null,
    notes: '',
    createdAt: { seconds: 1000000, nanoseconds: 0 } as never,
    updatedAt: { seconds: 1000000, nanoseconds: 0 } as never,
    ...overrides,
  }
}

describe('buildServiceSnapshot / buildRehearseAccess — rehearsals/reportTime projection (R433)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('both builders surface a known dated rehearsal value + reportTime', async () => {
    const { buildServiceSnapshot } = await import('../services')
    const { buildRehearseAccess } = await import('@/utils/rehearseAccess')

    const service = makeService({
      rehearsals: [{ id: 'r1', date: '2026-09-04', time: '19:00' }],
      reportTime: '08:00',
    }) as unknown as Service

    const snapshot = buildServiceSnapshot(service)
    expect(snapshot.rehearsals).toEqual([{ id: 'r1', date: '2026-09-04', time: '19:00' }])
    expect(snapshot.reportTime).toBe('08:00')

    const rehearseAccess = buildRehearseAccess(service, 'org-1', undefined, [], [], [], [])
    expect(rehearseAccess.rehearsals).toEqual([{ id: 'r1', date: '2026-09-04', time: '19:00' }])
    expect(rehearseAccess.reportTime).toBe('08:00')
  })

  it('both builders filter an undated rehearsal (date: "") out of the projection, but it remains on the raw Service doc', async () => {
    const { buildServiceSnapshot } = await import('../services')
    const { buildRehearseAccess } = await import('@/utils/rehearseAccess')

    const service = makeService({
      rehearsals: [
        { id: 'dated', date: '2026-09-04', time: '19:00' },
        { id: 'undated', date: '', time: '18:00' },
      ],
    }) as unknown as Service

    // Raw doc still carries both rows (editor reads this unfiltered).
    expect(service.rehearsals).toHaveLength(2)

    const snapshot = buildServiceSnapshot(service)
    expect(snapshot.rehearsals).toEqual([{ id: 'dated', date: '2026-09-04', time: '19:00' }])

    const rehearseAccess = buildRehearseAccess(service, 'org-1', undefined, [], [], [], [])
    expect(rehearseAccess.rehearsals).toEqual([{ id: 'dated', date: '2026-09-04', time: '19:00' }])
  })

  it('both builders filter a dated-but-timeless rehearsal (time: "") out of the projection (CR-01)', async () => {
    const { buildServiceSnapshot } = await import('../services')
    const { buildRehearseAccess } = await import('@/utils/rehearseAccess')

    const service = makeService({
      rehearsals: [
        { id: 'complete', date: '2026-09-04', time: '19:00' },
        { id: 'dated-timeless', date: '2026-09-11', time: '' },
      ],
    }) as unknown as Service

    const snapshot = buildServiceSnapshot(service)
    expect(snapshot.rehearsals).toEqual([{ id: 'complete', date: '2026-09-04', time: '19:00' }])

    const rehearseAccess = buildRehearseAccess(service, 'org-1', undefined, [], [], [], [])
    expect(rehearseAccess.rehearsals).toEqual([{ id: 'complete', date: '2026-09-04', time: '19:00' }])
  })

  it('both builders return rehearsals in chronological order even when the source array is out of order', async () => {
    const { buildServiceSnapshot } = await import('../services')
    const { buildRehearseAccess } = await import('@/utils/rehearseAccess')

    const service = makeService({
      rehearsals: [
        { id: 'later', date: '2026-09-11', time: '19:00' },
        { id: 'earlier', date: '2026-09-04', time: '19:00' },
      ],
    }) as unknown as Service

    const snapshot = buildServiceSnapshot(service)
    expect(snapshot.rehearsals?.map((r) => r.id)).toEqual(['earlier', 'later'])

    const rehearseAccess = buildRehearseAccess(service, 'org-1', undefined, [], [], [], [])
    expect(rehearseAccess.rehearsals?.map((r) => r.id)).toEqual(['earlier', 'later'])
  })

  it('an empty rehearsals array / unset reportTime is OMITTED from both projections, not written as [] / ""', async () => {
    const { buildServiceSnapshot } = await import('../services')
    const { buildRehearseAccess } = await import('@/utils/rehearseAccess')

    const service = makeService() as unknown as Service // no rehearsals/reportTime set

    const snapshot = buildServiceSnapshot(service)
    expect('rehearsals' in snapshot).toBe(false)
    expect('reportTime' in snapshot).toBe(false)

    const rehearseAccess = buildRehearseAccess(service, 'org-1', undefined, [], [], [], [])
    expect('rehearsals' in rehearseAccess).toBe(false)
    expect('reportTime' in rehearseAccess).toBe(false)
  })

  it('an all-undated rehearsals array is also OMITTED (not written as [])', async () => {
    const { buildServiceSnapshot } = await import('../services')
    const { buildRehearseAccess } = await import('@/utils/rehearseAccess')

    const service = makeService({
      rehearsals: [{ id: 'undated', date: '', time: '18:00' }],
    }) as unknown as Service

    const snapshot = buildServiceSnapshot(service)
    expect('rehearsals' in snapshot).toBe(false)

    const rehearseAccess = buildRehearseAccess(service, 'org-1', undefined, [], [], [], [])
    expect('rehearsals' in rehearseAccess).toBe(false)
  })

  it('an all-dated-but-timeless rehearsals array is also OMITTED (not written as []) (CR-01)', async () => {
    const { buildServiceSnapshot } = await import('../services')
    const { buildRehearseAccess } = await import('@/utils/rehearseAccess')

    const service = makeService({
      rehearsals: [{ id: 'dated-timeless', date: '2026-09-11', time: '' }],
    }) as unknown as Service

    const snapshot = buildServiceSnapshot(service)
    expect('rehearsals' in snapshot).toBe(false)

    const rehearseAccess = buildRehearseAccess(service, 'org-1', undefined, [], [], [], [])
    expect('rehearsals' in rehearseAccess).toBe(false)
  })
})
