---
phase: 66-storage-retention
plan: 02
type: execute
wave: 2
depends_on: [66-01]
files_modified:
  - functions/src/index.ts
  - functions/src/index.test.ts
autonomous: true
requirements: [R167, R168]
user_setup:
  - service: firebase-functions-runtime-env
    why: "First LIVE deletion of real Storage objects is owner-gated (v1.8 grant). Both new sweeps ship with their enable flag OFF; the owner flips it and redeploys."
    env_vars:
      - name: BACKGROUND_CLEANUP_ENABLED
        source: "OWNER STEP ONLY — add `BACKGROUND_CLEANUP_ENABLED=true` to functions/.env, then `firebase deploy --only functions:cleanupOrphanBackgrounds`. Do NOT run in this plan."
      - name: PPTX_SOURCE_CLEANUP_ENABLED
        source: "OWNER STEP ONLY — add `PPTX_SOURCE_CLEANUP_ENABLED=true` to functions/.env, then `firebase deploy --only functions:cleanupPptxSources`. Do NOT run in this plan."

must_haves:
  truths:
    - "A background under orgs/{orgId}/backgrounds/ that NO live document references AND is older than BACKGROUND_RETENTION_DAYS (30) becomes eligible for deletion when BACKGROUND_CLEANUP_ENABLED=\"true\" (R167)."
    - "A background that IS referenced by any tier (slideGroup group-level, slideGroup slides[] entry, or song lyrics doc) is NEVER deleted regardless of age — proven by test."
    - "If the reference picture is incomplete (any backgroundImageUrl cannot be parsed to an object path), the background run deletes NOTHING that run (forced dry-run) — the sweep never deletes when it cannot see all references."
    - "A CONSUMED pptx import (pptxRenders status \"ready\") older than PPTX_SOURCE_RETENTION_DAYS (30) has its source.pptx + images/ eligible for deletion, while rendered/ is NEVER deleted (R168)."
    - "Both new sweeps default to DRY-RUN and each carries a path guard scoped to its own prefix."
  artifacts:
    - functions/src/index.ts
    - functions/src/index.test.ts
  key_links:
    - "Background reference enumeration MUST cover all three tiers — a missed tier is a wrongful delete of a live background (blank slide mid-service)."
    - "PPTX_SOURCE_GUARD positively matches ONLY source.pptx and images/ — rendered/ is structurally unreachable."
    - "cleanupPptxSources is driven by pptxRenders docs, so image-only imports (no render doc, whose images/ ARE the display) are never in scope."
---

<objective>
Build the two NEVER-PRUNED Storage paths their first bounded, tested retention story: a background-image orphan sweep (R167) and a PPTX-import source sweep (R168). Both are new `onSchedule` crons in `functions/src/index.ts`, both DRY-RUN BY DEFAULT, both path-guarded and age-gated, both proven by tests against mocked Storage/Firestore. Nothing is deployed and no real object is deleted here.

R167 is this phase's riskiest requirement: deleting a still-referenced background blanks a slide mid-service. The reference model is fully mapped below so the executor does not have to rediscover it, and the sweep is orphan+age (NEVER pure age) with a hard fail-safe: if it cannot enumerate ALL references, it deletes nothing.

Purpose: bound the two Storage paths that grow forever today (backgrounds and pptx-import sources) without ever endangering a live background or the rendered/ display artifacts.
Output: `cleanupOrphanBackgrounds` (R167) and `cleanupPptxSources` (R168) crons + handlers + guards + constants, all tested; owner enablement commands in SUMMARY.
</objective>

<execution_context>
@$HOME/.claude/gsd-core/workflows/execute-plan.md
@$HOME/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/66-storage-retention/66-CONTEXT.md

# Templates to MIRROR (structure, safety-contract comments, dry-run gate direction):
#   cleanupOrphanRendersHandler  ~functions/src/index.ts:1053-1141 (collectionGroup scan + parent-chain orgId + guard + dry-run + own schedule slot)
#   renderedPrefixFor            ~functions/src/index.ts:716
#   readDeleteCap()              introduced in 66-01 — REUSE it for both new sweeps' per-run cap
@functions/src/index.ts

