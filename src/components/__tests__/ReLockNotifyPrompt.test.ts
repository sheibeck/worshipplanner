import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises, DOMWrapper, enableAutoUnmount } from '@vue/test-utils'
import { nextTick } from 'vue'
import ReLockNotifyPrompt from '../ReLockNotifyPrompt.vue'
import type { Service } from '@/types/service'
import type { Person, Role, Quarter } from '@/types/roster'
import type { ChangeEntry } from '@/utils/serviceLockDiff'

// ── Mocks ────────────────────────────────────────────────────────────────────
// Mirrors MessageComposer.test.ts: the queueServiceMessage callable is stubbed so
// this suite proves the modal's WIRING (checkable diff → affected-teams union →
// Reaches-N; selector-only + changeDiff payload; disabled-Send states; emitted
// cancel/sent), never the server send path. The pure resolver (resolveRecipients)
// is fed REAL fixtures — the counts below are the resolver's genuine output.

const mockQueueServiceMessage = vi.fn<(...args: unknown[]) => Promise<{ data: { messageId: string } }>>(
  () => Promise.resolve({ data: { messageId: 'msg-1' } }),
)
const mockHttpsCallable = vi.fn<(...args: unknown[]) => typeof mockQueueServiceMessage>(() => mockQueueServiceMessage)

vi.mock('firebase/functions', () => ({
  httpsCallable: (...args: unknown[]) => mockHttpsCallable(...args),
}))

vi.mock('@/firebase', () => ({
  functions: {},
}))

// Teleport-to-body: every query goes through body(), per Vue Test Utils'
// documented Teleport testing pattern (same as MessageComposer.test.ts).
enableAutoUnmount(afterEach)
function body() {
  return new DOMWrapper(document.body)
}

// ── Fixtures ─────────────────────────────────────────────────────────────────

function mkPerson(id: string, name: string, email: string): Person {
  return {
    id,
    name,
    email,
    phone: '',
    active: true,
    roles: [],
    pcPersonId: null,
    createdAt: null as never,
    updatedAt: null as never,
  }
}

const roles: Role[] = [
  { id: 'r-band', name: 'guitar', group: 'band', defaultCount: 1, order: 0 },
  { id: 'r-tech', name: 'sound', group: 'tech', defaultCount: 1, order: 1 },
]

// p2 and p5 have no email → unreachable. Everyone else is reachable.
const people: Person[] = [
  mkPerson('p1', 'Alice', 'alice@example.com'),
  mkPerson('p2', 'Bob', ''),
  mkPerson('p3', 'Cara', 'cara@example.com'),
  mkPerson('p5', 'Ed', ''),
]

// band → p1 (reachable) + p2 (unreachable); tech → p3 (reachable) + p5 (unreachable)
const service: Service = {
  id: 'svc-1',
  date: '2026-08-16',
  name: 'Sunday Morning',
  progression: '1-2-2-3',
  teams: [],
  status: 'planned',
  slots: [
    { id: 's1', kind: 'SONG', position: 0, requiredVwType: 'VW', songId: 'song-1', songTitle: 'Amazing Grace', songKey: 'G' },
  ] as never,
  sermonPassage: null,
  notes: '',
  createdAt: null as never,
  updatedAt: null as never,
  roleAssignmentOverrides: {
    'r-band': ['p1', 'p2'],
    'r-tech': ['p3', 'p5'],
  },
}

const quarters: Quarter[] = []

// e0 SONG (broad band+tech) · e1 ROLE (narrow band) · e2 NOTES (broad band+tech)
const entries: ChangeEntry[] = [
  { type: 'SONG', description: 'Song changed', affectedTeams: ['band', 'tech'] },
  { type: 'ROLE', description: 'guitar assignment changed', affectedTeams: ['band'] },
  { type: 'NOTES', description: 'Service notes changed', affectedTeams: ['band', 'tech'] },
]

