# Technology Stack

**Analysis Date:** 2026-07-16

## Languages

**Primary:**
- TypeScript ~5.9.3 - Client and backend development
- JavaScript (ES Modules) - Runtime language

**Secondary:**
- Vue Single File Components (.vue) - Template/styling layer

## Runtime

**Environment:**
- Node.js ^20.19.0 || >=22.12.0 - Development and Cloud Functions

**Package Manager:**
- npm - Dependency management
- Lockfile: `package-lock.json` present

## Frameworks

**Core:**
- Vue 3.5.29 - Progressive JavaScript framework for UI
- Vue Router 5.0.3 - Client-side routing

**State Management:**
- Pinia 3.0.4 - Vue composition API state management

**Backend:**
- Firebase Admin SDK 13.10.0 - Server-side Firebase integration
- Firebase Functions 7.2.5 - Serverless backend via Google Cloud Functions

**Testing:**
- Vitest 4.0.18 - Unit testing framework
- @vue/test-utils 2.4.6 - Vue component testing
- @firebase/rules-unit-testing 5.0.0 - Firestore rules testing
- jsdom 28.1.0 - DOM simulation for tests

**Build/Dev:**
- Vite 7.3.1 - Frontend build tool and dev server
- @vitejs/plugin-vue 6.0.4 - Vue compilation for Vite

## Key Dependencies

**Critical:**
- @anthropic-ai/sdk ^0.78.0 - Anthropic Claude API integration for AI suggestions
- firebase ^12.0.0 - Client SDK for Authentication and Firestore
- papaparse ^5.5.3 - CSV parsing/export for volunteer roster
- sortablejs ^1.15.7 - Drag-and-drop for schedule slots

**Infrastructure:**
- @tailwindcss/vite ^4.0.0 - Tailwind CSS integration
- tailwindcss ^4.0.0 - Utility-first CSS framework

**Development Quality:**
- eslint ^10.0.2 - JavaScript linting
- eslint-plugin-vue ~10.8.0 - Vue linting rules
- eslint-plugin-oxlint ~1.50.0 - Rust-based linter
- oxlint ~1.50.0 - High-performance linter
- prettier 3.8.1 - Code formatter
- vue-tsc 3.2.5 - Vue-aware TypeScript compiler
- npm-run-all2 ^8.0.4 - Concurrent script execution

**Type Definitions:**
- @types/node ^24.11.0
- @types/papaparse ^5.5.2
- @types/sortablejs ^1.15.9
- @types/jsdom ^28.0.0

## Configuration

**Environment:**
- Client env vars: Prefixed with `VITE_` (exposed to bundle)
  - `VITE_FIREBASE_API_KEY`
  - `VITE_FIREBASE_AUTH_DOMAIN`
  - `VITE_FIREBASE_PROJECT_ID`
  - `VITE_FIREBASE_STORAGE_BUCKET`
  - `VITE_FIREBASE_MESSAGING_SENDER_ID`
  - `VITE_FIREBASE_APP_ID`
  - `VITE_FIREBASE_MEASUREMENT_ID`
  - `VITE_USE_EMULATORS` (dev-only, enables local Firebase emulators)

- Server env vars: Non-prefixed (server-side only)
  - `CLAUDE_API_KEY` - Stored in Google Secret Manager
  - `ESV_API_KEY` - Stored in Google Secret Manager

**Build:**
- `vite.config.ts` - Vite configuration with Vue and Tailwind plugins
- `tsconfig.json` - TypeScript project references
- `tsconfig.app.json` - Application TypeScript settings
- `tsconfig.vitest.json` - Test environment TypeScript settings
- `tsconfig.node.json` - Build tool TypeScript settings
- `eslint.config.ts` - ESLint flat config with Vue and Vitest plugins
- `firebase.json` - Firebase Hosting and Cloud Functions configuration
- `firestore.indexes.json` - Firestore index definitions
- `firestore.rules` - Firestore security rules

## Platform Requirements

**Development:**
- Node.js 20.19.0 or 22.12.0+
- npm (included with Node.js)
- Firebase Emulator Suite (optional, for local development)
  - Firestore emulator (port 8080)
  - Auth emulator (port 9099)
  - Functions emulator (port 5001)
  - Emulator UI (port 4000)

**Production:**
- Firebase Hosting (Google Cloud)
- Cloud Functions (Google Cloud)
- Firestore database (Google Cloud)
- Google Secret Manager (for API keys)

