# Phase 2: Song Library - Research

**Researched:** 2026-03-03
**Domain:** Vue 3 + Firestore song data model, CSV parsing, slide-over UI, search/filter
**Confidence:** HIGH (stack is established from Phase 1; patterns verified against existing codebase)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**CSV import experience**
- Two entry points: "Import Songs" button on the Songs page AND a link from the Getting Started checklist on the dashboard
- After file selection, show a preview table of parsed songs with validation highlights (missing fields, warnings) before committing to Firestore
- Skip duplicates by CCLI number match (or title if no CCLI); show count of skipped duplicates in the preview
- User will provide a real Planning Center CSV export file so the parser matches the actual column format exactly
- Non-destructive: no data is written until the user reviews and clicks "Import"

**Song list & browsing**
- Table/list view as the primary display — sortable rows for scanning a large library quickly
- Default columns: Title, Category (VW type), Key, BPM, Last Used, Team Tags
- Search bar at the top for title/CCLI text search
- Filter dropdowns for Category (1/2/3), Key, and Team Tags — filters combine (e.g., Type 2 + Key of G + Choir)
- Empty state: centered message ("Your song library is empty") with a prominent "Import from CSV" button and a smaller "Add song manually" link

**Song detail & editing**
- Click a song row to open a slide-over panel from the right — song list stays visible behind it (Linear-style pattern)
- Same slide-over panel for both creating a new song and editing an existing one (blank for create, populated for edit)
- Multiple arrangements per song displayed as collapsible accordion sections or tabs within the panel — each showing key, BPM, length, chord chart link, tags
- User can add, remove, and edit arrangements inline within the panel
- Explicit "Save" button to commit changes; "Cancel" discards edits — no auto-save

**Categorization & tagging**
- Vertical Worship type (1/2/3) displayed as color-coded badges in the song table (e.g., Type 1 = blue, Type 2 = purple, Type 3 = amber)
- Team compatibility shown as small pill tags on each song row (e.g., "Choir", "Orchestra", "Band")
- Team tags assigned in the song detail slide-over via toggle buttons or checkboxes
- CSV import auto-populates team tags from arrangement tag data
- Predefined team tags: Choir, Orchestra, Band — plus the ability for users to create custom team tags
- After import, uncategorized songs (no VW type) are filterable via an "Uncategorized" filter
- Two modes for assigning VW types: per-song in the detail panel AND a batch quick-assign mode for working through uncategorized songs with quick 1/2/3 buttons

### Claude's Discretion
- Exact color values for VW type badges within the dark mode palette
- Loading states, spinners, and skeleton patterns
- Sort behavior defaults (alphabetical by title, or most recently used)
- Pagination vs infinite scroll for the song table (whichever fits the data size)
- Exact slide-over panel width and responsive breakpoints
- Error toast/notification design
- Delete confirmation dialog design and wording
- Batch quick-assign mode interaction details

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| SONG-01 | User can import song stable from CSV (Planning Center export format with multiple arrangements per song) | PapaParse for browser CSV parsing; Firestore batched writes for import; preview-before-commit pattern documented below |
| SONG-02 | User can add, edit, and delete songs with title, CCLI number, themes, and notes | Firestore CRUD operations; slide-over panel pattern; Pinia store with `onSnapshot`; delete with confirmation dialog |
| SONG-03 | User can search and filter songs by title, key, tempo, category, and team tags | Client-side filtering on `onSnapshot` data; Firestore composite index for multi-field server queries; search via computed filter |
| SONG-04 | User can manage multiple arrangements per song (key, BPM, length, chord chart, notes) | Arrangements embedded as array of maps in the song document; inline accordion editing in slide-over |
| SONG-05 | User can categorize each song as Vertical Worship type 1, 2, or 3 | `vwType` field (1/2/3/null); color-coded badge component; batch quick-assign mode |
| SONG-06 | User can tag songs with team compatibility (choir, orchestra, standard band, etc.) | `teamTags` array field; `array-contains` Firestore query; tag pill components; predefined + custom tags |
</phase_requirements>

---

## Summary

