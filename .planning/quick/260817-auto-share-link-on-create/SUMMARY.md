---
quick_id: 260817-auto-share-link-on-create
slug: auto-share-link-on-create
date: 2026-08-17
mode: quick
status: complete
---

# Summary: Auto-generate a share link when a service is created

**Done.** `createService` now calls `ensureShareLink` right after creating the
service doc, so every service has a `shareTokens` doc from creation — meaning a
volunteer message's `{{service_link}}` always resolves, even for a service that was
never manually "Shared." Soft-fail: a share error is logged and swallowed, never
failing the create.

## Files changed
- `src/stores/services.ts` — `createService` generates the link via `ensureShareLink`
  (soft-fail try/catch); updated the stale `maybeRefreshShareLink` comment.
- `src/stores/__tests__/services.test.ts` — +2 tests (link generated at creation;
  soft-fail still returns the id).

## Gates
- Client tests: `services.test.ts` 95/95 pass.
- `npm run type-check` clean.

## Deploy / follow-up
- **Client-only change** — ships with the next `hosting` deploy (no functions/rules
  change). The server-side `{{service_link}}` resolver is unchanged.
- Existing services created **before** this change still have no link until edited or
  Shared once — this fix is forward-looking (going-forward, like the org-name work).
  A backfill (mint links for existing services) was not requested; note it if the
  owner wants old services covered.
