---
phase: quick-17
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/components/ServicePrintLayout.vue
  - src/views/ShareView.vue
  - src/components/ServiceCard.vue
autonomous: true
requirements: [QUICK-17]

must_haves:
  truths:
    - "Progression line does not appear in the printed service header"
    - "Progression line does not appear in the shared service view header"
    - "ServiceCard shows 'Special Service: {name}' badge when service.name is set"
  artifacts:
    - path: src/components/ServicePrintLayout.vue
      provides: "Print layout without progression"
    - path: src/views/ShareView.vue
      provides: "Share view without progression"
    - path: src/components/ServiceCard.vue
      provides: "Special service badge display"
  key_links:
    - from: src/components/ServiceCard.vue
      to: "service.name"
      via: "v-if guard on special service badge"
      pattern: "service\\.name"
---

<objective>
Three targeted UI fixes:
1. Remove the "Progression:" line from ServicePrintLayout's header section.
2. Remove the progression segment from ShareView's header subtitle line.
3. Display a "Special Service: {name}" badge in ServiceCard when service.name is set, replacing the current plain-text name line.

Purpose: Progression is an internal planning detail — not useful to printed or shared output. The special service label needs visual distinction matching the badge pattern used elsewhere in the card.
Output: Updated ServicePrintLayout.vue, ShareView.vue, ServiceCard.vue
</objective>

<execution_context>
@C:/Users/Dell/.claude/get-shit-done/workflows/execute-plan.md
@C:/Users/Dell/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Remove progression from print and share headers</name>
  <files>src/components/ServicePrintLayout.vue, src/views/ShareView.vue</files>
  <action>
    In ServicePrintLayout.vue: Delete line 12 entirely:
    `<p class="text-xs text-gray-600">Progression: {{ props.service.progression }}</p>`
    The teams line above it (line 10-11) stays.

    In ShareView.vue: Change line 22 from:
    `<p class="text-sm text-gray-600 mt-1">{{ teamsDisplay }} &middot; {{ serviceSnapshot.progression }}</p>`
    to:
    `<p class="text-sm text-gray-600 mt-1">{{ teamsDisplay }}</p>`
    Remove the middot and progression interpolation entirely.
  </action>
  <verify>
    npm run build -- --emptyOutDir 2>&1 | tail -5
    Confirm no TypeScript errors. Visually: the progression value (e.g. "1-2-2-3") must not appear in either output view.
  </verify>
  <done>Neither ServicePrintLayout nor ShareView renders the progression string anywhere in the header.</done>
</task>

<task type="auto">
  <name>Task 2: Special Service badge in ServiceCard</name>
  <files>src/components/ServiceCard.vue</files>
  <action>
    Replace the current plain-text service name display (line 21):
    ```html
    <p v-if="service.name" class="text-xs font-medium text-indigo-300 mb-1.5 truncate">{{ service.name }}</p>
    ```
    with a badge-style element:
    ```html
    <span v-if="service.name" class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-900/40 text-amber-300 border border-amber-800 mb-1.5">Special Service: {{ service.name }}</span>
    ```
    Use a static amber color class — does NOT use dynamic class binding so Tailwind v4 purge safety is maintained (all class strings are literal, not computed). The badge pattern matches the existing `statusClasses` pattern in ServiceCard.
  </action>
  <verify>
    npm run build -- --emptyOutDir 2>&1 | tail -5
    Confirm build succeeds with no errors. Manually verify in ServicesView that a service with name "Good Friday" shows a badge reading "Special Service: Good Friday" and a service without a name shows nothing in that location.
  </verify>
  <done>ServiceCard renders an amber badge "Special Service: {name}" when service.name is non-empty, and renders nothing when service.name is empty.</done>
</task>

</tasks>

<verification>
npm run build -- --emptyOutDir 2>&1 | tail -10
npm run type-check 2>&1 | tail -10
</verification>

<success_criteria>
- Build and type-check pass with zero errors
- Printed service header shows date, name (if set), and teams — no progression
- Shared service header shows date, name (if set), and teams — no progression
- ServiceCard shows amber "Special Service: {name}" badge when service.name is set
- ServiceCard shows nothing in that location when service.name is empty
</success_criteria>

<output>
After completion, create `.planning/quick/17-remove-progression-from-print-share-head/17-SUMMARY.md`
</output>
