# Phase 4: Output - Research

**Researched:** 2026-03-04
**Domain:** CSS print media, Firestore share tokens, Clipboard API, Vue 3 routing
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Print layout & content:**
- Audience: musicians & tech team — a working document for rehearsal and service execution
- Song detail per slot: Title + Key + BPM
- Scripture: reference only (e.g., "Psalm 23:1-6"), no full text — keeps printout compact
- Single page target: dense but scannable; allow graceful overflow to second page with proper breaks
- Header: date, active teams (Choir/Orchestra/etc.), progression pattern (1-2-2-3), service name if special
- Notes: print the service's existing notes field content
- Sermon passage: displayed in the Message row (e.g., "Message — Romans 8:1-11")
- Print method: browser print via CSS @media print stylesheet — "Print" button opens native print dialog, no PDF library dependency
- Light/white background for print — separate print stylesheet from dark app theme

**Shareable link access:**
- Token URL model: generate a unique URL like /share/abc123 — anyone with the link can view, no login required
- Link generation: on-demand — user clicks "Share" to generate token; no public URL exists until explicitly shared
- Shared view detail level: same as print — Title + Key + BPM per song, scripture references, sermon passage, teams, progression
- Theme: light theme for the shared view — better readability on phones in daylight
- Distribution: "Copy Link" button copies URL to clipboard; user pastes into email, text, GroupMe, etc.

**Planning Center export:**
- Workflow: manual copy-paste — user opens Planning Center and adds items one by one using the exported text as reference
- Format: copy-to-clipboard text block — "Copy for Planning Center" button, no file download
- Song fields: Title + Key + CCLI# per song
- Scope: full service order — songs with keys/CCLI, scripture references, prayer, message/sermon passage
- Output is a structured, readable text block ordered by service slot position

**Entry points & triggers:**
- All actions (Print, Share, Copy for PC) as buttons in the service editor header
- Single service at a time — no batch print/export from services list
- Clipboard feedback: button text changes to "Copied!" with checkmark icon, then reverts — inline feedback, no toast

### Claude's Discretion
- Exact print stylesheet layout, spacing, and typography within "single page, dense, scannable" direction
- Share token generation mechanism (Firestore document with security rules vs. Firebase Functions)
- How the shared view component is structured (new route, public layout without AppShell)
- Exact text format for the Planning Center clipboard export
- Button placement and styling within the service editor header
- Print preview behavior (if any) before triggering browser print dialog
- How to handle printing a draft vs. planned service (warning, or allow both)

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| OUT-01 | User can print a formatted order of service for rehearsal and Sunday | CSS @media print via Tailwind `print:` variant; `window.print()` trigger; light-theme print layout component |
| OUT-02 | User can share a read-only service plan link (mobile-friendly) | Firestore `shareTokens/{token}` collection with public read rule; `/share/:token` Vue Router route without auth guard; ShareView.vue light-theme component |
| OUT-03 | User can export structured service plan data for Planning Center entry | `navigator.clipboard.writeText()` Async Clipboard API; plain-text formatter function; song store lookup for CCLI numbers |
</phase_requirements>

---

## Summary

Phase 4 delivers three output mechanisms from a fully planned service: formatted print, mobile-friendly share link, and Planning Center clipboard export. All three are triggered from the existing ServiceEditorView header area, are scoped to a single service, and share the same data source — the `Service` document already loaded in the service store.

The three features are technically independent and can be built as separate waves. Print is pure CSS (no new libraries). The share link requires one new Firestore collection, one new Firestore security rule, and one new Vue route. The Planning Center export is a pure TypeScript string formatter plus the Async Clipboard API — no new dependencies.

The most important constraint is Tailwind v4 purge safety: any dynamic classes added in the print or share view components must use the established static lookup object pattern from prior phases. The `print:` Tailwind variant is confirmed available in v4 and works exactly as in v3 — no configuration changes needed.

**Primary recommendation:** Build in three sequential tasks within one plan wave: (1) print stylesheet + button, (2) share token Firestore + route + ShareView, (3) Planning Center text formatter + clipboard button. All use existing store data; no new dependencies required.

---

## Standard Stack

