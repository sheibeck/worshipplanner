# Phase 71 — UI Review

**Audited:** 2026-08-20
**Baseline:** 71-UI-SPEC.md (extends 70-UI-SPEC.md tokens)
**Screenshots:** not captured — no dev server running; audit performed on markup/classes vs SPEC + `NewServiceDialog.vue`/`SettingsView.vue` precedent (no live render)

---

## Pillar Scores

| Pillar | Score | Key Finding |
|--------|-------|-------------|
| 1. Design-system consistency | 4/4 | Dialog shell is a byte-for-byte structural copy of `NewServiceDialog.vue`'s Teleport/backdrop/panel pattern; no ad-hoc styles found |
| 2. States | 3/4 | All spec'd states implemented correctly, but one unhandled edge case: `wouldDeleteCount === 0 && referencesComplete === false` renders the hard-blocked Confirm in red instead of the spec's count-driven indigo/red rule |
| 3. Hierarchy & layout | 4/4 | Danger framing, count prominence in body copy, and Cancel/Confirm placement all match spec and `NewServiceDialog.vue` |
| 4. Copywriting | 4/4 | Every string (title, body count/zero variants, warning, button labels, error copy) matches the SPEC's Copywriting Contract table verbatim |
| 5. Accessibility | 3/4 | Focus trap, Escape-as-cancel, aria-labelledby/describedby, safe default focus all present; but the header close (X) button precedent from `NewServiceDialog.vue` is absent here with no replacement, and the hard-blocked button gives no `aria-disabled`/`title` explaining why (relies solely on adjacent visible text, which is spec-compliant but a missed accessibility strengthening opportunity) |
| 6. Responsiveness | 3/4 | `max-w-md p-4` matches `NewServiceDialog.vue`'s mobile reflow pattern exactly (not independently verified live) — no code diverges from the proven precedent, but this pillar can't be scored 4/4 without a live viewport check |

**Overall: 21/24**

---

## Top 3 Priority Fixes

1. **Blocked-Confirm color ignores the count=0 case** — `CleanupEnableConfirmDialog.vue:78-85` hardcodes `bg-red-600` for the `isBlocked` branch regardless of `wouldDeleteCount`. If a backgrounds preview ever returns `wouldDeleteCount: 0` AND `referencesComplete: false` simultaneously (plausible: zero *currently known* candidates, but detection is still incomplete), the button shows red/destructive framing for a scenario the SPEC's Resolved Design Decision 3 says should read as non-destructive. Concrete fix: gate the blocked button's fill the same way `isDestructive` gates the live Confirm — `isDestructive ? 'bg-red-600' : 'bg-indigo-600'` combined with `opacity-60 cursor-not-allowed`, or simply always render blocked as neutral/red since it's non-actionable anyway (either resolution is defensible, but pick one on purpose rather than leaving red as an accidental default).

2. **No live viewport verification of mobile reflow** — `CleanupEnableConfirmDialog.vue` was audited only against `NewServiceDialog.vue`'s classes (`w-full max-w-md ... p-4` wrapper), never rendered at a 375px width. Low risk given the structural copy, but the SPEC explicitly calls for "reflows like NewServiceDialog" as a checkable claim — this hasn't actually been checked. Fix: run a quick Playwright/dev-server screenshot pass at 375×812 the next time the dev server is up, to close this out with evidence rather than inference.

3. **Hard-blocked Confirm has no explicit accessible-name reinforcement for the block reason** — `CleanupEnableConfirmDialog.vue:78-85` renders `<button disabled>Enable</button>` with no `aria-disabled="true"` (redundant with native `disabled` but some AT/testing tooling still checks for it) and no `title`/`aria-describedby` tying the button itself to the warning block above it (the warning and button are sibling elements in the same `space-y-3`/footer flow, connected only by DOM proximity, not an explicit ARIA relationship). SPEC does not require this, so this is not a spec violation — but it is a real screen-reader-navigation gap: a user who tabs directly to (or is announced) the disabled Confirm button gets "Enable, dimmed" with no indication *why*, unless they've already read the preceding paragraph in document order. Fix: add `:aria-describedby="isBlocked ? warningId : undefined"` on the blocked button variant.

