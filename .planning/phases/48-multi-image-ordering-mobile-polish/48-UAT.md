---
status: passed
status_source: owner-attributed 2026-08-10 (v1.5 milestone close — code deployed to production & in real-world use; owner explicitly accepted these deferred phases as verified)
phase: 48-multi-image-ordering-mobile-polish
source: [48-VERIFICATION.md]
started: 2026-08-09T02:15:00Z
updated: 2026-08-09T02:15:00Z
---

## Current Test

number: 1
name: Real touch-drag reorder correctness on a phone (R099)
expected: |
  On a real touch device, long-press + drag a slide card to reorder it; the card lands where
  dropped with no off-by-one, on both a fresh grid and after a prior reorder. (The existing
  desktop *DraggableIndex/onEnd logic is byte-unchanged; touch options were only appended.)
awaiting: user response

## Tests

### 1. Real touch-drag reorder correctness (R099)
expected: Long-press + drag reorders a slide card correctly on a physical touch device — no off-by-one, on a fresh grid and after a prior reorder. jsdom cannot simulate a real touch gesture.
result: [pending]

### 2. Real-thumb 44px reachability (R099)
expected: The slide-card drag handle and the slide action-menu trigger are comfortably tappable with a thumb on a phone (44px hit area via the asymmetric-padding technique), without the hit area swallowing card-selection taps.
result: [pending]

### 3. Real ~375px layout (R099/R100)
expected: At ~375px width, the Slides tab shows no horizontal overflow (the plan rail stacks above the grid as a horizontal-scroll strip, no longer eating the viewport), and the service edit screen's header action buttons stack vertically (QuarterView recipe). Visual/layout judgment.
result: [pending]

### 4. WR-02 — Print/Share cross-tab availability sign-off (R101)
expected: OWNER DECISION. Print and Share now live in the top contextual action bar on the **Service Order tab only** (previously the page-bottom row made them reachable from every tab). This is a documented, UI-checker-approved design decision that satisfies R101 literally, but it narrows where Print/Share are reachable. Confirm this is acceptable, or request they appear across tabs.
result: [pending]
