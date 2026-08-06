# Phase 33 — UI Review

**Audited:** 2026-08-03
**Baseline:** 33-UI-SPEC.md (approved design contract), post-33-REVIEW-FIX.md (WR-01–WR-04 landed)
**Screenshots:** not captured — no dev server detected on :3000/:5173/:8080; this is a **code-only audit** against markup, classes, and ARIA attributes in source

---

## Pillar Scores

| Pillar | Score | Key Finding |
|--------|-------|-------------|
| 1. Copywriting | 3/4 | Contract strings match verbatim; one declared per-level `aria-label` ("Remove group/song background") was never threaded — `BackgroundControl.vue` ships the generic `"Remove background"` at both call sites |
| 2. Visuals | 3/4 | Card restructure is clean and matches spec, but the footer row now stacks kind badge + drag handle + label + audio chip + background chip in one line with no verified overflow test at the 200px floor — a real crowding risk the spec's own E1 "overflow" backstop for the menu doesn't cover for the chip row |
| 3. Color | 4/4 | Accent (indigo) usage traced to exactly the three declared uses (own-background chip, nav menu items, upload-progress text); destructive class matches `red-400`/`red-300` verbatim; no stray hardcoded hex found in the phase's five touched files |
| 4. Typography | 4/4 | All four declared sizes (10/11/12/14px) and both declared weights (400/500) used exactly where specified — chip is `text-[10px] font-medium`, caption `text-[11px]`, field label `text-xs font-medium`, menu item `text-sm` |
| 5. Spacing | 4/4 | Trigger is `p-1` (matching the corrected spec row, not the retracted 6px claim); menu panel `px-3 py-2`/`w-40`; background control rows `px-3 py-2`; group control `px-6 pt-2` — all verified verbatim against §-cited markup |
| 6. Experience Design | 3/4 | Locked-service behaviour correctly removes (not disables) mutating affordances; loading/error/empty states all present and copy-matched; but the WR-04 fix left a disclosed, un-remediated UX regression (no "Discard unsaved changes?" prompt on menu-driven song/scripture nav before the fix — now fixed per REVIEW-FIX, verified below) and one structurally-unreachable caption branch (`lowerLevelBackgroundLabel` never returns `'song'`) that leaves a real, if narrow, legibility gap the phase's own named core failure mode was supposed to close |

**Overall: 21/24**

---

## Top 3 Priority Fixes

1. **`lowerLevelBackgroundLabel` structurally can never return `'song'`** (`EditSlideDrawer.vue:847-851`) — a slide overriding a song-only background with no group in between shows NO removal caption at all instead of "the song's still applies." User impact: in exactly this one inheritance shape, the phase's own named core risk ("an override the user cannot see") re-appears in miniature — the user removing their override gets no warning that a song-level background will reappear. Fix: thread a song-background lookup into the drawer (the component already knows `resolvedBackgroundUrl`/`backgroundSource`; it needs the actual song URL for comparison, matching how `SlideGrid.vue`'s `songBackgroundForInheritedDisplay` already derives the equivalent value for the group control).

