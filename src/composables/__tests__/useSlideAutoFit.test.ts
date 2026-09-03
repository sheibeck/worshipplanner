/**
 * Phase 115 Plan 01 (R329). Unit coverage for the auto-fit engine every render
 * site (Audience/Confidence outputs + Run previews/thumbnails) will share.
 *
 * Task 1 — pure fit math (computeFitScale, computeContainScale, constants):
 * driven by injected numeric oracles, no DOM/mounting.
 */
import { describe, it, expect } from 'vitest'
import {
  computeFitScale,
  computeContainScale,
  DEFAULT_FIT_SCALE,
  MAX_FIT_SCALE,
  REFERENCE_WIDTH,
  REFERENCE_HEIGHT,
} from '../useSlideAutoFit'

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
