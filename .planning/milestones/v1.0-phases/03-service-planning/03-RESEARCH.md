# Phase 3: Service Planning - Research

**Researched:** 2026-03-03
**Domain:** Vue 3 + Firebase service planning, Pinia state management, song suggestion algorithm, Firestore data modeling
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Service order builder:**
- Pre-filled template: service opens with all 9 slots laid out in standard order (Song, Scripture, Song, Prayer, Scripture, Song, Song, Message, Sending Song)
- Each slot shows its VW type constraint label (e.g., "Type 1 — Call to Worship")
- User fills slots by clicking each one — no drag-and-drop or wizard
- Full-page editor at `/services/:id` — service planning is complex enough to warrant its own dedicated page
- Progression pattern (1-2-2-3 or 1-2-3-3) chosen at service creation (before seeing slots) so slot labels are accurate from the start
- Team configuration via checkboxes at top of service plan (Choir, Orchestra, Special Service) — visible and easy to toggle, immediately filters song suggestions

**Song suggestions:**
- Dropdown list appears in-slot when user clicks an empty song slot
- Each suggestion row shows: song title, preferred key, "last used X weeks ago", VW type badge
- Top 5 suggestions shown per slot by default
- Strict VW type filtering — only songs matching the slot's type appear in suggestions
- Search bar within the dropdown for manual override — type to search the full library (filtered to correct VW type), suggestions show first, search results below
- Songs used in last 2 weeks deprioritized (shown lower in ranking, not hidden)

**Scripture & sermon input:**
- Structured book/chapter/verse picker for scripture passages (select book from dropdown, enter chapter and verse range)
- Validates format to ensure consistent, parseable references
- Link to ESV.org for passage text (e.g., esv.org/Psalm+23) — no ESV API integration in v1
- Dedicated "Sermon Passage" input field in the service plan (separate from scripture reading slots)
- When a scripture reading matches or overlaps with the sermon passage, show a warning
- Subtle hint text under scripture input: "Tip: Psalms work well for responsive readings"

**Calendar & services list:**
- Services list page shows list of week cards — one card per Sunday, each showing date, progression, song titles, and status (planned/draft)
- Click a card to navigate to the full service editor
- Focus on upcoming services (next 4-6 weeks) shown first, with past services section below
- "New Service" button with date picker dialog (defaults to next Sunday) — click navigates to full editor
- Seasonal/quarterly overview as a song rotation table: weeks as columns, songs as rows, highlights repeats and gaps to surface rotation issues

### Claude's Discretion
- Song suggestion ranking algorithm weights (recency decay, category match scoring, team compatibility)
- Exact layout and spacing of the 9-slot service template
- Loading states and skeleton patterns for the service editor
- Empty state design for the services list (no services yet)
- Date picker component choice and styling
- How the seasonal rotation table handles large song libraries (scrolling, filtering)
- Service plan auto-save vs. explicit save behavior
- How the "Prayer" and "Message" slots look (no song assignment, just labels)

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| PLAN-01 | User can create a weekly service plan following the standard order (Song, Scripture, Song, Prayer, Scripture, Song, Song, Message, Sending Song) | Firestore `services` collection with a `slots` array encoding the 9-position template; ServiceEditorView at `/services/:id` |
| PLAN-02 | User can select a 4-song progression pattern (1-2-2-3 or 1-2-3-3) for each service | `progression` field on service document; chosen at creation before editor opens |
| PLAN-03 | Service song slots enforce Vertical Worship type constraints based on chosen progression | `VW_SLOT_TYPE` lookup table maps progression + position → required VWType; enforced in suggestion filter |
| PLAN-04 | User can specify which teams are participating per service (choir, orchestra, special service) | `teams` array field on service; checkbox row at top of editor; re-filters suggestions on toggle |
| PLAN-05 | Available songs are automatically filtered by team configuration for each service | `song.teamTags` intersection with `service.teams`; computed inside suggestion algorithm |
| PLAN-06 | App suggests songs for each slot based on category type, rotation recency, and team configuration | `rankSongsForSlot()` pure function in `src/utils/suggestions.ts`; uses `lastUsedAt` Timestamp |
| PLAN-07 | User can override suggestions and manually pick any song from the stable | Search bar in slot dropdown filters full song store (VW type match only), results below suggestions |
| PLAN-08 | Song usage history is tracked automatically when songs are placed in service plans | `updateSong(songId, { lastUsedAt: serverTimestamp() })` called by service store when a song slot is saved |
| PLAN-09 | Songs used in the last 2 weeks are deprioritized in suggestions (rotation enforcement) | `isRecent()` check in ranking function; recent songs get a recency penalty score, not hidden |
| SCRI-01 | User can add scripture passages to the service order (multiple reading slots) | Two `SCRIPTURE` slots in the 9-position template; each stores `{ book, chapter, verseStart, verseEnd }` |
| SCRI-02 | User can enter the pastor's sermon passage to prevent duplication in readings | `sermonPassage` field on service document; overlap detection computed property |
| SCRI-03 | App links to or displays ESV Bible text for selected scripture passages | `esvLink()` utility: `https://esv.org/${book}+${chapter}:${verse}` — no API, external link only |
| SCRI-04 | App suggests Psalms when user is selecting scripture readings | Hint text under scripture input: "Tip: Psalms work well for responsive readings" |
| CAL-01 | User can view and manage services week-by-week with upcoming and recent weeks | ServicesView at `/services` — sorted list of week cards, upcoming first |
| CAL-02 | User can view a seasonal/quarterly overview of planned services | Tab or section on ServicesView: rotation table with weeks as columns, songs as rows |
| CAL-03 | Seasonal view shows song usage patterns across weeks to spot rotation issues | Rotation table highlights consecutive repeats; uses service documents fetched from Firestore |
</phase_requirements>

