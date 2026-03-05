# Phase 08: Planning Center API Export - Research

**Researched:** 2026-03-04
**Domain:** Planning Center Services REST API v2 (JSON:API), Vue 3 + Pinia, Firestore credential storage
**Confidence:** MEDIUM — PC API endpoints confirmed via Dart SDK docs and community research; CORS status unverified without live test

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Personal Access Token authentication (App ID + Secret), NOT OAuth2
- User generates token at planningcenteronline.com/api_passwords
- Credentials stored org-level in Firestore `organizations/{orgId}` (shared across all editors)
- Credentials masked (dots/asterisks) after saving — can clear/re-enter but not read back
- Validate credentials on save with a test API call — show immediate success/error feedback
- SONG slots → PC Song item type (plain text title + key, no PC song library matching)
- HYMN slots → PC Song item type (hymn name/number as plain text)
- SCRIPTURE slots → PC Item entries with full ESV text in description
- PRAYER slots → PC Item entries (title: "Prayer")
- MESSAGE slots → PC Item entries with sermon passage reference in description
- One-way, one-and-done export — services are marked "exported" after, no sync back
- Re-export always creates a brand new PC plan, never updates the previous one
- Track export status on service document: `pcExportedAt` timestamp + `pcPlanId`
- Exported services show visual indicator (badge/dimmed/read-only)
- Partial failure: report partial success, don't roll back the plan
- Loading state: spinner + "Exporting..." text, button disabled during export
- Success: green inline toast "Exported to Planning Center" — auto-dismisses
- Error: red inline banner with error message — stays until dismissed
- Fetch available service types from PC API after credentials validated
- User selects which PC service type (default: "Sunday Gathering")
- Service type selection in Settings alongside credentials, or one-time prompt on first export
- Service status "planned" = exportable (no new "locked" status)
- Show "Export to PC" when credentials configured; fall back to "Copy for PC" when no credentials
- Export button only in ServiceEditorView (not ServicesView cards)
- Button hidden entirely for draft services (no disabled/grayed state)

### Claude's Discretion
- PC API request batching/sequencing strategy
- Error message wording and toast timing
- Settings UI layout for the credentials section
- How to store/retrieve the PC plan URL after export

### Deferred Ideas (OUT OF SCOPE)
- None — discussion stayed within phase scope
</user_constraints>

---

## Summary

This phase adds a one-way export from WorshipPlanner to Planning Center Services via the PC REST API v2. The API uses JSON:API 1.0 specification and Personal Access Token auth via HTTP Basic Auth (App ID + Secret as username:password). The export sequence is: (1) validate credentials with a test API call, (2) fetch service types, (3) create a Plan under the selected service type, (4) POST each slot as an Item in sequence.

The critical architecture question is CORS. The Planning Center API's CORS policy is unconfirmed from available public documentation — all official examples use server-side languages. However, this project already calls the ESV API directly from the browser (`esvApi.ts`), which means direct browser-to-third-party-API calls are an established pattern here. The safest approach is to add a Vite dev proxy for Planning Center (same pattern as Anthropic) and test whether the PC API returns proper CORS headers in production. If it does not, a Firebase Cloud Function proxy becomes necessary. This is the primary open question for planning.

The app has no Firebase Functions currently (firebase.json has no `functions` key, no `/functions` directory). Adding Cloud Functions would be a meaningful infrastructure change. Given the project pattern of calling external APIs directly from the browser (ESV API, proxied Anthropic API), **the recommended first attempt is direct browser fetch with a Vite dev proxy**, treating a potential CORS failure as a fallback contingency that adds a Cloud Function.

