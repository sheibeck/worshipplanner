# Phase 42: PowerPoint Rendered-Image Display - Pattern Map

**Mapped:** 2026-08-07
**Files analyzed:** 11 (new + modified)
**Analogs found:** 10 / 11 (1 file — the async status/URL join — has NO true analog; see below)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/stores/pptxRenders.ts` (NEW) | store | event-driven (live subscription) | `src/stores/importedSlides.ts` | role-match (collection-subscribe shape; this file needs a **per-doc/per-id** variant — see gap note) |
| `src/composables/useSlideshowAssembly.ts` (MODIFIED — new subscription + URL-resolution loader) | provider/composable | async join / event-driven | itself, `loadMissingLyrics`/`distinctSongIds` block (lines 195-230) | exact (same file, same shape, different data) |
| `src/utils/importedRenderReconciler.ts` (NEW — shared helper, naming per CONTEXT's discretion) | utility | transform (pure) | `src/utils/slideGroupMaterializer.ts`'s `deriveGroupEntries`/`sourceSignature` IMPORTED cases | role-match (pure reconciliation logic, no existing file does exactly this join) |
| `src/utils/slideGroupMaterializer.ts` (MODIFIED — IMPORTED branch of `deriveGroupEntries` + `sourceSignature`) | utility | transform (pure) | itself (existing IMPORTED case, lines 119-141 / 192-198) | exact |
| `src/utils/slideshowAssembler.ts` (MODIFIED — `resolveEntryContent`'s `imported` case + fallback IMPORTED branch) | utility | transform (pure) | itself (existing `imported` case, lines 186-193) | exact |
| `src/utils/pptxUpload.ts` or new small util (MODIFIED/NEW — client-side `renderedPrefixFor`/`renderedObjectName` constants) | utility | transform | `src/utils/pptxUpload.ts::resolveImageUrl` (lines 173-181, per RESEARCH.md) | exact (reuse the wrapper; add the 2 tiny path constants alongside it) |
| `src/components/slides/SlideCard.vue` (MODIFIED — pending/failed branches) | component | request-response (presentational) | itself (existing `isImage` branch, lines 36-42) | exact |
| `src/components/slides/slideDisplay.ts` (MODIFIED — `failureReason` → sentence lookup) | utility | transform | itself (`KIND_BADGE_CLASSES`, lines 40-52) | exact |
| `src/components/PresentationViewer.vue` (MODIFIED — pending/failed branches) | component | request-response (presentational) | itself (`isLoadingState` block lines 39-54; `videoMutedPlaying` chip lines 261-269; image branch lines 182-187) | exact |
| `firestore.rules` (MODIFIED — new `pptxRenders` read block + generic-wildcard write exclusion) | config | request-response (authorization) | itself (`slideGroups` exclusion pattern, lines 173-203) | exact |
| `src/rules.test.ts` (MODIFIED — new `pptxRenders` describe block) | test | request-response | itself (`serviceShareLinks` describe block, lines 780-949) | exact (freshest ALLOW/DENY shape in the file) |

## Pattern Assignments

### `src/stores/pptxRenders.ts` (store, event-driven)

**Analog:** `src/stores/importedSlides.ts` (full file, 105 lines)

**Imports pattern:**
```typescript
import { ref, reactive } from 'vue'
import { defineStore } from 'pinia'
import { collection, onSnapshot, doc, query, where, documentId, type Unsubscribe } from 'firebase/firestore'
import { db } from '@/firebase'
```

**Core subscribe pattern** (`importedSlides.ts:30-46`):
```typescript
function subscribeDecks(orgId: string) {
  if (unsubscribeFn) unsubscribeFn()
  isLoading.value = true
  const q = query(collection(db, 'organizations', orgId, 'importedSlides'), orderBy('updatedAt', 'desc'))
  unsubscribeFn = onSnapshot(q, (snap) => {
    decks.value = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as ImportedDeck)
    isLoading.value = false
  })
}
```

**Gap this store must close that the analog does NOT show:** `importedSlides.ts` subscribes to ONE
collection query, once per org. `pptxRenders` needs **N live per-document listeners** (one per distinct
`renderImportId` referenced by the current service), added/removed as that set changes, and torn down
individually (Pitfall 5 in RESEARCH.md — `onSnapshot` holds an open connection, unlike the one-shot
`getDocs` `loadMissingLyrics` pattern). There is no existing file in this codebase that manages a
**reactive set of per-id live listeners** (as opposed to one listener for a whole collection, or a
one-shot per-id fetch). Model the listener-set lifecycle on `useSlideshowAssembly.ts`'s
`distinctSongIds`/`loadMissingLyrics` watch pair (below) for the "which ids do I need" half, but the
"open one `onSnapshot` per id, close removed ones" half is genuinely new — write it carefully, store a
`Map<importId, Unsubscribe>` and diff it against the current distinct-id set on each watch tick.

**Error/lifecycle pattern** (`importedSlides.ts:48-53`):
```typescript
function unsubscribeDecks() {
  unsubscribeFn?.()
  unsubscribeFn = null
  decks.value = []
  isLoading.value = true
}
```

---

### `src/composables/useSlideshowAssembly.ts` (composable — subscription owner + async URL resolver)

**Analog:** itself — `distinctSongIds`/`loadMissingLyrics`/`stopLyricsWatch` block, lines 195-230, and
the org-subscribe block, lines 160-173.

**Per-distinct-id async loader pattern to model the new URL-resolution loader on** (lines 205-222,
already quoted in RESEARCH.md Pattern 2 — reproduced here for direct copy):
```typescript
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

