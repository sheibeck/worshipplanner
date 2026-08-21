# Phase 74 — UI Review (Retroactive)

**Audited:** 2026-08-21
**Baseline:** `.planning/phases/74-organizations-onboard-assign/74-UI-SPEC.md` (approved design contract)
**Screenshots:** not captured — dev server (localhost:5173) is up, but the Organizations tab lives behind the super-admin-gated `/owner-console` route; live visual capture requires an authenticated super-admin session and is already deferred to human UAT per the v2.0 autonomy grant (per `74-CONTEXT.md`). This is a code-only structural audit against the UI-SPEC's markup, class recipes, and state matrix.
**Advisory:** non-blocking per orchestrator instruction.

---

## Pillar Scores

| Pillar | Score | Key Finding |
|--------|-------|-------------|
| 1. Copywriting | 4/4 | Every string (labels, placeholders, CTA idle/submitting/success, all error/empty/loading copy) matches the contract verbatim. |
| 2. Visuals | 3/4 | Structure/hierarchy matches spec exactly, but all four text inputs (church name, admin email, assign email) rely on placeholder-only labeling with no `<label>`/`aria-label` — an accessibility gap inherited from the reused pattern, not introduced fresh, but still a real defect for screen-reader users. |
| 3. Color | 4/4 | Indigo accent appears only on the Onboard button, Assign trigger/confirm, and the three focus rings — exactly the "reserved for" list; no accent leakage onto table body text/dates/counts; red/green scoped to error/success text only, no destructive control exists. |
| 4. Typography | 4/4 | Exactly the 3 sizes (`text-sm`/`text-xs`/implicit default) and 2 weight buckets (`font-semibold`/`font-medium` vs regular) the contract declares; no stray sizes introduced. |
| 5. Spacing | 4/4 | All spacing (`gap-3`, `px-4`/`py-3` cells, `mt-2`/`mt-3`, `w-40`/`px-2 py-1` compact input, `gap-2` inline row) is a verbatim copy of the spec's own code blocks — no drift, no arbitrary values. |
| 6. Experience Design | 3/4 | All 15 declared states (list loading/empty/error/populated/overflow; onboard idle/submitting/error×3/success; assign idle/submitting/error/success) are implemented and correctly wired per-org via keyed dictionaries — but the per-row assign control has two residual-state gaps (see findings) that the top-level onboard form avoids. |

**Overall: 22/24**

---

## Top 3 Priority Fixes

1. **Assign-admin row never auto-closes or clears its input after success** — `onConfirmAssign` (OrganizationsTab.vue:292-324) sets `assignFeedback[orgId]` but never resets `assigningOrgId` or `assignEmail`, unlike the top-level onboard flow which clears its inputs and auto-dismisses the success flash after 2s (line 261-269). User impact: after successfully assigning an admin, the row stays pinned open in edit mode with the just-submitted email still sitting in the input, and the "Added as admin." message never goes away until the admin manually clicks "Cancel assign." A super-admin working through several orgs in sequence will see multiple rows stuck open with stale success text. Fix: after success, either call `cancelAssign()`-equivalent logic (close the row) or clear `assignEmail.value = ''` and apply the same `setTimeout(... 2000)` pattern used for `onboardedFeedback` to auto-clear `assignFeedback[orgId]`.

2. **Placeholder-only form inputs have no accessible label** — all four text inputs (`churchName`, `adminEmail` in the onboard form; `assignEmail` per row) rely solely on `placeholder` text with no `<label>`, `aria-label`, or `aria-labelledby` (OrganizationsTab.vue:7-19, 61-67). This is inherited verbatim from `ConfigurationTab.vue`'s existing grant form, so it is pre-existing console debt rather than a regression introduced this phase — but it is a real screen-reader/accessibility defect on a form a super-admin uses to grant privileged access. Fix (console-wide, not scoped to this phase alone): add `aria-label="Church name"` / `aria-label="First admin email"` / `aria-label="Admin email"` to the three inputs at minimum, since placeholders disappear once a value is typed and are not reliably announced by all assistive tech.

3. **Re-opening "Assign admin" on a row that previously errored does not require the user to see the old error clear visually until re-triggered** — `startAssign` (line 280-285) does correctly `delete assignError.value[orgId]` and `delete assignFeedback.value[orgId]` when reopening, so this is *handled* functionally, but the same courtesy is not extended after a successful assign — see Fix #1, which is the concrete manifestation of this gap. (Folded into #1; listed separately here only because the underlying pattern — "top-level form resets itself, per-row form doesn't" — is the root cause worth calling out once at the component-design level for any future per-row control added to this tab.)