---

## Summary

Phase 3 builds on the established Vue 3 + Firebase + Pinia foundation by adding a `services` Pinia store mirroring the `songs` store pattern (`onSnapshot` directly, multi-tenant `organizations/{orgId}/services` path), two new views (`ServicesView` and `ServiceEditorView`), and a pure-function suggestion algorithm in `src/utils/`. The service data model centers on a `slots` array of 9 discriminated-union slot objects (song slots, scripture slots, non-assignable slots), a `progression` enum, and `teams` array. Song `lastUsedAt` is already modeled in the `Song` type and must be written back whenever a song is assigned to a service slot.

The suggestion algorithm is the phase's most complex piece: it is a pure TypeScript scoring function (`rankSongsForSlot`) that takes the song store snapshot, slot required VW type, service teams, and a "recent services" window, then returns a sorted list. Because it is pure (no Firestore reads), it runs synchronously and can be unit-tested completely independently of Firebase. The seasonal rotation table is the key UI differentiator and requires only the already-fetched `services` array — no extra Firestore queries.

**Primary recommendation:** Implement in three plans — (1) Firestore data model + service store + routes, (2) service editor with slot picker + suggestion dropdown, (3) services list + seasonal rotation table. Keep the suggestion algorithm in a standalone `src/utils/suggestions.ts` file so it is testable without mocking Firebase.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Vue 3 | ^3.5.29 (installed) | Component framework | Project non-negotiable |
| Pinia | ^3.0.4 (installed) | State management | Already used for auth + songs stores |
| Firebase | ^12.0.0 (installed) | Firestore + Auth | Project non-negotiable |
| Vue Router | ^5.0.3 (installed) | SPA routing | Already used for `/` and `/songs` |
| Tailwind CSS v4 | ^4.0.0 (installed) | Styling | Project standard — dark mode palette enforced |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Vitest | ^4.0.18 (installed) | Unit tests | All store logic and pure functions |
| @vue/test-utils | ^2.4.6 (installed) | Component tests | Component rendering and interaction |
| jsdom | ^28.1.0 (installed) | DOM simulation | Already configured as Vitest environment |

### No New Dependencies Required
All libraries needed for Phase 3 are already installed. The suggestion algorithm, scripture link generator, and rotation table are all pure TypeScript/Vue — no additional packages.

**Installation:**
```bash
# No new packages — all dependencies are already in package.json
```

---

## Architecture Patterns

### Recommended Project Structure Additions
```
src/
├── stores/
│   ├── auth.ts          # existing
│   ├── songs.ts         # existing
│   └── services.ts      # NEW — mirrors songs.ts pattern
├── types/
│   ├── song.ts          # existing
│   └── service.ts       # NEW — Service, ServiceSlot, ScriptureRef, etc.
├── utils/
│   └── suggestions.ts   # NEW — pure rankSongsForSlot() function
├── views/
│   ├── DashboardView.vue    # existing
│   ├── LoginView.vue        # existing
│   ├── SongsView.vue        # existing
│   ├── ServicesView.vue     # NEW — /services list + seasonal table
│   └── ServiceEditorView.vue # NEW — /services/:id full-page editor
├── components/
│   ├── SongBadge.vue        # existing — reuse in slot labels + suggestion rows
│   ├── TeamTagPill.vue      # existing — reuse for team checkboxes display
│   └── SongSlotPicker.vue   # NEW — the in-slot suggestion dropdown
```

