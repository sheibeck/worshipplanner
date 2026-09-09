# Architecture Research

**Domain:** Feature integration analysis — v2.15 (Vamps library, rehearsal/report times, service-update
email link wiring, deep-link church-picker fix) into a shipped Vue 3 + Pinia + Firebase (Firestore/
Storage/Functions) worship-planning app.
**Researched:** 2026-09-09
**Confidence:** HIGH (every claim below is grounded in the real files read on this pass — `src/types/*`,
`src/stores/*`, `src/router/index.ts`, `src/components/AppSidebar.vue`, `src/utils/slideshowAssembler.ts`,
`src/utils/rehearseAccess.ts`, `functions/src/index.ts`, `functions/src/messageTokens.ts`, `storage.rules`,
`functions/src/cleanupSweeps.ts`, `src/components/ScheduleServiceCard.vue`, `src/views/SettingsView.vue`)

## System Overview — where each feature lands

```
┌────────────────────────────────────────────────────────────────────────────┐
│  EDITOR SURFACES (Vue views/components)                                     │
│  ┌───────────────┐ ┌──────────────────┐ ┌────────────────┐ ┌─────────────┐ │
│  │ VampsView.vue │ │ ServiceEditorView │ │ SettingsView    │ │ AppSidebar  │ │
│  │  (NEW)        │ │  .vue (Times tab, │ │  .vue (org      │ │  .vue (NEW  │ │
│  │  + VampSlideOver│  vamp picker in   │ │  rehearsal/     │ │  nav entry) │ │
│  │  (NEW)        │ │  EditSlideDrawer) │ │  report defaults)│ │             │ │
│  └───────┬───────┘ └─────────┬─────────┘ └────────┬────────┘ └──────┬──────┘ │
├──────────┼───────────────────┼────────────────────┼─────────────────┼───────┤
│  STORES (Pinia)               │                    │                 │       │
│  ┌───────▼──────┐  ┌──────────▼───────┐  ┌─────────▼────────┐        │       │
│  │ vamps.ts     │  │ services.ts       │  │ auth.ts           │       │       │
│  │  (NEW, mirrors│  │  (updateService  │  │  (OrgSettings +   │       │       │
│  │  songs.ts)   │  │  carries new      │  │  applyOrgSnapshot │       │       │
│  │              │  │  rehearsals[]/    │  │  merges rehearsal │       │       │
│  │              │  │  reportTime;      │  │  defaults;        │       │       │
│  │              │  │  buildServiceSnap-│  │  updateOrgSettings)│      │       │
│  │              │  │  shot/buildRehearse│ │                    │      │       │
│  │              │  │  Access carry them)│ │                    │      │      │
│  └──────────────┘  └──────────┬────────┘  └───────────────────┘       │      │
├────────────────────────────────┼────────────────────────────────────────────┤
│  PUBLIC / CROSS-CONSUMER PROJECTIONS                                        │
│  ┌─────────────────────────┐   ┌──────────────────────────────────────┐    │
│  │ ServiceSnapshot          │   │ RehearseAccessDoc (rehearseAccess.ts) │    │
│  │  (services.ts) → Share   │   │  → My Schedule / ScheduleServiceCard  │    │
│  │  views, print            │   │  / VolunteerServiceView               │    │
│  └─────────────────────────┘   └──────────────────────────────────────┘    │
├──────────────────────────────────────────────────────────────────────────────┤
│  PRESENTATION PIPELINE (unchanged surface, new data source)                  │
│  slideshowAssembler.ts → resolveEntryMedia() → Slide.audioUrl/audioLoop      │
│      → AudioPlayer.vue (already shipped; a vamp's URL flows through here     │
│        exactly like an uploaded slide-audio file does today)                 │
├──────────────────────────────────────────────────────────────────────────────┤
│  FIRESTORE (organizations/{orgId}/…)                                        │
│   services/{id}  (+ rehearsals[], reportTime)                               │
│   vamps/{id}      (NEW collection)                                          │
│   organizations/{orgId} settings.rehearsalDefaults / settings.reportTime    │
├──────────────────────────────────────────────────────────────────────────────┤
│  STORAGE                                                                     │
│   orgs/{orgId}/song-files/**        (existing, unchanged)                   │
│   orgs/{orgId}/vamp-files/**        (NEW, mirrors song-files/ exactly)      │
├──────────────────────────────────────────────────────────────────────────────┤
│  CLOUD FUNCTIONS (functions/src/index.ts)                                   │
│   sendQueuedMessageHandler — wire {{service_link}} into the                 │
│   relock-notification auto-generated body (ReLockNotifyPrompt.vue)          │
└──────────────────────────────────────────────────────────────────────────────┘
```

## Component Responsibilities (new vs. modified)

