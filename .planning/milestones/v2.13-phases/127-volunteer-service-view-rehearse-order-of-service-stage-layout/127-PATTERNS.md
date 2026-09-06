# Phase 127: Volunteer Service View — Pattern Map

**Mapped:** 2026-09-06
**Files analyzed:** 10 (1 extended util, 1 replaced view, 6 new components, 1 router edit, 1 test-extension)
**Analogs found:** 10 / 10

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/utils/rehearseAccess.ts` (EXTEND) | utility (pure projection builder) | transform | `src/stores/services.ts` `buildServiceSnapshot`/`toPublicServiceSnapshot` (lines 129-279) | exact (same allowlist, different store) |
| `src/views/VolunteerServiceView.vue` (NEW, replaces placeholder) | view/controller | request-response (getDoc) + event-driven (tabs, player) | `src/views/VolunteerServicePlaceholderView.vue` (shell to replace) + `src/views/MyScheduleView.vue` (top bar, loading/error states) + `src/views/ServiceEditorView.vue` (tab shell) | exact (shell) / role-match (data fetch, new orgId-resolution pattern) |
| `src/router/index.ts` (1-line EDIT) | route | — | lines 187-193 (existing route entry) | exact — component import swap only |
| `src/components/rehearse/RehearseSongList.vue` (NEW) | component | CRUD-read/select | `src/components/SongFilesTab.vue` (row anatomy, `metaLine`) + `src/components/ScheduleServiceCard.vue` (row/button-as-link pattern) | role-match |
| `src/components/rehearse/RehearseSongDetail.vue` (NEW) | component | CRUD-read | `src/components/SongFilesTab.vue` (Documents/Recordings groups, `metaLine`/`formatSize`/`formatAttachmentDate`/`downloadAttachment`) + `src/utils/songLinks.ts` (link labels) | exact |
| `src/components/rehearse/RehearseFileReader.vue` (NEW) | component | file-I/O (PDF display) | `src/components/SongFilePreviewModal.vue` (iframe loading/error internals, adapted from modal to inline) | exact (logic), role-match (non-modal shell) |
| `src/components/rehearse/RehearseAudioPlayerBar.vue` (NEW) | component | streaming (native audio) | `src/components/SongFilesTab.vue` (`<audio>` mount/error pattern, lines 284-304, 466-482) | role-match (SongFilesTab is per-row/`controls`; this is a persistent custom-chrome bar) |
| `src/components/rehearse/VolunteerOrderOfService.vue` (NEW) | component | CRUD-read | `src/views/ShareView.vue` (lines 34-135 — slot-kind branching + roleAssignments card) | exact (row anatomy re-themed) |
| `src/components/rehearse/VolunteerStageLayoutTab.vue` (NEW) | component | CRUD-read | `src/components/stage/StageLayoutView.vue` (embedded verbatim) + `src/views/ShareView.vue` lines 16-32 (wide-cap wrapper + empty copy) | exact |
| `src/utils/rehearseAccess.test.ts` (EXTEND) | test | — | existing 6-case file (same file) | exact |

## Pattern Assignments

### `src/utils/rehearseAccess.ts` (utility, transform) — EXTEND

**Analog:** `src/stores/services.ts` (`buildServiceSnapshot` lines 129-236, `toPublicServiceSnapshot`/`PublicStageMarker` lines 271-299) and the file's own existing shape.

**Current shape to extend** (full file already read — `src/utils/rehearseAccess.ts:1-154`):
```typescript
// Source: src/utils/rehearseAccess.ts:1-10 — imports/header convention (pure, store-free util)
import type { Service, SongSlot } from '@/types/service'
import type { Quarter, Role, Person } from '@/types/roster'
import type { Song, SongAttachmentKind } from '@/types/song'
import { resolveServiceRoleAssignments } from '@/utils/serviceRoles'

export interface RehearseAttachment {
  id: string
  name: string
  kind: SongAttachmentKind
  downloadUrl?: string
  href?: string
}

export interface RehearseSong {
  id: string
  title: string
  keyOrArrangement?: string
  attachments: RehearseAttachment[]
}

