import { describe, it, expect } from 'vitest'
import type { SlideGroup, GroupSlideEntry, SourceRef } from '@/types/slideGroup'
import type { ServiceSnapshot } from '@/stores/services'
import type { SongSlot, NonAssignableSlot } from '@/types/service'
import {
  fingerprintSlideGroups,
  diffServiceSnapshots,
  type SlideFingerprint,
  type ChangeEntry,
} from '@/utils/serviceLockDiff'

// ---------------------------------------------------------------------------
// Fixture builders — plain literals, NO Firestore/Pinia mocking (mirrors the
// mock-free convention of messagingRecipients.test.ts).
// ---------------------------------------------------------------------------

const ts = null as never // Timestamp is never read by the pure functions under test

function makeSlide(order: number, sourceRef: SourceRef, id = `slide-${order}`): GroupSlideEntry {
  return { id, order, sourceRef }
}

function makeGroup(overrides: Partial<SlideGroup> = {}): SlideGroup {
  return {
    id: 'slot-1',
    serviceId: 'svc-1',
    slotId: 'slot-1',
    slides: [],
    createdAt: ts,
    updatedAt: ts,
    ...overrides,
  }
}

describe('fingerprintSlideGroups', () => {
  it('is deterministic — the same groups produce a byte-identical map on repeat calls', () => {
    const groups: SlideGroup[] = [
      makeGroup({
        slotId: 'slot-1',
        slides: [
          makeSlide(0, { kind: 'lyric', songId: 'song-a', sectionId: 'v1' }),
          makeSlide(1, { kind: 'lyric', songId: 'song-a', sectionId: 'c1' }),
        ],
      }),
      makeGroup({
        slotId: 'slot-2',
        slides: [makeSlide(0, { kind: 'text', title: 'Welcome', body: 'Hello' })],
      }),
    ]
    const a = fingerprintSlideGroups(groups, 'svc-1')
    const b = fingerprintSlideGroups(groups, 'svc-1')
    expect(a).toEqual(b)
    expect(Object.keys(a).sort()).toEqual(['slot-1', 'slot-2'])
    expect(typeof a['slot-1']).toBe('string')
  })

  it('is independent of the input array order (group order does not change any hash)', () => {
    const g1 = makeGroup({
      slotId: 'slot-1',
      slides: [makeSlide(0, { kind: 'lyric', songId: 'song-a', sectionId: 'v1' })],
    })
    const g2 = makeGroup({
      slotId: 'slot-2',
      slides: [makeSlide(0, { kind: 'copyright', songId: 'song-a' })],
    })
    const forward = fingerprintSlideGroups([g1, g2], 'svc-1')
    const reversed = fingerprintSlideGroups([g2, g1], 'svc-1')
    expect(forward).toEqual(reversed)
  })

  it('is independent of the input slides array order (sorts by .order before hashing)', () => {
    const ordered = makeGroup({
      slotId: 'slot-1',
      slides: [
        makeSlide(0, { kind: 'lyric', songId: 'song-a', sectionId: 'v1' }),
        makeSlide(1, { kind: 'lyric', songId: 'song-a', sectionId: 'c1' }),
      ],
    })
    const shuffled = makeGroup({
      slotId: 'slot-1',
      slides: [
        makeSlide(1, { kind: 'lyric', songId: 'song-a', sectionId: 'c1' }),
        makeSlide(0, { kind: 'lyric', songId: 'song-a', sectionId: 'v1' }),
      ],
    })
    const a = fingerprintSlideGroups([ordered], 'svc-1')
    const b = fingerprintSlideGroups([shuffled], 'svc-1')
    expect(a['slot-1']).toBe(b['slot-1'])
  })

  it('is order-SENSITIVE within a group — swapping .order values changes the hash', () => {
    const original = makeGroup({
      slotId: 'slot-1',
      slides: [
        makeSlide(0, { kind: 'lyric', songId: 'song-a', sectionId: 'v1' }),
        makeSlide(1, { kind: 'lyric', songId: 'song-a', sectionId: 'c1' }),
      ],
    })
    const reordered = makeGroup({
      slotId: 'slot-1',
      slides: [
        makeSlide(1, { kind: 'lyric', songId: 'song-a', sectionId: 'v1' }),
        makeSlide(0, { kind: 'lyric', songId: 'song-a', sectionId: 'c1' }),
      ],
    })
    const a = fingerprintSlideGroups([original], 'svc-1')
    const b = fingerprintSlideGroups([reordered], 'svc-1')
    expect(a['slot-1']).not.toBe(b['slot-1'])
  })

  it('changes the hash when a slide is added', () => {
    const before = makeGroup({
      slotId: 'slot-1',
      slides: [makeSlide(0, { kind: 'lyric', songId: 'song-a', sectionId: 'v1' })],
    })
    const after = makeGroup({
      slotId: 'slot-1',
      slides: [
        makeSlide(0, { kind: 'lyric', songId: 'song-a', sectionId: 'v1' }),
        makeSlide(1, { kind: 'lyric', songId: 'song-a', sectionId: 'c1' }),
      ],
    })
    expect(fingerprintSlideGroups([before], 'svc-1')['slot-1']).not.toBe(
      fingerprintSlideGroups([after], 'svc-1')['slot-1'],
    )
  })

  it('changes the hash when a slide is removed', () => {
    const before = makeGroup({
      slotId: 'slot-1',
      slides: [
        makeSlide(0, { kind: 'lyric', songId: 'song-a', sectionId: 'v1' }),
        makeSlide(1, { kind: 'lyric', songId: 'song-a', sectionId: 'c1' }),
      ],
    })
    const after = makeGroup({
      slotId: 'slot-1',
      slides: [makeSlide(0, { kind: 'lyric', songId: 'song-a', sectionId: 'v1' })],
    })
    expect(fingerprintSlideGroups([before], 'svc-1')['slot-1']).not.toBe(
      fingerprintSlideGroups([after], 'svc-1')['slot-1'],
    )
  })

  it('changes the hash when an authored text/scripture/video field is edited', () => {
    const before = makeGroup({
      slotId: 'slot-1',
      slides: [makeSlide(0, { kind: 'text', title: 'Welcome', body: 'Hello' })],
    })
    const afterText = makeGroup({
      slotId: 'slot-1',
      slides: [makeSlide(0, { kind: 'text', title: 'Welcome', body: 'Goodbye' })],
    })
    expect(fingerprintSlideGroups([before], 'svc-1')['slot-1']).not.toBe(
      fingerprintSlideGroups([afterText], 'svc-1')['slot-1'],
    )

    const scr = makeGroup({
      slotId: 'slot-2',
      slides: [makeSlide(0, { kind: 'scripture', speaker: 'LEADER', text: 'For God', verseRange: '16' })],
    })
    const scrEdited = makeGroup({
      slotId: 'slot-2',
      slides: [makeSlide(0, { kind: 'scripture', speaker: 'LEADER', text: 'For God so loved', verseRange: '16' })],
    })
    expect(fingerprintSlideGroups([scr], 'svc-1')['slot-2']).not.toBe(
      fingerprintSlideGroups([scrEdited], 'svc-1')['slot-2'],
    )

    const vid = makeGroup({
      slotId: 'slot-3',
      slides: [makeSlide(0, { kind: 'video', videoSrc: 'https://x/a.mp4' })],
    })
    const vidEdited = makeGroup({
      slotId: 'slot-3',
      slides: [makeSlide(0, { kind: 'video', videoSrc: 'https://x/b.mp4' })],
    })
    expect(fingerprintSlideGroups([vid], 'svc-1')['slot-3']).not.toBe(
      fingerprintSlideGroups([vidEdited], 'svc-1')['slot-3'],
    )
  })

  it('hashes a song swap (differing songId) differently', () => {
    const songA = makeGroup({
      slotId: 'slot-1',
      slides: [makeSlide(0, { kind: 'lyric', songId: 'song-a', sectionId: 'v1' })],
    })
    const songB = makeGroup({
      slotId: 'slot-1',
      slides: [makeSlide(0, { kind: 'lyric', songId: 'song-b', sectionId: 'v1' })],
    })
    expect(fingerprintSlideGroups([songA], 'svc-1')['slot-1']).not.toBe(
      fingerprintSlideGroups([songB], 'svc-1')['slot-1'],
    )
  })

  it('excludes groups whose serviceId does not match', () => {
    const inService = makeGroup({ slotId: 'slot-1', serviceId: 'svc-1' })
    const otherService = makeGroup({ slotId: 'slot-2', serviceId: 'svc-2' })
    const fp = fingerprintSlideGroups([inService, otherService], 'svc-1')
    expect(Object.keys(fp)).toEqual(['slot-1'])
  })

  it('yields a stable, defined hash for an empty group', () => {
    const empty = makeGroup({ slotId: 'slot-1', slides: [] })
    const fp: SlideFingerprint = fingerprintSlideGroups([empty], 'svc-1')
    expect(fp['slot-1']).toBeDefined()
    expect(typeof fp['slot-1']).toBe('string')
    expect(fingerprintSlideGroups([empty], 'svc-1')['slot-1']).toBe(fp['slot-1'])
  })
})

