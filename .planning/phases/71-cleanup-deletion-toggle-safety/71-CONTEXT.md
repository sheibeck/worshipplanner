# Phase 71: Cleanup Deletion-Toggle Safety - Context

**Gathered:** 2026-08-20
**Status:** Ready for planning
**Mode:** Autonomous smart-discuss (grey areas auto-resolved from research/SUMMARY.md + FEATURES.md/PITFALLS.md + REQUIREMENTS.md under the v1.9 autonomy grant; recommended answers accepted). Final phase of v1.9.

<domain>
## Phase Boundary

Make the four `*_CLEANUP_ENABLED` flags flippable from the Owner Console — but ONLY behind a real dry-run
blast-radius preview + an explicit confirm — and prove the song-linked-background protection is intact.
This completes the safety the v1.8 cleanup flags always needed before going live. (Phase 70 rendered these
four toggles read-only precisely so this phase adds the safe flip.)

**In scope (R188, R189, R190):**
- A super-admin-only `previewCleanupDryRun` Cloud Function callable that, for a given cleanup type, runs its
  dry-run computation (forcing dry-run regardless of the stored flag) and returns the blast-radius count
  (objects + bytes it WOULD delete right now), plus `referencesComplete` for the background sweep.
- A client confirm-to-flip flow in `CleanupConfigCard.vue`: to ENABLE a cleanup, first fetch the dry-run
  count, show a confirm that echoes it, and only on confirm write the `cleanup.*Enabled` flag to
  `appConfig/global`. Flipping the flag NEVER deletes immediately — only the next scheduled cron acts.
- Prove/verify R190: `cleanupOrphanBackgrounds`'s `referencesComplete` / floor-guard fail-safes remain intact
  (its existing unit tests pass unchanged) — no cleanup can ever delete a song-linked background.

**Out of scope:** the config doc + runtime read (Phase 69 — done); the console shell + other config panels
(Phase 70 — done); any change to WHAT the cleanup crons delete (the deletion logic + fail-safes are
untouched — this phase only adds a safe PREVIEW + CONFIRM gate in front of the enable flag).
</domain>

<decisions>
## Implementation Decisions

### The dry-run preview callable (R188)
- NEW `previewCleanupDryRun` `onCall` in `functions/src/index.ts` (or a small sibling module), **super-admin
  guarded** — reuse the Phase 68 caller re-check pattern (token `superAdmin` claim AND a `superAdmins/{uid}`
  re-read). It takes a cleanup-type argument (`media` | `orphanRenders` | `backgrounds` | `pptxSources`) and
  returns `{ wouldDeleteCount, wouldDeleteBytes, referencesComplete? }`.
- **It forces dry-run and NEVER deletes**, independent of the stored `*_CLEANUP_ENABLED` value — the `dryRun`
  passed to the compute path is hard-`true`, not derived from config (the exact anti-pattern to avoid: a
  preview that reads the live flag and actually deletes).
- **Reuse the existing dry-run computation**, do not fork it. The four v1.8 cleanup handlers already compute a
  would-delete tally as their dry-run path; the cleanest seam is to extract each handler's scan-and-count
  logic into a callable-invokable function that returns the tally without side effects (or invoke the handler
  with a forced-dry-run flag and capture the tally). The planner/researcher settles the exact seam — the
  constraint is: **zero change to the deletion logic and the fail-safes**; the preview shares the SAME
  scan/reference-detection code the real run uses, so the count is truthful.
- For `backgrounds`, the preview MUST surface `referencesComplete` (the 3-tier reference detection's
  completeness flag). If reference detection is incomplete, the count is not trustworthy — see the enable
  guard below.

### The confirm-to-flip flow (R189)
- In `CleanupConfigCard.vue`, each of the four cleanup rows becomes: current state (on/off) + an **Enable**
  affordance (only when currently off/dry-run). Clicking Enable:
  1. calls `previewCleanupDryRun` for that type (loading state),
  2. shows a confirm dialog echoing the real count: e.g. *"This will permanently delete up to N objects
     (X MB) on the next scheduled run. This cannot be undone. Enable?"* (copy per the UI-SPEC),
  3. only on explicit confirm, writes `cleanup.{type}Enabled = true` to `appConfig/global` via the Phase 70
     store `saveField`.
- **Disabling is immediate and needs no preview** (turning a cleanup OFF is always safe) — a plain toggle
  back to false.
- **Flipping the flag NEVER triggers a deletion in-band** — enabling only means the NEXT scheduled cron run
  will act (the crons read the flag fresh each run, per Phase 69 R183). Make this explicit in the confirm
  copy ("on the next scheduled run").
