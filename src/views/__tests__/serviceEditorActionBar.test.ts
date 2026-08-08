import { describe, it, expect, vi } from 'vitest'
import {
  buildActionBarItems,
  type ActionBarContext,
  type ActionBarTab,
} from '../serviceEditorActionBar'

// R068 acceptance suite (36-02 Task 2) — deliberately DATA-level, not
// DOM-level. 36-CONTEXT.md is explicit that a DOM-level test in three places
// is the shape that let `Suggest All Songs` leak onto Roles in the first
// place; a pure function call answers "which actions does tab X expose?"
// without mounting anything.
//
// Expected values below were derived from the pre-phase markup at:
//   - ServiceEditorView.vue:96-246 (the four header buttons)
//   - ServiceEditorView.vue:1697-1700 (isLocked, canEditService)
//   - ServiceEditorView.vue:2074-2082 (isDirty, hasSermonContext)
//   - SlidesTab.vue:12-23, 200-210, 405-426 (canPresent, presentStartIndex,
//     onPresentClick, the Present button)
//
// ★ FLAGGED SPEC DIVERGENCE (36-02-PLAN.md frontmatter `assumptions`):
// 36-UI-SPEC.md §3's illustrative code and its Empty-State row E3 both claim
// every Service Order action-bar item is `canEditService`-gated. Live source
// disagrees: `ServiceEditorView.vue:166` gates Export to PC on
// `authStore.hasPcCredentials` ALONE, and `:199`'s Copy for PC is a bare
// `v-else` — neither carries `canEditService`, and the enclosing div at `:97`
// has none either. A viewer, and an editor on a locked service, see
// Export/Copy today. This suite asserts that PRESERVED behaviour (the two
// `canEditService: false` Service Order rows below), which is what proves no
// relocated control was silently narrowed.

function makeHandlers() {
  return {
    suggestAllSongs: vi.fn(),
    onExportToPC: vi.fn(),
    onSave: vi.fn(),
    onPresent: vi.fn(),
    onPrint: vi.fn(),
    onShare: vi.fn(),
  }
}

function makeContext(overrides: Partial<ActionBarContext> = {}): ActionBarContext {
  return {
    canEditService: true,
    hasSermonContext: true,
    aiSuggestingAll: false,
    aiEnabled: true,
    hasPcCredentials: true,
    pcEnabled: true,
    isExporting: false,
    serviceStatus: 'planned',
    isDirty: true,
    isSaving: false,
    canPresent: true,
    // R101 (48-03) — defaults chosen so every pre-existing GATING MATRIX row
    // below (written before Print/Share existed) keeps exercising the SAME
    // canEditService/hasPcCredentials/aiEnabled/pcEnabled combinations it
    // always has; Print/Share visibility is covered by its own dedicated
    // describe block further down.
    isEditor: true,
    isSharing: false,
    shareCopied: false,
    shareError: null,
    handlers: makeHandlers(),
    ...overrides,
  }
}

function keysOf(tab: ActionBarTab, ctx: ActionBarContext): string[] {
  return buildActionBarItems(tab, ctx).map((item) => item.key)
}

const BOOLEAN_FLAG_KEYS = [
  'canEditService',
  'hasSermonContext',
  'aiSuggestingAll',
  'aiEnabled',
  'hasPcCredentials',
  'isExporting',
  'isDirty',
  'isSaving',
  'canPresent',
] as const

const STATUSES: ActionBarContext['serviceStatus'][] = ['draft', 'planned', 'exported']

function* cartesianContexts(): Generator<ActionBarContext> {
  const flagCount = BOOLEAN_FLAG_KEYS.length
  const combinations = 1 << flagCount
  for (let mask = 0; mask < combinations; mask++) {
    for (const serviceStatus of STATUSES) {
      const overrides: Partial<ActionBarContext> = { serviceStatus }
      BOOLEAN_FLAG_KEYS.forEach((key, index) => {
        ;(overrides as Record<string, boolean>)[key] = Boolean(mask & (1 << index))
      })
      yield makeContext(overrides)
    }
  }
}