| Component/module | Status | Responsibility |
|---|---|---|
| `src/types/vamp.ts` | **NEW** | `Vamp` type: `id`, `title`, `key` (one key per doc), `audioUrl`, `storagePath`, `mimeType`, `sizeBytes`, `hidden`, `createdAt`/`updatedAt`. Flat — no `Arrangement[]`, no VW types, no CCLI. |
| `src/stores/vamps.ts` | **NEW** | Mirrors `src/stores/songs.ts` almost verbatim: `subscribe`/`unsubscribeAll` (onSnapshot on `organizations/{orgId}/vamps`), `addVamp`, `updateVamp`, `deleteVamp` (soft, `hidden:true`), `hardDeleteVamp` (mirrors `hardDeleteSong`'s hidden-only guard + best-effort Storage cleanup). No lyrics subcollection equivalent. |
| `src/utils/vampFiles.ts` | **NEW** | Mirrors `src/utils/songFiles.ts`: `VAMP_FILE_MAX_BYTES` (52428800, same cap), `VAMP_FILE_ALLOWED_MIME = ['audio/mpeg']` (audio-only — narrower than `SONG_FILE_ALLOWED_MIME`), `vampFileStoragePath(orgId, vampId, name)` → `orgs/{orgId}/vamp-files/{vampId}/{sanitizedName}`. Reuses `sanitizeFileName` from `songFiles.ts` (already exported for exactly this kind of reuse). |
| `src/composables/useVampFileUpload.ts` | **NEW** | Mirrors `useSongFileUpload.ts` but single-file (a vamp is one key = one mp3, not a multi-file attachment list) and MP3-only. Writes `vamp.audioUrl`/`storagePath` directly via `updateVamp`, not an `arrayUnion` attachments array — a vamp has exactly one audio file, not a growable list, so it does not need `addSongAttachment`'s atomic-append pattern. |
| `src/views/VampsView.vue` | **NEW** | Full page mirroring `SongsView.vue`'s shape (list + search, no page-level tabs — same "no tab bar" precedent the recon already flagged for Songs). |
| `src/components/VampSlideOver.vue` | **NEW** | Mirrors `SongSlideOver.vue`: create/edit a vamp's title, key, and single mp3 (via `useVampFileUpload`). |
| `src/components/VampTable.vue` | **NEW** | Mirrors `SongTable.vue` (list rows, key badge, filename, play/remove). |
| `src/components/slides/EditSlideDrawer.vue` | **MODIFIED** | Add a third `audioState` value (`'vamp'`) alongside today's `'slide' | 'group' | null`, and a "Choose a Vamp" picker beside the existing raw-file "Attach audio" control. See **Vamp→Slide Assignment** pattern below for the exact write path and field-design recommendation. |
| `src/types/slideGroup.ts` (`GroupSlideEntry`) | **MODIFIED (additive)** | Add `vampId?: string` — metadata only (see recommendation). `audioUrl`/`audioLoop` are unchanged and remain the actual playback fields. |
| `src/types/service.ts` (`Service`) | **MODIFIED (additive)** | Add `rehearsals?: { id: string; date: string; time: string }[]` and `reportTime?: string`. See **Rehearsal/Report Times** section for the exact shape and rationale. |
| `src/types/organization.ts` (`OrgSettings`) | **MODIFIED (additive)** | Add `rehearsalDefaults: { date: never; time: string }[]`-shaped default *template* (time-only, no date — see below) and `reportTimeDefault: string`, both inside `DEFAULT_ORG_SETTINGS`. |
| `src/stores/services.ts` | **MODIFIED** | `createService` pre-fills `rehearsals`/`reportTime` from `authStore.settings` (mirrors the existing `defaultServiceTemplate` pre-fill at the same call site, `services.ts:452-457`). `buildServiceSnapshot` carries the new fields into `ServiceSnapshot` (they are not free-text/PII, so no `toPublicServiceSnapshot` strip is needed — they behave like `date`, not like `notes`). |
| `src/utils/rehearseAccess.ts` (`buildRehearseAccess`) | **MODIFIED** | Add `rehearsals`/`reportTime` to `RehearseAccessDoc`, copied straight off `service.rehearsals`/`service.reportTime` — same treatment as `serviceDate`, no PII concern. |
| `src/views/SettingsView.vue` | **MODIFIED** | New "Rehearsal & Report Defaults" section, following the existing Messaging section's exact pattern (`updateDoc` dot-path write + local mirror-write, `reminderDaysBeforeSavedFeedback`-style save feedback). |
| `src/views/ServiceEditorView.vue` | **MODIFIED** | New "Times" UI (likely a small panel on the existing Order tab, or its own tab) to add/edit `rehearsals[]` and `reportTime`, pre-filled from org defaults at creation. |
| `src/components/ScheduleServiceCard.vue` | **MODIFIED** | Lines 40-41 today read: *"Time·venue and call time are omitted entirely — Service has no time-of-day/venue field yet."* This is the exact, already-flagged gap v2.15 closes — render `reportTime` (and the next upcoming `rehearsals[]` entry) once `RehearseAccessDoc` carries them. |
| `src/components/DashboardView.vue`, `ServiceCard.vue`, `ShareView.vue`, `VolunteerServiceView.vue` | **MODIFIED (display only)** | Every site that calls `formatServiceDate(service.date)` today (enumerated below) gains an adjacent time render. |
| `functions/src/index.ts` (`sendQueuedMessageHandler`) | **MODIFIED** | See **Emails** section — `options.attachServiceLink` is currently a dead field; either wire it to append the link server-side, or fix the one caller that omits the token from its body. |
| `src/components/ReLockNotifyPrompt.vue` | **MODIFIED** | The re-lock ("order-of-service update") notice's auto-generated `bodyText` (lines 297-300) never includes `{{service_link}}` — this is the actual defect the milestone's "always link to the plan" feature fixes. |
| `src/stores/auth.ts` | **MODIFIED** | `readRememberedOrg`/`rememberOrg`/`clearRememberedOrg` — add a `localStorage` fallback keyed by uid, read by `loadOrgContext`. See **Church-Picker Fix** section for the exact minimal diff. |
| `storage.rules` | **MODIFIED** | New `match /orgs/{orgId}/vamp-files/{allPaths=**}` block mirroring the existing `song-files/` block (lines 107-120) exactly, but `contentType == 'audio/mpeg'` only; add `vamp-files/` to the catch-all's two exclusion regexes (lines 130, 137). |
| `functions/src/cleanupSweeps.ts` | **NOT MODIFIED** | The retention sweeps use an *allowlist* regex (`MEDIA_PATH_GUARD = /^orgs\/[^/]+\/media\//`, `cleanupSweeps.ts:54`) — anything outside `media/`/`backgrounds/`/`pptx-imports/` is already structurally exempt. A new `vamp-files/` prefix needs **zero** changes here, exactly like `song-files/` needed none. |

## Architectural Patterns

### Pattern 1: New library entity mirrors Song 1:1 (Vamps)

**What:** `Vamp` is a flat, single-file version of `Song` + `SongAttachment` collapsed into one document — no
arrangements, one key, one audio file, org-scoped collection, soft-delete-then-hard-delete lifecycle.

**When to use:** Any future "small keyed media library" entity (this is now the second one after Song
attachments) should follow this exact shape rather than growing `Song` itself or building a bespoke store.

**Trade-offs:** Duplicating `songs.ts`'s ~600 lines into `vamps.ts` is more code than parameterizing a
generic "keyed media library" store, but the codebase's own convention (documented repeatedly across ADRs
in `slideGroup.ts`/`organization.ts`) is "mirror the precedent exactly, do not prematurely abstract" —
`useSongFileUpload.ts` vs. a hypothetical generic uploader is the same call already made once. Follow it
again rather than introducing a shared abstraction two call sites don't yet justify.

