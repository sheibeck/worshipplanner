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
  }
}

function makeContext(overrides: Partial<ActionBarContext> = {}): ActionBarContext {
  return {
    canEditService: true,
    hasSermonContext: true,
    aiSuggestingAll: false,
    hasPcCredentials: true,
    pcEnabled: true,
    isExporting: false,
    serviceStatus: 'planned',
    isDirty: true,
    isSaving: false,
    canPresent: true,
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
        expected: ['suggest-all-songs', 'export-pc', 'save'],
      },
      {
        // Owner follow-up: Copy for PC deleted entirely — no export/copy item
        // renders at all when there are no credentials, only suggest + save.
        name: 'service-order, canEditService true, hasPcCredentials false — no export/copy item at all',
        tab: 'service-order',
        overrides: { canEditService: true, hasPcCredentials: false },
        expected: ['suggest-all-songs', 'save'],
      },
      {
        name: 'service-order, canEditService false, hasPcCredentials true (preserves the ungated export)',
        tab: 'service-order',
        overrides: { canEditService: false, hasPcCredentials: true },
        expected: ['export-pc'],
      },
      {
        // Owner follow-up: with no credentials AND no edit permission, the bar
        // is now completely empty — there is no replacement affordance for
        // the deleted Copy for PC button.
        name: 'service-order, canEditService false, hasPcCredentials false — empty bar, no replacement affordance',
        tab: 'service-order',
        overrides: { canEditService: false, hasPcCredentials: false },
        expected: [],
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
      expect(keysOf('service-order', ctx)).toEqual(['suggest-all-songs', 'save'])
    })

    it('pcEnabled true, hasPcCredentials true: export-pc is present in service-order', () => {
      const ctx = makeContext({ canEditService: true, hasPcCredentials: true, pcEnabled: true })
      expect(keysOf('service-order', ctx)).toEqual(['suggest-all-songs', 'export-pc', 'save'])
    })

    it('pcEnabled false, hasPcCredentials false: export-pc is still absent (both gates agree)', () => {
      const ctx = makeContext({ canEditService: true, hasPcCredentials: false, pcEnabled: false })
      expect(keysOf('service-order', ctx)).toEqual(['suggest-all-songs', 'save'])
    })
  })

  it('ADJACENCY: on slides with canEditService true, present sits immediately before save', () => {
    const ctx = makeContext({ canEditService: true })
    const keys = keysOf('slides', ctx)
    expect(keys.indexOf('present')).toBe(keys.indexOf('save') - 1)
  })

  it('ORDERING: service-order with canEditService true is suggest, then export (when credentialed), then save', () => {
    const credentialed = keysOf('service-order', makeContext({ canEditService: true, hasPcCredentials: true }))
    expect(credentialed).toEqual(['suggest-all-songs', 'export-pc', 'save'])

    // Owner follow-up: uncredentialed no longer inserts a copy-pc item — the
    // export slot is simply absent, so suggest sits directly before save.
    const uncredentialed = keysOf('service-order', makeContext({ canEditService: true, hasPcCredentials: false }))
    expect(uncredentialed).toEqual(['suggest-all-songs', 'save'])
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
})