### Core (all already in project)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Vue Router 5 | ^5.0.3 | `/share/:token` public route — no auth guard | Already installed; route meta pattern established |
| Firebase Firestore | ^12.0.0 | `shareTokens/{token}` collection for token storage | Already installed; same store pattern |
| Tailwind CSS v4 | ^4.0.0 | `print:` variant for @media print styles | Already installed; `print:hidden` / `print:block` confirmed in v4 |
| Pinia | ^3.0.4 | Service store provides all data for output | Already installed |
| Async Clipboard API | Browser native | `navigator.clipboard.writeText()` for copy-to-clipboard | No install needed; Baseline status March 2025 |

### No New Dependencies Needed
All three output features are implemented with:
- CSS: Tailwind `print:` utilities + `@media print` in a dedicated print stylesheet
- Data: existing `useServiceStore` and `useSongStore` stores
- Browser API: `navigator.clipboard.writeText()` (secure context required; localhost qualifies in dev)
- Routing: additional route in `src/router/index.ts`
- Firestore: new collection with security rule addition in `firestore.rules`

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `window.print()` | jsPDF / html2pdf.js | PDF library adds ~400KB bundle; user asked for browser print only |
| Firestore token doc | Firebase Function URL signing | Functions add cold start latency and billing; Firestore token is simpler |
| `navigator.clipboard` | vue-clipboard3 / VueUse `useClipboard` | Extra dependency unnecessary; native API is Baseline since March 2025 |

---

## Architecture Patterns

### Recommended File Structure for Phase 4

```
src/
├── views/
│   ├── ServiceEditorView.vue      # ADD: Print/Share/CopyPC buttons in header
│   └── ShareView.vue              # NEW: Public read-only service view
├── components/
│   └── ServicePrintLayout.vue     # NEW: Print-optimized service layout (used by print + share)
├── utils/
│   └── planningCenterExport.ts    # NEW: Text formatter for PC clipboard export
├── stores/
│   └── services.ts                # ADD: createShareToken() action
└── router/
    └── index.ts                   # ADD: /share/:token route (no auth guard)
```

### Pattern 1: CSS Print Via Tailwind `print:` Variant
**What:** Tailwind's `print:` variant generates `@media print { ... }` rules. Use `print:hidden` to hide app chrome (sidebar, buttons, nav). Use `hidden print:block` for print-only content. Use a separate light-background print layout embedded in the view or triggered via a dedicated component.
**When to use:** For OUT-01. No PDF library, no separate server route — browser handles pagination.
**Example:**
```html
<!-- Hide all UI chrome when printing -->
<AppShell class="print:hidden">...</AppShell>

<!-- Print-only layout — hidden in browser, visible in print -->
<div class="hidden print:block bg-white text-gray-900 font-sans text-sm p-8">
  <header class="border-b border-gray-300 pb-2 mb-4">
    <h1 class="text-lg font-bold">{{ formattedDate }}</h1>
    <p class="text-xs text-gray-600">{{ teamsDisplay }} | {{ service.progression }}</p>
  </header>
  <div v-for="slot in service.slots" :key="slot.position" class="py-1.5 border-b border-gray-100">
    <!-- slot content -->
  </div>
</div>
```

**Page break control:**
```html
<!-- Prevent break inside a slot row -->
<div class="break-inside-avoid">...</div>
<!-- Force break before second page content if needed -->
<div class="print:break-before-page">...</div>
```

**Trigger:**
```typescript
function onPrint() {
  window.print()
}
```

### Pattern 2: Share Token (Firestore Document)
**What:** When user clicks "Share", generate a random token, write it to `shareTokens/{token}` with `serviceId` and `orgId`. The `/share/:token` route reads this document (unauthenticated), then fetches the service document.
**When to use:** For OUT-02. Simpler than Firebase Functions; token is only created on demand.

**Token generation:**
```typescript
// In useServiceStore or a dedicated composable
import { doc, setDoc } from 'firebase/firestore'

async function createShareToken(serviceId: string, orgId: string): Promise<string> {
  // Generate cryptographically random token
  const array = new Uint8Array(18)
  crypto.getRandomValues(array)
  const token = Array.from(array, b => b.toString(16).padStart(2, '0')).join('')

  await setDoc(doc(db, 'shareTokens', token), {
    serviceId,
    orgId,
    createdAt: serverTimestamp(),
  })

  return token
}
```

**Firestore security rule addition** (append to `firestore.rules`):
```
// Share tokens: anyone with the token can read; only org members can create
match /shareTokens/{token} {
  allow read: if true;
  allow create: if isSignedIn();
  allow update, delete: if false;
}
```

