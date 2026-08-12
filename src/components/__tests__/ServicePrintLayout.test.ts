import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import ServicePrintLayout from '../ServicePrintLayout.vue'
import type { Service } from '@/types/service'
import type { Timestamp } from 'firebase/firestore'

const mockTimestamp = { toDate: () => new Date('2026-03-04') } as unknown as Timestamp

const mockService: Service = {
  id: 'svc-001',
  date: '2026-03-08',
  name: '',
  progression: '1-2-2-3',
  teams: ['Choir', 'Orchestra'],
  status: 'draft',
  slots: [
    { kind: 'SONG', id: 'slot-0', position: 0, requiredVwType: 1, songId: 'song-0', songTitle: 'Come Thou Fount', songKey: 'G' },
    { kind: 'SCRIPTURE', id: 'slot-1', position: 1, book: 'Psalms', chapter: 23, verseStart: 1, verseEnd: 6 },
    { kind: 'SONG', id: 'slot-2', position: 2, requiredVwType: 2, songId: 'song-2', songTitle: 'Great Is Thy Faithfulness', songKey: 'D' },
    { kind: 'PRAYER', id: 'slot-3', position: 3 },
    { kind: 'SCRIPTURE', id: 'slot-4', position: 4, book: 'John', chapter: 3, verseStart: 16, verseEnd: 17 },
    { kind: 'SONG', id: 'slot-5', position: 5, requiredVwType: 2, songId: null, songTitle: null, songKey: null },
    { kind: 'SONG', id: 'slot-6', position: 6, requiredVwType: 3, songId: null, songTitle: null, songKey: null },
    { kind: 'MESSAGE', id: 'slot-7', position: 7 },
    { kind: 'SONG', id: 'slot-8', position: 8, requiredVwType: 3, songId: null, songTitle: null, songKey: null },
  ],
  sermonPassage: { book: 'Romans', chapter: 8, verseStart: 1, verseEnd: 11 },
  notes: 'Communion Sunday — extended prayer time',
  createdAt: mockTimestamp,
  updatedAt: mockTimestamp,
}

