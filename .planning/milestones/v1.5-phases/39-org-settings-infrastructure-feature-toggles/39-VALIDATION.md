---
phase: 39
slug: org-settings-infrastructure-feature-toggles
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-06
---

# Phase 39 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from `39-RESEARCH.md` § Validation Architecture, with the three Wave 0 file-existence
> questions **resolved by direct filesystem check on 2026-08-06** (see Wave 0 Requirements).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest ^4.0.18 |
| **Config file** | `vite.config.ts` (app suite — excludes `src/rules.test.ts`) |
| **Quick run command** | `npx vitest run src/stores/__tests__/auth.test.ts src/utils/__tests__/claudeApi.test.ts` |
| **Full suite command** | `npx vitest run --dir src --exclude '**/rules.test.ts'` |
| **Type gate** | `npm run type-check` — the `vue-tsc --build` form. **Not** `-p tsconfig.app.json`, which silently skips test files |
| **Estimated runtime** | ~60s full suite |

> ⚠ **Command correctness matters here** (CLAUDE.md, verified 2026-08-04). `npx vitest run src/`
> picks up `render-service/src/render.test.ts` by substring match and dies on a Vitest version
> mismatch. Bare `--dir src` bypasses `vite.config.ts`'s relative exclude and runs
> `src/rules.test.ts`, which fails without an emulator. Use the full command exactly as written
> above, or bare `npx vitest run`.

**Known-failing baseline (pre-existing, NOT caused by this phase):** `src/storage.rules.test.ts`
(2 allow-cases — the cross-service `firestore.exists()` limitation Phase 40 fixes) and
`src/views/__tests__/RosterView.test.ts` (stale assertion). A run reporting exactly these is green
for this phase's purposes.

---

## Sampling Rate

- **After every task commit:** targeted file run, e.g. `npx vitest run src/utils/__tests__/claudeApi.test.ts`
- **After every plan wave:** `npx vitest run --dir src --exclude '**/rules.test.ts'`
- **Before `/gsd-verify-work`:** full suite at the 2-file baseline **and** `npm run type-check` clean
- **Max feedback latency:** ~15s targeted, ~60s full

---

## Per-Requirement Verification Map

Task IDs are filled in by the planner; this map is the requirement-level contract the plan must
satisfy.

| Req | Behavior | Test Type | Automated Command | File Status |
|-----|----------|-----------|-------------------|-------------|
| R073 | `loadOrgContext` resolves a fully-populated `OrgSettings` when `orgData.settings` is absent (pre-v1.5 org doc) | unit | `npx vitest run src/stores/__tests__/auth.test.ts -t "OrgSettings"` | ✅ extend `auth.test.ts` |
| R073 | **Dual-read regression:** a flat `vwModeEnabled: false` org doc with no `settings` key still resolves `false`, not the new default `true` | unit | `npx vitest run src/stores/__tests__/auth.test.ts -t "vwModeEnabled"` | ✅ extend the existing `describe('vwModeEnabled (D-15/D-16)')` block at `auth.test.ts:295` |
| R073 | A partial `settings` object (only `aiEnabled` present) still resolves `pcEnabled` to its default | unit | same file, new case | ✅ extend |
| R073 | Dot-path write (`settings.vwModeEnabled`) rather than whole-object overwrite, so a concurrent settings write is not clobbered | unit | assert the `updateDoc` payload shape | ✅ extend |
| R088 | Each of the **3 network-calling** `claudeApi.ts` exports returns `null` and never invokes the SDK mock when `aiEnabled === false` | unit | `npx vitest run src/utils/__tests__/claudeApi.test.ts -t "aiEnabled"` | ✅ extend — reuse the existing `vi.hoisted` `mockCreate`/`mockParse` SDK mocks |
| R088 | The **4 pure helper exports** remain callable and ungated with AI off | unit | same file | ✅ extend |
| R088 | Three AI entry points hide when `aiEnabled` is false (UI consequence, not the enforcement) | component | `CongregationalEditor.test.ts`, `ScriptureInput.test.ts` | ✅ extend — note `ScriptureInput.test.ts` has **no Pinia activation today**, so adding the auth store breaks every test at mount unless the harness is prepared in the same change; `CongregationalEditor.test.ts` already calls `setActivePinia` and differs |
| R088 | Turning AI off does not alter existing AI-generated content — an existing split stays intact and hand-editable | component | `CongregationalEditor.test.ts` | ✅ extend |
| R089 | `buildExportOrCopyItem` omits the export item when `pcEnabled` is false, **independent of** `hasPcCredentials` | unit | `npx vitest run src/views/__tests__/serviceEditorActionBar.test.ts` | ✅ **exists — extend, do not create** |
| R089 | **Credential retention:** toggling PC off never invokes the clear-credentials path and never writes `pcAppId`/`pcSecret`; re-enabling shows the same masked display | unit | new `SettingsView.test.ts` | ❌ **Wave 0 — file does not exist** |
| R089 | Roster import button hides when `pcEnabled` is false | component | `RosterView.test.ts` | ✅ extend (note: carries a pre-existing stale-assertion failure) |
| R089 | Song import button hides when `pcEnabled` is false | component | new `SongsView.test.ts` | ❌ **Wave 0 — file does not exist** |