---

## Detailed Findings

### Pillar 1: Copywriting (4/4)
- Onboard button states: `'Onboarding...' : onboardedFeedback ? 'Onboarded!' : 'Onboard church'` — matches contract exactly (line 26).
- Success feedback string: `Onboarded {{ onboardedFeedback.name }} — admin {{ onboardedFeedback.status }}.` where `status` is `'added'`/`'invited'` taken verbatim from the callable (lines 30-32, 260) — matches contract's "status string comes directly from the callable" requirement.
- `friendlyCallableError` (lines 197-210) correctly special-cases `already-exists` → "That church name is taken." (R201), falls through to the generic "Something went wrong. Please try again." — matches contract.
- Client-side validation message "Enter a church name and a valid admin email address." (line 249) and assign-row "Enter a valid email address." (line 302) match contract verbatim.
- List states: "Loading organizations..." (line 36), "No organizations yet. Onboard one above." (line 103), "Couldn't load organizations. Refresh the page and try again." (line 112, note the escaped apostrophe renders correctly as a curly-free straight quote matching spec) — all verbatim.
- Table headers "Church"/"Org ID"/"Created"/"Members"/"Actions" (lines 45-49) — verbatim.
- Assign-row copy: "Assign admin" (line 94), "Assigning..."/"Assign" (line 74), "Cancel assign" (line 81), "Added as admin."/"No account yet — invited as admin." (line 315) — all verbatim, including the action-scoped "Cancel assign" (not a bare "Cancel") the contract explicitly called out.
- No generic "Submit"/"OK"/"Click Here" patterns found anywhere in the file.

### Pillar 2: Visuals (3/4)
- Visual hierarchy matches spec: onboard form sits first in DOM/visual order (primary), table below is secondary/scannable, per-row assign control is tertiary and only rendered on demand via `v-if="assigningOrgId === org.orgId"` — correct focal-point ordering.
- No icon-only buttons exist (text-only per spec — "no icons" requirement met), so the icon+aria-label pairing rule is moot here.
- **Defect:** four text inputs across the surface have no programmatic label — `churchName`/`adminEmail` (lines 7-19) and `assignEmail` (lines 61-67) rely on `placeholder` alone. This is a real (if inherited) accessibility gap; not scored as a blocker because it's faithful reuse of an existing, already-shipped pattern rather than new regression, but it's a legitimate finding a fresh audit should surface rather than wave through.
- Hover affordance present on table rows (`hover:bg-gray-800/20`, line 53) and on all interactive text controls (`hover:text-indigo-200`/`hover:text-gray-200`) — good micro-interaction coverage.

### Pillar 3: Color (4/4)
- Accent (indigo) usage count: `bg-indigo-600`/`hover:bg-indigo-500` (Onboard button, line 24), `text-indigo-300`/`hover:text-indigo-200` (Assign confirm, line 72; Assign trigger, line 92), `focus:ring-indigo-500` ×3 (lines 11, 17, 65) — exactly matches the contract's "reserved for: Onboard button, Assign-admin trigger + confirm, focus rings" list. No accent on table body text, org id, dates, member counts, or placeholder text.
- Destructive red (`text-red-400`) appears only on error text (lines 29, 84, 111) — never on a clickable control, matching the contract's "no destructive action exists this phase" constraint.
- Success green (`text-green-400`) appears only on success feedback text (lines 30, 85) — matches contract.
- No hardcoded hex/rgb colors found in the file — 100% Tailwind token usage.

### Pillar 4: Typography (4/4)
- Section heading: `text-sm font-semibold` (line 3) — matches "14px / 600" spec row.
- Table header labels: `text-xs font-medium uppercase tracking-wider` (lines 45-49) — matches "12px / 500 / uppercase, tracked" spec row.
- Body/table cells and form inputs: `text-sm` (multiple), regular weight (no font-weight class = 400 default) — matches "14px / 400" spec row.
- Compact inline controls (assign row buttons, org-id cell): `text-xs` (lines 55, 65, 72, 79, 84-85, 90) — matches "12px / 400" spec row.
- Total distinct sizes in file: `text-sm`, `text-xs` (2, well within any reasonable ceiling) plus the un-classed `h2`/`p` defaults accounted for by the contract's explicit 3-size table. Total weight buckets: `font-semibold`, `font-medium`, implicit regular = the declared 2-bucket (regular/emphasis) contract. No drift.

