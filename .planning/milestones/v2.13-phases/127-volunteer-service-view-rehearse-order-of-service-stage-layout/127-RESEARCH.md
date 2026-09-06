# Phase 127: Volunteer Service View — Rehearse, Order of Service & Stage Layout - Research

**Researched:** 2026-09-06
**Domain:** Vue 3 SFC composition, Firestore projection extension, native browser media APIs (audio/PDF)
**Confidence:** HIGH

## Summary

Phase 127 is almost entirely a **composition and data-plumbing** problem, not a new-technology
problem. Every rendering primitive this phase needs already exists in the codebase: `ShareView.vue`'s
per-kind slot row branching (Order of Service), `StageLayoutView.vue`'s dark-default room diagram
(Stage Layout), `SongFilePreviewModal.vue`'s iframe-based PDF viewer (PDF reader), and
`SongFilesTab.vue`'s inline `<audio>` player + `metaLine()`/`formatSize()`/`downloadAttachment()`
helpers (Rehearse tab). Nothing here requires pdf.js, a new audio library, or any new npm dependency —
confirmed by `grep -i pdf package.json` returning empty. The real engineering work is: (1) extending
`buildRehearseAccess()` (src/utils/rehearseAccess.ts, Phase 125) to carry an order-of-service item list
and the stage layout elements, reusing the exact allowlist logic `buildServiceSnapshot`/
`toPublicServiceSnapshot` already enforce so the PII rules are never re-derived from scratch; (2)
resolving `orgId` for the standalone `/volunteer/service/:serviceId` route, which — a Phase 126 finding
not previously surfaced in CONTEXT/UI-SPEC — carries **no orgId param or query string**, so the view
must resolve `orgId` from the volunteer's own already-scoped `mySchedule` store state (or a fresh
`loadMySchedule()` call) rather than trusting a route input; and (3) building 4 new leaf components
(song list, song detail, PDF reader panel, audio player bar) plus the top-level shell, all pure
Tailwind/Vue with no new UI library.

**Primary recommendation:** Extend `RehearseAccessDoc` with two new fields (`orderOfService: RehearseOrderItem[]`
and `stageLayout?: { elements: PublicStageMarker[] }`) built by factoring shared allowlist helpers out
of `buildServiceSnapshot` (or calling it directly and stripping) so Order/Stage projection logic exists
in exactly one place; no `firestore.rules` change is needed since the existing `get` arm already grants
the assigned volunteer the whole `rehearseAccess/{serviceId}` document, not a field subset.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Access gate (assigned volunteer, live Planned check) | API/Backend (Firestore rules) | — | `firestore.rules`' existing `get` arm on `rehearseAccess/{serviceId}` already enforces this; no client-side gate is trustworthy alone |
| orgId resolution for the route | Browser/Client (Pinia store) | — | Route carries only `serviceId`; `mySchedule` store already resolves `orgId` per doc from the collectionGroup query result |
| Projection extension (order items, stage elements) | API/Backend write path (`services.ts` lock-time write) | — | Same choke point that already writes `songs[]`/`assignedEmailsLower` at `markAsPlanned` time — a single frozen snapshot, not a live read |
| Rehearse tab rendering (song list/detail/player) | Browser/Client | — | Pure presentational Vue components consuming the already-fetched `rehearseAccess` doc; no additional Firestore reads |
| PDF viewing | Browser/Client (native) | — | Delegates to the OS/browser's built-in PDF viewer via `<iframe>`/`window.open`; no in-app PDF rendering library |
| Audio playback | Browser/Client (native `<audio>`) | — | `HTMLAudioElement.playbackRate`/`.loop` are native browser APIs; no library |
| Order of Service / Stage Layout tabs | Browser/Client | — | Read-only render of the extended projection; reuses `ShareView.vue` row anatomy and `StageLayoutView.vue` verbatim |

## User Constraints (from CONTEXT.md)

<user_constraints>
### Locked Decisions

**Access & data source (all tabs)**
- The view reads the `rehearseAccess/{serviceId}` projection via the **`get` arm** (the live
  `parentIsPlanned()` check + `email_verified` + assigned-email membership from Phase 125). A volunteer
  opens a service they're assigned to; a not-assigned/Draft/reopened service is denied at the data layer.
