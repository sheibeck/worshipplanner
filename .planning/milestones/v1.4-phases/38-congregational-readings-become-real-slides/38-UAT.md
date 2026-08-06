---
status: complete
phase: 38-congregational-readings-become-real-slides
source:
  - 38-01-SUMMARY.md
  - 38-02-SUMMARY.md
  - 38-03-SUMMARY.md
  - 38-04-SUMMARY.md
started: 2026-08-05
updated: 2026-08-05
attribution: owner
---

## Current Test

[testing complete]

## How this session was recorded — read before trusting the results

The owner approved this phase in one statement (*"current phase 8 is approved"*, disambiguated to
Phase 38 and confirmed) rather than by walking items 38.1–38.7 one at a time. Every result below is
therefore **owner-attributed**: recorded on the owner's authority, not observed by the assistant and
not derived from an automated run.

This distinction is the whole point of the standing autonomy grant's rule that a deferred check is
never self-approved. It was not self-approved — the owner approved it. But the record should say
which kind of approval it was, because "the owner said yes" and "someone watched the third card stay
deleted after a reload" are different evidence, and only the owner knows which happened here.

The automated half is separately strong and is NOT owner-attributed: 5/5 roadmap success criteria
verified against live source in `38-VERIFICATION.md` (criterion 4 hand-traced through the production
write path, not inferred from tests passing), plus the 15-case multi-tick durability suite in
`src/utils/__tests__/congregationalDetachment.test.ts`.

### ⚠ Two UI changes landed AFTER `38-VERIFICATION.md` was written

Both were owner requests made in the same session, after the verification report and after
`PENDING-VERIFICATION.md` items 38.1–38.7 were drafted. They change what those items describe:

| Change | Commit | Effect on the items above |
|---|---|---|
| Leader/Congregation speaker tags coloured (sky / amber) | `58000e0` | **Supersedes item 38.5's parenthetical.** 38.5 asked the owner to judge whether the two speakers read as distinguishable *"without an indigo/amber accent"* — that premise is now obsolete; there IS a colour accent again. The distinguishability question stands, but against the new sky/amber treatment. |
| 3-dot menu item renamed "Edit scripture text" → "Set up congregational reading" | `d70104c` | **Item 38.1 step 3 names the old label.** The step now reads "open the 3-dot menu and choose *Set up congregational reading*". |

Neither change touches the phase's mechanism — both are copy/colour on surfaces the phase built.
Recorded here so a future reader does not conclude the UAT script and the product disagree.

## Tests

### 1. 38.1 Split a scripture item into congregational sections — one card per section
expected: A scripture item with a reference shows ONE reference-only card; after Fetch Passage + Split, the group shows one card PER SECTION, each naming its own speaker (Leader / Congregation).
result: pass
source: owner-attributed
note: The menu item invoked at step 3 is now labelled "Set up congregational reading" (was "Edit scripture text") — renamed in d70104c after this script was written.

### 2. 38.2 Edit a section's words in isolation
expected: Editing the second card's words in the Edit Slide drawer changes that card and no other.
result: pass
source: owner-attributed

### 3. 38.3 Flip a section's speaker in isolation
expected: Flipping the speaker (Leader ↔ Congregation) on one card changes only that card.
result: pass
source: owner-attributed

### 4. 38.4 ★ Delete one section and confirm it survives a reload
expected: Deleting the third card and reloading leaves it gone, with the remaining cards keeping their order and words — including after a later reactive tick, not just the first.
result: pass
source: owner-attributed
note: This is roadmap criterion 4 and the phase's hardest claim — group membership re-derives from the slot, so deletion only sticks because conversion DETACHES the group. Independently supported by the 15-case congregationalDetachment.test.ts durability suite and by the code reviewer's hand-trace of the production write path, but only this item exercises a real Firestore round-trip.

### 5. 38.5 Present the split reading and confirm the projected layout
expected: Each section slide shows the reference at top, the speaker on its own line below it, and that section's words below the speaker — one section per slide, never stacked.
result: pass
source: owner-attributed
note: Also closes item 37.1's sub-point 3 (Leader/Congregation distinguishable at projection distance). That sub-point was written against the UNCOLOURED tags; the tags now carry sky/amber (58000e0), so this approval reads against the coloured treatment.

### 6. 38.6 A scripture change destroys the split (intended data loss, D1)
expected: Changing the service item's scripture to a different passage collapses the group back to ONE card showing the new reference. The split is intentionally gone and must be chosen again.
result: pass
source: owner-attributed

### 7. 38.7 An existing pre-Phase-38 congregational reading upgrades itself
expected: An existing service that had a congregational reading before this phase shows one card per section with no action from the user.
result: pass
source: owner-attributed
note: The script explicitly asked the owner to say so rather than guess if they had no such pre-existing service. Covered by the blanket approval; the automated MIGRATION case in congregationalDetachment.test.ts proves the mechanism regardless.

## Summary

total: 7
passed: 7
issues: 0
pending: 0
skipped: 0

## Gaps

[none]
