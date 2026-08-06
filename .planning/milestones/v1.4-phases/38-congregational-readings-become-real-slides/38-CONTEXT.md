# Phase 38: Congregational Readings Become Real Slides - Context

**Gathered:** 2026-08-05
**Status:** Ready for planning

<domain>
## Phase Boundary

A congregational scripture reading currently produces **one** slide carrying all
its Leader/Congregation sections stacked on top of each other. It must instead
produce **one slide per section**, each showing the speaker above that section's
passage text, and each independently editable and deletable.

Owner verbatim (2026-08-05): *"when we make a Scripture a Congregational
scripture reading, it should actually make individual slides for each section
with the Leader or Congregation on top, then the scripture below. We should be
able to modify them after we split them up, or delete them entirely."*
</domain>

<decisions>
## Implementation Decisions

### D1 — Congregational conversion DETACHES the group (owner-selected, load-bearing)

This is the phase's central decision and it resolves the tension with Phase 30's
hard lock. Owner verbatim:

> *"What I want is to make this slide group become editable once we make it a
> congregational reading. But, if we delete or change the associated Scripture
> from the service plan, that should delete and remake the entire slide group.
> If we don't convert it to congregational reading then it remains not editable."*

> *"Once we make it congregational, the slide group is freely editable. As soon
> as we change anything about the scripture on the Service Editor item, we delete
> the existing slide group and make a new scripture Slide group tied back to the
> Service Editor item. We'd need to once again choose to make it congregational
> or it stays as just the Scripture reference."*

So a scripture slide group has exactly **two states**:

| State | Membership | Editable? |
|---|---|---|
| **Reference** (default) | One payload-free entry, mirrored from the slot | **No** — hard lock stands, exactly as today |
| **Congregational** (opt-in) | N entries, one per section, materialized at conversion | **Yes** — edit and delete individual slides freely |

The transition rules:

- **Reference → Congregational:** converting materializes one entry per section
  and detaches the group from slot-driven re-derivation. This is a deliberate,
  user-initiated act, which is what earns the detachment.
- **Congregational → Reference:** any change to the slot's scripture — a new
  reference, a cleared reference, the item deleted — **destroys the whole group
  and rebuilds it** in the default Reference state. The user must opt into
  congregational again.

**The data-loss consequence is intended, not an oversight.** Per-slide edits made
in the congregational state do not survive a scripture change on the service item.
That is the same rule the codebase already enforces one level down:
`scripture.ts:227-238` deliberately clears stored sections when a slot's reference
changes, because projecting one passage's words under a different reference is a
correctness failure the assembler cannot detect. D1 extends that existing rule to
the slide group rather than inventing a new policy. Preserve that reasoning in
code comments — do not "improve" this into edit-preserving behaviour.

### D2 — Editing is unconstrained in the congregational state (owner-selected)

The owner explicitly folded the edit question into D1: *"I think that answer to
Delete also answers this."* Once detached, section slides are ordinary editable
slides. There is no write-back-to-the-reading path and no per-slide override
concept — the group simply owns its own content after conversion.

Consequently the shadow-copy hazard that motivated the old Hymn carve-out does not
apply here: there is no live source to drift *from*, because conversion cut the
tie deliberately.

### Claude's Discretion

- **How the two states are represented.** Whether detachment is a flag on the
  `SlideGroup`, an inference from the entries' `sourceRef` shape, or something
  else. The requirement is only that the state is unambiguous and that the
  materializer can tell "rebuild this" from "leave this alone".
- **What counts as "changing the scripture"** for the rebuild trigger, beyond the
  obvious reference change and item deletion. Note that today's structural
  signature for scripture is *only* the formatted reference
  (`slideGroupMaterializer.ts:133-137`), so it is a natural starting point — but
  verify it actually fires on every case D1 names, including clearing the
  reference entirely.
- **Where the "make it congregational" affordance lives** and whether converting
  an already-converted group re-splits or is a no-op.
- Whether `PresentationViewer`'s now-unused multi-section rendering branch is
  deleted in this phase or left until the new shape is proven. State which.
</decisions>

<specifics>
## Specific Ideas

**Follow the IMPORTED precedent — this is not a novel shape.** An `IMPORTED` slot
already emits one entry per inner slide, discriminated by `innerSlideId`
(`slideGroupMaterializer.ts:92-96`). Multi-entry groups derived from a single slot
are established. The `SourceRef` union doc comment in `src/types/slideGroup.ts`
already anticipates precisely this widening for congregational splits — read it
before designing a new discriminator.

Live-source anchors, scouted 2026-08-05 (re-verify before editing; they drift):

| What | Where |
|---|---|
| Sections stored on the SLOT, not the slide | `src/types/service.ts:69` (`congregationalSections`) |
| Scripture emits ONE payload-free entry | `src/utils/slideGroupMaterializer.ts:84` |
| IMPORTED's one-entry-per-fragment precedent | `src/utils/slideGroupMaterializer.ts:92-96` |
| Structural signature (re-derivation trigger) | `src/utils/slideGroupMaterializer.ts:133-137` |
| All sections copied onto one slide at assembly | `src/utils/scripture.ts:218-225` |
| Reference-change clears sections (the rule D1 extends) | `src/utils/scripture.ts:227-238` |
| Sections rendered stacked on one slide | `src/components/PresentationViewer.vue` congregational branch |
| Scripture slides built with empty `text` | `src/utils/slideshowAssembler.ts:152`, `:409` |
| Congregational editor | `src/components/CongregationalEditor.vue` |
| Per-kind 3-dot menu table | `src/components/slides/slideDisplay.ts` |

**Recently changed — do not plan against stale assumptions.** Quick task
`260805-kzd` (2026-08-05) reworked the projected slide: there are no label
elements left anywhere in `PresentationViewer.vue`, the scripture reference is now
body-sized content under `data-testid="presentation-scripture-reference"`, and the
speaker tags are plain white at body size with their `data-testid` values kept
deliberately as anchors for this phase.

</specifics>

<canonical_refs>
## Canonical References

- **Phase 30** — the hard lock ("slides mirror the plan"). D1 does not repeal it;
  it scopes it to the Reference state. Any code comment citing the hard lock near
  scripture groups must be updated to say so, not left asserting a rule the code
  no longer follows unconditionally.
- **Phase 34** — produced `ServiceSlot.congregationalSections` and the LLM split.
- **R047** — scripture content derives from the slot; a scripture slide defaults
  to reference-only with empty `text`.

## Gates (binding, per CLAUDE.md)

- `npm run type-check` — must be `vue-tsc --build`. The `-p tsconfig.app.json`
  form silently skips test files and is NOT sufficient evidence.
- `npx vitest run --dir src --exclude '**/rules.test.ts'` — the only correct
  app-suite invocation.
- Known-failing baseline, NOT regressions: `src/storage.rules.test.ts` and
  `src/views/__tests__/RosterView.test.ts`. Any other failure is a real regression.
- Never record a deferred or human-verify check as passed.
</canonical_refs>