**Primary recommendation:** Build `planningCenterApi.ts` utility with direct `fetch()` calls using Basic Auth headers, add a Vite dev proxy for development, and architect to make the base URL swappable if a production proxy is needed. Implement sequentially: validate → fetch service types → create plan → add items in order.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `fetch` (native) | Browser native | HTTP requests to PC API | No extra dep needed; already used in `esvApi.ts` |
| `firebase/firestore` | ^12.0.0 (already installed) | Store PC credentials org-level | Established project pattern for org data |
| Vue 3 Composition API | ^3.5.29 (already installed) | UI components and reactive state | Project standard |
| Pinia | ^3.0.4 (already installed) | Auth store extensions | Project standard |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Vite dev proxy | Built into Vite 7 (already installed) | Proxy PC API calls in dev to avoid CORS | Development only; same pattern as Anthropic proxy |
| `esvApi.ts` | Existing | Fetch scripture text for SCRIPTURE items | Already integrated — reuse directly |
| `planningCenterExport.ts` | Existing | `formatScriptureRef()` utility | Reuse for building item titles/descriptions |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Direct browser fetch | Firebase Cloud Function proxy | Functions add infra complexity; try direct fetch first since ESV API works the same way |
| Direct browser fetch | `@planningcenter/api-client` npm package | Unofficial/community package; adds a dep for what's essentially a few `fetch()` calls |
| Sequential item POSTs | Batch/parallel POSTs | PC API rate limit is 100 req/min — sequential is safer and simpler; order preservation guaranteed |

**Installation:** No new packages needed. All dependencies are already installed.

---

## Architecture Patterns

### Recommended Project Structure
```
src/
├── utils/
│   ├── planningCenterApi.ts   # NEW: PC API client (auth, plan creation, item creation)
│   └── planningCenterExport.ts  # EXISTING: reuse formatScriptureRef()
├── stores/
│   └── auth.ts                # EXTEND: expose pcCredentials computed, pcServiceTypeId
├── views/
│   ├── SettingsView.vue       # EXTEND: add PC credentials + service type section
│   └── ServiceEditorView.vue  # EXTEND: conditional Export to PC button + export logic
└── types/
    └── service.ts             # EXTEND: add pcExportedAt, pcPlanId to Service interface
```

### Pattern 1: PC API Client Utility

**What:** A standalone TypeScript module with typed functions for each PC API operation. All functions accept credentials as parameters (never read from env vars directly — they come from Firestore).

**When to use:** All Planning Center API calls go through this module. Import in views/composables, not stores.

**Example:**
```typescript
// src/utils/planningCenterApi.ts

const PC_BASE_URL = 'https://api.planningcenteronline.com/services/v2'

function basicAuthHeader(appId: string, secret: string): string {
  return 'Basic ' + btoa(`${appId}:${secret}`)
}

export async function validatePcCredentials(
  appId: string,
  secret: string
): Promise<{ valid: boolean; error?: string }> {
  try {
    const res = await fetch(`${PC_BASE_URL}/service_types?per_page=1`, {
      headers: {
        Authorization: basicAuthHeader(appId, secret),
        Accept: 'application/json',
      },
    })
    if (res.status === 401) return { valid: false, error: 'Invalid credentials' }
    if (!res.ok) return { valid: false, error: `API error: ${res.status}` }
    return { valid: true }
  } catch (e) {
    return { valid: false, error: 'Network error' }
  }
}

export async function fetchServiceTypes(
  appId: string,
  secret: string
): Promise<Array<{ id: string; name: string }>> {
  const res = await fetch(`${PC_BASE_URL}/service_types?per_page=100`, {
    headers: {
      Authorization: basicAuthHeader(appId, secret),
      Accept: 'application/json',
    },
  })
  if (!res.ok) throw new Error(`Failed to fetch service types: ${res.status}`)
  const json = await res.json()
  return (json.data as Array<{ id: string; attributes: { name: string } }>).map((st) => ({
    id: st.id,
    name: st.attributes.name,
  }))
}

export async function createPlan(
  appId: string,
  secret: string,
  serviceTypeId: string,
  title: string,
  dates?: string // ISO date string
): Promise<string> { // returns PC plan ID
  const body = {
    data: {
      type: 'Plan',
      attributes: {
        title,
        // dates attribute sets the plan's date in PC
        ...(dates ? { dates } : {}),
      },
    },
  }
  const res = await fetch(`${PC_BASE_URL}/service_types/${serviceTypeId}/plans`, {
    method: 'POST',
    headers: {
      Authorization: basicAuthHeader(appId, secret),
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Failed to create plan: ${res.status} — ${err}`)
  }
  const json = await res.json()
  return json.data.id as string
}

