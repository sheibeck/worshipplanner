# Phase 42: PowerPoint Rendered-Image Display - Research

**Researched:** 2026-08-07
**Domain:** Client-side consumption of an existing server-side render pipeline (Firestore live
subscription, Firebase Storage URL resolution, pure slide-assembly reconciliation, Firestore
security rules)
**Confidence:** HIGH — every claim below is grounded in a direct read of the cited file/line, not
training-data assumption. Two findings (marked ★) are corrections to premises stated in
42-CONTEXT.md / functions/src/index.ts's own comments — both are HIGH confidence because they
follow the exact OR-semantics this codebase's own `firestore.rules` comments already document and
the codebase's own documented "Trap 1" comment, not a new theory.

## Summary

This phase is client-only in the sense that no new backend code ships, but it is not a thin
"swap a URL" job. Three things make it structurally non-trivial, in order of how much they should
drive the plan's task breakdown:

1. **The rendered page sequence has no reliable positional correspondence to `deck.slides`.**
   `functions/src/index.ts`'s own "Trap 1" comment (quoted verbatim below) says `pptxParser.ts`'s
   `mapAstToSlides` **skips** slides with neither substantial text nor images, and emits **one
   entry per image** on a multi-image slide. Both effects break index alignment in both
   directions — deck.slides[3] is not reliably "the same slide" as rendered page 4. The safe,
   sound design (and the one that best matches the owner's own framing, "the slides look like they
   natively looked") is to treat the READY state's slide sequence as `renderedCount` independent
   image entries, sourced ONLY from the render pages, with `deck.slides` retained for search/label
   purposes but **not** positionally paired to render pages for display. 42-CONTEXT.md's "surplus"
   framing (surplus = `renderedCount − deck.slides.length`) is the locked decision for *counting*,
   but nothing in the codebase supports pairing rendered page N with `deck.slides[N]` for a
   text-label overlay — see Pitfall 1.

2. **The pure-function purity contract blocks the obvious implementation.** `slideGroupMaterializer.ts`
   and `slideshowAssembler.ts` are explicitly documented as PURE — no Firestore reads, no Storage
   calls. But displaying a rendered PNG requires an async `getDownloadURL()` call per page (Firebase
   Storage download URLs carry a token that cannot be constructed client-side from the path alone).
   This means URL resolution must happen in the composable layer (`useSlideshowAssembly.ts`,
   which already does exactly this shape of thing for `songLyricsById`), with the **resolved URLs**
   passed into the pure engines as a new `AssemblyInputs` field — mirroring `importedDecksById`,
   never inlined into the pure functions themselves.

3. **★ The `firestore.rules` change needed is not what 42-CONTEXT.md describes.** Direct rules
   re-read shows `organizations/{orgId}/pptxRenders/{importId}` already matches the existing
   generic `match /{collection}/{docId}` block (nested inside `match /organizations/{orgId}`,
   `firestore.rules:198-203`) because `'pptxRenders'` is **not** in that block's exclusion list
   (only `'services'` and `'slideGroups'` are excluded). Firestore rules are OR-evaluated — this
   codebase's own comment at `firestore.rules:174-184` documents and cites emulator-verified proof
   of exactly this mechanism for the `services`/`slideGroups` exclusions. Concretely, **an org
   editor can already read AND write `pptxRenders` docs today**, contradicting both
   `functions/src/index.ts:144-148`'s comment ("the rules file's catch-all... already denies client
   access") and 42-CONTEXT.md's claim that "the client cannot read status... at all today." Adding
   only a new `allow read: if isOrgMember(orgId)` block (as CONTEXT specifies) does not close the
   T-37-15 write hole the CONTEXT deck itself explicitly wants to guard against — the generic
   wildcard's `write: if isOrgEditor(orgId)` grant remains untouched and still ORs in. The
   `firestore.rules` task must **also** extend the generic block's exclusion list to
   `collection != 'services' && collection != 'slideGroups' && collection != 'pptxRenders'`, exactly
   mirroring how `slideGroups` was excluded. See Pitfall 2 for the full argument and the exact diff
   shape.

**Primary recommendation:** Add a `usePptxRenders`-style store (mirrors `useImportedSlides`)
subscribing live (`onSnapshot`, per distinct `renderImportId`) to `pptxRenders` docs; feed its
`Map<importId, PptxRenderDoc>` PLUS a client-resolved `Map<"importId:pageNumber", downloadUrl>`
into a new `AssemblyInputs` field consumed by one shared pure helper
(`resolveImportedSlides.ts` or similar) that both `slideGroupMaterializer.ts`'s IMPORTED branch and
`slideshowAssembler.ts`'s `resolveEntryContent`/fallback IMPORTED branch call — never duplicating
the reconciliation logic. Extend `SourceRef`'s `imported` variant and `ImageSlide` (or `AssembledSlide`)
with render-state fields so `SlideCard.vue`/`PresentationViewer.vue` can branch on
pending/ready/failed without inventing a new `contentKind`. Fix the `firestore.rules` generic-wildcard
write hole in the same commit as the new read rule.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Render status live subscription | Frontend (Pinia store) | — | Mirrors `useImportedSlides`/`useSlideGroups` — a live Firestore listener owned by a store, not a component |
| Rendered-page URL resolution (`getDownloadURL`) | Frontend (composable) | Database/Storage (Firebase Storage) | Async Storage SDK call; must happen outside the PURE assembly engines per their documented no-I/O contract |
| Slide-count reconciliation (parsed vs rendered) | Frontend (pure utility, shared helper) | — | `slideGroupMaterializer.ts`/`slideshowAssembler.ts` are pure, framework-agnostic logic; this is exactly their existing job |
| Pending/failed visual states | Frontend (Vue components: `SlideCard.vue`, `PresentationViewer.vue`) | — | Per 42-UI-SPEC.md, presentational only, driven by data already resolved upstream |
| `pptxRenders` read authorization | Database (Firestore security rules) | — | The only privilege boundary in this phase; must be fixed alongside the new read grant, not only added to |
| Render pipeline itself (LibreOffice/Poppler, Cloud Run) | Backend (already deployed) | — | Out of scope — explicitly not touched this phase |

## Package Legitimacy Audit

Not applicable — this phase installs no new npm packages. It consumes `firebase/firestore` and
`firebase/storage`, both already project dependencies (`getDownloadURL`, `onSnapshot`, `doc`, `where`,
`documentId` are all already imported elsewhere in `src/`). No `package-legitimacy check` run was
needed.

## Standard Stack

No new libraries. Every primitive this phase needs is already in use elsewhere in the same
codebase area:

| Primitive | Already used at | Reused for |
|-----------|-----------------|------------|
| `onSnapshot(doc(...))` / `onSnapshot(query(...))` | `src/stores/slideGroups.ts`, `src/stores/importedSlides.ts` | Live `pptxRenders` subscription |
| `getDownloadURL(ref(storage, path))` | `src/utils/pptxUpload.ts::resolveImageUrl` | Resolving a rendered page's Storage path to a displayable URL |
| `firebase/firestore`'s `documentId()` + `where(documentId(), 'in', [...])` | not yet used in this codebase, but standard SDK API — **optional** alternative to per-doc listeners if the planner prefers one query over N listeners (see Open Question 1) | Batched `pptxRenders` reads for a service with several imported decks |

## Architecture Patterns

### System Architecture Diagram

```
 [PptxImportModal.vue, Phase 37 — UNCHANGED]
        │ writes ImportedDeck.renderImportId
        ▼
 [importedSlides store] ──subscribeDecks()──► deck.slides (parsed, for search/labels — NEVER drawn once a render exists)
        │
        │ renderImportId
        ▼
 [NEW: pptxRenders store] ──onSnapshot per importId──► organizations/{orgId}/pptxRenders/{importId}
        │  { status, storagePath, renderedCount?, failureReason? }
        ▼
 [NEW: resolved-URL cache, composable-owned] ──getDownloadURL() per rendered page, cached──►
        orgs/{orgId}/pptx-imports/{importId}/rendered/page-XXXX.png
        │
        ▼
 [useSlideshowAssembly.ts] ── builds AssemblyInputs { ..., pptxRendersById, renderedImageUrlsByImportId }
        │
        ├──► [slideGroupMaterializer.ts: deriveGroupEntries/sourceSignature, IMPORTED branch]
        │        └─► SHARED reconciliation helper (new) — decides entry count & sourceRef per status
        │
        └──► [slideshowAssembler.ts: resolveEntryContent/fallback, IMPORTED branch]
                 └─► SAME shared reconciliation helper — must agree with the materializer, never a
                     second copy (CONTEXT: "the grid and the presenter disagreeing... is the exact
                     failure this phase exists to end")
        │
        ▼
 [SlideGrid.vue / SlideCard.vue]         [PresentationViewer.vue]
   ready → <img> (byte-identical to        ready → <img> (byte-identical to
   existing ImageSlide branch)             existing ImageSlide branch)
   pending → spinner + "Rendering…"        pending → spinner + heading
   failed → red tint + mapped reason       failed → amber icon + mapped reason
```

### Recommended Project Structure

```
src/
├── stores/
│   └── pptxRenders.ts          # NEW — mirrors importedSlides.ts; live per-importId subscription
├── utils/
│   ├── slideGroupMaterializer.ts   # IMPORTED branch reworked to call the shared helper
│   ├── slideshowAssembler.ts       # IMPORTED branch (group + fallback) reworked to call the shared helper
│   └── importedRenderReconciler.ts # NEW — the ONE shared helper (naming is Claude's discretion per CONTEXT)
├── composables/
│   └── useSlideshowAssembly.ts     # subscribes the new store; owns the resolved-URL cache; extends AssemblyInputs
├── components/slides/
│   ├── SlideCard.vue               # + pending/failed branches per 42-UI-SPEC.md
│   └── slideDisplay.ts             # + failureReason → sentence lookup table (KIND_BADGE_CLASSES-shaped)
├── components/
│   └── PresentationViewer.vue      # + pending/failed branches per 42-UI-SPEC.md
└── types/
    ├── slide.ts                    # ImageSlide (or SlideBase) gains optional render-state fields
    └── slideGroup.ts               # SourceRef's `imported` variant gains a page-number/synthetic-id shape
```

### Pattern 1: Deterministic Storage path, no Storage listing required

The client can construct a rendered page's Storage path purely from `(orgId, importId, pageNumber)`
— no `listAll()`/`getFiles()` call is ever needed client-side. This mirrors (but must NOT import
from) the Cloud Function/render-service pair, since `functions/src/` and `render-service/src/` are
separate Node packages from `src/` (the Vite/Vue app) and cannot be imported across that boundary.

```typescript
// Source: functions/src/index.ts:274-283 and render-service/src/render.ts:69-79
// (server-side canonical definitions — the client needs its OWN copy of this
// convention; there is no shared package boundary to import from)
function renderedPrefixFor(orgId: string, importId: string): string {
  return `orgs/${orgId}/pptx-imports/${importId}/rendered/`
}

const RENDERED_PAGE_PAD = 4 // page-0001.png .. page-9999.png

function renderedObjectName(pageNumber: number): string {
  return `page-${String(pageNumber).padStart(RENDERED_PAGE_PAD, '0')}.png`
}

// Page numbers are 1-BASED. functions/src/index.ts:408's own contiguity check
// is `pageNumbers.every((n, i) => n === i + 1)` — page 1 is the first page,
// there is no page 0. A `renderedCount` of N means pages 1..N exist, always
// contiguous (the render trigger's own "ready" gate REQUIRES contiguity —
// see Pitfall 3).
```

**Recommendation:** duplicate this tiny convention client-side (3 constants/functions) rather than
attempt a shared package — the two other server packages (`functions/`, `render-service/`) are not
importable from `src/` (different `tsconfig`/build targets, `functions/` uses `firebase-admin`
which cannot run in the browser). Put the client copy in the same file as the resolved-URL cache
(`useSlideshowAssembly.ts` or a small dedicated util) with a comment cross-referencing the two
server-side originals so a future page-numbering change is easy to keep in sync.

### Pattern 2: Async URL resolution owned by the composable, never the pure engines

```typescript
// Source: src/composables/useSlideshowAssembly.ts:205-222 (existing pattern for songLyricsById)
// This phase's renderedImageUrlsByImportId map follows the SAME shape:
// synchronous computed decides WHAT to resolve, an async function does the
// actual I/O, results land in a `reactive(new Map())` the computed AssemblyInputs reads.
async function loadMissingRenderedUrls(renders: Map<string, PptxRenderDoc>) {
  for (const [importId, render] of renders) {
    if (render.status !== 'ready' || !render.renderedCount) continue
    const cacheKey = `${importId}:${render.renderedCount}` // invalidates on renderedCount change
    if (resolvedUrlCache.has(cacheKey)) continue
    const urls = await Promise.all(
      Array.from({ length: render.renderedCount }, (_, i) =>
        resolveImageUrl(`${renderedPrefixFor(orgId, importId)}${renderedObjectName(i + 1)}`),
      ),
    )
    resolvedUrlCache.set(cacheKey, urls)
  }
}
```

Reuses `src/utils/pptxUpload.ts::resolveImageUrl` (already exported, already the codebase's one
`getDownloadURL` wrapper for this exact use — see `PptxImportModal.vue:328/394` for the existing
call shape). **Caching by `${importId}:${renderedCount}` is load-bearing** — without it, every
reactive recompute of `assembledSlideshow` would re-issue N `getDownloadURL` network calls per
imported deck per recompute (Pitfall 4).

### Pattern 3: The one shared reconciliation helper (both consumers, one source of truth)

CONTEXT.md is explicit: "The reconciliation lives in one shared helper consumed by both
`slideGroupMaterializer.ts` and `slideshowAssembler.ts`." Concretely, this helper's job is to
answer, given `(deck, render, resolvedUrls)`:

- How many entries exist, and in what order? (`render.status === 'ready'` → `renderedCount`
  entries, sourced only from the render; anything else → `deck.slides.length` entries, all in the
  pending/failed placeholder state — see Pitfall 1 for why NOT `max(deck.slides.length, renderedCount)`
  or any parsed/rendered pairing.)
- What is each entry's stable identity (`innerSlideId`) for `derivedIdentityKey`/`carryStoredDerivedEntries`
  to key on across a rebuild? Recommendation: `rendered-page-${pageNumber}` for every ready-state
  entry (not `deck.slides[i].id` — see Pitfall 1), and continue using `deck.slides[i].id` for
  pending/failed-state placeholder entries (so a pending→ready transition for the FIRST
  `deck.slides.length` slides can still carry forward any user-set label/audio/notes on those
  specific entries, and only entries beyond that boundary are wholly new).
- What content does each entry resolve to? `resolveEntryContent`'s existing `imported` case
  (`slideshowAssembler.ts:186-193`) currently does `deck.slides.find(id)` — this must branch: a
  `rendered-page-N` identity resolves to the pre-resolved URL at `renderedImageUrlsByImportId
  .get(importId)?.[N-1]`; a `deck.slides[i].id`-identity placeholder resolves to nothing drawable
  (the component layer renders pending/failed chrome instead, driven by the render-state field on
  the slide, not by `resolveEntryContent`'s content shape).

### Anti-Patterns to Avoid

- **Deriving `<img>` src by string-templating a `getDownloadURL`-shaped URL.** Firebase Storage
  download URLs are opaque (bucket, path, and a server-issued `token` query param) — there is no
  client-derivable formula. Always call `getDownloadURL()`.
- **Calling `getDownloadURL()` (or any Storage/Firestore API) from inside `deriveGroupEntries`,
  `sourceSignature`, or `resolveEntryContent`.** These are explicitly documented PURE — breaking
  that contract breaks their unit-testability (every existing test in
  `slideGroupMaterializer.test.ts`/`slideshowAssembler.test.ts` calls them synchronously with
  plain-object fixtures) and the composable's `computed()` re-invocation model (a `computed` that
  triggers async side effects on every access is a well-known Vue foot-gun).
- **Pairing `deck.slides[i]` with rendered page `i+1` for a text-label overlay.** See Pitfall 1 —
  this index correspondence is not guaranteed to exist.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Resolving a Storage path to a display URL | A second `getDownloadURL` wrapper | `src/utils/pptxUpload.ts::resolveImageUrl` (already exists, already tested, already mocked in `PptxImportModal.test.ts`/`SlideGrid.test.ts`) | One canonical wrapper avoids two slightly-different error-handling paths |
| Firestore rules ALLOW/DENY test scaffolding | A new test harness | `src/rules.test.ts`'s existing `seedDoc`/`seedMembershipDoc`/`testEnv.authenticatedContext` helpers (lines 1-51) | Already the established, CLAUDE.md-mandated pattern; every recent rules phase (40, 41) used it verbatim |
| Render-page path/name convention | A guess at the naming scheme | The exact constants documented in Pattern 1 above, copied from `functions/src/index.ts`/`render-service/src/render.ts` | Any drift (e.g. wrong padding width, 0-based numbering) produces silent 404s the render pipeline itself would never produce |

**Key insight:** every piece of infrastructure this phase needs (URL resolution, rules-test
harness, store-subscription shape, pure-engine dispatch pattern) already has exactly one canonical
implementation elsewhere in this codebase. The work is wiring, not invention — except for the
reconciliation policy itself (Pattern 3), which is genuinely new logic.

## Common Pitfalls

### Pitfall 1: Assuming `deck.slides[i]` pairs with rendered page `i+1` (HIGH RISK — read this before writing any reconciliation code)

**What goes wrong:** A naive implementation zips `deck.slides` against rendered pages by index —
e.g. "use `deck.slides[i]`'s alt text as page `i+1`'s label; treat indices beyond
`deck.slides.length` as surplus." This produces WRONG pairings for any deck where a slide was
skipped during parsing or where a slide had multiple images.

**Why it happens:** `functions/src/index.ts`'s own doc comment (lines 296-306, quoted verbatim) is
unambiguous:

> "★ Trap 1 ... this handler must NEVER import, reference, or reason about parsePptxBuffer,
> MappedSlide, or a parsed slide array. mapAstToSlides (pptxParser.ts) SKIPS slides with neither
> substantial text nor images, and emits ONE ENTRY PER IMAGE on a multi-image slide -- its length
> is structurally decoupled from the deck's real page count (a 6-slide deck can yield 4 entries, or
> more than 6 with a multi-image collage). Deriving the expected render page count from it would be
> silently wrong in BOTH directions."

