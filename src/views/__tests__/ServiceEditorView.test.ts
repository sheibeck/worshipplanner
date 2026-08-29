import { describe, it, expect, vi, beforeEach, beforeAll, afterEach } from 'vitest'
import { shallowMount, enableAutoUnmount, DOMWrapper, flushPromises, type VueWrapper } from '@vue/test-utils'
import { reactive } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import type { Options as SortableOptions } from 'sortablejs'
import type { Service } from '@/types/service'
import type { Song } from '@/types/song'
import type { Person, Role, Quarter } from '@/types/roster'
import type { Timestamp } from 'firebase/firestore'
import type { SlideGroup } from '@/types/slideGroup'
import type { ServiceSnapshot } from '@/stores/services'
import PresentationViewer from '@/components/PresentationViewer.vue'
import SlidesTab from '@/components/slides/SlidesTab.vue'
import CongregationalEditor from '@/components/CongregationalEditor.vue'
// 62-04 (R146/R148): matched against the shallowMount stub so re-lock tests can
// read the mounted prompt's props and emit its sent/cancel events.
import ReLockNotifyPrompt from '@/components/ReLockNotifyPrompt.vue'
// 32-05: ServiceEditorView now consumes the REAL, Firestore-free useSaveStatus
// store directly (not vi.mock-ed) — the same new-precedent choice 32-03/32-04
// already made for their own store/component tests.
import { useSaveStatus, GENERIC_ERROR_TEXT } from '@/stores/saveStatus'

// Every test in this file mounts ServiceEditorView (a large component with a
// live autosave debounce timer + Sortable instance) but historically never
// unmounted the wrapper. Left un-unmounted, a test that mutates localService
// without waiting out the 800ms autosave debounce leaves a REAL timer running
// in the background — which can fire during a LATER test's own wait window
// and pollute the shared `mockUpdateService` spy's call count (Phase 24-06
// discovery: this blocked the new backfill tests' own call-count assertions,
// Rule 3). `enableAutoUnmount` runs `wrapper.unmount()` after every test,
// which triggers ServiceEditorView's existing `onUnmounted` cleanup
// (clearTimeout(autosaveTimer), sortableInstance?.destroy()).
enableAutoUnmount(afterEach)

// ── Mocks ─────────────────────────────────────────────────────────────────────

// Reactive (not a fresh plain object per call) so a test can simulate a route
// param change without remounting the component — the 32-05 E2 loading
// backstop drives serviceId's own computed off route.params.id, which only
// stays reactive if the mocked route itself is a Vue reactive object.
const mockRoute = reactive({ params: { id: 'service-1' } })
// 95-06 (R261/R275): stabilize useRouter().push into a SINGLE shared spy (hoisted
// so the vi.mock factory below can reference it) so the Run-button describe block
// can assert the /run navigation. Additive + low-risk: no pre-existing test in
// this file reads router.push, and the block resets it in its own beforeEach.
const { mockRouterPush } = vi.hoisted(() => ({ mockRouterPush: vi.fn() }))
vi.mock('vue-router', () => ({
  useRoute: () => mockRoute,
  useRouter: () => ({ push: mockRouterPush }),
  RouterLink: { template: '<a><slot /></a>' },
}))

// 61-04 (R144): hoisted spies for the lock hook's Firestore + callable seams.
// vi.hoisted guarantees these are initialized before any vi.mock factory that
// references them runs, regardless of module-load order.
const {
  mockGetDoc,
  mockSetDoc,
  mockHttpsCallable,
  mockQueueCallable,
  mockResolveRecipients,
} = vi.hoisted(() => {
  const mockQueueCallable = vi.fn<(...a: unknown[]) => Promise<{ data: { messageId: string } }>>(
    () => Promise.resolve({ data: { messageId: 'msg-1' } }),
  )
  return {
    // Default: a FIRST lock (no prior snapshot). `data` is optional and the
    // legacy `.data().orgIds` shape is preserved so any pre-existing getDoc
    // consumer stays happy; `exists` is a plain boolean so per-test overrides
    // (`() => true` for a re-lock) type-check.
    mockGetDoc: vi.fn<
      (...a: unknown[]) => Promise<{ exists: () => boolean; data?: () => Record<string, unknown> }>
    >(() => Promise.resolve({ exists: () => false, data: () => ({ orgIds: ['org-1'] }) })),
    mockSetDoc: vi.fn<(...a: unknown[]) => Promise<void>>(() => Promise.resolve()),
    mockQueueCallable,
    mockHttpsCallable: vi.fn<(...a: unknown[]) => typeof mockQueueCallable>(() => mockQueueCallable),
    mockResolveRecipients: vi.fn<
      (...a: unknown[]) => {
        reachable: Array<{ id: string; name: string; email: string }>
        unreachableCount: number
      }
    >(() => ({ reachable: [], unreachableCount: 0 })),
  }
})

vi.mock('@/firebase', () => ({
  auth: {},
  db: {},
  functions: {},
}))

// 61-04: the lock hook enqueues via httpsCallable(functions, 'queueServiceMessage').
vi.mock('firebase/functions', () => ({
  httpsCallable: (...a: unknown[]) => mockHttpsCallable(...a),
}))

// 61-04: the hook resolves the assigned recipients client-side to get N. Mock
// the whole module (also re-export MESSAGING_TEAM_LABELS, which MessageComposer
// imports at module scope) so the reachable count is controllable per-test.
vi.mock('@/utils/messagingRecipients', () => ({
  resolveRecipients: (...a: unknown[]) => mockResolveRecipients(...a),
  MESSAGING_TEAM_LABELS: { band: 'Band', tech: 'Tech', vocals: 'Vocals', other: 'Other' },
}))

vi.mock('firebase/firestore', () => ({
  getFirestore: vi.fn(),
  collection: vi.fn(),
  doc: vi.fn(() => ({})),
  onSnapshot: vi.fn(),
  getDoc: mockGetDoc,
  setDoc: mockSetDoc,
  updateDoc: vi.fn(),
  serverTimestamp: vi.fn(() => ({})),
  // useSlideshowAssembly's default lyrics loader (20-04) issues a one-shot
  // getDocs query — stub the whole chain so it resolves to "no lyrics doc"
  // rather than throwing on undefined firestore query builders.
  query: vi.fn(),
  orderBy: vi.fn(),
  limit: vi.fn(),
  getDocs: vi.fn(() => Promise.resolve({ empty: true, docs: [] })),
}))

// ── Phase 29-01: multi-instance Sortable capture harness (R044) ────────────────
// This file mounts the REAL SortableJS library today — no mock existed here
// before this phase. `Sortable.create()` only wires native drag listeners (no
// test above triggers a real browser drag), so replacing it with a capturing
// mock is behavior-neutral for every describe block preceding this one.
// `sortableCaptures` records EVERY `Sortable.create` call with its container
// element and options, so a test can invoke `onEnd` directly against the exact
// options the mounted component registered — generalizes the single-capture
// pattern already used in SlideGrid.test.ts to the multi-instance shape 29-03
// introduces (one Sortable instance per section container).
interface SortableCapture {
  el: HTMLElement
  options: SortableOptions
}
let sortableCaptures: SortableCapture[] = []
const mockSlotSortableDestroy = vi.fn()
vi.mock('sortablejs', () => ({
  default: {
    create: vi.fn((el: HTMLElement, options: SortableOptions) => {
      sortableCaptures.push({ el, options })
      return { destroy: mockSlotSortableDestroy }
    }),
  },
}))

function resetSortableCaptures(): void {
  sortableCaptures = []
  mockSlotSortableDestroy.mockClear()
}

/** Resolves the capture whose container carries `data-section="{section}"` —
 *  only resolves once 29-03 splits the flat slot list into per-section
 *  containers. Resolves to `undefined` against today's flat render. */
function captureForSection(section: string): SortableCapture | undefined {
  return sortableCaptures.find((c) => c.el.dataset.section === section)
}

/** Resolves the single capture with NO `data-section` attribute — today's flat
 *  container. Stops resolving once every container carries a section (29-03). */
function flatCapture(): SortableCapture | undefined {
  return sortableCaptures.find((c) => c.el.dataset.section === undefined)
}

// ── 260811-vsr: per-row ⋯ menu drivers ─────────────────────────────────────────
// The per-row three-dot menu replaced the inline section <select> and the inline ✕.
// These helpers drive it by the slot's ARRAY index (its data-testid="slot-{index}",
// which renders in section-major array order). openRowMenu returns the slot id.
async function openRowMenu(wrapper: VueWrapper, index: number): Promise<string> {
  const row = wrapper.find(`[data-testid="slot-${index}"]`)
  const slotId = row.attributes('data-slot-id')!
  await row.find(`[data-testid="row-menu-trigger-${slotId}"]`).trigger('click')
  await wrapper.vm.$nextTick()
  return slotId
}

/** Open a row's ⋯ menu and click a Move-to-section item. `value` is a ServiceSection
 *  key, or '' for "No section" (maps to the `no-section` testid suffix). */
async function moveSlotViaRowMenu(wrapper: VueWrapper, index: number, value: string): Promise<void> {
  const slotId = await openRowMenu(wrapper, index)
  const suffix = value === '' ? 'no-section' : value
  await wrapper.find(`[data-testid="row-menu-move-${slotId}-${suffix}"]`).trigger('click')
  await wrapper.vm.$nextTick()
}

/** Open a row's ⋯ menu and click its Delete item (opens the D-14 confirm dialog). */
async function deleteSlotViaRowMenu(wrapper: VueWrapper, index: number): Promise<void> {
  const slotId = await openRowMenu(wrapper, index)
  await wrapper.find(`[data-testid="row-menu-delete-${slotId}"]`).trigger('click')
  await wrapper.vm.$nextTick()
}

// The reported ZTXcpNRcJTalEQp42fTx shape: 8 slots, section-major, across the
// four ORIGINAL sections — deliberately no 'post-service' slot, so this fixture
// pins the reorder-repro tests to the pre-29-05 four-section shape while the
// Post-Service section itself (always rendered, empty here) is covered by its
// own tests below.
//   s1 SONG pre-service · s2 SONG worship · s3 SONG worship · s4 SCRIPTURE worship
//   s5 MESSAGE message · s6 PRAYER message · s7 SONG sending · s8 PRAYER sending
function makeSectionedService(): Service {
  return {
    ...mockService,
    slots: [
      { kind: 'SONG', id: 's1', position: 0, requiredVwType: 1, songId: null, songTitle: null, songKey: null, section: 'pre-service' },
      { kind: 'SONG', id: 's2', position: 1, requiredVwType: 2, songId: null, songTitle: null, songKey: null, section: 'worship' },
      { kind: 'SONG', id: 's3', position: 2, requiredVwType: 2, songId: null, songTitle: null, songKey: null, section: 'worship' },
      { kind: 'SCRIPTURE', id: 's4', position: 3, book: null, chapter: null, verseStart: null, verseEnd: null, section: 'worship' },
      { kind: 'MESSAGE', id: 's5', position: 4, section: 'message' },
      { kind: 'PRAYER', id: 's6', position: 5, section: 'message' },
      { kind: 'SONG', id: 's7', position: 6, requiredVwType: 3, songId: null, songTitle: null, songKey: null, section: 'sending' },
      { kind: 'PRAYER', id: 's8', position: 7, section: 'sending' },
    ],
  }
}

// useSlideshowAssembly (20-04) reads scripture readings from this store — mirrors
// the reactive-stub mocking pattern used by ScriptureSlideEditor.test.ts.
vi.mock('@/stores/scriptureSlides', () => ({
  useScriptureSlides: () => ({
    readings: [],
    isLoading: false,
    subscribeReadings: vi.fn(),
    unsubscribeReadings: vi.fn(),
  }),
}))

// useSlideshowAssembly (21-01) also reads imported decks from this store —
// unmocked, useImportedSlides() calls getActivePinia() against a Pinia
// instance this test never installs, crashing ServiceEditorView's setup().
// Same reactive-stub pattern as the scriptureSlides mock above.
vi.mock('@/stores/importedSlides', () => ({
  useImportedSlides: () => ({
    decks: [],
    isLoading: false,
    subscribeDecks: vi.fn(),
    unsubscribeDecks: vi.fn(),
  }),
}))

// useSlideshowAssembly (24-04) also reads groupsBySlotId from this store, and
// ServiceEditorView itself (24-06) calls deleteGroup/setGroupBedMedia
// directly — unmocked, useSlideGroups() calls getActivePinia() against a
// Pinia instance this test never installs. Stateful (not a static stub) so
// the Phase 24-06 delete-cascade and media-retarget tests can control which
// groups exist and inspect what was written — mirrors the reactive-stub
// pattern in src/composables/__tests__/useSlideshowAssembly.test.ts.
const mockSlideGroupsState = reactive<{ groups: SlideGroup[] }>({ groups: [] })
const mockSubscribeGroups = vi.fn()
const mockUnsubscribeGroups = vi.fn()
const mockMaterializeGroupIfMissing = vi.fn((_orgId: string, _input: unknown) => Promise.resolve(true))
const mockDeleteGroup = vi.fn((_orgId: string, _slotId: string) => Promise.resolve())
const mockSetGroupBedMedia = vi.fn((_orgId: string, _slotId: string, _patch: unknown) => Promise.resolve())
const mockReplaceGroupSlides = vi.fn((_orgId: string, _slotId: string, _slides: unknown, _sig?: string) => Promise.resolve())

vi.mock('@/stores/slideGroups', () => ({
  useSlideGroups: () => ({
    groups: mockSlideGroupsState.groups,
    isLoading: false,
    get groupsBySlotId() {
      const map = new Map<string, SlideGroup>()
      for (const group of mockSlideGroupsState.groups) map.set(group.slotId, group)
      return map
    },
    subscribeGroups: mockSubscribeGroups,
    unsubscribeGroups: mockUnsubscribeGroups,
    materializeGroupIfMissing: mockMaterializeGroupIfMissing,
    deleteGroup: mockDeleteGroup,
    setGroupBedMedia: mockSetGroupBedMedia,
    replaceGroupSlides: mockReplaceGroupSlides,
  }),
}))

/**
 * Walks an element's ancestor chain checking for an inline `display: none`
 * (how `v-show` toggles visibility) — VTU's own `isVisible()` does not
 * reliably reflect an ancestor's inline style in this jsdom environment, so
 * the Slides-tab panel-visibility tests (Phase 25-03) check directly.
 */
function isVShowHidden(wrapper: { element: Element }): boolean {
  let el: HTMLElement | null = wrapper.element as HTMLElement
  while (el) {
    if (el.style?.display === 'none') return true
    el = el.parentElement
  }
  return false
}

const mockTimestamp = { toDate: () => new Date('2026-03-08') } as unknown as Timestamp

const mockService: Service = {
  id: 'service-1',
  date: '2026-03-08',
  name: '',
  progression: '1-2-2-3',
  teams: ['Choir'],
  status: 'draft',
  slots: [
    { kind: 'SONG', id: 'slot-0', position: 0, requiredVwType: 1, songId: 'song-1', songTitle: 'Amazing Grace', songKey: 'G' },
    { kind: 'SCRIPTURE', id: 'slot-1', position: 1, book: 'Psalms', chapter: 23, verseStart: 1, verseEnd: 6 },
    { kind: 'SONG', id: 'slot-2', position: 2, requiredVwType: 2, songId: null, songTitle: null, songKey: null },
    { kind: 'PRAYER', id: 'slot-3', position: 3 },
    { kind: 'SCRIPTURE', id: 'slot-4', position: 4, book: null, chapter: null, verseStart: null, verseEnd: null },
    { kind: 'SONG', id: 'slot-5', position: 5, requiredVwType: 2, songId: null, songTitle: null, songKey: null },
    { kind: 'SONG', id: 'slot-6', position: 6, requiredVwType: 3, songId: null, songTitle: null, songKey: null },
    { kind: 'MESSAGE', id: 'slot-7', position: 7 },
    { kind: 'SONG', id: 'slot-8', position: 8, requiredVwType: 3, songId: null, songTitle: null, songKey: null },
  ],
  sermonPassage: { book: 'Romans', chapter: 8, verseStart: 1, verseEnd: 11 },
  notes: '',
  createdAt: mockTimestamp,
  updatedAt: mockTimestamp,
}

// Mutable per-test services list (20-04 section/preview tests swap in a sectioned
// fixture) — mirrors the mockQuarters/mockRosterOrgId pattern below: read fresh by
// useServiceStore() on every mount, so a test can reassign it before mountView().
let mockServicesList: Service[] = [mockService]

// R039 (32-01): which service ids the store currently classifies as "this
// client's own write settling" — read live (arrow function, same lazy-read
// convention as `services: mockServicesList` above) by the `isOwnWriteEcho`
// member the mock exposes below. This is the interface Task 2's real
// `src/stores/services.ts` classifier and Task 3's view guard must satisfy.
let mockOwnWriteEchoIds: string[] = []

const mockSongs: Song[] = [
  {
    id: 'song-1',
    title: 'Amazing Grace',
    ccliNumber: '22025',
    author: 'John Newton',
    themes: [],
    notes: '',
    tags: [],
    removedThemes: [],
    vwTypes: [1],
    arrangements: [
      {
        id: 'arr-1a',
        name: 'Standard',
        key: 'G',
        bpm: 84,
        lengthSeconds: null,
        chordChartUrl: '',
        notes: '',
        teamTags: [],
      },
    ],
    primaryArrangementId: null,
    lastUsedAt: null,
    hidden: false,
    pcSongId: null,
    createdAt: mockTimestamp,
    updatedAt: mockTimestamp,
  },
]

const mockSetRoleOverride = vi.fn(
  (_serviceId: string, _roleId: string, _personIds: string[]) => Promise.resolve(),
)
const mockClearRoleOverride = vi.fn(() => Promise.resolve())
// 58-05 (R132): scoped dot-path override write for the per-service Messaging
// defaults panel. Hoisted so the panel tests can inspect the exact patch the
// three inherit-or-override selects push, and make it reject to prove the
// inline "Failed to save" surface.
const mockSetServiceMessagingDefaults = vi.fn(
  (_serviceId: string, _patch: unknown) => Promise.resolve(),
)
// Hoisted (not created fresh per useServiceStore() call) so the Phase 24-06
// backfill tests below can inspect what the autosave path actually persisted.
const mockUpdateService = vi.fn((_id: string, _data: unknown) => Promise.resolve())
// R037 (31-03): the two named status transitions that replaced toggleStatus.
// Hoisted so the lifecycle tests can assert what the view asked the store to do
// AND make either transition reject, which is how the no-optimistic-flip
// contract is proved.
const mockMarkAsPlanned = vi.fn<(id: string) => Promise<void>>(() => Promise.resolve())
const mockReopenService = vi.fn<(id: string) => Promise<void>>(() => Promise.resolve())
// 61-04: the lock hook writes lockSnapshots/current using buildServiceSnapshot,
// which the component imports from the (fully mocked) '@/stores/services'. A
// lightweight stub is enough — the tests assert only that a snapshot object was
// written, not its full shape (the real builder needs live Pinia stores).
const mockBuildServiceSnapshot = vi.fn((svc: Service) => ({
  name: svc.name,
  status: svc.status,
  slots: svc.slots,
}))
const mockAssignSongToSlot = vi.fn<
  (id: string, index: number, song: { id: string; title: string; key: string }) => Promise<void>
>(() => Promise.resolve())
// WR-01 (80-REVIEW): hoisted so the delete-error-surfacing regression test
// can make it reject and assert onDelete's new catch branch renders the
// error and leaves the confirm dialog open, instead of silently closing it.
const mockDeleteService = vi.fn<(id: string) => Promise<void>>(() => Promise.resolve())

// WR-01 (48-REVIEW): mutable so the Share in-flight regression test can give
// the store a real orgId (the module default below stays `null`, preserving
// every pre-existing test's behavior — none of them reach the `orgId`-gated
// `onShare` guard). `mockCreateShareToken` is likewise controllable per-test
// so the regression test can hold its promise pending to simulate an
// in-flight request.
let mockServiceStoreOrgId: string | null = null
const mockCreateShareToken = vi.fn(
  (_service: Service, _orgId: string) => Promise.resolve('mock-share-token'),
)

// BL-02: the view branches on `err instanceof ServiceLockedError` to tell a
// refusal it can never retry (the service is locked) from a transport blip it
// can. Because this whole module is mocked, the mock must export a REAL class
// or that `instanceof` is unsatisfiable and the branch is untestable. Shape
// mirrors `src/stores/services.ts:52-65` exactly.
class ServiceLockedErrorStub extends Error {
  readonly serviceId: string
  readonly storedStatus: string

  constructor(serviceId: string, storedStatus: string, action = 'update') {
    super(
      `R036: refusing to ${action} service ${serviceId} — its stored status is ` +
        `"${storedStatus}", not "draft". Reopen it for editing first.`,
    )
    this.name = 'ServiceLockedError'
    this.serviceId = serviceId
    this.storedStatus = storedStatus
  }
}

vi.mock('@/stores/services', () => ({
  ServiceLockedError: ServiceLockedErrorStub,
  buildServiceSnapshot: mockBuildServiceSnapshot,
  useServiceStore: () => ({
    services: mockServicesList,
    isLoading: false,
    orgId: mockServiceStoreOrgId,
    subscribe: vi.fn(),
    updateService: mockUpdateService,
    markAsPlanned: mockMarkAsPlanned,
    reopenService: mockReopenService,
    assignSongToSlot: mockAssignSongToSlot,
    deleteService: mockDeleteService,
    clearSongFromSlot: vi.fn(() => Promise.resolve()),
    setRoleOverride: mockSetRoleOverride,
    clearRoleOverride: mockClearRoleOverride,
    setServiceMessagingDefaults: mockSetServiceMessagingDefaults,
    createShareToken: mockCreateShareToken,
    // R039 (32-01): arrow function evaluated lazily at call time — same reason
    // `services: mockServicesList` above stays live across a test's mutation
    // of `mockOwnWriteEchoIds` rather than snapshotting it at mock-creation time.
    isOwnWriteEcho: (id: string) => mockOwnWriteEchoIds.includes(id),
  }),
}))

// ME-02: the `lastUsedAt` bump now writes the SONG documents directly instead
// of round-tripping through `assignSongToSlot` (which rewrote the whole service
// `slots` array from the store snapshot).
const mockUpdateSong = vi.fn((_id: string, _data: unknown) => Promise.resolve())

vi.mock('@/stores/songs', () => ({
  useSongStore: () => ({
    songs: mockSongs,
    // Phase 79 (R230): suggestAllSongs()/fetchAiForSlot() read this computed
    // (mirrors the real store's `songs.filter(s => s.hidden !== true)`) to
    // build the AI candidate pool before the song-tag filter helper narrows it.
    get aiCandidateSongs() {
      return mockSongs.filter((s) => s.hidden !== true)
    },
    orgId: null,
    subscribe: vi.fn(),
    updateSong: mockUpdateSong,
  }),
}))

// Phase 79 (R230/R241): suggestAllSongs()/fetchAiForSlot() call the real
// getSongSuggestions() through the union-of-team-tags filter helper. Mocked
// so no real Anthropic/network call happens; the "song-tag filter" describe
// block below asserts against the `songLibrary` this spy was called with.
// getScriptureSuggestions/splitCongregationalReading are stubbed too (safe
// no-op defaults) so any OTHER real child component sharing this module
// (ScriptureInput, CongregationalEditor) keeps its existing never-called
// contract intact — this file never un-stubs ScriptureInput and never
// exercises CongregationalEditor's Split action.
const { mockGetSongSuggestions } = vi.hoisted(() => ({
  mockGetSongSuggestions: vi.fn<
    (params: unknown) => Promise<{ songId: string; reason: string }[] | null>
  >(() => Promise.resolve(null)),
}))

vi.mock('@/utils/claudeApi', () => ({
  getSongSuggestions: mockGetSongSuggestions,
  getScriptureSuggestions: vi.fn(() => Promise.resolve(null)),
  splitCongregationalReading: vi.fn(() => Promise.resolve(null)),
}))

// ── Roles tab (Phase 17-04) — mutable per-test mocks ────────────────────────────
// `mockAuthState` is a Vue `reactive()` object (not a plain module-level `let`),
// so `watch(() => authStore.isEditor, ...)` inside the component can actually
// observe a post-mount transition — mirrors how the real Pinia store is
// reactive. Tests that need to flip isEditor after mount (WR-01 regression)
// mutate `mockAuthState.isEditor` directly and await a tick.
const mockAuthState = reactive<{
  user: { uid: string }
  isEditor: boolean
  orgId: string | null
  hasPcCredentials: boolean
  pcCredentials: { appId: string; secret: string } | null
  // 39-04: CongregationalEditor.vue (mounted as a child via the
  // Congregational Reading modal) now reads authStore.settings.aiEnabled
  // directly — without this, accessing `.aiEnabled` on an undefined
  // `settings` throws at mount. Defaults to true so every pre-existing
  // test in this file keeps its current behavior.
  // quick/260809-vvq: onConfirmExport now threads authStore.settings.bibleVersion
  // into every addSlotAsItem call, so the mock settings must carry it too.
  // 58-05 (R132): the Messaging defaults panel reads authStore.settings.messaging.*
  // for each select's "Default (Settings: …)" label and the read-only summary's
  // resolved value — without it, accessing `.lockNotifyDefault` on an undefined
  // `messaging` throws at mount. Conservative org defaults (off) match
  // DEFAULT_ORG_SETTINGS from 58-01.
  settings: {
    aiEnabled: boolean
    pcEnabled: boolean
    vwModeEnabled: boolean
    bibleVersion: 'ESV' | 'NLT'
    messaging: {
      enabled: boolean
      lockNotifyDefault: boolean
      reminderEnabled: boolean
      reminderDaysBefore: number
    }
  }
  // WR-02 (82-REVIEW): activeActionItems now threads authStore.isAiEnabled
  // (the two-gate master-AND-settings check) into buildActionBarItems,
  // instead of the bare settings.aiEnabled. Defaults to true so every
  // pre-existing test in this file keeps its current behavior -- no test
  // in this file toggles the AI action-bar item today.
  isAiEnabled: boolean
}>({
  user: { uid: 'user-1' },
  isEditor: false,
  orgId: 'org-1',
  // ME-01: default false/null, so every pre-existing test keeps taking the
  // "Copy for PC" branch it always took. Only the export tests flip these.
  hasPcCredentials: false,
  pcCredentials: null,
  settings: {
    aiEnabled: true,
    pcEnabled: true,
    vwModeEnabled: true,
    bibleVersion: 'NLT',
    messaging: {
      enabled: false,
      lockNotifyDefault: false,
      reminderEnabled: false,
      reminderDaysBefore: 3,
    },
  },
  isAiEnabled: true,
})

vi.mock('@/stores/auth', () => ({
  useAuthStore: () => mockAuthState,
}))

// ── ME-01: Planning Center API surface ────────────────────────────────────────
// Only `onExportToPC`/`onConfirmExport` reach these, and no test before the
// ME-01 block below invokes either — so stubbing the module is behaviour-neutral
// for everything above it. The `Copy for PC` path (`formatForPlanningCenter`)
// was removed entirely per owner feedback; only the real `Export to PC` path
// (`planningCenterApi.ts`) remains, and it is what this mock stands in for.
const mockCreatePlan = vi.fn(async () => 'pc-plan-new')
const mockAddSlotAsItem = vi.fn(async () => undefined)
const mockFetchPlanItems = vi.fn(async () => [])
const mockFetchTemplateItems = vi.fn(async () => [])

vi.mock('@/utils/planningCenterApi', () => ({
  fetchServiceTypes: vi.fn(async () => []),
  fetchTemplates: vi.fn(async () => []),
  fetchServiceTypeTeams: vi.fn(async () => []),
  fetchPlans: vi.fn(async () => []),
  fetchPlanItems: mockFetchPlanItems,
  createPlan: mockCreatePlan,
  fetchTemplateItems: mockFetchTemplateItems,
  addSlotAsItem: mockAddSlotAsItem,
  buildPlanTitle: vi.fn(() => 'Sunday Service'),
  createItem: vi.fn(async () => undefined),
  updateItem: vi.fn(async () => undefined),
  deleteItem: vi.fn(async () => undefined),
  createPlanTime: vi.fn(async () => undefined),
  fetchPlanNeededPositionTeamIds: vi.fn(async () => new Set<string>()),
  fetchTeamPositions: vi.fn(async () => []),
  addNeededPosition: vi.fn(async () => undefined),
}))

const mockRoles: Role[] = [
  { id: 'role-vox', name: 'Vocals', group: 'band', multiRole: true, defaultCount: 1, order: 0 },
  { id: 'role-drums', name: 'Drums', group: 'band', defaultCount: 1, order: 1 },
]

const mockRosterPeople: Person[] = [
  {
    id: 'person-1',
    name: 'Alice',
    email: 'alice@example.com',
    phone: '',
    active: true,
    roles: ['role-vox'],
    pcPersonId: null,
    createdAt: mockTimestamp,
    updatedAt: mockTimestamp,
  },
  {
    id: 'person-2',
    name: 'Bob',
    email: 'bob@example.com',
    phone: '',
    active: true,
    roles: ['role-drums'],
    pcPersonId: null,
    createdAt: mockTimestamp,
    updatedAt: mockTimestamp,
  },
  {
    id: 'person-3',
    name: 'Carol',
    email: 'carol@example.com',
    phone: '',
    active: true,
    // Second role-vox-eligible candidate — needed by the WR-02 rapid-toggle
    // regression test (two different people toggled for the same role).
    roles: ['role-vox'],
    pcPersonId: null,
    createdAt: mockTimestamp,
    updatedAt: mockTimestamp,
  },
]

let mockQuarters: Quarter[] = []
let mockRosterOrgId: string | null = null
let mockQuartersOrgId: string | null = null

// Shared spies (not recreated per useRosterStore()/useQuartersStore() call) so
// the WR-01 regression test can assert initStores() re-subscribes once
// authStore.isEditor flips true after mount.
const mockRosterSubscribe = vi.fn()
const mockQuartersSubscribe = vi.fn()

vi.mock('@/stores/roster', () => ({
  useRosterStore: () => ({
    people: mockRosterPeople,
    roles: mockRoles,
    activePeople: mockRosterPeople.filter((p) => p.active),
    orgId: mockRosterOrgId,
    subscribe: mockRosterSubscribe,
  }),
}))

vi.mock('@/stores/quarters', () => ({
  useQuartersStore: () => ({
    quarters: mockQuarters,
    orgId: mockQuartersOrgId,
    subscribe: mockQuartersSubscribe,
  }),
}))

// Phase 79 (R229/R241/RESEARCH Pitfall 6): the team checkbox row now reads the
// shared teams store instead of a hard-coded array. Seeded with the same 4
// default team names the old hard-coded team-list constant carried, so the
// existing "Orchestra" checkbox-label test below keeps finding it. (The former
// per-team `songFilterTag` AI-suggestion filter was removed 2026-08-25, so team
// selection no longer narrows the AI candidate pool at all.)
let mockTeams: { id: string; name: string; order: number }[] = [
  { id: 'team-choir', name: 'Choir', order: 0 },
  { id: 'team-orchestra', name: 'Orchestra', order: 1 },
  { id: 'team-communion', name: 'Communion', order: 2 },
  { id: 'team-special', name: 'Special', order: 3 },
]
let mockTeamsOrgId: string | null = null
const mockTeamsSubscribe = vi.fn()
const mockSeedDefaultTeamsIfEmpty = vi.fn()

vi.mock('@/stores/teams', () => ({
  useTeamsStore: () => ({
    teams: mockTeams,
    orgId: mockTeamsOrgId,
    subscribe: mockTeamsSubscribe,
    seedDefaultTeamsIfEmpty: mockSeedDefaultTeamsIfEmpty,
  }),
}))

// 60-03: the delivery-history panel subscribes this store on the Service Order
// tab. Stub it like the other store mocks so no real onSnapshot/getDocs runs.
const mockSubscribeServiceMessages = vi.fn()
const mockUnsubscribeServiceMessages = vi.fn()
vi.mock('@/stores/serviceMessages', () => ({
  useServiceMessagesStore: () => ({
    messages: [],
    isLoading: false,
    subscribeServiceMessages: mockSubscribeServiceMessages,
    unsubscribeServiceMessages: mockUnsubscribeServiceMessages,
    fetchBouncedRecipients: vi.fn(() => Promise.resolve([])),
  }),
}))

// 32-05: a fresh, real Pinia before every test — new-precedent hazard, since
// no component test in this file previously installed one (every store below
// is vi.mock-ed). ServiceEditorView now consumes useSaveStatus directly, so a
// mount with no active Pinia throws "no active Pinia" at setup(). The route
// mock is also reset here so a test that drives the E2 loading backstop
// (mutating mockRoute.params.id mid-test) never leaks into a later test.
beforeEach(() => {
  setActivePinia(createPinia())
  mockRoute.params.id = 'service-1'
  // WR-01 (48-REVIEW): reset to the pre-existing default (`orgId: null`) and
  // clear call history so the Share in-flight regression test's setup never
  // leaks into an unrelated later test.
  mockServiceStoreOrgId = null
  mockCreateShareToken.mockClear()
  mockCreateShareToken.mockImplementation(() => Promise.resolve('mock-share-token'))
  // Phase 79: reset the teams mock to its default 4-team seed so a test
  // mutating it never leaks into an unrelated later test.
  mockTeams = [
    { id: 'team-choir', name: 'Choir', order: 0 },
    { id: 'team-orchestra', name: 'Orchestra', order: 1 },
    { id: 'team-communion', name: 'Communion', order: 2 },
    { id: 'team-special', name: 'Special', order: 3 },
  ]
  mockTeamsOrgId = null
  mockTeamsSubscribe.mockClear()
  mockSeedDefaultTeamsIfEmpty.mockClear()
  mockGetSongSuggestions.mockClear()
  mockGetSongSuggestions.mockImplementation(() => Promise.resolve(null))
  // WR-01 (80-REVIEW): reset to the pre-existing default (resolves) so a
  // test that makes it reject never leaks into a later, unrelated test.
  mockDeleteService.mockClear()
  mockDeleteService.mockImplementation(() => Promise.resolve())
})

/** Reads the real useSaveStatus store's entry for `service:{id}` — the
 *  post-migration equivalent of the deleted `vm.autosaveStatus` ref. Reads
 *  the CURRENTLY active Pinia (set fresh in the beforeEach above), so this
 *  only resolves correctly when called after a mountView() in the same test. */
function saveStatusEntry(id = 'service-1') {
  return useSaveStatus().entryFor(`service:${id}`)
}

// Reset the stateful slideGroups mock before every test so a test that
// populates `mockSlideGroupsState.groups` never leaks into a later one that
// assumes the default empty-groups state.
beforeEach(() => {
  mockSlideGroupsState.groups = []
  mockSubscribeGroups.mockClear()
  mockUnsubscribeGroups.mockClear()
  mockMaterializeGroupIfMissing.mockClear()
  mockDeleteGroup.mockClear()
  mockSetGroupBedMedia.mockClear()
  mockReplaceGroupSlides.mockClear()
})

// Warm the SFC transform + template compile once before any test. The first
// mount of this large (2200+ line) component can, on a loaded machine, exceed
// vitest's default 5s per-test timeout — which would flake whichever test
// happens to mount first. Paying that one-time cold cost here (with a generous
// timeout) keeps every individual test's timer measuring only a warm mount.
beforeAll(async () => {
  // 32-05: this runs before the first per-test beforeEach, so it needs its
  // own active Pinia — same "no active Pinia" reasoning as above.
  setActivePinia(createPinia())
  const { default: ServiceEditorView } = await import('@/views/ServiceEditorView.vue')
  shallowMount(ServiceEditorView, {
    global: {
      stubs: {
        AppShell: { template: '<div><slot /></div>' },
        RouterLink: { template: '<a><slot /></a>' },
        ServicePrintLayout: true,
        SongBadge: true,
        SongSlotPicker: true,
        ScriptureInput: true,
      },
    },
  }).unmount()
}, 30000)

// ── Tests ─────────────────────────────────────────────────────────────────────

// Copy for PC was deleted entirely per direct owner feedback on the running
// app ("let's get rid of the Copy for PC button all together, it's not
// useful at all") — this describe block's two Copy-for-PC tests (clicking
// showed "Copied!", clicking called navigator.clipboard.writeText) asserted
// behavior the owner has now removed, so they are deleted rather than
// updated. Print is unaffected and its coverage stays as-is.
describe('ServiceEditorView - Print button', () => {
  beforeEach(() => {
    vi.spyOn(window, 'print').mockImplementation(() => {})
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: vi.fn(() => Promise.resolve()),
      },
      writable: true,
      configurable: true,
    })
  })

  async function mountView() {
    const { default: ServiceEditorView } = await import('@/views/ServiceEditorView.vue')
    return shallowMount(ServiceEditorView, {
      global: {
        stubs: {
          AppShell: { template: '<div><slot /></div>' },
          // 36-03: Suggest/Export/Copy/Save/Present all moved into this real
          // child component (ContextualActionBar.vue) — every mountView in
          // this file must render it for real (`false` opts a component OUT
          // of shallowMount's default auto-stub) or none of those controls'
          // pre-existing testids/text are reachable in the DOM anymore.
          ContextualActionBar: false,
          RouterLink: { template: '<a><slot /></a>' },
          // 32-05: render the real SaveStatusIndicator (not a shallow stub)
          // so its data-testid="save-status"/"save-status-error" handles are
          // reachable from these tests.
          SaveStatusIndicator: false,
          ServicePrintLayout: true,
          SongBadge: true,
          SongSlotPicker: true,
          ScriptureInput: true,
        },
      },
    })
  }

  it('Print button exists and clicking it calls window.print() once', async () => {
    const wrapper = await mountView()
    const printBtn = wrapper.find('[data-testid="print-btn"]')
    expect(printBtn.exists()).toBe(true)
    await printBtn.trigger('click')
    expect(window.print).toHaveBeenCalledTimes(1)
  })

  // Owner follow-up: Copy for PC no longer renders at all, with no
  // replacement affordance — the default (no-credentials) mock state this
  // block mounts with used to render it.
  it('Copy for PC no longer renders — deleted per owner feedback, no replacement affordance', async () => {
    const wrapper = await mountView()
    expect(wrapper.find('[data-testid="copy-pc-btn"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="export-pc-btn"]').exists()).toBe(false)
  })
})

// Regression guard for the 2026-08-25 removal of the per-team song-tag filter:
// selecting teams on a service must NOT narrow the AI candidate pool. The
// `songLibrary` argument the mocked getSongSuggestions() receives should carry
// the full candidate set regardless of which teams are selected.
describe('ServiceEditorView - team selection does not narrow the AI pool', () => {
  async function mountView() {
    const { default: ServiceEditorView } = await import('@/views/ServiceEditorView.vue')
    return shallowMount(ServiceEditorView, {
      global: {
        stubs: {
          AppShell: { template: '<div><slot /></div>' },
          ContextualActionBar: true,
          RouterLink: { template: '<a><slot /></a>' },
          ServicePrintLayout: true,
          SongBadge: true,
          SongSlotPicker: true,
          ScriptureInput: true,
        },
      },
    })
  }

  // Three fixture songs with distinct tag signatures, added to the shared
  // `mockSongs` array only for the lifetime of this describe block (pushed in
  // beforeEach, spliced back out in afterEach) so no other test sees a changed
  // song count.
  const songOrchestra: Song = { ...mockSongs[0]!, id: 'song-orchestra', title: 'Orchestra Song', tags: ['Orchestra'] }
  const songChoir: Song = { ...mockSongs[0]!, id: 'song-choir', title: 'Choir Song', tags: ['ChoirTag'] }
  const songUntagged: Song = { ...mockSongs[0]!, id: 'song-untagged', title: 'Untagged Song', tags: [] }

  // A single-SONG-slot service fixture — fetchAiForSlot(0) then fires exactly
  // one getSongSuggestions() call, keeping the assertion a single-call check.
  function singleSlotService(teams: string[]): Service {
    return {
      ...mockService,
      teams,
      slots: [
        { kind: 'SONG', id: 'slot-only', position: 0, requiredVwType: 1, songId: null, songTitle: null, songKey: null },
      ],
    }
  }

  beforeEach(() => {
    mockAuthState.isEditor = true
    mockSongs.push(songOrchestra, songChoir, songUntagged)
  })

  afterEach(() => {
    mockSongs.splice(mockSongs.indexOf(songOrchestra), 1)
    mockSongs.splice(mockSongs.indexOf(songChoir), 1)
    mockSongs.splice(mockSongs.indexOf(songUntagged), 1)
  })

  /** Reads the `songLibrary` id list from the mock's most recent call. */
  function librarySongIds(): string[] {
    const calls = mockGetSongSuggestions.mock.calls
    const call = calls[calls.length - 1]
    const params = call?.[0] as { songLibrary: { id: string }[] } | undefined
    return (params?.songLibrary ?? []).map((s) => s.id)
  }

  it('selecting teams passes the full candidate pool to getSongSuggestions (no tag narrowing)', async () => {
    mockServicesList = [singleSlotService(['Orchestra', 'Choir'])]
    const wrapper = await mountView()
    const vm = wrapper.vm as unknown as { fetchAiForSlot: (i: number) => Promise<void> }
    await vm.fetchAiForSlot(0)
    await flushPromises()
    expect(librarySongIds().sort()).toEqual([
      'song-1',
      'song-choir',
      'song-orchestra',
      'song-untagged',
    ])
  })
})

// WR-01 (48-REVIEW): the pre-migration bottom-row Share button was
// `:disabled="!localService || isSharing"`. That guard was dropped when Share
// moved into the top action bar's `buildShareItem` (no `disabled` at all) and
// `onShare()` had no re-entrancy check of its own — so a second click while a
// share was already in flight could fire a second concurrent
// `createShareToken` write. Both halves of the fix (the action-bar item's
// `disabled: ctx.isSharing` AND `onShare()`'s own `if (isSharing.value) return`
// guard) are covered here.
describe('ServiceEditorView - Share button in-flight guard (WR-01)', () => {
  beforeEach(() => {
    mockAuthState.isEditor = true
    mockServiceStoreOrgId = 'org-1'
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: vi.fn(() => Promise.resolve()),
      },
      writable: true,
      configurable: true,
    })
  })

  async function mountView() {
    const { default: ServiceEditorView } = await import('@/views/ServiceEditorView.vue')
    return shallowMount(ServiceEditorView, {
      global: {
        stubs: {
          AppShell: { template: '<div><slot /></div>' },
          ContextualActionBar: false,
          RouterLink: { template: '<a><slot /></a>' },
          SaveStatusIndicator: false,
          ServicePrintLayout: true,
          SongBadge: true,
          SongSlotPicker: true,
          ScriptureInput: true,
        },
      },
    })
  }

  it('a second click while a share is in flight does not issue a second createShareToken write', async () => {
    // Hold the token promise pending so the first click's request is still
    // "in flight" when the second click fires.
    let resolveToken: (token: string) => void = () => {}
    mockCreateShareToken.mockImplementation(
      () => new Promise<string>((resolve) => { resolveToken = resolve }),
    )

    const wrapper = await mountView()
    const bar = wrapper.find('[data-testid="contextual-action-bar"]')
    const shareBtn = bar.findAll('button').find((b) => b.text().startsWith('Share') || b.text() === 'Sharing...')
    expect(shareBtn).toBeDefined()

    // First click starts the in-flight share.
    await shareBtn!.trigger('click')
    expect(mockCreateShareToken).toHaveBeenCalledTimes(1)

    // Re-query: the action bar re-renders with the button now disabled and
    // labeled "Sharing...". Trigger click again on the SAME element (a stale
    // handle still fires the same @click listener bound at mount) to also
    // exercise onShare()'s own re-entrancy guard, not just Vue's native
    // disabled-button click suppression.
    await shareBtn!.trigger('click')
    expect(mockCreateShareToken).toHaveBeenCalledTimes(1)

    const sharingBtn = bar.findAll('button').find((b) => b.text() === 'Sharing...')
    expect(sharingBtn).toBeDefined()
    expect(sharingBtn!.attributes('disabled')).toBeDefined()

    // Let the in-flight request resolve and confirm the flow completes normally.
    resolveToken('mock-share-token')
    await flushPromises()
    expect(mockCreateShareToken).toHaveBeenCalledTimes(1)
  })
})

// ── 34-12 Task 3 (UAT F5): the no-credentials explanation ──────────────────────
// The owner read the credential-gated swap to Copy for PC as the Export to PC
// feature having been deleted. It wasn't — 34-12 Task 1 diagnosed the gate as
// behaving correctly. This block covers the actual fix: an editor with no
// Planning Center credentials is told so, beside the fallback, with a route to
// Settings, and the export affordance stays exactly as gated as it was.
describe('ServiceEditorView - Planning Center credentials-missing note (34-12 Task 3, R071)', () => {
  // This block's own RouterLink stub exposes the `to` prop (as a data attribute)
  // instead of discarding it, so the settings-route assertion below can check
  // it resolves by NAME rather than a hardcoded path string.
  async function mountView(overrides: Partial<Service> = {}) {
    mockServicesList = [{ ...mockService, ...overrides }]
    const { default: ServiceEditorView } = await import('@/views/ServiceEditorView.vue')
    return shallowMount(ServiceEditorView, {
      global: {
        stubs: {
          AppShell: { template: '<div><slot /></div>' },
          // 36-03: Suggest/Export/Copy/Save/Present all moved into this real
          // child component (ContextualActionBar.vue) — every mountView in
          // this file must render it for real (`false` opts a component OUT
          // of shallowMount's default auto-stub) or none of those controls'
          // pre-existing testids/text are reachable in the DOM anymore.
          ContextualActionBar: false,
          RouterLink: {
            props: ['to'],
            template:
              '<a :data-route-name="to && to.name"><slot /></a>',
          },
          SaveStatusIndicator: false,
          ServicePrintLayout: true,
          SongBadge: true,
          SongSlotPicker: true,
          ScriptureInput: true,
        },
      },
    })
  }

  beforeEach(() => {
    mockAuthState.isEditor = true
    mockAuthState.orgId = 'org-1'
    mockAuthState.hasPcCredentials = false
    mockAuthState.pcCredentials = null
  })

  afterEach(() => {
    mockAuthState.hasPcCredentials = false
    mockAuthState.pcCredentials = null
  })

  it('renders the note, with no credentials configured, for an editor on a draft service', async () => {
    const wrapper = await mountView({ status: 'draft' })
    const note = wrapper.find('[data-testid="pc-credentials-missing-note"]')
    expect(note.exists()).toBe(true)
  })

  it('does not render the note when credentials are configured', async () => {
    mockAuthState.hasPcCredentials = true
    mockAuthState.pcCredentials = { appId: 'placeholder-app-id', secret: 'placeholder-secret' }
    const wrapper = await mountView({ status: 'draft' })
    const note = wrapper.find('[data-testid="pc-credentials-missing-note"]')
    expect(note.exists()).toBe(false)
  })

  it('the note links to the settings route by NAME, not a hardcoded path', async () => {
    const wrapper = await mountView({ status: 'draft' })
    const note = wrapper.find('[data-testid="pc-credentials-missing-note"]')
    const link = note.find('a')
    expect(link.exists()).toBe(true)
    expect(link.attributes('data-route-name')).toBe('settings')
  })

  it('never ungates the export affordance: export-pc-btn does not exist for a planned service without credentials', async () => {
    const wrapper = await mountView({ status: 'planned' })
    expect(wrapper.find('[data-testid="export-pc-btn"]').exists()).toBe(false)
    // Owner follow-up: Copy for PC is deleted, not merely still-gated — there
    // is no replacement affordance for a credentials-less org. Do NOT read
    // this false as a bug to "fix" by ungating export-pc-btn instead.
    expect(wrapper.find('[data-testid="copy-pc-btn"]').exists()).toBe(false)
  })

  it('a viewer (cannot edit) never sees the credentials-missing note, even with no credentials configured', async () => {
    mockAuthState.isEditor = false
    const wrapper = await mountView({ status: 'draft' })
    expect(wrapper.find('[data-testid="pc-credentials-missing-note"]').exists()).toBe(false)
  })

  // Owner follow-up superseded this test's original premise ("Copy for PC
  // still renders ... unchanged by this plan"): the button is now deleted
  // entirely, with the note as the sole affordance for a draft service with
  // no credentials configured.
  it('a draft service with no credentials configured shows the note and NO export/copy button of any kind', async () => {
    const wrapper = await mountView({ status: 'draft' })
    expect(wrapper.find('[data-testid="copy-pc-btn"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="export-pc-btn"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="pc-credentials-missing-note"]').exists()).toBe(true)
  })

  // ★★ THE TRAP (owner follow-up 3/4): the note used to render only when a
  // `copy-pc` item existed in the action-bar list, which incidentally kept
  // it off Slides/Roles — the exact R068 leak defect this codebase already
  // fixed once (`Suggest All Songs`/`Copy for PC` bleeding onto every tab).
  // Deleting `copy-pc` destroyed that free coupling, so the note now carries
  // an EXPLICIT `activeTab === 'service-order'` gate — pinned here as its
  // own dedicated regression, not merely inferred from the general
  // contextual-action-bar-wiring suite below.
  it('the note is Service-Order-only: present on Service Order, absent on Slides and on Roles, for the identical no-credentials editor state', async () => {
    const wrapper = await mountView({ status: 'draft' })
    expect(wrapper.find('[data-testid="pc-credentials-missing-note"]').exists()).toBe(true)

    const slidesTab = wrapper.findAll('button').find((b) => b.text() === 'Slides')
    await slidesTab!.trigger('click')
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[data-testid="pc-credentials-missing-note"]').exists()).toBe(false)

    const rolesTab = wrapper.findAll('button').find((b) => b.text() === 'Roles')
    await rolesTab!.trigger('click')
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[data-testid="pc-credentials-missing-note"]').exists()).toBe(false)

    const serviceOrderTab = wrapper.findAll('button').find((b) => b.text() === 'Service Order')
    await serviceOrderTab!.trigger('click')
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[data-testid="pc-credentials-missing-note"]').exists()).toBe(true)
  })
})

// ── 36-03 (R068 mounted proof / R069): the per-tab header action bar ───────────
// 36-02 already proved the gating invariant as DATA over the full cartesian
// product of context flags (serviceEditorActionBar.test.ts). This block is the
// MOUNTED proof named in 36-03's acceptance criteria — that wiring the real
// `ContextualActionBar` into the header, per tab, actually renders (and stops
// rendering) the right controls, and that the relocated Present button still
// reaches PresentationViewer through the real `slidesTabRef` plumbing.
//
// `SlidesTab` is replaced with a purpose-built stub (not the real component)
// so `canPresent`/`onPresentClick` are deterministic without driving the real
// `useSlideshowAssembly` pipeline (Firestore-backed lyrics/materialization) —
// this block is testing the HEADER's wiring, which 36-02's data-level suite
// and SlidesTab.test.ts's own R061 suite (36-03 Task 1) already prove in
// isolation. The stub still emits the SAME `present` event with the SAME
// payload shape the real component emits, so the relay through
// `@present="onPresent"` into `PresentationViewer` is exercised for real.
describe('ServiceEditorView - contextual action bar wiring (36-03, R068)', () => {
  const PRESENT_STUB_START_INDEX = 5

  const slidesTabPresentStub = {
    name: 'SlidesTab',
    emits: ['present', 'navigate-to-scripture-editor'],
    data() {
      return { canPresent: true }
    },
    methods: {
      onPresentClick(this: { $emit: (e: string, i: number) => void }) {
        this.$emit('present', PRESENT_STUB_START_INDEX)
      },
    },
    template: '<div data-testid="slides-tab-stub" />',
  }

  async function mountView(overrides: Partial<Service> = {}) {
    mockServicesList = [{ ...mockService, ...overrides }]
    const { default: ServiceEditorView } = await import('@/views/ServiceEditorView.vue')
    return shallowMount(ServiceEditorView, {
      global: {
        stubs: {
          AppShell: { template: '<div><slot /></div>' },
          ContextualActionBar: false,
          RouterLink: {
            props: ['to'],
            template: '<a :data-route-name="to && to.name"><slot /></a>',
          },
          SaveStatusIndicator: false,
          ServicePrintLayout: true,
          SongBadge: true,
          SongSlotPicker: true,
          ScriptureInput: true,
          SlidesTab: slidesTabPresentStub,
          PresentationViewer: {
            props: ['slides', 'isLoading', 'initialIndex'],
            template: '<div data-testid="presentation-viewer-stub" />',
          },
        },
      },
    })
  }

  beforeEach(() => {
    mockAuthState.isEditor = true
    mockAuthState.orgId = 'org-1'
    mockAuthState.hasPcCredentials = false
    mockAuthState.pcCredentials = null
    mockQuarters = []
    mockRosterOrgId = null
    mockQuartersOrgId = null
  })

  afterEach(() => {
    mockAuthState.hasPcCredentials = false
    mockAuthState.pcCredentials = null
  })

  function barButtons(wrapper: Awaited<ReturnType<typeof mountView>>) {
    return wrapper.find('[data-testid="contextual-action-bar"]').findAll('button')
  }

  async function clickTab(wrapper: Awaited<ReturnType<typeof mountView>>, label: string) {
    const btn = wrapper.findAll('button').find((b) => b.text() === label)
    await btn!.trigger('click')
    await wrapper.vm.$nextTick()
  }

  it('Service Order + editor + unlocked + no credentials: Suggest, Save and the R071 note all render, with no export/copy button', async () => {
    const wrapper = await mountView({ status: 'draft' })
    await wrapper.vm.$nextTick()

    const texts = barButtons(wrapper).map((b) => b.text())
    expect(texts.some((t) => t.includes('Suggest All Songs'))).toBe(true)
    // Owner follow-up: Copy for PC is deleted, and no replacement takes its
    // place in the bar — the note (below the bar, asserted next) is the
    // sole affordance for a credentials-less org.
    expect(wrapper.find('[data-testid="copy-pc-btn"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="export-pc-btn"]').exists()).toBe(false)
    expect(texts.some((t) => t.includes('Save'))).toBe(true)
    const note = wrapper.find('[data-testid="pc-credentials-missing-note"]')
    expect(note.exists()).toBe(true)
    expect(note.find('a').attributes('data-route-name')).toBe('settings')
  })

  // R101 (48-03), Pitfall 3: the ActionBarIcon union and ContextualActionBar's
  // template branches are two files with no compiler link between them — a
  // missing template branch type-checks cleanly but renders a bare-text
  // button. This test closes that gap by asserting the icon SVGs actually
  // render, not merely that the buttons exist.
  it('Print and Share render WITH their icons in the top action bar (Pitfall 3 closure)', async () => {
    mockAuthState.isEditor = true
    const wrapper = await mountView({ status: 'draft' })
    await wrapper.vm.$nextTick()

    const bar = wrapper.find('[data-testid="contextual-action-bar"]')
    const printBtn = bar.find('[data-testid="print-btn"]')
    expect(printBtn.exists()).toBe(true)
    expect(printBtn.find('svg').exists()).toBe(true)

    const shareBtn = bar.findAll('button').find((b) => b.text().includes('Share'))
    expect(shareBtn).toBeDefined()
    expect(shareBtn!.find('svg').exists()).toBe(true)
  })

  // R100 (48-03): the header Save-area row (Mark as Planned + the action bar)
  // uses QuarterView's button-cluster recipe so it stacks full-width below
  // `sm` and sits inline at `sm` and above, matching the Schedule screen.
  it('the header Save-area row carries the QuarterView flex-col/sm:flex-row stacking recipe', async () => {
    const wrapper = await mountView({ status: 'draft' })
    await wrapper.vm.$nextTick()

    const saveAreaRow = wrapper.find('[data-testid="mark-planned-btn"]').element.parentElement
    expect(saveAreaRow?.classList.contains('flex-col')).toBe(true)
    expect(saveAreaRow?.classList.contains('sm:flex-row')).toBe(true)
  })

  it('Service Order + editor + unlocked + credentialed: export-pc-btn renders, the R071 note does not', async () => {
    mockAuthState.hasPcCredentials = true
    mockAuthState.pcCredentials = { appId: 'placeholder-app-id', secret: 'placeholder-secret' }
    const wrapper = await mountView({ status: 'planned' })
    await wrapper.vm.$nextTick()

    expect(wrapper.find('[data-testid="export-pc-btn"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="pc-credentials-missing-note"]').exists()).toBe(false)
  })

  it('ROADMAP criterion 2, mounted: Slides tab shows neither Suggest All Songs nor Export/Copy nor the R071 note', async () => {
    const wrapper = await mountView({ status: 'draft' })
    await wrapper.vm.$nextTick()
    await clickTab(wrapper, 'Slides')

    const texts = barButtons(wrapper).map((b) => b.text())
    expect(texts.some((t) => t.includes('Suggest All Songs'))).toBe(false)
    expect(wrapper.find('[data-testid="copy-pc-btn"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="export-pc-btn"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="pc-credentials-missing-note"]').exists()).toBe(false)
  })

  it('Roles tab: the bar renders zero buttons, no leaked Service Order actions, and Mark as Planned/the undo-link still render outside it', async () => {
    const wrapper = await mountView({ status: 'draft' })
    await wrapper.vm.$nextTick()
    // Force a previousService snapshot directly (bypassing the real autosave
    // debounce/flow, which is exercised elsewhere) so the undo-link's own
    // `v-if="previousService"` has something to gate on.
    ;(wrapper.vm as unknown as { previousService: Service | null }).previousService = { ...mockService }
    await wrapper.vm.$nextTick()

    await clickTab(wrapper, 'Roles')

    expect(wrapper.find('[data-testid="contextual-action-bar"]').exists()).toBe(true)
    expect(barButtons(wrapper)).toHaveLength(0)
    const texts = wrapper.findAll('button').map((b) => b.text())
    expect(texts.some((t) => t.includes('Suggest All Songs'))).toBe(false)
    expect(wrapper.find('[data-testid="copy-pc-btn"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="export-pc-btn"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="pc-credentials-missing-note"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="mark-planned-btn"]').exists()).toBe(true)
    // R102 (48-03): the undo-link lives in the save-status bar, which is
    // mounted regardless of activeTab (34-10) — still reachable on Roles.
    expect(wrapper.find('[data-testid="undo-link"]').exists()).toBe(true)
  })

  it('design 1a: Present renders in the page header on the Slides tab, immediately before Save, and NOT inside the slides tab panel', async () => {
    const wrapper = await mountView({ status: 'draft' })
    await wrapper.vm.$nextTick()
    await clickTab(wrapper, 'Slides')

    const bar = wrapper.find('[data-testid="contextual-action-bar"]')
    const present = bar.find('[data-testid="action-bar-item-present"]')
    expect(present.exists()).toBe(true)
    // Not inside the (stubbed) tab panel — it lives in the page header only.
    expect(wrapper.find('[data-testid="slides-tab-stub"]').find('[data-testid="action-bar-item-present"]').exists()).toBe(false)

    const testIds = barButtons(wrapper).map((b) => b.attributes('data-testid'))
    expect(testIds).toEqual(['action-bar-item-present', 'action-bar-item-save'])
  })

  it('clicking the relocated Present button opens PresentationViewer at the start index SlidesTab.onPresentClick() computed', async () => {
    const wrapper = await mountView({ status: 'draft' })
    await wrapper.vm.$nextTick()
    await clickTab(wrapper, 'Slides')

    expect(wrapper.find('[data-testid="presentation-viewer-stub"]').exists()).toBe(false)

    await wrapper.find('[data-testid="action-bar-item-present"]').trigger('click')
    await wrapper.vm.$nextTick()

    const viewer = wrapper.findComponent(PresentationViewer)
    expect(viewer.exists()).toBe(true)
    expect(viewer.props('initialIndex')).toBe(PRESENT_STUB_START_INDEX)
  })

  // Owner follow-up: with the default no-credentials mock state, there is no
  // export/copy item at all any more (Copy for PC deleted, no replacement),
  // so this pair now sets credentials to prove the underlying invariant this
  // test always meant to pin — export-pc renders unconditionally on
  // `canEditService` (36-02-SUMMARY.md's preserved pre-phase gate) — using
  // the ONE item that can still demonstrate it now that copy-pc is gone.
  it('viewer (isEditor false) on Service Order, credentialed: no Suggest, no Save, no R071 note, but export-pc still renders — the preserved pre-phase gate (36-02-SUMMARY.md)', async () => {
    mockAuthState.isEditor = false
    mockAuthState.hasPcCredentials = true
    mockAuthState.pcCredentials = { appId: 'placeholder-app-id', secret: 'placeholder-secret' }
    const wrapper = await mountView({ status: 'planned' })
    await wrapper.vm.$nextTick()

    const texts = barButtons(wrapper).map((b) => b.text())
    expect(texts.some((t) => t.includes('Suggest All Songs'))).toBe(false)
    expect(texts.some((t) => t.includes('Save'))).toBe(false)
    expect(wrapper.find('[data-testid="pc-credentials-missing-note"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="export-pc-btn"]').exists()).toBe(true)
  })

  it('viewer (isEditor false) on Service Order, uncredentialed: no Suggest, no Save, no R071 note (viewers never see it), and no export/copy button of any kind', async () => {
    mockAuthState.isEditor = false
    const wrapper = await mountView({ status: 'draft' })
    await wrapper.vm.$nextTick()

    const texts = barButtons(wrapper).map((b) => b.text())
    expect(texts.some((t) => t.includes('Suggest All Songs'))).toBe(false)
    expect(texts.some((t) => t.includes('Save'))).toBe(false)
    expect(wrapper.find('[data-testid="pc-credentials-missing-note"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="copy-pc-btn"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="export-pc-btn"]').exists()).toBe(false)
  })

  it('locked editor (status planned), credentialed: same expectation as the credentialed viewer row above — export-pc still renders', async () => {
    mockAuthState.hasPcCredentials = true
    mockAuthState.pcCredentials = { appId: 'placeholder-app-id', secret: 'placeholder-secret' }
    const wrapper = await mountView({ status: 'planned' })
    await wrapper.vm.$nextTick()

    const texts = barButtons(wrapper).map((b) => b.text())
    expect(texts.some((t) => t.includes('Suggest All Songs'))).toBe(false)
    expect(texts.some((t) => t.includes('Save'))).toBe(false)
    expect(wrapper.find('[data-testid="pc-credentials-missing-note"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="export-pc-btn"]').exists()).toBe(true)
  })

  it('locked editor (status planned), uncredentialed: no export/copy button of any kind — the deleted Copy for PC leaves no replacement, and the note stays absent (canEditService is false while locked)', async () => {
    const wrapper = await mountView({ status: 'planned' })
    await wrapper.vm.$nextTick()

    const texts = barButtons(wrapper).map((b) => b.text())
    expect(texts.some((t) => t.includes('Suggest All Songs'))).toBe(false)
    expect(texts.some((t) => t.includes('Save'))).toBe(false)
    expect(wrapper.find('[data-testid="pc-credentials-missing-note"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="copy-pc-btn"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="export-pc-btn"]').exists()).toBe(false)
  })

  // WR-02 (39-REVIEW): mounted-level proof of the three `pcEnabled`-composed
  // behaviors this phase added to ServiceEditorView.vue. serviceEditorActionBar
  // .test.ts already proves the pure gating logic; these assert the VIEW
  // actually wires `authStore.settings.pcEnabled` into it correctly — a
  // regression that hard-coded `pcEnabled: true` in `activeActionItems`, or
  // dropped the clause from either `v-if`/guard, was not caught by any test
  // before this block existed.
  describe('WR-02: authStore.settings.pcEnabled composition', () => {
    beforeEach(() => {
      mockAuthState.hasPcCredentials = true
      mockAuthState.pcCredentials = { appId: 'placeholder-app-id', secret: 'placeholder-secret' }
    })

    afterEach(() => {
      mockAuthState.settings.pcEnabled = true
    })

    // Behavior 1: `activeActionItems` passes `pcEnabled` into
    // `buildActionBarItems`, so export-pc-btn disappears when the org has
    // turned Planning Center off — even with credentials present.
    it('pcEnabled false, credentialed: export-pc-btn does not render (action-bar context wiring)', async () => {
      mockAuthState.settings.pcEnabled = false
      const wrapper = await mountView({ status: 'planned' })
      await wrapper.vm.$nextTick()

      expect(wrapper.find('[data-testid="export-pc-btn"]').exists()).toBe(false)
    })

    it('pcEnabled true, credentialed: export-pc-btn renders (control case)', async () => {
      mockAuthState.settings.pcEnabled = true
      const wrapper = await mountView({ status: 'planned' })
      await wrapper.vm.$nextTick()

      expect(wrapper.find('[data-testid="export-pc-btn"]').exists()).toBe(true)
    })

    // Behavior 2: the credentials-missing hint row's v-if gained
    // `&& authStore.settings.pcEnabled` — a church that turned PC off should
    // not be nudged to configure credentials for a feature it disabled.
    it('pcEnabled false, uncredentialed: the credentials-missing note does not render', async () => {
      mockAuthState.hasPcCredentials = false
      mockAuthState.pcCredentials = null
      mockAuthState.settings.pcEnabled = false
      const wrapper = await mountView({ status: 'draft' })
      await wrapper.vm.$nextTick()

      expect(wrapper.find('[data-testid="pc-credentials-missing-note"]').exists()).toBe(false)
    })

    it('pcEnabled true, uncredentialed: the credentials-missing note still renders (control case)', async () => {
      mockAuthState.hasPcCredentials = false
      mockAuthState.pcCredentials = null
      mockAuthState.settings.pcEnabled = true
      const wrapper = await mountView({ status: 'draft' })
      await wrapper.vm.$nextTick()

      expect(wrapper.find('[data-testid="pc-credentials-missing-note"]').exists()).toBe(true)
    })

    // Behavior 3: `onExportToPC`'s belt-and-suspenders early return
    // (`|| !authStore.settings.pcEnabled`) — exercised directly on the vm
    // since the action-bar button that would normally invoke it is itself
    // hidden when pcEnabled is false (behavior 1 above), so a DOM click
    // cannot reach this guard. Calling the handler directly proves the
    // function-level guard holds independently of whether the button
    // rendered, matching the guard's own "stale bundle / residual DOM node"
    // rationale (ServiceEditorView.vue:3083-3087).
    it('pcEnabled false: calling onExportToPC directly never opens the export dialog, even with credentials present', async () => {
      mockAuthState.settings.pcEnabled = false
      const wrapper = await mountView({ status: 'planned' })
      await wrapper.vm.$nextTick()

      const vm = wrapper.vm as unknown as { onExportToPC: () => Promise<void>; showExportDialog: boolean }
      await vm.onExportToPC()
      await wrapper.vm.$nextTick()

      expect(vm.showExportDialog).toBe(false)
    })

    it('pcEnabled true: calling onExportToPC directly opens the export dialog (control case)', async () => {
      mockAuthState.settings.pcEnabled = true
      const wrapper = await mountView({ status: 'planned' })
      await wrapper.vm.$nextTick()

      const vm = wrapper.vm as unknown as { onExportToPC: () => Promise<void>; showExportDialog: boolean }
      await vm.onExportToPC()
      await wrapper.vm.$nextTick()

      expect(vm.showExportDialog).toBe(true)
    })
  })

  // ★ 34-10 SURVIVES (named regression guard): this plan relocates the
  // buttons directly above this element in the template, and the save-status
  // bar's wrapper condition/chrome-only conditional (34-10/34-07) is
  // explicitly NOT to be touched. Verified here, adjacent to the new bar's
  // own coverage, rather than trusting the pre-existing 34-10 describe block
  // alone to catch a regression this plan could introduce beside it.
  it('34-10 guard: the save-status bar stays mounted at idle with no chrome classes and a mounted SaveStatusIndicator', async () => {
    const wrapper = await mountView({ status: 'draft' })
    await wrapper.vm.$nextTick()

    const bar = wrapper.find('[data-testid="service-save-status-bar"]')
    expect(bar.exists()).toBe(true)
    // R102 (48-03): the wrapper's flex layout is now unconditional (so the
    // Undo link lays out beside SaveStatusIndicator even at idle) — only
    // border/background/padding/sticky stay conditional.
    expect(bar.classes()).toEqual(['flex', 'items-center', 'gap-2'])
    expect(bar.find('[data-testid="save-status"]').exists()).toBe(true)
  })

  it('R068 edge/idempotency, mounted: Service Order -> Slides -> Roles -> Service Order returns the header to the identical button set', async () => {
    const wrapper = await mountView({ status: 'draft' })
    await wrapper.vm.$nextTick()
    const before = barButtons(wrapper).map((b) => b.attributes('data-testid'))

    await clickTab(wrapper, 'Slides')
    await clickTab(wrapper, 'Roles')
    await clickTab(wrapper, 'Service Order')

    const after = barButtons(wrapper).map((b) => b.attributes('data-testid'))
    expect(after).toEqual(before)
  })
})

// ── R125 (55-02): Planning Center export in-progress spinner ────────────────
// The owner asked for "a spinner to the services planning center export so
// users can see it's doing something." The export flow already carries the
// `isExporting` reactive flag (set at the start of onConfirmExport, cleared in
// its finally), an "Exporting..." text label, and a `:disabled` guard on the
// Confirm Export button — only the visible spinner GLYPH was missing. This
// block pins the glyph onto the button while exporting, its absence otherwise,
// and the pre-existing disabled guard (double-invocation protection, T-55-02),
// reusing the EXISTING flag — no second export-state flag is introduced.
describe('ServiceEditorView - R125 export in-progress spinner (55-02)', () => {
  async function mountView(overrides: Partial<Service> = {}) {
    mockServicesList = [{ ...mockService, ...overrides }]
    const { default: ServiceEditorView } = await import('@/views/ServiceEditorView.vue')
    return shallowMount(ServiceEditorView, {
      global: {
        stubs: {
          AppShell: { template: '<div><slot /></div>' },
          ContextualActionBar: false,
          RouterLink: { template: '<a><slot /></a>' },
          SaveStatusIndicator: false,
          ServicePrintLayout: true,
          SongBadge: true,
          SongSlotPicker: true,
          ScriptureInput: true,
          // The export dialog is a <Teleport to="body"> block — shallowMount
          // discards teleported children unless teleport is opted out (34-07).
          teleport: false,
        },
      },
    })
  }

  beforeEach(() => {
    mockAuthState.isEditor = true
    mockAuthState.orgId = 'org-1'
    mockAuthState.hasPcCredentials = true
    mockAuthState.pcCredentials = { appId: 'placeholder-app-id', secret: 'placeholder-secret' }
  })

  afterEach(() => {
    mockAuthState.hasPcCredentials = false
    mockAuthState.pcCredentials = null
  })

  // Drive the export dialog into its "options loaded, export running" state by
  // setting the component's own reactive flags directly (the same vm-level
  // approach the WR-02 export tests above use), then assert the glyph + guard.
  interface ExportVm {
    showExportDialog: boolean
    exportLoading: boolean
    isExporting: boolean
    exportSelectedServiceTypeId: string
  }

  it('renders the export-spinner in the Confirm Export button while isExporting, and the button stays disabled', async () => {
    // status: 'draft' (the mockService default) — the export state is driven
    // directly via the vm flags below, so the service status is irrelevant to
    // these assertions; leaving a draft in mockServicesList also keeps this
    // block from leaking a locked service into the Roles tab describe that
    // follows (its mountView reuses whatever mockServicesList was last set).
    const wrapper = await mountView({ status: 'draft' })
    await wrapper.vm.$nextTick()

    const vm = wrapper.vm as unknown as ExportVm
    vm.showExportDialog = true
    vm.exportLoading = false
    vm.exportSelectedServiceTypeId = 'service-type-1'
    vm.isExporting = true
    await wrapper.vm.$nextTick()

    const body = new DOMWrapper(document.body)
    const spinner = body.find('[data-testid="export-spinner"]')
    expect(spinner.exists()).toBe(true)
    // The spinner uses the app's established animate-spin ring affordance.
    expect(spinner.classes()).toContain('animate-spin')

    // The Confirm Export button (the one carrying the "Exporting..." label
    // while the round-trip runs) stays disabled — the T-55-02 double-fire
    // guard this presentation-only change must preserve untouched.
    const confirmBtn = body.findAll('button').find((b) => b.text().includes('Exporting'))
    expect(confirmBtn).toBeDefined()
    expect(confirmBtn!.attributes('disabled')).toBeDefined()
  })

  it('does not render the export-spinner when no export is running', async () => {
    // status: 'draft' (the mockService default) — the export state is driven
    // directly via the vm flags below, so the service status is irrelevant to
    // these assertions; leaving a draft in mockServicesList also keeps this
    // block from leaking a locked service into the Roles tab describe that
    // follows (its mountView reuses whatever mockServicesList was last set).
    const wrapper = await mountView({ status: 'draft' })
    await wrapper.vm.$nextTick()

    const vm = wrapper.vm as unknown as ExportVm
    vm.showExportDialog = true
    vm.exportLoading = false
    vm.exportSelectedServiceTypeId = 'service-type-1'
    vm.isExporting = false
    await wrapper.vm.$nextTick()

    const body = new DOMWrapper(document.body)
    expect(body.find('[data-testid="export-spinner"]').exists()).toBe(false)
  })
})

describe('ServiceEditorView - Roles tab (Phase 17-04)', () => {
  async function mountView() {
    const { default: ServiceEditorView } = await import('@/views/ServiceEditorView.vue')
    return shallowMount(ServiceEditorView, {
      global: {
        stubs: {
          AppShell: { template: '<div><slot /></div>' },
          // 36-03: Suggest/Export/Copy/Save/Present all moved into this real
          // child component (ContextualActionBar.vue) — every mountView in
          // this file must render it for real (`false` opts a component OUT
          // of shallowMount's default auto-stub) or none of those controls'
          // pre-existing testids/text are reachable in the DOM anymore.
          ContextualActionBar: false,
          RouterLink: { template: '<a><slot /></a>' },
          // 32-05: render the real SaveStatusIndicator (not a shallow stub)
          // so its data-testid="save-status"/"save-status-error" handles are
          // reachable from these tests.
          SaveStatusIndicator: false,
          ServicePrintLayout: true,
          SongBadge: true,
          SongSlotPicker: true,
          ScriptureInput: true,
        },
      },
    })
  }

  beforeEach(() => {
    mockAuthState.isEditor = false
    mockAuthState.orgId = 'org-1'
    mockRosterOrgId = null
    mockQuartersOrgId = null
    mockQuarters = []
    mockRosterSubscribe.mockClear()
    mockQuartersSubscribe.mockClear()
  })

  it('editor: Roles tab lists seeded role assignments resolved from the quarterly schedule', async () => {
    mockAuthState.isEditor = true
    mockQuarters = [
      {
        id: 'q1',
        label: 'Q1 2026',
        year: 2026,
        quarter: 1,
        serviceDates: ['2026-03-08'],
        roleOverridesByDate: {},
        personQuarterData: {},
        calendar: { '2026-03-08': { 'role-vox': ['person-1'] } },
        status: 'finalized',
        shareToken: null,
        createdAt: mockTimestamp,
        updatedAt: mockTimestamp,
      },
    ]

    const wrapper = await mountView()
    const rolesTabBtn = wrapper.findAll('button').find((b) => b.text() === 'Roles')
    expect(rolesTabBtn?.exists()).toBe(true)
    await rolesTabBtn!.trigger('click')

    expect(wrapper.text()).toContain('Vocals')
    expect(wrapper.text()).toContain('Alice')
    expect(wrapper.text()).toContain('Nobody scheduled') // Drums role has no schedule entry
  })

  it('editor: override control (checkbox picker) appears, filtered by role eligibility', async () => {
    mockAuthState.isEditor = true
    mockQuarters = [
      {
        id: 'q1',
        label: 'Q1 2026',
        year: 2026,
        quarter: 1,
        serviceDates: ['2026-03-08'],
        roleOverridesByDate: {},
        personQuarterData: {},
        calendar: { '2026-03-08': { 'role-vox': ['person-1'] } },
        status: 'finalized',
        shareToken: null,
        createdAt: mockTimestamp,
        updatedAt: mockTimestamp,
      },
    ]

    const wrapper = await mountView()
    const rolesTabBtn = wrapper.findAll('button').find((b) => b.text() === 'Roles')
    await rolesTabBtn!.trigger('click')

    // Vocals role: only Alice (has role-vox) should be offered as a candidate — Bob (role-drums) should not
    const aliceLabel = wrapper.findAll('label').find((l) => l.text() === 'Alice')
    expect(aliceLabel?.exists()).toBe(true)

    // Drums role has no schedule entry, so Bob's checkbox (role-drums eligible) starts
    // unchecked — toggling it exercises the override control end-to-end.
    const bobLabel = wrapper.findAll('label').find((l) => l.text() === 'Bob')
    expect(bobLabel?.exists()).toBe(true)
    const checkbox = bobLabel!.find('input[type="checkbox"]')
    expect(checkbox.exists()).toBe(true)
    await checkbox.setValue(true)
    expect(mockSetRoleOverride).toHaveBeenCalled()
  })

  it('non-editor: Roles tab button is hidden and no roster/quarters data is read', async () => {
    mockAuthState.isEditor = false

    const wrapper = await mountView()
    const rolesTabBtn = wrapper.findAll('button').find((b) => b.text() === 'Roles')
    expect(rolesTabBtn).toBeUndefined()
  })

  it('editor: empty state renders when no quarter covers the service date', async () => {
    mockAuthState.isEditor = true
    mockQuarters = [] // no quarter at all covers '2026-03-08'

    const wrapper = await mountView()
    const rolesTabBtn = wrapper.findAll('button').find((b) => b.text() === 'Roles')
    await rolesTabBtn!.trigger('click')

    expect(wrapper.text()).toContain('No schedule found for this date')
  })

  // ── WR-01 regression ──────────────────────────────────────────────────────────
  // initStores() must re-subscribe roster/quarters once authStore.isEditor
  // resolves to true *after* mount (e.g. a real editor landing directly on
  // /services/:id before loadOrgContext() finishes) — not just when isEditor
  // was already true at mount time.
  it('editor: roster/quarters are subscribed once authStore.isEditor flips true after mount (WR-01)', async () => {
    // Simulate landing on the page before the role has resolved.
    mockAuthState.isEditor = false

    await mountView()

    // Not editor yet at mount time — must not have subscribed.
    expect(mockRosterSubscribe).not.toHaveBeenCalled()
    expect(mockQuartersSubscribe).not.toHaveBeenCalled()

    // Role resolves asynchronously (mirrors loadOrgContext() completing).
    mockAuthState.isEditor = true
    await Promise.resolve()
    await Promise.resolve()

    expect(mockRosterSubscribe).toHaveBeenCalledWith('org-1')
    expect(mockQuartersSubscribe).toHaveBeenCalledWith('org-1')
  })

  // ── WR-02 regression ──────────────────────────────────────────────────────────
  // Toggling two different people's checkboxes for the *same* role in quick
  // succession must not let the second write clobber the first — the
  // optimistic local update means the second toggle reads the just-applied
  // state instead of a stale pre-write baseline.
  it('editor: rapid toggles of two different people for the same role do not clobber each other (WR-02)', async () => {
    mockAuthState.isEditor = true
    mockQuarters = [
      {
        id: 'q1',
        label: 'Q1 2026',
        year: 2026,
        quarter: 1,
        serviceDates: ['2026-03-08'],
        roleOverridesByDate: {},
        personQuarterData: {},
        // Nobody scheduled for Vocals yet — both Alice and Carol are role-vox
        // eligible candidates offered in the checkbox group.
        calendar: { '2026-03-08': {} },
        status: 'finalized',
        shareToken: null,
        createdAt: mockTimestamp,
        updatedAt: mockTimestamp,
      },
    ]

    const wrapper = await mountView()
    const rolesTabBtn = wrapper.findAll('button').find((b) => b.text() === 'Roles')
    await rolesTabBtn!.trigger('click')

    const aliceLabel = wrapper.findAll('label').find((l) => l.text() === 'Alice')
    const carolLabel = wrapper.findAll('label').find((l) => l.text() === 'Carol')
    expect(aliceLabel?.exists()).toBe(true)
    expect(carolLabel?.exists()).toBe(true)

    const aliceCheckbox = aliceLabel!.find('input[type="checkbox"]')
    const carolCheckbox = carolLabel!.find('input[type="checkbox"]')

    // Toggle Alice, then Carol, for the same role — awaiting each in turn
    // (this is exactly what the reactive-store round-trip fails to keep up
    // with pre-fix, since the mocked setRoleOverride never updates
    // serviceStore.services; only the optimistic local mutation does).
    await aliceCheckbox.setValue(true)
    await carolCheckbox.setValue(true)

    // The last write must include BOTH people, not just Carol.
    const lastCallArgs = mockSetRoleOverride.mock.calls[mockSetRoleOverride.mock.calls.length - 1]
    expect(lastCallArgs?.[1]).toBe('role-vox')
    expect(lastCallArgs?.[2]).toEqual(expect.arrayContaining(['person-1', 'person-3']))
    expect(lastCallArgs?.[2]).toHaveLength(2)
  })

  // ── quick 260812-jjj regression ──────────────────────────────────────────
  // "Reset to schedule" must clear an override and restore "Nobody scheduled"
  // even when NO quarter covers the service date at all — not just when
  // there's a generated schedule assignment for it to fall back to.
  it('editor: Reset to schedule clears an override and shows "Nobody scheduled" when no quarter covers the service date (260812-jjj)', async () => {
    mockAuthState.isEditor = true
    mockQuarters = [] // no quarter covers '2026-03-08' -> hasQuarterForServiceDate is false
    mockServicesList = [{
      ...mockService,
      status: 'draft',
      roleAssignmentOverrides: { 'role-vox': ['person-1'] },
    }]

    const wrapper = await mountView()
    const rolesTabBtn = wrapper.findAll('button').find((b) => b.text() === 'Roles')
    await rolesTabBtn!.trigger('click')

    const vocalsCard = wrapper.findAll('.rounded-lg').find((c) => c.text().includes('Vocals'))
    expect(vocalsCard?.exists()).toBe(true)
    expect(vocalsCard!.text()).toContain('Overridden')

    const resetBtn = wrapper.findAll('button').find((b) => b.text() === 'Reset to schedule')
    expect(resetBtn?.exists()).toBe(true)

    await resetBtn!.trigger('click')
    expect(mockClearRoleOverride).toHaveBeenCalledWith('service-1', 'role-vox')

    await wrapper.vm.$nextTick()

    const vm = wrapper.vm as unknown as {
      resolvedRoleAssignments: Array<{ roleId: string; roleName: string; overriddenPersonIds: string[] | null }>
    }
    const vocalsAssignment = vm.resolvedRoleAssignments.find((a) => a.roleId === 'role-vox')
    expect(vocalsAssignment?.overriddenPersonIds).toBeNull()

    expect(wrapper.text()).not.toContain('Overridden')
    expect(wrapper.text()).toContain('Nobody scheduled')
  })

  it('editor: Reset to schedule button shows the pointer cursor (260812-jjj)', async () => {
    mockAuthState.isEditor = true
    mockQuarters = []
    mockServicesList = [{
      ...mockService,
      status: 'draft',
      roleAssignmentOverrides: { 'role-vox': ['person-1'] },
    }]

    const wrapper = await mountView()
    const rolesTabBtn = wrapper.findAll('button').find((b) => b.text() === 'Roles')
    await rolesTabBtn!.trigger('click')

    const resetBtn = wrapper.findAll('button').find((b) => b.text() === 'Reset to schedule')
    expect(resetBtn?.exists()).toBe(true)
    expect(resetBtn!.classes()).toContain('cursor-pointer')
  })
})

// ── Sections and inline slideshow preview (Phase 20-04) ─────────────────────────

function buildSectionedService(): Service {
  return {
    ...mockService,
    slots: [
      { kind: 'SONG', id: 'slot-0', position: 0, requiredVwType: 1, songId: 'song-1', songTitle: 'Amazing Grace', songKey: 'G', section: 'worship' },
      { kind: 'SCRIPTURE', id: 'slot-1', position: 1, book: 'Psalms', chapter: 23, verseStart: 1, verseEnd: 6, section: 'worship' },
      { kind: 'MESSAGE', id: 'slot-2', position: 2, section: 'message' },
      { kind: 'SONG', id: 'slot-3', position: 3, requiredVwType: 3, songId: null, songTitle: null, songKey: null, section: 'sending' },
    ],
  }
}

describe('ServiceEditorView - Section headers and slideshow preview (Phase 20-04)', () => {
  async function mountView() {
    const { default: ServiceEditorView } = await import('@/views/ServiceEditorView.vue')
    return shallowMount(ServiceEditorView, {
      global: {
        stubs: {
          AppShell: { template: '<div><slot /></div>' },
          // 36-03: Suggest/Export/Copy/Save/Present all moved into this real
          // child component (ContextualActionBar.vue) — every mountView in
          // this file must render it for real (`false` opts a component OUT
          // of shallowMount's default auto-stub) or none of those controls'
          // pre-existing testids/text are reachable in the DOM anymore.
          ContextualActionBar: false,
          RouterLink: { template: '<a><slot /></a>' },
          // 32-05: render the real SaveStatusIndicator (not a shallow stub)
          // so its data-testid="save-status"/"save-status-error" handles are
          // reachable from these tests.
          SaveStatusIndicator: false,
          ServicePrintLayout: true,
          SongBadge: true,
          SongSlotPicker: true,
          ScriptureInput: true,
          // props declared so wrapper.props('slides') resolves in the
          // array-identity test below — a bare template stub would treat
          // :slides/:is-loading as fallthrough attrs instead of tracked props.
          PresentationViewer: {
            props: ['slides', 'isLoading'],
            template: '<div data-testid="presentation-viewer-stub" />',
          },
        },
      },
    })
  }

  beforeEach(() => {
    mockAuthState.isEditor = true
    mockAuthState.orgId = 'org-1'
    mockServicesList = [mockService]
  })

  // Restated for 29-03: headers are no longer conditional on "does this section have a
  // slot" (showsSectionHeaderAt was deleted) — every SERVICE_SECTIONS member renders its
  // own header unconditionally, in fixed SERVICE_SECTIONS order, whether or not it holds
  // items (R043).
  it('renders all five section headers unconditionally, in SERVICE_SECTIONS order, Post-Service last (29-05)', async () => {
    mockServicesList = [buildSectionedService()] // no Pre-Service or Post-Service slot — still renders both headers
    const wrapper = await mountView()

    const headers = wrapper.findAll('[data-testid^="section-header-"]')
    expect(headers).toHaveLength(5)
    expect(headers[0]?.text()).toContain('Pre-Service')
    expect(headers[1]?.text()).toContain('Worship')
    expect(headers[2]?.text()).toContain('Message')
    expect(headers[3]?.text()).toContain('Sending')
    expect(headers[4]?.text()).toContain('Post-Service')
  })

  it('renders all five section headers, with placeholders, and routes every slot into the trailing ungrouped container for a legacy service (29-03/29-05)', async () => {
    mockServicesList = [mockService] // default fixture: no slot carries a `section` field
    const wrapper = await mountView()

    const headers = wrapper.findAll('[data-testid^="section-header-"]')
    expect(headers).toHaveLength(5)
    for (const section of ['pre-service', 'worship', 'message', 'sending', 'post-service']) {
      expect(wrapper.find(`[data-testid="section-empty-${section}"]`).exists()).toBe(true)
      expect(wrapper.find(`[data-testid="section-list-${section}"] .slot-item`).exists()).toBe(false)
    }
    const ungrouped = wrapper.find('[data-testid="section-list-ungrouped"]')
    expect(ungrouped.exists()).toBe(true)
    expect(ungrouped.findAll('.slot-item')).toHaveLength(mockService.slots.length)
  })

  it('renders an empty-section placeholder as a live drop target for a section with no slots (29-03)', async () => {
    mockServicesList = [buildSectionedService()] // no Pre-Service slot
    const wrapper = await mountView()

    const preServiceList = wrapper.find('[data-testid="section-list-pre-service"]')
    expect(preServiceList.exists()).toBe(true)
    const placeholder = preServiceList.find('[data-testid="section-empty-pre-service"]')
    expect(placeholder.exists()).toBe(true)
    expect(placeholder.text()).toContain('No items yet')
  })

  it('the Post-Service empty placeholder carries the purpose-naming UI-SPEC §2 copy; Pre-Service (also empty in this fixture) carries the generic copy (29-05)', async () => {
    mockServicesList = [buildSectionedService()] // no Pre-Service or Post-Service slot — both render empty
    const wrapper = await mountView()

    const postServicePlaceholder = wrapper.find('[data-testid="section-empty-post-service"]')
    expect(postServicePlaceholder.exists()).toBe(true)
    expect(postServicePlaceholder.text()).toContain(
      'Drag an item here, or set its Section to Post-Service — runs as people exit, e.g. a cycling announcement deck.',
    )

    const preServicePlaceholder = wrapper.find('[data-testid="section-empty-pre-service"]')
    expect(preServicePlaceholder.exists()).toBe(true)
    expect(preServicePlaceholder.text()).toContain('Drag an item here, or set its Section to Pre-Service.')
  })

  it('a Post-Service slot renders inside the Post-Service container and every slot kind is accepted there (29-05)', async () => {
    mockServicesList = [{
      ...mockService,
      slots: [
        { kind: 'SONG', id: 'ps-song', position: 0, requiredVwType: 1, songId: null, songTitle: null, songKey: null, section: 'post-service' },
        { kind: 'IMPORTED', id: 'ps-imported', position: 1, importId: null, section: 'post-service' },
        { kind: 'PRAYER', id: 'ps-prayer', position: 2, section: 'post-service' },
      ],
    }]
    const wrapper = await mountView()

    const postServiceCards = wrapper.find('[data-testid="section-list-post-service"]').findAll('.slot-item')
    expect(postServiceCards.map((c) => c.attributes('data-slot-id'))).toEqual(['ps-song', 'ps-imported', 'ps-prayer'])
    expect(wrapper.find('[data-testid="section-empty-post-service"]').exists()).toBe(false)
  })

  it('every slot card carries data-slot-id equal to its slot.id, in section-major id order across containers (29-03)', async () => {
    mockServicesList = [makeSectionedService()] // s1..s8 already section-major: pre-service, worship x3, message x2, sending x2
    const wrapper = await mountView()

    const cards = wrapper.findAll('.slot-item')
    expect(cards.map((c) => c.attributes('data-slot-id'))).toEqual(['s1', 's2', 's3', 's4', 's5', 's6', 's7', 's8'])
  })

  it("changing a slot's section via the ⋯ menu moves its card into the target section's container and renumbers positions section-major (29-03)", async () => {
    mockAuthState.isEditor = true
    mockServicesList = [buildSectionedService()] // slot-0/1 worship, slot-2 message, slot-3 sending
    const wrapper = await mountView()
    await wrapper.vm.$nextTick()

    // slot-3 (currently 'sending') -> reassign to 'worship' via the per-row ⋯ menu.
    // It should now render inside the worship container, after the two existing worship cards.
    await moveSlotViaRowMenu(wrapper, 3, 'worship')

    const worshipCards = wrapper.find('[data-testid="section-list-worship"]').findAll('.slot-item')
    expect(worshipCards.map((c) => c.attributes('data-slot-id'))).toEqual(['slot-0', 'slot-1', 'slot-3'])
    expect(wrapper.find('[data-testid="section-list-sending"]').find('.slot-item').exists()).toBe(false)

    // Section-major reindex (onSectionChange composes reindexSlots(orderSlotsBySection(...))):
    // the array's absolute index now runs 0..3 in the NEW order — moved slot-3 becomes array
    // index 2 (worship's third card), and message's now-lone slot-2 becomes array index 3.
    // Each card's `data-testid="slot-{index}"` reflects that renumbered absolute index directly,
    // without needing to wait on the (separately covered) debounced autosave write.
    expect(worshipCards.map((c) => c.attributes('data-testid'))).toEqual(['slot-0', 'slot-1', 'slot-2'])
    const messageCards = wrapper.find('[data-testid="section-list-message"]').findAll('.slot-item')
    expect(messageCards.map((c) => c.attributes('data-slot-id'))).toEqual(['slot-2'])
    expect(messageCards.map((c) => c.attributes('data-testid'))).toEqual(['slot-3'])
  })

  it('adding a slot inherits the section of the current last slot, landing at the end of that section rather than in the ungrouped container (29-03)', async () => {
    mockAuthState.isEditor = true
    mockServicesList = [buildSectionedService()] // last slot (slot-3) is 'sending'
    const wrapper = await mountView()
    await wrapper.vm.$nextTick()

    // 36-05: moved-and-restyled-control edit — the bottom-of-list add control is now the
    // always-visible palette (no open/closed state); `addSlot`'s logic and arguments are unchanged.
    const songBtn = wrapper.find('[data-testid="palette-add-song"]')
    await songBtn.trigger('click')
    await wrapper.vm.$nextTick()

    const sendingCards = wrapper.find('[data-testid="section-list-sending"]').findAll('.slot-item')
    expect(sendingCards).toHaveLength(2)
    expect(wrapper.find('[data-testid="section-list-ungrouped"]').exists()).toBe(false)
  })

  it('does not mount PresentationViewer on initial render', async () => {
    mockServicesList = [buildSectionedService()]
    const wrapper = await mountView()

    expect(wrapper.find('[data-testid="presentation-viewer-stub"]').exists()).toBe(false)
  })

  it('mounts PresentationViewer when the Slides tab emits present (D-05), and unmounts it when PresentationViewer emits exit', async () => {
    mockServicesList = [buildSectionedService()]
    const wrapper = await mountView()

    await wrapper.findComponent(SlidesTab).vm.$emit('present')
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[data-testid="presentation-viewer-stub"]').exists()).toBe(true)

    await wrapper.findComponent(PresentationViewer).vm.$emit('exit')
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[data-testid="presentation-viewer-stub"]').exists()).toBe(false)
  })

  it('passes the same assembledSlideshow array instance to PresentationViewer across re-renders, confirming it is not rebuilt locally', async () => {
    mockServicesList = [buildSectionedService()]
    const wrapper = await mountView()

    await wrapper.findComponent(SlidesTab).vm.$emit('present')
    await wrapper.vm.$nextTick()

    const viewer = wrapper.findComponent(PresentationViewer)
    expect(viewer.exists()).toBe(true)
    const firstSlides = viewer.props('slides')
    expect(Array.isArray(firstSlides)).toBe(true)

    // Force a re-render with no underlying data change — a locally rebuilt
    // (re-flattened) array would produce a new reference here; the
    // composable's memoized `assembledSlideshow` computed does not.
    await wrapper.vm.$nextTick()
    const secondSlides = wrapper.findComponent(PresentationViewer).props('slides')
    expect(secondSlides).toBe(firstSlides)
  })

  it('editor: a per-row ⋯ menu is present for each slot and its Move-to-section item mutates slot.section through the existing localService path (260811-vsr)', async () => {
    mockServicesList = [buildSectionedService()]
    const wrapper = await mountView()

    const triggers = wrapper.findAll('[data-testid^="row-menu-trigger-"]')
    // 4 slots in buildSectionedService(), one ⋯ menu per slot
    expect(triggers).toHaveLength(4)
    // slot 3 (SONG, currently 'sending') -> reassign to 'worship' via its ⋯ menu.
    const slots = (wrapper.vm as unknown as { localService: { slots: Array<{ section?: string }> } }).localService.slots
    expect(slots[3]!.section).toBe('sending')
    await moveSlotViaRowMenu(wrapper, 3, 'worship')
    // Section-major reindex moves the slot; find it by id and confirm its new section.
    const moved = (wrapper.vm as unknown as { localService: { slots: Array<{ id: string; section?: string }> } })
      .localService.slots.find((s) => s.id === 'slot-3')
    expect(moved?.section).toBe('worship')
  })

  it('non-editor: no per-row ⋯ menu (and no legacy section select) renders (260811-vsr)', async () => {
    mockAuthState.isEditor = false
    mockServicesList = [buildSectionedService()]
    const wrapper = await mountView()

    expect(wrapper.find('[data-testid^="row-menu-trigger-"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="section-select"]').exists()).toBe(false)
  })
})

// ── 260811-vsr: per-row ⋯ menu owns Move-to-section + Delete ─────────────────────

describe('ServiceEditorView - per-row ⋯ menu (260811-vsr)', () => {
  interface MenuVm {
    localService: { slots: Array<{ id: string; section?: string }> }
  }

  async function mountView() {
    const { default: ServiceEditorView } = await import('@/views/ServiceEditorView.vue')
    return shallowMount(ServiceEditorView, {
      global: {
        stubs: {
          AppShell: { template: '<div><slot /></div>' },
          ContextualActionBar: false,
          RouterLink: { template: '<a><slot /></a>' },
          SaveStatusIndicator: false,
          ServicePrintLayout: true,
          SongBadge: true,
          SongSlotPicker: true,
          ScriptureInput: true,
          PresentationViewer: true,
          // Delete opens the D-14 confirm dialog via <Teleport to="body">.
          teleport: false,
        },
      },
    })
  }

  function body() {
    return new DOMWrapper(document.body)
  }

  beforeEach(() => {
    mockAuthState.isEditor = true
    mockAuthState.orgId = 'org-1'
    mockServicesList = [buildSectionedService()]
  })

  it('opens one menu at a time and closes it on outside-click (backdrop)', async () => {
    const wrapper = await mountView()

    const row0 = wrapper.find('[data-testid="slot-0"]')
    const id0 = row0.attributes('data-slot-id')!
    await row0.find(`[data-testid="row-menu-trigger-${id0}"]`).trigger('click')
    await wrapper.vm.$nextTick()
    expect(wrapper.find(`[data-testid="row-menu-panel-${id0}"]`).exists()).toBe(true)

    // Opening another row's menu closes the first (single-open, keyed on slot.id).
    const row1 = wrapper.find('[data-testid="slot-1"]')
    const id1 = row1.attributes('data-slot-id')!
    await row1.find(`[data-testid="row-menu-trigger-${id1}"]`).trigger('click')
    await wrapper.vm.$nextTick()
    expect(wrapper.find(`[data-testid="row-menu-panel-${id0}"]`).exists()).toBe(false)
    expect(wrapper.find(`[data-testid="row-menu-panel-${id1}"]`).exists()).toBe(true)

    // Clicking the backdrop closes the open menu.
    await wrapper.find('div.fixed.inset-0.z-10').trigger('click')
    await wrapper.vm.$nextTick()
    expect(wrapper.find(`[data-testid="row-menu-panel-${id1}"]`).exists()).toBe(false)
  })

  it('a Move-to-section item calls onSectionChange and reassigns slot.section, then closes the menu', async () => {
    const wrapper = await mountView()

    // slot-3 (SONG) starts in 'sending'; move it to 'worship' via its ⋯ menu.
    const vm = wrapper.vm as unknown as MenuVm
    expect(vm.localService.slots.find((s) => s.id === 'slot-3')?.section).toBe('sending')

    await moveSlotViaRowMenu(wrapper, 3, 'worship')

    expect(vm.localService.slots.find((s) => s.id === 'slot-3')?.section).toBe('worship')
    // Menu closed after selection.
    expect(wrapper.find('[data-testid="row-menu-panel-slot-3"]').exists()).toBe(false)
  })

  it('the No-section item reassigns slot.section to undefined', async () => {
    const wrapper = await mountView()
    const vm = wrapper.vm as unknown as MenuVm

    await moveSlotViaRowMenu(wrapper, 0, '') // slot-0 was 'worship'

    expect(vm.localService.slots.find((s) => s.id === 'slot-0')?.section).toBeUndefined()
  })

  it('the Delete item opens the remove-confirm dialog and confirming removes the slot', async () => {
    const wrapper = await mountView()
    const vm = wrapper.vm as unknown as MenuVm
    const before = vm.localService.slots.length

    await deleteSlotViaRowMenu(wrapper, 0)

    // D-14: Delete opens the confirm dialog rather than removing immediately.
    const confirmBtn = body().findAll('button').find((b) => b.text() === 'Remove')
    expect(confirmBtn).toBeDefined()
    await confirmBtn!.trigger('click')
    await wrapper.vm.$nextTick()

    expect(vm.localService.slots).toHaveLength(before - 1)
  })
})

// ── Section-band headers: slide count + per-band add (36-04, R067) ─────────────

describe('ServiceEditorView - section-band slide count and per-band add (36-04, R067)', () => {
  async function mountView() {
    const { default: ServiceEditorView } = await import('@/views/ServiceEditorView.vue')
    return shallowMount(ServiceEditorView, {
      global: {
        stubs: {
          AppShell: { template: '<div><slot /></div>' },
          // 36-03: Suggest/Export/Copy/Save/Present all moved into this real
          // child component (ContextualActionBar.vue) — every mountView in
          // this file must render it for real (`false` opts a component OUT
          // of shallowMount's default auto-stub) or none of those controls'
          // pre-existing testids/text are reachable in the DOM anymore.
          ContextualActionBar: false,
          RouterLink: { template: '<a><slot /></a>' },
          SaveStatusIndicator: false,
          ServicePrintLayout: true,
          SongBadge: true,
          SongSlotPicker: true,
          ScriptureInput: true,
          PresentationViewer: true,
        },
      },
    })
  }

  beforeEach(() => {
    mockAuthState.isEditor = true
    mockAuthState.orgId = 'org-1'
    mockServicesList = [buildSectionedService()]
  })

  function headerCountText(wrapper: Awaited<ReturnType<typeof mountView>>, key: string): string {
    return wrapper.find(`[data-testid="section-slide-count-${key}"]`).text()
  }

  async function openBand(wrapper: Awaited<ReturnType<typeof mountView>>, key: string) {
    await wrapper.find(`[data-testid="section-add-item-${key}"]`).trigger('click')
    await wrapper.vm.$nextTick()
  }

  async function clickChip(wrapper: Awaited<ReturnType<typeof mountView>>, key: string, kind: string) {
    await wrapper.find(`[data-testid="section-add-${kind}-${key}"]`).trigger('click')
    await wrapper.vm.$nextTick()
  }

  it('all five band headers carry a label, a slide count and an add-item link for an editor on an unlocked service', async () => {
    const wrapper = await mountView()

    const headers = wrapper.findAll('[data-testid^="section-header-"]')
    expect(headers).toHaveLength(5)
    for (const key of ['pre-service', 'worship', 'message', 'sending', 'post-service']) {
      const header = wrapper.find(`[data-testid="section-header-${key}"]`)
      expect(header.exists()).toBe(true)
      expect(header.find(`[data-testid="section-slide-count-${key}"]`).exists()).toBe(true)
      expect(header.find(`[data-testid="section-add-item-${key}"]`).exists()).toBe(true)
    }
  })

  it('still renders exactly 5 headers with a legacy ungrouped slot present, and the ungrouped bucket gets no count or add-item', async () => {
    mockServicesList = [{
      ...buildSectionedService(),
      slots: [...buildSectionedService().slots, { kind: 'PRAYER', id: 'legacy-1', position: 4 }],
    }]
    const wrapper = await mountView()

    expect(wrapper.findAll('[data-testid^="section-header-"]')).toHaveLength(5)
    expect(wrapper.find('[data-testid="section-list-ungrouped"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="section-slide-count-ungrouped"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="section-add-item-ungrouped"]').exists()).toBe(false)
  })

  // ── 260811-vsr: muted/dashed "No Section" band for the ungrouped bucket ──────
  it('renders a muted/dashed no-section-band labeled "No Section" when a legacy/ungrouped slot is present, distinct from the 5 real section headers', async () => {
    mockServicesList = [{
      ...buildSectionedService(),
      slots: [...buildSectionedService().slots, { kind: 'PRAYER', id: 'legacy-1', position: 4 }],
    }]
    const wrapper = await mountView()

    const band = wrapper.find('[data-testid="no-section-band"]')
    expect(band.exists()).toBe(true)
    expect(band.text()).toContain('No Section')
    // Muted/dashed styling, distinct from a real section header.
    expect(band.classes()).toContain('border-dashed')
    // It is NOT one of the real section headers, and carries no count/add-item control.
    expect(wrapper.findAll('[data-testid^="section-header-"]')).toHaveLength(5)
    expect(band.attributes('data-testid')).not.toMatch(/^section-header-/)
    expect(wrapper.find('[data-testid="section-slide-count-ungrouped"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="section-add-item-ungrouped"]').exists()).toBe(false)
  })

  it('does not render the no-section-band when every slot is sectioned', async () => {
    mockServicesList = [buildSectionedService()] // all four slots carry a section
    const wrapper = await mountView()

    expect(wrapper.find('[data-testid="section-list-ungrouped"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="no-section-band"]').exists()).toBe(false)
  })

  it('reads singular "1 slide" for worship and message, and "0 slides" for the sending band whose one slot contributes no assembled slide', async () => {
    // buildSectionedService: worship = [SONG w/ songId but no lyrics loaded (0) + SCRIPTURE (1)] = 1;
    // message = [MESSAGE (1)] = 1; sending = [SONG w/ no songId (0)] = 0 despite having one slot.
    const wrapper = await mountView()

    expect(headerCountText(wrapper, 'worship')).toBe('1 slide')
    expect(headerCountText(wrapper, 'message')).toBe('1 slide')
    expect(headerCountText(wrapper, 'sending')).toBe('0 slides')
  })

  it('reads plural "2 slides" for a band whose slots contribute more than one assembled slide', async () => {
    // makeSectionedService's message band holds MESSAGE (1) + PRAYER (1) = 2.
    mockServicesList = [makeSectionedService()]
    const wrapper = await mountView()

    expect(headerCountText(wrapper, 'message')).toBe('2 slides')
  })

  it('an empty band (pre-service, no slots in this fixture) still renders its header, a "0 slides" count, its add-item link, and the existing empty-band placeholder verbatim', async () => {
    const wrapper = await mountView()

    expect(wrapper.find('[data-testid="section-header-pre-service"]').exists()).toBe(true)
    expect(headerCountText(wrapper, 'pre-service')).toBe('0 slides')
    expect(wrapper.find('[data-testid="section-add-item-pre-service"]').exists()).toBe(true)
    const placeholder = wrapper.find('[data-testid="section-empty-pre-service"]')
    expect(placeholder.exists()).toBe(true)
    expect(placeholder.text()).toContain('No items yet')
    expect(placeholder.text()).toContain('Drag an item here, or set its Section to Pre-Service.')
  })

  it('clicking a band add-item link opens exactly 6 chips (43-03: Hymn retired, Announcements/Misc added); clicking it again closes it; opening another band closes the first', async () => {
    const wrapper = await mountView()

    await openBand(wrapper, 'worship')
    const menu = wrapper.find('[data-testid="section-add-menu-worship"]')
    expect(menu.exists()).toBe(true)
    expect(menu.findAll('button')).toHaveLength(6)

    await openBand(wrapper, 'worship') // toggle closed
    expect(wrapper.find('[data-testid="section-add-menu-worship"]').exists()).toBe(false)

    await openBand(wrapper, 'worship')
    await openBand(wrapper, 'sending') // opening sending closes worship
    expect(wrapper.find('[data-testid="section-add-menu-worship"]').exists()).toBe(false)
    expect(wrapper.findAll('[data-testid^="section-add-menu-"]')).toHaveLength(1)
    expect(wrapper.find('[data-testid="section-add-menu-sending"]').exists()).toBe(true)
  })

  it('backstop: clicking worship\'s add-item then the Prayer chip lands the new slot in worship while the service\'s last slot (sending) is unchanged', async () => {
    // buildSectionedService's last slot (slot-3) is in 'sending'.
    const wrapper = await mountView()

    const worshipBefore = wrapper.find('[data-testid="section-list-worship"]').findAll('.slot-item')
    expect(worshipBefore).toHaveLength(2)

    await openBand(wrapper, 'worship')
    await clickChip(wrapper, 'worship', 'prayer')

    const worshipAfter = wrapper.find('[data-testid="section-list-worship"]').findAll('.slot-item')
    expect(worshipAfter).toHaveLength(3)
    const sendingAfter = wrapper.find('[data-testid="section-list-sending"]').findAll('.slot-item')
    expect(sendingAfter.map((c) => c.attributes('data-slot-id'))).toEqual(['slot-3'])
    // the chip row closes itself after adding
    expect(wrapper.find('[data-testid="section-add-menu-worship"]').exists()).toBe(false)
  })

  it('clicking a chip twice, reopening the row between clicks, adds exactly two slots', async () => {
    const wrapper = await mountView()

    await openBand(wrapper, 'sending')
    await clickChip(wrapper, 'sending', 'song')
    await openBand(wrapper, 'sending')
    await clickChip(wrapper, 'sending', 'song')

    const sendingCards = wrapper.find('[data-testid="section-list-sending"]').findAll('.slot-item')
    // sending started with 1 slot (slot-3); +2 = 3
    expect(sendingCards).toHaveLength(3)
  })

  it('two successive targeted adds into two different bands each land in their own band', async () => {
    const wrapper = await mountView()

    await openBand(wrapper, 'worship')
    await clickChip(wrapper, 'worship', 'scripture')
    await openBand(wrapper, 'sending')
    await clickChip(wrapper, 'sending', 'misc')

    expect(wrapper.find('[data-testid="section-list-worship"]').findAll('.slot-item')).toHaveLength(3)
    expect(wrapper.find('[data-testid="section-list-sending"]').findAll('.slot-item')).toHaveLength(2)
  })

  it('an empty band\'s add-item routes the new slot into that band as its only entry (E5)', async () => {
    const wrapper = await mountView()
    expect(wrapper.find('[data-testid="section-list-pre-service"]').findAll('.slot-item')).toHaveLength(0)

    await openBand(wrapper, 'pre-service')
    await clickChip(wrapper, 'pre-service', 'song')

    const preServiceCards = wrapper.find('[data-testid="section-list-pre-service"]').findAll('.slot-item')
    expect(preServiceCards).toHaveLength(1)
    expect(wrapper.find('[data-testid="section-empty-pre-service"]').exists()).toBe(false)
  })

  it('locked service: no per-band add-item links or chip menus render, while every header, label and count still does', async () => {
    mockServicesList = [{ ...buildSectionedService(), status: 'planned' }]
    const wrapper = await mountView()

    expect(wrapper.findAll('[data-testid^="section-add-item-"]')).toHaveLength(0)
    expect(wrapper.findAll('[data-testid^="section-add-menu-"]')).toHaveLength(0)
    expect(wrapper.findAll('[data-testid^="section-header-"]')).toHaveLength(5)
    for (const key of ['pre-service', 'worship', 'message', 'sending', 'post-service']) {
      expect(wrapper.find(`[data-testid="section-slide-count-${key}"]`).exists()).toBe(true)
    }
  })

  it('viewer: no per-band add-item links or chip menus render, while every header, label and count still does', async () => {
    mockAuthState.isEditor = false
    const wrapper = await mountView()

    expect(wrapper.findAll('[data-testid^="section-add-item-"]')).toHaveLength(0)
    expect(wrapper.findAll('[data-testid^="section-add-menu-"]')).toHaveLength(0)
    expect(wrapper.findAll('[data-testid^="section-header-"]')).toHaveLength(5)
  })

  it('re-rendering a band does not duplicate its header, its count or its add-item link (idempotency)', async () => {
    const wrapper = await mountView()
    await wrapper.vm.$nextTick()
    await wrapper.vm.$nextTick()

    expect(wrapper.findAll('[data-testid="section-header-worship"]')).toHaveLength(1)
    expect(wrapper.findAll('[data-testid="section-slide-count-worship"]')).toHaveLength(1)
    expect(wrapper.findAll('[data-testid="section-add-item-worship"]')).toHaveLength(1)
  })

  it('drag-reorder is untouched by the header rebuild: the total slot-item count matches the fixture and every Sortable capture still targets a section-list container', async () => {
    resetSortableCaptures()
    const wrapper = await mountView()
    await wrapper.vm.$nextTick()

    expect(wrapper.findAll('.slot-item')).toHaveLength(buildSectionedService().slots.length)
    expect(captureForSection('worship')).toBeDefined()
    expect(captureForSection('sending')).toBeDefined()
  })
})

// ── Add-to-service palette (36-05, R067) ─────────────────────────────────────────

describe('ServiceEditorView - add-to-service palette (36-05, R067)', () => {
  interface SlotsVm {
    localService: { slots: Array<Record<string, unknown>> }
  }

  async function mountView() {
    const { default: ServiceEditorView } = await import('@/views/ServiceEditorView.vue')
    return shallowMount(ServiceEditorView, {
      global: {
        stubs: {
          AppShell: { template: '<div><slot /></div>' },
          // 36-03: Suggest/Export/Copy/Save/Present all moved into this real
          // child component (ContextualActionBar.vue) — every mountView in
          // this file must render it for real (`false` opts a component OUT
          // of shallowMount's default auto-stub) or none of those controls'
          // pre-existing testids/text are reachable in the DOM anymore.
          ContextualActionBar: false,
          RouterLink: { template: '<a><slot /></a>' },
          SaveStatusIndicator: false,
          ServicePrintLayout: true,
          SongBadge: true,
          SongSlotPicker: true,
          ScriptureInput: true,
          PresentationViewer: true,
        },
      },
    })
  }

  beforeEach(() => {
    mockAuthState.isEditor = true
    mockAuthState.orgId = 'org-1'
    mockServicesList = [buildSectionedService()]
  })

  it('renders exactly six chips in order, with the six palette-add-* testids and the labels Song/Scripture/Prayer/Message/Announcements/Miscellaneous, and NO Hymn chip (43-03, R084 easy half)', async () => {
    const wrapper = await mountView()

    const palette = wrapper.find('[data-testid="add-to-service-palette"]')
    expect(palette.exists()).toBe(true)
    const buttons = palette.findAll('button')
    expect(buttons).toHaveLength(6)
    const testids = buttons.map((b) => b.attributes('data-testid'))
    expect(testids).toEqual([
      'palette-add-song',
      'palette-add-scripture',
      'palette-add-prayer',
      'palette-add-message',
      'palette-add-announcements',
      'palette-add-misc',
    ])
    expect(buttons.map((b) => b.text())).toEqual(['Song', 'Scripture', 'Prayer', 'Message', 'Announcements', 'Miscellaneous'])
    // Explicit negative: the Hymn palette testid is not among the six — a chip
    // count alone does not prove R084's palette-retirement half.
    expect(testids).not.toContain('palette-add-hymn')
  })

  it('no button anywhere in the view has the old "Add Element" label, and there is no click-away backdrop or floating panel', async () => {
    const wrapper = await mountView()

    expect(wrapper.findAll('button').some((b) => b.text() === 'Add Element')).toBe(false)
    // the old dropdown's click-away backdrop was `class="fixed inset-0 z-10"` — asserting
    // no such element exists anywhere proves it was deleted, not merely hidden.
    expect(wrapper.find('.fixed.inset-0.z-10').exists()).toBe(false)
  })

  it('the palette chips are queryable and clickable immediately after mount, with no prior interaction: clicking palette-add-song on first render still adds a slot', async () => {
    const wrapper = await mountView()
    const before = (wrapper.vm as unknown as SlotsVm).localService.slots.length

    await wrapper.find('[data-testid="palette-add-song"]').trigger('click')
    await wrapper.vm.$nextTick()

    expect((wrapper.vm as unknown as SlotsVm).localService.slots).toHaveLength(before + 1)
    // the palette itself has no open/closed state — it is still fully rendered after the click
    expect(wrapper.find('[data-testid="add-to-service-palette"]').exists()).toBe(true)
  })

  it('clicking palette-add-song appends a SONG slot with the same vw-type the old menu entry produced (requiredVwType 2), inheriting the last slot\'s section', async () => {
    const wrapper = await mountView()
    const beforeIds = new Set((wrapper.vm as unknown as SlotsVm).localService.slots.map((s) => s.id))

    await wrapper.find('[data-testid="palette-add-song"]').trigger('click')
    await wrapper.vm.$nextTick()

    const slots = (wrapper.vm as unknown as SlotsVm).localService.slots
    const created = slots.find((s) => !beforeIds.has(s.id))
    expect(created).toBeDefined()
    const { id, position, ...rest } = created!
    expect(id).toEqual(expect.any(String))
    expect(position).toEqual(expect.any(Number))
    // buildSectionedService's last slot (slot-3) is in 'sending' — the palette omits a
    // targetSection, so addSlot's inherit-from-last-slot fallback applies, exactly as the
    // dropdown entry it replaces did.
    expect(rest).toEqual({
      kind: 'SONG',
      requiredVwType: 2,
      songId: null,
      songTitle: null,
      songKey: null,
      section: 'sending',
    })
  })

  it.each([
    ['palette-add-scripture', 'SCRIPTURE'],
    ['palette-add-prayer', 'PRAYER'],
    ['palette-add-message', 'MESSAGE'],
    ['palette-add-announcements', 'ANNOUNCEMENTS'],
    ['palette-add-misc', 'MISC'],
  ])('clicking %s appends a slot of kind %s', async (testid, kind) => {
    const wrapper = await mountView()
    const before = (wrapper.vm as unknown as SlotsVm).localService.slots.length

    await wrapper.find(`[data-testid="${testid}"]`).trigger('click')
    await wrapper.vm.$nextTick()

    const slots = (wrapper.vm as unknown as SlotsVm).localService.slots
    expect(slots).toHaveLength(before + 1)
    expect(slots[slots.length - 1]!.kind).toBe(kind)
  })

  it('clicking palette-add-prayer twice, with no intervening open/close, appends exactly two slots', async () => {
    const wrapper = await mountView()
    const before = (wrapper.vm as unknown as SlotsVm).localService.slots.length

    await wrapper.find('[data-testid="palette-add-prayer"]').trigger('click')
    await wrapper.vm.$nextTick()
    await wrapper.find('[data-testid="palette-add-prayer"]').trigger('click')
    await wrapper.vm.$nextTick()

    const slots = (wrapper.vm as unknown as SlotsVm).localService.slots
    expect(slots).toHaveLength(before + 2)
    expect(slots.slice(-2).every((s) => s.kind === 'PRAYER')).toBe(true)
  })

  it('no import/PowerPoint entry exists in the palette', async () => {
    const wrapper = await mountView()

    const palette = wrapper.find('[data-testid="add-to-service-palette"]')
    expect(palette.text()).not.toContain('Import')
    expect(palette.text()).not.toContain('PowerPoint')
  })

  it('viewer: the palette does not render', async () => {
    mockAuthState.isEditor = false
    const wrapper = await mountView()

    expect(wrapper.find('[data-testid="add-to-service-palette"]').exists()).toBe(false)
  })

  it('locked (planned) service: the palette does not render', async () => {
    mockServicesList = [{ ...buildSectionedService(), status: 'planned' }]
    const wrapper = await mountView()

    expect(wrapper.find('[data-testid="add-to-service-palette"]').exists()).toBe(false)
  })
})

// ── Shared body editor: Message/Announcements/Misc, Hymn palette retirement (43-03) ──
// Probe edges owned by this plan: E-02, E-06, E-09, E-11, E-12, E-16 (43-03-PLAN.md
// § Probe Edge Coverage). UI-SPEC covered considerations: empty, populated, palette
// exclusivity, data-retention, zero-one-many, and the lifted UI-06 (elementLabel copy).

describe('ServiceEditorView - shared body editor: Message/Announcements/Misc, Hymn palette retirement (43-03)', () => {
  interface SlotsVm {
    localService: { slots: Array<Record<string, unknown>> }
  }

  async function mountView() {
    const { default: ServiceEditorView } = await import('@/views/ServiceEditorView.vue')
    return shallowMount(ServiceEditorView, {
      global: {
        stubs: {
          AppShell: { template: '<div><slot /></div>' },
          ContextualActionBar: false,
          RouterLink: { template: '<a><slot /></a>' },
          SaveStatusIndicator: false,
          ServicePrintLayout: true,
          SongBadge: true,
          SongSlotPicker: true,
          // Stub ScriptureInput but render its `version` slot, so the slotted
          // per-item Bible-version selector (R128) is reachable in the DOM.
          ScriptureInput: { template: '<div class="scripture-input-stub"><slot name="version" /></div>' },
          PresentationViewer: true,
          // The MISC badge is now an inline-editable child (MiscLabelBadge);
          // render it for real so its badge/input testids are reachable.
          MiscLabelBadge: false,
          // D-14's slot-delete confirmation renders via <Teleport to="body"> —
          // opt it out of shallowMount's default auto-stub so UI-06's test can
          // read the confirm dialog's body text from document.body.
          teleport: false,
        },
      },
    })
  }

  function body() {
    return new DOMWrapper(document.body)
  }

  async function openBand(wrapper: Awaited<ReturnType<typeof mountView>>, key: string) {
    await wrapper.find(`[data-testid="section-add-item-${key}"]`).trigger('click')
    await wrapper.vm.$nextTick()
  }

  beforeEach(() => {
    mockAuthState.isEditor = true
    mockAuthState.orgId = 'org-1'
    mockServicesList = [buildSectionedService()]
  })

  // ── Palette membership (R084 easy half, UI-03) ──────────────────────────────

  it('the per-section inline chip row renders Announcements and Misc, and no Hymn chip', async () => {
    const wrapper = await mountView()
    await openBand(wrapper, 'worship')

    const menu = wrapper.find('[data-testid="section-add-menu-worship"]')
    expect(menu.find('[data-testid="section-add-announcements-worship"]').exists()).toBe(true)
    expect(menu.find('[data-testid="section-add-misc-worship"]').exists()).toBe(true)
    expect(menu.find('[data-testid="section-add-hymn-worship"]').exists()).toBe(false)
  })

  // ── UI-05: zero-one-many, no new quantity constraint ────────────────────────

  it('UI-05: clicking Announcements twice appends two distinct slots; the same for Miscellaneous', async () => {
    const wrapper = await mountView()
    const before = (wrapper.vm as unknown as SlotsVm).localService.slots.length

    await wrapper.find('[data-testid="palette-add-announcements"]').trigger('click')
    await wrapper.vm.$nextTick()
    await wrapper.find('[data-testid="palette-add-announcements"]').trigger('click')
    await wrapper.vm.$nextTick()

    let slots = (wrapper.vm as unknown as SlotsVm).localService.slots
    expect(slots).toHaveLength(before + 2)
    const firstTwoNew = slots.slice(-2)
    expect(firstTwoNew.every((s) => s.kind === 'ANNOUNCEMENTS')).toBe(true)
    expect(firstTwoNew[0]!.id).not.toBe(firstTwoNew[1]!.id)

    await wrapper.find('[data-testid="palette-add-misc"]').trigger('click')
    await wrapper.vm.$nextTick()
    await wrapper.find('[data-testid="palette-add-misc"]').trigger('click')
    await wrapper.vm.$nextTick()

    slots = (wrapper.vm as unknown as SlotsVm).localService.slots
    expect(slots).toHaveLength(before + 4)
    const lastTwoNew = slots.slice(-2)
    expect(lastTwoNew.every((s) => s.kind === 'MISC')).toBe(true)
    expect(lastTwoNew[0]!.id).not.toBe(lastTwoNew[1]!.id)
  })

  // ── E-02 / UI-01: consolidated notes-canonical field, ANNOUNCEMENTS (260811-vsr) ─
  // Plain kinds now show ONE field (the notes-canonical field). A legacy body-only
  // slot still displays via the `notes ?? body` fallback; the old `slot-body-input`
  // textarea and `slot-body-empty` placeholder are gone.

  it('E-02: a legacy body-only ANNOUNCEMENTS shows its text via notes ?? body in the viewer, and an empty one renders the consolidated field with the ANNOUNCEMENTS placeholder in the editor, with no error styling', async () => {
    mockServicesList = [{
      ...buildSectionedService(),
      slots: [{ kind: 'ANNOUNCEMENTS', id: 'a1', position: 0, body: 'Potluck this Sunday' }],
    }]
    mockAuthState.isEditor = false
    const viewerWrapper = await mountView()

    const text = viewerWrapper.find('[data-testid="slot-notes-text"]')
    expect(text.exists()).toBe(true)
    expect(text.text()).toBe('Potluck this Sunday')
    expect(viewerWrapper.find('[data-testid="slot-body-input"]').exists()).toBe(false)
    expect(viewerWrapper.findAll('.text-red-400').length + viewerWrapper.findAll('.text-red-500').length).toBe(0)

    mockServicesList = [{
      ...buildSectionedService(),
      slots: [{ kind: 'ANNOUNCEMENTS', id: 'a2', position: 0 }],
    }]
    mockAuthState.isEditor = true
    const editorWrapper = await mountView()
    const input = editorWrapper.find('[data-testid="slot-notes-input"]')
    expect(input.exists()).toBe(true)
    expect((input.element as HTMLInputElement).value).toBe('')
    expect(input.attributes('placeholder')).toBe('Church-wide announcements')
    expect(editorWrapper.find('[data-testid="slot-body-input"]').exists()).toBe(false)
  })

  // ── E-06: the same predicate, independently, for MISC (260811-vsr) ──────────

  it('E-06: a legacy body-only MISC shows its text via notes ?? body in the viewer, and an empty one renders the consolidated field with the MISC placeholder in the editor, with no error styling', async () => {
    mockServicesList = [{
      ...buildSectionedService(),
      slots: [{ kind: 'MISC', id: 'x1', position: 0, body: 'Building closes early Monday' }],
    }]
    mockAuthState.isEditor = false
    const viewerWrapper = await mountView()

    const text = viewerWrapper.find('[data-testid="slot-notes-text"]')
    expect(text.exists()).toBe(true)
    expect(text.text()).toBe('Building closes early Monday')
    expect(viewerWrapper.find('[data-testid="slot-body-input"]').exists()).toBe(false)
    expect(viewerWrapper.findAll('.text-red-400').length + viewerWrapper.findAll('.text-red-500').length).toBe(0)

    mockServicesList = [{
      ...buildSectionedService(),
      slots: [{ kind: 'MISC', id: 'x2', position: 0 }],
    }]
    mockAuthState.isEditor = true
    const editorWrapper = await mountView()
    const input = editorWrapper.find('[data-testid="slot-notes-input"]')
    expect(input.exists()).toBe(true)
    expect((input.element as HTMLInputElement).value).toBe('')
    expect(input.attributes('placeholder')).toBe('Details')
  })

  // ── R127 (Phase 56 → 2026-08-12): MISC label edited INLINE on the badge pill ───
  // The separate label input was replaced by an editable badge (MiscLabelBadge):
  // click the pill (testid slot-misc-<i>-badge) to reveal the inline input
  // (slot-misc-<i>-input); blur/Enter commits, empty clears to undefined.

  it('R127: editing the MISC badge sets slot.label; clearing it to empty yields undefined', async () => {
    mockServicesList = [{
      ...buildSectionedService(),
      slots: [{ kind: 'MISC', id: 'ml1', position: 0 }],
    }]
    mockAuthState.isEditor = true
    const wrapper = await mountView()

    // The pill IS the editable surface — no separate label input until clicked.
    const badge = wrapper.find('[data-testid="slot-misc-0-badge"]')
    expect(badge.exists()).toBe(true)
    expect(badge.text()).toContain('Miscellaneous')
    expect(wrapper.find('[data-testid="slot-misc-0-input"]').exists()).toBe(false)

    await badge.trigger('click')
    const input = wrapper.find('[data-testid="slot-misc-0-input"]')
    expect(input.exists()).toBe(true)
    await input.setValue('Communion')
    await input.trigger('blur')
    await wrapper.vm.$nextTick()
    let slots = (wrapper.vm as unknown as SlotsVm).localService.slots
    expect((slots[0] as unknown as { label?: string }).label).toBe('Communion')

    // Re-open and clear → undefined (stripUndefined-friendly).
    await wrapper.find('[data-testid="slot-misc-0-badge"]').trigger('click')
    const input2 = wrapper.find('[data-testid="slot-misc-0-input"]')
    await input2.setValue('')
    await input2.trigger('blur')
    await wrapper.vm.$nextTick()
    slots = (wrapper.vm as unknown as SlotsVm).localService.slots
    expect((slots[0] as unknown as { label?: string }).label).toBeUndefined()
  })

  it('R127: the MISC badge is a static (non-editable) pill for viewers, showing the label', async () => {
    mockServicesList = [{
      ...buildSectionedService(),
      slots: [{ kind: 'MISC', id: 'ml2', position: 0, label: 'Communion' }],
    }]
    mockAuthState.isEditor = false
    const wrapper = await mountView()

    const badge = wrapper.find('[data-testid="slot-misc-0-badge"]')
    expect(badge.exists()).toBe(true)
    expect(badge.element.tagName).toBe('SPAN') // static, not a <button>
    expect(badge.text()).toContain('Communion')
    // Not editable: clicking reveals no input.
    await badge.trigger('click')
    expect(wrapper.find('[data-testid="slot-misc-0-input"]').exists()).toBe(false)
  })

  it('R127: an unlabeled MISC shows "Miscellaneous" on the viewer badge', async () => {
    mockServicesList = [{
      ...buildSectionedService(),
      slots: [{ kind: 'MISC', id: 'ml3', position: 0 }],
    }]
    mockAuthState.isEditor = false
    const wrapper = await mountView()

    const badge = wrapper.find('[data-testid="slot-misc-0-badge"]')
    expect(badge.exists()).toBe(true)
    expect(badge.text()).toContain('Miscellaneous')
  })

  // ── R128 (Phase 56): per-item Scripture Bible-version selector ───────────────

  it('R128: the Scripture-row version selector round-trips (choose NLT -> slot.bibleVersion, choose Default -> undefined)', async () => {
    mockServicesList = [{
      ...buildSectionedService(),
      slots: [{ kind: 'SCRIPTURE', id: 'sv1', position: 0, book: 'Psalms', chapter: 23, verseStart: 1, verseEnd: 6, section: 'worship' }],
    }]
    mockAuthState.isEditor = true
    const wrapper = await mountView()

    const select = wrapper.find('[data-testid="slot-scripture-version"]')
    expect(select.exists()).toBe(true)
    // Unset slot => selector reflects the "Default" (empty) option.
    expect((select.element as HTMLSelectElement).value).toBe('')

    await select.setValue('NLT')
    await wrapper.vm.$nextTick()
    let slots = (wrapper.vm as unknown as SlotsVm).localService.slots
    expect((slots[0] as unknown as { bibleVersion?: string }).bibleVersion).toBe('NLT')

    await select.setValue('')
    await wrapper.vm.$nextTick()
    slots = (wrapper.vm as unknown as SlotsVm).localService.slots
    expect((slots[0] as unknown as { bibleVersion?: string }).bibleVersion).toBeUndefined()
  })

  it('R128: the version selector is absent for viewers (non-canEditService)', async () => {
    mockServicesList = [{
      ...buildSectionedService(),
      slots: [{ kind: 'SCRIPTURE', id: 'sv2', position: 0, book: 'Psalms', chapter: 23, verseStart: 1, verseEnd: 6, section: 'worship' }],
    }]
    mockAuthState.isEditor = false
    const wrapper = await mountView()

    expect(wrapper.find('[data-testid="slot-scripture-version"]').exists()).toBe(false)
  })

  // ── UI-02: legacy body round-trips into the read-only viewer via notes ?? body ─

  it('a legacy MESSAGE body renders read-only with preserved line breaks in the viewer, via the notes ?? body fallback (260811-vsr)', async () => {
    const populatedBody = 'Line one\nLine two'
    mockServicesList = [{
      ...buildSectionedService(),
      slots: [{ kind: 'MESSAGE', id: 'm1', position: 0, body: populatedBody }],
    }]
    mockAuthState.isEditor = false
    const wrapper = await mountView()

    const text = wrapper.find('[data-testid="slot-notes-text"]')
    expect(text.exists()).toBe(true)
    // .text() collapses whitespace (including the embedded newline) per VTU's
    // normalization — assert the exact preserved-newline content via textContent.
    // The consolidated field's viewer <p> keeps whitespace-pre-wrap.
    expect(text.element.textContent).toBe(populatedBody)
    expect(wrapper.find('[data-testid="slot-body-text"]').exists()).toBe(false)
  })

  // ── E-09: adjacency — two MESSAGE slots stay independent (260811-vsr) ───────

  it('E-09: two adjacent MESSAGE slots each render their own consolidated field, and editing one writes its notes while leaving the other untouched', async () => {
    mockServicesList = [{
      ...buildSectionedService(),
      slots: [
        { kind: 'MESSAGE', id: 'm1', position: 0, body: 'First message' },
        { kind: 'MESSAGE', id: 'm2', position: 1, body: 'Second message' },
      ],
    }]
    const wrapper = await mountView()

    const inputs = wrapper.findAll('[data-testid="slot-notes-input"]')
    expect(inputs).toHaveLength(2)
    // Legacy body-only slots still display via notes ?? body.
    expect((inputs[0]!.element as HTMLInputElement).value).toBe('First message')
    expect((inputs[1]!.element as HTMLInputElement).value).toBe('Second message')

    await inputs[0]!.setValue('Changed first')
    await wrapper.vm.$nextTick()

    const slots = (wrapper.vm as unknown as SlotsVm).localService.slots
    // The edit writes the canonical `notes`, never `body`; the other slot is untouched.
    expect(slots[0]!.notes).toBe('Changed first')
    expect(slots[1]!.body).toBe('Second message')
  })

  // ── E-11: typed text writes notes verbatim AND stored linkUrl survives (260811-vsr) ─

  it('E-11: typing into the consolidated field writes slot.notes verbatim (never body), and a stored linkUrl/linkLabel on the same MESSAGE slot survives the edit', async () => {
    mockServicesList = [{
      ...buildSectionedService(),
      slots: [{ kind: 'MESSAGE', id: 'm1', position: 0, linkUrl: 'https://example.com/notes', linkLabel: 'Sermon notes' }],
    }]
    const wrapper = await mountView()

    // Half 1: neither notes nor body is populated from linkUrl; linkUrl/linkLabel survive mount.
    const slotsBefore = (wrapper.vm as unknown as SlotsVm).localService.slots
    expect(slotsBefore[0]!.notes).toBeUndefined()
    expect(slotsBefore[0]!.body).toBeUndefined()
    expect(slotsBefore[0]!.linkUrl).toBe('https://example.com/notes')
    expect(slotsBefore[0]!.linkLabel).toBe('Sermon notes')

    // Half 2: typed text (leading/trailing space, multi-byte, emoji) round-trips verbatim
    // into notes; body stays undefined; linkUrl/linkLabel are untouched by the edit.
    // (No embedded newline: the consolidated field is a single-line <input type="text">.)
    const encoded = ' leading and trailing space · café · 🎵 '
    const input = wrapper.find('[data-testid="slot-notes-input"]')
    await input.setValue(encoded)
    await wrapper.vm.$nextTick()

    const slotsAfter = (wrapper.vm as unknown as SlotsVm).localService.slots
    expect(slotsAfter[0]!.notes).toBe(encoded)
    expect(slotsAfter[0]!.body).toBeUndefined()
    expect(slotsAfter[0]!.linkUrl).toBe('https://example.com/notes')
    expect(slotsAfter[0]!.linkLabel).toBe('Sermon notes')
  })

  // ── E-12: removing the URL control renumbers nothing ─────────────────────────

  it('E-12: mounting a service with a MESSAGE slot carrying a stored linkUrl leaves every slot\'s id, position and array index identical to before', async () => {
    const fixture: Service = {
      ...buildSectionedService(),
      slots: [
        ...buildSectionedService().slots,
        { kind: 'MESSAGE', id: 'm-with-link', position: 4, linkUrl: 'https://example.com', linkLabel: 'Link', section: 'sending' },
      ],
    }
    const before = fixture.slots.map((s, i) => ({ id: s.id, position: s.position, index: i }))
    mockServicesList = [fixture]
    const wrapper = await mountView()
    await wrapper.vm.$nextTick()

    const after = (wrapper.vm as unknown as SlotsVm).localService.slots.map((s, i) => ({ id: s.id, position: s.position, index: i }))
    expect(after).toEqual(before)
  })

  // ── E-16: a saved HYMN slot renders and reorders nothing (R084 ordering half) ─

  it('E-16: mounting a saved service containing a HYMN slot leaves slot count, ids, order and positions unchanged, and the HYMN slot still renders its own content row', async () => {
    const fixture: Service = {
      ...buildSectionedService(),
      slots: [
        ...buildSectionedService().slots,
        { kind: 'HYMN', id: 'h1', position: 4, hymnName: 'Great Is Thy Faithfulness', hymnNumber: '10', verses: '', section: 'sending' },
      ],
    }
    const before = fixture.slots.map((s) => ({ id: s.id, position: s.position }))
    mockServicesList = [fixture]
    const wrapper = await mountView()
    await wrapper.vm.$nextTick()

    const slots = (wrapper.vm as unknown as SlotsVm).localService.slots
    expect(slots).toHaveLength(fixture.slots.length)
    expect(slots.map((s) => ({ id: s.id, position: s.position }))).toEqual(before)
    // canEditService is true in this describe block's default fixture, so the
    // HYMN branch renders its editor arm (an <input>, not text content) — read
    // the input's bound value rather than wrapper.text().
    const hymnNameInput = wrapper.find('input[placeholder="Hymn Name"]')
    expect(hymnNameInput.exists()).toBe(true)
    expect((hymnNameInput.element as HTMLInputElement).value).toBe('Great Is Thy Faithfulness')
  })

  // ── 260811-vsr: link controls removed from BOTH Message AND Prayer (data retained) ─

  it('neither a MESSAGE nor a PRAYER row renders a url-typed input or a link anchor anymore; each renders exactly one consolidated notes field', async () => {
    mockServicesList = [{
      ...buildSectionedService(),
      slots: [
        { kind: 'MESSAGE', id: 'm1', position: 0, linkUrl: 'https://example.com/message' },
        { kind: 'PRAYER', id: 'p1', position: 1, linkUrl: 'https://example.com/prayer' },
      ],
    }]
    const wrapper = await mountView()

    const rows = wrapper.findAll('.slot-item')
    const messageRow = rows.find((r) => r.text().includes('Message'))
    const prayerRow = rows.find((r) => r.text().includes('Prayer'))
    expect(messageRow).toBeDefined()
    expect(prayerRow).toBeDefined()

    // The link fields moved out of the UI (linkUrl/linkLabel retained on the type).
    expect(messageRow!.find('input[type="url"]').exists()).toBe(false)
    expect(messageRow!.find('a').exists()).toBe(false)
    expect(prayerRow!.find('input[type="url"]').exists()).toBe(false)
    expect(prayerRow!.find('a').exists()).toBe(false)

    // Each plain-kind row now has exactly one consolidated free-text field.
    expect(messageRow!.findAll('[data-testid="slot-notes-input"]')).toHaveLength(1)
    expect(prayerRow!.findAll('[data-testid="slot-notes-input"]')).toHaveLength(1)
  })

  // ── UI-06: elementLabel copy for the remove-element confirmation ────────────

  it('UI-06: the remove-element confirmation names "this announcement" and "this miscellaneous item" instead of falling to the generic default', async () => {
    mockServicesList = [{
      ...buildSectionedService(),
      slots: [
        { kind: 'ANNOUNCEMENTS', id: 'a1', position: 0 },
        { kind: 'MISC', id: 'x1', position: 1 },
      ],
    }]
    const wrapper = await mountView()

    // 260811-vsr: Delete now lives in each row's ⋯ menu.
    const triggers = wrapper.findAll('[data-testid^="row-menu-trigger-"]')
    expect(triggers.length).toBeGreaterThanOrEqual(2)

    await deleteSlotViaRowMenu(wrapper, 0)
    expect(body().text()).toContain('this announcement')
    const cancelBtn1 = body().findAll('button').find((b) => b.text() === 'Cancel')
    await cancelBtn1!.trigger('click')
    await wrapper.vm.$nextTick()

    await deleteSlotViaRowMenu(wrapper, 1)
    expect(body().text()).toContain('this miscellaneous item')
    const cancelBtn2 = body().findAll('button').find((b) => b.text() === 'Cancel')
    await cancelBtn2!.trigger('click')
    await wrapper.vm.$nextTick()
  })
})

// ── R122 (54-02): a slot-level plain-text notes field beside every selector ──────
//
// One shared notes input written ONCE inside the :891 content wrapper covers all
// five slot kinds (the field lives on the base MediaAttachableSlot, so slot.notes
// is reachable cast-free). The selector and notes sit in a two-column responsive
// flex — side-by-side on desktop (sm:flex-row), stacked below sm (flex-col), reusing
// the QuarterView / Phase 48 recipe. Editing rides the existing autosave path; an
// emptied notes is set to undefined (never '') so stripUndefined drops it. A viewer
// (locked / read-only) shows notes as text via slot-notes-text, never an input,
// never v-html.

describe('ServiceEditorView - R122 slot-level notes field (54-02)', () => {
  interface SlotsVm {
    localService: { slots: Array<Record<string, unknown>> }
  }

  async function mountView() {
    const { default: ServiceEditorView } = await import('@/views/ServiceEditorView.vue')
    return shallowMount(ServiceEditorView, {
      global: {
        stubs: {
          AppShell: { template: '<div><slot /></div>' },
          ContextualActionBar: false,
          RouterLink: { template: '<a><slot /></a>' },
          SaveStatusIndicator: false,
          ServicePrintLayout: true,
          SongBadge: true,
          SongSlotPicker: true,
          ScriptureInput: true,
          PresentationViewer: true,
        },
      },
    })
  }

  // A multi-kind service so the "once per slot, every kind" claim is exercised
  // across SONG / SCRIPTURE / MESSAGE / HYMN in one mount.
  function multiKindService(): Service {
    return {
      ...buildSectionedService(),
      slots: [
        { kind: 'SONG', id: 'n-song', position: 0, requiredVwType: 1, songId: null, songTitle: null, songKey: null, section: 'worship' },
        { kind: 'SCRIPTURE', id: 'n-scr', position: 1, book: 'Psalms', chapter: 23, verseStart: 1, verseEnd: 6, section: 'worship' },
        { kind: 'MESSAGE', id: 'n-msg', position: 2, section: 'message' },
        { kind: 'HYMN', id: 'n-hymn', position: 3, hymnName: 'It Is Well', hymnNumber: '', verses: '', section: 'sending' },
      ],
    }
  }

  beforeEach(() => {
    mockAuthState.isEditor = true
    mockAuthState.orgId = 'org-1'
    mockServicesList = [multiKindService()]
  })

  // ── (a) one notes input per slot, every kind ────────────────────────────────
  it('renders exactly one slot-notes-input per slot, across every item kind', async () => {
    const wrapper = await mountView()

    const inputs = wrapper.findAll('[data-testid="slot-notes-input"]')
    const slotCount = (wrapper.vm as unknown as SlotsVm).localService.slots.length
    expect(slotCount).toBe(4)
    expect(inputs).toHaveLength(slotCount)
  })

  // ── (b) three-rail layout: the row itself is the responsive container, badge
  //        rail present, and the notes field is no longer in an sm:w-64 side column ─
  it('lays each row out as a three-rail responsive container with a per-kind badge and a full-width (not sm:w-64) notes field (260811-vsr)', async () => {
    const wrapper = await mountView()

    // The .slot-item ROOT now carries the QuarterView responsive recipe (stack below
    // sm, three-rail flex-row at sm+), replacing the removed inner side-by-side wrapper.
    const rows = wrapper.findAll('.slot-item.flex.flex-col.sm\\:flex-row')
    expect(rows.length).toBeGreaterThanOrEqual(1)

    // Each row renders exactly one per-kind badge (replacing the inline label headings).
    const badges = wrapper.findAll('[data-testid^="slot-badge-"]')
    const slotCount = (wrapper.vm as unknown as SlotsVm).localService.slots.length
    expect(badges).toHaveLength(slotCount)

    // The notes field is full-width in the field column — no sm:w-64 side column remains.
    expect(wrapper.find('.slot-item .sm\\:w-64').exists()).toBe(false)
  })

  // ── (b2) the per-kind badge carries kindBadgeClass output + the position label ──
  it('renders a per-kind colored badge whose classes come from kindBadgeClass and whose text is slotLabel (260811-vsr)', async () => {
    const wrapper = await mountView()

    // multiKindService(): [SONG, SCRIPTURE, MESSAGE, HYMN] at indices 0..3.
    const songBadge = wrapper.find('[data-testid="slot-badge-0"]')
    expect(songBadge.exists()).toBe(true)
    expect(songBadge.classes()).toContain('text-indigo-300') // SONG tint from kindBadgeClass
    expect(songBadge.text()).toBe('Song')

    const scriptureBadge = wrapper.find('[data-testid="slot-badge-1"]')
    expect(scriptureBadge.classes()).toContain('text-cyan-300') // SCRIPTURE tint
    expect(scriptureBadge.text()).toBe('Scripture Reading')

    const hymnBadge = wrapper.find('[data-testid="slot-badge-3"]')
    expect(hymnBadge.classes()).toContain('text-amber-300') // HYMN tint
  })

  // ── (c) editing sets slot.notes; clearing yields undefined (not '') ─────────
  it('typing into slot-notes-input sets slot.notes; clearing it to empty yields undefined', async () => {
    const wrapper = await mountView()

    const input = wrapper.find('[data-testid="slot-notes-input"]')
    expect(input.exists()).toBe(true)

    await input.setValue('Who leads: Sam')
    await wrapper.vm.$nextTick()
    expect((wrapper.vm as unknown as SlotsVm).localService.slots[0]!.notes).toBe('Who leads: Sam')

    await input.setValue('')
    await wrapper.vm.$nextTick()
    expect((wrapper.vm as unknown as SlotsVm).localService.slots[0]!.notes).toBeUndefined()
  })

  // ── (d) viewer shows slot-notes-text and NO input, plain text only ──────────
  it('a locked/viewer service renders slot-notes-text (not an input) for a slot carrying notes', async () => {
    // Markup-bearing notes proves text-only rendering: {{ }} interpolation
    // escapes it (T-54-01), so the literal string round-trips and no live
    // <b> element is injected into the DOM.
    mockServicesList = [{
      ...buildSectionedService(),
      slots: [{ kind: 'MESSAGE', id: 'v-msg', position: 0, notes: 'Read <b>slowly</b>', section: 'message' }],
    }]
    mockAuthState.isEditor = false
    const wrapper = await mountView()

    const text = wrapper.find('[data-testid="slot-notes-text"]')
    expect(text.exists()).toBe(true)
    // The literal markup survives as text — nothing was parsed into an element.
    expect(text.text()).toBe('Read <b>slowly</b>')
    expect(text.element.querySelector('b')).toBeNull()
    // Plain text only — no editable input, no v-html injection sink (T-54-01).
    expect(wrapper.find('[data-testid="slot-notes-input"]').exists()).toBe(false)
  })
})

// ── Service Order preservation sweep and the phase gate (36-05, R067) ────────────
//
// This block proves the rebuild across 36-01..36-05 removed nothing from the
// Service Order tab's pre-existing capability set — behaviourally, not merely by
// existence check, per 36-05-PLAN.md Task 2. It re-asserts, in one place, every
// capability 36-CONTEXT.md names as load-bearing: drag-reorder, per-row section
// select, per-row remove, the scripture slot editor, the sermon-context inputs,
// the teams row, the lock banner and the save-status bar (34-10).

describe('ServiceEditorView - Service Order preservation sweep (36-05, R067)', () => {
  interface SweepVm {
    localService: {
      teams: string[]
      sermonTopic: string | null
      slots: Array<Record<string, unknown>>
    }
  }

  async function mountView() {
    const { default: ServiceEditorView } = await import('@/views/ServiceEditorView.vue')
    return shallowMount(ServiceEditorView, {
      global: {
        stubs: {
          AppShell: { template: '<div><slot /></div>' },
          ContextualActionBar: false,
          RouterLink: { template: '<a><slot /></a>' },
          SaveStatusIndicator: false,
          ServicePrintLayout: true,
          SongBadge: true,
          SongSlotPicker: true,
          ScriptureInput: true,
          PresentationViewer: true,
          // D-14's slot-delete confirmation renders via <Teleport to="body"> —
          // opt it out of shallowMount's default auto-stub or the confirm
          // dialog's content never reaches document.body.
          teleport: false,
        },
      },
    })
  }

  function body() {
    return new DOMWrapper(document.body)
  }

  beforeEach(() => {
    mockAuthState.isEditor = true
    mockAuthState.orgId = 'org-1'
    mockServicesList = [buildSectionedService()]
  })

  it('drag-reorder: .slot-item elements exist for every fixture slot, and every populated section-list container is still configured with draggable: ".slot-item"', async () => {
    resetSortableCaptures()
    const wrapper = await mountView()
    await wrapper.vm.$nextTick()

    expect(wrapper.findAll('.slot-item')).toHaveLength(buildSectionedService().slots.length)
    for (const key of ['worship', 'message', 'sending']) {
      const capture = captureForSection(key)
      expect(capture).toBeDefined()
      expect(capture!.options.draggable).toBe('.slot-item')
    }
  })

  it('per-row ⋯ menu exists for each row, and its Move-to-section item moves the slot into the chosen band, reordering the array section-major (260811-vsr)', async () => {
    const wrapper = await mountView()

    const triggers = wrapper.findAll('[data-testid^="row-menu-trigger-"]')
    expect(triggers).toHaveLength(buildSectionedService().slots.length)

    // slot-2 (MESSAGE, array index 2) starts in 'message' — retarget it to 'pre-service'
    // via its ⋯ menu and confirm it actually moved, not merely that the control exists.
    expect(wrapper.find('[data-testid="section-list-message"]').findAll('.slot-item')).toHaveLength(1)
    expect(wrapper.find('[data-testid="section-list-pre-service"]').findAll('.slot-item')).toHaveLength(0)

    await moveSlotViaRowMenu(wrapper, 2, 'pre-service')

    expect(wrapper.find('[data-testid="section-list-message"]').findAll('.slot-item')).toHaveLength(0)
    expect(wrapper.find('[data-testid="section-list-pre-service"]').findAll('.slot-item')).toHaveLength(1)
  })

  it('per-row ⋯ menu Delete exists for each row, and confirming removal decreases localService.slots.length by exactly 1 (260811-vsr)', async () => {
    const wrapper = await mountView()
    const before = (wrapper.vm as unknown as SweepVm).localService.slots.length

    const triggers = wrapper.findAll('[data-testid^="row-menu-trigger-"]')
    expect(triggers.length).toBeGreaterThan(0)
    await deleteSlotViaRowMenu(wrapper, 0)

    // D-14: remove opens a confirm dialog (Teleport to body) rather than
    // removing immediately — confirm it, then assert the slot is actually gone.
    const confirmBtn = body().findAll('button').find((b) => b.text() === 'Remove')
    expect(confirmBtn).toBeDefined()
    await confirmBtn!.trigger('click')
    await wrapper.vm.$nextTick()

    expect((wrapper.vm as unknown as SweepVm).localService.slots).toHaveLength(before - 1)
  })

  it('teams row, sermon topic input and sermon passage input all render for an editor and write to localService', async () => {
    const wrapper = await mountView()

    // Teams row
    const orchestraLabel = wrapper.findAll('label').find((l) => l.text() === 'Orchestra')
    expect(orchestraLabel).toBeDefined()
    const orchestraCheckbox = orchestraLabel!.find('input[type="checkbox"]')
    expect(orchestraCheckbox.exists()).toBe(true)
    await orchestraCheckbox.setValue(true)
    await wrapper.vm.$nextTick()
    expect((wrapper.vm as unknown as SweepVm).localService.teams).toContain('Orchestra')

    // Sermon Topic input
    const topicInput = wrapper.find('input[placeholder="e.g. Grace and forgiveness, The prodigal son"]')
    expect(topicInput.exists()).toBe(true)
    await topicInput.setValue('Grace')
    await wrapper.vm.$nextTick()
    expect((wrapper.vm as unknown as SweepVm).localService.sermonTopic).toBe('Grace')

    // Sermon Passage input — a ScriptureInput distinct from any per-row scripture
    // slot editor (this fixture's SCRIPTURE row uses its own, separate instance).
    const sermonPassageInputs = wrapper
      .findAllComponents({ name: 'ScriptureInput' })
      .filter((c) => c.props('label') === 'Sermon Passage')
    expect(sermonPassageInputs).toHaveLength(1)
  })

  it("the scripture slot's editor still renders for a scripture slot", async () => {
    const wrapper = await mountView()

    const scriptureRow = wrapper.find('[data-scripture-slot-index="1"]')
    expect(scriptureRow.exists()).toBe(true)
    expect(scriptureRow.findComponent({ name: 'ScriptureInput' }).exists()).toBe(true)
  })

  it('the lock banner renders for a locked editor', async () => {
    mockServicesList = [{ ...buildSectionedService(), status: 'planned' }]
    const wrapper = await mountView()

    expect(wrapper.find('[data-testid="service-lock-banner-text"]').exists()).toBe(true)
  })

  it('service-save-status-bar (34-10) renders for an unlocked editor with no chrome classes at idle, re-asserted at phase close', async () => {
    const wrapper = await mountView()
    await wrapper.vm.$nextTick()

    const bar = wrapper.find('[data-testid="service-save-status-bar"]')
    expect(bar.exists()).toBe(true)
    // R102 (48-03): the wrapper's flex layout is now unconditional (so the
    // Undo link lays out beside SaveStatusIndicator even at idle) — only
    // border/background/padding/sticky stay conditional.
    expect(bar.classes()).toEqual(['flex', 'items-center', 'gap-2'])
  })

  it('five section headers, five band labels, five counts; the empty-band placeholder still renders its pre-phase copy verbatim for the editor variant', async () => {
    const wrapper = await mountView()

    const headers = wrapper.findAll('[data-testid^="section-header-"]')
    expect(headers).toHaveLength(5)
    for (const key of ['pre-service', 'worship', 'message', 'sending', 'post-service']) {
      expect(wrapper.find(`[data-testid="section-header-${key}"]`).exists()).toBe(true)
      expect(wrapper.find(`[data-testid="section-slide-count-${key}"]`).exists()).toBe(true)
    }
    const placeholder = wrapper.find('[data-testid="section-empty-pre-service"]')
    expect(placeholder.text()).toContain('No items yet')
    expect(placeholder.text()).toContain('Drag an item here, or set its Section to Pre-Service.')
  })

  it('five section headers, five band labels, five counts; the empty-band placeholder still renders its pre-phase copy verbatim for the LOCKED variant', async () => {
    mockServicesList = [{ ...buildSectionedService(), status: 'planned' }]
    const wrapper = await mountView()

    const headers = wrapper.findAll('[data-testid^="section-header-"]')
    expect(headers).toHaveLength(5)
    const placeholder = wrapper.find('[data-testid="section-empty-pre-service"]')
    expect(placeholder.text()).toBe('No items in this section.')
  })
})

describe('ServiceEditorView - Service Order locked/viewer sweep — write affordances absent, view stays (36-05, R067)', () => {
  async function mountView() {
    const { default: ServiceEditorView } = await import('@/views/ServiceEditorView.vue')
    return shallowMount(ServiceEditorView, {
      global: {
        stubs: {
          AppShell: { template: '<div><slot /></div>' },
          ContextualActionBar: false,
          RouterLink: { template: '<a><slot /></a>' },
          SaveStatusIndicator: false,
          ServicePrintLayout: true,
          SongBadge: true,
          SongSlotPicker: true,
          ScriptureInput: true,
          PresentationViewer: true,
        },
      },
    })
  }

  beforeEach(() => {
    mockAuthState.isEditor = true
    mockAuthState.orgId = 'org-1'
    mockServicesList = [buildSectionedService()]
  })

  it('locked service: every write affordance introduced or moved by Phase 36 is absent, while band labels and counts stay visible', async () => {
    mockServicesList = [{ ...buildSectionedService(), status: 'planned' }]
    const wrapper = await mountView()

    expect(wrapper.find('[data-testid="add-to-service-palette"]').exists()).toBe(false)
    expect(wrapper.findAll('[data-testid^="section-add-item-"]')).toHaveLength(0)
    expect(wrapper.findAll('[data-testid^="section-add-menu-"]')).toHaveLength(0)
    expect(wrapper.findAll('button').some((b) => b.text().includes('Save'))).toBe(false)

    expect(wrapper.findAll('[data-testid^="section-header-"]')).toHaveLength(5)
    for (const key of ['pre-service', 'worship', 'message', 'sending', 'post-service']) {
      expect(wrapper.find(`[data-testid="section-slide-count-${key}"]`).exists()).toBe(true)
    }
  })

  it('viewer: every write affordance introduced or moved by Phase 36 is absent, while band labels and counts stay visible', async () => {
    mockAuthState.isEditor = false
    const wrapper = await mountView()

    expect(wrapper.find('[data-testid="add-to-service-palette"]').exists()).toBe(false)
    expect(wrapper.findAll('[data-testid^="section-add-item-"]')).toHaveLength(0)
    expect(wrapper.findAll('[data-testid^="section-add-menu-"]')).toHaveLength(0)
    expect(wrapper.findAll('button').some((b) => b.text().includes('Save'))).toBe(false)

    expect(wrapper.findAll('[data-testid^="section-header-"]')).toHaveLength(5)
    for (const key of ['pre-service', 'worship', 'message', 'sending', 'post-service']) {
      expect(wrapper.find(`[data-testid="section-slide-count-${key}"]`).exists()).toBe(true)
    }
  })
})

// ── Slot id backfill on load (Phase 24-06 Task 1, R028) ─────────────────────────

describe('ServiceEditorView - slot id backfill on load (Phase 24-06 Task 1)', () => {
  async function mountView() {
    const { default: ServiceEditorView } = await import('@/views/ServiceEditorView.vue')
    return shallowMount(ServiceEditorView, {
      global: {
        stubs: {
          AppShell: { template: '<div><slot /></div>' },
          // 36-03: Suggest/Export/Copy/Save/Present all moved into this real
          // child component (ContextualActionBar.vue) — every mountView in
          // this file must render it for real (`false` opts a component OUT
          // of shallowMount's default auto-stub) or none of those controls'
          // pre-existing testids/text are reachable in the DOM anymore.
          ContextualActionBar: false,
          RouterLink: { template: '<a><slot /></a>' },
          // 32-05: render the real SaveStatusIndicator (not a shallow stub)
          // so its data-testid="save-status"/"save-status-error" handles are
          // reachable from these tests.
          SaveStatusIndicator: false,
          ServicePrintLayout: true,
          SongBadge: true,
          SongSlotPicker: true,
          ScriptureInput: true,
        },
      },
    })
  }

  // Simulates a pre-Phase-24 Firestore document: every slot lacks `id`. Real
  // legacy documents predate the TS type change, so bypassing it here with a
  // cast is the honest way to reproduce that shape.
  function buildLegacyService(): Service {
    return {
      ...mockService,
      slots: mockService.slots.map((slot) => {
        const clone: Record<string, unknown> = { ...(slot as unknown as Record<string, unknown>) }
        delete clone.id
        return clone
      }),
    } as unknown as Service
  }

  beforeEach(() => {
    mockAuthState.isEditor = true
    mockAuthState.orgId = 'org-1'
    mockUpdateService.mockClear()
  })

  it('legacy (id-less) service loads with isDirty false and schedules no autosave through the debounce window', async () => {
    mockServicesList = [buildLegacyService()]
    const wrapper = await mountView()
    await wrapper.vm.$nextTick()

    // If the backfill didn't apply identically to BOTH localService and
    // originalService, the JSON.stringify comparison behind isDirty would
    // mismatch immediately on load, rendering the "Unsaved changes" badge.
    expect(wrapper.text()).not.toContain('Unsaved changes')

    await new Promise((resolve) => setTimeout(resolve, 900))
    expect(mockUpdateService).not.toHaveBeenCalled()
  })

  it('a service whose slots already have ids is untouched (no false dirty, no id churn)', async () => {
    mockServicesList = [{ ...mockService }] // default fixture: every slot already carries an id
    const wrapper = await mountView()
    await wrapper.vm.$nextTick()

    expect(wrapper.text()).not.toContain('Unsaved changes')

    await new Promise((resolve) => setTimeout(resolve, 900))
    expect(mockUpdateService).not.toHaveBeenCalled()
  })

  it('backfilled ids are identical across localService and originalService and persist through the next real save', async () => {
    mockServicesList = [buildLegacyService()]
    const wrapper = await mountView()
    await wrapper.vm.$nextTick()

    // Trigger an explicit edit so isDirty flips true and autosave schedules —
    // now via the per-row ⋯ menu's Move-to-section (260811-vsr) instead of the
    // removed inline section select.
    const triggers = wrapper.findAll('[data-testid^="row-menu-trigger-"]')
    expect(triggers.length).toBeGreaterThan(1)
    // The autosave watcher's very FIRST deep-watch trigger is always consumed
    // by the `autosaveInitialized` guard (by design — see the watcher's own
    // comment). In production that first trigger is the load event itself;
    // here it's this throwaway edit instead, because the mock store resolves
    // synchronously so the load watcher's `{ immediate: true }` fires and
    // assigns `localService.value` BEFORE the autosave watcher is even
    // created (it's declared later in the script) — so the load reassignment
    // has no watcher yet to consume it. The SECOND edit below is the one
    // this test actually asserts against.
    await moveSlotViaRowMenu(wrapper, 0, 'worship')
    await moveSlotViaRowMenu(wrapper, 1, 'message')

    await new Promise((resolve) => setTimeout(resolve, 900))

    expect(mockUpdateService).toHaveBeenCalledTimes(1)
    const payload = mockUpdateService.mock.calls[0]![1] as { slots: Array<{ id?: string }> }
    const ids = payload.slots.map((s) => s.id)
    // Every slot got a real, non-empty id...
    expect(ids.every((id) => typeof id === 'string' && id.length > 0)).toBe(true)
    // ...and none of them collide — proving isDirty stayed false pre-edit
    // (see previous test) is only possible if localService/originalService
    // held byte-identical ids at load, and that those ids survive untouched
    // into the very next legitimate save.
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('a second identical id-less remote snapshot does not change previously backfilled ids (R028 remote-merge stability)', async () => {
    const reactiveServices = reactive([buildLegacyService()])
    mockServicesList = reactiveServices as unknown as Service[]
    const wrapper = await mountView()
    await wrapper.vm.$nextTick()

    // First save: a throwaway edit absorbs the autosave watcher's very first
    // trigger (the `autosaveInitialized` guard — see the previous test's
    // comment for why that's this edit rather than the load event in this
    // synchronous-mock environment); the second edit is the real one this
    // save's ids are captured from.
    await moveSlotViaRowMenu(wrapper, 0, 'worship')
    await moveSlotViaRowMenu(wrapper, 1, 'message')
    await new Promise((resolve) => setTimeout(resolve, 900))
    expect(mockUpdateService).toHaveBeenCalledTimes(1)
    const firstPayload = mockUpdateService.mock.calls[0]![1] as { slots: Array<{ id?: string }> }
    const firstIds = firstPayload.slots.map((s) => s.id)
    // Guard against a vacuous pass: without backfill every id would be
    // `undefined`, and `[undefined, ...] === [undefined, ...]` would trivially
    // satisfy the final equality check below without ever proving a real id
    // was minted and reused.
    expect(firstIds.every((id) => typeof id === 'string' && id.length > 0)).toBe(true)

    // Simulate a second remote snapshot of the SAME still-id-less document
    // (e.g. a stale re-emission) — the remote-merge branch must reuse the
    // ids already held locally, not mint fresh ones. The reassignment inside
    // the load watcher resets `autosaveInitialized = false` and ALSO fires
    // the autosave watcher itself (a top-level ref reassignment always
    // triggers regardless of deep), so that reset is consumed by the merge
    // event itself — no extra throwaway edit is needed here.
    reactiveServices[0] = buildLegacyService()
    await wrapper.vm.$nextTick()

    // Third edit + save: the ids captured this time must match the first — as a SET, not
    // as an ordered array. Assigning slot-2 a section now also reorders the array
    // section-major (29-03: onSectionChange reindexes via orderSlotsBySection), so slot-2
    // legitimately moves to the front; what R028 actually guarantees is that no id is
    // dropped or re-minted across the stale remote merge, not that array order is stable
    // across an unrelated ordering change this same edit triggers.
    await moveSlotViaRowMenu(wrapper, 2, 'sending')
    await new Promise((resolve) => setTimeout(resolve, 900))
    expect(mockUpdateService).toHaveBeenCalledTimes(2)
    const secondPayload = mockUpdateService.mock.calls[1]![1] as { slots: Array<{ id?: string }> }
    const secondIds = secondPayload.slots.map((s) => s.id)

    expect([...secondIds].sort()).toEqual([...firstIds].sort())
  })
})

// ── R039 (32-01): a save's own Firestore echo must not swallow the next
//    discrete mutation ───────────────────────────────────────────────────────
//
// See 32-RESEARCH.md § "Root Cause: Confirmed" for the full mechanism. In
// short: `serviceStore.updateService` always stamps a fresh `updatedAt` on
// the server; the client never re-syncs its own copy after a successful
// save; the next snapshot echoing that write back (server ack, or a stale
// re-emission) differs from local state ONLY in `updatedAt`; the
// remote-merge watcher's JSON diff treats that lone difference as a genuine
// remote change, applies it, and resets the `autosaveInitialized` guard —
// which then swallows whatever discrete mutation lands next (a song pick,
// a reorder-triggered re-render, etc.) with no debounce armed and no
// status change.
//
// `mockTimestamp` (declared above) is NOT reusable here — it exposes only a
// `toDate` function with no enumerable fields, so `JSON.stringify` drops it
// entirely and the JSON diff this bug depends on would see no difference at
// all (32-RESEARCH.md Pitfall 2). `stampedService()` below fixes that with a
// real `{ seconds, nanoseconds }` shape, which survives `JSON.stringify`
// exactly like a genuine Firestore `Timestamp` does.
function stampedService(seconds: number, base: Service = mockService): Service {
  return {
    ...base,
    updatedAt: { seconds, nanoseconds: 0 } as unknown as Timestamp,
  }
}

describe("ServiceEditorView - R039: a save's own Firestore echo must not swallow the next discrete mutation", () => {
  async function mountView() {
    const { default: ServiceEditorView } = await import('@/views/ServiceEditorView.vue')
    return shallowMount(ServiceEditorView, {
      global: {
        stubs: {
          AppShell: { template: '<div><slot /></div>' },
          // 36-03: Suggest/Export/Copy/Save/Present all moved into this real
          // child component (ContextualActionBar.vue) — every mountView in
          // this file must render it for real (`false` opts a component OUT
          // of shallowMount's default auto-stub) or none of those controls'
          // pre-existing testids/text are reachable in the DOM anymore.
          ContextualActionBar: false,
          RouterLink: { template: '<a><slot /></a>' },
          // 32-05: render the real SaveStatusIndicator (not a shallow stub)
          // so its data-testid="save-status"/"save-status-error" handles are
          // reachable from these tests.
          SaveStatusIndicator: false,
          ServicePrintLayout: true,
          SongBadge: true,
          SongSlotPicker: true,
          ScriptureInput: true,
          teleport: false,
        },
      },
    })
  }

  beforeEach(() => {
    mockAuthState.isEditor = true
    mockAuthState.orgId = 'org-1'
    mockUpdateService.mockClear()
    mockUpdateService.mockImplementation(() => Promise.resolve())
    mockOwnWriteEchoIds = []
    resetSortableCaptures()
  })

  // `mockOwnWriteEchoIds` is module-level state shared by the WHOLE file —
  // every describe block after this one mounts services with the SAME
  // 'service-1' id but has no reason to know this mock member exists, so a
  // value left set by the last test here would silently make every later
  // remote-merge test's `isOwnWriteEcho('service-1')` return true.
  afterEach(() => {
    mockOwnWriteEchoIds = []
  })

  /** The autosave watcher swallows the FIRST `localService` mutation after a
   *  load or a remote merge (`autosaveInitialized`) — same idiom as the
   *  BL-02 block's `warmAutosaveWatcher`. A `notes` touch is used
   *  deliberately (not a slot mutation) so slot state stays untouched for
   *  the repro's own assertions. */
  async function warmAutosaveWatcher(
    wrapper: Awaited<ReturnType<typeof mountView>>,
    vm: { localService: { notes: string } },
  ) {
    vm.localService.notes = 'R039 warm-up touch the watcher swallows'
    await wrapper.vm.$nextTick()
  }

  it("picking a song immediately after a prior save's own echo lands still fires a save", async () => {
    const reactiveServices = reactive([stampedService(1)])
    mockServicesList = reactiveServices as unknown as Service[]
    const wrapper = await mountView()
    await wrapper.vm.$nextTick()
    const vm = wrapper.vm as unknown as {
      localService: { notes: string; slots: Array<{ songId: string | null }> }
      onSelectSong: (index: number, song: { id: string; title: string; key: string }) => void
    }

    // ── Absorb the watcher's first-trigger guard, then land a REAL prior
    //    edit that actually arms and fires the 800ms debounce — this is the
    //    "prior save" the repro's echo is standing on.
    await warmAutosaveWatcher(wrapper, vm)
    vm.localService.notes = 'a prior edit that will actually save'
    await wrapper.vm.$nextTick()
    await new Promise((resolve) => setTimeout(resolve, 900))
    await flushPromises()
    expect(mockUpdateService).toHaveBeenCalledTimes(1)

    // ── Simulate that save's own echo: identical content, a NEW enumerable
    //    timestamp — exactly what serverTimestamp() produces on the
    //    server-ack snapshot. Built from the CURRENT local state (not a
    //    fresh mockService) so the only field that differs is updatedAt,
    //    isolating exactly the mechanism 32-RESEARCH.md documents.
    // ── Simulate the echo landing AND the discrete pick in the SAME
    //    synchronous tick — deliberately not separated by an awaited
    //    `$nextTick()`. This is the actual race: Vue's reactivity scheduler
    //    dedups multiple triggers of the SAME watcher within one flush into
    //    a single execution. The remote-merge watcher (declared earlier,
    //    lower job id) runs first in that flush and resets
    //    `autosaveInitialized`; the discrete mutation's own trigger to
    //    `watch(localService, …)` is coalesced into that watcher's ALREADY-
    //    queued job rather than getting its own separate run, so the one
    //    execution that does happen observes the freshly-reset guard and
    //    swallows it — even though it was genuinely triggered by a NEW user
    //    edit, not by the echo's own reassignment.
    mockOwnWriteEchoIds = ['service-1']
    reactiveServices[0] = stampedService(2, JSON.parse(JSON.stringify(vm.localService)))
    // ── THE REPRO: a discrete one-shot mutation, immediately after the
    //    echo, via the real onSelectSong path (not a raw property
    //    assignment) — matching the phase's own "picking a song" example.
    vm.onSelectSong(0, { id: 'song-9', title: 'New Song', key: 'C' })
    await wrapper.vm.$nextTick()
    await new Promise((resolve) => setTimeout(resolve, 900))
    await flushPromises()

    // If the hypothesis holds, this call count is STILL 1 (the mutation was
    // swallowed) — red against today's code, green once the fix lands.
    expect(mockUpdateService).toHaveBeenCalledTimes(2)
    // The local edit itself is never lost — only the SAVE is.
    expect(vm.localService.slots[0]!.songId).toBe('song-9')
  })

  it("a discrete pick immediately after the D-15 reorder-save's echo also fires a save", async () => {
    // The reorder-save path (unlike the debounced onSave() path) writes
    // immediately and unconditionally — no warm-up touch is needed to
    // produce its "prior save"; RESEARCH Pitfall 1 is exactly that a fix
    // scoped to onSave()'s payload would leave this second entry point
    // into the identical failure unpatched.
    const reactiveServices = reactive([stampedService(1, makeSectionedService())])
    mockServicesList = reactiveServices as unknown as Service[]
    const wrapper = await mountView()
    await wrapper.vm.$nextTick()
    const vm = wrapper.vm as unknown as {
      localService: { slots: Array<{ id: string; songId?: string | null }> }
      onSelectSong: (index: number, song: { id: string; title: string; key: string }) => void
    }

    const worshipCapture = captureForSection('worship')
    if (!worshipCapture) throw new Error('R039 reorder repro: no worship Sortable capture resolved')

    // Worship is [s2, s3, s4] — drag s2 (position 0) to the last position,
    // mirroring the existing "moves an item within its own section" D-15 test.
    await worshipCapture.options.onEnd!({
      oldDraggableIndex: 0,
      newDraggableIndex: 2,
      item: worshipCapture.el.children[0] as HTMLElement,
      from: worshipCapture.el,
      to: worshipCapture.el,
    } as never)
    await flushPromises()
    expect(mockUpdateService).toHaveBeenCalledTimes(1)

    const songSlotIndex = vm.localService.slots.findIndex((s) => s.id === 's1')
    expect(songSlotIndex).toBeGreaterThanOrEqual(0)

    // ── Simulate the reorder-save's own echo landing AND the discrete pick
    //    in the SAME synchronous tick — see the sibling test's comment for
    //    why this ordering (not separated by an awaited `$nextTick()`) is
    //    what actually exercises the race.
    mockOwnWriteEchoIds = ['service-1']
    reactiveServices[0] = stampedService(2, JSON.parse(JSON.stringify(vm.localService)))
    // THE REPRO: a discrete pick (via the real onSelectSong path) landing
    // immediately after the reorder-save's own echo.
    vm.onSelectSong(songSlotIndex, { id: 'song-9', title: 'New Song', key: 'C' })
    await wrapper.vm.$nextTick()
    await new Promise((resolve) => setTimeout(resolve, 900))
    await flushPromises()

    expect(mockUpdateService).toHaveBeenCalledTimes(2)
    expect(vm.localService.slots[songSlotIndex]!.songId).toBe('song-9')
  })
})

// ── Slot delete cascades to its group (Phase 24-06 Task 2, R029) ───────────────

describe('ServiceEditorView - slot delete cascades to its group (Phase 24-06 Task 2, R029)', () => {
  async function mountView() {
    const { default: ServiceEditorView } = await import('@/views/ServiceEditorView.vue')
    return shallowMount(ServiceEditorView, {
      global: {
        stubs: {
          AppShell: { template: '<div><slot /></div>' },
          // 36-03: Suggest/Export/Copy/Save/Present all moved into this real
          // child component (ContextualActionBar.vue) — every mountView in
          // this file must render it for real (`false` opts a component OUT
          // of shallowMount's default auto-stub) or none of those controls'
          // pre-existing testids/text are reachable in the DOM anymore.
          ContextualActionBar: false,
          RouterLink: { template: '<a><slot /></a>' },
          // 32-05: render the real SaveStatusIndicator (not a shallow stub)
          // so its data-testid="save-status"/"save-status-error" handles are
          // reachable from these tests.
          SaveStatusIndicator: false,
          ServicePrintLayout: true,
          SongBadge: true,
          SongSlotPicker: true,
          ScriptureInput: true,
          // shallowMount auto-stubs <Teleport> (its default `shallow` behavior
          // treats ANY non-root component — including Vue's built-in Teleport
          // — as stubbable, discarding its children) UNLESS explicitly opted
          // out here. Without this, the slot-delete confirm dialog's content
          // never reaches document.body and every assertion below silently
          // finds nothing.
          teleport: false,
        },
      },
    })
  }

  // The slot-delete confirm dialog renders via <Teleport to="body"> — Vue
  // Test Utils' documented pattern for asserting against teleported content
  // (see src/components/__tests__/PptxImportModal.test.ts).
  function body() {
    return new DOMWrapper(document.body)
  }

  function buildGroup(slotId: string, overrides: Partial<SlideGroup> = {}): SlideGroup {
    return {
      id: slotId,
      slotId,
      serviceId: 'service-1',
      slides: [],
      createdAt: mockTimestamp,
      updatedAt: mockTimestamp,
      ...overrides,
    }
  }

  async function openDeleteConfirm(wrapper: Awaited<ReturnType<typeof mountView>>, index: number) {
    // 260811-vsr: Delete moved into the per-row ⋯ menu — open it, then click Delete.
    await deleteSlotViaRowMenu(wrapper as unknown as VueWrapper, index)
  }

  function confirmButton() {
    return body().findAll('button').find((b) => b.text() === 'Remove')
  }

  function cancelButton() {
    return body().findAll('button').find((b) => b.text() === 'Cancel')
  }

  beforeEach(() => {
    mockAuthState.isEditor = true
    mockAuthState.orgId = 'org-1'
    mockServicesList = [mockService]
    mockUpdateService.mockClear()
  })

  it('confirming a remove-element delete calls deleteGroup with the slot id BEFORE the splice', async () => {
    let resolveDelete!: () => void
    mockDeleteGroup.mockImplementationOnce(() => new Promise<void>((resolve) => { resolveDelete = resolve }))

    const wrapper = await mountView()
    await wrapper.vm.$nextTick()
    await openDeleteConfirm(wrapper, 0)

    await confirmButton()!.trigger('click')
    await wrapper.vm.$nextTick()

    // deleteGroup has been called, but its promise is still pending — the
    // splice must not have happened yet.
    expect(mockDeleteGroup).toHaveBeenCalledWith('org-1', 'slot-0')
    expect(wrapper.findAll('[data-testid^="row-menu-trigger-"]')).toHaveLength(9)

    resolveDelete()
    await Promise.resolve()
    await Promise.resolve()
    await wrapper.vm.$nextTick()

    expect(wrapper.findAll('[data-testid^="row-menu-trigger-"]')).toHaveLength(8)
  })

  it('shows a spinner on the Remove button while the delete is in flight, then clears it (2026-08-12)', async () => {
    let resolveDelete!: () => void
    mockDeleteGroup.mockImplementationOnce(() => new Promise<void>((resolve) => { resolveDelete = resolve }))

    const wrapper = await mountView()
    await wrapper.vm.$nextTick()
    await openDeleteConfirm(wrapper, 0)

    await confirmButton()!.trigger('click')
    await wrapper.vm.$nextTick()

    // In flight: spinner shown, the button reads "Removing…" and is disabled.
    expect(body().find('[data-testid="slot-remove-spinner"]').exists()).toBe(true)
    const removingBtn = body().findAll('button').find((b) => b.text().includes('Removing'))
    expect(removingBtn).toBeTruthy()
    expect(removingBtn!.attributes('disabled')).toBeDefined()

    resolveDelete()
    await Promise.resolve()
    await Promise.resolve()
    await wrapper.vm.$nextTick()

    // Resolved: the dialog closed and the spinner is gone.
    expect(body().find('[data-testid="slot-remove-spinner"]').exists()).toBe(false)
  })

  it('R045 membership lock: after a confirmed remove-element delete, the removed slot id no longer appears in the view and no further group delete is issued for it', async () => {
    const wrapper = await mountView()
    await wrapper.vm.$nextTick()
    await openDeleteConfirm(wrapper, 0)

    await confirmButton()!.trigger('click')
    await flushPromises()
    await wrapper.vm.$nextTick()

    // Membership: the removed slot's id is gone from the rendered slot list.
    const remainingSlotIds = wrapper.findAll('[data-slot-id]').map((w) => w.attributes('data-slot-id'))
    expect(remainingSlotIds).not.toContain('slot-0')

    const callsAfterDelete = mockDeleteGroup.mock.calls.length
    expect(callsAfterDelete).toBe(1)

    // Locked, not just cascaded once: further ticks (e.g. an unrelated
    // autosave/reactivity pass) issue no repeat delete for the same slot.
    await flushPromises()
    await wrapper.vm.$nextTick()
    await new Promise((resolve) => setTimeout(resolve, 900))

    expect(mockDeleteGroup).toHaveBeenCalledTimes(callsAfterDelete)
    expect(mockDeleteGroup).toHaveBeenCalledWith('org-1', 'slot-0')
  })

  it('cancelling calls neither deleteGroup nor the splice, leaving the slot list unchanged', async () => {
    const wrapper = await mountView()
    await wrapper.vm.$nextTick()
    await openDeleteConfirm(wrapper, 0)

    await cancelButton()!.trigger('click')
    await wrapper.vm.$nextTick()

    expect(mockDeleteGroup).not.toHaveBeenCalled()
    expect(wrapper.findAll('[data-testid^="row-menu-trigger-"]')).toHaveLength(9)
  })

  it('names the true slide count and attached audio for a group with six slides and bed audio, and never claims attached video (D-18)', async () => {
    mockSlideGroupsState.groups = [
      buildGroup('slot-0', {
        bedAudioUrl: 'https://example.com/bed.mp3',
        slides: Array.from({ length: 6 }, (_, i) => ({
          id: `slide-${i}`,
          order: i,
          sourceRef: { kind: 'text' } as const,
        })),
      }),
    ]
    const wrapper = await mountView()
    await wrapper.vm.$nextTick()
    await openDeleteConfirm(wrapper, 0)

    const dialogText = body().text()
    expect(dialogText).toContain('6')
    expect(dialogText).toContain('attached audio')
    expect(dialogText).not.toContain('attached video')
  })

  it('names operator notes and per-slide audio when present, with no group bed', async () => {
    mockSlideGroupsState.groups = [
      buildGroup('slot-0', {
        slides: [
          { id: 'slide-0', order: 0, sourceRef: { kind: 'text' }, notes: 'watch the tempo change' },
          { id: 'slide-1', order: 1, sourceRef: { kind: 'text' }, audioUrl: 'https://example.com/slide-audio.mp3' },
        ],
      }),
    ]
    const wrapper = await mountView()
    await wrapper.vm.$nextTick()
    await openDeleteConfirm(wrapper, 0)

    const dialogText = body().text()
    expect(dialogText).toContain('operator notes')
    expect(dialogText).toContain('per-slide audio')
  })

  it('makes no attached-media claim for a group with no media and no notes', async () => {
    mockSlideGroupsState.groups = [
      buildGroup('slot-0', { slides: [{ id: 'slide-0', order: 0, sourceRef: { kind: 'text' } }] }),
    ]
    const wrapper = await mountView()
    await wrapper.vm.$nextTick()
    await openDeleteConfirm(wrapper, 0)

    const dialogText = body().text()
    expect(dialogText).toContain('with no attached audio or notes')
  })

  it('names zero slides and still completes the delete when the slot has no group', async () => {
    mockSlideGroupsState.groups = [] // no group at all for slot-0
    const wrapper = await mountView()
    await wrapper.vm.$nextTick()
    await openDeleteConfirm(wrapper, 0)

    expect(body().text()).toContain('0 slides')

    await confirmButton()!.trigger('click')
    await Promise.resolve()
    await Promise.resolve()
    await wrapper.vm.$nextTick()

    expect(mockDeleteGroup).toHaveBeenCalledWith('org-1', 'slot-0')
    expect(wrapper.findAll('[data-testid^="row-menu-trigger-"]')).toHaveLength(8)
  })

  it('deleting one of two slots referencing the same song calls deleteGroup exactly once, with that slot id', async () => {
    mockServicesList = [{
      ...mockService,
      slots: [
        { kind: 'SONG', id: 'dup-a', position: 0, requiredVwType: 1, songId: 'song-1', songTitle: 'Amazing Grace', songKey: 'G' },
        { kind: 'SONG', id: 'dup-b', position: 1, requiredVwType: 2, songId: 'song-1', songTitle: 'Amazing Grace', songKey: 'G' },
      ],
    }]
    const wrapper = await mountView()
    await wrapper.vm.$nextTick()
    await openDeleteConfirm(wrapper, 0)

    await confirmButton()!.trigger('click')
    await Promise.resolve()
    await Promise.resolve()
    await wrapper.vm.$nextTick()

    expect(mockDeleteGroup).toHaveBeenCalledTimes(1)
    expect(mockDeleteGroup).toHaveBeenCalledWith('org-1', 'dup-a')
  })

  it('deleting a middle slot leaves the surviving slots ids unchanged after reindexSlots', async () => {
    const wrapper = await mountView()
    await wrapper.vm.$nextTick()

    // Absorb the autosave watcher's first-ever trigger (see the Task 1 tests'
    // comment for why this is needed in this synchronous-mock environment) with an edit
    // on slot-8, now via the per-row ⋯ menu (260811-vsr). Since 29-03 onSectionChange
    // reorders section-major, this ALSO moves slot-8 to the front of the render (ahead of
    // the still-ungrouped slot-0..slot-7) — the row index below accounts for that reordering.
    await moveSlotViaRowMenu(wrapper, 8, 'sending')

    // Post-reorder row order is [slot-8, slot-0, slot-1, slot-2, slot-3, slot-4,
    // slot-5, slot-6, slot-7] — slot-4 (this test's target) is now at row index 5.
    await openDeleteConfirm(wrapper, 5)
    await confirmButton()!.trigger('click')
    await Promise.resolve()
    await Promise.resolve()
    await wrapper.vm.$nextTick()

    await new Promise((resolve) => setTimeout(resolve, 900))

    expect(mockUpdateService).toHaveBeenCalledTimes(1)
    const payload = mockUpdateService.mock.calls[0]![1] as { slots: Array<{ id?: string; position: number }> }
    expect(payload.slots.map((s) => s.id)).toEqual([
      'slot-8', 'slot-0', 'slot-1', 'slot-2', 'slot-3', 'slot-5', 'slot-6', 'slot-7',
    ])
    expect(payload.slots.map((s) => s.position)).toEqual([0, 1, 2, 3, 4, 5, 6, 7])
  })

  it('the clear-song branch calls deleteGroup zero times', async () => {
    const wrapper = await mountView()
    await wrapper.vm.$nextTick()

    const clearSongBtn = wrapper.find('[title="Remove song"]')
    expect(clearSongBtn.exists()).toBe(true)
    await clearSongBtn.trigger('click')
    await wrapper.vm.$nextTick()

    await confirmButton()!.trigger('click')
    await Promise.resolve()
    await wrapper.vm.$nextTick()

    expect(mockDeleteGroup).not.toHaveBeenCalled()
  })

  it('a failed group delete leaves the slot in place (T-24-06-02)', async () => {
    mockDeleteGroup.mockRejectedValueOnce(new Error('network error'))
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const wrapper = await mountView()
    await wrapper.vm.$nextTick()
    await openDeleteConfirm(wrapper, 0)

    await confirmButton()!.trigger('click')
    await Promise.resolve()
    await Promise.resolve()
    await wrapper.vm.$nextTick()

    expect(wrapper.findAll('[data-testid^="row-menu-trigger-"]')).toHaveLength(9)

    errSpy.mockRestore()
  })
})

// ── Slides tab: third tab button and panel (Phase 25-03) ────────────────────────

describe('ServiceEditorView - Slides tab (Phase 25-03)', () => {
  async function mountView() {
    const { default: ServiceEditorView } = await import('@/views/ServiceEditorView.vue')
    return shallowMount(ServiceEditorView, {
      global: {
        stubs: {
          AppShell: { template: '<div><slot /></div>' },
          // 36-03: Suggest/Export/Copy/Save/Present all moved into this real
          // child component (ContextualActionBar.vue) — every mountView in
          // this file must render it for real (`false` opts a component OUT
          // of shallowMount's default auto-stub) or none of those controls'
          // pre-existing testids/text are reachable in the DOM anymore.
          ContextualActionBar: false,
          RouterLink: { template: '<a><slot /></a>' },
          // 32-05: render the real SaveStatusIndicator (not a shallow stub)
          // so its data-testid="save-status"/"save-status-error" handles are
          // reachable from these tests.
          SaveStatusIndicator: false,
          ServicePrintLayout: true,
          SongBadge: true,
          SongSlotPicker: true,
          ScriptureInput: true,
        },
      },
    })
  }

  beforeEach(() => {
    mockAuthState.isEditor = true
    mockAuthState.orgId = 'org-1'
    mockServicesList = [mockService]
  })

  // MOVED-CONTROL (36-03, R069): the rendered order changed from
  // Service Order · Roles · Slides to Service Order · Slides · Roles — the
  // buttons, their gates and their click behaviour are unchanged, only their
  // position. Was 'renders three tab buttons, the third reading Slides'.
  it('renders three tab buttons in order Service Order, Slides, Roles', async () => {
    const wrapper = await mountView()
    const tabButtons = wrapper.findAll('button').filter((b) => ['Service Order', 'Roles', 'Slides'].includes(b.text()))
    expect(tabButtons.map((b) => b.text())).toEqual(['Service Order', 'Slides', 'Roles'])
  })

  it('viewer: the Slides button is present while the Roles button is not', async () => {
    mockAuthState.isEditor = false
    const wrapper = await mountView()
    const slidesBtn = wrapper.findAll('button').find((b) => b.text() === 'Slides')
    const rolesBtn = wrapper.findAll('button').find((b) => b.text() === 'Roles')
    expect(slidesBtn?.exists()).toBe(true)
    expect(rolesBtn).toBeUndefined()
  })

  it('clicking Slides shows the slides panel and hides the service order panel', async () => {
    const wrapper = await mountView()
    await wrapper.vm.$nextTick()

    expect(isVShowHidden(wrapper.find('[data-testid="service-order-panel"]'))).toBe(false)

    const slidesBtn = wrapper.findAll('button').find((b) => b.text() === 'Slides')
    expect(slidesBtn?.exists()).toBe(true)
    await slidesBtn!.trigger('click')
    await wrapper.vm.$nextTick()

    expect(isVShowHidden(wrapper.findComponent(SlidesTab))).toBe(false)
    expect(isVShowHidden(wrapper.find('[data-testid="service-order-panel"]'))).toBe(true)
  })

  it('the default active tab is unchanged (still opens on Service Order)', async () => {
    const wrapper = await mountView()
    await wrapper.vm.$nextTick()
    expect(isVShowHidden(wrapper.find('[data-testid="service-order-panel"]'))).toBe(false)
  })

  it('the slides panel receives the assembled slideshow and the groups map as props', async () => {
    mockSlideGroupsState.groups = [
      { id: 'slot-0', slotId: 'slot-0', serviceId: 'service-1', slides: [], createdAt: mockTimestamp, updatedAt: mockTimestamp },
    ]
    const wrapper = await mountView()
    await wrapper.vm.$nextTick()

    const slidesTab = wrapper.findComponent(SlidesTab)
    expect(slidesTab.exists()).toBe(true)
    expect(slidesTab.props('assembledSlideshow')).toBeDefined()
    expect(Array.isArray(slidesTab.props('assembledSlideshow'))).toBe(true)
    expect(slidesTab.props('groupsBySlotId')).toBeInstanceOf(Map)
    expect((slidesTab.props('groupsBySlotId') as Map<string, unknown>).has('slot-0')).toBe(true)
    expect(slidesTab.props()).not.toHaveProperty('pendingReconciliations')
    expect(slidesTab.props('slots')).toEqual(mockService.slots)
    expect(slidesTab.props('serviceId')).toBe('service-1')
    expect(slidesTab.props('isEditor')).toBe(true)
  })

  it('passes the on-demand group materializer down to the slides panel (25-05 Task 1)', async () => {
    const wrapper = await mountView()
    await wrapper.vm.$nextTick()

    const slidesTab = wrapper.findComponent(SlidesTab)
    expect(slidesTab.props('ensureGroupMaterialized')).toBeInstanceOf(Function)
  })

  it('the slides panel is told it is active only while the Slides tab is selected', async () => {
    const wrapper = await mountView()
    await wrapper.vm.$nextTick()

    let slidesTab = wrapper.findComponent(SlidesTab)
    expect(slidesTab.props('active')).toBe(false)

    const slidesBtn = wrapper.findAll('button').find((b) => b.text() === 'Slides')
    await slidesBtn!.trigger('click')
    await wrapper.vm.$nextTick()

    slidesTab = wrapper.findComponent(SlidesTab)
    expect(slidesTab.props('active')).toBe(true)

    const serviceOrderBtn = wrapper.findAll('button').find((b) => b.text() === 'Service Order')
    await serviceOrderBtn!.trigger('click')
    await wrapper.vm.$nextTick()

    slidesTab = wrapper.findComponent(SlidesTab)
    expect(slidesTab.props('active')).toBe(false)
  })

  it('renders no page-level import control and no generate-missing-slides control anywhere on the page', async () => {
    const wrapper = await mountView()
    const text = wrapper.text()
    expect(text).not.toContain('Generate missing slides')
    // The existing per-item "Import PowerPoint" menu entries are unrelated
    // page-level actions this phase does not touch — only a NEW page-level
    // "⇪ Import" header button (D-02) is prohibited.
    expect(wrapper.find('[data-testid="page-level-import"]').exists()).toBe(false)
  })

  // MOVED-CONTROL (36-03, R069): the index-based lookup itself is unaffected
  // by the reorder (Service Order is still index 0 either way), restated here
  // only so the filter's own literal order documents the new rendered order.
  it('the first tab button still reads Service Order', async () => {
    const wrapper = await mountView()
    const firstTabBtn = wrapper.findAll('button').filter((b) => ['Service Order', 'Slides', 'Roles'].includes(b.text()))[0]
    expect(firstTabBtn?.text()).toBe('Service Order')
  })

  it('the first tab panel is reachable by a stable data-testid seam (27-02)', async () => {
    const wrapper = await mountView()
    await wrapper.vm.$nextTick()

    const panel = wrapper.find('[data-testid="service-order-panel"]')
    expect(panel.exists()).toBe(true)
    expect(isVShowHidden(panel)).toBe(false)
  })
})

// ── "Edit in scripture" plumbing (Phase 26-03, D-15) ────────────────────────────
// The drawer built in 26-05/26-07 relays a request up through SlidesTab's
// `navigate-to-scripture-editor` event. Here the SlidesTab is shallow-mount
// stubbed, so tests emit that event directly on the stub — the same seam a
// real drawer will use once wired.

describe('ServiceEditorView - Edit in scripture plumbing (Phase 26-03)', () => {
  async function mountView() {
    const { default: ServiceEditorView } = await import('@/views/ServiceEditorView.vue')
    return shallowMount(ServiceEditorView, {
      global: {
        stubs: {
          AppShell: { template: '<div><slot /></div>' },
          // 36-03: Suggest/Export/Copy/Save/Present all moved into this real
          // child component (ContextualActionBar.vue) — every mountView in
          // this file must render it for real (`false` opts a component OUT
          // of shallowMount's default auto-stub) or none of those controls'
          // pre-existing testids/text are reachable in the DOM anymore.
          ContextualActionBar: false,
          RouterLink: { template: '<a><slot /></a>' },
          // 32-05: render the real SaveStatusIndicator (not a shallow stub)
          // so its data-testid="save-status"/"save-status-error" handles are
          // reachable from these tests.
          SaveStatusIndicator: false,
          ServicePrintLayout: true,
          SongBadge: true,
          SongSlotPicker: true,
          ScriptureInput: true,
          // 34-07: the congregational-editor modal is a <Teleport to="body">
          // block, same as the export/reopen/delete dialogs elsewhere in this
          // file — shallowMount discards teleported children unless opted out.
          teleport: false,
        },
      },
    })
  }

  beforeEach(() => {
    mockAuthState.isEditor = true
    mockAuthState.orgId = 'org-1'
    mockServicesList = [mockService]
  })

  // ★ REVISED 34-07 (owner UAT F1) — the relay is REUSED, the destination is
  // REPLACED. R047's tab-switch-plus-scroll destination is gone; relaying
  // the event now opens the congregational-reading MODAL for that slot and
  // leaves `activeTab` untouched — the disorientation of dragging the user
  // off the Slides tab (where the request originates) was the point of F1.
  it('opens the congregational-editor modal for the requested SCRIPTURE slot, and leaves activeTab unchanged (Slides stays active)', async () => {
    const wrapper = await mountView()
    await wrapper.vm.$nextTick()

    // Start on the Slides tab, where both routes to this relay originate.
    const slidesBtn = wrapper.findAll('button').find((b) => b.text() === 'Slides')
    await slidesBtn!.trigger('click')
    await wrapper.vm.$nextTick()
    expect(isVShowHidden(wrapper.find('[data-testid="service-order-panel"]'))).toBe(true)

    // slot-1 is the populated SCRIPTURE plan item (raw array index 1).
    await wrapper.findComponent(SlidesTab).vm.$emit('navigate-to-scripture-editor', 1)
    await wrapper.vm.$nextTick()
    await wrapper.vm.$nextTick()

    // activeTab is unchanged — the Slides tab stays hidden-false the same
    // way it was before the relay; the Service Order panel does NOT reappear.
    // The modal is Teleported to body — queried via document, not `wrapper`.
    expect(isVShowHidden(wrapper.find('[data-testid="service-order-panel"]'))).toBe(true)
    const body = new DOMWrapper(document.body)
    expect(body.find('[data-testid="congregational-editor-modal"]').exists()).toBe(true)
    expect(body.find('[data-testid="congregational-editor-panel"]').exists()).toBe(true)
  })

  it('asking twice for the same slot is idempotent and does not throw — the modal stays open on that slot', async () => {
    const wrapper = await mountView()
    await wrapper.vm.$nextTick()
    const body = new DOMWrapper(document.body)

    for (let i = 0; i < 2; i++) {
      await wrapper.findComponent(SlidesTab).vm.$emit('navigate-to-scripture-editor', 1)
      await wrapper.vm.$nextTick()
      await wrapper.vm.$nextTick()
      expect(body.find('[data-testid="congregational-editor-modal"]').exists()).toBe(true)
    }
  })

  it('relaying for a service whose status is not draft (planned/locked) renders no modal', async () => {
    mockServicesList = [{ ...mockService, status: 'planned' }]
    const wrapper = await mountView()
    await wrapper.vm.$nextTick()

    await wrapper.findComponent(SlidesTab).vm.$emit('navigate-to-scripture-editor', 1)
    await wrapper.vm.$nextTick()
    await wrapper.vm.$nextTick()

    expect(new DOMWrapper(document.body).find('[data-testid="congregational-editor-modal"]').exists()).toBe(false)
  })

  // R047: the "Edit Scripture Slides" button and its panel are gone from this
  // tab. They fetched passage TEXT into a separate reading document, which is
  // not what a scripture slide shows and is Phase 34's concern. Their presence
  // implied the slide had a second, hidden source.
  it('renders no scripture slides editor button or panel on the Service Order tab', async () => {
    const wrapper = await mountView()
    await wrapper.vm.$nextTick()

    expect(wrapper.find('[data-testid="edit-scripture-slides-btn"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="scripture-editor-panel"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="reading-mode-toggle"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="scripture-slide-editor"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="congregational-editor"]').exists()).toBe(false)
  })

  it('an out-of-range index changes nothing, does not throw, and renders no modal', async () => {
    const wrapper = await mountView()
    await wrapper.vm.$nextTick()

    const before = wrapper.find('[data-testid="service-order-panel"]')
    const wasHidden = isVShowHidden(before)

    expect(() => wrapper.findComponent(SlidesTab).vm.$emit('navigate-to-scripture-editor', 999)).not.toThrow()
    await wrapper.vm.$nextTick()
    await wrapper.vm.$nextTick()

    expect(isVShowHidden(wrapper.find('[data-testid="service-order-panel"]'))).toBe(wasHidden)
    expect(new DOMWrapper(document.body).find('[data-testid="congregational-editor-modal"]').exists()).toBe(false)
  })

  it('a request naming a non-scripture plan item does not switch tabs and renders no modal', async () => {
    const wrapper = await mountView()
    await wrapper.vm.$nextTick()

    const slidesBtn = wrapper.findAll('button').find((b) => b.text() === 'Slides')
    await slidesBtn!.trigger('click')
    await wrapper.vm.$nextTick()

    // slot-0 is a SONG plan item.
    await wrapper.findComponent(SlidesTab).vm.$emit('navigate-to-scripture-editor', 0)
    await wrapper.vm.$nextTick()
    await wrapper.vm.$nextTick()

    expect(isVShowHidden(wrapper.find('[data-testid="service-order-panel"]'))).toBe(true)
    expect(new DOMWrapper(document.body).find('[data-testid="congregational-editor-modal"]').exists()).toBe(false)
  })

  it('every scripture plan item row carries its own index marker', async () => {
    const twoScriptureService: Service = {
      ...mockService,
      slots: mockService.slots.map((slot) =>
        slot.id === 'slot-4'
          ? { ...slot, book: 'John', chapter: 3, verseStart: 16, verseEnd: 16 }
          : slot,
      ),
    }
    mockServicesList = [twoScriptureService]
    const wrapper = await mountView()
    await wrapper.vm.$nextTick()

    expect(wrapper.find('[data-scripture-slot-index="1"]').exists()).toBe(true)
    expect(wrapper.find('[data-scripture-slot-index="4"]').exists()).toBe(true)
  })
})

// ── 34-07 (owner UAT F1) — the congregational-reading editor is now MOUNTED ──
// (the reachability gap 34-VERIFICATION.md recorded). Unlike the block above
// (which shallow-stubs everything, including CongregationalEditor itself),
// this block mounts CongregationalEditor for REAL so its props and emits are
// actually exercised — the literal gap-closure check
// (`grep -rl "CongregationalEditor" src --include=*.vue`) now finds a real
// component instance being driven through its props/emits contract, not just
// an import statement.
describe('ServiceEditorView - congregational reading (34-07)', () => {
  async function mountView(overrides: Partial<Service> = {}) {
    if (Object.keys(overrides).length > 0) {
      mockServicesList = [{ ...mockService, ...overrides }]
    }
    const { default: ServiceEditorView } = await import('@/views/ServiceEditorView.vue')
    return shallowMount(ServiceEditorView, {
      global: {
        stubs: {
          AppShell: { template: '<div><slot /></div>' },
          // 36-03: Suggest/Export/Copy/Save/Present all moved into this real
          // child component (ContextualActionBar.vue) — every mountView in
          // this file must render it for real (`false` opts a component OUT
          // of shallowMount's default auto-stub) or none of those controls'
          // pre-existing testids/text are reachable in the DOM anymore.
          ContextualActionBar: false,
          RouterLink: { template: '<a><slot /></a>' },
          SaveStatusIndicator: false,
          ServicePrintLayout: true,
          SongBadge: true,
          SongSlotPicker: true,
          ScriptureInput: true,
          // shallowMount auto-stubs EVERY child regardless of whether it's
          // listed here — `CongregationalEditor: false` is what actually
          // opts it out of that and mounts the real component, which this
          // block's whole point requires.
          CongregationalEditor: false,
          teleport: false,
        },
      },
    })
  }

  beforeEach(() => {
    mockAuthState.isEditor = true
    mockAuthState.orgId = 'org-1'
    mockServicesList = [mockService]
    mockUpdateService.mockClear()
  })

  function body() {
    return new DOMWrapper(document.body)
  }

  it('relays navigate-to-scripture-editor for a SCRIPTURE slot: update:sections lands on that slot, book/chapter/verseStart/verseEnd/id/position unchanged, and the textarea editor is present', async () => {
    const wrapper = await mountView()
    await wrapper.vm.$nextTick()

    await wrapper.findComponent(SlidesTab).vm.$emit('navigate-to-scripture-editor', 1)
    await wrapper.vm.$nextTick()

    expect(body().find('[data-testid="congregational-editor-modal"]').exists()).toBe(true)
    const editor = wrapper.findComponent(CongregationalEditor)
    expect(editor.exists()).toBe(true)

    // The reading is now edited as a `---`-delimited textarea (supersedes the
    // click-between-verses divider UX per owner feedback).
    expect(body().find('[data-testid="congregational-textarea"]').exists()).toBe(true)

    const newSections = [
      { speaker: 'LEADER' as const, text: 'The Lord is my shepherd' },
      { speaker: 'CONGREGATION' as const, text: 'I shall not want' },
    ]
    editor.vm.$emit('update:sections', newSections)
    await wrapper.vm.$nextTick()
    await new Promise((resolve) => setTimeout(resolve, 900))
    await flushPromises()

    const written = mockUpdateService.mock.calls
      .map(([, patch]) => (patch as { slots?: Array<Record<string, unknown>> }).slots)
      .filter((slots): slots is Array<Record<string, unknown>> => Array.isArray(slots))
      .pop()
    const scriptureSlot = written?.find((s) => s.id === 'slot-1')
    expect(scriptureSlot).toBeDefined()
    expect(scriptureSlot!.congregationalSections).toEqual(newSections)
    expect(scriptureSlot!.book).toBe('Psalms')
    expect(scriptureSlot!.chapter).toBe(23)
    expect(scriptureSlot!.verseStart).toBe(1)
    expect(scriptureSlot!.verseEnd).toBe(6)
    expect(scriptureSlot!.id).toBe('slot-1')
    expect(scriptureSlot!.position).toBe(1)
  })

  it('does not change activeTab (the Slides tab stays selected)', async () => {
    const wrapper = await mountView()
    await wrapper.vm.$nextTick()
    const slidesBtn = wrapper.findAll('button').find((b) => b.text() === 'Slides')
    await slidesBtn!.trigger('click')
    await wrapper.vm.$nextTick()

    await wrapper.findComponent(SlidesTab).vm.$emit('navigate-to-scripture-editor', 1)
    await wrapper.vm.$nextTick()

    // Service Order stays hidden — the relay never flips activeTab back.
    expect(isVShowHidden(wrapper.find('[data-testid="service-order-panel"]'))).toBe(true)
  })

  it('for a service whose status is planned (locked), relaying renders no modal', async () => {
    const wrapper = await mountView({ status: 'planned' })
    await wrapper.vm.$nextTick()

    await wrapper.findComponent(SlidesTab).vm.$emit('navigate-to-scripture-editor', 1)
    await wrapper.vm.$nextTick()

    expect(body().find('[data-testid="congregational-editor-modal"]').exists()).toBe(false)
  })

  it('an out-of-range index and a non-SCRIPTURE index each render no modal', async () => {
    const wrapper = await mountView()
    await wrapper.vm.$nextTick()

    await wrapper.findComponent(SlidesTab).vm.$emit('navigate-to-scripture-editor', 999)
    await wrapper.vm.$nextTick()
    expect(body().find('[data-testid="congregational-editor-modal"]').exists()).toBe(false)

    // slot-0 is SONG.
    await wrapper.findComponent(SlidesTab).vm.$emit('navigate-to-scripture-editor', 0)
    await wrapper.vm.$nextTick()
    expect(body().find('[data-testid="congregational-editor-modal"]').exists()).toBe(false)
  })

  it('the modal header renders a save-status element', async () => {
    const wrapper = await mountView()
    await wrapper.vm.$nextTick()

    await wrapper.findComponent(SlidesTab).vm.$emit('navigate-to-scripture-editor', 1)
    await wrapper.vm.$nextTick()

    const modal = body().find('[data-testid="congregational-editor-modal"]')
    expect(modal.find('[data-testid="save-status"]').exists()).toBe(true)
  })

  // T-34-07-06 — exactly ONE save-status region exists on the
  // `service:{serviceId}` surface at any moment. The modal is Teleported to
  // body, so this assertion is DOCUMENT-scoped (not `wrapper`-scoped) — a
  // wrapper-scoped query would only ever count the page's own copy and prove
  // nothing about the modal's.
  it('exactly one [data-testid="save-status"] exists in the whole document while the modal is open, and it is the one inside the modal; the page bar is absent', async () => {
    const wrapper = await mountView()
    await wrapper.vm.$nextTick()
    // Seed a non-idle status so the page bar would have visible chrome if it
    // were rendered — the absence assertion below needs real chrome to be
    // meaningful, not just an always-idle empty box.
    const saveStatus = useSaveStatus()
    saveStatus.set('service:service-1', { status: 'saved', savedAt: new Date() })
    await wrapper.vm.$nextTick()

    await wrapper.findComponent(SlidesTab).vm.$emit('navigate-to-scripture-editor', 1)
    await wrapper.vm.$nextTick()

    const documentSaveStatusNodes = body().findAll('[data-testid="save-status"]')
    expect(documentSaveStatusNodes).toHaveLength(1)
    const modal = body().find('[data-testid="congregational-editor-modal"]')
    expect(modal.find('[data-testid="save-status"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="service-save-status-bar"]').exists()).toBe(false)
  })

  it('the page save-status bar returns once the modal closes', async () => {
    const wrapper = await mountView()
    await wrapper.vm.$nextTick()
    const saveStatus = useSaveStatus()
    saveStatus.set('service:service-1', { status: 'saved', savedAt: new Date() })
    await wrapper.vm.$nextTick()

    await wrapper.findComponent(SlidesTab).vm.$emit('navigate-to-scripture-editor', 1)
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[data-testid="service-save-status-bar"]').exists()).toBe(false)

    const editor = wrapper.findComponent(CongregationalEditor)
    editor.vm.$emit('close')
    await wrapper.vm.$nextTick()

    expect(body().find('[data-testid="congregational-editor-modal"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="service-save-status-bar"]').exists()).toBe(true)
  })

  it('the close control unmounts the panel and writes nothing', async () => {
    const wrapper = await mountView()
    await wrapper.vm.$nextTick()

    await wrapper.findComponent(SlidesTab).vm.$emit('navigate-to-scripture-editor', 1)
    await wrapper.vm.$nextTick()

    await body().find('[data-testid="congregational-editor-close"]').trigger('click')
    await wrapper.vm.$nextTick()

    expect(body().find('[data-testid="congregational-editor-modal"]').exists()).toBe(false)
    expect(mockUpdateService).not.toHaveBeenCalled()
  })

  it('delete routes through onCongregationalDelete: clears the slot\'s congregationalSections while leaving the reference fields intact', async () => {
    const withReading: Service = {
      ...mockService,
      slots: mockService.slots.map((slot) =>
        slot.id === 'slot-1'
          ? { ...slot, congregationalSections: [{ speaker: 'LEADER' as const, text: 'Old passage text' }] }
          : slot,
      ),
    }
    const wrapper = await mountView(withReading)
    await wrapper.vm.$nextTick()

    await wrapper.findComponent(SlidesTab).vm.$emit('navigate-to-scripture-editor', 1)
    await wrapper.vm.$nextTick()

    const editor = wrapper.findComponent(CongregationalEditor)
    editor.vm.$emit('delete')
    await wrapper.vm.$nextTick()
    await new Promise((resolve) => setTimeout(resolve, 900))
    await flushPromises()

    const written = mockUpdateService.mock.calls
      .map(([, patch]) => (patch as { slots?: Array<Record<string, unknown>> }).slots)
      .filter((slots): slots is Array<Record<string, unknown>> => Array.isArray(slots))
      .pop()
    const scriptureSlot = written?.find((s) => s.id === 'slot-1')
    expect(scriptureSlot).toBeDefined()
    // Reverts to a plain scripture reference — the reference fields are intact,
    // only the reading is dropped.
    expect(scriptureSlot!.book).toBe('Psalms')
    expect(scriptureSlot!.chapter).toBe(23)
    // The key must be ABSENT from the written patch, not present-with-undefined:
    // Firestore's updateDoc rejects an undefined field value. (`toBeUndefined`
    // alone passed even for the buggy `congregationalSections: undefined`, since
    // reading a present-but-undefined key also yields undefined — hence the
    // stricter `in` check that mirrors what Firestore actually requires.)
    expect('congregationalSections' in scriptureSlot!).toBe(false)
    expect(scriptureSlot!.congregationalSections).toBeUndefined()
  })

  it('exactly one CongregationalEditor element exists in the rendered tree when the modal is open', async () => {
    const wrapper = await mountView()
    await wrapper.vm.$nextTick()

    await wrapper.findComponent(SlidesTab).vm.$emit('navigate-to-scripture-editor', 1)
    await wrapper.vm.$nextTick()

    expect(wrapper.findAllComponents(CongregationalEditor)).toHaveLength(1)
  })
})

// ── 34-07 Task 3 — WR-04 keyed-mount contract, proven by a slot-swap test ──
// `CongregationalEditor.vue` seeds its editable state ONCE at setup and is
// deliberately not reactive to a later prop change (34-06,
// CongregationalEditor.vue:357-376's original contract comment, restated in
// `PENDING-VERIFICATION.md` item 34.2). A parent that swaps which slot the
// panel shows without forcing a fresh instance would silently misattribute a
// save to the first slot the instance ever saw — no error, no warning, no
// visual tell. This block exists because that failure is silent; a comment
// asserting the `:key` is present is not evidence, a swap test is.
describe('ServiceEditorView - WR-04 keyed mount (34-07 Task 3)', () => {
  async function mountView() {
    const { default: ServiceEditorView } = await import('@/views/ServiceEditorView.vue')
    return shallowMount(ServiceEditorView, {
      global: {
        stubs: {
          AppShell: { template: '<div><slot /></div>' },
          // 36-03: Suggest/Export/Copy/Save/Present all moved into this real
          // child component (ContextualActionBar.vue) — every mountView in
          // this file must render it for real (`false` opts a component OUT
          // of shallowMount's default auto-stub) or none of those controls'
          // pre-existing testids/text are reachable in the DOM anymore.
          ContextualActionBar: false,
          RouterLink: { template: '<a><slot /></a>' },
          SaveStatusIndicator: false,
          ServicePrintLayout: true,
          SongBadge: true,
          SongSlotPicker: true,
          ScriptureInput: true,
          // shallowMount auto-stubs EVERY child regardless of whether it's
          // listed here — `CongregationalEditor: false` opts it out and
          // mounts the real component, which the seeding-text and
          // vm-identity assertions below both need.
          CongregationalEditor: false,
          teleport: false,
        },
      },
    })
  }

  function body() {
    return new DOMWrapper(document.body)
  }

  beforeEach(() => {
    mockAuthState.isEditor = true
    mockAuthState.orgId = 'org-1'
    mockUpdateService.mockClear()
  })

  // Two SCRIPTURE slots (slot-1, slot-4 — both already present in
  // mockService), each given its own reference and its own
  // congregationalSections whose text is distinguishable between the two.
  const twoReadingsService: Service = {
    ...mockService,
    slots: mockService.slots.map((slot) => {
      if (slot.id === 'slot-1') {
        return { ...slot, congregationalSections: [{ speaker: 'LEADER' as const, text: 'FIRST-SLOT-ONLY-TEXT' }] }
      }
      if (slot.id === 'slot-4') {
        return {
          ...slot,
          book: 'John',
          chapter: 3,
          verseStart: 16,
          verseEnd: 16,
          congregationalSections: [{ speaker: 'LEADER' as const, text: 'SECOND-SLOT-ONLY-TEXT' }],
        }
      }
      return slot
    }),
  }

  it('a slot swap yields a fresh CongregationalEditor instance, re-seeds from the new slot, and a post-swap write lands on the second slot only', async () => {
    mockServicesList = [twoReadingsService]
    const wrapper = await mountView()
    await wrapper.vm.$nextTick()

    // Open the panel on the first slot (array index 1). The reading is seeded
    // into the textarea (its VALUE, not text content — read `.value`).
    await wrapper.findComponent(SlidesTab).vm.$emit('navigate-to-scripture-editor', 1)
    await wrapper.vm.$nextTick()
    const firstTextarea = body().find('[data-testid="congregational-textarea"]')
      .element as HTMLTextAreaElement
    expect(firstTextarea.value).toContain('FIRST-SLOT-ONLY-TEXT')
    const firstVm = wrapper.findComponent(CongregationalEditor).vm

    // Swap to the second slot (array index 4) — the misattribution guard.
    await wrapper.findComponent(SlidesTab).vm.$emit('navigate-to-scripture-editor', 4)
    await wrapper.vm.$nextTick()
    const secondVm = wrapper.findComponent(CongregationalEditor).vm
    expect(secondVm).not.toBe(firstVm)

    // The seeding guard — the fresh instance really re-seeded from the new
    // props, not retained once-at-setup state from the first slot.
    const secondTextarea = body().find('[data-testid="congregational-textarea"]')
      .element as HTMLTextAreaElement
    expect(secondTextarea.value).toContain('SECOND-SLOT-ONLY-TEXT')
    expect(secondTextarea.value).not.toContain('FIRST-SLOT-ONLY-TEXT')

    // The write-attribution guard — a post-swap update:sections lands on the
    // SECOND slot only, leaving the first slot's sections byte-unchanged.
    const editor = wrapper.findComponent(CongregationalEditor)
    editor.vm.$emit('update:sections', [{ speaker: 'LEADER', text: 'UPDATED-SECOND-SLOT-TEXT' }])
    await wrapper.vm.$nextTick()
    await new Promise((resolve) => setTimeout(resolve, 900))
    await flushPromises()

    const written = mockUpdateService.mock.calls
      .map(([, patch]) => (patch as { slots?: Array<Record<string, unknown>> }).slots)
      .filter((slots): slots is Array<Record<string, unknown>> => Array.isArray(slots))
      .pop()
    const slot1 = written?.find((s) => s.id === 'slot-1')
    const slot4 = written?.find((s) => s.id === 'slot-4')
    expect(slot4?.congregationalSections).toEqual([{ speaker: 'LEADER', text: 'UPDATED-SECOND-SLOT-TEXT' }])
    expect(slot1?.congregationalSections).toEqual([{ speaker: 'LEADER', text: 'FIRST-SLOT-ONLY-TEXT' }])
  })
})

// ── No deck-editing or deck-import surface on the Service Order tab (Phase 27-03, R034) ──
// The imported-deck editor and both section-scoped PowerPoint/image import actions are
// removed from this tab (deck import now lives on the Slides tab, Phase 25-07). The
// imported plan item's own row — its heading and empty-state wording — is service
// structure and stays; only its slide-editing half leaves.

describe('ServiceEditorView - no deck editing or deck import on the Service Order tab (Phase 27-03)', () => {
  const importedSlidesService: Service = {
    ...mockService,
    slots: [
      ...mockService.slots,
      { kind: 'IMPORTED', id: 'slot-imported-with-id', position: 9, importId: 'import-1' },
      { kind: 'IMPORTED', id: 'slot-imported-empty', position: 10, importId: null },
    ],
  }

  async function mountView() {
    const { default: ServiceEditorView } = await import('@/views/ServiceEditorView.vue')
    return shallowMount(ServiceEditorView, {
      global: {
        stubs: {
          AppShell: { template: '<div><slot /></div>' },
          // 36-03: Suggest/Export/Copy/Save/Present all moved into this real
          // child component (ContextualActionBar.vue) — every mountView in
          // this file must render it for real (`false` opts a component OUT
          // of shallowMount's default auto-stub) or none of those controls'
          // pre-existing testids/text are reachable in the DOM anymore.
          ContextualActionBar: false,
          RouterLink: { template: '<a><slot /></a>' },
          // 32-05: render the real SaveStatusIndicator (not a shallow stub)
          // so its data-testid="save-status"/"save-status-error" handles are
          // reachable from these tests.
          SaveStatusIndicator: false,
          ServicePrintLayout: true,
          SongBadge: true,
          SongSlotPicker: true,
          ScriptureInput: true,
        },
      },
    })
  }

  beforeEach(() => {
    mockAuthState.isEditor = true
    mockAuthState.orgId = 'org-1'
    mockServicesList = [importedSlidesService]
  })

  it('offers no way to expand or view an imported deck editor', async () => {
    const wrapper = await mountView()
    await wrapper.vm.$nextTick()

    expect(wrapper.find('[data-testid="edit-imported-slides-btn"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="imported-editor-panel"]').exists()).toBe(false)
  })

  // 36-05: moved-and-restyled-control edit — the palette has no open/closed state (every chip
  // is directly clickable), so this test no longer needs to trigger a click to reveal it.
  // `addSlot`'s logic and every argument it receives are unchanged.
  it('offers no PowerPoint/image import action in the add-to-service palette, and the modal it opened is gone', async () => {
    const wrapper = await mountView()
    await wrapper.vm.$nextTick()

    expect(wrapper.find('[data-testid="add-to-service-palette"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="add-import-announcements"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="add-import-sermon"]').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('Import PowerPoint')
  })

  it('still offers the six non-import palette chips (43-03: Hymn retired, Announcements/Misc added)', async () => {
    const wrapper = await mountView()
    await wrapper.vm.$nextTick()

    const palette = wrapper.find('[data-testid="add-to-service-palette"]')
    expect(palette.exists()).toBe(true)
    const chipLabels = palette.findAll('button').map((b) => b.text())
    expect(chipLabels).toEqual(expect.arrayContaining(['Song', 'Scripture', 'Prayer', 'Message', 'Announcements', 'Miscellaneous']))
  })

  it('an existing imported plan item with a deck still renders its heading', async () => {
    const wrapper = await mountView()
    await wrapper.vm.$nextTick()

    expect(wrapper.text()).toContain('Imported Slides')
  })

  it('an existing imported plan item with no deck still renders its empty-state wording', async () => {
    mockServicesList = [
      {
        ...mockService,
        slots: [
          ...mockService.slots,
          { kind: 'IMPORTED', id: 'slot-imported-empty-only', position: 9, importId: null },
        ],
      },
    ]
    const wrapper = await mountView()
    await wrapper.vm.$nextTick()

    expect(wrapper.text()).toContain('Imported Slides — Empty')
  })
})

// ── Reorder repro (Phase 29-01, R044) ────────────────────────────────────────
// Builds the FAILING reproduction of the reported ZTXcpNRcJTalEQp42fTx symptom
// (Sending mid-list, Message last, Worship appearing twice) before any source
// fix lands. Every fixture below includes section-header nodes as REAL
// siblings of the slot items — exactly as ServiceEditorView.vue renders them —
// and every index handed to `onEnd` is derived from that live DOM by
// `simulateSlotDrag`, never hand-passed. This is deliberate: the pre-existing
// tests above (and SlideGrid.test.ts's pre-29-01 shape) pass with the three
// defects still present precisely because their fixtures have no header
// siblings and their indices are typed in by hand. Every assertion below
// reads `slot.id` identity, never position/index.
describe('ServiceEditorView - Phase 29 reorder repro', () => {
  async function mountView() {
    const { default: ServiceEditorView } = await import('@/views/ServiceEditorView.vue')
    return shallowMount(ServiceEditorView, {
      global: {
        stubs: {
          AppShell: { template: '<div><slot /></div>' },
          // 36-03: Suggest/Export/Copy/Save/Present all moved into this real
          // child component (ContextualActionBar.vue) — every mountView in
          // this file must render it for real (`false` opts a component OUT
          // of shallowMount's default auto-stub) or none of those controls'
          // pre-existing testids/text are reachable in the DOM anymore.
          ContextualActionBar: false,
          RouterLink: { template: '<a><slot /></a>' },
          // 32-05: render the real SaveStatusIndicator (not a shallow stub)
          // so its data-testid="save-status"/"save-status-error" handles are
          // reachable from these tests.
          SaveStatusIndicator: false,
          ServicePrintLayout: true,
          SongBadge: true,
          SongSlotPicker: true,
          ScriptureInput: true,
        },
      },
    })
  }

  /** Resolves the container that holds `section`'s `.slot-item` nodes —
   *  prefers a scoped per-section container (the 29-03 shape); falls back to
   *  the single flat container that holds every `.slot-item` today. */
  function resolveSectionContainer(wrapper: Awaited<ReturnType<typeof mountView>>, section: string): HTMLElement {
    const scoped = wrapper.find(`[data-testid="section-list-${section}"]`)
    if (scoped.exists()) return scoped.element as HTMLElement
    const anySlotItem = wrapper.find('.slot-item')
    if (!anySlotItem.exists()) throw new Error('simulateSlotDrag: no .slot-item found in the rendered DOM')
    return anySlotItem.element.parentElement as HTMLElement
  }

  /** The `.slot-item` element children of `container` that belong to
   *  `section` — scanned as the siblings between `section-header-{section}`
   *  and the next `.section-header` (today's flat render), or every
   *  `.slot-item` child when the container has no header siblings at all
   *  (the 29-03 per-section shape). */
  function sectionSlotItems(container: HTMLElement, section: string): HTMLElement[] {
    const children = Array.from(container.children) as HTMLElement[]
    const headerIndex = children.findIndex((c) => c.dataset.testid === `section-header-${section}`)
    if (headerIndex === -1) {
      return children.filter((c) => c.classList.contains('slot-item'))
    }
    const items: HTMLElement[] = []
    for (let i = headerIndex + 1; i < children.length; i++) {
      const child = children[i]!
      if (child.classList.contains('section-header')) break
      if (child.classList.contains('slot-item')) items.push(child)
    }
    return items
  }

  function elementIndex(container: HTMLElement, node: HTMLElement): number {
    return Array.from(container.children).indexOf(node)
  }

  function draggableIndex(container: HTMLElement, node: HTMLElement): number {
    return Array.from(container.children)
      .filter((c) => (c as HTMLElement).classList.contains('slot-item'))
      .indexOf(node)
  }

  /**
   * Derives BOTH SortableJS index pairs from the LIVE rendered DOM and
   * invokes the matching capture's `onEnd` directly — never accepts a
   * hand-passed index. Works unchanged whether the source/destination
   * containers are today's single flat list (headers as siblings) or the
   * per-section containers 29-03 introduces.
   */
  async function simulateSlotDrag(
    wrapper: Awaited<ReturnType<typeof mountView>>,
    { fromSection, fromPos, toSection, toPos }: { fromSection: string; fromPos: number; toSection: string; toPos: number },
  ): Promise<void> {
    const fromContainer = resolveSectionContainer(wrapper, fromSection)
    const toContainer = resolveSectionContainer(wrapper, toSection)

    const fromItems = sectionSlotItems(fromContainer, fromSection)
    const item = fromItems[fromPos]
    if (!item) throw new Error(`simulateSlotDrag: no slot-item at ${fromSection}[${fromPos}]`)

    const oldIndex = elementIndex(fromContainer, item)
    const oldDraggableIndex = draggableIndex(fromContainer, item)

    // Destination items EXCLUDING the dragged node itself (relevant for a
    // within-section move, where `item` is still one of `toSection`'s
    // current children) — `toPos` indexes into this post-removal ordering,
    // matching the splice-out/splice-in mental model the fix itself uses.
    const toItemsExcludingSelf = sectionSlotItems(toContainer, toSection).filter((el) => el !== item)
    const destAnchor = toItemsExcludingSelf[toPos] ?? null

    let newIndex: number
    let newDraggableIndex: number
    if (destAnchor) {
      newIndex = elementIndex(toContainer, destAnchor)
      newDraggableIndex = draggableIndex(toContainer, destAnchor)
    } else if (toItemsExcludingSelf.length > 0) {
      // Past the last existing item in the destination section — land one
      // position after it.
      const lastEl = toItemsExcludingSelf[toItemsExcludingSelf.length - 1]!
      newIndex = elementIndex(toContainer, lastEl) + 1
      newDraggableIndex = draggableIndex(toContainer, lastEl) + 1
    } else {
      // Destination section has no OTHER items — land immediately after its
      // header. Not exercised by either repro test below (both target a
      // non-empty section), kept correct for reuse by later plans.
      const headerEl = Array.from(toContainer.children).find(
        (c) => (c as HTMLElement).dataset.testid === `section-header-${toSection}`,
      ) as HTMLElement | undefined
      newIndex = headerEl ? elementIndex(toContainer, headerEl) + 1 : 0
      newDraggableIndex = 0
    }

    const capture = captureForSection(fromSection) ?? flatCapture()
    if (!capture) throw new Error(`simulateSlotDrag: no Sortable capture resolved for section "${fromSection}"`)

    await capture.options.onEnd!({
      oldIndex,
      newIndex,
      oldDraggableIndex,
      newDraggableIndex,
      item,
      from: fromContainer,
      to: toContainer,
    } as never)
    await flushPromises()
  }

  beforeEach(() => {
    mockAuthState.isEditor = true
    mockAuthState.orgId = 'org-1'
    mockServicesList = [makeSectionedService()]
    mockUpdateService.mockClear()
    resetSortableCaptures()
  })

  it('lands a service item exactly where it was dropped (R044)', async () => {
    const wrapper = await mountView()
    await wrapper.vm.$nextTick()

    // Worship is [s2, s3, s4] — drag s4 (worship position 2) to the first
    // position of the message section (currently [s5, s6]).
    await simulateSlotDrag(wrapper, { fromSection: 'worship', fromPos: 2, toSection: 'message', toPos: 0 })

    expect(mockUpdateService).toHaveBeenCalledTimes(1)
    const payload = mockUpdateService.mock.calls[0]![1] as { slots: Array<{ id: string; section?: string }> }
    const ids = payload.slots.map((s) => s.id)

    // Source removed from worship, inserted at the front of message — every
    // other section's internal order and the section-major ordering itself
    // are otherwise untouched.
    expect(ids).toEqual(['s1', 's2', 's3', 's4', 's5', 's6', 's7', 's8'])
    expect(payload.slots.map((s) => s.section)).toEqual([
      'pre-service', 'worship', 'worship', 'message', 'message', 'message', 'sending', 'sending',
    ])
    // Pins the "Worship appeared twice" symptom directly: no id may repeat.
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('moves an item within its own section to a non-adjacent position (R044)', async () => {
    const wrapper = await mountView()
    await wrapper.vm.$nextTick()

    // Worship is [s2, s3, s4] — drag s2 (position 0) to the last position —
    // the single-step DOM revert only undoes one adjacent step, so a
    // multi-position move is where DOM and persisted state diverge.
    await simulateSlotDrag(wrapper, { fromSection: 'worship', fromPos: 0, toSection: 'worship', toPos: 2 })

    expect(mockUpdateService).toHaveBeenCalledTimes(1)
    const payload = mockUpdateService.mock.calls[0]![1] as { slots: Array<{ id: string }> }
    const ids = payload.slots.map((s) => s.id)

    expect(ids).toEqual(['s1', 's3', 's4', 's2', 's5', 's6', 's7', 's8'])
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('creates one Sortable instance per rendered section list container, sharing the group name; the ungrouped container is pull-only (put: false)', async () => {
    mockServicesList = [{
      ...makeSectionedService(),
      slots: [...makeSectionedService().slots, { kind: 'PRAYER', id: 's9', position: 8 }], // section-less -> ungrouped
    }]
    const wrapper = await mountView()
    await wrapper.vm.$nextTick()

    expect(sortableCaptures).toHaveLength(6) // 5 sections (including the always-rendered, empty Post-Service) + the ungrouped container
    for (const section of ['pre-service', 'worship', 'message', 'sending', 'post-service']) {
      expect(captureForSection(section)?.options.group).toBe('service-slots')
    }
    // The ungrouped container has no `data-section` attribute — flatCapture() resolves it.
    expect(flatCapture()?.options.group).toEqual({ name: 'service-slots', pull: true, put: false })
  })

  it('reads only the Draggable-suffixed indices — deliberately wrong un-prefixed oldIndex/newIndex do not affect the result', async () => {
    const wrapper = await mountView()
    await wrapper.vm.$nextTick()

    const worshipCapture = captureForSection('worship')
    if (!worshipCapture) throw new Error('no worship capture resolved')

    // Same move as "moves an item within its own section..." above (s2 -> worship's last
    // position) but with oldIndex/newIndex set to values that would splice the WRONG slot
    // if the handler ever read them — it must not.
    await worshipCapture.options.onEnd!({
      oldIndex: 99,
      newIndex: 0,
      oldDraggableIndex: 0,
      newDraggableIndex: 2,
      item: worshipCapture.el.children[0] as HTMLElement,
      from: worshipCapture.el,
      to: worshipCapture.el,
    } as never)
    await flushPromises()

    expect(mockUpdateService).toHaveBeenCalledTimes(1)
    const payload = mockUpdateService.mock.calls[0]![1] as { slots: Array<{ id: string }> }
    expect(payload.slots.map((s) => s.id)).toEqual(['s1', 's3', 's4', 's2', 's5', 's6', 's7', 's8'])
  })

  it('performs no write for a no-op drag (same section, same draggable index)', async () => {
    const wrapper = await mountView()
    await wrapper.vm.$nextTick()

    const worshipCapture = captureForSection('worship')
    if (!worshipCapture) throw new Error('no worship capture resolved')

    await worshipCapture.options.onEnd!({
      oldIndex: 0,
      newIndex: 0,
      oldDraggableIndex: 1,
      newDraggableIndex: 1,
      item: worshipCapture.el.children[1] as HTMLElement,
      from: worshipCapture.el,
      to: worshipCapture.el,
    } as never)
    await flushPromises()

    expect(mockUpdateService).not.toHaveBeenCalled()
  })

  it('destroys every Sortable instance on unmount', async () => {
    const wrapper = await mountView()
    await wrapper.vm.$nextTick()

    const instanceCount = sortableCaptures.length
    expect(instanceCount).toBeGreaterThan(0)
    mockSlotSortableDestroy.mockClear()
    wrapper.unmount()

    expect(mockSlotSortableDestroy).toHaveBeenCalledTimes(instanceCount)
  })

  // ── Save-failure revert and the 'error' autosave state (Task 3, T-29-09) ─────
  it('reverts to the pre-drag id sequence and surfaces the UI-SPEC §5 message when the reorder write rejects, logging once via the bracketed-module convention', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    mockUpdateService.mockRejectedValueOnce(new Error('network error'))
    const wrapper = await mountView()
    await wrapper.vm.$nextTick()

    await simulateSlotDrag(wrapper, { fromSection: 'worship', fromPos: 0, toSection: 'worship', toPos: 2 })

    // Reverted: the write failed, so the editor must show the exact pre-drag id
    // sequence — never an order that was never persisted.
    const cards = wrapper.findAll('.slot-item')
    expect(cards.map((c) => c.attributes('data-slot-id'))).toEqual(['s1', 's2', 's3', 's4', 's5', 's6', 's7', 's8'])

    const errorMsg = wrapper.find('[data-testid="save-status-error"]')
    expect(errorMsg.exists()).toBe(true)
    expect(errorMsg.text()).toBe("Couldn't save this order — reverted. Try dragging again.")

    expect(errSpy).toHaveBeenCalledTimes(1)
    expect(errSpy).toHaveBeenCalledWith('[ServiceEditorView] reorder save failed:', expect.any(Error))

    errSpy.mockRestore()
  })

  it('a subsequent successful reorder clears the error state', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    mockUpdateService.mockRejectedValueOnce(new Error('network error'))
    const wrapper = await mountView()
    await wrapper.vm.$nextTick()

    await simulateSlotDrag(wrapper, { fromSection: 'worship', fromPos: 0, toSection: 'worship', toPos: 2 })
    expect(wrapper.find('[data-testid="save-status-error"]').exists()).toBe(true)

    // Same move again — this time the write resolves (mockUpdateService's default
    // implementation, not overridden a second time).
    await simulateSlotDrag(wrapper, { fromSection: 'worship', fromPos: 0, toSection: 'worship', toPos: 2 })
    expect(wrapper.find('[data-testid="save-status-error"]').exists()).toBe(false)

    errSpy.mockRestore()
  })

  // ── CR-01 regression: overlapping drags, first fails, second succeeds ────────
  // Reproduces the code-review BLOCKER empirically: SortableJS invokes `onEnd`
  // fire-and-forget (never awaited), so a second, faster drag can start — and its
  // write can succeed and persist — before an earlier drag's write settles. The
  // earlier drag's rejection must NOT restore a stale pre-drag snapshot that
  // discards the later, already-persisted edit, and must NOT leave a stale array
  // for the general autosave debounce to silently re-persist over the successful
  // write.
  it('a failed drag does not clobber (locally or via the debounce re-save) a later drag that already succeeded', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    // Drag A's write is held open until explicitly rejected below — this lets
    // drag B's write resolve first, matching the reviewer's empirical repro
    // timing (drag B's write settles BEFORE drag A's rejection is observed).
    let rejectDragA!: (err: Error) => void
    const dragAWrite = new Promise<void>((_resolve, reject) => {
      rejectDragA = reject
    })
    mockUpdateService.mockImplementationOnce(() => dragAWrite)

    const wrapper = await mountView()
    await wrapper.vm.$nextTick()

    const worshipCapture = captureForSection('worship')
    if (!worshipCapture) throw new Error('no worship capture resolved')

    // Drag A: worship is [s2, s3, s4] — move s2 (draggableIndex 0) to the last
    // position (draggableIndex 2). Fire-and-forget: do NOT await the returned
    // promise, matching real SortableJS's `onEnd` invocation.
    void worshipCapture.options.onEnd!({
      oldIndex: 0,
      newIndex: 2,
      oldDraggableIndex: 0,
      newDraggableIndex: 2,
      item: worshipCapture.el.children[0] as HTMLElement,
      from: worshipCapture.el,
      to: worshipCapture.el,
    } as never)

    // Let Vue apply drag A's synchronous optimistic mutation (worship is now
    // [s3, s4, s2] locally) before drag B reads state. Drag A's write is still
    // pending (dragAWrite unresolved) — this is the "overlapping" window.
    await wrapper.vm.$nextTick()
    expect(mockUpdateService).toHaveBeenCalledTimes(1)

    // Drag B: move s3 (now worship draggableIndex 0) to the last position
    // (draggableIndex 2). This write resolves via the default mock
    // (Promise.resolve()) and is fully awaited here, so it settles before
    // drag A's rejection below.
    await worshipCapture.options.onEnd!({
      oldIndex: 0,
      newIndex: 2,
      oldDraggableIndex: 0,
      newDraggableIndex: 2,
      item: worshipCapture.el.children[0] as HTMLElement,
      from: worshipCapture.el,
      to: worshipCapture.el,
    } as never)

    expect(mockUpdateService).toHaveBeenCalledTimes(2)
    const dragBPayload = mockUpdateService.mock.calls[1]![1] as { slots: Array<{ id: string }> }
    // s3 -> s4 -> s2 -> s3: worship becomes [s4, s2, s3].
    expect(dragBPayload.slots.map((s) => s.id)).toEqual(['s1', 's4', 's2', 's3', 's5', 's6', 's7', 's8'])

    // Drag A's write now rejects — its stale, pre-both-drags snapshot must NOT
    // be restored over drag B's already-persisted result.
    rejectDragA(new Error('network error'))
    await flushPromises()

    // Drag B's persisted order must survive in local state...
    const cards = wrapper.findAll('.slot-item')
    expect(cards.map((c) => c.attributes('data-slot-id'))).toEqual(['s1', 's4', 's2', 's3', 's5', 's6', 's7', 's8'])

    // ...the error must be visible (not silent)...
    expect(wrapper.find('[data-testid="save-status-error"]').exists()).toBe(true)

    // ...and the general 800ms autosave debounce must NOT then silently
    // re-persist a stale array over drag B's committed write. A third call (or
    // a third call whose payload isn't drag B's order) means the bug is back.
    await new Promise((resolve) => setTimeout(resolve, 900))
    expect(mockUpdateService).toHaveBeenCalledTimes(2)

    errSpy.mockRestore()
  })

  // ── R110: cross-section drag must not orphan a phantom "No Section" duplicate ──
  // 51-RESEARCH Pitfall 1 / "CRITICAL caveat": the module-level `sortablejs` mock
  // (top of file) only CAPTURES options — its `Sortable.create` never performs a
  // real DOM move. A test that merely invokes the captured `onEnd` therefore
  // exercises only the (already-correct) reactive move logic and passes GREEN even
  // against today's buggy code, proving nothing. To reproduce the phantom this test
  // PHYSICALLY relocates the dragged `.slot-item` node from the source (ungrouped)
  // container into the target (worship) container BEFORE invoking `onEnd` — exactly
  // what real SortableJS does on a cross-`<ul>` drag — then asserts on RENDERED DOM
  // node counts, never on the reactive `slots` array (which is already correct).
  it('leaves exactly one rendered .slot-item after a cross-section drag — no orphaned "No Section" phantom (R110)', async () => {
    // A single section-less song sits in the ungrouped ("No Section") container.
    // Dragging the ONLY ungrouped item out empties the legacy bucket, so the whole
    // ungrouped container is removed on re-render — the exact condition that orphans
    // the Sortable-moved node: Vue tears down the container subtree without ever
    // reclaiming the child it no longer physically owns (the node now lives in the
    // worship container after the real DOM move). This mirrors the owner's verbatim
    // repro: add a Song at No Section, drag it to Worship, end up with two songs.
    mockServicesList = [{
      ...makeSectionedService(),
      slots: [
        ...makeSectionedService().slots,
        // section-less -> ungrouped ("No Section")
        { kind: 'SONG', id: 's9', position: 8, requiredVwType: 1, songId: null, songTitle: null, songKey: null },
      ],
    }]
    const wrapper = await mountView()
    await wrapper.vm.$nextTick()

    const ungroupedContainer = wrapper.find('[data-testid="section-list-ungrouped"]').element as HTMLElement
    const worshipContainer = wrapper.find('[data-testid="section-list-worship"]').element as HTMLElement

    // The dragged node and its SortableJS indices, derived from the LIVE DOM.
    const movedNode = Array.from(ungroupedContainer.children)
      .find((el) => (el as HTMLElement).dataset.slotId === 's9') as HTMLElement | undefined
    if (!movedNode) throw new Error('R110 repro: no ungrouped .slot-item for s9 rendered')
    const oldDraggableIndex = draggableIndex(ungroupedContainer, movedNode)
    const worshipItemsBefore = Array.from(worshipContainer.children)
      .filter((c) => (c as HTMLElement).classList.contains('slot-item')).length

    // Physically perform SortableJS's cross-container move: detach from the source
    // list and append into the target list. The mocked Sortable.create does NOT do
    // this — omitting it is the exact reason a naive onEnd-only test is false-GREEN.
    ungroupedContainer.removeChild(movedNode)
    worshipContainer.appendChild(movedNode)

    // The ungrouped container carries no `data-section` attribute, so flatCapture()
    // resolves its Sortable options.
    const capture = flatCapture()
    if (!capture) throw new Error('R110 repro: no ungrouped Sortable capture resolved')
    await capture.options.onEnd!({
      oldIndex: oldDraggableIndex,
      newIndex: worshipItemsBefore,
      oldDraggableIndex,
      newDraggableIndex: worshipItemsBefore, // dropped after worship's existing items
      item: movedNode,
      from: ungroupedContainer,
      to: worshipContainer,
    } as never)
    await flushPromises()
    await wrapper.vm.$nextTick()

    // (a) The source "No Section" list holds ZERO copies of the moved slot. Once the
    //     only ungrouped item leaves, the container is removed entirely, so its
    //     absence also satisfies this — the point is that no phantom clone survives
    //     in the source region.
    const ungroupedAfter = wrapper.find('[data-testid="section-list-ungrouped"]')
    const strandedInSource = ungroupedAfter.exists()
      ? ungroupedAfter.element.querySelectorAll('.slot-item[data-slot-id="s9"]').length
      : 0
    expect(strandedInSource).toBe(0)

    // (b) THE R110 gate: exactly ONE `.slot-item` for the moved id exists anywhere in
    //     the tree. Buggy code leaves a second, handler-less clone (the phantom) that
    //     the SortableJS DOM move orphaned; the fix rebuilds the container from state
    //     and reclaims it.
    const allS9 = wrapper.element.querySelectorAll('.slot-item[data-slot-id="s9"]')
    expect(allS9.length).toBe(1)

    // (c) Architecture-unchanged guard (must-have): whatever mechanism reclaims the
    //     orphan must NOT leave the target section without a live Sortable. If the fix
    //     recreates the container element, a fresh Sortable instance must be bound to
    //     the CURRENT worship container — otherwise cross-section drop / reorder would
    //     silently go dead for the rest of the session. Passes trivially on today's
    //     (no-rebuild) code; guards a container-rebuild fix that forgets to rebind.
    const currentWorship = wrapper.find('[data-testid="section-list-worship"]').element as HTMLElement
    expect(sortableCaptures.some((c) => c.el === currentWorship)).toBe(true)
  })
})

// ── R047: the scripture slot's own reference is the slide's source ────────────
// Phase 30 verification defect: adding a scripture item produced NO slide on
// the Slides tab. The slide was sourced from a separate reading document that
// only an ESV fetch inside an "Edit Scripture Slides" panel could create, and
// its id was never written back to the slot — so the slot always pointed at
// nothing and `deriveGroupEntries` correctly derived zero slides. The panel is
// gone; the reference typed on the row is now the source.
describe('ServiceEditorView - R047 scripture reference is the slide source', () => {
  async function mountView() {
    const { default: ServiceEditorView } = await import('@/views/ServiceEditorView.vue')
    return shallowMount(ServiceEditorView, {
      global: {
        stubs: {
          AppShell: { template: '<div><slot /></div>' },
          // 36-03: Suggest/Export/Copy/Save/Present all moved into this real
          // child component (ContextualActionBar.vue) — every mountView in
          // this file must render it for real (`false` opts a component OUT
          // of shallowMount's default auto-stub) or none of those controls'
          // pre-existing testids/text are reachable in the DOM anymore.
          ContextualActionBar: false,
          RouterLink: { template: '<a><slot /></a>' },
          // 32-05: render the real SaveStatusIndicator (not a shallow stub)
          // so its data-testid="save-status"/"save-status-error" handles are
          // reachable from these tests.
          SaveStatusIndicator: false,
          ServicePrintLayout: true,
          SongBadge: true,
          SongSlotPicker: true,
          ScriptureInput: { name: 'ScriptureInput', props: ['modelValue'], template: '<div />' },
        },
      },
    })
  }

  beforeEach(() => {
    mockAuthState.isEditor = true
    mockAuthState.orgId = 'org-1'
    // slot-1 is SCRIPTURE with a populated reference and NO scriptureReadingId.
    mockServicesList = [buildSectionedService()]
  })

  it('renders the scripture reference row with no slides-editor surface at all', async () => {
    const wrapper = await mountView()
    await wrapper.vm.$nextTick()

    expect(wrapper.find('[data-scripture-slot-index="1"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="edit-scripture-slides-btn"]').exists()).toBe(false)
    expect(wrapper.findComponent({ name: 'ScriptureSlideEditor' }).exists()).toBe(false)
    expect(wrapper.findComponent({ name: 'CongregationalEditor' }).exists()).toBe(false)
  })

  // The reference itself is edited through ScriptureInput on the row, and that
  // is the ONLY scripture write path left on this tab. Nothing writes
  // `scriptureReadingId` any more — the field is legacy, and a slot that still
  // carries one derives its slide from its own reference regardless.
  it('changing the reference writes the slot fields and nothing else', async () => {
    const wrapper = await mountView()
    await wrapper.vm.$nextTick()
    mockUpdateService.mockClear()

    // [Rule 1 - Bug, pre-existing, exposed by 32-05] A bare
    // `findComponent({ name: 'ScriptureInput' })` matches the FIRST
    // ScriptureInput in the render tree, which is the header's Sermon
    // Passage editor (:671), not slot-1's own Scripture Reading row
    // (:880) this test's title and body are actually about. This test
    // silently passed before the R039 fix because the pre-fix swallow bug
    // consumed the edit's own watcher trigger, so `written` was always
    // undefined and every assertion inside `if (scriptureSlot)` was
    // vacuous. Scoping the query to the slot's own container is the real
    // fix — not the swallow bug, which 32-01 already closed.
    const input = wrapper.find('[data-scripture-slot-index="1"]').findComponent({ name: 'ScriptureInput' })
    expect(input.exists()).toBe(true)
    input.vm.$emit('update:modelValue', { book: 'Psalms', chapter: 103, verseStart: 1, verseEnd: 5 })
    await wrapper.vm.$nextTick()
    await new Promise((resolve) => setTimeout(resolve, 900))
    await flushPromises()

    const written = mockUpdateService.mock.calls
      .map(([, patch]) => (patch as { slots?: Array<Record<string, unknown>> }).slots)
      .filter((slots): slots is Array<Record<string, unknown>> => Array.isArray(slots))
      .pop()
    const scriptureSlot = written?.find((s) => s.kind === 'SCRIPTURE')
    // Unconditional now, not `if (scriptureSlot)` — a missing slot must fail
    // the test, not silently skip its assertions (see the Rule 1 note above).
    expect(scriptureSlot).toBeDefined()
    expect(scriptureSlot!.book).toBe('Psalms')
    expect(scriptureSlot!.chapter).toBe(103)
    expect(scriptureSlot!.scriptureReadingId).toBeUndefined()
  })
})

// ── ME-02: R047's source of truth must round-trip in its OWN editor ──────────
//
// `scriptureRefFromSlot` requires only book + chapter — a whole-chapter reading
// is explicitly a valid slide source. The view's private `slotToScriptureRef`
// required all FOUR fields, so a slot the slide layer considers populated was
// handed to ScriptureInput as `null`: the Service Order row rendered an EMPTY
// input, the read-only lines rendered "Scripture — Empty", and "Edit in
// scripture" scrolled to a blank field — all while the slide projected the
// reference correctly.
describe('ServiceEditorView - ME-02 scripture reference round-trips in its own editor', () => {
  async function mountView() {
    const { default: ServiceEditorView } = await import('@/views/ServiceEditorView.vue')
    return shallowMount(ServiceEditorView, {
      global: {
        stubs: {
          AppShell: { template: '<div><slot /></div>' },
          // 36-03: Suggest/Export/Copy/Save/Present all moved into this real
          // child component (ContextualActionBar.vue) — every mountView in
          // this file must render it for real (`false` opts a component OUT
          // of shallowMount's default auto-stub) or none of those controls'
          // pre-existing testids/text are reachable in the DOM anymore.
          ContextualActionBar: false,
          RouterLink: { template: '<a><slot /></a>' },
          // 32-05: render the real SaveStatusIndicator (not a shallow stub)
          // so its data-testid="save-status"/"save-status-error" handles are
          // reachable from these tests.
          SaveStatusIndicator: false,
          ServicePrintLayout: true,
          SongBadge: true,
          SongSlotPicker: true,
          ScriptureInput: { name: 'ScriptureInput', props: ['modelValue'], template: '<div />' },
        },
      },
    })
  }

  function serviceWithScriptureSlot(overrides: Record<string, unknown>): Service {
    return {
      ...mockService,
      slots: [
        { kind: 'SCRIPTURE', id: 'slot-0', position: 0, book: null, chapter: null, verseStart: null, verseEnd: null, ...overrides } as Service['slots'][number],
      ],
    }
  }

  beforeEach(() => {
    mockAuthState.isEditor = true
    mockAuthState.orgId = 'org-1'
  })

  /**
   * The ROW's input specifically — the sermon-passage field is another
   * ScriptureInput earlier in the tree, and a bare `findComponent` returns it.
   */
  function rowScriptureInput(wrapper: Awaited<ReturnType<typeof mountView>>) {
    return wrapper.find('[data-scripture-slot-index="0"]').findComponent({ name: 'ScriptureInput' })
  }

  it('renders a whole-chapter reading back into the Service Order input after reload', async () => {
    mockServicesList = [serviceWithScriptureSlot({ book: 'Psalms', chapter: 103 })]
    const wrapper = await mountView()
    await wrapper.vm.$nextTick()

    const input = rowScriptureInput(wrapper)
    expect(input.exists()).toBe(true)
    expect(input.props('modelValue')).toEqual({ book: 'Psalms', chapter: 103 })
  })

  it('renders a single-verse reading back into the Service Order input after reload', async () => {
    mockServicesList = [serviceWithScriptureSlot({ book: 'Romans', chapter: 8, verseStart: 28 })]
    const wrapper = await mountView()
    await wrapper.vm.$nextTick()

    expect(rowScriptureInput(wrapper).props('modelValue')).toEqual({ book: 'Romans', chapter: 8, verseStart: 28 })
  })

  it('still hands null to the input for a reference that has not been filled in', async () => {
    mockServicesList = [serviceWithScriptureSlot({})]
    const wrapper = await mountView()
    await wrapper.vm.$nextTick()

    expect(rowScriptureInput(wrapper).props('modelValue')).toBeNull()
  })

  it('a viewer sees the reference, not "Scripture — Empty", for a whole-chapter reading', async () => {
    mockAuthState.isEditor = false
    mockServicesList = [serviceWithScriptureSlot({ book: 'Psalms', chapter: 103 })]
    const wrapper = await mountView()
    await wrapper.vm.$nextTick()

    const row = wrapper.find('[data-scripture-slot-index="0"]')
    expect(row.exists()).toBe(true)
    expect(row.text()).toContain('Psalms 103')
    expect(row.text()).not.toContain('Scripture — Empty')
  })

  it('a viewer sees a single verse spelled out rather than the whole chapter', async () => {
    mockAuthState.isEditor = false
    mockServicesList = [serviceWithScriptureSlot({ book: 'Romans', chapter: 8, verseStart: 28 })]
    const wrapper = await mountView()
    await wrapper.vm.$nextTick()

    expect(wrapper.find('[data-scripture-slot-index="0"]').text()).toContain('Romans 8:28')
  })
})

// -- R036 wave 2: no slide-group writes are ATTEMPTED on a locked service ----
//
// *** This is the regression test for the failure mode that would have shipped
// green. useSlideshowAssembly's materialization watcher runs with
// `{ immediate: true }` -- it writes to slideGroups when an editor merely OPENS
// a service, with no user action -- and rebuildOutcomes does too. Both read the
// `canWrite` this view passes in.
//
// Once the /slideGroups Firestore rule rejects writes whose parent service is
// not draft, leaving canWrite as bare `isEditor` makes EVERY locked service
// throw permission-denied the moment it loads. Nothing in the default vitest
// run would catch that: src/rules.test.ts is excluded from it, so the rule and
// the client would each look correct in isolation.
describe('ServiceEditorView - no slide-group writes on a locked service (R036)', () => {
  async function mountView() {
    const { default: ServiceEditorView } = await import('@/views/ServiceEditorView.vue')
    return shallowMount(ServiceEditorView, {
      global: {
        stubs: {
          AppShell: { template: '<div><slot /></div>' },
          // 36-03: Suggest/Export/Copy/Save/Present all moved into this real
          // child component (ContextualActionBar.vue) — every mountView in
          // this file must render it for real (`false` opts a component OUT
          // of shallowMount's default auto-stub) or none of those controls'
          // pre-existing testids/text are reachable in the DOM anymore.
          ContextualActionBar: false,
          RouterLink: { template: '<a><slot /></a>' },
          // 32-05: render the real SaveStatusIndicator (not a shallow stub)
          // so its data-testid="save-status"/"save-status-error" handles are
          // reachable from these tests.
          SaveStatusIndicator: false,
          ServicePrintLayout: true,
          SongBadge: true,
          SongSlotPicker: true,
          ScriptureInput: true,
        },
      },
    })
  }

  beforeEach(() => {
    mockAuthState.isEditor = true
    mockAuthState.orgId = 'org-1'
    mockSlideGroupsState.groups = []
  })

  for (const status of ['planned', 'exported'] as const) {
    it(`attempts ZERO slide-group writes when the service is ${status}`, async () => {
      mockServicesList = [{ ...mockService, status }]
      const wrapper = await mountView()
      await wrapper.vm.$nextTick()
      await flushPromises()
      await wrapper.vm.$nextTick()

      expect(mockMaterializeGroupIfMissing).not.toHaveBeenCalled()
      expect(mockReplaceGroupSlides).not.toHaveBeenCalled()
    })
  }

  it('still materializes normally when the service is draft', async () => {
    mockServicesList = [{ ...mockService, status: 'draft' }]
    const wrapper = await mountView()
    await wrapper.vm.$nextTick()
    await flushPromises()
    await wrapper.vm.$nextTick()

    // The draft path is unchanged by this wave; if this ever stops being called
    // the narrowing has over-reached and slides silently stop materializing.
    expect(mockMaterializeGroupIfMissing).toHaveBeenCalled()
  })

  // Reopening must restore slide editing without a reload -- the gate has to be
  // a live computed over the service's status, not a value captured at mount.
  //
  // Driven by mutating `localService` directly rather than by swapping
  // `mockServicesList`: that mock hands `useServiceStore()` the array reference
  // it holds at creation time (see its own comment at the declaration), so a
  // post-mount reassignment cannot reach an already-mounted view. Mutating
  // localService is also the closer analogue of the real path, where the store
  // write lands and the snapshot updates localService in place.
  it('resumes materialization when a locked service is reopened, with no remount', async () => {
    mockServicesList = [{ ...mockService, status: 'planned' }]
    const wrapper = await mountView()
    await wrapper.vm.$nextTick()
    await flushPromises()
    expect(mockMaterializeGroupIfMissing).not.toHaveBeenCalled()

    const vm = wrapper.vm as unknown as { localService: { status: string } | null }
    expect(vm.localService).not.toBeNull()
    vm.localService!.status = 'draft'
    await wrapper.vm.$nextTick()
    await flushPromises()
    await wrapper.vm.$nextTick()

    expect(mockMaterializeGroupIfMissing).toHaveBeenCalled()
  })
})

// -- R036/R037 wave 3: the status pill, the two named transitions, and the
// no-optimistic-flip contract ------------------------------------------------
//
// D-01 deleted `toggleStatus`, a blind draft -> planned -> exported -> draft
// cycle on a badge click. It is the source of two live defects: a user could
// mark a service "Exported" without ever exporting it (leaving pcExportedAt and
// pcPlanId unset), and reopening was an unlabelled click with no warning.
//
// The star assertion in this block is the rejection case. A UI that shows
// `Draft` while the store still holds `planned` is exactly the "it didn't save"
// defect class this milestone exists to close, so a rejected transition must
// leave the pill, the banner and every gate reading the OLD status -- and say so
// on screen.
describe('ServiceEditorView - service lifecycle transitions (R036, R037)', () => {
  async function mountView() {
    const { default: ServiceEditorView } = await import('@/views/ServiceEditorView.vue')
    return shallowMount(ServiceEditorView, {
      global: {
        stubs: {
          AppShell: { template: '<div><slot /></div>' },
          // 36-03: Suggest/Export/Copy/Save/Present all moved into this real
          // child component (ContextualActionBar.vue) — every mountView in
          // this file must render it for real (`false` opts a component OUT
          // of shallowMount's default auto-stub) or none of those controls'
          // pre-existing testids/text are reachable in the DOM anymore.
          ContextualActionBar: false,
          RouterLink: { template: '<a><slot /></a>' },
          // 32-05: render the real SaveStatusIndicator (not a shallow stub)
          // so its data-testid="save-status"/"save-status-error" handles are
          // reachable from these tests.
          SaveStatusIndicator: false,
          ServicePrintLayout: true,
          SongBadge: true,
          SongSlotPicker: true,
          ScriptureInput: true,
          // The reopen and delete confirms are <Teleport to="body"> blocks;
          // shallowMount discards teleported children unless opted out.
          teleport: false,
        },
      },
    })
  }

  function body() {
    return new DOMWrapper(document.body)
  }

  const PC_EVIDENCE = { pcExportedAt: mockTimestamp, pcPlanId: 'pc-plan-1' }

  let consoleErrorSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    mockAuthState.isEditor = true
    mockAuthState.orgId = 'org-1'
    mockUpdateService.mockClear()
    mockMarkAsPlanned.mockClear()
    mockMarkAsPlanned.mockImplementation(() => Promise.resolve())
    mockReopenService.mockClear()
    mockReopenService.mockImplementation(() => Promise.resolve())
    mockAssignSongToSlot.mockClear()
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    consoleErrorSpy.mockRestore()
  })

  // ---- The pill is not a control (D-01) -------------------------------------

  it('renders the status pill as a non-interactive <span>, not a button', async () => {
    mockServicesList = [{ ...mockService, status: 'draft' }]
    const wrapper = await mountView()

    const pill = wrapper.find('[data-testid="service-status-pill"]')
    expect(pill.exists()).toBe(true)
    expect(pill.element.tagName).toBe('SPAN')
    // Not focusable, not in the tab order, and no hover affordance -- the four
    // "this is status, not a button" signals are all obtained by deletion.
    expect(pill.attributes('tabindex')).toBeUndefined()
    expect(pill.classes()).not.toContain('cursor-pointer')
    // role="status" is a LIVE REGION and would announce on every reactive
    // touch -- deliberately absent.
    expect(pill.attributes('role')).toBeUndefined()
  })

  it('clicking the status pill changes nothing — there is no cycle left', async () => {
    mockServicesList = [{ ...mockService, status: 'draft' }]
    const wrapper = await mountView()
    const vm = wrapper.vm as unknown as { localService: { status: string } | null }

    await wrapper.find('[data-testid="service-status-pill"]').trigger('click')
    await wrapper.vm.$nextTick()
    await flushPromises()

    expect(vm.localService!.status).toBe('draft')
    expect(mockMarkAsPlanned).not.toHaveBeenCalled()
    expect(mockUpdateService).not.toHaveBeenCalled()
  })

  // ---- One action per status (D-02) -----------------------------------------

  it('draft: shows Mark as Planned, no Reopen, no lock banner', async () => {
    mockServicesList = [{ ...mockService, status: 'draft' }]
    const wrapper = await mountView()

    expect(wrapper.find('[data-testid="mark-planned-btn"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="reopen-service-btn"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="service-lock-banner"]').exists()).toBe(false)
  })

  for (const status of ['planned', 'exported'] as const) {
    it(`${status}: shows the lock banner with Reopen, and no Mark as Planned`, async () => {
      mockServicesList = [{ ...mockService, status }]
      const wrapper = await mountView()

      expect(wrapper.find('[data-testid="service-lock-banner"]').exists()).toBe(true)
      expect(wrapper.find('[data-testid="reopen-service-btn"]').exists()).toBe(true)
      expect(wrapper.find('[data-testid="mark-planned-btn"]').exists()).toBe(false)
    })
  }

  // E8: a viewer cannot edit at ANY status, so a banner saying "editing is
  // locked" would explain a restriction that is not the reason they cannot
  // edit, and would hand them a Reopen button they may not use.
  it('viewer: no lock banner and no Reopen, but the pill still renders', async () => {
    mockAuthState.isEditor = false
    mockServicesList = [{ ...mockService, status: 'exported' }]
    const wrapper = await mountView()

    expect(wrapper.find('[data-testid="service-lock-banner"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="reopen-service-btn"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="service-status-pill"]').text()).toContain('Exported')
  })

  it('Mark as Planned awaits the store action, then moves the pill to Planned', async () => {
    mockServicesList = [{ ...mockService, status: 'draft' }]
    const wrapper = await mountView()

    await wrapper.find('[data-testid="mark-planned-btn"]').trigger('click')
    await flushPromises()
    await wrapper.vm.$nextTick()

    expect(mockMarkAsPlanned).toHaveBeenCalledWith('service-1')
    expect(wrapper.find('[data-testid="service-status-pill"]').text()).toContain('Planned')
    expect(wrapper.find('[data-testid="service-lock-banner"]').exists()).toBe(true)
  })

  // ---- Reopen: friction only where there are consequences (D-10) ------------

  it('reopening a planned service with no export evidence fires immediately, no dialog', async () => {
    mockServicesList = [{ ...mockService, status: 'planned' }]
    const wrapper = await mountView()

    await wrapper.find('[data-testid="reopen-service-btn"]').trigger('click')
    await flushPromises()
    await wrapper.vm.$nextTick()

    expect(body().find('[data-testid="reopen-confirm-dialog"]').exists()).toBe(false)
    expect(mockReopenService).toHaveBeenCalledWith('service-1')
    expect(wrapper.find('[data-testid="service-status-pill"]').text()).toContain('Draft')
  })

  // ★ E9 / D-04 -- the gate is EVIDENCE, never the status string. Live data
  // holds services sitting at `exported` that the deleted cycle hand-set and
  // that were never exported; warning them that "Planning Center holds the
  // previously exported version" would be false, and a warning users learn is
  // sometimes false is one they learn to click through.
  it('reopening a legacy exported service with NO evidence shows no dialog and no PC warning', async () => {
    mockServicesList = [{ ...mockService, status: 'exported' }]
    const wrapper = await mountView()

    expect(wrapper.find('[data-testid="service-lock-banner-text"]').text()).not.toContain(
      'Planning Center',
    )

    await wrapper.find('[data-testid="reopen-service-btn"]').trigger('click')
    await flushPromises()

    expect(body().find('[data-testid="reopen-confirm-dialog"]').exists()).toBe(false)
    expect(mockReopenService).toHaveBeenCalledOnce()
  })

  it('reopening with export evidence opens the confirm and does NOT transition yet', async () => {
    mockServicesList = [{ ...mockService, status: 'exported', ...PC_EVIDENCE }]
    const wrapper = await mountView()

    await wrapper.find('[data-testid="reopen-service-btn"]').trigger('click')
    await flushPromises()
    await wrapper.vm.$nextTick()

    const dialog = body().find('[data-testid="reopen-confirm-dialog"]')
    expect(dialog.exists()).toBe(true)
    expect(body().find('[data-testid="reopen-confirm-pc-warning"]').text()).toContain(
      'exported to Planning Center',
    )
    expect(mockReopenService).not.toHaveBeenCalled()
    expect(wrapper.find('[data-testid="service-status-pill"]').text()).toContain('Exported')
  })

  it('the reopen confirm transitions only once its confirm button is pressed', async () => {
    mockServicesList = [{ ...mockService, status: 'exported', ...PC_EVIDENCE }]
    const wrapper = await mountView()

    await wrapper.find('[data-testid="reopen-service-btn"]').trigger('click')
    await flushPromises()
    await body().find('[data-testid="reopen-confirm-btn"]').trigger('click')
    await flushPromises()
    await wrapper.vm.$nextTick()

    expect(mockReopenService).toHaveBeenCalledWith('service-1')
    expect(wrapper.find('[data-testid="service-status-pill"]').text()).toContain('Draft')
    expect(body().find('[data-testid="reopen-confirm-dialog"]').exists()).toBe(false)
  })

  // E10: a reopened-then-re-planned service still carries the ids D-11 kept, so
  // it is `planned` WITH evidence -- and still gets the dialog. Proves the gate
  // is not "status === exported" in disguise.
  it('a planned service that carries export evidence still gets the dialog', async () => {
    mockServicesList = [{ ...mockService, status: 'planned', ...PC_EVIDENCE }]
    const wrapper = await mountView()

    await wrapper.find('[data-testid="reopen-service-btn"]').trigger('click')
    await flushPromises()

    expect(body().find('[data-testid="reopen-confirm-dialog"]').exists()).toBe(true)
    expect(mockReopenService).not.toHaveBeenCalled()
  })

  // ★ D-11 -- the rule's hasOnly(['status','updatedAt']) reads affectedKeys(),
  // so re-writing pcExportedAt/pcPlanId even to their existing values can get
  // the whole reopen denied. The view must go through the dedicated action and
  // must never route a reopen through updateService with those fields attached.
  it('the reopen carries no pcExportedAt/pcPlanId payload', async () => {
    mockServicesList = [{ ...mockService, status: 'exported', ...PC_EVIDENCE }]
    const wrapper = await mountView()

    await wrapper.find('[data-testid="reopen-service-btn"]').trigger('click')
    await flushPromises()
    await body().find('[data-testid="reopen-confirm-btn"]').trigger('click')
    await flushPromises()

    expect(mockReopenService).toHaveBeenCalledWith('service-1')
    expect(mockReopenService.mock.calls[0]).toHaveLength(1)
    for (const [, data] of mockUpdateService.mock.calls) {
      expect(data).not.toHaveProperty('pcExportedAt')
      expect(data).not.toHaveProperty('pcPlanId')
    }
  })

  it('the ids D-11 preserves are still on the service after a reopen', async () => {
    mockServicesList = [{ ...mockService, status: 'exported', ...PC_EVIDENCE }]
    const wrapper = await mountView()
    const vm = wrapper.vm as unknown as {
      localService: { status: string; pcPlanId?: string | null; pcExportedAt?: unknown } | null
    }

    await wrapper.find('[data-testid="reopen-service-btn"]').trigger('click')
    await flushPromises()
    await body().find('[data-testid="reopen-confirm-btn"]').trigger('click')
    await flushPromises()

    expect(vm.localService!.status).toBe('draft')
    expect(vm.localService!.pcPlanId).toBe('pc-plan-1')
    expect(vm.localService!.pcExportedAt).toBeTruthy()
  })

  // ---- ★ The no-optimistic-flip contract (E13 / E14) ------------------------

  it('★ a rejected Reopen leaves the OLD status everywhere and renders the error in the banner', async () => {
    mockReopenService.mockImplementation(() => Promise.reject(new Error('permission-denied')))
    mockServicesList = [{ ...mockService, status: 'planned' }]
    const wrapper = await mountView()
    const vm = wrapper.vm as unknown as { localService: { status: string } | null }

    await wrapper.find('[data-testid="reopen-service-btn"]').trigger('click')
    await flushPromises()
    await wrapper.vm.$nextTick()

    // The store still holds `planned`; so must every surface.
    expect(vm.localService!.status).toBe('planned')
    expect(wrapper.find('[data-testid="service-status-pill"]').text()).toContain('Planned')
    expect(wrapper.find('[data-testid="service-lock-banner"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="mark-planned-btn"]').exists()).toBe(false)

    const err = wrapper.find('[data-testid="service-lock-banner-error"]')
    expect(err.exists()).toBe(true)
    expect(err.text()).toBe("Couldn't reopen this service. Check your connection and try again.")
    // The banner's Reopen button IS the retry affordance -- it must survive.
    expect(wrapper.find('[data-testid="reopen-service-btn"]').exists()).toBe(true)
  })

  it('★ a rejected Mark as Planned leaves the pill at Draft and renders the inline error', async () => {
    mockMarkAsPlanned.mockImplementation(() => Promise.reject(new Error('permission-denied')))
    mockServicesList = [{ ...mockService, status: 'draft' }]
    const wrapper = await mountView()
    const vm = wrapper.vm as unknown as { localService: { status: string } | null }

    await wrapper.find('[data-testid="mark-planned-btn"]').trigger('click')
    await flushPromises()
    await wrapper.vm.$nextTick()

    expect(vm.localService!.status).toBe('draft')
    expect(wrapper.find('[data-testid="service-status-pill"]').text()).toContain('Draft')
    // No banner appeared -- the service never left draft.
    expect(wrapper.find('[data-testid="service-lock-banner"]').exists()).toBe(false)

    const err = wrapper.find('[data-testid="lifecycle-error"]')
    expect(err.exists()).toBe(true)
    expect(err.text()).toBe(
      "Couldn't mark this service as Planned. Check your connection and try again.",
    )
    expect(wrapper.find('[data-testid="mark-planned-btn"]').exists()).toBe(true)
  })

  it('the lifecycle error clears when the next attempt starts', async () => {
    mockReopenService.mockImplementationOnce(() => Promise.reject(new Error('offline')))
    mockServicesList = [{ ...mockService, status: 'planned' }]
    const wrapper = await mountView()

    await wrapper.find('[data-testid="reopen-service-btn"]').trigger('click')
    await flushPromises()
    expect(wrapper.find('[data-testid="service-lock-banner-error"]').exists()).toBe(true)

    await wrapper.find('[data-testid="reopen-service-btn"]').trigger('click')
    await flushPromises()
    await wrapper.vm.$nextTick()

    expect(wrapper.find('[data-testid="service-status-pill"]').text()).toContain('Draft')
    expect(wrapper.find('[data-testid="service-lock-banner"]').exists()).toBe(false)
  })

  // ---- D-15: the delete confirm's evidence-gated sentence -------------------

  it('delete confirm gains the Planning Center sentence when there is export evidence', async () => {
    mockServicesList = [{ ...mockService, status: 'exported', ...PC_EVIDENCE }]
    const wrapper = await mountView()

    const deleteBtn = wrapper.findAll('button').find((b) => b.text() === 'Delete')
    await deleteBtn!.trigger('click')
    await wrapper.vm.$nextTick()

    const copy = body().find('[data-testid="delete-service-confirm-body"]').text()
    expect(copy).toContain('This cannot be undone.')
    expect(copy).toContain(
      'This service was exported to Planning Center. Deleting it here does not remove that plan.',
    )
  })

  it('delete confirm omits the Planning Center sentence without export evidence', async () => {
    mockServicesList = [{ ...mockService, status: 'exported' }]
    const wrapper = await mountView()

    const deleteBtn = wrapper.findAll('button').find((b) => b.text() === 'Delete')
    await deleteBtn!.trigger('click')
    await wrapper.vm.$nextTick()

    const copy = body().find('[data-testid="delete-service-confirm-body"]').text()
    expect(copy).toContain('This cannot be undone.')
    expect(copy).not.toContain('Planning Center')
  })

  // Delete stays available at EVERY status -- it is a lifecycle action on the
  // service, not an edit to its contents, and forcing a Reopen just to delete
  // strands the "created by mistake" case behind two extra steps (D-15).
  it('the Delete button is still rendered on a locked service', async () => {
    mockServicesList = [{ ...mockService, status: 'planned' }]
    const wrapper = await mountView()

    expect(wrapper.findAll('button').some((b) => b.text() === 'Delete')).toBe(true)
  })

  // WR-01 (80-REVIEW): before this fix, onDelete had no catch — a
  // deleteService failure (e.g. a mid-sequence revocation error) closed the
  // confirm dialog silently via the old bare `finally`, looking like success
  // while the service was never actually deleted. Now a failure surfaces an
  // error and leaves the dialog open instead.
  it('a deleteService failure surfaces an error and keeps the confirm dialog open, instead of silently closing it', async () => {
    mockServicesList = [mockService]
    mockDeleteService.mockImplementationOnce(() => Promise.reject(new Error('permission-denied')))
    const wrapper = await mountView()

    const deleteBtn = wrapper.findAll('button').find((b) => b.text() === 'Delete')
    await deleteBtn!.trigger('click')
    await wrapper.vm.$nextTick()

    const confirmDeleteBtn = body().findAll('button').find((b) => b.text() === 'Delete')
    await confirmDeleteBtn!.trigger('click')
    await flushPromises()
    await wrapper.vm.$nextTick()

    expect(mockDeleteService).toHaveBeenCalledWith('service-1')
    // Dialog is still open (the confirm body is still present) and the error
    // is visible — this is the "coherent outcome" WR-01 requires instead of
    // a silent, misleading close.
    expect(body().find('[data-testid="delete-service-confirm-body"]').exists()).toBe(true)
    expect(body().find('[data-testid="delete-service-error"]').text()).toBe(
      'Failed to delete service. Please try again.',
    )
  })

  // ---- The Suggest All Songs disabled binding is COMPOUND --------------------
  //
  // Only the isExportedLocked term was dropped from :134. Deleting the whole
  // binding would make the button clickable with no sermon context and
  // re-clickable while a request is in flight.
  it('Suggest All Songs stays disabled with no sermon context after the lock term was dropped', async () => {
    mockServicesList = [{ ...mockService, status: 'draft', sermonPassage: null, sermonTopic: '' }]
    const wrapper = await mountView()

    const suggestBtn = wrapper.findAll('button').find((b) => b.text().includes('Suggest All Songs'))
    expect(suggestBtn).toBeDefined()
    expect(suggestBtn!.attributes('disabled')).toBeDefined()
    // The retired tooltip named a control that no longer exists.
    expect(suggestBtn!.attributes('title')).not.toContain('cycle badge')
  })

  // ── 34-10 (UAT F4): the exact reproduction path the owner walked ────────────
  //
  // "When I marked as planned, then re-open for editing, this panel gets left
  // at the top of the screen and it's now empty since we're no longer
  // locked." This must walk the REAL transitions, not merely assert idle
  // strips the chrome in isolation.
  it('mark as planned, then reopen, leaves the save-status bar with no chrome classes', async () => {
    mockServicesList = [{ ...mockService, status: 'draft' }]
    const wrapper = await mountView()
    await wrapper.vm.$nextTick()

    await wrapper.find('[data-testid="mark-planned-btn"]').trigger('click')
    await flushPromises()
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[data-testid="service-status-pill"]').text()).toContain('Planned')
    expect(wrapper.find('[data-testid="service-save-status-bar"]').exists()).toBe(false)

    await wrapper.find('[data-testid="reopen-service-btn"]').trigger('click')
    await flushPromises()
    await wrapper.vm.$nextTick()

    expect(wrapper.find('[data-testid="service-status-pill"]').text()).toContain('Draft')
    const bar = wrapper.find('[data-testid="service-save-status-bar"]')
    expect(bar.exists()).toBe(true)
    // R102 (48-03): the wrapper's flex layout is now unconditional (so the
    // Undo link lays out beside SaveStatusIndicator even at idle) — only
    // border/background/padding/sticky stay conditional.
    expect(bar.classes()).toEqual(['flex', 'items-center', 'gap-2'])
  })

  it('a locked service renders the lock banner and no save-status bar; a viewer renders neither', async () => {
    mockServicesList = [{ ...mockService, status: 'planned' }]
    const lockedWrapper = await mountView()
    await lockedWrapper.vm.$nextTick()

    expect(lockedWrapper.find('[data-testid="service-lock-banner"]').exists()).toBe(true)
    expect(lockedWrapper.find('[data-testid="service-save-status-bar"]').exists()).toBe(false)

    mockAuthState.isEditor = false
    const viewerWrapper = await mountView()
    await viewerWrapper.vm.$nextTick()

    expect(viewerWrapper.find('[data-testid="service-lock-banner"]').exists()).toBe(false)
    expect(viewerWrapper.find('[data-testid="service-save-status-bar"]').exists()).toBe(false)
  })
})

// ── 61-04 (R144): first-lock auto-notification hook + banner confirmation ─────
//
// On the draft→locked transition, AFTER the lock lands, the hook writes
// services/{id}/lockSnapshots/current on EVERY lock (so Phase 62 can diff) and,
// ONLY on a FIRST lock behind the isMessagingEnabled() + effective-lockNotify +
// ≥1-reachable gates, auto-enqueues one type:'lock-notification'. The whole
// block runs in its own try/catch after the transition succeeded and NEVER
// re-raises into lifecycleError — a failed enqueue is the amber 'error' line,
// not the red lock-failure line (SC1/SC2, UI-SPEC § Component #0/#1).
describe('ServiceEditorView - first-lock auto-notification (R144, 61-04)', () => {
  async function mountView() {
    const { default: ServiceEditorView } = await import('@/views/ServiceEditorView.vue')
    return shallowMount(ServiceEditorView, {
      global: {
        stubs: {
          AppShell: { template: '<div><slot /></div>' },
          ContextualActionBar: false,
          RouterLink: { template: '<a><slot /></a>' },
          SaveStatusIndicator: false,
          ServicePrintLayout: true,
          SongBadge: true,
          SongSlotPicker: true,
          ScriptureInput: true,
          teleport: false,
        },
      },
    })
  }

  type LockNotify =
    | null
    | { kind: 'sent'; count: number }
    | { kind: 'none-reachable' }
    | { kind: 'error' }
  function lockNotifyOf(wrapper: VueWrapper): LockNotify {
    return (wrapper.vm as unknown as { lockNotify: LockNotify }).lockNotify
  }

  let consoleErrorSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    mockAuthState.isEditor = true
    mockAuthState.orgId = 'org-1'
    // Gates OPEN by default; individual tests close a gate to prove the no-send.
    mockAuthState.settings.messaging.enabled = true
    mockAuthState.settings.messaging.lockNotifyDefault = true

    mockMarkAsPlanned.mockClear()
    mockMarkAsPlanned.mockImplementation(() => Promise.resolve())
    mockBuildServiceSnapshot.mockClear()

    mockGetDoc.mockReset()
    mockGetDoc.mockResolvedValue({ exists: () => false }) // first lock
    mockSetDoc.mockReset()
    mockSetDoc.mockResolvedValue(undefined)
    mockHttpsCallable.mockClear()
    mockQueueCallable.mockReset()
    mockQueueCallable.mockResolvedValue({ data: { messageId: 'msg-1' } })
    mockResolveRecipients.mockReset()
    mockResolveRecipients.mockReturnValue({
      reachable: [
        { id: 'p1', name: 'Alice', email: 'alice@example.com' },
        { id: 'p2', name: 'Bob', email: 'bob@example.com' },
      ],
      unreachableCount: 0,
    })
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    // Reset the shared reactive auth mock so this block's OPEN gates never leak
    // into a later describe (the module default is off/off).
    mockAuthState.settings.messaging.enabled = false
    mockAuthState.settings.messaging.lockNotifyDefault = false
    consoleErrorSpy.mockRestore()
  })

  async function lockDraft(overrides: Partial<Service> = {}): Promise<VueWrapper> {
    mockServicesList = [{ ...mockService, status: 'draft', ...overrides }]
    const wrapper = await mountView()
    await wrapper.find('[data-testid="mark-planned-btn"]').trigger('click')
    await flushPromises()
    await wrapper.vm.$nextTick()
    return wrapper
  }

  it('first lock behind the gates: writes lockSnapshots/current (read-before-write) then enqueues one lock-notification', async () => {
    // 62-04 (R146): seed a slide group for this service so the written fingerprint
    // is a REAL { [slotId]: hash } map (Phase 61's `slideGroupsFingerprint: null`
    // stub is now realized — a stub filled, NOT a behavior regression).
    mockSlideGroupsState.groups = [
      {
        id: 'slot-0',
        slotId: 'slot-0',
        serviceId: 'service-1',
        slides: [{ id: 's0', order: 0, sourceRef: { kind: 'text', title: 'T', body: 'B' } }],
        createdAt: mockTimestamp,
        updatedAt: mockTimestamp,
      } as SlideGroup,
    ]
    const wrapper = await lockDraft()

    // Snapshot written on the lock, read BEFORE the write (first-lock detection).
    expect(mockGetDoc).toHaveBeenCalledTimes(1)
    expect(mockSetDoc).toHaveBeenCalledTimes(1)
    expect(mockGetDoc.mock.invocationCallOrder[0]!).toBeLessThan(
      mockSetDoc.mock.invocationCallOrder[0]!,
    )
    const snapPayload = mockSetDoc.mock.calls[0]![1] as {
      snapshot: unknown
      slideGroupsFingerprint: Record<string, string>
    }
    expect(snapPayload.snapshot).toBeDefined()
    // 62-04: a REAL fingerprint map (not null), keyed by the in-service group's slotId.
    expect(snapPayload.slideGroupsFingerprint).toEqual(expect.any(Object))
    expect(snapPayload.slideGroupsFingerprint).toHaveProperty('slot-0')
    expect(typeof snapPayload.slideGroupsFingerprint['slot-0']).toBe('string')

    // Exactly one lock-notification enqueued, selector-only (never an email list).
    expect(mockHttpsCallable).toHaveBeenCalledWith(expect.anything(), 'queueServiceMessage')
    expect(mockQueueCallable).toHaveBeenCalledTimes(1)
    const req = mockQueueCallable.mock.calls[0]![0] as {
      type: string
      recipientSelector: { includeEveryone: boolean }
      options: { attachServiceLink: boolean; sendCopyToSelf: boolean }
      scheduledFor: unknown
    }
    expect(req.type).toBe('lock-notification')
    expect(req.recipientSelector.includeEveryone).toBe(true)
    expect(req.options.attachServiceLink).toBe(true)
    expect(req.options.sendCopyToSelf).toBe(false)
    expect(req.scheduledFor).toBeNull()

    expect(lockNotifyOf(wrapper)).toEqual({ kind: 'sent', count: 2 })
  })

  it('messaging OFF: snapshot still written, NO enqueue, lockNotify null', async () => {
    mockAuthState.settings.messaging.enabled = false
    const wrapper = await lockDraft()

    expect(mockSetDoc).toHaveBeenCalledTimes(1)
    expect(mockQueueCallable).not.toHaveBeenCalled()
    expect(lockNotifyOf(wrapper)).toBeNull()
    // The lock itself still succeeded.
    const vm = wrapper.vm as unknown as { localService: { status: string } | null }
    expect(vm.localService!.status).toBe('planned')
  })

  it('effective lock-notify OFF (default off, no per-service override): snapshot written, NO enqueue, null', async () => {
    mockAuthState.settings.messaging.lockNotifyDefault = false
    const wrapper = await lockDraft() // service.messaging undefined → falls back to default (off)

    expect(mockSetDoc).toHaveBeenCalledTimes(1)
    expect(mockQueueCallable).not.toHaveBeenCalled()
    expect(lockNotifyOf(wrapper)).toBeNull()
  })

  it('per-service lock-notify ON while org default OFF: enqueues (override wins)', async () => {
    mockAuthState.settings.messaging.lockNotifyDefault = false
    const wrapper = await lockDraft({ messaging: { lockNotifyEnabled: true } } as Partial<Service>)

    expect(mockQueueCallable).toHaveBeenCalledTimes(1)
    expect(lockNotifyOf(wrapper)).toEqual({ kind: 'sent', count: 2 })
  })

  it('zero reachable recipients: snapshot written, NO enqueue, lockNotify none-reachable', async () => {
    mockResolveRecipients.mockReturnValue({ reachable: [], unreachableCount: 3 })
    const wrapper = await lockDraft()

    expect(mockSetDoc).toHaveBeenCalledTimes(1)
    expect(mockQueueCallable).not.toHaveBeenCalled()
    expect(lockNotifyOf(wrapper)).toEqual({ kind: 'none-reachable' })
  })

  it('re-lock with an EMPTY diff: snapshot overwritten silently, NO prompt, NO enqueue, null', async () => {
    // 62-04: the Phase 61 "re-lock still overwrites" assertion, updated to the
    // deferred/gated form — an EMPTY diff (prior === current, matching fingerprint)
    // overwrites immediately with no prompt (nothing changed to notify about).
    const snap = { name: '', status: 'planned' as const, slots: [], roleAssignments: [], notes: '' }
    mockBuildServiceSnapshot.mockReturnValue(snap)
    mockGetDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({ snapshot: snap, slideGroupsFingerprint: {} }),
    })
    const wrapper = await lockDraft()

    expect(mockSetDoc).toHaveBeenCalledTimes(1) // still written for the next diff
    expect(mockQueueCallable).not.toHaveBeenCalled() // but never auto-sends
    expect(lockNotifyOf(wrapper)).toBeNull()
    // No re-lock prompt was opened.
    expect((wrapper.vm as unknown as { reLockEntries: unknown }).reLockEntries).toBeNull()
  })

  it('★ enqueue rejects AFTER a successful lock: transition stays succeeded, lifecycleError null, lockNotify error', async () => {
    mockQueueCallable.mockRejectedValue(new Error('callable failed'))
    const wrapper = await lockDraft()

    const vm = wrapper.vm as unknown as { localService: { status: string } | null }
    expect(vm.localService!.status).toBe('planned')
    // The failure was NOT re-raised into the red lock-failure line.
    expect(wrapper.find('[data-testid="service-lock-banner-error"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="service-status-pill"]').text()).toContain('Planned')
    expect(lockNotifyOf(wrapper)).toEqual({ kind: 'error' })
  })

  it('markAsPlanned itself rejects: neither snapshot nor callable written, status stays draft, lifecycleError set', async () => {
    mockMarkAsPlanned.mockImplementation(() => Promise.reject(new Error('permission-denied')))
    const wrapper = await lockDraft()

    expect(mockSetDoc).not.toHaveBeenCalled()
    expect(mockQueueCallable).not.toHaveBeenCalled()
    const vm = wrapper.vm as unknown as { localService: { status: string } | null }
    expect(vm.localService!.status).toBe('draft')
    expect(wrapper.find('[data-testid="lifecycle-error"]').exists()).toBe(true)
    expect(lockNotifyOf(wrapper)).toBeNull()
  })

  // ── Task 2: the subordinate confirmation line inside the lock banner ─────────

  it('sent (N=2): renders "Notified 2 assigned volunteers." with aria-live polite inside the banner', async () => {
    const wrapper = await lockDraft()

    const banner = wrapper.find('[data-testid="service-lock-banner"]')
    expect(banner.exists()).toBe(true)
    const line = banner.find('[data-testid="lock-notify-confirmation"]')
    expect(line.exists()).toBe(true)
    expect(line.text()).toBe('Notified 2 assigned volunteers.')
    expect(line.attributes('aria-live')).toBe('polite')
    expect(line.classes()).toContain('text-amber-200')
  })

  it('sent (N=1): pluralization backstop renders the singular "1 assigned volunteer."', async () => {
    mockResolveRecipients.mockReturnValue({
      reachable: [{ id: 'p1', name: 'Alice', email: 'alice@example.com' }],
      unreachableCount: 0,
    })
    const wrapper = await lockDraft()

    expect(wrapper.find('[data-testid="lock-notify-confirmation"]').text()).toBe(
      'Notified 1 assigned volunteer.',
    )
  })

  it('none-reachable: renders the muted zero-reachable line (amber-300, not red)', async () => {
    mockResolveRecipients.mockReturnValue({ reachable: [], unreachableCount: 2 })
    const wrapper = await lockDraft()

    const line = wrapper.find('[data-testid="lock-notify-confirmation"]')
    expect(line.exists()).toBe(true)
    expect(line.text()).toContain('no one was notified')
    expect(line.classes()).toContain('text-amber-300')
    expect(line.classes()).not.toContain('text-red-300')
  })

  it('error: renders the muted amber error line whose "Open Messages" button opens the composer', async () => {
    mockQueueCallable.mockRejectedValue(new Error('callable failed'))
    const wrapper = await lockDraft()

    const line = wrapper.find('[data-testid="lock-notify-confirmation"]')
    expect(line.exists()).toBe(true)
    expect(line.text()).toContain('Locked')
    expect(line.classes()).toContain('text-amber-300')
    expect(line.classes()).not.toContain('text-red-300')

    const openBtn = line.findAll('button').find((b) => b.text() === 'Open Messages')
    expect(openBtn).toBeDefined()
    const vm = wrapper.vm as unknown as { messageComposerOpen: boolean }
    expect(vm.messageComposerOpen).toBe(false)
    await openBtn!.trigger('click')
    expect(vm.messageComposerOpen).toBe(true)
  })

  it('null (a re-lock): renders NO confirmation line — only the banner copy', async () => {
    // 62-04: an empty-diff re-lock (prior === current) never sets lockNotify, so
    // the subordinate confirmation line stays absent.
    const snap = { name: '', status: 'planned' as const, slots: [], roleAssignments: [], notes: '' }
    mockBuildServiceSnapshot.mockReturnValue(snap)
    mockGetDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({ snapshot: snap, slideGroupsFingerprint: {} }),
    }) // re-lock
    const wrapper = await lockDraft()

    expect(wrapper.find('[data-testid="service-lock-banner"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="lock-notify-confirmation"]').exists()).toBe(false)
  })
})

// ── 62-04 (R146/R148/SC4): re-lock change-notice prompt + deferred overwrite ──
//
// On a RE-LOCK (a prior lockSnapshots/current exists), the hook reads the prior
// snapshot + fingerprint BEFORE overwriting, runs the pure diffServiceSnapshots,
// and — for a non-empty diff with messaging ON — opens ReLockNotifyPrompt while
// DEFERRING the lockSnapshots/current overwrite to a writeSnapshot closure that
// the modal's `sent` OR `cancel` resolution runs. A failed send emits neither,
// so the snapshot stays as the safe pre-edit diff basis (SC4). An empty diff or
// messaging OFF overwrites silently with no prompt. The whole block stays in its
// own try/catch, never re-raised into lifecycleError.
describe('ServiceEditorView - re-lock change-notice prompt (R146/R148/SC4, 62-04)', () => {
  async function mountView() {
    const { default: ServiceEditorView } = await import('@/views/ServiceEditorView.vue')
    return shallowMount(ServiceEditorView, {
      global: {
        stubs: {
          AppShell: { template: '<div><slot /></div>' },
          ContextualActionBar: false,
          RouterLink: { template: '<a><slot /></a>' },
          SaveStatusIndicator: false,
          ServicePrintLayout: true,
          SongBadge: true,
          SongSlotPicker: true,
          ScriptureInput: true,
          teleport: false,
        },
      },
    })
  }

  /** A full ServiceSnapshot fixture — the real diffServiceSnapshots runs against
   *  these, so every field it reads (slots, roleAssignments, notes) is present. */
  function snap(overrides: Partial<ServiceSnapshot> = {}): ServiceSnapshot {
    return {
      date: '2026-03-08',
      name: '',
      progression: '1-2-2-3',
      teams: [],
      slots: [],
      sermonPassage: null,
      notes: '',
      status: 'planned',
      roleAssignments: [],
      ...overrides,
    }
  }

  // A non-empty diff: only the service-level notes differ (one NOTES entry).
  const CURR = snap({ notes: 'edited notes' })
  const PRIOR = snap({ notes: 'original notes' })

  function reLockEntriesOf(wrapper: VueWrapper): unknown {
    return (wrapper.vm as unknown as { reLockEntries: unknown }).reLockEntries
  }

  let consoleErrorSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    mockAuthState.isEditor = true
    mockAuthState.orgId = 'org-1'
    mockAuthState.settings.messaging.enabled = true
    mockAuthState.settings.messaging.lockNotifyDefault = true

    mockMarkAsPlanned.mockClear()
    mockMarkAsPlanned.mockImplementation(() => Promise.resolve())
    mockBuildServiceSnapshot.mockReset()
    mockGetDoc.mockReset()
    mockSetDoc.mockReset()
    mockSetDoc.mockResolvedValue(undefined)
    mockHttpsCallable.mockClear()
    mockQueueCallable.mockReset()
    mockQueueCallable.mockResolvedValue({ data: { messageId: 'msg-1' } })
    mockSlideGroupsState.groups = [] // → currFingerprint = {}
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    mockAuthState.settings.messaging.enabled = false
    mockAuthState.settings.messaging.lockNotifyDefault = false
    // Restore the module-default snapshot builder so later describes are unaffected.
    mockBuildServiceSnapshot.mockReset()
    mockBuildServiceSnapshot.mockImplementation((svc: Service) => ({
      name: svc.name,
      status: svc.status,
      slots: svc.slots,
    }))
    consoleErrorSpy.mockRestore()
  })

  async function lockDraft(): Promise<VueWrapper> {
    mockServicesList = [{ ...mockService, status: 'draft' }]
    const wrapper = await mountView()
    await wrapper.find('[data-testid="mark-planned-btn"]').trigger('click')
    await flushPromises()
    await wrapper.vm.$nextTick()
    return wrapper
  }

  /** Drive a re-lock: current snapshot = `curr`, prior snapshot = `prior`. */
  async function reLock(curr: ServiceSnapshot, prior: ServiceSnapshot): Promise<VueWrapper> {
    mockBuildServiceSnapshot.mockReturnValue(curr)
    mockGetDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({ snapshot: prior, slideGroupsFingerprint: {} }),
    })
    return lockDraft()
  }

  function prompt(wrapper: VueWrapper) {
    return wrapper.findComponent(ReLockNotifyPrompt)
  }

  it('non-empty diff + messaging ON: opens the prompt and does NOT overwrite lockSnapshots/current yet (SC4)', async () => {
    const wrapper = await reLock(CURR, PRIOR)

    // read-before-write ran, but the overwrite is DEFERRED to the modal's confirm.
    expect(mockGetDoc).toHaveBeenCalledTimes(1)
    expect(mockSetDoc).not.toHaveBeenCalled()

    const p = prompt(wrapper)
    expect(p.exists()).toBe(true)
    expect(p.props('open')).toBe(true)
    expect((p.props('entries') as unknown[]).length).toBeGreaterThan(0)
    expect(reLockEntriesOf(wrapper)).not.toBeNull()
  })

  it('emitting `sent`: runs the deferred writeSnapshot (new snapshot + real fingerprint) and closes the prompt (SC4)', async () => {
    const wrapper = await reLock(CURR, PRIOR)
    expect(mockSetDoc).not.toHaveBeenCalled()

    await prompt(wrapper).vm.$emit('sent')
    await flushPromises()
    await wrapper.vm.$nextTick()

    expect(mockSetDoc).toHaveBeenCalledTimes(1)
    const payload = mockSetDoc.mock.calls[0]![1] as {
      snapshot: unknown
      slideGroupsFingerprint: unknown
    }
    expect(payload.snapshot).toBe(CURR) // exactly the state that was diffed
    expect(payload.slideGroupsFingerprint).toEqual({})
    expect(reLockEntriesOf(wrapper)).toBeNull()
    expect(prompt(wrapper).exists()).toBe(false)
  })

  it('emitting `cancel` (Lock quietly / dismiss): runs the SAME deferred writeSnapshot and closes the prompt (SC4)', async () => {
    const wrapper = await reLock(CURR, PRIOR)
    expect(mockSetDoc).not.toHaveBeenCalled()

    await prompt(wrapper).vm.$emit('cancel')
    await flushPromises()
    await wrapper.vm.$nextTick()

    expect(mockSetDoc).toHaveBeenCalledTimes(1)
    const payload = mockSetDoc.mock.calls[0]![1] as { snapshot: unknown }
    expect(payload.snapshot).toBe(CURR)
    expect(reLockEntriesOf(wrapper)).toBeNull()
    expect(prompt(wrapper).exists()).toBe(false)
  })

  it('SC4 safe basis: a SEND FAILURE (modal stays open, emits NEITHER) leaves lockSnapshots/current NOT overwritten', async () => {
    const wrapper = await reLock(CURR, PRIOR)
    expect(prompt(wrapper).exists()).toBe(true)

    // The modal's onSend catch surfaces an inline error and emits NEITHER `sent`
    // nor `cancel`, so the deferred writeSnapshot never runs and the prior
    // snapshot stays as the safe pre-edit diff basis for a retry.
    await flushPromises()
    await wrapper.vm.$nextTick()

    expect(mockSetDoc).not.toHaveBeenCalled()
    expect(reLockEntriesOf(wrapper)).not.toBeNull() // still open, awaiting the planner
  })

  it('empty diff: overwrites lockSnapshots/current silently, no prompt, no callable', async () => {
    const wrapper = await reLock(CURR, CURR) // identical → diff === []

    expect(mockSetDoc).toHaveBeenCalledTimes(1)
    expect(prompt(wrapper).exists()).toBe(false)
    expect(mockQueueCallable).not.toHaveBeenCalled()
    expect(reLockEntriesOf(wrapper)).toBeNull()
  })

  it('messaging OFF: overwrites silently with NO prompt even when the diff is non-empty', async () => {
    mockAuthState.settings.messaging.enabled = false
    const wrapper = await reLock(CURR, PRIOR)

    expect(mockSetDoc).toHaveBeenCalledTimes(1)
    expect(prompt(wrapper).exists()).toBe(false)
    expect(reLockEntriesOf(wrapper)).toBeNull()
  })

  it('a first lock never opens the re-lock prompt (immediate write, Task 1 path)', async () => {
    mockBuildServiceSnapshot.mockReturnValue(CURR)
    mockGetDoc.mockResolvedValue({ exists: () => false }) // first lock
    const wrapper = await lockDraft()

    expect(prompt(wrapper).exists()).toBe(false)
    expect(mockSetDoc).toHaveBeenCalledTimes(1)
    expect(reLockEntriesOf(wrapper)).toBeNull()
  })

  it('the re-lock block never re-raises into lifecycleError: a deferred-write failure leaves the lock succeeded', async () => {
    const wrapper = await reLock(CURR, PRIOR)
    mockSetDoc.mockRejectedValueOnce(new Error('snapshot write failed'))

    await prompt(wrapper).vm.$emit('sent')
    await flushPromises()
    await wrapper.vm.$nextTick()

    // The lock itself already landed; no red lock-failure line, prompt closed.
    expect(wrapper.find('[data-testid="lifecycle-error"]').exists()).toBe(false)
    const vm = wrapper.vm as unknown as { localService: { status: string } | null }
    expect(vm.localService!.status).toBe('planned')
    expect(reLockEntriesOf(wrapper)).toBeNull()
  })
})

// ── 31-04: the three tabs go read-only when the service is locked (R036) ──────
//
// ★ Every assertion below runs at BOTH `planned` and `exported`. That symmetry
// IS the bug being fixed: the retired `isExportedLocked` fired only at
// `exported`, so a `planned` service went on offering every mutation control it
// was supposed to have lost. A suite that only exercised `exported` would pass
// against the defect.
describe('ServiceEditorView - locked service renders all three tabs read-only (R036)', () => {
  async function mountView() {
    const { default: ServiceEditorView } = await import('@/views/ServiceEditorView.vue')
    return shallowMount(ServiceEditorView, {
      global: {
        stubs: {
          AppShell: { template: '<div><slot /></div>' },
          // 36-03: Suggest/Export/Copy/Save/Present all moved into this real
          // child component (ContextualActionBar.vue) — every mountView in
          // this file must render it for real (`false` opts a component OUT
          // of shallowMount's default auto-stub) or none of those controls'
          // pre-existing testids/text are reachable in the DOM anymore.
          ContextualActionBar: false,
          RouterLink: { template: '<a><slot /></a>' },
          // 32-05: render the real SaveStatusIndicator (not a shallow stub)
          // so its data-testid="save-status"/"save-status-error" handles are
          // reachable from these tests.
          SaveStatusIndicator: false,
          ServicePrintLayout: true,
          SongBadge: true,
          SongSlotPicker: true,
          ScriptureInput: true,
          teleport: false,
        },
      },
    })
  }

  const SCHEDULED_QUARTER: Quarter = {
    id: 'q1',
    label: 'Q1 2026',
    year: 2026,
    quarter: 1,
    serviceDates: ['2026-03-08'],
    roleOverridesByDate: {},
    personQuarterData: {},
    calendar: { '2026-03-08': { 'role-vox': ['person-1'] } },
    status: 'finalized',
    shareToken: null,
    createdAt: mockTimestamp,
    updatedAt: mockTimestamp,
  }

  const LOCKED_STATUSES = ['planned', 'exported'] as const

  beforeEach(() => {
    mockAuthState.isEditor = true
    mockAuthState.orgId = 'org-1'
    mockQuarters = [SCHEDULED_QUARTER]
    mockUpdateService.mockClear()
    mockSetRoleOverride.mockClear()
    mockClearRoleOverride.mockClear()
    mockMarkAsPlanned.mockClear()
    mockMarkAsPlanned.mockImplementation(() => Promise.resolve())
    mockReopenService.mockClear()
    mockReopenService.mockImplementation(() => Promise.resolve())
    resetSortableCaptures()
  })

  async function openRolesTab(wrapper: Awaited<ReturnType<typeof mountView>>) {
    const rolesTabBtn = wrapper.findAll('button').find((b) => b.text() === 'Roles')
    await rolesTabBtn!.trigger('click')
  }

  // ---- BL-01: the service DATE (31-PATTERNS § 4a row 1) ----------------------
  //
  // Row 1 shipped with gate `none`. The heading button and its <input type=date>
  // were gated on `authStore.isEditor` ALONE, so on a locked service the picker
  // still rendered, still opened, and still wrote: picking a Sunday mutated
  // `localService.date`, the 800ms debounce fired a full-document `onSave`, and
  // all three enforcement layers refused it — with nothing on screen, because
  // the autosave error line lives inside `v-if="canEditService"`. The header
  // showed a date that was never persisted and never would be.
  for (const status of LOCKED_STATUSES) {
    it(`${status}: the service date is read-only text — no picker button, no date input`, async () => {
      mockServicesList = [{ ...mockService, status }]
      const wrapper = await mountView()

      expect(wrapper.findAll('input[type="date"]')).toHaveLength(0)
      // D-05's "removed, not disabled" rule: the class-D inverse branch renders
      // the date as a plain heading rather than leaving the editor with nothing.
      const heading = wrapper.find('h1')
      expect(heading.exists()).toBe(true)
      expect(heading.text()).toContain('March 8, 2026')
    })
  }

  it('a draft service still gets the date picker — the guard is the lock, not a blanket removal', async () => {
    mockServicesList = [{ ...mockService, status: 'draft' }]
    const wrapper = await mountView()

    expect(wrapper.findAll('input[type="date"]')).toHaveLength(1)
  })

  it('onDateChange DOES move the date on a draft service', async () => {
    mockServicesList = [{ ...mockService, status: 'draft' }]
    const wrapper = await mountView()
    const vm = wrapper.vm as unknown as {
      localService: { date: string }
      onDateChange: (d: string) => void
    }

    vm.onDateChange('2026-12-25')
    expect(vm.localService.date).toBe('2026-12-25')
  })

  // ---- Service Order (D-06) -------------------------------------------------

  for (const status of LOCKED_STATUSES) {
    it(`${status}: Service Order offers no drag handle, add-to-service palette, section select or remove control`, async () => {
      mockServicesList = [{ ...mockService, status }]
      const wrapper = await mountView()

      expect(wrapper.findAll('.drag-handle')).toHaveLength(0)
      // 36-05: moved-and-restyled-control edit — the locked-service absence assertion moves
      // from the old "Add Element" button label to the palette's testid.
      expect(wrapper.find('[data-testid="add-to-service-palette"]').exists()).toBe(false)
      expect(wrapper.findAll('[data-testid^="row-menu-trigger-"]')).toHaveLength(0)
      expect(wrapper.findAll('button').some((b) => b.attributes('title') === 'Remove element')).toBe(false)
      expect(wrapper.findAll('button').some((b) => b.attributes('title') === 'Remove song')).toBe(false)
    })

    it(`${status}: Teams checkboxes and the Sermon Topic input are REMOVED, not disabled`, async () => {
      mockServicesList = [{ ...mockService, status, sermonTopic: 'Grace' }]
      const wrapper = await mountView()

      // D-05: removed, not disabled. A `:disabled` binding rewritten instead of
      // deleted would leave these in the DOM.
      expect(wrapper.findAll('input[type="checkbox"]')).toHaveLength(0)
      expect(wrapper.findAll('input[type="text"]')).toHaveLength(0)
      // Class E: the shipped viewer branch now absorbs the locked editor.
      expect(wrapper.text()).toContain('Choir')
      expect(wrapper.text()).toContain('Grace')
    })

    it(`${status}: the sermon passage renders through the class-D inverse branch, not nothing`, async () => {
      mockServicesList = [{ ...mockService, status }]
      const wrapper = await mountView()

      // Substituting canEditService into that `v-else-if` would have deleted this
      // rendering and left a locked editor staring at a bare field label.
      expect(wrapper.text()).toContain('Romans 8:1-11')
    })

    it(`${status}: the same fixture at draft DOES still offer them — the gate is the status`, async () => {
      mockServicesList = [{ ...mockService, status: 'draft' }]
      const draft = await mountView()
      expect(draft.findAll('.drag-handle').length).toBeGreaterThan(0)
      expect(draft.findAll('[data-testid^="row-menu-trigger-"]').length).toBeGreaterThan(0)
      draft.unmount()

      mockServicesList = [{ ...mockService, status }]
      const locked = await mountView()
      expect(locked.findAll('.drag-handle')).toHaveLength(0)
    })

    // ---- Roles (D-06) -------------------------------------------------------

    it(`${status}: Roles renders assignments as names, with no checkboxes and no Reset to schedule`, async () => {
      mockServicesList = [{
        ...mockService,
        status,
        roleAssignmentOverrides: { 'role-drums': ['person-2'] },
      }]
      const wrapper = await mountView()
      await openRolesTab(wrapper)

      expect(wrapper.find('[data-testid="role-override-picker"]').exists()).toBe(false)
      expect(wrapper.findAll('button').some((b) => b.text() === 'Reset to schedule')).toBe(false)
      // The names line — the "names not checkboxes" rendering D-06 asks for —
      // already rendered unconditionally, so no new markup was needed.
      expect(wrapper.text()).toContain('Vocals')
      expect(wrapper.text()).toContain('Alice')
      // The `Overridden` badge is STATUS, not a control: it stays.
      expect(wrapper.text()).toContain('Overridden')
    })

    it(`${status}: the Roles viewer branch is untouched — a viewer still gets its own note`, async () => {
      mockAuthState.isEditor = false
      mockServicesList = [{ ...mockService, status }]
      const wrapper = await mountView()

      // Class E. The tab BUTTON is editor-only; the PANEL's viewer branch is not,
      // and deleting it would strand viewers with an empty panel.
      expect(wrapper.text()).toContain('visible via the shared service link')
    })

    // ---- D-08: the non-editing carve-outs stay live --------------------------

    // Owner follow-up: Copy for PC dropped from this D-08 carve-out list — it
    // no longer exists, deleted rather than gated, and no replacement takes
    // its place. Print and Share are unaffected by that deletion.
    //
    // R101 (48-03): Print/Share moved from the page-bottom row into the top
    // ContextualActionBar; Delete stays at the bottom. Asserted by container,
    // not merely by presence, so a future regression that moves Delete back
    // in with Print/Share (or leaves Print/Share stranded at the bottom) is
    // caught.
    it(`${status}: Print and Share render in the top contextual action bar; Delete stays at the bottom row; no export/copy button of any kind`, async () => {
      mockServicesList = [{ ...mockService, status }]
      const wrapper = await mountView()

      const bar = wrapper.find('[data-testid="contextual-action-bar"]')
      const printBtn = bar.find('[data-testid="print-btn"]')
      expect(printBtn.exists()).toBe(true)
      expect(printBtn.attributes('disabled')).toBeUndefined()

      expect(wrapper.find('[data-testid="copy-pc-btn"]').exists()).toBe(false)
      expect(wrapper.find('[data-testid="export-pc-btn"]').exists()).toBe(false)

      const shareBtn = bar.findAll('button').find((b) => b.text() === 'Share')
      expect(shareBtn).toBeDefined()
      expect(shareBtn!.attributes('disabled')).toBeUndefined()

      // Delete is NOT in the top bar — it stays at the page bottom, away from
      // the primary actions a destructive control must never sit beside.
      expect(bar.findAll('button').some((b) => b.text() === 'Delete')).toBe(false)
      expect(wrapper.findAll('button').some((b) => b.text() === 'Delete')).toBe(true)
    })

    it(`${status}: SlidesTab is told the service is locked, WITHOUT overloading isEditor`, async () => {
      mockServicesList = [{ ...mockService, status }]
      const wrapper = await mountView()

      const tab = wrapper.findComponent(SlidesTab)
      expect(tab.props('serviceLocked')).toBe(true)
      // ★ isEditor is NOT overloaded: the drawer must be able to tell "you are a
      // viewer" from "the service is locked" — they need different copy. Present
      // (D-08) is gated on neither, so it stays live.
      expect(tab.props('isEditor')).toBe(true)
    })

    // ---- No dead instructions (Task 5) --------------------------------------

    it(`${status}: the empty-section placeholder drops its drag/section instruction`, async () => {
      mockServicesList = [{ ...mockService, status }]
      const wrapper = await mountView()

      const placeholder = wrapper.find('[data-testid="section-empty-worship"]')
      expect(placeholder.exists()).toBe(true)
      expect(placeholder.text()).toContain('No items in this section.')
      expect(placeholder.text()).not.toContain('Drag an item here')
      expect(placeholder.text()).not.toContain('set its Section')
    })

    it(`${status}: the Roles no-schedule note drops "assign roles manually below"`, async () => {
      mockQuarters = [] // no quarter covers 2026-03-08
      mockServicesList = [{ ...mockService, status }]
      const wrapper = await mountView()
      await openRolesTab(wrapper)

      const note = wrapper.find('[data-testid="roles-no-schedule-note"]')
      expect(note.exists()).toBe(true)
      expect(note.text()).toBe('No schedule found for this date.')
      expect(note.text()).not.toContain('assign roles manually')
    })
  }

  it('draft keeps both instructions — the locked copy is a swap, not a deletion', async () => {
    mockQuarters = []
    mockServicesList = [{ ...mockService, status: 'draft' }]
    const wrapper = await mountView()

    expect(wrapper.find('[data-testid="section-empty-worship"]').text()).toContain('Drag an item here')
    await openRolesTab(wrapper)
    expect(wrapper.find('[data-testid="roles-no-schedule-note"]').text()).toContain('assign roles manually below')
  })

  // ---- D-06: exactly one banner, guaranteed structurally --------------------

  it('exactly one lock banner is on screen, and switching tabs does not add a second', async () => {
    mockServicesList = [{ ...mockService, status: 'planned' }]
    const wrapper = await mountView()

    expect(wrapper.findAll('[data-testid="service-lock-banner"]')).toHaveLength(1)

    await openRolesTab(wrapper)
    expect(wrapper.findAll('[data-testid="service-lock-banner"]')).toHaveLength(1)

    const slidesBtn = wrapper.findAll('button').find((b) => b.text() === 'Slides')
    await slidesBtn!.trigger('click')
    expect(wrapper.findAll('[data-testid="service-lock-banner"]')).toHaveLength(1)

    const orderBtn = wrapper.findAll('button').find((b) => b.text() === 'Service Order')
    await orderBtn!.trigger('click')
    expect(wrapper.findAll('[data-testid="service-lock-banner"]')).toHaveLength(1)
  })

  it('a viewer sees no banner at any status — read-only by role, not by status', async () => {
    mockAuthState.isEditor = false
    for (const status of ['draft', 'planned', 'exported'] as const) {
      mockServicesList = [{ ...mockService, status }]
      const wrapper = await mountView()
      expect(wrapper.findAll('[data-testid="service-lock-banner"]')).toHaveLength(0)
      wrapper.unmount()
    }
  })

  // ---- ★ Sortable teardown and rebuild (Task 5) ----------------------------

  it('★ locking destroys the per-section Sortable instances', async () => {
    mockServicesList = [{ ...mockService, status: 'draft' }]
    const wrapper = await mountView()
    expect(sortableCaptures.length).toBeGreaterThan(0)
    expect(mockSlotSortableDestroy).not.toHaveBeenCalled()

    await wrapper.find('[data-testid="mark-planned-btn"]').trigger('click')
    await flushPromises()
    await wrapper.vm.$nextTick()

    expect(mockSlotSortableDestroy).toHaveBeenCalled()
  })

  it('★ reopening re-creates them — drag works again with no page reload', async () => {
    // The regression this guards: hiding the drag handles without destroying and
    // re-creating the instances leaves a reopened service permanently undraggable.
    mockServicesList = [{ ...mockService, status: 'planned' }]
    const wrapper = await mountView()
    expect(sortableCaptures).toHaveLength(0)

    // No PC evidence -> one click, no dialog (D-10).
    await wrapper.find('[data-testid="reopen-service-btn"]').trigger('click')
    await flushPromises()
    await wrapper.vm.$nextTick()

    expect(sortableCaptures.length).toBeGreaterThan(0)
    // And the fresh instances are wired to the real handler, not a stub.
    expect(sortableCaptures[0]!.options.handle).toBe('.drag-handle')
  })

  // ---- ★ Handler-level guards (30-VERIFICATION I-01) ------------------------
  //
  // Calling each handler DIRECTLY, not merely asserting the template hides its
  // control. Six of seven Slides-tab mutation entry points were `v-if`-only when
  // this phase started; a lifecycle lock that only hides templates inherits that.
  for (const status of LOCKED_STATUSES) {
    it(`${status}: every Service Order and Roles mutation handler no-ops when called directly`, async () => {
      mockServicesList = [{
        ...mockService,
        status,
        roleAssignmentOverrides: { 'role-drums': ['person-2'] },
      }]
      const wrapper = await mountView()
      const vm = wrapper.vm as unknown as {
        localService: {
          teams: string[]
          slots: Array<Record<string, unknown>>
          sermonPassage: unknown
          date: string
          notes: string
        }
        showSlotDeleteConfirm: boolean
        resolvedRoleAssignments: Array<{ roleId: string; effectivePersonIds: string[] }>
        onDateChange: (d: string) => void
        onSave: () => Promise<void>
        toggleTeam: (t: string) => void
        addSlot: (kind: string) => void
        removeSlot: (i: number) => void
        onSelectSong: (i: number, s: { id: string; title: string; key: string }) => void
        onClearSong: (i: number) => void
        onSectionChange: (i: number, v: string) => void
        onScriptureChange: (i: number, r: unknown) => void
        onSermonPassageChange: (r: unknown) => void
        onUndo: () => void
        onToggleOverridePerson: (a: unknown, p: string) => Promise<void>
        onResetRoleOverride: (roleId: string) => Promise<void>
      }

      const slotCount = vm.localService.slots.length

      // Row 1 — the enumeration below shipped WITHOUT onDateChange, which is
      // precisely why BL-01 survived a 1880-test suite. Hiding the picker is
      // not enough: the handler is reachable from the input's own change event
      // during the tick before a status flip re-renders, and 30-VERIFICATION
      // I-01's rule is "gate the handlers, not just the templates".
      vm.onDateChange('2026-12-25')
      expect(vm.localService.date).toBe('2026-03-08')

      vm.toggleTeam('Orchestra')
      expect(vm.localService.teams).toEqual(['Choir'])

      vm.addSlot('SONG')
      expect(vm.localService.slots).toHaveLength(slotCount)

      vm.removeSlot(0)
      expect(vm.showSlotDeleteConfirm).toBe(false)

      vm.onSelectSong(2, { id: 'song-1', title: 'Amazing Grace', key: 'G' })
      expect(vm.localService.slots[2]!.songId).toBeNull()

      vm.onClearSong(0)
      expect(vm.localService.slots[0]!.songId).toBe('song-1')

      vm.onSectionChange(0, 'worship')
      expect(vm.localService.slots[0]!.section).toBeUndefined()

      vm.onScriptureChange(1, null)
      expect(vm.localService.slots[1]!.book).toBe('Psalms')

      vm.onSermonPassageChange(null)
      expect(vm.localService.sermonPassage).not.toBeNull()

      vm.onUndo()

      await vm.onToggleOverridePerson(vm.resolvedRoleAssignments[0], 'person-1')
      expect(mockSetRoleOverride).not.toHaveBeenCalled()

      await vm.onResetRoleOverride('role-drums')
      expect(mockClearRoleOverride).not.toHaveBeenCalled()

      // Row 24 — `onSave` itself. 31-04-SUMMARY records the decision to leave
      // it ungated because "the store guard already refuses it"; this phase
      // made that refusal a THROW, so an ungated `onSave` is not a harmless
      // no-op but a rejected promise nobody catches (BL-02).
      await vm.onSave()

      // Row 23 — the autosave debounce watcher. Mutating `localService`
      // directly is exactly what any handler that lost its guard would do, and
      // is also what a still-armed debounce carries across a status flip. The
      // watcher must decline to issue the write, not merely decline to render
      // its indicator. 31-RESEARCH: "cancel or no-op pending debounced writes
      // when the lock engages, not merely hide their inputs."
      vm.localService.notes = 'smuggled past the debounce'
      await wrapper.vm.$nextTick()
      vm.localService.notes = 'smuggled past the debounce, twice'
      await wrapper.vm.$nextTick()
      await new Promise((resolve) => setTimeout(resolve, 900))

      await flushPromises()
      expect(mockUpdateService).not.toHaveBeenCalled()
      expect(saveStatusEntry('service-1').status).not.toBe('saving')
    })
  }

  it('the same handlers DO act on a draft service — the guard is the lock, not a blanket no-op', async () => {
    mockServicesList = [{ ...mockService, status: 'draft' }]
    const wrapper = await mountView()
    const vm = wrapper.vm as unknown as {
      localService: { teams: string[] }
      toggleTeam: (t: string) => void
      onResetRoleOverride: (roleId: string) => Promise<void>
    }

    vm.toggleTeam('Orchestra')
    expect(vm.localService.teams).toContain('Orchestra')

    await vm.onResetRoleOverride('role-vox')
    expect(mockClearRoleOverride).toHaveBeenCalledWith('service-1', 'role-vox')
  })
})

// ── BL-02: a rejected autosave must not wedge the view ────────────────────────
//
// The autosave timer callback awaited `onSave()` inside `try { … } finally { … }`
// with NO `catch`. Any rejection therefore skipped the `autosaveStatus = 'saved'`
// line and left the status stranded at `'saving'` forever — and the remote-merge
// branch in the store watcher only runs at `'idle'`/`'saved'`, so EVERY later
// Firestore snapshot was silently discarded for the life of the component. Two
// editors on the same service stop seeing each other, permanently, with nothing
// on screen (the autosave error line is inside `v-if="canEditService"`, which is
// false at exactly the statuses where the deterministic rejection happens).
//
// Phase 31 made that rejection deterministic rather than hypothetical: the store
// guard now THROWS `ServiceLockedError` instead of relying on a round trip.
describe('ServiceEditorView - BL-02: a rejected autosave must not strand the status machine', () => {
  async function mountView() {
    const { default: ServiceEditorView } = await import('@/views/ServiceEditorView.vue')
    return shallowMount(ServiceEditorView, {
      global: {
        stubs: {
          AppShell: { template: '<div><slot /></div>' },
          // 36-03: Suggest/Export/Copy/Save/Present all moved into this real
          // child component (ContextualActionBar.vue) — every mountView in
          // this file must render it for real (`false` opts a component OUT
          // of shallowMount's default auto-stub) or none of those controls'
          // pre-existing testids/text are reachable in the DOM anymore.
          ContextualActionBar: false,
          RouterLink: { template: '<a><slot /></a>' },
          // 32-05: render the real SaveStatusIndicator (not a shallow stub)
          // so its data-testid="save-status"/"save-status-error" handles are
          // reachable from these tests.
          SaveStatusIndicator: false,
          ServicePrintLayout: true,
          SongBadge: true,
          SongSlotPicker: true,
          ScriptureInput: true,
          teleport: false,
        },
      },
    })
  }

  let consoleErrorSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    mockAuthState.isEditor = true
    mockAuthState.orgId = 'org-1'
    mockUpdateService.mockClear()
    mockUpdateService.mockImplementation(() => Promise.resolve())
    mockMarkAsPlanned.mockClear()
    mockMarkAsPlanned.mockImplementation(() => Promise.resolve())
    mockAssignSongToSlot.mockClear()
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    consoleErrorSpy.mockRestore()
    mockUpdateService.mockImplementation(() => Promise.resolve())
    mockMarkAsPlanned.mockImplementation(() => Promise.resolve())
  })

  /** The autosave watcher swallows the first `localService` mutation after a
   *  load or a remote merge (`autosaveInitialized`), so a test that wants a
   *  real debounce armed has to touch the model twice. */
  async function warmAutosaveWatcher(
    wrapper: Awaited<ReturnType<typeof mountView>>,
    vm: { localService: { notes: string } },
  ) {
    vm.localService.notes = 'warm-up touch the watcher swallows'
    await wrapper.vm.$nextTick()
  }

  it('a store-guard rejection leaves the status recoverable AND a later remote change still applies', async () => {
    // A reactive list so a post-mount mutation actually reaches the mounted
    // view's `watch(() => serviceStore.services, …, { deep: true })` — this is
    // the remote-snapshot path the wedge disables.
    mockServicesList = reactive([{ ...mockService, status: 'draft' }])
    const wrapper = await mountView()
    await wrapper.vm.$nextTick()
    const vm = wrapper.vm as unknown as {
      localService: { notes: string; date: string; status: string }
    }

    // ── Control: the remote-merge branch works BEFORE the failure ────────────
    mockServicesList[0]!.date = '2026-03-15'
    await flushPromises()
    await wrapper.vm.$nextTick()
    expect(vm.localService.date).toBe('2026-03-15')

    // ── Another editor locks the service; our debounced write is refused ─────
    await warmAutosaveWatcher(wrapper, vm)
    mockUpdateService.mockRejectedValueOnce(new ServiceLockedErrorStub('service-1', 'planned'))
    vm.localService.notes = 'typed just as another editor marked it Planned'
    await wrapper.vm.$nextTick()
    await new Promise((resolve) => setTimeout(resolve, 900))
    await flushPromises()

    expect(mockUpdateService).toHaveBeenCalled()

    // BL-02 consequence 1 — the status machine must not be stranded.
    expect(saveStatusEntry('service-1').status).not.toBe('saving')

    // BL-02 consequence 2 — the remote-merge branch must still be alive. This
    // is the assertion the reviewer reproduced failing: remote 2026-05-03 was
    // ignored and the editor kept showing the stale date for the whole session.
    mockServicesList[0]!.date = '2026-05-03'
    await flushPromises()
    await wrapper.vm.$nextTick()
    expect(vm.localService.date).toBe('2026-05-03')
  })

  it('the failure is on screen, not only in the console', async () => {
    mockServicesList = reactive([{ ...mockService, status: 'draft' }])
    const wrapper = await mountView()
    await wrapper.vm.$nextTick()
    const vm = wrapper.vm as unknown as { localService: { notes: string } }

    await warmAutosaveWatcher(wrapper, vm)
    mockUpdateService.mockRejectedValueOnce(new ServiceLockedErrorStub('service-1', 'exported'))
    vm.localService.notes = 'an edit that can never land'
    await wrapper.vm.$nextTick()
    await new Promise((resolve) => setTimeout(resolve, 900))
    await flushPromises()
    await wrapper.vm.$nextTick()

    // `:93` put the autosave status/error line inside `v-if="canEditService"`,
    // so it is gone at exactly the statuses where this rejection is
    // deterministic. `lifecycleError` is the surface that renders at BOTH —
    // the draft span at `:184` and the lock banner's row at `:317`.
    const surfaced =
      wrapper.find('[data-testid="lifecycle-error"]').exists() ||
      wrapper.find('[data-testid="service-lock-banner-error"]').exists()
    expect(surfaced).toBe(true)
  })

  // ── The second, date-independent trigger ────────────────────────────────────
  //
  // `onMarkAsPlanned` awaits `onSave()` and the status write but never cleared
  // the armed `autosaveTimer`. A user still typing during that round trip
  // re-arms the debounce while the service is still locally draft; it then
  // fires AFTER `applyTransitionLocally('planned')` and lands a full-document
  // write on a service that is now locked.
  it('typing during Mark as Planned does not leave a debounced write to land on the locked service', async () => {
    mockServicesList = reactive([{ ...mockService, status: 'draft' }])
    const wrapper = await mountView()
    await wrapper.vm.$nextTick()
    const vm = wrapper.vm as unknown as {
      localService: { notes: string; status: string }
      onMarkAsPlanned: () => Promise<void>
    }

    await warmAutosaveWatcher(wrapper, vm)

    // Hold the status write open so the "user keeps typing during the awaited
    // round trip" window is real rather than a zero-width race.
    let resolveMark!: () => void
    mockMarkAsPlanned.mockImplementationOnce(
      () => new Promise<void>((resolve) => { resolveMark = resolve }),
    )

    const marking = vm.onMarkAsPlanned()
    await flushPromises()

    vm.localService.notes = 'still typing while the transition is in flight'
    await wrapper.vm.$nextTick()

    resolveMark()
    await marking
    await wrapper.vm.$nextTick()
    expect(vm.localService.status).toBe('planned')

    // Everything up to here is legitimate. What must NOT happen is the armed
    // debounce firing into the now-locked service.
    mockUpdateService.mockClear()
    await new Promise((resolve) => setTimeout(resolve, 900))
    await flushPromises()

    expect(mockUpdateService).not.toHaveBeenCalled()
    expect(saveStatusEntry('service-1').status).not.toBe('saving')
  })
})

// ── ME-01: a completed export must never report a developer string ────────────
//
// `onConfirmExport`'s terminal Firestore write goes through
// `serviceStore.updateService`, whose new `assertWritable` throws a message
// written for developers, and the catch rendered `e.message` verbatim. The
// Export button's own guard reads `localService.status`, which can disagree
// with the STORED status the guard reads.
//
// So: two editors have the same `planned` service open. A exports; the stored
// status becomes `exported`. B's Export button is still enabled from B's own
// `localService`. B exports — every Planning Center API call completes, creating
// a real plan — and only then does the local guard throw. B is shown
// "R036: refusing to update service svc-1 — its stored status is …", `pcPlanId`
// is never recorded, and the plan just written to Planning Center is orphaned
// with no audit trail. That is exactly the loss D-11 exists to prevent.
describe('ServiceEditorView - ME-01: export failure copy and the pre-flight status re-check', () => {
  async function mountView() {
    const { default: ServiceEditorView } = await import('@/views/ServiceEditorView.vue')
    return shallowMount(ServiceEditorView, {
      global: {
        stubs: {
          AppShell: { template: '<div><slot /></div>' },
          // 36-03: Suggest/Export/Copy/Save/Present all moved into this real
          // child component (ContextualActionBar.vue) — every mountView in
          // this file must render it for real (`false` opts a component OUT
          // of shallowMount's default auto-stub) or none of those controls'
          // pre-existing testids/text are reachable in the DOM anymore.
          ContextualActionBar: false,
          RouterLink: { template: '<a><slot /></a>' },
          // 32-05: render the real SaveStatusIndicator (not a shallow stub)
          // so its data-testid="save-status"/"save-status-error" handles are
          // reachable from these tests.
          SaveStatusIndicator: false,
          ServicePrintLayout: true,
          SongBadge: true,
          SongSlotPicker: true,
          ScriptureInput: true,
          teleport: false,
        },
      },
    })
  }

  interface ExportVm {
    localService: { status: string }
    exportSelectedServiceTypeId: string
    exportSelectedTemplateId: string
    exportMode: string
    existingPlan: { id: string; title: string; dates: string } | null
    exportError: string | null
    onConfirmExport: () => Promise<void>
  }

  async function armExport(wrapper: Awaited<ReturnType<typeof mountView>>): Promise<ExportVm> {
    const vm = wrapper.vm as unknown as ExportVm
    vm.exportSelectedServiceTypeId = 'st-1'
    vm.exportSelectedTemplateId = ''
    vm.exportMode = 'new'
    await wrapper.vm.$nextTick()
    return vm
  }

  beforeEach(() => {
    mockAuthState.isEditor = true
    mockAuthState.orgId = 'org-1'
    mockAuthState.hasPcCredentials = true
    mockAuthState.pcCredentials = { appId: 'app-1', secret: 'secret-1' }
    mockUpdateService.mockClear()
    mockUpdateService.mockImplementation(() => Promise.resolve())
    mockCreatePlan.mockClear()
    mockAddSlotAsItem.mockClear()
  })

  afterEach(() => {
    mockAuthState.hasPcCredentials = false
    mockAuthState.pcCredentials = null
    mockUpdateService.mockImplementation(() => Promise.resolve())
  })

  it('refuses BEFORE any Planning Center work when the stored status is no longer planned', async () => {
    // The stored row says `exported` (editor A already exported it); this
    // editor's own localService still says `planned`, which is what the Export
    // button's `:disabled` reads.
    mockServicesList = [{ ...mockService, status: 'exported' }]
    const wrapper = await mountView()
    const vm = await armExport(wrapper)
    vm.localService.status = 'planned'
    await wrapper.vm.$nextTick()

    await vm.onConfirmExport()
    await flushPromises()

    // The whole point: no orphaned plan. Nothing was created in Planning
    // Center, so there is nothing to reconcile by hand.
    expect(mockCreatePlan).not.toHaveBeenCalled()
    expect(mockAddSlotAsItem).not.toHaveBeenCalled()
    expect(mockUpdateService).not.toHaveBeenCalled()

    expect(vm.exportError).toBeTruthy()
    expect(vm.exportError).not.toContain('R036')
    expect(vm.exportError).not.toContain('refusing to')
  })

  it('maps a ServiceLockedError from the terminal write to user copy, not the R036 developer string', async () => {
    mockServicesList = [{ ...mockService, status: 'planned' }]
    const wrapper = await mountView()
    const vm = await armExport(wrapper)

    // The pre-flight check passes (stored status IS planned), the PC
    // conversation completes, and the service is locked underneath us only in
    // the window between. The terminal write is then refused.
    mockUpdateService.mockRejectedValueOnce(new ServiceLockedErrorStub('service-1', 'exported'))

    await vm.onConfirmExport()
    await flushPromises()

    expect(mockCreatePlan).toHaveBeenCalled()
    expect(vm.exportError).toBeTruthy()
    expect(vm.exportError).not.toContain('R036')
    expect(vm.exportError).not.toContain('refusing to')
    // And it must name the actual situation, so the user knows the plan DID
    // reach Planning Center and a blind retry would duplicate it.
    expect(vm.exportError!.toLowerCase()).toContain('planning center')
  })

  it('a genuinely planned service still exports — the pre-flight check is not a blanket refusal', async () => {
    mockServicesList = [{ ...mockService, status: 'planned' }]
    const wrapper = await mountView()
    const vm = await armExport(wrapper)

    await vm.onConfirmExport()
    await flushPromises()

    expect(mockCreatePlan).toHaveBeenCalled()
    expect(vm.exportError).toBeNull()
    expect(mockUpdateService).toHaveBeenCalledWith(
      'service-1',
      expect.objectContaining({ status: 'exported', pcPlanId: 'pc-plan-new' }),
    )
    expect(vm.localService.status).toBe('exported')
  })

  // quick/260809-vvq Sub-task B: PRAYER/MESSAGE/ANNOUNCEMENTS/MISC must be
  // exported in ALL three paths (previously dropped in existing-plan and
  // new-plan-with-template); IMPORTED stays excluded. Sub-task A: every call
  // threads authStore.settings.bibleVersion.
  const kindFixtureSlots: Service['slots'] = [
    { kind: 'SONG', id: 's-song', position: 0, requiredVwType: 1, songId: 'song-1', songTitle: 'Amazing Grace', songKey: 'G' },
    { kind: 'SCRIPTURE', id: 's-scr', position: 1, book: 'Psalms', chapter: 23, verseStart: 1, verseEnd: 6 },
    { kind: 'PRAYER', id: 's-pray', position: 2 },
    { kind: 'MESSAGE', id: 's-msg', position: 3 },
    { kind: 'ANNOUNCEMENTS', id: 's-ann', position: 4 },
    { kind: 'MISC', id: 's-misc', position: 5 },
    { kind: 'IMPORTED', id: 's-imp', position: 6, importId: 'import-1' },
  ]

  // 5th positional arg (index 4) is the slot; 8th (index 7) is bibleVersion.
  // The mock is typed with no params, so read each call as an untyped tuple.
  const exportedKinds = () =>
    (mockAddSlotAsItem.mock.calls as unknown as unknown[][]).map(
      (c) => (c[4] as { kind: string }).kind,
    )

  it('exports PRAYER/MESSAGE/ANNOUNCEMENTS/MISC (never IMPORTED) in the new-plan no-template path, with bibleVersion threaded', async () => {
    mockServicesList = [{ ...mockService, status: 'planned', slots: kindFixtureSlots }]
    const wrapper = await mountView()
    const vm = await armExport(wrapper)
    vm.exportMode = 'new'
    vm.exportSelectedTemplateId = ''
    await wrapper.vm.$nextTick()

    await vm.onConfirmExport()
    await flushPromises()

    const kinds = exportedKinds()
    expect(kinds).toEqual(expect.arrayContaining(['PRAYER', 'MESSAGE', 'ANNOUNCEMENTS', 'MISC']))
    expect(kinds).not.toContain('IMPORTED')
    // Sub-task A: bibleVersion (arg index 7) is the org setting on every call.
    expect(mockAddSlotAsItem.mock.calls.length).toBeGreaterThan(0)
    for (const call of mockAddSlotAsItem.mock.calls as unknown as unknown[][]) {
      expect(call[7]).toBe(mockAuthState.settings.bibleVersion)
    }
  })

  it('exports the four non-song kinds in the new-plan WITH-template path (previously dropped)', async () => {
    mockServicesList = [{ ...mockService, status: 'planned', slots: kindFixtureSlots }]
    mockFetchTemplateItems.mockResolvedValueOnce([
      { title: 'Worship Song', itemType: 'song', sequence: 1, description: undefined },
    ] as unknown as never)
    const wrapper = await mountView()
    const vm = await armExport(wrapper)
    vm.exportMode = 'new'
    vm.exportSelectedTemplateId = 'tmpl-1'
    await wrapper.vm.$nextTick()

    await vm.onConfirmExport()
    await flushPromises()

    const kinds = exportedKinds()
    expect(kinds).toEqual(expect.arrayContaining(['PRAYER', 'MESSAGE', 'ANNOUNCEMENTS', 'MISC']))
    expect(kinds).not.toContain('IMPORTED')
  })

  it('appends the four non-song kinds in the existing-plan path (previously dropped)', async () => {
    mockServicesList = [{ ...mockService, status: 'planned', slots: kindFixtureSlots }]
    mockFetchPlanItems.mockResolvedValueOnce([] as unknown as never)
    const wrapper = await mountView()
    const vm = await armExport(wrapper)
    vm.exportMode = 'existing'
    vm.existingPlan = { id: 'pc-plan-existing', title: 'Existing', dates: '2026-03-08' }
    await wrapper.vm.$nextTick()

    await vm.onConfirmExport()
    await flushPromises()

    const kinds = exportedKinds()
    expect(kinds).toEqual(expect.arrayContaining(['PRAYER', 'MESSAGE', 'ANNOUNCEMENTS', 'MISC']))
    expect(kinds).not.toContain('IMPORTED')
  })
})

// ── ME-02 / ME-03 / R247 (84-01 CR-01): the retired lastUsedAt bump ───────────
//
// Wave 3 moved the draft->planned `lastUsedAt` bump out of `onSave` and into a
// view-level `bumpScheduledSongsLastUsed`, called by `onMarkAsPlanned` right
// after the transition. That view-level bump wrote `serverTimestamp()` (i.e.
// wall-clock "now") directly onto every scheduled song, unconditionally — and
// once `services.ts::markAsPlanned` (R247, 84-01) started doing its OWN correct
// lock-gated recompute (`MAX(locked service date)`), the two writes raced, with
// the view's wall-clock stamp landing after and clobbering the store's correct
// value. This reproduced the exact "stamps the add date, not the service date"
// bug 84-01 exists to fix, on every single "Mark as Planned" click, in
// production. Fixed by deleting `bumpScheduledSongsLastUsed` and its call site
// entirely (CR-01, 84-REVIEW.md): `serviceStore.markAsPlanned` is now the SOLE
// writer of `lastUsedAt` on this transition. The tests below assert the absence
// of the second write path, not its correctness — the store's own recompute is
// exercised end-to-end in `src/stores/__tests__/services.test.ts`'s "lastUsedAt
// recompute (R247)" suite, which this view's tests cannot reach because
// `serviceStore.markAsPlanned` is mocked here (see `mockMarkAsPlanned`).
describe('ServiceEditorView - ME-02/ME-03/R247: lastUsedAt on Mark as Planned', () => {
  async function mountView() {
    const { default: ServiceEditorView } = await import('@/views/ServiceEditorView.vue')
    return shallowMount(ServiceEditorView, {
      global: {
        stubs: {
          AppShell: { template: '<div><slot /></div>' },
          // 36-03: Suggest/Export/Copy/Save/Present all moved into this real
          // child component (ContextualActionBar.vue) — every mountView in
          // this file must render it for real (`false` opts a component OUT
          // of shallowMount's default auto-stub) or none of those controls'
          // pre-existing testids/text are reachable in the DOM anymore.
          ContextualActionBar: false,
          RouterLink: { template: '<a><slot /></a>' },
          // 32-05: render the real SaveStatusIndicator (not a shallow stub)
          // so its data-testid="save-status"/"save-status-error" handles are
          // reachable from these tests.
          SaveStatusIndicator: false,
          ServicePrintLayout: true,
          SongBadge: true,
          SongSlotPicker: true,
          ScriptureInput: true,
          teleport: false,
        },
      },
    })
  }

  interface LifecycleVm {
    localService: { status: string }
    lifecycleError: string | null
    onMarkAsPlanned: () => Promise<void>
  }

  let consoleErrorSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    mockAuthState.isEditor = true
    mockAuthState.orgId = 'org-1'
    mockUpdateService.mockClear()
    mockUpdateService.mockImplementation(() => Promise.resolve())
    mockMarkAsPlanned.mockClear()
    mockMarkAsPlanned.mockImplementation(() => Promise.resolve())
    mockAssignSongToSlot.mockClear()
    mockUpdateSong.mockClear()
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    consoleErrorSpy.mockRestore()
    mockMarkAsPlanned.mockImplementation(() => Promise.resolve())
  })

  it('CR-01 regression: does NOT bump SONG documents directly — serviceStore.markAsPlanned is the only lastUsedAt writer', async () => {
    mockServicesList = [{ ...mockService, status: 'draft' }]
    const wrapper = await mountView()
    const vm = wrapper.vm as unknown as LifecycleVm

    await vm.onMarkAsPlanned()
    await flushPromises()

    // The store call happened — this is where the real, lock-gated
    // `lastUsedAt` recompute now lives (see services.test.ts's "lastUsedAt
    // recompute (R247)" suite for proof it stamps the SERVICE date, not
    // wall-clock time).
    expect(mockMarkAsPlanned).toHaveBeenCalledTimes(1)
    expect(vm.localService.status).toBe('planned')

    // CR-01: the view must NOT also write `lastUsedAt` on any song directly.
    // A `songStore.updateSong({ lastUsedAt: ... })` call here would be the
    // deleted `bumpScheduledSongsLastUsed` conflicting write path reappearing
    // and clobbering the store's correct recompute with wall-clock time.
    const lastUsedAtCalls = mockUpdateSong.mock.calls.filter(
      ([, patch]) => (patch as Record<string, unknown> | undefined)?.lastUsedAt !== undefined,
    )
    expect(lastUsedAtCalls).toHaveLength(0)
    expect(mockUpdateSong).not.toHaveBeenCalled()

    // ME-02: `assignSongToSlot` is the round trip that rewrote `slots` from the
    // store snapshot — the reorder-clobbering hazard. It must not be used here.
    expect(mockAssignSongToSlot).not.toHaveBeenCalled()
    // ...and no `slots` write of any kind rides along with the transition.
    const slotWrites = mockUpdateService.mock.calls.filter(
      ([, patch]) => (patch as Record<string, unknown>).slots !== undefined,
    )
    expect(slotWrites).toHaveLength(0)
  })

  it('a failed markAsPlanned leaves lastUsedAt untouched — no song aged for a service that was never scheduled', async () => {
    mockServicesList = [{ ...mockService, status: 'draft' }]
    const wrapper = await mountView()
    const vm = wrapper.vm as unknown as LifecycleVm

    mockMarkAsPlanned.mockRejectedValueOnce(new Error('network error'))
    await vm.onMarkAsPlanned()
    await flushPromises()

    expect(vm.localService.status).toBe('draft')
    // Asserted over BOTH aging mechanisms, not just the new one: `updateSong`
    // alone would pass trivially against the pre-fix code (which aged songs via
    // `assignSongToSlot`) and so would prove nothing.
    expect(mockUpdateSong).not.toHaveBeenCalled()
    expect(mockAssignSongToSlot).not.toHaveBeenCalled()
  })

  it('distinguishes a lock refusal from a connection failure in the message', async () => {
    mockServicesList = [{ ...mockService, status: 'draft' }]
    const wrapper = await mountView()
    const vm = wrapper.vm as unknown as LifecycleVm

    mockMarkAsPlanned.mockRejectedValueOnce(new ServiceLockedErrorStub('service-1', 'exported', 'mark as planned'))
    await vm.onMarkAsPlanned()
    await flushPromises()

    expect(vm.lifecycleError).toBeTruthy()
    // "Check your connection and try again" is wrong advice for a store-guard
    // refusal — the connection is fine and retrying will fail identically.
    expect(vm.lifecycleError!.toLowerCase()).not.toContain('connection')
    expect(vm.lifecycleError).not.toContain('R036')

    // ...and the transport case still says what it always said.
    mockMarkAsPlanned.mockRejectedValueOnce(new Error('network error'))
    await vm.onMarkAsPlanned()
    await flushPromises()
    expect(vm.lifecycleError!.toLowerCase()).toContain('connection')
  })
})

// ── 32-05: migrated onto useAutoSave/useSaveStatus; one sticky status bar ─────
//
// The hand-rolled ~150-line inline autosave block (autosaveStatus/autosaveTimer/
// autosaveInitialized/autosaveSaving) is gone — ServiceEditorView now delegates
// its debounce/inflight-guard/error-catch to the shared `useAutoSave` composable
// and reports into the shared `useSaveStatus` store, keyed `service:{id}`. The
// header's inline status text is retired in favour of a sticky
// `service-save-status-bar` hosting one `SaveStatusIndicator`. See 32-RESEARCH.md
// § Architecture Patterns → Pattern 3 for the full migration checklist this
// block exercises.
describe('ServiceEditorView - 32-05: migrated onto useAutoSave/useSaveStatus, sticky status bar', () => {
  async function mountView() {
    const { default: ServiceEditorView } = await import('@/views/ServiceEditorView.vue')
    return shallowMount(ServiceEditorView, {
      global: {
        stubs: {
          AppShell: { template: '<div><slot /></div>' },
          // 36-03: Suggest/Export/Copy/Save/Present all moved into this real
          // child component (ContextualActionBar.vue) — every mountView in
          // this file must render it for real (`false` opts a component OUT
          // of shallowMount's default auto-stub) or none of those controls'
          // pre-existing testids/text are reachable in the DOM anymore.
          ContextualActionBar: false,
          RouterLink: { template: '<a><slot /></a>' },
          ServicePrintLayout: true,
          SongBadge: true,
          SongSlotPicker: true,
          ScriptureInput: true,
          SaveStatusIndicator: false,
        },
      },
    })
  }

  beforeEach(() => {
    mockAuthState.isEditor = true
    mockAuthState.orgId = 'org-1'
    mockServicesList = [{ ...mockService }]
    mockUpdateService.mockClear()
    mockUpdateService.mockImplementation(() => Promise.resolve())
    mockOwnWriteEchoIds = []
    resetSortableCaptures()
  })

  afterEach(() => {
    mockOwnWriteEchoIds = []
  })

  /** The composable's own internal `initialized` flag swallows its FIRST
   *  `localService` trigger, same reasoning as the R039/BL-02 blocks'
   *  `warmAutosaveWatcher` — a throwaway touch absorbs it so the SECOND edit
   *  is the one that genuinely arms the debounce. */
  async function warmUp(
    wrapper: Awaited<ReturnType<typeof mountView>>,
    vm: { localService: { notes: string } },
  ) {
    vm.localService.notes = 'warm-up touch the composable swallows'
    await wrapper.vm.$nextTick()
  }

  // ── Structure: one bar, one indicator, mutually exclusive with lock/viewer ──

  it('renders exactly one service-save-status-bar hosting exactly one save-status indicator for an editable draft service', async () => {
    const wrapper = await mountView()
    await wrapper.vm.$nextTick()

    const bars = wrapper.findAll('[data-testid="service-save-status-bar"]')
    expect(bars).toHaveLength(1)
    expect(bars[0]!.findAll('[data-testid="save-status"]')).toHaveLength(1)
  })

  it('the bar is absent for a locked (planned) service', async () => {
    mockServicesList = [{ ...mockService, status: 'planned' }]
    const wrapper = await mountView()
    await wrapper.vm.$nextTick()

    expect(wrapper.find('[data-testid="service-save-status-bar"]').exists()).toBe(false)
  })

  it('the bar is absent for a viewer', async () => {
    mockAuthState.isEditor = false
    const wrapper = await mountView()
    await wrapper.vm.$nextTick()

    expect(wrapper.find('[data-testid="service-save-status-bar"]').exists()).toBe(false)
  })

  // ── Chrome visibility (34-10 / UAT F4) ──────────────────────────────────────
  //
  // The bar element itself stays mounted for an editor (v-if="canEditService"
  // is untouched); only its CHROME — border, background, padding, margin,
  // sticky positioning — is conditional on whether there is a status to
  // report. Idle carries no classes at all, so nothing is pinned to the top
  // of the scrollport and nothing occupies vertical space.

  it('an editor on an unedited draft service sees the bar element with no chrome classes at all', async () => {
    const wrapper = await mountView()
    await wrapper.vm.$nextTick()

    const bar = wrapper.find('[data-testid="service-save-status-bar"]')
    expect(bar.exists()).toBe(true)
    // R102 (48-03): the wrapper's flex layout is now unconditional (so the
    // Undo link lays out beside SaveStatusIndicator even at idle) — only
    // border/background/padding/sticky stay conditional.
    expect(bar.classes()).toEqual(['flex', 'items-center', 'gap-2'])
  })

  for (const status of ['pending', 'saving', 'saved', 'error'] as const) {
    it(`status "${status}": the bar carries its full chrome class list`, async () => {
      const wrapper = await mountView()
      await wrapper.vm.$nextTick()

      useSaveStatus().set('service:service-1', { status, errorText: status === 'error' ? GENERIC_ERROR_TEXT : undefined })
      await wrapper.vm.$nextTick()

      const bar = wrapper.find('[data-testid="service-save-status-bar"]')
      expect(bar.classes()).toEqual(
        expect.arrayContaining(['sticky', 'top-0', 'z-10', 'rounded-md', 'border', 'border-gray-800', 'bg-gray-900']),
      )
    })
  }

  it('going from saved back to idle strips the chrome again', async () => {
    const wrapper = await mountView()
    await wrapper.vm.$nextTick()

    useSaveStatus().set('service:service-1', { status: 'saved', savedAt: new Date() })
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[data-testid="service-save-status-bar"]').classes().length).toBeGreaterThan(0)

    useSaveStatus().set('service:service-1', { status: 'idle' })
    await wrapper.vm.$nextTick()
    // R102 (48-03): flex layout is unconditional now — only chrome strips.
    expect(wrapper.find('[data-testid="service-save-status-bar"]').classes()).toEqual(['flex', 'items-center', 'gap-2'])
  })

  it('the aria-live element is the SAME DOM node across idle -> pending -> saving -> saved, with changing text', async () => {
    const wrapper = await mountView()
    await wrapper.vm.$nextTick()

    const idleNode = wrapper.find('[data-testid="save-status"]').element
    expect(wrapper.find('[data-testid="save-status"]').text()).toBe('')

    useSaveStatus().set('service:service-1', { status: 'pending' })
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[data-testid="save-status"]').element).toBe(idleNode)
    expect(wrapper.find('[data-testid="save-status"]').text()).toBe('Saving soon…')

    useSaveStatus().set('service:service-1', { status: 'saving' })
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[data-testid="save-status"]').element).toBe(idleNode)
    expect(wrapper.find('[data-testid="save-status"]').text()).toBe('Saving…')

    const savedAt = new Date()
    useSaveStatus().set('service:service-1', { status: 'saved', savedAt })
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[data-testid="save-status"]').element).toBe(idleNode)
    expect(wrapper.find('[data-testid="save-status"]').text()).toContain('Saved')
  })

  // Owner follow-up: with the default no-credentials mock state, there is no
  // export/copy button any more — Copy for PC was deleted, with no
  // replacement. The credentials-missing note (now rendered below the
  // button row rather than beside it) is the only surviving export-related
  // affordance for this state, so it stands in for the old "Export/Copy"
  // assertion here.
  // R102 (48-03): rewritten — Undo no longer lives in the header Save area
  // (Pitfall 5: this test's title used to claim it did, while its
  // assertions never actually checked for it). Undo is now a link inside
  // the save-status bar, beside SaveStatusIndicator.
  it('the header Save area keeps Suggest All Songs and Mark as Planned but NOT Undo once the inline status block is removed; Undo lives in the save-status bar; the credentials-missing note is the sole export affordance', async () => {
    const wrapper = await mountView()
    await wrapper.vm.$nextTick()
    // Force a previousService snapshot so the undo-link's own
    // `v-if="previousService"` has something to gate on.
    ;(wrapper.vm as unknown as { previousService: unknown }).previousService = { ...mockService }
    await wrapper.vm.$nextTick()

    expect(wrapper.find('[data-testid="mark-planned-btn"]').exists()).toBe(true)
    const buttons = wrapper.findAll('button')
    expect(buttons.some((b) => b.text().includes('Suggest All Songs'))).toBe(true)
    expect(wrapper.find('[data-testid="export-pc-btn"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="copy-pc-btn"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="pc-credentials-missing-note"]').exists()).toBe(true)

    // NOT in the header Save area (mark-planned-btn's own row).
    const markPlannedRow = wrapper.find('[data-testid="mark-planned-btn"]').element.parentElement
    expect(markPlannedRow?.querySelector('[data-testid="undo-link"]')).toBeNull()

    // IS inside the save-status bar, beside SaveStatusIndicator.
    const saveStatusBar = wrapper.find('[data-testid="service-save-status-bar"]')
    expect(saveStatusBar.find('[data-testid="undo-link"]').exists()).toBe(true)
  })

  // ── Reporting into useSaveStatus ────────────────────────────────────────────

  it('after a successful debounced save the store entry reads saved with a savedAt', async () => {
    const wrapper = await mountView()
    await wrapper.vm.$nextTick()
    const vm = wrapper.vm as unknown as { localService: { notes: string } }

    await warmUp(wrapper, vm)
    vm.localService.notes = 'a real edit'
    await wrapper.vm.$nextTick()
    await new Promise((resolve) => setTimeout(resolve, 900))
    await flushPromises()

    const entry = saveStatusEntry('service-1')
    expect(entry.status).toBe('saved')
    expect(entry.savedAt).toBeInstanceOf(Date)
  })

  it('after a rejected debounced save the store entry reads error with the generic sentence, and the edit is kept', async () => {
    const wrapper = await mountView()
    await wrapper.vm.$nextTick()
    const vm = wrapper.vm as unknown as { localService: { notes: string } }

    await warmUp(wrapper, vm)
    mockUpdateService.mockRejectedValueOnce(new Error('network error'))
    vm.localService.notes = 'an edit that fails to save'
    await wrapper.vm.$nextTick()
    await new Promise((resolve) => setTimeout(resolve, 900))
    await flushPromises()

    const entry = saveStatusEntry('service-1')
    expect(entry.status).toBe('error')
    expect(entry.errorText).toBe("Couldn't save your changes — they're still here. Try again.")
    expect(vm.localService.notes).toBe('an edit that fails to save')
  })

  it("after a rejected reorder save the store entry reads error with the reorder sentence", async () => {
    mockServicesList = [makeSectionedService()]
    resetSortableCaptures()
    mockUpdateService.mockRejectedValueOnce(new Error('network error'))
    const wrapper = await mountView()
    await wrapper.vm.$nextTick()

    const worshipCapture = captureForSection('worship')
    if (!worshipCapture) throw new Error('no worship capture resolved')
    await worshipCapture.options.onEnd!({
      oldDraggableIndex: 0,
      newDraggableIndex: 2,
      item: worshipCapture.el.children[0] as HTMLElement,
      from: worshipCapture.el,
      to: worshipCapture.el,
    } as never)
    await flushPromises()

    const entry = saveStatusEntry('service-1')
    expect(entry.status).toBe('error')
    expect(entry.errorText).toBe("Couldn't save this order — reverted. Try dragging again.")
  })

  // ── P-02: viewing must never write ──────────────────────────────────────────

  it('mounting the view and touching nothing issues no write and leaves the entry idle, even for a service with zero slots', async () => {
    mockServicesList = [{ ...mockService, slots: [] }]
    const wrapper = await mountView()
    await wrapper.vm.$nextTick()
    await new Promise((resolve) => setTimeout(resolve, 900))
    await flushPromises()

    expect(mockUpdateService).not.toHaveBeenCalled()
    expect(saveStatusEntry('service-1').status).toBe('idle')
  })

  // ── E2 backstops ─────────────────────────────────────────────────────────────

  it("navigating from one service id to another does not carry the first save's entry into the second render (loading backstop)", async () => {
    mockServicesList = [
      { ...mockService, id: 'service-1' },
      { ...mockService, id: 'service-2' },
    ]
    const wrapper = await mountView()
    await wrapper.vm.$nextTick()
    const vm = wrapper.vm as unknown as { localService: { notes: string } }

    await warmUp(wrapper, vm)
    vm.localService.notes = 'drive to saved'
    await wrapper.vm.$nextTick()
    await new Promise((resolve) => setTimeout(resolve, 900))
    await flushPromises()
    expect(saveStatusEntry('service-1').status).toBe('saved')

    mockRoute.params.id = 'service-2'
    await wrapper.vm.$nextTick()
    await flushPromises()

    expect(saveStatusEntry('service-2').status).toBe('idle')
  })

  it('unmounting the view leaves no entry for its surface (partial backstop)', async () => {
    const wrapper = await mountView()
    await wrapper.vm.$nextTick()
    const vm = wrapper.vm as unknown as { localService: { notes: string } }

    await warmUp(wrapper, vm)
    vm.localService.notes = 'a real edit'
    await wrapper.vm.$nextTick()
    await new Promise((resolve) => setTimeout(resolve, 900))
    await flushPromises()
    expect(saveStatusEntry('service-1').status).toBe('saved')

    wrapper.unmount()

    expect(useSaveStatus().entries['service:service-1']).toBeUndefined()
  })

  // ── Task 3: the four preserved behaviours the migration could silently drop ──

  it('the lock-cancel guarantee: a timer armed before the lock engages is cancelled the instant it engages, not merely left to no-op at fire time', async () => {
    const wrapper = await mountView()
    await wrapper.vm.$nextTick()
    const vm = wrapper.vm as unknown as { localService: { notes: string; status: string } }

    await warmUp(wrapper, vm)
    vm.localService.notes = 'typed just before the lock engages'
    await wrapper.vm.$nextTick()
    expect(saveStatusEntry('service-1').status).toBe('pending')

    // The client's own copy locks — the same effect `applyTransitionLocally`
    // has, without going through the whole onMarkAsPlanned flow the BL-02
    // block already exercises via a different mechanism.
    vm.localService.status = 'planned'
    await wrapper.vm.$nextTick()

    // Proactive: the entry drops to idle immediately, not merely once the
    // now-orphaned timer eventually fires 800ms later and no-ops on its own
    // re-check.
    expect(saveStatusEntry('service-1').status).toBe('idle')

    await new Promise((resolve) => setTimeout(resolve, 900))
    await flushPromises()
    expect(mockUpdateService).not.toHaveBeenCalled()
  })

  it('the undo snapshot: undo restores the pre-save state after a completed autosave', async () => {
    const wrapper = await mountView()
    await wrapper.vm.$nextTick()
    const vm = wrapper.vm as unknown as {
      localService: { notes: string }
      onUndo: () => void
    }

    // Captured BEFORE the warm-up touch: the snapshot `onUndo` restores is
    // taken from `originalService` at the moment the save wrapper runs,
    // which — for this, the FIRST save on this mount — is still the
    // pristine, as-loaded state, not whatever the warm-up touch left behind.
    const pristineNotes = vm.localService.notes
    await warmUp(wrapper, vm)
    vm.localService.notes = 'a change that will be undone'
    await wrapper.vm.$nextTick()
    await new Promise((resolve) => setTimeout(resolve, 900))
    await flushPromises()
    expect(mockUpdateService).toHaveBeenCalledTimes(1)

    vm.onUndo()
    expect(vm.localService.notes).toBe(pristineNotes)
  })

  it('a genuine external merge still applies and arms no save (RESEARCH assumption A2)', async () => {
    const reactiveServices = reactive([{ ...mockService }])
    mockServicesList = reactiveServices as unknown as Service[]
    const wrapper = await mountView()
    await wrapper.vm.$nextTick()
    const vm = wrapper.vm as unknown as { localService: { notes: string } }

    // Not classified as our own echo — genuinely a different writer's change.
    mockOwnWriteEchoIds = []
    reactiveServices[0]!.notes = 'a change from a different editor'
    await wrapper.vm.$nextTick()
    await flushPromises()

    expect(vm.localService.notes).toBe('a change from a different editor')

    await new Promise((resolve) => setTimeout(resolve, 900))
    await flushPromises()
    expect(mockUpdateService).not.toHaveBeenCalled()
  })

  it('a locked-service rejection reverts local state and returns the entry to idle, not error', async () => {
    const wrapper = await mountView()
    await wrapper.vm.$nextTick()
    const vm = wrapper.vm as unknown as { localService: { notes: string } }

    // Captured BEFORE the warm-up touch — see the undo-snapshot test's
    // comment above for why: this is the FIRST save attempt on this mount,
    // so the state `handleAutosaveFailure` reverts to is the pristine,
    // as-loaded state, not whatever the warm-up touch left behind.
    const persistedNotes = vm.localService.notes
    await warmUp(wrapper, vm)
    mockUpdateService.mockRejectedValueOnce(new ServiceLockedErrorStub('service-1', 'planned'))
    vm.localService.notes = 'typed just as another editor locked it'
    await wrapper.vm.$nextTick()
    await new Promise((resolve) => setTimeout(resolve, 900))
    await flushPromises()

    expect(vm.localService.notes).toBe(persistedNotes)
    const entry = saveStatusEntry('service-1')
    expect(entry.status).toBe('idle')
  })

  it("a transport rejection keeps the user's edit and leaves the entry at error, never stranded at saving", async () => {
    const wrapper = await mountView()
    await wrapper.vm.$nextTick()
    const vm = wrapper.vm as unknown as { localService: { notes: string } }

    await warmUp(wrapper, vm)
    mockUpdateService.mockRejectedValueOnce(new Error('network error'))
    vm.localService.notes = 'an edit kept after a transport failure'
    await wrapper.vm.$nextTick()
    await new Promise((resolve) => setTimeout(resolve, 900))
    await flushPromises()

    expect(vm.localService.notes).toBe('an edit kept after a transport failure')
    const entry = saveStatusEntry('service-1')
    expect(entry.status).toBe('error')
    expect(entry.status).not.toBe('saving')
  })
})

// ── 32-REVIEW: CR-01/CR-02/CR-03 ────────────────────────────────────────────────
//
// The review's three Critical findings all live in the window where a SECOND,
// distinct edit lands while a FIRST autosave write for this same view is still
// in flight — a window none of the phase's own (otherwise careful) tests
// exercised. See 32-REVIEW.md for the full traces.
describe('ServiceEditorView - 32-REVIEW: CR-01/CR-02/CR-03', () => {
  async function mountView() {
    const { default: ServiceEditorView } = await import('@/views/ServiceEditorView.vue')
    return shallowMount(ServiceEditorView, {
      global: {
        stubs: {
          AppShell: { template: '<div><slot /></div>' },
          // 36-03: Suggest/Export/Copy/Save/Present all moved into this real
          // child component (ContextualActionBar.vue) — every mountView in
          // this file must render it for real (`false` opts a component OUT
          // of shallowMount's default auto-stub) or none of those controls'
          // pre-existing testids/text are reachable in the DOM anymore.
          ContextualActionBar: false,
          RouterLink: { template: '<a><slot /></a>' },
          ServicePrintLayout: true,
          SongBadge: true,
          SongSlotPicker: true,
          ScriptureInput: true,
          SaveStatusIndicator: false,
        },
      },
    })
  }

  beforeEach(() => {
    mockAuthState.isEditor = true
    mockAuthState.orgId = 'org-1'
    mockServicesList = [{ ...mockService }]
    mockUpdateService.mockClear()
    mockUpdateService.mockImplementation(() => Promise.resolve())
    mockMarkAsPlanned.mockClear()
    mockMarkAsPlanned.mockImplementation(() => Promise.resolve())
    mockOwnWriteEchoIds = []
    resetSortableCaptures()
  })

  afterEach(() => {
    mockOwnWriteEchoIds = []
    mockMarkAsPlanned.mockImplementation(() => Promise.resolve())
  })

  /** Same warm-up idiom as the 32-05 block above — the composable's own
   *  `initialized` flag swallows the first `localService` trigger. */
  async function warmUp(
    wrapper: Awaited<ReturnType<typeof mountView>>,
    vm: { localService: { notes: string } },
  ) {
    vm.localService.notes = 'warm-up touch the composable swallows'
    await wrapper.vm.$nextTick()
  }

  it('CR-01: an edit made while an earlier autosave write is still in flight is not marked clean before it is ever persisted', async () => {
    const wrapper = await mountView()
    await wrapper.vm.$nextTick()
    const vm = wrapper.vm as unknown as { localService: { notes: string; name: string } }

    await warmUp(wrapper, vm)

    // Edit A: hold its write open so a second, distinct edit can land while
    // it is still in flight.
    let resolveA!: () => void
    mockUpdateService.mockImplementationOnce(
      () => new Promise<void>((resolve) => { resolveA = resolve }),
    )
    vm.localService.notes = 'edit A'
    await wrapper.vm.$nextTick()
    await new Promise((resolve) => setTimeout(resolve, 900))
    await flushPromises()
    expect(mockUpdateService).toHaveBeenCalledTimes(1)

    // Edit B: a DIFFERENT field, made while edit A's write is still in flight.
    vm.localService.name = 'edit B, made mid-flight'
    await wrapper.vm.$nextTick()

    // Edit A's write resolves.
    resolveA()
    await flushPromises()

    // Before the fix: onSave() stamped originalService from the LIVE
    // localService (which by then already contained B), marking B clean
    // without B ever having been sent — the next debounce timer's own
    // isDirty re-check would then see nothing left to save, and B would
    // never reach Firestore.
    mockUpdateService.mockClear()
    await new Promise((resolve) => setTimeout(resolve, 900))
    await flushPromises()

    expect(mockUpdateService).toHaveBeenCalledTimes(1)
    const payload = mockUpdateService.mock.calls[0]![1] as { name?: string; notes?: string }
    expect(payload.name).toBe('edit B, made mid-flight')
    expect(payload.notes).toBe('edit A')
  })

  it("CR-02: Mark as Planned's flush() does not destroy a newer edit's only retry path while an earlier save is still in flight", async () => {
    const wrapper = await mountView()
    await wrapper.vm.$nextTick()
    const vm = wrapper.vm as unknown as {
      localService: { notes: string; name: string; status: string }
      onMarkAsPlanned: () => Promise<void>
    }

    await warmUp(wrapper, vm)

    // Edit A: hold its write open.
    let resolveA!: () => void
    mockUpdateService.mockImplementationOnce(
      () => new Promise<void>((resolve) => { resolveA = resolve }),
    )
    vm.localService.notes = 'edit A'
    await wrapper.vm.$nextTick()
    await new Promise((resolve) => setTimeout(resolve, 900))
    await flushPromises()
    expect(mockUpdateService).toHaveBeenCalledTimes(1)

    // Edit B lands while A's write is still in flight — arms its own timer.
    vm.localService.name = 'edit B while A is still in flight'
    await wrapper.vm.$nextTick()

    // Mark as Planned is clicked now — flush() runs while A is still
    // saving. The transition itself is made to fail so applyTransitionLocally
    // never runs and the (separate, already-tested) cancel-on-lock watcher
    // cannot be what clears B's timer — isolating flush()'s own behavior.
    mockMarkAsPlanned.mockRejectedValueOnce(new Error('transition failed'))
    await vm.onMarkAsPlanned()
    expect(vm.localService.status).toBe('draft')

    // A's write resolves.
    resolveA()
    await flushPromises()

    // Before the fix, flush() cleared B's just-armed timer up front, then
    // no-op'd on `if (saving) return` — B became unreachable by any
    // mechanism, with no error, no toast, and the service never even locked.
    mockUpdateService.mockClear()
    await new Promise((resolve) => setTimeout(resolve, 900))
    await flushPromises()

    expect(mockUpdateService).toHaveBeenCalledTimes(1)
    const payload = mockUpdateService.mock.calls[0]![1] as { name?: string }
    expect(payload.name).toBe('edit B while A is still in flight')
  })

  it('CR-03: an outstanding autosave error stays visible in the lock banner instead of vanishing when Mark as Planned locks the service', async () => {
    const wrapper = await mountView()
    await wrapper.vm.$nextTick()
    const vm = wrapper.vm as unknown as {
      localService: { notes: string; status: string }
      onMarkAsPlanned: () => Promise<void>
    }

    await warmUp(wrapper, vm)
    mockUpdateService.mockRejectedValueOnce(new Error('network error'))
    vm.localService.notes = 'an edit that fails to save, still unsaved when the lock lands'
    await wrapper.vm.$nextTick()
    await new Promise((resolve) => setTimeout(resolve, 900))
    await flushPromises()

    expect(saveStatusEntry('service-1').status).toBe('error')

    // Mark as Planned is not gated on an outstanding autosave error (CR-03's
    // own point) — the user can click it with the failed, still-unsaved edit
    // on screen. `onMarkAsPlanned` nulls `lifecycleError` at its own start,
    // then locks the service — the exact sequence that, before the fix, left
    // both surfaces silently reporting "nothing is wrong."
    await vm.onMarkAsPlanned()
    await wrapper.vm.$nextTick()
    await flushPromises()
    expect(vm.localService.status).toBe('planned')

    // The status bar (canEditService-gated) is gone, as designed — but before
    // the fix the failure vanished completely: `onMarkAsPlanned` had already
    // nulled `lifecycleError`, and the cancel-on-lock watcher unconditionally
    // overwrote the saveStatus entry to 'idle', with nothing re-populating
    // either surface. The lock banner's error line is NOT gated behind
    // canEditService (31-UI-SPEC § 1), so it must show the failure instead.
    expect(wrapper.find('[data-testid="service-save-status-bar"]').exists()).toBe(false)
    const bannerError = wrapper.find('[data-testid="service-lock-banner-error"]')
    expect(bannerError.exists()).toBe(true)
    expect(bannerError.text()).toBe("Couldn't save your changes — they're still here. Try again.")
  })
})

// ── 58-05 (R132): per-service Messaging defaults panel ────────────────────────
//
// The Service Order tab carries a "Messaging defaults" card with three
// inherit-or-override <select>s (lock-notify, service-link reminder, reminder
// days-before). Editable only while the service is Draft (canEditService),
// read-only once locked or for a viewer. Each @change writes the scoped
// dot-path via serviceStore.setServiceMessagingDefaults — NEVER updateService —
// mapping the empty "Default" option to null and coercing the days value to a
// number. Mirrors the Roles-tab override selects' direct-write pattern.
describe('ServiceEditorView - Messaging defaults panel (58-05, R132)', () => {
  async function mountView(overrides: Partial<Service> = {}) {
    mockServicesList = [{ ...mockService, status: 'draft', ...overrides }]
    const { default: ServiceEditorView } = await import('@/views/ServiceEditorView.vue')
    return shallowMount(ServiceEditorView, {
      global: {
        stubs: {
          AppShell: { template: '<div><slot /></div>' },
          ContextualActionBar: false,
          RouterLink: { template: '<a><slot /></a>' },
          SaveStatusIndicator: false,
          ServicePrintLayout: true,
          SongBadge: true,
          SongSlotPicker: true,
          ScriptureInput: true,
          PresentationViewer: true,
        },
      },
    })
  }

  beforeEach(() => {
    mockAuthState.isEditor = true
    mockAuthState.orgId = 'org-1'
    // Restore conservative org defaults each test (a prior test may flip them).
    mockAuthState.settings.messaging = {
      enabled: false,
      lockNotifyDefault: false,
      reminderEnabled: false,
      reminderDaysBefore: 3,
    }
    mockSetServiceMessagingDefaults.mockClear()
    mockSetServiceMessagingDefaults.mockImplementation(() => Promise.resolve())
  })

  it('a Draft service renders the lock-notify and reminder-enabled selects; the days-before select is hidden while the reminder row resolves off', async () => {
    const wrapper = await mountView()

    expect(wrapper.find('[data-testid="messaging-lock-notify-select"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="messaging-reminder-enabled-select"]').exists()).toBe(true)
    // Org default reminderEnabled is false and the service has no override, so
    // the reminder row resolves off and the days-before select stays hidden.
    expect(wrapper.find('[data-testid="messaging-reminder-days-select"]').exists()).toBe(false)
    // No read-only summary on a Draft service.
    expect(wrapper.find('[data-testid="messaging-defaults-readonly"]').exists()).toBe(false)
  })

  it('the days-before select appears once the reminder row resolves on — via the inherited org default', async () => {
    mockAuthState.settings.messaging.reminderEnabled = true
    const wrapper = await mountView()

    expect(wrapper.find('[data-testid="messaging-reminder-days-select"]').exists()).toBe(true)
  })

  it('the days-before select appears once the reminder row resolves on — via an explicit service override', async () => {
    const wrapper = await mountView({
      messaging: {
        lockNotifyEnabled: null,
        reminderEnabled: true,
        reminderDaysBefore: null,
        reminderSentAt: null,
      },
    })

    expect(wrapper.find('[data-testid="messaging-reminder-days-select"]').exists()).toBe(true)
  })

  it('selecting an explicit lock-notify value writes it as a boolean via setServiceMessagingDefaults (scoped dot-path, not updateService)', async () => {
    const wrapper = await mountView()
    // Clear any mount-time backfill write (Phase 24-06) so the assertion below
    // isolates the @change handler: it must NOT route the override through the
    // generic updateService autosave path.
    mockUpdateService.mockClear()

    await wrapper.find('[data-testid="messaging-lock-notify-select"]').setValue('true')
    await flushPromises()

    expect(mockSetServiceMessagingDefaults).toHaveBeenCalledWith('service-1', { lockNotifyEnabled: true })
    expect(mockUpdateService).not.toHaveBeenCalled()
  })

  it('selecting the Default (empty) lock-notify option writes null to inherit', async () => {
    const wrapper = await mountView({
      messaging: {
        lockNotifyEnabled: true,
        reminderEnabled: null,
        reminderDaysBefore: null,
        reminderSentAt: null,
      },
    })

    await wrapper.find('[data-testid="messaging-lock-notify-select"]').setValue('')
    await flushPromises()

    expect(mockSetServiceMessagingDefaults).toHaveBeenCalledWith('service-1', { lockNotifyEnabled: null })
  })

  it('selecting an explicit reminder-enabled value writes the boolean', async () => {
    const wrapper = await mountView()

    await wrapper.find('[data-testid="messaging-reminder-enabled-select"]').setValue('true')
    await flushPromises()

    expect(mockSetServiceMessagingDefaults).toHaveBeenCalledWith('service-1', { reminderEnabled: true })
  })

  it('selecting a days-before value persists it coerced to a number, never the raw select string', async () => {
    // Reminder resolves on via the org default, so the days-before select renders.
    mockAuthState.settings.messaging.reminderEnabled = true
    const wrapper = await mountView()

    await wrapper.find('[data-testid="messaging-reminder-days-select"]').setValue('7')
    await flushPromises()

    expect(mockSetServiceMessagingDefaults).toHaveBeenCalledWith('service-1', { reminderDaysBefore: 7 })
    const patch = mockSetServiceMessagingDefaults.mock.calls[0]![1] as { reminderDaysBefore: unknown }
    expect(typeof patch.reminderDaysBefore).toBe('number')
  })

  it('selecting the Default (empty) days-before option writes null to inherit', async () => {
    mockAuthState.settings.messaging.reminderEnabled = true
    const wrapper = await mountView({
      messaging: {
        lockNotifyEnabled: null,
        reminderEnabled: null,
        reminderDaysBefore: 7,
        reminderSentAt: null,
      },
    })

    await wrapper.find('[data-testid="messaging-reminder-days-select"]').setValue('')
    await flushPromises()

    expect(mockSetServiceMessagingDefaults).toHaveBeenCalledWith('service-1', { reminderDaysBefore: null })
  })

  it('a locked service (editor, status planned) renders the read-only summary and no editable select', async () => {
    const wrapper = await mountView({ status: 'planned' })

    expect(wrapper.find('[data-testid="messaging-defaults-readonly"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="messaging-lock-notify-select"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="messaging-reminder-enabled-select"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="messaging-reminder-days-select"]').exists()).toBe(false)
  })

  it('a viewer (isEditor false) sees the read-only summary and no editable select', async () => {
    mockAuthState.isEditor = false
    const wrapper = await mountView()

    expect(wrapper.find('[data-testid="messaging-defaults-readonly"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="messaging-lock-notify-select"]').exists()).toBe(false)
  })

  it('a save failure surfaces the inline "Failed to save. Please try again." message', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    mockSetServiceMessagingDefaults.mockRejectedValueOnce(new Error('network down'))
    const wrapper = await mountView()

    await wrapper.find('[data-testid="messaging-lock-notify-select"]').setValue('true')
    await flushPromises()

    const panel = wrapper.find('[data-testid="messaging-defaults-panel"]')
    expect(panel.text()).toContain('Failed to save. Please try again.')
    consoleErrorSpy.mockRestore()
  })
})

// ── 63-01 (R149/R150): Messages tab — relocated defaults + delivery history ────
//
// The messaging surfaces now live in a dedicated Messages tab (4th button,
// after Roles), gated authStore.isEditor && isMessagingEnabled(). The
// messaging-defaults panel and the read-only ServiceMessageHistory card MOVED
// out of the Service Order tab into the v-show="activeTab==='messages'"
// messages-panel. R150: the history's own gate dropped canEditService (→
// isMessagingEnabled() && authStore.isEditor), so it renders on a LOCKED
// service. Panels use v-show (kept in DOM), so relocation is proven by the
// CONTAINER a surface resolves inside, not a bare .exists(). Focused
// present/absent assertions only — the panel's own behavior is covered by
// ServiceMessageHistory.test.ts.
describe('ServiceEditorView - Messages tab: relocated defaults + history (63-01, R149/R150)', () => {
  async function mountView(overrides: Partial<Service> = {}) {
    mockServicesList = [{ ...mockService, status: 'draft', ...overrides }]
    const { default: ServiceEditorView } = await import('@/views/ServiceEditorView.vue')
    return shallowMount(ServiceEditorView, {
      global: {
        stubs: {
          AppShell: { template: '<div><slot /></div>' },
          ContextualActionBar: false,
          RouterLink: { template: '<a><slot /></a>' },
          SaveStatusIndicator: false,
          ServicePrintLayout: true,
          SongBadge: true,
          SongSlotPicker: true,
          ScriptureInput: true,
          PresentationViewer: true,
        },
      },
    })
  }

  beforeEach(() => {
    mockAuthState.isEditor = true
    mockAuthState.orgId = 'org-1'
    mockAuthState.settings.messaging = {
      enabled: false,
      lockNotifyDefault: false,
      reminderEnabled: false,
      reminderDaysBefore: 3,
    }
    mockSubscribeServiceMessages.mockClear()
  })

  it('shows the Messages tab button for an editor with messaging ON', async () => {
    mockAuthState.settings.messaging.enabled = true
    const wrapper = await mountView()
    await wrapper.vm.$nextTick()

    const btn = wrapper.findAll('button').find((b) => b.text() === 'Messages' && b.classes().includes('rounded-t-md'))
    expect(btn?.exists()).toBe(true)
  })

  it('HIDES the Messages tab button for a viewer (non-editor)', async () => {
    mockAuthState.settings.messaging.enabled = true
    mockAuthState.isEditor = false
    const wrapper = await mountView()
    await wrapper.vm.$nextTick()

    expect(wrapper.findAll('button').find((b) => b.text() === 'Messages' && b.classes().includes('rounded-t-md'))).toBeUndefined()
  })

  it('HIDES the Messages tab button when org messaging is OFF', async () => {
    mockAuthState.settings.messaging.enabled = false
    const wrapper = await mountView()
    await wrapper.vm.$nextTick()

    expect(wrapper.findAll('button').find((b) => b.text() === 'Messages' && b.classes().includes('rounded-t-md'))).toBeUndefined()
  })

  it('relocates the defaults panel + history INTO the messages-panel (not service-order-panel)', async () => {
    mockAuthState.settings.messaging.enabled = true
    const wrapper = await mountView()
    await wrapper.vm.$nextTick()

    const messagesBtn = wrapper.findAll('button').find((b) => b.text() === 'Messages' && b.classes().includes('rounded-t-md'))
    await messagesBtn!.trigger('click')

    // Both surfaces resolve INSIDE the messages-panel container.
    const messagesPanel = wrapper.find('[data-testid="messages-panel"]')
    expect(messagesPanel.find('[data-testid="messaging-defaults-panel"]').exists()).toBe(true)
    expect(messagesPanel.find('[data-testid="service-message-history"]').exists()).toBe(true)

    // And they are NO LONGER inside the service-order-panel container (v-show
    // keeps both panels in the DOM, so the container is what proves the move).
    const serviceOrderPanel = wrapper.find('[data-testid="service-order-panel"]')
    expect(serviceOrderPanel.find('[data-testid="messaging-defaults-panel"]').exists()).toBe(false)
    expect(serviceOrderPanel.find('[data-testid="service-message-history"]').exists()).toBe(false)

    // The store subscription is still opened for this service.
    expect(mockSubscribeServiceMessages).toHaveBeenCalledWith('org-1', 'service-1')
  })

  it('HIDES the history card when messaging is OFF (kill-switch)', async () => {
    mockAuthState.settings.messaging.enabled = false
    const wrapper = await mountView()
    await wrapper.vm.$nextTick()

    expect(wrapper.find('[data-testid="service-message-history"]').exists()).toBe(false)
  })

  it('HIDES the history card for a non-editor even when messaging is ON', async () => {
    mockAuthState.settings.messaging.enabled = true
    mockAuthState.isEditor = false
    const wrapper = await mountView()
    await wrapper.vm.$nextTick()

    expect(wrapper.find('[data-testid="service-message-history"]').exists()).toBe(false)
  })
})

// ── 63-01 (R150): the delivery history stays visible on a LOCKED service ───────
//
// The R150 defect: the history's gate used canEditService (= isEditor &&
// !isLocked), so it vanished the moment the service left draft. The gate is now
// isMessagingEnabled() && authStore.isEditor — no lock term — so a locked
// (status !== 'draft') service still renders the read-only history for an org
// editor. The messaging-defaults panel's OWN canEditService branch is
// intentionally UNCHANGED (locked-read-only summary, no editable selects). A
// viewer / messaging-off org still hides the history on a locked service.
describe('ServiceEditorView - Messages tab R150 locked-service regression (63-01)', () => {
  async function mountView(overrides: Partial<Service> = {}) {
    mockServicesList = [{ ...mockService, status: 'draft', ...overrides }]
    const { default: ServiceEditorView } = await import('@/views/ServiceEditorView.vue')
    return shallowMount(ServiceEditorView, {
      global: {
        stubs: {
          AppShell: { template: '<div><slot /></div>' },
          ContextualActionBar: false,
          RouterLink: { template: '<a><slot /></a>' },
          SaveStatusIndicator: false,
          ServicePrintLayout: true,
          SongBadge: true,
          SongSlotPicker: true,
          ScriptureInput: true,
          PresentationViewer: true,
        },
      },
    })
  }

  beforeEach(() => {
    mockAuthState.isEditor = true
    mockAuthState.orgId = 'org-1'
    mockAuthState.settings.messaging = {
      enabled: false,
      lockNotifyDefault: false,
      reminderEnabled: false,
      reminderDaysBefore: 3,
    }
    mockSubscribeServiceMessages.mockClear()
  })

  it('R150: on a LOCKED service the history STILL renders for an editor with messaging ON', async () => {
    // Regression guard: canEditService is gone from the history's gate. It was
    // false on a locked service and used to collapse the read-only history.
    mockAuthState.settings.messaging.enabled = true
    const wrapper = await mountView({ status: 'planned' })
    await wrapper.vm.$nextTick()

    const messagesBtn = wrapper.findAll('button').find((b) => b.text() === 'Messages' && b.classes().includes('rounded-t-md'))
    await messagesBtn!.trigger('click')

    expect(wrapper.find('[data-testid="service-message-history"]').exists()).toBe(true)
  })

  it('locked service: the defaults panel shows its locked-read-only summary and no editable selects (unchanged 58-05/62)', async () => {
    // The defaults panel's OWN canEditService branch is intentionally untouched
    // — only the history's gate dropped canEditService.
    mockAuthState.settings.messaging.enabled = true
    const wrapper = await mountView({ status: 'planned' })
    await wrapper.vm.$nextTick()

    const messagesBtn = wrapper.findAll('button').find((b) => b.text() === 'Messages' && b.classes().includes('rounded-t-md'))
    await messagesBtn!.trigger('click')

    expect(wrapper.find('[data-testid="messaging-defaults-readonly"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="messaging-lock-notify-select"]').exists()).toBe(false)
  })

  it('locked service: a viewer (non-editor) still hides the history', async () => {
    mockAuthState.settings.messaging.enabled = true
    mockAuthState.isEditor = false
    const wrapper = await mountView({ status: 'planned' })
    await wrapper.vm.$nextTick()

    expect(wrapper.find('[data-testid="service-message-history"]').exists()).toBe(false)
  })

  it('locked service: messaging OFF still hides the history', async () => {
    mockAuthState.settings.messaging.enabled = false
    const wrapper = await mountView({ status: 'planned' })
    await wrapper.vm.$nextTick()

    expect(wrapper.find('[data-testid="service-message-history"]').exists()).toBe(false)
  })
})

describe('ServiceEditorView - ARIA tab semantics (R239)', () => {
  async function mountView() {
    const { default: ServiceEditorView } = await import('@/views/ServiceEditorView.vue')
    return shallowMount(ServiceEditorView, {
      global: {
        stubs: {
          AppShell: { template: '<div><slot /></div>' },
          ContextualActionBar: false,
          RouterLink: { template: '<a><slot /></a>' },
          SaveStatusIndicator: false,
          ServicePrintLayout: true,
          SongBadge: true,
          SongSlotPicker: true,
          ScriptureInput: true,
          PresentationViewer: true,
        },
      },
    })
  }

  beforeEach(() => {
    // Editor with messaging ON so all four tab buttons (Service Order,
    // Slides, Roles, Messages) render — the widest surface for this suite.
    mockAuthState.isEditor = true
    mockAuthState.orgId = 'org-1'
    mockAuthState.settings.messaging = {
      enabled: true,
      lockNotifyDefault: false,
      reminderEnabled: false,
      reminderDaysBefore: 3,
    }
  })

  it('exposes role=tablist on the container, role=tab on the always-present buttons, and aria-selected reflecting the default active tab', async () => {
    const wrapper = await mountView()
    await wrapper.vm.$nextTick()

    const tablist = wrapper.find('[role="tablist"]')
    expect(tablist.exists()).toBe(true)

    const serviceOrderTab = wrapper.get('#svc-tab-service-order')
    const slidesTab = wrapper.get('#svc-tab-slides')
    expect(serviceOrderTab.attributes('role')).toBe('tab')
    expect(slidesTab.attributes('role')).toBe('tab')

    // Service Order is the default active tab.
    expect(serviceOrderTab.attributes('aria-selected')).toBe('true')
    expect(slidesTab.attributes('aria-selected')).toBe('false')

    // aria-controls on each button matches a role=tabpanel element's id.
    const serviceOrderPanelId = serviceOrderTab.attributes('aria-controls')!
    const slidesPanelId = slidesTab.attributes('aria-controls')!
    const serviceOrderPanel = wrapper.get(`#${serviceOrderPanelId}`)
    const slidesPanel = wrapper.get(`#${slidesPanelId}`)
    expect(serviceOrderPanel.attributes('role')).toBe('tabpanel')
    expect(slidesPanel.attributes('role')).toBe('tabpanel')
    expect(serviceOrderPanel.attributes('aria-labelledby')).toBe('svc-tab-service-order')
    expect(slidesPanel.attributes('aria-labelledby')).toBe('svc-tab-slides')
  })

  it('exposes role=tab + aria-selected + aria-controls on the conditionally-rendered Roles and Messages buttons (editor + messaging on)', async () => {
    const wrapper = await mountView()
    await wrapper.vm.$nextTick()

    const rolesTab = wrapper.get('#svc-tab-roles')
    const messagesTab = wrapper.get('#svc-tab-messages')
    expect(rolesTab.attributes('role')).toBe('tab')
    expect(messagesTab.attributes('role')).toBe('tab')
    expect(rolesTab.attributes('aria-selected')).toBe('false')
    expect(messagesTab.attributes('aria-selected')).toBe('false')

    const rolesPanelId = rolesTab.attributes('aria-controls')!
    const messagesPanelId = messagesTab.attributes('aria-controls')!
    const rolesPanel = wrapper.get(`#${rolesPanelId}`)
    const messagesPanel = wrapper.get(`#${messagesPanelId}`)
    expect(rolesPanel.attributes('role')).toBe('tabpanel')
    expect(messagesPanel.attributes('role')).toBe('tabpanel')
    expect(rolesPanel.attributes('aria-labelledby')).toBe('svc-tab-roles')
    expect(messagesPanel.attributes('aria-labelledby')).toBe('svc-tab-messages')
  })

  it('updates aria-selected on the corresponding buttons after clicking the Slides tab (bound to the existing activeTab state)', async () => {
    const wrapper = await mountView()
    await wrapper.vm.$nextTick()

    const slidesBtn = wrapper.findAll('button').find((b) => b.text() === 'Slides')!
    await slidesBtn.trigger('click')

    expect(wrapper.get('#svc-tab-service-order').attributes('aria-selected')).toBe('false')
    expect(wrapper.get('#svc-tab-slides').attributes('aria-selected')).toBe('true')
  })

  it('does not render Roles/Messages tab roles for a non-editor viewer (v-if gates preserved)', async () => {
    mockAuthState.isEditor = false
    const wrapper = await mountView()
    await wrapper.vm.$nextTick()

    expect(wrapper.find('#svc-tab-roles').exists()).toBe(false)
    expect(wrapper.find('#svc-tab-messages').exists()).toBe(false)
    // The always-present tabs are unaffected.
    expect(wrapper.get('#svc-tab-service-order').attributes('role')).toBe('tab')
    expect(wrapper.get('#svc-tab-slides').attributes('role')).toBe('tab')
  })
})

describe('ServiceEditorView - tab strip keyboard navigation (WR-01, 81-REVIEW)', () => {
  async function mountView() {
    const { default: ServiceEditorView } = await import('@/views/ServiceEditorView.vue')
    return shallowMount(ServiceEditorView, {
      global: {
        stubs: {
          AppShell: { template: '<div><slot /></div>' },
          ContextualActionBar: false,
          RouterLink: { template: '<a><slot /></a>' },
          SaveStatusIndicator: false,
          ServicePrintLayout: true,
          SongBadge: true,
          SongSlotPicker: true,
          ScriptureInput: true,
          PresentationViewer: true,
        },
      },
    })
  }

  beforeEach(() => {
    // Editor with messaging ON so all four tab buttons (Service Order,
    // Slides, Roles, Messages) render — the widest surface for this suite.
    mockAuthState.isEditor = true
    mockAuthState.orgId = 'org-1'
    mockAuthState.settings.messaging = {
      enabled: true,
      lockNotifyDefault: false,
      reminderEnabled: false,
      reminderDaysBefore: 3,
    }
  })

  it('keeps the active tab at tabindex 0 and every other tab at tabindex -1 (roving tabindex)', async () => {
    const wrapper = await mountView()
    await wrapper.vm.$nextTick()

    expect(wrapper.get('#svc-tab-service-order').attributes('tabindex')).toBe('0')
    expect(wrapper.get('#svc-tab-slides').attributes('tabindex')).toBe('-1')
    expect(wrapper.get('#svc-tab-roles').attributes('tabindex')).toBe('-1')
    expect(wrapper.get('#svc-tab-messages').attributes('tabindex')).toBe('-1')
  })

  it('ArrowRight steps through Service Order -> Slides -> Roles -> Messages -> wraps to Service Order', async () => {
    const wrapper = await mountView()
    await wrapper.vm.$nextTick()

    const tablist = wrapper.get('[role="tablist"]')
    const order = ['svc-tab-slides', 'svc-tab-roles', 'svc-tab-messages', 'svc-tab-service-order']
    for (const nextId of order) {
      await tablist.trigger('keydown', { key: 'ArrowRight' })
      expect(wrapper.get(`#${nextId}`).attributes('aria-selected')).toBe('true')
    }
  })

  it('ArrowLeft from the first tab wraps to the last VISIBLE tab', async () => {
    const wrapper = await mountView()
    await wrapper.vm.$nextTick()

    await wrapper.get('[role="tablist"]').trigger('keydown', { key: 'ArrowLeft' })

    expect(wrapper.get('#svc-tab-messages').attributes('aria-selected')).toBe('true')
  })

  it('Home and End jump to the first and last visible tab respectively', async () => {
    const wrapper = await mountView()
    await wrapper.vm.$nextTick()

    await wrapper.get('[role="tablist"]').trigger('keydown', { key: 'End' })
    expect(wrapper.get('#svc-tab-messages').attributes('aria-selected')).toBe('true')

    await wrapper.get('[role="tablist"]').trigger('keydown', { key: 'Home' })
    expect(wrapper.get('#svc-tab-service-order').attributes('aria-selected')).toBe('true')
  })

  it('skips the hidden Roles/Messages tabs for a non-editor viewer (navigation order matches what is rendered)', async () => {
    mockAuthState.isEditor = false
    const wrapper = await mountView()
    await wrapper.vm.$nextTick()

    await wrapper.get('[role="tablist"]').trigger('keydown', { key: 'ArrowLeft' })

    // Only Service Order + Slides are visible for a non-editor, so
    // ArrowLeft from Service Order wraps straight to Slides.
    expect(wrapper.get('#svc-tab-slides').attributes('aria-selected')).toBe('true')
  })
})

// ── 95-06 (R261/R275): the Run entry button ─────────────────────────────────────
// Proves the presence/absence gating of the header Run CTA and — the load-bearing
// R275 assertion — that it is NOT editor-gated: a VIEWER of a locked service can
// still Run. canRunService = isLocked && !!orgId (deliberately NOT isEditor), so
// the button is absent on a draft and present on a locked service for BOTH an
// editor and a viewer. Clicking it router.push-es /run/:serviceId?org=.
describe('Run entry button (R261/R275)', () => {
  async function mountView(overrides: Partial<Service> = {}) {
    mockServicesList = [{ ...mockService, ...overrides }]
    const { default: ServiceEditorView } = await import('@/views/ServiceEditorView.vue')
    return shallowMount(ServiceEditorView, {
      global: {
        stubs: {
          AppShell: { template: '<div><slot /></div>' },
          ContextualActionBar: false,
          SaveStatusIndicator: false,
          ServicePrintLayout: true,
          SongBadge: true,
          SongSlotPicker: true,
          ScriptureInput: true,
        },
      },
    })
  }

  beforeEach(() => {
    // Self-contained state so this block never perturbs (nor is perturbed by)
    // siblings: default to an org-set editor and a fresh push spy.
    mockAuthState.isEditor = true
    mockAuthState.orgId = 'org-1'
    mockRouterPush.mockClear()
  })

  it('is ABSENT on a draft service (any role)', async () => {
    const wrapper = await mountView({ status: 'draft' })
    await flushPromises()
    expect(wrapper.find('[data-testid="run-service-btn"]').exists()).toBe(false)
  })

  it('is PRESENT on a LOCKED service for an EDITOR, with the run aria-label', async () => {
    mockAuthState.isEditor = true
    const wrapper = await mountView({ status: 'planned' })
    await flushPromises()
    const btn = wrapper.find('[data-testid="run-service-btn"]')
    expect(btn.exists()).toBe(true)
    expect(btn.attributes('aria-label')).toBe('Run this service live')
  })

  it('is PRESENT on a LOCKED service for a VIEWER — running is NOT editor-gated (R275)', async () => {
    // The load-bearing R275 proof: isEditor=false, orgId set → Run still renders.
    mockAuthState.isEditor = false
    mockAuthState.orgId = 'org-1'
    const wrapper = await mountView({ status: 'planned' })
    await flushPromises()
    expect(wrapper.find('[data-testid="run-service-btn"]').exists()).toBe(true)
  })

  it('is ABSENT on a locked service for an org-less user (no active org)', async () => {
    // canRunService also requires an active org — an org-less member sees no Run.
    mockAuthState.isEditor = false
    mockAuthState.orgId = null
    const wrapper = await mountView({ status: 'planned' })
    await flushPromises()
    expect(wrapper.find('[data-testid="run-service-btn"]').exists()).toBe(false)
  })

  it('navigates to /run/:serviceId?org= on click', async () => {
    const wrapper = await mountView({ status: 'exported' })
    await flushPromises()
    await wrapper.get('[data-testid="run-service-btn"]').trigger('click')
    expect(mockRouterPush).toHaveBeenCalledWith('/run/service-1?org=org-1')
  })
})