export interface RehearseAccessDoc {
  serviceId: string
  orgId: string
  serviceDate: string
  title: string
  status: string
  assignedEmailsLower: string[]
  rolesByEmailLower: Record<string, string[]>
  songs: RehearseSong[]
}
```

**Bpm resolution to copy** (source: `src/stores/services.ts:141-149`, the exact resolution logic to mirror inside `buildRehearseAccess`'s song-mapping loop):
```typescript
// Source: src/stores/services.ts:141-149 (inside slotsWithBpm's SONG case)
const song = songStore.songs.find((s) => s.id === slot.songId)
const bpm = song
  ? (song.arrangements.find((a) => a.key === slot.songKey)?.bpm ?? song.arrangements[0]?.bpm ?? null)
  : null
```
Adapt: `buildRehearseAccess` already receives `songs: Song[]` as a plain argument (no `useSongStore()` — it's a store-free pure function per its own header comment), so replace `songStore.songs.find(...)` with the existing `songsById`/`song` lookup already in `rehearseAccess.ts:110-112`.

**Order-of-service item allowlist to copy verbatim (per-kind switch), field-for-field** (source: `src/stores/services.ts:135-204`, the exact `switch (slot.kind)` block — SONG/SCRIPTURE/HYMN/IMPORTED/PRAYER/MESSAGE/ANNOUNCEMENTS/MISC/default). Do not re-derive; factor into a shared store-free helper or copy the switch body unmodified. Note the default-branch defensive fallback (services.ts:189-203) for a runtime slot kind outside the compile-time union — carry this forward too, since `buildRehearseAccess` faces the identical Firestore-boundary risk `buildServiceSnapshot` guards against (an `undefined` return crashes the `setDoc`).

**Stage-marker allowlist to copy verbatim** (source: `src/stores/services.ts:224-249`):
```typescript
// Source: src/stores/services.ts:224-249 — PublicStageMarker allowlist
// (already excludes `note`, matching PublicStageMarker = Omit<StageMarker, 'note'>, services.ts:274)
const stageLayoutElements: StageMarker[] = (service.stageLayout?.elements ?? []).map((marker) => ({
  id: marker.id,
  label: marker.label,
  ...(marker.kind ? { kind: marker.kind } : {}),
  zone: marker.zone,
  xPct: clampPct(marker.xPct),
  yPct: clampPct(marker.yPct),
  // note intentionally OMITTED — free-text, PII risk (WR-01, 118-REVIEW)
  ...(marker.roleName ? { roleName: marker.roleName } : {}),
  ...(marker.personName ? { personName: marker.personName } : {}),
  ...(marker.withVocal ? { withVocal: true } : {}),
}))
```
`clampPct` lives alongside `buildServiceSnapshot` in `services.ts` — either import it (if exported) or copy the one-line clamp; do not re-derive the PII rule, only decide the import mechanics.

**roleAssignments allowlist to copy verbatim** (source: `src/stores/services.ts:214-222`, i.e. the `roleAssignments` map preceding the stage block):
```typescript
// Source: src/stores/services.ts — resolved via resolveServiceRoleAssignments,
// names-only via a nameById Map (NEVER the raw Person object)
const roleAssignments = resolved.map((r) => ({
  roleId: r.roleId,
  roleName: r.roleName,
  group: r.group,
  personNames: r.effectivePersonIds.map((id) => nameById.get(id) ?? id),
}))
```
`buildRehearseAccess` already computes `assignments = resolveServiceRoleAssignments(...)` (rehearseAccess.ts:77) and `peopleById` (rehearseAccess.ts:78) — reuse those, do not build a second Map.

**Conditional-spread-for-Firestore-undefined pattern** (source: `src/stores/services.ts:261-267`) — apply identically to the new `stageLayout` field on `RehearseAccessDoc`:
```typescript
...(stageLayoutElements.length > 0 ? { stageLayout: { elements: stageLayoutElements } } : {}),
```

**New fields to add to `RehearseAccessDoc`** (per RESEARCH.md's Code Examples section, already vetted against the codebase):
```typescript
export interface RehearseOrderItem { /* mirrors ServiceSnapshot's ServiceSlot union, minus free-text */ }
export interface RehearseRoleAssignment { roleId: string; roleName: string; group: RoleGroup; personNames: string[] }
export interface RehearseAccessDoc {
  // ...existing fields unchanged...
  orderOfService: RehearseOrderItem[]
  roleAssignments: RehearseRoleAssignment[]
  stageLayout?: { elements: PublicStageMarker[] } // import PublicStageMarker from '@/stores/services'
}
```

---

### `src/views/VolunteerServiceView.vue` (view, request-response) — NEW, replaces placeholder

**Analogs:** `src/views/VolunteerServicePlaceholderView.vue` (full file, 25 lines — the exact shell/route contract this replaces), `src/views/MyScheduleView.vue` (top bar + loading/menu chrome, lines 1-70), `src/views/ServiceEditorView.vue` (tab bar, lines 705-853 + `handleTabKeydown`, lines 1829-1852).

**Placeholder being replaced** (source: `src/views/VolunteerServicePlaceholderView.vue:1-25`, full file):
```vue
<template>
  <div class="min-h-screen bg-gray-950 flex items-center justify-center px-4">
    <div class="w-full max-w-sm">
      <div class="text-center mb-8">
        <h1 class="text-2xl font-semibold text-white tracking-tight">Worship Planner</h1>
        <p class="text-sm text-gray-400 mt-1">Rehearse view coming soon</p>
      </div>
      <div class="bg-gray-900 border border-gray-800 rounded-xl shadow-xl p-6 space-y-5">
        <p class="text-sm text-gray-400">This service's Rehearse view is coming soon.</p>
        <router-link to="/my-schedule" class="text-sm text-indigo-400 hover:text-indigo-300">
          Back to My Schedule
        </router-link>
      </div>
    </div>
  </div>
