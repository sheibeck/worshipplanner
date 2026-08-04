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

- [x] **R036** (core-capability): A service is editable only while its status is `draft`. At `planned`
      or `exported`, the Service Order, Slides and Roles tabs are all read-only. Enforcement is
      three-layer — Firestore rules, store guard, and UI — because `firestore.rules` has **zero**
      status-based write guard today, making any UI-only lock bypassable. `[ARCH]` `[PITFALL]`

- [x] **R037** (core-capability): An editor can explicitly reopen a non-draft service for editing,
      returning it to `draft`. When the service was already `exported`, the action warns that Planning
      Center holds the previously exported version. No competitor precedent exists for this pattern —
      Planning Center gates on role only. `[FEAT]`

- [x] **R038** (quality-attribute): Creating a service defaults the date to the nearest Sunday that does
      not already have a service plan, rather than the nearest Sunday outright.

- [x] **R071** (quality-attribute): An editor who cannot export to Planning Center is told why, with a
      route to fix it. When Planning Center credentials are not configured for the organization, the
      service editor says so plainly beside the copy-for-Planning-Center fallback and links to Settings,
      instead of silently substituting a differently-named button. The export affordance itself stays
      gated — an export that cannot authenticate is never offered.
      *(Added 2026-08-03 from owner UAT finding F5, where the silent substitution read as the export
      feature having been deleted.)* `[FEAT]`
      **Delivered (34-12):** a `canEditService && !authStore.hasPcCredentials`-gated note beside Copy for
      PC names Planning Center credentials as the reason and links to Settings by route name; the Export
      to PC button's `v-if`/handler/modal are byte-unchanged and never ungated. F5's diagnosis verdict
      (`34-12-SUMMARY.md`): `hasPcCredentials` behaves correctly — a reactivity test proved it self-heals
      the instant the org document resolves — so the org document genuinely lacking credentials is the
      remaining explanation, not a load-order regression. Whether this organization's document actually
      has `pcAppId`/`pcSecret` cannot be observed from this environment — `PENDING-VERIFICATION.md` item
      34.6 (presence/absence only, never values) is open.

### Save Reliability

- [x] **R039** (quality-attribute): Every mutation on the Service Order fires autosave, including
      discrete one-shot actions such as changing a song — not only continuous typing.
      **A failing repro test must be written before any fix.** The evidenced root cause (a save's own
      Firestore echo carrying a server `updatedAt` the client never tracked, resetting the
      `autosaveInitialized` guard and swallowing the next discrete mutation) is MEDIUM confidence and
      has never been reproduced against the live app. `[ARCH]` `[PITFALL]`

- [x] **R040** (primary-user-loop): Every surface with autosave shows a persistent inline
      "Saving… / Saved HH:MM" status anchored to the content being edited, never above the fold. Backed
      by one `useSaveStatus` aggregator rather than per-surface implementations; `ServiceEditorView.vue`
      stops hand-duplicating the already-tested `useAutoSave` composable. `[ARCH]` `[STACK]`

- [x] **R041** (quality-attribute): A save **failure** raises a toast. Success does not — at a 500ms
      debounce, success toasts are constant noise. Status region is `aria-live`. `[FEAT]` `[STACK]`

### Order Structure

- [x] **R042** (core-capability): A fifth **Post-Service** section exists in both the service plan and
      the Slides tab, for content that runs as people exit. Structural only — no auto-advance or loop
      timer engine, which belongs to the live-presentation layer this app does not own. `[FEAT]`

- [x] **R043** (core-capability): The five sections render in fixed order — Pre-Service → Worship →
      Message → Sending → Post-Service — are never draggable, and are always visible including when
      empty. Items move freely within and between them.

- [x] **R044** (primary-user-loop): Dragging a service item lands it exactly where it was dropped, with
      the view correct immediately and no refresh required. Fixes three compounding bugs in
      `ServiceEditorView.vue`'s `onEnd`: `evt.oldIndex`/`newIndex` used where `oldDraggableIndex`/
      `newDraggableIndex` are required (section headers are counted despite the `draggable` selector),
      a DOM revert undoing only one adjacent step, and a `v-for` key rebuilt from `slot.position` which
      `reindexSlots()` rewrites every reorder. **The existing D-16 DOM-revert fix works and must not be
      re-applied.** `[ARCH]` `[PITFALL]`