# Existing cleanup test harness to MIRROR:
#   mockOrphanDb / fakeOrphanDoc / mockOrphanBucket  ~functions/src/index.test.ts:800-839
#   ★ SOURCE INSPECTION gate-direction test          ~functions/src/index.test.ts:1004
@functions/src/index.test.ts

# Background reference model — source of truth for R167 (fields carry the FULL download URL):
#   group tier: organizations/{orgId}/slideGroups/{slotId}.backgroundImageUrl   (src/types/slideGroup.ts:53)
#   slide tier: same doc's EMBEDDED slides[] array — each entry.backgroundImageUrl (src/types/slideGroup.ts:94; array, NOT a subcollection)
#   song tier:  organizations/{orgId}/songs/{songId}/lyrics/{lyricsId}.backgroundImageUrl (src/types/songLyrics.ts:68)
@src/types/slideGroup.ts
@src/composables/useBackgroundUpload.ts
@src/types/importedDeck.ts
</context>

<background_reference_model>
## MANDATORY R167 INVESTIGATION — FINDINGS (map, do not rediscover)

**What a background IS (write side):** `useBackgroundUpload.ts:93-134` uploads to
`orgs/{orgId}/backgrounds/{backgroundId}/{sanitizedFileName}` (a per-upload `crypto.randomUUID()`
backgroundId) and resolves to a Firebase **download URL** via `getDownloadURL()`. The reference
stored in Firestore is that **full download URL string**, never the backgroundId or the raw object
path.

**Where references live (three tiers — the cascade resolved by `slideshowAssembler.ts:335`):**
1. **Group tier** — `organizations/{orgId}/slideGroups/{slotId}` document, field
   `backgroundImageUrl` (`src/types/slideGroup.ts:53`; written via `slideGroups.ts:238-252`).
2. **Slide tier** — the SAME slideGroups doc's **embedded `slides[]` array** (`GroupSlideEntry`),
   each entry's `backgroundImageUrl` (`src/types/slideGroup.ts:94`). This is an array field ON the
   slideGroups document, NOT a nested subcollection — enumerate it by reading `doc.data().slides`.
3. **Song tier** — `organizations/{orgId}/songs/{songId}/lyrics/{lyricsId}` document, field
   `backgroundImageUrl` (`src/types/songLyrics.ts:68`; written via `songLyrics.ts:163`).

**How a cron enumerates ALL live references (no composite index required — plain `.get()`):**
- `getFirestore().collectionGroup("slideGroups").get()` — for each doc: collect `data().backgroundImageUrl`
  (group tier) AND iterate `data().slides` reading each `entry.backgroundImageUrl` (slide tier).
- `getFirestore().collectionGroup("lyrics").get()` — for each doc: collect `data().backgroundImageUrl`
  (song tier).

**Object <-> reference matching (deterministic):** a Firebase download URL has the shape
`https://firebasestorage.googleapis.com/v0/b/{bucket}/o/{ENCODED_OBJECT_PATH}?alt=media&token=...`.
The object path is the segment between `/o/` and `?`, URL-encoded. `decodeURIComponent` it to recover
the exact object name `orgs/{orgId}/backgrounds/{backgroundId}/{fileName}`, which compares 1:1 against
`file.name` from the bucket listing. Object names embed the orgId, so a single global referenced-name
Set is sufficient and safe — an object under org A can only ever match a reference under org A.

**Why this is SAFE enough for orphan+age deletion (not the narrowed fallback):** references are stored
as stable, self-describing download URLs whose object path is recoverable by pure string parsing across
three well-defined, fully-reachable tiers. Reference detection is therefore FEASIBLE and RELIABLE, so
the full orphan+age design is planned (per the CONTEXT's instruction to fall back only if detection is
infeasible). The one residual risk — an unparseable reference — is closed by the fail-safe below.

