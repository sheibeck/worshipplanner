/**
 * Phase 115 Plan 01 (R329). Unit coverage for the auto-fit engine every render
 * site (Audience/Confidence outputs + Run previews/thumbnails) will share.
 *
 * Task 1 — pure fit math (computeFitScale, computeContainScale, constants):
 * driven by injected numeric oracles, no DOM/mounting.
 *
 * Task 2 — the ResizeObserver composable shells (useSlideAutoFit,
 * useContainScale): mounted through a trivial host component (same harness
 * idiom as useOutputWindow.test.ts) so onMounted/onBeforeUnmount actually run.
 * jsdom has no layout engine, so these only assert the documented no-layout
 * fallback (scale stays DEFAULT_FIT_SCALE) and that mount/retrigger/unmount
 * never throw — real measured scales are covered by Plan 03's integration and
 * the batched hardware UAT.
 */
import { describe, it, expect, afterEach } from 'vitest'
import { mount, enableAutoUnmount } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import {
  computeFitScale,
  computeContainScale,
  useSlideAutoFit,
  useContainScale,
  DEFAULT_FIT_SCALE,
  MAX_FIT_SCALE,
  REFERENCE_WIDTH,
  REFERENCE_HEIGHT,
  type UseSlideAutoFitResult,
  type UseContainScaleResult,
} from '../useSlideAutoFit'

enableAutoUnmount(afterEach)

describe('constants', () => {
  it('REFERENCE_WIDTH/HEIGHT are the canonical 1280x720 stage', () => {
    expect(REFERENCE_WIDTH).toBe(1280)
    expect(REFERENCE_HEIGHT).toBe(720)
  })

  it('MAX_FIT_SCALE is finite and greater than 1', () => {
    expect(Number.isFinite(MAX_FIT_SCALE)).toBe(true)
    expect(MAX_FIT_SCALE).toBeGreaterThan(1)
  })

  it('DEFAULT_FIT_SCALE is 1', () => {
    expect(DEFAULT_FIT_SCALE).toBe(1)
  })
})

describe('computeFitScale', () => {
  it('returns the largest fitting scale within tolerance for a monotone oracle', () => {
    const result = computeFitScale((s) => s <= 2.3)
    expect(result).toBeLessThanOrEqual(2.3)
    expect(result).toBeGreaterThan(2.2)
  })

  it('returns MAX_FIT_SCALE when the oracle always fits (capped, never unbounded)', () => {
    expect(computeFitScale(() => true)).toBe(MAX_FIT_SCALE)
  })

  it('returns the min bound when the oracle never fits (degrades to smallest, never 0/NaN/negative)', () => {
    const result = computeFitScale(() => false)
    expect(result).toBeGreaterThan(0)
    expect(Number.isFinite(result)).toBe(true)
  })

  it('respects custom min/max/steps bounds', () => {
    const result = computeFitScale((s) => s <= 1.5, { min: 0.5, max: 2, steps: 8 })
    expect(result).toBeLessThanOrEqual(1.5)
    expect(result).toBeGreaterThanOrEqual(0.5)
  })
})

describe('computeContainScale', () => {
  it('returns the equal ratio when both dimensions scale identically', () => {
    expect(computeContainScale(1920, 1080, 1280, 720)).toBe(1.5)
  })

  it('returns the min (tighter) ratio — height-constrained never stretches past it', () => {
    // width ratio 1280/1280=1, height ratio 1280/720≈1.78 — min is 1.
    expect(computeContainScale(1280, 1280, 1280, 720)).toBe(1)
  })

  it('returns DEFAULT_FIT_SCALE for a 0-size (jsdom) container', () => {
    expect(computeContainScale(0, 0, 1280, 720)).toBe(DEFAULT_FIT_SCALE)
  })

  it('returns DEFAULT_FIT_SCALE for non-finite input', () => {
    expect(computeContainScale(NaN, 1080, 1280, 720)).toBe(DEFAULT_FIT_SCALE)
    expect(computeContainScale(1920, Infinity, 1280, 720)).toBe(DEFAULT_FIT_SCALE)
  })

  it('returns DEFAULT_FIT_SCALE for negative input', () => {
    expect(computeContainScale(-100, 1080, 1280, 720)).toBe(DEFAULT_FIT_SCALE)
  })
})

