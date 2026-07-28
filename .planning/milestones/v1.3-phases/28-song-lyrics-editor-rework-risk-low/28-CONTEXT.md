# Phase 28: Song Lyrics Editor Rework - Context

**Gathered:** 2026-07-27
**Status:** Ready for planning
**Milestone:** v1.3 — Slides Tab Rework (FINAL phase)
**Mode:** Smart discuss (autonomous) — 3 decisions, including the milestone's one mandated design choice

<domain>
## Phase Boundary

Rework the song lyrics editor so it presents **one scroll surface and one list that IS the slide
order** — eliminating the nested scrollbar and the duplicated Available-Sections / Performance-Order
lists introduced in Phase 18 (R035).

This phase is **independent of Phases 24-27** and was sequenced last. It touches the song editor, not
the Slides tab.

### Starting state (verified in the codebase, not assumed)

- `src/components/SongLyricEditor.vue` (6817 bytes) and `src/components/PerformanceOrderBuilder.vue`
  (6562 bytes) are the Phase 18 pair being reworked.
- Both are imported **only** by `src/components/SongSlideOver.vue` (lines 305-306). No other consumer.
- `SongSlideOver.vue` gained an `initialTab` prop in Phase 26 (plan 26-02) so Phase 26's "Edit in song"
  link can open it on the lyrics tab. **That link lands here — do not break it.**

</domain>

<decisions>
## Implementation Decisions

### D-01 — Design option **2a** is chosen *(locked; this is the milestone's one mandated design choice)*

`docs/design/README.md` states 2a vs 2b is "an **open decision** to settle at that phase's discuss
step." Settled: **2a**.

**2a is:** one list of section cards, **always** drag-to-reorder. The section list **IS** the slide
order — there is no second list. Cards collapse to a one-line summary (`CHORUS ⌄`, "4 lines").
Rows are numbered `1..N`. Repeats render as linked rows (`3 Chorus ↺` · `linked`). Plus
`＋ Add section` and a `✓ N sections` confirmation.

**Why not 2b** (a "Switch to Sections to reorder" mode toggle): 2a has no modes to notice or manage,
and it matches how the Slides tab grid already behaves — so **drag means the same thing in both
places**. 2b's advantage (no accidental drag while editing) is real but is better addressed with a
drag handle, exactly as Phase 25 D-11 did for slide cards.

### D-02 — A repeat is a REFERENCE; edits propagate *(locked)*

A repeated chorus is a reference to the same section, not a copy. Editing the chorus once updates
every occurrence — which is what the mockup's `linked` label already implies.

This is the same principle **D002** applies across the whole milestone: a single canonical version,
referenced rather than copied. An independent-copy model would reintroduce exactly the duplication
D002 removed and would force a lyric fix to be made in several places.

### D-03 — Reshape the model only as far as 2a requires *(locked)*

**D-19** makes Phase 18's `lyrics` / `performanceOrder` structures greenfield — reshape freely, no
migration, no fallback, no deprecated field. But scope the reshape to what 2a needs: collapse the
Available-Sections / Performance-Order split into one ordered list, and change nothing else.

⚠ **The `Song` catalog records themselves are PRODUCTION data** (shipped v1.0, 2026-03-05). Only the
Phase 18 lyrics/order *structures* are greenfield. See the boundary table in `.planning/STATE.md`.

### Claude's Discretion

Whether the reworked editor is one component or a small set; how a section card collapses/expands;
the drag mechanism (SortableJS is already used for the slot list and the slide grid — reuse preferred,
not mandated); how "add section" and the repeat/link affordance are presented; and whether
`PerformanceOrderBuilder.vue` is deleted outright or absorbed.

</decisions>

<hard_constraints>
## Must not break

- **Phase 26's "Edit in song" link** — `src/utils/songEditLink.ts` builds a `?edit=`/`?tab=` query that
  `SongsView.vue` resolves, opening `SongSlideOver` on a requested tab via its `initialTab` prop. The
  reworked editor must still be reachable that way.
- **D006** — manual copy/paste from CCLI SongSelect with auto-parsing of section markers. CCLI provides
  no API (a hard constraint), so `Paste lyrics` is the primary way lyrics enter the app. It appears in
  the Turn 2 mockup and must survive.
- **D002 / D007** — a single canonical song lyric version; services reference it live and never copy.
  Slide text stays read-only on the Slides tab; per-service overrides are permanently out. This phase
  changes how lyrics are EDITED, never how services consume them.
