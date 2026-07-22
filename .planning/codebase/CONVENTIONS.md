# Coding Conventions

**Analysis Date:** 2026-07-16

## Naming Patterns

**Files:**
- Components: PascalCase `.vue` files (e.g., `SongBadge.vue`, `ServiceCard.vue`)
- Utilities: camelCase `.ts` files (e.g., `quarterDates.ts`, `claudeApi.ts`)
- Stores: camelCase `.ts` files without prefix (e.g., `auth.ts`, `songs.ts`)
- Types: camelCase `.ts` files (e.g., `song.ts`, `service.ts`)
- Tests: `.test.ts` suffix in `__tests__` directories parallel to source

**Functions:**
- camelCase for all exported and private functions
- Descriptive names matching their primary purpose: `generateSundaysInQuarter()`, `mapPcSongToUpsert()`, `validateSongSuggestions()`

**Variables & Constants:**
- camelCase for local variables and ref/computed: `isSharing`, `songLibrary`, `openingSlots`
- SCREAMING_SNAKE_CASE for module-level constants: `BIBLE_BOOKS`, `SONG_SYSTEM_PROMPT`, `VW_TYPE_LABELS`
- Ref types annotated explicitly: `const user = ref<User | null>(null)`
- Constants marked `readonly` where appropriate: `export const BIBLE_BOOKS: readonly string[]`

**Types & Interfaces:**
- PascalCase for all types, interfaces, and type aliases: `Song`, `Service`, `VWType`, `AiSongSuggestion`
- Use `type` for union types or Omit/Pick: `type VWType = 1 | 2 | 3`
- Use `interface` for object shapes: `interface Song { ... }`
- Suffix input types with `Input`: `UpsertSongInput`, `GetSongSuggestionsParams`

**Stores:**
- Store names: `use{Name}Store()` following Pinia convention: `useAuthStore()`, `useSongStore()`
- State properties: camelCase refs and computed values

## Code Style

**Formatting:**
- Tool: Prettier v3.8.1
- Applied via `npm run format` on src/ directory
- ESLint config disables formatting rules to avoid conflicts

**Linting:**
- Tool: ESLint v10.0.2 with flat config (`eslint.config.ts`)
- Plugins: `@vue/eslint-config-typescript`, `eslint-plugin-vue`, `@vitest/eslint-plugin`, `eslint-plugin-oxlint`
- Oxlint v1.50.0 provides fast linting for TypeScript
- Run: `npm run lint` (oxlint + eslint with --fix)
- Caching: ESLint cache enabled (`--cache` flag)

**TypeScript:**
- Strict settings: `noUncheckedIndexedAccess: true` for safety
- Vue tsconfig extends `@vue/tsconfig/tsconfig.dom.json`
- Test tsconfig (`tsconfig.vitest.json`) separates jsdom types from app types
- Path aliases: `@/*` maps to `./src/*` — use this in all imports

## Import Organization

**Order:**
1. Vue imports (`import { ref, computed } from 'vue'`)
2. External package imports (`import router from 'vue-router'`, `import Anthropic from '@anthropic-ai/sdk'`)
3. Firebase imports (`import { doc, setDoc } from 'firebase/firestore'`)
4. Local imports from `@/*` (types, stores, components, utils)

**Examples:**
```typescript
import { ref, computed, watch } from 'vue'
import { defineStore } from 'pinia'
import { doc, setDoc } from 'firebase/firestore'
import { auth, db } from '@/firebase'
import type { Service } from '@/types/service'
import { useAuthStore } from '@/stores/auth'
```

**Path Aliases:**
- Always use `@/` prefix for local imports, never relative paths
- `@/types/song` — type definitions
- `@/stores/auth` — Pinia stores
- `@/utils/quarterDates` — utility functions
- `@/components/ServiceCard` — Vue components
- `@/firebase` — Firebase config module

## Error Handling

**Pattern:**
```typescript
try {
  const result = await someAsyncOperation()
  return result
} catch (err) {
  console.error('[moduleName] functionName failed:', err)
  return null
}
```

**Conventions:**
- Log errors with `console.error()` including module name in brackets: `[claudeApi]`, `[planningCenterApi]`
- Return `null` on error for optional results
- Return empty array `[]` for collection operations
- Don't throw from service/utility functions; let callers handle null
- Wrap API calls and async operations; pure functions don't need try/catch