### Pillar 5: Spacing (4/4)
- Onboard form row: `flex flex-col sm:flex-row gap-3` (line 6) — 12px gap, a clean 4px multiple; copied verbatim from the spec's own component-spec code block (spec line 181), so no deviation from contract even though the spacing-scale table's "sm" token example (`gap-2`) doesn't literally appear here — the contract's own worked example uses `gap-3`, and the implementation matches that worked example exactly.
- Card shell: `p-4` (line 2), `mb-3` (line 3), `mt-4` (line 40 wrapper — matches spec's "spacing between form and table below it") — all match declared `md` token (16px family).
- Table cells: `px-4 py-3` uniformly (lines 45-97) — matches declared `md`/`sm` combination from spec's worked table example.
- Assign-row compact input: `px-2 py-1 w-40` (line 65) — matches the spec's explicitly-called-out exception verbatim.
- Feedback text margins: `mt-2` (onboard, lines 29-30), `mt-3` (list error, line 111), `mt-1` (assign row, lines 84-85) — all match the spec's per-context margin choices (`mt-2` top-level form vs `mt-1` compact inline row).
- No arbitrary bracket values (`[...px]`/`[...rem]`) found anywhere in the file.

### Pillar 6: Experience Design (3/4)
- **List states:** loading (`!loaded`, line 35), populated (`v-else`, table renders per-org rows, line 53), empty (`orgs.length === 0` row, line 101), error (`listError`, line 111) — all four covered, matching spec's state matrix. `refreshOrgs()` correctly sets `loaded.value = true` in a `finally` block (line 230) so the loading state always resolves even on error — good defensive coverage.
- **Onboard form states:** idle (default), submitting (`isOnboarding`, button disabled + "Onboarding...", line 23/26), success (`onboardedFeedback`, auto-clears after 2s via `setTimeout`, lines 267-269), and three distinct error paths (name-taken via `already-exists` code match, invalid-input via client validation, generic via fallback) — all covered with correct disambiguation logic (`friendlyCallableError`, lines 197-210).
- **Double-submit guard:** both `onOnboard` (line 242, `if (isOnboarding.value) return`) and `onConfirmAssign` (line 295) explicitly guard against the Enter-key handler firing while a submission is already in flight — a defect (WR-03) the implementation notes it fixed proactively; good state-machine discipline beyond the bare spec text.
- **Assign-admin states:** idle/trigger (line 88-96), open/editing (`assigningOrgId === org.orgId`, line 59), submitting (`isAssigning`, "Assigning...", disabled, line 71/74), success (`assignFeedback[orgId]`, line 85), error (`assignError[orgId]`, line 84) — all five covered and correctly keyed per-`orgId` so one row's feedback never leaks into another's (verified: `assignError`/`assignFeedback` are `Record<string, string>` keyed maps, not shared scalars).
- **Defect (see Priority Fix #1):** unlike the onboard form, the assign-row success path does not reset `assigningOrgId`/`assignEmail` or auto-clear `assignFeedback[orgId]` — the row remains open indefinitely post-success with the submitted email still populating the input. This is a real state-hygiene gap between the two forms in the same component, not called out or required by the UI-SPEC's own code block (the spec's Assign-Admin component spec also omits a reset-on-success step), so it is as much a contract gap as an implementation gap — but it degrades the actual admin's workflow when processing multiple orgs in one sitting.
- **Refetch behavior:** `refreshOrgs()` is correctly re-invoked after both successful onboard (line 263) and successful assign (line 317), keeping member counts/rows current per the spec's "one-shot, not realtime" refetch requirement.

---

## Registry Safety

Registry audit: not applicable. `components.json` is absent (project confirmed: no shadcn, no third-party registries) — this phase introduces zero new external components, per both the UI-SPEC's "Registry Safety" table and direct inspection of `OrganizationsTab.vue` (only `vue`/`firebase/functions`/local `@/firebase` imports, no registry-sourced code).

---

## Files Audited

- `src/components/admin/OrganizationsTab.vue` (full file, 332 lines)
- `.planning/phases/74-organizations-onboard-assign/74-UI-SPEC.md` (baseline contract)
- `.planning/phases/74-organizations-onboard-assign/74-CONTEXT.md` (scope/decisions reference)