**Divergence required (documented in RESEARCH.md Pattern 2/Pitfall 4):** the new loader must be keyed by
`${importId}:${renderedCount}` (not just `importId`) so a `renderedCount` change invalidates the cache
without needing a full re-derivation; and unlike `songLyricsById` (append-only, never shrinks), the new
`pptxRenders` **store subscription** (not this URL cache) must actively unsubscribe ids no longer present
— see the store section above.

**org-subscribe-once guard pattern to extend** (lines 160-173):
```typescript
const subscribedOrgId = ref<string | null>(null)
const stopOrgWatch = watch(resolvedOrgId, (id) => {
  if (id && subscribedOrgId.value !== id) {
    scriptureStore.subscribeReadings(id)
    importedStore.subscribeDecks(id)
    slideGroupsStore.subscribeGroups(id)
    subscribedOrgId.value = id
  }
}, { immediate: true })
```
Add `pptxRendersStore` alongside these three — but note it takes an **id set**, not just an orgId, so its
own subscribe call differs in shape from the other three (see store section).

**`AssemblyInputs` extension point** (`slideshowAssembler.ts:33-48`, the interface the composable already
builds every recompute — add `pptxRendersById: Map<string, PptxRenderDoc>` and
`renderedImageUrlsByImportId: Map<string, string[]>` fields here, mirroring how `importedDecksById` is
built at `useSlideshowAssembly.ts:183-189`):
```typescript
const importedDecksById = computed(() => {
  const map = new Map<string, (typeof importedStore.decks)[number]>()
  for (const deck of importedStore.decks) map.set(deck.id, deck)
  return map
})
```

**Cleanup pattern** (lines 558-565) — add the new store's unsubscribe/stop-watch call here:
```typescript
function cleanup() {
  stopOrgWatch()
  stopLyricsWatch()
  stopMaterializeWatch()
  stopRebuildWatch()
}
onUnmounted(cleanup)
```

---

### `src/utils/importedRenderReconciler.ts` (NEW shared pure helper)