</template>
<script setup lang="ts">
// Phase 126 (R382) — build-safe placeholder for the Phase 127 Rehearse
// view. No data fetch, no spinner...
</script>
```
Only the **component import** at the route registration changes (see Router entry below) — path/name/meta stay stable per the placeholder's own header comment.

**Top-bar pattern to reuse verbatim** (source: `src/views/MyScheduleView.vue:1-67` — header, user-chip avatar/menu, outside-click dismissal, `aria-haspopup="menu"`):
```vue
<!-- Source: src/views/MyScheduleView.vue:4-67 (full top-bar block) -->
<header class="h-14 px-4 sm:px-6 border-b border-gray-800 bg-gray-900 flex items-center justify-between">
  <div class="flex items-center gap-2">
    <svg ...>...</svg>
    <span class="text-sm font-semibold text-gray-100 tracking-tight">Worship Planner</span>
  </div>
  <div class="relative">
    <button ref="userChipRef" data-testid="user-chip" aria-haspopup="menu" :aria-expanded="menuOpen" @click="menuOpen = !menuOpen">
      <div class="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-xs font-medium text-white shrink-0">{{ initials }}</div>
      <div class="hidden sm:block text-left min-w-0">
        <p class="text-sm font-medium text-gray-100 truncate">{{ displayLabel }}</p>
        <p class="text-xs text-gray-500 truncate">{{ authStore.user?.email }}</p>
      </div>
      <svg ...chevron-down.../>
    </button>
    <div v-if="menuOpen" class="fixed inset-0 z-10" @click="menuOpen = false" />
    <div v-if="menuOpen" role="menu" data-testid="user-menu" class="absolute right-0 mt-2 w-56 rounded-md border border-gray-800 bg-gray-900 shadow-lg py-1 z-20">
      <button role="menuitem" data-testid="check-different-email-menu" @click="goToDifferentEmail">Check a different email</button>
      <button role="menuitem" :disabled="isSigningOut" @click="handleSignOut">{{ isSigningOut ? 'Signing out...' : 'Sign out' }}</button>
    </div>
  </div>
