/**
 * The ONE shared, pure reconciliation helper for PPTX render status (Phase 42,
 * R079/R080) — the single source of truth both `slideGroupMaterializer.ts`'s
 * IMPORTED branch and `slideshowAssembler.ts`'s IMPORTED branches (group AND
 * fallback) call into. 42-CONTEXT.md is explicit that the grid and the
 * presenter disagreeing about what a deck contains "is the exact failure this
 * phase exists to end" — two copies of this decision table would drift, so
 * this module exists precisely so there is only ever one.
 *
 * This module is PURE (mirrors `slideGroupMaterializer.ts`/
 * `slideshowAssembler.ts`'s own stated contracts): no Firestore reads, no
 * Storage calls, no Vue reactivity, no imports from any store or composable.
 * It takes `(deck, render, resolvedUrls)` as plain, pre-resolved data — the
 * async `getDownloadURL()` work happens upstream in the composable layer
 * (`useSlideshowAssembly.ts`), never here.
 *
 * Three load-bearing facts a future editor must not lose:
 *
 * 1. **No positional pairing exists between `deck.slides[i]` and rendered
 *    page `i+1`** (42-RESEARCH.md Pitfall 1). `functions/src/index.ts`'s own
 *    "★ Trap 1" comment (lines ~294-303) is unambiguous: `mapAstToSlides`
 *    (pptxParser.ts) SKIPS slides with neither substantial text nor images,
 *    and emits ONE ENTRY PER IMAGE on a multi-image slide — the parsed
 *    array's length is structurally decoupled from the deck's real page
 *    count in BOTH directions. `deck.slides` is a COUNT source for the
 *    non-ready modes (parsed/pending/failed) and a CONTENT source only in
 *    `parsed` mode. Anything that indexes `deck.slides` by a rendered page
 *    number is a defect.
 * 2. **Gate on `render.status`, never on `render.renderedCount` truthiness**
 *    (42-RESEARCH.md Pitfall 3). `functions/src/index.ts:396-415`'s own
 *    three-conjunct ready gate (`actualCount > 0 && actualCount ===
 *    reportedCount && contiguous`) means `status` already encodes every
 *    failure mode. A `failed` document CAN carry a non-zero `renderedCount`
 *    (the `incomplete-render` outcome still writes the partial `actualCount`,
 *    `functions/src/index.ts:411-415`); a `pending` document legitimately
 *    carries none.
 * 3. **`renderedCount` wins in every ready case** (D-05), with ONE named
 *    carve-out: `status: 'ready'` with `renderedCount` absent or `< 1` is
 *    self-contradictory — the server's own ready gate REQUIRES `actualCount
 *    > 0` before it ever writes `status: 'ready'` — so this state is
 *    unproducible by the real pipeline. A client that emitted zero entries
 *    for it would make a deck silently vanish mid-service; this module
 *    resolves it to `failed` (with no `failureReason`, so the generic
 *    fallback sentence 42-06 introduces applies) instead.
 */
import type { ImportedDeck } from '@/types/importedDeck'
import type { PptxRenderDoc } from '@/types/pptxRender'
import type { ImageSlide, TextSlide } from '@/types/slide'

/** Prefix for the synthetic ready-state entry identity this module mints —
 * `rendered-page-N`, never `deck.slides[N-1].id` (Pitfall 1). */
export const RENDERED_PAGE_IDENTITY_PREFIX = 'rendered-page-'

/** The four states a deck's IMPORTED content can resolve to. `parsed` is the
 * pre-Phase-37/no-`renderImportId` path, byte-unchanged from before this
 * phase (D-16). */
export type ImportedRenderMode = 'parsed' | 'pending' | 'failed' | 'ready'

/**
 * The one decision every consumer (`deriveGroupEntries`, `sourceSignature`,
 * `resolveEntryContent`, and the no-group fallback) needs: how many entries
 * exist, in what mode, and — only for `failed` — the raw failure slug (routed
 * through the 42-06 sentence lookup by the caller, never rendered directly).
 */
export interface ImportedRenderResolution {
  mode: ImportedRenderMode
  entryCount: number
  failureReason?: string
}

