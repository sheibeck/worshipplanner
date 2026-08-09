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
 * source disagrees — the export affordance's gate is
 * `authStore.hasPcCredentials` ALONE, with no `canEditService` involved, nor
 * does the enclosing div. This module preserves that: `buildServiceOrderItems`
 * pushes the export item unconditionally (when one exists at all), only
 * suggest-all-songs and save are gated on `canEditService`. Preserving the
 * phase invariant ("moving a control must not change who can press it")
 * outranks the spec's illustrative code, per this plan's own stated central
 * invariant.
 *
 * ★ Owner follow-up (post-36-02): the `copy-pc` fallback item described
 * below no longer exists. `buildExportOrCopyItem` now returns `undefined`
 * when `hasPcCredentials` is false — direct owner feedback on the running
 * app: "let's get rid of the Copy for PC button all together, it's not
 * useful at all." An organization with no Planning Center credentials now
 * has NO export affordance in the action bar; only the credentials-missing
 * note (`ServiceEditorView.vue`, rendered below the bar and gated to the
 * Service Order tab) points them at Settings. That is the owner's explicit,
 * accepted consequence — do not add a replacement affordance and do not
 * ungate `export-pc`.
 *
 * ★ 39-05 (R089): `buildExportOrCopyItem`'s single early return now also
 * composes the org's Planning Center integration toggle (`ctx.pcEnabled`)
 * alongside the pre-existing credentials check. Both conditions govern the
 * SAME return — not two competing checks — so the item disappears when the
 * integration is off even if credentials happen to be present, and the
 * credentials-only gate is unchanged when the integration is on. This is
 * the last of five entry points 39-05 gates; Planning Center has no single
 * choke point the way `claudeApi.ts` does for AI, so each surface carries
 * its own composed condition.
 */
import type { ActionBarItem } from '@/components/actionBarItems'

export type ActionBarTab = 'service-order' | 'roles' | 'slides'

export interface ActionBarHandlers {
  suggestAllSongs: () => void
  onExportToPC: () => void
  onSave: () => void
  onPresent: () => void
  onPrint: () => void
  onShare: () => void
}

export interface ActionBarContext {
  canEditService: boolean
  hasSermonContext: boolean
  aiSuggestingAll: boolean
  /**
   * Org-level AI features toggle (WR-01, 39-REVIEW). Required (not
   * optional) so the compiler forces every call site to supply it — an
   * `undefined` here would silently show "Suggest All Songs" with AI off,
   * the one AI entry point that was missed by 39-05's hide-don't-disable
   * pass. Follows the same threading pattern as `pcEnabled` below.
   */
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
 * Owner follow-up (post-36-02): returns `undefined` — no item at all — when
 * there are no Planning Center credentials, instead of the `copy-pc`
 * fallback button this used to build. Direct owner instruction: "let's get
 * rid of the Copy for PC button all together, it's not useful at all." Do
 * NOT ungate `export-pc` to fill the gap this leaves for an uncredentialed
 * org — that consequence is intentional (see this file's head comment).
 *
 * 39-05 (R089): also returns `undefined` when the org has turned Planning
 * Center off, independently of credentials — composed onto this SAME
 * return, not a second check, so the two conditions can never drift apart.
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
    label: 'Present',
    icon: 'present',
    // Owner follow-up: "Update the Present Button so that it matches the
    // other buttons, right now it stands out because it's so visually
    // different." Deliberately omits `tone` (falls back to `default`,
    // ContextualActionBar.vue's own fallback) rather than the outlined-
    // indigo `present` tone 36-UI-SPEC.md §2 originally called for.
    //
    // ★ DIVERGES FROM 36-UI-SPEC.md §2, which explicitly asked for a fourth
    // `present` tone so Present and Save would never collapse into one
    // visual treatment. The owner has now asked for the opposite — do not
    // "restore" the spec's outlined-indigo present tone. Present and Save
    // remain visually distinguishable anyway: Save keeps `tone: 'primary'`
    // (filled indigo), Present is now `default` (gray) — two different
    // treatments, just not the spec's original pairing. The `▶` icon is
    // untouched; the owner objected to the button's styling, not its glyph.
    disabled: !ctx.canPresent,
    title: !ctx.canPresent ? 'Add songs or scripture to build a slideshow to present.' : undefined,
    testId: 'action-bar-item-present',
    onClick: ctx.handlers.onPresent,
  }
}

/**
 * R101 (48-03): Print, relocated verbatim from the page-bottom button
 * (ServiceEditorView.vue:1303-1314) — unconditional, same as the button it
 * replaces (no editor gate on Print today). testId is preserved so the
 * `print-btn` selector keeps working once the bottom button is deleted
 * (Pitfall 3 / Anti-Patterns: exactly one print-btn must exist).
 */
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
    // WR-01 (48-REVIEW): the pre-migration bottom-row button was
    // `:disabled="!localService || isSharing"` — the `!localService` half is
    // moot here (the whole action bar only mounts once localService is
    // truthy), but `isSharing` must be preserved so a double-click can't fire
    // concurrent createShareToken writes while a share is in flight.
    disabled: ctx.isSharing,
    onClick: ctx.handlers.onShare,
  }
}

function buildServiceOrderItems(ctx: ActionBarContext): ActionBarItem[] {
  const items: ActionBarItem[] = []
  // WR-01: "Suggest All Songs" is a live AI entry point (calls
  // getSongSuggestions for every SONG slot) and must be hidden — not
  // disabled — when the org has turned AI off, per the UI-SPEC's
  // Hide-Don't-Disable Contract.
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
  if (ctx.canEditService) {
    items.push(buildSaveItem(ctx))
  }
  // R101 (48-03): Print/Share relocated here from the page bottom, appended
  // AFTER Save — Save stays the row's one `tone: 'primary'` item; Print and
  // Share both use the bar's `default` gray tone (same as Present), reading
  // as an appendix to the primary actions rather than a competitor to Save.
  items.push(buildPrintItem(ctx))
  const shareItem = buildShareItem(ctx)
  if (shareItem) {
    items.push(shareItem)
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