- **Background-specific guard (song-background protection, owner's hard constraint):** if the backgrounds
  preview returns `referencesComplete: false`, the confirm dialog must WARN and SHOULD block/discourage
  enabling (reference detection incomplete → risk of deleting a still-referenced background). Surface this
  prominently — never let the owner enable background cleanup while references are unproven.

### R190 — song-background protection intact (verify hard)
- No change to `cleanupOrphanBackgroundsHandler`'s deletion logic or its `referencesComplete` / floor-guard
  fail-safes — this phase only reads them (for the preview) and gates the enable. Its existing unit tests
  must pass UNCHANGED. Add a test asserting the preview path invokes the SAME reference-detection the real
  run uses (so the count can't diverge from what would actually be deleted), and that the preview never
  deletes.

### Security & correctness
- `previewCleanupDryRun` is super-admin-only and side-effect-free (a compromised or buggy caller can at worst
  read a count, never delete). The confirm flow is client UX; the REAL protection is (a) the callable's
  forced-dry-run, (b) the cron reading the flag fresh and only deleting on its own schedule, and (c) the
  unchanged fail-safes. Client validation/confirm is not a security boundary.

### Deploy discipline (v1.9 grant)
- The `previewCleanupDryRun` callable is a functions change → ships built + tested + **UNDEPLOYED**, deploy
  command handed to the owner (fold into / reference the existing runtime-config hand-over note). The client
  flow ships built + tested. **Actually enabling a cleanup in production (writing the flag + the resulting
  first real deletion on the next cron) remains the owner's button** — this phase gives them the safe UI to
  do it, it does not do it. No `.env.local`/`functions/.env` writes.

### Claude's Discretion
- The exact refactor seam for the dry-run compute (extracted pure function vs forced-flag handler invocation),
  the callable's request/response shape, the confirm-dialog component (reuse an existing confirm pattern or a
  small new one), and whether the four types share one preview handler with a type param or four thin ones.
</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `functions/src/index.ts` — the four cleanup handlers (`cleanupExpiredMediaHandler`,
  `cleanupOrphanRendersHandler`, `cleanupOrphanBackgroundsHandler`, `cleanupPptxSourcesHandler`), each with an
  existing dry-run path + `deletedBytes`/`cappedByLimit` observability (v1.8 Phase 66) — the scan/count logic
  the preview reuses. `cleanupOrphanBackgroundsHandler` carries the 3-tier reference detection +
  `referencesComplete` + floor-guard (the R190 fail-safes).
- `functions/src/superAdminClaims.ts` (Phase 68) — `setSuperAdminClaimHandler`'s caller re-check pattern to
  mirror for `previewCleanupDryRun`'s super-admin guard.
- `functions/src/appConfig.ts` (Phase 69) — `getAppConfig`; the preview forces dry-run and does NOT depend on
  the stored enable flag.
- `src/components/admin/CleanupConfigCard.vue` (Phase 70) — currently renders the four toggles READ-ONLY;
  this phase adds the Enable→preview→confirm flow. `src/stores/appConfig.ts`'s `saveField` writes the flag.
- Existing client confirm/dialog patterns (e.g. the roster remove-confirm in `OwnerConsoleView.vue` /
  `TeamView.vue`, or `window.confirm` usage) to mirror for the confirm dialog.
- `httpsCallable` usage (`MessageComposer.vue`, `OwnerConsoleView.vue`) for calling `previewCleanupDryRun`.

### Established Patterns
- gen2 `onCall` with server-side caller re-verification; functions-standalone build gate
  (`cd functions && npm run build`); the app type gate `npm run type-check`.

### Integration Points
- New `previewCleanupDryRun` export in `functions/src/index.ts`; `CleanupConfigCard.vue` gains the flow +
  calls the callable; the enable write goes through the existing Phase 70 `saveField`.
</code_context>

<specifics>
## Specific Ideas
- The dry-run preview MUST share the exact scan/reference-detection the real cron uses — a preview computed by
  a separate code path could under-count and lull the owner into enabling an unsafe deletion. Reuse, don't
  fork.
- The single most dangerous anti-pattern to avoid: a "preview" that derives `dryRun` from the live config and
  therefore actually deletes. `dryRun` in the preview is hard-`true`.
- Song-linked backgrounds must NEVER be deletable — the background preview surfaces `referencesComplete`, and
  enabling background cleanup while references are incomplete is warned/blocked.
</specifics>

<deferred>
## Deferred Ideas
- Actually enabling the cleanups in production + reviewing the first real deletion → owner action (hand-over),
  not this phase.
- An in-console log/history of past dry-run counts or actual deletions → out of scope (Future R169).
- Scheduling/automating cleanup enablement → out of scope (owner flips manually via this safe flow).
</deferred>
