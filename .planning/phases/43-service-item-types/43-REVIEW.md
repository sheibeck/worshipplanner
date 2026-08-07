---
phase: 43-service-item-types
reviewed: 2026-08-07T20:16:44Z
depth: standard
files_reviewed: 17
files_reviewed_list:
  - src/types/service.ts
  - src/utils/planningCenterApi.ts
  - src/utils/slotTypes.ts
  - src/components/slides/slideDisplay.ts
  - src/utils/slideGroupMaterializer.ts
  - src/utils/slideshowAssembler.ts
  - src/components/ServiceCard.vue
  - src/components/ServicePrintLayout.vue
  - src/views/ServiceEditorView.vue
  - src/views/ShareView.vue
  - src/utils/__tests__/slotTypes.test.ts
  - src/utils/__tests__/planningCenterApi.test.ts
  - src/components/slides/__tests__/slideDisplay.test.ts
  - src/components/__tests__/ServicePrintLayout.test.ts
  - src/views/__tests__/ServiceEditorView.test.ts
  - src/views/__tests__/ShareView.test.ts
  - src/views/__tests__/hymnRetirement.regression.test.ts
findings:
  critical: 0
  warning: 2
  info: 1
  total: 3
status: issues_found
---

# Phase 43: Code Review Report

**Reviewed:** 2026-08-07T20:16:44Z
**Depth:** standard
**Files Reviewed:** 17
**Status:** issues_found

## Summary

Reviewed the widened `SlotKind` union (`ANNOUNCEMENTS`/`MISC`), the Hymn-chip retirement, the
shared `body` free-text editor for Message/Announcements/Miscellaneous, and the exhaustive
`addSlotAsItem` dispatch, across the type definitions, the PC export API, every kind-dispatch
site (`slotTypes.ts`, `slideDisplay.ts`, `slideGroupMaterializer.ts`, `slideshowAssembler.ts`,
`ServiceCard.vue`, `ServicePrintLayout.vue`, `ServiceEditorView.vue`, `ShareView.vue`), and the
corresponding test suites.

The core claims hold up under adversarial reading:
- Every kind-dispatch `switch`/chain touched by this phase (`slotLabel`, `createSlot`,
  `KIND_BADGE_CLASSES`, `slotDisplayTitle`, `slideContentLabel`/`slideBodyText`/
  `slideFooterLabel`, `deriveGroupEntries`/`sourceSignature`/`isSlotDerivableRef`/`rebuildGroup`,
  `buildTextContentForSlot`, the fallback branch in `assembleSlideshow`, `ServiceCard.vue`'s
  local `slotLabel`, the print/share templates) explicitly handles `ANNOUNCEMENTS` and `MISC` —
  none silently fall through to a `MESSAGE`-shaped default.
- `addSlotAsItem`'s `never`-typed backstop is real: every `SlotKind` member has its own explicit
  `if` branch, `IMPORTED` is handled defensively even though the caller already skips it, and the
  backstop line is unit-tested via a cast-to-`never` fixture that proves the throw arm is
  reachable and correctly worded.
- `body` is rendered via Vue text interpolation (`{{ slot.body }}`) everywhere it appears
  (`ServicePrintLayout.vue`, `ShareView.vue`, `ServiceEditorView.vue`) — no `v-html` or
  `innerHTML` sink was introduced anywhere in the reviewed file set.
- Removing the Message URL control from the editor markup does not touch `linkUrl`/`linkLabel`:
  the type still carries both fields, `buildServiceSnapshot` spreads the whole slot object into
  the share snapshot, and `ServiceEditorView.test.ts`'s E-11/E-12 tests assert a stored
  `linkUrl`/`linkLabel` on a `MESSAGE` slot survives mount and a body edit untouched.
- Stored `HYMN` data is proven not to degrade: `hymnRetirement.regression.test.ts` round-trips a
  `HYMN` slot's `hymnName`/`hymnNumber`/`verses` — including a multi-byte/whitespace fixture —
  through render, print, share, present, and export, and confirms the palette chip is gone from
  both the top-level and per-section add rows.

Two warnings below concern a real-world Planning Center export gap (pre-existing for
PRAYER/MESSAGE, now silently extended to the two new kinds this phase adds) that undercuts the
phase's own stated goal — "every type exports to Planning Center as itself" — for two of the
three actual export code paths in `ServiceEditorView.vue`. `addSlotAsItem` itself is correct;
the gap is in the callers that decide which slots ever reach it.

## Warnings

### WR-01: "Add to existing plan" export never calls `addSlotAsItem` for PRAYER/MESSAGE/ANNOUNCEMENTS/MISC — silently drops them, contradicting the phase goal