</header>
```
UI-SPEC §1 says factor into `VolunteerTopBar.vue` (planner's discretion) or reuse verbatim in-place — either way, this is the exact block/logic to copy, not re-derive.

**Tab shell + keyboard nav to reuse verbatim** (source: `src/views/ServiceEditorView.vue:710-726` per-button shape, `:1829-1852` `handleTabKeydown`):
```vue
<!-- Source: src/views/ServiceEditorView.vue:710-726 (one tab button; repeat ×3 for Rehearse/Order of Service/Stage Layout) -->
<div role="tablist" class="flex items-center gap-1 px-4 sm:px-6 border-b border-gray-800 bg-gray-900" @keydown="handleTabKeydown">
  <button
    id="vsv-tab-rehearse" role="tab" type="button"
    :aria-selected="activeTab === 'rehearse'" aria-controls="vsv-panel-rehearse"
    :tabindex="activeTab === 'rehearse' ? 0 : -1"
    class="px-4 py-2 text-sm font-medium rounded-t-md transition-colors -mb-px border-b-2"
    :class="activeTab === 'rehearse' ? 'text-indigo-300 border-indigo-500 bg-gray-900' : 'text-gray-400 border-transparent hover:text-gray-200 hover:border-gray-600'"
    @click="activeTab = 'rehearse'"
  >Rehearse</button>
</div>
```
```typescript
// Source: src/views/ServiceEditorView.vue:1829-1852 (handleTabKeydown) — copy verbatim,
// swap `visibleTabOrder`/`tabButtonRef` for this view's 3-tab equivalents.
function handleTabKeydown(event: KeyboardEvent) {
  const tabs = visibleTabOrder.value
  const currentIndex = tabs.indexOf(activeTab.value)
  if (currentIndex === -1) return
  let nextIndex: number | null = null
  switch (event.key) {
    case 'ArrowRight': nextIndex = (currentIndex + 1) % tabs.length; break
    case 'ArrowLeft': nextIndex = (currentIndex - 1 + tabs.length) % tabs.length; break
    case 'Home': nextIndex = 0; break
    case 'End': nextIndex = tabs.length - 1; break
    default: return
  }
  event.preventDefault()
  focusAndActivateTab(tabs[nextIndex]!)
}
```

**orgId resolution + rehearseAccess getDoc pattern (NEW this phase, no direct analog — synthesized in RESEARCH.md Pattern 2, verified against live source):**
```typescript
// Source: pattern synthesized from src/stores/mySchedule.ts (full file read —
// MyScheduleDoc = RehearseAccessDoc & { orgId: string }, docs[] already carries
// orgId per-doc from d.ref.parent.parent!.id) + rehearseAccess.ts's own orgId field.
import { useMyScheduleStore } from '@/stores/mySchedule'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '@/firebase'

const mySchedule = useMyScheduleStore()
const route = useRoute()
const serviceId = route.params.serviceId as string

