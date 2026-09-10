# Phase 140: Vamps Library — CRUD & Storage - Research

**Researched:** 2026-09-09
**Domain:** Vue 3 + Pinia + Firebase (Firestore/Storage) CRUD feature, mirroring the shipped v2.11 Song
attachment pattern, placed as a tab on an existing page (not a new route)
**Confidence:** HIGH — every code claim below is grounded in a direct read of the real file on this pass
(paths + line context cited); the only LOW-confidence items are two owner-design gaps not resolved by any
existing precedent (see Open Questions).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Placement & UX** (from the owner-supplied `Vamps.dc.html`, confirmed 2026-09-09):
- **Vamps is a TAB on the Songs page** (a `Songs | Vamps` tab bar in `SongsView.vue`), per the owner's
  original "a Vamps tab in the songs page" and the design's Turn-12 layout — NOT a separate sidebar route.
  This **supersedes** the earlier requirements-draft wording ("dedicated page/sidebar nav").
- **Flat, one-vamp-per-row** table (design Turn 12 "12a"): columns **Vamp · Key · Tempo · Audio**; search by
  vamp name or key; "No MP3 attached" warning state; row-click opens a slide-out editor. Full structure,
  fields, and interactions are in **`140-DESIGN-NOTES.md`** (distilled from the design; the full HTML is
  re-fetchable via the design MCP `get_file`).
- **Slide-out editor** mirrors `SongSlideOver.vue`: Name input, Key chip-picker (12 keys), Tempo input, MP3
  attach/play/remove (dashed drop-zone when none), Delete vamp.

**Data model:**
- **Vamp = one name, one key, one optional tempo, one MP3** (1:1 with a Song row; "Open Response in G" and
  "…in A" are two separate vamps). Tempo is an **optional freeform string** ("68 bpm", "—") — INCLUDED per
  the design (this overrides the FEATURES-research "BPM is an anti-feature" note, because the owner designed
  tempo in).
- Org-scoped Firestore collection for vamps (mirror the per-org songs storage). Storage prefix
  `orgs/{orgId}/vamp-files/{vampId}/{sanitizedName}` — sibling of `song-files/`, **outside `media/`**, so it
  is structurally exempt from every retention/cleanup sweep (same guarantee song-files relies on;
  `MEDIA_PATH_GUARD` allowlist already excludes non-`media/` prefixes — verify no sweep change needed).
- Reuse the v2.11 upload pipeline: a `useVampFileUpload` mirroring `useSongFileUpload` (resumable, MP3 only,
  ≤50 MB, per-file progress) + a `vampFileStoragePath` helper mirroring `songFileStoragePath`.
- `storage.rules`: a `vamp-files/` block mirroring the shipped `song-files/` block (editor-gated,
  `audio/mpeg` only, <50 MB, immutable/editor-only). NOTE the `firestore.exists()`-in-Storage-emulator blind
  spot (CLAUDE.md): annotate expected-local-failure allow-cases; verify the real upload in a deployed env.
  **Research correction (this file): this blind spot no longer applies — see Summary below.**

**Styling:**
- Map the Nocturne palette → the app's existing **dark gray-950** language, mirroring `SongTable.vue` /
  `SongSlideOver.vue` (same mapping approach v2.11/v2.12 used). Reuse the app's existing key vocabulary
  (Songs already has an editable Key with a type-ahead) — **research note: the 12-key chip picker needs a
  new, smaller constant than `MAJOR_KEYS`, see Pattern 1 below.**

### Claude's Discretion
- Whether the vamps store is a standalone Pinia store (`vamps.ts` mirroring `songs.ts`) or folded near the
  songs store — recommend a standalone `vamps.ts` store, subscribed by org like `songs.ts`.
- Exact tab-bar component (new small component vs. inline in SongsView) and how the search/filter is shared
  with the Songs tab.

### Deferred Ideas (OUT OF SCOPE)
- Vamp→slide assignment, live playback, arm-audio, Audience-only audibility (Phase 141, R437–R440).
- Multi-key-per-vamp (design Turn 11) — explicitly NOT built; the owner chose one-key-per-vamp.
- Progression/scale-degree field (design Turn 11 only) — not in the chosen one-row model.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| R435 | An editor can create and manage vamps from a "Vamps" tab on the Songs page. Each vamp has a name, a musical key, an optional tempo (freeform), and one attached MP3 (≤50 MB), uploaded via the shipped resumable-upload pipeline into a retention-exempt, org-scoped Storage prefix (`orgs/{orgId}/vamp-files/…`), editor-gated in `storage.rules`, structurally exempt from every cleanup sweep. An editor can edit a vamp's name/key/tempo, replace/remove its MP3, and delete the vamp. | Pattern 1 (`Vamp` type), Pattern 2 (`vamps.ts` store mirroring `songs.ts`), Pattern 3 (`useVampFileUpload`/`vampFiles.ts` mirroring the v2.11 pipeline), storage.rules `vamp-files/` block (Code Examples), `MEDIA_PATH_GUARD` cleanup-sweep exemption confirmed structurally (Sources), Pitfall 2 (path-collision-safe replace), Pitfall 4 (no new Firestore rule needed) |
| R436 | The Vamps tab is a flat, browsable, searchable one-vamp-per-row table (Vamp · Key · Tempo · Audio, searchable by name/key, "No MP3 attached" warning state), with a slide-out editor (Name, Key chip-picker, Tempo, MP3 attach/play/remove, Delete), built to `Vamps.dc.html` Turn 12, mapped to the app's dark gray-950 language. | Pattern 4 (tab bar inside `SongsView.vue`), `VampTable.vue`/`VampSlideOver.vue` mirrors of `SongTable.vue`/`SongSlideOver.vue` (Recommended Project Structure), 12-key chip constant (Pattern 1), meta-line/play/remove UI patterns from `SongFilesTab.vue` (Don't Hand-Roll, Pitfall 5) |
</phase_requirements>

## Summary

Phase 140 is a narrow, high-precedent CRUD feature: a new `Vamp` entity (name + key + optional tempo + one
MP3 ≤50 MB) that is **1:1 structurally identical** to a `SongAttachment` collapsed onto its own top-level
per-org document. The codebase already has a complete, battle-tested template for every layer this phase
touches — `songs.ts` (store), `songFiles.ts` + `useSongFileUpload.ts` (upload pipeline), `SongTable.vue` /
`SongSlideOver.vue` (list + slide-out editor UI), and `storage.rules`' `song-files/` block (Storage rule) —
and the correct move for all of them is **mirror, don't invent**.