Phase 2 implements the Song Library on top of the Vue 3 + Firebase v12 + Pinia + Tailwind CSS v4 foundation established in Phase 1. The stack is locked and proven. All song data lives in `organizations/{orgId}/songs` (already covered by existing Firestore security rules). The two primary technical challenges are (1) the CSV import pipeline and (2) the slide-over panel UI pattern.

For CSV import, PapaParse is the standard browser-side CSV parser — no server required. Parsed rows are held in component state for the preview step, then written to Firestore using batched writes (chunked to 499 ops to stay under the 500-op limit). The Planning Center CSV column schema is not publicly documented and will need to be confirmed against the user's actual export file before column mapping is finalized; this is a known risk documented in STATE.md.

For the song list and detail, the pattern is: a reactive Pinia store subscribes to the `songs` collection via `onSnapshot`; filtering/searching happens client-side on the in-memory array (appropriate for a song library of typical church size, 50–500 songs); the slide-over panel is a fixed-position overlay rendered via Vue's `<Teleport>` to `body` with a CSS `translate-x` transition. No new npm dependencies are needed beyond PapaParse.

**Primary recommendation:** Embed arrangements as an array of maps inside each song document (not a subcollection) — simpler reads, no extra queries, safe within Firestore's 1 MiB document limit for typical arrangement counts (< 20).

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Vue 3 | ^3.5.29 (project) | UI components, reactivity, `<Teleport>` | Locked — Phase 1 foundation |
| Pinia | ^3.0.4 (project) | Song store with `onSnapshot` subscription | Locked — established pattern |
| Firebase SDK | ^12.0.0 (project) | Firestore CRUD + batched writes | Locked — Phase 1 foundation |
| Tailwind CSS | ^4.0.0 (project) | Styling, dark mode palette, transitions | Locked — Phase 1 foundation |
| PapaParse | ^5.4.1 | Browser-side CSV parsing | Standard for JS CSV; no server needed |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| vue-router | ^5.0.3 (project) | `/songs` route, route params | Add route for Songs page |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| PapaParse | Native `FileReader` + manual split | PapaParse handles quoting, encoding, empty lines correctly; hand-rolling CSV is error-prone |
| Client-side filter | Firestore compound queries | Firestore `array-contains` + multiple `where` clauses require composite indexes per combination; for < 500 songs, client-side filtering on `onSnapshot` data is simpler and fast |
| Embedded arrangements array | Arrangements subcollection | Subcollection requires extra reads; embedding is fine for < 20 arrangements per song |

**Installation:**
```bash
npm install papaparse
npm install --save-dev @types/papaparse
```

---

## Architecture Patterns

### Recommended Project Structure
```
src/
├── stores/
│   └── songs.ts             # Pinia store: onSnapshot, CRUD, import action
├── views/
│   └── SongsView.vue        # Page shell wrapping AppShell; hosts table + slide-over
├── components/
│   ├── SongTable.vue        # Table rows, sort, empty state
│   ├── SongFilters.vue      # Search bar + filter dropdowns
│   ├── SongSlideOver.vue    # Right-side panel: create/edit/arrangements
│   ├── SongBadge.vue        # VW type color badge (1=blue, 2=purple, 3=amber)
│   ├── TeamTagPill.vue      # Team tag pill (Choir/Orchestra/Band/custom)
│   ├── ArrangementAccordion.vue  # Collapsible arrangement section
│   ├── CsvImportModal.vue   # File input → preview table → import button
│   └── BatchQuickAssign.vue # Quick-assign VW type 1/2/3 for uncategorized songs
└── types/
    └── song.ts              # Song, Arrangement TypeScript interfaces
```

### Firestore Data Model

**Collection:** `organizations/{orgId}/songs`

**Song document:**
```typescript
interface Arrangement {
  id: string            // client-generated UUID (crypto.randomUUID())
  name: string          // e.g., "Original", "Acoustic"
  key: string           // e.g., "G", "Ab", "C#m"
  bpm: number | null
  lengthSeconds: number | null
  chordChartUrl: string
  notes: string
  teamTags: string[]    // subset of org-level tags, e.g., ["Choir", "Orchestra"]
}

interface Song {
  id: string            // Firestore document ID
  title: string
  ccliNumber: string    // stored as string to preserve leading zeros; "" if none
  author: string
  themes: string[]
  notes: string
  vwType: 1 | 2 | 3 | null   // Vertical Worship category
  teamTags: string[]    // union of all arrangement tags (for top-level filtering)
  arrangements: Arrangement[]
  lastUsedAt: Timestamp | null
  createdAt: Timestamp
  updatedAt: Timestamp
}
```

