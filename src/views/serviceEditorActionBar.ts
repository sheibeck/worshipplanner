/**
 * serviceEditorActionBar.ts — the pure per-tab item builder behind R068 (36-02 Task 2).
 * See .planning/codebase/INTEGRATIONS.md (Type & View Integration Notes (R318) ->
 * src/views/serviceEditorActionBar.ts).
 */
import type { ActionBarItem } from '@/components/actionBarItems'

export type ActionBarTab = 'service-order' | 'roles' | 'slides' | 'messages' | 'stage'

export interface ActionBarHandlers {
  suggestAllSongs: () => void
  onExportToPC: () => void
  onSave: () => void
  onPresent: () => void
  onPrint: () => void
  onShare: () => void
  /** R136 (59-04): opens the ✉ Messages composer (MessageComposer.vue). */
  onMessages: () => void
}

export interface ActionBarContext {
  canEditService: boolean
  hasSermonContext: boolean
  aiSuggestingAll: boolean
  /** See ADR-0241 (docs/adr/0241-org-level-ai-features-toggle-wr-01-39-review-required-not.md) */
  aiEnabled: boolean
  hasPcCredentials: boolean
  /**
   * Org-level Planning Center integration toggle (R089, 39-05). Required
   * (not optional) so the compiler forces every call site to supply it —
   * an `undefined` here would silently hide the export item for everyone,
   * credentialed or not.
   */
  pcEnabled: boolean
  isExporting: boolean
  serviceStatus: 'draft' | 'planned' | 'exported'
  isDirty: boolean
  isSaving: boolean
  canPresent: boolean
  /**
   * R101 (48-03): whether the current viewer is an editor. Required (not
   * optional) so the compiler forces the one call site to supply it — a
   * share denormalizes an editor-only roster/schedule snapshot, so this
   * gate must move WITH `buildShareItem`, not be dropped (T-48-03-01).
   */
  isEditor: boolean
  /** R101 (48-03): mirrors ServiceEditorView.vue's `isSharing` ref. */
  isSharing: boolean
  /** R101 (48-03): mirrors ServiceEditorView.vue's `shareCopied` ref. */
  shareCopied: boolean
  /** R101 (48-03): mirrors ServiceEditorView.vue's `shareError` ref. */
  shareError: string | null
  /**
   * R136 (59-04): the org-level volunteer-email messaging kill switch
   * (`isMessagingEnabled()`, Phase 58). Required (not optional) so the
   * compiler forces the one call site to supply it — the same rationale as
   * `aiEnabled`/`pcEnabled` above. A `false` here HIDES the ✉ Messages item
   * entirely (see `buildMessagesItem`), the same hide-on-fail rule those two
   * follow (owner UAT 2026-08-17 reversed 59-04's disabled+tooltip form).
   */
  messagingEnabled: boolean
  handlers: ActionBarHandlers
}

function buildSuggestItem(ctx: ActionBarContext): ActionBarItem {
  return {
    key: 'suggest-all-songs',
    label: ctx.aiSuggestingAll ? 'Suggesting...' : 'Suggest All Songs',
    disabled: !ctx.hasSermonContext || ctx.aiSuggestingAll,
    title: !ctx.hasSermonContext ? 'Add a sermon topic or passage for AI suggestions' : undefined,
    icon: 'ai-sparkle',
    onClick: ctx.handlers.suggestAllSongs,
  }
}

/**
 * Do NOT ungate `export-pc` for an uncredentialed org — intentional (owner follow-up).
 * See .planning/codebase/INTEGRATIONS.md (Type & View Integration Notes (R318) ->
 * src/views/serviceEditorActionBar.ts).
 */
function buildExportOrCopyItem(ctx: ActionBarContext): ActionBarItem | undefined {
  if (!ctx.hasPcCredentials || !ctx.pcEnabled) return undefined
  return {
    key: 'export-pc',
    testId: 'export-pc-btn',
    label: ctx.isExporting ? 'Exporting...' : ctx.serviceStatus === 'exported' ? 'Exported' : 'Export to PC',
    disabled: ctx.isExporting || ctx.serviceStatus !== 'planned',
    title:
      ctx.serviceStatus === 'draft'
        ? 'Mark service as Planned to export'
        : ctx.serviceStatus === 'exported'
          ? 'Already exported to Planning Center'
          : undefined,
    icon: ctx.isExporting ? 'spinner' : ctx.serviceStatus === 'exported' ? 'check' : 'upload',
    onClick: ctx.handlers.onExportToPC,
  }
}

function buildSaveItem(ctx: ActionBarContext): ActionBarItem {
  return {
    key: 'save',
    label: ctx.isSaving ? 'Saving...' : 'Save',
    disabled: !ctx.isDirty || ctx.isSaving,
    tone: 'primary',
    onClick: ctx.handlers.onSave,
  }
}

function buildPresentItem(ctx: ActionBarContext): ActionBarItem {
  return {
    key: 'present',
    // Owner 2026-09-01: renamed "Present" → "Review Slides" so it is not
    // confused with Run (running a live service). Kept SECONDARY (default
    // gray, no `tone`) on the owner's explicit direction — "Review button
    // should be secondary; that makes Run as primary stand out more" — so Run
    // is the one filled-indigo standout in the button area. The old ▶ play
    // glyph (which read as "run/play") is swapped for an eye to reinforce that
    // this is a REVIEW, not a live run.
    label: 'Review Slides',
    icon: 'review',
    disabled: !ctx.canPresent,
    title: !ctx.canPresent ? 'Add songs or scripture to build a slideshow to review.' : undefined,
    testId: 'action-bar-item-present',
    onClick: ctx.handlers.onPresent,
  }
}