- **The Slides tab's live rendering** — Phase 24 D-02 keeps song text a live reference, so a lyrics
  edit must still flow through to every service referencing that song. If the section-order model
  changes shape, `slideGroupMaterializer`'s song reconciliation (which matches by `sectionId`) must
  keep working. **Phase 26-09 fixed a defect there** (`storedBySectionId` is now an array so duplicated
  entries survive) — do not regress it.

## Standing milestone decisions

- **D-18:** no bed video; the group bed is audio-only.
- **D-19:** no legacy compatibility in the slide area — delete, don't deprecate. Exception: Phase 24
  D-01's `ServiceSlot.id` backfill (production data). Full boundary table in `.planning/STATE.md`.
</hard_constraints>

<canonical_refs>
## Canonical References

- `docs/design/slides-tab.dc.html` — **Turn 2**, roughly lines 25-214, holds BOTH options; build **2a**
  only. Cumulative and overwritten per design turn — re-pull before planning.
- `docs/design/README.md` — the turn map and the 2a/2b description this decision resolves.
- `.planning/milestones/v1.2-REQUIREMENTS.md` — R035. (There is no `.planning/REQUIREMENTS.md`.)
- `.planning/STATE.md` — ★ v1.3 STANDING DECISIONS and the greenfield/production boundary table.
- `src/components/SongLyricEditor.vue`, `src/components/PerformanceOrderBuilder.vue` — what is reworked.
- `src/components/SongSlideOver.vue` — the only consumer; carries Phase 26's `initialTab` prop.
- `src/utils/songEditLink.ts` — Phase 26's link contract that lands here.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- SortableJS already drives two drag surfaces: the slot list (`handle: '.drag-handle'`, Phase 20-04)
  and the slide grid (Phase 25-05). Reusing that pattern keeps drag consistent app-wide — and is the
  reason D-01 preferred 2a.
- Phase 25's `src/components/slides/` established the collapse/summary and numbered-row idioms.

### Established Patterns
- Modals/slide-overs teleport to `<body>`; tests need `DOMWrapper` over `document.body` +
  `enableAutoUnmount(afterEach)`, and `stubs: { teleport: false }` under `shallowMount`.
- **Tailwind v4 purges dynamically-built class names** — use static, fully-spelled-out class maps. This
  has shipped as a bug twice in this codebase.
- The UI-SPEC exceptions approved for Phases 25/26 (3 font weights + `text-[10px]`; 6px `gap-1.5`) are
  app-wide conventions — match them; do NOT "correct" them.

### Integration Points
- `SongSlideOver.vue` mounts the editor; its `initialTab` prop is Phase 26's entry point.
- Song lyric data flows out to `slideshowAssembler` / `slideGroupMaterializer`, which match song
  sections by `sectionId` — the reshape must preserve whatever those rely on.

</code_context>

<specifics>
## Specific Ideas

- Verbatim labels from the Turn 2 mockup: `＋ Add section`, `✓ 7 sections`, `Paste lyrics`,
  `Remove`, `Duplicate`, and the per-row summary form `CHORUS ⌄` / `4 lines`.

  > **Correction (2026-07-27, caught during planning).** An earlier draft of this list also included
  > **`Lyric sheet`**. That label is the second segment of **2b's mode toggle** — the deferred option —
  > so building it would build 2b. It is **excluded**. The label list above was drawn across both mockup
  > panels; `✓ N sections`, the `1..N` numbering and the `↺` repeat glyph also sit in the 2b panel, but
  > those are wanted and are explicitly folded into 2a by D-01, so they ship.
- The linked-repeat row reads `3 Chorus ↺` with a `linked` marker — D-02 makes that label literally
  true rather than decorative.
- R035's success condition is concrete and testable: **no nested scrollbar, and exactly one list**.
  Both are worth asserting rather than eyeballing.

</specifics>

<deferred>
## Deferred Ideas

- **Option 2b** (the mode-toggle design) — not built; D-01 chose 2a.
- Broader Phase 18 model cleanup beyond what 2a requires (D-03).
- Everything still deferred from Phases 24-27: `UNANCHORED`/orphaned slides, `Tag`/`Details`, a
  reconciliation diff view, per-service slide text overrides, keyboard reordering, formatted slide
  rendering, the `List` view toggle, and `isSlotPopulated` dead-code cleanup (27-REVIEW IN-01).

</deferred>
