---
phase: 46-global-slide-typography
plan: 02
subsystem: frontend
tags: [typography, css-variables, font-loading, org-settings, vitest, tdd]

requires:
  - phase: 46-global-slide-typography
    plan: 01
    provides: "SLIDE_FONTS registry (src/config/slideFonts.ts) and SLIDE_FONT_FAMILY_NAMES — the single source of truth for family/weight/category this plan's snapWeight/cssVarsFor/loadFontCss all read"
provides:
  - "OrgSettings.slideTypography field + DEFAULT_ORG_SETTINGS default, extended at the single loadOrgContext merge point"
  - "src/utils/slideTypography.ts — SCALE_MAP, FONT_LOAD_TIMEOUT_MS, cssVarsFor(), snapWeight(), waitForSlideFont(), loadFontCss()"
  - "--slide-font-family/-weight/-scale CSS custom properties declared in :root with Inter/400/1 fallbacks"
  - "Eager import of @fontsource/inter/400.css in main.ts before app.mount()"
affects: [46-03-settings-slide-typography-card, 46-04-render-site-application]

tech-stack:
  added: []
  patterns:
    - "Pure-function typography module (cssVarsFor/snapWeight/waitForSlideFont/loadFontCss) shared by Settings card, render sites, and app init — one implementation, three-plus consumers"
    - "Promise.race(loadFontFaces, timeout) bounded font-flash gate resolving to a plain boolean, never hanging"
    - "Defensive full-fallback (not partial) to Inter/400/md when any one of family/weight/scale fails validation against SLIDE_FONTS/SCALE_MAP"

key-files:
  created:
    - src/utils/slideTypography.ts
    - src/utils/__tests__/slideTypography.test.ts
  modified:
    - src/types/organization.ts
    - src/assets/main.css
    - src/main.ts

key-decisions:
  - "cssVarsFor falls back to the FULL Inter/400/md default (never a partial mix) if the family is unknown, the weight is unreachable for that family, OR the scale is not sm|md|lg — matches the plan's literal 'falls back to Inter/400/md when...' wording rather than snapping each field independently."
  - "loadFontCss uses one hardcoded dynamic-import call per curated family (5 static @fontsource/<package> prefixes), not a single templated package name, so Vite's import-analysis can statically discover and bundle the per-weight chunks (plan's explicit instruction)."
  - "Followed the task's tdd=true flow literally: RED (failing test file, confirmed failing on module-not-found), then GREEN (implementation), each as its own commit — no plan-level TDD gate applies since the plan's own frontmatter type is 'execute', not 'tdd'."

patterns-established:
  - "Slide-typography CSS vars are runtime custom properties in :root with safe fallbacks, deliberately not Tailwind v4 @theme (a build-time-only mechanism) — per 46-RESEARCH.md Pattern 1."

requirements-completed: []
requirements-partial:
  - id: R093
    note: "Settings contract (slideTypography field/default) and the CSS-var/weight-snap logic exist and are unit-tested, but the Settings 'Slide Typography' picker UI (46-03) and the three render-site consumers (46-04) are not yet built."
  - id: R094
    note: "waitForSlideFont's bounded Promise.race gate exists and is unit-tested (resolve + timeout paths), but it is not yet wired into PresentationViewer.vue's onMounted (46-04)."

coverage:
  - id: D1
    description: "OrgSettings.slideTypography field + DEFAULT_ORG_SETTINGS default at the single loadOrgContext merge point"
    requirement: "R093"
    verification:
      - kind: other
        ref: "npm run type-check (vue-tsc --build) clean; src/stores/auth.ts::loadOrgContext read directly — merge is still the single `{ ...DEFAULT_ORG_SETTINGS, ...orgSettings }` at line 202, untouched"
        status: pass
    human_judgment: false
  - id: D2
    description: "Pure typography helpers (SCALE_MAP, FONT_LOAD_TIMEOUT_MS, cssVarsFor, snapWeight, waitForSlideFont, loadFontCss) unit-tested including the defensive-fallback and bounded-timeout paths"
    requirement: "R093, R094"
    verification:
      - kind: unit
        ref: "src/utils/__tests__/slideTypography.test.ts — 11/11 passing (SCALE_MAP/FONT_LOAD_TIMEOUT_MS constants; cssVarsFor serif/sans stacks, undefined fallback, tampered-value fallback; snapWeight snap and reachable-weight cases; waitForSlideFont resolve + fake-timer timeout)"
        status: pass
      - kind: other
        ref: "npm run type-check (vue-tsc --build)"
        status: pass
    human_judgment: false
  - id: D3
    description: ":root CSS variables declared with safe Inter/400/1 fallbacks; default face eager-imported before app.mount()"
    requirement: "R093, R094"
    verification:
      - kind: other
        ref: "npm run build succeeds — @fontsource/inter/400.css resolves and bundles the Inter 400 latin/cyrillic/greek/vietnamese woff2+woff chunks; src/assets/main.css :root block and src/main.ts import order inspected directly"
        status: pass
    human_judgment: false

