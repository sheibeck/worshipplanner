# Testing Patterns

**Analysis Date:** 2026-07-15

## Test Framework

**Runner:**
- Vitest 4.0.18
- Config: `vite.config.ts` (test section defines jsdom environment)
- Environment: jsdom (DOM simulation for component testing)

**Assertion Library:**
- Vitest built-in expect() syntax
- No external assertion library

**Run Commands:**
```bash
npm run test:unit              # Run all tests
npm run test:rules             # Run Firestore security rules tests (firebase emulator)
```

**Watch Mode:**
- Implicit in Vitest; invoke `npx vitest` in project root (not configured in package.json scripts)

**Coverage:**
- No explicit coverage reporting configured
- No coverage thresholds enforced

## Test File Organization

**Location:**
- Co-located with source: `src/components/__tests__/`, `src/stores/__tests__/`, `src/utils/__tests__/`
- Firestore rules test: `src/rules.test.ts` (root of src, special case)

**Naming:**
- Match source file with `.test.ts` suffix: `ServiceCard.vue` → `ServiceCard.test.ts`, `claudeApi.ts` → `claudeApi.test.ts`
- All test files in `__tests__/` subdirectory

**Directory Structure:**
```
src/
├── components/
│   ├── ServiceCard.vue
│   ├── SongTable.vue
│   └── __tests__/
│       ├── ServiceCard.test.ts
│       ├── SongTable.test.ts
│       └── ... (20+ component tests)
├── stores/
│   ├── services.ts
│   ├── songs.ts
│   └── __tests__/
│       ├── services.test.ts
│       ├── songs.test.ts
│       └── ... (4 store tests)
├── utils/
│   ├── claudeApi.ts
│   ├── csvImport.ts
│   └── __tests__/
│       ├── claudeApi.test.ts
│       ├── csvImport.test.ts (not seen but pattern)
│       └── ... (6+ utility tests)
└── rules.test.ts (Firestore security rules, special)
```

## Test Structure

**Suite Organization:**
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

describe('ComponentOrFunctionName', () => {
  // Optional setup
  beforeEach(() => {
    vi.clearAllMocks()
    mockStore.reset()
  })

  // Grouped test suites
  describe('subsection', () => {
    it('does specific thing', () => {
      // Arrange
      const input = makeData()
      
      // Act
      const result = functionUnderTest(input)
      
      // Assert
      expect(result).toBe(expected)
    })

    it('handles edge case', () => {
      // ...
    })
  })

  describe('another subsection', () => {
    // ...
  })
})
```

**Patterns:**
- Setup: `vi.mock()` calls at top of file (before imports if needed)
- Hoisting: `vi.hoisted()` for shared mock state across mocks
- Globals: `vi.stubGlobal()` for browser APIs (IntersectionObserver, crypto, etc)
- Teardown: `vi.clearAllMocks()` in beforeEach to reset mock call counts
- No afterEach observed in codebase

## Mocking

**Framework:** Vitest `vi` API

**Module Mocking:**
```typescript
// Pattern 1: Mock entire module
vi.mock('firebase/firestore', () => ({
  getFirestore: vi.fn(() => ({})),
  collection: vi.fn((db, ...segments) => ({ path: segments.join('/') })),
  onSnapshot: vi.fn((_query, callback) => {
    snapshotCallback = callback
    return mockUnsubscribe
  }),
  // ... other exports
}))

// Pattern 2: Mock with hoisted shared state
const { mockCreate } = vi.hoisted(() => {
  const mockCreate = vi.fn()
  return { mockCreate }
})

vi.mock('@anthropic-ai/sdk', () => {
  function MockAnthropic() {
    return {
      messages: {
        create: mockCreate,
      },
    }
  }
  return { default: MockAnthropic }
})

// Pattern 3: Mock store modules
const mockSongStore = {
  get columnVisibility() { return mockColumnVisibility },
  allUserTags: [] as string[],
  searchQuery: '',
  updateSong: vi.fn(() => Promise.resolve()),
  toggleColumn: vi.fn(),
  resetColumns: vi.fn(),
}