async function resolveOrgIdAndLoad() {
  let match = mySchedule.docs.find((d) => d.serviceId === serviceId)
  if (!match) {
    await mySchedule.loadMySchedule()
    match = mySchedule.docs.find((d) => d.serviceId === serviceId)
  }
  if (!match) return null // access-denied state, do NOT guess orgId
  const snap = await getDoc(doc(db, 'organizations', match.orgId, 'rehearseAccess', serviceId))
  return snap.exists() ? snap.data() : null
}
```

**Loading/error/access-denied copy (source: UI-SPEC §7, matches `MyScheduleView.vue`'s existing error-state phrasing formula):**
- Loading: reuse `MyScheduleView.vue`'s spinner verbatim + `"Loading this service…"`.
- Access-denied: `"You don't have access to this service, or it's no longer available."` + `‹ Back to My Schedule`.
- Load failure: `"Couldn't load this service. Check your connection and try again."` + Retry.

---

### `src/router/index.ts` (route) — 1-line EDIT

**Current entry** (source: `src/router/index.ts:187-193`):
```typescript
{
  path: '/volunteer/service/:serviceId',
  name: 'volunteer-service',
  component: () => import('../views/VolunteerServicePlaceholderView.vue'),
  meta: { requiresAuth: true, isVolunteerRoute: true },
},
```
**Change:** swap only the `component:` import target to `() => import('../views/VolunteerServiceView.vue')`. Path/name/meta MUST stay identical — `ScheduleServiceCard.vue:101`'s `to` computed (`` `/volunteer/service/${props.serviceId}` ``) already targets this exact path and needs zero changes.

---

### `src/components/rehearse/RehearseSongList.vue` (component, CRUD-read/select) — NEW

**Analogs:** `src/components/SongFilesTab.vue` (`metaLine`, count-badge idiom) + `src/components/ScheduleServiceCard.vue` (real `<router-link>`/button-as-row pattern, props-driven, no store coupling).

**Row-as-real-button pattern** (source: `src/components/ScheduleServiceCard.vue:1-99`, a whole card is a real interactive element with `computed` derived fields, no store calls inside the component — pure presentational props). Mirror this for each song row: real `<button>` (not a `<div>` click handler), `aria-current` for the selected row, PDF/MP3 counts computed via a `.filter(a => a.kind === 'document').length` / `'audio'` count off `song.attachments` (the `RehearseAttachment[]` shape already on `RehearseSong`).

**metaLine-style join for the key + counts row** — reuse the `.filter(Boolean).join(' · ')` graceful-omission idiom from `src/components/SongFilesTab.vue:534-545` (`metaLine`) for any composed row text.

---

### `src/components/rehearse/RehearseSongDetail.vue` (component, CRUD-read) — NEW

**Analog:** `src/components/SongFilesTab.vue` (full file read) — reuse these functions/patterns **verbatim, unmodified**, not re-derived:

```typescript
// Source: src/components/SongFilesTab.vue:512-529 — copy verbatim
function formatSize(bytes?: number): string {
  if (bytes == null) return ''
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
function formatAttachmentDate(createdAt: SongAttachment['createdAt'] | undefined): string {
  if (!createdAt || typeof (createdAt as { toDate?: unknown }).toDate !== 'function') return ''
  return (createdAt as { toDate: () => Date }).toDate().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}
```
```typescript
// Source: src/components/SongFilesTab.vue:497-510, 534-545 — TYPE_LABELS,
// LINK_SOURCE_LABELS, metaLine() — copy verbatim (RehearseAttachment carries
// the same kind/linkSource-adjacent shape from src/utils/songLinks.ts)
const TYPE_LABELS: Record<'document' | 'audio', string> = { document: 'PDF', audio: 'MP3' }
const LINK_SOURCE_LABELS: Record<NonNullable<SongAttachment['linkSource']>, string> = {
  youtube: 'YouTube link', drive: 'Google Drive link', dropbox: 'Dropbox link', other: 'Link',
}
function metaLine(a: SongAttachment): string {
  const date = formatAttachmentDate(a.createdAt)
  if (a.kind === 'link') {
    const source = LINK_SOURCE_LABELS[a.linkSource ?? 'other']
    return [source, date].filter(Boolean).join(' · ')
  }
  const typeLabel = TYPE_LABELS[a.kind]
  const size = formatSize(a.sizeBytes)
  return [typeLabel, size, date].filter(Boolean).join(' · ')
}
```
```typescript
// Source: src/components/SongFilesTab.vue:443-459 (downloadAttachment) —
// copy UNMODIFIED (124-REVIEW FIX A fixed a real cross-origin download bug here)
async function downloadAttachment(a: SongAttachment) {
  try {
    const res = await fetch(a.downloadUrl!)
    if (!res.ok) throw new Error(String(res.status))
    const blob = await res.blob()
    const objectUrl = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = objectUrl
    link.download = a.name
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(objectUrl)
  } catch {
    window.open(a.downloadUrl, '_blank', 'noopener,noreferrer')
  }
}
```
**Grouping filter** (source: `src/components/SongFilesTab.vue:550-553`):
```typescript
const documents = computed(() => props.attachments.filter((a) => a.kind === 'document' || a.kind === 'link'))
const audio = computed(() => props.attachments.filter((a) => a.kind === 'audio'))
```
**Note:** unlike `SongFilesTab.vue`'s per-row inline `<audio controls>` (lines 284-291, `playingId` toggle), this phase centralizes playback into ONE persistent `RehearseAudioPlayerBar.vue` — do not mount an `<audio>` element inside this component; a Play toggle here should emit an event/set a shared "active track" state instead (see Anti-Patterns in RESEARCH.md).

---

### `src/components/rehearse/RehearseFileReader.vue` (component, file-I/O) — NEW

**Analog:** `src/components/SongFilePreviewModal.vue` (full file read, 247 lines) — adapt the **body/iframe internals only**, dropping the Teleport/Transition/backdrop/focus-trap modal chrome (this is an always-visible inline panel, not a dismissible dialog).

**Loading/error state machine to preserve verbatim** (source: `SongFilePreviewModal.vue:153-198`):
```typescript
const loading = ref(true)
const errored = ref(false)

// CRITICAL (Pitfall 3, RESEARCH.md): reset on attachment change, not just on open —
// otherwise a stale error/loading state carries over across song selections.
watch(
  () => props.attachment,
  () => { loading.value = true; errored.value = false },
)

function onLoad(): void { loading.value = false }
function onError(): void { loading.value = false; errored.value = true }
```
**Iframe + error-fallback markup** (source: `SongFilePreviewModal.vue:96-116`):
```vue
<iframe v-if="!errored" :src="attachment.downloadUrl" class="w-full h-full border-0" tabindex="-1" @load="onLoad" @error="onError"></iframe>
<div v-else class="absolute inset-0 flex flex-col items-center justify-center gap-3">
  <p class="text-sm text-gray-400">Couldn't preview this file.</p>
  <a :href="attachment.downloadUrl" download class="px-3 py-1.5 rounded-md text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-500">Download</a>
</div>
```
**Print action (new for this component, no direct copy target — per UI-SPEC §2/Don't-Hand-Roll):** `window.open(attachment.downloadUrl, '_blank', 'noopener,noreferrer')` — NOT `iframe.contentWindow.print()` (throws on cross-origin Storage URLs).

**Mobile link-first variant (R391):** no iframe at all — two full-width buttons, "Open PDF" (`window.open(downloadUrl, '_blank', ...)`) and "Download" (the `downloadAttachment()` fetch-blob function above, copied from `SongFilesTab.vue`).

---

### `src/components/rehearse/RehearseAudioPlayerBar.vue` (component, streaming) — NEW

**Analog:** `src/components/SongFilesTab.vue`'s `<audio>` mount pattern (lines 284-291) and `onAudioError`/`playingId` idiom (lines 466-482) — role-match only (that file mounts a native-`controls` element per-row; this phase needs ONE persistent instance with fully custom transport chrome per UI-SPEC §2 Column 3).

**Native audio element convention to preserve:**
```vue
<!-- Source: src/components/SongFilesTab.vue:284-291 pattern, adapted:
     mount ONCE (not per-row/v-if toggle), class="sr-only" (custom chrome
     replaces the native controls bar), bind @error the same way -->
<audio ref="audioEl" :src="activeTrack?.downloadUrl" class="sr-only" @error="onAudioError" @timeupdate="onTimeUpdate" @loadedmetadata="onLoadedMetadata"></audio>
```
**Speed/loop — native properties, no library (source: RESEARCH.md Code Examples, verified no `pdf.js`/audio-library dependency exists via `grep -i pdf package.json` returning empty):**
```typescript
const SPEEDS = [1, 0.9, 0.75, 1.25] as const
const speedIndex = ref(0)
function cycleSpeed() {
  speedIndex.value = (speedIndex.value + 1) % SPEEDS.length
  if (audioEl.value) audioEl.value.playbackRate = SPEEDS[speedIndex.value]!
}
const loop = ref(false)
function toggleLoop() {
  loop.value = !loop.value
  if (audioEl.value) audioEl.value.loop = loop.value
}
```
**One-track-at-a-time invariant** (source: `SongFilesTab.vue:471-478` `togglePlay`, adapted to a single shared active-track ref instead of a per-row `playingId`):
```typescript
// Selecting a new track REPLACES the current one — never layer a second <audio>.
function playTrack(attachment: RehearseAttachment) {
  activeTrack.value = attachment
  audioErrored.value = false
}
```

---

### `src/components/rehearse/VolunteerOrderOfService.vue` (component, CRUD-read) — NEW

**Analog:** `src/views/ShareView.vue` (full slot-branching block, lines 34-135) — re-theme the row anatomy (dark tokens vs. ShareView's light/print palette), do NOT mount `ShareView.vue` itself.

**Per-kind row branching to re-theme, field-for-field** (source: `ShareView.vue:52-102`):
```vue
<!-- Source: src/views/ShareView.vue:52-60 (SONG), re-theme text-gray-900→text-gray-100 etc. -->
<template v-if="slot.kind === 'SONG'">
  <p class="text-xs text-gray-500 uppercase tracking-wider mb-0.5">{{ slotLabel(slot, index) }}</p>
  <template v-if="slot.songId">
    <p class="text-base font-medium text-gray-900">{{ slot.songTitle }}</p>
    <p class="text-sm text-gray-500">Key: {{ slot.songKey }}</p>
  </template>
  <p v-else class="text-gray-400 italic text-sm">[not assigned]</p>
</template>
<!-- SCRIPTURE (:63-69), PRAYER (:72-74), MESSAGE (:77-82), ANNOUNCEMENTS (:85-87),
     MISC (:90-92), HYMN (:95-102) — identical branching shape, copy each verbatim -->
```
**"Who's Serving" card to re-theme** (source: `ShareView.vue:112-126`):
```vue
<div v-if="serviceSnapshot.roleAssignments?.length" class="mt-6 rounded-lg bg-gray-50 p-4">
  <h2 class="text-sm font-semibold text-gray-700 mb-2">Who's Serving</h2>
  <div v-for="role in serviceSnapshot.roleAssignments" :key="role.roleId" class="py-1">
    <p class="text-xs text-gray-500 uppercase tracking-wider">{{ role.roleName }}</p>
    <p v-if="role.personNames?.length > 0" class="text-sm text-gray-800">{{ role.personNames.join(', ') }}</p>
    <p v-else class="text-gray-400 italic text-sm">[not assigned]</p>
  </div>
</div>
```
**R346/SEC-S-04 comment convention to carry forward** (source: `ShareView.vue:104-106,110`): "no per-item free-text (notes/body) render" — this dark-themed re-implementation must repeat the same never-render-free-text discipline, since it consumes `orderOfService`/`roleAssignments` fields that were ALREADY stripped upstream by `buildRehearseAccess` — do not add a template branch that reads a field the projection doesn't carry.

**Architectural recommendation (per UI-SPEC §4, not mandatory):** factor a single theme-aware row-template both `ShareView.vue` and this component call, rather than forking the branching twice.

---

### `src/components/rehearse/VolunteerStageLayoutTab.vue` (component, CRUD-read) — NEW

**Analog:** `src/components/stage/StageLayoutView.vue` (full file read, embed directly — zero remapping) + `src/views/ShareView.vue:16-32` (wide-cap wrapper + empty copy).

**Embed pattern** (source: `StageLayoutView.vue:7-15` prop defaults — `theme` already defaults to `'dark'`):
```vue
<!-- Source: src/views/ShareView.vue:19-28, re-themed dark (drop print/light overrides) -->
<div class="max-w-[1600px] mx-auto px-4 sm:px-6 py-6">
  <div v-if="stageMarkers.length">
    <StageLayoutView :elements="stageMarkers" theme="dark" :print="false" />
  </div>
  <p v-else class="text-gray-500 text-sm">No stage layout has been set up for this service.</p>
</div>
```
`theme="dark"` is literally the component's own default (`StageLayoutView.vue:15`, `{ theme: 'dark', print: false }`), so this is pure data-plumbing — `stageMarkers` comes straight from the extended `rehearseAccess.stageLayout?.elements ?? []`.

---

## Shared Patterns

### PII-safe projection allowlist (governs `rehearseAccess.ts` extension)
**Source:** `src/stores/services.ts:135-249` (`buildServiceSnapshot`'s per-kind slot switch + stage-marker allowlist)
**Apply to:** `src/utils/rehearseAccess.ts`'s new `orderOfService`/`roleAssignments`/`stageLayout` fields
**Rule:** never re-derive a second allowlist — extract a shared store-free helper both `buildServiceSnapshot` and `buildRehearseAccess` call, or copy the switch/map bodies verbatim. Free-text fields (`notes`, `body`, stage-marker `note`) are NEVER included, matching `PublicStageMarker = Omit<StageMarker, 'note'>` (services.ts:274).

### Cross-origin download (Save-As)
**Source:** `src/components/SongFilesTab.vue:443-459` (`downloadAttachment`)
**Apply to:** `RehearseSongDetail.vue`'s Download buttons, `RehearseFileReader.vue`'s mobile Download button
**Rule:** `fetch → blob → createObjectURL → synthetic <a> click`, fall back to `window.open(url, '_blank', 'noopener,noreferrer')` on fetch failure. Never a plain `<a download>` on a cross-origin Storage URL (124-REVIEW FIX A regression risk).

### Tab shell + roving-tabindex keyboard nav
**Source:** `src/views/ServiceEditorView.vue:710-853` (markup) + `:1829-1852` (`handleTabKeydown`)
**Apply to:** `VolunteerServiceView.vue`'s Rehearse/Order of Service/Stage Layout tabs
**Rule:** `role="tablist"`/`role="tab"`, `aria-selected`/`aria-controls`, roving `tabindex`, Arrow/Home/End keyboard nav — copy the exact classes and keydown handler, only relabel tab ids/panel ids.

### orgId resolution without a route param
**Source:** synthesized from `src/stores/mySchedule.ts` (full file) — `MyScheduleDoc = RehearseAccessDoc & { orgId: string }`
**Apply to:** `VolunteerServiceView.vue`'s `onMounted` hook
**Rule:** resolve `orgId` by matching `serviceId` against `mySchedule.docs` (already loaded), falling back to `mySchedule.loadMySchedule()` on cold navigation. Never trust a route/query param for `orgId` — this route (`src/router/index.ts:187-193`) carries none, by design (volunteer sessions aren't org-scoped).

### Graceful-omission meta-line join
**Source:** `src/components/SongFilesTab.vue:534-545` (`metaLine`)
**Apply to:** `RehearseSongList.vue`'s key/count row, `RehearseSongDetail.vue`'s `"{key} · {bpm} bpm · CCLI {ccliNumber}"` header line
**Rule:** build each clause as a real string or `null`/`''` BEFORE `.filter(Boolean).join(' · ')` — never interpolate a possibly-null value directly into a template literal (Pitfall 4, RESEARCH.md — the "null bpm" bug class).

## No Analog Found

None — every file in this phase has at least a role-match analog in the codebase (see table above). The only genuinely new logic (orgId resolution without a route param, the persistent single-instance audio player replacing per-row `<audio>`) is explicitly synthesized/flagged in RESEARCH.md's Architecture Patterns and cited above rather than invented from nothing.

## Metadata

**Analog search scope:** `src/utils/`, `src/stores/`, `src/views/`, `src/components/`, `src/router/` — all files RESEARCH.md/CONTEXT.md named, plus `ScheduleServiceCard.vue` and `ServiceEditorView.vue` for tab/row-link precedent.
**Files scanned:** `rehearseAccess.ts`, `services.ts` (partial, targeted ranges), `ShareView.vue` (full), `StageLayoutView.vue` (partial), `SongFilePreviewModal.vue` (full), `SongFilesTab.vue` (partial, targeted ranges), `songLinks.ts` (full), `VolunteerServicePlaceholderView.vue` (full), `router/index.ts` (partial), `mySchedule.ts` (full), `ScheduleServiceCard.vue` (partial), `ServiceEditorView.vue` (partial, tab block + keydown handler), `MyScheduleView.vue` (partial, top bar).
**Pattern extraction date:** 2026-09-06
