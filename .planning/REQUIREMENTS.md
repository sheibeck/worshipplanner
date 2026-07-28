# Requirements: WorshipPlanner v1.4 "Service and Slides"

**Defined:** 2026-07-28
**Core Value:** Smart weekly service planning that follows the Vertical Worship methodology (1→2→3 song
progression) while rotating through the full song stable and respecting team configurations.

**Milestone goal:** Make the Service Order and Slides tabs trustworthy — ordering that holds, saves you
can see, slides that always mirror the plan — and finish them against the Claude Design wireframes.

**Numbering:** continues from v1.3 (R028–R035). v1.4 owns **R036–R069**.

**Research basis:** `.planning/research/SUMMARY.md` and the four dimension files. Findings that constrain
these requirements are cited inline as `[SUMMARY]`, `[ARCH]`, `[PITFALL]`, `[STACK]`, `[FEAT]`.

---

## v1.4 Requirements

### Service Lifecycle

- [ ] **R036** (core-capability): A service is editable only while its status is `draft`. At `planned`
      or `exported`, the Service Order, Slides and Roles tabs are all read-only. Enforcement is
      three-layer — Firestore rules, store guard, and UI — because `firestore.rules` has **zero**
      status-based write guard today, making any UI-only lock bypassable. `[ARCH]` `[PITFALL]`
- [ ] **R037** (core-capability): An editor can explicitly reopen a non-draft service for editing,
      returning it to `draft`. When the service was already `exported`, the action warns that Planning
      Center holds the previously exported version. No competitor precedent exists for this pattern —
      Planning Center gates on role only. `[FEAT]`
- [ ] **R038** (quality-attribute): Creating a service defaults the date to the nearest Sunday that does
      not already have a service plan, rather than the nearest Sunday outright.

### Save Reliability

- [ ] **R039** (quality-attribute): Every mutation on the Service Order fires autosave, including
      discrete one-shot actions such as changing a song — not only continuous typing.
      **A failing repro test must be written before any fix.** The evidenced root cause (a save's own
      Firestore echo carrying a server `updatedAt` the client never tracked, resetting the
      `autosaveInitialized` guard and swallowing the next discrete mutation) is MEDIUM confidence and
      has never been reproduced against the live app. `[ARCH]` `[PITFALL]`
- [ ] **R040** (primary-user-loop): Every surface with autosave shows a persistent inline
      "Saving… / Saved HH:MM" status anchored to the content being edited, never above the fold. Backed
      by one `useSaveStatus` aggregator rather than per-surface implementations; `ServiceEditorView.vue`
      stops hand-duplicating the already-tested `useAutoSave` composable. `[ARCH]` `[STACK]`
- [ ] **R041** (quality-attribute): A save **failure** raises a toast. Success does not — at a 500ms
      debounce, success toasts are constant noise. Status region is `aria-live`. `[FEAT]` `[STACK]`

### Order Structure

- [ ] **R042** (core-capability): A fifth **Post-Service** section exists in both the service plan and
      the Slides tab, for content that runs as people exit. Structural only — no auto-advance or loop
      timer engine, which belongs to the live-presentation layer this app does not own. `[FEAT]`
- [ ] **R043** (core-capability): The five sections render in fixed order — Pre-Service → Worship →
      Message → Sending → Post-Service — are never draggable, and are always visible including when
      empty. Items move freely within and between them.
- [ ] **R044** (primary-user-loop): Dragging a service item lands it exactly where it was dropped, with
      the view correct immediately and no refresh required. Fixes three compounding bugs in
      `ServiceEditorView.vue`'s `onEnd`: `evt.oldIndex`/`newIndex` used where `oldDraggableIndex`/
      `newDraggableIndex` are required (section headers are counted despite the `draggable` selector),
      a DOM revert undoing only one adjacent step, and a `v-for` key rebuilt from `slot.position` which
      `reindexSlots()` rewrites every reorder. **The existing D-16 DOM-revert fix works and must not be
      re-applied.** `[ARCH]` `[PITFALL]`

### Slides Mirror the Plan

