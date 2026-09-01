import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import type { Service } from '@/types/service'

// ── 107-03 Task 1 — buildServiceSnapshot's stageLayout projection ────────────
//
// buildServiceSnapshot() is a pure function that reaches into useSongStore /
// useRosterStore / useQuartersStore for its (unrelated) song-bpm and
// roleAssignments resolution — so even a stageLayout-only test needs those
// three stores mocked and an active Pinia, mirroring services.test.ts's own
// setup. Per the plan: a minimal service with a stageLayout is enough; no
// roles need to be configured for these assertions.

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
    date: '2026-03-08',
    name: 'Sunday Service',
    progression: '1-2-2-3',
    teams: [],
    status: 'draft',
    slots: [],
    sermonPassage: null,
    notes: '',
    createdAt: { seconds: 1000000, nanoseconds: 0 } as never,
    updatedAt: { seconds: 1000000, nanoseconds: 0 } as never,
    ...overrides,
  }
}

describe('buildServiceSnapshot stageLayout projection (T-107-01)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('includes stageLayout with the mapped markers when the service has markers', async () => {
    const { buildServiceSnapshot } = await import('../services')
    const service = makeService({
      stageLayout: {
        elements: [
          { id: 'm1', label: 'Acoustic Guitar', kind: 'instrument', zone: 'onstage', xPct: 25, yPct: 60 },
          { id: 'm2', label: 'Guest Speaker Mic', zone: 'offstage', xPct: 10, yPct: 90 },
        ],
      },
    })

    const snapshot = buildServiceSnapshot(service)

    expect(snapshot.stageLayout).toBeDefined()
    expect(snapshot.stageLayout?.elements).toHaveLength(2)
    expect(snapshot.stageLayout?.elements[0]).toEqual({
      id: 'm1',
      label: 'Acoustic Guitar',
      kind: 'instrument',
      zone: 'onstage',
      xPct: 25,
      yPct: 60,
    })
  })

  it('has no stageLayout key when service.stageLayout is absent', async () => {
    const { buildServiceSnapshot } = await import('../services')
    const service = makeService()

    const snapshot = buildServiceSnapshot(service)

    expect('stageLayout' in snapshot).toBe(false)
  })

  it('has no stageLayout key when service.stageLayout has zero markers', async () => {
    const { buildServiceSnapshot } = await import('../services')
    const service = makeService({ stageLayout: { elements: [] } })

    const snapshot = buildServiceSnapshot(service)

    expect('stageLayout' in snapshot).toBe(false)
  })

  it('projects each marker with exactly the 6 expected keys and no others (no PII/no raw spread leak)', async () => {
    const { buildServiceSnapshot } = await import('../services')
    const service = makeService({
      stageLayout: {
        elements: [
          {
            id: 'm1',
            label: 'Drums',
            kind: 'instrument',
            zone: 'offstage',
            xPct: 40,
            yPct: 50,
            // @ts-expect-error — deliberately smuggling a non-display field to
            // prove the projection does NOT raw-spread the source marker.
            secretField: 'must not leak',
          },
        ],
      },
    })

    const snapshot = buildServiceSnapshot(service)
    const marker = snapshot.stageLayout?.elements[0]

    expect(marker).toBeDefined()
    expect(Object.keys(marker!).sort()).toEqual(['id', 'kind', 'label', 'xPct', 'yPct', 'zone'])
    expect('secretField' in (marker as object)).toBe(false)
  })

  it('omits kind on the projected marker when the source marker has no kind set (absent, not undefined)', async () => {
    const { buildServiceSnapshot } = await import('../services')
    const service = makeService({
      stageLayout: {
        elements: [{ id: 'm1', label: 'Extra Mic', zone: 'onstage', xPct: 5, yPct: 5 }],
      },
    })

    const snapshot = buildServiceSnapshot(service)
    const marker = snapshot.stageLayout?.elements[0]

    expect(marker).toBeDefined()
    expect('kind' in (marker as object)).toBe(false)
  })

  it('IN-03: defensively re-clamps xPct/yPct to [0,100] for a stored value that reached the field through some path other than the app UI', async () => {
    const { buildServiceSnapshot } = await import('../services')
    const service = makeService({
      stageLayout: {
        // Deliberately out-of-range xPct/yPct — StageMarker's type is a plain
        // `number` (no range narrowing), so this simulates a bulk import /
        // manual Firestore edit / future caller bug that bypassed the app's
        // own UI-side clamping without needing a type-system escape hatch.
        elements: [{ id: 'm1', label: 'Off-canvas Mic', zone: 'onstage', xPct: 145, yPct: -20 }],
      },
    })

    const snapshot = buildServiceSnapshot(service)
    const marker = snapshot.stageLayout?.elements[0]

    expect(marker?.xPct).toBe(100)
    expect(marker?.yPct).toBe(0)
  })

  it('preserves xPct/yPct verbatim through the projection', async () => {
    const { buildServiceSnapshot } = await import('../services')
    const service = makeService({
      stageLayout: {
        elements: [{ id: 'm1', label: 'Piano', kind: 'instrument', zone: 'offstage', xPct: 33.5, yPct: 71.25 }],
      },
    })

    const snapshot = buildServiceSnapshot(service)
    const marker = snapshot.stageLayout?.elements[0]

    expect(marker?.xPct).toBe(33.5)
    expect(marker?.yPct).toBe(71.25)
  })
})
