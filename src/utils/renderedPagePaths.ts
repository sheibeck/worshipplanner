/**
 * Client-side rendered-page Storage-path convention (Phase 42, R079/R080).
 *
 * Copied verbatim from the two server-side originals — there is no importable package
 * boundary between `functions/`/`render-service/` and `src/`, so this is a hand-synced
 * third copy. Keep in sync with:
 *   - `functions/src/index.ts:274-283` (`renderedPrefixFor`, `RENDERED_OBJECT_NAME`)
 *   - `render-service/src/render.ts:69-79` (`RENDERED_PAGE_PAD`, `renderedPrefix`,
 *     `renderedObjectName`)
 *
 * Page numbering is 1-based — there is no page 0. This matches the contiguity check
 * `functions/src/index.ts:408` runs against the server's own recount
 * (`pageNumbers.every((n, i) => n === i + 1)`), which is only sound if page numbers
 * start at 1.
 *
 * Do NOT re-implement `getDownloadURL` here — `src/utils/pptxUpload.ts::resolveImageUrl`
 * is the one canonical wrapper; this module only builds the PATH that wrapper resolves.
 */

// ★ Load-bearing, not cosmetic — see render-service/src/render.ts:62-68 for the full
// lexical-Storage-listing-order rationale this padding exists to satisfy. A client-built
// path for page 7 must be `page-0007.png`, never `page-7.png`.
export const RENDERED_PAGE_PAD = 4

/** `orgs/{orgId}/pptx-imports/{renderImportId}/rendered/` — byte-identical to the two
 * server-side originals. `renderImportId` is `ImportedDeck.renderImportId`, NOT
 * `ImportedDeck.id`/`ImportedSlot.importId` (src/types/importedDeck.ts:19-30). */
export function renderedPrefixFor(orgId: string, renderImportId: string): string {
  return `orgs/${orgId}/pptx-imports/${renderImportId}/rendered/`
}

/** `renderedObjectName(1)` → `'page-0001.png'`. There is no page 0 — this is not a
 * supported input. */
export function renderedObjectName(pageNumber: number): string {
  return `page-${String(pageNumber).padStart(RENDERED_PAGE_PAD, '0')}.png`
}

/** The full Storage object path for one rendered page — the composition of
 * `renderedPrefixFor` and `renderedObjectName`. Resolve the result through
 * `resolveImageUrl` (`src/utils/pptxUpload.ts`), never construct a download URL here. */
export function renderedPagePath(orgId: string, renderImportId: string, pageNumber: number): string {
  return `${renderedPrefixFor(orgId, renderImportId)}${renderedObjectName(pageNumber)}`
}
