# Testing Patterns

**Analysis Date:** 2026-07-16

## Test Framework

**Runner:**
- Vitest v4.0.18
- Config: `vite.config.ts` (inline test config)
- Separate rules config: `vitest.rules.config.ts` (node environment for Firebase Security Rules)

**Assertion Library:**
- Vitest built-in (no external assertion library)
- Pattern: `expect(actual).toBe(expected)`, `expect(array).toEqual([...])`

**Run Commands:**
```bash
npm run test:unit              # Run all tests in jsdom environment
npm run test:rules             # Run Firebase Security Rules tests (node + emulator)
```

**Environment:**
- `jsdom` for UI tests (Vue components, browser APIs)
- `node` for security rules tests (firebase-rules-unit-testing)
- Configuration in `tsconfig.vitest.json`: separates jsdom types from app types

## Test File Organization

**Location:**
- Co-located in `__tests__` directories parallel to source
- Pattern: `src/[category]/__tests__/[FileName].test.ts`
- Examples:
  - `src/utils/quarterDates.ts` → `src/utils/__tests__/quarterDates.test.ts`
  - `src/stores/songs.ts` → `src/stores/__tests__/songs.test.ts`
  - `src/components/SongBadge.vue` → `src/components/__tests__/SongBadge.test.ts`

**Naming:**
- `.test.ts` suffix for all test files
- No `.spec.ts` files in this codebase

**Directory Structure:**
```
src/
├── components/
│   ├── ServiceCard.vue
│   ├── SongBadge.vue
│   └── __tests__/
│       ├── ServiceCard.test.ts
│       └── SongBadge.test.ts
├── utils/
│   ├── quarterDates.ts
│   └── __tests__/
│       └── quarterDates.test.ts
└── stores/
    ├── songs.ts
    └── __tests__/
        └── songs.test.ts
```

## Test Structure

**Suite Organization:**
```typescript
import { describe, it, expect } from 'vitest'

describe('functionName', () => {
  describe('when behavior context', () => {
    it('should do what is expected', () => {
      expect(actual).toBe(expected)
    })
  })
})
```

**Patterns:**
- Top-level `describe()` wraps the unit (function, component, store)
- Nested `describe()` for feature areas or context
- Each `it()` tests one specific behavior
- Descriptive test names explain the expected outcome

**Example from `quarterDates.test.ts`:**
```typescript
describe('generateSundaysInQuarter', () => {
  it('returns every Sunday from 2026-07-01 through 2026-09-30 for Q3 2026, ascending', () => {
    const result = generateSundaysInQuarter(2026, 3)
    expect(result).toEqual([
      '2026-07-05',
      '2026-07-12',
      // ... rest of expected array
    ])
  })
})
```

**Setup & Teardown:**
- `beforeEach()` for test setup (initializing Pinia, resetting mocks)
- No `afterEach()` cleanup needed in most tests; mocks are reset automatically
- Pinia setup: `setActivePinia(createPinia())` in beforeEach

**Example from `songs.test.ts`:**
```typescript
import { setActivePinia, createPinia } from 'pinia'

// Mock modules at top level
vi.mock('firebase/firestore', () => ({ /* ... */ }))
vi.mock('@/stores/auth', () => ({ /* ... */ }))

describe('useSongsStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })
  
  it('loads songs on init', () => {
    // test body
  })
})
```

## Mocking

**Framework:** Vitest `vi` utilities

**Patterns:**

### Module Mocking
```typescript
vi.mock('firebase/firestore', () => ({
  getFirestore: vi.fn(() => ({})),
  doc: vi.fn((db, ...segments) => ({ path: segments.join('/') })),
  collection: vi.fn((db, ...segments) => ({ path: segments.join('/') })),
  onSnapshot: vi.fn((_query, callback) => {
    snapshotCallback = callback
    return mockUnsubscribe
  }),
}))
```

