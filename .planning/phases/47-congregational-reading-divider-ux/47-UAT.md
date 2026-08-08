---
status: testing
phase: 47-congregational-reading-divider-ux
source: [47-VERIFICATION.md]
started: 2026-08-08T20:45:00Z
updated: 2026-08-08T20:45:00Z
---

## Current Test

number: 1
name: Touch discoverability of the gap-+ / divider-remove affordance
expected: |
  On a phone-width viewport, the gap-+ and divider-remove controls are visible (persistent
  opacity-40) below the md breakpoint without hovering, reveal fully on hover/focus at md+, and
  have a 44×44px hit area around the visually smaller 24px control — discoverable and tappable on
  a real touch device.
awaiting: user response

## Tests

### 1. Touch discoverability of the gap-+ / divider-remove affordance
expected: Controls are discoverable and tappable on a real touch device / emulated phone width (persistent opacity-40 below md; full reveal on hover/focus at md+; 44×44px hit area). UI-SPEC backstop — not DOM-assertable in jsdom.
result: [pending]

### 2. Hand-dividing feels low-friction on real readings (R095)
expected: Hand-dividing Psalm 136 (refrain) and Psalm 24 (call/response) via gap-+ and the 3-way chip feels natural, not clunky. Interaction-feel judgment (VALIDATION.md Manual-Only).
result: [pending]

### 3. Projected 3-role legibility at projection distance (R097)
expected: Presenting a hand-divided reading, the first slide shows the reference, later slides show only the speaker label, and Leader (sky) / Congregation (amber) / All (violet) read distinctly from a distance. Visual/projection judgment.
result: [pending]

### 4. WR-01/WR-02 logic-change sign-off
expected: Spot-checking real (non-fixture) passages with run-on verses through the Start Blank seed, verse ranges are never over-reported; an intentionally unmatchable-seed condition fires the toast cleanly with no end-user-visible console noise. The fixer flagged both fixes "requires human verification" despite passing regression tests.
result: [pending]
