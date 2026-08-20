# Phase 70 — UI Review

**Audited:** 2026-08-20
**Baseline:** `70-UI-SPEC.md` (design contract), cross-checked against `src/views/SettingsView.vue` precedent
**Screenshots:** not captured — this view sits behind Firebase Auth + super-admin custom claim behind the
emulator; no dev server was probed for this advisory pass. Audit is code-only (markup/class comparison).

---

## Pillar Scores

| Pillar | Score | Key Finding |
|--------|-------|-------------|
| 1. Copywriting | 4/4 | Every string (loading/error/read-only note/warning/save-error) is a verbatim match to the contract. |
| 2. Visuals | 4/4 | Card shell, header, intro-paragraph, grouping order all match `SettingsView.vue` exactly; no ad-hoc styles. |
| 3. Color | 3/4 | Palette and 60/30/10 scope are correct, but `text-yellow-500` lives in the *generic* `ConfigTextField.vue`, not gated to the Sender card — scope is enforced by caller convention only, not the component. |
| 4. Typography | 4/4 | Only contract sizes/weights (`text-xs`/`text-sm`/`font-semibold`/`font-medium`) appear; no new scale introduced. |
| 5. Spacing | 4/4 | `p-4`, `mb-3`, `space-y-6`, `mt-6`/`pt-6` all match the declared 4/8/12/16/24 scale; no arbitrary `[…px]` values. |
| 6. Experience Design | 2/4 | The `allowedModels` field can be Saved while effectively empty (`","`, `" , "`) — the Save button is NOT disabled for that invalid state, contradicting the contract's core promise that "an owner sees why Save is disabled, not just that it is." |

**Overall: 21/24**

---

## Top 3 Priority Fixes

