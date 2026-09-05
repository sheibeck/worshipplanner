import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import type { Service } from '@/types/service'

// ── 118-02 Task 1 — R346/SEC-S-04 public-share PII projection ───────────────
//
// buildServiceSnapshot() reaches into useSongStore/useRosterStore/
// useQuartersStore even for a PII-only assertion, mirroring
// services.stageLayout.test.ts's setup exactly.

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

const PII_MARKER = 'call me at 555-0100'

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

describe('buildServiceSnapshot / toPublicServiceSnapshot PII projection (R346/SEC-S-04)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('drops per-slot notes/body for every slot kind, for every consumer of buildServiceSnapshot', async () => {
    const { buildServiceSnapshot } = await import('../services')
    const service = makeService({
      slots: [
        {
          kind: 'SONG',
          id: 'slot-song',
          position: 0,
          requiredVwType: 1,
          songId: 'song-abc',
          songTitle: 'Amazing Grace',
          songKey: 'G',
          notes: PII_MARKER,
        },
        {
          kind: 'SCRIPTURE',
          id: 'slot-scripture',
          position: 1,
          book: 'Psalm',
          chapter: 100,
          verseStart: 1,
          verseEnd: 5,
          notes: PII_MARKER,
        },
        { kind: 'HYMN', id: 'slot-hymn', position: 2, hymnName: 'Holy, Holy, Holy', hymnNumber: '1', verses: '1-3', notes: PII_MARKER },
        { kind: 'MISC', id: 'slot-misc', position: 3, label: 'Announcement', body: PII_MARKER },
        { kind: 'MESSAGE', id: 'slot-message', position: 4, body: PII_MARKER },
        { kind: 'ANNOUNCEMENTS', id: 'slot-announce', position: 5, body: PII_MARKER },
        { kind: 'PRAYER', id: 'slot-prayer', position: 6, notes: PII_MARKER },
      ],
    }) as unknown as Service

    const snapshot = buildServiceSnapshot(service)

    for (const slot of snapshot.slots) {
      expect('notes' in (slot as object)).toBe(false)
      expect('body' in (slot as object)).toBe(false)
    }
    expect(JSON.stringify(snapshot.slots)).not.toContain(PII_MARKER)

    // Structured display fields survive — a missing one would blank the share page.
    const song = snapshot.slots.find((s) => s.id === 'slot-song') as unknown as Record<string, unknown>
    expect(song.songTitle).toBe('Amazing Grace')
    expect(song.songKey).toBe('G')
    const scripture = snapshot.slots.find((s) => s.id === 'slot-scripture') as unknown as Record<string, unknown>
    expect(scripture.book).toBe('Psalm')
    expect(scripture.verseStart).toBe(1)
    const hymn = snapshot.slots.find((s) => s.id === 'slot-hymn') as unknown as Record<string, unknown>
    expect(hymn.hymnName).toBe('Holy, Holy, Holy')
    const misc = snapshot.slots.find((s) => s.id === 'slot-misc') as unknown as Record<string, unknown>
    expect(misc.label).toBe('Announcement')
  })

  it('toPublicServiceSnapshot drops the service-level free-text notes for the public write path', async () => {
    const { buildServiceSnapshot, toPublicServiceSnapshot } = await import('../services')
    const service = makeService({ notes: PII_MARKER }) as unknown as Service

    const snapshot = buildServiceSnapshot(service)
    // buildServiceSnapshot itself still carries notes — the org-internal
    // lockSnapshots re-lock diff (serviceLockDiff.ts) needs it.
    expect(snapshot.notes).toBe(PII_MARKER)

    const publicSnapshot = toPublicServiceSnapshot(snapshot)
    expect('notes' in publicSnapshot).toBe(false)
    expect(JSON.stringify(publicSnapshot)).not.toContain(PII_MARKER)
  })

  it('the public projection preserves everything else unchanged (date, name, roleAssignments, status)', async () => {
    const { buildServiceSnapshot, toPublicServiceSnapshot } = await import('../services')
    const service = makeService({ name: 'Sunday Service', status: 'planned' }) as unknown as Service

    const publicSnapshot = toPublicServiceSnapshot(buildServiceSnapshot(service))

    expect(publicSnapshot.date).toBe('2026-03-08')
    expect(publicSnapshot.name).toBe('Sunday Service')
    expect(publicSnapshot.status).toBe('planned')
    expect(publicSnapshot.roleAssignments).toEqual([])
  })

  // WR-01 (118-REVIEW) — the stage-marker free-text `note` rode the public
  // projection unstripped even after R346 closed service/slot free-text.
  it('toPublicServiceSnapshot drops the stage-marker free-text note for the public write path, but buildServiceSnapshot itself keeps it', async () => {
    const { buildServiceSnapshot, toPublicServiceSnapshot } = await import('../services')
    const service = makeService({
      stageLayout: {
        elements: [
          { id: 'm1', label: 'Guest', kind: 'mic', zone: 'onstage', xPct: 40, yPct: 40, note: PII_MARKER },
          { id: 'm2', label: 'Drums', kind: 'instrument', zone: 'offstage', xPct: 10, yPct: 20 },
        ],
      },
    }) as unknown as Service

    const snapshot = buildServiceSnapshot(service)
    // buildServiceSnapshot itself still carries the marker note — the
    // org-internal lockSnapshots/current consumer (ServiceEditorView.vue) is
    // untouched by this change, exactly like service-level `notes`.
    expect(snapshot.stageLayout?.elements[0]?.note).toBe(PII_MARKER)

    const publicSnapshot = toPublicServiceSnapshot(snapshot)
    for (const marker of publicSnapshot.stageLayout?.elements ?? []) {
      expect('note' in (marker as object)).toBe(false)
    }
    expect(JSON.stringify(publicSnapshot)).not.toContain(PII_MARKER)
    // Structured stage-layout fields survive — only the free-text note is stripped.
    const marker0 = publicSnapshot.stageLayout?.elements[0] as unknown as Record<string, unknown>
    expect(marker0.label).toBe('Guest')
    expect(marker0.kind).toBe('mic')
    expect(marker0.zone).toBe('onstage')
  })

  it('toPublicServiceSnapshot is a no-op for stageLayout when the service has no markers', async () => {
    const { buildServiceSnapshot, toPublicServiceSnapshot } = await import('../services')
    const service = makeService() as unknown as Service

    const publicSnapshot = toPublicServiceSnapshot(buildServiceSnapshot(service))

    expect('stageLayout' in publicSnapshot).toBe(false)
  })
})