### Pattern 2: Vamp→slide assignment — denormalize the audio URL, keep `vampId` as display-only metadata

**What:** `GroupSlideEntry` already has `audioUrl`/`audioLoop` (shipped, used by `resolveEntryMedia` in
`slideshowAssembler.ts` and rendered by `AudioPlayer.vue`). The question is whether a vamp assignment
writes the vamp's URL **into that existing field** (denormalized) or adds a **new `vampId` reference**
that the assembler resolves live against a vamp lookup map (mirroring how `SongSlot.songId` is resolved
live against `songLyricsById` in `useSlideshowAssembly.ts`).

**Recommendation — hybrid, weighted toward denormalization:**

1. Add `vampId?: string` to `GroupSlideEntry` — **metadata only**, used by the editor UI to label the
   control ("Playing: Bridge Vamp — Key of G") and to let `EditSlideDrawer.vue` re-open the picker with
   the current selection highlighted. **Never read by the presentation pipeline.**
2. At assignment time, write the vamp's **current** `audioUrl` into the entry's **existing** `audioUrl`
   field, through the exact same write path `attachSlideAudio()` already uses today
   (`EditSlideDrawer.vue:867-874` → `slideGroupsStore.replaceGroupSlides`). Only the field's *value*
   changes (now a vamp's URL instead of a raw upload's URL) — no changes to `slideshowAssembler.ts`,
   `AssemblyInputs`, `useSlideshowAssembly.ts` (which currently threads `songLyricsById` through four
   separate call sites — see lines 414/453/574/617 — a `vampsById` reference-resolution design would need
   to touch all four), `resolveEntryMedia`, or any output view (`FullscreenSlideOutput.vue`,
   `AudienceOutputView.vue`, `ConfidenceOutputView.vue`, `VideoOutputView.vue`). This is the literal
   "reuse the existing per-slide live-audio pipeline, no new render surface" instruction from PROJECT.md.