**What to Mock:**
- External APIs (Firebase, Anthropic, Planning Center)
- Async dependencies with side effects
- Modules that require setup (auth, database)
- Keep mocks minimal; only mock what's actually tested

**What NOT to Mock:**
- Constants (BIBLE_BOOKS, VW_TYPE_LABELS) — use real values
- Pure utility functions — call them directly
- Simple data builders — implement them in tests
- The unit under test itself

**Accessing Mocked Functions:**
```typescript
import { vi, vi.mocked } from 'vitest'
import { fetchSongArrangements } from '@/utils/planningCenterApi'

// Later in test
vi.mocked(fetchSongArrangements).mockResolvedValue(someData)
expect(vi.mocked(fetchSongArrangements)).toHaveBeenCalledWith(...)
```

**Mock Reset:**
- Vitest clears mocks between tests automatically
- Manual reset if needed: `vi.clearAllMocks()` in beforeEach

### Callback/Subscription Mocking
```typescript
// Store callback reference for manual triggering
let snapshotCallback: ((snap: object) => void) | null = null

vi.mock('firebase/firestore', () => ({
  onSnapshot: vi.fn((_query, callback) => {
    snapshotCallback = callback
    return mockUnsubscribe
  }),
}))

// In test: trigger callback manually
it('loads data on snapshot', () => {
  const wrapper = mount(Component)
  snapshotCallback?.({ docs: [{ id: 'doc-1', data: () => ({ /* ... */ }) }] })
  expect(wrapper.text()).toContain('doc-1')
})
```

## Fixtures and Factories

**Test Data Builders:**
```typescript
function makePcSong(overrides: {
  id?: string
  title?: string
  ccli_number?: string | null
} = {}) {
  return {
    id: overrides.id ?? 'pc-song-1',
    attributes: {
      title: overrides.title ?? 'Amazing Grace',
      ccli_number: 'ccli_number' in overrides ? overrides.ccli_number ?? null : '12345',
      // ... rest of song object
    },
  }
}

// Usage
const song = makePcSong({ title: 'Custom Song' })
const songNoId = makePcSong({ ccli_number: null })
```

**Location:**
- Defined at top of test file, after imports and mocks
- Marked with JSDoc comment if non-obvious
- Can accept partial overrides object for flexibility

**Pattern:**
- Set sensible defaults for common properties
- Accept overrides object for test-specific values
- Return fully-formed object matching the real shape

## Vue Component Testing

**Mount & Assertions:**
```typescript
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'

it('renders component text', () => {
  const wrapper = mount(SongBadge, { props: { types: [1] } })
  expect(wrapper.text()).toContain('Type 1')
})

it('emits event on click', async () => {
  const wrapper = mount(SongBadge, { props: { types: [1], clickable: true } })
  await wrapper.find('span').trigger('click')
  expect(wrapper.emitted('select')).toHaveLength(1)
  expect(wrapper.emitted('select')[0]).toEqual([1])
})

it('updates on prop change', async () => {
  const wrapper = mount(SongBadge, { props: { types: [1] } })
  await wrapper.setProps({ types: [2] })
  await nextTick()
  expect(wrapper.text()).toContain('Type 2')
})
```

**Patterns:**
- Pass props via `{ props: { ... } }` mount option
- Use `wrapper.find()` for single elements, `wrapper.findAll()` for multiple
- Call `await nextTick()` after state/prop changes to ensure DOM updates
- Check emits via `wrapper.emitted('eventName')`
- Use `flushPromises()` from @vue/test-utils for async operations

**Store Access in Components:**
- Stores are instantiated normally via `useAuthStore()`
- Wrap in `setActivePinia(createPinia())` beforeEach if needed
- Mock store methods if testing component in isolation

## Pinia Store Testing

**Setup:**
```typescript
import { setActivePinia, createPinia } from 'pinia'

beforeEach(() => {
  setActivePinia(createPinia())
})

it('initializes state correctly', () => {
  const store = useAuthStore()
  expect(store.user).toBeNull()
  expect(store.isAuthenticated).toBe(false)
})
```