// ---------------------------------------------------------------------------
// diffServiceSnapshots
// ---------------------------------------------------------------------------

type RoleAssignment = ServiceSnapshot['roleAssignments'][number]

function makeSongSlot(id: string, overrides: Partial<SongSlot> = {}): SongSlot {
  return {
    id,
    kind: 'SONG',
    position: 0,
    requiredVwType: 1,
    songId: 'song-a',
    songTitle: 'Song A',
    songKey: 'C',
    ...overrides,
  }
}

function makeMiscSlot(id: string, overrides: Partial<NonAssignableSlot> = {}): NonAssignableSlot {
  return {
    id,
    kind: 'MISC',
    position: 0,
    ...overrides,
  }
}

function makeAssignment(overrides: Partial<RoleAssignment> = {}): RoleAssignment {
  return {
    roleId: 'r1',
    roleName: 'guitar',
    group: 'band',
    personNames: ['Alice'],
    ...overrides,
  }
}

function makeSnapshot(overrides: Partial<ServiceSnapshot> = {}): ServiceSnapshot {
  return {
    date: '2026-08-02',
    name: 'Sunday Service',
    progression: '1-2-2-3',
    teams: [],
    slots: [],
    sermonPassage: null,
    notes: '',
    status: 'planned',
    roleAssignments: [],
    ...overrides,
  }
}

