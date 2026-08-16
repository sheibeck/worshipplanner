import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises, DOMWrapper, enableAutoUnmount } from '@vue/test-utils'
import { nextTick } from 'vue'
import MessageComposer from '../MessageComposer.vue'
import type { Service } from '@/types/service'
import type { Person, Role, Quarter } from '@/types/roster'

// ── Mocks ────────────────────────────────────────────────────────────────────
// Mirrors PptxImportModal.test.ts: the onCall RPC is stubbed so this suite
// proves the composer's WIRING (selection → selector-only payload, Reaches-N,
// token insertion, disabled-Send states, emitted cancel/sent), never the
// server send path. The pure resolver (resolveRecipients) is fed REAL fixtures
// (serviceRoles.test discipline) — the counts below are the resolver's genuine
// output, not a mock's.

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

// The failure-toast store (success/queued toast on send). Mocked so the
// composer needs no active Pinia instance in this suite.
const mockToastPush = vi.fn()
vi.mock('@/stores/toasts', () => ({
  useToasts: () => ({ push: (...args: unknown[]) => mockToastPush(...args) }),
}))

// Teleport-to-body: every query goes through body(), per Vue Test Utils'
// documented Teleport testing pattern (same as PptxImportModal.test.ts).
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
  mkPerson('p4', 'Dan', 'dan@example.com'), // unassigned — addable as an individual
]