**FAIL-SAFE (the design against deleting a referenced background):** track a `referencesComplete`
boolean while building the Set. If any NON-EMPTY `backgroundImageUrl` cannot be parsed into an object
path (unexpected URL shape), set `referencesComplete = false`. If either collectionGroup scan throws,
treat the whole reference picture as unavailable. When `referencesComplete` is false (or a scan threw),
the run is forced to DRY-RUN — it deletes NOTHING that run — because it cannot prove an object is
unreferenced. Under-deletion (leaving an orphan another day) is always preferred over deleting a live
background. This is the disclosed safety posture and is asserted by test.
</background_reference_model>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: cleanupOrphanBackgrounds — orphan+age background sweep with reference fail-safe (R167)</name>
  <files>functions/src/index.ts, functions/src/index.test.ts</files>
  <behavior>
    Against mocked Firestore (two collectionGroup scans) + Storage:
    - ORPHAN+AGE delete branch: BACKGROUND_CLEANUP_ENABLED="true", one background object older than BACKGROUND_RETENTION_DAYS whose object path appears in NO reference => delete() called once; summary.dryRun=false, deletedCount=1.
    - NEVER deletes a referenced background: a 90-day-old background object whose object path is embedded in a group-tier backgroundImageUrl download URL => delete() NOT called. Same assertion for a slide-tier entry (slides[] array) reference and for a song-tier lyrics reference — one test per tier proves each tier is enumerated.
    - NEVER pure age: an aged object that is unreferenced is deleted, but an aged object that IS referenced is not — age alone is never sufficient.
    - Reference fail-safe: when any backgroundImageUrl string cannot be parsed to an object path, referencesComplete=false and the run deletes nothing even with the flag enabled (summary.dryRun=true, referencesComplete=false). Same when a collectionGroup scan rejects.
    - Path guard: an aged object under orgs/{orgId}/media/ or .../pptx-imports/ is never considered (BACKGROUND_PATH_GUARD rejects it before the age/reference check).
    - FAIL-SAFE gate: unset/""/"false"/"1"/"True" all leave dryRun=true and delete nothing. NaN/unreadable timeCreated is skipped.
    - Per-run cap: readDeleteCap() (from 66-01) bounds LIVE object deletes; cappedByLimit reported.
  </behavior>
  <action>
    In `functions/src/index.ts`, alongside the existing sweeps, add: constant `BACKGROUND_RETENTION_DAYS = 30`; path guard `BACKGROUND_PATH_GUARD = /^orgs\/[^/]+\/backgrounds\//` (exported); an `OrphanBackgroundSummary` interface `{ scannedCount, orphanCount, deletedCount, deletedBytes, referencesComplete, cappedByLimit, dryRun }`; a small exported pure helper `extractBackgroundObjectPath(url: string): string | null` that returns the decoded object path from a Firebase download URL's `/o/{path}` segment or null when the URL has no parseable `/o/…` segment.

    Add `cleanupOrphanBackgroundsHandler(): Promise<OrphanBackgroundSummary>`, exported separately from its `onSchedule` wrapper (mirror cleanupOrphanRendersHandler). Body:
    - `const dryRun = process.env.BACKGROUND_CLEANUP_ENABLED !== "true";` (this exact fail-safe direction — the 9f1b881 regression guard).
    - Build the referenced-object-path Set + `referencesComplete` flag from the two scans described in the background_reference_model context block: `collectionGroup("slideGroups")` (group field + every `slides[]` entry field) and `collectionGroup("lyrics")` (song field). For each non-empty backgroundImageUrl, call `extractBackgroundObjectPath`; add its result to the Set, or set `referencesComplete=false` when it returns null. Wrap the scans in try/catch; on throw, log and set `referencesComplete=false`.
    - `const effectiveDryRun = dryRun || !referencesComplete;` — if references are incomplete, the run must delete nothing regardless of the flag.
    - `getFiles({ prefix: "orgs/" })`; for each file, skip unless `BACKGROUND_PATH_GUARD.test(file.name)`; skip if `referencedSet.has(file.name)` (referenced — never delete); skip if `timeCreated` is NaN or newer than `Date.now() - BACKGROUND_RETENTION_DAYS*DAY_MS`. Remaining candidates are orphans: count `orphanCount`, sum `Number(file.metadata?.size ?? 0)` into `deletedBytes`; when `effectiveDryRun` count only; else `file.delete()` inside try/catch, respecting `readDeleteCap()` (set `cappedByLimit` and stop when reached). Log a summary line with all fields. Set `summary.dryRun = effectiveDryRun`.

    Add the wrapper `export const cleanupOrphanBackgrounds = onSchedule({ schedule: "every day 05:00", timeZone: "UTC" }, async () => { await cleanupOrphanBackgroundsHandler(); });` — 05:00 UTC keeps it staggered after media (02:00), orphan-renders (03:00), and reminders (04:00). Add a SAFETY CONTRACT comment block above it in the same style as the existing sweeps, stating the orphan+age double gate, the three-tier enumeration, and the references-incomplete fail-safe.

    In `functions/src/index.test.ts`, add a `describe("cleanupOrphanBackgroundsHandler")` block mirroring the mockOrphanDb pattern but exposing BOTH `collectionGroup("slideGroups")` and `collectionGroup("lyrics")` scans (each returning `{ get }` with a `docs` array of `{ data: () => (...) }`), plus a background bucket mock. Include one referenced-survives test per tier, the orphan-delete test, the references-incomplete forced-dry-run test, the guard test, and the fail-safe gate cases. Add a ★ SOURCE INSPECTION test pinning `const dryRun = process.env.BACKGROUND_CLEANUP_ENABLED !== "true";` in the handler body (mirror index.test.ts:1004).
  </action>
  <verify>
    <automated>cd functions && npm test -- --run src/index.test.ts</automated>
  </verify>
  <done>cleanupOrphanBackgroundsHandler deletes an aged unreferenced background when enabled; never deletes a background referenced at ANY of the three tiers; forces dry-run when references are incomplete; guard + age + fail-safe gate all proven; `cd functions && npm run build` clean.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: cleanupPptxSources — prune consumed/failed import sources, keep rendered/ (R168)</name>
  <files>functions/src/index.ts, functions/src/index.test.ts</files>
  <behavior>
    Against mocked Firestore collectionGroup("pptxRenders") + Storage:
    - CONSUMED delete branch: PPTX_SOURCE_CLEANUP_ENABLED="true", a "ready" render doc older than PPTX_SOURCE_RETENTION_DAYS, with source.pptx + images/0.png + rendered/page-0001.png in its scope => source.pptx and images/0.png delete() called; rendered/page-0001.png delete() NOT called; summary.dryRun=false.
    - KEEP rendered/: even with the flag enabled and a 90-day-old ready import, no rendered/ object is ever deleted (PPTX_SOURCE_GUARD rejects it).
    - Failed-source coverage: a "failed" render doc older than the window also has its source.pptx + images/ pruned (its rendered/ + doc lifecycle stay owned by cleanupOrphanRenders).
    - NEVER deletes a fresh/consumed-but-too-new import: a "ready" doc younger than the window is skipped.
    - Age gate on server-set createdAt; NaN/unreadable createdAt skipped; parent-chain orgId recovery, skipped when missing.
    - FAIL-SAFE gate: unset/""/"false"/"1"/"True" all dry-run. Per-run cap via readDeleteCap(); cappedByLimit reported.
  </behavior>
  <action>
    In `functions/src/index.ts`, add: constant `PPTX_SOURCE_RETENTION_DAYS = 30`; path guard `PPTX_SOURCE_GUARD = /^orgs\/[^/]+\/pptx-imports\/[^/]+\/(source\.pptx$|images\/)/` (exported) — a POSITIVE guard matching ONLY the source deck and the extracted images/ prefix, structurally unable to match rendered/; a `PptxSourceCleanupSummary` interface `{ scannedCount, deletedObjectCount, deletedBytes, cappedByLimit, dryRun }`.

    Add a helper for the per-import prefix mirroring `renderedPrefixFor` (index.ts:716): `sourcePrefixFor(orgId, importId)` returning `orgs/${orgId}/pptx-imports/${importId}/`.

    Add `cleanupPptxSourcesHandler(): Promise<PptxSourceCleanupSummary>`, exported separately from its wrapper (mirror cleanupOrphanRendersHandler). Body:
    - `const dryRun = process.env.PPTX_SOURCE_CLEANUP_ENABLED !== "true";` (exact fail-safe direction).
    - `const cutoffMs = Date.now() - PPTX_SOURCE_RETENTION_DAYS*DAY_MS;`
    - `collectionGroup("pptxRenders").where("status", "in", ["ready", "failed"]).get()` — "ready" = consumed (source no longer needed; app displays from rendered/), "failed" = orphaned import whose source is dead weight. Recover orgId from `renderDoc.ref.parent.parent?.id` (skip if missing); importId = renderDoc.id; read `createdAt.toMillis()`; skip if NaN or newer than cutoff.
    - For each eligible import: `getFiles({ prefix: sourcePrefixFor(orgId, importId) })`, filter to `PPTX_SOURCE_GUARD.test(file.name)` (source.pptx + images/ only — rendered/ excluded by construction). Sum bytes; in dry-run count only; else `file.delete()` in try/catch, honoring `readDeleteCap()` across the whole run. Do NOT delete the render doc (rendered/ and the doc are the display record; for "failed" docs their lifecycle stays with cleanupOrphanRenders). Log a summary line.

    Add wrapper `export const cleanupPptxSources = onSchedule({ schedule: "every day 06:00", timeZone: "UTC" }, async () => { await cleanupPptxSourcesHandler(); });` — 06:00 UTC keeps it staggered after the 05:00 background sweep. Add a SAFETY CONTRACT comment block in the existing style, stating: KEEP rendered/, the positive source-only guard, consumed-vs-failed coverage, and that image-only imports (no pptxRenders doc, whose images/ ARE the display) are structurally out of scope because the scan is driven by render docs. Note the disclosed benign race: if cleanupOrphanRenders (once owner-enabled) deletes a failed doc before this sweep first sees it, that failed import's source may be missed — under-deletion only, never over-deletion.

    In `functions/src/index.test.ts`, add a `describe("cleanupPptxSourcesHandler")` block reusing the mockOrphanDb/fakeOrphanDoc/mockOrphanBucket shapes (fakeOrphanDoc already supports status "ready"). Include the consumed-prune test (asserting rendered/ survives), the keep-rendered test, the failed-source test, the too-new skip, the guard/age/fail-safe cases, and a ★ SOURCE INSPECTION test pinning `const dryRun = process.env.PPTX_SOURCE_CLEANUP_ENABLED !== "true";`.
  </action>
  <verify>
    <automated>cd functions && npm test -- --run src/index.test.ts</automated>
  </verify>
  <done>cleanupPptxSourcesHandler prunes source.pptx + images/ for aged consumed AND failed imports while never touching rendered/; too-new imports skipped; guard + age + fail-safe gate proven; `cd functions && npm run build` clean.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| scheduled cron -> Cloud Storage | Two new daily jobs issue object deletes; guard/age/reference bugs are the only thing between them and live-data loss. |
