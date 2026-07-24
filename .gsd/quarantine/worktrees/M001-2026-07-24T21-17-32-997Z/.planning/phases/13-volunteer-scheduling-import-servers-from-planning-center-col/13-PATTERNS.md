# Phase 13: Volunteer Role Scheduling - Pattern Map

**Mapped:** 2026-07-07
**Files analyzed:** 21 (15 source + 6 test)
**Analogs found:** 21 / 21 (every new file has a direct in-repo analog — this is a "copy the pattern, change the shape" phase)

> Every piece of infrastructure this phase needs (pure scoring util, org-scoped `onSnapshot` store, soft-delete, paginated PC fetch, CSV import + preview modal, share token, print layout, public share view, RBAC routes) already has a working, tested reference in this exact codebase. The only genuinely novel logic is the scheduler's scoring/propagation rules.

---

## File Classification

| New / Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---------------------|------|-----------|----------------|---------------|
| `src/types/roster.ts` | model (types) | — | `src/types/service.ts`, `src/types/song.ts` | role-match |
| `src/utils/scheduler.ts` | utility (pure) | transform | `src/utils/suggestions.ts` | exact (same pure-fn/inject/sort shape) |
| `src/utils/quarterDates.ts` | utility (pure) | transform | `src/utils/suggestions.ts` (shape) + `fetchPlans` date-fmt (l.138-148 `planningCenterApi.ts`) | role-match |
| `src/utils/volunteerCsv.ts` | utility (pure) | transform | `src/utils/csvImport.ts` (`mapRowToSong`/`detectDuplicates`) | exact |
| `src/utils/planningCenterApi.ts` *(MODIFY: add `fetchAllPeople`)* | service (API client) | request-response | `src/utils/pcSongImport.ts` (`fetchAllPcSongs`) | exact |
| `src/stores/roster.ts` | store | CRUD + soft-delete | `src/stores/songs.ts` | exact |
| `src/stores/quarters.ts` | store | CRUD + event-driven (propose→persist) + share | `src/stores/services.ts` | exact |
| `src/components/RosterImportModal.vue` | component | request-response (fetch→preview→commit) | `src/components/PcImportModal.vue` | exact |
| `src/components/VolunteerCsvImportModal.vue` | component | file-I/O (parse→preview→commit) | `src/components/CsvImportModal.vue` | exact |
| `src/components/QuarterGrid.vue` | component | event-driven (per-cell edit → Firestore) | `ServiceEditorView.vue` slot-edit + `CsvImportModal.vue` table | role-match |
| `src/components/RosterPrintLayout.vue` | component | transform (print CSS) | `src/components/ServicePrintLayout.vue` | exact |
| `src/views/RosterView.vue` | view | CRUD | `src/views/SongsView.vue` | role-match |
| `src/views/QuarterView.vue` | view | orchestrator (import/generate/grid/share) | `src/views/ServiceEditorView.vue` / `SongsView.vue` | role-match |
| `src/views/QuarterShareView.vue` | view | request-response (public read) | `src/views/ShareView.vue` | exact |
| `src/router/index.ts` *(MODIFY: add routes)* | route/config | — | existing routes (l.35-70) | exact |
| `src/utils/__tests__/scheduler.test.ts` | test | — | `src/utils/__tests__/suggestions.test.ts` | exact |
| `src/utils/__tests__/quarterDates.test.ts` | test | — | `src/utils/__tests__/suggestions.test.ts` | role-match |
| `src/utils/__tests__/volunteerCsv.test.ts` | test | — | `src/components/__tests__/CsvImportModal.test.ts` | role-match |
| `src/stores/__tests__/roster.test.ts` | test | — | `src/stores/__tests__/songs.test.ts` | exact |
| `src/stores/__tests__/quarters.test.ts` | test | — | `src/stores/__tests__/services.test.ts` | exact |
| `src/utils/__tests__/planningCenterApi.test.ts` *(MODIFY)* | test | — | `src/utils/__tests__/pcSongImport.test.ts` | exact |

