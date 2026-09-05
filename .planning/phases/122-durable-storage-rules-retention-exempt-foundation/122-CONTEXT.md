# Phase 122: Durable Storage, Rules & Retention-Exempt Foundation - Context

**Gathered:** 2026-09-05
**Status:** Ready for planning
**Mode:** Auto-generated (autonomous smart-discuss; invariants pre-locked with owner 2026-09-05)

<domain>
## Phase Boundary

Give song attachments a **permanent, org-scoped, permission-correct home** in Firestore and Storage —
**proven exempt from every automated cleanup sweep** — before any upload UI exists to write into it.
This is the backend/data/rules foundation. **No Files-tab UI** here (that's Phase 123); no preview/play
(Phase 124). Delivers R364, R369, R370, R371, R372.

The one visible artifact this phase MAY touch on the client is the **`Song` type** (`src/types/song.ts`)
— the additive `attachments` field — plus a small pure helper/constant module if useful. Everything else
is `storage.rules`, `firestore.rules` (if needed for the attachments field), a rules-emulator test, and a
retention-exemption test against `functions/src/cleanupSweeps.ts`.
</domain>

<decisions>
## Implementation Decisions

### Data model (R369) — additive, no migration
- Add `attachments?: SongAttachment[]` to `interface Song` (`src/types/song.ts:23–42`), optional so every
  existing song loads/saves unchanged (mirrors the additive `Service.stageLayout` pattern). Include it in
  `UpsertSongInput` handling so `songStore.updateSong(id, { attachments })` (`src/stores/songs.ts:296–302`)
  rides it through as an ordinary partial field — **no new store method** needed.
- `SongAttachment` shape (Claude's discretion on exact fields, but cover): `id`; `kind:
  'document' | 'audio' | 'link'`; `name` (display filename/label); for uploads `storagePath`
  (`orgs/{orgId}/song-files/{attachmentId}/{sanitizedName}`), `downloadUrl` (the Storage download-token
  URL, so reads need no rules round-trip), `mimeType`, `sizeBytes`; for links `linkSource`
  ('youtube'|'drive'|'dropbox'|'other') + `href`; `createdAt`, `createdBy`. Display extras (PDF page
  count, MP3 duration) are computed client-side at upload time (Phase 123) — this phase only fixes the
  schema shape so those fields have a home.

### Storage path & prefix (R369) — the retention-exemption cornerstone
- Uploaded bytes live under a **dedicated org-scoped prefix OUTSIDE `media/`**:
  `orgs/{orgId}/song-files/{attachmentId}/{sanitizeFileName(name)}` — mirrors
  `useMediaUpload.ts:70`'s pattern with a new prefix. This prefix is what makes attachments
  retention-safe (see R370).

### Storage rules (R364, R372) — the two REAL decisions this phase must resolve
1. **Type + size enforcement vs. the existing catch-all (KEY DECISION).** `storage.rules` today has a
   generic `match /orgs/{orgId}/{allPaths=**}` block (`storage.rules:69–77`) that already grants any org
   member `write` at `size < 26214400` (25 MB). Firebase Storage rule blocks are **OR-combined** (access
   granted if ANY matching block allows) — so a dedicated `song-files` block alone CANNOT prevent a
   member from writing a non-PDF/MP3 file (or a >25 MB-but-the-catch-all-denies case) because the
   catch-all may still grant it. R364 requires type + size to be **server-authoritative**. The phase must
   resolve this — the likely fix: **scope the catch-all so it does NOT match `song-files/`** (e.g. an
   `allPaths` condition excluding the prefix, or restructure), then a dedicated
   `match /orgs/{orgId}/song-files/{allPaths=**}` block enforces: read if org member; write if **editor
   tier** AND `request.resource.size < 52428800` (50 MB) AND
   `request.resource.contentType in ['application/pdf', 'audio/mpeg']`. The researcher/planner decides the
   exact rule structure; the ACCEPTANCE TRUTH is: a non-PDF/MP3 or >50 MB write to `song-files/` is
   **denied at the rules layer**, proven by emulator tests. Follow the CLAUDE.md warning: NEVER gate on a
   cross-service `firestore.exists()` (inert in the Storage emulator).
2. **Editor-only mutation (R372).** Determine how the app's `orgs:{orgId:role}` custom claim carries the
   role and whether an `isOrgEditor(orgId)`-style helper exists or must be added to `storage.rules`
   (alongside the claim-only `isOrgMemberByClaim`, `storage.rules:13–40`). Write (upload) and delete of
   `song-files/` must require **editor tier**; read requires org membership (viewers can read). A viewer
   write/delete attempt is denied at the rules layer — proven by emulator allow/deny tests covering
   member-read-allow, editor-write-allow, viewer-write-deny, oversize-deny, wrong-type-deny.

### Retention exemption (R370) — prove it, lock it
- All four cleanup sweeps live in `functions/src/cleanupSweeps.ts` and use **hard-anchored regex guards**
  (`MEDIA_PATH_GUARD` `/^orgs\/[^/]+\/media\//`, `BACKGROUND_PATH_GUARD` `/^orgs\/[^/]+\/backgrounds\//`,
  the two pptx guards). A `song-files/` path matches **none** of them, so attachments are exempt **by
  construction**. This phase LOCKS that: add a test (co-located with the cleanup tests) asserting that a
  representative `orgs/{orgId}/song-files/{id}/x.pdf` path is NOT matched by `MEDIA_PATH_GUARD`,
  `BACKGROUND_PATH_GUARD`, `RENDERED_OBJECT_GUARD`, or `PPTX_SOURCE_GUARD` — so a future edit to any guard
  that accidentally widened to include song-files would fail the test. Optionally add a one-line comment
  at each guard naming song-files as intentionally out of scope. **Do NOT add a new sweep** for song-files
  — they are permanent (owner: "Songs are a permanent part of a church's collection").

### Deletion semantics (R371)
- An attachment is removed only by (a) an explicit editor remove (built in Phase 124) or (b) the song
  being deleted. This phase's guarantee: **no service-side operation removes or orphans a song's
  attachments** — they live on the Song doc, not on any service, so deleting a service can't touch them,
  and they survive indefinitely. **Decision to make:** whether song *deletion* should cascade-delete the
  Storage objects under that song's `song-files/` (recommended, to avoid permanent orphans since nothing
  sweeps them) or leave it for a later pass — resolve during planning. The R371 acceptance truth is the
  no-service-op-orphans guarantee + indefinite survival; the song-delete cascade is the open sub-decision.

