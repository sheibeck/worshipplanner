# Phase 129: Admin Resend — Email & Copy - Context

**Gathered:** 2026-09-06
**Status:** Ready for planning
**Mode:** Auto-generated (discuss skipped via workflow.skip_discuss); enriched with the owner's settled architecture.

<domain>
## Phase Boundary

From the Volunteers page, an editor/admin can get a rostered volunteer their sign-in link — **emailed** as
a standalone message OR **copied** to the clipboard — reusing the **same server-side mint/send core** built
in Phase 128, under one authorization model. Requirements: R400, R401, R402. **Depends on Phase 128**
(`functions/src/volunteerLink.ts` shared core + the `requestVolunteerLink` precedent).
</domain>

<decisions>
## Implementation Decisions (owner-settled — honor these)

- **Reuse the shared core (R402 = one code path):** the mint/send logic lives in Phase 128's
  `functions/src/volunteerLink.ts` (`mintAndSendVolunteerLink`). Phase 129 adds a SECOND callable that
  reuses that SAME core — it does NOT reimplement minting/sending.
- **A NEW authenticated callable** (e.g. `adminVolunteerLink` / `sendVolunteerLinkForAdmin`), distinct from
  the public `requestVolunteerLink`:
  - **Authenticated** — `request.auth` required; server-side editor/admin re-check of membership in the
    named org (mirror `queueServiceMessageHandler` ~L1712: `members/{uid}` role ∈ {editor, admin}); never
    trust the client-declared orgId.
  - **Roster-gated** — the target email must be on `organizations/{orgId}/people` (same in-memory lowercase
    compare as Phase 128). Mint uses the normalized `emailLower` (the CR-02 fix — send to the normalized
    address).
  - **mode: 'email'** → mint + send via the shared core, return `{ sent: true }`.
  - **mode: 'copy'** → mint via the shared core, return `{ link }` (the raw sign-in link string) to the
    admin client for clipboard. This is NOT enumeration-sensitive (caller is an authenticated editor who
    can already see the roster), so it deliberately does NOT need the public callable's enumeration-safe /
    rate-limit / timing-pad machinery. A NOT-on-roster / no-email target returns a normal, honest error to
    the admin (unlike the public path).
  - Re-exported from `functions/src/index.ts`, `secrets: [RESEND_API_KEY]`.
- **Volunteers page UI (RosterView.vue):** a per-volunteer affordance offering "Email sign-in link" and
  "Copy sign-in link" (only for people who have an email). Copy uses `navigator.clipboard.writeText`.
- **Trust/impersonation tradeoff (accepted, document in threat model):** an editor minting a volunteer's
  account-level sign-in link can effectively sign in as that (read-only) volunteer. Accepted for this app's
  trust model (small church; editor already has full org access; volunteer view is read-only). The copy
  path also sidesteps prod Resend test-mode entirely.
- **UAT deferred** to the batched pass (PENDING). Do NOT deploy to prod this phase.
</decisions>

<code_context>
## Existing Code Insights (plan-phase research will deepen)

- Shared core: `functions/src/volunteerLink.ts` (`mintAndSendVolunteerLink`), built in Phase 128 — the
  reuse target. The public callable `requestVolunteerLink` (functions/src/index.ts) is the sibling
  precedent for wiring (but its public/enumeration/rate-limit semantics are NOT copied here).
- Editor authz re-check: `queueServiceMessageHandler` (functions/src/index.ts ~L1712) — `members/{uid}`
  role ∈ {editor, admin}.
- Roster fetch + lowercase compare: the Phase 128 roster-gate code in `requestVolunteerLinkHandler`.
- Client callable invocation: `httpsCallable(functions, ...)` (ServiceEditorView.vue ~L3142).
- Volunteers page: `src/views/RosterView.vue` (the per-volunteer row/actions — where the two affordances go).
- Clipboard precedent: search for existing `navigator.clipboard` usage (e.g. share-link copy) to match the
  toast/confirmation pattern.
</code_context>

<specifics>
## Specific Ideas
- Prefer a single callable with a `mode: 'email' | 'copy'` param over two callables (one code path).
- "Copy" returns the link; "Email" sends and returns success — both mint through the shared core.
- Only show the affordance for roster people WITH an email; disable/hide otherwise.
- Match RosterView's existing action-menu / toast conventions; do not invent new chrome.
</specifics>

<deferred>
## Deferred Ideas
None — scope is fixed by R400–R402.
</deferred>
