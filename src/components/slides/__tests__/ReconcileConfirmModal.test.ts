import { describe, it, expect, afterEach, vi } from 'vitest'
import { mount, DOMWrapper, enableAutoUnmount } from '@vue/test-utils'
import ReconcileConfirmModal from '../ReconcileConfirmModal.vue'
import type { ServiceSlot } from '@/types/service'
import type { GroupSlideEntry } from '@/types/slideGroup'
import type { PendingReconciliation } from '../slideDisplay'

// This dialog is a SECOND, independently-teleported surface alongside the
// Edit Slide drawer (26-RESEARCH.md Pitfall 3) — auto-unmount is required so
// a leaked node from a previous test never satisfies the wrong query.
enableAutoUnmount(afterEach)

function body() {
  return new DOMWrapper(document.body)
}

function makeSlot(
  overrides: Partial<ServiceSlot> & { kind: ServiceSlot['kind']; id: string; position: number },
): ServiceSlot {
  return { ...overrides } as ServiceSlot
}

function makePending(overrides: Partial<PendingReconciliation> = {}): PendingReconciliation {
  return {
    slotId: 'slot-1',
    proposed: [] as GroupSlideEntry[],
    ...overrides,
  }
}

function makeSongSlot(overrides: Partial<ServiceSlot> = {}): ServiceSlot {
  return makeSlot({
    kind: 'SONG',
    id: 'slot-1',
    position: 0,
    songId: 's1',
    songTitle: 'This Is Our God',
    songKey: null,
    requiredVwType: 1,
    ...overrides,
  } as never)
}

function mountModal(props: {
  open?: boolean
  pending?: PendingReconciliation | null
  planItem?: ServiceSlot | null
}) {
  return mount(ReconcileConfirmModal, {
    props: {
      open: props.open ?? true,
      pending: props.pending === undefined ? makePending() : props.pending,
      planItem: props.planItem === undefined ? makeSongSlot() : props.planItem,
    },
  })
}

describe('ReconcileConfirmModal', () => {
  it('renders teleported to the document body, centred over a dimming layer, when open', () => {
    mountModal({})
    expect(body().find('[data-testid="reconcile-confirm-modal"]').exists()).toBe(true)
    expect(body().find('[data-testid="reconcile-confirm-modal-scrim"]').exists()).toBe(true)
  })

  it('renders nothing when mounted closed', () => {
    mountModal({ open: false })
    expect(body().find('[data-testid="reconcile-confirm-modal"]').exists()).toBe(false)
    expect(body().find('[data-testid="reconcile-confirm-modal-scrim"]').exists()).toBe(false)
  })

  it('renders nothing when mounted with no pending update, even if asked to open', () => {
    mountModal({ pending: null })
    expect(body().find('[data-testid="reconcile-confirm-modal"]').exists()).toBe(false)
  })

  it('renders nothing when mounted with no plan item, even if asked to open', () => {
    mountModal({ planItem: null })
    expect(body().find('[data-testid="reconcile-confirm-modal"]').exists()).toBe(false)
  })

  it('clicking the dimming layer does nothing — the dialog stays open and no choice is made', async () => {
    const wrapper = mountModal({})
    await body().get('[data-testid="reconcile-confirm-modal-scrim"]').trigger('click')

    expect(body().find('[data-testid="reconcile-confirm-modal"]').exists()).toBe(true)
    expect(wrapper.emitted('apply')).toBeUndefined()
    expect(wrapper.emitted('dismiss')).toBeUndefined()
  })

  it('pressing Escape resolves it as a decline, the safe default', () => {
    const wrapper = mountModal({})
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))

    expect(wrapper.emitted('dismiss')).toHaveLength(1)
    expect(wrapper.emitted('apply')).toBeUndefined()
  })

  it('a subsequent Escape after closing emits nothing', async () => {
    const wrapper = mountModal({})
    await wrapper.setProps({ open: false })
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))

    expect(wrapper.emitted('dismiss')).toBeUndefined()
  })

  it('removes the Escape listener on unmount', () => {
    const removeSpy = vi.spyOn(window, 'removeEventListener')
    const wrapper = mountModal({})
    wrapper.unmount()

    expect(removeSpy).toHaveBeenCalledWith('keydown', expect.any(Function))
    removeSpy.mockRestore()
  })

  it('renders exactly two action buttons with the UI-SPEC labels, each emitting its own intent once', async () => {
    const wrapper = mountModal({})
    const applyButton = body().get('[data-testid="reconcile-confirm-modal-apply"]')
    const dismissButton = body().get('[data-testid="reconcile-confirm-modal-dismiss"]')

    expect(applyButton.text()).toBe('Apply source changes')
    expect(dismissButton.text()).toBe('Dismiss')

    await applyButton.trigger('click')
    await dismissButton.trigger('click')

    expect(wrapper.emitted('apply')).toHaveLength(1)
    expect(wrapper.emitted('dismiss')).toHaveLength(1)
  })

  it('renders the generic heading/body naming the plan item when the pending update carries no song titles', () => {
    mountModal({
      pending: makePending({ loss: { customizedEntries: 3, withAudio: 1, withNotes: 0 } }),
      planItem: makeSongSlot({ songTitle: 'This Is Our God' }),
    })

    expect(body().get('[data-testid="reconcile-confirm-modal-heading"]').text()).toBe("Update this group's slides?")
    const bodyText = body().get('[data-testid="reconcile-confirm-modal-body"]').text()
    expect(bodyText).toContain('This Is Our God')
    expect(bodyText).toContain('3 slides')
    expect(bodyText).toContain('1 with attached audio')
  })

  it('renders the song-swap heading/body naming both songs when the pending update carries both song titles', () => {
    mountModal({
      pending: makePending({ oldSongTitle: 'Old Song', newSongTitle: 'New Song' }),
    })

    expect(body().get('[data-testid="reconcile-confirm-modal-heading"]').text()).toBe(
      'Replace "Old Song" with "New Song"?',
    )
    const bodyText = body().get('[data-testid="reconcile-confirm-modal-body"]').text()
    expect(bodyText).toContain('Old Song')
    expect(bodyText).toContain('New Song')
  })

  it('renders no element listing the proposed slides individually — no diff, no list (D-06)', () => {
    mountModal({
      pending: makePending({
        proposed: [
          { id: 'p1', order: 0, sourceRef: { kind: 'text' } },
          { id: 'p2', order: 1, sourceRef: { kind: 'text' } },
        ],
      }),
    })

    const dialogText = body().get('[data-testid="reconcile-confirm-modal"]').text()
    expect(dialogText).not.toContain('p1')
    expect(dialogText).not.toContain('p2')
    expect(body().findAll('li').length).toBe(0)
  })

  // --- Task 3: the dialog cannot outlive the decision it is about ---
  it('closes itself and removes its Escape binding when the pending update is cleared while open', async () => {
    const wrapper = mountModal({})
    expect(body().find('[data-testid="reconcile-confirm-modal"]').exists()).toBe(true)

    await wrapper.setProps({ pending: null })
    expect(body().find('[data-testid="reconcile-confirm-modal"]').exists()).toBe(false)

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(wrapper.emitted('dismiss')).toBeUndefined()
  })
})
