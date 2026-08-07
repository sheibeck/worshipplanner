# Phase 43: Service Item Types - Context

**Gathered:** 2026-08-07
**Status:** Ready for planning
**Mode:** Smart discuss (autonomous). Grey-area recommendations auto-accepted under STATE.md's
★★ Standing Autonomy Grant (v1.5, 2026-08-06). Every choice is disclosed rather than approved
interactively.

<domain>
## Phase Boundary

A planner has the right set of service item types — **Announcements** and **Miscellaneous** added,
**Message** reduced to plain text, **Hymn** retired from the add-item palette — and every type exports
to Planning Center as itself.

**In scope:** widening `SlotKind`; the free-text field the three text kinds need (R081-R083); the
palette-only Hymn removal (R084); and explicit Planning Center export branches with a compiler
backstop (R085).

**Out of scope:** the default service template (Phase 44 — it depends on this phase's final `SlotKind`
set); any migration of stored service data; changing Prayer; changing the Slides-tab rendering of any
item type beyond what a new kind requires.

</domain>

<decisions>
## Implementation Decisions

### Type shape for the new kinds

- `ANNOUNCEMENTS` and `MISC` join the existing **`NonAssignableSlot`** by widening its `kind` to
  `'PRAYER' | 'MESSAGE' | 'ANNOUNCEMENTS' | 'MISC'`. They need no fields Prayer and Message do not
  already have, so two new interfaces would duplicate a shape with nothing to distinguish it.
- The free text all three text kinds need (R081, R082, R083) is **one new optional field,
  `body?: string`**, on `NonAssignableSlot` — not four per-kind names for one concept.
- The name is **`body`**, matching the existing `TextSlide.body` in `src/types/slide.ts`. Same concept,
  same word.
- **Optional, not required.** Every PRAYER and MESSAGE slot already in production has no `body`;
  making it required would break every stored service and force a migration this phase is not
  authorized to write.

### Retiring Hymn (R084)

- **Palette-only removal, exactly as the requirement states.** `'HYMN'` stays in `SlotKind`, stays in
  `slotLabel()`, stays in `createSlot()`, and stays in every render / print / present / export path. It
  is removed **only** from the add-item palette.
- Rejected: deleting the kind (breaks every saved Hymn item) and migrating Hymn → Song. The
  requirement itself explains why the migration is lossy: `HYMN` carries free-text
  `hymnName`/`hymnNumber`/`verses`, and `SONG` requires a catalog `songId` it cannot represent.
- **`createSlot('HYMN')` is kept.** Removing it would make the palette the only definition of what is
  constructible, which invites a later "unused branch" cleanup to delete the kind for real.
- Proof is an **absence-of-regression** test: a stored HYMN slot still renders, prints, and exports
  after the palette change. Asserting only that the palette lost its entry proves the easy half.
- The palette must enumerate kinds **separately from `SlotKind`**. If the palette is derived from the
  union, "offerable" and "representable" stay fused and R084 is unimplementable by construction.

### Message simplification (R083)

- Remove the URL link **from the Message editing UI**. Leave `linkUrl`/`linkLabel` in place as optional
  type fields so stored data is not dropped.
- **No migration.** No requirement authorizes one, and removing the UI does not destroy the stored
  value. A service that has a Message link today keeps it in Firestore; it simply stops being editable.
- **Prayer is not in scope.** It shares `NonAssignableSlot`, so the fields remain typed for it, but
  R083 names Message only — do not change Prayer's UI.
- Message's Planning Center description keeps its existing `sermonPassage` behaviour, and prefers
  `body` when set.

### Planning Center export — R085, the trap this phase exists to close

- `addSlotAsItem` (`src/utils/planningCenterApi.ts:884-1004`) is an **unguarded if-chain whose final
  branch is an implicit `else` returning a "Message" item** (verified by direct read: the last block is
  preceded only by a bare `// MESSAGE` comment). Any `SlotKind` without an explicit branch is silently
  exported as "Message".
- **This is not caught by the compiler.** `slotLabel()` and `createSlot()` are exhaustive `switch`
  statements — `npm run type-check` catches a missing case there. `addSlotAsItem` is an if-chain, so it
  does not. That asymmetry is the entire trap, and `IMPORTED` already needed an explicit skip with a
  comment naming it.
