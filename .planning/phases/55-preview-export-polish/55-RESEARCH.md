# Phase 55: Preview & Export Polish - Research

**Researched:** 2026-08-11
**Domain:** Vue 3 render-site edit (scripture attribution), async export UX (spinner), self-hosted font registry wiring (@fontsource)
**Confidence:** HIGH — all three deliverables verified against live source at file:line, the Roboto package verified against its own tarball + npm registry this session.

## Summary

Three independent, small, low-risk refinements closing v1.6. All findings are grounded in the current
`src/` tree (not training memory).

- **R124** is a pure render-only change at exactly **two** call sites of `scriptureAttribution(resolveTranslationSource(...))`. Both are preview surfaces. **PRINT and SHARE do NOT use these sites** — they render scripture as a *reference only* (e.g. `Romans 8:1-11`) through a completely separate path (`formatScriptureRef`), and never showed an `(ESV)`/`(NLT)` suffix at all. Removing the auto-append therefore **cannot regress print/share**. The provenance machinery (`translationSource` field, `resolveTranslationSource`, `scriptureAttribution`) stays intact — only its two render consumers are removed.
- **R125** is largely already scaffolded: `isExporting` reactive flag, `:disabled="isExporting"` double-invocation guards, a store-status re-check guard, and an `{{ isExporting ? 'Exporting...' : ... }}` text label already exist in `ServiceEditorView.vue`. The work is to add the **visual spinner glyph** (the app's existing `animate-spin` ring from `VolunteerCsvImportModal.vue`) to the Confirm Export button. No new flag or guard needs inventing.
- **R126** adds Roboto to the curated self-hosted font set. `@fontsource/roboto@5.3.0` is **OFL-1.1** (verified in-tarball), ships the **full 100–900 static weight ramp** (600 included), `postinstall` is null, canonical repo `github.com/fontsource/font-files`. The registry entry uses the same 300–700 ramp `[300,400,500,600,700]` as Inter — **no weight omissions needed** (unlike Lora). Loader map gets one static-prefix line.

**Primary recommendation:** Treat as three tiny, parallelizable tasks. Delete the two attribution render sites + their now-unused imports (R124); add an `animate-spin` glyph to the Confirm Export button (R125); `npm install @fontsource/roboto@^5.3.0` as a Wave-0 step, then add one registry entry + one loader line (R126). Keep `npm run type-check` (vue-tsc --build) clean by removing dead imports.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| R124 scripture-slide render (preview) | Browser / Client (Vue render) | — | Suffix is appended at render time in `.vue`/display helper, not baked into stored data or the API |
| R124 print/share scripture render | Browser / Client (separate components) | — | `ServicePrintLayout.vue` + `ShareView.vue` render reference-only via `formatScriptureRef`; independent of the two preview sites |
| R125 export progress indicator | Browser / Client (Vue reactive state) | API / Backend (Planning Center calls it awaits) | The async work is PC API calls; the spinner is a pure client-side reactive affordance over an existing `isExporting` flag |
| R126 font loading | Browser / Client + CDN/Static (self-hosted woff2 bundled by Vite) | — | `@fontsource` woff2 is bundled and served as a static asset — never the runtime Google Fonts API (offline-projector constraint) |

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| R124 | Slideshow preview no longer auto-appends the Bible version to scripture slides; manual add still possible; provenance data preserved | Two render sites pinned at file:line (§R124); print/share proven independent; provenance helpers kept; suffix-asserting tests enumerated |
| R125 | Planning Center export shows a spinner while running | Export seam pinned (`onConfirmExport`, `isExporting`); reusable `animate-spin` glyph pattern identified; guards already present (§R125) |
| R126 | Add Roboto to curated self-hosted slide fonts; Inter + other four remain | `@fontsource/roboto@5.3.0` legitimacy verified (OFL-1.1, full weight ramp, null postinstall); registry entry + loader line specified (§R126) |
</phase_requirements>

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**R124 — No auto-appended Bible version in preview**
- The `(ESV)`/`(NLT)` suffix is auto-appended at TWO render sites (v1.5 Phase 45 R091): `slideDisplay.ts::slideBodyText()` (~:217) and `PresentationViewer.vue::scriptureAttributionSuffix()` (~:707, used :213/:222).
- **Remove the AUTOMATIC append at the render sites** so a scripture slide shows only its own text.
- **KEEP the provenance machinery intact** — do NOT delete the `translationSource` field, the `resolveTranslationSource` resolver, or the `scriptureAttribution` helper. R092's capture-once immutability stays. This is a RENDER change, not a data change.
- **Manual addition** = the user types "(ESV)" into the slide's own text if they want it; nothing special is built.
- **Scope — research MUST confirm:** default to removing the auto-append at BOTH presenter and grid. Research MUST verify PRINT and SHARE either have their own independent attribution or do not rely on these two sites — R124 must NOT regress required attribution on print/share. If print/share share the sites, flag for explicit decision.

**R125 — Spinner on the Planning Center export**
- The export flow lives in `ServiceEditorView.vue`. Add a spinner / in-progress indicator on the export action that shows while running and clears on completion/failure.
- Reuse the app's existing spinner/loading affordance; do not invent a new one. Disable/guard the trigger against double-invocation while running.

**R126 — Roboto slide font**
- Install `@fontsource/roboto` (self-hosted woff2 — NEVER the runtime Google Fonts API). Add a Roboto entry to `SLIDE_FONTS` (`src/config/slideFonts.ts`) with its correct weight ramp, and a loader-map entry in `slideTypography.ts` (~:156-160). Inter (and the other four) remain unchanged.
- **Package legitimacy — research MUST verify** `@fontsource/roboto` the Phase 46 way: confirm license and available weights against the package's own files, not assumed. Pin the version consistent with the existing @fontsource packages (5.x line).

### Claude's Discretion
- Whether R124 removes the auto-append at one render site or both (default both, pending the print/share check), the exact spinner affordance for R125, and Roboto's exact weight ramp for R126 — subject to: R124 keeps the provenance data (render-only), R125 reuses existing loading UI, R126 is self-hosted woff2 with verified legitimacy, and `npm run type-check` stays clean.

### Deferred Ideas (OUT OF SCOPE)
None — three self-contained polish items.
</user_constraints>

## Project Constraints (from CLAUDE.md)

- **Type-check gate:** `npm run type-check` runs `vue-tsc --build`, which typechecks test files too. Use it as the gate — NOT `vue-tsc --noEmit -p tsconfig.app.json` (that silently skips tests). Dead imports left after R124 will surface here.
- **App test suite:** run `npx vitest run` (bare) or `npx vitest run --dir src --exclude '**/rules.test.ts'`. Do NOT use `npx vitest run src/` (picks up `render-service/src/render.test.ts` on a Vitest version mismatch) and do NOT use `npx vitest run --dir src` alone (runs `src/rules.test.ts` which needs an emulator).
- **Known-failing baseline (2 files, do not chase):** `src/storage.rules.test.ts` (Storage-emulator cross-service limitation) and `src/views/__tests__/RosterView.test.ts` (stale assertion). A green run for this phase = these 2 still failing, nothing new.
- **Curated-fonts constraint:** every slide font ships as static `@fontsource/*` self-hosted woff2 — NEVER the runtime Google Fonts API (a projector offline at service time cannot fetch a remote font). R126 must follow this.
- **`.env.local` required** in any worktree for emulator/tests/build — copy/symlink from `C:\projects\worshipplanner\.env.local`. (Not directly needed for these three code changes, but the full unit suite fails to *load* Firebase-importing component tests without it.)

## Standard Stack

No new runtime libraries beyond one font package. Everything else is already in the tree.

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@fontsource/roboto` | `^5.3.0` | Self-hosted Roboto woff2 + per-weight CSS for the slide font registry | Matches the five existing `@fontsource/*@^5.3.0` deps; self-hosted (offline-safe); OFL-1.1 [VERIFIED: npm registry + in-tarball LICENSE] |

**Installation (Wave 0 — build-dependency add, reversible, NOT a deploy, NOT .env.local):**
```bash
npm install @fontsource/roboto@^5.3.0
```

**Version verification (performed this session):**
- `npm view @fontsource/roboto version` → `5.3.0`; `dist-tags.latest` → `5.3.0` [VERIFIED: npm registry]
- Existing package.json fontsource deps are all `^5.3.0` (inter, lora, open-sans, poppins, source-serif-4) — `^5.3.0` is consistent [VERIFIED: codebase package.json:21-25]

## Package Legitimacy Audit

Ran the Phase 46 protocol: `gsd-tools query package-legitimacy check`, `npm view`, tarball extraction of LICENSE + weight files, `postinstall` inspection.

| Package | Registry | Age (last publish) | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| `@fontsource/roboto` | npm | 2026-07-19 (catalog lockstep re-publish) | 1,263,382 / wk | github.com/fontsource/font-files | `SUS` (reason: `too-new`) | **Approved** — structural false positive (see below) |

**Verdict interpretation:** `SUS`/`too-new` is the **identical structural false positive** documented for Phase 46's five fontsource packages in `src/config/slideFonts.ts`'s header comment and `.planning/PENDING-VERIFICATION.md`. The entire `@fontsource` catalog (hundreds of packages) re-publishes in lockstep on every upstream Google Fonts refresh, so `publishedAt` always looks "new". Countervailing signals, all verified this session:
- **License OFL-1.1** — confirmed by the verbatim string *"This Font Software is licensed under the SIL Open Font License, Version 1.1"* in the extracted `package/LICENSE`. `npm view ... license` also reports `OFL-1.1` for `5.3.0`. [VERIFIED: in-tarball LICENSE]
  - ⚠ **License-drift note:** early 5.x (`5.0.0`–`5.1.1`) report `Apache-2.0`; `5.2.0`+ report `OFL-1.1` (Google relicensed Roboto to OFL upstream and fontsource followed). Pinning `^5.3.0` lands on **OFL-1.1**, matching the other five families' `license: 'OFL-1.1'`. CONTEXT.md's "Apache-2.0/OFL" is resolved to **OFL-1.1** for the pinned version.
- **`postinstall` is null/undefined** — no install-time script. [VERIFIED: `npm view ... scripts.postinstall` + tarball package.json]
- **Weekly downloads 1.26M**, canonical repo `github.com/fontsource/font-files`. [VERIFIED: npm registry via legitimacy seam]

**Disposition:** Approve for install. Follow the Phase 46 precedent — record the `SUS`/`too-new` verdict in `.planning/PENDING-VERIFICATION.md` § Phase 55 as DEFERRED (structural false positive, direct tarball+registry verification performed), and mirror the reasoning in the new `slideFonts.ts` Roboto entry / header comment. The planner does **not** need a `checkpoint:human-verify` gate here because direct authoritative verification (in-tarball LICENSE + weight files) was completed — but at minimum note the deferral entry, consistent with Phase 46.

**Packages removed due to SLOP verdict:** none.
**Packages flagged SUS:** `@fontsource/roboto` — structural false positive, approved per above.

## Architecture Patterns

### R124 — the two render sites (definitive, with file:line)

The `(ESV)`/`(NLT)` suffix is **appended at render time**, never stored. `scriptureAttribution` is called at **exactly two** places in `src/` (verified: `grep 'scriptureAttribution\b'` returns only these two + the helper definition + the unit test):

**Site 1 — grid/card/drawer preview:** `src/components/slides/slideDisplay.ts::slideBodyText()` line **217**:
```ts
if (!slide.text) return slide.reference
const suffix = ` ${scriptureAttribution(resolveTranslationSource(slide))}`   // ← REMOVE
const showReference = !slide.section
return showReference ? `${slide.reference}\n${slide.text}${suffix}` : `${slide.text}${suffix}`
```
Cleanest edit — drop the suffix:
```ts
if (!slide.text) return slide.reference
const showReference = !slide.section
return showReference ? `${slide.reference}\n${slide.text}` : slide.text
```
Then remove the now-unused named imports on lines 16–19 (keep `formatScriptureReference`, `scriptureRefFromSlot`; delete `scriptureAttribution`, `resolveTranslationSource`):
```ts
import { formatScriptureReference, scriptureRefFromSlot } from '@/utils/scripture'
```

**Site 2 — presenter ("the slideshow preview"):** `src/components/PresentationViewer.vue`:
- `scriptureAttributionSuffix()` defined line **707–709** (calls `scriptureAttribution(resolveTranslationSource(slide))`).
- Called in the template at line **213** (congregational-section paragraph) and line **222** (normal-mode passage paragraph).
- Import at line **401**: `import { scriptureAttribution, resolveTranslationSource } from '@/utils/scripture'`.

Cleanest edit — delete the function, drop both template call expressions, remove the import:
```vue
<!-- line 212-213 becomes -->
{{ ((currentSlide.slide as ScriptureSlide).section as CongregationalSection).text }}
<!-- line 221-222 becomes -->
{{ (currentSlide.slide as ScriptureSlide).text }}
```
Delete `scriptureAttributionSuffix` (707–709) and the line-401 import entirely (both symbols become unused → `vue-tsc --build` / oxlint would flag them).

**Consumers of `slideBodyText` (all are preview/edit surfaces — none are print/share):**
- `src/components/slides/SlideCard.vue:251` (grid card body)
- `src/components/slides/EditSlideDrawer.vue:690,799,831` (edit-drawer live preview)

Removing the suffix in `slideBodyText` correctly removes it from the grid card AND the edit-drawer preview — both "preview" surfaces, consistent with "don't auto add it".

### PRINT / SHARE verdict (definitive — R124 does NOT regress them)

**Print** (`src/components/ServicePrintLayout.vue`): renders a SCRIPTURE slot as a bare reference — `{{ slot.book }} {{ slot.chapter }}:{{ slot.verseStart }}-{{ slot.verseEnd }}` (line 44) — and the MESSAGE sermon passage via `formatScriptureRef(props.service.sermonPassage)` (line 62). It **never renders passage text and never appends an `(ESV)`/`(NLT)` suffix**. `grep` for `scriptureAttribution|Attribution|ESV|NLT` in this file returns **no matches**.

**Share** (`src/views/ShareView.vue`): renders a SCRIPTURE slot via `formatScriptureRef` (imported from `@/utils/planningCenterExport`, line 127) — reference-only. **No passage text, no attribution suffix.** `grep` for scripture/attribution/ESV/NLT returns **no matches**.

**PresentationViewer is mounted in exactly one place** — `ServiceEditorView.vue:1341` (the Service-Order/Slides preview). It is not used by print or share.

**Conclusion:** Print and share render scripture through a **separate reference-only path** and have never shown the translation suffix. Removing the auto-append at the two preview render sites is fully scoped to preview + grid + edit-drawer, with **zero effect on print/share**. No decision-flag is needed; the owner's "slideshow preview" instruction is satisfied and print/share attribution is not a concern (there is none to regress). The provenance data (`translationSource` on each slide/section) remains stamped for future/manual use.

### R125 — export spinner seam

Everything except the visual glyph already exists in `src/views/ServiceEditorView.vue`:

- **Reactive flag (reuse, do not add):** `const isExporting = ref(false)` (line **1667**), set `true` at line **3269** in `onConfirmExport`, cleared in `finally` at line **3617**.
- **Double-invocation guard (already present):** the Confirm button is `:disabled="isExporting || !exportSelectedServiceTypeId"` (line **498**); the Cancel button `:disabled="isExporting"` (line 492); and `onConfirmExport` additionally re-reads the stored service status and aborts if another editor already exported (lines 3242–3269).
- **Existing text feedback:** the button label already reads `{{ isExporting ? 'Exporting...' : exportMode === 'existing' ? 'Add to Plan' : 'Export' }}` (line **500**).
- **Two async phases:** `onExportToPC` (line 3161) opens the dialog and fetches service types/templates/teams — that phase already shows `exportLoading` → "Loading options..." (line 405). `onConfirmExport` (line 3242) is the long-running export. The spinner belongs on the **Confirm Export button** (the long PC round-trip).

**Reusable spinner markup (the app's established affordance):** `src/components/VolunteerCsvImportModal.vue:99`:
```html
<div class="h-8 w-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
```
Also used at `VolunteerCsvImportModal.vue:193`, `SongTable.vue:7`, and the inline SVG `animate-spin` variant in `LoginView.vue:32`. For an inline button glyph, size it down (e.g. `h-4 w-4`, `border-white/40 border-t-transparent`) so it sits beside "Exporting...".

**Exact change:** inside the Confirm Export button (lines 495–500), render the spinner glyph when `isExporting`, e.g.:
```vue
<button type="button" @click="onConfirmExport"
  :disabled="isExporting || !exportSelectedServiceTypeId"
  class="... inline-flex items-center justify-center gap-2 ...">
  <span v-if="isExporting" class="h-4 w-4 border-2 border-white/50 border-t-transparent rounded-full animate-spin" data-testid="export-spinner" aria-hidden="true"></span>
  {{ isExporting ? 'Exporting...' : exportMode === 'existing' ? 'Add to Plan' : 'Export' }}
</button>
```
Add `data-testid="export-spinner"` so the test can assert presence/absence. No new flag, no new guard.

### R126 — Roboto registry + loader wiring

**Registry entry** — add to `SLIDE_FONTS` in `src/config/slideFonts.ts` (place after Inter or at the end; `Inter` MUST stay first per the "lists Inter first" test at slideFonts.test.ts:12). Roboto ships the **full 100–900 ramp** (verified: tarball contains `100.css`…`900.css` including `600.css`), so the standard 300–700 ramp applies with **no omissions**:
```ts
Roboto: {
  family: 'Roboto',
  package: '@fontsource/roboto',
  category: 'sans',
  weights: [300, 400, 500, 600, 700],
  license: 'OFL-1.1',
  licenseUrl: 'https://fontsource.org/fonts/roboto/license',
},
```

**Loader map** — add one line to `FONT_CSS_LOADERS` in `src/utils/slideTypography.ts` (~:155–161), using the same static-prefix form so Vite can statically discover the per-weight chunks:
```ts
Roboto: (weight) => import(`@fontsource/roboto/${weight}.css`),
```

**No other edits needed:** `SLIDE_FONT_FAMILY_NAMES` is derived from `Object.keys(SLIDE_FONTS)` (auto-includes Roboto); `snapWeight`/`cssVarsFor`/`waitForSlideFont`/`loadFontCss` are all data-driven off the registry. Inter stays `DEFAULT_FAMILY`. The Settings picker `<select>` picks up Roboto automatically. Category `sans` → `SANS_STACK` fallback.

### Anti-Patterns to Avoid
- **Don't delete the provenance helpers.** `scriptureAttribution`/`resolveTranslationSource`/`translationSource` stay (R092 immutability). Remove only their two render consumers + the now-dead imports.
- **Don't leave dead imports.** After R124, `scriptureAttribution` + `resolveTranslationSource` are unused in both files — `npm run type-check` (vue-tsc --build) and oxlint will flag them.
- **Don't template the fontsource package name dynamically.** Keep the static `@fontsource/roboto/${weight}.css` prefix — a fully dynamic package string breaks Vite import-analysis (per the existing header comment in slideTypography.ts).
- **Don't add a new `isExporting`-style flag for R125.** Reuse the existing one; a second flag risks the two disagreeing.
- **Don't bake attribution into stored slide text as a "manual" default.** Manual add = the user typing it into the slide's own editable text; no code change beyond leaving text editable.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Spinner glyph | A new CSS keyframe / component | The existing `animate-spin` ring (`VolunteerCsvImportModal.vue:99`) | Consistent app affordance; Tailwind `animate-spin` already available |
| Export in-progress state | A new reactive flag / debounce | Existing `isExporting` ref + `:disabled` guards + store-status re-check | Already wired end-to-end; reinventing risks double-fire regressions |
| Font family list / weight snap | Per-component font logic | The data-driven `SLIDE_FONTS` registry + `slideTypography.ts` helpers | Single source of truth; Roboto is one registry entry + one loader line |
| Self-hosting a font | Manual woff2 download + @font-face | `@fontsource/roboto` static package | Offline-projector-safe, versioned, license-shipped, matches the existing five |

**Key insight:** all three items are wiring changes into existing, well-factored seams — the codebase already anticipated each (data-driven font registry, shared attribution helper, existing export flag). The risk is *over*-building, not under-building.

## Common Pitfalls

### Pitfall 1: Dead imports after removing the render sites
**What goes wrong:** deleting the suffix expressions but leaving `import { scriptureAttribution, resolveTranslationSource }` → `vue-tsc --build` errors or lint failure.
**How to avoid:** remove the imports in both files in the same edit; run `npm run type-check` as the gate (not the `-p tsconfig.app.json` form, per CLAUDE.md).
**Warning signs:** `TS6133 'scriptureAttribution' is declared but its value is never read` (from vue-tsc --build), or oxlint `no-unused-vars`.

### Pitfall 2: Updating the suffix tests to the wrong shape
**What goes wrong:** many tests assert the suffix is *present*; after R124 they must assert its *absence*. Missing one leaves a red test; over-deleting removes the coverage that proves the suffix is gone.
**How to avoid:** flip each `endsWith('(ESV)')`/`toContain('(NLT)')` assertion to `not.toContain('(ESV)')` + `not.toContain('(NLT)')`, and change combined-string expectations to the no-suffix form (see the enumerated list in Validation Architecture).
**Warning signs:** a test named "…shows (NLT)…" still passing after the render site is removed means the assertion wasn't actually re-pointed.

### Pitfall 3: Adding a weight Roboto doesn't ship, or wrong license
**What goes wrong:** copying Lora's "omit 300" habit, or listing 200/800; or trusting an early-5.x Apache-2.0 license.
**How to avoid:** Roboto@5.3.0 ships the full 100–900 ramp (600 included) and is OFL-1.1 — use `[300,400,500,600,700]` and `license: 'OFL-1.1'`. Verified this session against the tarball.
**Warning signs:** a `import('@fontsource/roboto/600.css')` 404 at runtime (won't happen — 600.css exists), or the slideFonts test's per-family weight-ramp check failing.

### Pitfall 4: The "exactly five families" test breaks (expected)
**What goes wrong:** `slideFonts.test.ts:5-9` asserts exactly five keys — adding Roboto makes it fail until updated.
**How to avoid:** update that test to six keys including `'Roboto'` as part of the R126 change (it is a required, expected edit — see Validation Architecture).

## Runtime State Inventory

Not a rename/refactor/migration phase. No stored data, live-service config, OS-registered state, secrets, or build-artifact renames are involved.
- **Stored data:** None — `translationSource` stays stamped on slides; R124 changes only rendering, no data migration. Manual attribution lives in user-typed slide text (already persisted as normal slide content).
- **Build artifacts:** the one new dependency (`@fontsource/roboto`) adds bundled woff2 chunks via Vite; `npm install` is the only artifact action (Wave 0). No stale artifacts to clean.

## Validation Architecture

> nyquist_validation key is absent in `.planning/config.json` → treated as ENABLED.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest `^4.0.18` + `@vue/test-utils` `^2.4.6` (jsdom) |
| Config file | `vite.config.ts` (app suite; excludes `src/rules.test.ts`) |
| Quick run command | `npx vitest run src/components/slides/__tests__/slideDisplay.test.ts src/config/__tests__/slideFonts.test.ts` |
| Full suite command | `npx vitest run` (bare — the CLAUDE.md-sanctioned invocation) |
| Type gate | `npm run type-check` (vue-tsc --build — typechecks tests too) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| R124 | `slideBodyText` no longer appends `(ESV)`/`(NLT)` | unit | `npx vitest run src/components/slides/__tests__/slideDisplay.test.ts` | ✅ (edit assertions) |
| R124 | Presenter renders no attribution suffix | component | `npx vitest run src/components/__tests__/PresentationViewer.test.ts` | ✅ (edit assertions) |
| R124 | Provenance data untouched (`scriptureAttribution`/`resolveTranslationSource` still exported & correct) | unit | `npx vitest run src/utils/__tests__/scripture.test.ts` | ✅ (should stay green, no edit) |
| R125 | Spinner shows while `isExporting`, absent otherwise; button disabled during export | component | `npx vitest run src/views/__tests__/ServiceEditorView.test.ts` | ✅ (add test) |
| R126 | Registry has six families incl. Roboto with `[300,400,500,600,700]`, OFL-1.1 | unit | `npx vitest run src/config/__tests__/slideFonts.test.ts` | ✅ (update count + add Roboto assertions) |
| R126 | Loader map resolves Roboto | unit | `npx vitest run src/utils/__tests__/slideTypography.test.ts` | ✅ (add loader assertion) |

**Existing suffix-asserting tests that MUST be re-pointed to assert ABSENCE (R124):**
- `src/components/slides/__tests__/slideDisplay.test.ts`:
  - `:358-366` combined ref+text expects `'Psalms 23:1-6\nThe LORD is my shepherd (ESV)'` → `'Psalms 23:1-6\nThe LORD is my shepherd'`
  - `:369-378` NLT case → drop ` (NLT)`
  - `:395-405` congregational section expects `'For God so loved the world (ESV)'` → `'For God so loved the world'`
  - `:409-419` later section → drop ` (ESV)`
  - `:424-432` reference-state → drop ` (ESV)`
  - `:381-389` reference-only (no text) already has no suffix — stays green (good regression anchor).
  - Consider adding explicit `not.toContain('(ESV)')` / `not.toContain('(NLT)')` guards to lock the new behavior.
- `src/components/__tests__/PresentationViewer.test.ts`:
  - `:653-655` expects `... + ' (ESV)'` → drop suffix
  - `:721-722` `${section.text} (ESV)` → `${section.text}`
  - `:738-809` the whole `describe('scripture attribution suffix (45-04, R091/R092)')` block (`:740,751,761,771,782,802`) — re-point to assert the suffix is now ABSENT (several already assert `not.toContain` for the *other* version — extend to assert neither `(ESV)` nor `(NLT)` appears)
  - `:831` and `:855` `${...} (ESV)` → drop suffix
  - `:1865` `${section.text} (ESV)` → drop suffix
- `src/utils/__tests__/scripture.test.ts:523-534` (`describe('scriptureAttribution')`) — **do NOT change**; the helper is preserved and must still return `(ESV)`/`(NLT)`. This is the proof R124 is render-only.

### Sampling Rate
- **Per task commit:** the relevant quick command for that task's file(s).
- **Per wave merge:** `npx vitest run` (bare) + `npm run type-check`.
- **Phase gate:** `npm run type-check` clean AND `npx vitest run` green except the known 2-file baseline (`src/storage.rules.test.ts`, `src/views/__tests__/RosterView.test.ts`), before `/gsd-verify-work`.

### Wave 0 Gaps
- [ ] **`npm install @fontsource/roboto@^5.3.0`** — build-dependency add; MUST run before `slideTypography.test.ts` can resolve the new loader import and before build. Schedule as the first R126 step.
- [ ] `src/config/__tests__/slideFonts.test.ts` — update "exactly five" (`:5-9`) to six keys incl. `'Roboto'`; the existing per-family license (`:48`) and weight-ramp (`:35-41`) loops auto-cover the new entry.
- [ ] `src/utils/__tests__/slideTypography.test.ts` — no existing Roboto/loader coverage; add a `loadFontCss('Roboto', 400)` resolves / `FONT_CSS_LOADERS['Roboto']` present assertion.
- [ ] `src/views/__tests__/ServiceEditorView.test.ts` — no existing `isExporting`/spinner test; add one asserting `[data-testid="export-spinner"]` renders when `isExporting` is true and the Confirm button is `disabled`.
- Test framework itself: present — no install needed beyond the font package.

## Security Domain

> security_enforcement key absent → treated as enabled. This phase's attack surface is minimal.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V5 Input Validation | yes (indirect) | Font family already flows through `cssVarsFor`'s defensive `SLIDE_FONTS`-membership check before reaching `document.fonts.load()` (T-46-03); Roboto is a curated registry key, not free text — no new input path. Manual attribution is plain-text interpolation (`{{ }}`), never `v-html` (PresentationViewer test `:802` proves no markup executes). |
| V2/V3/V4 Auth/Session/Access | no | No auth, session, or access-control surface touched |
| V6 Cryptography | no | None |

### Known Threat Patterns for this stack
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| XSS via slide text (manual attribution now user-typed) | Tampering | Text rendered via Vue `{{ }}` interpolation, never `v-html` — auto-escaped. No change needed; R124 removes output, adds none. |
| Untrusted font family reaching `document.fonts.load()` | Tampering | Existing `cssVarsFor` defensive fallback to Inter for unknown families (unchanged); Roboto is a curated key. |

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Roboto licensed Apache-2.0 | Roboto relicensed to OFL-1.1 (Google upstream); `@fontsource/roboto` ≥5.2.0 reports OFL-1.1 | fontsource 5.2.0 (early 2025) | Pin `^5.3.0` → OFL-1.1, matching the other five curated families; CONTEXT.md's "Apache-2.0/OFL" resolves to OFL-1.1 |
| Attribution auto-appended at render (Phase 45 R091) | Auto-append removed; provenance data retained for manual/future use (R124) | This phase | Preview/grid/drawer show scripture text only; print/share unaffected (always reference-only) |

**Deprecated/outdated:** none removed; `scriptureAttribution`/`resolveTranslationSource` are retained (deliberately not deprecated — kept for manual/future use).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| — | (none) | — | All claims verified against live source (file:line) or the `@fontsource/roboto` tarball + npm registry this session. |

**All claims in this research were verified or cited — no user confirmation needed.** The one judgment call (removing the auto-append at BOTH preview sites, not just the presenter) is explicitly sanctioned by CONTEXT.md's "default both" and is proven safe by the print/share independence finding.

## Open Questions

1. **Spinner placement nuance — Confirm button only, or also the action-bar trigger?**
   - What we know: the long PC round-trip is `onConfirmExport`; the dialog-open fetch (`onExportToPC`) already shows "Loading options...".
   - What's unclear: whether the owner also wants a spinner on the action-bar `export-pc-btn` that opens the dialog.
   - Recommendation: put the spinner on the **Confirm Export button** (the long operation the owner means by "doing something"); the dialog-open phase is fast and already has "Loading options..." feedback. Discretion granted by CONTEXT.md.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| npm registry (`@fontsource/roboto`) | R126 install | ✓ | 5.3.0 (latest) | — |
| Node | build/test | ✓ | engines `^20.19 || >=22.12` | — |
| `.env.local` | full unit suite load (Firebase-importing tests) | present in main checkout | — | copy/symlink from `C:\projects\worshipplanner\.env.local` |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** none blocking.

## Sources

### Primary (HIGH confidence)
- Live source read at file:line: `slideDisplay.ts:16-19,190-228`, `PresentationViewer.vue:201-223,401,690-709`, `scripture.ts:289-307`, `ServicePrintLayout.vue:39-64,120-124`, `ShareView.vue:45-53,122-128`, `ServiceEditorView.vue:483-501,1341,1667-1679,3161-3271,3593-3617`, `slideFonts.ts` (full), `slideTypography.ts` (full), `VolunteerCsvImportModal.vue:99`, `package.json`.
- Existing tests: `slideDisplay.test.ts:352-433`, `PresentationViewer.test.ts:653-855,1865`, `scripture.test.ts:523-534`, `slideFonts.test.ts:5-48`.
- `@fontsource/roboto@5.3.0` tarball: LICENSE (OFL-1.1 verbatim), weight files `100.css`–`900.css`, package.json (`postinstall` null).
- `npm view @fontsource/roboto` (version 5.3.0, license per-version, dist-tags), `gsd-tools query package-legitimacy check` (SUS/too-new + signals: 1.26M dl/wk, canonical repo, postinstall null).

### Secondary (MEDIUM confidence)
- fontsource license-drift (Apache-2.0 → OFL-1.1 across the 5.x line) inferred from per-version `npm view ... license` output — authoritative registry data.

### Tertiary (LOW confidence)
- None.

## Metadata

**Confidence breakdown:**
- R124 render sites + print/share verdict: HIGH — exhaustive grep (`scriptureAttribution\b` → only 2 call sites) + direct read of print/share render paths.
- R125 export seam + spinner: HIGH — flag/guards/label already in source; reusable glyph identified.
- R126 Roboto legitimacy + wiring: HIGH — tarball LICENSE + weight files + registry all verified this session.

**Research date:** 2026-08-11
**Valid until:** ~2026-09-10 (stable; the one moving part is the fontsource version, pinned `^5.3.0`).