---

## Pattern Assignments

### `src/utils/scheduler.ts` (utility, transform — THE centerpiece)

**Analog:** `src/utils/suggestions.ts` — pure function, injectable inputs, `.map(score).sort(desc)`. No Firestore/PC/`Date.now()` imports.

**Pure-function shape to copy** (`suggestions.ts` lines 25-30, 52-81):
```typescript
// Signature: plain arrays in, plain result out; nowMs-style injectable determinism
export function rankSongsForSlot(
  songs: Song[],
  requiredVwType: VWType,
  serviceTeams: string[],
  nowMs: number = Date.now(),   // ← injectable → testable; scheduler injects NOTHING (all dates come from serviceDates)
): SuggestionResult[] {
  return teamFiltered
    .map((song) => { /* ...compute score... */ return { song, score, weeksAgo, isRecent } })
    .sort((a, b) => b.score - a.score)   // ← deficit-desc sort mirrors this
}
```

**Deterministic multi-key sort to copy** (already sketched in 13-RESEARCH.md Code Examples, lines 469-479) — note the `localeCompare` final tie-break replaces suggestions.ts's single-key sort to guarantee no `Math.random()`:
```typescript
.sort((a, b) =>
  b.deficit - a.deficit ||
  (served.get(a.p.id) ?? 0) - (served.get(b.p.id) ?? 0) ||
  a.p.name.localeCompare(b.p.name),   // deterministic — never Math.random()
)
```

**Do NOT import Firestore here.** `suggestions.ts` imports only `import type { Song, VWType } from '@/types/song'`. Scheduler imports only `import type { ... } from '@/types/roster'`.

Full algorithm (outer loop = dates ascending, inner = roles in stable order, innermost = slot count; blackout gate before every assign incl. pairing propagation; `unfilled` + `pairingConflicts` arrays) is spelled out in 13-RESEARCH.md lines 375-489 — planner should lift that verbatim into TDD tasks.

---

### `src/utils/volunteerCsv.ts` (utility, transform)

**Analog:** `src/utils/csvImport.ts` — `mapRowToSong` (row→preview object with `_warnings[]`), `detectDuplicates` (match against existing).

**Row-mapping + warnings pattern** (`csvImport.ts` lines 96-161):
```typescript
export function mapRowToSong(row: Record<string, string>): ParsedSongPreview {
  const warnings: string[] = []
  const title = row['Title']?.trim() ?? row['Song Title']?.trim() ?? ''   // defensive multi-header
  if (!title) warnings.push('Missing title')
  // multi-value cell → split/trim/filter:
  const themes = themesRaw ? themesRaw.split(',').map((t) => t.trim()).filter((t) => t.length > 0) : []
  return { title, /* ... */, _warnings: warnings }
}
```
For the volunteer CSV, multi-value cells are `;`-separated (D-15) not comma. Roles = `vocals; guitar`, Blackout = `2026-07-05; 2026-08-16`, Serve-With by name.

**Name-matching pattern** (adapt `detectDuplicates`, `csvImport.ts` lines 169-191 — case-insensitive `.toLowerCase()`):
```typescript
// existing.some((e) => e.title.toLowerCase() === song.title.toLowerCase())
```
Per Pitfall 4 (RESEARCH l.317-321): normalize BOTH sides — `.trim()`, collapse internal whitespace, `.toLowerCase()` — before comparing names. Surface any non-exact-after-normalization row in the preview (map-to-existing / create-new), never silently fuzzy-match.

**`expandBlackoutCell(cell, serviceDates)`** — new logic, no direct analog; full impl in RESEARCH l.352-372. Key: iterate the finite generated-Sunday list, use lexicographic `date >= start && date <= end` (zero-padded `YYYY-MM-DD` sorts chronologically).

---

### `src/utils/quarterDates.ts` (utility, transform)