- [ ] **R045** (core-capability): Slide-group sequence and membership always mirror the service order.
      Reordering a service item reorders its slide group with no second manual step.
- [ ] **R046** (core-capability): Changing the song on a service item rewrites that group's slides to
      the new song automatically, with no review or confirmation step.
- [ ] **R047** (core-capability): Changing a scripture passage on a service item updates its scripture
      slide. A scripture slide defaults to one slide carrying the passage.
- [ ] **R048** (quality-attribute): The reconciliation/confirm flow is removed — `ReconcileConfirmModal`,
      `dismissedSignature`, and the confirm branches — replaced by one unconditional rebuild path.
      Spans 9 files plus tests. **Keep** the concurrent-write transaction merge in `replaceGroupSlides`.
      `dismissedSignature` is a persisted Firestore field: the leave-vs-backfill decision must be
      recorded explicitly, not made by omission. `[ARCH]` `[PITFALL]`

### Slides Interaction

- [ ] **R049** (primary-user-loop): Dragging a slide to a new position persists it there. Same
      root-cause family as R044 — the pattern is copy-pasted in `SlideGrid.vue`. `[ARCH]`
- [ ] **R050** (quality-attribute): Adding a slide appends it to the end of the group, not before the
      last slide.
- [ ] **R051** (primary-user-loop): A slide enters edit mode only via an explicit action in a 3-dot
      menu — never by clicking the slide — so slides can be dragged without triggering edit.
- [ ] **R052** (core-capability): The 3-dot menu offers "Edit details" and "Edit lyrics" as separate
      drawers, replacing the arrow affordance and the multi-tab single drawer.
- [ ] **R053** (quality-attribute): The group's drag-and-drop zone doubles as the import affordance when
      clicked; the separate "Import into this Group" button is removed. "Add slide" and "Add music to
      this group" move into the contextual action bar (R068).
- [ ] **R054** (core-capability): Song groups are read-only in the Slides tab — no create, update,
      delete, or reorder of their slides. Songs are edited only from the Song Lyrics screen, keeping the
      canonical-song guarantee (D002) intact.

### Backgrounds and Media

- [ ] **R055** (core-capability): A background image can be set for all slides in a group, mirroring the
      existing group-level music control.
- [ ] **R056** (core-capability): A background image can be set on a single slide, overriding the
      group's. Cascade is song > group > slide, extending the existing slide-beats-bed audio precedent.
      `[FEAT]` `[ARCH]`
- [ ] **R057** (core-capability): A background image can be set for a song from the Song Lyrics editor,
      applying wherever that song appears.
- [ ] **R058** (quality-attribute): Per-slide audio loses its "all slides in this group" scope option —
      group-wide audio is set only at group level. Per-slide audio remains. Supersedes the scope toggle
      shipped in **R030**.

### Presentation Correctness

- [ ] **R059** (quality-attribute): Organizational labels never render when presenting or previewing —
      they exist only to organize slides within a group.
- [ ] **R060** (quality-attribute): Copyright/CCLI information is visible on the first **and** last
      slide of every song group. **This exceeds the documented legal minimum** (the convention is at
      least once per song, typically the last slide) and is a deliberate safety margin for mid-deck
      starts and songs cut short. Must not be justified as a CCLI mandate; CCLI's primary license text
      remains unretrieved and should be pulled before this criterion is treated as final. `[FEAT]`
- [ ] **R061** (primary-user-loop): Previewing the slideshow starts at the highlighted group and its
      highlighted slide, or that group's first slide when none is highlighted.

### Smarter Content

- [ ] **R062** (core-capability): PowerPoint import produces a true visual representation of each slide —
      backgrounds, fonts, layout, effects — not text alone. Rendered server-side to images via a
      standalone Cloud Run service (LibreOffice + Poppler, custom Dockerfile — Firebase Functions
      buildpacks cannot install these), invoked asynchronously. Extracted text is retained as a
      searchable layer. Images land under `orgs/{orgId}/pptx-imports/{importId}/rendered/`, structurally
      exempt from `cleanupExpiredMedia`'s prefix guard. Only metric-compatible open fonts
      (Carlito/Caladea/Liberation) — never bundle Microsoft fonts. Orphan cleanup for failed renders
      **defaults to dry-run**; the inverse default already caused a real incident in this codebase.
      `[STACK]` `[PITFALL]`
