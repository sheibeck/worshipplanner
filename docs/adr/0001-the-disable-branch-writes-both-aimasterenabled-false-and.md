# 0001. The DISABLE branch writes BOTH aiMasterEnabled: false AND

## Status

Accepted

## Context

This rationale is applied consistently at 4 call site(s) across 4 files: `firestore.rules`, `functions/src/orgProvisioning.ts`, `src/stores/auth.ts`, `src/types/organization.ts`. Documented at the time in `82-RESEARCH.md`.

the DISABLE branch writes BOTH `aiMasterEnabled: false` AND `settings.aiEnabled: false` in the SAME merge write, using the EXPLICIT dot-path key form (`'settings.aiEnabled': false`), never a nested `{ settings: { aiEnabl...

## Decision

The rationale below is preserved verbatim from the source comment(s) it was extracted from (tag: `Pitfall`):

**`firestore.rules:112-126`:**

```
      // specifically an ORDINARY editor forging these fields.
      // Phase 82 (R242/R243): `aiMasterEnabled` -- the super-admin-only master
      // AI gate -- is appended to this SAME allow-list, not given its own
      // guard function. It is a DISTINCT top-level field from the pre-existing
      // `settings.aiEnabled` (the church's own AI preference, editor-writable
      // via the settings map) -- never a bare `aiEnabled` at this depth, to
      // avoid the exact name collision 82-RESEARCH.md's Pitfall 1 warns
      // against. Written ONLY by the setOrgAiEnabled Cloud Function via the
      // Admin SDK (functions/src/orgProvisioning.ts), which bypasses these
      // rules entirely -- mirrors `active`'s posture verbatim, INCLUDING the
      // "no exemption for a super-admin's own client SDK" posture (see the
      // CRITICAL test at src/rules.test.ts:682 and its aiMasterEnabled twin):
      // a super-admin client write here would skip setOrgAiEnabled's R243
      // forced-off side effect on `settings.aiEnabled`, reopening the same
      // partial-state hole Phase 78 closed for `active`.
```

**`functions/src/orgProvisioning.ts:662-676`:**

```
 * the DISABLE branch writes BOTH `aiMasterEnabled: false` AND
 * `settings.aiEnabled: false` in the SAME merge write, using the EXPLICIT
 * dot-path key form (`'settings.aiEnabled': false`), never a nested
 * `{ settings: { aiEnabled: false } }` object literal -- the dot-path form is
 * unambiguously a single-field merge and matches SettingsView.vue:1047's own
 * client-side save shape, so a sibling settings field (bibleVersion, etc.)
 * can never be clobbered (82-RESEARCH.md Pitfall 4).
 *
 * EDGE-CASE short-circuit (plan-checker warning #3): a DISABLE call short-
 * circuits ONLY when BOTH `aiMasterEnabled` is already false AND
 * `settings.aiEnabled` is already false -- never on `aiMasterEnabled` alone.
 * A repeat disable call must still re-force `settings.aiEnabled` off if it
 * somehow drifted back on (e.g. write-ordering with a concurrent settings
 * save), so the forced-off write is never silently skipped. ENABLE keeps the
 * plain same-state short-circuit -- there is no forced-on side effect to
```

**`src/stores/auth.ts:121-129`:**

```
  // Phase 82 (R242/R243) — the super-admin MASTER AI gate, read from the org
  // doc's top-level `aiMasterEnabled` field (distinct from
  // `settings.aiEnabled` above). Absent/false => OFF (default) — DELIBERATELY
  // the inverse of vwModeEnabled's `?? true` default, since AI must be off by
  // default for every org (R242). Mirror-written from applyOrgSnapshot, NOT
  // live-synced via onSnapshot — same latency posture as vwModeEnabled/
  // settings (Pitfall 2, 82-RESEARCH.md). Consumed as the first AND-gate leg
  // in `src/utils/claudeApi.ts`'s isAiEnabled() and as SettingsView.vue's AI
  // Features card v-if.
```

**`src/types/organization.ts:187-195`:**

```
   * super-admin explicitly enables it. Written ONLY by the `setOrgAiEnabled`
   * Cloud Function (Admin SDK, `functions/src/orgProvisioning.ts`, Plan 01);
   * `firestore.rules`'s `lifecycleFields()` guard denies every client write
   * path, including a super-admin's own client SDK — mirrors `active`'s
   * write-authority shape exactly. Deliberately a distinct top-level name
   * (never a bare `aiEnabled`) so it can never be confused with or
   * accidentally overwritten via `settings.aiEnabled` (Pitfall 1,
   * 82-RESEARCH.md).
   */
```

## Consequences

Removing or reverting the behavior described above without re-deriving this rationale would reopen the specific defect, edge case, or constraint it documents. Any change to the call sites listed under "Source comments" below should re-read this ADR first and update it if the decision changes, rather than re-accumulating rationale back into the source comment.

## Source comments

- `firestore.rules:112-126`
- `functions/src/orgProvisioning.ts:662-676`
- `src/stores/auth.ts:121-129`
- `src/types/organization.ts:187-195`