**Why `teamTags` at both song and arrangement level:**
- Song-level `teamTags` = union of all arrangement tags → enables Firestore `array-contains` query without joining
- Arrangement-level `teamTags` = which specific arrangements the team can use

### Pattern 1: Pinia Store with onSnapshot

Follow the established `auth.ts` pattern exactly. Song store subscribes when initialized; unsubscribes on cleanup.

```typescript
// src/stores/songs.ts
// Source: follows existing auth.ts Pinia composition pattern + Firebase SDK docs
import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import {
  collection, onSnapshot, addDoc, updateDoc, deleteDoc,
  doc, serverTimestamp, writeBatch, query, orderBy,
  type Unsubscribe,
} from 'firebase/firestore'
import { db } from '@/firebase'
import type { Song } from '@/types/song'

export const useSongStore = defineStore('songs', () => {
  const songs = ref<Song[]>([])
  const isLoading = ref(true)
  let unsubscribe: Unsubscribe | null = null

  function subscribe(orgId: string) {
    if (unsubscribe) unsubscribe()
    const q = query(
      collection(db, 'organizations', orgId, 'songs'),
      orderBy('title')
    )
    unsubscribe = onSnapshot(q, (snap) => {
      songs.value = snap.docs.map(d => ({ id: d.id, ...d.data() } as Song))
      isLoading.value = false
    })
  }

  function unsubscribeAll() {
    unsubscribe?.()
    unsubscribe = null
    songs.value = []
    isLoading.value = true
  }

  // CRUD actions...
  return { songs, isLoading, subscribe, unsubscribeAll }
})
```

### Pattern 2: Slide-Over Panel via Teleport

Use Vue's built-in `<Teleport to="body">` to avoid z-index and overflow stacking context issues with the `AppShell` layout.

```typescript
// src/components/SongSlideOver.vue (structure)
// Source: Vue 3 Teleport docs https://vuejs.org/guide/built-ins/teleport.html
```

```html
<Teleport to="body">
  <Transition
    enter-active-class="transition-transform duration-300 ease-out"
    enter-from-class="translate-x-full"
    enter-to-class="translate-x-0"
    leave-active-class="transition-transform duration-200 ease-in"
    leave-from-class="translate-x-0"
    leave-to-class="translate-x-full"
  >
    <div
      v-if="open"
      class="fixed inset-y-0 right-0 z-50 w-[480px] flex flex-col
             bg-gray-900 border-l border-gray-800 shadow-2xl overflow-hidden"
    >
      <!-- Header: title + Save/Cancel -->
      <!-- Body: scrollable form -->
      <!-- Arrangements: ArrangementAccordion list -->
    </div>
  </Transition>

  <!-- Backdrop (optional — doesn't close list context) -->
  <div v-if="open" class="fixed inset-0 z-40 bg-black/30" @click="$emit('close')" />
</Teleport>
```

**Note:** The backdrop is intentionally semi-transparent and dismisses on click. The song list MUST remain visible/scrollable behind the panel (Linear pattern) — do NOT use a full-opacity backdrop.

### Pattern 3: CSV Import Pipeline

```typescript
// src/components/CsvImportModal.vue (logic flow)
// Source: PapaParse docs https://www.papaparse.com/docs
import Papa from 'papaparse'

function onFileSelected(file: File) {
  Papa.parse(file, {
    header: true,
    skipEmptyLines: true,
    complete(results) {
      // results.data = array of row objects keyed by header name
      parsedRows.value = results.data
      showPreview.value = true
    }
  })
}

// Map Planning Center CSV rows → Song objects
function mapRowToSong(row: Record<string, string>): ParsedSongPreview {
  return {
    title: row['Title'] ?? row['Song Title'] ?? '',
    ccliNumber: row['CCLI Number'] ?? row['CCLI'] ?? '',
    author: row['Author'] ?? row['Copyright'] ?? '',
    // ... other fields
    _warnings: [],  // populate with validation messages
  }
}
```

