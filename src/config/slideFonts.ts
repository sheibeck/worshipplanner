/**
 * See .planning/codebase/CONCERNS.md (Store & Config Concern Notes (R318) ->
 * src/config/slideFonts.ts).
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
 * The six curated slide font families (CONTEXT.md's locked, deliberately
 * small set; Roboto added for R126 in Phase 55). `Inter` is listed first —
 * `SLIDE_FONT_FAMILY_NAMES` preserves that order for the Settings `<select>`,
 * and `Inter` is `DEFAULT_ORG_SETTINGS.slideTypography.fontFamily` (46-02).
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
  Roboto: {
    family: 'Roboto',
    package: '@fontsource/roboto',
    category: 'sans',
    // Roboto ships the full 100-900 static ramp (600.css present) — the
    // standard 300-700 ramp applies with no omissions, unlike Lora.
    weights: [300, 400, 500, 600, 700],
    // OFL-1.1 for the pinned ^5.3.0: early 5.x reported Apache-2.0; Google
    // relicensed Roboto to OFL upstream and fontsource followed at 5.2.0.
    // Verified in-tarball (SIL OFL 1.1 verbatim) + `npm view … license`.
    // The package-legitimacy SUS/too-new flag is the documented
    // fontsource-lockstep structural false positive (Phase 46 precedent),
    // deferred in PENDING-VERIFICATION.md § Phase 55.
    license: 'OFL-1.1',
    licenseUrl: 'https://fontsource.org/fonts/roboto/license',
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
