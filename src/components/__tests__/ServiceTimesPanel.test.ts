import { describe, it, expect, vi, afterEach } from 'vitest'
import { mount, enableAutoUnmount } from '@vue/test-utils'
import ServiceTimesPanel from '../ServiceTimesPanel.vue'
import type { Rehearsal } from '@/utils/rehearsalTimes'

enableAutoUnmount(afterEach)

afterEach(() => {
  vi.useRealTimers()
})

type PanelProps = {
  rehearsals?: Rehearsal[]
  reportTime?: string
  serviceDate?: string
  canEdit: boolean
  defaultTimes?: string[]
  isEditor?: boolean
}

function mountPanel(props: PanelProps, options: { attachTo?: HTMLElement } = {}) {
  return mount(ServiceTimesPanel, { props, ...options })
}

const mixedRows: Rehearsal[] = [
  { id: 'd1', date: '2026-11-06', time: '19:00' },
  { id: 'u1', date: '', time: '19:00' },
  { id: 't1', date: '2026-11-04', time: '' },
  { id: 'd0', date: '2026-11-05', time: '18:00' },
]

const norm = (s: string) => s.replace(/\s+/g, ' ').trim()

describe('ServiceTimesPanel — R441 add form', () => {
  it('R441: add is disabled until both date and time are set, then emits once and resets', async () => {
    const wrapper = mountPanel({ canEdit: true, defaultTimes: ['19:00'] })
    const time = wrapper.get('[data-testid="new-rehearsal-time"]')
    const date = wrapper.get('[data-testid="new-rehearsal-date"]')
    const btn = wrapper.get('[data-testid="add-rehearsal-btn"]')

    expect((time.element as HTMLInputElement).value).toBe('19:00')
    expect(btn.attributes('disabled')).toBeDefined()

    await date.setValue('2026-11-05')
    expect(btn.attributes('disabled')).toBeUndefined()

    await wrapper.get('[data-testid="add-rehearsal-form"]').trigger('submit')
    expect(wrapper.emitted('add')).toHaveLength(1)
    expect(wrapper.emitted('add')![0]).toEqual([{ date: '2026-11-05', time: '19:00' }])

    expect((date.element as HTMLInputElement).value).toBe('')
    expect((time.element as HTMLInputElement).value).toBe('19:00')
    expect(btn.attributes('disabled')).toBeDefined()

    await wrapper.get('[data-testid="add-rehearsal-form"]').trigger('submit')
    expect(wrapper.emitted('add')).toHaveLength(1)
  })

  it('R441: with no default time, add needs the planner to set the time too', async () => {
    const wrapper = mountPanel({ canEdit: true, defaultTimes: [] })
    const btn = wrapper.get('[data-testid="add-rehearsal-btn"]')
    await wrapper.get('[data-testid="new-rehearsal-date"]').setValue('2026-11-05')
    expect(btn.attributes('disabled')).toBeDefined()
    await wrapper.get('[data-testid="new-rehearsal-time"]').setValue('18:00')
    expect(btn.attributes('disabled')).toBeUndefined()
  })

  it('R441: clearing a dated row date reverts the input, shows a 4s status message and emits nothing', async () => {
    vi.useFakeTimers()
    const wrapper = mountPanel({
      canEdit: true,
      rehearsals: [{ id: 'r1', date: '2026-11-05', time: '19:00' }],
    })
    const input = wrapper.get('[data-testid="rehearsal-date-input"]')
    ;(input.element as HTMLInputElement).value = ''
    await input.trigger('change')

    expect(wrapper.emitted('date-change')).toBeUndefined()
    expect((input.element as HTMLInputElement).value).toBe('2026-11-05')
    const msg = wrapper.get('[data-testid="rehearsal-revert-message"]')
    expect(msg.text()).toBe('A rehearsal needs a date. Use Remove to delete it.')
    // The announcement goes through the persistent live region, not the inserted visual line.
    const live = wrapper.get('[data-testid="times-live-region"]')
    expect(live.attributes('role')).toBe('status')
    expect(live.attributes('aria-live')).toBe('polite')
    expect(live.text()).toBe('A rehearsal needs a date. Use Remove to delete it.')

    await vi.advanceTimersByTimeAsync(4000)
    expect(wrapper.find('[data-testid="rehearsal-revert-message"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="times-live-region"]').text()).toBe('')
  })

  it('UI review: the live region exists before any message so screen readers announce changes', () => {
    const wrapper = mountPanel({ canEdit: true, rehearsals: [{ id: 'r1', date: '2026-11-05', time: '19:00' }] })
    const live = wrapper.get('[data-testid="times-live-region"]')
    expect(live.attributes('role')).toBe('status')
    expect(live.text()).toBe('')
  })

  it('UI review: each Remove button names its rehearsal for assistive tech', () => {
    const wrapper = mountPanel({
      canEdit: true,
      rehearsals: [
        { id: 'u1', date: '', time: '19:00' },
        { id: 'd1', date: '2026-11-06', time: '19:00' },
      ],
    })
    const labels = wrapper.findAll('[data-testid="remove-rehearsal-btn"]').map((b) => b.attributes('aria-label'))
    expect(labels[0]).toBe('Remove rehearsal without a date')
    expect(labels[1]).toMatch(/^Remove rehearsal Nov 6, /)
  })

  it('R441: clearing a row time reverts the input, shows the time message and emits nothing', async () => {
    vi.useFakeTimers()
    const wrapper = mountPanel({
      canEdit: true,
      rehearsals: [{ id: 'r1', date: '2026-11-05', time: '19:00' }],
    })
    const input = wrapper.get('[data-testid="rehearsal-time-input"]')
    ;(input.element as HTMLInputElement).value = ''
    await input.trigger('change')

    expect(wrapper.emitted('time-change')).toBeUndefined()
    expect((input.element as HTMLInputElement).value).toBe('19:00')
    expect(wrapper.get('[data-testid="rehearsal-revert-message"]').text()).toBe(
      'A rehearsal needs a time. Use Remove to delete it.',
    )
    await vi.advanceTimersByTimeAsync(4000)
    expect(wrapper.find('[data-testid="rehearsal-revert-message"]').exists()).toBe(false)
  })

  it('R441: a non-clearing edit emits date-change and clears a visible revert message', async () => {
    const wrapper = mountPanel({
      canEdit: true,
      rehearsals: [{ id: 'r1', date: '2026-11-05', time: '19:00' }],
    })
    const input = wrapper.get('[data-testid="rehearsal-date-input"]')
    ;(input.element as HTMLInputElement).value = ''
    await input.trigger('change')
    expect(wrapper.find('[data-testid="rehearsal-revert-message"]').exists()).toBe(true)

    ;(input.element as HTMLInputElement).value = '2026-11-06'
    await input.trigger('change')
    expect(wrapper.emitted('date-change')).toEqual([[{ id: 'r1', date: '2026-11-06' }]])
    expect(wrapper.find('[data-testid="rehearsal-revert-message"]').exists()).toBe(false)
  })

  it('R441: a malformed date edit (6-digit year) reverts the input, shows a message and emits nothing', async () => {
    const wrapper = mountPanel({
      canEdit: true,
      rehearsals: [{ id: 'r1', date: '2026-11-05', time: '19:00' }],
    })
    const input = wrapper.get('[data-testid="rehearsal-date-input"]')
    ;(input.element as HTMLInputElement).value = '20266-01-01'
    await input.trigger('change')

    expect(wrapper.emitted('date-change')).toBeUndefined()
    expect((input.element as HTMLInputElement).value).toBe('2026-11-05')
    expect(wrapper.get('[data-testid="rehearsal-revert-message"]').text()).toBe(
      'That date is not valid. Use a four-digit year.',
    )
  })

  it('R441: a malformed add-form date keeps Add disabled and emits nothing', async () => {
    const wrapper = mountPanel({ canEdit: true, defaultTimes: ['19:00'] })
    await wrapper.get('[data-testid="new-rehearsal-date"]').setValue('20266-01-01')
    expect(wrapper.get('[data-testid="add-rehearsal-btn"]').attributes('disabled')).toBeDefined()
    await wrapper.get('[data-testid="add-rehearsal-form"]').trigger('submit')
    expect(wrapper.emitted('add')).toBeUndefined()
  })

  it('R441: date inputs cap the year at four digits', () => {
    const wrapper = mountPanel({ canEdit: true, rehearsals: [{ id: 'r1', date: '2026-11-05', time: '19:00' }] })
    expect(wrapper.get('[data-testid="new-rehearsal-date"]').attributes('max')).toBe('9999-12-31')
    expect(wrapper.get('[data-testid="rehearsal-date-input"]').attributes('max')).toBe('9999-12-31')
  })

  it('R441: after a successful add and after Remove, focus returns to the add-form date input', async () => {
    const wrapper = mountPanel(
      { canEdit: true, defaultTimes: ['19:00'], rehearsals: [{ id: 'r1', date: '2026-11-05', time: '19:00' }] },
      { attachTo: document.body },
    )
    await wrapper.get('[data-testid="new-rehearsal-date"]').setValue('2026-11-12')
    await wrapper.get('[data-testid="add-rehearsal-form"]').trigger('submit')
    await wrapper.vm.$nextTick()
    await wrapper.vm.$nextTick()
    expect(document.activeElement).toBe(wrapper.get('[data-testid="new-rehearsal-date"]').element)

    ;(document.activeElement as HTMLElement).blur()
    await wrapper.get('[data-testid="remove-rehearsal-btn"]').trigger('click')
    await wrapper.vm.$nextTick()
    await wrapper.vm.$nextTick()
    expect(document.activeElement).toBe(wrapper.get('[data-testid="new-rehearsal-date"]').element)
  })

  it('R441: rows and the add form stack on mobile and go inline from sm', () => {
    const wrapper = mountPanel({
      canEdit: true,
      rehearsals: [{ id: 'r1', date: '2026-11-05', time: '19:00' }],
    })
    const row = wrapper.get('[data-testid="rehearsal-row"]')
    expect(row.classes()).toEqual(expect.arrayContaining(['flex-col', 'sm:flex-row']))
    const formWrapper = wrapper.get('[data-testid="add-rehearsal-form"] > div')
    expect(formWrapper.classes()).toEqual(expect.arrayContaining(['flex-col', 'sm:flex-row']))
  })
})

