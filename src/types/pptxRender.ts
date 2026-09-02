/**
 * See .planning/codebase/ARCHITECTURE.md (Type & View Behavioral Notes (R318) ->
 * src/types/pptxRender.ts). Keep in sync by hand with functions/src/index.ts
 * (PptxRenderStatus/PptxRenderDoc) — no importable boundary between functions/ and src/.
 */
export type PptxRenderStatus = 'pending' | 'ready' | 'failed'

export interface PptxRenderDoc {
  status: PptxRenderStatus
  renderedCount?: number
  failureReason?: string
}