### Pattern 1: Service Pinia Store (mirrors songs.ts)
**What:** Setup store with `onSnapshot` directly, `subscribe(orgId)` / `unsubscribeAll()`, CRUD methods.
**When to use:** Any view that needs real-time service data.
**Example:**
```typescript
// src/stores/services.ts — follows exact pattern from src/stores/songs.ts
import { ref } from 'vue'
import { defineStore } from 'pinia'
import { collection, onSnapshot, addDoc, updateDoc, query, orderBy, serverTimestamp, type Unsubscribe } from 'firebase/firestore'
import { db } from '@/firebase'
import type { Service } from '@/types/service'

export const useServiceStore = defineStore('services', () => {
  const services = ref<Service[]>([])
  const isLoading = ref(true)
  const orgId = ref<string | null>(null)
  let unsubscribeFn: Unsubscribe | null = null

  function subscribe(orgIdValue: string) {
    if (unsubscribeFn) unsubscribeFn()
    orgId.value = orgIdValue
    const q = query(
      collection(db, 'organizations', orgIdValue, 'services'),
      orderBy('date', 'desc'),
    )
    unsubscribeFn = onSnapshot(q, (snap) => {
      services.value = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Service)
      isLoading.value = false
    })
  }

  function unsubscribeAll() {
    unsubscribeFn?.()
    unsubscribeFn = null
    orgId.value = null
    services.value = []
    isLoading.value = true
  }

  async function createService(data: ServiceInput): Promise<string> {
    if (!orgId.value) throw new Error('No orgId')
    const ref = await addDoc(
      collection(db, 'organizations', orgId.value, 'services'),
      { ...data, createdAt: serverTimestamp(), updatedAt: serverTimestamp() }
    )
    return ref.id
  }

  async function updateService(id: string, data: Partial<ServiceInput>) {
    if (!orgId.value) return
    await updateDoc(doc(db, 'organizations', orgId.value, 'services', id), {
      ...data, updatedAt: serverTimestamp()
    })
  }

  return { services, isLoading, orgId, subscribe, unsubscribeAll, createService, updateService }
})
```

### Pattern 2: Service Firestore Data Model
**What:** The canonical shape of a service document in `organizations/{orgId}/services/{serviceId}`.
**When to use:** All reads/writes to the services collection.
**Example:**
```typescript
// src/types/service.ts
import type { Timestamp } from 'firebase/firestore'
import type { VWType } from './song'

export type Progression = '1-2-2-3' | '1-2-3-3'
export type ServiceStatus = 'draft' | 'planned'
export type SlotKind = 'SONG' | 'SCRIPTURE' | 'PRAYER' | 'MESSAGE'

export interface SongSlot {
  kind: 'SONG'
  position: number           // 0-8 in the 9-slot template
  requiredVwType: VWType     // derived from progression at creation time
  songId: string | null      // null = unfilled
  songTitle: string | null   // denormalized for list card display
  songKey: string | null     // denormalized preferred key
}

export interface ScriptureSlot {
  kind: 'SCRIPTURE'
  position: number
  book: string | null
  chapter: number | null
  verseStart: number | null
  verseEnd: number | null
}

export interface NonAssignableSlot {
  kind: 'PRAYER' | 'MESSAGE'
  position: number
}

export type ServiceSlot = SongSlot | ScriptureSlot | NonAssignableSlot

export interface ScriptureRef {
  book: string
  chapter: number
  verseStart: number
  verseEnd: number
}

export interface Service {
  id: string
  date: string              // ISO date string 'YYYY-MM-DD' — not Timestamp, for easy sorting
  progression: Progression
  teams: string[]           // ['Choir', 'Orchestra', 'Band'] — subset active for this service
  status: ServiceStatus
  slots: ServiceSlot[]      // always 9 elements, positions 0-8
  sermonPassage: ScriptureRef | null
  notes: string
  createdAt: Timestamp
  updatedAt: Timestamp
}
```