**ShareView route — no auth guard:**
```typescript
{
  path: '/share/:token',
  name: 'share',
  component: () => import('../views/ShareView.vue'),
  // No meta.requiresAuth — public route
}
```

**ShareView data fetch:**
```typescript
// ShareView.vue <script setup>
const route = useRoute()
const token = route.params.token as string

// 1. Read shareTokens/{token} — public read
const tokenDoc = await getDoc(doc(db, 'shareTokens', token))
if (!tokenDoc.exists()) { /* show 404 */ }

const { serviceId, orgId } = tokenDoc.data() as { serviceId: string; orgId: string }

// 2. Read service doc — requires org member auth per current rules
// PROBLEM: current org/services rule requires isOrgMember — public viewer can't read it
// SOLUTION: Denormalize service data into the shareToken document at creation time
```

**CRITICAL INSIGHT — Firestore rule conflict:** The current security rules require `isOrgMember(orgId)` to read any service document (`organizations/{orgId}/services/{id}`). An unauthenticated viewer cannot satisfy this. Two solutions:

- **Option A (recommended): Embed service snapshot in share token.** When creating the token, serialize the full service data into the `shareTokens/{token}` document itself. Single read, no org membership required, no rule change to service collection.
- **Option B:** Add a public read rule exception to `organizations/{orgId}/services/{id}` that checks if a valid shareToken exists for the serviceId. This requires a cross-document check in Firestore rules, which is expensive (existsAfter, get) and fragile.

**Option A implementation:**
```typescript
async function createShareToken(service: Service, orgId: string): Promise<string> {
  const array = new Uint8Array(18)
  crypto.getRandomValues(array)
  const token = Array.from(array, b => b.toString(16).padStart(2, '0')).join('')

  await setDoc(doc(db, 'shareTokens', token), {
    serviceId: service.id,
    orgId,
    // Snapshot of display data — not sensitive, just the service plan
    serviceSnapshot: {
      date: service.date,
      name: service.name,
      progression: service.progression,
      teams: service.teams,
      slots: service.slots,
      sermonPassage: service.sermonPassage,
      notes: service.notes,
      status: service.status,
    },
    createdAt: serverTimestamp(),
  })

  return token
}
```

ShareView then reads only `shareTokens/{token}` — one document, public read, no auth. Display uses the embedded `serviceSnapshot`.

### Pattern 3: Clipboard Export (Planning Center Text)
**What:** A pure TypeScript function that takes a `Service` and a `Song[]` lookup and produces a formatted plain-text block. Copy via `navigator.clipboard.writeText()`. Button shows "Copied!" for 2 seconds then reverts.
**When to use:** For OUT-03. No download, no file, no server.

**Text formatter utility:**
```typescript
// src/utils/planningCenterExport.ts
import type { Service, SongSlot, ScriptureSlot } from '@/types/service'
import type { Song } from '@/types/song'

export function formatForPlanningCenter(service: Service, songs: Song[]): string {
  const songMap = new Map(songs.map(s => [s.id, s]))
  const lines: string[] = []

  const dateStr = service.date  // format as needed
  lines.push(`ORDER OF SERVICE — ${dateStr}`)
  if (service.name) lines.push(service.name)
  lines.push(`Teams: ${service.teams.join(', ') || 'Standard Band'}`)
  lines.push(`Progression: ${service.progression}`)
  lines.push('')

  for (const slot of service.slots) {
    if (slot.kind === 'SONG') {
      const song = slot.songId ? songMap.get(slot.songId) : null
      if (slot.songId && song) {
        const ccli = song.ccliNumber ? ` | CCLI #${song.ccliNumber}` : ''
        lines.push(`${slotLabel(slot.position)} — ${slot.songTitle} (Key: ${slot.songKey}${ccli})`)
      } else {
        lines.push(`${slotLabel(slot.position)} — [empty]`)
      }
    } else if (slot.kind === 'SCRIPTURE') {
      if (slot.book) {
        lines.push(`Scripture — ${slot.book} ${slot.chapter}:${slot.verseStart}-${slot.verseEnd}`)
      } else {
        lines.push(`Scripture — [empty]`)
      }
    } else if (slot.kind === 'PRAYER') {
      lines.push('Prayer')
    } else if (slot.kind === 'MESSAGE') {
      const passage = service.sermonPassage
      if (passage) {
        lines.push(`Message — ${passage.book} ${passage.chapter}:${passage.verseStart}-${passage.verseEnd}`)
      } else {
        lines.push('Message')
      }
    }
  }

  if (service.notes) {
    lines.push('')
    lines.push('Notes:')
    lines.push(service.notes)
  }

  return lines.join('\n')
}