2. **`BackgroundControl.vue`'s Remove button ships one generic `aria-label` for two call sites** — spec's Copywriting Contract declares `aria-label="Remove group background"` and `aria-label="Remove song background"` as distinct strings (lines 147, 151 of 33-UI-SPEC.md); the shipped component hardcodes `aria-label="Remove background"` regardless of level (`BackgroundControl.vue:19`). User impact: low-severity but real for a screen-reader user navigating between the group and song controls on the same page (e.g., a SONG group's slide panel), where two controls now announce identically. Fix: add a `removeLabel: string` prop alongside the existing `addLabel` prop (which already threads per-level text correctly) and pass the two declared strings from each call site.

3. **Footer-row crowding at the 200px card floor is unverified** — `SlideCard.vue`'s footer (`data-testid="slide-card-footer"`) now packs kind badge, optional drag handle, truncating label, optional `ml-auto` audio chip, and optional `ml-1.5` background chip into one `flex items-center gap-1.5` row. The spec's own E1 "overflow" backstop only covers the *menu panel* at 200px, not this chip row, and no mounted-width test for the footer's five-element worst case (audio chip + background chip both present, short label) was found in the phase's test files. User impact: at the declared 200px card floor, a slide with both attached audio and its own background could visually collide or force the label to zero width. This needs a real browser or a targeted width-assertion test to settle — currently unverified in either direction.

---

## Detailed Findings

### Pillar 1: Copywriting (3/4)

- Menu item labels verified verbatim against `slideDisplay.ts`: `Edit details`, `Edit lyrics`, `Edit in song`, `Edit in scripture`, `Duplicate`, `Delete Slide` all present exactly as declared.
- Background-control copy verified verbatim: `+ Add background for this group`/`for this song` threaded via the `addLabel` prop (`BackgroundControl.vue:103`, `SlideGrid.vue`, `SongLyricEditor.vue` call sites); group "applies to all N slides..." caption and song's two caption variants both present in `SongLyricEditor.vue` and `SlideGrid.vue` matching the contract's exact sentences.
- Upload error/progress strings match `useMediaUpload.ts`'s phrasing pattern verbatim in `useBackgroundUpload.ts:84,88` ("Unsupported file type... only images can be set as a background." / "File is too large (max {N}MB).").
- **Gap:** `Remove` `aria-label`s. Spec §Copywriting Contract declares two distinct strings (`Remove group background`, `Remove song background`); shipped code has one generic string used at both mount points (`BackgroundControl.vue:19`). The audit_focus prompt itself flags this as an "open nit" and asks whether it matters — it does, marginally: it is a declared contract line, not an incidental omission, and the fix is a one-line prop addition already half-built (the sibling `addLabel` prop shows the pattern). Scored 3, not 4, because a declared, testable, per-element copy contract line was not honored.
- Slide-level three-state copy (`No background`, `Inherited from group`/`Inherited from song`, `Set for this slide only`, `Remove`, the two removal captions) verified verbatim in `EditSlideDrawer.vue:296-360`.

### Pillar 2: Visuals (3/4)

- Focal point: the slide grid remains the dominant visual element; the new menu trigger and background chip are secondary, low-contrast additions (`text-gray-500`, `bg-gray-800`) that don't compete with card content — consistent with the spec's stated intent not to over-signal routine actions.
- Icon-only menu trigger has `aria-label="Slide options"` — paired correctly (Pillar 6/Accessibility cross-check).
- Visual hierarchy: own-background chip (indigo) vs inherited chip (gray) reads as a genuine two-tier distinction by color alone, matching the spec's explicit "own vs inherited, opposite colors" design decision (§Color).
- **Concern (undercuts a full 4):** the card's number badge relocation (`right-1.5` → `right-9`, confirmed at `SlideCard.vue:32`) and the menu trigger's new `absolute right-1 top-1` position (confirmed at `SlideCard.vue:13-16`) sit close together in the card's top-right corner. At the spec-declared minimum 200px card width this is a tight corner with three stacked visual elements (number badge, menu trigger, and the preview's own content underneath) — plausible but not confirmed without a real screenshot at 200px. Marked as a real risk in the priority fixes, not just a nitpick, because the same corner also has to survive drag-and-drop visual affordances layered on top in the existing UI.

### Pillar 3: Color (4/4)

- Accent (indigo) count in the phase's touched files: 22 occurrences across 11 files, cross-checked against the three declared uses — own-background chip (`SlideCard.vue`), nav menu items (`SlideActionMenu.vue`, via the `tone === 'nav'` class binding), and upload-progress text (`BackgroundControl.vue`, `EditSlideDrawer.vue`). No stray new indigo use found on the menu trigger itself or on "Edit details"/"Edit lyrges" items — matches the spec's explicit prohibition ("nothing else in this phase gains indigo").
- Destructive class (`text-red-400 hover:text-red-300`) verified verbatim on "Delete Slide" (`SlideActionMenu.vue:44-49`) and on every "Remove" control (`BackgroundControl.vue:17`, `EditSlideDrawer.vue:348`) — matches `SlideGroupMusicControl.vue:26`'s existing precedent, neutral-until-hover as declared, never a permanent-red fill.
- Muted/inherited color (`gray-400`/`gray-800`/`gray-700`) confirmed on the inherited chip and inherited captions — the opposite-of-accent contrast the spec designed for is intact.
- No hardcoded hex/`rgb(` literals found in the five newly-authored/modified components.

### Pillar 4: Typography (4/4)

- Chip: `text-[10px] font-medium` (`SlideCard.vue:87`) — exactly the declared one-step-below-audio-chip size.
- Caption/provenance: `text-[11px]` used consistently across `BackgroundControl.vue`, `EditSlideDrawer.vue`'s background section, and the R058 audio hint — matches the declared 11px tier.
- Field label: `text-xs font-medium text-gray-400 mb-1` (`EditSlideDrawer.vue:304`) — verbatim reuse as declared.
- Menu item: `text-sm` (`SlideActionMenu.vue:43`) — matches declared 14px/400-weight tier; nav items differ only by color class, never weight, matching the spec's explicit "distinguished by colour only, never by weight" rule.
- Exactly 4 sizes / 2 weights in evidence across the phase's new markup — no invented tier found.

### Pillar 5: Spacing (4/4)

- Menu trigger: `p-1` (`SlideActionMenu.vue:6`) — confirmed to match the spec's **corrected** row (4px, not the original retracted 6px claim). This was explicitly called out in the audit focus as needing verification against the correction, and it checks out.
- Menu panel: `w-40`, `px-3 py-2` per item (`SlideActionMenu.vue:34,43`) — verbatim.
- Background control bordered row: `px-3 py-2` (`BackgroundControl.vue:2`) — matches `SlideGroupMusicControl.vue`'s cited precedent exactly.
- Group control placement: `px-6 pt-2` (`SlideGrid.vue`) — one step tighter than the music control's `pt-3`, matching the spec's stated "stack as a related pair" reasoning.
- No arbitrary/non-4px-grid spacing values found in the phase's new markup beyond the already-declared exceptions (12px, 4px rows in the Spacing Scale table).