/** See ADR-0242 (docs/adr/0242-r101-48-03-print-relocated-verbatim-from-the-page-bottom-but.md) */
function buildPrintItem(ctx: ActionBarContext): ActionBarItem {
  return {
    key: 'print',
    label: 'Print',
    icon: 'print',
    testId: 'print-btn',
    onClick: ctx.handlers.onPrint,
  }
}

/**
 * R101 (48-03): Share, relocated verbatim from the page-bottom button
 * (ServiceEditorView.vue:1319-1333). Preserves the exact `isEditor` gate
 * the bottom-row button used — a share denormalizes an editor-only
 * roster/schedule snapshot, so a viewer-created share would silently omit
 * "Who's Serving" (T-48-03-01). The gate moves with the control; it is not
 * dropped.
 */
function buildShareItem(ctx: ActionBarContext): ActionBarItem | undefined {
  if (!ctx.isEditor) return undefined
  return {
    key: 'share',
    label: ctx.isSharing ? 'Sharing...' : ctx.shareCopied ? 'Link Copied!' : ctx.shareError ? ctx.shareError : 'Share',
    icon: 'share',
    // See ADR-0233 (docs/adr/0233-the-pre-migration-bottom-row-button-was-disabled-localservic.md)
    disabled: ctx.isSharing,
    onClick: ctx.handlers.onShare,
  }
}

/** See ADR-0243 (docs/adr/0243-hide-on-fail-when-messaging-is-off-owner-uat-2026-08-17-the.md) */
function buildMessagesItem(ctx: ActionBarContext): ActionBarItem | undefined {
  if (!ctx.isEditor || !ctx.messagingEnabled) return undefined
  return {
    key: 'messages',
    label: 'Messages',
    icon: 'mail',
    onClick: ctx.handlers.onMessages,
  }
}

function buildServiceOrderItems(ctx: ActionBarContext): ActionBarItem[] {
  const items: ActionBarItem[] = []
  // See ADR-0244 (docs/adr/0244-suggest-all-songs-is-a-live-ai-entry-point-calls.md)
  if (ctx.canEditService && ctx.aiEnabled) {
    items.push(buildSuggestItem(ctx))
  }
  // Export renders regardless of canEditService, matching live source (see
  // the flagged spec divergence in this file's head comment) — and renders
  // NOTHING at all when there are no PC credentials (owner follow-up).
  const exportItem = buildExportOrCopyItem(ctx)
  if (exportItem) {
    items.push(exportItem)
  }
  items.push(buildPrintItem(ctx))
  // R136 (59-04): ✉ Messages sits LEFT OF Share (UI-SPEC #0) — pushed before
  // the share item so the row reads [..., print, messages, share].
  const messagesItem = buildMessagesItem(ctx)
  if (messagesItem) {
    items.push(messagesItem)
  }
  const shareItem = buildShareItem(ctx)
  if (shareItem) {
    items.push(shareItem)
  }
  // Save is the LAST (rightmost) action-bar item on every tab (owner
  // 2026-09-01), matching the Slides tab where Save also sits last — so the
  // primary Save control is in the same position regardless of tab. (It used
  // to sit mid-row, right after Export.)
  if (ctx.canEditService) {
    items.push(buildSaveItem(ctx))
  }
  return items
}

function buildSlidesItems(ctx: ActionBarContext): ActionBarItem[] {
  // No Save on the Slides tab (owner 2026-09-01): slide edits ride the
  // slideGroups store, NOT `localService`, so `isDirty` never trips here and a
  // Save button would sit permanently disabled. Autosave still persists slide
  // changes. "Review Slides" (Present) is the only action; it has no editor
  // gate (presentation-only), so a viewer sees it too.
  return [buildPresentItem(ctx)]
}

/**
 * Which action-bar entries does tab `tab` expose, given `ctx`? Pure: no Vue,
 * Pinia or router import anywhere in this module, and no mutation of `ctx`.
 * Roles always returns a fresh empty array — undrawn in the wireframe,
 * unresolved by design per 36-UI-SPEC § UI Considerations, implemented as
 * "expose nothing" pending a future design decision.
 */
export function buildActionBarItems(tab: ActionBarTab, ctx: ActionBarContext): ActionBarItem[] {
  if (tab === 'roles') return []
  // 63-01 (R149): the Messages tab exposes no action-bar items — like Roles.
  // The ✉ Messages composer entry stays inside buildServiceOrderItems, reached
  // only on the Service Order tab (SC3 unchanged).
  if (tab === 'messages') return []
  // Phase 107 (R313): the Stage Layout tab exposes no action-bar items either —
  // same "expose nothing" precedent as Roles/Messages above. Marker persistence
  // rides the existing autosave path with no dedicated Save/Present affordance.
  if (tab === 'stage') return []
  if (tab === 'slides') return buildSlidesItems(ctx)
  return buildServiceOrderItems(ctx)
}
