---
phase: 75-pending-invite-visibility
reviewed: 2026-08-22T00:00:00Z
depth: standard
files_reviewed: 4
files_reviewed_list:
  - functions/src/orgProvisioning.ts
  - functions/src/orgProvisioning.test.ts
  - src/components/admin/OrganizationsTab.vue
  - src/components/admin/__tests__/OrganizationsTab.test.ts
findings:
  critical: 0
  warning: 0
  info: 2
  total: 2
status: findings
---

# Phase 75: Code Review Report

**Reviewed:** 2026-08-22
**Depth:** standard
**Files Reviewed:** 4
**Status:** findings (Info only — no Critical or Warning issues)

## Summary

Reviewed the diff across commits d2847117 → a9ce4430 (test-first RED, server `pendingCount`, test-first RED, client badge). This is a genuinely additive change: `listOrganizationsHandler` now runs a second `count()` aggregate (`invites`) concurrently with the existing `members` aggregate via `Promise.all`, and the client renders the resulting `pendingCount` as a text-labelled badge in the existing Members cell. No new callable, no `firestore.rules` change, no new client-side cross-org Firestore read.

Verified directly (not just read):
- `npx vitest run src/components/admin/__tests__/OrganizationsTab.test.ts` — 23/23 pass.
- `cd functions && npx vitest run src/orgProvisioning.test.ts` — 30/30 pass.
- `npm run type-check` (the project's mandated `vue-tsc --build` gate, not the narrower `-p tsconfig.app.json` form) — clean, no errors.

Correctness: `orgDoc.ref.collection("invites").count().get()` and the `members` equivalent are dispatched together inside one `Promise.all`, so the new aggregate does not serialize behind the existing one. A real Firestore `count()` aggregate over a collection with zero documents (or a subcollection that was never created) resolves to `{ count: 0 }`, not `undefined`/`NaN` — confirmed against the codebase's own `withCallerGate`/`FakeFirestore` fake and the explicit `pendingCount: 0`-on-omission test case. `pendingCount` is wired end-to-end: `OrgSummary` (server) → `OrgSummary` (client, mirrored) → `org.pendingCount` in the template.

Also checked the one thing that would make `pendingCount` silently wrong: whether accepting an invite deletes the `invites/{email}` doc, since a lingering doc after claim would make an active member look "pending" forever. `src/stores/auth.ts`'s `ensureUserDocument` batch-deletes both `inviteLookup/{email}` and `organizations/{orgId}/invites/{email}` on first login, so the aggregate this phase reads stays accurate for genuinely-unclaimed invites only. This logic predates the phase and was not touched by it.

Security: `assertSuperAdminCaller` is untouched (verified against the pre-phase version — identical). `listOrganizationsHandler` still gates on it before anything else. The new aggregate is Admin-SDK-only (server-side), so no client permission surface changed; a numeric invite count is the only new information reaching the (already fully-privileged) super-admin caller.

Quality: the badge (`bg-amber-900/40 text-amber-300 border border-amber-800/50`, literal " pending" text) matches the existing amber-badge idiom used elsewhere in the app (`PresentationViewer.vue`, `CsvImportModal.vue`'s warning badge) and is not color-only — it fails safe to a plain `{{ org.memberCount }}` with no badge when `pendingCount` is `0` or falsy. No stray `console.log`, no `any`, no dead code. No regressions found in onboarding/assign/list beyond the additive field.

## Critical Issues

None found.

## Warnings

None found.

## Info

### IN-01: A couple of new client test assertions are weaker than the behavior they claim to prove

**File:** `src/components/admin/__tests__/OrganizationsTab.test.ts:129-166`
**Issue:** Two of the three new tests assert on loosely-related substrings rather than the specific rendered output:
- `'shows "0" active plus "1 pending" ..."'` asserts `wrapper.text()).toContain('0')` and `.toContain('1 pending')` separately. The `toContain('0')` half is trivially satisfiable by unrelated page content (e.g. any other `0`-containing string rendered elsewhere) and doesn't actually verify the `0` came from `memberCount` in this org's row.
- `'renders an accessible "N pending" badge ..."'` asserts `.toContain('pending')` and `.toContain('2')` as two separate checks rather than one assertion on the combined `"2 pending"` string, so a bug that decoupled the count from the label (e.g. wrong org's count landing next to the word "pending") would not be caught.

Neither is a functional defect in the shipped code — both pass today because the implementation is correct — but they provide less regression protection than the test names imply.
**Fix:** Tighten to combined-string assertions, e.g. `expect(wrapper.text()).toContain('0')` → assert on the specific cell/row text, or at minimum change both cases to check the joined badge text directly:
```ts
expect(wrapper.text()).toContain('1 pending')
// and, for the badge-present case:
expect(wrapper.text()).toContain('2 pending')
```

### IN-02: Client `pendingCount` is typed as required `number`, matching the wire contract only as long as both sides deploy together

**File:** `src/components/admin/OrganizationsTab.vue:134-140`
**Issue:** `pendingCount: number` (non-optional) is accurate for the paired server/client change in this phase, but if the Functions bundle and the web bundle are ever deployed out of lockstep (an older `listOrganizations` callable without `pendingCount` served to a newer client), `org.pendingCount` would be `undefined` at runtime despite the TS type promising `number`. The template usage (`org.pendingCount > 0`) fails safe (`undefined > 0` is `false`, so no crash and no badge), so this is not a live bug — it's the same latent risk `memberCount` already carries, not something newly introduced by this phase, and not worth blocking on.
**Fix:** No action required for this phase. If deployment ordering is ever a real concern, make the field optional (`pendingCount?: number`) and default it at the render site (`org.pendingCount ?? 0`) — but this is a pre-existing pattern-level concern, not a Phase 75 regression.

---

_Reviewed: 2026-08-22_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
