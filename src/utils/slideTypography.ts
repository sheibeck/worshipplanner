import { SLIDE_FONTS } from '@/config/slideFonts'

/**
 * Pure, independently-testable slide-typography helpers (46-RESEARCH.md
 * Pattern 1-3) — the single implementation every render site shares.
 * See .planning/codebase/ARCHITECTURE.md (Utils Behavioral Notes — src/utils/slideTypography.ts)
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
 * Computes the three `--slide-font-*` CSS custom properties. DEFENSIVELY
 * falls back to Inter/400/md — never partially — on any invalid input
 * (T-46-03, ASVS V5): the value fed downstream into `document.fonts.load()`
 * is therefore always drawn from the curated `SLIDE_FONTS` set, never free text.
 * See .planning/codebase/ARCHITECTURE.md (Utils Behavioral Notes — src/utils/slideTypography.ts)
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
  ]).then(
    () => true,
    // See ADR-0197 (docs/adr/0197-a-rejected-document-fonts-load-is-a-failed-load-not-a-stalle.md)
    () => false,
  )

  // IN-01 (46-REVIEW.md): capture the timer id so the losing side of the
  // race can be cleared once a result is known, rather than leaving a live
  // timer running for up to `timeoutMs` on every mount for no purpose.
  let timeoutId: ReturnType<typeof setTimeout>
  const timeout = new Promise<boolean>((resolve) => {
    timeoutId = setTimeout(() => resolve(false), timeoutMs)
  })

  return Promise.race([load, timeout]).then((result) => {
    clearTimeout(timeoutId)
    return result
  })
}

/**
 * On-demand loader for a non-eager curated family. Every `import()` below is
 * a FULLY STATIC string literal — do NOT collapse to a templated
 * `import(\`…/${weight}.css\`)`; Vite 7's `dynamic-import-vars` cannot
 * statically analyze a variable inside a bare `@fontsource/*` specifier, and
 * the lazy font load would throw at runtime in a production build.
 * See .planning/codebase/STACK.md (Utils Stack Notes — src/utils/slideTypography.ts)
 */
export const FONT_CSS_LOADERS: Record<string, (weight: number) => Promise<unknown>> = {
  Inter: (weight) => {
    switch (weight) {
      case 300:
        return import('@fontsource/inter/300.css')
      case 400:
        return import('@fontsource/inter/400.css')
      case 500:
        return import('@fontsource/inter/500.css')
      case 600:
        return import('@fontsource/inter/600.css')
      case 700:
        return import('@fontsource/inter/700.css')
      default:
        return Promise.resolve()
    }
  },
  Roboto: (weight) => {
    switch (weight) {
      case 300:
        return import('@fontsource/roboto/300.css')
      case 400:
        return import('@fontsource/roboto/400.css')
      case 500:
        return import('@fontsource/roboto/500.css')
      case 600:
        return import('@fontsource/roboto/600.css')
      case 700:
        return import('@fontsource/roboto/700.css')
      default:
        return Promise.resolve()
    }
  },
  'Open Sans': (weight) => {
    switch (weight) {
      case 300:
        return import('@fontsource/open-sans/300.css')
      case 400:
        return import('@fontsource/open-sans/400.css')
      case 500:
        return import('@fontsource/open-sans/500.css')
      case 600:
        return import('@fontsource/open-sans/600.css')
      case 700:
        return import('@fontsource/open-sans/700.css')
      default:
        return Promise.resolve()
    }
  },
  Poppins: (weight) => {
    switch (weight) {
      case 300:
        return import('@fontsource/poppins/300.css')
      case 400:
        return import('@fontsource/poppins/400.css')
      case 500:
        return import('@fontsource/poppins/500.css')
      case 600:
        return import('@fontsource/poppins/600.css')
      case 700:
        return import('@fontsource/poppins/700.css')
      default:
        return Promise.resolve()
    }
  },
  Lora: (weight) => {
    // Lora ships no 300 weight (see SLIDE_FONTS) — omitted here on purpose.
    switch (weight) {
      case 400:
        return import('@fontsource/lora/400.css')
      case 500:
        return import('@fontsource/lora/500.css')
      case 600:
        return import('@fontsource/lora/600.css')
      case 700:
        return import('@fontsource/lora/700.css')
      default:
        return Promise.resolve()
    }
  },
  'Source Serif 4': (weight) => {
    switch (weight) {
      case 300:
        return import('@fontsource/source-serif-4/300.css')
      case 400:
        return import('@fontsource/source-serif-4/400.css')
      case 500:
        return import('@fontsource/source-serif-4/500.css')
      case 600:
        return import('@fontsource/source-serif-4/600.css')
      case 700:
        return import('@fontsource/source-serif-4/700.css')
      default:
        return Promise.resolve()
    }
  },
}

export function loadFontCss(family: string, weight: number): Promise<unknown> {
  const loader = FONT_CSS_LOADERS[family]
  if (!loader) {
    return Promise.resolve()
  }
  return loader(weight)
}