function slotLabel(position: number): string {
  const labels: Record<number, string> = {
    0: 'Song 1 (Call to Worship)',
    1: 'Scripture Reading',
    2: 'Song 2',
    3: 'Prayer',
    4: 'Scripture Reading',
    5: 'Song 3',
    6: 'Song 4',
    7: 'Message',
    8: 'Sending Song',
  }
  return labels[position] ?? `Slot ${position}`
}
```

**Button copy pattern in ServiceEditorView:**
```typescript
const copyButtonLabel = ref<'Copy for Planning Center' | 'Copied!'>('Copy for Planning Center')

async function onCopyForPC() {
  if (!localService.value) return
  const text = formatForPlanningCenter(localService.value, songStore.songs)
  await navigator.clipboard.writeText(text)
  copyButtonLabel.value = 'Copied!'
  setTimeout(() => { copyButtonLabel.value = 'Copy for Planning Center' }, 2000)
}
```

**CCLI lookup:** `songStore.songs` is already subscribed in ServiceEditorView (see `initStores()`). The `Song` type has `ccliNumber: string`. The formatter receives `songStore.songs` directly — no new store subscriptions.

### Pattern 4: BPM on Song Slot
**What:** The print and share views need BPM per song. The current `SongSlot` type stores `songTitle` and `songKey` as denormalized snapshots, but NOT `bpmSnapshot`. Two options:
- **Option A (recommended for simplicity):** Look up BPM at render time from `songStore.songs` (already loaded). No schema change. Only works in authenticated ServiceEditorView and the new ShareView via embedded snapshot.
- **Option B:** Add `songBpm: number | null` to `SongSlot` interface and write it when songs are assigned. Requires migration/schema change but is self-contained in the token document.

**For print view (ServiceEditorView context):** Use `songStore.songs` lookup — store is already subscribed. Clean and zero-schema-change.

**For share view (ShareView — unauthenticated):** Must embed BPM in the service snapshot at token creation time. The `serviceSnapshot.slots` SongSlot objects should include BPM resolved at token-creation time.

### Anti-Patterns to Avoid
- **Don't add PDF libraries.** User locked in browser print. jsPDF/html2pdf.js not needed.
- **Don't use toast notifications.** User locked in inline "Copied!" button feedback — not a toast.
- **Don't guard `/share/:token` with `meta.requiresAuth`.** The whole point is public access.
- **Don't query the service document from the share view.** The existing `isOrgMember` rule blocks unauthenticated reads. Embed the service snapshot in the token document instead.
- **Don't use dynamic class strings without static lookup objects.** Tailwind v4 purges unreferenced class strings. Any new dynamic classes (e.g., slot kind label colors) need a static lookup map.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Clipboard copy | Custom execCommand fallback | `navigator.clipboard.writeText()` | Baseline since March 2025; supported in all modern browsers |
| PDF generation | Custom PDF renderer | Browser `window.print()` + `@media print` CSS | User explicitly chose browser print; no PDF library needed |
| Token randomness | Math.random() token | `crypto.getRandomValues()` | `Math.random()` is not cryptographically secure; guessable tokens |
| Page break control | JavaScript scroll detection | CSS `break-inside-avoid`, `break-before-page` | Browser handles pagination natively |
| Public URL routing | Server-side route | Vue Router public route (no meta.requiresAuth) | SPA can handle this with a meta flag pattern already in router |

**Key insight:** All three output mechanisms are thin presentation layers over data that already exists. The only non-trivial piece is the Firestore rule conflict for unauthenticated service reads — solved by embedding a service snapshot in the token document.

---

## Common Pitfalls

### Pitfall 1: Firestore Auth Rule Blocks Share View Reads
**What goes wrong:** ShareView fetches `organizations/{orgId}/services/{serviceId}` but the current security rule requires `isOrgMember(orgId)`. Unauthenticated viewer gets PERMISSION_DENIED.
**Why it happens:** The share URL passes a token, not auth credentials. Firestore rules cannot dynamically check if a token for a service exists without a cross-document `get()` call, which is expensive and complex.
**How to avoid:** Embed a `serviceSnapshot` object inside the `shareTokens/{token}` document at creation time. ShareView reads only the token document, which has `allow read: if true`. Zero reads of the protected org collection.
**Warning signs:** `FirebaseError: Missing or insufficient permissions` in ShareView console.

### Pitfall 2: Missing BPM in Print/Share Output
**What goes wrong:** Print layout shows "Key: G | BPM: —" because BPM is not stored in the slot snapshot.
**Why it happens:** `SongSlot` only denormalizes `songTitle` and `songKey`. `bpm` lives on the `Arrangement` in the `Song` document.
**How to avoid:** For print view, look up BPM from `songStore.songs` by `slot.songId` at render time. For share view, resolve BPM and embed it in the `serviceSnapshot.slots` at token creation time.
**Warning signs:** BPM always shows `null` or `undefined` in the print layout.

### Pitfall 3: Tailwind v4 Purge of Dynamic Print Classes
**What goes wrong:** Classes like `print:bg-white` or `print:text-gray-900` disappear in production build because they're assembled dynamically.
**Why it happens:** Tailwind v4 scans source files for literal class strings. Dynamic string concatenation is not detected.
**How to avoid:** Use the static class lookup object pattern established in prior phases. Define all print-specific classes as complete strings in a const object.
**Warning signs:** Print layout has dark background in production build but looks correct in dev.

### Pitfall 4: `navigator.clipboard` Not Available in Non-Secure Context
**What goes wrong:** `navigator.clipboard.writeText()` throws `TypeError: Cannot read properties of undefined` in HTTP contexts.
**Why it happens:** The Async Clipboard API requires a secure context (HTTPS or localhost). Some older CI/test environments or HTTP dev servers don't qualify.
**How to avoid:** In dev, `localhost` qualifies. In production, the app runs on HTTPS. In tests, mock `navigator.clipboard`. Add a null guard: `if (navigator.clipboard)`.
**Warning signs:** Copy button silently fails or throws in non-HTTPS environment.

### Pitfall 5: Print Dialog Opens Before Vue Renders Print Layout
**What goes wrong:** `window.print()` is called before the reactive print layout has rendered its data (e.g., service is still loading).
**Why it happens:** `window.print()` is synchronous but Vue renders asynchronously.
**How to avoid:** The Print button should only be enabled when `localService.value` is not null and not loading. Because the print layout is part of the same DOM as the editor (hidden with `hidden print:block`), it renders when the editor does — no timing issue.
**Warning signs:** Print preview shows empty slots even though the editor shows data.

### Pitfall 6: Share Token URL Points to Wrong Origin
**What goes wrong:** "Copy Link" copies `http://localhost:5173/share/abc123` in dev, which is useless for sharing.
**Why it happens:** `window.location.origin` returns the dev server origin.
**How to avoid:** This is fine in production (deployed domain). In dev, the team won't actually share URLs. No special handling needed — `window.location.origin + '/share/' + token` is the correct approach.

