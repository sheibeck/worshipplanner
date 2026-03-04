---
phase: quick
plan: 5
type: execute
wave: 1
depends_on: []
files_modified:
  - src/views/ServicesView.vue
autonomous: true
requirements: [QUICK-5]
must_haves:
  truths:
    - "Past services section has month/year select inputs"
    - "Default month is current month if it has past services, otherwise most recent month with services"
    - "Selecting a month/year shows ALL past services from that month (no 5-item limit)"
    - "Expand/collapse toggle still controls visibility of the entire past section"
  artifacts:
    - path: "src/views/ServicesView.vue"
      provides: "Month/year picker UI and smart default logic"
  key_links:
    - from: "month/year selects"
      to: "displayedPastServices computed"
      via: "reactive selectedMonth/selectedYear filter pastServices by month/year"
      pattern: "selectedMonth|selectedYear"
---

<objective>
Replace the "show 5 past services" pattern with a month/year picker that defaults to the current month (falling back to the most recent month with services) and shows ALL services from the selected month/year.

Purpose: Users need to browse past services by month rather than seeing an arbitrary recent-5 list.
Output: Updated ServicesView.vue with month/year picker and smart default logic.
</objective>

<execution_context>
@C:/Users/Dell/.claude/get-shit-done/workflows/execute-plan.md
@C:/Users/Dell/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@src/views/ServicesView.vue
@src/stores/services.ts
</context>

<tasks>

<task type="auto">
  <name>Task 1: Replace past services limit with month/year picker and smart default</name>
  <files>src/views/ServicesView.vue</files>
  <action>
In ServicesView.vue, replace the `displayedPastServices` computed (which slices to 5) with a month/year filtering system:

1. **Add reactive state** for `selectedMonth` (0-11) and `selectedYear` (number). Initialize both to `null`.

2. **Create `availableMonths` computed** that extracts unique month/year pairs from `pastServices`, sorted descending (most recent first). Each entry: `{ month: number, year: number, label: string }` where label is like "March 2026". Use `new Date(s.date)` to parse — service dates are ISO strings like "2026-03-01".

3. **Create `smartDefault` computed** that determines the default month/year:
   - Get current month and year from `new Date()`.
   - Check if `availableMonths` contains current month/year. If yes, use it.
   - Otherwise, use the first entry in `availableMonths` (most recent month with services).
   - Return `{ month, year }` or null if no past services.

4. **Create `activeMonth` / `activeYear` computeds** that return `selectedMonth ?? smartDefault.month` and `selectedYear ?? smartDefault.year` (falling back to smart default when user hasn't explicitly chosen).

5. **Replace `displayedPastServices`** with a computed that filters `pastServices` to only services whose date falls in `activeMonth`/`activeYear`. Show ALL matching services (no slice).

6. **Update the template** inside the past services section (after the expand/collapse button, inside the `v-if="showPast"` block):
   - Add a row with two `<select>` elements before the service grid:
     - **Month select**: options from availableMonths (unique months for selected year). Display month names. Bind to `selectedMonth`.
     - **Year select**: options from unique years in pastServices. Bind to `selectedYear`.
   - When either select changes, reset the other if the combination doesn't exist (e.g., if switching year and selected month has no services, reset month to most recent available in that year).
   - Style selects with dark theme classes consistent with existing UI: `bg-gray-800 border-gray-700 text-gray-200 text-sm rounded-md px-2 py-1 focus:ring-indigo-500 focus:border-indigo-500`.
   - Place selects in a flex row with a small gap, left-aligned, with `mb-3` spacing before the grid.

7. **Update the section header** button text from `Past Services ({{ pastServices.length }})` to `Past Services` (total count is less meaningful with month filtering; the month picker provides context).

8. **Remove** the old `displayedPastServices` 5-item slice computed entirely.

Important: Keep the `showPast` toggle button as the expand/collapse control. The month/year picker appears INSIDE the expanded section (visible only when `showPast` is true). When user changes month/year via selects, set `selectedMonth`/`selectedYear` refs directly via v-model with number conversion.
  </action>
  <verify>
    <automated>cd C:/projects/worshipplanner && npx vue-tsc --noEmit 2>&1 | head -30</automated>
  </verify>
  <done>
    - Past services section has month and year select dropdowns visible when expanded
    - Default selection is current month if it has past services, otherwise most recent month with services
    - All services from selected month/year are displayed (no 5-item cap)
    - Expand/collapse toggle still works to show/hide the entire past section including the picker
    - Type-checks pass with no errors
  </done>
</task>

</tasks>

<verification>
- `npx vue-tsc --noEmit` passes
- `npx vitest run` passes (no regressions)
- Manual: open Services tab, expand past services, see month/year selects defaulting to current or most-recent month, change month and see different services
</verification>

<success_criteria>
Past services section uses month/year picker instead of 5-item limit. Smart default selects current month or falls back to most recent month with data. All services from the selected month are shown.
</success_criteria>

<output>
After completion, create `.planning/quick/5-past-services-month-year-filter-with-sma/5-SUMMARY.md`
</output>
