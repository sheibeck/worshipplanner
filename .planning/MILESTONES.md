# Milestones

## v1.5 Settings, Sharing, and Fidelity (Shipped: 2026-08-10)

**Phases completed:** 13 phases, 49 plans, 110 tasks

**Key accomplishments:**

- Two new mount-based Vitest harnesses (SettingsView.test.ts, SongsView.test.ts) against unmodified source, both carrying a forward-compatible settings-shaped auth-store mock and a shared findImportSongsButton selector for Wave 2 to reuse.
- Typed `OrgSettings`/`Organization` shape in `src/types/organization.ts`, a single defaults-merge point in `auth.ts::loadOrgContext`, and a dual-read for `vwModeEnabled` that cannot silently re-enable a deliberately-off church.
- Two new Settings toggles (AI Features, Planning Center enable) and a relocated `vwModeEnabled` write target, all three now writing concurrency-safe Firestore dot-path leaf keys instead of flat or whole-map fields.
- Single `isAiEnabled()` guard in `claudeApi.ts` gates exactly the 3 network-calling exports (proven at the module entry point via the existing Anthropic SDK mocks), and three composed `v-if`s hide the corresponding UI affordances without touching any pre-existing state.
- Five of the six enumerated Planning Center entry points (export action-bar item, export dialog invocation, the set-up hint row, both roster import triggers, and the song import trigger) are hidden with `v-if`/composed-early-return gates on `authStore.settings.pcEnabled`, with the export item's gate proven at the data level and no credential or already-imported data path touched.
- Independently re-ran the full type gate and test suite over the assembled phase, confirmed both green against their documented baselines, mapped R073/R088/R089 each to a real passing command, reconfirmed the firestore.rules finding in writing, and closed the last gap in the phase's manual-verification disclosure — the congregational editor button-row reflow backstop that 39-03 had not yet recorded.
- Added a claim-first dual-read (`isOrgMemberByClaim || isOrgMemberByFirestore`) to `storage.rules` and rewrote `src/storage.rules.test.ts` so every assertion is non-vacuous — turned the measured-baseline `2 failed | 96 passed (98)` into `0 failed | 103 passed (103)`.
- Single `onDocumentWritten` trigger (`syncOrgMembershipClaim`) that computes and sets the `{ orgId, role }` custom auth claim from `organizations/{orgId}/members/{uid}` writes, sharing its decision logic (`decideMembershipClaim`) for plan 40-04's backfill to reuse — built and unit-tested, never deployed.
- Forced `getIdTokenResult(user, true)` on every `loadOrgContext` load, with a P-01-scoped bounded retry (4 attempts × 1500ms) that fires only on the just-created-membership path — the ordinary already-a-member path pays exactly one refresh with zero added latency.
- `backfillOrgMembershipClaims` -- an idempotent, dry-run-by-default Node script over `collectionGroup('members')` that shares its decision logic with the trigger via `decideMembershipClaim` -- plus `functions/DEPLOY-ORG-CLAIMS.md`, the exact owner-run two-deploy sequence with a mandatory one-hour soak and multi-org pre-check between the two deploys.
- Replaced Firestore's unconditional `allow create` on `members/{uid}` with an OR of two explicit, emulator-proven flow branches (`getAfter()` for org founding, `get()`/`exists()` with role-pinning for invite acceptance), closing a pre-existing privilege-escalation hole where any signed-in user could self-join any org at a role of their choosing.
- Loosened `shareTokens`' unconditional update denial to the org-scoped `isOrgEditor` idiom and added a new absence-tolerant `serviceShareLinks/{serviceId}` CRUD block, proven by 20 new/replaced emulator-backed tests including two load-bearing genuine ALLOW cases.
- Pure `src/utils/shareTokens.ts` module extracting R078's mint and adopt-vs-mint decisions into dependency-free, exhaustively-tested functions — no Firestore, no Pinia, no mock, and no `orderBy` anywhere in the diff, closing off the composite-index production failure mode the research pass found.
- `ensureShareLink` replaces "mint a fresh token and freeze a snapshot on every call" with "resolve one stable token per service — reading `serviceShareLinks/{serviceId}`, else adopting the most recent already-circulated `shareTokens` doc, else minting — then always writing the current payload in place," with a `runTransaction` re-read making concurrent first-shares converge on a single token.
- `maybeRefreshShareLink(id, overrides?)` hooked into `updateService`, `setRoleOverride` and `clearRoleOverride` so a previously-shared service's public snapshot — including role overrides — stays current after every save, with zero write-back to the service document, a soft-fail that never breaks the user's save, and a per-session cache so an unshared service costs nothing extra.
- Closed a live-in-production Firestore write hole letting any org editor forge a `pptxRenders` render-status doc to `ready`, and made read access an intentional member-tier grant instead of an accident of wildcard fallthrough — both proven RED-then-GREEN against the real emulator.
- Client PptxRenderDoc type, a byte-identical rendered-page Storage-path builder, and a Pinia store managing a dynamic set of live per-renderImportId Firestore listeners — the phase's one genuinely new design (no prior codebase analog).
- `src/utils/importedRenderReconciler.ts` — the single render-decision-table helper (resolveImportedRender/importedEntryIdentities/renderedPageNumberFromIdentity/importedEntryContent/importedSourceSignature) both assembly engines will consume, plus the two `SlideBase` render-state fields and two `AssemblyInputs` maps it needs.
- `slideGroupMaterializer.ts`'s two IMPORTED branches now read from the one shared reconciler instead of a second, unsafe decision table — and a `pending`/`failed` → `ready` render transition is proven, by test, to rebuild exactly once and never destroy a user's own slides.
- `slideshowAssembler.ts`'s two IMPORTED branches now read from the one shared reconciler instead of a direct `deck.slides` lookup — proven by 10 new tests that a pending/failed render is a present slide, page 1 and the last page of a multi-page render resolve to their own URLs, and the grid and presenter agree content-for-content.
- Added the grid's two explicit R080 states — an indigo "Rendering…" pending tile and a red "Render failed" tile with a mapped human sentence — plus the one sanctioned `slideDisplay.ts` lookup that turns any `failureReason` slug into one of three authored sentences.
- Added the presenter's two explicit R080 states — an indigo "This slide is still rendering." pending block and an amber "This slide couldn't be rendered." failed block with the same mapped caption the grid uses — and proved by test that neither state removes a slide from `props.slides`, `hasSlides`, `atFirst`, `atLast` or the `n / m` progress count.
- A fifth live `onSnapshot` subscription and a second async URL-caching loader in `useSlideshowAssembly.ts` make a `pending → ready` render transition update the grid and presenter once, with no reload, bounded Storage calls, and no possibility of a stale page array — this is what makes ROADMAP criterion 4 observable end to end.
- Widened `SlotKind` with `ANNOUNCEMENTS`/`MISC` and one shared optional `NonAssignableSlot.body?: string` field, then used `npm run type-check`'s compiler-surfaced worklist (plus three compiler-silent sites found by hand) to close every `switch (slot.kind)` in the codebase with an explicit case — zero new `default` arms.
- Converted `addSlotAsItem`'s unguarded if-chain — whose implicit final `else` labelled every unhandled `SlotKind` "Message" — into an exhaustive, compiler-guarded dispatch with an explicit branch per kind and a `never`-typed backstop that fails `vue-tsc --build` if a future kind is ever left unhandled.
- Gave the planner the editor surface for the new item kinds: two new palette chips (Announcements, Miscellaneous) added to both palette rows, the Hymn chip retired from the palette (but not the type), one shared body `<textarea>` serving Message/Announcements/Miscellaneous, and the Message URL control removed from the markup while its `linkUrl`/`linkLabel` type fields and stored values remain untouched.
- Closed the print/share silent-omission gap for ANNOUNCEMENTS/MISC (T-43-12), added the standing cross-surface HYMN absence-of-regression suite proving R084's hard half, and empirically proved the `addSlotAsItem` exhaustiveness backstop fires both at compile time and at runtime.
- `buildSlotsFromTemplate()` builds a new service's slots from `OrgSettings.defaultServiceTemplate`, computing Vertical Worship types at creation by walking SONG entries as an ordinal sequence (not array position) into `PROGRESSION_SLOT_TYPES`, with an empty/unset template deliberately producing a zero-slot service instead of the old automatic 1-2-3 default.
- `ServiceTemplateEditor.vue` — a Teleported, no-scrim slide-out that structurally ports `EditSlideDrawer.vue`'s panel shell around Phase 43's closed six-chip palette and `ServiceEditorView.vue`'s per-section SortableJS reorder, wired into a new "Services" card on `SettingsView.vue` with a live item/section-count summary — completing R086's UI half on top of Plan 44-01's storage engine.
- NLT scripture proxy (query-param secret injection) and DOMParser-based nltApi.ts client, built and unit-tested against real NLT response fixtures, shipped built/tested/UNDEPLOYED per the standing v1.5 NO-DEPLOYS grant.
- Church-level `bibleVersion: 'ESV' | 'NLT'` field defaulting to NLT (owner's locked override) via the single existing `loadOrgContext` merge, plus a "Bible Translation" Settings card mirroring the AI/Planning Center/Vertical Worship toggle cards exactly.
- Established the data-layer foundation that makes R091 attribution and R092 immutability true by construction: an optional `translationSource` field on the scripture-slide / congregational-section / source-ref types, two pure helpers (`scriptureAttribution` for initials-only attribution, `resolveTranslationSource` whose hardcoded `?? 'ESV'` fallback never reads the live org setting), and materializer/assembler threading that carries a stamped value through without re-deriving it — proven by a named R092 invariant test.
- Closes R091 and R092 end to end: `CongregationalEditor.vue`/`ScriptureInput.vue` route ESV/NLT scripture fetches by the church's `bibleVersion` setting, `CongregationalEditor.vue` stamps `translationSource` exactly once at fetch time (never restamped by a later setting change or a subsequent AI split), and both scripture render sites (`PresentationViewer.vue`, `slideDisplay.ts::slideBodyText()`) append the one shared `(ESV)`/`(NLT)` attribution suffix, driven entirely by each slide's own resolved provenance.
- Five self-hosted @fontsource packages (Inter, Open Sans, Poppins, Lora, Source Serif 4) pinned at 5.3.0, with a typed `SLIDE_FONTS` registry whose license and weight-ramp claims were verified directly against each package's own LICENSE/CSS files rather than assumed.
- `OrgSettings.slideTypography` field + default, and a pure `src/utils/slideTypography.ts` module (CSS-var computation, weight snapping, the bounded R094 font-load gate, and the on-demand font-CSS loader) — unit-tested independently of any component mount, plus the `:root` CSS variables and app-init eager import of the default face.
- Added the "Slide Typography" card to Settings — font-family/weight selects, a Small/Medium/Large size control, and a live Preview bound to the shared `cssVarsFor` — as the single editor-gated write point for `authStore.settings.slideTypography`, with family-change weight snapping and on-demand font loading.
- Wired the church's chosen slide typography (family/weight/scale) into the grid, drawer preview, and presenter — and gated the presenter's first paint on that font being resident (R094), closing UI-SPEC unresolved item #1 with a bounded 3000ms timeout.
- Task 1 — ALL speaker unions, `isFirstSection`, AI split schema + validator widen
- Reworked `CongregationalEditor.vue` from fetch-auto-splits-then-binary-toggle into a boundary-indexed hand-divide editor with three equal seeds (AI/Alternate/Blank), click-between-verses gap-+ dividers, a 3-way Leader/Congregation/All chip, and a re-seed confirm — all three seeds resolve to the same draft shape via a byte-exact text-to-boundary alignment helper.
- Task 1 — Failing tests (RED)
- Intl.Collator natural-order sort closes the slide10-before-slide2 drop defect; a synchronously-seeded localStorage flag makes the Getting Started panel dismissible per-device
- Responsive Slides-tab stacking (rail-above-grid + horizontal-scroll strip), 44px hit areas on the drag handle and menu trigger, and additive SortableJS touch options on the existing instance — all unit-proven, with the two physical-device backstops deferred to the owner.
- Print and Share moved into the top ContextualActionBar with reused icon SVGs, Undo demoted to a text link beside the save-status text, and the header Save-area row now stacks on a phone using QuarterView's recipe — all three landing on a type-clean commit at every step.
- A congregational scripture reading now assembles to N+1 slides — a dedicated leading reference slide (byte-identical to a plain scripture reference slide) plus one text-only slide per section — emitted at assembly time on both assembler paths (approach B), with the reference eyebrow removed from every section slide.
- A 9-case preservation suite proving `slideGroupMaterializer.ts`'s existing derived-vs-user-added split already guarantees R107 end-to-end — zero production code changed.
- Threads a 1-based source-slide page reference from `officeparser`'s AST through the `parsePptx` callable, `PptxImportModal`, and `SlideGrid.onImportConfirmed` onto a hand-added imported entry's `sourceRef.renderedPage`, entirely optional and backward-compatible with every pre-phase deck.
- Per-group "Remove imported slides" bulk-delete control in `SlideGrid.vue`, gated behind the existing `canMutateGroup` seam and a `window.confirm` prompt, writing through `replaceGroupSlides`'s CR-02 concurrent-merge with the source signature left unchanged.
- A hand-added imported PPTX slide now resolves to its correct rendered page for multi-image decks by consuming the 50-03 `renderedPage` reference, closing the gap the ec217aa 1:1 positional resolver could never handle.

---

## v1.4 Service and Slides (Shipped: 2026-08-05)

**Phases completed:** 10 phases, 61 plans, 147 tasks

**Key accomplishments:**

- Committed failing reproductions of the ZTXcpNRcJTalEQp42fTx drag-reorder bug (R044) and the SlideGrid append-order defect (R050), built on a DOM-derived (never hand-passed) drag-index harness that reproduces exactly what the pre-existing header-free/tile-free fixtures could not catch.
- groupBySection/flattenBySection/orderSlotsBySection in slotTypes.ts — total, SERVICE_SECTIONS-driven, identity-preserving ordering contract, plus an audit confirming defaultSectionForPosition needs no change for the fifth section.
- Rebuilt `ServiceEditorView.vue`'s drag-reorder from a single flat Sortable list to one Sortable instance per `SERVICE_SECTIONS` container (always visible, sharing a `service-slots` group for cross-section drag), keyed on the stable `slot.id`, with `reindexSlots(orderSlotsBySection(...))` composed at every mutation site so the rendered order and the persisted order can never diverge — plus a real revert-and-surface path for a rejected reorder write.
- SlideGrid.vue's reorder/append defects fixed via draggable-scoped indices, a single `appendToGroup` sort-append-renumber contract shared by all three append paths, and an inline reorder-failure surface that replaces a hand-rolled DOM revert with a props-driven re-render.
- Widened `SERVICE_SECTIONS`/`SERVICE_SECTION_LABELS`/`ServiceSection` to a fifth, last member (`'post-service'`) with zero migration and zero source changes anywhere except `src/types/service.ts` and one placeholder-copy branch in `ServiceEditorView.vue` — confirmed by test, not assumed, that all four downstream consumers (slideshow assembly, print layout, Planning Center export, plan rail) already propagate it correctly.
- Deleted the entire reconcile/confirm-modal UI surface (component, prop chain, store decline-action, and confirm-copy builder) from the Slides tab, leaving the concurrent-write transaction merge untouched and a narrower prop surface for 30-02's unconditional-rebuild engine.
- Replaced the three-branch confirm-gated slide-group reconciler with one unconditional, idempotent rebuild per slot kind, generalizing SONG's hand-added-slide survival to SCRIPTURE and IMPORTED groups in the same commit that deleted the confirm gate, and narrowed scripture derivation to a single reference-only slide.
- Song groups in the Slides tab now expose zero slide create/update/delete/reorder affordances — controls are absent from the DOM, not disabled — while retaining group-level bed audio and the existing Edit in song link, plus a new muted read-only notice on both the drawer and the grid.
- Proved R045's order and membership lock with a 50-permutation property test (this codebase's first), ran the phase's widened reconciliation-symbol removal gate clean, and closed the phase through a human-verify pass that failed twice — a song-group drop tile still advertising an action its handler silently rejected (R054), and a scripture item producing NO slide at all because nothing in `src/` ever wrote `scriptureReadingId` onto its slot (R047) — the second failure's real fix rebuilding scripture derivation around the SCRIPTURE slot's own book/chapter/verse fields instead of a linked reading document.
- 2026-07-30
- 2026-07-30
- `toggleStatus` is gone
- Every site matched the class the UI-SPEC assigned it.
- Plan gate 1
- 2026-07-30
- Reproduced (live, not merely hypothesized) that a save's own Firestore echo swallows the next discrete mutation, then fixed it in `serviceStore.subscribe()` via `onSnapshot({includeMetadataChanges: true})` + per-doc `metadata.hasPendingWrites`, not a view-layer `updatedAt` patch.
- Extended `useAutoSave`'s status union to a five-member `'idle' | 'pending' | 'saving' | 'saved' | 'error'`, added a generic catch on both save paths so a rejected `saveFn` sets `'error'` instead of stranding at `'saving'`, and removed the 3-second saved-to-idle fade so `'saved'` is now terminal.
- Two client-only Pinia stores — a per-surfaceId save-status aggregator with a deterministic "most urgent" rollup, and a minimal array-backed failure-toast store — wired together so a save failure raises exactly one toast per episode, from inside `set()`, with zero Firestore involvement in either store.
- Two new components — a single shared `aria-live` save-status span consumed by four surfaces, and an app-level `role="alert"` failure-toast stack mounted once in `AppShell.vue` — built verbatim from 32-UI-SPEC.md's markup against the real `useSaveStatus`/`useToasts` Pinia stores plan 03 shipped, with no surface migrated yet.
- Deleted ServiceEditorView's ~150-line hand-rolled autosave duplicate in favor of `useAutoSave` (folding the lock into its dirty computed) plus a shared `useSaveStatus` store, and replaced the header's inline status text with one sticky `service-save-status-bar` that stays on screen underneath a long Service Order — the largest single de-duplication in Phase 32, landing at exactly a 100-line net reduction.
- Rolled the shared `SaveStatusIndicator`/`useSaveStatus` pair out to `CongregationalEditor.vue`, `ScriptureSlideEditor.vue` and `SongLyricEditor.vue` — retiring the nine per-status `data-testid`s these three duplicated, resolving the surface-id race the phase's own RESEARCH flagged as its sharpest UI-layer correctness risk, and fixing a same-plan regression in an out-of-scope test file this migration exposed. This is Phase 32's last plan.
- Three-level `backgroundImageUrl` fields (slide/group/song) plus a resolved tri-state `backgroundSource`, wired into `resolveEntryMedia`'s existing slide/group precedence — computed ahead of the video audio carve-out so a video slide keeps its background but not its bed audio.
- Pure per-kind 3-dot menu item list (`slideActionMenuItems`) plus the codebase's first real ARIA menu component (`SlideActionMenu.vue`), both fully unit-tested and unwired — no existing surface changed yet.
- Image-only 10MB-capped Firebase Storage upload composable (`orgs/{orgId}/backgrounds/
- Deleted `GroupSlideEntry.audioScope`, the drawer's two-write-route scope toggle, and the stale store doc-comment paragraph — leaving one attach route and a hint naming `SlideGroupMusicControl.vue` as where group-wide audio now lives.
- Swapped `SlideCard.vue`'s root from a native `<button>` to a `role="button"` div so `SlideActionMenu` can legally nest, and added a three-variant background provenance chip read directly off the assembled slide.
- A `setSongBackground` Pinia store action (explicit `deleteField()` clear, mirroring `setGroupBedMedia`) plus the existing `BackgroundControl.vue` mounted as a new sibling row in `SongLyricEditor.vue`, with the song's least-specific-tier caption copy and no `inheritedFrom`.
- `EditSlideDrawer.vue` gained a `mode: 'details' | 'lyrics'` prop (one component, no tabs), a three-state Slide Background section wired through `useBackgroundUpload`, and a nonce-keyed `pendingAction` seam that routes menu-dispatched Delete onto the drawer's existing confirm rather than a second, quieter path.
- Added a `setGroupBackground` store action (mirroring `setGroupBedMedia` exactly), mounted `BackgroundControl` as a new sibling row below the group's music control, and made `SlideGrid.vue` the single owner of menu state — one `openMenuEntryId` ref, per-card items sourced entirely from `slideActionMenuItems`, and a new `menu-action` emit the tab one level up will dispatch.
- `SlidesTab.vue`'s `onSelectSlide` is reduced to a one-line selection-only handler (R051's entire fix), and a new `onMenuAction` dispatches all six 3-dot menu keys from one place — the two edit keys open `EditSlideDrawer` in the matching mode, the two navigation keys route/relay without opening it, and Duplicate/Delete open the drawer and hand off to its EXISTING 33-07 `pendingAction` seam rather than mutating anything themselves.
- Pure-function boundary layer (`computeBoundaries`, `hasSplittableBoundaries`, `embedBoundaryMarkers`, `sliceAtBoundaries`, `stripVerseMarkers`, `verseRangeForSlice`) that makes altered scripture structurally impossible by constraining the model to integer indices into a pre-computed legal-position array.
- The model's entire permitted vocabulary (speaker enum + two integer boundary indices, `additionalProperties:false` everywhere) and the client-side `validateSplitResult()` gate — 19 distinct rejection tests plus one acceptance test prove every bounds/ordering/adjacency/coverage check the JSON Schema subset cannot express.
- Assembled the one place the model's output and real scripture meet: `splitCongregationalReading()` computes legal boundaries once, calls `messages.parse()` with the exact accepted shape for pre-4.6-family Haiku (dated id, `output_config.format`, no `thinking`/`effort`), validates via 34-02's `validateSplitResult`, and slices every section's text from the untouched ESV source — with 16 new tests proving the call shape, the byte-exact slicing, and every failure path's total-rejection `null`.
- Wired `splitCongregationalReading()` into `CongregationalEditor.vue` as an explicit, gated, opt-in `data-testid="ai-split-btn"` that either replaces sections wholesale or changes nothing and says so via one R041 toast — closing R064 end to end while recording the two things this phase cannot settle by itself: empirical split determinism (needs a live API call) and the editor's total unreachability in production (needs an owner decision).
- `ScriptureSlot.congregationalSections` plus one shared predicate helper threaded through both `slideshowAssembler.ts` scripture call sites, with `slideGroupMaterializer.ts` proven — not assumed — to need no change
- `CongregationalEditor.vue` converted from a self-persisting component (separate `ScriptureReading` Firestore document via `useScriptureSlides`) to a pure controlled prop/emit component — the exact model R047 rejected is now fully gone from this file
- Closed the R064 reachability gap `34-VERIFICATION.md` recorded — `CongregationalEditor.vue` is now mounted by `ServiceEditorView.vue` as a keyed, Teleported modal reachable from two slide-side routes that converge on one relay, with sections written onto `ScriptureSlot.congregationalSections` through the existing autosave and exactly one save-status live region on screen at any moment.
- Proved the slot -> group -> slide composition end to end in one test file, extended the validation record without disturbing what was already there, resolved the blocking PENDING-VERIFICATION item and opened four new (unapproved) ones, ran the full three-command phase gate, and corrected R064/R070/R071 to match what the gate actually observed.
- Added R070 to REQUIREMENTS.md/ROADMAP.md, then wired `PresentationViewer.vue`'s `currentBackgroundUrl` computed and a scrim layer so a group/slide background set in the Slides tab now appears while presenting — closing owner UAT finding F3.
- Fixed owner UAT finding F4 — the empty bordered save-status box left pinned at the top of a reopened service — by stripping only the wrapper's chrome at idle (border/background/padding/margin/sticky) instead of unmounting it, so the aria-live region inside it survives every status transition including the very first.
- SlideGrid.vue's two separate group-media rows (group music bar, group background control) are now one `slide-grid-group-media-panel`, with each control's own visibility condition preserved and the permission gate, caption, inherited-display rule, and all four write handlers byte-unchanged.
- Diagnosed owner UAT finding F5 as a misdiagnosis (Export to PC was never removed — `hasPcCredentials` behaves correctly), wrote R071 for the real defect (a silent, unexplained button swap), and shipped only the UX fix: a `canEditService`-gated note beside Copy for PC that names the missing-credentials reason and links to Settings by route name — the export affordance itself stays exactly as gated as it was.
- Deleted the lyric-slide `sectionLabel` render in `PresentationViewer.vue` (R059) and threaded a `SlidesTab` → `ServiceEditorView` → `PresentationViewer` start-index chain so Present opens on the highlighted slide/group instead of always slide 0 (R061).
- Pinned the already-shipped leading-and-trailing copyright bracket with 17 new unit tests across both group-construction paths — zero production code touched.
- Built LyricPasteRegion.vue — a chrome-less, multi-root successor to the Teleported LyricPasteDialog.vue — with an R065 copyright-missing warning that blocks the save unless an always-available override checkbox is checked, plus a save-rejection backstop; migrated and extended LyricPasteDialog.test.ts's 13-test suite into 16 tests with zero coverage loss.
- SongLyricEditor.vue now swaps its whole Sections view for LyricPasteRegion in place via `v-if="!pasteMode"`/`v-else` — LyricPasteDialog.vue and its test file are deleted entirely, closing R066 with exactly one paste surface reachable from both entry points, host-driven open/close/reopen-reset/exit-guard mechanics covered by 9 new tests, and zero net test-count drop across the phase (2253 passing, up from ~2219 pre-phase, against the same 9-test/2-file known-failing baseline).
- `SlideDropTarget` gains a keyboard-accessible `clickable` variant and `SlideGrid` deletes its separate `⇪ Import into this group` button, wiring both drop-tile instances (`:clickable="canMutateGroup"`, `@browse="openImportModal"`) as the click-to-import affordance — R053, minus the button that duplicated it.
- Pure `buildActionBarItems(tab, ctx)` builder plus the one shared `ContextualActionBar.vue` renderer, with R068's leak invariant proven as data over the full cartesian product of context flags rather than as DOM assertions in three places.
- `ServiceEditorView`'s header now renders one per-tab `ContextualActionBar` (built by 36-02) instead of four unconditional buttons, `▶ Present` relocates from `SlidesTab` into that header via a `slidesTabRef`/`defineExpose` seam, and the tab strip reorders to Service Order · Slides · Roles — with the pre-phase export/copy gate, R071's note, and 34-10's chrome-strip all verified byte-for-byte intact.
- Every Service Order section band now renders a labelled, counted header with its own inline `＋ Add item` chip row, backed by an additive `addSlot(kind, vwType?, targetSection?)` parameter that routes a per-band add into the clicked band — even an empty one — while every existing capability (drag, section select, remove, scripture editing, the lock banner, the save-status bar) is verified untouched.
- The bottom-of-list Add Element dropdown is rebuilt as a single-state dashed chip row (5 always-clickable chips, no open/closed state), a dedicated behavioural sweep proves the whole Service Order tab lost nothing across 36-01..36-05, and the phase closes with a clean type-check, a clean build, and the app suite at its documented 2-file baseline — with one environment-only gate-command discrepancy found and disclosed rather than smoothed over.
- Standalone `render-service/` Cloud Run project scaffolded outside `functions/`, with a two-stage LibreOffice+Poppler Dockerfile whose open-font-only policy (Carlito/Caladea/Liberation, never Microsoft fonts) is proven by a 15-assertion text-only test — no Docker daemon, nothing built, nothing deployed.
- LibreOffice→PDF→PNG render pipeline with a numeric (never lexical) page-ordering guarantee and a single validated `/render` route, all proven by 39 mocked tests — no container built, no real `soffice`/`pdftoppm` invoked, nothing deployed.
- Added `renderInvoker.ts` (IAM-authenticated Cloud Run invocation seam with zero unauthenticated fallback) and one additive, failure-swallowing Firestore queue write in `parsePptxHandler`, with 16 new regression tests proving nothing else about the existing handler moved.
- `requestPptxRenderHandler` gates a deck's ready flip on three independent agreements — a positive Storage recount, a reported-vs-actual equality, and a contiguous 1..N page sequence — never on the render service's self-report alone and never on the parser's structurally-decoupled slide count, proven by 11 new tests plus two deliberate-failure confirmations that show the gate's two sharpest conjuncts are genuinely load-bearing.
- A second, separate `cleanupOrphanRendersHandler` scheduled job (03:00 UTC) that defaults to dry-run exactly like the post-incident `cleanupExpiredMedia` gate, plus `ImportedDeck.renderImportId` wiring `PptxImportModal.vue`'s Storage import id onto the confirmed deck.
- Wrote `render-service/DEPLOY.md` (the complete, unexecuted `gcloud run deploy` handoff with both IAM directions and the STORAGE_BUCKET env var), added six unchecked owner to-dos to `PENDING-VERIFICATION.md`, ran the full three-suite gate green, audited the phase for zero executed deploy commands, and marked R062 `[~]` partial rather than overstating completion.
- A congregational scripture reading now derives, signs, rebuilds and assembles as N independently-editable slide-group entries — one per section — detached from the slot once converted, instead of one slide carrying a stacked sections array.
- `ScriptureSlide.sections?: CongregationalSection[]` is now the singular `section?: CongregationalSection`, and the projected slide renders the speaker on its own line above that section's words at the reference's unified body treatment — the stacked multi-section rendering branch is deleted, not left standing.
- A Congregational-state section slide now names its speaker on its card, and the Edit Slide drawer edits that section's words and flips its speaker independently of every sibling — both writes gated to the single `congregationalSectionFromRef` predicate, leaving a Reference-state scripture slide completely untouched.
- A 15-case composed test file (`congregationalDetachment.test.ts`) proves the congregational two-state mechanism survives repeated rebuild ticks — not just one — covering delete/edit/speaker-flip/reorder survival, both DESTROY paths, RE-CONVERT/RE-SPLIT, and both migration shapes; four stale doc-comment claims in `slideGroupMaterializer.ts` were corrected; and the phase's owner-verification checkpoint was deferred (never self-approved) into `PENDING-VERIFICATION.md` items 38.1-38.7.

---

## v1.4 Service and Slides (In progress — since 2026-07-28)

**Goal:** Make the Service Order and Slides tabs trustworthy — ordering that holds, saves you see,
slides that always mirror the plan — and finish them against the Claude Design wireframes.

**Phases:** 29-37 (9). **Requirements:** `.planning/REQUIREMENTS.md` (R036-R069, 34 total, 34/34 mapped).

Scope covers service lifecycle locking, autosave reliability + app-wide save visibility, a fifth
Post-Service section, the long-standing drag-and-drop reordering corruption, hard-locking slide groups
to the service order (deleting the reconcile/confirm flow), slide interaction fixes, backgrounds at
group/slide/song level, presentation correctness (labels, CCLI copyright), true-fidelity PPTX rendering,
LLM-assisted congregational reading splits, lyric-editor copyright warnings, and a contextual
action-bar audit across every tabbed screen.

First milestone with `workflow.verifier: true` — every phase produces a real `VERIFICATION.md`.

Roadmap: `.planning/ROADMAP.md` §Phase 29-37. Phase 29 (Order Structure — Stable Reordering &
Post-Service) is first — foundational; Phase 37 (PowerPoint Server-Side Rendering) is deliberately
last, per user decision, so an overrun or cut disturbs nothing else.

---

## v1.3 Slides Tab Rework (Shipped: 2026-07-28)

**Phases:** 24-28 (5), 33 plans. **Requirements:** `milestones/v1.3-REQUIREMENTS.md` (R028-R035).

**Delivered:** A persisted slide-group model and a dedicated **Slides** tab where all slide editing
lives — plan rail mirroring the service order, Edit Slide drawer, and a song lyrics editor rebuilt as
one list that IS the slide order. The first tab was renamed **Service Order** and stripped of slide
editing.

**Verification:** closed on direct owner verification, not an automated gate — `workflow.verifier` was
`false` for the whole milestone. Each phase carries an owner-attributed `*-VERIFICATION.md` stating so
explicitly.

**Notable defects caught during the milestone:** a compounding reconciliation bug (2→4→8→16 slide
duplication on the additive path, which has no confirm gate) and two competing `performanceOrder`
fields where the builder read one but wrote the other.

---

## v1.2 Worship Service Slide Management (Shipped: 2026-07-28)

**Migrated from gsdpi** (milestone M001, slices S01-S06) into gsd-core on 2026-07-24. The
`.gsd/` store is legacy/read-only.

**Phases:** 18-23 (6). **Requirements:** `milestones/v1.2-REQUIREMENTS.md` (R001-R020).

**Delivered:** Song lyric slides + CCLI paste parser and editor; scripture and congregational reading
slides with ESV auto-pull; four formalized service sections with slide auto-assembly; PowerPoint import
for announcements and sermon; media attachments with a storage lifecycle; presentation preview mode.

**Verification:** closed by explicit owner acceptance with checkpoints waived — *"close v1.2. I've
verified everything I need to anyway."* Phases 18-23 were never verified by a passing gate. Recorded
plainly so this milestone's archived state is not later read as evidence that the checkpoints ran.

**Decisions:** D001-D006 (unified slide model, single canonical song version, PPTX universal import,
server-side parsing, four service sections, CCLI paste). See STATE.md.

---

## v1.1 (Shipped: 2026-07-24)

**Phases:** 8-17 plus 16.1 (11 total). Archived to `milestones/v1.1-phases/`.

**Delivered:** Planning Center API export for published plans; PC song import and tag management; song
export naming templates; song catalog and service planner improvements; advanced song search with
multi-select persistent tag filtering; volunteer role scheduling with PC roster import; in-app quarterly
availability editor; per-role serve frequency and role-category rules; quarterly schedule share links;
song list tag/column customization; schedule sync with planned services plus a Roles tab on the service
editor.

---

## v1.0 MVP (Shipped: 2026-03-05)

**Phases completed:** 6 phases (1, 2, 3, 4, 6, 7), 18 plans
**Commits:** 218
**Lines of code:** 12,747 (TypeScript + Vue)
**Timeline:** 2 days (2026-03-03 → 2026-03-04)
**Git range:** cbd8583..66b2202

**Delivered:** A complete worship service planning app with song library, smart Vertical Worship suggestions, AI-powered song/scripture discovery, print/share/export, and team collaboration with RBAC.

**Key accomplishments:**

1. Vue 3 + Firebase foundation with Google/email auth, Firestore security rules, and dark mode app shell
2. Song library with CSV import (Planning Center format), VW type categorization, team tags, search & filter
3. Weekly service planning with 9-slot template, 1-2-2-3/1-2-3-3 progression enforcement, smart song suggestions, scripture input with ESV preview
4. Print layout, Planning Center text export, and shareable read-only links via denormalized Firestore tokens
5. AI-powered song suggestions and natural language scripture discovery using Claude, with graceful degradation
6. Team management with email invite flow and editor/viewer RBAC enforced across Firestore rules, router guards, and UI

**Quick tasks shipped:** 14 polish/UX improvements including autosave, infinite scroll, hymn slots, settings screen, communion checkbox, and rotation visibility fixes

### Known Gaps

Phase 5 (Collaboration, Tasks & Events) deferred to v1.1:

- TASK-01: Recurring tasks with church-specific categories
- TASK-02: Assign tasks to team members with relative due dates
- TASK-03: Check off completed tasks per service week
- EVNT-01: Create special event services
- EVNT-02: Special events on calendar with advance lead time
- EVNT-03: View past special event plans as reference
- EVNT-04: Duplicate past special event to new date

Note: AUTH-03 and AUTH-04 (team invites and shared access) were completed in Phase 7, not Phase 5.

---