- Fix in two parts:
  1. **An explicit branch per kind**, including converting the trailing implicit else into an explicit
     `if (slot.kind === 'MESSAGE')`, so no kind can ever fall through unnamed again.
  2. **A compiler backstop** after the chain — an exhaustiveness assertion (`const _never: never = slot`
     or equivalent) so that the *next* phase to widen `SlotKind` gets a compile error rather than a
     silent mislabel. Part 1 fixes today; part 2 is what makes the fix durable. Phase 44 widens the
     palette's consumers immediately, so this matters within the milestone, not hypothetically.
- `ANNOUNCEMENTS` → title `Announcements`, `MISC` → title `Miscellaneous`, both `itemType: 'regular'`,
  mirroring the existing Prayer branch.
- **`body` is exported as the item description** for all three text kinds. Without it, the planner's
  typed text silently vanishes on export — which is R085's own failure mode wearing a different hat.

### Claude's Discretion

- The exact palette data structure and where it lives.
- Editor UI layout for the `body` textarea, subject to the UI-SPEC generated next.
- Whether the exhaustiveness backstop is a `never` assignment, a helper, or a default-case throw —
  any form that turns a missing kind into a compile error is acceptable.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets

- `src/types/service.ts:7` — `SlotKind`, the union to widen.
- `src/types/service.ts:73-79` — `NonAssignableSlot`, already `'PRAYER' | 'MESSAGE'` with optional
  `linkUrl`/`linkLabel`. The natural home for the two new kinds and for `body`.
- `src/types/service.ts:81-88` — `HymnSlot`, which must survive untouched.
- `src/utils/slotTypes.ts:37-52` — `slotLabel()`, an exhaustive switch: **compiler-caught**.
- `src/utils/slotTypes.ts:58-98` — `createSlot()`, an exhaustive switch: **compiler-caught**.
- `src/utils/slotTypes.ts:274-282` — `buildSlots`'s `nonAssignableSlot` helper, currently typed
  `'PRAYER' | 'MESSAGE'`; widening the union may or may not require touching it (it constructs template
  defaults, which Phase 44 replaces).
- `src/utils/planningCenterApi.ts:884-1004` — `addSlotAsItem`, the if-chain: **NOT compiler-caught**.
- `src/types/slide.ts` — `TextSlide.body`, the naming precedent for the new field.

### Established Patterns

- **Exhaustive switch over `slot.kind`** is the codebase's normal shape; the PC export is the documented
  exception, and `IMPORTED`'s explicit skip is the precedent for handling it.
- **Optional fields for backward compatibility** — `section?`, `linkUrl?`, `renderImportId?` all follow
  the same "absent means legacy, never migrate" convention Firestore's schemalessness allows.
- Phase 24 D-01's stable `ServiceSlot.id` is minted by `createSlot()` for every new slot; the new kinds
  inherit that for free by going through the same factory.

### Integration Points

- The add-item palette in `src/views/ServiceEditorView.vue` (the file that imports `SlotKind`).
- `src/utils/__tests__/planningCenterApi.test.ts` — where R085's per-branch proof belongs.
- `src/utils/__tests__/slotTypes.test.ts` — `slotLabel`/`createSlot` coverage for the new kinds.
- `src/components/slides/slideDisplay.ts` — imports `SlotKind`; check whether it needs new cases.
- `src/views/__tests__/ServiceEditorView.test.ts` — palette and editor coverage.

</code_context>

<specifics>
## Specific Ideas

- ROADMAP criterion 5 is unusually prescriptive and should be read as written: *"`addSlotAsItem`'s
  unguarded if-chain gets an explicit branch for each, proven by test, since this is a
  silent-fallthrough trap the compiler's exhaustive-switch checking does not catch."* The test is not
  optional and the branch-per-kind is not negotiable.
- The ROADMAP also notes this phase **must land before or with Phase 44**, because the template editor
  needs the final `SlotKind` set. Phase 44 is next in the queue, so this ordering holds naturally.
- `research flag: skip` — the ROADMAP judged this compiler-guided against well-understood
  architecture. No researcher was spawned. The one genuinely non-compiler-guided risk (the if-chain) is
  named explicitly above rather than left for research to rediscover.

</specifics>

<deferred>
## Deferred Ideas

- Migrating existing Hymn items to some other type. Explicitly rejected by owner decision recorded in
  R084 — the conversion is lossy.
- Migrating existing Message `linkUrl` values into the new `body` field. No requirement covers it.
- Removing `linkUrl`/`linkLabel` from the type entirely, or removing them from Prayer's UI. Out of
  scope; R083 names Message only.
- Any further item types beyond Announcements and Miscellaneous.

</deferred>
