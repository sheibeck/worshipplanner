/**
 * REVIEW-FIX WR-01 (92-REVIEW.md): a flex item's default min-width is `auto`
 * (its min-content size) regardless of anything set on the flex CONTAINER —
 * `truncate`'s `overflow:hidden`/`white-space:nowrap` only takes effect once
 * the item's own box can shrink below its content width. `min-w-0` (paired
 * with `flex-1` so the label is the element that shrinks, with the "Primary"
 * badge kept `shrink-0`) MUST live on the `<h3>` itself, not the row's flex
 * container, or a long OS-provided label renders at full width instead of
 * eliding with `…` and grows the card.
 */
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import MonitorCard from '../MonitorCard.vue'
import { computeFingerprint, type ScreenLike } from '@/utils/monitorConfig'

function makeScreen(overrides: Partial<ScreenLike> = {}): ScreenLike {
  return {
    label: 'Screen',
    width: 1920,
    height: 1080,
    left: 0,
    top: 0,
    isPrimary: true,
    ...overrides,
  }
}

describe('MonitorCard — label truncation (WR-01)', () => {
  it('puts flex-1, min-w-0, and truncate on the <h3> label itself, not just the row container', () => {
    const screen = makeScreen({
      label: 'A Very Long OS-Provided Monitor Label That Should Not Wrap Or Grow The Card',
    })
    const wrapper = mount(MonitorCard, {
      props: {
        screen,
        fingerprint: computeFingerprint(screen),
        selectedRole: null,
        nickname: '',
      },
    })

    const label = wrapper.get('h3')
    expect(label.classes()).toContain('flex-1')
    expect(label.classes()).toContain('min-w-0')
    expect(label.classes()).toContain('truncate')
    expect(label.text()).toBe(screen.label)
  })

  it('keeps the Primary badge shrink-0 so it never gets squeezed by the truncating label', () => {
    const screen = makeScreen({ label: 'Front Wall', isPrimary: true })
    const wrapper = mount(MonitorCard, {
      props: {
        screen,
        fingerprint: computeFingerprint(screen),
        selectedRole: null,
        nickname: '',
      },
    })

    const badge = wrapper.findAll('span').find((s) => s.text() === 'Primary')
    expect(badge).toBeTruthy()
    expect(badge!.classes()).toContain('shrink-0')
  })
})

describe('MonitorCard — role selector: None/Audience/Confidence (R325)', () => {
  it('renders exactly three role radios and marks None checked when selectedRole is null', () => {
    const screen = makeScreen()
    const fingerprint = computeFingerprint(screen)
    const wrapper = mount(MonitorCard, {
      props: { screen, fingerprint, selectedRole: null, nickname: '' },
    })

    const radios = wrapper.findAll('[role="radio"]')
    expect(radios).toHaveLength(3)
    expect(wrapper.get(`[data-testid="monitor-role-${fingerprint}-none"]`).attributes('aria-checked')).toBe('true')
    expect(wrapper.get(`[data-testid="monitor-role-${fingerprint}-audience"]`).attributes('aria-checked')).toBe('false')
    expect(wrapper.get(`[data-testid="monitor-role-${fingerprint}-confidence"]`).attributes('aria-checked')).toBe('false')
  })

  it('emits select-role with null when the None radio is clicked', async () => {
    const screen = makeScreen()
    const fingerprint = computeFingerprint(screen)
    const wrapper = mount(MonitorCard, {
      props: { screen, fingerprint, selectedRole: 'audience', nickname: '' },
    })

    await wrapper.get(`[data-testid="monitor-role-${fingerprint}-none"]`).trigger('click')

    expect(wrapper.emitted('select-role')).toBeTruthy()
    expect(wrapper.emitted('select-role')![0]).toEqual([null])
  })

  it('marks Audience checked and None unchecked when selectedRole is audience', () => {
    const screen = makeScreen()
    const fingerprint = computeFingerprint(screen)
    const wrapper = mount(MonitorCard, {
      props: { screen, fingerprint, selectedRole: 'audience', nickname: '' },
    })

    expect(wrapper.get(`[data-testid="monitor-role-${fingerprint}-audience"]`).attributes('aria-checked')).toBe('true')
    expect(wrapper.get(`[data-testid="monitor-role-${fingerprint}-none"]`).attributes('aria-checked')).toBe('false')
  })
})

describe('MonitorCard — nickname-first heading + edit affordance (R338)', () => {
  it('uses the nickname as the heading when non-empty', () => {
    const screen = makeScreen({ label: 'Front Wall' })
    const wrapper = mount(MonitorCard, {
      props: { screen, fingerprint: computeFingerprint(screen), selectedRole: null, nickname: 'Sanctuary Screen' },
    })

    expect(wrapper.get('h3').text()).toBe('Sanctuary Screen')
  })

  it('falls back to the OS label when the nickname is blank', () => {
    const screen = makeScreen({ label: 'Front Wall' })
    const wrapper = mount(MonitorCard, {
      props: { screen, fingerprint: computeFingerprint(screen), selectedRole: null, nickname: '' },
    })

    expect(wrapper.get('h3').text()).toBe('Front Wall')
  })

  it('falls back to "Unknown" when both nickname and label are blank', () => {
    const screen = makeScreen({ label: '' })
    const wrapper = mount(MonitorCard, {
      props: { screen, fingerprint: computeFingerprint(screen), selectedRole: null, nickname: '' },
    })

    expect(wrapper.get('h3').text()).toBe('Unknown')
  })

  it('emits update-nickname with the new value when the nickname input changes', async () => {
    const screen = makeScreen()
    const fingerprint = computeFingerprint(screen)
    const wrapper = mount(MonitorCard, {
      props: { screen, fingerprint, selectedRole: null, nickname: '' },
    })

    const input = wrapper.get(`[data-testid="monitor-nickname-${fingerprint}"]`)
    await input.setValue('Stage Left')

    expect(wrapper.emitted('update-nickname')).toBeTruthy()
    expect(wrapper.emitted('update-nickname')![0]).toEqual(['Stage Left'])
  })
})
