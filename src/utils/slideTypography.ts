import { SLIDE_FONTS } from '@/config/slideFonts'

/**
 * Pure, independently-testable slide-typography helpers (46-RESEARCH.md
 * Pattern 1-3). This module is the single implementation all three render
 * sites (`PresentationViewer.vue`, the Slides grid, the Edit Slide drawer
 * preview — 46-04), the Settings "Slide Typography" card preview (46-03),
 * and the app-init font-load gate (R094) share — no consumer computes CSS
 * variables or re-derives the font-load gate on its own.
 */

/** Locked scale multipliers (46-CONTEXT.md): Medium is the identity scale —
 *  a church that never opens this setting sees zero size change. */
export const SCALE_MAP: Record<'sm' | 'md' | 'lg', number> = {
  sm: 0.85,
  md: 1.0,
  lg: 1.25,
}

/** Bounded font-load gate timeout (R094 / RESEARCH Open Question 1). A named
 *  constant, not a magic number, so it is a one-line change if human-verify
 *  on real projector hardware says otherwise. A stalled/missing font asset
 *  degrades to "render anyway" after this many ms — never a hung
 *  "Loading slideshow…" screen (T-46-04). */
export const FONT_LOAD_TIMEOUT_MS = 3000

const SANS_STACK = 'ui-sans-serif, system-ui, sans-serif'
const SERIF_STACK = 'ui-serif, Georgia, serif'

/** Matches `DEFAULT_ORG_SETTINGS.slideTypography` (src/types/organization.ts). */
const DEFAULT_FAMILY = 'Inter'
const DEFAULT_WEIGHT = 400
const DEFAULT_SCALE: keyof typeof SCALE_MAP = 'md'

export interface SlideTypographySettings {
  fontFamily: string
  fontWeight: number
  fontScale: 'sm' | 'md' | 'lg'
}

export interface SlideTypographyCssVars {
  '--slide-font-family': string
  '--slide-font-weight': number
  '--slide-font-scale': number
}

/**
 * Returns `weight` unchanged if it is reachable for `family` in the
 * `SLIDE_FONTS` registry, else snaps to 400 (every curated family ships
 * 400) — RESEARCH Pattern 3. Used both by the Settings card's family-change
 * handler and defensively by `cssVarsFor` below, in case Firestore ever
 * holds a stale `{family, weight}` pair from before a weight-list
 * correction (see 46-01-SUMMARY.md's corrected ramp).
 */
export function snapWeight(family: string, weight: number): number {
  const weights = SLIDE_FONTS[family]?.weights ?? [DEFAULT_WEIGHT]
  return weights.includes(weight) ? weight : DEFAULT_WEIGHT
}

function defaultCssVars(): SlideTypographyCssVars {
  const entry = SLIDE_FONTS[DEFAULT_FAMILY]
  const stack = entry?.category === 'serif' ? SERIF_STACK : SANS_STACK
  return {
    '--slide-font-family': `"${DEFAULT_FAMILY}", ${stack}`,
    '--slide-font-weight': DEFAULT_WEIGHT,
    '--slide-font-scale': SCALE_MAP[DEFAULT_SCALE],
  }
}

/**
 * Computes the three `--slide-font-*` CSS custom properties from a stored
 * (or possibly undefined/tampered) `slideTypography` value. DEFENSIVELY
 * falls back to Inter/400/md — never partially — when the family key is
 * unknown, the weight is not reachable for that family (via `snapWeight`),
 * or the scale is not one of `sm`/`md`/`lg` (T-46-03, ASVS V5): the value
 * written into `--slide-font-family` and, downstream, into a
 * `document.fonts.load()` template string is therefore always drawn from
 * the curated `SLIDE_FONTS` set, never free text.
 */
export function cssVarsFor(
  typography: Partial<SlideTypographySettings> | undefined,
): SlideTypographyCssVars {
  const { fontFamily, fontWeight, fontScale } = typography ?? {}

  const entry = fontFamily !== undefined ? SLIDE_FONTS[fontFamily] : undefined
  const weightValid =
    entry !== undefined &&
    fontWeight !== undefined &&
    snapWeight(fontFamily as string, fontWeight) === fontWeight
  const scaleValid =
    fontScale !== undefined && Object.prototype.hasOwnProperty.call(SCALE_MAP, fontScale)

  if (!entry || !weightValid || !scaleValid) {
    return defaultCssVars()
  }

  const stack = entry.category === 'serif' ? SERIF_STACK : SANS_STACK
  return {
    '--slide-font-family': `"${fontFamily}", ${stack}`,
    '--slide-font-weight': fontWeight as number,
    '--slide-font-scale': SCALE_MAP[fontScale as 'sm' | 'md' | 'lg'],
  }
}

/**
 * Font-flash gate (R094 / RESEARCH Pattern 2). Races an explicit
 * `document.fonts.load()` for the exact face — paired with `fonts.ready`
 * because `fonts.ready` alone is a documented footgun (WebKit#225790) —
 * against a bounded timeout, so a stalled/missing font asset resolves
 * `false` (proceed to render) rather than hanging the caller's loading
 * state indefinitely (T-46-04).
 */
export function waitForSlideFont(
  family: string,
  weight: number,
  timeoutMs: number = FONT_LOAD_TIMEOUT_MS,
): Promise<boolean> {
  const load = Promise.all([
    document.fonts.ready,
    document.fonts.load(`${weight} 1em "${family}"`),
  ]).then(() => true)

  const timeout = new Promise<boolean>((resolve) => {
    setTimeout(() => resolve(false), timeoutMs)
  })

  return Promise.race([load, timeout])
}

/**
 * On-demand loader for a non-eager curated family (RESEARCH's "bundle
 * strategy": only the org's chosen default face is eager-imported in
 * `main.ts`; the other four curated families load lazily when previewed in
 * Settings — 46-03 — or requested by the presenter gate — 46-04). Each
 * entry uses a static `@fontsource/<package>` prefix so Vite's
 * import-analysis can statically discover and bundle the per-weight
 * chunks; do NOT replace this with a single dynamically-templated package
 * name.
 */
const FONT_CSS_LOADERS: Record<string, (weight: number) => Promise<unknown>> = {
  Inter: (weight) => import(`@fontsource/inter/${weight}.css`),
  'Open Sans': (weight) => import(`@fontsource/open-sans/${weight}.css`),
  Poppins: (weight) => import(`@fontsource/poppins/${weight}.css`),
  Lora: (weight) => import(`@fontsource/lora/${weight}.css`),
  'Source Serif 4': (weight) => import(`@fontsource/source-serif-4/${weight}.css`),
}

export function loadFontCss(family: string, weight: number): Promise<unknown> {
  const loader = FONT_CSS_LOADERS[family]
  if (!loader) {
    return Promise.resolve()
  }
  return loader(weight)
}
