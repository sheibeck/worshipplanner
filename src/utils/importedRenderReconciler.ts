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
  * See ADR-0178 (docs/adr/0178-in-the-ready-state-an-identity-is-the-reconciler-s-synthetic.md)
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

/** See ADR-0179 (docs/adr/0179-prefix-for-the-synthetic-ready-state-entry-identity-this-mod.md) */
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

  // See ADR-0180 (docs/adr/0180-an-explicit-render-status-ready-check-not-an-implicit.md)
  if (render.status === 'ready') {
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

  // Safe fallback for any status value outside the closed union this module
  // type-checks against (a future server-added status, or a corrupted/
  // malformed document) — degrade to `failed` with no `failureReason`, so
  // the generic fallback sentence (42-06) applies, rather than crash or
  // masquerade as `ready`.
  return { mode: 'failed', entryCount: deck.slides.length }
}

/**
  * See ADR-0181 (docs/adr/0181-mints-the-stable-per-entry-identity-derivedidentitykey.md)
 * pending/failed is silently dropped — and the entry's `id` itself churns —
 * the instant the render completes.
 *
 * This is an accepted trade-off, not an oversight left unfixed: Fact 1 (this
 * module's header comment) rules out the one alternative that would restore
 * See ADR-0182 (docs/adr/0182-the-promise-a-positional-deck-slides-i-rendered-page-i-1.md)
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
  renderedPage?: number,
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
      // R108 (Phase 50, part 2 of 2 — CONSUME the page): an imported deck's
      // slides can be manually added into ANOTHER slot's group (e.g. a Prayer
      // group, alongside auto-generated slides). Such a hand-added entry keeps
      // the deck's PARSED-slide id as its innerSlideId — the synthetic
      // `rendered-page-N` identity is only ever minted by the IMPORTED-slot
      // materializer, never for an entry dropped into a non-imported group.
      // Resolution order, strictly extending the ec217aa positional stopgap:
      //   1. A synthetic `rendered-page-N` identity (the materializer's own
      //      entries) resolves by N — unconditional on renderedPage.
      //   2. Else a supplied `renderedPage` (the 50-03 render-stable reference
      //      recorded on a hand-added entry's sourceRef at add-time) resolves
      //      directly — this is what makes a MULTI-IMAGE deck (parsed-slide
      //      count != rendered-page count) work, closing the gap the ec217aa
      //      positional resolver could not.
      //   3. Else, when parsed/rendered counts match 1:1 (the common
      //      single-image-per-slide deck), fall back to the ec217aa positional
      //      resolver: map the entry to its page by its position in
      //      `deck.slides`. Kept in place for legacy entries added before
      //      50-03 recorded renderedPage (50-CONTEXT.md: fallback, no
      //      migration).
      //   4. Else — a multi-image deck with no renderedPage (a legacy entry
      //      that has never worked) — leave it pending rather than risk
      //      pairing to the wrong page.
      let pageNumber = renderedPageNumberFromIdentity(innerSlideId)
      if (pageNumber === null && renderedPage !== undefined) {
        pageNumber = renderedPage
      }
      if (pageNumber === null && deck.slides.length === resolution.entryCount) {
        const idx = deck.slides.findIndex((s) => s.id === innerSlideId)
        if (idx >= 0) pageNumber = idx + 1
      }
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