---

## Detailed Findings

### Pillar 1: Design-system consistency (4/4)
- `CleanupEnableConfirmDialog.vue:2-42` reproduces `NewServiceDialog.vue:2-33`'s Teleport + backdrop `Transition` + panel `Transition` structure line-for-line, including identical duration/easing classes and identical panel classes (`w-full max-w-md bg-gray-900 rounded-xl border border-gray-800 shadow-2xl flex flex-col`).
- Dark-theme tokens throughout: `bg-gray-900`, `border-gray-800`, `text-gray-100/300`, all consistent with `70-UI-SPEC.md`'s declared palette (verified against `CleanupConfigCard.vue:2` card shell `bg-gray-900 border border-gray-800`).
- No hex literals or arbitrary `[...]` Tailwind values found in either file — spacing/color all comes from the declared token set.
- One deliberate, spec-sanctioned structural difference from `NewServiceDialog.vue`: no header close (X) button. `NewServiceDialog.vue:36-48` has a header row with title + X-close button; `CleanupEnableConfirmDialog.vue:43-47` has title only, no border-b/header split into its own row with a close affordance. Not a SPEC deviation (SPEC's ASCII mock at line 69-81 shows no close X), but worth flagging as a system inconsistency: this is the first dialog in the app without a close-X, and a user's learned "click X to dismiss" habit from every other modal won't work here (Escape/backdrop-click/Cancel still work, so it's not a functional gap — see Pillar 6).

### Pillar 2: States (3/4)
- Per-row state machine (`idle`/`previewing`/`preview-error`) matches SPEC table exactly — `CleanupConfigCard.vue:281-304` `onEnableClick`.
- Disable sub-state machine (`idle`/`disabling`/`disable-error`) matches — `CleanupConfigCard.vue:334-350`.
- Dialog `confirm-shown`/`enabling`/write-failure states match — `CleanupEnableConfirmDialog.vue:90` disables Confirm while `confirming`, Cancel also disabled at line 72 (`:disabled="confirming"`), matching SPEC's "Cancel also disabled (prevents closing mid-write)" requirement.
- Zero-count variant correctly branches body copy (`CleanupEnableConfirmDialog.vue:154-159`) and Confirm color (`isDestructive` computed at line 150, gates `bg-red-600` vs `bg-indigo-600` at line 93).
- **Gap:** the `isBlocked` branch (lines 78-85) does not participate in the `isDestructive` color gate at all — it's unconditionally `bg-red-600`. This is the count=0-and-blocked edge case flagged in priority fix #1. Not exercised by the SPEC's own examples (which pair the warning only with implicit count>0 scenarios), but the data contract (`referencesComplete?: boolean` is independent of `wouldDeleteCount`) allows the combination, and the component's own `isDestructive`/`isBlocked` computeds are structured as if independent.

### Pillar 3: Hierarchy & layout (4/4)
- Confirm dialog's danger framing: body copy leads with the permanent-delete sentence before any warning block (`CleanupEnableConfirmDialog.vue:51-53` then conditional warning at 55-62) — matches SPEC's stacking order.
- Blast-radius count is inline in the primary sentence, not a separate stat/badge — matches SPEC's copy contract exactly (no visual over-engineering beyond what's specified).
- Button placement: Cancel then destructive Confirm, right-aligned footer (`justify-end gap-2`, `CleanupEnableConfirmDialog.vue:68`) — matches `NewServiceDialog.vue`'s own Cancel-then-primary footer convention and general safe-action-on-left convention.
- Row-level layout (`CleanupConfigCard.vue:15-44`): checkbox+label left, action button right, `justify-between` — clean single hierarchy level, no competing visual weight.

