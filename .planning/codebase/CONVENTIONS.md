# Coding Conventions

**Analysis Date:** 2026-07-15

## Naming Patterns

**Files:**
- Vue components: PascalCase (`ServiceCard.vue`, `SongTable.vue`, `AvailabilityDrawer.vue`)
- TypeScript utilities/stores: camelCase (`claudeApi.ts`, `csvImport.ts`, `scheduler.ts`)
- Test files: match source name with `.test.ts` suffix (`services.test.ts`, `claudeApi.test.ts`)
- Configuration files: camelCase or dotfiles (`.oxlintrc.json`, `vite.config.ts`, `eslint.config.ts`)

**Functions:**
- Event handlers: camelCase, verb-first (`handleClick`, `toggleSort`, `toggleSelectAll`)
- Exported functions: camelCase (`getSongSuggestions`, `mapRowToSong`, `fetchPassageText`)
- Helper functions: camelCase, descriptive (`parseArrangementTags`, `safeParseJsonArray`, `validateSongSuggestions`)
- Computed properties: camelCase (`filteredSongs`, `allUserTags`, `isLoading`)

**Variables:**
- Constants (module-level): UPPERCASE or camelCase (`DEFAULT_COLUMN_VISIBILITY`, `SONG_SYSTEM_PROMPT`)
- Local variables: camelCase (`mockService`, `tagFilterInclude`, `unsubscribeFn`)
- Store properties: camelCase (`services`, `searchQuery`, `columnVisibility`)
- Reactive refs: camelCase with `ref` suffix when needed for clarity (`services`, `isLoading`)

**Types:**
- Interfaces: PascalCase (`Service`, `Song`, `ParsedSongPreview`, `GetSongSuggestionsParams`)
- Type aliases: PascalCase (`VWType`, `CreateServiceInput`, `SongInput`)
- Generic parameters: PascalCase (T, K in generics)
- Store hooks: `use<StoreName>` pattern (`useServiceStore`, `useSongStore`, `useAuthStore`)

## Code Style

**Formatting:**
- Tool: Prettier 3.8.1 (no custom config detected; uses default settings)
- Run with: `npm run format` (formats `src/` directory)
- Default Prettier behavior: 80-char line wrap, 2-space indent, single quotes where possible, trailing commas

**Linting:**
- Tools: ESLint 10.0.2 with oxlint plugin (~1.50.0)
- Vue plugin: `@vue/eslint-config-typescript` (14.7.0) with `eslint-plugin-vue` (10.8.0)
- Config file: `eslint.config.ts` (flat config format)
- Run with: `npm run lint:oxlint --fix` (oxlint pass) and `npm run lint:eslint --fix` (ESLint pass)
- Combined: `npm run lint` runs both in sequence (`run-s lint:*`)

**Language:**
- TypeScript 5.9.3 with strict mode enabled
- Target: ES2020 (via Vue 3 standard setup)
- Path aliases: `@/*` maps to `./src/*` (configured in `tsconfig.app.json`)

## Import Organization

**Order:**
1. Type imports from external packages (marked with `type` keyword)
2. Value imports from external packages (Vue, Pinia, Firebase)
3. Type imports from local modules (from `@/types/`)
4. Value imports from local modules (stores, utils, components)

**Example from `src/stores/services.ts`:**
```typescript
import { ref } from 'vue'                    // Framework
import { defineStore } from 'pinia'          // State mgmt
import { ... } from 'firebase/firestore'    // External API
import { db } from '@/firebase'              // Local config
import { useSongStore } from '@/stores/songs' // Local stores
import { buildSlots } from '@/utils/slotTypes' // Local utils
import type { Service } from '@/types/service' // Local types
```

**Path Aliases:**
- `@/` always resolves to `./src/`
- Used consistently throughout for relative imports to avoid `../../` chains
- Never mix: all local imports use `@/`, no relative paths

## Error Handling

**Patterns:**
- Async functions return explicit nullable types: `Promise<Result | null>` on error
- Try/catch blocks wrap async operations
- Functions return `null` silently on validation/parse failures (not throwing)
- Guard clauses for early returns: `if (!orgId.value) return`
- Firebase Firestore operations wrapped in try/catch with console.error logging