| Firestore reference set -> delete decision (R167) | The set of live background references decides which objects are orphans; an incomplete set could authorize deleting a referenced background. |
| runtime env (functions/.env) -> handler behavior | The `*_CLEANUP_ENABLED` string flips a run from dry-run to real deletion; owner-controlled. |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-66-02-01 | Tampering | cleanupOrphanBackgrounds reference detection | critical | mitigate | Orphan+age double gate (never pure age); all three reference tiers enumerated; `referencesComplete=false` (or a scan throw) forces the whole run to dry-run — deletes nothing when references cannot be fully seen. Per-tier survives-referenced tests. |
| T-66-02-02 | Tampering | cleanupPptxSources deleting rendered/ display artifacts | high | mitigate | PPTX_SOURCE_GUARD positively matches ONLY source.pptx + images/; rendered/ is structurally unmatchable; a test proves a 90-day-old ready import keeps its rendered/ objects. |
| T-66-02-03 | Tampering | inverted/`!= "true"` gate drift | critical | mitigate | Both handlers use the exact `!== "true"` fail-safe direction; ★ SOURCE INSPECTION tests pin it; both ship OFF by default. |
| T-66-02-04 | Denial of Service | first LIVE enablement on a large backlog | high | mitigate | readDeleteCap() (default 500) bounds objects deleted per run for both sweeps; idempotent-by-age/status drains over subsequent runs. |
| T-66-02-05 | Elevation of scope | deleting outside backgrounds/ or the pptx source prefixes | high | mitigate | BACKGROUND_PATH_GUARD and PPTX_SOURCE_GUARD are applied BEFORE any delete decision; media/ and rendered/ are structurally excluded; guard tests included. |
| T-66-02-SC | Tampering | npm/pip/cargo installs | low | accept | No new package installs are introduced by this plan; nothing to audit. |
</threat_model>