describe('ServiceTimesPanel — R442 defaults', () => {
  it('R442: one default shows no chips; two defaults show two chips with a pressed state and click sets time only', async () => {
    const one = mountPanel({ canEdit: true, defaultTimes: ['19:00'] })
    expect(one.findAll('[data-testid="rehearsal-default-chip"]')).toHaveLength(0)

    const two = mountPanel({ canEdit: true, defaultTimes: ['18:30', '19:00'] })
    const chips = two.findAll('[data-testid="rehearsal-default-chip"]')
    expect(chips.map((c) => c.text())).toEqual(['6:30 PM', '7:00 PM'])
    // Form time follows defaultTimes[0] ('18:30'), so that chip starts pressed
    expect((two.get('[data-testid="new-rehearsal-time"]').element as HTMLInputElement).value).toBe('18:30')
    expect(chips[0]!.attributes('aria-pressed')).toBe('true')
    expect(chips[1]!.attributes('aria-pressed')).toBe('false')

    await chips[1]!.trigger('click')
    expect((two.get('[data-testid="new-rehearsal-time"]').element as HTMLInputElement).value).toBe('19:00')
    const after = two.findAll('[data-testid="rehearsal-default-chip"]')
    expect(after[1]!.attributes('aria-pressed')).toBe('true')
    expect(after[0]!.attributes('aria-pressed')).toBe('false')
    expect(two.emitted('add')).toBeUndefined()
  })

  it('R442: duplicate default times collapse to one chip (no double pressed state)', () => {
    const one = mountPanel({ canEdit: true, defaultTimes: ['18:30', '18:30'] })
    expect(one.findAll('[data-testid="rehearsal-default-chip"]')).toHaveLength(0)

    const two = mountPanel({ canEdit: true, defaultTimes: ['18:30', '18:30', '19:00'] })
    const chips = two.findAll('[data-testid="rehearsal-default-chip"]')
    expect(chips.map((c) => c.text())).toEqual(['6:30 PM', '7:00 PM'])
    expect(chips.filter((c) => c.attributes('aria-pressed') === 'true')).toHaveLength(1)
  })

  it('R442: pressed state follows the form time when it matches a default', async () => {
    const wrapper = mountPanel({ canEdit: true, defaultTimes: ['18:30', '19:00'] })
    const chips = wrapper.findAll('[data-testid="rehearsal-default-chip"]')
    expect(chips[0]!.attributes('aria-pressed')).toBe('true')
    await chips[1]!.trigger('click')
    expect(wrapper.findAll('[data-testid="rehearsal-default-chip"]')[0]!.attributes('aria-pressed')).toBe('false')
  })

  it('R442: late defaults pre-fill, a typed time is not overwritten, and add re-pre-fills from defaults', async () => {
    const wrapper = mountPanel({ canEdit: true, defaultTimes: [] })
    const time = wrapper.get('[data-testid="new-rehearsal-time"]')
    expect((time.element as HTMLInputElement).value).toBe('')

    await wrapper.setProps({ defaultTimes: ['19:00'] })
    expect((time.element as HTMLInputElement).value).toBe('19:00')

    await time.setValue('20:00')
    await wrapper.setProps({ defaultTimes: ['18:00'] })
    expect((time.element as HTMLInputElement).value).toBe('20:00')

    await wrapper.get('[data-testid="new-rehearsal-date"]').setValue('2026-11-05')
    await wrapper.get('[data-testid="add-rehearsal-form"]').trigger('submit')
    expect(wrapper.emitted('add')![0]).toEqual([{ date: '2026-11-05', time: '20:00' }])
    expect((time.element as HTMLInputElement).value).toBe('18:00')
  })
})