---

## Code Examples

Verified patterns from official sources and established project conventions:

### Print Button in Header
```typescript
// ServiceEditorView.vue — add to header area
function onPrint() {
  window.print()
}
```

```html
<!-- In the header div — hidden when printing (print:hidden) -->
<button
  type="button"
  @click="onPrint"
  :disabled="!localService"
  class="print:hidden inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-gray-200 bg-gray-800 hover:bg-gray-700 transition-colors border border-gray-700"
>
  <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
    <path stroke-linecap="round" stroke-linejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
  </svg>
  Print
</button>
```

### Share Button with Token Generation
```typescript
const shareUrl = ref<string | null>(null)
const isSharing = ref(false)
const shareCopied = ref(false)

async function onShare() {
  if (!localService.value || !authStore.orgId) return
  isSharing.value = true
  try {
    const token = await serviceStore.createShareToken(localService.value, authStore.orgId)
    const url = `${window.location.origin}/share/${token}`
    shareUrl.value = url
    await navigator.clipboard.writeText(url)
    shareCopied.value = true
    setTimeout(() => { shareCopied.value = false }, 2000)
  } finally {
    isSharing.value = false
  }
}
```

### Clipboard Copy with Inline Feedback
```typescript
// Source: Async Clipboard API (Baseline March 2025)
const pcCopied = ref(false)

async function onCopyForPC() {
  if (!localService.value) return
  const text = formatForPlanningCenter(localService.value, songStore.songs)
  if (navigator.clipboard) {
    await navigator.clipboard.writeText(text)
  }
  pcCopied.value = true
  setTimeout(() => { pcCopied.value = false }, 2000)
}
```