**Analog:** pure-fn shape from `suggestions.ts`; date-format helper from `planningCenterApi.ts::fetchPlans` (lines 138-139):
```typescript
const fmtDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
```
`generateSundaysInQuarter(year, quarter)` full impl in RESEARCH l.332-348. Copy the exact `fmtDate` zero-padding so date strings match everywhere (CSV, blackouts, calendar keys).

---

### `src/utils/planningCenterApi.ts` — MODIFY: append `fetchAllPeople`

**Analog:** `src/utils/pcSongImport.ts::fetchAllPcSongs` (lines 138-206) — pagination via `links.next` with proxy-URL rewrite + 429 retry.

**Existing auth + base-URL conventions in the SAME file to reuse** (`planningCenterApi.ts` lines 12-19):
```typescript
export const PC_BASE_URL = '/api/planningcenter/services/v2'
function basicAuthHeader(appId: string, secret: string): string {
  return 'Basic ' + btoa(appId + ':' + secret)
}
```

**Pagination loop to copy** (`pcSongImport.ts` lines 144-192):
```typescript
let url: string | undefined = `${PC_SONGS_BASE_URL}/songs?include=tags&per_page=100`
while (url) {
  // 429 retry respecting Retry-After:
  for (let attempt = 0; ; attempt++) {
    response = await fetch(url, { headers: { Authorization: authHeader, Accept: 'application/json' } })
    if (response.status !== 429 || attempt >= 3) break
    const retryAfter = response.headers.get('Retry-After')
    await new Promise((r) => setTimeout(r, retryAfter ? parseFloat(retryAfter) * 1000 : 60_000))
  }
  const json = await response.json()
  allSongs.push(...json.data)
  url = json.links.next
    ? json.links.next.replace('https://api.planningcenteronline.com/services/v2', PC_SONGS_BASE_URL)
    : undefined
}
```
Adapt for `GET /services/v2/people?per_page=100`. Then per person fetch `emails` via nested `GET /services/v2/people/{id}/emails`, batched in groups of 3 exactly like `fetchAndMapPcSongs` batches arrangements (`pcSongImport.ts` lines 224-244).

**CRITICAL (Pitfall 5 / Assumption A1, RESEARCH l.110, 323-327):** PC Services v2 has **no phone-number vertex**. D-14 says "name, email, phone" but phone is NOT fetchable from Services v2. Planner must descope phone from the fetch (app-only editable field) or flag with user. Do NOT wire a `phone_numbers` include/endpoint — it 404s.

**Also new (mirror `mapPcSongToUpsert`, `pcSongImport.ts` lines 54-128):** a pure `mapPcPersonToUpsert(person, emails)` → the roster upsert shape, and a `fetchAndMapPeople` orchestrator returning preview data before commit (mirrors `fetchAndMapPcSongs`, lines 218-247).

---

### `src/stores/roster.ts` (store, CRUD + soft-delete)

**Analog:** `src/stores/songs.ts` — org-scoped `onSnapshot`, `hidden` soft-delete, `upsertSongs` re-import-safe upsert. For people, `active: false` plays the inverse role of `hidden: true`.

**Store skeleton + subscribe** (`songs.ts` lines 1-26, 153-188):
```typescript
export const useSongStore = defineStore('songs', () => {
  const songs = ref<Song[]>([])
  const orgId = ref<string | null>(null)
  let unsubscribeFn: Unsubscribe | null = null

  function subscribe(orgIdValue: string) {
    if (unsubscribeFn) unsubscribeFn()
    orgId.value = orgIdValue
    const q = query(collection(db, 'organizations', orgIdValue, 'songs'), orderBy('title'))
    unsubscribeFn = onSnapshot(q, (snap) => {
      songs.value = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Song))
      isLoading.value = false
    })
  }
  function unsubscribeAll() { unsubscribeFn?.(); unsubscribeFn = null; orgId.value = null; songs.value = []; isLoading.value = true }
```