### Pattern 3: VW Slot Type Enforcement (lookup table)
**What:** A static lookup table mapping (progression, song-slot index) to required VWType.
**When to use:** At service creation to populate `requiredVwType` on each song slot; also in suggestion filter.
**Example:**
```typescript
// src/utils/slotTypes.ts
import type { Progression } from '@/types/service'
import type { VWType } from '@/types/song'

// Standard order: Song(0), Scripture(1), Song(2), Prayer(3), Scripture(4), Song(5), Song(6), Message(7), Sending Song(8)
// Song positions: 0, 2, 5, 6, 8
// For 1-2-2-3: songs at positions 0,2,5,6,8 get types 1,2,2,3,? (sending song is special)
// For 1-2-3-3: songs at positions 0,2,5,6,8 get types 1,2,3,3,?

export const PROGRESSION_SLOT_TYPES: Record<Progression, Record<number, VWType>> = {
  '1-2-2-3': {
    0: 1,  // Song 1 — Call to Worship
    2: 2,  // Song 2 — Intimate
    5: 2,  // Song 3 — Intimate
    6: 3,  // Song 4 — Ascription
    8: 3,  // Sending Song — Ascription (or allow any)
  },
  '1-2-3-3': {
    0: 1,  // Song 1 — Call to Worship
    2: 2,  // Song 2 — Intimate
    5: 3,  // Song 3 — Ascription
    6: 3,  // Song 4 — Ascription
    8: 3,  // Sending Song — Ascription
  },
}

export function buildSlots(progression: Progression): ServiceSlot[] {
  // Returns the 9-slot template pre-populated with requiredVwType
  // Positions: 0=Song, 1=Scripture, 2=Song, 3=Prayer, 4=Scripture, 5=Song, 6=Song, 7=Message, 8=Sending Song
  ...
}
```

### Pattern 4: Song Suggestion Algorithm (pure function)
**What:** A pure TypeScript function that scores and ranks songs for a given slot. No Firestore reads — operates on in-memory store data.
**When to use:** Called synchronously when user opens a song slot dropdown. Lives in `src/utils/suggestions.ts`.
**Example:**
```typescript
// src/utils/suggestions.ts
import type { Song } from '@/types/song'
import type { VWType } from '@/types/song'

const RECENT_WEEKS = 2
const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000

export interface SuggestionResult {
  song: Song
  score: number
  weeksAgo: number | null  // null = never used
  isRecent: boolean        // true if used in last 2 weeks
}

/**
 * Returns songs ranked for a given slot, filtered by VW type and team.
 * Pure function — no side effects, easily testable.
 */
export function rankSongsForSlot(
  songs: Song[],
  requiredVwType: VWType,
  serviceTeams: string[],   // e.g. ['Choir', 'Orchestra']
  nowMs: number = Date.now(),
): SuggestionResult[] {
  const twoWeeksAgo = nowMs - RECENT_WEEKS * MS_PER_WEEK

  // 1. Filter: correct VW type
  const eligible = songs.filter((s) => s.vwType === requiredVwType)

  // 2. Filter: team compatibility (song must support ALL active teams — or have no team constraint)
  // If serviceTeams is empty, no team filtering
  const teamFiltered = serviceTeams.length === 0
    ? eligible
    : eligible.filter((s) =>
        serviceTeams.every((team) => s.teamTags.length === 0 || s.teamTags.includes(team))
      )

  // 3. Score each song
  return teamFiltered.map((song) => {
    const lastUsedMs = song.lastUsedAt ? song.lastUsedAt.toMillis() : null
    const weeksAgo = lastUsedMs ? Math.floor((nowMs - lastUsedMs) / MS_PER_WEEK) : null
    const isRecent = lastUsedMs ? lastUsedMs > twoWeeksAgo : false

    // Scoring: higher = better suggestion
    // Never used: high base score (500)
    // Used but not recent: score based on staleness (older = higher)
    // Used in last 2 weeks: penalty (score capped at 100)
    let score: number
    if (lastUsedMs === null) {
      score = 500  // never used — prioritize
    } else if (isRecent) {
      score = 50 + (weeksAgo ?? 0) * 10  // recent: low score, deprioritized
    } else {
      score = 200 + Math.min((weeksAgo ?? 0) * 15, 300)  // older = higher score
    }

    return { song, score, weeksAgo, isRecent }
  }).sort((a, b) => b.score - a.score)
}
```

### Pattern 5: Scripture Overlap Detection
**What:** Compare a scripture reading slot against the sermon passage to detect same-book overlap.
**When to use:** Computed property in ServiceEditorView; fires when any scripture slot or sermonPassage changes.
**Example:**
```typescript
// Pure utility — no store dependency
export function scripturesOverlap(
  reading: ScriptureRef,
  sermon: ScriptureRef,
): boolean {
  if (reading.book !== sermon.book || reading.chapter !== sermon.chapter) return false
  // Check verse range overlap
  return reading.verseStart <= sermon.verseEnd && reading.verseEnd >= sermon.verseStart
}
```