/** A Slide variant's fields minus the id/position an assembly engine assigns
 * on emit — the same `DistributiveOmit` shape `slideshowAssembler.ts` uses,
 * restricted to the two content kinds an ImportedDeck slide can ever be. */
export type ImportedEntryContent = Omit<ImageSlide, 'id' | 'position'> | Omit<TextSlide, 'id' | 'position'>

/**
 * Decides the render mode and entry count for one deck, given its live
 * render document (or `undefined` when no document exists yet / hasn't
 * loaded). See the module doc comment for the three load-bearing facts this
 * function encodes.
 */
export function resolveImportedRender(
  deck: Pick<ImportedDeck, 'slides' | 'renderImportId'>,
  render: PptxRenderDoc | undefined,
): ImportedRenderResolution {
  // D-16: a deck that never requested a render can never resolve one — this
  // branch is unconditional on `render`, so a deck missing `renderImportId`
  // is byte-identical to today's parsed-text path no matter what a stale or
  // mis-keyed render map might otherwise contain (T-42-07 defense in depth).
  if (!deck.renderImportId) {
    return { mode: 'parsed', entryCount: deck.slides.length }
  }

  if (render === undefined) {
    // No render document has loaded yet (or none exists yet) — the deck DID
    // request a render, so this is "still working", not "no render at all".
    return { mode: 'pending', entryCount: deck.slides.length }
  }

  if (render.status === 'pending') {
    return { mode: 'pending', entryCount: deck.slides.length }
  }

  if (render.status === 'failed') {
    // Fact 2: a failed document can legitimately carry a non-zero
    // renderedCount (the incomplete-render outcome) — entryCount still comes
    // from deck.slides.length, never from that stale count.
    return {
      mode: 'failed',
      entryCount: deck.slides.length,
      ...(render.failureReason !== undefined ? { failureReason: render.failureReason } : {}),
    }
  }

  // render.status === 'ready'
  if (render.renderedCount !== undefined && render.renderedCount >= 1) {
    // Fact 3: renderedCount wins outright — no comparison against
    // deck.slides.length, no clamping, no pairing. Under, at, or over parsed
    // count are all just "N ready entries."
    return { mode: 'ready', entryCount: render.renderedCount }
  }

  // Fact 3's named carve-out: a self-contradictory ready document (the
  // server's own gate requires actualCount > 0 to ever write 'ready') falls
  // back to failed with the deck's parsed length, not to zero entries.
  return { mode: 'failed', entryCount: deck.slides.length }
}

/**
 * Mints the stable per-entry identity `derivedIdentityKey`/
 * `carryStoredDerivedEntries` key on across a rebuild. `ready` mode mints
 * synthetic `rendered-page-N` identities (Fact 1 — no `deck.slides[i].id`
 * pairing); every other mode reuses `deck.slides[i].id` so a pending→ready
 * transition for the first `deck.slides.length` slides can still carry
 * forward any per-entry label/audio/notes a user set before the render
 * completed. The returned array's length always equals `resolution.entryCount`.
 */
export function importedEntryIdentities(
  deck: Pick<ImportedDeck, 'slides'>,
  resolution: ImportedRenderResolution,
): string[] {
  if (resolution.mode === 'ready') {
    return Array.from({ length: resolution.entryCount }, (_, i) => `${RENDERED_PAGE_IDENTITY_PREFIX}${i + 1}`)
  }
  return deck.slides.map((s) => s.id).slice(0, resolution.entryCount)
}

/**
 * Parses a `rendered-page-N` synthetic identity back to its 1-based page
 * number, or `null` for anything else — a parsed `deck.slides[i].id`
 * (typically a `crypto.randomUUID()`), a malformed suffix, or page 0 (there
 * is no page 0, `src/utils/renderedPagePaths.ts`).
 */
export function renderedPageNumberFromIdentity(innerSlideId: string): number | null {
  if (!innerSlideId.startsWith(RENDERED_PAGE_IDENTITY_PREFIX)) return null
  const suffix = innerSlideId.slice(RENDERED_PAGE_IDENTITY_PREFIX.length)
  if (!/^\d+$/.test(suffix)) return null
  const page = Number(suffix)
  if (page < 1) return null
  return page
}