**No true analog** — this is genuinely new reconciliation logic (RESEARCH.md's own framing: "the work is
wiring, not invention — except for the reconciliation policy itself"). The closest **shape** to imitate
is `slideGroupMaterializer.ts`'s existing IMPORTED case, which this helper replaces the guts of:

**Current IMPORTED case to replace** (`slideGroupMaterializer.ts:119-129`):
```typescript
case 'IMPORTED': {
  if (!slot.importId) return []
  const deck = inputs.importedDecksById.get(slot.importId)
  if (!deck) return []
  return deck.slides.map((innerSlide, index) => ({
    id: crypto.randomUUID(),
    order: index,
    sourceRef: { kind: 'imported' as const, importId: slot.importId!, innerSlideId: innerSlide.id },
  }))
}
```

**Current `sourceSignature` IMPORTED branch to extend** (`slideGroupMaterializer.ts:192-198`):
```typescript
case 'IMPORTED': {
  if (!slot.importId) return undefined
  const deck = inputs.importedDecksById.get(slot.importId)
  if (!deck) return undefined
  const texts = deck.slides.map((s) => (s.contentKind === 'image' ? s.imageUrl : s.body))
  return `${texts.length}:${texts.join('|')}`
}
```
Fold in `status` and `renderedCount` per CONTEXT.md's locked decision, e.g.
`` `${status}:${renderedCount ?? ''}:${texts.length}:${texts.join('|')}` ``.

**Purity discipline to preserve** — the module's own doc comment (`slideGroupMaterializer.ts:1-24`) states
the file performs no Firestore/Storage I/O; the new helper must take `(deck, render, resolvedUrls)` as
plain-object inputs (already resolved upstream by the composable), never call `getDownloadURL`/`onSnapshot`
itself. RESEARCH.md's Pattern 3 gives the exact decision table this helper must implement (entry count,
identity `rendered-page-${pageNumber}` vs `deck.slides[i].id`, content resolution).

---

### `src/utils/slideshowAssembler.ts` (MODIFIED — `resolveEntryContent`'s `imported` case)

**Analog:** itself, lines 186-193:
```typescript
case 'imported': {
  const deck = inputs.importedDecksById.get(ref.importId)
  if (!deck) return undefined
  const innerSlide = deck.slides.find((s) => s.id === ref.innerSlideId)
  if (!innerSlide) return undefined
  const { id: _id, position: _position, ...rest } = innerSlide
  return rest
}
```
This must branch per Pattern 3: an identity of `rendered-page-${pageNumber}` resolves via
`inputs.renderedImageUrlsByImportId.get(ref.importId)?.[pageNumber - 1]` instead of
`deck.slides.find(...)`. Keep the same `Omit<..., 'id' | 'position'>` destructure shape used today for the
non-rendered case.

`AssemblyInputs` interface itself is at `slideshowAssembler.ts:33-48` — add the two new map fields there
(the single place both engines read from).

---

### `src/utils/pptxUpload.ts` (or a small sibling util) — rendered page path constants

**Analog:** `src/utils/pptxUpload.ts::resolveImageUrl`, lines 173-181:
```typescript
export async function resolveImageUrl(path: string): Promise<string> {
  return getDownloadURL(ref(storage, path))
}
```
Reuse this verbatim — do not write a second `getDownloadURL` wrapper (Don't-Hand-Roll table,
RESEARCH.md). Add alongside it the tiny client-side path-convention copy RESEARCH.md's Pattern 1
specifies (`renderedPrefixFor`, `renderedObjectName`, `RENDERED_PAGE_PAD = 4`), commented with a
cross-reference to the server-side originals (`functions/src/index.ts:274-283`,
`render-service/src/render.ts:69-79`) since there is no importable shared package boundary.

---

### `src/components/slides/SlideCard.vue` (component, request-response)