const typesOf = (entries: ChangeEntry[]) => entries.map((e) => e.type).sort()

describe('diffServiceSnapshots', () => {
  it('detects a SONG change (songTitle) on a slot matched by stable id — exactly one SONG entry', () => {
    const prev = makeSnapshot({ slots: [makeSongSlot('slot-1', { songTitle: 'Old Title' })] })
    const curr = makeSnapshot({ slots: [makeSongSlot('slot-1', { songTitle: 'New Title' })] })
    const diff = diffServiceSnapshots(prev, curr, null, null)
    expect(typesOf(diff)).toEqual(['SONG'])
  })

  it('detects a SONG change (songId swap) on a slot matched by stable id', () => {
    const prev = makeSnapshot({ slots: [makeSongSlot('slot-1', { songId: 'song-a' })] })
    const curr = makeSnapshot({ slots: [makeSongSlot('slot-1', { songId: 'song-b' })] })
    expect(typesOf(diffServiceSnapshots(prev, curr, null, null))).toEqual(['SONG'])
  })

  it('reports no SONG entry for an unchanged song slot', () => {
    const prev = makeSnapshot({ slots: [makeSongSlot('slot-1')] })
    const curr = makeSnapshot({ slots: [makeSongSlot('slot-1')] })
    expect(diffServiceSnapshots(prev, curr, null, null)).toEqual([])
  })

  it('detects an ORDER change when a shared slot id moves position without content change', () => {
    const a = makeSongSlot('slot-1', { position: 0 })
    const b = makeSongSlot('slot-2', { position: 1, songId: 'song-b', songTitle: 'Song B' })
    const prev = makeSnapshot({ slots: [a, b] })
    const curr = makeSnapshot({ slots: [b, a] })
    expect(typesOf(diffServiceSnapshots(prev, curr, null, null))).toEqual(['ORDER'])
  })

  it('reports no ORDER entry when the order is identical', () => {
    const a = makeSongSlot('slot-1')
    const b = makeMiscSlot('slot-2')
    const prev = makeSnapshot({ slots: [a, b] })
    const curr = makeSnapshot({ slots: [a, b] })
    expect(diffServiceSnapshots(prev, curr, null, null)).toEqual([])
  })

  it('folds a SONG slot ADD into SONG + ORDER', () => {
    const prev = makeSnapshot({ slots: [makeSongSlot('slot-1')] })
    const curr = makeSnapshot({ slots: [makeSongSlot('slot-1'), makeSongSlot('slot-2', { songId: 'song-b' })] })
    expect(typesOf(diffServiceSnapshots(prev, curr, null, null))).toEqual(['ORDER', 'SONG'])
  })

  it('folds a SONG slot REMOVE into SONG + ORDER', () => {
    const prev = makeSnapshot({ slots: [makeSongSlot('slot-1'), makeSongSlot('slot-2', { songId: 'song-b' })] })
    const curr = makeSnapshot({ slots: [makeSongSlot('slot-1')] })
    expect(typesOf(diffServiceSnapshots(prev, curr, null, null))).toEqual(['ORDER', 'SONG'])
  })

  it('folds a non-SONG slot ADD/REMOVE into ORDER only', () => {
    const prev = makeSnapshot({ slots: [makeSongSlot('slot-1')] })
    const curr = makeSnapshot({ slots: [makeSongSlot('slot-1'), makeMiscSlot('slot-2')] })
    expect(typesOf(diffServiceSnapshots(prev, curr, null, null))).toEqual(['ORDER'])
  })

  it('detects a ROLE change and tags EXACTLY that role\'s group (narrow, never broad)', () => {
    const prev = makeSnapshot({
      roleAssignments: [
        makeAssignment({ roleId: 'r1', group: 'band', personNames: ['Charlie'] }),
        makeAssignment({ roleId: 'r2', roleName: 'sound', group: 'tech', personNames: ['Bob'] }),
      ],
    })
    const curr = makeSnapshot({
      roleAssignments: [
        makeAssignment({ roleId: 'r1', group: 'band', personNames: ['Alice'] }),
        makeAssignment({ roleId: 'r2', roleName: 'sound', group: 'tech', personNames: ['Bob'] }),
      ],
    })
    const diff = diffServiceSnapshots(prev, curr, null, null)
    expect(typesOf(diff)).toEqual(['ROLE'])
    expect(diff[0]!.affectedTeams).toEqual(['band'])
  })

  it('treats personNames comparison as order-insensitive (no ROLE entry on reorder)', () => {
    const prev = makeSnapshot({
      roleAssignments: [makeAssignment({ roleId: 'r1', personNames: ['Alice', 'Bob'] })],
    })
    const curr = makeSnapshot({
      roleAssignments: [makeAssignment({ roleId: 'r1', personNames: ['Bob', 'Alice'] })],
    })
    expect(diffServiceSnapshots(prev, curr, null, null)).toEqual([])
  })

  it('detects a NOTES change', () => {
    const prev = makeSnapshot({ notes: 'old' })
    const curr = makeSnapshot({ notes: 'new' })
    expect(typesOf(diffServiceSnapshots(prev, curr, null, null))).toEqual(['NOTES'])
  })

  it('detects a SLIDES change when the fingerprint maps differ (map vs map)', () => {
    const prev = makeSnapshot()
    const curr = makeSnapshot()
    const diff = diffServiceSnapshots(prev, curr, { 'slot-1': 'aaa' }, { 'slot-1': 'bbb' })
    expect(typesOf(diff)).toEqual(['SLIDES'])
  })

  it('detects a SLIDES change when a fingerprint key is added/removed (null vs map)', () => {
    const prev = makeSnapshot()
    const curr = makeSnapshot()
    expect(typesOf(diffServiceSnapshots(prev, curr, null, { 'slot-1': 'aaa' }))).toEqual(['SLIDES'])
  })

  it('reports no SLIDES entry when both fingerprints are null or equal', () => {
    const prev = makeSnapshot()
    const curr = makeSnapshot()
    expect(diffServiceSnapshots(prev, curr, null, null)).toEqual([])
    expect(diffServiceSnapshots(prev, curr, { 'slot-1': 'x' }, { 'slot-1': 'x' })).toEqual([])
  })

  it('tags broad entries (SONG) with only groups that have >=1 assigned person on the CURRENT snapshot', () => {
    const assignments = [
      makeAssignment({ roleId: 'r1', group: 'band', personNames: ['Alice'] }),
      makeAssignment({ roleId: 'r2', roleName: 'sound', group: 'tech', personNames: [] }),
      makeAssignment({ roleId: 'r3', roleName: 'lead vocal', group: 'vocals', personNames: ['Dan'] }),
    ]
    const prev = makeSnapshot({ slots: [makeSongSlot('slot-1', { songTitle: 'Old' })], roleAssignments: assignments })
    const curr = makeSnapshot({ slots: [makeSongSlot('slot-1', { songTitle: 'New' })], roleAssignments: assignments })
    const diff = diffServiceSnapshots(prev, curr, null, null)
    expect(typesOf(diff)).toEqual(['SONG'])
    expect([...diff[0]!.affectedTeams].sort()).toEqual(['band', 'vocals'])
  })

  it('returns [] for two identical snapshots with identical fingerprints (empty-diff branch)', () => {
    const slots = [makeSongSlot('slot-1'), makeMiscSlot('slot-2')]
    const assignments = [makeAssignment({ roleId: 'r1', personNames: ['Alice'] })]
    const prev = makeSnapshot({ slots, roleAssignments: assignments, notes: 'same' })
    const curr = makeSnapshot({ slots, roleAssignments: assignments, notes: 'same' })
    expect(diffServiceSnapshots(prev, curr, { 'slot-1': 'x' }, { 'slot-1': 'x' })).toEqual([])
  })
})