**Batched write (chunked to 499):**
```typescript
// Source: Firebase SDK docs on batched writes
async function importSongs(songs: ParsedSongPreview[]) {
  const CHUNK = 499
  for (let i = 0; i < songs.length; i += CHUNK) {
    const batch = writeBatch(db)
    songs.slice(i, i + CHUNK).forEach(song => {
      const ref = doc(collection(db, 'organizations', orgId, 'songs'))
      batch.set(ref, { ...song, createdAt: serverTimestamp(), updatedAt: serverTimestamp() })
    })
    await batch.commit()
  }
}
```

### Pattern 4: Client-Side Search + Filter

Store filtering stays in a computed on the component or store, NOT server-side queries. This is correct for typical library size (50–500 songs).

```typescript
// Computed filter example in SongsView.vue or songs store
const filteredSongs = computed(() => {
  return songStore.songs.filter(song => {
    const matchesSearch = !searchQuery.value ||
      song.title.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
      song.ccliNumber.includes(searchQuery.value)

    const matchesVwType = !filterVwType.value ||
      (filterVwType.value === 'uncategorized'
        ? song.vwType === null
        : song.vwType === filterVwType.value)

    const matchesKey = !filterKey.value ||
      song.arrangements.some(a => a.key === filterKey.value)

    const matchesTag = !filterTag.value ||
      song.teamTags.includes(filterTag.value)

    return matchesSearch && matchesVwType && matchesKey && matchesTag
  })
})
```

### Anti-Patterns to Avoid

- **Calling `subscribe()` before orgId is known:** `orgId` comes from auth store. Wait for auth to be ready before calling `subscribe()`. Subscribe in `SongsView.vue` `onMounted` after confirming orgId exists.
- **Creating arrangements as a subcollection:** Adds read complexity with no benefit for < 20 arrangements per song. Keep arrangements embedded as an array of maps.
- **Writing all import docs in a single batch:** Firestore batches cap at 500 ops. Always chunk imports.
- **Putting slide-over inside AppShell's scroll container:** Causes visual overflow issues. Always use `<Teleport to="body">`.
- **Using VueFire composables in the store:** Established project decision — use `onSnapshot` directly (follows auth.ts pattern).
- **Auto-save on change:** User decision requires explicit Save/Cancel. Do not add watchers that write to Firestore on input change.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| CSV parsing | Manual string split on commas | PapaParse | Handles quoted fields with commas, line endings, BOM, encoding edge cases |
| CSV field quoting | Regex-based quote stripping | PapaParse `header: true` | RFC 4180 compliance; handles multiline quoted fields |
| Firestore batching | Single large batch | Chunked batches of 499 | Firestore hard-caps at 500 ops per batch — single batch fails silently or throws |
| Transition animation | CSS class toggling in JS | Vue `<Transition>` + Tailwind classes | Vue manages enter/leave lifecycle correctly; manual toggling causes race conditions |
| UUID for arrangement IDs | Incrementing counter | `crypto.randomUUID()` | Built into all modern browsers; no library needed; avoids index collisions |

**Key insight:** The CSV import surface area is deceptively large — quoted commas, Windows line endings, BOM headers, and encoding issues are all handled transparently by PapaParse but would require significant effort to handle manually.

---

## Common Pitfalls

### Pitfall 1: Planning Center CSV Column Names Are Unstable
**What goes wrong:** The parser assumes column names like `"Title"` or `"CCLI Number"` but the user's actual export uses different headers (e.g., `"Song Title"`, `"CCLI #"`).
**Why it happens:** PCO has changed its export format over time; the exact headers depend on which report/export option the user chose.
**How to avoid:** Parse defensively — try multiple candidate column names per field (`row['Title'] ?? row['Song Title'] ?? ''`). In the preview step, display the raw header row so the user can see what was detected. Flag rows where critical fields (title) are empty.
**Warning signs:** Preview table shows empty title column for all rows.