1. **`allowedModels` "all-blank" input is Saveable, not disabled** (`src/components/admin/AiProxyConfigCard.vue:38-48`, `onSaveAllowedModels` at line 142) — user impact: an owner can type `,,,` or a single trailing comma, click **Save** (button is enabled — `ConfigTextField`'s own dirty/required check only looks at raw trimmed length, not at the parsed model list), and only then see `allowedModelsError` appear post-click, momentarily leaving `aiProxy.allowedModels` un-saved with no visible reason the click "did nothing." Fix: compute the parsed/filtered list reactively (mirroring the `rateLimitPerDayLive`/`fromAddressLive` pattern already used for the other two cross-field checks in this same file) and feed it into `ConfigTextField`'s `:external-error` prop so Save is disabled and the reason is visible before the click, per the contract's own "States & Interactions" §5.

2. **Scoped warning color lives in a reusable component, not the one field it's contracted to** (`src/components/admin/ConfigTextField.vue:24`) — user impact: none today (only `SenderConfigCard.vue` passes a `warning` prop), but the contract is explicit that `text-yellow-500` is "**Only** the non-blocking Resend-domain-unverifiable warning on `sender.fromAddress` ... do not extend to other fields." Because the color lives in the shared field component, any future card wiring a `warning` prop silently inherits amber without a design decision. Fix: either rename/scope the prop (e.g. `senderDomainWarning`) so its purpose is self-documenting, or add a comment at the prop declaration flagging the single-consumer contract so a future add is caught in review.

3. **`appConfig` store's internal `loadError` string doesn't match the copy actually shown** (`src/stores/appConfig.ts:34`: `loadError.value = 'Load error'` vs. the contract's `Couldn't load platform configuration. Refresh the page and try again.` which is hardcoded separately in `OwnerConsoleView.vue:119`) — no current user-facing defect (the view never renders `store.loadError`'s string, only checks its truthiness), but it's a live trap: any future refactor that renders `{{ appConfigStore.loadError }}` directly will silently regress the contracted copy. Fix: set `loadError.value` to the exact contracted string so the store is the single source of truth, or delete the unused string content and use a boolean flag.

---

## Detailed Findings

### Pillar 1: Copywriting (4/4)
- `Loading configuration...` — `OwnerConsoleView.vue:116` — verbatim match.
- `Couldn't load platform configuration. Refresh the page and try again.` — `OwnerConsoleView.vue:119` — verbatim match.
- Cleanup read-only note — `CleanupConfigCard.vue:55-56` — verbatim match, single instance beneath all four toggles (not repeated per-toggle) as specified.
- Resend-domain warning — `SenderConfigCard.vue:135` — verbatim match including punctuation.
- `Failed to save. Please try again.` — repeated identically across `CleanupConfigCard.vue:175`, `AiProxyConfigCard.vue:112/165`, `MessagingConfigCard.vue:88/123`, `SenderConfigCard.vue:89` — matches the one save-error copy in the contract.
- Provenance line — `OwnerConsoleView.vue:110-113` — "Last changed by {{ updatedBy }} at {{ formatStamp(updatedAt) }}" matches the contract's template exactly, correctly gated on `v-if="updatedBy"` (no placeholder for the never-saved state, per R182).
- No blank/empty-state copy needed or introduced — correctly matches the contract's "Not applicable" for empty state.

### Pillar 2: Visuals (4/4)
- Card shell `rounded-lg bg-gray-900 border border-gray-800 p-4 mt-6` reproduced identically across all four cards (`CleanupConfigCard.vue:2`, `AiProxyConfigCard.vue:2`, `MessagingConfigCard.vue:2`, `SenderConfigCard.vue:2`).
- Card header `text-sm font-semibold text-gray-300 mb-3` matches exactly in all four.
- Intro paragraph `text-xs text-gray-400 mb-3` present before fields in every card, matching the "explain before offering the control" rule.
- Field order within each card follows the `AppConfig` declaration order from the contract's Component Inventory table (verified line-by-line against Cleanup, AI Proxy, Messaging, Sender sections).
- Read-only cleanup toggles are visually grouped first, above the retention numbers, separated by `border-t border-gray-800` before the editable block — matches "visually distinct sub-block, grouped together first."
- Deploy-time note reuses the dashed-border/muted-text block verbatim (`OwnerConsoleView.vue:128-135`).

### Pillar 3: Color (3/4)
- Accent (`indigo-600`/`indigo-500`) confirmed scoped to Save buttons, checkbox `checked` fill, and (via the shared input class, not separately audited here) focus rings — no accent bleed onto decorative elements.
- No hardcoded hex/`rgb()` anywhere in `src/components/admin/**` or `src/stores/appConfig.ts` (grep confirmed zero hits).
- `text-red-400` used only for save-errors and inline validation, consistent with contract.
- **Finding (see Fix #2):** `text-yellow-500` (`ConfigTextField.vue:24`) is defined at the shared-component level rather than scoped to the Sender card specifically. Currently only one consumer passes `warning`, so the *actual rendered* 60/30/10 split is correct today — this is a structural/maintainability gap, not a currently-visible violation, hence 3/4 rather than 2/4.

### Pillar 4: Typography (4/4)
- Card headings: `text-sm font-semibold` (14px/600) — matches "Card heading" row.
- Field labels/help text: `text-xs text-gray-400`/`text-gray-500` (12px/400) — matches "Help/label text" row.
- Body/input text and Save button labels: `text-sm` with `font-medium` on buttons only — matches the declared 400/500 split exactly, no new weight introduced.
- No `text-lg`/`text-xl`/`text-2xl`+ or `font-bold`/`font-extrabold` anywhere in the four cards or two field components (grep confirmed).

### Pillar 5: Spacing (4/4)
- `p-4` card padding, `mb-3` header-to-intro gap, `mb-3`/`mt-2` within the cleanup toggle block, `space-y-6` (24px) between fields, `mt-6 pt-6` between the read-only sub-block and the editable numbers — every value maps onto the declared 4/8/12/16/24 scale; no `[…px]`/`[…rem]` arbitrary values found in any of the seven audited files.
- `gap-3` on toggle rows and `gap-2` on the field's input/button row match the `md`/`sm` tokens respectively.

### Pillar 6: Experience Design (2/4)
- Loading/error/loaded-missing/loaded-present states for the section as a whole are all correctly implemented per the contract's State table (`OwnerConsoleView.vue:115-126`, `appConfig.ts` store).
- `(default)` badge correctly uses presence-in-raw-doc (`isExplicitlySet`), not resolved-value equality — matches the contract's precise semantics section exactly (`appConfigDefaults.ts:136-145`).
- Per-field Save/Saving/Saved!/error triad correctly implemented in all four cards, with the `setTimeout(2000)` clear behavior matching the contract everywhere it's used.
- The one editable toggle (`messaging.scheduledCronEnabled`) correctly saves immediately on change and reverts on failure (`MessagingConfigCard.vue:89`), matching the contract's toggle spec precisely.
- Write mechanics correctly use `setDoc(..., { merge: true })`, never `updateDoc` (`appConfig.ts:55-63`) — the contract calls this "the single most load-bearing implementation note"; it is honored.
- Cross-field validation for `aiProxy.rateLimitPerDay >= rateLimitPerMin` and the `sender.fromAddress` format/warning are both correctly wired as *live* (pre-click) validation via the `update:modelValue` live-value pattern.
- **Finding (see Fix #1):** the third and only remaining cross-field-shaped check — `allowedModels` parsing to a non-empty list — was NOT given the same live-validation treatment as the other two. It is the one field in the whole surface where "Save is enabled but doing so may silently fail validation after the click" is possible, directly undercutting the contract's explicit design intent for this exact interaction pattern. This is a real, user-reachable interaction gap, not a cosmetic one — hence 2/4 rather than 3/4.

---

## Registry Safety

Not applicable — `components.json` is absent (`shadcn_initialized: false` per the UI-SPEC frontmatter, confirmed no `components.json` in repo root). Registry audit skipped per the audit's own gate.

---

## Files Audited

- `src/views/OwnerConsoleView.vue`
- `src/components/admin/ConfigNumberField.vue`
- `src/components/admin/ConfigTextField.vue`
- `src/components/admin/CleanupConfigCard.vue`
- `src/components/admin/AiProxyConfigCard.vue`
- `src/components/admin/MessagingConfigCard.vue`
- `src/components/admin/SenderConfigCard.vue`
- `src/stores/appConfig.ts`
- `src/config/appConfigDefaults.ts`
- `src/views/SettingsView.vue` (baseline/precedent comparison)
- `.planning/phases/70-admin-console-ui/70-UI-SPEC.md`
- `.planning/phases/70-admin-console-ui/70-CONTEXT.md`
