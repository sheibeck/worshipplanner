---
phase: 102-gated-scripture-fetch-dispatcher
fixed_at: 2026-08-31T20:00:00Z
review_path: .planning/phases/102-gated-scripture-fetch-dispatcher/102-REVIEW.md
iteration: 1
findings_in_scope: 5
fixed: 5
skipped: 0
status: all_fixed
---

# Phase 102: Code Review Fix Report

**Fixed at:** 2026-08-31
**Source review:** .planning/phases/102-gated-scripture-fetch-dispatcher/102-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 5 (1 critical, 3 warning, 1 info — `fix_scope: all`)
- Fixed: 5
- Skipped: 0

## Fixed Issues

### CR-01: `planningCenterApi.ts`'s SCRIPTURE branch bypassed the scriptureApi dispatcher

**Files modified:** `src/utils/planningCenterApi.ts`, `src/utils/__tests__/planningCenterApi.test.ts`
**Commit:** `9685942a`
**Applied fix:** `addSlotAsItem`'s SCRIPTURE branch now calls `scriptureApi.fetchScriptureText(refText, effectiveVersion)` instead of `fetchPassageText`/`fetchNltPassageText` directly. The direct `esvApi`/`nltApi` imports were removed. Kept wrapped in the pre-existing `try/catch` as a defensive safety net (the dispatcher's gate check runs before its own internal try/catch, so a throw from `useAuthStore()` would otherwise propagate uncaught — the same edge case WR-02 addresses in the two Vue components). Result branching:
- `'ok'` → uses the fetched text as the item description (unchanged behavior).
- `'disabled'` → makes zero proxy calls; falls back to the slot's own `congregationalSections` text (joined) if present, else omits the description entirely — no throw, no error.
- `'error'` → preserves the pre-existing silent-ignore behavior (description stays `undefined`).

Test file updated to mock `@/stores/auth` (`useAuthStore` → flippable `isBibleApiEnabled` getter, defaulting to `true` so every pre-existing SCRIPTURE test keeps its enabled/passthrough assertions unchanged) since the real dispatcher now runs inside `addSlotAsItem` and needs a resolvable auth store in this pure-util test file (no `setActivePinia`). Added two new tests under `R297: disabled org (bibleApiEnabled=false)`: no-proxy-call with no stored text (empty description), and no-proxy-call with `congregationalSections` fallback.

### WR-01: `ScriptureSlideEditor.vue` imported `esvApi` directly — a latent bypass