duration: 25min
completed: 2026-08-08
status: complete
---

# Phase 46 Plan 02: CSS Variables & Font Loading Foundation Summary

**`OrgSettings.slideTypography` field + default, and a pure `src/utils/slideTypography.ts` module (CSS-var computation, weight snapping, the bounded R094 font-load gate, and the on-demand font-CSS loader) — unit-tested independently of any component mount, plus the `:root` CSS variables and app-init eager import of the default face.**

## Performance

- **Duration:** 25 min
- **Started:** 2026-08-08T17:14:00Z (approx, first read of plan)
- **Completed:** 2026-08-08T17:39:00Z
- **Tasks:** 3 (Task 1 settings contract; Task 2 TDD pure helpers; Task 3 CSS vars + eager import)
- **Files modified:** 5 (src/types/organization.ts, src/utils/slideTypography.ts, src/utils/__tests__/slideTypography.test.ts, src/assets/main.css, src/main.ts)

## Accomplishments

- Added `OrgSettings.slideTypography: { fontFamily: string; fontWeight: number; fontScale: 'sm' | 'md' | 'lg' }` with JSDoc matching the `bibleVersion` field's style, and `DEFAULT_ORG_SETTINGS.slideTypography = { fontFamily: 'Inter', fontWeight: 400, fontScale: 'md' }` — confirmed `src/stores/auth.ts::loadOrgContext` still has exactly one `{ ...DEFAULT_ORG_SETTINGS, ...orgSettings }` merge point (line 202), unchanged.
- Followed the task's `tdd="true"` RED/GREEN flow: wrote `src/utils/__tests__/slideTypography.test.ts` first (confirmed it failed on `Failed to resolve import "@/utils/slideTypography"` — module did not exist yet), committed as `test(...)`, then implemented `src/utils/slideTypography.ts` and confirmed all 11 tests pass, committed as `feat(...)`.
- `cssVarsFor()` computes the three `--slide-font-*` CSS vars, building a sans or serif font stack by the family's `SLIDE_FONTS[...].category`, and falls back to the FULL Inter/400/md default (not a partial per-field snap) when the family is unknown, the weight is unreachable via `snapWeight`, or the scale isn't `sm|md|lg` — closing T-46-03's tampering mitigation.
- `snapWeight()` reads `SLIDE_FONTS[family]?.weights`, returning the weight unchanged if reachable, else `400`.
- `waitForSlideFont()` races `Promise.all([document.fonts.ready, document.fonts.load(...)])` against `setTimeout(FONT_LOAD_TIMEOUT_MS = 3000)` via `Promise.race`, resolving a plain boolean — verified both the resolve-ready and the fake-timer timeout path with `vi.useFakeTimers()` / `vi.advanceTimersByTimeAsync`.
- `loadFontCss()` maps each of the five curated families to its own hardcoded `import(\`@fontsource/<package>/${weight}.css\`)` call (a static per-family record, not a single templated package name), for on-demand loading of non-default families by 46-03's preview and 46-04's presenter gate.
- Declared `:root { --slide-font-family: 'Inter', ui-sans-serif, system-ui, sans-serif; --slide-font-weight: 400; --slide-font-scale: 1; }` in `src/assets/main.css` — deliberately NOT via Tailwind v4's `@theme`, which is build-time only and cannot hold a runtime/per-org value.
- Added `import '@fontsource/inter/400.css'` to `src/main.ts` immediately after `import './assets/main.css'` and before `createApp`/`app.mount('#app')`, so the default face is fetched before first paint. `npm run build` confirmed the import resolves and bundles the Inter 400 woff2/woff chunks (latin, latin-ext, cyrillic, cyrillic-ext, greek, greek-ext, vietnamese subsets).
- `npm run type-check` (`vue-tsc --build`) clean after every task.
- Full app suite (`npx vitest run`, bare) reports the documented 2-file baseline (`src/storage.rules.test.ts`, `src/views/__tests__/RosterView.test.ts`) plus the pre-existing `render-service/src/render.test.ts` tooling artifact already logged in `46-01`'s `deferred-items.md` (Vitest version mismatch between root and `render-service/`) — no new failure introduced by this plan. 3023/3036 individual tests pass; the 13 failures are entirely within those three known files.

