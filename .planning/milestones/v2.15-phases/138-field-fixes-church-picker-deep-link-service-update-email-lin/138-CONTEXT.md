# Phase 138: Field Fixes — Church-Picker Deep-Link & Service-Update Email Link - Context

**Gathered:** 2026-09-09
**Status:** Ready for planning

<domain>
## Phase Boundary

Two independent, already-diagnosed defect fixes:
1. **Church-picker deep-link/new-tab bug (R428)** — a multi-church member opening a nav link in a new
   browser tab (right-click → open in new tab) or following a deep link into a fresh tab is bounced to
   `/select-church` instead of the intended page, because the active org is persisted only in
   `sessionStorage` (not inherited by a genuinely-new tab).
2. **Service-update email link (R434)** — order-of-service update / re-lock notification emails do not
   reliably include a working link to the service plan (share link).

Out of boundary: any rehearsal/report time work (Phase 139), Vamps (140/141), and broader messaging/
notification redesign. This phase changes only the org-persistence helpers, the router guard's inputs,
and the re-lock notice email body — no schema changes, no new UI surface.
</domain>

<decisions>
## Implementation Decisions

### Church-Picker Persistence (R428)
- **Two-tier storage:** keep `sessionStorage` as the primary remembered-org store and add a **uid-scoped
  `localStorage` fallback**, changed only inside `src/stores/auth.ts`'s three private helpers
  (`readRememberedOrg` / `rememberOrg` / `clearRememberedOrg`). A genuinely-new tab (empty sessionStorage)
  restores the active org from the localStorage fallback; same-session per-tab behavior is unchanged. This
  is ARCHITECTURE.md's recommended shape — it needs zero changes to `loadOrgContext`, `needsOrgSelection`,
  or the router guard.
- **No cross-tab live sync** — a new tab reads the persisted org on load only; do NOT add a `storage`-event
  listener that live-switches an open tab's active org (preserves the deliberate per-tab isolation the
  original `sessionStorage` design chose, documented at `src/stores/auth.ts:64-70`).
- **Sign-out clears BOTH tiers** — the existing logout clear call must clear the new `localStorage` key too,
  so a different user signing in next on a shared computer sees no leftover church (no cross-account leak).
- **Stale-membership re-validation preserved** — the persisted org is honored only if it is still in the
  user's memberships (`ids.includes(remembered)` in `loadOrgContext`). A user removed from an org since it
  was last remembered is not silently routed into it.

### Service-Update Email Link (R434)
- **Root-cause fix:** append `{{service_link}}` to `ReLockNotifyPrompt.vue`'s **auto-generated re-lock
  notice body** (the diagnosed gap — that body never contained the token).
- **Ensure-link precondition:** guarantee a share link exists before the email is sent (ensure/self-heal
  via the existing `ensureShareLink`/`resolveServiceLink` path). If a link genuinely cannot be produced,
  omit the link line **gracefully** — never substitute an empty/broken token into the email (Pitfall 9).
- **Dead `attachServiceLink` field:** out of scope for this phase (optional defense-in-depth per
  ARCHITECTURE.md). The R434 requirement is satisfied by the auto-body fix + ensure-link guard.

### Claude's Discretion
- Exact `localStorage` key name/shape (mirror the existing `SELECTED_ORG_STORAGE_KEY` uid-scoping).
- Whether the ensure-link step lives client-side (before `queueServiceMessage`) or server-side in the
  send handler — planner/executor decides based on where the null-link risk actually is.
</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/stores/auth.ts` — `readRememberedOrg` / `rememberOrg` / `clearRememberedOrg` (currently
  `sessionStorage`, `SELECTED_ORG_STORAGE_KEY = 'wp.selectedOrg'`, uid-scoped), `loadOrgContext`
  (resolves active org, has the `ids.includes(remembered)` guard), the logout clear call.
- `src/router/index.ts` — the `beforeEach` org-selection guard (~270-352); the `select-church` redirect
  (~281-290). No changes expected here (the fix is upstream in auth.ts).
- Email: `src/components/ReLockNotifyPrompt.vue` (auto-generated re-lock body), `MessageComposer.vue`
  (`{{service_link}}` token palette), `functions/src/messageTokens.ts` (`service_link` → `ctx.serviceLink`),
  `resolveServiceLink` (functions/src/index.ts), `ensureShareLink`/`writeSharePayload`/`maybeRefreshShareLink`
  (src/stores/services.ts).

### Established Patterns
- Firebase Auth already persists the session via IndexedDB (`browserLocalPersistence`), so the session
  survives a new tab; only the org *choice* needs the storage-type fix.
- The messaging `{{service_link}}` token + `resolveServiceLink` are shipped and working — this is a
  wiring/guarantee fix, not new plumbing.

### Integration Points
- Org persistence: auth.ts helpers only (no router change).
- Email: the re-lock notice body + an ensure-link precondition in the send flow.
</code_context>

<specifics>
## Specific Ideas

- Church-picker fix must NOT regress single-church users (the `ids.length === 1` fallback already makes
  them immune) and must NOT break the "viewing as super-admin" enter-any-church path.
- Add a focused test (or extend an existing auth-store test) asserting: new-tab restore from the
  localStorage fallback; sign-out clears both tiers; a persisted-but-no-longer-member org is not honored.
</specifics>

<deferred>
## Deferred Ideas

- Wiring the dead `attachServiceLink` composer option (defense-in-depth, not required for R434).
- Dedicated `{{report_time}}`/`{{rehearsal_dates}}` merge tokens (v2 TIME-EXTRA-03).
</deferred>
