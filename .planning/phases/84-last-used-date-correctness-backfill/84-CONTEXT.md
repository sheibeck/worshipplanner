# Phase 84: Last-Used Date Correctness & Backfill - Context

**Gathered:** 2026-08-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Fix the song "last used / last scheduled" date so it reflects the **date of the most recent LOCKED
service** the song is in — not the wall-clock time the song was added to a plan — then a one-time,
owner-run backfill that corrects existing songs in the single production (Berean) org.

**Root cause (located):** `src/stores/services.ts` → `assignSongToSlot` (line ~519) writes
`lastUsedAt: serverTimestamp()` — the moment of assignment. A service planned ~2 weeks ahead therefore
stamps the add date (Aug 11), never the service date (Sep 6). The reported bug ("His Mercy Is More"
showed Aug 11 despite a locked & exported Sep 6 service) is exactly this.

Requirements: R247 (live correctness), R248 (retroactive backfill).
</domain>

<decisions>
## Implementation Decisions

### Last-used derivation semantics (Area 1 — owner-refined)
- **Lock-gated, not assign-gated.** A song's `lastUsedAt` counts a service ONLY when that service is
  **locked** — i.e. `service.status !== 'draft'` (`'planned'` or `'exported'`). Draft services never
  contribute. (Owner: "Only update the last used date when a service has the song and that service is
  locked.")
- **Value = MAX(service.date) over locked services containing the song** in a SONG slot. Adding a song
  to a later-dated locked service advances the date (R247 SC2); a song in an earlier locked service does
  not regress it.
- **Recompute on lock-state / membership change, not on draft edits.** When a service is locked, unlocked
  (reopened), or its songs change while it becomes/leaves locked, recompute `lastUsedAt` for each
  affected song from the locked-service set. (Owner: "If you unlock a service and change the song, then
  recompute the last used by MAX(service.date) where services are locked.")
  - The old `serverTimestamp()` write in `assignSongToSlot` is removed/replaced — assignment inside a
    draft must NOT stamp a date.
- **Date source.** `Service.date` is a `"YYYY-MM-DD"` string; convert to the song's `lastUsedAt: Timestamp`
  via a single consistent calendar-date parse (shared with the backfill).
- **Never blank a value that has no locked-service replacement.** The live recompute sets `lastUsedAt` to
  the computed locked MAX; a computed value may legitimately be null when a song that IS in services has
  no *locked* service (e.g. its only locked service was just reopened). Blanking is acceptable ONLY for a
  song that is in ≥1 service — it must never touch a song that is in **no** service (see backfill).

### Backfill script — R248 (Area 2 — owner-refined)
- **Single org only.** Production has exactly one org (Berean); scope the backfill to that one org (no
  all-orgs sweep). (Owner: "just backfill one org. we only have one org in production anyway.")
- **Never touch songs that are in no service.** Those `lastUsedAt` values came from the Planning Center
  import and must be preserved. (Owner: "don't touch songs that are not in any service. Leave those dates
  for production berean org since those came from planning center.")
- **Conservative write rule:** the backfill WRITES `lastUsedAt = MAX(locked-service date containing song)`
  ONLY for songs that have ≥1 locked service; it SKIPS (leaves untouched) every other song. It never
  nulls/blanks anything. This strictly honors "don't touch" and only ever corrects real locked dates.
- **Form & safety:** a Node Admin-SDK script mirroring `functions/src/backfillOrgClaims.ts`
  (TS in `functions/src/`, compiled to `functions/lib/`), **dry-run by default**, `--apply` to write,
  idempotent recompute-and-set. Owner-run locally — NOT a `firebase deploy`. Owner-confirmed before the
  `--apply` run (it writes production data), per the standing confirm-then-deploy policy.

### Shared logic & tests (Area 3 — accepted)
- **One pure helper** (e.g. `computeLastUsedAt(songId, services)` or a small date-max util) that filters
  to locked services and returns MAX(date) or null — consumed by BOTH the live store path and the
  backfill so they can never disagree.
- **Tests:** unit tests for the helper (max, tie, null/no-locked-service, `"YYYY-MM-DD"` parse) PLUS a
  store test proving lock/unlock recomputes to the service date and that a draft assignment does NOT
  stamp `now()`.
- **Consistent calendar-date handling** for `service.date` in both live path and backfill.
</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/stores/services.ts` — `assignSongToSlot` (root-cause write ~line 519), `clearSongFromSlot`, and
  the lock/unlock lifecycle (draft → planned) are the trigger points to recompute from.
- `src/stores/songs.ts` — `updateSong(id, { lastUsedAt })` is the existing cross-store write API.
- `src/utils/suggestions.ts` (lines ~42–52) reads `song.lastUsedAt` for rotation ("weeks since",
  "isRecent") — the sole downstream consumer; its behavior must stay correct after the fix.
- `functions/src/backfillOrgClaims.ts` (+ `.test.ts`, compiled `functions/lib/backfillOrgClaims.js`) —
  the canonical dry-run/`--apply` Admin-SDK backfill pattern to mirror for R248.

### Established Patterns
- `Service.date: string` (`"YYYY-MM-DD"`); `Song.lastUsedAt: Timestamp | null` (`src/types/song.ts:34`).
- `ServiceStatus = 'draft' | 'planned' | 'exported'` (`src/types/service.ts:6`); locked ≡ not `'draft'`.
- Backfills live in `functions/` under the Admin SDK, owner-run, dry-run-first.

### Integration Points
- Live recompute hooks into the service lock/unlock (reopen) actions and any locked-service song change
  in `services.ts`, writing through `songStore.updateSong`.
- Backfill reads `organizations/{orgId}/services/*` + `.../songs/*` via Admin SDK for the one prod org.
</code_context>

<specifics>
## Specific Ideas

- Reported repro to kill: "His Mercy Is More" showed **Aug 11** despite a locked & exported **Sep 6**
  service. After the fix, that song reads Sep 6; after the backfill, every song already in a locked
  service is corrected to its true locked MAX date.
- The R248 `--apply` run targets the production Berean org and is owner-confirmed before it runs.
</specifics>

<deferred>
## Deferred Ideas

- All-orgs backfill sweep — deferred; production is single-org, so the script is scoped to one org.
- Nulling/adjusting last-used for songs that are in no service — explicitly out of scope; those PC-import
  dates are preserved untouched.
</deferred>