## Backend Stack Notes (R318)

Behavioral/architectural "how it works" narration relocated out of backend source comments
(`functions/src/**`) per the Phase 109 comment convention (CONVENTIONS.md § Comment Convention).
Each entry cites the file:line range at the time of relocation (109-02).

### functions/src/messageTokens.ts

**Module overview (pure server-side token renderer for the send path, Phase 59, R138/R139):**
`sendQueuedMessage` (`functions/src/index.ts`) renders each recipient's subject and body from the
RAW token template stored on the message doc. This file is deliberately PURE — string in, string
out, no Firestore/Pinia/`@/` alias and no import of the client `buildServiceSnapshot` (which is
store-bound and not importable in the functions project, 59-RESEARCH.md Anti-Pattern). The caller
(the send trigger) Admin-SDK-loads the service/quarters/roles/people, derives the token values,
and calls this once PER RECIPIENT so `{{their_roles}}` and `{{name}}` reflect that person's own
roles/name (R139/R154). The supported tokens are substituted GLOBALLY; every other `{{token}}` is
left verbatim, and a template with no tokens is returned unchanged.

## Utils Stack Notes (R318)

Behavioral/architectural "how it works" narration relocated out of `src/utils/**` source comments
per the Phase 109 comment convention (CONVENTIONS.md § Comment Convention). Each entry cites the
file:line range at the time of relocation (109-03).

### src/utils/slideTypography.ts