**Soft-delete / restore to copy** (`songs.ts` lines 207-221) — for people, `active` instead of `hidden`:
```typescript
async function deleteSong(id: string) {
  await updateDoc(doc(db, 'organizations', orgId.value, 'songs', id), { hidden: true, updatedAt: serverTimestamp() })
}
async function restoreSong(id: string) {
  await updateDoc(doc(db, 'organizations', orgId.value, 'songs', id), { hidden: false, updatedAt: serverTimestamp() })
}
// → deactivatePerson: { active: false }; reactivatePerson: { active: true }
```

**Filter inactive from candidate pool** (`songs.ts` lines 91-93) — scheduler/pickers use `people.filter(p => p.active)`, exactly like:
```typescript
const aiCandidateSongs = computed(() => songs.value.filter((song) => song.hidden !== true))
```

**Upsert by natural key (name), preserving standing fields** — adapt `upsertSongs` (`songs.ts` lines 223-293): build a `byName` lookup (lowercased), match, and on match preserve `active` status just as `upsertSongs` preserves `hidden` (line 262). **Pitfall 3 (RESEARCH l.311-315):** person doc holds STANDING `roles` + `frequencyTargetN` (upserted); `blackoutDates` + `pairedWith` live in a SEPARATE per-quarter record, never on the person doc.

---

### `src/stores/quarters.ts` (store, CRUD + propose-then-persist + share)

**Analog:** `src/stores/services.ts` — subscribe/create/update, plus `createShareToken`.

**Create-with-defaults** (`services.ts` lines 61-76) — mirror for `createQuarter` (generate `serviceDates` via `quarterDates.ts`, apply default role template):
```typescript
async function createService(data: CreateServiceInput): Promise<string> {
  if (!orgId.value) throw new Error('No orgId set — call subscribe() first')
  const slots = buildSlots('1-2-2-3')
  const ref = await addDoc(collection(db, 'organizations', orgId.value, 'services'), {
    ...data, progression: '1-2-2-3', slots, status: 'draft', /* ... */
    createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
  })
  return ref.id
}
```

**Propose→persist action** — gather live state, call the PURE `proposeQuarterSchedule(...)`, write result in one `updateDoc` (same shape as `createShareToken` computing a snapshot then writing once). Per-cell grid edits = small `updateDoc` on `quarters/{id}.calendar`, mirroring `services.ts::updateService` (lines 78-84).

**Per-person CSV replace (D-19)** — `applyCsvToQuarter`: for each person in the CSV, fully REPLACE their `personQuarterData` entry (blackouts/frequency/serve-with); leave absent people untouched. Store blackouts/pairings in a per-quarter subcollection/map, NOT merged into the person doc (Pitfall 3 + anti-pattern, RESEARCH l.282).

**Share token to copy verbatim** (`services.ts` lines 137-176):
```typescript
async function createShareToken(service: Service, orgIdValue: string): Promise<string> {
  const array = new Uint8Array(18)
  crypto.getRandomValues(array)
  const token = Array.from(array, (b) => b.toString(16).padStart(2, '0')).join('')
  await setDoc(doc(db, 'shareTokens', token), {
    serviceId: service.id, orgId: orgIdValue,
    serviceSnapshot: { /* denormalized read-only copy */ },
    createdAt: serverTimestamp(),
  })
  return token
}
```
For the quarter, write a `quarterSnapshot` (dates × roles × assigned names). See Shared Patterns → Share Token.

---

### `src/components/RosterImportModal.vue` (component, fetch→preview→commit)

**Analog:** `src/components/PcImportModal.vue` — copy near-verbatim (Teleport + backdrop/modal transitions, step state machine, credential guard, add/update preview counts).

**Step state machine** (`PcImportModal.vue` lines 238-262):
```typescript
type Step = 'idle' | 'fetching' | 'preview' | 'importing' | 'done' | 'error'
const step = ref<Step>('idle')
watch(() => props.open, (isOpen) => { if (isOpen) resetToIdle() })
```