describe('buildActionBarItems', () => {
  it('LEAK TEST: neither slides nor roles ever contain suggest-all-songs, export-pc, or copy-pc, for the full cartesian product of context flags', () => {
    const forbidden = ['suggest-all-songs', 'export-pc', 'copy-pc']
    for (const ctx of cartesianContexts()) {
      const slidesKeys = keysOf('slides', ctx)
      const rolesKeys = keysOf('roles', ctx)
      for (const key of forbidden) {
        expect(slidesKeys).not.toContain(key)
        expect(rolesKeys).not.toContain(key)
      }
    }
  })

  it('ROLES EMPTY: the roles item list has length 0 across the same cartesian product', () => {
    for (const ctx of cartesianContexts()) {
      expect(buildActionBarItems('roles', ctx).length).toBe(0)
    }
  })

  describe('GATING MATRIX (exact key arrays, toEqual not toContain)', () => {
    const rows: Array<{ name: string; tab: ActionBarTab; overrides: Partial<ActionBarContext>; expected: string[] }> = [
      { name: 'roles, editor', tab: 'roles', overrides: { canEditService: true }, expected: [] },
      { name: 'roles, viewer', tab: 'roles', overrides: { canEditService: false }, expected: [] },
      { name: 'slides, canEditService false', tab: 'slides', overrides: { canEditService: false }, expected: ['present'] },
      { name: 'slides, canEditService true', tab: 'slides', overrides: { canEditService: true }, expected: ['present', 'save'] },
      {
        name: 'service-order, canEditService true, hasPcCredentials true',
        tab: 'service-order',
        overrides: { canEditService: true, hasPcCredentials: true },
        // R101 (48-03): Print/Share now trail Save (isEditor defaults true).
        expected: ['suggest-all-songs', 'export-pc', 'save', 'print', 'share'],
      },
      {
        // Owner follow-up: Copy for PC deleted entirely — no export/copy item
        // renders at all when there are no credentials, only suggest + save
        // (+ Print/Share, R101).
        name: 'service-order, canEditService true, hasPcCredentials false — no export/copy item at all',
        tab: 'service-order',
        overrides: { canEditService: true, hasPcCredentials: false },
        expected: ['suggest-all-songs', 'save', 'print', 'share'],
      },
      {
        // R101 (48-03): Print/Share are NOT gated on canEditService (same as
        // the page-bottom buttons they replace) — they still trail whatever
        // else the row emits.
        name: 'service-order, canEditService false, hasPcCredentials true (preserves the ungated export)',
        tab: 'service-order',
        overrides: { canEditService: false, hasPcCredentials: true },
        expected: ['export-pc', 'print', 'share'],
      },
      {
        // Owner follow-up: with no credentials AND no edit permission, the bar
        // has no export/copy replacement affordance — but Print/Share (R101)
        // are gated on isEditor alone, not canEditService, so they still show.
        name: 'service-order, canEditService false, hasPcCredentials false — empty bar except Print/Share',
        tab: 'service-order',
        overrides: { canEditService: false, hasPcCredentials: false },
        expected: ['print', 'share'],
      },
    ]

    for (const row of rows) {
      it(row.name, () => {
        const ctx = makeContext(row.overrides)
        expect(keysOf(row.tab, ctx)).toEqual(row.expected)
      })
    }
  })

  // 39-05 (R089): pcEnabled composes with hasPcCredentials on the SAME
  // return in buildExportOrCopyItem — asserted here at the data level
  // (the keys the builder emits), matching this file's established style
  // rather than mounting a component. Named so `-t "pcEnabled"` selects
  // exactly these cases.
  describe('pcEnabled (39-05, R089)', () => {
    it('pcEnabled false, hasPcCredentials true: export-pc is absent from service-order', () => {
      const ctx = makeContext({ canEditService: true, hasPcCredentials: true, pcEnabled: false })
      expect(keysOf('service-order', ctx)).toEqual(['suggest-all-songs', 'save', 'print', 'share'])
    })

    it('pcEnabled true, hasPcCredentials true: export-pc is present in service-order', () => {
      const ctx = makeContext({ canEditService: true, hasPcCredentials: true, pcEnabled: true })
      expect(keysOf('service-order', ctx)).toEqual(['suggest-all-songs', 'export-pc', 'save', 'print', 'share'])
    })

    it('pcEnabled false, hasPcCredentials false: export-pc is still absent (both gates agree)', () => {
      const ctx = makeContext({ canEditService: true, hasPcCredentials: false, pcEnabled: false })
      expect(keysOf('service-order', ctx)).toEqual(['suggest-all-songs', 'save', 'print', 'share'])
    })
  })

  // WR-01 (39-REVIEW): "Suggest All Songs" is a live AI entry point
  // (buildSuggestItem calls getSongSuggestions per SONG slot) that was never
  // gated on the org's AI toggle. Hide-don't-disable, same as the other
  // AI-gated surfaces this phase touches — named so `-t "aiEnabled"` selects
  // exactly these cases.
  describe('aiEnabled (WR-01)', () => {
    it('aiEnabled false: suggest-all-songs is absent from service-order', () => {
      const ctx = makeContext({ canEditService: true, aiEnabled: false })
      expect(keysOf('service-order', ctx)).toEqual(['export-pc', 'save', 'print', 'share'])
    })

    it('aiEnabled true: suggest-all-songs is present in service-order', () => {
      const ctx = makeContext({ canEditService: true, aiEnabled: true })
      expect(keysOf('service-order', ctx)).toEqual(['suggest-all-songs', 'export-pc', 'save', 'print', 'share'])
    })

    it('aiEnabled false composes with canEditService: suggest-all-songs never appears regardless of edit permission', () => {
      const editor = makeContext({ canEditService: true, aiEnabled: false, hasPcCredentials: false })
      const viewer = makeContext({ canEditService: false, aiEnabled: false, hasPcCredentials: false })
      expect(keysOf('service-order', editor)).not.toContain('suggest-all-songs')
      expect(keysOf('service-order', viewer)).not.toContain('suggest-all-songs')
    })

    it('aiEnabled has no effect on slides or roles tabs (suggest-all-songs never appears there anyway)', () => {
      expect(keysOf('slides', makeContext({ aiEnabled: false }))).not.toContain('suggest-all-songs')
      expect(keysOf('roles', makeContext({ aiEnabled: false }))).not.toContain('suggest-all-songs')
    })
  })

  it('ADJACENCY: on slides with canEditService true, present sits immediately before save', () => {
    const ctx = makeContext({ canEditService: true })
    const keys = keysOf('slides', ctx)
    expect(keys.indexOf('present')).toBe(keys.indexOf('save') - 1)
  })

  it('ORDERING: service-order with canEditService true is suggest, then export (when credentialed), then save, then print, then share', () => {
    const credentialed = keysOf('service-order', makeContext({ canEditService: true, hasPcCredentials: true }))
    expect(credentialed).toEqual(['suggest-all-songs', 'export-pc', 'save', 'print', 'share'])

    // Owner follow-up: uncredentialed no longer inserts a copy-pc item — the
    // export slot is simply absent, so suggest sits directly before save.
    const uncredentialed = keysOf('service-order', makeContext({ canEditService: true, hasPcCredentials: false }))
    expect(uncredentialed).toEqual(['suggest-all-songs', 'save', 'print', 'share'])
  })

  it('IDEMPOTENCY: two successive calls with the same context return equal key arrays', () => {
    const ctx = makeContext()
    expect(keysOf('service-order', ctx)).toEqual(keysOf('service-order', ctx))
  })

  it('IDEMPOTENCY: service-order -> slides -> service-order returns a key array equal to the first call', () => {
    const ctx = makeContext()
    const first = keysOf('service-order', ctx)
    keysOf('slides', ctx)
    const third = keysOf('service-order', ctx)
    expect(third).toEqual(first)
  })

  it('CONCURRENCY: aiSuggestingAll true disables the suggest item and relabels it Suggesting...', () => {
    const ctx = makeContext({ canEditService: true, aiSuggestingAll: true })
    const items = buildActionBarItems('service-order', ctx)
    const suggest = items.find((item) => item.key === 'suggest-all-songs')
    expect(suggest?.disabled).toBe(true)
    expect(suggest?.label).toBe('Suggesting...')
  })

  it('CONCURRENCY: isExporting true disables the export item and shows the spinner icon', () => {
    const ctx = makeContext({ canEditService: true, hasPcCredentials: true, isExporting: true, serviceStatus: 'planned' })
    const items = buildActionBarItems('service-order', ctx)
    const exportItem = items.find((item) => item.key === 'export-pc')
    expect(exportItem?.disabled).toBe(true)
    expect(exportItem?.icon).toBe('spinner')
  })

  it('HANDLER IDENTITY: every emitted onClick is reference-equal to the handler passed in ctx.handlers', () => {
    const ctx = makeContext({ canEditService: true, hasPcCredentials: true })
    const items = buildActionBarItems('service-order', ctx)
    const suggest = items.find((item) => item.key === 'suggest-all-songs')
    const exportItem = items.find((item) => item.key === 'export-pc')
    const save = items.find((item) => item.key === 'save')
    expect(suggest?.onClick).toBe(ctx.handlers.suggestAllSongs)
    expect(exportItem?.onClick).toBe(ctx.handlers.onExportToPC)
    expect(save?.onClick).toBe(ctx.handlers.onSave)

    const slidesCtx = makeContext({ canEditService: false })
    const present = buildActionBarItems('slides', slidesCtx).find((item) => item.key === 'present')
    expect(present?.onClick).toBe(slidesCtx.handlers.onPresent)
  })

  describe('DISABLED CONDITIONS', () => {
    it('save is disabled when !isDirty', () => {
      const ctx = makeContext({ canEditService: true, isDirty: false, isSaving: false })
      const save = buildActionBarItems('service-order', ctx).find((item) => item.key === 'save')
      expect(save?.disabled).toBe(true)
    })

    it('save is disabled when isSaving', () => {
      const ctx = makeContext({ canEditService: true, isDirty: true, isSaving: true })
      const save = buildActionBarItems('service-order', ctx).find((item) => item.key === 'save')
      expect(save?.disabled).toBe(true)
    })

    it('save is enabled only when dirty and not saving', () => {
      const ctx = makeContext({ canEditService: true, isDirty: true, isSaving: false })
      const save = buildActionBarItems('service-order', ctx).find((item) => item.key === 'save')
      expect(save?.disabled).toBe(false)
    })

    it('present is disabled exactly when !canPresent', () => {
      const disabledCtx = makeContext({ canPresent: false })
      const enabledCtx = makeContext({ canPresent: true })
      expect(buildActionBarItems('slides', disabledCtx).find((item) => item.key === 'present')?.disabled).toBe(true)
      expect(buildActionBarItems('slides', enabledCtx).find((item) => item.key === 'present')?.disabled).toBe(false)
    })
  })

  describe('label/title/icon reproduction of live source expressions', () => {
    it('suggest-all-songs title fires only when hasSermonContext is false', () => {
      const withContext = makeContext({ canEditService: true, hasSermonContext: true })
      const withoutContext = makeContext({ canEditService: true, hasSermonContext: false })
      expect(buildActionBarItems('service-order', withContext).find((i) => i.key === 'suggest-all-songs')?.title).toBeUndefined()
      expect(buildActionBarItems('service-order', withoutContext).find((i) => i.key === 'suggest-all-songs')?.title).toBe(
        'Add a sermon topic or passage for AI suggestions',
      )
    })

    it('export-pc label/title/icon vary by serviceStatus and isExporting', () => {
      const draft = buildActionBarItems(
        'service-order',
        makeContext({ canEditService: true, hasPcCredentials: true, serviceStatus: 'draft' }),
      ).find((i) => i.key === 'export-pc')
      expect(draft?.label).toBe('Export to PC')
      expect(draft?.title).toBe('Mark service as Planned to export')
      expect(draft?.disabled).toBe(true)
      expect(draft?.icon).toBe('upload')

      const exported = buildActionBarItems(
        'service-order',
        makeContext({ canEditService: true, hasPcCredentials: true, serviceStatus: 'exported' }),
      ).find((i) => i.key === 'export-pc')
      expect(exported?.label).toBe('Exported')
      expect(exported?.title).toBe('Already exported to Planning Center')
      expect(exported?.disabled).toBe(true)
      expect(exported?.icon).toBe('check')

      const planned = buildActionBarItems(
        'service-order',
        makeContext({ canEditService: true, hasPcCredentials: true, serviceStatus: 'planned' }),
      ).find((i) => i.key === 'export-pc')
      expect(planned?.title).toBeUndefined()
      expect(planned?.disabled).toBe(false)
    })

    // Owner follow-up: Copy for PC is deleted entirely, not merely relabeled —
    // `buildExportOrCopyItem` returns `undefined` with no credentials, so no
    // `copy-pc` key can ever appear in a built item list. Restated here (the
    // LEAK TEST and GATING MATRIX above already assert this at the array
    // level) as a direct pin against the specific find-by-key lookup this
    // block otherwise exercises for every other key.
    it('no copy-pc item is ever produced, with or without canEditService, once credentials are absent', () => {
      const editorNoCreds = buildActionBarItems(
        'service-order',
        makeContext({ canEditService: true, hasPcCredentials: false }),
      ).find((i) => i.key === 'copy-pc')
      expect(editorNoCreds).toBeUndefined()

      const viewerNoCreds = buildActionBarItems(
        'service-order',
        makeContext({ canEditService: false, hasPcCredentials: false }),
      ).find((i) => i.key === 'copy-pc')
      expect(viewerNoCreds).toBeUndefined()
    })

    it('export-pc carries its preserved testid', () => {
      const exportItem = buildActionBarItems(
        'service-order',
        makeContext({ canEditService: true, hasPcCredentials: true }),
      ).find((i) => i.key === 'export-pc')
      expect(exportItem?.testId).toBe('export-pc-btn')
    })

    it('present carries the disabled title and testid exactly', () => {
      const disabled = buildActionBarItems('slides', makeContext({ canPresent: false })).find((i) => i.key === 'present')
      expect(disabled?.title).toBe('Add songs or scripture to build a slideshow to present.')
      expect(disabled?.testId).toBe('action-bar-item-present')

      const enabled = buildActionBarItems('slides', makeContext({ canPresent: true })).find((i) => i.key === 'present')
      expect(enabled?.title).toBeUndefined()
    })
  })

  // R101 (48-03): Print/Share relocation from the page-bottom row into the
  // top action bar. buildServiceOrderItems appends them AFTER Save;
  // buildShareItem preserves the exact isEditor gate the bottom-row Share
  // button used (T-48-03-01); buildPrintItem is unconditional, matching the
  // bottom-row Print button it replaces.
  describe('Print/Share (R101, 48-03)', () => {
    it('service-order ends in [..., save, print, share] when isEditor and canEditService', () => {
      const ctx = makeContext({ canEditService: true, isEditor: true })
      const keys = keysOf('service-order', ctx)
      expect(keys.slice(-3)).toEqual(['save', 'print', 'share'])
    })

    it('share is absent (no "share" key) when isEditor is false', () => {
      const ctx = makeContext({ isEditor: false })
      expect(keysOf('service-order', ctx)).not.toContain('share')
    })

    it('print is present regardless of isEditor', () => {
      expect(keysOf('service-order', makeContext({ isEditor: true }))).toContain('print')
      expect(keysOf('service-order', makeContext({ isEditor: false }))).toContain('print')
    })

    it('the Roles tab still returns [] regardless of isEditor', () => {
      expect(buildActionBarItems('roles', makeContext({ isEditor: true }))).toEqual([])
      expect(buildActionBarItems('roles', makeContext({ isEditor: false }))).toEqual([])
    })

    it('buildPrintItem carries its preserved print-btn testid and label', () => {
      const item = buildActionBarItems('service-order', makeContext()).find((i) => i.key === 'print')
      expect(item?.testId).toBe('print-btn')
      expect(item?.label).toBe('Print')
      expect(item?.icon).toBe('print')
    })

    it('buildShareItem label reflects isSharing/shareCopied/shareError precedence', () => {
      const idle = buildActionBarItems('service-order', makeContext({ isEditor: true })).find((i) => i.key === 'share')
      expect(idle?.label).toBe('Share')
      expect(idle?.icon).toBe('share')

      const sharing = buildActionBarItems('service-order', makeContext({ isEditor: true, isSharing: true })).find(
        (i) => i.key === 'share',
      )
      expect(sharing?.label).toBe('Sharing...')

      const copied = buildActionBarItems('service-order', makeContext({ isEditor: true, shareCopied: true })).find(
        (i) => i.key === 'share',
      )
      expect(copied?.label).toBe('Link Copied!')

      const errored = buildActionBarItems('service-order', makeContext({ isEditor: true, shareError: 'Failed to create share link' })).find(
        (i) => i.key === 'share',
      )
      expect(errored?.label).toBe('Failed to create share link')
    })

    it('HANDLER IDENTITY: print/share onClick are reference-equal to ctx.handlers.onPrint/onShare', () => {
      const ctx = makeContext({ isEditor: true })
      const items = buildActionBarItems('service-order', ctx)
      expect(items.find((i) => i.key === 'print')?.onClick).toBe(ctx.handlers.onPrint)
      expect(items.find((i) => i.key === 'share')?.onClick).toBe(ctx.handlers.onShare)
    })
  })
})