**Defensive Validation:**
- Filter/validate data from external sources (APIs, user input, mocked data)
- Example: `validateSongSuggestions()` removes hallucinated song IDs
- Example: `validateScriptureSuggestions()` ensures books are in Protestant canon

## Logging

**Framework:** `console` (no external logging library)

**Patterns:**
- Error logging: `console.error('[moduleName] operation:', error)`
- No debug logging in production code (keep logs for real errors only)
- Include module name in brackets for traceable logs

## Comments

**When to Comment:**
- JSDoc on all exported functions and types
- Inline comments explaining "why", not "what" (code shows what it does)
- Comments on side effects or non-obvious design decisions
- Design document references (D-01, R-02, C-01 pattern)

**JSDoc/TSDoc:**
```typescript
/**
 * Returns every Sunday in the given quarter as zero-padded YYYY-MM-DD strings, ascending.
 * Q1 = Jan-Mar, Q2 = Apr-Jun, Q3 = Jul-Sep, Q4 = Oct-Dec.
 */
export function generateSundaysInQuarter(year: number, quarter: 1 | 2 | 3 | 4): string[]
```

**Section Dividers:**
- Use ASCII art dividers for major sections in larger files
- Pattern: `// ─── Section Name ───────────────────────────────────────────────────────────`
- See `src/utils/claudeApi.ts` for examples

**Design References:**
- Comments reference internal design docs: `(D-01)`, `(R-02)`, `(CR-01)`
- Used for explaining non-obvious choices or trade-offs

## Function Design

**Size:** 
- Keep functions under 40 lines where possible
- Extract complex logic into separate named functions
- Use pure functions for data transformation

**Parameters:**
- Use object parameters for functions with 2+ parameters
- Example: `function applyDateAdditionsRemovals(dates: string[], changes: { add?: string[]; remove?: string[] })`
- Destructure immediately in function body when helpful

**Return Values:**
- Return descriptive types (objects over booleans when multiple values)
- Return `null` on error for optional results
- Return types explicitly annotated on exported functions

## Module Design

**Exports:**
- Export only public APIs from utils
- Keep internal helpers private (no export)
- Export types alongside implementations

**Barrel Files:**
- Not used; import directly from source files
- Example: `import { generateSundaysInQuarter } from '@/utils/quarterDates'` (not from `@/utils/index.ts`)

**Organization:**
- Each utility file handles one domain/feature
- Store files use Pinia composition API pattern
- Component files follow Vue SFC structure

## Vue Component Patterns

**Script Setup:**
- Use `<script setup lang="ts">` in all Vue components
- Declare props with `defineProps<T>()` and TypeScript interface
- Declare emits with `defineEmits<{ eventName: [args] }>()`
- Use `withDefaults()` for prop defaults

**Example:**
```vue
<script setup lang="ts">
import type { Song } from '@/types/song'

const props = withDefaults(
  defineProps<{
    songs: Song[]
    clickable?: boolean
  }>(),
  { clickable: false },
)

defineEmits<{
  select: [song: Song]
}>()
</script>
```

**Styling:**
- Tailwind CSS utility classes only (no scoped CSS)
- Static class maps to prevent dynamic class purging
- Example from `SongBadge.vue`:
  ```typescript
  const badgeClasses = {
    1: 'bg-blue-900/50 text-blue-300 border-blue-800',
    2: 'bg-purple-900/50 text-purple-300 border-purple-800',
    3: 'bg-amber-900/50 text-amber-300 border-amber-800',
  } as const
  ```

## Pinia Store Patterns

**Composition API Style:**
```typescript
export const useAuthStore = defineStore('auth', () => {
  // State refs
  const user = ref<User | null>(null)
  const isReady = ref(false)
  
  // Computed
  const isAuthenticated = computed(() => user.value !== null)
  
  // Actions (functions)
  async function signIn() { ... }
  
  return { user, isReady, isAuthenticated, signIn }
})
```

**Patterns:**
- Refs for mutable state: `const state = ref<Type>(initial)`
- Computed for derived state: `const isDerived = computed(() => ...)`
- Functions for actions, no special action prefix
- Always type-annotate refs and computed values
- Return all public state/actions at end of function

---

*Convention analysis: 2026-07-16*