### Slides Mirror the Plan

- [x] **R045** (core-capability): Slide-group sequence and membership always mirror the service order.
      Reordering a service item reorders its slide group with no second manual step. Proven over 50
      generated permutations of a mixed slot arrangement (order lock) and by re-verifying the single
      existing remove-element cascade delete unedited plus a new no-repeat-delete assertion (membership
      lock) — not example-based, per the phase's governing decision that this class of bug ("some
      particular arrangement desyncs") is what fixed-fixture tests systematically miss.

- [x] **R046** (core-capability): Changing the song on a service item rewrites that group's slides to
      the new song automatically, with no review or confirmation step.

- [x] **R047** (core-capability): Changing a scripture passage on a service item updates its scripture
      slide. A scripture slide defaults to **one slide showing the passage REFERENCE only** (e.g.
      "Psalm 103:1–5") — not the scripture text. Full scripture text is added only through the
      congregational reading feature (R064, Phase 34), which keeps that phase purely additive rather
      than a rewrite of this one. *(Clarified by the owner 2026-07-28 during Phase 30 discussion; the
      original wording "one slide carrying the passage" was ambiguous between reference and text.)*
      **Delivered shape changed during this phase's human-verify pass:** the slide derives directly
      from the SCRIPTURE slot's own book/chapter/verse fields (`scriptureRefFromSlot`), exactly as a
      SONG slot's `songId` is its slide's source — there is no separate scripture-reading document, ESV
      fetch, or linking step in the loop. Entering the reference on the Service Order tab is what makes
      the slide appear; editing it replaces the slide's content with no group write, resolved live at
      assembly time. The "Edit Scripture Slides" button, its reading-mode toggle, and the expandable
      editor panel are removed from the Service Order tab as a result (both editor components remain on
      disk, unmounted, for Phase 34/R064 to reuse). *(Superseded an initial fix — 3da5fe4 — that linked a
      separately-created reading document to the slot instead; the owner rejected that model in favor of
      the slot-as-source-of-truth shape landed in 5c531b1.)*

- [x] **R048** (quality-attribute): The reconciliation/confirm flow is removed — `ReconcileConfirmModal`,
      `dismissedSignature`, and the confirm branches — replaced by one unconditional rebuild path.
      Spans 9 files plus tests. **Keep** the concurrent-write transaction merge in `replaceGroupSlides`.
      `dismissedSignature` is a persisted Firestore field: the leave-vs-backfill decision must be
      recorded explicitly, not made by omission. `[ARCH]` `[PITFALL]`

### Slides Interaction

- [x] **R049** (primary-user-loop): Dragging a slide to a new position persists it there. Same
      root-cause family as R044 — the pattern is copy-pasted in `SlideGrid.vue`. `[ARCH]`

- [x] **R050** (quality-attribute): Adding a slide appends it to the end of the group, not before the
      last slide.

- [x] **R051** (primary-user-loop): A slide enters edit mode only via an explicit action in a 3-dot
      menu — never by clicking the slide — so slides can be dragged without triggering edit.

- [x] **R052** (core-capability): The 3-dot menu offers "Edit details" and "Edit lyrics" as separate
      drawers, replacing the arrow affordance and the multi-tab single drawer.

- [x] **R053** (quality-attribute): The group's drag-and-drop zone doubles as the import affordance when
      clicked; the separate "Import into this Group" button is removed. "Add slide" moves into the
      contextual action bar (R068).
      **Correction (2026-08-03, Phase 36 UI-SPEC):** the "Add music to this group" clause is
      **superseded by owner UAT finding F2** (`34-11-PLAN.md`, commits `98fdd29`/`2938d01`), which
      merged group music and group background into one panel in `SlideGrid.vue`
      (`slide-grid-group-media-panel`) in direct response to the owner reading the two controls as
      "two unrelated sections" when separated. The re-pulled wireframe (`docs/design/slides-tab.dc.html`,
      "1a Plan rail · slide grid · Edit Slide drawer") shows group music as its own inline panel below
      the grid header — not inside any action bar — and shows no background-image feature anywhere
      (confirmed absent, `docs/design/README.md`). Pulling music back out into the action bar would
      re-fragment the exact pairing the owner asked to have merged, on the strength of a mockup that
      does not itself show the bar placement. **Group music and group background stay together in the
      existing merged panel; only "Add slide" moves into the action bar.**