describe('ServicePrintLayout', () => {
  it('renders all 9 slot rows from the service prop', () => {
    const wrapper = mount(ServicePrintLayout, {
      props: { service: mockService },
    })
    // Each slot should be rendered; check slot container has 9 children
    const slotRows = wrapper.findAll('[data-slot-row]')
    expect(slotRows).toHaveLength(9)
  })

  it('renders song title and key for a populated song slot', () => {
    const wrapper = mount(ServicePrintLayout, {
      props: { service: mockService },
    })
    expect(wrapper.text()).toContain('Come Thou Fount')
    expect(wrapper.text()).toContain('Key: G')
  })

  it('renders "[not assigned]" for empty song slots (songId is null)', () => {
    const wrapper = mount(ServicePrintLayout, {
      props: { service: mockService },
    })
    expect(wrapper.text()).toContain('[not assigned]')
  })

  it('renders sermon passage in the Message row when sermonPassage exists', () => {
    const wrapper = mount(ServicePrintLayout, {
      props: { service: mockService },
    })
    expect(wrapper.text()).toContain('Romans 8:1-11')
  })

  it('does not render sermon passage in Message row when sermonPassage is null', () => {
    const serviceNoPassage: Service = { ...mockService, sermonPassage: null }
    const wrapper = mount(ServicePrintLayout, {
      props: { service: serviceNoPassage },
    })
    // Should still have Message label but no passage text
    expect(wrapper.text()).toContain('Message')
    expect(wrapper.text()).not.toContain('Romans')
  })

  it('renders notes section when service.notes is non-empty', () => {
    const wrapper = mount(ServicePrintLayout, {
      props: { service: mockService },
    })
    expect(wrapper.text()).toContain('Notes')
    expect(wrapper.text()).toContain('Communion Sunday')
  })

  it('does not render notes section when service.notes is empty string', () => {
    const serviceNoNotes: Service = { ...mockService, notes: '' }
    const wrapper = mount(ServicePrintLayout, {
      props: { service: serviceNoNotes },
    })
    expect(wrapper.text()).not.toContain('Notes')
  })

  it('renders the formatted date in the header', () => {
    const wrapper = mount(ServicePrintLayout, {
      props: { service: mockService },
    })
    // date: '2026-03-08' should render as "Sunday, March 8, 2026"
    expect(wrapper.text()).toContain('March 8, 2026')
  })

  it('renders teams display in the header', () => {
    const wrapper = mount(ServicePrintLayout, {
      props: { service: mockService },
    })
    expect(wrapper.text()).toContain('Choir')
    expect(wrapper.text()).toContain('Orchestra')
  })

  // 29-05: confirmation-by-test, not rework — this component has no section
  // awareness at all (PATTERNS.md), it renders `service.slots` in array order.
  // The section model guarantees section-major array order, so a Post-Service
  // item placed last in the array renders last on the printed page for free.
  it('renders a Post-Service item last for a section-major slots array (29-05)', () => {
    const sectionMajorService: Service = {
      ...mockService,
      slots: [
        { kind: 'SONG', id: 'slot-worship', position: 0, requiredVwType: 1, songId: 'song-0', songTitle: 'Come Thou Fount', songKey: 'G', section: 'worship' },
        { kind: 'MESSAGE', id: 'slot-message', position: 1, section: 'message' },
        { kind: 'SONG', id: 'slot-sending', position: 2, requiredVwType: 3, songId: 'song-2', songTitle: 'Great Is Thy Faithfulness', songKey: 'D', section: 'sending' },
        { kind: 'PRAYER', id: 'slot-post-service', position: 3, section: 'post-service' },
      ],
    }
    const wrapper = mount(ServicePrintLayout, {
      props: { service: sectionMajorService },
    })
    const slotRows = wrapper.findAll('[data-slot-row]')
    expect(slotRows).toHaveLength(4)
    expect(slotRows[slotRows.length - 1]!.text()).toContain('Prayer')
  })

  // ── 43-04: ANNOUNCEMENTS/MISC branches and body rendering ───────────────────
  // T-43-12 — before this plan, the v-else-if chain had no trailing arm, so
  // these two kinds rendered as nothing at all.

  it('renders an ANNOUNCEMENTS slot as its own labelled line, with its body (43-04)', () => {
    const service: Service = {
      ...mockService,
      slots: [{ kind: 'ANNOUNCEMENTS', id: 'ann-1', position: 0, body: 'Potluck this Sunday after service' }],
    }
    const wrapper = mount(ServicePrintLayout, { props: { service } })
    expect(wrapper.text()).toContain('Announcements')
    expect(wrapper.text()).toContain('Potluck this Sunday after service')
  })

  it('renders a MISC slot as its own labelled line, with its body (43-04)', () => {
    const service: Service = {
      ...mockService,
      slots: [{ kind: 'MISC', id: 'misc-1', position: 0, body: 'Building closes early Monday' }],
    }
    const wrapper = mount(ServicePrintLayout, { props: { service } })
    expect(wrapper.text()).toContain('Miscellaneous')
    expect(wrapper.text()).toContain('Building closes early Monday')
  })

  // R127 (Phase 56): a MISC slot's custom label replaces the hard-coded
  // "Miscellaneous" label line; an unlabeled MISC still reads "Miscellaneous".
  it('renders a MISC slot with a custom label in place of "Miscellaneous" (R127)', () => {
    const service: Service = {
      ...mockService,
      slots: [{ kind: 'MISC', id: 'misc-lbl-1', position: 0, label: 'Communion' }],
    }
    const wrapper = mount(ServicePrintLayout, { props: { service } })
    expect(wrapper.text()).toContain('Communion')
    expect(wrapper.text()).not.toContain('Miscellaneous')
  })

  it('renders an unlabeled MISC slot as "Miscellaneous" (R127, today\'s behavior)', () => {
    const service: Service = {
      ...mockService,
      slots: [{ kind: 'MISC', id: 'misc-lbl-2', position: 0 }],
    }
    const wrapper = mount(ServicePrintLayout, { props: { service } })
    expect(wrapper.text()).toContain('Miscellaneous')
  })

  it('preserves an embedded newline in a MESSAGE body (43-04)', () => {
    const service: Service = {
      ...mockService,
      slots: [{ kind: 'MESSAGE', id: 'msg-body-1', position: 0, body: 'Line one\nLine two' }],
    }
    const wrapper = mount(ServicePrintLayout, { props: { service } })
    const row = wrapper.findAll('[data-slot-row]')[0]!
    const bodyEl = row.find('p.whitespace-pre-wrap')
    expect(bodyEl.exists()).toBe(true)
    // .text() collapses whitespace including the embedded newline — read
    // textContent directly to prove the line break survives (mirrors the
    // precedent in ServiceEditorView.test.ts for the same reason).
    expect(bodyEl.element.textContent).toBe('Line one\nLine two')
  })

  it('renders an ANNOUNCEMENTS slot with no body as a label-only line, with no not-assigned placeholder (43-04)', () => {
    const service: Service = {
      ...mockService,
      slots: [{ kind: 'ANNOUNCEMENTS', id: 'ann-2', position: 0 }],
    }
    const wrapper = mount(ServicePrintLayout, { props: { service } })
    expect(wrapper.text()).toContain('Announcements')
    expect(wrapper.text()).not.toContain('[not assigned]')
    const row = wrapper.findAll('[data-slot-row]')[0]!
    expect(row.find('p.whitespace-pre-wrap').exists()).toBe(false)
  })

  // ── 260811-vsr: notes-canonical print (notes ?? body) ─────────────────────────
  // The consolidated free-text field is `notes`, falling back to legacy `body`.

  it('prints a notes-only MESSAGE slot from its notes (notes ?? body)', () => {
    const service: Service = {
      ...mockService,
      slots: [{ kind: 'MESSAGE', id: 'msg-notes-1', position: 0, notes: 'Guest speaker this week' }],
    }
    const wrapper = mount(ServicePrintLayout, { props: { service } })
    expect(wrapper.text()).toContain('Guest speaker this week')
  })

  it('prints a notes-only ANNOUNCEMENTS slot from its notes (notes ?? body)', () => {
    const service: Service = {
      ...mockService,
      slots: [{ kind: 'ANNOUNCEMENTS', id: 'ann-notes-1', position: 0, notes: 'Coffee in the lobby' }],
    }
    const wrapper = mount(ServicePrintLayout, { props: { service } })
    expect(wrapper.text()).toContain('Coffee in the lobby')
  })

  it('prefers notes over legacy body when a MISC slot carries both', () => {
    const service: Service = {
      ...mockService,
      slots: [{ kind: 'MISC', id: 'misc-both-1', position: 0, notes: 'New notes win', body: 'stale body' }],
    }
    const wrapper = mount(ServicePrintLayout, { props: { service } })
    expect(wrapper.text()).toContain('New notes win')
    expect(wrapper.text()).not.toContain('stale body')
  })
})
