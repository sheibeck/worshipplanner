/**
 * Client-side render-status type for `organizations/{orgId}/pptxRenders/{importId}`
 * (Phase 42, R079/R080).
 *
 * This is a CONSUMED-FIELDS PROJECTION of the server document defined in
 * `functions/src/index.ts:150-157`, not a wire mirror. It deliberately OMITS the server
 * document's `storagePath` field: a render document is server-written today but was
 * writable by any org editor until 42-01's rules fix landed (T-42-01), and display code
 * has no legitimate reason to build an image source from a render-document field at all
 * — the sole sanctioned producer of a rendered-page Storage path is `renderedPagePath`
 * (`src/utils/renderedPagePaths.ts`), built only from ids the client already trusts
 * (orgId, renderImportId, pageNumber). Omitting the member here turns "read a path off
 * this document" into a compile error instead of a code-review question (T-42-05).
 *
 * Keep this in sync by hand with `functions/src/index.ts:150-157`
 * (`PptxRenderStatus`/`PptxRenderDoc`) — there is no importable package boundary between
 * `functions/` and `src/`.
 */
export type PptxRenderStatus = 'pending' | 'ready' | 'failed'

export interface PptxRenderDoc {
  status: PptxRenderStatus
  renderedCount?: number
  failureReason?: string
}