**Credential-gated fetch + error handling** (`PcImportModal.vue` lines 285-314):
```typescript
async function onStartFetch() {
  const creds = authStore.pcCredentials
  if (!creds) return
  step.value = 'fetching'
  try {
    const songs = await fetchAndMapPcSongs(creds.appId, creds.secret)
    preview.value = classifySongs(songs, songStore.songs)
    step.value = 'preview'
  } catch (err: unknown) {
    errorMessage.value = err instanceof Error ? err.message : 'An unknown error occurred'
    step.value = 'error'
  }
}
```
Uses `authStore.pcCredentials` / `authStore.hasPcCredentials` (auth.ts lines 43-57) — no new auth UI. Swap `fetchAndMapPcSongs`→`fetchAndMapPeople`, `songStore.upsertSongs`→`rosterStore.upsertPeople`.

---

### `src/components/VolunteerCsvImportModal.vue` (component, file-I/O + name-match preview)

**Analog:** `src/components/CsvImportModal.vue` — drop-zone/file-input, PapaParse, preview table with per-row status (New/Duplicate/Warning), checkbox selection, progress bar.

**PapaParse invocation to copy** (`CsvImportModal.vue` lines 402-430):
```typescript
Papa.parse<Record<string, string>>(file, {
  header: true,
  skipEmptyLines: true,
  complete(results) {
    detectedColumns.value = results.meta.fields ?? []
    const mapped = results.data.map((row) => mapRowToSong(row))
    const withDuplicates = detectDuplicates(mapped, songStore.songs)
    previewSongs.value = withDuplicates
    checkedRows.value = withDuplicates.map((s) => !s.isDuplicate)
    step.value = 'preview'
  },
  error(err) { step.value = 'select' },
})
```
Swap `mapRowToSong`→`parseVolunteerCsvRow`, `detectDuplicates`→`matchNameToPerson`. The per-row status column (lines 201-211) becomes: matched / unmatched-ambiguous (needs map-or-create) / warning (blackout date outside quarter). This is the D-16 preview-resolution surface.

---

### `src/components/QuarterGrid.vue` (component, event-driven grid)

**Analog (structure):** `CsvImportModal.vue` preview `<table>` (lines 143-215) for the dates×roles table shell + dark-mode cell styling. **Analog (edit-writes-to-Firestore):** `ServiceEditorView.vue` slot editing → `services.ts::updateService`.

No exact grid analog exists (see No Analog Found). Reuse: table markup + dark palette from CsvImportModal; per-cell click → store action (`assignPerson`/`clearAssignment`/`swap`) that does a scoped `updateDoc`. Gap-filling side panel (D-23: who blacked out + available-unassigned candidates per cell) is net-new UI — derive from `personQuarterData` + `people.filter(active && role && !blackedOut)`.

---

### `src/components/RosterPrintLayout.vue` (component, print CSS)

**Analog:** `src/components/ServicePrintLayout.vue` — copy the print-only wrapper + header + `break-inside-avoid` rows.

**Print wrapper to copy** (`ServicePrintLayout.vue` lines 1-21):
```vue
<div class="hidden print:block bg-white text-gray-900 font-sans text-sm p-8">
  <div class="border-b border-gray-300 pb-3 mb-4">
    <h1 class="text-lg font-bold text-gray-900">{{ formattedDate }}</h1>
    ...
  </div>
  <div v-for="(slot, index) in props.service.slots"
       :key="..." data-slot-row class="py-1.5 border-b border-gray-100 break-inside-avoid">
```
Rows become one-per-Sunday (or one table) with role→people; keep `break-inside-avoid` so dates don't split across pages.

---

### `src/views/QuarterShareView.vue` (view, public read)

**Analog:** `src/views/ShareView.vue` — public route, load snapshot by token, light-theme read-only render.