// item_type values: 'song_arrangement' for songs, 'regular' for other items
export async function createItem(
  appId: string,
  secret: string,
  serviceTypeId: string,
  planId: string,
  params: {
    title: string
    itemType: 'song_arrangement' | 'regular' | 'header' | 'media'
    description?: string
    sequence?: number
  }
): Promise<string> { // returns PC item ID
  const body = {
    data: {
      type: 'Item',
      attributes: {
        title: params.title,
        item_type: params.itemType,
        ...(params.description ? { html_details: params.description } : {}),
        ...(params.sequence !== undefined ? { sequence: params.sequence } : {}),
      },
    },
  }
  const res = await fetch(
    `${PC_BASE_URL}/service_types/${serviceTypeId}/plans/${planId}/items`,
    {
      method: 'POST',
      headers: {
        Authorization: basicAuthHeader(appId, secret),
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(body),
    }
  )
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Failed to create item: ${res.status} — ${err}`)
  }
  const json = await res.json()
  return json.data.id as string
}
```

### Pattern 2: Credential Storage in Firestore

**What:** Store PC credentials in the `organizations/{orgId}` document. The auth store exposes a computed that indicates whether credentials are present.

**When to use:** On settings save and whenever the export button needs to show/hide.

```typescript
// In Firestore org document:
// organizations/{orgId} = {
//   name: "...",
//   pcAppId: "abc123",       // stored in plaintext (user's own org credential)
//   pcSecret: "xyz789",      // stored in plaintext
//   pcServiceTypeId: "12345" // selected service type ID
// }

// In auth store — add reactive fields:
const pcAppId = ref<string | null>(null)
const pcSecret = ref<string | null>(null)
const pcServiceTypeId = ref<string | null>(null)
const hasPcCredentials = computed(
  () => pcAppId.value !== null && pcSecret.value !== null
)
```

**Security note:** Storing App ID + Secret in Firestore is acceptable for this use case (single-org, user's own Planning Center account). Firestore security rules should restrict reads to members of the org. This matches the existing pattern for how org-level data is stored.

### Pattern 3: Export Sequence

**What:** The export runs as a sequential async operation in ServiceEditorView.

**When to use:** On "Export to PC" button click, for planned services only.

```typescript
async function onExportToPC() {
  if (!localService.value || localService.value.status !== 'planned') return
  if (!authStore.hasPcCredentials) return

  isExporting.value = true
  exportError.value = null

  try {
    const { appId, secret, serviceTypeId } = authStore.pcCredentials!

    // 1. Build plan title: "Revelation 12 (Choir)" format
    const title = buildPlanTitle(localService.value)

    // 2. Create the plan
    const planId = await createPlan(appId, secret, serviceTypeId, title, localService.value.date)

    // 3. Add items sequentially, track failures
    const failures: string[] = []
    let sequence = 1
    for (const slot of localService.value.slots) {
      try {
        await addSlotAsItem(appId, secret, serviceTypeId, planId, slot, sequence)
        sequence++
      } catch (e) {
        failures.push(slotLabel(slot))
      }
    }

    // 4. Mark service as exported in Firestore
    await serviceStore.updateService(localService.value.id, {
      pcExportedAt: serverTimestamp(),
      pcPlanId: planId,
    })

    // 5. Show feedback
    if (failures.length > 0) {
      exportError.value = `Plan created but ${failures.length} item(s) failed: ${failures.join(', ')}`
    } else {
      pcExported.value = true
      setTimeout(() => { pcExported.value = false }, 3000)
    }
  } catch (e) {
    exportError.value = e instanceof Error ? e.message : 'Export failed'
  } finally {
    isExporting.value = false
  }
}
```

### Pattern 4: Vite Dev Proxy for Planning Center

**What:** Add a proxy entry in `vite.config.ts` to avoid CORS during development.

**Example:**
```typescript
// vite.config.ts — add to server.proxy:
'/api/planningcenter': {
  target: 'https://api.planningcenteronline.com',
  changeOrigin: true,
  rewrite: (path) => path.replace(/^\/api\/planningcenter/, ''),
},
```

Then in `planningCenterApi.ts`:
```typescript
// Use environment-aware base URL
const PC_BASE_URL = import.meta.env.DEV
  ? '/api/planningcenter/services/v2'
  : 'https://api.planningcenteronline.com/services/v2'
```

**Note:** In production (Firebase Hosting), whether `api.planningcenteronline.com` returns CORS headers is unverified. The Vite proxy only helps during development. If production CORS fails, a Firebase Cloud Function proxy will be needed.

### Anti-Patterns to Avoid

- **Exposing raw credentials in computed/template:** Always pass credentials through function calls, never bind them to template refs that could be logged/leaked.
- **Parallel item POSTs:** PC API has a 100 req/min rate limit per organization. Sequential POSTs preserve order and stay well within limits.
- **Rolling back the PC plan on partial failure:** Per locked decisions, report partial success — don't delete the created plan.
- **Storing credential values in Pinia reactive state without clearing on logout:** Clear `pcAppId`/`pcSecret` in the auth store's logout function.
- **Attempting to update an existing PC plan:** Per locked decisions, re-export always creates a brand new plan.
- **Showing the export button for draft services:** Button must be absent (not disabled) for draft services.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Scripture text for export | Custom scripture text fetcher | Existing `esvApi.ts` `fetchPassageText()` | Already integrated and tested |
| Scripture ref formatting | Custom formatter | Existing `formatScriptureRef()` in `planningCenterExport.ts` | Already tested |
| Basic auth header | Custom base64 encoding logic | `btoa()` (browser native) | Standard approach; `btoa()` is available in all modern browsers |
| Plan title building | Inline ad-hoc string construction | Dedicated `buildPlanTitle(service)` function in `planningCenterApi.ts` | Testable, reusable |
| Credential masking UI | Custom masking component | Native `<input type="password">` with controlled value display | Standard pattern; show dots automatically |

**Key insight:** The Planning Center API is a simple JSON:API REST service. The only custom code needed is straightforward `fetch()` calls with a Basic Auth header and JSON bodies. No SDK, wrapper library, or complex abstraction needed.

---

## Common Pitfalls

### Pitfall 1: CORS in Production
**What goes wrong:** The Vite dev proxy handles CORS during development, but in production (Firebase Hosting serving the SPA), browser fetch calls go directly to `api.planningcenteronline.com`. If PC's API does not include `Access-Control-Allow-Origin: *` (or the specific hosting domain) in responses, all API calls will fail silently in production even though they worked in dev.
**Why it happens:** The Vite proxy only runs in dev. The ESV API (`api.esv.org`) apparently supports CORS since `esvApi.ts` calls it directly without a proxy even in production. PC's CORS policy is not publicly documented.
**How to avoid:** Test the export against a real PC account in a production build before shipping. If CORS fails, add a Firebase Cloud Function that proxies the PC API calls server-side.
**Warning signs:** Export works in `npm run dev` but fails in `npm run preview` or deployed build with a CORS error in the browser console.

### Pitfall 2: Credential Security and Firestore Rules
**What goes wrong:** Storing App ID + Secret in the Firestore `organizations/{orgId}` document is readable by anyone with access to that document. If Firestore rules are too permissive, credentials could be read by non-members.
**Why it happens:** Credentials are stored in the org document for shared access across editors.
**How to avoid:** Verify Firestore rules restrict `organizations/{orgId}` reads to authenticated members of that org. Check `firestore.rules` before implementing.
**Warning signs:** Current rules were built before this feature — check whether org document reads are member-gated.

### Pitfall 3: item_type Value for Song Items
**What goes wrong:** Using the wrong `item_type` when creating song items. The PC API `item_type` for song items is `"song_arrangement"` (not `"song"`). Using `"regular"` for songs creates a generic item that cannot link to PC's song library later.
**Why it happens:** The API documentation is JavaScript-disabled and the Dart SDK docs describe the value as `"song_arrangement"`.
**How to avoid:** Use `item_type: "song_arrangement"` for SONG and HYMN slots. Use `item_type: "regular"` for SCRIPTURE, PRAYER, and MESSAGE slots. This is MEDIUM confidence — verify with a real API call.
**Warning signs:** Items appear in PC as generic items rather than song items; no song icon in PC UI.

### Pitfall 4: PC Plan Date Format
**What goes wrong:** Sending a malformed date to the `dates` attribute when creating a plan.
**Why it happens:** PC plans use a specific date format. The service uses `"YYYY-MM-DD"` strings internally.
**How to avoid:** Pass the service date string directly — PC appears to accept ISO date strings. Verify in the first integration test.
**Warning signs:** Plan is created without a date, or API returns a 422 error.

### Pitfall 5: ESV Text in `html_details` vs `description`
**What goes wrong:** Sending scripture text to the wrong field. PC Items have `html_details` (rich text) and a plain `description` field.
**Why it happens:** The Dart SDK shows both `description` and `htmlDetails` as writable. Scripture text from ESV API contains verse numbers that work better as plain text.
**How to avoid:** Use `html_details` for scripture text (PC renders it in the item detail view). Strip any HTML entities from ESV response if sending as plain text.
**Warning signs:** Scripture text does not appear in PC item description after export.

### Pitfall 6: Credential Field Not Cleared on Settings Save Without Re-Entry
**What goes wrong:** If the user views Settings and sees masked credentials (dots), then saves without touching the credential fields, the empty form values overwrite the stored credentials with empty strings.
**Why it happens:** The Settings form shows masked placeholder text but the actual input value is empty (like `<input type="password" placeholder="••••••">` with empty value).
**How to avoid:** Track whether the credential fields have been touched. Only update Firestore if the fields contain non-empty, non-placeholder values. Add a "clear credentials" button separate from the save flow.
**Warning signs:** Credentials disappear after user visits Settings and clicks Save without changing anything.

---

## Code Examples

### Building the Plan Title
```typescript
// Source: CONTEXT.md — "sermon scripture reference + special info in parens"
// Example: "Revelation 12 (Choir)"
function buildPlanTitle(service: Service): string {
  const parts: string[] = []

  // Primary: sermon passage reference
  if (service.sermonPassage) {
    parts.push(formatScriptureRef(service.sermonPassage)) // reuse existing util
  } else if (service.name) {
    parts.push(service.name)
  } else {
    parts.push('Service') // fallback
  }

  // Append special info (teams) in parens if present
  if (service.teams.length > 0) {
    parts[0] = `${parts[0]} (${service.teams.join(', ')})`
  }

  return parts[0]
}
```

### Slot-to-Item Mapping
```typescript
// Source: CONTEXT.md decisions
async function addSlotAsItem(
  appId: string,
  secret: string,
  serviceTypeId: string,
  planId: string,
  slot: ServiceSlot,
  sequence: number,
  songs: Song[],
): Promise<void> {
  if (slot.kind === 'SONG') {
    const song = songs.find((s) => s.id === (slot as SongSlot).songId)
    const title = song ? `${song.title} (Key: ${(slot as SongSlot).songKey})` : '[Empty Song]'
    await createItem(appId, secret, serviceTypeId, planId, {
      title,
      itemType: 'song_arrangement',
      sequence,
    })
  } else if (slot.kind === 'HYMN') {
    const hymnSlot = slot as HymnSlot
    const title = hymnSlot.hymnName
      ? `${hymnSlot.hymnName}${hymnSlot.hymnNumber ? ` #${hymnSlot.hymnNumber}` : ''}`
      : '[Empty Hymn]'
    await createItem(appId, secret, serviceTypeId, planId, {
      title,
      itemType: 'song_arrangement',
      sequence,
    })
  } else if (slot.kind === 'SCRIPTURE') {
    const scriptureSlot = slot as ScriptureSlot
    let title = 'Scripture'
    let description: string | undefined
    if (scriptureSlot.book) {
      const ref = `${scriptureSlot.book} ${scriptureSlot.chapter}${
        scriptureSlot.verseStart ? `:${scriptureSlot.verseStart}-${scriptureSlot.verseEnd}` : ''
      }`
      title = ref
      // Fetch ESV text for description
      try {
        description = await fetchPassageText(ref) // existing esvApi.ts
      } catch {
        // ESV fetch failed — export item without description
      }
    }
    await createItem(appId, secret, serviceTypeId, planId, {
      title,
      itemType: 'regular',
      description,
      sequence,
    })
  } else if (slot.kind === 'PRAYER') {
    await createItem(appId, secret, serviceTypeId, planId, {
      title: 'Prayer',
      itemType: 'regular',
      sequence,
    })
  } else if (slot.kind === 'MESSAGE') {
    await createItem(appId, secret, serviceTypeId, planId, {
      title: 'Message',
      itemType: 'regular',
      sequence,
    })
  }
}
```

### Credential Masking in Settings UI
```vue
<!-- Masked display: show dots if saved, empty input for new entry -->
<div class="flex items-center gap-2">
  <input
    v-if="!hasPcCredentials || editingPcCreds"
    v-model="pcAppId"
    type="text"
    placeholder="App ID"
    class="bg-gray-800 border border-gray-700 text-gray-100 rounded-md px-3 py-2 text-sm ..."
  />
  <span v-else class="text-gray-400 text-sm font-mono">••••••••••</span>
</div>
```

---

## API Reference (Verified Facts)

### Authentication
- **Method:** HTTP Basic Auth — `Authorization: Basic base64(appId:secret)`
- **Credentials obtained at:** `https://api.planningcenteronline.com/oauth/applications` → "Personal Access Tokens"
- **Confidence:** HIGH (multiple sources confirm this pattern)

### Base URL
- `https://api.planningcenteronline.com/services/v2`

### Key Endpoints
| Operation | Method | Endpoint |
|-----------|--------|----------|
| Validate credentials / list service types | GET | `/service_types` |
| Create a Plan | POST | `/service_types/{serviceTypeId}/plans` |
| Create an Item in a Plan | POST | `/service_types/{serviceTypeId}/plans/{planId}/items` |

### Plan Attributes (POST body)
```json
{
  "data": {
    "type": "Plan",
    "attributes": {
      "title": "Revelation 12 (Choir)",
      "dates": "2026-03-08"
    }
  }
}
```
- **Confidence:** MEDIUM — endpoint confirmed via Dart SDK docs; `dates` attribute format not verified

### Item Attributes (POST body)
```json
{
  "data": {
    "type": "Item",
    "attributes": {
      "title": "Amazing Grace (Key: G)",
      "item_type": "song_arrangement",
      "html_details": "optional rich text description",
      "sequence": 1
    }
  }
}
```
- **item_type values:** `"song_arrangement"` (songs), `"regular"` (generic items), `"header"`, `"media"`
- **Confidence:** MEDIUM — item_type values from Dart SDK analysis; verify with live API call

### Rate Limit
- 100 requests per minute per organization
- Sequential item creation is safe for typical services (5-10 items max)

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| "Copy for PC" clipboard text | "Export to PC" API button | This phase | Users no longer manually copy-paste into PC |
| Manual PC plan creation | Automated via API | This phase | Eliminates ~10 manual steps per service |

**New fields on Service type:**
- `pcExportedAt: Timestamp | null` — when exported
- `pcPlanId: string | null` — PC plan ID for reference

**New fields on org document:**
- `pcAppId: string` — PC application ID
- `pcSecret: string` — PC application secret
- `pcServiceTypeId: string` — selected PC service type ID

---

## CORS Architecture Decision

This is the primary architectural risk for this phase.

**The app's existing pattern:**
- `esvApi.ts` calls `https://api.esv.org/v3/passage/text/` directly from the browser — no proxy
- `claudeApi.ts` calls Anthropic via a Vite dev proxy (`/api/anthropic`) — also uses `dangerouslyAllowBrowser: true` on the Anthropic SDK

**ESV API evidence:** The fact that `esvApi.ts` works without a proxy in production means ESV API supports CORS for browser clients. This establishes that some external APIs work fine with direct browser fetch.

**Planning Center evidence:** No public documentation confirms PC API CORS support. All official examples use server-side languages (PHP, Python, Ruby). The `@planningcenter/api-client` npm package exists but is designed for graph-style queries (not REST write operations) and may require server-side use.

**Recommended approach:**
1. **Attempt direct browser fetch in production** — if PC API returns CORS headers (as many modern APIs do), no proxy is needed
2. **Add Vite dev proxy for development** — identical pattern to Anthropic proxy
3. **Contingency:** If production CORS fails, add a Firebase Cloud Function that proxies PC API calls. This adds ~1 day of work and infrastructure complexity but is manageable.

The plan should note this as a contingency wave, not a blocking dependency.

---

## Open Questions

1. **Does the Planning Center API support CORS for browser-based requests?**
   - What we know: All official PC examples are server-side; no public CORS documentation found; ESV API (similar type of service) does support it
   - What's unclear: Whether `api.planningcenteronline.com` returns `Access-Control-Allow-Origin` headers
   - Recommendation: Add a Wave 0 task to test CORS with a real PC account using `curl` and then a browser fetch. If CORS works, proceed with direct fetch. If not, implement Cloud Function proxy in the same wave.

2. **Exact `item_type` value for songs: `"song_arrangement"` vs `"song"`?**
   - What we know: Dart SDK docs enumerate `itemType` with 4 possible values; community references mention `"song"` as a value in filter checks
   - What's unclear: Whether creating with `item_type: "song_arrangement"` creates a proper song item vs `"song"`
   - Recommendation: Verify with a real API call in Wave 0. If `"song"` works for creation, use that. The Dart SDK uses `"song_arrangement"` for writable operations.

3. **Does the `dates` attribute set the service date on the PC plan?**
   - What we know: PC plans have a `dates` field; Dart SDK shows it as writable
   - What's unclear: Whether `dates` accepts a simple ISO date string or requires a specific format
   - Recommendation: Test in Wave 0. Fallback: set plan title to include the date if `dates` attribute doesn't work as expected.

4. **Should PC service type selection live in Settings, or as a one-time prompt on first export?**
   - What we know: Locked decision says "Settings or a one-time prompt on first export" — both are valid
   - Recommendation: Put it in Settings alongside credentials. It's simpler and allows users to change the service type without re-exporting. No modal/prompt UX needed.

---

## Validation Architecture

> `workflow.nyquist_validation` key is absent from config.json — treating as enabled.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.0.18 |
| Config file | `vite.config.ts` (test section with jsdom environment) |
| Quick run command | `npm run test:unit -- --reporter=verbose --run` |
| Full suite command | `npm run test:unit` |

### Phase Requirements → Test Map
| Behavior | Test Type | Automated Command | File Exists? |
|----------|-----------|-------------------|-------------|
| `buildPlanTitle()` formats "Sermon Ref (Teams)" correctly | unit | `npm run test:unit -- planningCenterApi` | ❌ Wave 0 |
| `createPlan()` sends correct JSON:API body | unit (mocked fetch) | `npm run test:unit -- planningCenterApi` | ❌ Wave 0 |
| `createItem()` maps SONG/HYMN → `song_arrangement`, others → `regular` | unit (mocked fetch) | `npm run test:unit -- planningCenterApi` | ❌ Wave 0 |
| Settings saves credentials to Firestore, shows masked after save | unit (mocked Firestore) | `npm run test:unit -- SettingsView` | ❌ Wave 0 (extend existing) |
| Export button visible for planned+credentials, hidden for draft | component | `npm run test:unit -- ServiceEditorView` | ❌ Wave 0 (extend existing) |
| Service status "planned" → export eligible | unit | `npm run test:unit -- ServiceEditorView` | ❌ Wave 0 |
| Partial failure reports correctly without rolling back | unit | `npm run test:unit -- planningCenterApi` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npm run test:unit -- --run`
- **Per wave merge:** `npm run test:unit`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/utils/__tests__/planningCenterApi.test.ts` — covers plan creation, item creation, credential validation, plan title building, slot mapping
- [ ] Extend `src/views/__tests__/ServiceEditorView.test.ts` — covers export button visibility logic
- [ ] Extend `src/views/__tests__/SettingsView.test.ts` — covers PC credentials section (SettingsView test doesn't currently exist per file listing)

*(Note: `SettingsView.vue` has no corresponding test file — Wave 0 creates it)*

---

## Sources

### Primary (HIGH confidence)
- Dart `planningcenter_api` library docs (pub.dev) — confirmed endpoint URLs, plan attributes, item attributes, item_type field existence
- Project source code (`esvApi.ts`, `planningCenterExport.ts`, `claudeApi.ts`, `vite.config.ts`) — established patterns for external API calls and proxy setup
- Planning Center README.md on GitHub (`planningcenter/developers`) — confirmed Basic Auth format: `curl -u application_id:secret https://api.planningcenteronline.com/services/v2/`

### Secondary (MEDIUM confidence)
- WebSearch results confirming endpoints: `GET /service_types`, `POST /service_types/{id}/plans`, `POST /service_types/{id}/plans/{id}/items`
- Rollout.com integration guide — confirmed rate limit (100 req/min), JSON:API 1.0 spec, base URL structure
- `pastorhudson/ProPresenter-PCO-Live-Auto-Control` GitHub README — confirmed Personal Access Token credential format (application_id + secret)

### Tertiary (LOW confidence)
- item_type value `"song_arrangement"` — inferred from Dart SDK property naming; not verified against live API response
- `dates` attribute format — inferred from SDK docs; specific ISO format not confirmed
- CORS support for browser clients — not documented anywhere found; treat as unverified until tested

---

## Metadata

**Confidence breakdown:**
- Standard Stack: HIGH — no new deps needed; established project patterns
- Authentication: HIGH — Basic Auth with App ID + Secret confirmed across multiple sources
- API Endpoints: MEDIUM — endpoint paths confirmed; attribute details partially inferred from Dart SDK
- item_type values: MEDIUM — "song_arrangement" inferred; needs live API verification
- CORS behavior: LOW — not documented; critical risk that needs live testing in Wave 0
- Architecture Patterns: HIGH — directly mirrors existing ESV API and Anthropic proxy patterns in codebase

**Research date:** 2026-03-04
**Valid until:** 2026-04-04 (30 days; PC API is stable but CORS status needs verification before this expires)