**Examples:**
```typescript
// Pattern 1: Return null on error
async function getSongSuggestions(...): Promise<AiSongSuggestion[] | null> {
  try {
    const response = await getClient().messages.create(...)
    const parsed = safeParseJsonArray(textContent.text)
    if (!parsed) return null
    return validated
  } catch (err) {
    console.error('[claudeApi] getSongSuggestions failed:', err)
    return null
  }
}

// Pattern 2: Guard clauses for missing context
async function createService(data: CreateServiceInput): Promise<string> {
  if (!orgId.value) throw new Error('No orgId set — call subscribe() first')
  // ... continue
}

// Pattern 3: Validate before use
function validateSongSuggestions(
  aiResult: AiSongSuggestion[],
  songs: { id: string }[],
): AiSongSuggestion[] {
  const songIdSet = new Set(songs.map((s) => s.id))
  return aiResult.filter((suggestion) => songIdSet.has(suggestion.songId))
}
```

## Logging

**Framework:** console (no external logging library)

**Patterns:**
- `console.error()` with namespace prefix: `console.error('[moduleName] operation failed:', err)`
- Minimal logging — errors only, no info/debug/warn levels
- Error messages include context module name in brackets
- Full error object passed to console for debugging

**Examples from codebase:**
```typescript
console.error('[claudeApi] getSongSuggestions failed:', err)
console.error('[claudeApi] getScriptureSuggestions failed:', err)
console.error('[stores/quarters] onSnapshot error:', e)
```

**No logging for:**
- Success cases
- Normal flow execution
- Debug information

## Comments

**When to Comment:**
- Exported functions: Include JSDoc block
- Non-obvious logic: Explain design decisions or constraints
- Workarounds/regressions: Use pattern codes (D-XX for design, WR-XX for workaround)
- Complex conditions: Clarify intent above the code
- Rules/constraints: Document cross-file or business logic

**JSDoc/TSDoc:**
- Used for all exported functions, types, and interfaces
- Include `@param` tags for complex parameters
- Include `@returns` tags for non-obvious return values
- Use `/**` block format

**Comment Style:**
```typescript
/**
 * Safely parse a JSON array from AI response text.
 * Handles: clean JSON, prose-wrapped JSON, markdown-fenced JSON.
 * Returns null on any failure.
 */
export function safeParseJsonArray(text: string): unknown[] | null {
  // ... implementation
}

// Section dividers
// ─── Song Suggestion Parameters ──────────────────────────────────────────

// Pattern codes for decision tracking
// D-11: VW type is advisory context only, do NOT restrict suggestions to this type
// WR-01: whitespace-token de-dupe check breaks for multi-word tag/theme values
```

**Pattern Codes:**
- `D-XX`: Design decision or architectural constraint (e.g., D-08, D-16)
- `WR-XX`: Workaround or known regression (e.g., WR-01, WR-04)
- Used in comments to link logic to CLAUDE.md or decision docs
- Enables tracking of "why" across refactors

## Function Design

**Size:**
- Target: Under 50 lines per function
- Complex operations break into smaller helpers
- Setup/teardown separated into distinct functions

**Parameters:**
- Use typed interfaces for multiple parameters: `GetSongSuggestionsParams`
- Avoid single-line function declarations with 5+ params
- Destructure params in function body for clarity
- Pass immutable data structures when possible

**Return Values:**
- Always explicitly typed: `Promise<Result | null>` or `Result[]`
- Nullable returns: use `| null` not `| undefined` consistently
- Async functions: always return `Promise<T>` form, never bare promises
- Validation functions: return filtered/mapped results, not boolean flags

**Example Pattern:**
```typescript
// ✓ Good: typed interface, explicit return type
async function assignSongToSlot(
  serviceId: string,
  slotIndex: number,
  song: { id: string; title: string; key: string },
): Promise<void> {
  // ... implementation
}

// ✓ Good: validation returns filtered result
export function detectDuplicates(
  parsed: ParsedSongPreview[],
  existing: Song[],
): ParsedSongPreview[] {
  return parsed.map((song) => {
    // ... detect and return updated song
  })
}
```

## Module Design

**Exports:**
- Named exports preferred over default exports
- Stores: export single `defineStore()` call
- Utils: export multiple named functions
- Types: export interfaces and type aliases
- No mixing: file exports either store OR utilities OR types, rarely mixed

**Barrel Files:**
- Not used extensively; most imports are direct
- Test imports typically direct from source file

**Store Pattern:**
```typescript
// ✓ Pattern from src/stores/services.ts
export const useServiceStore = defineStore('services', () => {
  // state
  const services = ref<Service[]>([])
  
  // actions
  async function createService(data: CreateServiceInput): Promise<string> {
    // ...
  }
  
  // return public API
  return {
    services,
    isLoading,
    orgId,
    subscribe,
    unsubscribeAll,
    createService,
    // ... other actions
  }
})
```

---

*Convention analysis: 2026-07-15*