// ── Composable shells ────────────────────────────────────────────────────────

let capturedFit: UseSlideAutoFitResult | null = null
const FitHost = defineComponent({
  name: 'UseSlideAutoFitHost',
  setup() {
    capturedFit = useSlideAutoFit()
    return () =>
      h('div', { ref: capturedFit!.frameRef }, [h('div', { ref: capturedFit!.contentRef })])
  },
})

let capturedContain: UseContainScaleResult | null = null
const ContainHost = defineComponent({
  name: 'UseContainScaleHost',
  setup() {
    capturedContain = useContainScale()
    return () => h('div', { ref: capturedContain!.containerRef })
  },
})

// WR-01 (115-REVIEW.md) — hosts whose frame/container element isn't present
// at the exact `onMounted` tick (e.g. a `v-if` that resolves after mount).
const LateFitHost = defineComponent({
  name: 'UseSlideAutoFitLateHost',
  props: { visible: { type: Boolean, default: false } },
  setup(props) {
    capturedFit = useSlideAutoFit()
    return () =>
      props.visible
        ? h('div', { ref: capturedFit!.frameRef }, [h('div', { ref: capturedFit!.contentRef })])
        : h('div')
  },
})

const LateContainHost = defineComponent({
  name: 'UseContainScaleLateHost',
  props: { visible: { type: Boolean, default: false } },
  setup(props) {
    capturedContain = useContainScale()
    return () => (props.visible ? h('div', { ref: capturedContain!.containerRef }) : h('div'))
  },
})

describe('useSlideAutoFit — no-layout fallback (jsdom/SSR)', () => {
  it('exposes frameRef, contentRef, scale, and retrigger; scale is DEFAULT_FIT_SCALE with no real layout', () => {
    const wrapper = mount(FitHost)
    expect(capturedFit).not.toBeNull()
    expect(capturedFit!.scale.value).toBe(DEFAULT_FIT_SCALE)
    wrapper.unmount()
  })

  it('retrigger() is a safe no-op that leaves scale at the default', () => {
    mount(FitHost)
    expect(() => capturedFit!.retrigger()).not.toThrow()
    expect(capturedFit!.scale.value).toBe(DEFAULT_FIT_SCALE)
  })

  it('unmounts without throwing (ResizeObserver disconnect guard)', () => {
    const wrapper = mount(FitHost)
    expect(() => wrapper.unmount()).not.toThrow()
  })

  it('WR-01: still degrades to DEFAULT_FIT_SCALE and never throws when frameRef attaches after mount', async () => {
    const wrapper = mount(LateFitHost, { props: { visible: false } })
    expect(capturedFit!.scale.value).toBe(DEFAULT_FIT_SCALE)
    await wrapper.setProps({ visible: true })
    expect(() => capturedFit!.retrigger()).not.toThrow()
    expect(capturedFit!.scale.value).toBe(DEFAULT_FIT_SCALE)
    expect(() => wrapper.unmount()).not.toThrow()
  })
})

describe('useContainScale — no-layout fallback (jsdom/SSR)', () => {
  it('exposes containerRef and scale; scale is DEFAULT_FIT_SCALE (1) with a 0-size container', () => {
    const wrapper = mount(ContainHost)
    expect(capturedContain).not.toBeNull()
    expect(capturedContain!.scale.value).toBe(DEFAULT_FIT_SCALE)
    wrapper.unmount()
  })

  it('unmounts without throwing (ResizeObserver disconnect guard)', () => {
    const wrapper = mount(ContainHost)
    expect(() => wrapper.unmount()).not.toThrow()
  })

  it('WR-01: still degrades to DEFAULT_FIT_SCALE and never throws when containerRef attaches after mount', async () => {
    const wrapper = mount(LateContainHost, { props: { visible: false } })
    expect(capturedContain!.scale.value).toBe(DEFAULT_FIT_SCALE)
    await wrapper.setProps({ visible: true })
    expect(capturedContain!.scale.value).toBe(DEFAULT_FIT_SCALE)
    expect(() => wrapper.unmount()).not.toThrow()
  })
})