### Pitfall 2: Firestore Batch Write Exceeds 500 Op Limit
**What goes wrong:** Importing 600 songs with a single `writeBatch()` throws `"Maximum 500 writes allowed per request"`.
**Why it happens:** Each `batch.set()` counts as one operation.
**How to avoid:** Always chunk: `for (let i = 0; i < songs.length; i += 499)` — create a new batch per chunk.
**Warning signs:** Import appears to succeed for small datasets but fails for larger ones.

### Pitfall 3: orgId Not Available at Store Subscription Time
**What goes wrong:** `subscribe(orgId)` is called with `undefined` because the auth store hasn't finished resolving the user's orgId yet.
**Why it happens:** `onAuthStateChanged` is async; component mounts before auth resolves.
**How to avoid:** In `SongsView.vue`, watch `authStore.user` and call `subscribe(orgId)` only when user and orgId are confirmed. Use `watchEffect` or `watch` with `{ immediate: true }`. Unsubscribe in `onUnmounted`.
**Warning signs:** Firestore throws `"Missing or insufficient permissions"` or the collection path contains `undefined`.

### Pitfall 4: Key Filtering Requires Scanning Arrangements
**What goes wrong:** Filtering by key (e.g., "G") does not match songs whose arrangements include key "G" because the top-level song document has no `key` field.
**Why it happens:** Keys live inside the arrangements array.
**How to avoid:** Use `song.arrangements.some(a => a.key === filterKey.value)` in the computed filter, not a top-level field comparison.
**Warning signs:** Key filter returns 0 results even when songs with that key exist.

### Pitfall 5: Slide-Over z-index Conflicts
**What goes wrong:** The slide-over panel renders behind the sidebar or mobile header.
**Why it happens:** CSS stacking contexts created by `transform` on the AppShell flex containers trap `z-index`.
**How to avoid:** Always use `<Teleport to="body">` so the slide-over renders as a direct child of `<body>`, outside all stacking contexts.
**Warning signs:** Slide-over appears clipped or behind the sidebar.

### Pitfall 6: Tailwind CSS v4 Purge for Dynamic Classes
**What goes wrong:** VW type badge colors (e.g., `bg-blue-900/50 text-blue-300`) are generated dynamically from `vwType` values and get purged from the production bundle.
**Why it happens:** Tailwind v4 scans source files for class strings; string-concatenated classes are not detected.
**How to avoid:** Use a static lookup object, never string interpolation:
```typescript
const vwBadgeClasses = {
  1: 'bg-blue-900/50 text-blue-300 border-blue-800',
  2: 'bg-purple-900/50 text-purple-300 border-purple-800',
  3: 'bg-amber-900/50 text-amber-300 border-amber-800',
} as const
// Usage: :class="vwBadgeClasses[song.vwType]"
```
**Warning signs:** Badges appear unstyled in production build only.

---

## Code Examples

### Song Store Subscription with orgId Safety
```typescript
// src/views/SongsView.vue <script setup>
// Source: established auth.ts pattern + Vue 3 docs
import { onMounted, onUnmounted, watchEffect } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useSongStore } from '@/stores/songs'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '@/firebase'

const authStore = useAuthStore()
const songStore = useSongStore()

// Resolve orgId from user document, then subscribe
watchEffect(async () => {
  const user = authStore.user
  if (!user) return

  const userSnap = await getDoc(doc(db, 'users', user.uid))
  const orgIds: string[] = userSnap.data()?.orgIds ?? []
  if (orgIds[0]) {
    songStore.subscribe(orgIds[0])
  }
})

onUnmounted(() => songStore.unsubscribeAll())
```

### Duplicate Detection During Import Preview
```typescript
// src/components/CsvImportModal.vue
function detectDuplicates(parsedRows: ParsedSongPreview[], existingSongs: Song[]) {
  const existingCcli = new Set(existingSongs.map(s => s.ccliNumber).filter(Boolean))
  const existingTitles = new Set(existingSongs.map(s => s.title.toLowerCase()))

  return parsedRows.map(row => ({
    ...row,
    isDuplicate: row.ccliNumber
      ? existingCcli.has(row.ccliNumber)
      : existingTitles.has(row.title.toLowerCase()),
  }))
}
```