vi.mock('@/stores/songs', () => ({
  useSongStore: () => mockSongStore,
}))
```

**Function Mocks:**
```typescript
// Create vi.fn() with mock behavior
const mockUnsubscribe = vi.fn()
const mockUpdateSong = vi.fn(() => Promise.resolve())

// Access mock calls for assertions
expect(mockUnsubscribe).toHaveBeenCalledOnce()
const callArgs = vi.mocked(addDoc).mock.calls[0]!
```

**Global Stubs:**
```typescript
// Stub browser APIs that jsdom doesn't implement
class MockIntersectionObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
vi.stubGlobal('IntersectionObserver', MockIntersectionObserver)

// Stub crypto for deterministic testing
vi.stubGlobal('crypto', {
  getRandomValues: vi.fn((arr: Uint8Array) => {
    for (let i = 0; i < arr.length; i++) arr[i] = i + 1
    return arr
  }),
})
```

**Component Stubs:**
```typescript
// Stub router-link in component tests
const globalStubs = {
  'router-link': {
    template: '<a :href="to"><slot /></a>',
    props: ['to'],
  },
}

const wrapper = mount(ServiceCard, {
  props: { service: mockService },
  global: { stubs: globalStubs },
})
```

**What to Mock:**
- All external dependencies: Firebase, HTTP APIs, third-party SDKs
- Browser APIs not implemented in jsdom: IntersectionObserver
- Crypto/random for deterministic results
- Router if component uses useRouter()
- Store modules (even in integration tests, to avoid full Pinia setup)

**What NOT to Mock:**
- Pure utilities and helpers (test them directly)
- Types and interfaces (not mocked)
- Real data structures that define the schema (e.g., BIBLE_BOOKS)
- Path aliases (tsconfig resolution works in tests)

## Fixtures and Factories

**Test Data:**
```typescript
// Factory pattern for building consistent test objects
function makeSong(overrides: Partial<Song> = {}): Song {
  return {
    id: 'song-1',
    title: 'Amazing Grace',
    ccliNumber: '12345',
    author: 'John Newton',
    themes: ['Grace', 'Redemption'],
    notes: '',
    vwTypes: [1],
    arrangements: [],
    primaryArrangementId: null,
    lastUsedAt: null,
    createdAt: {} as never,
    updatedAt: {} as never,
    pcSongId: null,
    hidden: false,
    tags: ['Christmas'],
    removedThemes: [],
    ...overrides,  // Override defaults with test-specific values
  }
}

// Specific factories per type
function makePcSong(overrides: { id?: string; title?: string; ... } = {}) {
  return {
    id: overrides.id ?? 'pc-song-1',
    attributes: {
      title: overrides.title ?? 'Amazing Grace',
      // ... other fields
    },
    // ...
  }
}

function makeService(overrides: Partial<{...}> = {}) {
  return {
    id: 'service-1',
    date: '2026-03-08',
    name: 'Sunday Service',
    // ... defaults
    ...overrides,
  }
}
```

**Location:**
- Defined within test file, near top before describe() blocks
- Exported only if shared across multiple test files (not observed in this codebase)
- Factories take override param to allow test-specific mutations

## Coverage

**Requirements:** None enforced

**View Coverage:**
- Coverage commands not configured in package.json
- Run manually with: `npx vitest --coverage` (requires coverage plugin)

## Test Types

**Unit Tests:**
- Scope: Individual functions, utilities, store actions
- Approach: Test pure logic, mock external dependencies
- Examples: `src/utils/__tests__/claudeApi.test.ts` (parsing/validation), `src/stores/__tests__/services.test.ts` (store actions)

**Component Tests:**
- Scope: Vue components in isolation
- Approach: Use `@vue/test-utils` mount() for DOM assertions
- Examples: `src/components/__tests__/ServiceCard.test.ts`, `src/components/__tests__/SongTable.test.ts`
- Mocking: Router, stores, browser APIs

**Integration Tests:**
- Scope: Cross-store interactions, complex workflows
- Approach: Test full store workflow with mocked Firebase
- Examples: `src/stores/__tests__/services.test.ts` (createService → assignSongToSlot → useSongStore.updateSong)

**E2E Tests:**
- Framework: Not used
- Firestore Rules Tests: `src/rules.test.ts` (uses firebase emulator via `npm run test:rules`)

## Common Patterns

**Async Testing:**
```typescript
// Pattern 1: await promise-returning functions
it('createService returns the new document id', async () => {
  const { useServiceStore } = await import('../services')
  const store = useServiceStore()
  store.subscribe('org-1')

  const id = await store.createService({
    date: '2026-03-08',
    name: '',
    teams: [],
  })

  expect(id).toBe('new-service-id')
})