**Critical correction to the milestone-level research:** `.planning/research/ARCHITECTURE.md` (written
before `140-CONTEXT.md`/`140-DESIGN-NOTES.md` existed) assumed Vamps would be a **separate page + sidebar
route** (`VampsView.vue` at `/vamps`). The owner has since decided (140-CONTEXT.md, confirmed against the
`Vamps.dc.html` design) that Vamps is a **tab on the existing Songs page** (`Songs | Vamps` tab bar inside
`SongsView.vue`), **not** a new route. This phase must build the tab-on-`SongsView.vue` shape, not the
milestone research's `VampsView.vue`/`/vamps`-route shape. Everything else in that research (store mirror,
Storage path, rules block, cleanup-sweep exemption) still applies unchanged.

**Second correction, also load-bearing:** both `.planning/research/PITFALLS.md` and `CLAUDE.md` describe a
`firestore.exists()`-in-Storage-emulator blind spot that made `song-files/`'s allow-cases permanently
unverifiable locally. **That description is now historical, not current.** `storage.rules` was migrated to
**claim-only** membership at "Deploy 2" (2026-08-12) — `isOrgMemberByClaim`/`isOrgEditorByClaim` read
`request.auth.token` claims exclusively; the cross-service `firestore.exists()` fallback was **removed**,
and `src/storage.rules.test.ts` carries a standing regression test
(`storage.rules — claim-only membership (Deploy 2, R075 guard)`) that fails loudly if it's ever
reintroduced. Every `song-files/` allow-case (including uploads) passes cleanly in the emulator today. A new
`vamp-files/` block that mirrors `song-files/`'s claim-based gate exactly will be **fully emulator-testable
with no expected-local-failure annotations needed** — do not carry forward the "annotate the 2
emulator-blind allow-cases" instruction from CONTEXT.md/PITFALLS.md into the plan; it describes a bug this
codebase already fixed for Storage rules generally.

**Primary recommendation:** Build `Vamp`/`vamps.ts`/`vampFiles.ts`/`useVampFileUpload.ts` as line-for-line
structural mirrors of `Song`/`songs.ts`/`songFiles.ts`/`useSongFileUpload.ts` (narrowed to one file, MP3-only,
no arrangements/lyrics/attachments-array), add a `vamp-files/` Storage block that copies `song-files/`'s
claim-based gate verbatim (tightened to `audio/mpeg` only), and add the `Songs | Vamps` tab bar directly
inside `SongsView.vue` rather than a new view/route. No new Firestore rule is needed for the `vamps`
collection — it already falls under the existing generic catch-all (see below). Zero new npm dependencies.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Vamp list/search UI, tab bar, slide-out editor | Browser / Client (Vue) | — | Pure client rendering + Pinia state, identical tier to Songs |
| Vamp CRUD writes (create/update/delete) | Browser / Client → Firestore SDK direct | Database | No Cloud Function needed — mirrors `songs.ts`'s direct `addDoc`/`updateDoc`/`deleteDoc`, no server-side validation beyond rules |
| MP3 upload | Browser / Client → Storage SDK direct | Database (Firestore doc gets the resulting URL) | Mirrors `useSongFileUpload.ts`'s direct `uploadBytesResumable`, no Cloud Function |
| Access control (who can create/edit/delete a vamp; who can upload/delete an MP3) | Database / Storage (Firestore + Storage security rules) | — | Rules are the sole authority; the client's `isEditor` gating is UX-only, never trusted |
| Vamp persistence | Database (Firestore: `organizations/{orgId}/vamps/{id}`) | Storage (`orgs/{orgId}/vamp-files/{vampId}/{name}`) | Firestore holds metadata + denormalized `downloadUrl`; Storage holds the actual bytes — same split as Song attachments |
| Retention/cleanup exemption | Database / Storage (structural, via path prefix) | — | `vamp-files/` sits outside `media/`, so `MEDIA_PATH_GUARD`'s regex allowlist excludes it automatically — no Cloud Function change needed |

## Package Legitimacy Audit

No external packages are installed by this phase. Every dependency this phase needs
(`firebase/firestore`, `firebase/storage`, Vue reactivity, `crypto.randomUUID()`) is already a direct
dependency of the shipped app and is used identically to how `songs.ts`/`useSongFileUpload.ts` already use
it. **No `npm install` step belongs in this phase's plan.**

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| *(none — zero new dependencies)* | — | — | — | — | — | N/A |

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│ BROWSER (Vue 3 + Pinia)                                                  │
│                                                                           │
│  SongsView.vue                                                           │
│   ├─ "Songs | Vamps" tab bar (NEW — inline in this file, tracks          │
│   │    activeTab ref, page title "Songs" stays constant per design)      │
│   ├─ [Songs tab] existing SongBrowser/SongTable/SongSlideOver — UNCHANGED│
│   └─ [Vamps tab] NEW:                                                    │
│        VampTable.vue (flat rows: Vamp·Key·Tempo·Audio, search)           │
│           → row click →                                                 │
│        VampSlideOver.vue (Name, Key chip-picker, Tempo, MP3 attach/      │
│           play/remove, Delete) — mirrors SongSlideOver.vue's shell       │
│                                                                           │
│  useVampStore() (Pinia, org-scoped, subscribed via                       │
│    watch(()=>authStore.orgId,{immediate:true}) inside SongsView.vue,     │
│    exactly like songStore.subscribe today)                               │
│    ├─ subscribe(orgId) → onSnapshot(organizations/{orgId}/vamps)         │
│    ├─ addVamp / updateVamp / deleteVamp (soft) / hardDeleteVamp          │
│    └─ registered in orgScopedStores.ts's resetOrgScopedStores()          │
│         (church-switch/logout teardown — REQUIRED, easy to miss)         │
│                                                                           │
│  useVampFileUpload() composable                                          │
│    → uploadBytesResumable(orgs/{orgId}/vamp-files/{vampId}/{name})       │
│    → getDownloadURL() → vampStore.updateVamp(id, { attachment })          │
└──────────────┬───────────────────────────────┬──────────────────────────┘
               │ Firestore SDK                 │ Storage SDK
               ▼                               ▼
