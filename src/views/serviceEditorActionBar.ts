/**
 * serviceEditorActionBar.ts — the pure per-tab item builder behind R068
 * (36-02 Task 2). `buildActionBarItems(tab, ctx)` turns
 * `ServiceEditorView.vue`'s header state into the declarative list
 * `ContextualActionBar.vue` renders. Imports nothing from Vue, Pinia or the
 * router — that is what makes "which actions does tab X expose?" answerable
 * as a plain function call against data, instead of as a DOM-mount
 * assertion repeated in three places (36-CONTEXT.md § Specific Ideas — that
 * repetition is the exact shape that let `Suggest All Songs` leak onto Roles
 * in the first place).
 *
 * Every builder here reproduces an EXISTING control's EXACT gate, label,
 * title and disabled expression — verified against:
 *   - ServiceEditorView.vue:96-246 (the four header buttons)
 *   - ServiceEditorView.vue:1697-1700 (isLocked, canEditService)
 *   - ServiceEditorView.vue:2074-2082 (isDirty, hasSermonContext)
 *   - SlidesTab.vue:12-23, 200-210, 405-426 (canPresent, presentStartIndex,
 *     onPresentClick, the Present button)
 *
 * ★ FLAGGED SPEC DIVERGENCE (36-02-PLAN.md frontmatter `assumptions`,
 * threat T-36-02-01): 36-UI-SPEC.md §3's illustrative code and its E3 row
 * both assert every Service Order item is `canEditService`-gated. Live
 * source disagrees — `ServiceEditorView.vue:166`'s Export to PC gate is
 * `authStore.hasPcCredentials` ALONE, and `:199`'s Copy for PC is a bare
 * `v-else`; neither carries `canEditService`, nor does the enclosing div at
 * `:97`. This module preserves that: `buildServiceOrderItems` pushes the
 * export/copy item unconditionally, only suggest-all-songs and save are
 * gated on `canEditService`. Preserving the phase invariant ("moving a
 * control must not change who can press it") outranks the spec's
 * illustrative code, per this plan's own stated central invariant.
 */
import type { ActionBarItem } from '@/components/actionBarItems'

export type ActionBarTab = 'service-order' | 'roles' | 'slides'

export interface ActionBarHandlers {
  suggestAllSongs: () => void
  onExportToPC: () => void
  onCopyForPC: () => void
  onSave: () => void
  onPresent: () => void
}

export interface ActionBarContext {
  canEditService: boolean
  hasService: boolean
  hasSermonContext: boolean
  aiSuggestingAll: boolean
  hasPcCredentials: boolean
  isExporting: boolean
  pcCopied: boolean
  serviceStatus: 'draft' | 'planned' | 'exported'
  isDirty: boolean
  isSaving: boolean
  canPresent: boolean
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

function buildExportOrCopyItem(ctx: ActionBarContext): ActionBarItem {
  if (ctx.hasPcCredentials) {
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
  return {
    key: 'copy-pc',
    testId: 'copy-pc-btn',
    label: ctx.pcCopied ? 'Copied!' : 'Copy for PC',
    disabled: !ctx.hasService,
    icon: ctx.pcCopied ? 'check' : 'copy',
    onClick: ctx.handlers.onCopyForPC,
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
    label: 'Present',
    icon: 'present',
    tone: 'present',
    disabled: !ctx.canPresent,
    title: !ctx.canPresent ? 'Add songs or scripture to build a slideshow to present.' : undefined,
    testId: 'action-bar-item-present',
    onClick: ctx.handlers.onPresent,
  }
}

function buildServiceOrderItems(ctx: ActionBarContext): ActionBarItem[] {
  const items: ActionBarItem[] = []
  if (ctx.canEditService) {
    items.push(buildSuggestItem(ctx))
  }
  // Export/copy renders regardless of canEditService, matching live source
  // (see the flagged spec divergence in this file's head comment).
  items.push(buildExportOrCopyItem(ctx))
  if (ctx.canEditService) {
    items.push(buildSaveItem(ctx))
  }
  return items
}

function buildSlidesItems(ctx: ActionBarContext): ActionBarItem[] {
  // Present has no editor gate today (SlidesTab.vue:12-23) and is pushed
  // BEFORE Save so the row reads Present then Save, matching design 1a.
  const items: ActionBarItem[] = [buildPresentItem(ctx)]
  if (ctx.canEditService) {
    items.push(buildSaveItem(ctx))
  }
  return items
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
  if (tab === 'slides') return buildSlidesItems(ctx)
  return buildServiceOrderItems(ctx)
}
