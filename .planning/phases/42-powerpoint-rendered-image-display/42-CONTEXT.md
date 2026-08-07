# Phase 42: PowerPoint Rendered-Image Display - Context

**Gathered:** 2026-08-07
**Status:** Ready for planning
**Mode:** Smart discuss (autonomous). Grey-area recommendations auto-accepted under STATE.md's
★★ Standing Autonomy Grant (v1.5, 2026-08-06). Every choice is disclosed below rather than approved
interactively.

<domain>
## Phase Boundary

An imported PowerPoint deck displays as its **true rendered self** — in the slide grid and while
presenting — instead of parsed text alone. Closes the half of R062 that v1.4 Phase 37 shipped backend-
only.

**In scope:** consuming the already-deployed render pipeline (R079); explicit pending/failed states
(R080); `IMPORTED`-branch logic in `slideGroupMaterializer.ts` and `slideshowAssembler.ts` that
reconciles render count against parsed-slide count; folding render status into `sourceSignature`; and
the one `firestore.rules` read rule that makes any of it possible (see the correction below).

**Out of scope:** the Cloud Run render service itself (already deployed and confirmed working against
production 2026-08-06); the PPTX parse/upload path; re-rendering or retry UI; changing how decks are
imported.

</domain>

<decisions>
## Implementation Decisions

### ⚠ CORRECTION TO THE ROADMAP — this phase is NOT deploy-free

The ROADMAP's Phase 42 notes state: *"this phase is pure client-side consumption, with nothing new to
deploy."* **That premise is false, and planning against it would produce an unimplementable phase.**

Verified 2026-08-07 against the live files:

- The render record lives at `organizations/{orgId}/pptxRenders/{importId}`
  (`functions/src/index.ts:159-165`).
- `firestore.rules` has **no match block for it**. It falls through to
  `match /{document=**} { allow read, write: if false; }` (`firestore.rules:317-320`).
- `functions/src/index.ts:144-148` says so explicitly, and defers rules deployment to "backlog 999.3":
  the Admin SDK bypasses rules, so the Functions never noticed.

**The client therefore cannot read `status`, `renderedCount`, or `failureReason` at all today.**
ROADMAP criterion 2 — distinguishing *pending* from *failed* — is unimplementable without it.

**Resolution:** add a read-only rule for that path. **This costs the owner nothing extra:** Phase 41
already queued `firebase deploy --only firestore:rules`, and this change lands in the same file, so
one deploy covers both. Record it in `.planning/PENDING-VERIFICATION.md` alongside Phase 41's entry
rather than as a second handoff.

**Storage needs no change** — rendered images live under `orgs/{orgId}/pptx-imports/{importId}/…`,
already covered by `match /orgs/{orgId}/{allPaths=**} { allow read: if isOrgMember(orgId); }` in
`storage.rules`, which Phase 40's claim dual-read made emulator-verifiable.

### Render status readability

- Add `match /organizations/{orgId}/pptxRenders/{importId} { allow read: if isOrgMember(orgId); }`.
  **Read only** — writes stay Admin-SDK-only, exactly as today. Do not open create/update/delete;
  nothing client-side writes this document and opening it would let a client fake a `ready` flip,
  which `functions/src/index.ts:342` calls out as threat T-37-15.
- Rejected: mirroring status onto the `importedDecks` document via a Cloud Function — that needs a
  **Functions** deploy, which is strictly more expensive than a rules deploy already scheduled.
- Rejected: inferring status from Storage 404s — it cannot distinguish *pending* from *failed*, which
  is precisely what criterion 2 requires.
- Subscribe with `onSnapshot`, not a one-shot `getDoc`. Criterion 4 requires reacting to a
  `pending → ready` transition, which can happen while the page is open.
- Prove the rule with emulator-backed **ALLOW and DENY** cases in `src/rules.test.ts`, to the same
  standard Phase 41 held. A deny-only suite is not evidence (CLAUDE.md).

### Count-disagreement reconciliation

- When `renderedCount` disagrees with `deck.slides.length`, **`renderedCount` wins**. The rendered deck
  is the truth; parsed text is metadata. The render trigger's own comments already document that these
  two counts structurally disagree — the phase must reconcile, never assume agreement.
- Surplus **parsed** slides are retained in the document for search and labels but **never drawn** —
  the owner's framing is *"import the powerpoint so that the slides look like they natively looked."*
- Surplus **rendered** pages beyond the parsed count are rendered as slides with no text label, not
  dropped. Dropping loses content the user actually saw in PowerPoint.
- The reconciliation lives in **one shared helper** consumed by both `slideGroupMaterializer.ts` and
  `slideshowAssembler.ts`. Two copies would drift, and the grid and the presenter disagreeing about
  what a deck contains is the exact failure this phase exists to end.

### sourceSignature and rebuild-on-mismatch

- Fold **both** `status` and `renderedCount` into the `IMPORTED` branch of `sourceSignature`
  (`slideGroupMaterializer.ts:192-198`), appended to the existing
  `${texts.length}:${texts.join('|')}` form. Status alone is insufficient: a re-render that changes
  the page count while staying `ready` would not trigger a rebuild.
