import { describe, it, expect } from 'vitest'
import type { SlideGroup, GroupSlideEntry, SourceRef } from '@/types/slideGroup'
import {
  fingerprintSlideGroups,
  type SlideFingerprint,
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