**File:** `src/views/ServiceEditorView.vue:3206-3319`
**Issue:** In `onConfirmExport`'s `exportMode === 'existing'` branch, the only two slot buckets
built from `localService.value.slots` are:
```ts
const songSlots = localService.value.slots.filter(s => s.kind === 'SONG' || s.kind === 'HYMN')
const scriptureSlots = localService.value.slots.filter(s => s.kind === 'SCRIPTURE')
```
Every pass through this branch (placeholder-matching, unmatched-placeholder deletion, and the
"append leftovers" pass) only ever touches `songSlots`/`scriptureSlots`. `PRAYER`, `MESSAGE`,
`ANNOUNCEMENTS`, `MISC`, and `IMPORTED` slots are never read, never matched, and never appended —
`addSlotAsItem` is simply never invoked for them in this mode. A planner who fills in an
Announcements or Miscellaneous body and then exports to an *existing* Planning Center plan gets
no corresponding item on PC, with no error and no indication anything was skipped. The in-code
comment at `planningCenterApi.ts:1201-1205` even acknowledges this was already true for
PRAYER/MESSAGE ("the 'existing plan' branch below only ever touches songSlots/scriptureSlots
(same as PRAYER/MESSAGE)") — this phase's two new kinds inherit the same silent omission without
any new comment or test calling it out, directly at odds with the phase goal "every service item
type exports to Planning Center as itself."
**Fix:** Build a third bucket for the non-song/non-scripture, non-imported kinds and append them
via `addSlotAsItem` in the same "leftovers" pass the song/scripture buckets already use, e.g.:
```ts
const otherSlots = localService.value.slots.filter(
  (s) => s.kind === 'PRAYER' || s.kind === 'MESSAGE' || s.kind === 'ANNOUNCEMENTS' || s.kind === 'MISC',
)
for (const slot of otherSlots) {
  try {
    await addSlotAsItem(appId, secret, serviceTypeId, planId, slot, sequence, songStore.songs, localService.value.sermonPassage)
    sequence++
  } catch {
    failures.push(elementLabel(slot.kind))
  }
}
```
At minimum, if this is intentionally out of scope for "add to existing plan," the UI should warn
the planner that Prayer/Message/Announcements/Miscellaneous content is not exported in that mode.

### WR-02: "Create new plan with template" export also drops unmatched PRAYER/MESSAGE/ANNOUNCEMENTS/MISC slots — template items get the template's own text, not the planner's body

**File:** `src/views/ServiceEditorView.vue:3366-3414`
**Issue:** In the templated "create new plan" path, a template item that is neither a song
placeholder nor a scripture placeholder is created directly from the *template's own*
title/description (`tItem.title`/`tItem.description`), never from the matching app slot:
```ts
} else if (!isSongItem && !isScriptureItem) {
  await createItem(appId, secret, serviceTypeId, planId, {
    title: tItem.title,
    itemType: tItem.itemType === 'header' ? 'header' : 'regular',
    description: tItem.description,
    sequence,
    length: tItem.length,
  })
}
```
So a Prayer/Message/Announcements/Miscellaneous body the planner typed never reaches PC even when
the template happens to have a same-named placeholder item — the template's static text wins
instead. After the template loop, only leftover `songSlots`/`scriptureSlots` are appended
(`3397-3414`); any Prayer/Message/Announcements/Miscellaneous slot that didn't get consumed by a
template item (which is every one of them, since none are matched above) is dropped entirely,
same failure mode as WR-01. Combined with WR-01, `addSlotAsItem`'s per-kind formatting for these
four kinds (including the new `bodyDescription`-driven `html_details` for ANNOUNCEMENTS/MISC/
MESSAGE) is only ever exercised by the "create new plan, no template" path and the standalone
`hymnRetirement`/`planningCenterApi` unit tests — never by the two most common real export flows
a planner with an existing PC setup would use.
**Fix:** Same remediation as WR-01 — build the "other" slot bucket once and append it as leftovers
after the template loop, alongside the existing song/scripture leftover passes.

## Info

### IN-01: `addSlotAsItem`'s MESSAGE branch omits the `length` forward that the new ANNOUNCEMENTS/MISC branches added

**File:** `src/utils/planningCenterApi.ts:1031-1044`
**Issue:** The `ANNOUNCEMENTS` and `MISC` branches added by this phase both forward the caller's
`length` parameter to `createItem`:
```ts
if (slot.kind === 'ANNOUNCEMENTS') {
  return createItem(appId, secret, serviceTypeId, planId, {
    title: 'Announcements', itemType: 'regular', description: bodyDescription(slot.body), sequence, length,
  })
}
```
but the sibling `MESSAGE` branch — which received the same shared `body` treatment in this same
phase — does not:
```ts
if (slot.kind === 'MESSAGE') {
  const description = bodyDescription(slot.body) ?? (sermonPassage ? formatScriptureRef(sermonPassage) : undefined)
  return createItem(appId, secret, serviceTypeId, planId, {
    title: 'Message', itemType: 'regular', description, sequence,
  })
}
```
This is currently latent — no call site in `ServiceEditorView.vue` passes a non-`undefined`
`length` for a `MESSAGE` slot today — but it is a real inconsistency introduced in the same phase
that unified MESSAGE/ANNOUNCEMENTS/MISC's `body` handling, and will silently drop a plan-item
length the moment any caller starts threading one through for MESSAGE (e.g. a future template
match).
**Fix:** Add `length` to the MESSAGE branch's `createItem` call for consistency with its two new
siblings:
```ts
return createItem(appId, secret, serviceTypeId, planId, {
  title: 'Message',
  itemType: 'regular',
  description,
  sequence,
  length,
})
```

---

_Reviewed: 2026-08-07T20:16:44Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