This is about the *bridging Function* deriving a count from the parsed array — but the same fact
means the CLIENT deriving a per-index PAIRING is equally unsound. A deck that skipped slide 3
during parsing has `deck.slides[2]` actually corresponding to PPTX page 4, not page 3.

**How to avoid:** Treat the ready-state slide sequence as `renderedCount` independent entries with
no per-index text pairing to `deck.slides`. Use `deck.slides.length` only as a COUNT (for the
pending/failed placeholder state, and for the 42-CONTEXT.md-mandated "surplus" framing when
counting, not pairing). Every ready-state entry gets the same generic label treatment
(`slideContentLabel`'s existing `'IMAGE'` fallback, `slideDisplay.ts:121`) — do not invent a
per-page label from parsed text.

**Warning signs:** any code that does `deck.slides[pageIndex]` or `deck.slides.find((s, i) => i ===
pageNumber - 1)` for content/label purposes in the ready-state path.

### Pitfall 2: ★ The `firestore.rules` generic-wildcard write hole (verify with an emulator test before trusting this write-up)

**What goes wrong:** Following 42-CONTEXT.md's decision literally — adding ONLY a new
`match /organizations/{orgId}/pptxRenders/{importId} { allow read: if isOrgMember(orgId); }` block
— does not close the write hole 42-CONTEXT.md itself says must stay closed ("Do not open
create/update/delete; nothing client-side writes this document and opening it would let a client
fake a `ready` flip, which `functions/src/index.ts:342` calls out as threat T-37-15").

**Why it happens:** `firestore.rules:198-203`'s generic block —

```
match /{collection}/{docId} {
  allow read: if isOrgEditor(orgId);
  allow write: if isOrgEditor(orgId)
    && collection != 'services'
    && collection != 'slideGroups';
}
```

— is nested inside `match /organizations/{orgId} { ... }` and matches ANY two-segment path under
an org, including `pptxRenders/{importId}`, because `'pptxRenders'` is absent from the exclusion
list. `firestore.rules:174-184`'s own comment documents (and cites emulator-verified proof,
"31-RESEARCH.md, probe A1/A2") that Firestore rules are OR-evaluated: "a broader rule that grants
access wins over a narrower one that denies... Without this exclusion the status guard in the
/services block above is a complete NO-OP." The exact same mechanism applies to `pptxRenders`
today. Both `functions/src/index.ts:144-148`'s comment and 42-CONTEXT.md's premise ("the client
cannot read `status`... at all today") appear to have been written without checking whether
`pptxRenders` was covered by this generic wildcard — it was, all along, for org EDITORS (not
members/viewers).

**How to avoid:** The `firestore.rules` task must do BOTH:
1. Add the new dedicated block (CONTEXT's plan) so a **member** (not just an editor) can read.
2. Extend the generic wildcard's exclusion to
   `collection != 'services' && collection != 'slideGroups' && collection != 'pptxRenders'`, so the
   generic block's `write: if isOrgEditor(orgId)` grant no longer applies to `pptxRenders`. Without
   this, the "read-only, admin-writes-only" invariant CONTEXT wants is not actually true — an org
   editor's client SDK could `setDoc`/`updateDoc` a `pptxRenders` doc today, before or after this
   phase, via the untouched generic wildcard.

**Verify before trusting this as final:** this conclusion is HIGH confidence from direct code
reading (the same OR-semantics this very file already documents and the codebase's own authors
already applied twice), but it has not been proven by an actual emulator `assertSucceeds`/`assertFails`
probe in this research pass. **The plan's Wave 0 should include exactly that probe** — an org
editor `setDoc` to a `pptxRenders` doc, asserted to fail AFTER the exclusion is added (and, ideally,
asserted to currently SUCCEED on `master` before the fix lands, as the regression proof).

**Warning signs:** a rules test that only exercises the NEW block's read grant and never attempts a
write from an org editor would miss this entirely — exactly the "deny-only suite is not evidence"
trap CLAUDE.md already calls out for `storage.rules`.

### Pitfall 3: `renderedCount` alone is not "ready" — contiguity already gates it server-side, but the client must not re-derive readiness from count alone

**What goes wrong:** Reading `renderedCount > 0` as a proxy for "usable" without checking `status
=== 'ready'`.

**Why it happens:** `functions/src/index.ts:396-415` — the three-conjunct "ready gate" (T-37-13) —
`actualCount > 0 && actualCount === reportedCount && contiguous` — means `status` already encodes
every failure mode (empty render, partial/non-contiguous render, mismatched self-report). A
`pending` doc can carry `renderedCount: undefined` (never set, per the initial queue write at
`functions/src/index.ts:235`); a `failed` doc CAN carry a non-zero `renderedCount` (e.g. the
`incomplete-render` outcome at line 411-415 still writes the partial `actualCount`). The client must
gate entirely on `status === 'ready'`, never on `renderedCount` truthiness alone.

**How to avoid:** Every consumer (`deriveGroupEntries`, `sourceSignature`, `resolveEntryContent`)
must branch on `render.status`, not on `render.renderedCount`.

**Warning signs:** any conditional shaped `if (render.renderedCount) { ... }` instead of `if
(render.status === 'ready') { ... }`.

### Pitfall 4: Unbounded `getDownloadURL()` calls on every reactive recompute

**What goes wrong:** `assembledSlideshow` is a Vue `computed` re-evaluated on many reactive changes
(slot reorder, any group write, etc). If URL resolution is inlined into that computed's dependency
chain without caching, every recompute re-issues N Storage SDK calls per imported deck.

**How to avoid:** Cache resolved URLs keyed by `${importId}:${renderedCount}` (Pattern 2) so a
cache hit is a synchronous Map lookup and only a genuine `renderedCount` change (which
`sourceSignature`'s fold-in already exists to detect, per CONTEXT's decision) triggers new
resolution calls.

**Warning signs:** a test that mocks `getDownloadURL` and asserts a specific call COUNT — if it
grows unboundedly across multiple `assembledSlideshow.value` accesses in the same test, the cache is
missing.

### Pitfall 5: A held-open `onSnapshot` listener per rendered deck leaking across service navigations

**What goes wrong:** `useSlideshowAssembly.ts`'s existing subscriptions (`scriptureStore`,
`importedStore`, `slideGroupsStore`) are all guarded by `subscribedOrgId` (subscribe once per org,
not per document) and cleaned up in `onUnmounted(cleanup)`. A new per-`importId` `pptxRenders`
listener needs the SAME lifecycle discipline — including unsubscribing listeners for `importId`s
that are no longer referenced by any slot in the CURRENT service (a deck removed from the service,
or the service itself changing), or the store accumulates listeners indefinitely across a session.

**How to avoid:** Model the new store's subscription set as reactive to `distinctRenderImportIds`
(mirrors the existing `distinctSongIds` pattern at `useSlideshowAssembly.ts:195-203`), tearing down
listeners for ids no longer present, exactly like `loadMissingLyrics` adds but never removes —
except THIS case genuinely needs removal since `onSnapshot` (unlike the one-shot lyrics `getDocs`)
holds an open connection.

## Code Examples

### Existing `getDownloadURL` wrapper (reuse this, do not duplicate)

```typescript
// Source: src/utils/pptxUpload.ts:173-181
/**
 * Resolves a Storage path (as returned by parsePptx for ImageSlide.imageUrl,
 * or produced directly by uploadImage) to a display URL via getDownloadURL —
 * so image display is governed by storage.rules, never a long-lived signed
 * URL minted server-side.
 */
export async function resolveImageUrl(path: string): Promise<string> {
  return getDownloadURL(ref(storage, path))
}
```

### Existing per-distinct-id async loader pattern (model the new render-status loader on this)

```typescript
// Source: src/composables/useSlideshowAssembly.ts:205-230 (abbreviated)
async function loadMissingLyrics(ids: string[], org: string | null) {
  if (!org) return
  const missing = ids.filter((id) => !songLyricsById.has(id))
  if (missing.length === 0) return
  isLoading.value = true
  try {
    await Promise.all(missing.map(async (songId) => {
      const lyrics = await loadLyrics(org, songId)
      if (lyrics) songLyricsById.set(songId, lyrics)
    }))
  } finally {
    isLoading.value = false
  }
}
const stopLyricsWatch = watch([distinctSongIds, resolvedOrgId], ([ids, org]) => {
  void loadMissingLyrics(ids, org)
}, { immediate: true })
```
The render-status subscription differs in one respect: it must be a LIVE `onSnapshot`, not a
one-shot `getDocs`/`getDoc`, because criterion 4 requires reacting to a `pending → ready` transition
while the page is open (CONTEXT: "Subscribe with `onSnapshot`, not a one-shot `getDoc`").

### Existing rules-test harness (reuse verbatim for the new pptxRenders ALLOW/DENY suite)

```typescript
// Source: src/rules.test.ts:32-51
async function seedDoc(path: string, data: Record<string, unknown>) {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore()
    const parts = path.split('/')
    const ref = doc(db, parts[0]!, ...parts.slice(1))
    await setDoc(ref, data)
  })
}
// Usage for this phase:
// await seedDoc('organizations/orgA/pptxRenders/import-1', { status: 'ready', storagePath: '...', renderedCount: 3 })
// await seedMembershipDoc('orgA', 'userA', 'viewer')  // MEMBER, not editor — proves the read grant is member-level
// const context = testEnv.authenticatedContext('userA')
// await assertSucceeds(getDoc(doc(context.firestore(), 'organizations', 'orgA', 'pptxRenders', 'import-1')))
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| PPTX import shows only parsed text/extracted images (`deck.slides`) | PPTX import shows the true rendered PNG per page, falling back to explicit pending/failed states | This phase (v1.5 Phase 42), closing out the backend Phase 37 shipped in v1.4 | The `IMPORTED` slot kind's visual output changes for every deck with a `renderImportId`; decks without one (pre-Phase-37 imports, image-only imports) are explicitly unaffected |

**Deprecated/outdated:** none — this is additive to the existing IMPORTED pipeline, not a
replacement of any currently-shipped path. `deck.slides` stays the searchable/label record; it is
simply no longer the DRAWN content once a render exists and is ready.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The recommended synthetic identity `rendered-page-${pageNumber}` for ready-state entries is stable enough for `derivedIdentityKey`/`carryStoredDerivedEntries` to carry user edits (label/audio/notes) across a rebuild that leaves `renderedCount` unchanged. **[ASSUMED]** — not verified against an actual multi-rebuild test in this research pass. | Pattern 3 / Don't Hand-Roll | If a rebuild that shouldn't change anything regenerates entries with new ids, user-attached per-slide audio/notes on a rendered-image slide would be silently dropped on the next unrelated rebuild — the exact class of bug Phase 26/28/30 fixed for other kinds. The planner should add a test explicitly proving idempotence: same `(deck, render)` inputs twice → identical entry ids. |
| A2 | Store-per-`importId` `onSnapshot` listeners (rather than a single `where(documentId(), 'in', [...])` query covering all of a service's imported decks at once) is architecturally preferable, mirroring the existing per-song lyrics pattern. **[ASSUMED]** — a reasonable default, not dictated by any locked decision. | Pattern 2 / Open Questions | If a service has many (10+) imported decks, N live listeners is heavier than one `in`-query listener. Low risk in practice — imported-PPTX decks per service are typically few — but flagged for the planner's discretion. |
| A3 | Extending `ImageSlide`/`AssembledSlide` with new optional render-state fields (rather than introducing a new `SlideContentKind`) is the right shape. **[ASSUMED]** — inferred from 42-UI-SPEC.md's explicit statement that the ready state is "byte-identical treatment to the existing `ImageSlide` path," implying pending/failed are variations on the same content kind, not a new kind. Not confirmed with the user as a locked decision. | Common Pitfalls / Recommended Project Structure | If a new discriminated `contentKind` were preferred instead, every exhaustive `switch (slide.contentKind)` in `slideDisplay.ts`, `PresentationViewer.vue`, `EditSlideDrawer.vue`, `slideActionMenuItems` would need a new arm — a much larger diff. The planner should confirm this shape choice explicitly in the plan rather than assume research settled it. |

## Open Questions

1. **Per-`importId` listeners vs one batched `in`-query listener for the `pptxRenders` subscription
   (A2 above).**
   - What we know: both are standard Firestore SDK patterns; the codebase currently has no
     precedent for either shape applied to a "small N, live" subscription set (the closest
     precedent, per-song lyrics, is one-shot `getDocs`, not live).
   - What's unclear: whether the planner considers listener-count overhead worth optimizing for in
     this phase, given decks-per-service is typically small (1-3).
   - Recommendation: default to per-`importId` listeners (simpler lifecycle mirroring
     `distinctSongIds`), document the `in`-query alternative as a future optimization if listener
     count ever becomes a measured problem.

2. **Should the grid tile's content-label eyebrow for a ready-state rendered slide say something
   other than the generic `'IMAGE'` fallback?** 42-UI-SPEC.md only specifies the label for the
   SURPLUS case explicitly ("its content-label eyebrow reads 'IMAGE'"); it is silent on whether a
   ready-state slide that happens to have an index within `deck.slides.length` should show
   something more specific. Given Pitfall 1's finding that no reliable per-index pairing exists,
   the technically sound answer is "no, every ready-state slide gets the generic `'IMAGE'` label" —
   but this was not explicitly confirmed with the user as a locked decision, only inferred from the
   UI-SPEC's silence plus the code-level unsoundness of any alternative. Flag for the planner to
   either treat as settled by this research or bounce back to a quick confirm.

3. **Firestore composite index needs.** None identified — every read this phase introduces is a
   direct single-document read by known id (`organizations/{orgId}/pptxRenders/{importId}`) or, if
   the batched-query alternative (Open Question 1) is chosen, a single `where(documentId(), 'in',
   [...])` clause with no `orderBy` on a different field — neither shape requires a composite index.
   `firestore.indexes.json` exists in the repo root but needs no new entry for this phase. This is
   the "Phase 41 composite-index trap" research question's answer: **no repeat here**, because
   Phase 41's trap involved a `where` + `orderBy` combination on different fields, which this phase
   does not do.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|--------------|-----------|---------|----------|
| Firestore emulator | `npm run test:rules` (new `pptxRenders` ALLOW/DENY suite, CLAUDE.md-mandated) | Not probed this research pass — assume available per CLAUDE.md's documented `npx vitest run --config vitest.rules.config.ts` fallback if `test:rules`'s own emulator start hits "port taken" | — | Run against an already-running emulator directly, per CLAUDE.md's documented workaround |
| Cloud Run render service | The already-deployed pipeline this phase consumes | ✓ (confirmed working against production 2026-08-06, per orchestrator brief) | — | None needed — out of scope to touch |
| `.env.local` (Firebase config) | `npm run build`/emulator/full unit suite | Required per CLAUDE.md in every worktree | — | Symlink/copy from `C:\projects\worshipplanner\.env.local` per CLAUDE.md |

**Missing dependencies with no fallback:** none identified.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.x (root config) + a separate `vitest.rules.config.ts` for Firestore/Storage rules tests |
| Config file | `vite.config.ts` (app suite, excludes `src/rules.test.ts`), `vitest.rules.config.ts` (rules suite) |
| Quick run command | `npx vitest run --dir src --exclude '**/rules.test.ts' <path-to-changed-test-file>` |
| Full suite command | `npx vitest run --dir src --exclude '**/rules.test.ts'` (app) + `npm run test:rules` or `npx vitest run --config vitest.rules.config.ts` against a running emulator (rules) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|--------------------|--------------|
| R079 | Ready-state render displays in grid, byte-identical `<img>` treatment to existing `ImageSlide` path | unit | `npx vitest run --dir src src/components/slides/__tests__/SlideCard.test.ts` | ✅ existing file, needs new cases |
| R079 | Ready-state render displays in presenter | unit | `npx vitest run --dir src src/components/__tests__/PresentationViewer.test.ts` | ✅ existing file, needs new cases |
| R079 | Reconciliation count-disagreement (renderedCount vs deck.slides.length), one shared helper | unit | `npx vitest run --dir src src/utils/__tests__/slideGroupMaterializer.test.ts` and `slideshowAssembler.test.ts` | ✅ existing files, need new `describe` blocks for the IMPORTED-with-render cases |
| R079 | `sourceSignature` folds in status+renderedCount, rebuild fires exactly once on transition | unit | `npx vitest run --dir src src/composables/__tests__/useSlideshowAssembly.test.ts` | ✅ existing file, needs a new mocked `pptxRenders` store block (see Test Surface below) |
| R080 | Pending/failed explicit states, grid and presenter | unit | same SlideCard.test.ts / PresentationViewer.test.ts files | ✅ |
| R080 | `pptxRenders` read authorization (member read, editor-write now blocked) | rules (emulator) | `npm run test:rules` | ✅ existing `src/rules.test.ts`, needs new `describe('pptxRenders...')` block — see Pitfall 2 |

### Test Surface — files needing updates (verified by direct read, not by test execution)

| File | Why it needs updating |
|------|------------------------|
| `src/utils/__tests__/slideGroupMaterializer.test.ts` | `deriveGroupEntries`/`sourceSignature`'s IMPORTED branch changes shape; existing IMPORTED tests (`describe('deriveGroupEntries — IMPORTED'`, line 296) construct `AssemblyInputs` without a render-status map — every existing IMPORTED fixture must gain a `pptxRendersById`/equivalent field or continue defaulting to "no render" (pre-Phase-37 deck) behavior unchanged |
| `src/utils/__tests__/slideshowAssembler.test.ts` | `resolveEntryContent`'s `imported` case and the no-group fallback IMPORTED case both change; existing fixtures at lines 99/665/984 assert `imageUrl` values directly against `deck.slides`-sourced content — must stay correct for decks with NO `renderImportId` and gain new cases for rendered decks |
| `src/composables/__tests__/useSlideshowAssembly.test.ts` | **This is the Phase-41-style "genuine Wave-0 blocker."** The file `vi.mock`s `@/stores/importedSlides` and `@/stores/slideGroups` at module scope (lines 29-96) with hand-built reactive stubs. A new `usePptxRenders`-shaped store needs an equivalent `vi.mock('@/stores/pptxRenders', ...)` block added BEFORE any test exercising the IMPORTED path can pass — omitting it will surface as "Cannot find module" or an unmocked live Firestore call inside a unit test, exactly the class of gap CLAUDE.md's Phase-41 precedent warns about (`services.test.ts`'s firestore mock lacking `where`/`getDocs`). |
| `src/components/slides/__tests__/SlideCard.test.ts` | New `describe` blocks for pending/failed grid states, testids `slide-card-render-pending`/`slide-card-render-failed` per 42-UI-SPEC.md |
| `src/components/slides/__tests__/SlideGrid.test.ts` | Already mocks `resolveImageUrl` (line 61) — reusable pattern; needs new fixtures for a slide whose `assembledSlide` carries render-pending/failed state |
| `src/components/__tests__/PresentationViewer.test.ts` | New `describe` blocks for `presentation-render-pending`/`presentation-render-failed` testids; existing image-slide fixture at line 151 (`imageUrl: 'https://example.com/announcement.png'`) is unaffected — a plain non-rendered `ImageSlide` still exists for non-renderImportId decks |
| `src/rules.test.ts` | New `describe('pptxRenders — org-member read, no client write')` block: ALLOW (member reads), DENY (non-member/unauth read), DENY (org editor write — Pitfall 2's regression proof) |
| `src/components/slides/slideDisplay.ts` (+ its existing test file, if any covers this module) | New `failureReason → sentence` `Record` lookup, shaped like `KIND_BADGE_CLASSES` (line 40) per 42-UI-SPEC.md's copywriting contract |

### Sampling Rate
- **Per task commit:** targeted `npx vitest run --dir src <changed-test-file>`
- **Per wave merge:** `npx vitest run --dir src --exclude '**/rules.test.ts'` (full app suite) + `npm run test:rules` (rules suite)
- **Phase gate:** both suites green, plus `npm run type-check` (the `vue-tsc --build` form per CLAUDE.md — NOT `-p tsconfig.app.json`, which silently skips test files) before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `src/stores/__tests__/pptxRenders.test.ts` (or equivalent) — new store, needs its own direct unit coverage before other suites can mock it meaningfully
- [ ] `src/composables/__tests__/useSlideshowAssembly.test.ts`'s `vi.mock('@/stores/pptxRenders', ...)` block — the Phase-41-precedent blocker described above; add this FIRST, before writing any IMPORTED-with-render test case in this file, or every such case will fail for the wrong reason (missing mock, not wrong logic)
- [ ] `src/rules.test.ts`'s Pitfall-2 regression probe (org editor write to `pptxRenders`, asserted to fail) — write this test to FAIL against current `master` first (proving the hole exists) if the planner wants the T-37-15 argument independently verified before trusting this research's rules analysis

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|----------------|---------|-------------------|
| V4 Access Control | yes | Firestore security rules, `isOrgMember`/`isOrgEditor` helpers already established in `firestore.rules` |
| V5 Input Validation | no (new surface) | This phase reads only; it writes nothing new to Firestore or Storage from the client |
| V6 Cryptography | no | Not applicable — no new secrets or crypto primitives |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|-----------------------|
| Client fakes a render's `status: 'ready'`/`renderedCount` to display forged/stale content, or floods a `pptxRenders` write to trigger unwanted downstream behavior (T-37-15, already named in `functions/src/index.ts:342`) | Tampering / Spoofing | Read-only Firestore rule for `pptxRenders`, PLUS closing the generic-wildcard write hole documented in Pitfall 2 — the second half is the part 42-CONTEXT.md's plan currently misses |
| A member (not just an editor) reading render status for a service they're only a viewer on | Information Disclosure (accepted) | `isOrgMember(orgId)`, the same tier `SlideGroup`/`ImportedDeck` reads already use — a viewer already sees the deck's parsed content and structure; render status carries no more sensitivity |
| A slug/id-guessing attack against `pptxRenders/{importId}` from a non-member | Information Disclosure | `isOrgMember(orgId)` on the org itself blocks this; `importId` is a `crypto.randomUUID()` (unguessable) as defense in depth, mirroring `generateImportId()`'s existing convention (`pptxUpload.ts:21-23`) |

## Sources

### Primary (HIGH confidence — direct file reads this session)
- `functions/src/index.ts` (full render-queue/trigger implementation, lines 138-599) — `PptxRenderDoc` shape, `pptxRenderDocRef`, `RENDERED_OBJECT_NAME`, the ready gate, Trap 1 comment
- `functions/src/renderInvoker.ts` — IAM-authenticated Cloud Run invocation contract (confirms no client-reachable path exists for triggering a render, out of scope confirmed)
- `render-service/src/render.ts` — `renderedPrefix`/`renderedObjectName`/`RENDERED_PAGE_PAD`/`pageNumberFromOutputName`, 1-based page numbering, contiguity requirement
- `firestore.rules` (full file) — the generic-wildcard OR-semantics finding (Pitfall 2), the existing `isOrgMember`/`isOrgEditor` helpers
- `storage.rules` — confirms no change needed (already covered by the generic `orgs/{orgId}/{allPaths=**}` member-read grant)
- `src/types/importedDeck.ts`, `src/types/slide.ts`, `src/types/slideGroup.ts` — `renderImportId`, `ImageSlide`, `SourceRef`'s `imported` variant, `derivedIdentityKey`'s existing scheme
- `src/utils/slideGroupMaterializer.ts`, `src/utils/slideshowAssembler.ts` (full files) — purity contracts, existing IMPORTED branches, rebuild/carry machinery, confirmed NO confirm-required path exists anymore (Phase 30 deleted it)
- `src/utils/pptxUpload.ts` — `resolveImageUrl`, confirms `ImageSlide.imageUrl` is a RESOLVED URL persisted at import time, not a lazily-resolved path
- `src/composables/useSlideshowAssembly.ts` (full file) — the composable architecture this phase must extend, the per-distinct-id async loader pattern to model the new subscription on
- `src/stores/slideGroups.ts`, `src/stores/importedSlides.ts` — the store patterns to mirror for the new `pptxRenders` store
- `src/components/PresentationViewer.vue`, `src/components/slides/SlideCard.vue`, `src/components/slides/slideDisplay.ts` — existing visual/label conventions this phase's new states must match
- `src/rules.test.ts` (setup/helpers section) — the exact ALLOW/DENY test harness to reuse
- `.planning/phases/42-powerpoint-rendered-image-display/42-CONTEXT.md`, `42-UI-SPEC.md` — locked decisions and the approved design contract
- `.planning/REQUIREMENTS.md`, `.planning/STATE.md` — R079/R080 text, project history, standing autonomy grant boundaries

### Secondary (MEDIUM confidence)
- Grep-based confirmation across `src/` that `resolveImageUrl`/`getDownloadURL` have exactly one call site pattern (`PptxImportModal.vue`) — read that file's relevant lines directly rather than trusting the grep alone
- Grep-based confirmation that `dismissedSignature`/`ReconcileConfirmModal` no longer exist anywhere in `src/` (zero matches), corroborating STATE.md's "Phase 30 deleted the confirm-gated reconciler" claim

### Tertiary (LOW confidence)
- None — every claim in this document traces to a direct file read this session.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new libraries, every primitive traced to an existing, working call site
- Architecture (URL resolution / purity boundary): HIGH — directly follows the codebase's own documented purity contracts and existing composable patterns
- Reconciliation policy (Pitfall 1): HIGH on the underlying fact (Trap 1 comment, quoted verbatim), MEDIUM on the recommended resolution shape (A1/A3 in Assumptions Log — reasonable inference, not a locked decision)
- `firestore.rules` gap (Pitfall 2): HIGH on the code-level mechanism (same OR-semantics this file already documents and cites emulator proof for), NOT YET independently emulator-verified in this research pass — flagged as a Wave 0 gap
- Pitfalls: HIGH — every pitfall traces to a specific, quoted code comment or a specific file/line

**Research date:** 2026-08-07
**Valid until:** 30 days (stable — no fast-moving external dependency; the render pipeline itself is
frozen/deployed and out of scope for this phase)