describe('ServiceTimesPanel — R443 legacy rows', () => {
  it('R443: legacy rows render first in stored order with markers; dated rows follow sorted without markers', () => {
    const wrapper = mountPanel({ canEdit: true, rehearsals: mixedRows })
    const items = wrapper.findAll('ul > li')
    expect(items).toHaveLength(4)

    const first = items[0]!.get('[data-testid="rehearsal-row-needs-fix"]')
    const second = items[1]!.get('[data-testid="rehearsal-row-needs-fix"]')
    expect(first.get('[data-testid="rehearsal-needs-fix-marker"]').text()).toBe('Needs a date')
    expect(second.get('[data-testid="rehearsal-needs-fix-marker"]').text()).toBe('Needs a time')

    const dated = [items[2]!, items[3]!]
    for (const li of dated) {
      expect(li.find('[data-testid="rehearsal-row"]').exists()).toBe(true)
      expect(li.find('[data-testid="rehearsal-needs-fix-marker"]').exists()).toBe(false)
    }
    expect((dated[0]!.get('[data-testid="rehearsal-date-input"]').element as HTMLInputElement).value).toBe('2026-11-05')
    expect((dated[1]!.get('[data-testid="rehearsal-date-input"]').element as HTMLInputElement).value).toBe('2026-11-06')
  })

  it('R443: the empty input on a legacy row is amber, inputs on dated rows are gray', () => {
    const wrapper = mountPanel({ canEdit: true, rehearsals: mixedRows })
    const items = wrapper.findAll('ul > li')
    expect(items[0]!.get('[data-testid="rehearsal-date-input"]').classes()).toContain('border-amber-700')
    expect(items[0]!.get('[data-testid="rehearsal-time-input"]').classes()).toContain('border-gray-700')
    expect(items[1]!.get('[data-testid="rehearsal-time-input"]').classes()).toContain('border-amber-700')
    expect(items[2]!.get('[data-testid="rehearsal-date-input"]').classes()).toContain('border-gray-700')
    expect(items[2]!.get('[data-testid="rehearsal-date-input"]').classes()).not.toContain('border-amber-700')
  })

  it('R443: setting a missing date emits date-change; a no-op change on a still-empty field is silent', async () => {
    const wrapper = mountPanel({ canEdit: true, rehearsals: mixedRows })
    const input = wrapper.findAll('ul > li')[0]!.get('[data-testid="rehearsal-date-input"]')

    await input.trigger('change')
    expect(wrapper.emitted('date-change')).toBeUndefined()
    expect(wrapper.find('[data-testid="rehearsal-revert-message"]').exists()).toBe(false)

    ;(input.element as HTMLInputElement).value = '2026-11-03'
    await input.trigger('change')
    expect(wrapper.emitted('date-change')).toEqual([[{ id: 'u1', date: '2026-11-03' }]])
  })

  it('R443: Remove emits remove with the row id', async () => {
    const wrapper = mountPanel({ canEdit: true, rehearsals: mixedRows })
    await wrapper.findAll('ul > li')[1]!.get('[data-testid="remove-rehearsal-btn"]').trigger('click')
    expect(wrapper.emitted('remove')).toEqual([['t1']])
  })

  it('R443: zero rehearsals renders the empty state with the add form and no divider', () => {
    const wrapper = mountPanel({ canEdit: true, rehearsals: [] })
    const empty = wrapper.get('[data-testid="rehearsals-empty"]')
    expect(empty.text()).toContain('No rehearsals yet')
    expect(empty.text()).toContain('Pick a date and time below, then choose Add rehearsal.')
    expect(wrapper.find('[data-testid="rehearsal-needs-fix-marker"]').exists()).toBe(false)
    const form = wrapper.get('[data-testid="add-rehearsal-form"]')
    expect(form.classes()).not.toContain('border-t')
  })

  it('R443: a non-empty list puts a divider above the add form', () => {
    const wrapper = mountPanel({ canEdit: true, rehearsals: [{ id: 'r1', date: '2026-11-05', time: '19:00' }] })
    expect(wrapper.get('[data-testid="add-rehearsal-form"]').classes()).toContain('border-t')
  })
})