### Pattern 6: ESV Link Generation
**What:** Build an ESV.org URL for a scripture reference.
**When to use:** In ScriptureSlot rendering — `<a :href="esvLink(slot)" target="_blank">`.
**Example:**
```typescript
// src/utils/esv.ts
export function esvLink(book: string, chapter: number, verseStart: number, verseEnd: number): string {
  // ESV.org format: https://www.esv.org/Psalm+23/  or  https://www.esv.org/John+3:16-17/
  const bookSlug = book.replace(/\s+/g, '+')
  if (verseStart === 1 && verseEnd >= 99) {
    return `https://www.esv.org/${bookSlug}+${chapter}/`
  }
  return `https://www.esv.org/${bookSlug}+${chapter}%3A${verseStart}-${verseEnd}/`
}
```

### Anti-Patterns to Avoid
- **Storing full song objects in service slots:** Only denormalize `songId`, `songTitle`, `songKey` (for list card display). Never embed the full `Song` in a service document — it creates stale data and bloated documents.
- **Calling Firestore inside the suggestion algorithm:** The algorithm must read from the in-memory Pinia store only. No async operations in the ranking logic.
- **Separate Firestore queries for the seasonal rotation table:** Use the already-fetched `services` array from the store — compute the rotation table as a pure computed property.
- **Dynamic Tailwind class strings:** Follow existing pattern — use static lookup objects (like `badgeClasses` in SongBadge.vue) to prevent Tailwind v4 purge of color classes.
- **Drag-and-drop:** Explicitly out of scope per CONTEXT.md. Click-to-fill only.
- **Using `date` as a Firestore Timestamp:** Store service date as an ISO string (`'YYYY-MM-DD'`) for easy `orderBy`, display, and comparison without Timestamp conversion edge cases.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Date "next Sunday" calculation | Custom date logic | `dayjs` or plain `Date` arithmetic | Use `Date` — already no extra dep needed; `new Date()` + `getDay()` math is 5 lines |
| Scripture book list | Manual typed list | Hardcoded constant array of 66 books | Already finite and immutable — a typed `BIBLE_BOOKS` constant is correct |
| Firestore real-time subscription | Manual polling or one-time `getDocs` | `onSnapshot` (already in codebase) | Phase 2 songs store already proves the pattern |
| Song comparison/deduplication in rotation table | Custom object comparison | Direct `songId` string comparison | IDs are already unique Firestore document IDs |
| Dropdown positioning | CSS calculation | Tailwind `absolute` + `z-50` within relative parent | No Popper.js or floating-ui needed for this fixed-layout in-slot dropdown |
| Auto-save debouncing | Manual timer management | Explicit save button (per CONTEXT.md discretion) | Simplest correct implementation — avoid losing partial writes |

**Key insight:** Every complex-seeming problem in this phase (rotation table, suggestion ranking, scripture overlap) reduces to pure TypeScript array operations on data already in the Pinia store. No additional libraries required.

---

## Common Pitfalls

### Pitfall 1: Song `lastUsedAt` Not Written Back
**What goes wrong:** Songs are assigned to service slots but `lastUsedAt` is never updated on the song document, so the suggestion algorithm always treats songs as never used.
**Why it happens:** The service store and song store are separate — easy to forget the cross-store write.
**How to avoid:** In `useServiceStore.assignSongToSlot()`, after updating the service document, also call `useSongStore().updateSong(songId, { lastUsedAt: serverTimestamp() })`.
**Warning signs:** Suggestion algorithm always returns the same top songs regardless of recent use.

### Pitfall 2: Tailwind v4 Purge of Dynamic Color Classes
**What goes wrong:** Slot type labels or service status badges use dynamic class strings like `` `bg-${color}-900` `` — classes are missing at runtime.
**Why it happens:** Tailwind v4 statically analyzes class strings at build time; dynamic strings are not detected.
**How to avoid:** Use static lookup objects like the existing `badgeClasses` pattern in `SongBadge.vue`. Define ALL color variants as complete strings in a const map.
**Warning signs:** Styles work in dev (JIT may be more permissive) but break in production build.

### Pitfall 3: Service Date Stored as Timestamp Causes Ordering/Display Issues
**What goes wrong:** Storing service date as a Firestore `Timestamp` requires `toDate()` conversion everywhere; comparing two services' dates requires `.toMillis()` math; the "next Sunday" default requires `Timestamp.fromDate()` conversion.
**Why it happens:** Natural temptation to use Timestamp for all date fields.
**How to avoid:** Store `date` as an ISO string (`'2026-03-08'`). Use `orderBy('date', 'desc')` — lexicographic sort works correctly for ISO dates. Convert to `Date` only for display.
**Warning signs:** Date comparisons returning unexpected results; Firestore `orderBy` sorting dates incorrectly.

### Pitfall 4: Suggestion Dropdown z-index Blocked by AppShell Stacking Context
**What goes wrong:** The in-slot suggestion dropdown is clipped by the scrollable content area's overflow or a stacking context, making it invisible or truncated.
**Why it happens:** AppShell uses `overflow-y-auto` on the main content area, which creates a new stacking context.
**How to avoid:** Same solution as SongSlideOver.vue — use `Teleport to="body"` for the dropdown if it needs to overflow the slot. Alternatively, use `position: fixed` with JS-computed coordinates if Teleport adds complexity.
**Warning signs:** Dropdown appears cut off at the container edge; z-index changes have no effect.

### Pitfall 5: Cross-Store orgId Dependency
**What goes wrong:** `ServiceEditorView` tries to use both `useServiceStore` and `useSongStore`, but each store's `subscribe(orgId)` is called independently in different views — one store may not yet have an orgId when the other does.
**Why it happens:** Each view manages its own store subscription lifecycle independently.
**How to avoid:** In `ServiceEditorView`, always call `songStore.subscribe(orgId)` and `serviceStore.subscribe(orgId)` in the same `onMounted` handler after resolving `orgId` from the user document (same pattern as `SongsView.vue`).
**Warning signs:** Song suggestions are empty (songStore not subscribed); service fails to load (serviceStore not subscribed).

### Pitfall 6: Seasonal Rotation Table Performance with Large Libraries
**What goes wrong:** Computing the full rotation table (songs as rows, weeks as columns) over a large song library and many past services is slow.
**Why it happens:** Naive N×M rendering (songs × weeks) with Vue reactivity.
**How to avoid:** Only show songs that appear at least once in the displayed date range (don't render all 200 songs if only 40 appear). Compute a derived `usedSongs` set from the visible services, then filter rows to that set. This is left to Claude's discretion per CONTEXT.md.
**Warning signs:** Long render time when switching to seasonal view; UI freezes briefly.

---

## Code Examples

Verified patterns from existing codebase (source: `/c/projects/worshipplanner/src/`):

### Pinia Store with onSnapshot (verified pattern from songs.ts)
```typescript
// The exact pattern to replicate in services.ts:
let unsubscribeFn: Unsubscribe | null = null

