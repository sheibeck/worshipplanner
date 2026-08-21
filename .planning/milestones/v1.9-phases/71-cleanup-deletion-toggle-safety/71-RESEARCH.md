# Phase 71: Cleanup Deletion-Toggle Safety - Research

**Researched:** 2026-08-20
**Domain:** Cloud Functions onCall (dry-run reuse seam) + Vue 3 confirm-dialog UX, on a live production Firebase app
**Confidence:** HIGH

## Summary

Every fact needed to plan this phase is already visible in the four v1.8/v1.9 cleanup handlers in
`functions/src/index.ts`: `cleanupExpiredMediaHandler`, `cleanupOrphanRendersHandler`,
`cleanupOrphanBackgroundsHandler`, `cleanupPptxSourcesHandler`. Each already computes `dryRun` as
the FIRST executable line of the function body, straight off `config.cleanup.*Enabled` (read via
`getAppConfig(db, { fresh: true })`), and every downstream branch — the scan loop, the guards, the
delete cap, and (uniquely for backgrounds) the `referencesComplete`/floor-guard fail-safes — reads
that single `dryRun` (or, for backgrounds, `effectiveDryRun`) value. This means the correct, minimal
reuse seam is **not** a new pure "compute" function extracted from the handler — it is a **one-line
change to each handler's existing `dryRun` computation**, adding an optional `forceDryRun` parameter
that the handler ORs into the existing boolean. Everything after that line — scan, guards, cap,
delete, and the backgrounds fail-safes — is untouched, character-for-character.

`previewCleanupDryRun` is therefore a thin `onCall` that (1) re-verifies the caller is a super-admin
using the exact two-check pattern already proven in `setSuperAdminClaimHandler`
(`functions/src/superAdminClaims.ts`), (2) dispatches on a `type` argument to one of the four
handlers, calling it with `{ forceDryRun: true }`, and (3) maps that handler's returned summary
object onto `{ wouldDeleteCount, wouldDeleteBytes, referencesComplete? }`. The one subtlety the
planner must get right: **the field that means "would-delete count" is NOT the same summary field
across all four handlers** — see the Code Examples section below; getting this wrong silently shows
the owner `0` even when there is a real backlog.

