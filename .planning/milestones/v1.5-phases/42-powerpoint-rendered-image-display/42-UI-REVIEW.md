# Phase 42 — UI Review

**Audited:** 2026-08-07
**Baseline:** 42-UI-SPEC.md (approved contract, checker-verified 6/6)
**Screenshots:** not captured — no dev server running at localhost:3000/5173/8080; this is a code-only audit against the six implemented render-state cells (grid ready/pending/failed, presenter ready/pending/failed) in `SlideCard.vue` and `PresentationViewer.vue`

**Scope, honored:** this is not a new screen — it is three visual states added to two existing surfaces (six cells total). Scored accordingly; nothing outside those six cells is penalized for being untouched.

---

## Pillar Scores

| Pillar | Score | Key Finding |
|--------|-------|-------------|
| 1. Copywriting | 4/4 | Every string, including the `failureReason` mapping table, is a byte-exact reproduction of the contract |
| 2. Visuals | 3/4 | Presenter's pending-state spinner is missing `aria-hidden="true"` — the checker's one explicit recommendation, honored on 3 of the 4 decorative icons but not this one |
| 3. Color | 4/4 | Red-on-grid / amber-on-presenter divergence is honored exactly as specced; no stray hardcoded colors introduced |
| 4. Typography | 4/4 | All six cells hit the declared 11px/13px/36px sizes and 400/600 weight budget exactly |
| 5. Spacing | 4/4 | `gap-2` (8px) on the grid, `gap-4` (16px) on the presenter — both match the declared scale with no arbitrary values |
| 6. Experience Design | 4/4 | Pending/failed never blank, never skipped, never falls through to stale parsed text — extensively covered by both test suites |

**Overall: 23/24**

---

## Top 3 Priority Fixes

1. **Presenter's pending-state spinner lacks `aria-hidden="true"`** (`src/components/PresentationViewer.vue`, the `<svg>` inside the `data-testid="presentation-render-pending"` block, ~lines 80–89) — screen readers will announce this decorative SVG (or its fallback name) as unlabeled content sitting immediately next to "This slide is still rendering.", producing redundant/confusing announcement for an assistive-tech user on the exact surface the phase calls "highest-stakes." Every sibling decorative icon this phase adds (`SlideCard.vue`'s pending spinner, `SlideCard.vue`'s failed icon, and the presenter's own failed icon) already carries `aria-hidden="true"` — this is the one inconsistent case. Fix: add `aria-hidden="true"` to that one `<svg>` to match its three siblings.

2. **Backstop not visually confirmed — overlay-badge visibility across states.** Per code inspection, `SlideCard.vue`'s content-label and slide-number badges (lines 27–34) are `position: absolute`, while the pending/failed/image content divs that follow them in the DOM are not positioned (plain flow `<div>`s). Under CSS painting order, positioned elements always paint above non-positioned in-flow siblings regardless of source order, so the badges should remain on top in all three states by construction, not by accident. This is **likely correct** but is asserted from static analysis, not a rendered screenshot — jsdom cannot settle it, per the UI-SPEC's own backstop note. Recommend a one-time manual screenshot of a pending and a failed grid tile to confirm the badges are visibly unobscured and correctly positioned before closing this out.

3. **UI-SPEC self-contradiction on the grid pending label's color** (42-UI-SPEC.md, Color section vs. Copywriting Contract section) — the Color table states the indigo accent covers "the spinner and the 'Rendering…' label," but the Copywriting Contract table (and the implementation) correctly uses `text-gray-300` for that label, with indigo reserved for the spinner icon only. The code followed the more specific, later table and is internally consistent with the existing grid pattern (labels muted, icon carries the accent) — this is not an implementation defect, but the contract document itself should be corrected so a future audit doesn't flag a false divergence in either direction.

---

## Detailed Findings

### Pillar 1: Copywriting (4/4)

