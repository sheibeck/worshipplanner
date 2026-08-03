# Phase 32 — UI Review

**Audited:** 2026-08-02
**Baseline:** 32-UI-SPEC.md (approved design contract), current code as of HEAD `2e76d8b` (post 32-REVIEW-FIX)
**Screenshots:** not captured — no dev server detected at localhost:3000. This is a code-only, static audit.

---

## Pillar Scores

| Pillar | Score | Key Finding |
|--------|-------|-------------|
| 1. Copywriting | 4/4 | All five states' copy, including the two verbatim Phase-31 error strings and the toast lead/dismiss label, match the spec character-for-character. |
| 2. Visuals | 4/4 | Both new components ship as byte-for-byte matches of the spec's literal markup; icon-free indicator, single warning glyph, correct hierarchy via color/weight only. |
| 3. Color | 4/4 | Exact declared triples used (`gray-400` pending/saving, `green-400` saved, `red-950/red-800/red-400` toast); no new indigo anywhere; no hardcoded hex/rgb introduced by this phase. |
| 4. Typography | 4/4 | Exactly the two declared sizes (`text-xs`, `text-sm`) and two weights (regular, `font-medium`) in the new/changed markup — no drift. |
| 5. Spacing | 4/4 | All spacing classes (`gap-2`, `px-4`, `py-2`/`py-3`, `mb-3`, `bottom-4`/`inset-x-4`, `sm:bottom-6`/`sm:right-6`) match the declared scale; no arbitrary off-grid values introduced. |
| 6. Experience Design | 3/4 | Core state machine, edge-triggering, unmount cleanup, and CR-01/02/03 concurrency fixes are all present and tested — but several UI-SPEC backstop items (loading-state race on view/record switch, overflow wrap) could not be confirmed statically and are correctly still open per `PENDING-VERIFICATION.md`. |

**Overall: 23/24**

---

## Top 3 Priority Fixes