- "Exactly once" (criterion 4) falls out of the signature being stable within a status — the existing
  rebuild-on-mismatch mechanism fires on the transition and not again. No separate one-shot flag.
- **User-added slides survive a rebuild.** Phase 24 D-02 ("never silently drop a user's added slide")
  still governs and is not relaxed here.
- A `failed → ready` transition (a retry succeeding) is treated identically to `pending → ready`. No
  special case.

### Pending and failed presentation

- **Grid, pending:** an explicit placeholder naming the state. Never a blank tile, and never stale
  parsed text presented as though it were the slide — R080 calls the latter "misleadingly-stale."
- **Grid, failed:** an explicit failure state that surfaces `failureReason` from the render document.
- **Presenter:** the same explicit states. A live congregation seeing a blank screen is the worst
  outcome in this phase; the presenter must never silently show nothing and must never skip the slide,
  because skipping changes the deck's length mid-service.
- **Decks with no `renderImportId`** — imports confirmed before Phase 37, and image-only imports that
  have no `source.pptx` — keep the existing parsed-text path unchanged. No render was ever requested,
  so this is *not* a failure state and must not render as one. `ImportedDeck.renderImportId` is
  optional precisely for these two cases (`src/types/importedDeck.ts:19-30`).

### Claude's Discretion

- Naming and file placement of the shared reconciliation helper.
- Where the `pptxRenders` subscription lives (store vs. composable) — choose whatever keeps the
  existing slide-group data flow intact rather than adding a parallel one.
- Exact visual treatment of the pending/failed states, subject to the UI-SPEC generated next.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets

- `src/types/importedDeck.ts` — `ImportedDeck` with the optional `renderImportId` that joins a
  confirmed deck to its render record. The comment there explains the two-identifier design; read it
  before touching the join.
- `functions/src/index.ts:152-165` — `PptxRenderDoc` (`status`, `storagePath`, `renderedCount?`,
  `failureReason?`) and `pptxRenderDocRef(orgId, importId)`, the one canonical path builder. The
  client-side type must match this shape exactly.
- `src/utils/slideGroupMaterializer.ts:119-141` — the existing `IMPORTED` case in `deriveGroupEntries`.
- `src/utils/slideGroupMaterializer.ts:192-198` — the existing `IMPORTED` branch of `sourceSignature`.
- `src/utils/slideshowAssembler.ts` — the presenter-side assembly that must agree with the grid.
- `src/components/slides/slideDisplay.ts`, `SlideCard.vue`, `SlideGrid.vue` — the grid rendering path.
- `src/components/PresentationViewer.vue` — the presenter.

### Established Patterns

- **One-entry-per-fragment** — the `IMPORTED` case already emits one group entry per deck slide;
  `slideGroupMaterializer.ts:96` notes the congregational case deliberately copies that shape.
- **Rebuild-on-mismatch** — `sourceSignature` is stored on the group and compared on load; a
  difference drives reconciliation. This phase supplies a new reason for the signature to change
  rather than inventing a new mechanism.
- **Phase 24 D-01 lazy `ServiceSlot.id` backfill** and **D-02 never-drop-a-user-slide** both still
  apply to any group this phase rebuilds.
- Storage paths are returned as PATHS by the Functions, never signed URLs; the client resolves
  `getDownloadURL()` under the `storage.rules` org gate (`functions/src/index.ts:178-180`).

### Integration Points

- `firestore.rules:317-320` — the catch-all the new `pptxRenders` read rule must be inserted *before*.
- `src/rules.test.ts` — where the ALLOW/DENY cases go.
- `src/utils/__tests__/slideGroupMaterializer.test.ts`, `slideshowAssembler.test.ts`,
  `src/composables/__tests__/useSlideshowAssembly.test.ts` — the three suites most likely to need
  updating.
- `.planning/PENDING-VERIFICATION.md` — Phase 41's deploy handoff, which this phase amends rather than
  duplicates.

</code_context>

<specifics>
## Specific Ideas

- Owner's framing, quoted in the ROADMAP: *"import the powerpoint so that the slides look like they
  natively looked in the powerpoint presentation."* The rendered PNG **is** the slide. Parsed text
  stays in the document for search and labels but is never drawn.
- This item has already slipped a full milestone — v1.4 Phase 37 shipped the backend and nothing
  consumed it. The ROADMAP says to treat the four success criteria as the explicit definition of done.
  Do not re-scope them.
- The Cloud Run render service is already deployed and was confirmed working against production on
  2026-08-06. Do not rebuild, redeploy, or "verify" it by deploying anything.

</specifics>

<deferred>
## Deferred Ideas

- A re-render / retry affordance for a failed deck. R080 requires *showing* the failed state, not
  offering recovery. Worth doing; not this phase.
- Opening `pptxRenders` to client writes, or exposing render progress as a percentage. Both widen the
  T-37-15 surface (a client faking a `ready` flip) for no requirement.
- Backlog 999.3 (the deferred rules deployment noted in `functions/src/index.ts:148`) — this phase
  resolves the *read* half incidentally; the backlog item itself stays open.

</deferred>