function subscribe(orgIdValue: string) {
  if (unsubscribeFn) {
    unsubscribeFn()  // always unsub previous before re-subscribing
  }
  orgId.value = orgIdValue
  const q = query(
    collection(db, 'organizations', orgIdValue, 'services'),
    orderBy('date', 'desc'),
  )
  unsubscribeFn = onSnapshot(q, (snap) => {
    services.value = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Service)
    isLoading.value = false
  })
}
```

### View Subscription Lifecycle (verified pattern from SongsView.vue)
```typescript
// Resolve orgId from user document, then subscribe both stores
async function initStore() {
  const user = authStore.user
  if (!user) return
  const userSnap = await getDoc(doc(db, 'users', user.uid))
  const orgIds: string[] = userSnap.data()?.orgIds ?? []
  if (orgIds[0]) {
    songStore.subscribe(orgIds[0])     // needed for suggestions
    serviceStore.subscribe(orgIds[0])  // needed for services
  }
}
onMounted(async () => { await initStore() })
onUnmounted(() => {
  serviceStore.unsubscribeAll()
  // NOTE: only unsubscribe songStore if this view owns the subscription
})
```

### Router Route Registration (verified from router/index.ts)
```typescript
// Add to routes array in src/router/index.ts:
{
  path: '/services',
  name: 'services',
  component: () => import('../views/ServicesView.vue'),
  meta: { requiresAuth: true },
},
{
  path: '/services/:id',
  name: 'service-editor',
  component: () => import('../views/ServiceEditorView.vue'),
  meta: { requiresAuth: true },
},
```

### Static Color Lookup (verified pattern from SongBadge.vue)
```typescript
// Use static maps — NEVER dynamic class strings like `bg-${color}-500`
// This pattern prevents Tailwind v4 purge
const statusClasses = {
  planned: 'bg-green-900/50 text-green-300 border-green-800',
  draft:   'bg-gray-800 text-gray-400 border-gray-700',
} as const
```

### AppShell Wrapper (verified pattern from SongsView.vue)
```vue
<!-- Every authenticated view wraps content in AppShell -->
<template>
  <AppShell>
    <div class="px-6 py-8">
      <!-- page content -->
    </div>
  </AppShell>
</template>

<script setup lang="ts">
import AppShell from '@/components/AppShell.vue'
</script>
```

### Teleport for Overlapping UI (verified from SongSlideOver.vue)
```vue
<!-- Use Teleport for dropdowns/panels that need to escape overflow stacking context -->
<Teleport to="body">
  <div v-if="open" class="fixed inset-0 z-40 bg-black/30" @click="close"></div>
  <div v-if="open" class="fixed ... z-50 ..."><!-- panel content --></div>
