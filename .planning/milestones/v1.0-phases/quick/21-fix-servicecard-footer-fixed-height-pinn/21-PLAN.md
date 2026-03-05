---
phase: quick-21
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/components/ServiceCard.vue
  - src/components/__tests__/ServiceCard.test.ts
autonomous: true
requirements: [QUICK-21]
must_haves:
  truths:
    - "All ServiceCards in a grid row have the same height"
    - "The share/print footer is always pinned to the bottom of each card"
    - "The footer has a fixed height regardless of card content length"
    - "Cards with fewer slots still align their footer with cards that have more slots"
  artifacts:
    - path: "src/components/ServiceCard.vue"
      provides: "Flex column layout with flex-grow body and pinned footer"
      contains: "flex flex-col"
  key_links:
    - from: "src/components/ServiceCard.vue"
      to: "ServicesView.vue grid"
      via: "CSS grid + flex column"
      pattern: "flex flex-col"
---

<objective>
Fix ServiceCard so the share/print footer is always pinned to the bottom of the card with a fixed height, and all cards in a CSS grid row align their footers regardless of content length.

Purpose: Cards in the grid currently have different heights and the footer floats up when a card has fewer slots, causing visual misalignment across the row.
Output: ServiceCard.vue with flex column layout ensuring consistent footer positioning.
</objective>

<execution_context>
@C:/Users/Dell/.claude/get-shit-done/workflows/execute-plan.md
@C:/Users/Dell/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@src/components/ServiceCard.vue
@src/components/__tests__/ServiceCard.test.ts

<interfaces>
<!-- ServiceCard is rendered inside a CSS grid in ServicesView.vue -->
<!-- The grid uses: class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3" -->
<!-- CSS grid already makes all items in a row equal height — the fix is making the card's internal layout use flex-col so the footer pins to the bottom of that equal-height container -->

Current ServiceCard root div (line 2):
```html
<div class="rounded-lg bg-gray-900 border border-gray-800 hover:bg-gray-800/50 transition-colors cursor-pointer overflow-hidden">
```

Current structure:
- Root div (no flex)
  - router-link (card body, block)
  - div (action footer with share/print buttons)
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Apply flex-col layout to ServiceCard for pinned footer</name>
  <files>src/components/ServiceCard.vue</files>
  <action>
Modify ServiceCard.vue template with these specific changes:

1. Root div (line 2): Add `flex flex-col h-full` to existing classes. The `h-full` ensures the card stretches to fill the grid cell height, and `flex flex-col` enables vertical flex layout.

   Change from:
   `class="rounded-lg bg-gray-900 border border-gray-800 hover:bg-gray-800/50 transition-colors cursor-pointer overflow-hidden"`
   To:
   `class="flex flex-col h-full rounded-lg bg-gray-900 border border-gray-800 hover:bg-gray-800/50 transition-colors cursor-pointer overflow-hidden"`

2. Router-link (line 4): Add `flex-1 min-h-0` to existing classes. `flex-1` makes the body grow to fill available space, pushing the footer to the bottom. `min-h-0` prevents flex overflow issues.

   Change from:
   `class="block px-3 py-2.5"`
   To:
   `class="block flex-1 min-h-0 px-3 py-2.5"`

3. Footer div (line 39): Add `shrink-0` to existing classes. This prevents the footer from shrinking when content is tall, ensuring fixed height.

   Change from:
   `class="flex items-center justify-end gap-1 px-3 py-1.5 border-t border-gray-800/50"`
   To:
   `class="shrink-0 flex items-center justify-end gap-1 px-3 py-1.5 border-t border-gray-800/50"`

No other changes needed. Do NOT modify script or any logic — this is a CSS-only fix.
  </action>
  <verify>
    <automated>cd C:/projects/worshipplanner && npx vitest run src/components/__tests__/ServiceCard.test.ts --reporter=verbose 2>&1 | tail -20</automated>
  </verify>
  <done>ServiceCard root has `flex flex-col h-full`, router-link body has `flex-1 min-h-0`, footer has `shrink-0`. All existing tests pass. Cards in the grid will now have equal heights with footers pinned to the bottom.</done>
</task>

<task type="auto">
  <name>Task 2: Add test verifying flex layout structure</name>
  <files>src/components/__tests__/ServiceCard.test.ts</files>
  <action>
Add a new test to the existing ServiceCard test suite that verifies the flex column layout classes are present:

```typescript
it('uses flex-col layout with pinned footer', () => {
  const wrapper = mount(ServiceCard, {
    props: { service: mockService },
    global: { stubs: globalStubs },
  })
  // Root element uses flex column layout
  const root = wrapper.element as HTMLElement
  expect(root.className).toContain('flex')
  expect(root.className).toContain('flex-col')
  expect(root.className).toContain('h-full')

  // Body area grows to fill space
  const body = wrapper.find('a')
  expect(body.classes()).toContain('flex-1')

  // Footer does not shrink
  const footer = wrapper.find('[title="Share"]').element.closest('div')!
  expect(footer.className).toContain('shrink-0')
})
```

Append this test inside the existing `describe('ServiceCard', ...)` block, after the last existing test.
  </action>
  <verify>
    <automated>cd C:/projects/worshipplanner && npx vitest run src/components/__tests__/ServiceCard.test.ts --reporter=verbose 2>&1 | tail -20</automated>
  </verify>
  <done>New test "uses flex-col layout with pinned footer" passes, confirming the flex layout structure is correct.</done>
</task>

</tasks>

<verification>
- All existing ServiceCard tests pass (no regressions)
- New flex layout test passes
- Visual: cards in grid rows should now align footers at the bottom
</verification>

<success_criteria>
- ServiceCard root div has `flex flex-col h-full` classes
- Router-link body has `flex-1 min-h-0` classes
- Footer div has `shrink-0` class
- All tests pass including new layout structure test
</success_criteria>

<output>
After completion, create `.planning/quick/21-fix-servicecard-footer-fixed-height-pinn/21-SUMMARY.md`
</output>