### Pillar 6: Experience Design (3/4)

- **Loading:** `Uploading... {pct}%` present at both `BackgroundControl.vue:56-58` and `EditSlideDrawer.vue:356-358`, verbatim reuse as declared.
- **Error:** both fixed validation strings present verbatim in `useBackgroundUpload.ts`; a failed upload deliberately never emits `attach` (`BackgroundControl.vue:130-146`), matching the "failed upload never clears an existing attachment" contract.
- **Empty states:** three distinct empty-state copies (group/song "nothing set," slide "nothing anywhere") all present and distinguishable.
- **Locked-service behaviour:** verified against §11's table — `canMutate`/`canMutateBackground` compose `!serviceLocked` and gate every mutating control by `v-if`, not `:disabled`. No second lock notice found in the phase's new markup (confirmed no new "this is locked" caption added beside the drawer's single existing notice). This matches the audit_focus's explicit ask (affordances ABSENT, not disabled-and-explained) — correct.
- **Accessibility (folded in per audit_focus's weighting):** `aria-haspopup="menu"`/`aria-expanded` present on the trigger (`SlideActionMenu.vue:7-8`); `role="menu"`/`role="menuitem"` present on panel/items; per WR-03 (confirmed landed), a `watch` on `open` focuses the panel's first `[role="menuitem"]` via `nextTick()` (`SlideActionMenu.vue:118-125`), and `onPanelKeydown`'s `Escape` branch both emits `toggle` and calls `triggerRef.value?.focus()` (`:139-143`) — the full round-trip (open → focus moves in → Escape closes → focus returns to trigger) is present in source and covered by the rewritten regression test per 33-REVIEW-FIX.md. The card's `role="button" tabindex="0"` root uses `@click`/`@keydown.enter`/`@keydown.space.prevent`, and the menu trigger's own `@click.stop` (`SlideActionMenu.vue:11`) prevents the nested-activation double-fire the spec worried about — correct, mirrors the drag grip's established idiom. No arrow-key roving-tabindex — a disclosed, deliberate gap matching house precedent, not a defect.
- **Real gaps that cap the score at 3:**
  1. The `lowerLevelBackgroundLabel` "song" branch is structurally unreachable (`EditSlideDrawer.vue:847-851`) — confirmed by direct inspection, matching 33-VERIFICATION.md's own disclosed gap. This is exactly the phase's named core failure mode ("an override the user cannot see") recurring in one narrow, real scenario — not hypothetical, reproducible by inspection of the computed's own logic (it only ever checks `props.group?.backgroundImageUrl`, never a song-level value).
  2. The WR-04 fix (confirmed landed per 33-REVIEW-FIX.md, `EditSlideDrawer.vue` `defineExpose({ confirmDiscard })` + `SlidesTab.vue`'s `confirmLeavingOpenDrawer()`) closes the "Discard unsaved changes?" regression this pillar would otherwise have flagged as a BLOCKER — verified present in source, not just claimed in the fix report, since the drawer's `onClose`/`onKeydown` handlers now route through `unsavedGuard.confirmDiscard()`. Scored as resolved, not held against the phase.
  3. Storage-orphan cleanup on background removal/replacement (IN-01) remains explicitly out of scope/unfixed per 33-REVIEW-FIX.md — a real but low-severity gap (storage cost, not a UI/UX defect), noted here for completeness but not weighted into the score since it's not a rendering/interaction issue.

---

## Files Audited

- `src/components/slides/SlideActionMenu.vue`
- `src/components/slides/BackgroundControl.vue`
- `src/components/slides/SlideCard.vue`
- `src/components/slides/SlideGrid.vue`
- `src/components/slides/SlidesTab.vue`
- `src/components/slides/EditSlideDrawer.vue`
- `src/components/slides/slideDisplay.ts`
- `src/components/SongLyricEditor.vue`
- `src/composables/useBackgroundUpload.ts`
- `.planning/phases/33-backgrounds-slide-editing/33-UI-SPEC.md`
- `.planning/phases/33-backgrounds-slide-editing/33-REVIEW-FIX.md`
- `.planning/phases/33-backgrounds-slide-editing/33-VERIFICATION.md`

**Not verifiable without a real browser** (per the audit_focus's honesty requirement — recorded, not guessed at): actual flex-wrap behavior of the card footer row at 200px width with both chips present; real focus-order/tab-through of the menu panel under a screen reader; genuine drag-vs-menu-click non-interference during an actual pointer drag; the drawer preview's `background-image` compositing visually. These match items already deferred in `.planning/PENDING-VERIFICATION.md` and 33-VERIFICATION.md's `human_needed` status — this audit does not manufacture a grade for them.