- Grid pending: `"Rendering…"` at `text-[11px] text-gray-300` — matches Copywriting Contract verbatim (`SlideCard.vue:51`).
- Grid failed: `"Render failed"` (`text-[11px] text-red-300`) + mapped sentence (`text-[13px] leading-normal text-red-400/80`) — matches (`SlideCard.vue:68-69`).
- Presenter pending: `"This slide is still rendering."` at `text-4xl font-semibold text-gray-100` — matches (`PresentationViewer.vue:90`).
- Presenter failed: `"This slide couldn't be rendered."` + mapped sentence at `text-[13px] leading-normal text-gray-400` — matches (`PresentationViewer.vue:112-113`).
- `RENDER_FAILURE_SENTENCES` (`slideDisplay.ts:66-69`) reproduces the two named mappings verbatim (`missing-render-doc`, `missing-storage-path`) plus the fallback constant `RENDER_FAILURE_FALLBACK_SENTENCE = "This slide couldn't be rendered."` (`slideDisplay.ts:72`), routed through the single function `renderFailureSentence()` (`slideDisplay.ts:88-91`) — **the one sanctioned path**, imported and reused by both `SlideCard.vue:164/205` and `PresentationViewer.vue:388/465-467`. No second copy exists.
- Test coverage confirms the raw slug never reaches the DOM for both an unmapped reason and an absent one, on both surfaces (`SlideCard.test.ts:183-213`, `PresentationViewer.test.ts:807-818`).

### Pillar 2: Visuals (3/4)

- Icon+text pairing is consistent across all four state blocks (pending/failed × grid/presenter): a small icon, a gap, then the heading/label — a coherent visual language.
- `aria-hidden="true"` is present on: `SlideCard.vue`'s pending spinner (line 46), `SlideCard.vue`'s failed icon (line 64), `PresentationViewer.vue`'s failed icon (line 108). It is **absent** from `PresentationViewer.vue`'s pending spinner (lines 80-89) — the one gap in an otherwise fully-honored checker recommendation.
- Failed-state visual loudness is correctly held equal between pending and failed on the presenter — same `h2` size/weight (`text-4xl font-semibold`), same layout family (`flex flex-col items-center gap-4`), asserted directly by `PresentationViewer.test.ts:820-833` ("failed is never louder").
- Overlay-badge layering (content-label, slide-number) is structurally sound per the CSS stacking analysis above, but is a code-review inference, not a rendered screenshot — flagged in Top 3 Fix #2 as the UI-SPEC's own declared backstop, not resolved by this audit.

### Pillar 3: Color (4/4)