- [x] **R054** (core-capability): Song groups are read-only in the Slides tab — no create, update,
      delete, or reorder of their slides. Songs are edited only from the Song Lyrics screen, keeping the
      canonical-song guarantee (D002) intact.

### Backgrounds and Media

- [x] **R055** (core-capability): A background image can be set for all slides in a group, mirroring the
      existing group-level music control.

- [x] **R056** (core-capability): A background image can be set on a single slide, overriding the
      group's. **Most specific wins:** a slide's own background beats its group's, which beats the
      song's. (Stated as prose deliberately — arrow notation for this cascade appeared in both
      directions during planning and reads as backwards half the time.) Extends the existing
      slide-beats-bed audio precedent. `[FEAT]` `[ARCH]`

- [x] **R057** (core-capability): A background image can be set for a song from the Song Lyrics editor,
      applying wherever that song appears.

- [x] **R058** (quality-attribute): Per-slide audio loses its "all slides in this group" scope option —
      group-wide audio is set only at group level. Per-slide audio remains. Supersedes the scope toggle
      shipped in **R030**.

- [x] **R070** (core-capability): A slide's resolved background image is displayed while presenting, not
      only while authoring. The presented slide renders the single background the slide → group → song
      cascade already resolved (R055/R056/R057) — the presentation surface consumes that resolved value
      and never re-derives the cascade — with a legibility treatment so projected text stays readable
      over the image. A video slide's own video takes precedence: no background renders on a video
      slide. *(Added 2026-08-03 from owner UAT finding F3. R055 and R056 both describe SETTING a
      background and neither ever asked for it to render while presenting, which is why Phase 33
      verified green with authoring and preview complete and display absent.)* `[FEAT]`
      **Delivered (34-09):** `PresentationViewer.vue`'s `currentBackgroundUrl` computed reads the
      already-resolved `slide.backgroundImageUrl` with zero re-derivation, rendered behind a fixed scrim
      layer, and returns `null` whenever a video is playing (video-precedence rule). The perceptual
      legibility check on a real projector remains open — `PENDING-VERIFICATION.md` item 34.4.

### Presentation Correctness

- [x] **R059** (quality-attribute): Organizational labels never render when presenting or previewing —
      they exist only to organize slides within a group.

- [x] **R060** (quality-attribute): Copyright/CCLI information is visible on the first **and** last
      slide of every song group. **This exceeds the documented legal minimum** (the convention is at
      least once per song, typically the last slide) and is a deliberate safety margin for mid-deck
      starts and songs cut short. Must not be justified as a CCLI mandate; CCLI's primary license text
      remains unretrieved and should be pulled before this criterion is treated as final. `[FEAT]`

- [x] **R061** (primary-user-loop): Previewing the slideshow starts at the highlighted group and its
      highlighted slide, or that group's first slide when none is highlighted.

### Smarter Content

- [~] **R062** — ⚠ **PARTIALLY DELIVERED (Phase 37, 2026-08-03).** The full pipeline is built and
      automated-tested end to end: `render-service/` (LibreOffice + Poppler, custom Dockerfile, font
      policy build-time gate, fontconfig substitution aliases — 39/39 tests), the bridging function
      (`requestPptxRenderHandler`, independent-recount completeness check, `renderInvoker.ts`'s
      IAM-authenticated Cloud Run call — 70/70 `functions/` tests), and the dry-run-by-default orphan
      sweep (`cleanupOrphanRendersHandler`, mirroring the post-9f1b881 fail-safe gate shape).
      **What is NOT delivered:** (1) the service is **not deployed** — STATE.md's standing v1.4
      decision was explicitly BUILD BUT DO NOT DEPLOY, so `PPTX_RENDER_SERVICE_URL` is unset and
      every render fails closed by design (`failureReason: "render-service-not-configured"`) until the
      owner runs `render-service/DEPLOY.md`'s handoff command; (2) **no UI consumes the rendered
      images yet** — 37-CONTEXT.md explicitly defers "client-side display rework for rendered images
      beyond storing and referencing them" to a later phase, so even once deployed, nothing in the app
      shows a rendered slide to a user. Real visual fidelity, font substitution, and cost/latency are
      consequently unverified (`PENDING-VERIFICATION.md` items 37.1–37.3). Original requirement text
      follows:

- [ ] **R062** (core-capability): PowerPoint import produces a true visual representation of each slide —
      backgrounds, fonts, layout, effects — not text alone. Rendered server-side to images via a
      standalone Cloud Run service (LibreOffice + Poppler, custom Dockerfile — Firebase Functions
      buildpacks cannot install these), invoked asynchronously. Extracted text is retained as a
      searchable layer. Images land under `orgs/{orgId}/pptx-imports/{importId}/rendered/`, structurally
      exempt from `cleanupExpiredMedia`'s prefix guard. Only metric-compatible open fonts
      (Carlito/Caladea/Liberation) — never bundle Microsoft fonts. Orphan cleanup for failed renders
      **defaults to dry-run**; the inverse default already caused a real incident in this codebase.
      `[STACK]` `[PITFALL]`

- [x] **R063** (core-capability): Slide-editing options vary by service-item type — a scripture item
      offers options a song item does not.

- [x] **R064** — ✅ **DELIVERED, GAP CLOSED (34-08 phase gate, 2026-08-03).** Two halves, both now
      closed. **Structural guarantee (34-01..34-04):** the schema permits no string field except the
      `speaker` enum, section text is sliced byte-exactly from the untouched ESV source, boundaries are
      computed once, and 19 distinct validator rejection cases cover the failure space — never
      hallucinated or regenerated scripture, by construction, not by prompt discipline.
      **Reachability closure (34-05..34-08):** `ScriptureSlot.congregationalSections` plus one shared
      derivation helper (`congregationalSlideFieldsFromSlot`) thread through both `slideshowAssembler.ts`
      call sites; `CongregationalEditor.vue`'s persistence was rewritten off the rejected separate
      reading-document model onto a prop/emit contract; and the editor is mounted by `ServiceEditorView.vue`
      as a keyed (`:key="congregationalSlot.id"`, WR-04) `Teleport`ed modal reached from the scripture
      **slide** itself (its 3-dot menu and Edit Slide Drawer) — the 2026-08-03 owner decision (UAT F1),
      with no free-text scripture override added anywhere. `34-08-SUMMARY.md`'s
      `congregationalReadingPipeline.test.ts` proves the composition end to end: both materialization
      paths agree, a group rebuild does not disturb stored sections, and the assembled slide satisfies
      `PresentationViewer`'s own `isCongregational` predicate. `PENDING-VERIFICATION.md` item 34.2 is
      resolved. **Two checks remain human-only and open, in the same breath as this delivery, not a
      footnote:** item 34.1 (empirical split determinism against Psalm 136 and Psalm 24, run more than
      once each) and item 34.3 (the mounted affordance itself and its projection, reached by both
      routes). This note describes R064 only — plans 34-09..34-12 close four owner UAT findings (F2, F3,
      F4, F5) that are not R064 scope; see R070 and R071 for those. Original requirement text follows:

- [x] **R064** (core-capability): A scripture item can be split into a congregational responsive reading
      with leader/congregation attribution. **The model returns only index ranges and speaker labels
      into already-fetched ESV text — never scripture words** — so altered or hallucinated scripture is
      structurally impossible rather than prompt-discouraged. Splits fall on clause/verse boundaries,
      never mid-sentence. Requires upgrading `@anthropic-ai/sdk` from the current `^0.78.0` pin, which
      predates the structured-outputs support this depends on. AI remains additive and never blocking.
      `[STACK]` `[PITFALL]` `[FEAT]`