### VW Type Badge Component
```html
<!-- src/components/SongBadge.vue -->
<template>
  <span
    v-if="type"
    class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border"
    :class="badgeClasses[type]"
  >
    Type {{ type }}
  </span>
  <span
    v-else
    class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium
           bg-gray-800 text-gray-500 border border-gray-700"
  >
    —
  </span>
</template>

<script setup lang="ts">
const props = defineProps<{ type: 1 | 2 | 3 | null }>()

// Static map prevents Tailwind purge of dynamic class strings
const badgeClasses = {
  1: 'bg-blue-900/50 text-blue-300 border-blue-800',
  2: 'bg-purple-900/50 text-purple-300 border-purple-800',
  3: 'bg-amber-900/50 text-amber-300 border-amber-800',
} as const
</script>
```

### GettingStarted.vue Update Pattern
The existing `GettingStarted.vue` already has "Import your song library" linking to `/songs` (line 73). Phase 2 must update the `done` property to be reactive — check whether any songs exist in the store:
```typescript
// Replace hardcoded done: false with:
import { useSongStore } from '@/stores/songs'
const songStore = useSongStore()
const steps = computed(() => [
  { title: 'Sign in...', done: true, to: null, description: '...' },
  {
    title: 'Import your song library',
    done: songStore.songs.length > 0,
    to: '/songs',
    description: 'Import songs from Planning Center CSV or add them manually.',
  },
  // ...
])
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| VueFire composables in stores | `onSnapshot` directly in Pinia | Project decision (Phase 1) | Simpler, fewer abstractions, more control |
| Vuex | Pinia composition stores | Vue 3 era | Better TypeScript, no mutations boilerplate |
| Tailwind v3 `@apply` | Tailwind v4 CSS-first config | 2024-2025 | No `tailwind.config.js`; use `@theme` in CSS |
| `import.meta.glob` for dynamic icons | Inline SVG strings in component data | Project decision (Phase 1) | No icon library dependency; full control |

**Deprecated/outdated:**
- `VueFire` composables in Pinia stores: project explicitly chose not to use them
- `writeBatch` with > 500 ops: always chunk; Firebase SDK does not auto-chunk

---

## Open Questions

1. **Planning Center CSV Column Schema**
   - What we know: PCO exports songs to CSV; columns include song title, CCLI number, author, and arrangement data — but exact header names vary by export type and PCO version
   - What's unclear: The exact column header strings the user's export file contains (e.g., `"Title"` vs `"Song Title"`, `"CCLI Number"` vs `"CCLI"`, `"BPM"` vs `"Tempo"`)
   - Recommendation: In Wave 1 of the plan, log `results.meta.fields` from PapaParse to console after file selection during development. Build the column mapper defensively with multiple fallback keys. Document in the import modal which column names are expected so users can verify their export matches.

2. **Last Used Timestamp Population**
   - What we know: Song table shows "Last Used" column; no service planning data exists yet (Phase 3)
   - What's unclear: Should `lastUsedAt` default to null and show "—" in Phase 2, or should it be populated from CSV data?
   - Recommendation: Default `lastUsedAt: null`, display "—" in Phase 2. Phase 3 will update this field when songs are placed in service plans.

3. **Custom Team Tags Storage**
   - What we know: Users can create custom team tags beyond Choir/Orchestra/Band
   - What's unclear: Where are custom tag definitions stored? On the org document? A separate `tags` subcollection?
   - Recommendation: Store custom tags as an array on the org document (`organizations/{orgId}.customTeamTags: string[]`). No separate collection needed for Phase 2 scale. Pinia can fetch this once when the store subscribes.

---

## Validation Architecture

> `workflow.nyquist_validation` key is absent from config.json — treating as enabled.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest ^4.0.18 |
| Config file | `vite.config.ts` (test block; excludes `rules.test.ts`) |
| Quick run command | `npx vitest run --reporter=verbose` |
| Full suite command | `npx vitest run --reporter=verbose` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SONG-01 | CSV row mapping produces correct Song shape | unit | `npx vitest run src/stores/__tests__/songs.test.ts -t "csv"` | ❌ Wave 0 |
| SONG-01 | Duplicate detection skips songs by CCLI/title | unit | `npx vitest run src/stores/__tests__/songs.test.ts -t "duplicate"` | ❌ Wave 0 |
| SONG-01 | Batch chunking splits 600 songs into 2 batches | unit | `npx vitest run src/stores/__tests__/songs.test.ts -t "batch"` | ❌ Wave 0 |
| SONG-02 | `addSong` writes correct fields to Firestore mock | unit | `npx vitest run src/stores/__tests__/songs.test.ts -t "addSong"` | ❌ Wave 0 |
| SONG-02 | `deleteSong` removes doc from Firestore mock | unit | `npx vitest run src/stores/__tests__/songs.test.ts -t "deleteSong"` | ❌ Wave 0 |
| SONG-03 | `filteredSongs` computed filters by title search query | unit | `npx vitest run src/stores/__tests__/songs.test.ts -t "filter"` | ❌ Wave 0 |
| SONG-03 | `filteredSongs` filters by vwType including "uncategorized" | unit | `npx vitest run src/stores/__tests__/songs.test.ts -t "vwType filter"` | ❌ Wave 0 |
| SONG-04 | Arrangement add/edit/remove stays within song document | unit | `npx vitest run src/stores/__tests__/songs.test.ts -t "arrangement"` | ❌ Wave 0 |
| SONG-05 | VW badge renders correct class for types 1, 2, 3, null | unit | `npx vitest run src/components/__tests__/SongBadge.test.ts` | ❌ Wave 0 |
| SONG-06 | teamTags union populates song-level field from arrangements | unit | `npx vitest run src/stores/__tests__/songs.test.ts -t "teamTags"` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run --reporter=verbose`
- **Per wave merge:** `npx vitest run --reporter=verbose`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/stores/__tests__/songs.test.ts` — covers SONG-01 through SONG-04, SONG-06 (mock Firestore + PapaParse)
- [ ] `src/components/__tests__/SongBadge.test.ts` — covers SONG-05 badge rendering
- [ ] `src/components/__tests__/CsvImportModal.test.ts` — covers SONG-01 column mapping and duplicate detection logic

---

## Sources

### Primary (HIGH confidence)
- Existing codebase `src/stores/auth.ts` — established Pinia + onSnapshot pattern to replicate
- Existing `firestore.rules` — confirms `organizations/{orgId}/{collection}/{docId}` wildcard covers songs collection
- Existing `package.json` — confirmed Firebase ^12.0.0, Vue ^3.5.29, Pinia ^3.0.4, Tailwind ^4.0.0, Vitest ^4.0.18
- [PapaParse docs](https://www.papaparse.com/docs) — `header: true`, `skipEmptyLines: true`, File object parsing
- [Firebase SDK batched writes docs](https://firebase.google.com/docs/firestore/quotas) — 500 op hard limit confirmed
- [Vue 3 Teleport docs](https://vuejs.org/guide/built-ins/teleport.html) — slide-over pattern

### Secondary (MEDIUM confidence)
- [Firebase best practices](https://firebase.google.com/docs/firestore/best-practices) — embedded array vs subcollection tradeoffs
- [Tailwind CSS slide-overs](https://tailwindui.com/components/application-ui/overlays/slide-overs) — transition pattern with `translate-x-full`
- [Vue 3 Transition docs](https://vuejs.org/guide/built-ins/transition) — enter/leave class API

### Tertiary (LOW confidence — flag for validation)
- Planning Center CSV column names: `"Title"`, `"CCLI Number"`, `"Author"`, `"BPM"` — inferred from PCO's API field names and third-party import tool docs; **must be validated against the user's actual CSV file before parser is finalized**

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries are pinned in package.json from Phase 1; only PapaParse is new
- Architecture: HIGH — data model follows established Pinia + Firestore patterns; slide-over pattern uses documented Vue 3 Teleport + Transition APIs
- Pitfalls: HIGH — Tailwind purge, Firestore batch limit, z-index stacking are well-documented failure modes
- CSV column schema: LOW — Planning Center has no public CSV format spec; column names must be validated against real export

**Research date:** 2026-03-03
**Valid until:** 2026-04-03 (stable stack; PapaParse API rarely changes)