---

## Wave 0 Requirements

**File existence verified by direct check, 2026-08-06** — the research flagged these as open
questions; they are now answered:

- [ ] **CREATE** `src/views/__tests__/SettingsView.test.ts` — does not exist. Needed for both new
      toggle save handlers and, critically, the R089 credential-retention assertion.
- [ ] **CREATE** `src/views/__tests__/SongsView.test.ts` — does not exist. Needed for the
      song-import hide case. *(If the planner instead gates the song-import affordance somewhere
      already under test, this file may be unnecessary — but the assertion must live somewhere.)*
- [x] `src/views/__tests__/serviceEditorActionBar.test.ts` — **EXISTS**, extend it. The research
      was unsure; it is present at `src/views/__tests__/`, and the module itself is
      `src/views/serviceEditorActionBar.ts` (not `src/utils/`).
- [x] `src/stores/__tests__/auth.test.ts` — exists, extend.
- [x] `src/utils/__tests__/claudeApi.test.ts` — exists, extend.
- [x] `src/views/__tests__/RosterView.test.ts` — exists, extend.

---

## Manual-Only Verifications

These are the `backstop` items lifted from `39-UI-SPEC.md` § UI Considerations. Each must appear in
a plan's `must_haves` as a flat-scalar `{ statement, verification: backstop }` marker, and each
resolves to a human check.

| Behavior | Req | Why Manual | Test Instructions |
|----------|-----|------------|-------------------|
| **Credential retention across a real toggle cycle** | R089 | Firestore round-trip plus page reload; a unit test proves the handler doesn't call clear, but not that the value survives a reload | Enter PC credentials → toggle PC off → **reload the page** → toggle PC on → confirm the masked credential display is present and unchanged |
| **Defaults on a genuinely pre-v1.5 org document** | R073 | A fixture proves the merge function; only a real legacy document proves the *deployed* read path | Open Settings as an org whose document predates v1.5 — both new toggles render **checked**, no blank or indeterminate state, and every other screen behaves normally |
| **`vwModeEnabled` not silently flipped** | R073 | The regression is invisible: no error, no log, no failing test if the dual-read is wrong | Against an org with flat `vwModeEnabled: false`, confirm the VW toggle still renders **unchecked** after this phase |
| **AI feature list does not wrap past 2 lines** | R088 | Visual typography check at real viewport width | Desktop viewport, Settings → AI Features: no list item wraps beyond two lines |
| **Congregational editor button-row reflow** | R088 | Layout judgement | With AI off, the button row shows two buttons instead of three, visually balanced, and hand-dividing still works identically |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers both MISSING files (`SettingsView.test.ts`, `SongsView.test.ts`)
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `npm run type-check` (the `vue-tsc --build` form) clean
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
