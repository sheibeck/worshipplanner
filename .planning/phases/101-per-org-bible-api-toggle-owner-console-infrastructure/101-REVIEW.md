---
phase: 101-per-org-bible-api-toggle-owner-console-infrastructure
reviewed: 2026-08-31T13:56:31Z
depth: deep
files_reviewed: 12
files_reviewed_list:
  - src/types/organization.ts
  - functions/src/orgProvisioning.ts
  - functions/src/index.ts
  - functions/src/orgProvisioning.test.ts
  - firestore.rules
  - src/rules.test.ts
  - src/stores/auth.ts
  - src/stores/__tests__/auth.test.ts
  - src/components/admin/OrgConfigDrawer.vue
  - src/components/admin/__tests__/OrgConfigDrawer.test.ts
  - src/components/admin/OrganizationsTab.vue
  - src/components/admin/__tests__/OrganizationsTab.test.ts
findings:
  critical: 0
  warning: 0
  info: 1
  total: 1
status: clean
---

# Phase 101: Code Review Report

**Reviewed:** 2026-08-31T13:56:31Z
**Depth:** deep
**Files Reviewed:** 12
**Status:** clean

## Summary

Reviewed the five Phase 101 commits (`bb80577f`, `d47cc68a`, `8021dfc5`, `24b24346`, `2cd02985`) implementing the per-org Bible API master gate: `Organization.bibleApiEnabled`, the `setOrgBibleEnabled` Cloud Function, the `firestore.rules` deny, the `authStore` mirror, and the Owner Console UI (checkbox + toggle handler + list badge).

This phase was explicitly scoped as a 1:1 mirror of the shipped v2.2 `aiMasterEnabled`/`setOrgAiEnabled`/`onToggleAi` pattern, and it is — I diffed every changed line against its AI-toggle analog and traced the full call chain (`OrganizationsTab.onToggleBible` → `httpsCallable('setOrgBibleEnabled')` → `setOrgBibleEnabledHandler` → `assertSuperAdminCaller` → Firestore merge write → `listOrganizationsHandler` echo → `authStore.applyOrgSnapshot` mirror → `isBibleApiEnabled` computed) and found no divergence that introduces a bug or security gap.

Specific checks performed and confirmed clean:

1. **Authorization ordering.** `setOrgBibleEnabledHandler` calls `assertSuperAdminCaller(request)` as its first statement, before any Firestore read/write, and `assertSuperAdminCaller` itself does dual verification (`request.auth.token.superAdmin === true` AND a Firestore `superAdmins/{uid}` doc existence check) — identical to `setOrgAiEnabledHandler`'s gate, and covered by unit tests asserting `unauthenticated` and `permission-denied` never reach the Firestore write.
2. **firestore.rules deny.** `bibleApiEnabled` + its four audit siblings ride the same `lifecycleFields()` array consumed by `preservesLifecycleFields()`, which uses `request.resource.data.diff(resource.data).affectedKeys().hasAny(lifecycleFields())` on update — this denies any update that touches the field, whether alone or bundled with other legitimate field changes, and denies on create via `.keys().hasAny(...)`. Both an ordinary-editor deny and the CRITICAL super-admin-client-SDK deny were added as rules-test twins of the `aiMasterEnabled` tests, and the existing no-lifecycle-fields org-create test still exercises the widened list.
3. **Default-OFF correctness.** Verified `?? false` (or equivalent) at every read site: `setOrgBibleEnabledHandler`'s `currentBibleApiEnabled = orgData?.bibleApiEnabled ?? false`, `listOrganizationsHandler`'s `bibleApiEnabled: data.bibleApiEnabled ?? false`, `authStore.applyOrgSnapshot`'s `(orgData.bibleApiEnabled as boolean | undefined) ?? false`, and all four `authStore` reset sites (`resetOrgContext`, the null-user branch, `logout`, and the initial declaration) zero the ref. No path leaves it `undefined` in a truthy UI context. The onboard path is untouched, which — per the plan's own reasoning — correctly keeps new orgs OFF by omission.
4. **Input validation.** `orgId` is validated as a non-empty trimmed string and `enabled` as strictly `typeof === "boolean"` before any Firestore access; org-not-found throws `not-found`; the merge write only ever sets literal field names (`bibleApiEnabled`, `bibleApiEnabledAt/By`, `bibleApiDisabledAt/By`) — no dynamic key construction from caller input, so no injection surface.
5. **Contract consistency.** The callable request/response field is `enabled` end-to-end — `SetOrgBibleEnabledRequest`/`Response` in both `orgProvisioning.ts` and the mirrored client-side interfaces in `OrganizationsTab.vue` agree, and this is distinct from `setOrgAiEnabled`'s `aiEnabled` field name (avoiding the collision the AI phase's own research doc warned about for `settings.aiEnabled` vs `aiMasterEnabled`).
6. **Correctness/quality.** `isBibleApiEnabled` is confirmed single-leg (`computed(() => bibleApiEnabled.value)`, no AND against `settings`, matching the deferred-leaf decision). `onToggleBible` has the same double-submit guard (`if (togglingBibleOrgId.value) return`), the same try/catch/finally shape with `friendlyCallableError` on rejection, and does not call `refreshOrgs()` on failure (verified by both code and test). The R301 badge (`v-if="org.bibleApiEnabled"`) reuses the existing indigo badge palette and renders only for explicitly-enabled orgs.

No BLOCKER or WARNING findings. One INFO-level style note below, which does not affect correctness or security and does not need to block this phase.

## Info

### IN-01: `console.error` in a caught, already-surfaced-to-UI callable rejection

**File:** `src/components/admin/OrganizationsTab.vue:724`
**Issue:** `onToggleBible`'s catch block logs `console.error('[OrganizationsTab] setOrgBibleEnabled error:', err)` in addition to surfacing `friendlyCallableError(err)` in the UI. This is intentional and consistent with the existing `onToggleAi` (line 696) and other toggle handlers in this same file, so it is not a regression introduced by this phase — flagging only for completeness since `console.*` calls are a generic anti-pattern signal. No action needed; this matches established project convention in this file and changing it here alone (without a broader file-wide sweep) would create inconsistency rather than remove it.
**Fix:** No change recommended for this phase; if the project later decides to route these through a structured logger, do it file-wide in a dedicated cleanup pass rather than singling out the Bible toggle.

---

_Reviewed: 2026-08-31T13:56:31Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