/**
 * Resolves one entry's drawable content. `renderedUrls` is the caller's
 * pre-resolved `renderedImageUrlsByImportId.get(renderImportId)` slice —
 * index `i` holds the URL for page `i + 1` (the single 1-based↔0-based
 * boundary in the phase). Returns `undefined` only in `parsed` mode when the
 * id no longer resolves against `deck.slides` — today's exact behavior,
 * unchanged.
 */
export function importedEntryContent(
  deck: Pick<ImportedDeck, 'slides'>,
  resolution: ImportedRenderResolution,
  innerSlideId: string,
  renderedUrls: string[] | undefined,
): ImportedEntryContent | undefined {
  switch (resolution.mode) {
    case 'parsed': {
      const innerSlide = deck.slides.find((s) => s.id === innerSlideId)
      if (!innerSlide) return undefined
      const { id: _id, position: _position, ...rest } = innerSlide
      return rest
    }

    case 'pending':
      // No deck text here on purpose — a render still in flight must never
      // present the parsed text as though it were the finished slide.
      return { contentKind: 'image', imageUrl: '', renderState: 'pending' }

    case 'failed':
      return {
        contentKind: 'image',
        imageUrl: '',
        renderState: 'failed',
        ...(resolution.failureReason !== undefined ? { renderFailureReason: resolution.failureReason } : {}),
      }

    case 'ready': {
      const pageNumber = renderedPageNumberFromIdentity(innerSlideId)
      const url = pageNumber !== null ? renderedUrls?.[pageNumber - 1] : undefined
      if (url) {
        return { contentKind: 'image', imageUrl: url }
      }
      // A URL still resolving (the composable's async getDownloadURL cache
      // hasn't caught up yet) is a pending state, never a broken <img> src.
      return { contentKind: 'image', imageUrl: '', renderState: 'pending' }
    }
  }
}

/**
 * Cheap change-detection proxy for the IMPORTED slot kind, mirroring
 * `slideGroupMaterializer.ts`'s `sourceSignature` contract for every other
 * slot kind. Encoded with the ASCII control-character separators the
 * SCRIPTURE branch there already uses and justifies (`\x1e` between fields,
 * `\x1f` between joined texts) — NOT the pre-existing IMPORTED branch's
 * `` `${texts.length}:${texts.join('|')}` `` form, which this function
 * deliberately replaces rather than inherits.
 *
 * Why the replacement is necessary: PPTX slide text can itself contain both
 * `|` and `:`, so two decks whose slide boundaries differ only in WHERE a
 * literal pipe falls could produce an identical `texts.join('|')` string
 * (e.g. one slide's body `"x|y"` next to another slide's body `"z"` joins to
 * the same string as two slides `"x"` and `"y|z"`, when both decks have the
 * same slide count). Neither `\x1e` nor `\x1f` can occur in PPTX-parsed text
 * (both are invalid XML 1.0 characters) nor in a Storage path, so no field
 * value can forge a field boundary.
 *
 * This encoding change is inert for stored data: nothing reads an IMPORTED
 * signature back — only `rebuildScriptureGroup` reads a stored signature —
 * so no group is rebuilt merely because the encoding changed.
 *
 * Fields, in order: mode, then the resolved `renderedCount` (the empty
 * string when the mode isn't `ready`, so pending/failed/parsed never
 * fabricate a count), then the parsed slide count, then the joined parsed
 * texts. Including `mode` keeps `pending`/`failed`/`ready` distinguishable
 * even when `deck.slides` is unchanged across all three.
 */
export function importedSourceSignature(
  deck: Pick<ImportedDeck, 'slides'>,
  resolution: ImportedRenderResolution,
): string {
  const renderedCountField = resolution.mode === 'ready' ? String(resolution.entryCount) : ''
  const texts = deck.slides.map((s) => (s.contentKind === 'image' ? s.imageUrl : s.body))
  return `${resolution.mode}\x1e${renderedCountField}\x1e${texts.length}\x1e${texts.join('\x1f')}`
}