- **Extend `buildRehearseAccess`** (src/utils/rehearseAccess.ts) to carry what the Order of Service and
  Stage Layout tabs need, PII-safe (mirroring `buildServiceSnapshot`/ShareView's frozen projection): a
  read-only **order-of-service item list** (section/type/title/song refs — NO free-text notes/slot
  bodies unless ShareView already exposes them) and the **stageLayout** field (the v2.7 additive
  `Service.stageLayout`, which is already positional + role/person "Name - Role" data, not free-text
  PII). Prefer ONE projection + one read path over new scoped reads. Research decides whether to reuse
  `buildServiceSnapshot`'s projection logic vs extend `buildRehearseAccess`.

**Rehearse tab (R385–R390) — the owner's Rehearsal.dc.html mock**
- **Song list** (left): songs in this service with key, PDF count, MP3 count, a now-playing indicator;
  select a song.
- **Song detail** (middle): **Sheet music & chords** = the song's PDF attachments, each with **Print** +
  **Download**; **Recordings** = the MP3 attachments; an optional **per-song note** (only if the
  projection carries a rehearsal note — otherwise omit). All from the v2.11 song attachments
  (download-token URLs) — nothing is uploaded here.
- **PDF reader** (right): view the selected chart, page navigation (Page X of Y, prev/next), **Print**.
  **Mobile (R391): link-first** — open/download the PDF via its download-token URL; the inline
  `<iframe>` viewer is a desktop enhancement only (do NOT assume inline PDF works on phones — v2.7
  research).
- **Audio player** (bottom bar): play/pause, seekable progress, elapsed/total time; **whole-track speed**
  (1× / 0.9× / 0.75× / 1.25× via native `<audio>.playbackRate`) and a **whole-track Loop** toggle
  (`<audio>.loop`). One track plays at a time. Native `<audio>` — works on mobile.
- **External links** (YouTube / Drive / Dropbox) attached in v2.11 open in a **new tab** (no in-app
  embed).

**Order of Service tab (R392, read-only)**
- Render the running order read-only, reusing the existing read-only order-of-service render (the
  ShareView/print path), fed from the projection. No editing.

**Stage Layout tab (R393, read-only)**
- Render the v2.7 stage diagram read-only (instruments/mics + person Name-Role), reusing the existing
  read-only/print stage render (v2.7 shipped a `?view=stage` read-only + "Print for tech"). No editing.
- **WYSIWYG caution (v2.7 bug):** v2.7 fixed a Tailwind `-translate-x/y-1/2` + inline-transform stacking
  bug by using a single inline-transform centering + hard-coded room size so editing/locked/share/print
  render identically. Reuse the SAME read-only render component — do not re-derive marker positioning.

**View shell & tabs**
- Standalone shell (volunteer top bar with the user chip, like the Rehearsal mock's header), tabs
  Rehearse / Order of Service / Stage Layout, Rehearse default. Reached only from My Schedule; a back
  path to My Schedule. Read-only throughout.
- Design → the owner's `Rehearsal.dc.html` mock (Nocturne → app dark gray-950), via a UI-SPEC.

### Claude's Discretion
- Component split, the projection-extension shape, exact tab/route structure, and player component are
  the planner's choice within the constraints above.

### Deferred Ideas (OUT OF SCOPE)
- Server-side transposition, loop-a-section, image/uploaded-video types → out of scope (milestone).
- Per-org storage quota + egress alerting → backlog (owner-deferred).
- Cross-device playback-position sync → future.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| R384 | Standalone read-only volunteer service view (not `ServiceEditorView`), tabs Rehearse/Order of Service/Stage Layout, Rehearse default | View shell pattern (§ Architecture Patterns, Pattern 1); reuses `ServiceEditorView.vue`'s exact tab markup/keyboard pattern |
| R385 | Rehearse tab song list: key, PDF count, MP3 count, now-playing indicator, select a song | `RehearseSong.attachments[]` already carries `kind`; count derived client-side; extend nothing (data already sufficient) |
| R386 | Song detail: Sheet music & chords (PDF) w/ Print+Download, Recordings (MP3), optional per-song note | Reuse `SongFilesTab.vue` row anatomy/`metaLine()`; per-song note omitted (no data-model field — see Assumptions Log) |
| R387 | PDF reader: page nav (Page X of Y, prev/next) + Print | No pdf.js in stack — native iframe/OS viewer recommended in place of a custom paginator (§ Don't Hand-Roll) |
| R388 | Audio player: play/pause, seekable progress, elapsed/total time | Reuse `SongFilesTab.vue`'s native `<audio>` idiom, centralized into one persistent bottom-bar instance |
| R389 | Whole-track speed (1×/0.9×/0.75×/1.25×) + Loop toggle | Native `HTMLAudioElement.playbackRate`/`.loop` — no library (§ Code Examples) |
| R390 | External links (YouTube/Drive/Dropbox) open in new tab | Reuse `songLinks.ts` (`buildLinkAttachment`/`LINK_SOURCE_LABELS`) + `SongFilesTab.vue`'s `<a target="_blank">` row |
| R391 | Mobile: PDFs link-first, audio plays on mobile | 3-column → drill-down stack reflow (§ Architecture Patterns, Pattern 3); native `<audio>` works on mobile unmodified |
| R392 | Read-only Order of Service tab, reusing existing render | `ShareView.vue`'s per-kind slot branching, re-themed (not re-mounted) — needs `buildRehearseAccess` extension |
| R393 | Read-only Stage Layout tab, reusing existing render | `StageLayoutView.vue` embedded verbatim (`theme="dark"` default) — needs `buildRehearseAccess` extension |
</phase_requirements>

## Standard Stack

### Core
No new libraries. This phase is 100% composition of existing in-repo Vue 3 SFCs, Pinia stores, and
native Web Platform APIs.

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Vue 3 (`<script setup>`) | already in repo | Component authoring | Existing project convention, every referenced source file uses it |
| Pinia | already in repo | `mySchedule` store lookup/refresh | Existing project convention |
| Native `HTMLAudioElement` | browser built-in | Playback, speed, loop, seek | `SongFilesTab.vue` already uses `<audio controls>`; `.playbackRate`/`.loop` are standard DOM properties, universally supported in evergreen browsers `[VERIFIED: MDN — HTMLMediaElement.playbackRate/.loop are baseline-widely-available]` |
| Native `<iframe>` + browser PDF viewer | browser built-in | PDF display (desktop) | `SongFilePreviewModal.vue` already does exactly this |

### Supporting
None required.

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Native iframe PDF viewer | `pdfjs-dist` custom paginator | Adds a ~1-2MB dependency, a worker-thread setup, and ongoing maintenance to deliver "Page X of Y" chrome the browser's own viewer already renders for free on desktop; rejected — SEED-003's own `SongFilesTab.vue` comment already documents "no PDF page-count library in the stack" as a deliberate no-new-deps precedent |
| `HTMLAudioElement.playbackRate` | `howler.js` / `wavesurfer.js` | Both add a dependency to get speed/loop/seek the native element already exposes as plain properties; rejected, no gap to fill |
| Reusing `ShareView.vue` component directly (embed) | Fork a new dark-themed component with the same branching | UI-SPEC explicitly calls for re-theming the row anatomy, NOT mounting `ShareView.vue` itself (it is unauthenticated/light/print-oriented) — factor the shared branching into a small presentational helper both call, per UI-SPEC §4's "architectural recommendation" |

**Installation:** none — no `npm install` required for this phase.

**Version verification:** N/A — no new packages.

## Package Legitimacy Audit

No external packages are installed or recommended by this phase. `grep -i pdf package.json` in the
project root returns no matches — confirming no pdf.js/pdfjs-dist dependency exists today
`[VERIFIED: package.json grep]`, and this research explicitly recommends NOT adding one (see Don't
Hand-Roll and Alternatives Considered). If a future phase needs a custom in-app paginator, that
decision should re-run this gate at that time.

**Packages removed due to [SLOP] verdict:** none (no packages proposed)
**Packages flagged as suspicious [SUS]:** none (no packages proposed)

## Architecture Patterns

### System Architecture Diagram

```
My Schedule (Phase 126)                    Volunteer Service View (Phase 127)
┌──────────────────────┐                   ┌─────────────────────────────────────────┐
│ mySchedule store      │  router-link      │ VolunteerServiceView.vue                 │
│ .docs[] (already      │  /volunteer/      │  onMounted:                               │
│  loaded, has orgId    │  service/:id ───► │   1. look up serviceId in mySchedule      │
│  per doc)             │  (NO orgId param) │      .docs (Pinia, already in memory)     │
└──────────────────────┘                   │   2. if absent (cold nav/refresh):        │
                                             │      await mySchedule.loadMySchedule()   │
                                             │      then re-look-up                     │
                                             │   3. resolved orgId + serviceId          │
                                             │      → getDoc(organizations/{orgId}/     │
                                             │        rehearseAccess/{serviceId})       │
                                             │        (LIVE get-arm re-check, R377)     │
                                             └──────────────┬────────────────────────────┘
                                                             │ RehearseAccessDoc
                                                             │ (extended: +orderOfService,
                                                             │  +stageLayout)
                                    ┌────────────────────────┼────────────────────────┐
                                    ▼                        ▼                        ▼
                          ┌──────────────────┐   ┌──────────────────────┐  ┌────────────────────┐
                          │ Rehearse tab      │   │ Order of Service tab │  │ Stage Layout tab    │
                          │ (default)         │   │ (read-only)          │  │ (read-only)         │
                          │                   │   │                      │  │                     │
                          │ Column 1:         │   │ Reuses ShareView's   │  │ <StageLayoutView    │
                          │  RehearseSongList │   │ per-kind slot row    │  │   :elements=         │
                          │ Column 2:         │   │ branching (re-themed,│  │     stageMarkers     │
                          │  RehearseSongDetail│  │ not re-mounted)      │  │   theme="dark" />    │
                          │ Column 3:         │   │                      │  │ (zero remapping —    │
                          │  RehearseFileReader│  └──────────────────────┘  │  dark is default)    │
                          │ Bottom bar:       │                             └─────────────────────┘
                          │  RehearseAudio-    │
                          │  PlayerBar         │
                          │  (native <audio>,  │
                          │  playbackRate/loop)│
                          └──────────────────┘
                                    │
                                    ▼ (PDF/MP3/link → `downloadUrl`/`href`)
                          Firebase Storage (download-token URLs,
                          already denormalized onto SongAttachment
                          by v2.11 — no new storage.rules needed)
```

### Recommended Project Structure
```
src/
├── views/
│   └── VolunteerServiceView.vue           # replaces VolunteerServicePlaceholderView.vue; owns
│                                            # orgId resolution, doc fetch, tab state, whole-view states
├── components/
│   ├── rehearse/
│   │   ├── RehearseSongList.vue           # Column 1 / mobile Screen A
│   │   ├── RehearseSongDetail.vue         # Column 2 / mobile Screen B
│   │   ├── RehearseFileReader.vue         # Column 3 PDF panel / mobile Screen C link-first panel
│   │   ├── RehearseAudioPlayerBar.vue     # persistent bottom transport (speed/loop/seek)
│   │   ├── VolunteerOrderOfService.vue    # Order of Service tab body (re-themed ShareView rows)
│   │   └── VolunteerStageLayoutTab.vue    # thin wrapper: <StageLayoutView :elements :theme="dark" />
│   └── VolunteerTopBar.vue                # optional: factor MyScheduleView.vue's top bar out (planner's call)
└── utils/
    └── rehearseAccess.ts                  # EXTEND: +orderOfService, +stageLayout, +bpm resolution
```

### Pattern 1: Tab shell reusing `ServiceEditorView.vue`'s exact tablist markup
**What:** `role="tablist"` container with `role="tab"` buttons, `aria-selected`/`aria-controls`/roving
`tabindex`, and a shared `handleTabKeydown` for arrow-key navigation.
**When to use:** The 3-tab Rehearse/Order of Service/Stage Layout switcher (R384).
**Example:**
```vue
<!-- Source: src/views/ServiceEditorView.vue:710-797 (existing pattern, reused verbatim per UI-SPEC §1) -->
<div role="tablist" class="flex items-center gap-1 px-4 sm:px-6 border-b border-gray-800 bg-gray-900" @keydown="handleTabKeydown">
  <button
    id="vsv-tab-rehearse"
    role="tab"
    type="button"
    :aria-selected="activeTab === 'rehearse'"
    aria-controls="vsv-panel-rehearse"
    :tabindex="activeTab === 'rehearse' ? 0 : -1"
    class="px-4 py-2 text-sm font-medium rounded-t-md transition-colors -mb-px border-b-2"
    :class="activeTab === 'rehearse'
      ? 'text-indigo-300 border-indigo-500 bg-gray-900'
      : 'text-gray-400 border-transparent hover:text-gray-200 hover:border-gray-600'"
    @click="activeTab = 'rehearse'"
  >Rehearse</button>
  <!-- Order of Service, Stage Layout tabs identical shape -->
</div>
```

### Pattern 2: orgId resolution without a route param (NEW finding this phase)
**What:** `/volunteer/service/:serviceId` (registered Phase 126) carries only `serviceId` — no `orgId`.
`RehearseAccessDoc` lives at `organizations/{orgId}/rehearseAccess/{serviceId}`, so a Firestore `getDoc`
needs `orgId` to build the path.
**When to use:** `VolunteerServiceView.vue`'s `onMounted` hook, before any Firestore read.
**Example:**
```typescript
// Source: pattern synthesized from src/stores/mySchedule.ts (orgId already resolved
// per-doc there) + src/utils/rehearseAccess.ts's own `orgId: string` field on
// RehearseAccessDoc (written by buildRehearseAccess, so it round-trips on the doc itself).
import { useMyScheduleStore } from '@/stores/mySchedule'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '@/firebase'

const mySchedule = useMyScheduleStore()
const route = useRoute()
const serviceId = route.params.serviceId as string

async function resolveOrgIdAndLoad() {
  let match = mySchedule.docs.find((d) => d.serviceId === serviceId)
  if (!match) {
    // Cold navigation / page refresh — the store hasn't been populated yet.
    await mySchedule.loadMySchedule()
    match = mySchedule.docs.find((d) => d.serviceId === serviceId)
  }
  if (!match) {
    // Not assigned, or the aggregate list rule's status==='planned' filter
    // excludes it (already reopened) — render the access-denied state,
    // do NOT attempt a getDoc with a guessed/absent orgId.
    return null
  }
  // The LIVE get-arm re-check (R377's parentIsPlanned()) still matters even
  // though the list arm already proved status==='planned' at query time —
  // a getDoc here re-validates against the CURRENT parent status, closing
  // the same staleness gap 125-02-SUMMARY.md's WR-01 retry logic guards on
  // the write side.
  const snap = await getDoc(doc(db, 'organizations', match.orgId, 'rehearseAccess', serviceId))
  return snap.exists() ? snap.data() : null
}
```
**Note:** `match.orgId` here is available two ways — either from `mySchedule.ts`'s own
`d.ref.parent.parent.id` mapping (confirmed in 126-03-SUMMARY.md), OR directly from the document's own
`orgId` field (written by `buildRehearseAccess`, confirmed in `rehearseAccess.ts:32,146`). Either source
is correct since they're the same value at write time; prefer the store's already-mapped field to avoid
a second lookup path.

### Pattern 3: Mobile drill-down reflow (3 columns → stacked screens)
**What:** Below `sm:` (640px), Rehearse's 3-column desktop layout becomes 3 full-width "screens"
(song list → song detail → PDF reader) navigated by tapping forward and a `‹ Back` control, while a
single persistent bottom audio player instance survives all 3 screens without remounting.
**When to use:** R391 (mobile-friendly Rehearse tab).
**Example:**
```vue
<!-- Source: pattern per 127-UI-SPEC.md §3 -->
<div class="sm:hidden">
  <RehearseSongList v-if="mobileScreen === 'list'" @select="onSelectSong" />
  <RehearseSongDetail v-else-if="mobileScreen === 'detail'" :song="selectedSong" @back="mobileScreen = 'list'" @open-pdf="mobileScreen = 'reader'" />
  <RehearseFileReader v-else-if="mobileScreen === 'reader'" :attachment="selectedAttachment" mobile-link-first @back="mobileScreen = 'detail'" />
  <!-- Player renders OUTSIDE the v-if/else-if chain, once, so it never unmounts on screen change -->
  <RehearseAudioPlayerBar v-if="activeTrack" :track="activeTrack" fixed-bottom />
</div>
<div class="hidden sm:flex ...">
  <!-- desktop 3-column layout, RehearseSongList/Detail/FileReader all mounted simultaneously -->
</div>
```

### Anti-Patterns to Avoid
- **Forking `ShareView.vue` or `StageLayoutView.vue` into a second copy:** R384 explicitly requires
  reusing the existing read-only renderers, not building parallel editor-adjacent components. For Stage
  Layout, embed the component directly (zero changes needed, dark is its default theme). For Order of
  Service, factor the shared per-kind row branching into one small presentational helper both `ShareView.vue`
  and the new tab call — do not copy/paste the `v-if`/`v-else-if` chain into a second file (drift risk
  flagged explicitly in UI-SPEC §4).
- **Re-deriving PII rules for the new projection fields:** `buildServiceSnapshot`'s slot/role/stage
  allowlists already encode the R346/SEC-S-04 free-text-strip rules. A parallel implementation inside
  `buildRehearseAccess` risks drifting from those rules over time (e.g., forgetting to strip
  `stageLayout.elements[].note`). Reuse the same allowlist logic (extract a shared helper, or call
  `buildServiceSnapshot`+`toPublicServiceSnapshot` and copy only the fields needed) rather than
  hand-rolling a second allowlist.
- **Trusting a route param for orgId that doesn't exist:** the placeholder route the previous phase
  registered has no orgId slot. Do not add a query param to work around this without updating
  `ScheduleServiceCard.vue`'s `to` computed in lockstep (a cross-phase change) — the store-lookup pattern
  above requires zero route/Phase-126 changes.
- **Mounting more than one `<audio>` element at a time:** `SongFilesTab.vue`'s per-row `playingId`
  toggle already establishes "one track at a time"; Phase 127 centralizes this further into a single
  persistent player instance (not per-row), so switching songs must stop/replace the existing track,
  never layer a second one.
- **Building a custom PDF paginator:** see Don't Hand-Roll below.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| PDF "Page X of Y, prev/next" chrome | A custom PDF.js-based paginator overlay | Native `<iframe :src="downloadUrl">` (desktop) / `window.open(downloadUrl)` (mobile) — let the browser's or OS's own PDF viewer supply page nav, zoom, search, print | No `pdf.js`-class dependency exists in the stack today; adding one purely for decorative page-count chrome the native viewer already provides contradicts the SEED-003 no-new-deps precedent already documented in `SongFilesTab.vue`'s own `metaLine()` comment |
| Playback speed control | A custom Web Audio API pitch-preserving time-stretch implementation | `<audio>.playbackRate = 0.9` etc. | Native `HTMLMediaElement.playbackRate` already exists, works identically across evergreen browsers, and needs zero additional code beyond a `<select>`/button cycling a value |
| Loop-a-track | Custom `timeupdate` listener manually seeking to 0 | `<audio>.loop = true` | Native boolean property; the browser handles the seamless restart |
| Cross-origin Save-As download | A raw `<a href download>` for a Storage URL | The existing `fetch()` → `blob()` → `URL.createObjectURL()` → synthetic click pattern from `SongFilesTab.vue`'s `downloadAttachment()` | Storage download URLs are cross-origin, so the plain `download` attribute is silently ignored by the browser and navigates the SPA away instead of prompting Save — this exact bug was already found and fixed in v2.11 (124-REVIEW FIX A); do not regress it in a new component |
| PDF/audio print | `iframe.contentWindow.print()` | `window.open(downloadUrl, '_blank', 'noopener,noreferrer')`, letting the native viewer's own Print supply the dialog | The iframe's `src` is a cross-origin Storage URL — calling `.print()` on a cross-origin `contentWindow` throws; `SongFilesTab.vue`'s Download fallback already establishes the new-tab pattern as the safe cross-origin idiom |
| Link-source badge (YouTube/Drive/Dropbox) | New link-classification logic | `inferLinkSource()` / `LINK_SOURCE_LABELS` (already in `src/utils/songLinks.ts` / `SongFilesTab.vue`) | Already built in v2.11 for the exact same three sources; this phase only needs to *render* the existing `SongAttachment.linkSource`/`href`, never reclassify |

**Key insight:** Every "hard" problem this phase's requirements describe (PDF paging, audio speed/loop,
cross-origin download, link classification) was already solved by a native browser API or a prior phase.
The actual net-new work is composition (assembling existing pieces into 3 new tabs) plus one small,
mechanically-derivable projection extension.

## Common Pitfalls

### Pitfall 1: Assuming the route carries `orgId`
**What goes wrong:** A `getDoc(doc(db, 'organizations', route.query.org, 'rehearseAccess', serviceId))`
call is written assuming an `orgId` route param/query exists, and crashes or silently 403s because it's
`undefined`.
**Why it happens:** Every other org-scoped view in this app (`ServiceEditorView.vue`, etc.) is reached
from within an already-org-scoped session with `orgId` in the Pinia auth store. The volunteer session
(Phase 125) is explicitly NOT org-scoped — a magic-link volunteer holds no `orgId` claim at all (the
whole reason `mySchedule.ts` needs a `collectionGroup` query instead of a normal subcollection query).
**How to avoid:** Resolve `orgId` from the `mySchedule` store's already-loaded `docs` (matching by
`serviceId`), falling back to a fresh `loadMySchedule()` call on cold navigation. See Pattern 2 above.
**Warning signs:** A `getDoc` call with a template-literal path containing `undefined`; a permission-denied
error on a service the volunteer IS actually assigned to, when navigating directly to the URL (e.g. a
bookmarked link, a page refresh) rather than clicking through from My Schedule.

### Pitfall 2: Re-deriving the PII allowlist for the new projection fields
**What goes wrong:** A second, hand-written per-kind slot branch (or a second `stageLayout.elements`
mapping) is written inside `buildRehearseAccess`, independently from `buildServiceSnapshot`'s existing
allowlist — and later drifts (e.g., a future stage-marker field addition updates one allowlist but not
the other, leaking free-text `note` through the `rehearseAccess` path even though `toPublicServiceSnapshot`
still strips it from the share-link path).
**Why it happens:** `buildRehearseAccess` is a pure, store-free function (by design, per 125-02's
`key-decisions`) that takes already-resolved data as arguments — it's tempting to write a second
standalone mapper rather than reach for `buildServiceSnapshot`, which itself calls `useSongStore()` /
`useRosterStore()` / `useQuartersStore()` internally (store-coupled, unlike `buildRehearseAccess`).
**How to avoid:** Extract the per-kind slot mapper (the `switch (slot.kind)` block, `services.ts:135-204`)
and the stage-marker allowlist mapper (`services.ts:224-249`) into standalone, store-free helper
functions in `src/utils/` (or `src/stores/services.ts` exported alongside `buildServiceSnapshot`) that
BOTH `buildServiceSnapshot` and `buildRehearseAccess` call with plain-argument input — matching the
"pure builder in `src/utils/`" convention 125-02-SUMMARY.md's `patterns-established` already documents.
**Warning signs:** Two near-identical `switch (slot.kind)` blocks in the codebase; a stage-marker mapping
with slightly different field lists between `services.ts` and `rehearseAccess.ts`.

### Pitfall 3: Mounting the PDF iframe with a stale attachment across song selections
**What goes wrong:** Column 3's PDF reader panel is fed `:src="attachment.downloadUrl"` without resetting
`loading`/`errored` state when a different song's PDF is selected — carrying over a previous file's error
state onto a new file, or flashing the old PDF momentarily before the new `src` loads.
**Why it happens:** `SongFilePreviewModal.vue`'s existing `watch([() => props.open, () => props.attachment], ...)`
resets `loading`/`errored` on attachment change specifically because it's designed to be reused for
multiple attachments across its lifetime — the inline (non-modal) adaptation for Column 3 must carry this
same watcher forward, not drop it because "it's not a modal anymore."
**How to avoid:** Preserve the `watch(() => props.attachment, ...)` reset logic verbatim when adapting
`SongFilePreviewModal.vue`'s internals into the new non-modal `RehearseFileReader.vue`.
**Warning signs:** Selecting a second song's PDF after the first one errored (e.g., offline test) shows
the OLD error message instead of a fresh loading spinner.

### Pitfall 4: bpm/bpm-less songs breaking the meta-line join
**What goes wrong:** `"{key} · {bpm} bpm · CCLI {ccliNumber}"` renders as `"Bb · bpm · CCLI 1234"` (a bare
literal "bpm" with no number) when a song's resolved `bpm` is `null`.
**Why it happens:** Naively concatenating `bpm + ' bpm'` without first checking `bpm != null` produces a
truthy non-empty string (`"null bpm"` or `"bpm"` depending on template syntax) that survives a
`.filter(Boolean)` join.
**How to avoid:** Build the "N bpm" clause as `bpm != null ? \`${bpm} bpm\` : null` BEFORE the
`.filter(Boolean).join(' · ')` call — mirroring `SongFilesTab.vue`'s `metaLine()` exactly, which
computes each clause as either a real string or a literal `''`/`null`, never a partial-interpolation
string.
**Warning signs:** A song with no arrangement bpm shows a meta line containing the literal substring
"bpm" with nothing before it.

### Pitfall 5: `emptyText`/`v-if` gaps producing an unhandled `undefined` render
**What goes wrong:** The optional per-song "Note from {leader}" card (UI-SPEC, explicitly `⚠ unresolved`
— may extend or may omit) gets a `v-if="song.note"` check added to the template while `RehearseSong`'s
type has no `note` field at all, so `song.note` is a TypeScript error under `npm run type-check`'s
stricter test-inclusive gate (per CLAUDE.md's "use `npm run type-check`, not `-p tsconfig.app.json`" note)
even though a narrower editor-only typecheck might not catch it.
**Why it happens:** The mock shows this field; a plan or executor may render it optimistically assuming
the projection will be extended, without confirming the type was actually added this phase.
**How to avoid:** If the planner chooses to OMIT the per-song note this phase (the CONTEXT-sanctioned
default), do not add any `v-if="song.note"` branch at all — omit the whole card unconditionally, matching
the "omit the whole card, not a silently-false-condition" contract already spelled out in UI-SPEC's Data
Dependencies table.
**Warning signs:** `npm run type-check` reports `Property 'note' does not exist on type 'RehearseSong'`.

## Runtime State Inventory

Not applicable — this is a greenfield phase (new view/components/projection fields), not a
rename/refactor/migration. No existing stored data, live service config, OS-registered state, or
secrets reference this phase's new field names.

## Code Examples

### Extending `buildRehearseAccess` with bpm, order-of-service, and stage layout
```typescript
// Source: pattern derived directly from src/stores/services.ts:135-156 (bpm resolution)
// and :224-249 (stage-marker allowlist) — src/utils/rehearseAccess.ts, Phase 127 extension.
// `songs` (Song[]) is already a buildRehearseAccess parameter; Arrangement lookup needs no
// new data dependency.

export interface RehearseSong {
  id: string
  title: string
  keyOrArrangement?: string
  bpm?: number | null // NEW — resolved via song.arrangements.find(a => a.key === keyOrArrangement)
  attachments: RehearseAttachment[]
}

export interface RehearseOrderItem {
  // Mirrors ServiceSnapshot's per-kind slot shape (services.ts:135-204), minus
  // free-text notes/body — same allowlist buildServiceSnapshot already enforces.
  id: string
  kind: SongSlot['kind']
  position: number
  // ...per-kind fields identical to ServiceSnapshot's ServiceSlot union
}

export interface RehearseAccessDoc {
  // ...existing fields unchanged...
  orderOfService: RehearseOrderItem[]       // NEW — required by R392
  roleAssignments: RehearseRoleAssignment[] // NEW — "Who's Serving" card, same shape as ServiceSnapshot.roleAssignments
  stageLayout?: { elements: PublicStageMarker[] } // NEW — required by R393, PublicStageMarker already exported from services.ts
}
```

### Whole-track speed cycling (R389)
```typescript
// Source: pattern using native HTMLMediaElement.playbackRate (no library)
const SPEEDS = [1, 0.9, 0.75, 1.25] as const
const speedIndex = ref(0)
const audioEl = ref<HTMLAudioElement | null>(null)

function cycleSpeed() {
  speedIndex.value = (speedIndex.value + 1) % SPEEDS.length
  if (audioEl.value) audioEl.value.playbackRate = SPEEDS[speedIndex.value]!
}
const speedLabel = computed(() => `${SPEEDS[speedIndex.value]}×`)
```

### Whole-track loop toggle (R389)
```typescript
// Source: pattern using native HTMLMediaElement.loop (no library)
const loop = ref(false)
function toggleLoop() {
  loop.value = !loop.value
  if (audioEl.value) audioEl.value.loop = loop.value
}
```

### Cross-origin download (reuse verbatim)
```typescript
// Source: src/components/SongFilesTab.vue:443-459 (downloadAttachment) — copy this
// function unmodified into any new component that needs a Save-As download; do not
// re-derive it (124-REVIEW FIX A fixed a real production bug here).
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

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| N/A | N/A | — | This is a stable, mature slice of the Web Platform (native `<audio>`, native PDF viewers, Vue 3 SFCs) — no recent framework/API shifts affect this phase |

**Deprecated/outdated:** none identified.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Per-song "Note from {leader}" should be omitted entirely this phase (no data-model field exists) rather than the projection being extended to add one | Rehearse tab / R386 | Low — CONTEXT explicitly sanctions omission as the default; if the owner wants this field, it's a small, isolated follow-up (add a `note?: string` to `RehearseSong` + a UI editor field elsewhere, out of this phase's scope) |
| A2 | `bpm` should be added to `RehearseSong` this phase (small, low-risk extension reusing `buildServiceSnapshot`'s existing resolution logic) rather than omitted | Rehearse tab meta line / R385 | Low — if omitted instead, the meta line simply drops the bpm clause per the graceful-omission join pattern; no functional break either way, purely a display richness call |
| A3 | Time signature is permanently unavailable (no data-model source anywhere in `Arrangement`/`Song`/`Service`) | Rehearse tab meta line | Low — confirmed by direct type read in UI-SPEC's Data Dependencies table; would only be wrong if a new field were silently added between UI-SPEC authoring and this research (not observed) |
| A4 | The `mySchedule` store lookup + fallback `loadMySchedule()` pattern is the correct way to resolve `orgId` for the standalone route, rather than adding an `orgId` query param to `ScheduleServiceCard.vue`'s link | Architecture Patterns, Pattern 2 | Medium — this is a planner-facing architectural recommendation, not a locked decision; if the planner instead threads `orgId` through as a query param, that requires touching Phase 126's `ScheduleServiceCard.vue` and its existing test assertions (href strings), which is a larger footprint. Flagging so the planner makes this call deliberately rather than by accident. |

## Open Questions

1. **Should Order of Service / Stage Layout data be included in the SAME `getDoc` read, or a second read?**
   - What we know: CONTEXT explicitly prefers "ONE projection + one read path over new scoped reads" —
     i.e., extend the existing `rehearseAccess` doc rather than add a second Firestore read.
   - What's unclear: nothing significant — this is effectively decided by CONTEXT, just flagging it here
     so the planner doesn't second-guess it mid-execution.
   - Recommendation: extend `RehearseAccessDoc` with `orderOfService`/`roleAssignments`/`stageLayout`
     fields; single `getDoc` call serves all 3 tabs.

2. **Does extending `RehearseAccessDoc` risk exceeding Firestore's 1MiB document size limit for a
   service with many slots/attachments?**
   - What we know: the existing doc already carries every song's full attachment list (PDF/MP3/link
     metadata with URLs). Order-of-service items and stage markers are much smaller per-item (a handful
     of short strings/numbers each) than a song's attachment array.
   - What's unclear: no real-world upper bound on slot count or stage marker count is documented; this is
     very unlikely to matter in practice for a single service's worth of data, but the plan should not
     assume unlimited scale.
   - Recommendation: no action needed for v1 — flag as a non-blocking note only; if a future service ever
     has a genuinely pathological slot/marker count, that's a separate, unrelated scaling concern.

## Environment Availability

Skipped — this phase has no external service/tool dependencies beyond the already-configured Firebase
project (Firestore, Storage) this codebase already depends on for every prior phase. `.env.local` is
already required project-wide per CLAUDE.md and is not phase-specific.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (already configured — `vitest.config.ts` at repo root) |
| Config file | `vite.config.ts` (app suite, jsdom) — bare `npx vitest run` is the correct scoping per CLAUDE.md |
| Quick run command | `npx vitest run src/utils/rehearseAccess.test.ts` |
| Full suite command | `npx vitest run` (baseline: only `src/storage.rules.test.ts` fails — unrelated to this phase) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| R384 | Tab shell defaults to Rehearse, switches on click/arrow keys, access-denied/loading/error states render correctly | unit (component) | `npx vitest run src/views/__tests__/VolunteerServiceView.test.ts` | ❌ Wave 0 |
| R385 | Song list renders key/PDF-count/MP3-count/now-playing per song; selecting a row updates Column 2/3 | unit (component) | `npx vitest run src/components/rehearse/__tests__/RehearseSongList.test.ts` | ❌ Wave 0 |
| R386 | Song detail groups Documents/Recordings correctly, Print/Download wired, empty-state copy per group | unit (component) | `npx vitest run src/components/rehearse/__tests__/RehearseSongDetail.test.ts` | ❌ Wave 0 |
| R387 | PDF reader mounts `<iframe :src>`, loading/error states, no custom paginator built | unit (component) | `npx vitest run src/components/rehearse/__tests__/RehearseFileReader.test.ts` | ❌ Wave 0 |
| R388 | Audio player renders play/pause/seek/elapsed-total; wires native `<audio>` element correctly | unit (component) | `npx vitest run src/components/rehearse/__tests__/RehearseAudioPlayerBar.test.ts` | ❌ Wave 0 |
| R389 | Speed cycles 1→0.9→0.75→1.25→1 and sets `audioEl.playbackRate`; Loop toggles `audioEl.loop` | unit (component) | same file as R388 | ❌ Wave 0 |
| R390 | External link rows render `<a target="_blank" rel="noopener noreferrer">` with correct source label | unit (component) | included in RehearseSongDetail test file | ❌ Wave 0 |
| R391 | Mobile breakpoint renders drill-down screens (list→detail→reader) instead of 3-column layout; player persists across screen changes | unit (component, viewport/class assertion) | included in VolunteerServiceView test file | ❌ Wave 0 |
| R392 | Order of Service tab renders extended `orderOfService`/`roleAssignments` fields per-kind, matches `ShareView.vue`'s row shape | unit (component) | `npx vitest run src/components/rehearse/__tests__/VolunteerOrderOfService.test.ts` | ❌ Wave 0 |
| R393 | Stage Layout tab embeds `StageLayoutView` with `theme="dark"` and the extended `stageLayout.elements` | unit (component) | included in the same test file, or a thin dedicated one | ❌ Wave 0 |
| Projection extension | `buildRehearseAccess` produces `orderOfService`/`roleAssignments`/`stageLayout` matching `buildServiceSnapshot`'s allowlist exactly (no free-text leak) | unit | `npx vitest run src/utils/rehearseAccess.test.ts` (extend existing file) | ✅ (extend existing) |
| Rules parity | The `get` arm on `rehearseAccess/{serviceId}` still grants the whole extended doc with no schema change needed | integration (emulator) | `npx vitest run --config vitest.rules.config.ts -t "R377"` | ✅ (existing suite, rerun to confirm no regression) |

### Sampling Rate
- **Per task commit:** the relevant component/unit test file for that task, plus `npm run type-check`
- **Per wave merge:** `npx vitest run` (full app suite) + `npm run type-check`
- **Phase gate:** full app suite green + `npx vitest run --config vitest.rules.config.ts -t "R377"` green
  before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `src/views/__tests__/VolunteerServiceView.test.ts` — covers R384, R391 (whole-view states, tab
      switching, mobile reflow, orgId-resolution fallback)
- [ ] `src/components/rehearse/__tests__/RehearseSongList.test.ts` — covers R385
- [ ] `src/components/rehearse/__tests__/RehearseSongDetail.test.ts` — covers R386, R390
- [ ] `src/components/rehearse/__tests__/RehearseFileReader.test.ts` — covers R387
- [ ] `src/components/rehearse/__tests__/RehearseAudioPlayerBar.test.ts` — covers R388, R389
- [ ] `src/components/rehearse/__tests__/VolunteerOrderOfService.test.ts` — covers R392
- [ ] Extend `src/utils/rehearseAccess.test.ts` with new cases for `orderOfService`/`roleAssignments`/
      `stageLayout`/`bpm` (mirroring the existing 6-case structure)
- [ ] No new test framework/config needed — Vitest + Vue Test Utils are already fully configured and
      used identically by `MyScheduleView.test.ts`/`ScheduleServiceCard`'s test siblings from Phase 126

**Manual/human-UAT items (cannot be automated):**
- Real PDF rendering fidelity inside the desktop `<iframe>` across Chrome/Edge/Firefox/Safari (each
  browser's built-in PDF viewer differs slightly in chrome/page-nav UI — jsdom cannot render an actual
  PDF).
- Real audio playback + speed/loop behavior on an actual mobile device (iOS Safari has historically had
  quirks with `playbackRate` and autoplay policies that jsdom's mocked `<audio>` element cannot surface).
- The "Open PDF" mobile hand-off to the native OS PDF viewer (link-first behavior) — genuinely requires a
  physical/emulated phone, not just a narrow viewport in a desktop browser.
- End-to-end magic-link volunteer sign-in → My Schedule → Rehearse flow against a real deployed
  Firestore index (the same outstanding owner action already documented in 126-01-SUMMARY.md).

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-------------------|
| V2 Authentication | yes (inherited, not re-implemented this phase) | Firebase magic-link auth + `email_verified` check, already enforced by Phase 125's `firestore.rules` `get` arm |
| V3 Session Management | yes (inherited) | Firebase Auth session token; no new session logic this phase |
| V4 Access Control | yes | The existing `rehearseAccess/{serviceId}` `get` rule (assigned-email + live Planned check) is the SOLE access gate for all 3 tabs' data — this phase adds no new access-control surface, only new fields inside the same gated document |
| V5 Input Validation | n/a — this phase is read-only; no user-supplied input is written anywhere (no forms, no uploads) | — |
| V6 Cryptography | n/a — no new crypto surface | — |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|----------------------|
| Reading another org's `rehearseAccess` doc by guessing/enumerating serviceIds | Information Disclosure | Already mitigated by the existing `get` arm's `assignedEmailsLower` check + live `parentIsPlanned()` re-check (Phase 125) — this phase does not touch that rule and must not weaken it |
| Leaking free-text PII (stage-marker `note`, slot `notes`/`body`) through the NEW `orderOfService`/`stageLayout` fields | Information Disclosure | Reuse `buildServiceSnapshot`'s existing field-allowlist logic (Pitfall 2 above) rather than a fresh allowlist that might omit the strip |
| Stale `rehearseAccess` doc surviving a Reopen and exposing since-changed order/stage data | Information Disclosure / Tampering-adjacent staleness | Already mitigated by `reopenService`'s existing delete-on-reopen (125-02) + the `get` arm's live `parentIsPlanned()` re-check — the new fields ride the SAME doc lifecycle, no separate revocation path needed |
| A compromised client requesting another volunteer's `orgId`/service via a manipulated route/query param | Spoofing | Mitigated by resolving `orgId` from the volunteer's OWN scoped `mySchedule` query result (server-enforced by the `assignedEmailsLower` filter), never from a client-suppliable route/query value — see Pattern 2's explicit non-trust-route-input framing |

## Sources

### Primary (HIGH confidence)
- `src/utils/rehearseAccess.ts` (read in full) — current `RehearseAccessDoc`/`buildRehearseAccess` shape
- `src/stores/services.ts` (`buildServiceSnapshot`, `toPublicServiceSnapshot`, `PublicStageMarker`) — the
  allowlist logic to reuse
- `src/views/ShareView.vue` (read in full) — Order of Service row anatomy, stage-view landscape pattern
- `src/components/stage/StageLayoutView.vue` (read in full) — confirmed `theme: 'dark'` default prop
- `src/components/SongFilesTab.vue` (read in full) — audio player, download, metaLine, link rendering
  patterns
- `src/components/SongFilePreviewModal.vue` (read in full) — iframe PDF viewer loading/error pattern
- `src/utils/songLinks.ts` (read in full) — `isValidExternalLink`/`inferLinkSource`/`buildLinkAttachment`
- `firestore.rules` lines 262-310, 394-463 (read) — confirmed the `get` arm grants the whole document
  (no field-level restriction), so extending the doc schema needs no rules change
- `src/router/index.ts` lines 187-194, `src/components/ScheduleServiceCard.vue` line 101 — confirmed the
  `/volunteer/service/:serviceId` route carries NO orgId param/query
- `.planning/phases/125-.../125-02-SUMMARY.md`, `.planning/phases/126-.../126-03-SUMMARY.md`,
  `.planning/phases/126-.../126-04-SUMMARY.md` — prior-phase decisions and the orgId-resolution gap
- `package.json` grep for "pdf" (returned no matches) `[VERIFIED: package.json grep]`

### Secondary (MEDIUM confidence)
- `[CITED: MDN HTMLMediaElement]` — `.playbackRate`/`.loop` are standard, baseline-available DOM
  properties on `<audio>`/`<video>` elements (training-knowledge confirmation of a very long-stable Web
  Platform API; not independently re-verified via a live fetch this session, but low-risk given the API's
  age and stability)

### Tertiary (LOW confidence)
None used — all claims in this research are grounded in direct file reads from this codebase or
long-stable, uncontroversial Web Platform APIs.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependencies; every reused component/utility was read in full this session
- Architecture: HIGH — orgId-resolution gap and projection-extension approach are both grounded in direct
  reads of the actual route/store/rules code, not inference
- Pitfalls: HIGH — all 5 pitfalls are derived from actual code patterns/comments already in the repo
  (e.g., 124-REVIEW FIX A, R346/SEC-S-04, 125-02's WR-01), not speculative

**Research date:** 2026-09-06
**Valid until:** 2026-10-06 (30 days — stable domain, no fast-moving external dependencies)
