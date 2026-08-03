---
phase: "34"
name: "smarter-content-llm-scripture-split"
created: 2026-08-03
status: gaps_found
source: owner hands-on session, 2026-08-03
scope_note: >
  These are OWNER findings from real use of the running app. Only F1 belongs to R064.
  F2-F5 are cross-phase defects and UX findings (Phases 31/32/33 + Planning Center export)
  that surfaced in the same session and are recorded here so they are not lost. Every
  "verified" line below was checked against live source by the orchestrator before planning;
  where the owner's diagnosis and the source disagree, BOTH are recorded.
---

# Phase 34 — UAT Findings (owner session, 2026-08-03)

## Test Results

| # | Finding | Status | Verified against source | Owns it |
|---|---------|--------|-------------------------|---------|
| F1 | Scripture slide gives no way to edit/see its text; the drawer routes elsewhere | ✗ FAIL | Confirmed | **R064** (this phase) |
| F2 | Group music and group background are two separate UI sections; should be one panel | ✗ FAIL | Confirmed | Phase 33 / Phase 36 |
| F3 | A group background image never appears on the Present screen | ✗ FAIL — **real defect** | Confirmed | Phase 33 (R055/R056) — **requirements gap** |
| F4 | Empty sticky save-status bar left at the top after reopening a planned service | ✗ FAIL — **real defect** | Confirmed | Phase 32 |
| F5 | "Export to PC" appears removed; only "Copy for PC" is offered | ⚠ **owner diagnosis incorrect — real symptom** | Confirmed not removed | Planning Center / auth |

---

## F1 — A scripture slide offers no way to edit or read its text

**Owner:** *"You've locked Edit Scripture behind: Slide Text / 'Edit this slide's text via Edit lyrics'. Since it's scripture it should just let us edit the text. Or at the least, update that label."*

**Verified:**
- `slideDisplay.ts:307-311` — a `scripture`-kind entry's action menu is `edit-details` + `edit-in-scripture` (+ `duplicate`/`delete` when mutable). It never offers `edit-lyrics`.
- `EditSlideDrawer.vue:155-161` — the `scripture` branch renders `scripturePassageText` **read-only** with the caption `SCRIPTURE_TEXT_CAPTION` = *"Pulled from the passage reference — editing the reference updates this slide."* (`:678`).
- `EditSlideDrawer.vue:656-661` — that text is `slide.text || slide.reference`, and its own comment records the R047 ripple: **"a reference-only scripture slide now always resolves with empty `text`"**. So today the block shows only the reference back to the user.
- `edit-in-scripture` → `ServiceEditorView.vue:1499-1506` `handleNavigateToScriptureEditor` — a tab switch plus `scrollIntoView`. It opens no editor.

**Note on the exact string quoted.** *"Edit this slide's text via Edit lyrics"* (`EditSlideDrawer.vue:205`) belongs to the `sourceKind === 'text'` branch in `details` mode, not the `scripture` branch. The owner may have had a hand-authored `text` slide selected. **This does not weaken the finding** — for a genuine `scripture` slide the outcome is the same or worse: read-only, showing only the reference, with the one edit route landing on a scroll.

**Impact on the committed plans.** `34-07` currently builds the mount seam on the **Service Order SCRIPTURE row**. This finding says the owner reaches for it from the **slide** — the drawer / action menu. That is a mount-seam decision `34-07` must revisit, not a cosmetic label change.

---

## F2 — Group music and group background are two separate sections

**Owner:** *"You have two entirely different sections in the UI for these buttons. They should be put in the same panel: ＋ Add music for this group (applies to all 2 slides in this group, unless a slide sets its own) / + Add background for this group."*

**Verified:** `SlideGrid.vue` renders them as two sibling rows, each with its own wrapper `v-if`:
- music — `SlideGroupMusicControl` (label at `SlideGroupMusicControl.vue:55`)
- background — `BackgroundControl` in a separate `div` at `SlideGrid.vue:90-102`, added by 33-08 as *"a NEW sibling row directly below the music control"*

Both are group-level media on the same `canWriteGroupMedia` gate. The caption the owner quoted is `SlideGrid.vue:452`. Nothing prevents one panel; they were simply built as separate rows.

---

## F3 — A group background image never renders on the Present screen ★ REAL DEFECT

**Owner:** *"When I add a background image to a group, it's not showing up in the slide Present screen."*

