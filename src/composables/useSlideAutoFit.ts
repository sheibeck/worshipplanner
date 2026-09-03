// R329 — replaces the manual `--slide-font-scale` sm/md/lg multiplier with a
// measure-and-fit engine. See .planning/codebase/ARCHITECTURE.md (§ Component &
// Composable Behavioral Notes) and docs/adr/ for the auto-fit rationale.
import { ref, onMounted, onBeforeUnmount, type Ref } from 'vue'

/** Identity default — the scale used whenever layout is unavailable (jsdom/SSR)
 *  or nothing fits, so no consumer ever renders zero-size or NaN-scaled text. */
export const DEFAULT_FIT_SCALE = 1
/** Sane upper cap so a two-word slide is not scaled without bound. */
export const MAX_FIT_SCALE = 4
/** Floor below which computeFitScale never degrades — never 0/negative. */
const MIN_FIT_SCALE = 0.3
/** Binary-search iteration count; bounds the DoS surface (T-115-01) to a fixed,
 *  small number of oracle calls per measure. */
const DEFAULT_STEPS = 12

/** The canonical 1280x720 slide frame — the single source Plan 03 imports so
 *  the stage size is defined once for Audience/Confidence outputs + previews. */
export const REFERENCE_WIDTH = 1280
export const REFERENCE_HEIGHT = 720

/**
 * Binary-searches [min, max] for the largest scale where `fits(scale)` is true.
 * Pure, no DOM — `fits` is an injected oracle. Returns max when everything fits
 * (capped), min when nothing fits (never 0/NaN), otherwise the low edge of the
 * final bracket so the returned scale is guaranteed to fit (never the
 * overflowing upper edge).
 */
export function computeFitScale(
  fits: (scale: number) => boolean,
  opts?: { min?: number; max?: number; steps?: number },
): number {
  const min = opts?.min ?? MIN_FIT_SCALE
  const max = opts?.max ?? MAX_FIT_SCALE
  const steps = opts?.steps ?? DEFAULT_STEPS

  if (fits(max)) return max
  if (!fits(min)) return min

  let lo = min
  let hi = max
  for (let i = 0; i < steps; i++) {
    const mid = (lo + hi) / 2
    if (fits(mid)) {
      lo = mid
    } else {
      hi = mid
    }
  }
  return lo
}

function isFinitePositive(n: number): boolean {
  return Number.isFinite(n) && n > 0
}

/**
 * Largest uniform scale that fits a fixed `refW`x`refH` stage inside a
 * `containerW`x`containerH` container (min of the two ratios) — letterboxes
 * rather than stretches. Returns DEFAULT_FIT_SCALE for any non-finite or
 * non-positive input (e.g. a 0-size jsdom/SSR container).
 */
export function computeContainScale(
  containerW: number,
  containerH: number,
  refW: number,
  refH: number,
): number {
  if (
    !isFinitePositive(containerW) ||
    !isFinitePositive(containerH) ||
    !isFinitePositive(refW) ||
    !isFinitePositive(refH)
  ) {
    return DEFAULT_FIT_SCALE
  }
  return Math.min(containerW / refW, containerH / refH)
}

export interface UseSlideAutoFitResult {
  frameRef: Ref<HTMLElement | null>
  contentRef: Ref<HTMLElement | null>
  scale: Ref<number>
  /** Re-runs the fit measurement — call on slide change / after fontReady. */
  retrigger: () => void
}

/**
 * Per-slide text fit: measures `contentRef` against `frameRef` and exposes a
 * reactive `scale` (the largest fitting scale, capped at `options.max`).
 * Re-measured on mount, on `retrigger()`, and via a feature-detected
 * ResizeObserver on the frame. Never throws; degrades to DEFAULT_FIT_SCALE
 * wherever layout is unavailable (mirrors RunPreviewPair's useScaleToFit).
 */
export function useSlideAutoFit(options?: { max?: number }): UseSlideAutoFitResult {
  const frameRef = ref<HTMLElement | null>(null)
  const contentRef = ref<HTMLElement | null>(null)
  const scale = ref(DEFAULT_FIT_SCALE)
  let observer: ResizeObserver | null = null

  function measure() {
    const frame = frameRef.value
    const content = contentRef.value
    if (!frame || !content) return

    const frameW = frame.clientWidth
    const frameH = frame.clientHeight
    if (frameW <= 0 || frameH <= 0) {
      scale.value = DEFAULT_FIT_SCALE
      return
    }

    const fits = (trial: number) => {
      content.style.setProperty('--slide-fit-scale', String(trial))
      const w = content.scrollWidth
      const h = content.scrollHeight
      return w <= frameW && h <= frameH
    }

    const result = computeFitScale(fits, { max: options?.max ?? MAX_FIT_SCALE })
    content.style.setProperty('--slide-fit-scale', String(result))
    scale.value = result
  }

  function retrigger() {
    measure()
  }

  onMounted(() => {
    measure()
    if (typeof ResizeObserver !== 'undefined' && frameRef.value) {
      observer = new ResizeObserver(() => measure())
      observer.observe(frameRef.value)
    }
  })

  onBeforeUnmount(() => {
    observer?.disconnect()
    observer = null
  })

  return { frameRef, contentRef, scale, retrigger }
}

export interface UseContainScaleResult {
  containerRef: Ref<HTMLElement | null>
  scale: Ref<number>
}

/**
 * Geometric scale-to-contain of a fixed reference stage (default
 * REFERENCE_WIDTH x REFERENCE_HEIGHT) inside `containerRef`. Re-measured on
 * mount and via a feature-detected ResizeObserver; degrades to
 * DEFAULT_FIT_SCALE (1) wherever layout is unavailable.
 */
export function useContainScale(options?: { refW?: number; refH?: number }): UseContainScaleResult {
  const containerRef = ref<HTMLElement | null>(null)
  const scale = ref(DEFAULT_FIT_SCALE)
  const refW = options?.refW ?? REFERENCE_WIDTH
  const refH = options?.refH ?? REFERENCE_HEIGHT
  let observer: ResizeObserver | null = null

  function measure() {
    const el = containerRef.value
    if (!el) return
    scale.value = computeContainScale(el.clientWidth, el.clientHeight, refW, refH)
  }

  onMounted(() => {
    measure()
    if (typeof ResizeObserver !== 'undefined' && containerRef.value) {
      observer = new ResizeObserver(() => measure())
      observer.observe(containerRef.value)
    }
  })

  onBeforeUnmount(() => {
    observer?.disconnect()
    observer = null
  })

  return { containerRef, scale }
}