**Token load to copy** (`ShareView.vue` lines 136-151):
```typescript
onMounted(async () => {
  const token = useRoute().params.token as string
  try {
    const snap = await getDoc(doc(db, 'shareTokens', token))
    if (!snap.exists()) notFound.value = true
    else serviceSnapshot.value = snap.data().serviceSnapshot
  } catch { notFound.value = true } finally { isLoading.value = false }
})
```
Render `quarterSnapshot` (dates × roles × names) instead of `serviceSnapshot`. RESEARCH (l.217) notes you may either add a new view OR extend `ShareView.vue`'s snapshot into a discriminated union — planner's call.

---

### `src/router/index.ts` — MODIFY: add routes

**Analog:** existing route entries (lines 35-70). Add authenticated editor routes for roster + quarter, and a PUBLIC (no `requiresAuth`) share route.

**Route shapes to copy** (lines 36-70):
```typescript
{ path: '/songs', name: 'songs', component: () => import('../views/SongsView.vue'),
  meta: { requiresAuth: true, requiresEditor: true } },
// public — note the intentional absence of meta:
{ path: '/share/:token', name: 'share', component: () => import('../views/ShareView.vue') },
```
Roster/quarter → `meta: { requiresAuth: true, requiresEditor: true }` (roster PII is editor-only, mirroring `songs`; see Security V4). Quarter share → no meta, like `/share/:token`.

---

### Test files

| New test | Analog | Copy |
|----------|--------|------|
| `src/utils/__tests__/scheduler.test.ts` | `src/utils/__tests__/suggestions.test.ts` | pure-fn table-driven asserts; cover D-02/04/06/07/08/09/10/11/12 per RESEARCH test map (l.551-558) |
| `src/utils/__tests__/quarterDates.test.ts` | `suggestions.test.ts` (shape) | Sunday-generation edge cases (quarter boundaries) |
| `src/utils/__tests__/volunteerCsv.test.ts` | `components/__tests__/CsvImportModal.test.ts` + `csvImport` usage | range expansion, name-match normalization |
| `src/stores/__tests__/roster.test.ts` | `src/stores/__tests__/songs.test.ts` | subscribe/upsert/soft-delete (active) |
| `src/stores/__tests__/quarters.test.ts` | `src/stores/__tests__/services.test.ts` | per-person replace (D-19), share token |
| `src/utils/__tests__/planningCenterApi.test.ts` *(extend)* | `pcSongImport.test.ts` | `fetchAllPeople` pagination + 429 |

Framework: Vitest (already configured). Run: `npx vitest run <file>`. Full: `npm run test:unit`.

---

## Shared Patterns

### PC Credentials (reuse — no new auth code)
**Source:** `src/stores/auth.ts` lines 43-57
**Apply to:** `RosterImportModal.vue`, `fetchAllPeople` callers
```typescript
const hasPcCredentials = computed(() =>
  pcAppId.value !== null && pcSecret.value !== null && pcAppId.value !== '' && pcSecret.value !== '')
const pcCredentials = computed(() => hasPcCredentials.value ? { appId: pcAppId.value!, secret: pcSecret.value! } : null)
```
Phase 8's `SettingsView.vue` PC section already collects/masks these — no new credential UI.

### Org-scoped store lifecycle (subscribe / unsubscribeAll)
**Source:** `src/stores/songs.ts` lines 153-188 (also `services.ts` 35-59)
**Apply to:** `roster.ts`, `quarters.ts` — every store: `if (unsubscribeFn) unsubscribeFn()` → `onSnapshot(query(collection(db, 'organizations', orgId, '<coll>'), orderBy(...)))` → map `{ id: d.id, ...d.data() }`; `unsubscribeAll` resets refs. Views call `subscribe(authStore.orgId)` once org resolves.

### Firestore write conventions
**Source:** `songs.ts` 190-221, `services.ts` 61-89
**Apply to:** all store mutations — `addDoc`/`updateDoc`/`setDoc` under `organizations/{orgId}/...`, always with `updatedAt: serverTimestamp()` (and `createdAt` on create). Soft-delete via boolean flag, never `deleteDoc`, for people (D-20).