**Verified — the owner is right, and the cause is a requirements gap, not a wiring slip:**
- `grep backgroundImageUrl src/components/PresentationViewer.vue` → **zero matches.** The presentation surface has no background rendering of any kind.
- The value *is* resolved: `SlideBase.backgroundImageUrl` + `backgroundSource` exist (`slide.ts:39-46`), the assembler populates them, `EditSlideDrawer.vue:628` reads `assembledSlide.slide.backgroundImageUrl` and `SlideGrid.vue:467` previews it. **Authoring and preview are complete; display is absent.**
- **R055** ("A background image can be set for all slides in a group") and **R056** ("...on a single slide, overriding the group's — most specific wins") both describe *setting* the background. **Neither requirement ever asked for it to render while presenting**, so Phase 33's verification passed honestly with the feature half-delivered.

This is the same shape as the open Phase 37 finding that client-side display of rendered images has no owner in the roadmap: **a media cascade built through authoring, with no requirement covering the surface that was the point of it.**

---

## F4 — Empty sticky save-status bar after reopening a planned service ★ REAL DEFECT

**Owner:** *"When I marked as planned, then re-open for editing, this panel gets left at the top of the screen and it's now empty since we're no longer locked"* — with the rendered DOM:

```html
<div class="sticky top-0 z-10 mb-3 flex items-center gap-2 rounded-md border border-gray-800 bg-gray-900 px-4 py-2" data-testid="service-save-status-bar">
  <div class="text-xs" aria-live="polite" aria-atomic="true" data-testid="save-status"><!--v-if--></div>
</div>
```

**Verified:** `ServiceEditorView.vue:235-241`. The bordered, sticky wrapper is gated on `v-if="canEditService"` alone, while `SaveStatusIndicator` inside it renders `<!--v-if-->` when there is no status to show. An editor with an idle service therefore gets an empty bordered box pinned to the top of the scrollport. The owner's pasted DOM is exactly this element.

The 33-08 background row directly above it was written with an explicit *"don't render an empty box"* wrapper gate (`SlideGrid.vue:85-90`, citing 31-UI-SPEC E5) — **this bar is missing the same guard the codebase already established as the rule.**

---

## F5 — "Export to PC" appears removed ⚠ diagnosis incorrect, symptom real

**Owner:** *"You removed the Export to PC functionality. Now all I have is a Copy to PC button. We didn't want to get rid of the Export to PC."*

**Verified — it was NOT removed:**
- `ServiceEditorView.vue:165-196` — the **Export to PC** button is present, with its spinner, exported-check and upload icons, `data-testid="export-pc-btn"`, and its `onExportToPC` handler. The full Planning Center export modal is still there too (`:367-465`).
- It is gated `v-if="authStore.hasPcCredentials"`. The **Copy for PC** button at `:198` is that `v-if`'s `v-else` — *"shown when NO credentials OR service is draft"*.
- `auth.ts:51-57` — `hasPcCredentials` requires `pcAppId` and `pcSecret` to be non-null **and** non-empty. `auth.ts:107-108` loads both from the **org document** (`orgData.pcAppId` / `orgData.pcSecret`).

**So the export path is intact and the observed behaviour means `hasPcCredentials` evaluated false for this org.** Two candidate causes, and this finding is a **diagnosis task before it is a fix task**:
1. The org document genuinely has no PC credentials (cleared, never set, or written under different field names), or
2. a load-order/reactivity regression leaves `pcAppId`/`pcSecret` null at render time even though the org doc has them.

**Do not "fix" this by ungating the button** — that would surface an export that cannot authenticate. Find out which cause it is first. Also worth deciding separately: silently swapping to a differently-named button is what made this read as a deletion. Whatever the cause, an editor with no credentials deserves to be told that, not handed a different button with no explanation.

---

## Summary

**5 findings. 2 confirmed defects (F3, F4), 1 in-scope gap for this phase (F1), 1 layout consolidation (F2), 1 misdiagnosis with a real underlying symptom (F5).**

- **F1 changes the committed plans.** `34-07` picked the Service Order row as the mount seam; the owner reaches for scripture editing from the slide. Revise before executing.
- **F3 and F4 are not R064 work** and are recorded here only because they surfaced in the same session. Both are small, well-localised, and both have an established in-repo pattern to follow (F4's "don't render an empty box" guard already exists one component away).
- **F5 must be diagnosed, not patched.**

Nothing here was self-approved. F5's owner-facing correction is stated plainly rather than quietly worked around.