### Pillar 4: Copywriting (4/4)
Verified line-by-line against SPEC's Copywriting Contract table:
- Row idle labels ("Enable"/"Disable") — `CleanupConfigCard.vue:33,42` — match.
- "Checking…"/"Disabling…" — match.
- Preview-error `"Couldn't check what would be deleted. Please try again."` — `CleanupConfigCard.vue:300` — matches verbatim.
- Disable-error `"Failed to save. Please try again."` — `CleanupConfigCard.vue:194` (shared with retention fields, per SPEC's "identical to every existing save-error line") and `:346` — matches.
- Success flashes "Saved!"/"Enabled!" — `:340`/`:315` — match.
- Dialog title `Enable {typeLabel}?` — `CleanupEnableConfirmDialog.vue:45` — matches.
- Body count>0 sentence and count=0 sentence — `:156`/`:158` — both match SPEC verbatim, including "This cannot be undone."
- Warning copy — `:59-61` — matches verbatim including the closing "so a song-linked background can never be deleted" clause.
- Write-failure `"Failed to enable. Please try again."` — `CleanupConfigCard.vue:321` — matches.
- Shared card note — `CleanupConfigCard.vue:57-58` — matches verbatim, correctly replacing Phase 70's placeholder.

No generic ("Submit"/"OK"/"Click Here") or unresolved TBD copy found anywhere in either file.

### Pillar 5: Accessibility (3/4)
- Focus trap: hand-rolled, correctly implemented — `onKeydown` (`CleanupEnableConfirmDialog.vue:187-216`) cycles between exactly the focusable set (`Cancel`-only when blocked, `Cancel`+`Confirm` otherwise), matching SPEC's described trap semantics.
- Escape → Cancel, never Confirm — `:188-192` — matches.
- Default focus on open lands on Cancel — `watch` block `:164-173` — matches SPEC's explicit safe-default requirement.
- `role="dialog"` `aria-modal="true"` `aria-labelledby`/`aria-describedby` wired to real title/body ids via `useId()` — `:35-38`, `:141-143` — matches.
- Destructive action marked both visually (red) and textually (body copy states "permanently delete... cannot be undone" directly above the button) — matches SPEC's "never color alone" requirement.
- Warning block is glyph + full sentence, not color-only — `:59-61` — matches.
- Focus ring `focus:ring-1 focus:ring-indigo-500` present on all three buttons — matches app-wide convention.
- **Gap:** blocked Confirm button (`:78-85`) has no `aria-describedby` link to the warning paragraph — a screen-reader user tabbing to (or focus-trapped onto) the disabled button in isolation has no programmatic tie to *why* it's disabled, only reliance on prior linear reading. Not a SPEC requirement, but a real gap relative to the app's stated accessibility posture ("never color alone as the only signal") — the equivalent principle (never rely on visual/positional-only cues) arguably extends to this case too.
- Missing header close-X (present in `NewServiceDialog.vue`, absent here) is a minor consistency note, not an a11y regression, since Escape/backdrop-click/Cancel all remain functional keyboard/mouse paths.

### Pillar 6: Responsiveness (3/4)
- `fixed inset-0 z-50 flex items-center justify-center p-4` wrapper (`:30`) and `w-full max-w-md` panel (`:39`) are identical to `NewServiceDialog.vue`'s proven mobile-safe pattern — code-level equivalence gives high confidence this reflows correctly.
- Dark-mode is canonical throughout (`bg-gray-900`/`bg-gray-950`-family tokens), consistent with `70-UI-SPEC.md`.
- Score held at 3/4 rather than 4/4 purely because no dev server was running to capture the mobile/tablet screenshots called for in this audit's method — this is an audit-completeness gap, not a code defect. Recommend closing with a live 375px capture next dev-server session.

---

## Registry Safety

`components.json` absent — shadcn not initialized in this project. Registry audit not applicable (per both 70-UI-SPEC.md and 71-UI-SPEC.md, which explicitly declare no component library / no shadcn for this phase).

---

## Files Audited

- `.planning/phases/71-cleanup-deletion-toggle-safety/71-UI-SPEC.md`
- `.planning/phases/71-cleanup-deletion-toggle-safety/71-CONTEXT.md`
- `.planning/phases/70-admin-console-ui/70-UI-SPEC.md` (referenced for token continuity, not separately re-audited)
- `src/components/admin/CleanupEnableConfirmDialog.vue`
- `src/components/admin/CleanupConfigCard.vue`
- `src/components/NewServiceDialog.vue` (comparison baseline, header section)