### Share Token (crypto-random, snapshot write)
**Source:** `src/stores/services.ts` lines 137-176 + `ShareView.vue` load (136-151)
**Apply to:** `quarters.ts::createQuarterShareToken` + `QuarterShareView.vue`
```typescript
const array = new Uint8Array(18); crypto.getRandomValues(array)
const token = Array.from(array, (b) => b.toString(16).padStart(2, '0')).join('')
await setDoc(doc(db, 'shareTokens', token), { orgId, quarterSnapshot: {...}, createdAt: serverTimestamp() })
```
Existing `shareTokens` Firestore rule already covers the new doc shape (RESEARCH l.564, 596) — no rules change.

### CSV multi-value cell + case-insensitive matching
**Source:** `src/utils/csvImport.ts` 96-191 (+ `songs.ts::upsertSongs` `.toLowerCase()` matching, 234-248)
**Apply to:** `volunteerCsv.ts`, roster name-match. Split → `map(trim)` → `filter(Boolean)`; normalize (trim + collapse whitespace + lowercase) both sides before comparing names (Pitfall 4).

### Import modal step-machine + preview/confirm
**Source:** `PcImportModal.vue` 238-326, `CsvImportModal.vue` 322-472
**Apply to:** both new import modals — `Step` union, `watch(() => props.open, reset)`, fetch/parse → classify → preview counts/table → confirm → done/error, `emit('imported', count)`. Dark palette: `bg-gray-900` card, `bg-gray-800` inputs, `bg-indigo-600` primary, green/blue/red/yellow status pills.

### Pure-function util (no I/O, injectable, sorted)
**Source:** `src/utils/suggestions.ts` (whole file)
**Apply to:** `scheduler.ts`, `quarterDates.ts`, `volunteerCsv.ts` — `import type` only, no Firestore/PC/`Date.now()`, return plain objects, deterministic sort with explicit tie-break keys (never `Math.random()`).

---

## No Analog Found

| File / Concern | Role | Data Flow | Reason — planner uses RESEARCH.md instead |
|----------------|------|-----------|-------------------------------------------|
| `scheduler.ts` core algorithm (deficit scoring + pairing propagation + unfilled/conflict tracking) | utility | transform | Greenfield logic — no prior scheduling code in repo. The *shape* copies `suggestions.ts`, but the scoring/propagation rules are novel. Full reference impl: 13-RESEARCH.md lines 375-489. |
| `QuarterGrid.vue` dates×roles editable grid + gap-filling side panel (D-22/D-23) | component | event-driven | No 2-D assignment grid exists in the app. Borrow table markup + dark styling from `CsvImportModal.vue` and edit-write pattern from `ServiceEditorView.vue`, but the grid + per-gap blackout/candidate panel is net-new UI. |
| `expandBlackoutCell` range expansion (D-17) | utility | transform | No date-range logic in repo. Reference impl: 13-RESEARCH.md lines 352-372 (iterate finite Sunday list, lexicographic compare). |
| Role list + role-count template editor (D-02/D-03) | config UI | CRUD | No editable-config-list UI precedent that maps cleanly; simple org-level collection following the standard store pattern — planner designs shape (Claude's Discretion). |

---

## Metadata

**Analog search scope:** `src/stores/`, `src/utils/`, `src/components/`, `src/views/`, `src/types/`, `src/router/`
**Files scanned:** 12 read in full/part (`songs.ts`, `services.ts`, `auth.ts`, `suggestions.ts`, `pcSongImport.ts`, `planningCenterApi.ts`, `csvImport.ts`, `PcImportModal.vue`, `CsvImportModal.vue`, `ServicePrintLayout.vue`, `ShareView.vue`, `router/index.ts`) + `types/service.ts`
**Pattern extraction date:** 2026-07-07
**Key upstream refs consulted:** 13-CONTEXT.md (D-01..D-25), 13-RESEARCH.md (Recommended Project Structure l.196-218, Code Examples l.329-489, Pitfalls l.297-327)
</content>
</invoke>