// band → p1 (reachable) + p2 (unreachable); tech → p3 (reachable) + p5 (unreachable)
const service: Service = {
  id: 'svc-1',
  date: '2026-08-16',
  name: 'Sunday Morning',
  progression: '1-2-2-3',
  teams: [],
  status: 'draft',
  slots: [
    { id: 's1', kind: 'SONG', position: 0, requiredVwType: 'VW', songId: 'song-1', songTitle: 'Amazing Grace', songKey: 'G' },
    { id: 's2', kind: 'SONG', position: 1, requiredVwType: 'VW', songId: 'song-2', songTitle: 'How Great', songKey: 'C' },
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

function mountComposer(props?: Record<string, unknown>) {
  return mount(MessageComposer, {
    props: {
      open: true,
      service,
      quarters,
      roles,
      people,
      orgId: 'org-1',
      ...props,
    },
  })
}

function q(testId: string) {
  return body().find(`[data-testid="${testId}"]`)
}

async function fillSubject(value: string) {
  const el = q('subject-input').element as HTMLInputElement
  el.value = value
  el.dispatchEvent(new Event('input'))
  await nextTick()
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('MessageComposer', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockHttpsCallable.mockReturnValue(mockQueueServiceMessage)
    mockQueueServiceMessage.mockResolvedValue({ data: { messageId: 'msg-1' } })
  })

  it('renders the four team chips + Everyone + the Individuals panel', () => {
    mountComposer()
    expect(q('team-chip-band').exists()).toBe(true)
    expect(q('team-chip-tech').exists()).toBe(true)
    expect(q('team-chip-vocals').exists()).toBe(true)
    expect(q('team-chip-other').exists()).toBe(true)
    expect(q('everyone-chip').exists()).toBe(true)
    expect(q('add-someone-select').exists()).toBe(true)
    // Team labels come from MESSAGING_TEAM_LABELS (Band/Tech/Vocals/Other).
    expect(q('team-chip-band').text()).toContain('Band')
    expect(q('team-chip-other').text()).toContain('Other')
  })

  describe('Reaches-N pluralization (UI-SPEC :401 zero-one-many backstop)', () => {
    it('reads "Reaches 0 people" with nothing selected', () => {
      mountComposer()
      expect(q('reaches-count').text()).toContain('Reaches 0 people')
    })

    it('reads "Reaches 1 person" for a single reachable recipient (tech → Cara)', async () => {
      mountComposer()
      await q('team-chip-tech').trigger('click')
      expect(q('reaches-count').text()).toContain('Reaches 1 person')
      // one no-email recipient in tech (Ed) → singular "has"
      expect(q('unreachable-note').text()).toContain('1 selected person has no email')
    })

    it('reads "Reaches 2 people" and "2 selected people have no email" for band + tech', async () => {
      mountComposer()
      await q('team-chip-band').trigger('click')
      await q('team-chip-tech').trigger('click')
      expect(q('reaches-count').text()).toContain('Reaches 2 people')
      expect(q('unreachable-note').text()).toContain('2 selected people have no email')
    })
  })

  it('per-team chips display their reachable count as "{label} · {count}"', () => {
    mountComposer()
    // band → 1 reachable (Alice; Bob has no email)
    expect(q('team-chip-band').text()).toMatch(/Band\s*·\s*1/)
    // tech → 1 reachable (Cara; Ed has no email)
    expect(q('team-chip-tech').text()).toMatch(/Tech\s*·\s*1/)
    // vocals → 0 assigned
    expect(q('team-chip-vocals').text()).toMatch(/Vocals\s*·\s*0/)
  })

  it('adding an individual writes individualPersonIds; the added person is excluded from the picker', async () => {
    mountComposer()
    const select = q('add-someone-select').element as HTMLSelectElement
    select.value = 'p4'
    select.dispatchEvent(new Event('change'))
    await nextTick()
    expect(q('individual-pill-p4').exists()).toBe(true)
    // Dan (p4) alone is reachable → 1 person
    expect(q('reaches-count').text()).toContain('Reaches 1 person')
    // p4 no longer an option in the picker
    expect(select.querySelector('option[value="p4"]')).toBeNull()
    // remove it again
    await q('remove-individual-p4').trigger('click')
    expect(q('individual-pill-p4').exists()).toBe(false)
    expect(q('reaches-count').text()).toContain('Reaches 0 people')
  })

  describe('add-someone picker (R152 — visible standalone select)', () => {
    it('has a DISABLED placeholder first option reading "＋ Add someone…" when people are addable', () => {
      mountComposer()
      const select = q('add-someone-select').element as HTMLSelectElement
      expect(select.disabled).toBe(false)
      const first = select.querySelector('option') as HTMLOptionElement
      expect(first.disabled).toBe(true)
      expect(first.value).toBe('')
      expect(first.textContent).toContain('＋ Add someone')
    })

    it('disables the select and shows "No one left to add" when nobody is addable', () => {
      mountComposer({ people: [] })
      const select = q('add-someone-select').element as HTMLSelectElement
      expect(select.disabled).toBe(true)
      const first = select.querySelector('option') as HTMLOptionElement
      expect(first.textContent).toContain('No one left to add')
    })
  })

  describe('always-on live preview (R153)', () => {
    it('renders the sample-preview on mount with NO Preview button, and updates live as the subject changes', async () => {
      mountComposer()
      // Present immediately — no click-to-preview toggle.
      expect(q('sample-preview').exists()).toBe(true)
      expect(q('preview-btn').exists()).toBe(false)
      // Editing the subject updates the rendered sample live.
      await fillSubject('Rehearsal at 8:15')
      expect(q('sample-preview').text()).toContain('Rehearsal at 8:15')
    })
  })

  describe('token palette + {{name}} sample (R154 client)', () => {
    it('offers a Name token chip and NO Song list chip', () => {
      mountComposer()
      expect(q('token-name').exists()).toBe(true)
      expect(q('token-song_list').exists()).toBe(false)
    })

    it('renders {{name}} as the sample recipient own name in the preview', async () => {
      mountComposer()
      // band → Alice (p1) reachable is the sample recipient.
      await q('team-chip-band').trigger('click')
      const el = q('body-textarea').element as HTMLTextAreaElement
      el.value = 'Hi {{name}}!'
      el.dispatchEvent(new Event('input'))
      await nextTick()
      expect(q('sample-preview').text()).toContain('Hi Alice!')
    })
  })

  describe('message type seeding with a dirty guard', () => {
    it('defaults to One-off (blank) and seeds Reminder/Share-link defaults when the draft is clean', async () => {
      mountComposer()
      expect((q('subject-input').element as HTMLInputElement).value).toBe('')

      await q('type-reminder').trigger('click')
      expect((q('subject-input').element as HTMLInputElement).value).not.toBe('')
      expect((q('body-textarea').element as HTMLTextAreaElement).value).toContain('{{service_link}}')

      // Share-link pre-inserts the {{service_link}} token.
      await q('type-share-link').trigger('click')
      expect((q('body-textarea').element as HTMLTextAreaElement).value).toContain('{{service_link}}')
    })

    it('does NOT overwrite a subject the user has edited (dirty guard)', async () => {
      mountComposer()
      await fillSubject('My own subject')
      await q('type-reminder').trigger('click')
      expect((q('subject-input').element as HTMLInputElement).value).toBe('My own subject')
      // body was untouched by the user → still seeded
      expect((q('body-textarea').element as HTMLTextAreaElement).value).not.toBe('')
    })

    it('Reminder defaults recipients to Everyone when the recipient set is clean (R156)', async () => {
      mountComposer()
      expect(q('everyone-chip').attributes('aria-checked')).toBe('false')
      await q('type-reminder').trigger('click')
      expect(q('everyone-chip').attributes('aria-checked')).toBe('true')
    })

    it('Reminder does NOT flip to Everyone after the user picked a team (recipientDirty guard)', async () => {
      mountComposer()
      await q('team-chip-band').trigger('click')
      await q('type-reminder').trigger('click')
      expect(q('everyone-chip').attributes('aria-checked')).toBe('false')
    })

    it('One-off and Share-link never auto-set Everyone', async () => {
      mountComposer()
      await q('type-oneoff').trigger('click')
      expect(q('everyone-chip').attributes('aria-checked')).toBe('false')
      await q('type-share-link').trigger('click')
      expect(q('everyone-chip').attributes('aria-checked')).toBe('false')
    })
  })

  it('a token chip inserts {{token}} at the caret and the body stores the RAW template', async () => {
    mountComposer()
    const el = q('body-textarea').element as HTMLTextAreaElement
    el.value = 'Hi there'
    el.dispatchEvent(new Event('input'))
    await nextTick()
    el.selectionStart = 2 // caret after "Hi"
    el.selectionEnd = 2
    await q('token-service_date').trigger('click')
    const after = (q('body-textarea').element as HTMLTextAreaElement).value
    expect(after).toBe('Hi{{service_date}} there')
    // RAW template — the literal token, never a rendered date.
    expect(after).toContain('{{service_date}}')
  })

  describe('options + schedule reveal', () => {
    it('attach-service-link defaults checked, send-me-a-copy defaults unchecked', () => {
      mountComposer()
      expect((q('opt-attach-link').element as HTMLInputElement).checked).toBe(true)
      expect((q('opt-send-copy').element as HTMLInputElement).checked).toBe(false)
    })

    it('toggling Schedule-for-later reveals the datetime input and flips the primary label to Schedule send', async () => {
      mountComposer()
      expect(q('scheduled-for').exists()).toBe(false)
      expect(q('send-btn').text()).toContain('Send now')

      const sched = q('opt-schedule').element as HTMLInputElement
      sched.checked = true
      sched.dispatchEvent(new Event('change'))
      await nextTick()

      expect(q('scheduled-for').exists()).toBe(true)
      expect(q('send-btn').text()).toContain('Schedule send')
    })
  })

  describe('Send disabled states (UI-SPEC :316-326)', () => {
    it('is disabled with an explanatory title when zero recipients are reachable', () => {
      mountComposer()
      const btn = q('send-btn').element as HTMLButtonElement
      expect(btn.disabled).toBe(true)
      expect(btn.getAttribute('title')).toBe('Select at least one team or person with an email')
    })

    it('is disabled when subject AND body are both empty even with reachable recipients', async () => {
      mountComposer()
      await q('team-chip-band').trigger('click')
      expect((q('send-btn').element as HTMLButtonElement).disabled).toBe(true)
      // one non-empty field unblocks it
      await fillSubject('Hello team')
      expect((q('send-btn').element as HTMLButtonElement).disabled).toBe(false)
    })

    it('is disabled when scheduling is on but the scheduled time is in the past', async () => {
      mountComposer()
      await q('team-chip-band').trigger('click')
      await fillSubject('Hello team')
      expect((q('send-btn').element as HTMLButtonElement).disabled).toBe(false)

      const sched = q('opt-schedule').element as HTMLInputElement
      sched.checked = true
      sched.dispatchEvent(new Event('change'))
      await nextTick()
      const dt = q('scheduled-for').element as HTMLInputElement
      dt.value = '2020-01-01T10:00'
      dt.dispatchEvent(new Event('input'))
      await nextTick()

      expect((q('send-btn').element as HTMLButtonElement).disabled).toBe(true)
      expect(q('schedule-error').exists()).toBe(true)
    })
  })

  describe('Send', () => {
    it('shows an in-button spinner + "Sending" and disables Send/Cancel while the send is in flight (R155)', async () => {
      let resolveSend!: (v: { data: { messageId: string } }) => void
      mockQueueServiceMessage.mockReturnValueOnce(
        new Promise((res) => {
          resolveSend = res
        }),
      )
      mountComposer()
      await q('team-chip-band').trigger('click')
      await fillSubject('Rehearsal at 8:15')

      await q('send-btn').trigger('click')
      await nextTick()

      // In-flight: disabled, spinner present, label reads "Sending", Cancel disabled.
      expect((q('send-btn').element as HTMLButtonElement).disabled).toBe(true)
      expect(q('send-btn').find('.animate-spin').exists()).toBe(true)
      expect(q('send-btn').text()).toContain('Sending')
      expect((q('cancel-btn').element as HTMLButtonElement).disabled).toBe(true)

      resolveSend({ data: { messageId: 'msg-1' } })
      await flushPromises()
      expect((q('send-btn').element as HTMLButtonElement).disabled).toBe(false)
      expect(q('send-btn').find('.animate-spin').exists()).toBe(false)
    })

    it('calls queueServiceMessage with the recipient SELECTOR only — no raw email list crosses to the server', async () => {
      const wrapper = mountComposer()
      await q('team-chip-band').trigger('click')
      await q('team-chip-tech').trigger('click')
      await fillSubject('Rehearsal moved to 8:15')

      await q('send-btn').trigger('click')
      await flushPromises()

      expect(mockHttpsCallable).toHaveBeenCalledWith({}, 'queueServiceMessage')
      expect(mockQueueServiceMessage).toHaveBeenCalledTimes(1)
      const payload = mockQueueServiceMessage.mock.calls[0]![0] as Record<string, unknown>
      expect(payload).toMatchObject({
        orgId: 'org-1',
        serviceId: 'svc-1',
        type: 'oneoff',
        subject: 'Rehearsal moved to 8:15',
        recipientSelector: {
          teams: ['band', 'tech'],
          individualPersonIds: [],
          includeEveryone: false,
        },
        options: { attachServiceLink: true, sendCopyToSelf: false },
        scheduledFor: null,
      })
      // The payload must NOT contain any resolved email address.
      const serialized = JSON.stringify(payload)
      expect(serialized).not.toContain('alice@example.com')
      expect(serialized).not.toContain('cara@example.com')
      expect(serialized).not.toContain('@example.com')

      // Success → emits 'sent' with the messageId; NO toast (the failure-only
      // toast store misrenders success as "Save failed." — dropped in 64-03).
      expect(wrapper.emitted('sent')).toBeTruthy()
      expect(wrapper.emitted('sent')![0]).toEqual(['msg-1'])
      expect(mockToastPush).not.toHaveBeenCalled()
    })

    it('sends scheduledFor as an ISO instant when scheduling is on', async () => {
      mountComposer()
      await q('team-chip-band').trigger('click')
      await fillSubject('Reminder')

      const sched = q('opt-schedule').element as HTMLInputElement
      sched.checked = true
      sched.dispatchEvent(new Event('change'))
      await nextTick()
      const dt = q('scheduled-for').element as HTMLInputElement
      dt.value = '2999-01-01T10:00'
      dt.dispatchEvent(new Event('input'))
      await nextTick()

      await q('send-btn').trigger('click')
      await flushPromises()

      const payload = mockQueueServiceMessage.mock.calls[0]![0] as { scheduledFor: string | null }
      expect(payload.scheduledFor).toBe(new Date('2999-01-01T10:00').toISOString())
    })

    it('on failure shows the inline error, re-enables Send, and preserves the draft (no sent emit)', async () => {
      mockQueueServiceMessage.mockRejectedValueOnce(new Error('network went away'))
      const wrapper = mountComposer()
      await q('team-chip-band').trigger('click')
      await fillSubject('Hello team')

      await q('send-btn').trigger('click')
      await flushPromises()

      expect(q('send-error').text()).toContain("Couldn't send this message")
      expect((q('send-btn').element as HTMLButtonElement).disabled).toBe(false)
      // Draft preserved for retry.
      expect((q('subject-input').element as HTMLInputElement).value).toBe('Hello team')
      expect(wrapper.emitted('sent')).toBeFalsy()
    })

    it('shows the kill-switch variant when the server rejects with failed-precondition', async () => {
      mockQueueServiceMessage.mockRejectedValueOnce({ code: 'functions/failed-precondition', message: 'off' })
      mountComposer()
      await q('team-chip-band').trigger('click')
      await fillSubject('Hello team')

      await q('send-btn').trigger('click')
      await flushPromises()

      expect(q('send-error').text()).toContain('Messaging is turned off for your organization')
    })
  })

  it('the ✕ / Cancel controls emit cancel without calling queueServiceMessage', async () => {
    const wrapper = mountComposer()
    await q('cancel-btn').trigger('click')
    expect(wrapper.emitted('cancel')).toBeTruthy()
    expect(mockQueueServiceMessage).not.toHaveBeenCalled()
  })
})