The client side is a pure UI-SPEC implementation: extend `CleanupConfigCard.vue`'s four rows with
Enable/Disable buttons (per `71-UI-SPEC.md`, already fully specified with copy/states/a11y), add one
new `CleanupEnableConfirmDialog.vue` modeled directly on `NewServiceDialog.vue`'s Teleport/backdrop/
Transition structure (this repo's first confirm dialog with a hand-rolled focus trap), and wire Enable
through `httpsCallable(functions, 'previewCleanupDryRun')` then, on confirm, through the existing
Phase 70 `store.saveField('cleanup.{x}Enabled', true)`. Disable is a direct `saveField(..., false)`
with no preview. No new npm dependency anywhere.

**Primary recommendation:** Add one optional `{ forceDryRun?: boolean }` parameter to each of the
four cleanup handler signatures, OR'd into their existing `dryRun`/`effectiveDryRun` computation
(the one and only line each handler already isolates for exactly this purpose); build
`previewCleanupDryRun` as a thin super-admin-gated dispatcher over the four handlers called with
`{ forceDryRun: true }`; extend `CleanupConfigCard.vue` and add `CleanupEnableConfirmDialog.vue`
exactly per `71-UI-SPEC.md`, with zero new dependencies.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Dry-run blast-radius computation (R188) | API / Backend (Cloud Functions) | — | Must share the exact scan/reference-detection code the real cron uses; only the Functions runtime has Storage/Firestore Admin SDK access |
| Super-admin re-verification of the preview caller | API / Backend | — | Client-declared authority is never trusted (mirrors `setSuperAdminClaimHandler`'s two independent re-checks) |
| Confirm-to-flip UX (R189) | Browser / Client | — | Pure UI state machine (preview → confirm → write); the actual safety boundary is server-side (forced dry-run + rules-gated write), the client dialog is UX friction only |
| `cleanup.*Enabled` flag write | Browser / Client → Firestore (direct write via rules) | — | Unchanged from Phase 70: `saveField` writes directly to `appConfig/global` through `firestore.rules`' `isSuperAdmin()` claim check, no new Cloud Function needed for the write itself |
| Song-background reference detection / floor-guard (R190) | API / Backend | — | Lives entirely inside `cleanupOrphanBackgroundsHandler`; the preview reuses it unmodified by invoking the same handler body |
| Deletion execution (unchanged, out of scope) | API / Backend (scheduled cron) | — | Untouched this phase — `onSchedule` wrappers still call the handler with zero args, so `forceDryRun` defaults to falsy and behavior is byte-identical to today |

## User Constraints (from CONTEXT.md)

<user_constraints>
### Locked Decisions

**The dry-run preview callable (R188)**
- NEW `previewCleanupDryRun` `onCall` in `functions/src/index.ts` (or a small sibling module),
  super-admin guarded — reuse the Phase 68 caller re-check pattern (token `superAdmin` claim AND a
  `superAdmins/{uid}` re-read). It takes a cleanup-type argument (`media` | `orphanRenders` |
  `backgrounds` | `pptxSources`) and returns `{ wouldDeleteCount, wouldDeleteBytes, referencesComplete? }`.
- It forces dry-run and NEVER deletes, independent of the stored `*_CLEANUP_ENABLED` value — the
  `dryRun` passed to the compute path is hard-`true`, not derived from config.
- Reuse the existing dry-run computation, do not fork it. The cleanest seam is to extract each
  handler's scan-and-count logic into a callable-invokable function that returns the tally without
  side effects (or invoke the handler with a forced-dry-run flag and capture the tally). The
  constraint is: zero change to the deletion logic and the fail-safes; the preview shares the SAME
  scan/reference-detection code the real run uses.
- For `backgrounds`, the preview MUST surface `referencesComplete`.

**The confirm-to-flip flow (R189)**
- In `CleanupConfigCard.vue`, each cleanup row: current state + an Enable affordance (only when
  currently off). Clicking Enable: (1) calls `previewCleanupDryRun` for that type, (2) shows a
  confirm dialog echoing the real count, (3) only on explicit confirm, writes
  `cleanup.{type}Enabled = true` via the Phase 70 store `saveField`.
- Disabling is immediate, no preview, plain toggle to false.
- Flipping the flag NEVER triggers a deletion in-band — only the next scheduled cron acts.
- Background-specific guard: if `referencesComplete: false`, the confirm dialog must WARN and
  SHOULD block/discourage enabling.

**R190 — song-background protection intact**
- No change to `cleanupOrphanBackgroundsHandler`'s deletion logic or its `referencesComplete` /
  floor-guard fail-safes — this phase only reads them and gates the enable. Its existing unit tests
  must pass UNCHANGED. Add a test asserting the preview path invokes the SAME reference-detection the
  real run uses, and that the preview never deletes.

**Security & correctness**
- `previewCleanupDryRun` is super-admin-only and side-effect-free. The confirm flow is client UX; the
  REAL protection is (a) the callable's forced-dry-run, (b) the cron reading the flag fresh, (c) the
  unchanged fail-safes. Client validation/confirm is not a security boundary.

**Deploy discipline (v1.9 grant)**
- The `previewCleanupDryRun` callable is a functions change → ships built + tested + UNDEPLOYED,
  deploy command handed to the owner. The client flow ships built + tested. Actually enabling a
  cleanup in production remains the owner's button. No `.env.local`/`functions/.env` writes.

### Claude's Discretion
- The exact refactor seam for the dry-run compute (extracted pure function vs forced-flag handler
  invocation) — **this research recommends forced-flag handler invocation**, see below.
- The callable's request/response shape.
- The confirm-dialog component (reuse an existing confirm pattern or a small new one) — the UI-SPEC
  (see below) has since resolved this to a NEW `CleanupEnableConfirmDialog.vue` modeled on
  `NewServiceDialog.vue`'s structure.
- Whether the four types share one preview handler with a type param or four thin ones — this
  research recommends one shared onCall with a `type` param + an internal dispatch map.

### Deferred Ideas (OUT OF SCOPE)
- Actually enabling the cleanups in production + reviewing the first real deletion → owner action.
- An in-console log/history of past dry-run counts or actual deletions (Future R169).
- Scheduling/automating cleanup enablement.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| R188 | Console shows an on-demand dry-run blast-radius count before a `*_CLEANUP_ENABLED` flag can be turned on, from a callable that forces dry-run regardless of the stored flag | "The Exact Reuse Seam" + "The `previewCleanupDryRun` onCall" sections — the `forceDryRun` param design, the four-handler dispatch table, and the summary-field mapping table |
| R189 | Enabling requires an explicit confirm echoing the dry-run count; flipping the flag never deletes immediately, only the next cron run acts | "Client Flow" section — `CleanupConfigCard.vue` + `CleanupEnableConfirmDialog.vue` wiring, state machine per `71-UI-SPEC.md`, `saveField` write-after-confirm-only |
| R190 | `cleanupOrphanBackgrounds`'s `referencesComplete`/floor-guard fail-safes remain intact after this change; existing unit tests pass unchanged | "`referencesComplete` for Backgrounds" + "R190 Verification" sections — proof the fail-safe code is untouched, existing test list, new same-scan-path test recommendation |
</phase_requirements>

## Standard Stack

### Core
No new library. This phase is glue code over an existing, already-tested handler set and an
already-tested super-admin re-check pattern.

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `firebase-functions` | `^7.2.5` (installed) [VERIFIED: functions/package.json] | `onCall`/`HttpsError`/`CallableRequest` for `previewCleanupDryRun` | Already the only callable-wrapper library in this codebase (`setSuperAdminClaimHandler`, `queueServiceMessageHandler`) |
| `firebase-admin` | `^13.10.0` (installed) [VERIFIED: functions/package.json] | Nothing new — the four handlers already use `getFirestore()`/`getStorage()` | No new capability needed |
| `firebase` (client SDK) | `^12.0.0` (installed) [VERIFIED: package.json] | `httpsCallable` for the client call to `previewCleanupDryRun` | Already the pattern used by `MessageComposer.vue`/`OwnerConsoleView.vue`'s `setSuperAdminClaim` call |
| Vue 3 `Teleport`/`Transition` | built-in | The confirm dialog structure | Already the exact pattern `NewServiceDialog.vue` uses; zero new dependency |

### Supporting
None — no Zod/form library needed; the callable's only input is a 4-value string enum (`type`),
validated with a plain `if` check mirroring `setSuperAdminClaimHandler`'s `typeof`/enum guards.

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| One shared `previewCleanupDryRun` onCall with a `type` dispatch | Four separate onCalls (`previewMediaCleanupDryRun`, etc.) | Four callables means four client `httpsCallable(...)` names to keep in sync with `71-UI-SPEC.md`'s type-arg table, four sets of super-admin re-check boilerplate (or a shared helper anyway) — one callable with a `type` switch is strictly less code for identical behavior, and matches the UI-SPEC's own `previewCleanupDryRun type arg` column (singular callable name) |
| `forceDryRun` param OR'd into the existing `dryRun` line | Extract a separate pure `computeXxxDryRun()` used by both the handler and the callable | Extraction means duplicating (or heavily restructuring) the scan loop, the per-object guard checks, and — critically for backgrounds — the `referencesComplete`/floor-guard block, which is exactly the code Pitfall 2 (research/PITFALLS.md) warns against touching. The forced-param approach changes ONE line per handler and reuses literally the same function body, guaranteeing the preview and the real run can never diverge in behavior. Rejected extraction as strictly higher risk for zero benefit. |

**Installation:** none — no `npm install` needed for this phase.

**Version verification:** `firebase-functions`/`firebase-admin`/`firebase` versions confirmed present
via direct read of `functions/package.json`/`package.json` in this repo (not a registry query — no
new package is being added, so no registry check is needed).

## Package Legitimacy Audit

Not applicable — this phase installs no new packages. No `npm install` step exists in this phase's
plan.

## Architecture Patterns

### System Architecture Diagram

```
CleanupConfigCard.vue (row: "Delete media after inactivity" ... Enable)
        │  click "Enable"
        ▼
  onEnableClick('media')
        │  httpsCallable(functions, 'previewCleanupDryRun')({ type: 'media' })
        ▼
┌─────────────────────────────────────────────────────────────┐
│ previewCleanupDryRun onCall (functions/src/index.ts)         │
│  1. request.auth present? else HttpsError('unauthenticated') │
│  2. request.auth.token.superAdmin === true? else 'permission-│
│     denied'  (Re-check #1, mirrors setSuperAdminClaimHandler)│
│  3. superAdmins/{uid} doc exists (fresh Firestore read)?     │
│     else 'permission-denied'  (Re-check #2)                  │
│  4. type ∈ {media, orphanRenders, backgrounds, pptxSources}? │
│     else HttpsError('invalid-argument')                      │
│  5. dispatch: await HANDLER_MAP[type]({ forceDryRun: true }) │
└───────────────────────────┬───────────────────────────────────┘
                             │  (same function body the cron calls)
                             ▼
        ┌───────────────────────────────────────────┐
        │ cleanupXxxHandler({ forceDryRun: true })   │
        │  const dryRun = forceDryRun === true        │
        │    ? true : !config.cleanup.xxxEnabled;     │  ← the ONE changed line
        │  ...UNCHANGED scan loop, guards, cap,       │
        │  (backgrounds only) referencesComplete/     │
        │  floor-guard fail-safes...                  │
        │  return summary  (dryRun:true, never deletes)│
        └───────────────────────────────────────────┘
                             │
                             ▼  map summary → { wouldDeleteCount, wouldDeleteBytes, referencesComplete? }
                    (field mapping differs per type — see Code Examples)
                             │
                             ▼
CleanupEnableConfirmDialog.vue shows "This will permanently delete up to N objects (X MB)..."
        │  click "Enable" (Confirm)
        ▼
  store.saveField('cleanup.mediaEnabled', true)   ← Phase 70 store, direct Firestore write
        │  (writes appConfig/global via firestore.rules' isSuperAdmin() gate)
        ▼
  Next scheduled cron (cleanupExpiredMedia, 02:00 UTC) reads config fresh, deletes for real
```

### Recommended Project Structure
No new files needed on the server side beyond editing `functions/src/index.ts` (the four handler
signatures + the new `previewCleanupDryRun` export). On the client:
```
src/components/admin/
├── CleanupConfigCard.vue            # extended (Phase 70 file) — Enable/Disable rows
└── CleanupEnableConfirmDialog.vue   # NEW — the confirm modal
```

### Pattern 1: `forceDryRun` param OR'd into the existing dry-run computation
**What:** Each handler gains an optional `opts: { forceDryRun?: boolean } = {}` parameter. The single
existing `dryRun = ...` line (or, for backgrounds, the line feeding `effectiveDryRun`) becomes
`opts.forceDryRun === true ? true : !config.cleanup.xxxEnabled`. Nothing else in the function changes.
**When to use:** Any time a scheduled/handler function needs an on-demand, side-effect-free preview
that must share 100% of its scan/guard logic with the real run.
**Example — `cleanupExpiredMediaHandler` (functions/src/index.ts:1053-1059), current code:**
```typescript
// Source: functions/src/index.ts (this repo)
export async function cleanupExpiredMediaHandler(): Promise<CleanupSummary> {
  const db = getFirestore();
  const config = await getAppConfig(db, { fresh: true });
  // Fail safe: only an explicit opt-in (cleanup.mediaEnabled=true in the
  // resolved config) enables real deletion. Anything else -- unset, false, a
  // malformed value -- leaves this a dry run (R181, fail-closed per R184).
  const dryRun = !config.cleanup.mediaEnabled;
  const bucket = getStorage().bucket();
  // ...scan loop, unchanged...
}
```
**The minimal change (Plan should express it exactly this way):**
```typescript
export async function cleanupExpiredMediaHandler(
  opts: { forceDryRun?: boolean } = {},
): Promise<CleanupSummary> {
  const db = getFirestore();
  const config = await getAppConfig(db, { fresh: true });
  // Fail safe: only an explicit opt-in (cleanup.mediaEnabled=true in the
  // resolved config) enables real deletion. Anything else -- unset, false, a
  // malformed value -- leaves this a dry run (R181, fail-closed per R184).
  // R188: forceDryRun (set only by previewCleanupDryRun) short-circuits to
  // true regardless of config -- the preview can NEVER derive dryRun from
  // the live flag.
  const dryRun = opts.forceDryRun === true ? true : !config.cleanup.mediaEnabled;
  const bucket = getStorage().bucket();
  // ...scan loop, UNCHANGED...
}
```
The `onSchedule` wrapper (`cleanupExpiredMedia`) still calls `cleanupExpiredMediaHandler()` with zero
args, so `opts` defaults to `{}`, `opts.forceDryRun` is `undefined`, `undefined === true` is `false`,
and behavior is byte-identical to today for the real cron. Apply the identical one-line change to
`cleanupOrphanRendersHandler` (index.ts:1224), `cleanupPptxSourcesHandler` (index.ts:1696), and
`cleanupOrphanBackgroundsHandler` (index.ts:1467 — the `dryRun` feeding into `effectiveDryRun` at
line 1531; `effectiveDryRun = dryRun || !referencesComplete` and the `referencesComplete`/floor-guard
block at lines 1469-1529 are completely untouched, since `referencesComplete` is computed
independently of `dryRun`).

### Pattern 2: Super-admin caller re-check (mirror `setSuperAdminClaimHandler`)
**What:** Every privileged onCall independently re-verifies the caller server-side two ways — the
ID-token claim AND a fresh Firestore doc read — never trusting a client-declared flag.
**When to use:** `previewCleanupDryRun`, exactly as `setSuperAdminClaimHandler` already does it.
**Example — Source: `functions/src/superAdminClaims.ts:106-128` (this repo, T-68-03 pattern):**
```typescript
// Source: functions/src/superAdminClaims.ts (this repo)
export async function setSuperAdminClaimHandler(
  request: CallableRequest<SetSuperAdminClaimRequest>,
): Promise<SetSuperAdminClaimResponse> {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Sign in required.");
  }
  // Re-check #1: the caller's own ID-token claim.
  if (request.auth.token.superAdmin !== true) {
    throw new HttpsError("permission-denied", "You must be a super-admin.");
  }
  // Re-check #2: an independent Firestore re-read of the source-of-truth document.
  const callerDoc = await getFirestore().collection("superAdmins").doc(request.auth.uid).get();
  if (!callerDoc.exists) {
    throw new HttpsError("permission-denied", "You must be a super-admin.");
  }
  // ...
}
```
`previewCleanupDryRun` should open with this exact five-line block (adjusted only for its own request
type), then proceed to the `type` validation and dispatch.

### Anti-Patterns to Avoid
- **Deriving `dryRun` from the live config inside the preview:** the single most dangerous mistake
  named in `71-CONTEXT.md`. The `forceDryRun` param must be checked FIRST (`opts.forceDryRun === true
  ? true : ...`), never `... || opts.forceDryRun` in a position where a falsy config read could slip
  through before the OR is evaluated — the ternary form above is unambiguous and matches the existing
  `!config.cleanup.mediaEnabled` fail-closed idiom's style.
- **Refactoring the backgrounds fail-safes "while you're in there":** Pitfall 2 (research/PITFALLS.md)
  documents this exact trap for this exact function. The diff to `cleanupOrphanBackgroundsHandler`
  must be exactly: the function signature gains `opts`, and the `dryRun` line gains the ternary. If a
  diff review shows any change to `referencesComplete`, `effectiveDryRun`, or the floor-guard
  condition (lines 1469-1531), that is the warning sign to stop and re-check.
- **Reading `summary.deletedObjectCount` uniformly across all four types** — see the field-mapping
  table below; for `backgrounds` specifically this is always `0` in forced-dry-run mode and the
  correct field is `summary.orphanCount`.
- **A second, forked scan-and-count function** — rejected explicitly above (Alternatives Considered);
  it can silently under-count if it drifts from the real handler's guards.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Super-admin server-side re-verification | A new claim-check helper | The exact two-check block already in `setSuperAdminClaimHandler` (functions/src/superAdminClaims.ts:106-128) | Already reviewed/tested (T-68-03); a second, slightly-different implementation is a place for the two to drift |
| Focus trap for the confirm dialog | A focus-trap npm package | Hand-rolled `keydown` Tab/Shift+Tab cycling between exactly 2 (or 1, when blocked) focusable elements, per `71-UI-SPEC.md`'s Accessibility section | The UI-SPEC already fully specifies the exact behavior (default focus on Cancel, trap scope, Escape-as-Cancel); the dialog has at most 2 focusable elements, making a full library (`focus-trap`, `vue-focus-lock`) unjustified overhead for this scope |
| Byte formatting | A new formatter/`Intl.NumberFormat` config | `(wouldDeleteBytes / 1024 / 1024).toFixed(1) + ' MB'`, identical to `src/utils/pptxUpload.ts`'s existing `fileMb` shape | UI-SPEC explicitly calls for reusing this exact precedent (Resolved Design Decision 7) |
| Confirm-modal shell (Teleport/backdrop/Transition) | A new modal library or a new structural pattern | Copy `NewServiceDialog.vue`'s exact Teleport/backdrop/Transition/panel structure (functions verified: `src/components/NewServiceDialog.vue:1-33`) | Already proven working in this codebase; UI-SPEC explicitly names this as the pattern to reuse |

**Key insight:** every piece of this phase already has a proven precedent somewhere in this codebase
(the super-admin re-check, the modal structure, the byte formatter, the `saveField` write path). The
only genuinely new code is: the `forceDryRun` param, the `previewCleanupDryRun` dispatch/mapping, the
confirm dialog's focus-trap keydown handler, and the Enable/Disable row state machine.

## Common Pitfalls

### Pitfall 1: Reading the wrong summary field as `wouldDeleteCount`
**What goes wrong:** Mapping `previewCleanupDryRun`'s response for `backgrounds` off
`summary.deletedObjectCount` (as the other three types correctly do) always returns `0`, even when
real orphaned backgrounds exist — because `deletedObjectCount` is ONLY incremented on the LIVE-delete
branch (`try { await file.delete(); deletedObjectCount++; ... }`, index.ts:1572-1575), never on the
dry-run branch. The dry-run/forced-dry-run branch for backgrounds instead increments `orphanCount`
(index.ts:1556, incremented unconditionally for every orphan candidate BEFORE the dry-run check) and
only accumulates `deletedBytes` (index.ts:1559-1565) — it never touches `deletedObjectCount`.
**Why it happens:** The other three handlers (media, orphanRenders, pptxSources) all increment
`deletedObjectCount` directly inside their `if (dryRun) { ... }` branch — so `deletedObjectCount`
genuinely IS the would-delete count for those three. `cleanupOrphanBackgroundsHandler` alone
introduced a separate `orphanCount` field (to distinguish "candidates considered" from "objects
actually deleted this run," since a LIVE run can be capped mid-way by `deleteCapPerRun`), and that
naming asymmetry is easy to miss when writing one generic field-mapping function for all four types.
**How to avoid:** Use the exact per-type mapping table below; write a unit test per type asserting the
mapped `wouldDeleteCount` matches the number of orphan/candidate files the mock bucket was given, not
just that SOME number came back.
**Warning signs:** The backgrounds row's dialog always shows "0 objects" even when the mock/real
Storage bucket has orphaned background files older than the retention window.

| Type | Handler | `wouldDeleteCount` source field | `wouldDeleteBytes` source field | `referencesComplete` source field |
|------|---------|----------------------------------|----------------------------------|-------------------------------------|
| `media` | `cleanupExpiredMediaHandler` | `summary.deletedObjectCount` | `summary.deletedBytes` | — |
| `orphanRenders` | `cleanupOrphanRendersHandler` | `summary.deletedObjectCount` | `summary.deletedBytes` | — |
| `backgrounds` | `cleanupOrphanBackgroundsHandler` | **`summary.orphanCount`** (NOT `deletedObjectCount`) | `summary.deletedBytes` | `summary.referencesComplete` |
| `pptxSources` | `cleanupPptxSourcesHandler` | `summary.deletedObjectCount` | `summary.deletedBytes` | — |

### Pitfall 2: Touching more than the one `dryRun` line in `cleanupOrphanBackgroundsHandler`
**What goes wrong:** Documented in `.planning/research/PITFALLS.md` Pitfall 2 (this milestone's own
prior research) — a well-meaning "clean up the boolean logic while I'm here" edit to
`effectiveDryRun = dryRun || !referencesComplete` or the floor-guard condition can silently drop a
fail-safe while the `forceDryRun` plumbing looks entirely correct.
**Why it happens:** The Firestore-config-driven `dryRun` value and the `referencesComplete` fail-safes
live a few lines apart in the same function body, and the reviewer's attention is on the (correct,
new) `forceDryRun` line right above.
**How to avoid:** The plan's verification step must explicitly diff-review
`cleanupOrphanBackgroundsHandler`'s body and confirm the ONLY change is the function signature (add
`opts` param) and the one `dryRun`-computing line. `referencesComplete`, `effectiveDryRun`'s formula,
and the floor-guard `if` block (lines 1469-1531) must be byte-identical to before this phase.
**Warning signs:** Any test in the existing `cleanupOrphanBackgroundsHandler` describe block
(index.test.ts:1315+) needing modification to keep passing — per R190's explicit constraint, none of
them should need to change.

### Pitfall 3: Preview cost — the same Storage-wide scan as the real cron, invoked on-demand
**What goes wrong:** `previewCleanupDryRun` calling e.g. `cleanupOrphanBackgroundsHandler({
forceDryRun: true })` runs the EXACT same `bucket.getFiles({ prefix: "orgs/", autoPaginate: true })`
full-bucket scan plus two `collectionGroup` scans that the daily cron does. This is not a new cost
category (the cron already does this once a day), but a super-admin clicking Enable repeatedly (e.g.
retrying after a `referencesComplete: false` result) re-runs the full scan each time.
**Why it happens:** There is no cheaper way to get a truthful count without running the same
detection logic — and per R188/71-CONTEXT.md, that IS the requirement ("shares the SAME
scan/reference-detection code the real run uses").
**How to avoid:** Accept this as correct-by-design (an on-demand, super-admin-only, rate-naturally-
limited-by-human-clicking action) — do NOT add caching to the preview path, since a cached preview
result could go stale between the preview and the confirm, undermining the count's truthfulness. No
action needed beyond noting it is not a bug.
**Warning signs:** N/A — this is an accepted, documented tradeoff, not a defect to fix.

## Runtime State Inventory

Not applicable — this is not a rename/refactor/migration phase. No stored data, live service config,
OS-registered state, secrets, or build artifacts carry an old name that needs updating.

## Code Examples

### The `previewCleanupDryRun` onCall (full recommended shape)
```typescript
// Source: this repo's existing patterns (superAdminClaims.ts's re-check +
// index.ts's four handler exports), composed for Phase 71
export type CleanupPreviewType = "media" | "orphanRenders" | "backgrounds" | "pptxSources";

export interface PreviewCleanupDryRunRequest {
  type: CleanupPreviewType;
}

export interface PreviewCleanupDryRunResponse {
  wouldDeleteCount: number;
  wouldDeleteBytes: number;
  referencesComplete?: boolean; // present only for type === "backgrounds"
}

export async function previewCleanupDryRunHandler(
  request: CallableRequest<PreviewCleanupDryRunRequest>,
): Promise<PreviewCleanupDryRunResponse> {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Sign in required.");
  }
  // Re-check #1: caller's own ID-token claim (mirrors setSuperAdminClaimHandler).
  if (request.auth.token.superAdmin !== true) {
    throw new HttpsError("permission-denied", "You must be a super-admin.");
  }
  // Re-check #2: independent Firestore re-read of the source-of-truth doc.
  const callerDoc = await getFirestore().collection("superAdmins").doc(request.auth.uid).get();
  if (!callerDoc.exists) {
    throw new HttpsError("permission-denied", "You must be a super-admin.");
  }

  const { type } = request.data ?? ({} as PreviewCleanupDryRunRequest);
  const VALID_TYPES: CleanupPreviewType[] = ["media", "orphanRenders", "backgrounds", "pptxSources"];
  if (typeof type !== "string" || !VALID_TYPES.includes(type as CleanupPreviewType)) {
    throw new HttpsError("invalid-argument", "type must be one of: " + VALID_TYPES.join(", "));
  }

  switch (type) {
    case "media": {
      const s = await cleanupExpiredMediaHandler({ forceDryRun: true });
      return { wouldDeleteCount: s.deletedObjectCount, wouldDeleteBytes: s.deletedBytes };
    }
    case "orphanRenders": {
      const s = await cleanupOrphanRendersHandler({ forceDryRun: true });
      return { wouldDeleteCount: s.deletedObjectCount, wouldDeleteBytes: s.deletedBytes };
    }
    case "backgrounds": {
      const s = await cleanupOrphanBackgroundsHandler({ forceDryRun: true });
      // NOTE: orphanCount, not deletedObjectCount -- see Pitfall 1 above.
      return {
        wouldDeleteCount: s.orphanCount,
        wouldDeleteBytes: s.deletedBytes,
        referencesComplete: s.referencesComplete,
      };
    }
    case "pptxSources": {
      const s = await cleanupPptxSourcesHandler({ forceDryRun: true });
      return { wouldDeleteCount: s.deletedObjectCount, wouldDeleteBytes: s.deletedBytes };
    }
  }
}

export const previewCleanupDryRun = onCall(previewCleanupDryRunHandler);
```
Note: `s.dryRun` (or `s.effectiveDryRun`-derived `s.dryRun` for backgrounds) will always be `true` in
every branch above, since `forceDryRun: true` was passed — this is itself a cheap runtime assertion
the plan can add (`if (!s.dryRun) throw new Error(...)`) as an extra defense-in-depth belt, though it
should never trip given the ternary in Pattern 1 above.

### Client: calling the preview then confirming (CleanupConfigCard.vue)
```typescript
// Source: this repo's httpsCallable precedent (OwnerConsoleView.vue's
// setSuperAdminClaim call), adapted for Phase 71
import { httpsCallable } from 'firebase/functions'
import { functions } from '@/firebase'

interface PreviewResult {
  wouldDeleteCount: number
  wouldDeleteBytes: number
  referencesComplete?: boolean
}

async function onEnableClick(type: 'media' | 'orphanRenders' | 'backgrounds' | 'pptxSources'): Promise<void> {
  const state = stateFor(type)
  state.status = 'previewing'
  state.previewError = null
  try {
    const preview = httpsCallable<{ type: string }, PreviewResult>(functions, 'previewCleanupDryRun')
    const result = await preview({ type })
    activeDialog.value = { type, ...result.data }
    state.status = 'idle' // dialog owns the interaction from here
  } catch (err) {
    console.error(`[CleanupConfigCard] preview ${type} error:`, err)
    state.previewError = "Couldn't check what would be deleted. Please try again."
    state.status = 'idle'
  }
}

async function onDialogConfirm(): Promise<void> {
  if (!activeDialog.value) return
  const { type } = activeDialog.value
  confirming.value = true
  confirmError.value = null
  try {
    await store.saveField(`cleanup.${configFieldFor(type)}`, true)
    activeDialog.value = null
    // ...2s "Enabled!" flash per UI-SPEC
  } catch (err) {
    confirmError.value = 'Failed to enable. Please try again.'
  } finally {
    confirming.value = false
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| `*_CLEANUP_ENABLED` flipped via `functions/.env` edit + `firebase deploy` (deploy itself was the review step) | Flag lives in `appConfig/global`, flippable from the console — but ONLY behind an on-demand real dry-run + explicit confirm | This phase (R188-R190), completing the v1.9 migration started in Phase 69/70 | Removing deploy friction without this phase's gate would have been a live-toggle regression (Pitfall 1, research/PITFALLS.md); this phase restores an equivalent (arguably stronger, since it shows a real count) review step |
| The four handlers' dry-run tallies only ever printed to Cloud Functions logs | The same tally is now fetchable on-demand via `previewCleanupDryRun`, shown directly in the confirm dialog | This phase | Nobody had to go read Cloud Functions logs before flipping a flag; now the exact count is in front of them at decision time |

**Deprecated/outdated:** none — this phase adds to, never replaces, the existing handler code.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `httpsCallable(functions, 'previewCleanupDryRun')` client import path (`@/firebase`'s `functions` export) mirrors the existing `setSuperAdminClaim` call site exactly | Code Examples | LOW — this is a direct pattern match against code already in this repo (`OwnerConsoleView.vue`), verifiable by the planner/executor by reading that file directly before use |

**If this table is empty:** N/A — one low-risk assumption logged above, everything else in this
research is grounded in direct reads of `functions/src/index.ts`, `functions/src/superAdminClaims.ts`,
`functions/src/appConfig.ts`, `functions/src/index.test.ts`, `src/components/admin/CleanupConfigCard.vue`,
`src/stores/appConfig.ts`, `src/components/NewServiceDialog.vue`, and `71-UI-SPEC.md`/`71-CONTEXT.md`.

## Open Questions

1. **Should `previewCleanupDryRun` assert `s.dryRun === true` before returning, as an extra runtime
   guard?**
   - What we know: given the ternary in Pattern 1, `forceDryRun: true` structurally guarantees
     `dryRun`/`effectiveDryRun` is `true` in every code path.
   - What's unclear: whether the plan should add a defensive `if (!s.dryRun) throw ...` anyway as
     belt-and-suspenders against a future edit to the handler that breaks the ternary.
   - Recommendation: add it — it's a one-line, zero-risk assertion and directly demonstrates R188's
     "never deletes" guarantee to a future reader/reviewer without requiring them to re-derive the
     ternary logic themselves.

## Environment Availability

Skipped — this phase has no new external tool/service dependency. Everything needed (Firebase Admin
SDK, Firestore, Storage, Cloud Functions callable) is already configured and in use by the four
existing handlers and `setSuperAdminClaimHandler`, which this phase only extends.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (functions: `functions/vitest.config.ts` or default, `vitest run`; app: root `vitest.config.ts`) |
| Config file | `functions/package.json`'s `"test": "vitest run"`; root `vite.config.ts` (app suite exclusions per CLAUDE.md) |
| Quick run command (functions) | `cd functions && npx vitest run index.test.ts -t "previewCleanupDryRun"` (once tests exist) |
| Quick run command (app) | `npx vitest run src/components/admin/__tests__/CleanupConfigCard.test.ts` (new/updated test file) |
| Full suite command (functions) | `cd functions && npm test` |
| Full suite command (app) | `npx vitest run` (per CLAUDE.md: excludes `src/rules.test.ts` and `render-service/**` by design — this is the correct baseline command) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|--------------------|--------------|
| R188 | `previewCleanupDryRun` returns a correct `wouldDeleteCount`/`wouldDeleteBytes` for each of the 4 types, using the same field-mapping table above | unit (functions) | `cd functions && npx vitest run index.test.ts -t "previewCleanupDryRun"` | ❌ Wave 0 — new describe block in `functions/src/index.test.ts` |
| R188 | `previewCleanupDryRun` rejects a non-super-admin caller (missing auth, missing token claim, missing `superAdmins/{uid}` doc) — three separate cases, mirroring `setSuperAdminClaimHandler`'s existing test coverage | unit (functions) | same file/command as above | ❌ Wave 0 |
| R188 | `previewCleanupDryRun` NEVER calls `file.delete()`/`renderDoc.ref.delete()` regardless of the live `cleanup.*Enabled` config value (i.e. even with `getAppConfig` mocked to `{ ...DEFAULT_APP_CONFIG, cleanup: { mediaEnabled: true, ... } }`, the preview still deletes nothing) | unit (functions) | same file/command as above | ❌ Wave 0 — this is the load-bearing test proving "forces dry-run regardless of the stored flag" |
| R189 | Clicking Enable calls the callable, shows the dialog with the echoed count; clicking Confirm calls `saveField('cleanup.{x}Enabled', true)`; clicking Cancel writes nothing | component (app, Vue Test Utils) | `npx vitest run src/components/admin/__tests__/CleanupConfigCard.test.ts` | ❌ Wave 0 — new test file, mocking `httpsCallable` and `store.saveField` |
| R189 | Disable writes `saveField('cleanup.{x}Enabled', false)` immediately with no preview call | component (app) | same file/command as above | ❌ Wave 0 |
| R189 | Zero-count preview (`wouldDeleteCount === 0`) still opens the dialog and allows confirming (per UI-SPEC's zero-state copy/color) | component (app) | same file/command as above | ❌ Wave 0 |
| R190 | `cleanupOrphanBackgroundsHandler`'s existing unit tests (references-incomplete forces dry-run, floor-guard forces dry-run, path-guard, group/slide/song-tier reference detection) pass UNCHANGED after the `forceDryRun` param is added | unit (functions) | `cd functions && npx vitest run index.test.ts -t "cleanupOrphanBackgroundsHandler"` | ✅ exists (`functions/src/index.test.ts:1315+`) — verification is that this describe block requires ZERO edits to keep passing |
| R190 | The preview path for `backgrounds` (`forceDryRun: true`) surfaces `referencesComplete: false` when the underlying scan is incomplete, using the exact same reference-detection code as a live run's `referencesComplete: false` case | unit (functions) | `cd functions && npx vitest run index.test.ts -t "previewCleanupDryRun.*backgrounds"` | ❌ Wave 0 — new test case, can reuse `mockBackgroundDb({ slideGroupsThrows: true })` from the existing describe block's helpers |
| R190 | Background confirm dialog hard-blocks the Confirm button when `referencesComplete === false` (no click handler fires) | component (app) | `npx vitest run src/components/admin/__tests__/CleanupEnableConfirmDialog.test.ts` | ❌ Wave 0 — new test file |

### Sampling Rate
- **Per task commit:** functions — `cd functions && npx vitest run index.test.ts`; app — `npx vitest run src/components/admin/`
- **Per wave merge:** `cd functions && npm run build && npm test`; `npm run type-check && npx vitest run`
- **Phase gate:** Full suite green before `/gsd-verify-work` — `cd functions && npm run build && npm test` AND root `npm run type-check && npx vitest run` (per CLAUDE.md, `npm run type-check` not the narrower `-p tsconfig.app.json` form)

### Wave 0 Gaps
- [ ] New describe block(s) in `functions/src/index.test.ts` for `previewCleanupDryRunHandler` — auth/claim/doc re-checks (3 cases), type validation (invalid `type` → `invalid-argument`), per-type dispatch + field-mapping correctness (4 cases, one per type), the "never deletes even when live-enabled" case, and the backgrounds `referencesComplete` pass-through case. Can reuse this file's existing `mockBucket`/`fakeFile`/`mockBackgroundDb`/`fakeBackgroundFile` helpers directly.
- [ ] New `src/components/admin/__tests__/CleanupConfigCard.test.ts` (or extend an existing Phase 70 test file if one exists — check `src/components/admin/__tests__/` first) covering the Enable → preview → confirm → `saveField` flow, the Disable-immediate flow, preview-error and write-error states, and the zero-count dialog variant.
- [ ] New `src/components/admin/__tests__/CleanupEnableConfirmDialog.test.ts` covering the hard-block-on-`referencesComplete:false` case, focus-on-open (Cancel), Escape-as-Cancel, and the destructive-red-vs-indigo Confirm-button color branch.
- [ ] Framework install: none — Vitest + Vue Test Utils already installed and in use by sibling admin component tests (verify the exact existing test-utils import shape by reading an existing `src/components/admin/__tests__/*.test.ts` file, if one exists from Phase 70, before writing new tests).

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|----------------|---------|-------------------|
| V2 Authentication | Indirect | `request.auth` presence check (Firebase Auth ID token, already verified by the Functions runtime before `onCall` invokes the handler) |
| V4 Access Control | **Yes — the core of this phase** | Two independent super-admin re-checks (ID-token claim + fresh Firestore doc read), mirroring `setSuperAdminClaimHandler` exactly — never trust a client-declared authority flag |
| V5 Input Validation | Yes | `type` argument validated against a fixed 4-value allow-list (`invalid-argument` on anything else); no free-text/unbounded input in this callable's request shape |
| V6 Cryptography | No | Not applicable — no new secret/crypto surface introduced |
| V1 Architecture | Yes | The callable is explicitly designed to be structurally incapable of deletion (forced `dryRun`), independent of the caller's privilege level — a compromised/buggy caller can at worst read a count, per `71-CONTEXT.md`'s own "Security & correctness" locked decision |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|-----------------------|
| A non-super-admin calling `previewCleanupDryRun` directly (bypassing the UI) | Elevation of Privilege | The two independent server-side re-checks (token claim + Firestore doc read) — client-only gating is explicitly insufficient (this codebase's own documented Pitfall 8 class, research/PITFALLS.md) |
| A forged/stale ID token claiming `superAdmin: true` after a revocation | Elevation of Privilege | Out of scope for THIS callable specifically (token-revocation propagation is Phase 68's `revokeRefreshTokens` concern, already shipped) — `previewCleanupDryRun` inherits whatever freshness guarantee the token has at call time, same as `setSuperAdminClaimHandler` |
| A client bug/compromise calling the preview with a malformed `type` to probe for an error-message information leak | Information Disclosure (low severity) | The `invalid-argument` `HttpsError` message lists only the 4 valid type strings — no internal detail leaked |
| A super-admin's preview click accidentally deleting data (the anti-pattern this entire phase exists to prevent) | Tampering / Repudiation | `forceDryRun: true` structurally short-circuits `dryRun` to `true` before any delete branch is reached — see Pattern 1 and the recommended defensive `if (!s.dryRun) throw` assertion in Open Questions |

## Sources

### Primary (HIGH confidence)
- `functions/src/index.ts` (this repo) — all four cleanup handlers read in full (lines 960-1788): `cleanupExpiredMediaHandler`, `cleanupOrphanRendersHandler`, `cleanupOrphanBackgroundsHandler`, `cleanupPptxSourcesHandler`, `readDeleteCap`
- `functions/src/appConfig.ts` (this repo) — `getAppConfig`, `AppConfig` shape, `coerceEnableFlag`'s fail-closed semantics
- `functions/src/superAdminClaims.ts` (this repo) — `setSuperAdminClaimHandler`'s two-check caller re-verification pattern to mirror
- `functions/src/index.test.ts` (this repo) — mock shape for `getFirestore`/`getStorage`/`getAppConfig` (lines 1-230), and the full `cleanupOrphanBackgroundsHandler` test setup (`mockBackgroundDb`, `fakeBackgroundFile`, `enableBackgroundCleanup`, lines 1315-1430+)
- `src/components/admin/CleanupConfigCard.vue` (this repo) — the Phase 70 read-only card being extended
- `src/stores/appConfig.ts` (this repo) — `saveField`'s dot-path `setDoc(..., {merge:true})` write shape
- `src/components/NewServiceDialog.vue` (this repo) — the Teleport/backdrop/Transition/panel structure `CleanupEnableConfirmDialog.vue` reuses
- `.planning/phases/71-cleanup-deletion-toggle-safety/71-CONTEXT.md` — locked decisions (verbatim, quoted above)
- `.planning/phases/71-cleanup-deletion-toggle-safety/71-UI-SPEC.md` — the full confirm-flow visual/interaction contract
- `.planning/REQUIREMENTS.md` — R188/R189/R190 exact wording
- `.planning/research/SUMMARY.md` and `.planning/research/PITFALLS.md` (this milestone's own prior research) — Pitfall 1 (live-toggle-before-review) and Pitfall 2 (background fail-safe erosion risk), both directly cited above

### Secondary (MEDIUM confidence)
None — every claim in this document traces directly to a file in this repository; no external
documentation lookup was needed since this phase adds no new library or platform capability.

### Tertiary (LOW confidence)
None.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — zero new dependencies, every library already installed and in active use
- Architecture: HIGH — the reuse seam is derived directly from reading all four handlers' actual current code, not inferred
- Pitfalls: HIGH — Pitfall 1 (field-mapping asymmetry) discovered by direct code inspection this session; Pitfall 2 is this milestone's own prior, already-verified research finding

**Research date:** 2026-08-20
**Valid until:** 30 days (stable, in-repo code — the only invalidation risk is a future phase materially restructuring one of the four cleanup handlers before Phase 71 is planned/executed)