// A single vocals-only entry — vocals has no assigned role → zero reachable.
const vocalsOnlyEntries: ChangeEntry[] = [
  { type: 'ROLE', description: 'backing vocal assignment changed', affectedTeams: ['vocals'] },
]

function mountPrompt(props?: Record<string, unknown>) {
  return mount(ReLockNotifyPrompt, {
    props: {
      open: true,
      service,
      quarters,
      roles,
      people,
      orgId: 'org-1',
      entries,
      ...props,
    },
  })
}

function q(testId: string) {
  return body().find(`[data-testid="${testId}"]`)
}

function qa(testId: string) {
  return body().findAll(`[data-testid="${testId}"]`)
}

function rows() {
  return body().findAll('[data-testid^="change-row-"]')
}

async function toggleRow(i: number) {
  const el = q(`change-check-${i}`).element as HTMLInputElement
  el.checked = !el.checked
  el.dispatchEvent(new Event('change'))
  await nextTick()
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('ReLockNotifyPrompt', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockHttpsCallable.mockReturnValue(mockQueueServiceMessage)
    mockQueueServiceMessage.mockResolvedValue({ data: { messageId: 'msg-1' } })
  })

  it('renders one checkable row per ChangeEntry with its type badge, description, and team-label chips', () => {
    mountPrompt()
    expect(rows().length).toBe(3)

    // Type badges carry the coarse ChangeEntry.type label.
    expect(q('change-row-0').text()).toContain('SONG')
    expect(q('change-row-1').text()).toContain('ROLE')
    expect(q('change-row-2').text()).toContain('NOTES')

    // Descriptions.
    expect(q('change-row-0').text()).toContain('Song changed')
    expect(q('change-row-1').text()).toContain('guitar assignment changed')

    // Team chips use MESSAGING_TEAM_LABELS (band→Worship, tech→Tech).
    expect(q('change-row-0').text()).toContain('Worship')
    expect(q('change-row-0').text()).toContain('Tech')
    // The ROLE row is narrow — exactly one chip (Worship), no Tech.
    expect(q('change-row-1').text()).toContain('Worship')
    expect(q('change-row-1').text()).not.toContain('Tech')
  })

  it('starts with every row CHECKED and the recipient choice on Affected teams', () => {
    mountPrompt()
    for (let i = 0; i < 3; i++) {
      expect((q(`change-check-${i}`).element as HTMLInputElement).checked).toBe(true)
    }
    expect(q('notify-affected').attributes('aria-checked')).toBe('true')
    expect(q('notify-everyone').attributes('aria-checked')).toBe('false')
  })

  it('renders a pluralization-safe change-count line', () => {
    mountPrompt()
    expect(q('change-count').text()).toContain('3 changes since the last lock')

    const single = mountPrompt({ entries: [entries[0]] })
    void single
    expect(qa('change-count').length).toBeGreaterThan(0)
    // The most-recently-mounted instance shows the singular form.
    expect(qa('change-count').some((w) => w.text().includes('1 change since the last lock'))).toBe(true)
  })

  it('renders nothing when open is false', () => {
    mountPrompt({ open: false })
    expect(q('change-row-0').exists()).toBe(false)
    expect(q('reaches-count').exists()).toBe(false)
  })

  it('Affected teams (default) resolves to the union of affectedTeams across CHECKED rows', () => {
    mountPrompt()
    // All 3 checked → union {band, tech} → reachable p1 (band) + p3 (tech) = 2.
    expect(q('reaches-count').text()).toContain('Reaches 2 people')
    // 2 selected have no email (Bob, Ed).
    expect(q('reaches-count').text()).toContain('2')
    expect(q('reaches-count').text()).toContain('no email')
  })

  it('unchecking the broad rows narrows the union to a single team and re-lowers Reaches-N', async () => {
    mountPrompt()
    expect(q('reaches-count').text()).toContain('Reaches 2 people')
    // Uncheck e0 (SONG broad) and e2 (NOTES broad) → only e1 (ROLE band) remains.
    await toggleRow(0)
    await toggleRow(2)
    // Union now {band} → reachable p1 only = 1 person.
    expect(q('reaches-count').text()).toContain('Reaches 1 person')
  })

  it('switching to Everyone recomputes over every assigned role regardless of the checked union', async () => {
    mountPrompt()
    // Narrow to the ROLE-only band union first (reaches 1).
    await toggleRow(0)
    await toggleRow(2)
    expect(q('reaches-count').text()).toContain('Reaches 1 person')

    await q('notify-everyone').trigger('click')
    expect(q('notify-everyone').attributes('aria-checked')).toBe('true')
    // Everyone ignores the team filter → band + tech assigned → p1 + p3 = 2.
    expect(q('reaches-count').text()).toContain('Reaches 2 people')
  })

  it('reads "Reaches 0 people" when the checked union reaches no one', () => {
    mountPrompt({ entries: vocalsOnlyEntries })
    // vocals has no assigned role → 0 reachable.
    expect(q('reaches-count').text()).toContain('Reaches 0 people')
  })

  describe('Send notice', () => {
    it('calls queueServiceMessage once with type:relock-notification, the selector, and changeDiff = the CHECKED entries', async () => {
      const wrapper = mountPrompt()
      // All 3 checked, Affected teams → union {band, tech}, reaches 2 → enabled.
      expect((q('send-btn').element as HTMLButtonElement).disabled).toBe(false)

      await q('send-btn').trigger('click')
      await flushPromises()

      expect(mockHttpsCallable).toHaveBeenCalledWith({}, 'queueServiceMessage')
      expect(mockQueueServiceMessage).toHaveBeenCalledTimes(1)
      const payload = mockQueueServiceMessage.mock.calls[0]![0] as Record<string, unknown>
      expect(payload).toMatchObject({
        orgId: 'org-1',
        serviceId: 'svc-1',
        type: 'relock-notification',
        recipientSelector: {
          teams: ['band', 'tech'],
          individualPersonIds: [],
          includeEveryone: false,
        },
        options: { attachServiceLink: true, sendCopyToSelf: false },
        scheduledFor: null,
        changeDiff: entries,
      })
      // Selector only — no resolved email address crosses to the server.
      const serialized = JSON.stringify(payload)
      expect(serialized).not.toContain('@example.com')

      // Success → emits `sent` exactly once, and NEVER cancel.
      expect(wrapper.emitted('sent')).toBeTruthy()
      expect(wrapper.emitted('sent')!.length).toBe(1)
      expect(wrapper.emitted('cancel')).toBeFalsy()
    })

    it('sends changeDiff = only the CHECKED entries and the Everyone selector when Everyone is chosen', async () => {
      mountPrompt()
      // Uncheck e0 (SONG) → changeDiff should carry only e1 + e2.
      await toggleRow(0)
      await q('notify-everyone').trigger('click')

      await q('send-btn').trigger('click')
      await flushPromises()

      const payload = mockQueueServiceMessage.mock.calls[0]![0] as {
        recipientSelector: { teams: string[]; includeEveryone: boolean }
        changeDiff: ChangeEntry[]
      }
      expect(payload.recipientSelector).toEqual({ teams: [], individualPersonIds: [], includeEveryone: true })
      expect(payload.changeDiff).toEqual([entries[1], entries[2]])
    })

    it('Send is disabled with an explanatory title when zero entries are checked', async () => {
      mountPrompt()
      await toggleRow(0)
      await toggleRow(1)
      await toggleRow(2)
      const btn = q('send-btn').element as HTMLButtonElement
      expect(btn.disabled).toBe(true)
      expect(btn.getAttribute('title')).toContain('Select at least one change')
    })

    it('Send is disabled with an explanatory title when the selection reaches zero people', () => {
      mountPrompt({ entries: vocalsOnlyEntries })
      const btn = q('send-btn').element as HTMLButtonElement
      expect(btn.disabled).toBe(true)
      expect(btn.getAttribute('title')).toContain('anyone with an email')
    })

    it('Send is disabled and reads "Sending…" while a send is in flight', async () => {
      let release: (v: { data: { messageId: string } }) => void = () => {}
      mockQueueServiceMessage.mockReturnValueOnce(new Promise((res) => { release = res }))
      mountPrompt()

      await q('send-btn').trigger('click')
      await nextTick()

      const btn = q('send-btn').element as HTMLButtonElement
      expect(btn.disabled).toBe(true)
      expect(q('send-btn').text()).toContain('Sending…')

      release({ data: { messageId: 'msg-1' } })
      await flushPromises()
    })

    it('a rejected send shows the inline error, re-enables Send, and emits NEITHER sent NOR cancel', async () => {
      mockQueueServiceMessage.mockRejectedValueOnce(new Error('network went away'))
      const wrapper = mountPrompt()

      await q('send-btn').trigger('click')
      await flushPromises()

      expect(q('send-error').exists()).toBe(true)
      expect(q('send-error').text()).toContain('Couldn’t send the notice')
      // Re-enabled for a safe retry (still 3 checked, reaches 2).
      expect((q('send-btn').element as HTMLButtonElement).disabled).toBe(false)
      // The parent must NOT overwrite the snapshot on a failed send (SC4).
      expect(wrapper.emitted('sent')).toBeFalsy()
      expect(wrapper.emitted('cancel')).toBeFalsy()
    })

    it('shows the kill-switch variant when the server rejects with failed-precondition', async () => {
      mockQueueServiceMessage.mockRejectedValueOnce({ code: 'functions/failed-precondition', message: 'off' })
      mountPrompt()

      await q('send-btn').trigger('click')
      await flushPromises()

      expect(q('send-error').text()).toContain('Messaging is turned off for your organization')
    })
  })

  describe('Lock quietly / dismiss (no send)', () => {
    it('Lock quietly emits cancel and NEVER calls queueServiceMessage', async () => {
      const wrapper = mountPrompt()
      await q('lock-quietly-btn').trigger('click')
      expect(wrapper.emitted('cancel')).toBeTruthy()
      expect(wrapper.emitted('cancel')!.length).toBe(1)
      expect(mockQueueServiceMessage).not.toHaveBeenCalled()
    })

    it('Lock quietly stays enabled and emits cancel even when the selection reaches zero people', async () => {
      const wrapper = mountPrompt({ entries: vocalsOnlyEntries })
      // Send is blocked (zero reachable), but Lock quietly is never disabled.
      expect((q('send-btn').element as HTMLButtonElement).disabled).toBe(true)
      const lock = q('lock-quietly-btn').element as HTMLButtonElement
      expect(lock.disabled).toBe(false)
      await q('lock-quietly-btn').trigger('click')
      expect(wrapper.emitted('cancel')).toBeTruthy()
      expect(mockQueueServiceMessage).not.toHaveBeenCalled()
    })

    it('the ✕ close button emits cancel with no send', async () => {
      const wrapper = mountPrompt()
      await q('close-btn').trigger('click')
      expect(wrapper.emitted('cancel')).toBeTruthy()
      expect(mockQueueServiceMessage).not.toHaveBeenCalled()
    })

    it('a backdrop click emits cancel with no send', async () => {
      const wrapper = mountPrompt()
      await q('backdrop').trigger('click')
      expect(wrapper.emitted('cancel')).toBeTruthy()
      expect(mockQueueServiceMessage).not.toHaveBeenCalled()
    })

    it('Escape emits cancel with no send', async () => {
      const wrapper = mountPrompt()
      await body().find('[role="dialog"]').trigger('keydown.esc')
      expect(wrapper.emitted('cancel')).toBeTruthy()
      expect(mockQueueServiceMessage).not.toHaveBeenCalled()
    })
  })
})