┌───────────────────────────────┐  ┌────────────────────────────────────┐
│ FIRESTORE                     │  │ CLOUD STORAGE                       │
│ organizations/{orgId}/        │  │ orgs/{orgId}/vamp-files/{vampId}/   │
│   vamps/{vampId}              │  │   {sanitizedName}.mp3               │
│  (NEW collection — no new     │  │  (NEW prefix, sibling of            │
│   explicit rules block        │  │   song-files/ — mirrors its         │
│   needed; falls under the     │  │   claim-based storage.rules block,  │
│   existing generic catch-all, │  │   editor-gated, audio/mpeg only,    │
│   isOrgEditor(orgId) read+    │  │   <50MB, immutable/update:false)    │
│   write — same behavior       │  └────────────────────────────────────┘
│   songs/{id} already gets)    │
└────────────────────────────────┘

  functions/src/cleanupSweeps.ts — NOT touched. MEDIA_PATH_GUARD
  (/^orgs\/[^/]+\/media\//) already excludes vamp-files/ structurally,
  identical to how it already excludes song-files/.
```

### Recommended Project Structure

```
src/
├── types/
│   └── vamp.ts                     # NEW — Vamp + VampAttachment types
├── utils/
│   └── vampFiles.ts                 # NEW — mirrors songFiles.ts
├── stores/
│   ├── vamps.ts                     # NEW — mirrors songs.ts (narrowed)
│   └── orgScopedStores.ts           # MODIFIED — add useVampStore().unsubscribeAll()
├── composables/
│   └── useVampFileUpload.ts         # NEW — mirrors useSongFileUpload.ts (single-file)
├── components/
│   ├── VampTable.vue                # NEW — mirrors SongTable.vue (flat, no VW/tags columns)
│   └── VampSlideOver.vue            # NEW — mirrors SongSlideOver.vue (no tabs — single form)
└── views/
    └── SongsView.vue                # MODIFIED — add "Songs | Vamps" tab bar + Vamps tab content
```

### Pattern 1: Vamp mirrors Song 1:1, collapsed to a single flat doc

**What:** `Vamp` = `Song` + `SongAttachment` merged into one document — one key (not an `Arrangement[]`),
one optional tempo string, one attachment (not an `attachments[]` array), no lyrics subcollection, no
VW-type/CCLI/themes metadata.

**When to use:** This phase only — but it is the second instance of this "small keyed media library"
shape in the codebase (the first being Song attachments), so treat the shape itself as the established
convention, not a one-off.

**Example — `src/types/vamp.ts` (new):**
```typescript
import type { Timestamp } from 'firebase/firestore'

/** Mirrors SongAttachment's upload shape, minus 'kind'/'link'-related fields
 * a vamp doesn't need (one file, always audio). */
export interface VampAttachment {
  storagePath: string
  downloadUrl: string
  fileName: string
  mimeType: string
  sizeBytes: number
  createdAt: Timestamp
  createdBy: string
}

export interface Vamp {
  id: string
  name: string
  key: string                       // one of the 12 chip-picker keys (see below)
  tempo?: string                    // freeform, optional — "68 bpm", "—"
  attachment?: VampAttachment | null
  hidden: boolean                   // soft-delete flag, mirrors Song.hidden
  createdAt: Timestamp
  updatedAt: Timestamp
}

export type UpsertVampInput = Omit<Vamp, 'id' | 'createdAt' | 'updatedAt'>
```

**Key vocabulary — do NOT reuse `MAJOR_KEYS` from `src/constants/keys.ts` unmodified.** The design's chip
picker is a closed set of exactly 12 keys: `C Db D Eb E F F# G Ab A Bb B` (no `C#`/`Gb` duplicates — the
design picks one enharmonic spelling per pitch class). `MAJOR_KEYS` in `src/constants/keys.ts` has **14**
entries (`C, C#, Db, D, Eb, E, F, F#, Gb, G, Ab, A, Bb, B` — both `C#`/`Db` and `F#`/`Gb` are present as it's
a free-typed datalist, not a fixed chip set). Define a new, smaller constant
(e.g. `VAMP_KEYS` in `src/constants/keys.ts`, alongside `MAJOR_KEYS`) with the design's exact 12-entry list
for the chip picker — reusing `MAJOR_KEYS` directly would render 14 chips, not 12, and include both
enharmonic spellings the design explicitly does not want.

### Pattern 2: Store mirrors `songs.ts`, narrowed

**What:** `useVampStore` (Pinia) copies `songs.ts`'s `subscribe`/`unsubscribeAll`/`addSong`→`addVamp`/
`updateSong`→`updateVamp`/`deleteSong`→`deleteVamp`/`hardDeleteSong`→`hardDeleteVamp` shape verbatim, at
`organizations/{orgId}/vamps` (`songs.ts:242-289` is the subscribe/unsubscribe template;
`songs.ts:291-306` addSong/updateSong; `songs.ts:383-433` deleteSong/hardDeleteSong).

**What to drop from the mirror:** `filteredSongs`/`filterVwType`/`filterKey`/`tagFilterInclude/Exclude`/
`columnVisibility`/`allUserTags`/`aiCandidateSongs`/`upsertSongs`/`importSongs` (Planning Center import has
no vamp equivalent) — a vamp has no VW/tags/import concept. Keep only `search`-by-name-or-key (a simple
computed filter, not the full tag-filter machinery) per 140-DESIGN-NOTES.md's "Search box... filters by
name or key."

**Attachment write path — simpler than Song's, no `arrayUnion`:** Song attachments use
`arrayUnion`/`runTransaction` (`songs.ts:314-381`) because a song can carry *several* attachments
concurrently, so concurrent adds/removes must not clobber each other. **A vamp has exactly one attachment
slot** — replacing it is a plain `updateDoc(vampRef, { attachment: newAttachment })`, no array semantics, no
transaction needed. Do not port the `arrayUnion`/transaction machinery; it solves a concurrency problem this
1:1 shape doesn't have.