**Testing Actions:**
```typescript
it('updates state on sign in', async () => {
  vi.mocked(signInWithPopup).mockResolvedValue(mockUser)
  const store = useAuthStore()
  
  await store.signIn()
  
  expect(store.user).toEqual(mockUser)
  expect(store.isAuthenticated).toBe(true)
})
```

**Testing Computed:**
```typescript
it('computes editor role', () => {
  setActivePinia(createPinia())
  const store = useAuthStore()
  
  expect(store.isEditor).toBe(false)
  
  store.userRole = 'editor'
  expect(store.isEditor).toBe(true)
})
```

## Coverage

**Requirements:** No enforced coverage threshold

**View Coverage:**
```bash
npm run test:unit -- --coverage
```

**Coverage is informational; aim for:**
- Core business logic: 90%+
- UI/presentational components: 60%+
- Error paths and edge cases: covered where possible

## Test Types

**Unit Tests:**
- Scope: Single function, component, or store action
- Approach: Test inputs and outputs, mock dependencies
- Location: Same `__tests__` directory as source
- Examples: `quarterDates.test.ts`, `slug.test.ts`, `songSearch.test.ts`

**Integration Tests:**
- Scope: Multiple modules working together
- Approach: Mock APIs, test data flow between store + component
- Location: Same `__tests__` directories
- Examples: `songs.test.ts` (mocks Firebase, tests store with auth)

**Component Integration Tests:**
- Scope: Component + its store usage
- Approach: Mount component, set Pinia, mock API calls
- Location: `components/__tests__/[Component].test.ts`
- Examples: `ServiceCard.test.ts`, `ScriptureInput.test.ts`

**Security Rules Tests:**
- Scope: Firebase Security Rules
- Approach: `@firebase/rules-unit-testing` with Firestore emulator
- Location: `src/rules.test.ts` (separate config)
- Command: `npm run test:rules`
- Environment: Node.js (not jsdom)

## Common Patterns

### Async Testing
```typescript
it('loads songs asynchronously', async () => {
  const store = useSongsStore()
  
  // API is mocked to resolve with data
  vi.mocked(onSnapshot).mockImplementation((_query, callback) => {
    callback({ docs: [{ id: 'song-1', data: () => ({...}) }] })
    return () => {}
  })
  
  await store.loadSongs()
  expect(store.songs).toHaveLength(1)
})
```

### Error Testing
```typescript
it('handles fetch error gracefully', async () => {
  vi.mocked(getSongSuggestions).mockResolvedValue(null)
  
  const result = await getSongSuggestions(params)
  
  expect(result).toBeNull()
})
```

### Promise Handling
```typescript
import { flushPromises } from '@vue/test-utils'

it('waits for async operation', async () => {
  vi.mocked(fetchData).mockResolvedValue({ data: 'value' })
  
  const promise = someAsyncFunction()
  await flushPromises()
  
  expect(state.data).toBe('value')
})
```

### Iterating Over Test Cases
```typescript
const testCases = [
  { input: [1, 2, 3], expected: 6 },
  { input: [], expected: 0 },
  { input: [10], expected: 10 },
]

testCases.forEach(({ input, expected }) => {
  it(`sums ${input} to ${expected}`, () => {
    expect(sum(input)).toBe(expected)
  })
})
```

## Snapshot Testing

**Not used in this codebase.** All tests use explicit assertions via `expect()`.

## Test Commands

```bash
npm run test:unit              # Run all tests in watch mode (default)
npm run test:unit -- --run     # Single run (CI mode)
npm run test:unit -- --ui      # Vitest UI dashboard
npm run test:unit -- --coverage # Show coverage report
npm run test:rules             # Firebase Security Rules tests
```

---

*Testing analysis: 2026-07-16*