</Teleport>
```

### "Next Sunday" Date Calculation (no library needed)
```typescript
// Pure Date arithmetic — no dayjs dependency needed
function nextSunday(from: Date = new Date()): string {
  const d = new Date(from)
  const daysUntilSunday = (7 - d.getDay()) % 7 || 7
  d.setDate(d.getDate() + daysUntilSunday)
  return d.toISOString().slice(0, 10)  // 'YYYY-MM-DD'
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| VueFire composables in stores | `onSnapshot` directly in Pinia setup stores | Phase 1 decision | Simpler, no VueFire dep, explicit lifecycle |
| signInWithRedirect | signInWithPopup | Phase 1 decision (Chrome M115+ / Firefox 109+ broke redirect) | Popup works in all modern browsers |
| Dynamic Tailwind class strings | Static lookup objects | Phase 2 decision | Prevents Tailwind v4 purge at build time |
| Full Song embedded in service | Denormalized `songId`+`songTitle`+`songKey` only | Phase 1 design decision | Avoids N+1 reads; snapshot consistency |

---

## Open Questions

1. **Sending Song VW Type Constraint**
   - What we know: The 9-slot template has a "Sending Song" at position 8. The 1-2-2-3 and 1-2-3-3 progressions define types for the first 4 worship songs (positions 0, 2, 5, 6).
   - What's unclear: Should position 8 (Sending Song) always require Type 3, or is it unconstrained and accepts any type?
   - Recommendation: Default to Type 3 (Ascription) for the Sending Song in both progressions. This is the safest liturgical assumption and can be overridden per CONTEXT.md's manual override capability.

2. **Team Filtering Logic: AND vs. OR**
   - What we know: Service has `teams: ['Choir', 'Orchestra']`. Songs have `teamTags`.
   - What's unclear: Does "Choir + Orchestra active" mean a song must support BOTH (AND), or EITHER (OR)?
   - Recommendation: Use AND logic — if Choir AND Orchestra are active, only suggest songs with BOTH tags. If a song has no team tags, treat it as compatible with any configuration (standard band works for all).

3. **Service Auto-Save vs. Explicit Save**
   - What we know: CONTEXT.md leaves this to Claude's discretion.
   - What's unclear: Auto-save avoids data loss but risks partial-save states; explicit save is simpler but requires user action.
   - Recommendation: Implement explicit Save button for MVP. Add a "unsaved changes" indicator in the header. This avoids partial Firestore writes during multi-slot editing and matches the app's form-style UX philosophy.

4. **Suggestion Algorithm: `lastUsedAt` Precision**
   - What we know: `Song.lastUsedAt` is a single Timestamp — most recent use only. The algorithm needs "used in last 2 weeks."
   - What's unclear: Does a song used 13 days ago count as "last week" or "2 weeks ago"? Week boundaries matter.
   - Recommendation: Use millisecond comparison (2 × 7 × 24 × 60 × 60 × 1000) relative to `Date.now()` at the time suggestions are generated. Simple and correct for the use case.

---

## Validation Architecture

> nyquist_validation key is absent from config.json — treating as enabled.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest ^4.0.18 |
| Config file | `vite.config.ts` (test section: `environment: 'jsdom'`, excludes `src/rules.test.ts`) |
| Quick run command | `npx vitest run --reporter=verbose src/stores/__tests__/services.test.ts src/utils/suggestions.test.ts` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PLAN-01 | createService writes correct slot template to Firestore | unit (store) | `npx vitest run src/stores/__tests__/services.test.ts -t "createService"` | ❌ Wave 0 |
| PLAN-02 | progression stored on service document | unit (store) | `npx vitest run src/stores/__tests__/services.test.ts -t "progression"` | ❌ Wave 0 |
| PLAN-03 | PROGRESSION_SLOT_TYPES lookup maps correctly for both progressions | unit (util) | `npx vitest run src/utils/suggestions.test.ts -t "slotTypes"` | ❌ Wave 0 |
| PLAN-04/05 | team filter respected in suggestions | unit (util) | `npx vitest run src/utils/suggestions.test.ts -t "team filter"` | ❌ Wave 0 |
| PLAN-06 | rankSongsForSlot returns songs sorted by score, filtered by VW type | unit (util) | `npx vitest run src/utils/suggestions.test.ts -t "ranking"` | ❌ Wave 0 |
| PLAN-07 | manual search returns VW-type-filtered songs not in top suggestions | unit (util) | `npx vitest run src/utils/suggestions.test.ts -t "manual override"` | ❌ Wave 0 |
| PLAN-08 | assignSong calls updateSong with lastUsedAt serverTimestamp | unit (store) | `npx vitest run src/stores/__tests__/services.test.ts -t "lastUsedAt"` | ❌ Wave 0 |
| PLAN-09 | songs used < 2 weeks ago appear in results but with lower score | unit (util) | `npx vitest run src/utils/suggestions.test.ts -t "recency penalty"` | ❌ Wave 0 |
| SCRI-01/02 | sermonPassage and scripture slots stored correctly | unit (store) | `npx vitest run src/stores/__tests__/services.test.ts -t "scripture"` | ❌ Wave 0 |
| SCRI-03 | esvLink generates correct URL format | unit (util) | `npx vitest run src/utils/esv.test.ts` | ❌ Wave 0 |
| SCRI-04 | "Psalms" hint text rendered in ScriptureSlot | component | `npx vitest run src/components/__tests__/ScriptureSlot.test.ts` | ❌ Wave 0 |
| CAL-01 | ServicesView renders service cards sorted upcoming first | component | `npx vitest run src/components/__tests__/ServiceCard.test.ts` | ❌ Wave 0 |
| CAL-02/03 | rotation table computed from services array | unit (computed) | `npx vitest run src/utils/rotationTable.test.ts` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run src/stores/__tests__/services.test.ts src/utils/suggestions.test.ts`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/stores/__tests__/services.test.ts` — covers PLAN-01, PLAN-02, PLAN-04, PLAN-08, SCRI-01, SCRI-02
- [ ] `src/utils/suggestions.test.ts` — covers PLAN-03, PLAN-05, PLAN-06, PLAN-07, PLAN-09
- [ ] `src/utils/esv.test.ts` — covers SCRI-03
- [ ] `src/components/__tests__/ServiceCard.test.ts` — covers CAL-01
- [ ] `src/utils/rotationTable.test.ts` — covers CAL-02, CAL-03
- [ ] `src/components/__tests__/ScriptureSlot.test.ts` — covers SCRI-04
- [ ] Framework install: none required — Vitest + jsdom + @vue/test-utils already installed

---

## Sources

### Primary (HIGH confidence)
- Codebase: `src/stores/songs.ts` — verified `onSnapshot` + Pinia setup store pattern
- Codebase: `src/types/song.ts` — verified `Song` interface with `lastUsedAt: Timestamp | null`
- Codebase: `src/components/SongBadge.vue` — verified static class lookup pattern for Tailwind v4
- Codebase: `src/components/SongSlideOver.vue` — verified Teleport to body pattern for z-index
- Codebase: `src/views/SongsView.vue` — verified subscribe/unsubscribe lifecycle pattern
- Codebase: `src/router/index.ts` — verified route registration pattern with `meta: { requiresAuth: true }`
- Codebase: `firestore.rules` — verified `organizations/{orgId}/services` path is already covered by wildcard rule
- Codebase: `package.json` — verified all required libraries already installed (Vue 3.5, Firebase 12, Pinia 3, Vitest 4, @vue/test-utils 2.4)
- Codebase: `vite.config.ts` — verified test configuration (jsdom environment, excludes rules test)
- Codebase: `src/stores/__tests__/songs.test.ts` — verified mocking pattern for firebase/firestore and @/firebase

### Secondary (MEDIUM confidence)
- Project context: `03-CONTEXT.md` — user decisions binding the implementation approach
- Project context: `REQUIREMENTS.md` — requirement IDs and descriptions
- Project context: `PROJECT.md` — Vertical Worship methodology domain model (service order, progression rules, scripture selection rules)
- Project context: `STATE.md` — existing decisions (denormalize song snapshots, onSnapshot in Pinia, avoid N+1 reads)

### Tertiary (LOW confidence)
- ESV.org URL format (`esv.org/Book+Chapter:Verse-Verse`) — inferred from domain knowledge; should be validated by opening a test URL
- "Sending Song is Type 3" assumption — reasonable inference from VW methodology; should be confirmed with team

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries verified in package.json
- Firestore data model: HIGH — derived from existing Song type + established patterns
- Architecture (store, views, routes): HIGH — mirrors verified existing patterns exactly
- Suggestion algorithm design: HIGH — pure TypeScript scoring function, no external dependencies
- Pitfalls: HIGH — derived from existing codebase decisions in STATE.md
- ESV link format: MEDIUM — domain knowledge, needs manual verification
- VW slot type assignments: MEDIUM — from PROJECT.md domain description; team should confirm before shipping

**Research date:** 2026-03-03
**Valid until:** 2026-04-03 (stable stack — all deps already locked in package.json)