**Church-switch safety — the part easy to miss:** `SongsView.vue`'s own `watch(() => authStore.orgId, ...,
{ immediate: true })` (line 354-361) only re-subscribes the *currently mounted* view's stores. The
**global** teardown on org-switch/logout happens in `src/stores/orgScopedStores.ts`'s
`resetOrgScopedStores()`, which explicitly lists every org-scoped store's `unsubscribeAll()` (currently 11
stores, including `useSongStore().unsubscribeAll()` at line 25). **`useVampStore().unsubscribeAll()` must be
added to this file** or a lingering vamps listener from a previous org survives a church switch triggered
from a *different* view (e.g. the sidebar switcher) — this is the exact class of bug ADR-0066 already fixed
once for songs, and CONTEXT.md's "must be church-switch safe" note is specifically about not re-introducing
it for a new store.

### Pattern 3: Upload composable mirrors `useSongFileUpload.ts`, narrowed to single-file audio-only

**What:** `useVampFileUpload.ts` copies `useSongFileUpload.ts`'s validate→upload→progress-row→
`getDownloadURL()`→persist shape (`useSongFileUpload.ts:114-223`), narrowed to:
- One file at a time (a vamp replaces its single attachment slot, no batch/multi-file list).
- MIME allowlist `['audio/mpeg']` only (not `SONG_FILE_ALLOWED_MIME`'s `['application/pdf', 'audio/mpeg']`).
- Extension check `.mp3` only (drop `useSongFileUpload.ts:76`'s `.pdf` branch).
- Persist via a plain `updateVamp(vampId, { attachment })` — not `addSongAttachment`'s `arrayUnion` (see
  Pattern 2).
- `sizeBytes >= VAMP_FILE_MAX_BYTES` client-side rejection copy mirrors `useSongFileUpload.ts:85-87`
  verbatim (same 52428800-byte cap).

**Example — `src/utils/vampFiles.ts` (new), mirrors `songFiles.ts` line-for-line:**
```typescript
import { sanitizeFileName } from '@/utils/songFiles'   // reuse directly — already exported for this

export const VAMP_FILE_MAX_BYTES = 52428800
export const VAMP_FILE_ALLOWED_MIME = ['audio/mpeg'] as const

/** orgs/{orgId}/vamp-files/{vampId}/{sanitizedName} — sibling of song-files/,
 * outside media/, structurally retention-exempt (mirrors songFileStoragePath). */