## Task Commits

1. **Task 1: OrgSettings.slideTypography field + default** - `c2261d1` (feat)
2. **Task 2 RED: failing tests for slideTypography helpers** - `3a9f8d3` (test)
3. **Task 2 GREEN: slideTypography pure helpers implementation** - `2f378da` (feat)
4. **Task 3: :root CSS vars + eager main.ts import** - `387ffea` (feat)

## Files Created/Modified

- `src/types/organization.ts` - `OrgSettings.slideTypography` field + `DEFAULT_ORG_SETTINGS.slideTypography` default
- `src/utils/slideTypography.ts` - `SCALE_MAP`, `FONT_LOAD_TIMEOUT_MS`, `cssVarsFor()`, `snapWeight()`, `waitForSlideFont()`, `loadFontCss()`
- `src/utils/__tests__/slideTypography.test.ts` - 11 tests covering every `<behavior>` case in the plan
- `src/assets/main.css` - `:root` block declaring `--slide-font-family/-weight/-scale` with Inter/400/1 fallbacks
- `src/main.ts` - eager `import '@fontsource/inter/400.css'` before `app.mount()`

## Decisions Made

- `cssVarsFor` falls back to the complete Inter/400/md default rather than snapping each field independently, when any one of family/weight/scale fails validation — the plan's `<action>` text says the function "DEFENSIVELY falls back to Inter / 400 / md ... when the family key is unknown, the weight is not in that family's ramp ..., or the scale is not one of sm|md|lg," read as an all-or-nothing fallback, not a per-field snap. `snapWeight` remains the separate, narrower helper the Settings card (46-03) will use for its own family-change re-derivation.
- `loadFontCss` hardcodes one dynamic-import call per curated family (5 literal `@fontsource/<package>` prefixes) rather than templating the package name from `SLIDE_FONTS[family].package`, per the plan's explicit instruction that the prefix must be static so Vite's import-analysis can discover and bundle the weight chunks.
- Ran Task 2 as an explicit RED → GREEN sequence (two separate commits) since the task carried `tdd="true"`, even though the plan's own frontmatter `type` is `execute` (not `tdd`) — the per-task TDD flag governs the task-level commit discipline regardless of the plan-level type.

## Deviations from Plan

None — plan executed exactly as written, including the TDD RED/GREEN sequencing on Task 2.

## Known Stubs

None. All three deliverables (settings field, pure helpers, CSS vars + eager import) are fully wired to their stated contract; nothing renders from a hardcoded/mock value here (this plan produces no UI — that is 46-03/46-04's scope).

## Threat Flags

None beyond the plan's own declared `<threat_model>` (T-46-03, T-46-04), both of which are directly mitigated by `cssVarsFor`'s full-fallback and `waitForSlideFont`'s `Promise.race`, respectively — no new, undeclared security-relevant surface was introduced by this plan's files.

## Issues Encountered

Full-suite verification (`npx vitest run`, bare, per CLAUDE.md) reports 3 failed test files, not the documented 2-file baseline. The third, `render-service/src/render.test.ts`, is the same pre-existing tooling artifact already logged in `.planning/phases/46-global-slide-typography/deferred-items.md` during 46-01 (a Vitest version mismatch between the root project and `render-service/`'s own workspace) — this plan touched none of `render-service/`'s files, so it is out of scope per the SCOPE BOUNDARY rule and not re-logged here as a new item.

## User Setup Required

None.

## Next Phase Readiness

`src/utils/slideTypography.ts` (`cssVarsFor`, `snapWeight`, `waitForSlideFont`, `loadFontCss`) and `OrgSettings.slideTypography` + its default are ready for 46-03 (Settings "Slide Typography" card, consuming `cssVarsFor`/`snapWeight`/`loadFontCss` for the preview and the family-change re-derivation) and 46-04 (the three render sites consuming `cssVarsFor`, and `PresentationViewer.vue`'s `onMounted` consuming `waitForSlideFont` + `FONT_LOAD_TIMEOUT_MS` for the R094 gate). No blockers.

---
*Phase: 46-global-slide-typography*
*Completed: 2026-08-08*

## Self-Check: PASSED

- FOUND: src/types/organization.ts
- FOUND: src/utils/slideTypography.ts
- FOUND: src/utils/__tests__/slideTypography.test.ts
- FOUND: src/assets/main.css
- FOUND: src/main.ts
- FOUND commit: c2261d1
- FOUND commit: 3a9f8d3
- FOUND commit: 2f378da
- FOUND commit: 387ffea