// Pattern 2: trigger async callbacks manually
function triggerSnapshot(services: ReturnType<typeof makeService>[]) {
  if (snapshotCallback) {
    snapshotCallback({
      docs: services.map((s) => ({
        id: s.id,
        data: () => {
          const { id: _id, ...rest } = s
          return rest
        },
      })),
    })
  }
}

it('populates services from snapshot', async () => {
  const store = useServiceStore()
  store.subscribe('org-1')
  const service = makeService()
  triggerSnapshot([service])  // Manually invoke the callback
  expect(store.services).toHaveLength(1)
})
```

**Error Testing:**
```typescript
// Pattern: expect thrown errors
it('throws when orgId not set', () => {
  const store = useServiceStore()
  expect(() => store.createService({...})).toThrow('No orgId set')
})

// Pattern: expect null returns on error
it('returns null on parse error', () => {
  const result = safeParseJsonArray('no json here')
  expect(result).toBeNull()
})

// Pattern: expect mock error handling
it('logs error and returns null on API failure', async () => {
  mockCreate.mockRejectedValueOnce(new Error('API error'))
  const result = await getSongSuggestions({...})
  expect(result).toBeNull()
  expect(console.error).toHaveBeenCalledWith(
    expect.stringContaining('[claudeApi]'),
    expect.any(Error),
  )
})
```

**State Mutations:**
```typescript
// Pattern: test reactive state changes
it('sets isLoading to false after first snapshot', async () => {
  const store = useServiceStore()
  store.subscribe('org-1')
  triggerSnapshot([])
  expect(store.isLoading).toBe(false)
})

// Pattern: test unsubscription resets state
it('unsubscribeAll calls the unsubscribe fn and resets state', async () => {
  const store = useServiceStore()
  store.subscribe('org-1')
  triggerSnapshot([makeService()])
  store.unsubscribeAll()
  expect(mockUnsubscribe).toHaveBeenCalled()
  expect(store.services).toEqual([])
  expect(store.isLoading).toBe(true)
})
```

**Component DOM Testing:**
```typescript
// Pattern: mount component and query DOM
it('renders formatted date with month and day', () => {
  const wrapper = mount(ServiceCard, {
    props: { service: mockService },
    global: { stubs: globalStubs },
  })
  expect(wrapper.text()).toContain('Mar')
  expect(wrapper.text()).toContain('8')
})

// Pattern: user interactions
it('sets search query when pill is clicked', async () => {
  const wrapper = mountTable([makeSong({ tags: ['Christmas'] })])
  const tagPill = wrapper
    .findAll('span')
    .find((s) => s.text() === 'Christmas')
  await tagPill!.trigger('click')
  expect(mockSongStore.searchQuery).toBe('tag:Christmas')
})

// Pattern: CSS class assertions
it('uses flex-col layout with pinned footer', () => {
  const wrapper = mount(ServiceCard, {...})
  const root = wrapper.element as HTMLElement
  expect(root.className).toContain('flex')
  expect(root.className).toContain('flex-col')
})
```

---

*Testing analysis: 2026-07-15*