### Lyric Editor

- [x] **R065** (quality-attribute): Pasting lyrics detects missing copyright information and warns,
      rather than accepting silently.

- [x] **R066** (quality-attribute): Paste-lyrics happens inline in the editor, not in a modal, per the
      design wireframes.

### UI Rework

- [ ] **R067** (primary-user-loop): The Service Order tab is rebuilt against Claude Design "Turn 3 —
      Service Order tab".

- [x] **R068** (quality-attribute): Every tabbed screen shows only actions relevant to the open tab, via
      one shared contextual-action-bar pattern. Fixes "Suggest All Songs"/"Copy to PC" appearing on the
      Slides and Roles tabs; carries the Present button placement from design "1a". Sequenced after the
      Service Order and Slides layouts finalize, to avoid rework. `[SUMMARY]`

- [x] **R069** (quality-attribute): The Roles tab is last in the tab order, being the least used.

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

| Requirement | Phase | Status |
|-------------|-------|--------|
| R036 | Phase 31 | Complete |
| R037 | Phase 31 | Complete |
| R038 | Phase 31 | Complete |
| R039 | Phase 32 | Complete |
| R040 | Phase 32 | Complete |
| R041 | Phase 32 | Complete |
| R042 | Phase 29 | Complete |
| R043 | Phase 29 | Complete |
| R044 | Phase 29 | Complete |
| R045 | Phase 30 | Complete |
| R046 | Phase 30 | Complete |
| R047 | Phase 30 | Complete |
| R048 | Phase 30 | Complete |
| R049 | Phase 29 | Complete |
| R050 | Phase 29 | Complete |
| R051 | Phase 33 | Complete |
| R052 | Phase 33 | Complete |
| R053 | Phase 36 | Complete |
| R054 | Phase 30 | Complete |
| R055 | Phase 33 | Complete |
| R056 | Phase 33 | Complete |
| R057 | Phase 33 | Complete |
| R058 | Phase 33 | Complete |
| R059 | Phase 35 | Complete |
| R060 | Phase 35 | Complete |
| R061 | Phase 35 | Complete |
| R062 | Phase 37 | Partial — pipeline built + automated-tested end to end; deploy and UI consumption NOT delivered (owner instruction: build but do not deploy) |
| R063 | Phase 33 | Complete |
| R064 | Phase 34 | Complete — reachability gap closed by 34-07 (2026-08-03) |
| R065 | Phase 35 | Complete |
| R066 | Phase 35 | Complete |
| R067 | Phase 36 | Pending |
| R068 | Phase 36 | Complete |
| R069 | Phase 36 | Complete |
| R070 | Phase 34 | Complete |
| R071 | Phase 34 | Complete |

**Coverage:**

- v1.4 requirements: 36 total (R036–R071)
- Mapped to phases: 36
- Unmapped: 0 ✓

**Phase → requirement-count summary:**

| Phase | Name | Requirements |
|-------|------|---------------|
| 29 | Order Structure — Stable Reordering & Post-Service | R042, R043, R044, R049, R050 (5) |
| 30 | Slides Mirror the Plan — Hard Lock & Reconciliation Removed | R045, R046, R047, R048, R054 (5) |
| 31 | Service Lifecycle — Draft Lock & Reopen | R036, R037, R038 (3) |
| 32 | Save Reliability — Autosave Fix & Persistent Status | R039, R040, R041 (3) |
| 33 | Backgrounds & Slide Editing | R051, R052, R055, R056, R057, R058, R063 (7) |
| 34 | Smarter Content — LLM Scripture Split | R064, R070, R071 (3) |
| 35 | Presentation Correctness & Lyric Editor | R059, R060, R061, R065, R066 (5) |
| 36 | UI Rework — Service Order & Contextual Action Bars | R053, R067, R068, R069 (4) |
| 37 | PowerPoint Server-Side Rendering | R062 (1) |

---
*Requirements defined: 2026-07-28*
*Last updated: 2026-07-28 — ROADMAP.md created (Phases 29-37); traceability filled, 34/34 requirements mapped, 0 unmapped*
