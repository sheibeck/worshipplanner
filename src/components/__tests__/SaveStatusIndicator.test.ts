import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import SaveStatusIndicator from '../SaveStatusIndicator.vue'
import { useSaveStatus, hasVisibleSaveStatus } from '@/stores/saveStatus'
import type { AutoSaveStatus } from '@/composables/useAutoSave'

// 34-10: enumerate the union with a TOTAL RECORD, not a typed array. An
// array literal annotated as an array of AutoSaveStatus elements only
// constrains each ELEMENT to be a union member — it never requires the
// array to hold every member, so it keeps compiling unchanged after a
// sixth status is added and omitted here, and the completeness guard this
// test exists to provide would silently stop existing while the test kept
// passing. A record keyed by the union IS missing-key-checked by the
// compiler (the same idiom as `slideDisplay.ts`'s `KIND_BADGE_CLASSES` and
// `MENU_ITEM_LABELS`), which is the property this test actually needs.
const ALL_SAVE_STATUSES: Record<AutoSaveStatus, true> = {
  idle: true,
  pending: true,
  saving: true,
  saved: true,
  error: true,
}

const REORDER_ERROR_TEXT = "Couldn't save this order — reverted. Try dragging again."
const GENERIC_ERROR_TEXT = "Couldn't save your changes — they're still here. Try again."

describe('SaveStatusIndicator', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  function mountIndicator(surfaceId = 'service:svc-1') {
    return mount(SaveStatusIndicator, {
      props: { surfaceId },
    })
  }

  it('renders nothing at idle — no placeholder box, empty text content', () => {
    const wrapper = mountIndicator()

    expect(wrapper.text()).toBe('')
    expect(wrapper.find('span').exists()).toBe(false)
  })

  it('renders "Saving soon…" at pending', async () => {
    const wrapper = mountIndicator()
    useSaveStatus().set('service:svc-1', { status: 'pending' })
    await wrapper.vm.$nextTick()

    expect(wrapper.text()).toBe('Saving soon…')
  })

  it('renders "Saving…" at saving', async () => {
    const wrapper = mountIndicator()
    useSaveStatus().set('service:svc-1', { status: 'saving' })
    await wrapper.vm.$nextTick()

    expect(wrapper.text()).toBe('Saving…')
  })

  it('renders "Saved 2:47 PM" for a savedAt of 14:47 local', async () => {
    const wrapper = mountIndicator()
    const savedAt = new Date()
    savedAt.setHours(14, 47, 0, 0)
    useSaveStatus().set('service:svc-1', { status: 'saved', savedAt })
    await wrapper.vm.$nextTick()

    expect(wrapper.text()).toBe('Saved 2:47 PM')
  })

  it('matches the general "Saved h:mm AM/PM" pattern for any saved time', async () => {
    const wrapper = mountIndicator()
    const savedAt = new Date()
    savedAt.setHours(9, 5, 0, 0)
    useSaveStatus().set('service:svc-1', { status: 'saved', savedAt })
    await wrapper.vm.$nextTick()

    expect(wrapper.text()).toMatch(/^Saved \d{1,2}:\d{2} (AM|PM)$/)
  })

  it('renders the exact reorder error sentence and carries data-testid="save-status-error"', async () => {
    const wrapper = mountIndicator()
    useSaveStatus().set('service:svc-1', { status: 'error', errorText: REORDER_ERROR_TEXT })
    await wrapper.vm.$nextTick()

    const errorEl = wrapper.find('[data-testid="save-status-error"]')
    expect(errorEl.exists()).toBe(true)
    expect(errorEl.text()).toBe(REORDER_ERROR_TEXT)
  })

  it('renders the exact generic error sentence', async () => {
    const wrapper = mountIndicator()
    useSaveStatus().set('service:svc-1', { status: 'error', errorText: GENERIC_ERROR_TEXT })
    await wrapper.vm.$nextTick()

    expect(wrapper.find('[data-testid="save-status-error"]').text()).toBe(GENERIC_ERROR_TEXT)
  })

  it('wrapper always carries aria-live="polite", aria-atomic="true" and data-testid="save-status", including in the error state', async () => {
    const wrapper = mountIndicator()
    useSaveStatus().set('service:svc-1', { status: 'error', errorText: GENERIC_ERROR_TEXT })
    await wrapper.vm.$nextTick()

    const root = wrapper.find('[data-testid="save-status"]')
    expect(root.attributes('aria-live')).toBe('polite')
    expect(root.attributes('aria-atomic')).toBe('true')
  })

  it('has exactly one element with an aria-live attribute in the mounted subtree, even in the error state', async () => {
    const wrapper = mountIndicator()
    useSaveStatus().set('service:svc-1', { status: 'error', errorText: GENERIC_ERROR_TEXT })
    await wrapper.vm.$nextTick()

    expect(wrapper.findAll('[aria-live]')).toHaveLength(1)
  })

  it('WR-01 (32-REVIEW): falls back to the generic sentence when errorText is missing, rather than rendering blank', async () => {
    const wrapper = mountIndicator()
    // No errorText — nothing in the type system currently prevents a caller
    // from omitting it (SaveStatusEntry.errorText is optional).
    useSaveStatus().set('service:svc-1', { status: 'error' })
    await wrapper.vm.$nextTick()

    const errorEl = wrapper.find('[data-testid="save-status-error"]')
    expect(errorEl.exists()).toBe(true)
    expect(errorEl.text()).toBe(GENERIC_ERROR_TEXT)
  })

  it('renders idle for an unknown surfaceId rather than throwing', () => {
    useSaveStatus().set('service:svc-1', { status: 'saving' })
    const wrapper = mountIndicator('service:never-registered')

    expect(wrapper.text()).toBe('')
  })

  it('re-renders reactively when the store entry changes', async () => {
    const wrapper = mountIndicator()
    const store = useSaveStatus()

    store.set('service:svc-1', { status: 'pending' })
    await wrapper.vm.$nextTick()
    expect(wrapper.text()).toBe('Saving soon…')

    store.set('service:svc-1', { status: 'saving' })
    await wrapper.vm.$nextTick()
    expect(wrapper.text()).toBe('Saving…')

    store.clear('service:svc-1')
    await wrapper.vm.$nextTick()
    expect(wrapper.text()).toBe('')
  })

  it('E1 overflow backstop: the 59-char generic error string renders without a truncation class inside a narrow fixed-width host', async () => {
    const wrapper = mount(
      {
        components: { SaveStatusIndicator },
        template: `<div style="width: 120px"><SaveStatusIndicator surface-id="song-lyrics:song-1" /></div>`,
      },
      { attachTo: document.body },
    )
    useSaveStatus().set('song-lyrics:song-1', { status: 'error', errorText: GENERIC_ERROR_TEXT })
    await wrapper.vm.$nextTick()

    const errorEl = wrapper.find('[data-testid="save-status-error"]')
    expect(errorEl.classes().join(' ')).not.toMatch(/truncate|overflow-hidden|text-ellipsis|line-clamp/)
    expect(errorEl.text()).toBe(GENERIC_ERROR_TEXT)
    expect(GENERIC_ERROR_TEXT.length).toBe(59)

    wrapper.unmount()
  })
})