<verification>
- `cd functions && npm test` passes, including the new cleanupOrphanBackgroundsHandler and cleanupPptxSourcesHandler suites and every pre-existing cleanup test (unchanged).
- `cd functions && npm run build` is clean (tsc).
- Both new handlers use the `!== "true"` gate direction (★ SOURCE INSPECTION tests pass) and default to dry-run.
- No `firebase deploy` was run; no live object was deleted; `functions/.env` was NOT written.
</verification>

<success_criteria>
- R167: an unreferenced, aged background is deletable when enabled; a background referenced at ANY tier is never deleted; an incomplete reference picture forces the run to delete nothing. Scope: full orphan+age (reference detection proven feasible + reliable), with the incomplete-references fail-safe as the disclosed safety net — NOT a pure-age deletion and NOT the narrowed deleted-org-only fallback.
- R168: an aged consumed ("ready") import's source.pptx + images/ are deletable when enabled while rendered/ is always kept; aged failed imports' sources are also covered; image-only imports (no render doc) are out of scope by construction.
- Both new sweeps default to dry-run, are path-guarded and age-gated, and are proven only against mocked Storage/Firestore — no success criterion depends on real production deletion.
</success_criteria>

<deploy>
## STAGED for orchestrator (dry-run functions) — autonomous per the v1.8 grant
The two NEW functions `cleanupOrphanBackgrounds` and `cleanupPptxSources` delete NOTHING by default (flags OFF). Deploying them in dry-run mode is bounded/reversible and may be included in the orchestrator's consolidated `firebase deploy --only functions:cleanupOrphanBackgrounds,functions:cleanupPptxSources` at milestone end. THE EXECUTOR MUST NOT RUN `firebase deploy`.

## OWNER-GATED (hand over, UNDEPLOYED, do NOT run) — the first LIVE deletion
Record verbatim in SUMMARY; do not execute and do not write functions/.env:
1. Backgrounds: review a dry-run's logged orphanCount/deletedBytes/referencesComplete FIRST; then add `BACKGROUND_CLEANUP_ENABLED=true` to `functions/.env` and `firebase deploy --only functions:cleanupOrphanBackgrounds`.
2. PPTX sources: review a dry-run's logged count/bytes FIRST; then add `PPTX_SOURCE_CLEANUP_ENABLED=true` to `functions/.env` and `firebase deploy --only functions:cleanupPptxSources`.
3. (Optional) bound the first LIVE run with `STORAGE_CLEANUP_MAX_DELETES_PER_RUN=<n>` (default 500) and tune retention via `BACKGROUND_RETENTION_DAYS` / `PPTX_SOURCE_RETENTION_DAYS` if desired.
</deploy>

<output>
Create `.planning/phases/66-storage-retention/66-02-SUMMARY.md` when done — include the OWNER-GATED enablement commands above verbatim under a "Handover" heading, and record the confirmed background reference model (three tiers) for future reference.
</output>
