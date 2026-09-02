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

**Font-size scoped-style rule (R093, 46-04):** per-element font-weight/font-size overrides reading
the `--slide-font-*` custom properties `PresentationViewer`'s `typographyStyle` sets on its viewer
root, which these elements inherit into (moved here unchanged, Phase 90).

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

---

*Stack analysis: 2026-07-16*