**`FONT_CSS_LOADERS` (RESEARCH's "bundle strategy"):** on-demand loader for a non-eager curated
family — only the org's chosen default face is eager-imported in `main.ts`; the other five curated
families load lazily when previewed in Settings or requested by the presenter gate. Every
`import()` inside this table is a FULLY STATIC string literal — one per `{family, weight}` pair
drawn from `SLIDE_FONTS` — so Vite's import-analysis discovers and bundles each per-weight chunk on
its own. Do NOT collapse these back to a templated `import(\`…/${weight}.css\`)`: a
`@fontsource/*` specifier is a BARE (node_modules) import, and Vite 7's `dynamic-import-vars`
cannot statically analyze a variable inside a bare specifier ("must start with ./ or ../") — it
warns at build/dev time AND leaves the import un-bundled, so the lazy font load would throw at
runtime in a production build. The verbose per-weight literals are the price of correctness. Each
family value stays a `(weight) => Promise` function so `loadFontCss` and the `FONT_CSS_LOADERS`
membership test are unaffected; an unlisted weight resolves to a no-op, mirroring the `snapWeight`
ramp.

### src/utils/slotTypes.ts

**`buildSuggestedTemplateEntries`:** builds the Suggested Template's `ServiceTemplateEntry[]` — the
single shared definition of the suggested-template content (the R114 `applyReset` button and the
R115 `createService` empty-template fallback BOTH call this, so the preset can never fork into two
copies). Derived from `buildSlots('1-2-2-3')` so the suggested order and section defaults stay in
lockstep with the canonical progression preset. Fresh `crypto.randomUUID()` ids are minted per call
(the editor draft needs unique per-row keys; `buildSlotsFromTemplate` never reads `entry.id`, so
fresh ids are harmless on the createService path). Carries no `body` — the suggested entries are
bodyless; a church adds recurring MISC body text itself.

### src/utils/messaging.ts

**`isMessagingEnabled` (R130):** single shared choke point for the org-level volunteer-email
messaging kill switch (`authStore.settings.messaging.enabled`). Every later messaging UI surface
gates on this ONE function — no scattered `settings.messaging.enabled` reads — mirroring
`claudeApi.ts::isAiEnabled`'s rationale. Unlike `isAiEnabled`, this function makes no network call
and has no "never throw" contract (yet), so it stays a thin, honest boolean read: `useAuthStore()`
throws if called with no active Pinia instance, and that throw is intentionally NOT swallowed here.
Callers that need a never-throw guarantee wrap their own call site.

### src/utils/runChannel.ts

**Module overview (Phase 91, consumed by Phases 92-96's multi-window Run mode):** run-mode
control->output message protocol — a typed, injectable wrapper around `BroadcastChannel`. The
control window is the SINGLE writer of `state` messages; an output window posts only `hello` on
(re)mount so control can re-send current state to a freshly-opened or reloaded output. Deliberately
free of Vue/Firebase/Pinia imports — its only runtime dependency is the `BroadcastChannel`
primitive, supplied through an injectable factory so tests can drive it deterministically without
relying on jsdom/Node to provide a native `BroadcastChannel` (they do not reliably do so). `seq` is
a monotonically increasing counter OWNED BY THE CALLER (control), not by this module — `postState`
posts `state` verbatim, never generating its own seq. `onState` is where the load-bearing stale-drop
lives: an incoming state message is delivered to the caller's callback ONLY when its seq is
STRICTLY greater than the highest seq already delivered on that handle — this guards the
window-open race and the reload-loses-place hazard, so a reopened/reloaded output window can never
be driven backward by a stale or out-of-order message. No echo-suppression is implemented on
purpose: the platform never delivers a context's own broadcast back to itself, so a self-filter
would be dead, misleading code.

### src/utils/serviceSlots.ts

**Module overview (Phase 91, consumed by the Run rail in Phases 92-96):** the `slotIndex` <->
first-assembled-slide-index lookup — the SINGLE shared derivation any consumer uses for "which slide
does clicking this order-of-service item jump to," extracted so the position-sort is never
re-implemented and allowed to disagree with `slideshowAssembler.ts` (CLAUDE.md's
two-orderings-disagree warning). `sortedSlotsWithIndex` reproduces `slideshowAssembler.ts`'s own
map-then-sort BYTE-FOR-BYTE: pair each slot with its ORIGINAL `service.slots` array index first,
THEN sort a copy by ascending `slot.position`. Every emitted `AssembledSlide.slotIndex` IS that
original array index (never a position-sorted index), so this module's `index` and the assembler's
`slotIndex` are the same number by construction. Pure derivation over in-memory
`Service`/`AssembledSlide[]` already resident in the window — no external trust boundary crossed, no
Firestore/Pinia/Vue import.

### src/utils/shareTokens.ts

**Module overview (R078):** share-token minting and adoption selection, extracted into a pure
module so both decisions ("what does a freshly-minted token look like" and "which of several
already-circulated tokens is the one to adopt") can be proven exhaustively without a Firestore mock.
The adoption branch this module exists for is built on an equality-only query
(`where('serviceId','==',id)`, no server-side sort clause) followed by a client-side sort here — an
equality filter combined with a server-side sort on a different field requires a composite
Firestore index this project's `firestore.indexes.json` has none of, and the Firestore emulator does
not enforce that requirement, so a version that added the server-side sort would pass every local
test and then throw in production. The caller must never add that sort clause to the query that
produces the candidates passed into `pickAdoptableToken` — do the ordering here instead.
Deliberately free of Firestore and Pinia imports.

### src/utils/stageLayout.ts

**Module overview (R313/R314, Phase 107 — redesigned to the single-room "Nocturne" diagram):** pure
geometry + kind-registry helpers for the visual stage layout. Dependency-free (no Vue/Pinia/
Firebase) so it is safe from BOTH the editor's drag canvas and the read-only renderer
(`StageLayoutView`), which keeps that view import-free enough for the public, unauthenticated
`ShareView`. The diagram is ONE continuous room; positions are a single percentage space ([0,100] of
the room rect) — never snapped, always resize-stable (R314). A marker's stored `zone` is derived
from where it lands (`zoneFromPosition`). A marker's TYPE is either a fixed `kind` (Vocals / Mics &
DI / Gear, plus the Orchestra & Instrument extras) OR a band ROLE (`roleId`/`roleName`): the
Instruments palette mirrors the org's Band roles so a marker's instrument lines up with the role a
person is assigned to. The read-only surfaces need only the denormalized `roleName` to render
(icon/label/skin), never the id.

## Component & Composable Stack Notes (R318)

Behavioral/architectural "how it works" narration relocated out of `src/components/**` and
`src/composables/**` source comments per the Phase 109 comment convention (CONVENTIONS.md §
Comment Convention). Each entry cites the file:line range at the time of relocation (109-04).

### src/components/SongLyricEditor.vue

**Drag reorder (D-01):** the list is always draggable by handle, no mode to enter first. Reproduces
the exact SortableJS configuration/DOM-revert pattern established for the service slot list
(`ServiceEditorView.vue`) and reused by the slide grid (`SlideGrid.vue`) — handle-scoped, same
animation duration and ghost class, so drag means the same thing app-wide (D-01's stated reason 2a
was chosen over 2b). Reorder moves a POSITION in `performanceOrder`, not a section — `moveRow` only
ever splices the order array. Which occurrence of a repeated section is "the followed row" vs. "the
repeat" is derived fresh on every render by `buildSectionRows` (earliest occurrence in order wins),
so a drag that reorders occurrences needs no extra bookkeeping here.

### src/components/slides/SlideCanvas.vue

**Font-size scoped-style rules (R093, 46-04):** per-element font-weight/font-size overrides reading
the `--slide-font-*` custom properties `PresentationViewer`'s `typographyStyle` sets on its viewer
root, which these elements inherit into (moved here unchanged, Phase 90). Unlayered scoped styles
win over Tailwind's `@layer utilities` regardless of selector specificity, so these override the
template's fixed Tailwind size/weight classes without touching them. Each element's base rem/px
value is its EXISTING Tailwind size class, read directly (46-UI-SPEC.md § Typography (B)):
`text-6xl`=3.75rem, `text-5xl`=3rem, `text-2xl`=1.5rem, `text-xs`=0.75rem. `presentation-body`
carries two distinct base sizes depending on slide kind (`text-5xl` for lyric/scripture/text,
`text-6xl` for the copyright title) — targeted by combining the testid with the existing size class
rather than a single ambiguous rule.

### src/components/slides/SlideDropTarget.vue

**Module overview (D-13):** the drop tile itself — always the LAST item the grid renders, including
at zero slides (D-08), and NEVER inside SortableJS's draggable set: `.slide-card` is deliberately
absent from this component's root class, so a tile mounted inside the cards container never shifts a
reorder's old/new index arithmetic by one. Performs no upload and no routing decision of its own — it
only emits the dropped file list upward; `SlideGrid.vue` routes BOTH this tile's drop and the
whole-grid container's drop through the exact same handler (`dropRouting.ts`'s `resolveDrop`), so the
two entry points can never diverge. Phase 36 (R053): this tile now doubles as the click-to-import
affordance the deleted "⇪ Import into this group" button used to be — a `clickable` prop adds
`role="button"`/keyboard parity and a `browse` emit; the gate is entirely the PARENT's job, this
component never decides who may click it, it only offers the emit when `clickable` says the parent
has already decided yes. R054: on a SONG group the tile stays mounted — group-level music is still
allowed — but every slide-appending route (deck, image, video) is refused by
`SlideGrid.onFilesDropped`; the `audioOnly` prop makes the COPY tell the same story the handler
enforces, since advertising "PPTX, image, and video appends a slide" on a locked group reads as a
bug (exactly how it was reported during Phase 30 verification).

### src/components/slides/SlideGrid.vue

**Task 3: drag-reorder within the selected group (D-11):** reuses the exact SortableJS pattern
already established in `ServiceEditorView.vue`'s slot list — `handle`/`draggable` scoping and
splice-and-reindex. R036 second lock over the instance itself: it is destroyed when `canReorder` goes
false, so `onEnd` only catches a drag already in flight when the service locks mid-gesture.
Draggable-scoped indices only (T-29-11) — `oldIndex`/`newIndex` count every element child of the
container, including 25-07's drop tile (a non-`.slide-card` sibling, always last today); only
`oldDraggableIndex`/`newDraggableIndex` respect the `draggable: '.slide-card'` selector. The tile
happens to sit last, which makes the un-prefixed pair latent rather than live here — fixed anyway for
symmetry with `ServiceEditorView.vue` and to guard the one divergence case (dragging past the tile's
own DOM position). Reads the current group and slot id from PROPS at call time — never from values
captured when the instance was created — since the same container instance serves whichever group is
selected.

### src/components/stage/StageLayoutView.vue

**Module overview (R313/R314/R315, Phase 107; redesigned to the single-room diagram):** shared
READ-ONLY stage-plot renderer. Pure presentational — props only, NO Pinia store import and NO
Firebase import — so it is safe to mount on the public, unauthenticated ShareView as well as the
locked-service editor and the print layout. This is the ONE component all three surfaces reuse; do
not fork a second read-only rendering path. Positions render directly from the stored
`xPct`/`yPct` percentages as inline `left`/`top` over the shared `StageRoom` rect — never computed
from a measured container — so placement is resize-stable and reload-exact (R314) by construction.
Labels/notes are Vue text interpolation only (XSS-safe).

### src/composables/useOutputWindow.ts

**`role` option:** each output view passes its OWN static role (`'audience' | 'confidence'`) — the
routes `/present/audience|confidence` make the role statically known. Retained as a harmless identity
option; fullscreen is no longer resolved from it. The control creates and positions each window on
its assigned monitor via `window.open` features, so auto-fullscreen has two independent, best-effort
paths: (1) the PRIMARY zero-click path — Chrome's "Automatic Fullscreen" content setting, via
`attemptAutoFullscreen()` on mount when the origin is granted; and (2) the fallback — Fullscreen
Capability Delegation from the opener (`handleDelegationMessage`) plus the one-tap overlay in each
view.

**Fullscreen Capability Delegation (best-effort zero-tap):** a popup opened via `window.open` loses
its OWN transient user-activation the moment its SPA/auth bootstrap runs, so a mount-time
`requestFullscreen()` here always rejected ("API can only be initiated by a user gesture") — the
console error the owner saw. The correct mechanism is Fullscreen Capability Delegation: the OPENER
(control window), which still HAS activation from the Go-live click, delegates its fullscreen
capability to us. The output window (a) announces readiness so the opener knows to delegate, and (b)
on receiving the delegation message calls `requestFullscreen()` — now permitted WITHOUT its own
gesture. A browser that does not implement capability delegation simply never enables this, and the
one-tap-anywhere affordance (rendered while `!isFullscreen`) guarantees a usable result. All
best-effort: never throws, never surfaces an error. `handleDelegationMessage` trusts ONLY
same-origin messages (the opener is the app's own origin).

### src/composables/useRunControl.ts

**`openWindow` auto-fullscreen (owner UAT):** Chrome's Window Management API supports opening a
popup DIRECTLY in fullscreen via the `fullscreen` window feature (with the window-management
permission — already granted in monitor setup — and this Go-live user gesture). `left`/`top` pick
the target monitor; `fullscreen` fills it with no chrome — harmless best-effort positioning.
Deliberately does NOT call `win.document.documentElement.requestFullscreen()` — that cross-document
call targets the child's still-loading/blank document from the OPENER and never worked. Reliable
auto-fullscreen is Fullscreen Capability Delegation instead: the child announces
`{ type:'wp-output-ready' }` and the control delegates its fullscreen capability back to it (see
`installFullscreenDelegation`/`handleOutputReady`) while the Go-live click's transient activation is
still valid — plus the child's one-tap-anywhere affordance as the guaranteed fallback.

**Fullscreen Capability Delegation (opener side):** a popup cannot self-fullscreen (it loses its own
activation to its bootstrap), but the control window still holds transient activation from the
Go-live click. When an opened output posts `{ type:'wp-output-ready' }` back to the control, it
delegates its fullscreen capability to that exact window via `postMessage` with the non-standard
`{ delegate:'fullscreen' }` option, so the child may then `requestFullscreen()` using the control's
delegated capability.

### src/composables/useSlideshowAssembly.ts

**Module overview:** reactive wrapper over the pure `assembleSlideshow` engine (20-02), delivering
R006: reorder/add/remove a service element and the assembled slideshow follows with no manual
re-sync. See the fuller module overview relocated to ARCHITECTURE.md § "src/composables/useSlideshowAssembly.ts"
for the content-map construction and `performanceOrder` ordering contract this wrapper builds on.

## Store & Entry-Point Stack Notes (R318)

### src/firebase/index.ts

**Emulator wiring (dev builds only):** `import.meta.env.DEV` is load-bearing, not belt-and-braces —
do not remove it, and do not "simplify" this back to a bare `VITE_USE_EMULATORS` check. This
shipped to production on 2026-08-05 gated on `VITE_USE_EMULATORS` alone, and the live site tried to
authenticate against `http://127.0.0.1:9099`. The reason: **Vite loads `.env.local` during a
production build too** — it is not a dev-only file. `.env.local` legitimately carries
`VITE_USE_EMULATORS=true` for local work (and must also carry the `VITE_FIREBASE_*` values the
build needs), so the flag was baked straight into the production bundle. Nothing warned: the build
succeeded, the deploy succeeded, and the breakage only appeared when a real user hit sign-in.
`import.meta.env.DEV` is statically `false` in a production build, so this whole block is
tree-shaken out of the bundle entirely — the emulator hosts cannot appear in shipped output even by
accident. That is the property `firebase.emulators.test.ts` asserts against the real built
artifact, rather than trusting this comment.

### src/main.ts

**Output-window fullscreen (module-load note):** there is deliberately NO module-load
`requestFullscreen()` here for `/present/*` windows. A popup opened via `window.open` does NOT
retain transient user-activation once its SPA/auth bootstrap runs, so a `requestFullscreen()` at
module load ALWAYS rejected with "API can only be initiated by a user gesture" — the console error
the owner saw, and it never actually went fullscreen. Auto-fullscreen for output windows is now
driven by Fullscreen Capability Delegation from the opener (the control window, which HAS
activation from the Go-live click) — see `useRunControl.ts` (delegates) + `useOutputWindow.ts`
(requests on delegation) — with a guaranteed one-tap-anywhere affordance as the fallback.

### src/stores/orgScopedStores.ts

**`resetOrgScopedStores`:** tears down EVERY org-scoped Pinia store — unsubscribe its Firestore
listener and clear its cached state — in one call. Quick 260823-switch-church-cache: each store's
`subscribe()` re-points its listener to the new org but keeps the previous org's `.value` array
until the new snapshot's first emission arrives. Because Vue Router mounts the destination view
before the source view unmounts, that stale array flashes on screen for a moment right after
switching churches (own church -> Enter Church, or the multi-church picker). Calling this at the
moment `orgId` changes — BEFORE any destination view mounts — guarantees no view can render the
prior church's data during the switch. Each teardown is null-guarded, so calling it while a view is
still mounted (its own `onUnmounted` will call the same teardown again) is harmless. Imported
dynamically from `auth.ts` to avoid the auth <-> store import cycle. STAGELAYOUTS-RESET-OBLIGATION —
RESOLVED (Phase 107): the forward obligation Phase 104 left here (R312) assumed Phase 107 would add
a `stageLayouts` org-scoped store needing its own teardown call. It did not — Phase 107 stores the
stage layout as an additive, optional field (`Service.stageLayout`) on the SERVICE document itself
(107-CONTEXT.md, superseding an earlier ARCHITECTURE.md draft that proposed a separate
`stageLayouts/{serviceId}` collection + store), owned end-to-end by `useServiceStore()`, whose
`unsubscribeAll()` is already called above. There is NO separate org-scoped stage-layout store to
register here, so a church switch cannot leak a prior church's stage layout — R312 is satisfied
with NO code change to this function. The literal token `STAGELAYOUTS-RESET-OBLIGATION` is kept
here (Phase 104 verification greps for it) purely as a resolved historical marker; do not add a new
`useStageLayout*()` teardown call.

### src/stores/pptxRenders.ts

**Module overview (Phase 42, R079/R080):** Pinia store for render-status documents —
`organizations/{orgId}/pptxRenders/{importId}`. Genuinely new design (42-PATTERNS.md "No Analog
Found"): every other store in this codebase either subscribes to ONE whole-collection query
(`importedSlides.ts`, `scriptureSlides.ts`) or does a one-shot per-id fetch
(`useSlideshowAssembly.ts`'s `loadMissingLyrics`). This store manages a DYNAMIC SET of live
per-document `onSnapshot` listeners — one per distinct `renderImportId` the current service
references — opened when an id joins the set and closed when it leaves (D-04, D-20; T-42-06
listener-leak guard). `renderImportId` is `ImportedDeck.renderImportId`, NOT
`ImportedDeck.id`/`ImportedSlot.importId` — the two identifiers are deliberately distinct
(`src/types/importedDeck.ts`); every map here is keyed by the former. An id absent from
`rendersByImportId` means "no render document yet" (or "its listener has been torn down") — never a
synthesized placeholder; callers must be able to tell "not written yet" from "written as pending"
(T-42-07's stale-render guard: an id's cached state can never outlive its subscription). Recorded
default (42-RESEARCH.md Assumption A2, D-20): one listener per `renderImportId` rather than a
single `where(documentId(), 'in', [...])` query — imported decks per service are typically 1-3, a
per-id listener set has a trivially correct teardown story, and the `in`-query alternative would
need re-issuing the whole query on every id-set change; revisit only if listener count becomes a
measured problem.

### src/stores/slideGroups.ts

**Module overview (Phase 24):** Pinia store for slide groups. Mirrors
`useImportedSlides`/`useScriptureSlides` (`src/stores/importedSlides.ts`,
`src/stores/scriptureSlides.ts`) against the `organizations/{orgId}/slideGroups` sibling
collection, with `slides` as an EMBEDDED ARRAY field (never a nested subcollection — see
`src/types/slideGroup.ts`). This is the ONLY module in the phase that talks to Firestore about
groups — every group write (materialize, delete, bed media, slide replace) lives here so a second,
competing save path never appears next to `ServiceEditorView`'s existing whole-document autosave
(R018). NEVER use the random-auto-id create function here: every group document's id IS the
anchoring slot's stable id (D-01) — a deterministic doc id — so that lazy materialization from two
simultaneously-open tabs can never create two divergent documents for the same slot (RESEARCH.md
Pattern 1).

## Type & View Stack Notes (R318)

### src/types/importedDeck.ts

**`ImportedDeck.renderImportId` (Phase 37, R062):** the Storage-side import id — the same
`crypto.randomUUID()` value `pptxUpload.ts`'s `generateImportId()` produces, which scopes
`orgs/{orgId}/pptx-imports/{importId}/` and `organizations/{orgId}/pptxRenders/{importId}`.
Deliberately distinct from this interface's own `id`, which Firestore assigns via `addDoc()` when
`importedSlidesStore.createDeck()` confirms the deck. Without this field nothing can join a
confirmed deck to its render record — the two identifiers were structurally unlinked before this
field existed. Optional because decks confirmed before this phase have no render record, and
because image-only imports (no `source.pptx`, nothing to render) never produce one.

### src/types/service.ts

**`Service.stageLayout` (R313/R314/R315, Phase 107):** visual stage plot for tech/sound. Additive,
optional, no-migration — mirrors `messaging`/`notes`/`loop`'s lifecycle exactly: absent on every
service written before this field existed (old behavior, no backfill needed), and an emptied layout
is set back to `undefined` and dropped by the existing `stripUndefined` save path before the
Firestore write, so a raw `undefined` never reaches the document. Deliberately NOT a new top-level
collection or subcollection (an earlier milestone ARCHITECTURE.md draft proposed a
`stageLayouts/{serviceId}` collection + store — 107-CONTEXT.md supersedes that draft). Storing it
here means the layout rides the service doc's existing read/write `firestore.rules`, its existing
`onSnapshot`, and the existing autosave path — no new rules surface, no new Pinia store. This is
also what RESOLVES the Phase-104 `STAGELAYOUTS-RESET-OBLIGATION` marker in
`src/stores/orgScopedStores.ts`: because the layout lives on the service doc (owned by the
already-reset services store), a church switch cannot leak a prior org's layout — there is no
separate store to register.

### src/views/ServiceEditorView.vue

**Sortable — one instance per section (29-03/R044):** one Sortable instance PER SECTION list
container — this codebase's first multi-instance Sortable and first use of SortableJS `group`
(cross-section drag). Generalizes `SlideGrid.vue`'s single-instance `canReorder` computed +
`destroySortable()` guard to a keyed `Map<ServiceSection | 'ungrouped', Sortable>` (PATTERNS.md
"Multi-instance Sortable lifecycle"). R036: this computed carried NO lock term until 31-04, so
drag-reorder worked on an exported service — a live defect, not a theoretical one. Composing
`canEditService` in also gives the Sortable teardown for free: the watcher keys on `canReorder`, so
the five per-section instances are `destroy()`ed the moment the service locks and re-created the
moment it unlocks.

**Cross-section drag orphan reclaim (R110):** reclaims any node SortableJS physically relocated
across containers. On a cross-section drag, Sortable moves the dragged `.slot-item` into the target
`<ul>` before the reorder handler runs; the reactive slot-array reassignment is correct, but Vue
does not reconcile that stray node — when the source section empties it removes the container
subtree without reclaiming the moved child, orphaning a handler-less "No Section" phantom. The
handler tears the section Sortables down FIRST, then bumps a render nonce so every keyed container
`<div>` is discarded and rebuilt from state (reclaiming the orphan). The teardown is load-bearing,
not belt-and-braces: the lifecycle watcher only creates a Sortable when
`!sectionSortables.has(key)`, so without clearing the map it would leave stale instances bound to
discarded elements and the rebuilt containers with no Sortable at all (dead drag) — the same
destroy-then-nonce pairing `SlideGrid.vue` uses.

---

*Stack analysis: 2026-07-16*