**Trade-offs made explicit (what breaks and why it's acceptable here):**

- **Vamp edited (mp3 replaced) after assignment:** Storage uploads in this codebase mint a **new**
  attachment id/path per upload rather than overwriting in place (`song-files/{attachmentId}/…`,
  explicitly enforced by `storage.rules`' `allow update: if false` on that block, "Attachments are
  immutable once uploaded — every re-upload uses a new attachmentId/path," `storage.rules:114-117`). A
  vamp "edit" that replaces its mp3 will therefore mint a new URL on the `Vamp` doc; **already-assigned
  slides keep playing the OLD file** until someone reopens the slide and reassigns. This exactly mirrors
  the existing, accepted precedent that `SongSlot.songTitle`/`songKey` are denormalized at assignment time
  and do **not** live-update when the song is later renamed (`services.ts` has no such propagation) — this
  is not a new class of staleness, it is the same one the codebase already ships with elsewhere.
- **Vamp deleted after assignment:** the denormalized URL becomes a dangling Storage reference. This is
  the same residual the codebase already explicitly accepts for song attachments — `removeSongAttachment`/
  `hardDeleteSong`'s own comments call an orphaned blob "acceptable per the CONTEXT remove-atomicity
  decision." The existing `AudioPlayer`/`EditSlideDrawer` failure path (`onAudioError` → `audioFailed`,
  `EditSlideDrawer.vue:842-847`) already surfaces a 404'd audio URL visibly in the editor — this is not a
  silent failure, it reuses an existing error affordance.
- **Mitigation worth building (cheap, not required for correctness):** before a hard-delete, scan
  `organizations/{orgId}/slideGroups` for any entry whose `vampId` matches (a `getDocs` best-effort scan,
  mirroring `resyncRehearseAccessForSong`'s existing cross-collection scan pattern in `services.ts`) and
  show "used in N slides" in the delete confirmation — advisory only, not a hard block, matching this
  codebase's general preference for visible warnings over hard locks on destructive actions elsewhere
  (e.g. Song's hidden-then-hard-delete two-step).

**Why not full reference-by-id (a `vampsById` map resolved live in the assembler), rejected but noted:**
this would make an edit/delete propagate automatically (a genuine correctness win) and matches this
codebase's dominant convention for *content* (`SourceRef` — lyric/copyright/scripture/imported all
resolve live, never denormalize). It was not recommended as the primary design because it requires
touching the assembler + all four `useSlideshowAssembly.ts` call sites + `EditSlideDrawer.vue`'s audio-state
model for a feature whose PROJECT.md framing explicitly prioritizes minimal new surface area ("no new
render surface," "heavy reuse"). If a future milestone finds vamp edits/deletes-after-assignment to be a
recurring pain point, revisit toward reference-by-id then — the `vampId` field recommended above is
forward-compatible with that migration (it already carries the reference; only the *resolution point*
would move from write-time to render-time).

### Pattern 3: Additive-only, no-migration schema growth

**What:** Every new field on `Service`, `OrgSettings`, `GroupSlideEntry`, and `RehearseAccessDoc` is
optional and additive — the exact convention this codebase uses for every prior schema change (see
`Service.stageLayout?`, `ServiceSlot.videoOutput?`, `SongAttachment` on `Song.attachments?`, all explicitly
documented as "no migration" in their own JSDoc). `rehearsals?`/`reportTime?` absent on every existing
service doc is the legitimate "no times set yet" state; `defaultServiceTemplate: []` empty-array precedent
in `DEFAULT_ORG_SETTINGS` is the model for `rehearsalDefaults: []`.

**When to use:** Always, for this codebase — a required field or non-empty default the app must
back-fill against production data is treated as expensive and avoided; optional-with-a-safe-default is the
house style throughout `organization.ts`/`service.ts`.

## Data Flow

### Vamps: assignment → playback

```
VampsView.vue (create/edit vamp)
    → vamps store addVamp/updateVamp
    → organizations/{orgId}/vamps/{id}  (Firestore)
    → useVampFileUpload → orgs/{orgId}/vamp-files/{vampId}/{name}.mp3  (Storage)

EditSlideDrawer.vue "Choose a Vamp" picker (reads vamps store, already subscribed like songs store)
    → attachSlideAudio(vamp.audioUrl) + entry.vampId = vamp.id   [existing write path, EditSlideDrawer.vue:867-874]
    → slideGroupsStore.replaceGroupSlides(...)
    → organizations/{orgId}/slideGroups/{slotId}.slides[i].audioUrl / .vampId  (Firestore)

useSlideshowAssembly.ts → assembleSlideshow() → resolveEntryMedia()   [UNCHANGED — reads entry.audioUrl exactly as today]
    → AssembledSlide.slide.audioUrl
    → AudioPlayer.vue (already shipped; plays whatever URL it is given, vamp or not)
    → Audience/Confidence/Video outputs render identically — no output-view changes needed
```

### Rehearsal & report times: defaults → service → every display surface

```
SettingsView.vue "Rehearsal & Report Defaults" (NEW section)
    → authStore.updateOrgSettings({ 'settings.rehearsalDefaults': [...], 'settings.reportTimeDefault': '...' })
    → organizations/{orgId}.settings.rehearsalDefaults / .reportTimeDefault  (Firestore, dot-path write — mirrors messaging.* pattern)
    → auth.ts applyOrgSnapshot() merges into authStore.settings (same DEFAULT_ORG_SETTINGS-merge choke point as every other setting)

services.ts createService()  [same call site that pre-fills defaultServiceTemplate, services.ts:452-457]
    → seeds new Service.rehearsals[] (dated from the defaults' time-of-day + org-picked offsets, or left for
      the planner to date) and Service.reportTime from authStore.settings

ServiceEditorView.vue "Times" UI → updateService(id, { rehearsals, reportTime })
    → organizations/{orgId}/services/{id}.rehearsals / .reportTime  (Firestore)
    → maybeRefreshShareLink() [existing hook, services.ts:619-621] refreshes ServiceSnapshot automatically
    → buildServiceSnapshot() carries the new fields  → ServiceSnapshot.rehearsals/.reportTime
        → shareTokens/{token} & serviceShares/{slug}__service-{date}  → ShareView.vue (public plan page)

markAsPlanned() [services.ts:628] → writeRehearseAccessDoc() → buildRehearseAccess()
    → RehearseAccessDoc.rehearsals/.reportTime (rehearseAccess.ts, additive fields, no PII concern — same
      treatment as serviceDate)
        → organizations/{orgId}/rehearseAccess/{serviceId}  (Firestore)
        → MyScheduleView.vue / ScheduleServiceCard.vue (closes the exact gap flagged at
          ScheduleServiceCard.vue:40-41, "Service has no time-of-day/venue field yet")
        → VolunteerServiceView.vue

DashboardView.vue / ServiceCard.vue  → read service.rehearsals/.reportTime directly off the subscribed
    services store (editor-facing, no projection hop needed — same as how they already read service.date)
```

**Every display surface that must carry the new times (enumerated from this pass's greps):**

| Surface | File | Today reads | Add |
|---|---|---|---|
| Editor dashboard | `src/views/DashboardView.vue` (`formatServiceDate(nextService.date)`, `formatServiceDate(s.date)`) | `service.date` directly off `services` store | `service.reportTime` / next `rehearsals[]` entry |
| Services list | `src/components/ServiceCard.vue:124` | `props.service.date` | same |
| Service editor header | `src/views/ServiceEditorView.vue` | `service.date` | new "Times" tab/panel (edit surface, not just display) |
| Public share page | `src/views/ShareView.vue:182` (`serviceSnapshot.value?.date`) | `ServiceSnapshot.date` | `ServiceSnapshot.rehearsals`/`.reportTime` |
| My Schedule card | `src/components/ScheduleServiceCard.vue:40-41` | *(explicitly nothing — comment documents the gap)* | `RehearseAccessDoc.reportTime` / next rehearsal |
| Volunteer service view | `src/views/VolunteerServiceView.vue` (via `RehearseAccessDoc`) | service title/date context | same doc's new fields |
| Volunteer messaging (email) | `functions/src/index.ts` `formatServiceDate(serviceData.date)` | Admin-SDK service read | optionally a new `{{report_time}}`/`{{rehearsal_dates}}` merge token in `messageTokens.ts`, out of the milestone's stated scope but a natural follow-on |

### Rehearsal/report time field shape recommendation

```typescript
// src/types/service.ts — additive on Service
rehearsals?: {
  id: string        // minted client-side (crypto.randomUUID()), mirrors StageMarker.id/SongAttachment.id
  date: string       // YYYY-MM-DD, same format/parsing convention as Service.date
  time: string        // 'HH:mm' 24h, matches <input type="time"> value format directly — no AM/PM parsing needed
  label?: string      // optional free text ("Full band", "Vocals only") — deferred if not requested
}[]
reportTime?: string   // 'HH:mm' 24h, day-of call time — single field, not an array (per owner decision)

// src/types/organization.ts — additive on OrgSettings, inside DEFAULT_ORG_SETTINGS
rehearsalDefaults: { time: string }[]   // TIME-ONLY (no date — a default can't know a future service's
                                          // date); createService() combines each default's time with a
                                          // planner-chosen date (or the pattern the discuss/plan phase
                                          // settles, e.g. "N days before the service")
reportTimeDefault: string                // 'HH:mm', empty string '' = unset (mirrors bibleVersion-style
                                          // flat-string defaults, not a boolean gate)
```

`'HH:mm'` (not a `Timestamp`) is recommended because: (1) it round-trips through a plain `<input
type="time">` with no timezone math, matching the codebase's existing `Service.date` treatment (a plain
`YYYY-MM-DD` string, not a `Timestamp`, specifically so no timezone conversion happens on a date-only
field — same rationale applies to a time-of-day field with no absolute-instant meaning); (2) it composes
directly with the existing `Service.date` + a per-org `OrgSettings.timezone` (already present, `R133`) at
the one place an absolute instant is ever needed — email/reminder scheduling — without adding a second
timezone-bearing field.

## Vamps: Storage path + rules (concrete diff)

**Storage path:** `orgs/{orgId}/vamp-files/{vampId}/{sanitizedName}` — a **new sibling prefix** to
`song-files/`, not a reuse of it. Reasons: (1) `song-files/`'s path segment is keyed by `attachmentId`
(one of potentially several attachments per song); a vamp has exactly one file per doc, so keying by
`vampId` directly is simpler and avoids inventing a fake "attachment id" for a 1:1 entity; (2) a distinct
prefix keeps the two libraries' `storage.rules` blocks independently auditable (vamps never need PDF, so
its `contentType` allowlist is `['audio/mpeg']` only, tighter than song-files' `['application/pdf',
'audio/mpeg']`) — reusing `song-files/` would either loosen the vamp-only path to admit PDFs or force the
song block to somehow know the caller's intent; (3) it costs nothing extra — the retention sweeps
(`cleanupSweeps.ts`) already use an allowlist regex (`MEDIA_PATH_GUARD`, `cleanupSweeps.ts:54`), so any
prefix outside `media/`/`backgrounds/`/`pptx-imports/` is automatically retention-exempt with **zero**
changes there, mirroring `song-files/`'s own "intentionally out of scope" comments verbatim
(`cleanupSweeps.ts:55,188,364,577`).

**`storage.rules` diff (mirrors the existing `song-files/` block, `storage.rules:99-120`, exactly):**

```
match /orgs/{orgId}/vamp-files/{allPaths=**} {
  allow read: if isOrgMember(orgId);
  allow create: if isOrgEditor(orgId)
                   && request.resource.size < 52428800
                   && request.resource.contentType == 'audio/mpeg';
  allow update: if false;   // immutable upload, same "new id per re-upload" rationale as song-files/
  allow delete: if isOrgEditor(orgId);
}
```

Plus add `vamp-files/` to the catch-all block's two existing exclusion regexes at `storage.rules:130` and
`storage.rules:137` (`!resource.name.matches('^orgs/[^/]+/(song-files|vamp-files)/.*')`), for the exact
same reason the block's own comment already documents for `song-files/` — without the exclusion the
generic `<25MB`/member-write catch-all would independently permit a non-audio or oversized write to
`vamp-files/`.

## Vamps: nav/route placement

`AppSidebar.vue`'s `navItems` computed builds items in explicit groups (My Schedule → Dashboard →
Services/Monitor Setup → Songs → Schedule/Volunteers → Admins/Settings → Owner Console). Vamps is an
editor-only library page like Songs, so it slots into the **same group as Songs**
(`AppSidebar.vue:539-547`), gated on `authStore.isEditor` exactly like Songs is, as a sibling item
immediately after it:

```typescript
if (authStore.isEditor) {
  items.push({ label: 'Songs', to: '/songs', icon: '…' })
  items.push({ label: 'Vamps', to: '/vamps', icon: '…' })   // NEW
}
```

`router/index.ts` gains one new route, placed among the other `requiresAuth + requiresEditor` static
routes (next to `/songs` at line 44-48, before the trailing public/dynamic slug routes so it's never
shadowed — same placement discipline the router's own comments call out repeatedly for every other
route added since):

```typescript
{
  path: '/vamps',
  name: 'vamps',
  component: () => import('../views/VampsView.vue'),
  meta: { requiresAuth: true, requiresEditor: true },
},
```

No router-guard changes needed — the existing `beforeEach` org-selection gate (`router/index.ts:270-291`)
and `requiresEditor` gate (`router/index.ts:310-317`) already cover any new `requiresAuth: true,
requiresEditor: true` route with zero modification.

## Emails: minimal wiring for `{{service_link}}`

**Root cause, verified in this pass:** the "service-update email" is the **relock-notification** —
queued by `ReLockNotifyPrompt.vue` when a planner re-locks a service after edits (`ServiceEditorView.vue`
lines ~3320+ call this on relock). Its `subject`/`bodyText` are **auto-generated purely from the change
diff** (`ReLockNotifyPrompt.vue:293-300`):

```typescript
const subject = computed(() => `Service updated: ${n} ${n === 1 ? 'change' : 'changes'} since the last lock`)
const bodyText = computed(() => ['Here's what changed since the last lock:', '', ...lines].join('\n'))
```

Neither string contains `{{service_link}}`. The call **does** set `options: { attachServiceLink: true,
sendCopyToSelf: false }` — but `options.attachServiceLink` is a **dead field**: grep across all of
`functions/src` confirms it is declared on the `MessageOptions` interface (`index.ts:1631-1634`) and
persisted onto `QueuedMessageDoc`, but `sendQueuedMessageHandler` (`index.ts:2029+`) never reads it. The
only place `{{service_link}}` ever reaches an outgoing email is `renderMessageTokens()`
(`messageTokens.ts:47-63`) substituting a **literal token string present in the body** — which this one
body never contains. (By contrast, `LOCK_BODY` in `ServiceEditorView.vue:3139-3153`, the initial-lock
email, and `MessageComposer.vue`'s `reminder`/`share-link` defaults, all correctly embed
`{{service_link}}` literally — this is an isolated, single-caller gap, not a systemic one.)

**Minimal, correct fix — two independent options, either sufficient alone:**

1. **Fix the one caller (recommended, smallest diff):** append a line to `ReLockNotifyPrompt.vue`'s
   `bodyText` computed: `['…', '', ...lines, '', 'View the full plan: {{service_link}}'].join('\n')`. Zero
   backend changes; `renderMessageTokens` already substitutes it correctly (proven by the `LOCK_BODY`
   path). This alone satisfies "no update email ever goes out without a link to the plan."
2. **Make `attachServiceLink` do what its name says (defense-in-depth, optional):** in
   `sendQueuedMessageHandler`, after computing `serviceLink` (`index.ts:2160`), if
   `message.options?.attachServiceLink && !message.body.includes('{{service_link}}')`, append a rendered
   link line before sending. This closes the gap structurally for any *future* caller that sets the flag
   but forgets the token (the flag currently gives a false sense of safety), at the cost of a
   server-side text-mutation branch that has to be careful not to double-append when a caller (like
   `LOCK_BODY`) already embedded the token.

Recommend **doing (1) now** (it is the actual, scoped bug) and flagging (2) as a phase-level
nice-to-have/cleanup — it touches shared send-path code exercised by every message type, which raises the
review bar for a milestone whose stated scope is narrowly "wire the token into the update flow."

## Church-picker fix: minimal diff respecting the sessionStorage rationale

**The documented rationale** (`auth.ts:65-70`) for `sessionStorage` is explicit: *"survives a page refresh
but a full logout clears it — matching 'log out and back in to switch churches'... one browser session
can't leak a choice across accounts."* Both of those properties must survive the fix. A bare switch to
`localStorage` would break the "logout clears the choice" guarantee (a shared/kiosk browser would keep
routing a *different* logged-in user into the *last* user's remembered org — mitigated today only by the
existing `uid` match check inside `readRememberedOrg`, which localStorage keeps too, but the **clear-on-
logout** behavior needs to be preserved deliberately since `localStorage.removeItem` doesn't happen
automatically the way session teardown does).

**Recommended minimal diff — `localStorage` as a second-tier fallback, `sessionStorage` remains primary:**

```typescript
// src/stores/auth.ts
const SELECTED_ORG_STORAGE_KEY = 'wp.selectedOrg'          // sessionStorage — UNCHANGED, still primary
const SELECTED_ORG_LOCAL_KEY = 'wp.selectedOrg.persist'      // NEW localStorage key, same {uid, orgId} shape

function readRememberedOrg(uid: string): string | null {
  try {
    const raw = sessionStorage.getItem(SELECTED_ORG_STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as { uid?: string; orgId?: string }
      if (parsed.uid === uid && typeof parsed.orgId === 'string') return parsed.orgId
    }
  } catch { /* fall through */ }
  // NEW — a genuinely new tab/window has no sessionStorage entry (browser-enforced
  // per-tab isolation) but DOES have localStorage; fall back to it so a right-clicked
  // deep link or a fresh tab restores the same active org instead of bouncing to
  // /select-church. Still uid-scoped, exactly like the sessionStorage path above.
  try {
    const raw = localStorage.getItem(SELECTED_ORG_LOCAL_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { uid?: string; orgId?: string }
    return parsed.uid === uid && typeof parsed.orgId === 'string' ? parsed.orgId : null
  } catch {
    return null
  }
}

function rememberOrg(uid: string, orgId: string): void {
  const payload = JSON.stringify({ uid, orgId })
  try { sessionStorage.setItem(SELECTED_ORG_STORAGE_KEY, payload) } catch { /* ignore */ }
  try { localStorage.setItem(SELECTED_ORG_LOCAL_KEY, payload) } catch { /* ignore */ }
}

function clearRememberedOrg(): void {
  try { sessionStorage.removeItem(SELECTED_ORG_STORAGE_KEY) } catch { /* ignore */ }
  try { localStorage.removeItem(SELECTED_ORG_LOCAL_KEY) } catch { /* ignore */ }  // preserves "logout clears it"
}
```

**Why this preserves every documented property:**
- **"Survives a refresh"** — unchanged, `sessionStorage` read still wins when present (same tab).
- **"A full logout clears it"** — `logout()` (`auth.ts:886-924`) already calls `clearRememberedOrg()`
  unconditionally before `signOut(auth)`; adding the `localStorage.removeItem` call there closes the same
  gap for the new key with a one-line addition to an existing, already-called function — no new call site
  needed.
- **"One browser session can't leak a choice across accounts"** — the `uid` match inside
  `readRememberedOrg` is preserved verbatim for the new key; a second Google account signing in on the
  same machine still only adopts `localStorage`'s remembered org if the stored `uid` matches theirs.
- **New tab / deep link now resolves** — `loadOrgContext` (`auth.ts:444+`) calls `readRememberedOrg(uid)`
  exactly once (`auth.ts:525`) and doesn't care which storage tier answered; `activeId` resolves the same
  way whether the read came from session or local storage, so **zero changes needed in `loadOrgContext`
  itself or the `needsOrgSelection`/`requiresOrgSelection` computed properties** (`auth.ts:183-208`) — the
  fix is entirely contained in the three private helper functions above. A single-church user is
  unaffected either way (`activeId` already resolves to their sole org regardless of remembered state, per
  the existing `ids.length === 1 ? ids[0]! : null` fallback at `auth.ts:527`).
- **Multi-membership `needsOrgSelection` interaction** — unaffected: that gate only fires when `orgId.value
  === null` *after* `loadOrgContext` has already tried (and failed) to resolve an active org from either
  storage tier. Restoring a remembered org via `localStorage` in a fresh tab means `activeId` resolves
  non-null, `orgId.value` gets set, and the gate never fires for that session — which is the entire point
  of the fix.

**Alternative considered and rejected:** restoring the org from the deep-link's own target route (e.g. an
`?org=` query param, as the presentation output routes already carry) instead of persisted storage. This
was rejected as the *primary* fix because most in-app links (`/services/:id`, `/songs`, etc.) carry no org
in their URL today, so making this work would mean threading an org param through every internal link app-
wide — a far larger diff than the two-tier storage fallback above, for the same user-visible outcome.

## Anti-Patterns to Avoid

### Anti-Pattern 1: Building a second Storage/upload abstraction for vamps

**What people might do:** write a bespoke upload handler for vamps instead of mirroring
`useSongFileUpload.ts`.
**Why it's wrong:** the codebase already has one battle-tested resumable-upload composable with the exact
validation/error/progress-row shape needed; duplicating the *pattern* (a new file, mirrored) is correct
per this codebase's convention, but duplicating the *upload mechanics themselves* (a different
`uploadBytesResumable` call shape, different progress-row model) would fragment behavior for no reason.
**Do this instead:** copy `useSongFileUpload.ts`'s structure into `useVampFileUpload.ts`, narrowing to
single-file + audio-only, reusing `sanitizeFileName` from `songFiles.ts` directly (already exported for
this).

### Anti-Pattern 2: Resolving vamp audio live in the assembler "for correctness" without weighing the diff cost

**What people might do:** jump straight to a `vampsById` reference-resolution design because it's "more
correct" (matches `SourceRef`'s live-resolution convention).
**Why it's wrong:** for this milestone's stated scope ("reuse the existing per-slide live-audio pipeline,
no new render surface"), that design touches five files (`slideshowAssembler.ts`,
`useSlideshowAssembly.ts` ×4 call sites, `EditSlideDrawer.vue`) for a staleness risk this codebase already
accepts elsewhere (song-slot title/key denormalization, song-attachment delete residue).
**Do this instead:** denormalize the URL at assignment time (Pattern 2 above); keep `vampId` as forward-
compatible metadata in case a future milestone wants to revisit.

### Anti-Pattern 3: Treating `Service.date`-adjacent time fields as `Timestamp`

**What people might do:** store `reportTime`/`rehearsals[].time` as a `Timestamp` "to be consistent with
`createdAt`/`updatedAt`."
**Why it's wrong:** `Timestamp` bakes in an absolute instant (UTC-anchored), which forces a timezone
decision at write time for a value that is really "a time-of-day label" (like `Service.date`'s deliberate
plain-string, no-`Timestamp` treatment) — every consumer (dashboard, My Schedule, share page) would then
have to re-derive "what time does this display as" through the org's `timezone` setting just to show a
label, when a plain `'HH:mm'` string needs no such derivation for display and composes with `Service.date`
+ `OrgSettings.timezone` only at the one point that already needs an absolute instant (email/reminder
scheduling, which already resolves timezone via `todayInTimeZone`/`minusDays` in `functions/src/index.ts`).
**Do this instead:** plain `'HH:mm'` strings, mirroring `Service.date`'s own `'YYYY-MM-DD'` convention.

## Integration Points

### Internal Boundaries

| Boundary | Communication | Notes |
|---|---|---|
| `vamps.ts` store ↔ `EditSlideDrawer.vue` | Direct Pinia read (already-subscribed org-scoped store, same pattern as `songStore.songs` today) | Vamps store must be subscribed alongside songs/slideGroups wherever the service editor mounts (mirrors existing org-scoped store subscription list in `ServiceEditorView.vue`/`orgScopedStores.ts`) |
| `services.ts` ↔ `rehearseAccess.ts` | `writeRehearseAccessDoc()` at `markAsPlanned` only — a **frozen snapshot**, not live-synced | Rehearsal/report time edits made **after** a service is locked do not reach My Schedule until the next relock (or the existing `resyncRehearseAccessForSong`-style resync pattern is extended) — same latency contract every other `RehearseAccessDoc` field already has |
| `auth.ts` ↔ `router/index.ts` | `authStore.requiresOrgSelection` computed, read once per navigation in `beforeEach` | No router changes needed for the church-picker fix — the fix is entirely inside `auth.ts`'s private storage helpers |
| `storage.rules` ↔ `functions/src/cleanupSweeps.ts` | Independent allowlists (`storage.rules`' explicit path match vs. `cleanupSweeps.ts`'s `MEDIA_PATH_GUARD` regex) | Both already agree a non-`media/`/`backgrounds/`/`pptx-imports/` prefix is out of scope for cleanup by construction — `vamp-files/` needs a `storage.rules` addition but zero `cleanupSweeps.ts` addition |

## Suggested Build Order (dependency-ordered)

1. **Types + org defaults** — `src/types/service.ts` (`rehearsals?`, `reportTime?`), `src/types/
   organization.ts` (`rehearsalDefaults`, `reportTimeDefault` in `DEFAULT_ORG_SETTINGS`). No UI yet;
   everything downstream depends on these shapes existing.
2. **Church-picker fix** — fully independent of everything else in this milestone (touches only
   `auth.ts`'s three private helpers + one line in `logout()`); ship first since it's isolated, low-risk,
   and unblocks nothing/is unblocked by nothing.
3. **Rehearsal/report times: Settings defaults + Service editor UI + display surfaces** — Settings section
   → `services.ts createService` pre-fill → `ServiceEditorView.vue` Times UI → `buildServiceSnapshot`/
   `buildRehearseAccess` projection carry-through → the enumerated display surfaces
   (`ScheduleServiceCard.vue` closes its own documented gap last, since it depends on the
   `RehearseAccessDoc` fields existing).
4. **Emails: `{{service_link}}` wiring** — trivial, one-line fix to `ReLockNotifyPrompt.vue`'s `bodyText`;
   no dependency on anything else in this milestone. Could ship in parallel with (2)/(3).
5. **Vamps library (types → store → Storage/rules → UI → nav/route → slide-assignment)** — the largest
   piece, and the only one with an internal sequencing constraint of its own:
   a. `src/types/vamp.ts`, `src/utils/vampFiles.ts` (constants/path helper, no dependencies).
   b. `storage.rules` vamp-files block (needed before any real upload can succeed, even in dev against
      the emulator).
   c. `src/stores/vamps.ts`, `src/composables/useVampFileUpload.ts`.
   d. `VampsView.vue`/`VampSlideOver.vue`/`VampTable.vue` (the CRUD UI) + `AppSidebar.vue`/`router/
      index.ts` nav+route.
   e. `GroupSlideEntry.vampId` field + the `EditSlideDrawer.vue` "Choose a Vamp" picker (depends on (c)
      existing so the picker has something to list) — this is the step that actually delivers "assignable
      to a slide, plays live," and it depends on nothing in steps 1-4.
6. **Cross-cutting verification** — confirm audible output under browser autoplay policy in the
   non-interactive Run outputs (explicitly called out in PROJECT.md) once step 5e ships; this is a UAT
   step, not an additional integration point — `AudioPlayer.vue`'s existing `autoplay-blocked`/play-
   affordance handling (`AudioPlayer.vue:90-95`) already covers this for any `audioUrl`, vamp-sourced or
   not.

Steps 1-4 have no dependency on step 5 and can be built/shipped as an earlier phase or in parallel by a
different plan; step 5 is the one multi-plan feature with true internal ordering constraints (rules before
store, store before UI, UI before slide-assignment).

## Sources

- Direct reads of this codebase (2026-09-09): `src/types/service.ts`, `src/types/slideGroup.ts`,
  `src/types/organization.ts`, `src/types/song.ts`, `src/stores/services.ts`, `src/stores/songs.ts`,
  `src/stores/auth.ts`, `src/utils/songFiles.ts`, `src/composables/useSongFileUpload.ts`,
  `src/utils/rehearseAccess.ts`, `src/router/index.ts`, `src/components/AppSidebar.vue`,
  `src/utils/slideshowAssembler.ts`, `src/components/AudioPlayer.vue`,
  `src/components/slides/EditSlideDrawer.vue`, `src/components/slides/SlideGroupMusicControl.vue`,
  `src/composables/useSlideshowAssembly.ts`, `functions/src/index.ts`, `functions/src/messageTokens.ts`,
  `functions/src/cleanupSweeps.ts`, `storage.rules`, `src/components/ReLockNotifyPrompt.vue`,
  `src/components/MessageComposer.vue`, `src/stores/mySchedule.ts`, `src/components/ScheduleServiceCard.vue`,
  `src/views/SettingsView.vue`, `src/views/ShareView.vue`, `src/components/ServiceCard.vue`,
  `src/views/DashboardView.vue`, `.planning/PROJECT.md` (v2.15 milestone section).

---
*Architecture research for: WorshipPlanner v2.15 (Vamps, rehearsal/report times, email link wiring,
church-picker fix)*
*Researched: 2026-09-09*