### Firestore Share Token Rule
```
// Source: Firebase Firestore Security Rules docs
// Append to firestore.rules inside the top-level match block
match /shareTokens/{token} {
  allow read: if true;           // anyone with the token URL can read
  allow create: if isSignedIn(); // only authenticated users can create tokens
  allow update, delete: if false;
}
```

### Tailwind Print Variant — Print Layout Block
```html
<!-- Source: tailwindcss.com/docs/hover-focus-and-other-states -->
<!-- Entire app shell is hidden when printing -->
<div class="print:hidden">
  <AppShell>...</AppShell>
</div>

<!-- Print layout: hidden in browser, visible when printing -->
<div class="hidden print:block bg-white text-gray-900 p-8 font-sans">
  <!-- Service header -->
  <div class="border-b border-gray-300 pb-3 mb-4">
    <h1 class="text-lg font-bold text-gray-900">{{ formattedDate }}</h1>
    <p class="text-sm text-gray-600">{{ teamsDisplay }} · {{ service.progression }}</p>
    <p v-if="service.name" class="text-sm font-semibold text-gray-800 mt-0.5">{{ service.name }}</p>
  </div>
  <!-- Slots -->
  <div
    v-for="slot in service.slots"
    :key="slot.position"
    class="py-1.5 border-b border-gray-100 break-inside-avoid"
  >
    <!-- slot rendering -->
  </div>
  <!-- Notes -->
  <div v-if="service.notes" class="mt-4 text-xs text-gray-600">
    <p class="font-semibold mb-1">Notes</p>
    <p class="whitespace-pre-wrap">{{ service.notes }}</p>
  </div>
</div>
```

### BPM Lookup from Song Store (for print view)
```typescript
// In ServiceEditorView — songStore.songs already subscribed
function getBpm(songId: string | null): number | null {
  if (!songId) return null
  const song = songStore.songs.find(s => s.id === songId)
  // Prefer the arrangement that matches the slot key
  return song?.arrangements[0]?.bpm ?? null
}
```

Note: If a song has multiple arrangements, BPM should come from the arrangement matching the slot's `songKey`. For simplicity in Phase 4, use the first arrangement's BPM as an approximation — or the arrangement whose `key` matches `slot.songKey`.

```typescript
function getBpmForSlot(slot: SongSlot): number | null {
  if (!slot.songId) return null
  const song = songStore.songs.find(s => s.id === slot.songId)
  if (!song) return null
  const matchingArr = song.arrangements.find(a => a.key === slot.songKey)
  return matchingArr?.bpm ?? song.arrangements[0]?.bpm ?? null
}
```

