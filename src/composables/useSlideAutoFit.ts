// R329 — replaces the manual `--slide-font-scale` sm/md/lg multiplier with a
// measure-and-fit engine. See .planning/codebase/ARCHITECTURE.md (§ Component &
// Composable Behavioral Notes) and docs/adr/ for the auto-fit rationale.

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