export function vampFileStoragePath(orgId: string, vampId: string, name: string): string {
  return `orgs/${orgId}/vamp-files/${vampId}/${sanitizeFileName(name)}`
}
```
Reuse `sanitizeFileName` by importing it directly from `songFiles.ts` (already exported there for exactly
this kind of cross-feature reuse — do not duplicate it into `vampFiles.ts`).

**Path keying differs from `song-files/` on purpose:** `song-files/{attachmentId}/...` keys by a per-upload
`attachmentId` because a song can hold several attachments. A vamp has exactly one file per doc, so key by
`vampId` directly (`orgs/{orgId}/vamp-files/{vampId}/{name}`) — simpler, no need to invent a fake
attachment id for a 1:1 entity. **Re-uploading an MP3 to replace an existing one reuses the same `vampId`
segment**, which means (unlike `song-files/`'s per-upload-unique path) a **second upload to the same vamp
writes to the same directory as the first.** Storage's `update: if false` rule still blocks *overwriting the
exact same object path*, so give the *file itself* a fresh name/path-component per upload if replacement
must succeed under an immutable-update rule — e.g. suffix the filename with a short random token, or key by
`{vampId}/{uploadId}/{name}` (mirroring `song-files/`'s per-upload-id segment instead of only `{vampId}/`).
**Decide this before writing the rules test** — a vamp's MP3-replace flow (explicitly in scope: "replace/
remove its MP3") will otherwise collide with the immutable-upload rule on the second upload to the same
vamp. Recommendation: `orgs/{orgId}/vamp-files/{vampId}/{uploadId}/{sanitizedName}` (adds one path segment
vs. the CONTEXT.md-stated shape) so every upload — including a replace — gets a fresh path, exactly like
`song-files/` already does, while old files become orphaned Storage objects on replace (same accepted
residual `removeSongAttachment`/`hardDeleteSong` already document for song attachments).

### Pattern 4: `Songs | Vamps` tab bar lives inside `SongsView.vue`, not a new route

**What:** Per 140-CONTEXT.md (owner decision, supersedes the milestone-research's `/vamps` route), the tab
bar is a `ref<'songs' | 'vamps'>('songs')` inside `SongsView.vue`'s `<script setup>`, gating which of two
template blocks renders below the shared page header. The page title stays "Songs" (per
140-DESIGN-NOTES.md); each tab shows a count badge (Songs: `songStore.filteredSongs.length`, already
computed; Vamps: a new `vampStore.vamps.length`-derived count).

**Where to put the tab-bar markup:** `SongSlideOver.vue:100-138` already has a page-internal tab-bar
pattern (`border-b-2 -mb-px`, active/inactive class toggling) — reuse those exact Tailwind classes for
visual consistency, but this is a **page-level** tab bar (Songs vs. Vamps), structurally simpler than
`SongSlideOver`'s in-drawer tab bar (no `isCreateMode`-gating needed).

**Router/nav — no changes needed:** `router/index.ts`'s existing `/songs` route
(`path: '/songs', meta: { requiresAuth: true, requiresEditor: true }`) already covers Vamps since it's a
tab on the same page — do **not** add a `/vamps` route or an `AppSidebar.vue` nav entry (both were
recommended in the pre-CONTEXT milestone research; both are now out of scope per the owner's tab decision).

### Anti-Patterns to Avoid

- **Building `VampsView.vue` as a separate routed page.** This was the milestone-research's original
  recommendation, made before 140-CONTEXT.md/140-DESIGN-NOTES.md existed. The owner has explicitly decided
  Vamps is a tab on Songs, not a page. Do not resurrect the separate-page design.
- **Reusing `MAJOR_KEYS` (14 entries) for the chip picker.** The design wants exactly 12 chips, one
  enharmonic spelling per pitch class. Define a new constant.
- **Porting `arrayUnion`/`runTransaction` attachment logic from `addSongAttachment`/`removeSongAttachment`.**
  A vamp has one attachment slot, not a growable array — a plain `updateDoc` suffices and the transaction
  machinery solves a concurrency problem this shape doesn't have.
- **Annotating vamp storage-rule allow-cases as "expected local failure."** That pattern applied to the
  *pre-Deploy-2* `firestore.exists()`-based rule. Current `storage.rules` is claim-only and fully
  emulator-verifiable — a vamp allow-case that fails locally is a real bug, not an environment quirk.
- **Keying the vamp Storage path by `{vampId}/` alone with no per-upload segment.** Collides with the
  `update: if false` immutable-upload rule on MP3 replacement (see Pattern 3).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Resumable file upload with progress | A new `uploadBytesResumable` wrapper from scratch | Copy `useSongFileUpload.ts`'s structure into `useVampFileUpload.ts` | Battle-tested error/progress/validation shape already exists; duplicating the *pattern* (new file) is this codebase's convention, duplicating the *mechanics* is not |
| Filename sanitization for Storage paths | A new sanitizer | `sanitizeFileName` from `src/utils/songFiles.ts` (already exported, already imported by `SongFilesTab.vue`) | Single canonical implementation per CLAUDE.md-adjacent convention (Phase 123 code-review IN-03 already consolidated this once) |
| Org-scoped subscribe/unsubscribe boilerplate | A new generic "org-scoped collection store" abstraction | Copy `songs.ts`'s `subscribe`/`unsubscribeAll` shape directly | This codebase's own ADRs (cited in the milestone ARCHITECTURE.md) explicitly document "mirror the precedent exactly, do not prematurely abstract" as house style |
| Cross-origin file download (Save-dialog) | A new download helper | `SongFilesTab.vue:443-459`'s `fetch → blob → objectUrl` pattern, if the Vamp editor needs a download affordance (design shows play/remove, not explicit download — confirm during planning whether download is in scope) | Firebase Storage URLs are cross-origin; a bare `<a download>` silently fails without this pattern (124-REVIEW FIX A) |
| Audio duration extraction ("length" in the MP3 meta line) | An MP3-parsing library | Native `<audio>` element's `loadedmetadata` event exposing `.duration` (client-side, zero dependencies) | See Open Questions — the codebase's existing precedent (`SongFilesTab.vue:531-533`) explicitly avoids a duration field today ("SEED-003 no-new-deps; no PDF page-count library"), but that comment is about *documents*, not audio — an `<audio>` element can read its own duration natively with no library |

**Key insight:** every piece of this phase already has a shipped, tested twin somewhere in this codebase.
The only genuinely new decisions are (1) the tab-bar placement inside `SongsView.vue`, (2) the 12-key chip
constant, and (3) the Storage path's per-upload segment for replace-safety — everything else is a narrowing
copy.

## Common Pitfalls

### Pitfall 1: Forgetting to register `useVampStore` in `orgScopedStores.ts`

**What goes wrong:** A church switch triggered from a view *other than* SongsView (e.g. the sidebar
switcher, per ADR-0066) does not tear down the vamps listener, because `resetOrgScopedStores()` is the
single global teardown point and a new store must be added to it explicitly — it is not automatic.
**Why it happens:** `SongsView.vue`'s own `watch(orgId, {immediate:true})` only fires when `SongsView.vue`
is mounted; the global reset is a separate, easy-to-forget registration.
**How to avoid:** Add `useVampStore().unsubscribeAll()` to `src/stores/orgScopedStores.ts`'s
`resetOrgScopedStores()` in the same commit that creates `vamps.ts`.
**Warning signs:** vamps from Church A still appear briefly (or permanently, until reload) after switching
to Church B from the sidebar (not from the Songs page).

### Pitfall 2: Storage path collision on MP3 replace

**What goes wrong:** If the Storage path is `orgs/{orgId}/vamp-files/{vampId}/{sanitizedName}` with no
per-upload segment, replacing a vamp's MP3 (explicitly in scope per R435 "replace... its MP3") re-uploads to
the same object path the first upload used (assuming the filename doesn't change), and `storage.rules`'
`allow update: if false` (mirrored from `song-files/`) denies it outright — the replace silently fails.
**Why it happens:** `song-files/`'s per-upload `attachmentId` segment avoids this because each *attachment*
gets a fresh id; a vamp's 1:1 shape tempts collapsing the path to `{vampId}/` alone, which loses that
per-upload uniqueness.
**How to avoid:** Add a per-upload segment (e.g. `{vampId}/{uploadId}/{sanitizedName}`, `uploadId =
crypto.randomUUID()`) so every upload — including a replace — gets a fresh path, exactly like `song-files/`.
**Warning signs:** the first MP3 upload for a vamp works; replacing it fails with a permission-denied error
that only reproduces on a *second* upload to the *same* vamp.

### Pitfall 3: Treating the pre-Deploy-2 `firestore.exists()` Storage-rules caveat as still current

**What goes wrong:** Copying CONTEXT.md's/PITFALLS.md's instruction to "annotate the vamp allow-cases as
expected-local-failure" into the actual rules test produces misleading comments and, worse, could mask a
genuine local test failure as "expected" when it's actually a real bug in the new rule.
**Why it happens:** Both documents were written from the milestone-level PROJECT.md framing, dated before
this phase's researcher verified the *current* `storage.rules` file, which no longer uses
`firestore.exists()` at all (Deploy 2, 2026-08-12).
**How to avoid:** Write the `vamp-files/` rules test as a full mirror of `song-files/`'s test block in
`src/storage.rules.test.ts:406-505` — every case (allow-editor-upload, allow-member-read, deny-viewer-write,
deny-oversize, deny-wrong-type, allow-editor-delete, deny-viewer-delete) should **pass** locally, with zero
"expected failure" annotations.
**Warning signs:** a rules test explained away as "environment quirk" without first confirming the actual
rule text uses `firestore.exists()` (it should not, for any new Storage rule written after 2026-08-12).

### Pitfall 4: Adding an unnecessary explicit Firestore rules block for `vamps`

**What goes wrong:** Writing a new explicit `match /vamps/{vampId} { ... }` block in `firestore.rules` that
duplicates the existing generic catch-all's behavior, creating two sources of truth that can drift.
**Why it happens:** `songs/{songId}` *does* have its own explicit block (`firestore.rules:481-492`) — but
that block exists **specifically because of the `lyrics` subcollection** underneath it (the catch-all only
matches single-segment subcollections, so the deeper `songs/{id}/lyrics/{id}` path needs its own rule). A
vamp has no subcollection, so it needs no explicit block.
**How to avoid:** Confirm `organizations/{orgId}/vamps/{vampId}` already falls under
`firestore.rules:508-515`'s catch-all (`match /{collection}/{docId} { allow read: if isOrgEditor(orgId);
allow write: if isOrgEditor(orgId) && collection != 'services' && collection != 'slideGroups' && collection
!= 'pptxRenders' && collection != 'rehearseAccess'; }`) — it does, with **zero changes needed**. Write a
rules test proving this (mirroring `src/rules.test.ts:82-88`'s "allows org editor to read nested collections
(songs)" pattern, retargeted at `vamps`) rather than adding a new rule.
**Warning signs:** a plan task that says "add a Firestore rules block for vamps" — this phase needs a rules
*test* for vamps, not a rules *change*.

### Pitfall 5: The design's "length" (audio duration) meta-line field has no existing extraction pattern

**What goes wrong:** 140-DESIGN-NOTES.md's slide-out editor spec shows the MP3 row with "meta ('MP3 · 4.8
MB · Sep 2, 2026' + length)" — but the closest existing precedent, `SongFilesTab.vue`'s `metaLine()`
function, explicitly documents (line 531-533) that it **never** renders a duration/length field, citing
"SEED-003 no-new-deps; no PDF page-count library." Copying that function verbatim silently drops the
"length" the design calls for.
**Why it happens:** That comment is about *documents* (no PDF page-count library exists) — it does not
actually apply to *audio* duration, which the browser's native `<audio>` element can read via its
`loadedmetadata` event (`audioElement.duration`, in seconds) with zero new dependencies. The comment reads
as a blanket "we don't do this" when it's really "we don't do this for PDFs."
**How to avoid:** Either (a) extract duration client-side via a throwaway `<audio>` element's
`loadedmetadata` listener at upload-completion time and persist it on `VampAttachment.durationSeconds`, or
(b) explicitly scope "length" out of this phase (flag it to the planner as a design-vs-precedent gap
requiring an owner call, since 140-CONTEXT.md doesn't mention it and R436's requirement text doesn't
mention duration either — only the design notes do). **Recommendation:** treat as Claude's discretion,
default to (b) — omit "length" from Phase 140's UI (it's not in the R435/R436 requirement text, only in the
distilled design notes) and flag it as a follow-up rather than blocking on new plumbing for a field no
requirement mandates.

## Code Examples

### Mirroring the store's subscribe pattern (adapted from `songs.ts:242-281`)

```typescript
// src/stores/vamps.ts (NEW)
function subscribe(orgIdValue: string) {
  if (unsubscribeFn) unsubscribeFn()
  orgId.value = orgIdValue
  const q = query(
    collection(db, 'organizations', orgIdValue, 'vamps'),
    orderBy('name'),
  )
  unsubscribeFn = onSnapshot(q, (snap) => {
    vamps.value = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Vamp)
    isLoading.value = false
  })
}