### Claude's Discretion
- Exact `SongAttachment` field names, the precise rule-block structure, and whether to add a small
  `songFiles.ts` constants module (e.g. `SONG_FILE_MAX_BYTES = 52428800`, allowed MIME list, path helper)
  are at Claude's discretion, following the `useMediaUpload.ts` / `MEDIA_MAX_BYTES` precedent.
</decisions>

<code_context>
## Existing Code Insights

### Files this phase touches
- `src/types/song.ts` — `interface Song` (`:23–42`), `UpsertSongInput` (`:48`) → add `attachments?`.
- `storage.rules` — `isOrgMemberByClaim` (`:13–40`), `isOrgMember` (`:47–49`), the `media/` dedicated
  block (`:60–67`, template for the song-files block), the generic catch-all (`:69–77`, the OR-semantics
  problem to resolve). Add the `song-files/` block + (likely) an editor-tier helper.
- `functions/src/cleanupSweeps.ts` — the four guard regexes (`MEDIA_PATH_GUARD` `:54`,
  `RENDERED_OBJECT_GUARD` `:186`, `BACKGROUND_PATH_GUARD` `:361`, `PPTX_SOURCE_GUARD` `:573`); add a
  guard-exclusion test (co-located test file, or `functions/`'s test setup).
- `src/storage.rules.test.ts` — the rules-emulator suite to extend with song-files allow/deny cases.
  NOTE (CLAUDE.md): this file has a KNOWN 2-test baseline failure (the media/background cross-service
  `firestore.exists()` blind spot) — do NOT gate song-files reads on `firestore.exists()`; the pure
  claim-based `isOrgMember` path works in the emulator and is the pattern to copy.

### Established patterns to reuse
- `MEDIA_MAX_BYTES = 52428800` (50 MB) in `useMediaUpload.ts:6` — the exact cap value song-files uses.
- `sanitizeFileName` (used at `useMediaUpload.ts:70`) — reuse for the path.
- Firestore doc path is `organizations/{orgId}/songs/{songId}`; Storage prefix is `orgs/{orgId}/...`
  (note the `organizations` vs `orgs` split — Firestore uses `organizations`, Storage uses `orgs`).

### Testing gates (CLAUDE.md)
- App suite: bare `npx vitest run` (excludes rules.test.ts + render-service). Rules suite:
  `npm run test:rules` (own emulator) OR `npx vitest run --config vitest.rules.config.ts` against a
  running emulator. Type-check gate: `npm run type-check` (vue-tsc --build). Do NOT use
  `-p tsconfig.app.json` as the gate.
</code_context>

<specifics>
## Specific Ideas

- The permanence invariant is the owner's emphatic, load-bearing requirement — treat the R370
  guard-exclusion test as a first-class deliverable, not an afterthought: it's the thing that stops a
  future sweep tweak from silently deleting chord charts.
- Reads use the denormalized Storage **download-token URL** stored on the attachment record — so viewing/
  downloading needs no per-file rules round-trip and no cross-service check (also the pattern the future
  public Rehearse mode will extend). Uploading/deleting still goes through the editor-gated rules.
</specifics>

<deferred>
## Deferred Ideas

- The Files-tab UI, the drop zone, the upload composable's UI wiring, and per-file preview/play are
  Phases 123–124, not this phase.
- Per-org storage quota + egress alerting — deferred to the Rehearse milestone (owner decision).
- A signed-URL Cloud Function read path — not needed this milestone (authenticated org members read via
  the denormalized download-token URL); it's a future public-Rehearse concern.
</deferred>
