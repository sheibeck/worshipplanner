import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, RouterLinkStub } from '@vue/test-utils'
import ServiceMessageHistory from '../ServiceMessageHistory.vue'
import type { ServiceMessageDoc, BouncedRecipient } from '@/stores/serviceMessages'

const FIXED_NOW = new Date('2026-08-14T12:00:00Z').getTime()

function makeMessage(overrides: Partial<ServiceMessageDoc> & { id: string }): ServiceMessageDoc {
  return {
    type: 'oneoff',
    status: 'sent',
    subject: 'Test subject',
    sentAt: { toMillis: () => FIXED_NOW - 60_000 } as never,
    scheduledFor: null,
    createdAt: { toMillis: () => FIXED_NOW - 60_000 } as never,
    deliveryCounts: { sent: 3, failed: 0, bounced: 0 },
    ...overrides,
  }
}

function mountHistory(props: {
  messages: ServiceMessageDoc[]
  recipientsByMessage?: Record<string, BouncedRecipient[]>
  loading?: boolean
  error?: boolean
}) {
  return mount(ServiceMessageHistory, {
    props,
    global: {
      stubs: { RouterLink: RouterLinkStub },
    },
  })
}

describe('ServiceMessageHistory', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(FIXED_NOW)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders one row per message, newest-first (input order preserved)', () => {
    const messages = [
      makeMessage({ id: 'm2', subject: 'Second' }),
      makeMessage({ id: 'm1', subject: 'First' }),
    ]
    const wrapper = mountHistory({ messages })
    const rows = wrapper.findAll('[data-testid="message-row"]')
    expect(rows).toHaveLength(2)
    expect(rows[0]!.text()).toContain('Second')
    expect(rows[1]!.text()).toContain('First')
  })

  it('maps the type badge label per message type', () => {
    const messages = [
      makeMessage({ id: 'm1', type: 'oneoff' }),
      makeMessage({ id: 'm2', type: 'reminder' }),
      makeMessage({ id: 'm3', type: 'share-link' }),
      makeMessage({ id: 'm4', type: 'lock-notification' }),
      makeMessage({ id: 'm5', type: 'relock-notification' }),
    ]
    const wrapper = mountHistory({ messages })
    const badges = wrapper.findAll('[data-testid="type-badge"]')
    expect(badges.map((b) => b.text())).toEqual([
      'One-off',
      'Reminder',
      'Share link',
      'Automatic',
      'Automatic',
    ])
  })

  it('shows no status pill for a clean sent message', () => {
    const messages = [makeMessage({ id: 'm1', status: 'sent', deliveryCounts: { sent: 2, failed: 0, bounced: 0 } })]
    const wrapper = mountHistory({ messages })
    expect(wrapper.find('[data-testid="status-pill"]').exists()).toBe(false)
  })

  it('renders the status pill for partial / failed / scheduled / sending', () => {
    const cases: Array<[ServiceMessageDoc['status'], string]> = [
      ['partial', 'Partial'],
      ['failed', 'Failed'],
      ['scheduled', 'Scheduled'],
      ['sending', 'Sending'],
    ]
    for (const [status, label] of cases) {
      const wrapper = mountHistory({
        messages: [makeMessage({ id: 'm1', status, scheduledFor: status === 'scheduled' ? '2026-09-01T10:00:00Z' : null })],
      })
      const pill = wrapper.find('[data-testid="status-pill"]')
      expect(pill.exists()).toBe(true)
      expect(pill.text()).toContain(label)
    }
  })

  it('surfaces an aged (> 5 min) queued row as a red "Failed to send" pill with no spinner', () => {
    const wrapper = mountHistory({
      messages: [
        makeMessage({
          id: 'm1',
          status: 'queued',
          sentAt: null,
          createdAt: { toMillis: () => FIXED_NOW - 6 * 60_000 } as never,
        }),
      ],
    })
    const pill = wrapper.find('[data-testid="status-pill"]')
    expect(pill.exists()).toBe(true)
    expect(pill.text()).toContain('Failed to send')
    expect(pill.classes()).toContain('bg-red-900/50')
    expect(pill.find('.animate-spin').exists()).toBe(false)
    // The time line must not disagree with the pill.
    expect(wrapper.find('[data-testid="count-line"]').text()).toContain('Failed to send')
  })

  it('keeps the grey "Sending…" spinner for a recent (< 5 min) sending row', () => {
    const wrapper = mountHistory({
      messages: [
        makeMessage({
          id: 'm1',
          status: 'sending',
          sentAt: null,
          createdAt: { toMillis: () => FIXED_NOW - 60_000 } as never,
        }),
      ],
    })
    const pill = wrapper.find('[data-testid="status-pill"]')
    expect(pill.exists()).toBe(true)
    expect(pill.text()).toContain('Sending')
    expect(pill.text()).not.toContain('Failed')
    expect(pill.find('.animate-spin').exists()).toBe(true)
    expect(wrapper.find('[data-testid="count-line"]').text()).toContain('Sending')
  })

  it('treats a null createdAt as not-yet-aged (keeps the "Sending…" spinner)', () => {
    const wrapper = mountHistory({
      messages: [makeMessage({ id: 'm1', status: 'queued', sentAt: null, createdAt: null })],
    })
    const pill = wrapper.find('[data-testid="status-pill"]')
    expect(pill.exists()).toBe(true)
    expect(pill.text()).toContain('Sending')
    expect(pill.text()).not.toContain('Failed')
    expect(pill.find('.animate-spin').exists()).toBe(true)
  })

  it('shows a "Scheduled for" send-time line for a scheduled message', () => {
    const wrapper = mountHistory({
      messages: [makeMessage({ id: 'm1', status: 'scheduled', sentAt: null, scheduledFor: '2026-09-01T10:00:00Z' })],
    })
    expect(wrapper.text()).toContain('Scheduled for')
  })

  it('renders the red bounce indicator ONLY when bounced > 0', () => {
    const clean = mountHistory({ messages: [makeMessage({ id: 'm1', deliveryCounts: { sent: 3, failed: 0, bounced: 0 } })] })
    expect(clean.find('[data-testid="bounce-indicator"]').exists()).toBe(false)

    const bounced = mountHistory({ messages: [makeMessage({ id: 'm1', deliveryCounts: { sent: 3, failed: 0, bounced: 2 } })] })
    const indicator = bounced.find('[data-testid="bounce-indicator"]')
    expect(indicator.exists()).toBe(true)
    expect(indicator.text()).toContain('2 bounced')
    expect(indicator.attributes('aria-expanded')).toBe('false')
  })

  it('clicking the bounce indicator emits expand and reveals the sublist', async () => {
    const messages = [makeMessage({ id: 'm1', deliveryCounts: { sent: 3, failed: 0, bounced: 1 } })]
    const recipientsByMessage = {
      m1: [{ personId: 'p1', name: 'Micah T.', email: 'micah@example.com', bounceReason: 'address rejected' }],
    }
    const wrapper = mountHistory({ messages, recipientsByMessage })

    const indicator = wrapper.find('[data-testid="bounce-indicator"]')
    await indicator.trigger('click')

    expect(wrapper.emitted('expand')).toBeTruthy()
    expect(wrapper.emitted('expand')![0]).toEqual(['m1'])
    expect(indicator.attributes('aria-expanded')).toBe('true')

    const recips = wrapper.findAll('[data-testid="bounced-recipient"]')
    expect(recips).toHaveLength(1)
    expect(recips[0]!.text()).toContain('Micah T.')
    expect(recips[0]!.text()).toContain('micah@example.com')
    expect(recips[0]!.text()).toContain('address rejected')
  })

  it('falls back to "Address rejected" when bounceReason is null', async () => {
    const messages = [makeMessage({ id: 'm1', deliveryCounts: { sent: 1, failed: 0, bounced: 1 } })]
    const recipientsByMessage = {
      m1: [{ personId: 'p1', name: 'Dana R.', email: 'dana@example.com', bounceReason: null }],
    }
    const wrapper = mountHistory({ messages, recipientsByMessage })
    await wrapper.find('[data-testid="bounce-indicator"]').trigger('click')
    expect(wrapper.find('[data-testid="bounced-recipient"]').text()).toContain('Address rejected')
  })

  it('shows a compact Loading… line while the expanded sublist has no recipients yet', async () => {
    const messages = [makeMessage({ id: 'm1', deliveryCounts: { sent: 1, failed: 0, bounced: 1 } })]
    // recipientsByMessage does NOT include m1 yet (parent has not resolved it)
    const wrapper = mountHistory({ messages, recipientsByMessage: {} })
    await wrapper.find('[data-testid="bounce-indicator"]').trigger('click')
    expect(wrapper.text()).toContain('Loading…')
    expect(wrapper.findAll('[data-testid="bounced-recipient"]')).toHaveLength(0)
  })

  it('renders a Fix email deep-link to /volunteers?edit={personId} and emits fixAddress', async () => {
    const messages = [makeMessage({ id: 'm1', deliveryCounts: { sent: 1, failed: 0, bounced: 1 } })]
    const recipientsByMessage = {
      m1: [{ personId: 'p42', name: 'Micah T.', email: 'micah@example.com', bounceReason: 'address rejected' }],
    }
    const wrapper = mountHistory({ messages, recipientsByMessage })
    await wrapper.find('[data-testid="bounce-indicator"]').trigger('click')

    const link = wrapper.findComponent(RouterLinkStub)
    expect(link.exists()).toBe(true)
    expect(link.props('to')).toEqual({ name: 'volunteers', query: { edit: 'p42' } })

    await wrapper.find('[data-testid="fix-email-link"]').trigger('click')
    expect(wrapper.emitted('fixAddress')![0]).toEqual(['p42'])
  })

  it('emits newMessage when the header ✉ New message button is clicked', async () => {
    const wrapper = mountHistory({ messages: [makeMessage({ id: 'm1' })] })
    await wrapper.find('[data-testid="new-message-btn"]').trigger('click')
    expect(wrapper.emitted('newMessage')).toHaveLength(1)
  })

  it('renders the empty state when there are no messages', () => {
    const wrapper = mountHistory({ messages: [] })
    expect(wrapper.find('[data-testid="history-empty"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('Nothing sent yet')
    expect(wrapper.findAll('[data-testid="message-row"]')).toHaveLength(0)
  })

  it('renders the loading state when loading is true', () => {
    const wrapper = mountHistory({ messages: [], loading: true })
    expect(wrapper.find('[data-testid="history-loading"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('Loading message history')
  })

  it('renders the error state when error is true', () => {
    const wrapper = mountHistory({ messages: [], error: true })
    expect(wrapper.find('[data-testid="history-error"]').exists()).toBe(true)
    expect(wrapper.text()).toContain("Couldn't load message history. Please refresh.")
  })

  it('pluralizes the sent count at 0 / 1 / many', () => {
    const zero = mountHistory({ messages: [makeMessage({ id: 'm1', deliveryCounts: { sent: 0, failed: 0, bounced: 0 } })] })
    expect(zero.find('[data-testid="count-line"]').text()).toContain('0 sent')

    const one = mountHistory({ messages: [makeMessage({ id: 'm1', deliveryCounts: { sent: 1, failed: 0, bounced: 0 } })] })
    expect(one.find('[data-testid="count-line"]').text()).toContain('1 sent')

    const many = mountHistory({ messages: [makeMessage({ id: 'm1', deliveryCounts: { sent: 14, failed: 0, bounced: 0 } })] })
    expect(many.find('[data-testid="count-line"]').text()).toContain('14 sent')
  })

  it('pluralizes the bounce indicator at 1 / many', () => {
    const one = mountHistory({ messages: [makeMessage({ id: 'm1', deliveryCounts: { sent: 2, failed: 0, bounced: 1 } })] })
    expect(one.find('[data-testid="bounce-indicator"]').text()).toContain('1 bounced')

    const many = mountHistory({ messages: [makeMessage({ id: 'm1', deliveryCounts: { sent: 2, failed: 0, bounced: 2 } })] })
    expect(many.find('[data-testid="bounce-indicator"]').text()).toContain('2 bounced')
  })
})