describe('ServiceTimesPanel — R444 report time and read-only', () => {
  it('R444: editable report time shows the value, emits changes including a clear, and the helper names the service date', async () => {
    const wrapper = mountPanel({ canEdit: true, reportTime: '08:00', serviceDate: '2026-11-08' })
    const input = wrapper.get('[data-testid="report-time-input"]')
    expect((input.element as HTMLInputElement).value).toBe('08:00')

    ;(input.element as HTMLInputElement).value = '09:30'
    await input.trigger('change')
    ;(input.element as HTMLInputElement).value = ''
    await input.trigger('change')
    expect(wrapper.emitted('report-time-change')).toEqual([['09:30'], ['']])

    expect(wrapper.get('[data-testid="report-time-helper"]').text()).toBe('Day-of call time on Nov 8')
  })

  it('R444: report-time helper drops the date clause when the service has no date', () => {
    const wrapper = mountPanel({ canEdit: true, reportTime: '', serviceDate: '' })
    expect(wrapper.get('[data-testid="report-time-helper"]').text()).toBe('Day-of call time')
  })

  it('R444: read-only shows the report time and only displayable rehearsals chronologically, with no controls', () => {
    const wrapper = mountPanel({ canEdit: false, reportTime: '08:00', rehearsals: mixedRows })
    expect(wrapper.find('input').exists()).toBe(false)
    expect(wrapper.find('form').exists()).toBe(false)
    expect(wrapper.find('[data-testid="rehearsal-default-chip"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="remove-rehearsal-btn"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="rehearsal-needs-fix-marker"]').exists()).toBe(false)

    const report = norm(wrapper.get('[data-testid="times-readonly-report"]').text())
    expect(report).toContain('Report time:')
    expect(report).toContain('8:00 AM')

    const items = wrapper.get('[data-testid="times-readonly"]').findAll('li').map((li) => norm(li.text()))
    expect(items).toEqual(['Nov 5, 6:00 PM', 'Nov 6, 7:00 PM'])
    expect(wrapper.find('[data-testid="times-readonly-empty"]').exists()).toBe(false)
  })

  it('R444: read-only with no report time and only legacy rows shows the "No times set" empty state', () => {
    const wrapper = mountPanel({
      canEdit: false,
      reportTime: '',
      rehearsals: [
        { id: 'u1', date: '', time: '19:00' },
        { id: 't1', date: '2026-11-04', time: '' },
      ],
    })
    const empty = wrapper.get('[data-testid="times-readonly-empty"]')
    expect(empty.text()).toContain('No times set')
    expect(empty.text()).toContain('The report time and any rehearsals will appear here once the planner adds them.')
    expect(wrapper.find('[data-testid="times-readonly"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="times-readonly-report"]').exists()).toBe(false)
  })

  it('R444: read-only with only a report time omits the rehearsal list and the empty state', () => {
    const wrapper = mountPanel({ canEdit: false, reportTime: '08:00' })
    expect(wrapper.find('[data-testid="times-readonly-report"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="times-readonly"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="times-readonly-empty"]').exists()).toBe(false)
  })

  it('UI review: a locked-service editor with legacy rows is told to reopen the service', () => {
    const wrapper = mountPanel({ canEdit: false, isEditor: true, rehearsals: mixedRows })
    expect(wrapper.get('[data-testid="times-readonly-legacy-notice"]').text()).toBe(
      'Some rehearsals are missing a date or time. Reopen the service to fix them.',
    )
  })

  it('UI review: the reopen notice is hidden for viewers and when every rehearsal is complete', () => {
    expect(
      mountPanel({ canEdit: false, isEditor: false, rehearsals: mixedRows })
        .find('[data-testid="times-readonly-legacy-notice"]')
        .exists(),
    ).toBe(false)
    expect(
      mountPanel({ canEdit: false, isEditor: true, rehearsals: [{ id: 'd1', date: '2026-11-06', time: '19:00' }] })
        .find('[data-testid="times-readonly-legacy-notice"]')
        .exists(),
    ).toBe(false)
  })
})