- [ ] **R063** (core-capability): Slide-editing options vary by service-item type — a scripture item
      offers options a song item does not.
- [ ] **R064** (core-capability): A scripture item can be split into a congregational responsive reading
      with leader/congregation attribution. **The model returns only index ranges and speaker labels
      into already-fetched ESV text — never scripture words** — so altered or hallucinated scripture is
      structurally impossible rather than prompt-discouraged. Splits fall on clause/verse boundaries,
      never mid-sentence. Requires upgrading `@anthropic-ai/sdk` from the current `^0.78.0` pin, which
      predates the structured-outputs support this depends on. AI remains additive and never blocking.
      `[STACK]` `[PITFALL]` `[FEAT]`

### Lyric Editor

- [ ] **R065** (quality-attribute): Pasting lyrics detects missing copyright information and warns,
      rather than accepting silently.
- [ ] **R066** (quality-attribute): Paste-lyrics happens inline in the editor, not in a modal, per the
      design wireframes.

### UI Rework

- [ ] **R067** (primary-user-loop): The Service Order tab is rebuilt against Claude Design "Turn 3 —
      Service Order tab".
- [ ] **R068** (quality-attribute): Every tabbed screen shows only actions relevant to the open tab, via
      one shared contextual-action-bar pattern. Fixes "Suggest All Songs"/"Copy to PC" appearing on the
      Slides and Roles tabs; carries the Present button placement from design "1a". Sequenced after the
      Service Order and Slides layouts finalize, to avoid rework. `[SUMMARY]`
- [ ] **R069** (quality-attribute): The Roles tab is last in the tab order, being the least used.

---

## Future Requirements

Acknowledged, deferred, not in this roadmap.

| ID | Requirement | Why deferred |
|----|-------------|--------------|
| — | Live auto-advance / loop timer engine for Post-Service content | Belongs to the live-presentation layer this app deliberately does not own (ProPresenter is managed separately) |
| — | Full audit-log screen for reopen actions | 2–3 planners; a lightweight inline "last reopened by X at HH:MM" is proportionate `[FEAT]` |
| — | Approval workflow on reopening a service | Same — team is too small to justify it |
| — | Keyboard-accessible reordering (up/down buttons + `aria-live`) | Real gap SortableJS doesn't cover; additive, no new dependency, but not a v1.4 commitment `[STACK]` |
| 999.1 | Extract shared song-browse component (Songs page + service-plan picker) | Pre-existing backlog item; duplication confirmed still present |

## Out of Scope

| Feature | Reason |
|---------|--------|
| Editing imported PowerPoint slide *content* in-app | R062 renders decks to images for fidelity; correcting a deck means re-importing it |
| Slide editing for song groups in the Slides tab | R054 — songs are canonical; per-service edits reintroduce wrong-slides-at-rehearsal |
| Migrating slide-area or song-lyrics data | D-19: greenfield, never deployed. Change models directly, update tests |
| Replacing SortableJS | Defects are application-level and root-caused; `sortablejs@1.15.7` is current `[STACK]` |
| A toast library | Hand-rolled suits one failure toast + a status chip against an existing dark theme; `vue-toastification` unmaintained since 2022 `[STACK]` |
| Bundling Microsoft core fonts for PPTX rendering | Licensing — metric-compatible open substitutes only |
| Planning Center API sync | Standing project boundary — complement only |

## Traceability

Populated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| R036–R069 | TBD | Pending |

**Coverage:**
- v1.4 requirements: 34 total (R036–R069)
- Mapped to phases: 0
- Unmapped: 34 ⚠️ (roadmap pending)

---
*Requirements defined: 2026-07-28*
*Last updated: 2026-07-28 after v1.4 research synthesis*