**Analog:** itself, existing `isImage` branch and preview box, lines 26-48 (confirmed exact classes exist
as UI-SPEC claims):
```html
<div class="relative h-[140px] overflow-hidden rounded-md bg-gray-950/40" data-testid="slide-card-preview">
  <span class="absolute left-2 top-1.5 text-[10px] uppercase tracking-wide text-indigo-300"
        data-testid="slide-card-content-label">{{ contentLabel }}</span>
  <span class="absolute right-9 top-1.5 ... text-[11px] font-medium text-indigo-300"
        data-testid="slide-card-number">{{ number }}</span>
  <img v-if="isImage" :src="imageSrc" :alt="imageAlt" class="h-full w-full object-contain"
       data-testid="slide-card-image" />
  <p v-else class="line-clamp-6 whitespace-pre-line px-2 pt-6 text-[13px] leading-normal text-gray-200"
     data-testid="slide-card-body">{{ bodyText }}</p>
</div>
```
`isImage` is computed at line 149: `computed(() => props.assembledSlide.slide.contentKind === 'image')`.
UI-SPEC confirms the ready state reuses this branch byte-identically ("Reuse `slide-card-image`, no new
testid"). Add sibling `v-else-if` branches inside the same preview box for pending
(`data-testid="slide-card-render-pending"`) and failed (`data-testid="slide-card-render-failed"`), each
gated on a new render-state field carried by the assembled slide (per RESEARCH.md A3, an optional field on
`ImageSlide`/`AssembledSlide`, not a new `contentKind`). The failed-state red tint
(`bg-red-950/20 border border-red-900/40`) is new chrome — no exact existing analog for a tinted preview
box, but `PptxImportModal.vue`'s error banner (`text-red-400`/`text-red-300`) and
`SlideGrid.vue`'s `mediaUploadError`/`reorderError` (`text-red-400`) are the confirmed color-token
provenance UI-SPEC cites; copy the color tokens, not layout.

---

### `src/components/slides/slideDisplay.ts` (utility — failureReason lookup)

**Analog:** itself, `KIND_BADGE_CLASSES`, lines 40-52:
```typescript
export const KIND_BADGE_CLASSES: Record<SlotKind, string> = {
  SONG: 'bg-indigo-950/50 text-indigo-300 border-indigo-800',
  HYMN: 'bg-indigo-950/50 text-indigo-300 border-indigo-800',
  SCRIPTURE: 'bg-teal-900/50 text-teal-300 border-teal-800',
  PRAYER: 'bg-gray-800 text-gray-400 border-gray-700',
  MESSAGE: 'bg-pink-900/50 text-pink-300 border-pink-800',
  IMPORTED: 'bg-amber-900/50 text-amber-300 border-amber-800',
}
```
Same shape for the new lookup — a fully-spelled-out `Record<string, string>` with a `default`-style
fallback arm (UI-SPEC's copywriting contract table gives the exact three entries required:
`missing-render-doc`, `missing-storage-path`, and the unrecognized/undefined fallback sentence). Also
extend `slideContentLabel` (lines 103-121) with the ready-state "always generic `'IMAGE'`" rule per
Pitfall 1/Open Question 2 — no per-page label branch.

---

### `src/components/PresentationViewer.vue` (component, request-response)

**Analog:** itself — three separate confirmed excerpts:

Loading-state layout to model pending/failed centered blocks on (lines 39-54):
```html
<div v-if="isLoadingState" data-testid="presentation-loading" class="flex flex-col items-center gap-4">
  <svg class="h-10 w-10 animate-spin text-indigo-400" ...>...</svg>
  <h2 class="text-4xl font-semibold text-gray-100">Loading slideshow&hellip;</h2>
</div>
```

Existing ready-state image treatment to reuse byte-identically (lines 182-187):
```html
<img :src="(currentSlide.slide as ImageSlide).imageUrl" :alt="(currentSlide.slide as ImageSlide).altText ?? ''"
     class="max-h-[80vh] max-w-full object-contain" />
```

Amber "soft-caution" chip precedent the failed state's color choice is drawn from (lines 261-269):
```html
<button v-if="videoMutedPlaying" data-testid="presentation-muted-chip"
        class="absolute bottom-20 right-6 rounded-full bg-amber-900/40 px-4 py-2 text-sm font-medium text-amber-300"
        @click="onUnmuteClick">
  Playing muted — tap to unmute
</button>
```

`isLoadingState`/`isEmptyState` computed pattern (lines 393-394) to model the new per-slide
pending/failed computed on:
```typescript
const isLoadingState = computed(() => !!props.isLoading && props.slides.length === 0)
const isEmptyState = computed(() => !isLoadingState.value && props.slides.length === 0)
```
New computeds (e.g. `isCurrentSlideRenderPending`/`isCurrentSlideRenderFailed`) should follow this same
`computed(() => ...)` style, reading the render-state field off `currentSlide.value`. **Non-negotiable
per UI-SPEC:** the pending/failed slide stays in `props.slides` at its normal position — do not filter it
out anywhere `hasSlides`/`atFirst`/`atLast`/`progressLabel` are computed.

---

### `firestore.rules` (config, request-response authorization)

**Analog:** itself — the `slideGroups` exclusion precedent this phase must replicate a third time, lines
173-203:
```
// All other nested collections — editors only.
//
// ★ `collection != 'services'` and `collection != 'slideGroups'` are both
// LOAD-BEARING. Do not remove either.
// ...
match /{collection}/{docId} {
  allow read: if isOrgEditor(orgId);
  allow write: if isOrgEditor(orgId)
    && collection != 'services'
    && collection != 'slideGroups';
}
```
Per 42-CONTEXT.md's SUPERSEDED correction and RESEARCH.md Pitfall 2 (independently confirmed by this
mapping pass), the task is TWO edits, not one:
1. Add a new dedicated block granting **read** to org **members** (not just editors):
   `match /organizations/{orgId}/pptxRenders/{importId} { allow read: if isOrgMember(orgId); }`
