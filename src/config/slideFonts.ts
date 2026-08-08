/**
 * Curated registry of self-hosted slide fonts (R093 success criterion 4).
 *
 * Every family here ships as a static (non-variable) `@fontsource/*` package
 * — self-hosted woff2, never the runtime Google Fonts API (a projector
 * without internet at service time cannot fetch a remote font). This is the
 * single source of truth the Settings "Slide Typography" card (46-03) reads
 * for the family list and per-family weight ramp, the `snapWeight` helper
 * (46-02) reads to validate/correct a stored weight, and the on-demand
 * font-CSS loader (46-02 `loadFontCss`) reads for the `package` + `category`
 * used to build the CSS `@import` path and the font-family CSS stack.
 *
 * `weights` is intentionally the "standard 300-700 ramp" subset of each
 * package's full shipped weight list, NOT every weight the package ships —
 * CONTEXT.md locks the picker to 300/400/500/600/700 only (no 100/200/800/
 * 900). A family that doesn't ship a given ramp weight simply omits it here
 * (e.g. Lora has no 300) rather than listing a weight that would 404.
 *
 * `license` and `licenseUrl` were each verified directly against that
 * package's own installed `node_modules/@fontsource/<package>/LICENSE` file
 * (2026-08-08) — not assumed by analogy to Inter. All five are SIL Open Font
 * License 1.1 ("OFL-1.1"), confirmed by the "This Font Software is licensed
 * under the SIL Open Font License, Version 1.1" text present verbatim in
 * every package's LICENSE file. See 46-RESEARCH.md § "Curated Font List" for
 * the source table this registry is built from (CORRECTED from
 * 46-UI-SPEC.md's table — Open Sans ships 500, Source Serif 4 ships 300 and
 * 500, both omitted by the UI-SPEC's unverified draft).
 *
 * Package legitimacy: `gsd-tools query package-legitimacy check` flagged all
 * five packages `SUS` with reason `too-new`. This is a structural false
 * positive from `@fontsource`'s catalog-wide lockstep release cadence (the
 * entire multi-hundred-package catalog re-publishes together on every
 * upstream Google Fonts refresh), not a genuine supply-chain signal — all
 * five resolve to the canonical `github.com/fontsource/font-files` repo,
 * weekly downloads range 104K-2.37M, and `postinstall` is `null` on every
 * package. Recorded in `.planning/PENDING-VERIFICATION.md` § Phase 46 as
 * DEFERRED (not self-approved) per the STATE.md v1.5 standing autonomy
 * grant, since RESEARCH.md already performed direct tarball + registry
 * verification.
 */

export interface SlideFontDefinition {
  /** Display family name, also the map key and the string written into
   *  `OrgSettings.slideTypography.fontFamily`. */
  family: string
  /** The `@fontsource/*` npm package providing this family's woff2 + CSS. */
  package: string
  /** Coarse category, used to build the CSS `font-family` fallback stack. */
  category: 'sans' | 'serif'
  /** Weights offered in the Settings picker for this family, restricted to
   *  the locked 300-700 ramp and to weights this package actually ships. */
  weights: number[]
  /** SPDX license identifier, verified against the package's own LICENSE file. */
  license: string
  /** Canonical URL to that license's text. */
  licenseUrl: string
}

/**
 * The five curated slide font families (CONTEXT.md's locked, deliberately
 * small set). `Inter` is listed first — `SLIDE_FONT_FAMILY_NAMES` preserves
 * that order for the Settings `<select>`, and `Inter` is
 * `DEFAULT_ORG_SETTINGS.slideTypography.fontFamily` (46-02).
 */
export const SLIDE_FONTS: Record<string, SlideFontDefinition> = {
  Inter: {
    family: 'Inter',
    package: '@fontsource/inter',
    category: 'sans',
    weights: [300, 400, 500, 600, 700],
    license: 'OFL-1.1',
    licenseUrl: 'https://fontsource.org/fonts/inter/license',
  },
  'Open Sans': {
    family: 'Open Sans',
    package: '@fontsource/open-sans',
    category: 'sans',
    weights: [300, 400, 500, 600, 700],
    license: 'OFL-1.1',
    licenseUrl: 'https://fontsource.org/fonts/open-sans/license',
  },
  Poppins: {
    family: 'Poppins',
    package: '@fontsource/poppins',
    category: 'sans',
    weights: [300, 400, 500, 600, 700],
    license: 'OFL-1.1',
    licenseUrl: 'https://fontsource.org/fonts/poppins/license',
  },
  Lora: {
    family: 'Lora',
    package: '@fontsource/lora',
    category: 'serif',
    // No 300/Light weight exists in the package at all.
    weights: [400, 500, 600, 700],
    license: 'OFL-1.1',
    licenseUrl: 'https://fontsource.org/fonts/lora/license',
  },
  'Source Serif 4': {
    family: 'Source Serif 4',
    package: '@fontsource/source-serif-4',
    category: 'serif',
    weights: [300, 400, 500, 600, 700],
    license: 'OFL-1.1',
    licenseUrl: 'https://fontsource.org/fonts/source-serif-4/license',
  },
}

/**
 * Derived family-name list, `Inter` first, for the Settings `<select>`.
 * The longest name (`Source Serif 4`) fits a native `<option>` with no
 * custom dropdown/overflow handling needed.
 */
export const SLIDE_FONT_FAMILY_NAMES = Object.keys(SLIDE_FONTS)