1. **Backstop tests for record-switch races (E2/E4 `loading`, E4 `partial`) are unverified in this audit** — user impact: switching services/readings/songs mid-save could theoretically show a stale `Saved h:mm` or misattribute a save to the wrong record — concrete fix: none required for this audit (advisory, non-blocking); confirm these are tracked in `PENDING-VERIFICATION.md` and scheduled, since 32-UI-SPEC itself flags E4 `partial` as "the sharpest correctness risk in the phase's UI layer."
2. **Overflow/wrap backstop (E1/E4 `overflow`, the 59-char error string in `SongLyricEditor`'s tightest header) is unverified** — user impact: if the string clips instead of wrapping, the failure copy becomes unreadable in the narrowest host — concrete fix: needs a real-browser or mounted-width check; static analysis only confirms no `truncate`/`whitespace-nowrap` class was added (a good sign, not proof).
3. **`lifecycleError`'s Phase-31 failure text at `ServiceEditorView.vue:2135` diverges from the Phase-32 `errorText` at `:2139`** (`"...Check your connection; editing again will retry."` vs `"...Try again."`) — this is explicitly out of this phase's copywriting contract (lifecycleError is Phase 31's own surface, deliberately untouched) but is worth flagging as a latent inconsistency for a future cleanup pass since both strings describe the same failure to the same user, just in different surfaces.

---

## Detailed Findings

### Pillar 1: Copywriting (4/4)
- `src/components/SaveStatusIndicator.vue:8-15` — all four rendered states (`Saving soon…`, `Saving…`, `Saved {{ formattedSavedAt }}`, `{{ entry.errorText ?? GENERIC_ERROR_TEXT }}`) match the spec's literal markup verbatim, including the ellipsis characters.
- `src/stores/saveStatus.ts:17` — `GENERIC_ERROR_TEXT = "Couldn't save your changes — they're still here. Try again."` — confirmed character-for-character against spec, including the typographic apostrophe (`'`) and em dash (`—`).
- `src/views/ServiceEditorView.vue:1829` — reorder variant `"Couldn't save this order — reverted. Try dragging again."` — verbatim match.
- `src/components/ToastHost.vue:18` — `<span class="font-medium">Save failed.</span> {{ toast.message }}` matches spec exactly; dismiss button `aria-label="Dismiss"` and `×` glyph match.
- No generic labels (`Submit`, `Click Here`, `OK`) introduced in any of the audited files.

### Pillar 2: Visuals (4/4)
- `SaveStatusIndicator.vue` and `ToastHost.vue` are both structurally identical to the spec's literal HTML blocks — same element order, same conditional branches, same SVG path data.
- Icon-free status indicator (text carries the meaning, per spec's stated rationale for `aria-live` announcement quality) — confirmed no icon markup added.
- Toast warning icon present with `aria-hidden="true"` (`ToastHost.vue:14`), correctly excluded from the accessibility tree while still visually signaling severity via the red palette.
- Visual hierarchy in the toast: bold lead (`font-medium`) vs. regular body — matches 31-UI-SPEC's established lock-banner pattern, so the app now has one consistent "lead + body" idiom across both floating alerts.

### Pillar 3: Color (4/4)
- Pending/saving: `text-gray-400` — matches declared muted-gray idiom.
- Saved: `text-green-400` — matches.
- Error (inline): `text-red-400`; toast: `bg-red-950 border-red-800 text-red-400` — exact triple match, reused from `LoginView.vue:77` per spec's own citation.
- No new indigo usage found in either new component (`grep` for `text-primary`/`bg-primary`/indigo confirms this phase adds none — the one existing indigo Save button at `ServiceEditorView.vue:225` is untouched).
- No hardcoded hex/rgb values introduced in `SaveStatusIndicator.vue` or `ToastHost.vue`.

### Pillar 4: Typography (4/4)
- Status text: `text-xs` throughout (`SaveStatusIndicator.vue:3`) — matches declared 12px/regular tier, with `italic` used for pending/saving states matching the spec markup exactly (spec's own snippet has no `leading-4` class explicitly but the size/weight contract is honored).
- Toast: `text-sm` body, `font-medium` lead (`ToastHost.vue:11,18`) — matches declared 14px/500 tier.
- Total distinct sizes across the new/changed markup: 2 (`text-xs`, `text-sm`). Total distinct weights: 2 (regular, `font-medium`). Matches the spec's explicit "exactly 2 sizes, exactly 2 weights" declaration.

### Pillar 5: Spacing (4/4)
- Status bar: `mb-3 flex items-center gap-2 ... px-4 py-2` (`ServiceEditorView.vue:237`) — exact match to spec's literal class string.
- Toast host: `inset-x-4 bottom-4 z-[60] flex flex-col items-stretch gap-2 sm:inset-x-auto sm:right-6 sm:bottom-6 sm:w-full sm:max-w-sm` (`ToastHost.vue:3-4`) — exact match.
- Toast card: `gap-2 rounded-md border border-red-800 bg-red-950 px-4 py-3` (`ToastHost.vue:11`) — exact match, including the declared 12px `py-3`.
- No arbitrary/off-grid spacing (`py-0.5`, `gap-1.5`, `mt-0.5`) found in either new component or in the three editors' modified header rows.

### Pillar 6: Experience Design (3/4)
**What is verified and solid:**
- `useAutoSave.ts` fade timers confirmed removed — `grep` for `savedFadeTimer`/`clearSavedFadeTimer`/`setTimeout(..., 3000)` returns no matches. `'saved'` is genuinely terminal.
- `aria-live="polite" aria-atomic="true"` wraps all four rendered states in one region with no nested second live region (`SaveStatusIndicator.vue:2-16`) — confirmed by direct inspection, matches the accessibility contract precisely.
- Toast: `role="alert"` with no redundant `aria-live="assertive"` (`ToastHost.vue:10`) — confirmed.
- `z-[60]` is unique in the codebase (`grep -rn "z-\[6"` returns only `ToastHost.vue:3`) — the toast genuinely occupies a new top layer above every `z-50` Teleport dialog.
- Sticky status bar (`v-if="canEditService"`) and lock banner (`v-if="authStore.isEditor && isLocked"`) are structurally mutually exclusive by construction — `canEditService = isEditor && !isLocked` — confirmed at `ServiceEditorView.vue:236,274`. They can never both render, so the shared `sticky top-0 z-10` cannot collide.
- Old `status-pending`/`status-saving`/`status-saved` handles are fully retired — `grep` across `src/` returns zero matches; all four surfaces now share `data-testid="save-status"` / `save-status-error`.
- The three CR-01/CR-02/CR-03 concurrency fixes from `32-REVIEW-FIX.md` are present in the shipped code and each has a dedicated regression test verified fail-before/pass-after per the fix report; `handleAutosaveFailure` correctly routes an outstanding error into `lifecycleError` when the service locks (`ServiceEditorView.vue:2005-2009`), so an unresolved error is never silently erased.
- Edge-triggering (toast fires only on `!== 'error' → === 'error'`) confirmed in `saveStatus.ts:42-56` — no spam-on-retry risk.
- Auto-dismiss timer lives in the store, not the component (`toasts.ts:24-29`), so an unmounting surface's toast still self-dismisses cleanly — correctly avoids the leaked-timer failure mode called out as a backstop.

**What could not be confirmed statically (the reason this isn't a 4):**
- E2/E4 `loading` backstop (does switching services/readings/songs mid-load ever show a stale prior record's `Saved h:mm`?) and E4 `partial` backstop (does switching records mid-save misattribute the result?) require either a real browser/interaction test or a targeted unit test walking the actual watcher timing — neither was runnable in this static pass. The spec itself calls E4 `partial` "the sharpest correctness risk in the phase's UI layer," so this is worth flagging even though it is correctly deferred rather than ignored.
- Overflow/wrap backstop (does the 59-char error string wrap rather than clip in `SongLyricEditor`'s tightest header?) needs actual rendered width, which static analysis cannot settle — the honest finding is "no `truncate`/`whitespace-nowrap` class was added," which is consistent with wrapping but not proof of it.
- No dev server was available in this environment, so no screenshot evidence exists for either of the above — both are appropriately left as open items rather than guessed at.

---

## Files Audited
- `src/components/SaveStatusIndicator.vue`
- `src/components/ToastHost.vue`
- `src/components/AppShell.vue`
- `src/views/ServiceEditorView.vue` (status bar, lock banner, `handleAutosaveFailure`, reorder catch, unmount-clear watcher)
- `src/components/CongregationalEditor.vue` (header slot only)
- `src/components/ScriptureSlideEditor.vue` (header slot only)
- `src/components/SongLyricEditor.vue` (header slot, `surfaceId` derivation)
- `src/stores/saveStatus.ts`
- `src/stores/toasts.ts`
- `src/composables/useAutoSave.ts` (fade-timer removal check only)
- `.planning/phases/32-save-reliability-autosave-fix-persistent-status/32-UI-SPEC.md`
- `.planning/phases/32-save-reliability-autosave-fix-persistent-status/32-REVIEW-FIX.md`