2. Extend the generic wildcard's write exclusion to
   `collection != 'services' && collection != 'slideGroups' && collection != 'pptxRenders'`, closing the
   T-37-15 write hole. Follow the exact comment convention above it — document why the exclusion is
   load-bearing, as the `slideGroups` comment does.

Insert both **before** the catch-all deny at `firestore.rules:317-320` (per CONTEXT's Integration Points
note) — though since the new dedicated block is nested inside `match /organizations/{orgId}`, exact
placement is alongside the `songs`/`services` blocks in that same nesting, not near the outer catch-all.

---

### `src/rules.test.ts` (test, request-response)

**Analog:** the `serviceShareLinks` describe block (Phase 41's freshest ALLOW/DENY shape), lines 780-949 —
representative excerpt (read ALLOW/DENY pair):
```typescript
describe('serviceShareLinks — org-editor-scoped, no public read', () => {
  it('ALLOW — an org editor of orgA reads an existing serviceShareLinks doc', async () => {
    await seedMembershipDoc('orgA', 'userA', 'editor')
    await seedDoc('serviceShareLinks/service-1', { token: 'tok-abc', orgId: 'orgA', serviceId: 'service-1' })
    const context = testEnv.authenticatedContext('userA')
    await assertSucceeds(getDoc(doc(context.firestore(), 'serviceShareLinks', 'service-1')))
  })

  it('DENY (WR-06) — a viewer-role member of the owning org cannot read an existing serviceShareLinks doc', async () => {
    // ... same shape, seedMembershipDoc(..., 'viewer'), assertFails
  })
})
```

Setup helpers to reuse verbatim (`src/rules.test.ts:32-51`):
```typescript
async function seedMembershipDoc(orgId: string, uid: string, role: string) {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore()
    await setDoc(doc(db, 'organizations', orgId, 'members', uid), { role, joinedAt: new Date() })
  })
}
async function seedDoc(path: string, data: Record<string, unknown>) {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore()
    const parts = path.split('/')
    await setDoc(doc(db, parts[0]!, ...parts.slice(1)), data)
  })
}
```

New `describe('pptxRenders — org-member read, no client write')` block needs (per RESEARCH.md's
Phase Requirements → Test Map and Pitfall 2's regression proof):
- ALLOW: a **viewer**-role member reads a seeded `organizations/orgA/pptxRenders/import-1` doc (proves
  member-level, not editor-level, per CONTEXT's locked decision).
- DENY: a non-member / unauthenticated caller reads the same doc.
- DENY (regression proof for Pitfall 2): an org **editor** attempts `setDoc`/`updateDoc` on the same doc
  path and it fails — this is the case the `serviceShareLinks`/`shareTokens` blocks don't have an exact
  precedent for (those collections DO allow editor writes); the closest write-DENY shape to copy the
  *assertion style* from is any of the `shareTokens` cross-tenant DENY cases (lines 619-667), substituting
  "same org, editor role" as the actor instead of "different org."

## Shared Patterns

### Async I/O kept out of pure engines
**Source:** `src/utils/slideGroupMaterializer.ts:1-24` (module doc comment) and
`src/utils/slideshowAssembler.ts` (parallel purity contract, per RESEARCH.md).
**Apply to:** `importedRenderReconciler.ts`, `slideGroupMaterializer.ts`'s IMPORTED branch,
`slideshowAssembler.ts`'s `imported` case. All must receive already-resolved URLs/status as plain data;
none may call `getDownloadURL`/`onSnapshot` themselves.

### Per-distinct-id async loader with `watch(..., { immediate: true })`
**Source:** `src/composables/useSlideshowAssembly.ts:195-230` (`distinctSongIds`/`loadMissingLyrics`).
**Apply to:** the new `pptxRenders` store's listener-set management and the new resolved-URL cache loader
in the same composable.

### Firestore rules generic-wildcard exclusion discipline
**Source:** `firestore.rules:173-203` (comment + `services`/`slideGroups` exclusion pattern).
**Apply to:** `firestore.rules`'s `pptxRenders` write-exclusion addition — same comment style, same
"load-bearing, do not remove" framing.

### ALLOW/DENY rules-test scaffolding
**Source:** `src/rules.test.ts:32-51` (`seedDoc`/`seedMembershipDoc`) plus the `serviceShareLinks` block
shape (lines 780-949).
**Apply to:** the new `pptxRenders` describe block.

### Static `Record` lookup with fallback arm (never raw slug/string-template to UI)
**Source:** `src/components/slides/slideDisplay.ts:40-52` (`KIND_BADGE_CLASSES`).
**Apply to:** the new `failureReason` → sentence mapping.

## No Analog Found

| File/Concern | Role | Data Flow | Reason |
|---|---|---|---|
| `pptxRenders` store's **per-id live listener set** (open/close `onSnapshot` per distinct `renderImportId`, reactive to a changing id set) | store | event-driven | No existing store in this codebase manages a *dynamic set* of live per-document listeners. Every existing store either (a) subscribes to one whole collection query (`importedSlides.ts`, `slideGroups.ts`), or (b) does a one-shot per-id fetch (`loadMissingLyrics`'s `getDocs`, not live). This phase's requirement — react to a `pending → ready` transition while the page is open (criterion 4), for a small, changing set of `importId`s — combines both shapes and has no precedent. Flagged explicitly per the task instructions: **nothing in this codebase already subscribes to a Firestore document keyed off a field of another already-loaded document** (`deck.renderImportId → pptxRenders/{importId}`) with a *live* listener. The planner should treat this as new design, not a copy job — use `distinctSongIds`'s synchronous-computed-decides-what/async-effect-does-the-work split as the closest structural precedent, but the listener lifecycle itself (open per new id, close per removed id) must be written fresh. |
| `importedRenderReconciler.ts`'s reconciliation **policy** (entry count/identity decision table in RESEARCH.md Pattern 3) | utility | transform | Genuinely new logic, not a refactor of an existing helper — RESEARCH.md itself says so explicitly. The *pattern* (pure function, called from both materializer and assembler) is well-established (see Shared Patterns above); the *content* of the decision table is new. |

## Metadata

**Analog search scope:** `src/stores/`, `src/composables/`, `src/utils/`, `src/components/`,
`src/components/slides/`, `src/types/`, `firestore.rules`, `src/rules.test.ts`
**Files scanned/read directly:** `src/utils/slideGroupMaterializer.ts`, `src/utils/slideshowAssembler.ts`,
`src/composables/useSlideshowAssembly.ts`, `src/stores/importedSlides.ts`, `src/utils/pptxUpload.ts`,
`src/types/importedDeck.ts`, `firestore.rules`, `src/rules.test.ts`, `src/components/slides/SlideCard.vue`,
`src/components/slides/slideDisplay.ts`, `src/components/PresentationViewer.vue`
**Pattern extraction date:** 2026-08-07