**Files modified:** `src/components/ScriptureSlideEditor.vue`, `src/components/__tests__/ScriptureSlideEditor.test.ts`
**Commit:** `e7f27770`
**Applied fix:** Confirmed via whole-`src/` grep that `ScriptureSlideEditor.vue` is not imported/mounted anywhere in the app (only its own test file and a stale doc-comment reference in `SongLyricEditor.vue`) — genuinely dead code today, not a live regression. Chose the "route through the dispatcher now" option (cheap, and closes the gap before a future phase wires this component into a view without re-auditing it) rather than deleting the component outright, since it represents real, tested functionality (fetch → split into slides → auto-save). `onFetchPassage` now calls `fetchScriptureText(query, 'ESV')` (still ESV-only — no NLT dispatch existed here before either, a pre-existing gap explicitly out of this phase's scope) and branches on `'ok'`/`'disabled'`/`'error'`; `'disabled'` is a graceful no-op matching the other two components. Test file's `esvApi` mock replaced with a `scriptureApi` mock; added a dedicated disabled-branch test asserting no slides/reading are created and no fetch-error is shown.

### WR-02: refactor dropped the generic `catch` in `ScriptureInput.vue`/`CongregationalEditor.vue`

**Files modified:** `src/components/ScriptureInput.vue`, `src/components/CongregationalEditor.vue`
**Commit:** `1bec4f60`
**Applied fix:** Restored a `catch` clause alongside the existing `status`-branching `if`/`else if` in three call sites — `ScriptureInput.vue`'s `fetchPreview` and `togglePreview`, and `CongregationalEditor.vue`'s `autoFetch` — while keeping the `finally` for loading-state cleanup. Each `catch` maps to the same error UX the `'error'` status branch already uses (`previewError`/`aiPreviewError`/`fetchError` respectively), so an exception anywhere in the try block (the dispatcher's pre-try-catch `useAuthStore()` call, or `CongregationalEditor.vue`'s post-fetch `stripVerseMarkers`) degrades gracefully instead of becoming an unhandled rejection.

### WR-03: no handler-level test proved `api()` denies esv/nlt for a disabled org

**Files modified:** `functions/src/index.test.ts`
**Commit:** `dcc459d2`
**Applied fix:** Added three handler-level tests inside the existing `api (WR-04: anthropic branch end-to-end wiring)` describe block, mirroring the anthropic branch's R242/R243/CR-01 tests 1:1 for the esv branch:
1. A disabled org (`bibleApiEnabled: false`) → `res.status(403)` with the exact user-facing message, `fetchMock` never called.
2. A caller whose token carries no `orgId` claim → `res.status(403)` before the enablement check, `fetchMock` never called, `getFirestore` never called.
3. An org-doc Firestore read error → `res.status(503)`, `fetchMock` never called (fail-closed, distinct from the rate limiter's fail-open posture).

`checkOrgBibleEnablement`'s own unit tests (six cases) and the pre-existing WR-01 enabled-esv-path end-to-end test were left untouched — these three close the specific gap the plan's `truths` entry called out (the actual `api(req, res)` wiring, not just the extracted gate function).

### IN-01: `togglePreview`'s disabled-branch was untested

**Files modified:** `src/components/__tests__/ScriptureInput.test.ts`
**Commit:** `f904871c`
**Applied fix:** Added a test mirroring the existing `fetchPreview` disabled-branch test (`mockBibleApiEnabled = false`), but driving the AI-suggestion expanded preview (`togglePreview`) instead — sets up an AI search result, expands it, and asserts neither `fetchPassageText` nor `fetchNltPassageText` is called and no "Could not load preview" text appears.

## Skipped Issues

None — all 5 in-scope findings were fixed.

## Verification (post-fix gate run, in an isolated worktree)

- `npm run type-check` (`vue-tsc --build`) — clean, zero errors.
- `cd functions && npm run build && npm test` — build clean; **636/636 tests passed** (18 test files), including the 3 new WR-03 handler tests.
- Bare `npx vitest run` (root) — **175/177 test files passed, 4776/4803 tests passed** (26 skipped). The only 2 failing files are the pre-existing documented baselines: `src/storage.rules.test.ts` (Storage-emulator-dependent, documented defect in CLAUDE.md, unrelated to this phase) and `src/stores/appConfig.test.ts` (one pre-existing dot-path-payload assertion mismatch, unrelated to scripture fetching). Neither regressed by this fix pass.
- Re-grep of the whole `src/` tree for `from '@/utils/esvApi'` / `from '@/utils/nltApi'` after all fixes: the **only** production import is `src/utils/scriptureApi.ts` (the dispatcher itself, as intended). All other matches are test files that mock these modules to assert non-invocation, plus `nltApi.ts`'s own unit test. **Zero remaining direct scripture-fetch callers outside the dispatcher.**
- `firebase deploy` — **not run**, per instructions.

## R297 Claim Status

Post-fix, the phase's "single scripture-fetch choke point" claim now holds for the whole codebase (`src/`), not just the two originally-scoped components (`ScriptureInput.vue`, `CongregationalEditor.vue`). Every reachable ESV/NLT fetch — including the previously-missed Planning Center push flow — now passes through `scriptureApi.ts`'s gate, and the one currently-dead-code call site (`ScriptureSlideEditor.vue`) is closed pre-emptively so it can't reintroduce a bypass when wired into a future view.

---

_Fixed: 2026-08-31_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