function unsubscribeAll() {
  unsubscribeFn?.()
  unsubscribeFn = null
  orgId.value = null
  vamps.value = []
  isLoading.value = true
}
```

### Mirroring the org-switch watch (from `SongsView.vue:353-361`)

```typescript
// src/views/SongsView.vue — add alongside the existing songStore watch
watch(
  () => authStore.orgId,
  (orgId) => {
    vampStore.unsubscribeAll()
    if (orgId) vampStore.subscribe(orgId)
  },
  { immediate: true },
)
```

### Storage rules — vamp-files block (mirrors `storage.rules:107-120`, tightened + path-collision-safe)

```
// New sibling of song-files/, editor-gated, audio/mpeg only, <50MB, immutable per path.
match /orgs/{orgId}/vamp-files/{allPaths=**} {
  allow read: if isOrgMember(orgId);

  allow create: if isOrgEditor(orgId)
                   && request.resource.size < 52428800
                   && request.resource.contentType == 'audio/mpeg';

  allow update: if false;   // immutable upload — every re-upload (incl. replace) uses a new path segment

  allow delete: if isOrgEditor(orgId);
}
```

Plus add `vamp-files` to the catch-all's two exclusion regexes at `storage.rules:130` and `storage.rules:137`
(currently `!resource.name.matches('^orgs/[^/]+/song-files/.*')` — change to
`'^orgs/[^/]+/(song-files|vamp-files)/.*'`), for the identical reason the block's own comment documents:
without the exclusion, the generic `<25MB`/member-write catch-all independently permits a non-audio or
oversized write to `vamp-files/` regardless of the dedicated block's deny.

## State of the Art

| Old Approach (pre-Deploy-2, 2026-08-12) | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `storage.rules` membership gated on cross-service `firestore.exists()` against a Firestore `members` doc | Claim-only (`request.auth.token.orgId`/`.role`/`.orgs`) — no cross-service call at all | Deploy 2, 2026-08-12 | The `firestore.exists()`-in-Storage-emulator blind spot documented in CLAUDE.md and the milestone PITFALLS.md **no longer applies to any current or new Storage rule**, including the vamp-files block this phase adds |

**Deprecated/outdated:** CLAUDE.md's `storage.rules.test.ts` section describes the pre-Deploy-2 rule and its
2 permanently-failing allow-cases. That description is about the *historical* rule shape, retained in
CLAUDE.md as an incident record — it is not a description of `storage.rules` as it exists today. Do not
apply its "expected local failure" guidance to any new rule written now.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The "length" (audio duration) field in 140-DESIGN-NOTES.md's MP3 meta line is out of scope for this phase (not mentioned in R435/R436's actual requirement text) | Pitfall 5 | Low — if wrong, adds one small client-side `<audio>`-metadata extraction step; does not block the rest of the phase |
| A2 | A per-upload path segment (`{vampId}/{uploadId}/{name}`) is needed to make MP3-replace work under the immutable-upload Storage rule | Pattern 3 / Pitfall 2 | Medium — if the planner instead keeps the CONTEXT.md-literal `{vampId}/{name}` path, MP3 replacement will fail in production on the second upload to any given vamp; this should be confirmed/decided explicitly during planning, not assumed silently |
| A3 | A vamp's soft-delete (`hidden: true`) + hard-delete two-step, mirroring Song's, is desired even though R435/CONTEXT.md only says "delete the vamp" (no explicit two-step mention) | Pattern 2 | Low — if the owner wants a single hard-delete instead (simpler, matches the design's single "Delete vamp" button with no restore/hidden-panel affordance shown in 140-DESIGN-NOTES.md), the store is simpler, not harder, to adjust away from the mirror |

**On A3 specifically:** 140-DESIGN-NOTES.md's slide-out editor shows a single "Delete vamp" button with no
mention of a hidden/restore panel (unlike `SongsView.vue`'s "Hidden Songs" panel). This suggests the owner's
mental model for Vamps may be **single-step hard delete**, not Song's soft-then-hard two-step. Flag this to
the planner as a discretion point: mirroring Song's two-step delete is the safer *code* precedent but may
not match the *design's* one-button UX — resolve by either building single-step hard delete (simpler,
matches the design) or two-step with the second step hidden behind a details view not shown in the design
mockup (matches Song precedent, adds UI the design didn't ask for). Recommend **single-step hard delete**
per R440's "warns but allows" framing for Phase 141's cross-reference, which implies vamps don't need a
recovery window the way songs' hidden-panel-restore flow provides.

## Open Questions

1. **Does "Delete vamp" soft-delete (hidden) or hard-delete immediately?**
   - What we know: `Song.hidden` + a "Hidden Songs" restore panel exists; 140-DESIGN-NOTES.md shows only a
     single "Delete vamp" button, no restore affordance.
   - What's unclear: whether the owner wants Song's two-step precedent or a simpler one-step delete.
   - Recommendation: single-step hard delete (see Assumption A3) — simpler store, matches the design
     mockup's single button; confirm with the owner only if the planner wants extra certainty.

2. **Is the "length" (audio duration) meta-line field in scope?**
   - What we know: it's in 140-DESIGN-NOTES.md's slide-out editor mock, not in R435/R436's requirement text.
   - What's unclear: whether design-only details are binding for this phase.
   - Recommendation: omit for Phase 140 (Assumption A1); flag as a fast client-side follow-up (native
     `<audio>` `loadedmetadata`, zero new deps) if the owner wants it during UAT.

3. **Storage path shape: does the plan need the extra `{uploadId}` segment, or is a same-name-overwrite
   acceptable?**
   - What we know: CONTEXT.md/DESIGN-NOTES literally specify `vamp-files/{vampId}/{sanitizedName}`; the
     shipped `storage.rules` convention (`song-files/`) makes every path immutable via `update: if false`.
   - What's unclear: whether the owner's literal path spec was meant to preclude a per-upload segment, or
     whether it's just the *conceptual* shape (mirrored loosely, like `song-files/{attachmentId}/...` is
     conceptually "one prefix per file" even though the exact key differs).
   - Recommendation: use `vamp-files/{vampId}/{uploadId}/{sanitizedName}` (Assumption A2) — the literal
     CONTEXT.md path as written would break MP3 replacement under the immutable-upload rule.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.x (already configured; `vitest.config.ts` for app suite, `vitest.rules.config.ts` for rules suite) |
| Config file | `vitest.config.ts` (app/unit), `vitest.rules.config.ts` (Firestore + Storage rules) |
| Quick run command (unit) | `npx vitest run src/stores/__tests__/vamps.test.ts src/utils/__tests__/vampFiles.test.ts` |
| Full suite command (app) | `npx vitest run` (per CLAUDE.md — bare, no `--dir`, excludes `render-service/**` and `src/rules.test.ts` automatically) |
| Rules suite command | `npm run test:rules` (own emulator) — or, if an emulator is already running, `npx vitest run --config vitest.rules.config.ts` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| R435 | Create/edit/delete a vamp (name/key/tempo), enforce ≤50MB MP3-only | unit | `npx vitest run src/stores/__tests__/vamps.test.ts -t "addVamp\|updateVamp\|deleteVamp"` | ❌ Wave 0 |
| R435 | `vampFileStoragePath`/`VAMP_FILE_MAX_BYTES`/`VAMP_FILE_ALLOWED_MIME` correctness | unit | `npx vitest run src/utils/__tests__/vampFiles.test.ts` | ❌ Wave 0 |
| R435 | `vamp-files/` Storage rule: editor-gated create, member-gated read, editor-gated delete, size/type denial | rules-emulator | `npx vitest run --config vitest.rules.config.ts src/storage.rules.test.ts -t "vamp-files"` | ❌ Wave 0 (add a new `describe` block mirroring `song-files` at lines 406-505) |
| R435 | `organizations/{orgId}/vamps` Firestore collection already covered by the existing generic catch-all (no rule change) | rules-emulator | `npx vitest run --config vitest.rules.config.ts src/rules.test.ts -t "vamps"` | ❌ Wave 0 (add a new case mirroring the "songs" nested-collection case at `src/rules.test.ts:82-88`) |
| R435 | `resetOrgScopedStores()` tears down the vamps listener on church switch/logout | unit | `npx vitest run src/stores/__tests__/orgScopedStores.test.ts` (or extend an existing store-reset test) | ❌ Wave 0 — no existing dedicated test file for `orgScopedStores.ts`; a new one, or an assertion added to an existing store's own teardown test, is needed |
| R436 | Vamp table search filters by name or key | unit | `npx vitest run src/components/__tests__/VampTable.test.ts` | ❌ Wave 0 |
| R436 | "No MP3 attached" warning state renders when `attachment` is null/undefined | unit | same `VampTable.test.ts` | ❌ Wave 0 |
| R436 | Slide-out editor: Name/Key/Tempo fields, MP3 attach/play/remove, Delete — visual layout, tab-bar switch, drag-drop | manual/visual UAT | N/A — component-mount unit tests can cover form-state logic, but the actual Nocturne→gray-950 visual mapping and drag-drop interaction need a human/visual check | N/A |

### Sampling Rate

- **Per task commit:** `npx vitest run <touched test files>` (fast, scoped)
- **Per wave merge:** `npx vitest run` (full app suite) + `npm run type-check`
- **Phase gate:** Full app suite green + `npx vitest run --config vitest.rules.config.ts` (rules suite) green
  before `/gsd-verify-work` — plus a manual UAT pass on the tab bar / slide-out editor visual rendering
  (Nocturne→gray-950 mapping is a design-fidelity check no unit test can verify).

### Wave 0 Gaps

- [ ] `src/stores/__tests__/vamps.test.ts` — covers R435 (mirror `src/stores/__tests__/songs.test.ts`'s
      mock-firebase pattern, narrowed to the smaller `vamps.ts` surface)
- [ ] `src/utils/__tests__/vampFiles.test.ts` — covers R435 (path helper, size/mime constants)
- [ ] A `vamp-files` `describe` block added to `src/storage.rules.test.ts` (mirrors lines 406-505's
      `song-files` block) — covers R435, and **must assert every allow-case actually succeeds** (no
      expected-local-failure annotations — see Pitfall 3)
- [ ] A `vamps` collection-access case added to `src/rules.test.ts` (mirrors lines 82-88's `songs` case) —
      proves the catch-all covers the new collection with zero rule changes (Pitfall 4)
- [ ] `src/components/__tests__/VampTable.test.ts` — covers R436 search/warning-state
- [ ] `src/components/__tests__/VampSlideOver.test.ts` — covers R436 form state (mirror
      `SongSlideOver.test.ts`'s conventions if that file exists; confirm during planning)
- [ ] A church-switch teardown assertion for `useVampStore` — either a new
      `src/stores/__tests__/orgScopedStores.test.ts` or an addition to whatever existing test already
      exercises `resetOrgScopedStores()`

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No (new surface) | Already covered by the app's existing Firebase Auth + custom-claims layer — this phase adds no new auth surface |
| V3 Session Management | No | Unchanged — reuses existing session/claims |
| V4 Access Control | Yes | Firestore: `isOrgEditor(orgId)` via the existing generic catch-all (no new rule). Storage: `isOrgEditorByClaim(orgId)` (create/delete) / `isOrgMemberByClaim(orgId)` (read) — claim-based, mirrors `song-files/` exactly |
| V5 Input Validation | Yes | Client-side MIME/extension/size validation mirroring `validateSongFile()` (UX only); Storage rules `contentType == 'audio/mpeg'` + `size < 52428800` are the real server-side authority |
| V6 Cryptography | No | No new cryptographic surface — reuses Firebase Storage's existing download-token URLs |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Client-side-only file-type validation bypassed by a crafted upload request | Tampering | Server-side `storage.rules` `contentType`/`size` checks are the real gate (already the pattern for `song-files/`) — never trust `validateSongFile`-style client checks alone |
| A viewer (non-editor) attempting to create/delete a vamp or its MP3 | Elevation of Privilege | `isOrgEditor(orgId)` (Firestore, via catch-all) / `isOrgEditorByClaim(orgId)` (Storage create/delete) — both already proven patterns, write a viewer-denial test mirroring `storage.rules.test.ts:442-450`'s "DENIES a viewer from uploading" |
| An in-place overwrite of an existing vamp MP3 bypassing the create-time type/size check | Tampering | `allow update: if false` (immutable) + per-upload path segment (Pitfall 2) — every write is a fresh `create`, never an `update` |
| Cross-org access to another church's vamp files via a guessed Storage path | Information Disclosure | `isOrgMemberByClaim(orgId)` scopes read to the caller's own org claim — same protection `song-files/` already has, proven at `storage.rules.test.ts:370-377`'s cross-org denial pattern |

## Sources

### Primary (HIGH confidence — direct source reads, this session, 2026-09-09)
- `src/views/SongsView.vue` (full file) — page structure, tab-bar precedent absence, org-switch watch
  pattern (lines 353-361), `onAddSong`/`onSelectSong` slide-over wiring.
- `src/stores/songs.ts` (full file) — subscribe/unsubscribe (242-289), addSong/updateSong (291-306),
  addSongAttachment/removeSongAttachment (`arrayUnion`/transaction, 308-381), deleteSong/hardDeleteSong
  (383-433).
- `src/utils/songFiles.ts`, `src/composables/useSongFileUpload.ts` (full files) — path helper, constants,
  validation, resumable-upload/progress-row shape.
- `src/components/SongSlideOver.vue`, `src/components/SongTable.vue`, `src/components/SongFilesTab.vue`
  (full files) — slide-out editor shell/tab-bar CSS, flat-table shape, attachment meta-line/play/download
  patterns (including the explicit "no duration field" comment, line 531-533).
- `src/types/song.ts` (full file) — `Song`/`SongAttachment`/`Arrangement` shapes.
- `storage.rules` (full file) — confirmed **claim-only** membership (`isOrgMemberByClaim`/
  `isOrgEditorByClaim`, lines 13-79), the `song-files/` block (99-120), the catch-all exclusion regexes
  (122-138).
- `src/storage.rules.test.ts` (full file) — confirmed every `song-files` allow-case passes today (406-505)
  and the standing "claim-only membership (Deploy 2, R075 guard)" regression test (555-600) that forbids
  reintroducing `firestore.exists()`.
- `firestore.rules` (lines 440-518) — `songs/{songId}` explicit block (exists because of the `lyrics`
  subcollection, not because the catch-all is insufficient), the generic catch-all (508-515) that already
  covers any new top-level collection like `vamps` with `isOrgEditor(orgId)` read+write.
- `src/rules.test.ts` (grepped, lines 82-104, 485-491, 733-740, 1801-1841) — confirmed the catch-all's
  editor-only read/write behavior is already proven for `songs` via this exact pattern.
- `functions/src/cleanupSweeps.ts` (lines 51-104) — confirmed `MEDIA_PATH_GUARD` regex
  (`/^orgs\/[^/]+\/media\//`) structurally excludes any non-`media/` prefix including a future
  `vamp-files/`, with an explicit comment already calling out `song-files/`'s exemption the same way.
- `src/constants/keys.ts` (full file) — confirmed `MAJOR_KEYS` has 14 entries (both enharmonic spellings),
  not the design's 12.
- `src/stores/orgScopedStores.ts` (full file) — confirmed the central church-switch/logout teardown
  registry that a new `vamps.ts` store must be added to.
- `.planning/config.json` — confirmed `workflow.nyquist_validation` is absent (treated as enabled) and
  `commit_docs: true`.

### Secondary (MEDIUM confidence — milestone-level research + owner design docs)
- `.planning/research/ARCHITECTURE.md` — largely reused for the store/upload/rules-mirror architecture;
  **its `/vamps` route + `VampsView.vue` recommendation is superseded** by 140-CONTEXT.md's tab decision
  (flagged explicitly in Summary above).
- `.planning/research/PITFALLS.md` — Pitfall 4's `firestore.exists()`-in-emulator framing is **superseded**
  by the current, claim-only `storage.rules` (flagged explicitly in Summary above); its other pitfalls
  (echo/autoplay/staleness) are Phase 141 concerns, out of this phase's scope.
- `.planning/phases/140-vamps-library-crud-storage/140-CONTEXT.md`,
  `.planning/phases/140-vamps-library-crud-storage/140-DESIGN-NOTES.md` — owner decisions (tab placement,
  one-key-per-vamp, optional tempo, delete-vamp button with no visible restore affordance) treated as
  locked per the User Constraints convention.
- `.planning/REQUIREMENTS.md` — R435/R436 verbatim requirement text.

### Tertiary (LOW confidence — not independently verified this session)
- None — every substantive claim above traces to a direct file read or an explicitly-flagged supersession
  of an earlier document.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — zero new dependencies, every pattern has a direct, currently-shipped twin read
  this session.
- Architecture: HIGH for store/upload/rules mirroring; MEDIUM for the two open UX-shape questions (delete
  two-step vs. one-step, "length" field scope) which are genuinely ambiguous between the design mock and
  the requirement text, not a research gap.
- Pitfalls: HIGH — all five pitfalls are grounded in specific, cited file/line evidence (path-collision
  math, the actual Deploy-2 rule text, the actual catch-all rule text, the actual `metaLine()` comment).

**Research date:** 2026-09-09
**Valid until:** 30 days (stable, shipped-precedent-heavy codebase; the storage.rules claim-migration and
catch-all behavior are architectural facts unlikely to change before this phase is planned/executed)