- Grid failed: `bg-red-950/20 border border-red-900/40` on the inner preview box only (`SlideCard.vue:55`), never on the card's outer `border-gray-800`/`border-indigo-500` classes — confirmed both by direct read and by `SlideCard.test.ts:232-247`'s explicit non-bleed assertion.
- Grid failed icon/text: `text-red-400` icon, `text-red-300` label, `text-red-400/80` caption — matches the "Destructive (grid)" row.
- Presenter failed: `text-amber-300` icon, `text-gray-100` heading, `text-gray-400` caption — matches the "Failed (presenter)" row, and correctly does **not** reuse red anywhere. The deliberate red/amber split the UI-SPEC calls out as its one discretionary decision is honored exactly, on both surfaces, with no unification.
- Pending state: `text-indigo-400` spinner on both surfaces (`h-4 w-4` grid / `h-10 w-10` presenter, both matching the spec's stated pixel scale of 16px/40px) — accent correctly scoped to the pending state only, never bleeding into ready or failed.
- No hardcoded hex/rgb colors introduced by this phase's new code in either file.

### Pillar 4: Typography (4/4)

- Label size (grid pending/failed labels): `text-[11px]`, weight 400 (no `font-*` class = default 400) — matches the declared Label row (11px/400).
- Body/caption size (grid failed sentence, presenter failed sentence): `text-[13px] leading-normal` — matches the declared Body row (13px/400/1.5) exactly, including the Tailwind `leading-normal` provenance note.
- Heading size (presenter pending/failed): `text-4xl font-semibold` = 36px/600 — matches the declared Heading row and is byte-identical to the pre-existing `isLoadingState`/`isEmptyState` headings this phase intentionally reused, satisfying the "never louder than an already-shipped state" requirement.
- Weight budget (400/600 only) is respected across every new element in both files — no `font-medium`, `font-bold`, etc. introduced.

### Pillar 5: Spacing (4/4)

- Grid pending/failed blocks: `gap-2` (8px) between icon and label — matches the declared `sm` token ("Spacing between the state icon and its heading line").
- Presenter pending/failed blocks: `gap-4` (16px) — matches the declared `md` token ("Presenter state block's internal vertical rhythm").
- No arbitrary bracketed spacing values (`p-[…]`, `m-[…]`) introduced by this phase's new elements; the pre-existing sub-4px chrome the UI-SPEC exempts (kind-badge/slide-number padding) is untouched, as required.

### Pillar 6: Experience Design (4/4)

- **No blank/skip guarantee:** the presenter's render-state branch (`currentRenderState`, `PresentationViewer.vue:459-461`) is evaluated as the *first* branch of the per-slide-kind chain, ahead of every content kind — a pending/failed slide can never fall through to a broken `<img>` or stale parsed text. Directly exercised by `PresentationViewer.test.ts:850-916`: a middle-position pending/failed slide is counted in `progressLabel`, reached by `next` (not skipped), and re-reached by `prev`; an all-pending deck still shows `1 / 3` and never the empty state.
- **Edge cases both covered:** the "doc doesn't exist yet" case collapses to the pending branch by construction (`renderState` is either `'pending'`/`'failed'`/absent — no separate "doc missing" branch exists to diverge), and the "no `renderImportId`" case is confirmed byte-identical to today via `SlideCard.test.ts:250-266` and `PresentationViewer.test.ts:835-845` (no render-state tile rendered, `object-contain` present, `object-cover` absent).
- **Grid never enters pending/failed for a plain image slide** — proven by the same tests above asserting `slide-card-render-pending`/`slide-card-render-failed` do not exist for a no-`renderState` slide.
- Bottom chrome (exit/prev/next/progress pill) is untouched by this phase and stays fully functional on a pending/failed slide, confirmed by the same navigation tests.

---

## Registry Safety

`components.json` does not exist in this repo (confirmed by the UI-SPEC's own Design System section: `Tool: none`). Registry audit skipped — not applicable.

---

## Files Audited

- `.planning/phases/42-powerpoint-rendered-image-display/42-UI-SPEC.md`
- `.planning/phases/42-powerpoint-rendered-image-display/42-CONTEXT.md`
- `.planning/codebase/CONVENTIONS.md`
- `src/components/slides/SlideCard.vue`
- `src/components/slides/slideDisplay.ts`
- `src/components/PresentationViewer.vue`
- `src/components/slides/__tests__/SlideCard.test.ts`
- `src/components/__tests__/PresentationViewer.test.ts` (first 1177 of 1669 lines — the render-state sections under audit are fully contained within this range; remainder is pre-existing media-playback test coverage outside this phase's scope)
</content>

---

## ⚠ Orchestrator correction — 2026-08-07, after the audit

**Priority fix #1 above is WRONG and requires no code change.** Verified directly before acting on it.

The audit reports that "Presenter's pending-state spinner is the one decorative icon of four missing
`aria-hidden="true"` (`src/components/PresentationViewer.vue` ~lines 80-89)". It is not missing — it is
present at **`PresentationViewer.vue:85`**, inside exactly the block cited.

All four decorative icons Phase 42 introduced carry the attribute:

| File | Line | Icon |
|---|---|---|
| `src/components/PresentationViewer.vue` | 85 | pending spinner |
| `src/components/PresentationViewer.vue` | 108 | failed warning |
| `src/components/slides/SlideCard.vue` | 46 | pending spinner |
| `src/components/slides/SlideCard.vue` | 64 | failed warning |

The SVGs in these files that genuinely lack `aria-hidden` are **pre-existing and outside this phase's
scope**: `PresentationViewer.vue:45` (the `presentation-loading` spinner), `PresentationViewer.vue:325`
(the exit-button icon), and `SlideCard.vue:100`. Adding it to those would be an unrequested change to
untouched code — worth doing opportunistically in a future accessibility pass, not here.

The UI checker's original recommendation was therefore **honored in full** by plans 42-06 and 42-07,
and both executors' `grep -c 'aria-hidden="true"'` acceptance criteria were accurate.

**The other two findings stand as written:**
- #2 — the overlay-badge backstop genuinely remains an open human check. Code inference is not a
  rendered screenshot, and the UI-SPEC itself declared it a `backstop` for that reason. It is recorded
  in `.planning/PENDING-VERIFICATION.md` § Phase 42.
- #3 — the UI-SPEC document does contradict itself on the grid pending label's color (Color section
  says indigo; Copywriting Contract says `text-gray-300`). The implementation followed the Copywriting
  Contract. This is spec hygiene, not a defect, and the spec should be reconciled if it is ever reused.

**Adjusted score: 24/24.** Visuals returns to 4/4 — the one point deducted was for a defect that does
not exist.

**The general point, since it is the second time this run:** an agent's finding is a hypothesis, not a
result. This one was specific, plausible, cited a line range, and was wrong. Acting on it would have
produced a no-op commit claiming to fix an accessibility bug — noise in the history and a false record
of what the code needed.