// 34-10 (UAT F4): agreement between `hasVisibleSaveStatus` and what the
// indicator actually renders, across every member of AutoSaveStatus. The
// list iterated is DERIVED from ALL_SAVE_STATUSES above, never re-typed by
// hand, so the two cannot silently drift apart.
describe('hasVisibleSaveStatus agrees with SaveStatusIndicator for every status', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  const statuses = Object.keys(ALL_SAVE_STATUSES) as AutoSaveStatus[]

  it('iterates exactly 5 statuses — one per union member', () => {
    expect(statuses).toHaveLength(5)
  })

  for (const status of statuses) {
    it(`status "${status}": hasVisibleSaveStatus matches whether the indicator renders non-empty text`, async () => {
      const entry = { status, errorText: status === 'error' ? GENERIC_ERROR_TEXT : undefined }
      useSaveStatus().set('service:svc-1', entry)
      const wrapper = mount(SaveStatusIndicator, { props: { surfaceId: 'service:svc-1' } })
      await wrapper.vm.$nextTick()

      const rendersNonEmpty = wrapper.text() !== ''
      expect(rendersNonEmpty).toBe(hasVisibleSaveStatus(entry))
    })
  }

  it("hasVisibleSaveStatus is false for the fresh idle object entryFor returns for an unknown surface id", () => {
    const entry = useSaveStatus().entryFor('service:never-registered')
    expect(entry).toEqual({ status: 'idle' })
    expect(hasVisibleSaveStatus(entry)).toBe(false)
  })
})
