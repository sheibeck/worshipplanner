# Phase 72 — UI Review

**Audited:** 2026-08-21
**Baseline:** `.planning/phases/72-owner-console-tabs/72-UI-SPEC.md` (approved design contract)
**Screenshots:** not captured — dev server was reachable at `http://localhost:5173`, but the Playwright
browser binary (`chrome-headless-shell`) is not installed in this environment
(`npx playwright install` required) and installing browsers is out of scope for a retroactive audit run.
Audit is code-only (template/class/string inspection against the spec's literal class recipes). Two
real-browser checks (deep-link-on-refresh, visual active/inactive tab styling) are already correctly
deferred to human UAT per `72-VERIFICATION.md`'s `human_verification` block — this audit does not attempt
to re-adjudicate those, only to confirm the code that would produce them matches the contract.

---

## Pillar Scores

| Pillar | Score | Key Finding |
|--------|-------|-------------|
| 1. Copywriting | 4/4 | Tab labels and placeholder copy are byte-identical to the spec's Copywriting Contract table |
| 2. Visuals | 3/4 | Visual hierarchy and reuse are correct, but the tab strip carries forward a pre-existing accessibility gap (no `role="tablist"`/`aria-selected`) that a fresh implementation should not have re-shipped without at least a note |
| 3. Color | 4/4 | Indigo accent appears in exactly the spec's reserved locations — active-tab underline/label/bg-tint, pre-existing Grant button, focus rings — nowhere else |
| 4. Typography | 4/4 | 3 sizes (`text-xs`/`text-sm`/`text-xl`), 2 weights (`font-medium`/`font-semibold`) — matches spec's stated scale exactly, no unauthorized sizes/weights introduced |
| 5. Spacing | 4/4 | Every spacing class used (`gap-1`, `px-4 py-2`, `mb-3`, `pb-0`, `-mb-px`, `px-6 py-8`, `p-4`) traces to the spec's declared scale; zero arbitrary-value (`[...]`) classes found |
| 6. Experience Design | 4/4 | All pre-existing states (roster loading/empty/error, config-card loading/error, revoke confirm) byte-preserved; new tab-switch/deep-link/no-resubscribe states are unit-tested (13/13); real-browser confirmation correctly routed to human UAT, not silently skipped |

**Overall: 23/24**

---

## Top 3 Priority Fixes

1. **Tab strip has no ARIA tab semantics (`role="tablist"`/`role="tab"`/`aria-selected`)** — screen-reader users get a row of plain buttons with no indication they form a tabbed interface or which one is selected — **not a regression** (the spec explicitly mandates mirroring `ServiceEditorView.vue`'s existing ARIA-less pattern for consistency), but it is inherited debt being actively re-shipped into a second surface. Recommend a follow-up phase (not this one) to retrofit both `ServiceEditorView.vue` and `OwnerConsoleView.vue` tab strips with `role="tablist"`/`role="tab"`/`aria-selected`/`aria-controls` together, so the two patterns don't drift.
2. **No `data-testid` or visible indicator ties the deep-link human-verification gap to a fallback** — if `?tab=organizations` fails to hydrate correctly on a real browser reload (the one thing this audit cannot itself verify without a working Playwright binary), there is no fallback UI (e.g., no error boundary) — low risk given `normalizeTab()` defaults safely to `configuration` on any unrecognized value, but confirm the human-UAT pass explicitly checks a *hard refresh*, not just client-side navigation, since those exercise different Vue Router hydration paths.
3. **Playwright browser binaries are not installed in this environment** — this is an environment/tooling gap, not a code defect, but it means no future `/gsd-ui-review` run in this workspace will produce real screenshots until `npx playwright install` is run once. Recommend running it opportunistically so future phases get actual visual capture instead of code-only audits.

None of these block shipping Phase 72 — this is an advisory, non-blocking audit, and the implementation is a faithful, near-byte-exact realization of its UI-SPEC.

---

## Detailed Findings

### Pillar 1: Copywriting (4/4)
- `src/views/OwnerConsoleView.vue:22,32` — tab labels "Configuration" / "Organizations" match spec's Copywriting Contract table exactly.
- `src/components/admin/OrganizationsTab.vue:3-4` — heading "Organizations" and body "Organization management is coming in this milestone." are character-for-character matches to the spec's `## Component Spec: Organizations Placeholder Pane` code block.
- `src/components/admin/ConfigurationTab.vue:26,29-30,59,64,69,73,77,86` — Grant/Granting.../Granted!, empty-state ("No super-admins yet. Grant one above."), and revoke-confirm ("Revoke {{email}}?" / Confirm / Cancel) copy is carried forward unchanged, as the spec requires ("carried forward unchanged" rows).
- No generic "Submit"/"Click Here"/"OK" labels found in the phase's 3 files.

### Pillar 2: Visuals (3/4)
- Clear focal point: header → tab strip → active pane, standard top-down hierarchy, consistent with `ServiceEditorView.vue`.
- No icon-only buttons in this phase's surface (Grant/Revoke/Confirm/Cancel are all text-labeled) — no aria-label gap there.
- **Finding (WARNING):** `OwnerConsoleView.vue:14-33` — the tab `<button>` pair has no `role="tablist"`/`role="tab"`/`aria-selected` markup. The spec explicitly authorizes this ("No ARIA `role=\"tablist\"`/`role=\"tab\"` pattern is introduced ... this phase mirrors that precedent exactly"), so the implementation is spec-compliant, but it is worth flagging in this audit as an accessibility debt item being duplicated into a second location in the app rather than resolved once. Score reflects the state of the shipped UI, not blame on this phase's execution.
- Active/inactive visual distinction (indigo underline+label+bg-tint vs. muted gray, hover-only on inactive) is implemented exactly per the spec's `## Component Spec: Tab Strip` states table (`OwnerConsoleView.vue:17-19,27-29`).

### Pillar 3: Color (4/4)
- Indigo usage count in the 3 phase files: 4 occurrences — 2 for the active-tab class ternary (`OwnerConsoleView.vue:18,28`), 1 for the pre-existing input focus ring (`ConfigurationTab.vue:17`), 1 for the pre-existing Grant button (`ConfigurationTab.vue:24`). This matches the spec's "Accent reserved for" list exactly — no accent usage anywhere in `OrganizationsTab.vue` (confirmed: zero indigo classes in that file).
- No hardcoded hex/`rgb()` colors found in any of the 3 files (`grep` for `#[0-9a-fA-F]{3,8}|rgb(` returns zero matches) — all colors are Tailwind gray/indigo/red/green utility classes, consistent with the existing dark palette.

### Pillar 4: Typography (4/4)
- Sizes found across the 3 files: `text-xs`, `text-sm`, `text-xl` — exactly 3 distinct sizes, matching the spec's "Only 3 distinct sizes appear in this phase's surface" statement.
- Weights found: `font-medium`, `font-semibold` — exactly 2, matching the spec's "2 weights" statement. No `font-normal`/`font-bold`/other weight utility introduced.
- `h1` (`OwnerConsoleView.vue:6`) is `text-xl font-semibold` per spec's Page heading row; tab labels (`text-sm font-medium`) per spec's Tab label row; section headings (`ConfigurationTab.vue:101`, `OrganizationsTab.vue:3`) are `text-sm font-semibold` per spec's Section heading row.

### Pillar 5: Spacing (4/4)
- Tab strip container: `flex items-center gap-1 mb-3 border-b border-gray-800 pb-0` (`OwnerConsoleView.vue:13`) — byte-identical to the spec's `## Component Spec: Tab Strip` container code block.
- Tab button: `px-4 py-2 text-sm font-medium rounded-t-md transition-colors -mb-px border-b-2` (`OwnerConsoleView.vue:16,26`) — byte-identical to the spec's tab-button code block.
- Page wrapper: `px-6 py-8` (`OwnerConsoleView.vue:3`) — matches spec's `lg`/`xl` tokens (page horizontal/vertical padding).
- Placeholder card: `rounded-lg bg-gray-900 border border-gray-800 p-4` (`OrganizationsTab.vue:2`) — byte-identical to spec's Organizations Placeholder Pane code block.
- No arbitrary-value spacing classes (`grep` for `\[.*px\]|\[.*rem\]`) found in any of the 3 files.

### Pillar 6: Experience Design (4/4)
- Default-state, deep-link, empty-placeholder, and unchanged-state-carryover — all 4 UI Considerations rows from the spec are implemented and unit-tested: `normalizeTab()` defaults absent/unrecognized query to `configuration` (`OwnerConsoleView.vue:59-61`, tested); `?tab=organizations` pre-mount hydration lands on Organizations pane (tested); `OrganizationsTab.vue` has zero data-fetch/loading/error branches per spec (confirmed — empty `<script setup>`); all of `ConfigurationTab.vue`'s pre-existing loading/empty/error/success/destructive-confirm states are present unchanged (roster loading text, empty-state row, grant error/success feedback, revoke inline confirm, config-card loading/error branches).
- The one subtle regression risk this phase introduced — losing the roster/appConfig subscriptions when switching away from the Configuration tab — is explicitly guarded against: both panes use `v-show` (never `v-if`, confirmed by grep), and a dedicated regression test ("does not re-subscribe when switching tabs and back (v-show invariant)") proves `onSnapshot`/`subscribe()` fire exactly once across a tab round-trip. This closes exactly the failure mode a naive `v-if` tab implementation would have introduced.
- Two items are correctly routed to human UAT rather than false-positively marked done: real-browser deep-link+refresh behavior, and visual active/inactive tab-color fidelity. `72-VERIFICATION.md` documents both with specific test steps and honest "why_human" reasoning — this is the correct handling, not a gap being hidden.

---

## Files Audited
- `src/views/OwnerConsoleView.vue`
- `src/components/admin/ConfigurationTab.vue`
- `src/components/admin/OrganizationsTab.vue`
- `src/views/__tests__/OwnerConsoleView.test.ts` (cross-referenced for state-coverage evidence)
- `.planning/phases/72-owner-console-tabs/72-UI-SPEC.md`
- `.planning/phases/72-owner-console-tabs/72-CONTEXT.md`
- `.planning/phases/72-owner-console-tabs/72-VERIFICATION.md`

Registry audit: `components.json` absent (shadcn not initialized in this project) — registry safety audit skipped per the audit's own gating rule.