### Router Addition — Public Share Route
```typescript
// Source: Vue Router docs + existing router/index.ts pattern
{
  path: '/share/:token',
  name: 'share',
  component: () => import('../views/ShareView.vue'),
  // No meta.requiresAuth — intentionally public
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `document.execCommand('copy')` | `navigator.clipboard.writeText()` | March 2025 Baseline | Async, reliable, no selection manipulation |
| `tailwind.config.js` for variants | CSS-first `@custom-variant` | Tailwind v4 (Jan 2025) | For this project, `print:` built-in variant — no config needed |
| pdf.js / jsPDF for export | `@media print` + `window.print()` | Ongoing pattern | Simpler, zero dependency, better user control |

**Deprecated/outdated:**
- `execCommand('copy')`: Deprecated in all browsers; do not use as primary implementation
- Tailwind v3 `screens.print` config: Not needed in v4 — `print:` variant works without configuration

---

## Open Questions

1. **BPM arrangement selection when song has multiple arrangements**
   - What we know: `SongSlot` stores `songKey`, `Song.arrangements` has `key` and `bpm` per arrangement
   - What's unclear: If song has arrangements in G and E, and slot is in G, the G arrangement BPM is correct. But the slot only stores a single key, not the arrangement ID.
   - Recommendation: Match arrangement by `arrangement.key === slot.songKey`. If no match, fall back to `arrangements[0].bpm`. This is correct for the common case. Document the edge case in code comment.

2. **Share token expiry / revocation**
   - What we know: User decision locked "on-demand generation, no public URL until shared"
   - What's unclear: Should tokens expire? Should a planner be able to revoke them?
   - Recommendation: Out of scope for Phase 4 (no expiry, no revocation). Tokens are permanent but low-risk (service plan data, not PII). Add a Firestore `expiresAt` field placeholder as a `null` field for future use.

3. **orgId availability in ServiceEditorView for token creation**
   - What we know: `authStore` does not currently expose `orgId` directly — it's fetched via `getDoc(doc(db, 'users', user.uid))` in `initStores()`
   - What's unclear: Where to store the resolved `orgId` so Share button can use it
   - Recommendation: Extract resolved `orgId` to a `ref<string | null>` at the top of ServiceEditorView (already computed in `initStores()`), or add `orgId` to the service store (it already has `serviceStore.orgId`). The service store's `orgId` ref is the cleanest approach — it's already set by `subscribe()`.

---

## Validation Architecture

Test framework: Vitest (already configured in `vite.config.ts`, test environment: jsdom)
Quick run: `npx vitest run`
Full suite: `npx vitest run`

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| OUT-01 | Print button calls `window.print()` | unit | `npx vitest run src/views/__tests__/ServiceEditorView.test.ts` | Wave 0 |
| OUT-01 | Print layout renders correct service data (date, slots, sermon passage, notes) | unit | `npx vitest run src/components/__tests__/ServicePrintLayout.test.ts` | Wave 0 |
| OUT-02 | `createShareToken` writes correct Firestore doc with serviceSnapshot | unit | `npx vitest run src/stores/__tests__/services.test.ts` | Extend existing |
| OUT-02 | ShareView renders service data from embedded snapshot | unit | `npx vitest run src/views/__tests__/ShareView.test.ts` | Wave 0 |
| OUT-02 | `/share/:token` route has no `requiresAuth` meta | unit | `npx vitest run src/router/__tests__/router.test.ts` | Extend existing |
| OUT-03 | `formatForPlanningCenter` produces correct text format | unit | `npx vitest run src/utils/__tests__/planningCenterExport.test.ts` | Wave 0 |
| OUT-03 | Copy button sets `pcCopied = true` and calls `navigator.clipboard.writeText` | unit | `npx vitest run src/views/__tests__/ServiceEditorView.test.ts` | Wave 0 |

### Sampling Rate
- Per task commit: `npx vitest run`
- Per wave merge: `npx vitest run`
- Phase gate: Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/utils/__tests__/planningCenterExport.test.ts` — covers OUT-03 text formatter
- [ ] `src/components/__tests__/ServicePrintLayout.test.ts` — covers OUT-01 print layout rendering
- [ ] `src/views/__tests__/ShareView.test.ts` — covers OUT-02 share view rendering
- [ ] `src/views/__tests__/ServiceEditorView.test.ts` — covers OUT-01 print trigger, OUT-02 share button, OUT-03 copy button

---

## Sources

### Primary (HIGH confidence)
- tailwindcss.com/docs/hover-focus-and-other-states — `print:` variant syntax confirmed; `print:hidden` and `hidden print:block` patterns verified
- firebase.google.com/docs/firestore/security/rules-conditions — `allow read: if true` pattern for public reads confirmed
- Codebase direct read — `src/types/service.ts`, `src/types/song.ts`, `src/stores/services.ts`, `src/stores/songs.ts`, `src/router/index.ts`, `src/views/ServiceEditorView.vue`, `firestore.rules` — all existing patterns verified

### Secondary (MEDIUM confidence)
- vueschool.io/articles/vuejs-tutorials/how-to-copy-to-clipboard-in-vue — Async Clipboard API `navigator.clipboard.writeText()` confirmed for Vue 3
- tailwindcss.com/blog/tailwindcss-v4 — CSS-first config confirmed; `print:` variant available without tailwind.config.js in v4

### Tertiary (LOW confidence)
- Arrangement BPM matching by key — logical derivation from `Song` and `Arrangement` types; not explicitly documented, but follows from data model

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all dependencies already in project; no new installs needed
- Architecture: HIGH — patterns verified against existing codebase; Firestore rule conflict identified and solution verified
- Print via Tailwind: HIGH — `print:` variant confirmed in v4 official docs
- Share token Firestore: HIGH — security rule syntax confirmed; snapshot embedding approach verified against existing rules
- Clipboard API: HIGH — Baseline status confirmed March 2025; native API correct approach
- BPM lookup: MEDIUM — derived from data model; correct for common case, documented edge case

**Research date:** 2026-03-04
**Valid until:** 2026-06-04 (stable stack; Tailwind v4, Firebase v12, Vue Router v5 are not fast-moving)
