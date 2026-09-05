# Phase 122: Durable Storage, Rules & Retention-Exempt Foundation - Research

**Researched:** 2026-09-05
**Domain:** Firebase Storage security rules (OR-combined match blocks), Firestore rules, custom-claim
role gating, Cloud Function retention-sweep path guards, Firestore doc schema (additive field).
**Confidence:** HIGH (rule-combination semantics confirmed against the codebase's own existing tests;
new-rule syntax CITED against official docs, to be proven empirically by this phase's own emulator tests).

## Summary

This phase adds zero UI and zero new packages. It resolves five concrete decisions — a `storage.rules`
restructure so a dedicated `song-files/` block can actually restrict what the existing org-wide
catch-all otherwise permits (the OR-combination problem), a new `isOrgEditor`-equivalent helper for
`storage.rules` (which today has no editor-tier concept, only membership), a locking unit test proving
the four retention-sweep regexes structurally exclude `song-files/`, the `SongAttachment` TypeScript
shape, and a recommendation for the song-deletion cascade.

The single hardest technical fact governing this phase: **Firebase Storage rule blocks are OR-combined
across every `match` block whose path pattern matches the requested object** — this project's own
`storage.rules` file already documents and tests this (the `media/` block's higher 50MB cap ADDS to
what the catch-all allows; it cannot be used to prove a MORE RESTRICTIVE block can narrow what the
catch-all already grants, because OR-combination only ever *widens*, never narrows). A dedicated
`song-files/` block that requires PDF/MP3 and ≤50MB is **insufficient by itself** — the existing
catch-all `match /orgs/{orgId}/{allPaths=**}` already grants `write` to any `<25MB` file at that same
path, PDF/MP3 or not. The catch-all's own `allow write`/`allow read` conditions must be amended to
exclude `song-files/` paths, using `resource.name`/`request.resource.name` (a string, confirmed to
support `.matches(regex)`) — not path-segment indexing into the `{allPaths=**}` capture, whose type
(`path`) is not documented to support indexing.

The second load-bearing fact: `functions/src/cleanupSweeps.ts`'s four guards are **hard-anchored
regexes requiring a specific second path segment** (`media`, `backgrounds`, or `pptx-imports`) — a
`song-files/` path structurally cannot match any of them, verified directly against the regex source.
No sweep code changes are needed; only a locking test that pins this fact against future edits.

The third notable finding, which the planner must account for: **`firestore.rules`' `songs/{songId}`
match is `allow read, write: if isOrgEditor(orgId)` — viewers cannot read a Song document at all today**,
and the `/songs` client route (`src/router/index.ts:40`) carries `meta: { requiresEditor: true }`. R372's
"viewers can see the Files tab... read-only" is therefore **currently unreachable in the live app** —
this phase's `storage.rules` song-files/ READ grant should still be `isOrgMember` (not `isOrgEditor`,
per CONTEXT.md's explicit decision and for forward-compatibility with a future Rehearse-mode read path),
but doing so does NOT unlock anything a viewer can reach this milestone, because the Song document itself
(and hence any attachment's `downloadUrl`) is unreachable to a viewer through Firestore/the router. See
Open Questions.

**Primary recommendation:** amend the existing `storage.rules` catch-all to exclude `song-files/`
paths via `!request.resource.name.matches('^orgs/[^/]+/song-files/.*')` (write) and
`!resource.name.matches('^orgs/[^/]+/song-files/.*')` (read), add a dedicated `song-files/` block with
explicit `create`/`update`/`delete` verbs (not bundled `write`) gated by a new `isOrgEditor`-equivalent
Storage claim helper, add the `SongAttachment` type additively to `Song`, and lock the retention
exemption with a same-pattern unit test in `functions/src/index.test.ts` (where the other three guards'
tests already live, despite the source having moved to `cleanupSweeps.ts` in Phase 120).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Attachment type/size enforcement (R364) | Database/Storage (storage.rules) | Browser/Client (future Phase 123 pre-check) | Server-authoritative gate must live in storage.rules; client-side check is UX-only and cannot be trusted |
| Attachment record persistence (R369) | Database/Storage (Firestore `Song` doc) | — | Additive field on an existing editor-owned document; no new collection |
| Editor-only mutation (R372) | Database/Storage (storage.rules + firestore.rules) | Browser/Client (future Phase 123/124 UI gating) | Rules are the enforcement boundary; UI hiding is defense-in-depth only |
| Retention-sweep exemption (R370) | API/Backend (Cloud Functions `cleanupSweeps.ts`) | — | Guards are pure regex logic in the scheduled functions; no rules-layer involvement |
| Deletion-cascade on song delete (R371) | Browser/Client (`songs.ts` store, editor session) | Database/Storage (rules must permit the delete) | No Cloud Function exists for this; a client-initiated best-effort delete is consistent with the app's `hardDeleteSong` pattern |

## User Constraints

<user_constraints>
### Locked Decisions (from 122-CONTEXT.md)

- **Data model (R369):** Add `attachments?: SongAttachment[]` to `interface Song`
  (`src/types/song.ts:23-42`), optional/additive, no migration. Ride through `UpsertSongInput` so
  `songStore.updateSong(id, { attachments })` works as an ordinary partial field — no new store method.
- **Storage path (R369):** `orgs/{orgId}/song-files/{attachmentId}/{sanitizeFileName(name)}` — mirrors
  `useMediaUpload.ts:70`'s pattern with a new prefix, deliberately OUTSIDE `media/`.
- **Storage rules type+size (R364, KEY DECISION):** Resolve the OR-combined-catch-all problem so a
  non-PDF/MP3 or >50MB write to `song-files/` is DENIED at the rules layer, proven by emulator tests.
  Never gate on cross-service `firestore.exists()` (inert in the Storage emulator).
- **Editor-only mutation (R372):** Determine/add an `isOrgEditor`-style helper to `storage.rules`.
  Write/delete of `song-files/` requires editor tier; read requires org membership.
- **Retention exemption (R370):** Add a locking test asserting a representative
  `orgs/{orgId}/song-files/{id}/x.pdf` path is NOT matched by any of the four guards. Do NOT add a new
  sweep for song-files — they are permanent.
- **Deletion semantics (R371):** No service-side operation may remove/orphan attachments. Whether song
  *deletion* cascades to delete the Storage objects is an open sub-decision to resolve during planning.

### Claude's Discretion

- Exact `SongAttachment` field names, the precise rule-block structure, and whether to add a small
  `songFiles.ts` constants module (e.g. `SONG_FILE_MAX_BYTES = 52428800`, allowed MIME list, path
  helper), following the `useMediaUpload.ts` / `MEDIA_MAX_BYTES` precedent.

### Deferred Ideas (OUT OF SCOPE)

- The Files-tab UI, drop zone, upload composable's UI wiring, per-file preview/play — Phases 123-124.
- Per-org storage quota + egress alerting — deferred to the Rehearse milestone.
- A signed-URL Cloud Function read path — not needed this milestone; deferred to public Rehearse mode.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| R364 | Uploads restricted to PDF/MP3, ≤50MB, enforced client AND in storage.rules | Must-Resolve #1: catch-all exclusion + dedicated `song-files/` block with explicit type/size conjuncts |
| R369 | Attachments on Song doc (additive), Storage prefix outside media/ | Must-Resolve #4: `SongAttachment` shape; confirmed no firestore.rules change needed (whole-doc editor write already covers the new field) |
| R370 | Exempt from every retention sweep | Must-Resolve #3: all four guard regexes verified structurally excluded; locking test recommended |
| R371 | Deletion only via editor removal or song deletion; no service op orphans them | Must-Resolve #5: `hardDeleteSong` is the correct cascade point (not the soft-delete `deleteSong`); client-side best-effort delete recommended |
| R372 | Editor-only mutation, viewer read-only, at the rules layer | Must-Resolve #2: new `isOrgEditor` Storage claim helper; noted viewer-read is currently unreachable via firestore.rules/router (see Open Questions) |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- Use `npm run type-check` (vue-tsc --build) as the type-check gate — NOT `-p tsconfig.app.json` (that
  form silently skips test files).
- App suite: bare `npx vitest run` (excludes `src/rules.test.ts` and `render-service/**` per
  `vite.config.ts`). Do NOT use `--dir src` (bypasses the exclude and pulls in `rules.test.ts`).
- Rules suite: `npm run test:rules` (starts its own emulator; fails with "port taken" if one is already
  running) OR `npx vitest run --config vitest.rules.config.ts` against an already-running emulator.
- NEVER gate `storage.rules` on a cross-service `firestore.exists()` — proven inert in the Storage
  emulator (firebase-js-sdk#6803) and the documented root cause of a real production incident
  (2026-08-06). `storage.rules` membership/role checks must be **claim-only**.
- Known baseline: `src/storage.rules.test.ts` currently passes in full (the historical 2-test baseline
  failure was in `storage.rules.test.ts` for an unrelated Storage-emulator media/background
  cross-service gap, already fixed/documented — do not treat any NEW failure introduced by this phase's
  changes as that known issue).
- `.env.local` must be present in the working tree for the emulator/tests/build to run (symlink or copy
  from the main checkout).

## Standard Stack

No new libraries are introduced by this phase. It touches only:

| File | Purpose |
|------|---------|
| `storage.rules` | Add `isOrgEditor` Storage claim helper + `song-files/` dedicated block + catch-all exclusion |
| `firestore.rules` | No change required (see Must-Resolve #4) |
| `src/types/song.ts` | Add `SongAttachment` interface + `Song.attachments?` field |
| `src/stores/songs.ts` | Optionally: cascade-delete `song-files/` objects in `hardDeleteSong` |
| `src/storage.rules.test.ts` | New `describe('storage.rules — song-files path')` block |
| `functions/src/index.test.ts` | New locking test proving the four guards exclude `song-files/` |

**Version verification:** N/A — no package.json changes. `rules_version = '2'` (already declared at the
top of `storage.rules`) is the current syntax version and unchanged.

## Package Legitimacy Audit

Not applicable — this phase installs no external packages.

## Architecture Patterns

### System Architecture Diagram

```
                     ┌─────────────────────────────┐
                     │  Song document (Firestore)   │
                     │  organizations/{orgId}/songs │
                     │  /{songId}                   │
                     │                               │
                     │  attachments?: SongAttachment[]│◄──── editor write (isOrgEditor)
                     │   { id, kind, name,           │       via existing whole-doc rule
                     │     storagePath, downloadUrl,  │       (firestore.rules:304) —
                     │     mimeType, sizeBytes,       │       NO rules change needed
                     │     linkSource?, href?,        │
                     │     createdAt, createdBy }     │
                     └───────────────┬───────────────┘
                                     │ denormalized downloadUrl
                                     │ (token URL — reads bypass
                                     │  rules entirely, matches
                                     │  the existing backgrounds
                                     │  pattern in cleanupSweeps.ts)
                                     ▼
                     ┌─────────────────────────────┐
                     │  Cloud Storage bytes          │
                     │  orgs/{orgId}/song-files/      │
                     │   {attachmentId}/{fileName}    │
                     │                               │
                     │  storage.rules:                │
                     │   read:   isOrgMember(orgId)   │◄── viewer OR editor read
                     │   create: isOrgEditor(orgId)   │◄── editor-only write
                     │           && size<50MB         │
                     │           && type in [pdf,mp3] │
                     │   update: false                │◄── immutable once created
                     │   delete: isOrgEditor(orgId)   │◄── editor-only delete
                     └───────────────┬───────────────┘
                                     │
                                     │ EXCLUDED BY CONSTRUCTION
                                     │ (regex path-guard mismatch,
                                     │  no runtime check needed)
                                     ▼
                     ┌─────────────────────────────┐
                     │ functions/src/cleanupSweeps.ts│
                     │  4 scheduled sweeps, each      │
                     │  gated by a hard-anchored       │
                     │  regex requiring a DIFFERENT    │
                     │  2nd path segment               │
                     │  (media/, backgrounds/,         │
                     │   pptx-imports/.../rendered/,   │
                     │   pptx-imports/.../source.pptx) │
                     │  → song-files/ never matches    │
                     └─────────────────────────────┘

songs.ts hardDeleteSong (editor session, client):
  Song doc deleted (existing) ──► for each attachment.storagePath,
                                   deleteObject() against song-files/
                                   (NEW, best-effort, storage.rules-
                                   permitted via the new isOrgEditor
                                   delete grant above)
```

### Recommended `storage.rules` structure

```
match /b/{bucket}/o {
  function isOrgDeactivatedForCaller(orgId) { ... }         // unchanged
  function isOrgMemberByClaim(orgId) { ... }                // unchanged

  // NEW — mirrors isOrgMemberByClaim's structure exactly, but requires the
  // resolved role to be editor/admin rather than merely non-null. 'admin' is
  // intentionally synonymous with 'editor' (matches firestore.rules'
  // isOrgEditor, R348/SEC-ISO-05).
  function isOrgEditorByClaim(orgId) {
    return request.auth != null
      && (
        request.auth.token.superAdmin == true
        ||
        (
          (
            (request.auth.token.orgs != null
              && request.auth.token.orgs[orgId] != null
              && request.auth.token.orgs[orgId] in ['editor', 'admin'])
            || (request.auth.token.orgId == orgId
              && request.auth.token.role in ['editor', 'admin'])
          )
          && !isOrgDeactivatedForCaller(orgId)
        )
      );
  }

  function isOrgMember(orgId) { return isOrgMemberByClaim(orgId); }   // unchanged
  function isOrgEditor(orgId) { return isOrgEditorByClaim(orgId); }   // NEW

  match /orgs/{orgId}/media/{allPaths=**} { ... }            // unchanged

  // NEW — dedicated block, evaluated independently of (OR-combined with) the
  // catch-all below. Explicit create/update/delete verbs, NOT bundled `write`
  // — `write` would bundle delete, and request.resource is null on delete
  // (referencing request.resource.size/.name on a delete errors -> denies
  // that clause), so delete needs its own unconditioned grant.
  match /orgs/{orgId}/song-files/{allPaths=**} {
    allow read: if isOrgMember(orgId);

    allow create: if isOrgEditor(orgId)
                     && request.resource.size < 52428800
                     && request.resource.contentType in ['application/pdf', 'audio/mpeg'];

    // Attachments are immutable once uploaded (a new attachmentId/path is
    // used for every re-upload, per the CONTEXT.md path scheme) — denying
    // update closes an in-place-overwrite bypass of the create-time type
    // check.
    allow update: if false;

    allow delete: if isOrgEditor(orgId);
  }

  // EXISTING catch-all, AMENDED to exclude song-files/ so this block's
  // permissive <25MB/any-type grant cannot OR-override the restrictive
  // song-files/ block above for the same object path.
  match /orgs/{orgId}/{allPaths=**} {
    allow read: if isOrgMember(orgId)
                   && !resource.name.matches('^orgs/[^/]+/song-files/.*');

    allow write: if isOrgMember(orgId)
                    && request.resource.size < 26214400
                    && !request.resource.name.matches('^orgs/[^/]+/song-files/.*');
  }
}
```

**Why the exclusion is necessary (not optional):** Firebase Storage evaluates every `match` block whose
path pattern matches the requested object and grants access if **any** matching block's condition is
true (OR across blocks) — this project's own `storage.rules` file already documents this exact
semantic at `storage.rules:51-54` ("Cloud Storage rules do NOT cascade between sibling `match`
blocks... evaluated independently... proven by the media rules tests, not merely assumed") and its own
test suite proves the *widening* direction (the `media/` block's 50MB cap grants access the catch-all's
25MB cap alone would deny, `src/storage.rules.test.ts:348-354`). The inverse is equally true and
unavoidable: a MORE RESTRICTIVE dedicated block **cannot narrow** what a co-matching, more permissive
catch-all already grants. Without the exclusion, a 10MB `.exe` written to
`orgs/orgA/song-files/x/malware.exe` would be **allowed** by the catch-all
(`isOrgMember && size<25MB`) even though the dedicated `song-files/` block's `create` condition denies
it — OR-combination means the catch-all's grant alone is sufficient. `[CITED: firebase.google.com/docs/rules/rules-behavior, firebase.google.com/docs/storage/security/core-syntax]`

**Why `resource.name`/`request.resource.name` string-regex, not `allPaths` indexing:** Firebase's own
rules-language reference documents the recursive-wildcard capture (`{allPaths=**}`) as a `path`-typed
value, with no documented indexing (`allPaths[0]`) example or method. `resource.name` /
`request.resource.name`, by contrast, are documented as plain strings supporting `.matches(regex)` (the
same construct already used in this file's planned `contentType in [...]` check, and in Firebase's own
official example `request.resource.contentType.matches('image/.*')`). Using string-regex on the full
object path is the CITED, doc-supported approach; treat the exact rule as a hypothesis this phase's own
emulator tests must prove (see Validation Architecture) rather than as verified fact.
`[CITED: firebase.google.com/docs/rules/rules-language]`

### Why delete needs its own verb (not bundled into `write`)

Confirmed empirically from the codebase: no `deleteObject()` call exists anywhere in `src/` outside
tests (`grep` returned only `src/components/__tests__/PptxImportModal.test.ts`). Every existing Storage
delete in this app happens server-side via the Admin SDK (Cloud Functions cleanup sweeps), which
bypasses `storage.rules` entirely. This means the existing catch-all's `allow write` has **never**
actually supported a client-initiated delete — on a delete request `request.resource` is `null`, so
`request.resource.size` (already present in the existing catch-all) throws, which Firebase rules treat
as a hard deny for that clause. `song-files/` is the **first path in this app to need a genuine
client-initiated Storage delete** (for the R371 cascade recommendation below), which is exactly why the
recommended block above declares `allow delete` as its own explicit verb rather than folding it into
`create`/`update`. `[VERIFIED: codebase grep]`

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Resumable/progress-tracked upload | A custom XHR/fetch upload loop | `uploadBytesResumable` (already used by `useMediaUpload.ts`) | Firebase SDK already handles chunking, retry, and `state_changed` progress events; Phase 123 will mirror this exactly |
| Filename sanitization | A new regex | Reuse/extract `sanitizeFileName` from `useMediaUpload.ts:31-33` | Already solved, already tested implicitly by production traffic on `media/` uploads |
| Path-based type/size enforcement | Client-only validation | `storage.rules` server-authoritative conjuncts (R364) | Client validation is always bypassable; this is the exact gap R364 closes |

**Key insight:** every piece of this phase is a rules/schema extension of an already-proven pattern
(`useMediaUpload.ts`'s upload shape, `cleanupSweeps.ts`'s guard-regex shape, `storage.rules`'s
claim-based membership shape) — there is no genuinely novel mechanism here except the catch-all
exclusion, which is exactly why it is the single "must-resolve" decision this research focuses on.

## Common Pitfalls

### Pitfall 1: Adding a restrictive `song-files/` block WITHOUT excluding it from the catch-all
**What goes wrong:** The dedicated block's type/size checks appear correct in isolation and pass a
manually-run "PDF under 50MB succeeds" test, masking that a "non-PDF under 25MB" attacker case still
silently succeeds via the untouched catch-all.
**Why it happens:** Storage rule blocks are OR-combined; a restrictive sibling block cannot veto a
permissive one for the same path. This is non-obvious and contradicts the mental model of "more
specific rule wins" that Firestore/most ACL systems train developers to expect.
**How to avoid:** The catch-all MUST be amended (per the recommended rule text above) as part of the
SAME change, not as a follow-up. The rules-emulator test suite MUST include an explicit "denies a
non-PDF file under the 25MB catch-all cap" case — this is the test that would have caught the gap.
**Warning signs:** A "wrong-type-deny" test that only uploads an oversized non-PDF file (which the
catch-all's own size cap would deny anyway, masking the missing type check) rather than a SMALL
non-PDF file.

### Pitfall 2: Gating `song-files/` reads on `firestore.exists()` for org membership
**What goes wrong:** The rule appears correct in code review but denies every reader in the Storage
emulator (and worked once in production only via the accidental IAM grant CLAUDE.md documents for a
DIFFERENT rule, `storage.rules`), because `firestore.exists()` is inert in the Storage emulator
(firebase-js-sdk#6803) — this is the exact incident CLAUDE.md documents in detail for `storage.rules`
(2026-08-06, `storage.rules.test.ts`'s Storage-emulator caveat).
**Why it happens:** It looks like the "obviously correct" way to check org membership from Storage
rules, especially since `firestore.rules`' own `isOrgEditor`/`isOrgMember` DO use `exists()`/`get()`
(because those run inside Cloud Firestore's OWN rules engine, where cross-collection reads work fine).
**How to avoid:** `storage.rules` membership/role checks MUST be claim-only, reusing
`isOrgMemberByClaim`'s exact pattern (as the recommended `isOrgEditorByClaim` above does) — never call
`firestore.exists()`/`firestore.get()` from `storage.rules`.
**Warning signs:** Any `firestore.` prefix appearing inside `storage.rules`.

### Pitfall 3: Cascading song-attachment delete on the SOFT delete (`deleteSong`), not the hard delete
**What goes wrong:** A song is soft-deleted (`hidden: true`) as part of normal workflow (e.g. accidental
click, later restored via `restoreSong`) and its attached PDFs/MP3s are permanently destroyed before the
user even confirms they meant to remove the song forever.
**Why it happens:** `deleteSong` (line 304) and `hardDeleteSong` (line 321) are both named plausibly for
"the delete path," but only `hardDeleteSong` — gated on `song.hidden === true` already, i.e. only
reachable from an already-soft-deleted song — is the actual permanent-removal operation.
**How to avoid:** Any Storage cascade-delete belongs in `hardDeleteSong`, never in `deleteSong`.
**Warning signs:** A test asserting attachments survive a `deleteSong` call but disappear after
`hardDeleteSong`.

### Pitfall 4: Assuming R372's viewer-read requirement is exercised by the live app this phase
**What goes wrong:** Effort spent trying to make a viewer session actually SEE a song's Files tab in
this phase's verification, when the `/songs` route (`meta: { requiresEditor: true }`) and
`firestore.rules`' `songs/{songId}` match (`allow read, write: if isOrgEditor(orgId)`) both already deny
viewers the underlying Song document entirely — independent of anything this phase changes.
**Why it happens:** The 121-UI-SPEC.md's Access Control section describes viewer read-only behavior in
detail, which reads as though it is reachable today.
**How to avoid:** Treat the `storage.rules` `isOrgMember` read grant on `song-files/` as forward-looking
correctness (matches the CONTEXT.md decision, harmless, consistent with `media/`'s existing
`isOrgMember`-gated read) rather than as something this phase's verification needs to prove reachable
end-to-end through the UI. See Open Questions.
**Warning signs:** A verification step that tries to log in as a viewer and navigate to `/songs`.

## Code Examples

### `src/types/song.ts` — recommended `SongAttachment` shape (R369, Must-Resolve #4)

```typescript
// Source: 122-CONTEXT.md's locked field list, aligned with 121-UI-SPEC.md's row-anatomy
// metadata needs (type · pages-or-duration · size · date) and link-row needs (source, href).
export type SongAttachmentKind = 'document' | 'audio' | 'link'
export type SongAttachmentLinkSource = 'youtube' | 'drive' | 'dropbox' | 'other'

export interface SongAttachment {
  id: string
  kind: SongAttachmentKind
  /** Display filename (uploads) or user-entered label (links). */
  name: string
  /** Storage object path, uploads only: orgs/{orgId}/song-files/{id}/{sanitizedName}. */
  storagePath?: string
  /** Denormalized Storage download-token URL — reads never need a rules round-trip. */
  downloadUrl?: string
  mimeType?: string
  sizeBytes?: number
  /** Links only. */
  linkSource?: SongAttachmentLinkSource
  href?: string
  createdAt: Timestamp
  createdBy: string
}

export interface Song {
  id: string
  // ...existing fields unchanged...
  /** R369: additive, optional — every existing song loads/saves unchanged. */
  attachments?: SongAttachment[]
}
```

`UpsertSongInput` (`Omit<Song, 'id' | 'createdAt' | 'updatedAt'>`) needs no change — the `Omit` already
carries `attachments?` through automatically since it is a plain field on `Song`.

### `src/storage.rules.test.ts` — recommended new test block (R364, R372)

```typescript
// Source: mirrors this file's existing 'storage.rules — media path' describe block exactly
// (same claim-arm-only convention, same SMALL_BYTES/OVER_CAP_BYTES constant pattern).
const SONG_FILE_UNDER_CAP_BYTES = new Uint8Array(40 * 1024 * 1024) // 40MB, under the 50MB song-file cap
const SONG_FILE_OVER_CAP_BYTES = new Uint8Array(52428801) // one byte over 50MB

describe('storage.rules — song-files path (R364, R372, Phase 122)', () => {
  it('allows an editor to upload a PDF under the 50MB cap', async () => {
    const context = testEnv.authenticatedContext('userA', { orgId: 'orgA', role: 'editor' })
    const storage = context.storage()
    const fileRef = ref(storage, 'orgs/orgA/song-files/f1/chart.pdf')
    await assertSucceeds(
      uploadBytes(fileRef, SONG_FILE_UNDER_CAP_BYTES, { contentType: 'application/pdf' }),
    )
  })

  it('allows a viewer to READ a song-files object (R372: read is member-gated, not editor-gated)', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await uploadBytes(
        ref(ctx.storage(), 'orgs/orgA/song-files/f2/chart.pdf'),
        SMALL_BYTES,
        { contentType: 'application/pdf' },
      )
    })
    const context = testEnv.authenticatedContext('userB', { orgId: 'orgA', role: 'viewer' })
    await assertSucceeds(getBytes(ref(context.storage(), 'orgs/orgA/song-files/f2/chart.pdf')))
  })

  it('DENIES a viewer from uploading (R372: write is editor-gated)', async () => {
    const context = testEnv.authenticatedContext('userC', { orgId: 'orgA', role: 'viewer' })
    await assertFails(
      uploadBytes(
        ref(context.storage(), 'orgs/orgA/song-files/f3/chart.pdf'),
        SMALL_BYTES,
        { contentType: 'application/pdf' },
      ),
    )
  })

  it('DENIES an oversize upload even from an editor', async () => {
    const context = testEnv.authenticatedContext('userA', { orgId: 'orgA', role: 'editor' })
    await assertFails(
      uploadBytes(
        ref(context.storage(), 'orgs/orgA/song-files/f4/chart.pdf'),
        SONG_FILE_OVER_CAP_BYTES,
        { contentType: 'application/pdf' },
      ),
    )
  })

  // THE pitfall-1 regression test: a SMALL wrong-type file, well under even the
  // catch-all's 25MB cap, so the ONLY thing that can deny it is the type check —
  // proves the catch-all exclusion actually works, not merely the size cap.
  it('DENIES a small non-PDF/MP3 upload from an editor (proves catch-all cannot OR-override the type gate)', async () => {
    const context = testEnv.authenticatedContext('userA', { orgId: 'orgA', role: 'editor' })
    await assertFails(
      uploadBytes(
        ref(context.storage(), 'orgs/orgA/song-files/f5/malware.exe'),
        SMALL_BYTES,
        { contentType: 'application/x-msdownload' },
      ),
    )
  })

  it('allows an editor to delete a song-files object', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await uploadBytes(
        ref(ctx.storage(), 'orgs/orgA/song-files/f6/chart.pdf'),
        SMALL_BYTES,
        { contentType: 'application/pdf' },
      )
    })
    const context = testEnv.authenticatedContext('userA', { orgId: 'orgA', role: 'editor' })
    await assertSucceeds(deleteObject(ref(context.storage(), 'orgs/orgA/song-files/f6/chart.pdf')))
  })

  it('DENIES a viewer from deleting a song-files object', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await uploadBytes(
        ref(ctx.storage(), 'orgs/orgA/song-files/f7/chart.pdf'),
        SMALL_BYTES,
        { contentType: 'application/pdf' },
      )
    })
    const context = testEnv.authenticatedContext('userB', { orgId: 'orgA', role: 'viewer' })
    await assertFails(deleteObject(ref(context.storage(), 'orgs/orgA/song-files/f7/chart.pdf')))
  })
})
```

Note: `deleteObject` must be added to this file's existing `import { ref, uploadBytes, getBytes } from
'firebase/storage'` line.

### `functions/src/index.test.ts` — retention-exemption locking test (R370, Must-Resolve #3)

```typescript
// Source: mirrors the file's existing MEDIA_PATH_GUARD/BACKGROUND_PATH_GUARD/PPTX_SOURCE_GUARD
// describe blocks exactly (lines ~218, ~1053, ~1393, ~1421). Add SONG_FILES_PATH_GUARD_PROBE
// alongside the other guard imports at the top of the file if a real exported constant does not
// exist — this phase does NOT add a new guard/sweep (song-files are permanent by owner mandate),
// so this test asserts against a representative literal path, not against a new regex export.
describe('Song-files retention exemption (R370, Phase 122)', () => {
  const SONG_FILE_PATH = 'orgs/orgA/song-files/attach1/chart.pdf'

  it('is NOT matched by MEDIA_PATH_GUARD', () => {
    expect(MEDIA_PATH_GUARD.test(SONG_FILE_PATH)).toBe(false)
  })

  it('is NOT matched by RENDERED_OBJECT_GUARD', () => {
    expect(RENDERED_OBJECT_GUARD.test(SONG_FILE_PATH)).toBe(false)
  })

  it('is NOT matched by BACKGROUND_PATH_GUARD', () => {
    expect(BACKGROUND_PATH_GUARD.test(SONG_FILE_PATH)).toBe(false)
  })

  it('is NOT matched by PPTX_SOURCE_GUARD', () => {
    expect(PPTX_SOURCE_GUARD.test(SONG_FILE_PATH)).toBe(false)
  })
})
```

Verified directly against the guard source (`functions/src/cleanupSweeps.ts`):

| Guard | Regex | Requires 2nd segment | Matches `song-files/`? |
|-------|-------|----------------------|-------------------------|
| `MEDIA_PATH_GUARD` (`:54`) | `/^orgs\/[^/]+\/media\//` | `media` | No |
| `RENDERED_OBJECT_GUARD` (`:186`) | `/^orgs\/[^/]+\/pptx-imports\/[^/]+\/rendered\//` | `pptx-imports` | No |
| `BACKGROUND_PATH_GUARD` (`:361`) | `/^orgs\/[^/]+\/backgrounds\//` | `backgrounds` | No |
| `PPTX_SOURCE_GUARD` (`:573`) | `/^orgs\/[^/]+\/pptx-imports\/[^/]+\/(source\.pptx$\|images\/)/` | `pptx-imports` | No |

`[VERIFIED: codebase source read, functions/src/cleanupSweeps.ts]`

### `src/stores/songs.ts` — recommended cascade delete (R371, Must-Resolve #5)

```typescript
// Add to imports: import { ref as storageRef, deleteObject } from 'firebase/storage'
//                 import { storage } from '@/firebase'

async function hardDeleteSong(id: string) {
  if (!orgId.value) return
  const song = songs.value.find((s) => s.id === id)
  if (!song || song.hidden !== true) return

  // NEW (R371): best-effort delete of this song's Storage attachments BEFORE
  // the Firestore doc goes away, mirroring cleanupSweeps.ts's own
  // partial-failure-tolerant convention (one bad delete never aborts the
  // operation — a leftover orphaned object is an acceptable residual; a
  // blocked song-delete is not).
  for (const attachment of song.attachments ?? []) {
    if (!attachment.storagePath) continue // link-kind attachments have no Storage object
    try {
      await deleteObject(storageRef(storage, attachment.storagePath))
    } catch (err) {
      console.error(`hardDeleteSong: failed to delete attachment ${attachment.storagePath}:`, err)
    }
  }

  const songRef = doc(db, 'organizations', orgId.value, 'songs', id)
  // ...existing lyrics-subcollection + doc delete unchanged...
}
```

This requires the `storage.rules` `allow delete: if isOrgEditor(orgId)` grant recommended above — the
CALLER of `hardDeleteSong` is always an already-editor-gated session (the entire `/songs` route requires
`requiresEditor: true`), so this delete will always be rules-permitted when reached through the app.

## Runtime State Inventory

Not applicable — this phase adds a new field/prefix; it does not rename or migrate any existing string,
key, or path. Skipped per the trigger condition (rename/refactor/migration phases only).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `resource.name` / `request.resource.name` support `.matches(regex)` for path exclusion, and this is the correct/idiomatic way to exclude a subpath from a Storage catch-all (vs. indexing the `{allPaths=**}` capture) | Architecture Patterns § Recommended `storage.rules` structure | If wrong, the catch-all exclusion silently fails to compile or fails to exclude, and R364's type/size gate remains bypassable via the catch-all — MUST be caught by the Pitfall-1 regression test (small wrong-type upload) before merge, regardless of this assumption's correctness |
| A2 | Browsers/File objects report MP3 files with MIME type exactly `audio/mpeg` (not `audio/mp3` or another variant) | Architecture Patterns (dedicated block's `contentType in [...]` list) | If some browsers/OSes report a different MIME string, valid MP3 uploads could be wrongly denied; Phase 123's client-side validation + a live-file emulator test with a real `.mp3` File object should surface this before it reaches production |
| A3 | `getDownloadURL()` tokens genuinely bypass `storage.rules` on subsequent reads (not merely "read is member-gated so it doesn't matter") | Summary, System Architecture Diagram | This is the SAME assumption the existing `backgrounds` feature already relies on (per `cleanupSweeps.ts`'s `extractBackgroundObjectPath`), so if wrong, it is a pre-existing app-wide issue, not new to this phase — low risk of being song-files-specific |

## Open Questions

1. **Should Phase 122 (or a later phase) loosen `firestore.rules`' `songs/{songId}` read gate for
   viewers, given R372 explicitly requires "viewers can see the Files tab... read-only"?**
   - What we know: today `firestore.rules:304` is `allow read, write: if isOrgEditor(orgId)` (no
     viewer read at all), and `src/router/index.ts:40` gates `/songs` to `requiresEditor: true`. Both
     predate this milestone and are unrelated to attachments specifically — Songs as a whole is
     currently an editor-only feature area.
   - What's unclear: whether R372's viewer-read language is (a) forward-looking spec for a future
     Rehearse-mode read path that will use a DIFFERENT data path entirely (e.g., reading attachments
     via a service-scoped document rather than the Song doc directly), making this phase's
     `isOrgMember`-gated Storage read correct-but-currently-unreachable by design, or (b) an implicit
     expectation that Phase 122/123/124 should also open Songs read to viewers this milestone.
   - Recommendation: Given `999.13`/SEED-003's explicit scope note ("This is step 1... builds only the
     editor-facing attach/manage surface. The Rehearse experience... is a separate, later milestone"),
     treat (a) as correct and make NO firestore.rules/router change in this phase — the `storage.rules`
     `isOrgMember` read grant is still the right forward-compatible choice (harmless, matches the
     `media/` convention, and avoids a rules rewrite later), but the planner should NOT expect any
     viewer-facing verification step to be reachable this phase. Flag this explicitly to the owner if
     surfaced during UAT.

2. **Should the `song-files/` object's `customMetadata` carry `createdAt`/`attachmentId`, mirroring
   `useMediaUpload.ts:73`'s `customMetadata: { createdAt: ... }`?**
   - What we know: `useMediaUpload.ts` stamps upload time into Storage object metadata (separate from
     Firestore's own `createdAt`).
   - What's unclear: whether this phase (schema-only) needs to specify that convention, or whether it's
     purely a Phase 123 upload-composable concern.
   - Recommendation: Defer to Phase 123 — this phase's `SongAttachment.createdAt` (Firestore-side) is
     the field of record; Storage `customMetadata` is a redundant convenience with no rules implication.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Firestore emulator (127.0.0.1:8080) | `src/storage.rules.test.ts` (cross-service Firestore rules load for the file's OWN unrelated tests) | Not probed this session | — | Run `npm run test:rules` which starts its own emulator |
| Storage emulator (127.0.0.1:9199) | New `song-files/` rules-emulator tests | Not probed this session | — | Same — `npm run test:rules`, or `vitest.rules.config.ts` against an already-running emulator |

**Missing dependencies with no fallback:** none — both emulators are started on-demand by the existing
`npm run test:rules` script; no new external dependency is introduced.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.x (root), `@firebase/rules-unit-testing` for the rules suite |
| Config file | `vitest.rules.config.ts` (rules suite, sequential, 30s timeout); root `vite.config.ts` (app suite) |
| Quick run command | `npx vitest run --config vitest.rules.config.ts -t "song-files"` (once written, scoped) |
| Full suite command | `npm run test:rules` (rules) + `npx vitest run` (app, includes `functions/src/index.test.ts` guard tests — note: functions has its own `package.json`/test runner, verify whether `functions/` tests run via the root `npx vitest run` or require `cd functions && npm test`) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| R364 | Editor upload of PDF/MP3 ≤50MB succeeds | rules-emulator | `npx vitest run --config vitest.rules.config.ts` | ✅ extend `src/storage.rules.test.ts` |
| R364 | Small non-PDF/MP3 upload denied (catch-all cannot override) | rules-emulator | same | ✅ extend `src/storage.rules.test.ts` |
| R364 | >50MB PDF upload denied | rules-emulator | same | ✅ extend `src/storage.rules.test.ts` |
| R372 | Viewer read allowed, viewer write/delete denied | rules-emulator | same | ✅ extend `src/storage.rules.test.ts` |
| R370 | `song-files/` path excluded from all 4 sweep guards | unit | `npx vitest run` (functions test runner — confirm invocation, see Wave 0 gap below) | ❌ Wave 0 — new describe block in `functions/src/index.test.ts` |
| R369 | `Song.attachments?` additive field type-checks and round-trips through `updateSong` | type-check + existing store tests | `npm run type-check` | ✅ no new test file — existing `songs.ts`/`Song` test coverage should already exercise partial `updateDoc` calls generically |
| R371 | `hardDeleteSong` best-effort-deletes each attachment's Storage object | unit (mocked Storage) | `npx vitest run -t hardDeleteSong` | ❌ Wave 0 — extend the existing `songs.ts` store test file's `hardDeleteSong` coverage (if any exists; verify during planning) |

### Sampling Rate
- **Per task commit:** the scoped rules-emulator run (`-t "song-files"`) and `npm run type-check`.
- **Per wave merge:** full `npm run test:rules` + `npx vitest run` (app) + functions test runner.
- **Phase gate:** both suites green before `/gsd-verify-work`.

### Wave 0 Gaps
- [ ] Confirm how `functions/` tests are actually invoked (root `npx vitest run` vs. `cd functions &&
  npm test`) — the existing 4 guard `describe` blocks live in `functions/src/index.test.ts`, imported
  from `./cleanupSweeps`, so the new locking test belongs in the same file; verify the exact run command
  during planning rather than assuming.
- [ ] Locate (or confirm absence of) existing `hardDeleteSong` test coverage in the songs store test
  file before writing the R371 cascade test, to avoid duplicating an existing mock-Storage setup.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V4 Access Control | yes | Claim-based role check (`isOrgEditor`/`isOrgMember`) in `storage.rules`, mirroring the existing `isOrgMemberByClaim` pattern — no new mechanism, extends the proven one |
| V5 Input Validation | yes | Server-authoritative `contentType`/`size` conjuncts in `storage.rules` (R364) — the exact gap this phase closes; client-side validation (Phase 123) is UX-only, never trusted |
| V1 Architecture | yes | The OR-combination catch-all fix IS an architectural/rules-design decision, not a coding pattern — documented above as the phase's central finding |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Type/size bypass via a permissive sibling `match` block (this phase's central finding) | Elevation of Privilege | Exclude the restricted subpath from the catch-all's own grant via `resource.name.matches()`, proven by an explicit small-wrong-type-file regression test (not merely an oversize test, which the catch-all's own cap would also catch) |
| Cross-service `firestore.exists()` in `storage.rules` (documented prior incident) | Denial of Service (deny-everyone) | Claim-only checks throughout `storage.rules`, per CLAUDE.md's explicit, hard-won warning |
| Malicious `contentType` header lying about file content (e.g. an executable served with `contentType: application/pdf`) | Tampering | Out of scope for this phase's rules-layer gate (Storage rules can only check the DECLARED contentType, not sniff actual bytes) — acceptable residual risk consistent with `media/`'s existing identical exposure; not a regression introduced by this phase |

## Sources

### Primary (HIGH confidence)
- `storage.rules` (this repo) — full file read, existing `isOrgMemberByClaim`/`isOrgMember` pattern and
  its own documented OR-combination comment (`:51-54`).
- `functions/src/cleanupSweeps.ts` (this repo) — all four guard regexes read directly.
- `firestore.rules` (this repo) — `songs/{songId}` match block (`:302-314`), `organizations/{orgId}`
  block's editor/member helper functions (`:11-53`).
- `src/router/index.ts` (this repo) — `/songs` route `meta.requiresEditor` (`:37-41`).
- `src/stores/songs.ts` (this repo) — `deleteSong`/`hardDeleteSong` (`:304-332`).
- `src/storage.rules.test.ts` / `functions/src/index.test.ts` (this repo) — existing test conventions
  mirrored for the recommended new tests.

### Secondary (MEDIUM confidence)
- `[CITED: firebase.google.com/docs/rules/rules-behavior]` — Storage/Firestore rules OR-combination
  across matching blocks.
- `[CITED: firebase.google.com/docs/storage/security/core-syntax]` — recursive wildcard `{name=**}`
  semantics, `path`-typed capture.
- `[CITED: firebase.google.com/docs/rules/rules-language]` — String `.matches(regex)` method,
  `resource.name`/`request.resource.name` string fields, official `contentType.matches('image/.*')`
  example.

### Tertiary (LOW confidence)
- None of the above claims are WebSearch-only/unconfirmed; all CITED items were fetched directly from
  `firebase.google.com` documentation pages this session. The gsd-tools `classify-confidence` seam
  scores `webfetch`/`websearch` as LOW by default (no authoritative-source cross-reference credit for
  these providers specifically) — treat the rule-syntax claims (A1 in the Assumptions Log) as needing
  empirical proof via this phase's own emulator tests, not as verified fact from documentation alone.

## Metadata

**Confidence breakdown:**
- Standard stack: N/A — no new packages.
- Architecture (rules structure): HIGH for the OR-combination diagnosis (proven by this repo's own
  existing tests + comments); MEDIUM for the exact `resource.name.matches()` syntax (CITED, to be
  proven by the phase's own emulator tests per Pitfall 1's regression test).
- Pitfalls: HIGH — all four are either directly evidenced in this repo's own CLAUDE.md/test history or
  logically necessary consequences of the OR-combination fact.

**Research date:** 2026-09-05
**Valid until:** 30 days (stable Firebase rules-language surface; re-verify if `firebase-tools`/SDK
major version changes before Phase 122 executes).
