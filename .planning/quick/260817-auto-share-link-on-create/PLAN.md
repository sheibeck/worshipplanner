---
quick_id: 260817-auto-share-link-on-create
slug: auto-share-link-on-create
date: 2026-08-17
mode: quick
status: complete
---

# Quick Task: Auto-generate a share link when a service is created

## Problem

A volunteer message's `{{service_link}}` token is resolved server-side
(`functions/src/index.ts::resolveServiceLink`) from the newest `shareTokens/{token}`
doc for the service. That doc only existed once the user clicked **Share**. So a
service that had never been explicitly shared emailed an **empty** link — silently,
with no signal to the sender. (Observed by owner: sent a real email, no link, because
no link had ever been generated.)

## Fix

Generate the share link at **service creation** so every service always has one.

- `src/stores/services.ts::createService` — after the `addDoc` that creates the
  service, construct the `Service` object and call the existing
  `ensureShareLink(service, orgId)` (which mints the opaque token +
  `serviceShareLinks/{id}` identity doc + `writeSharePayload`). Wrapped in a
  soft-fail `try/catch` (mirrors the Phase 41 share-write discipline: "a share
  problem must never fail the user's create") so a share error never breaks
  service creation.
- From creation on, the existing `maybeRefreshShareLink` keeps the payload current
  on every edit (it already runs on `updateService`/role changes). Updated the stale
  comment that claimed "`createService` has nothing yet to refresh."

No new collections, rules, or functions — reuses the whole Phase 41 share
infrastructure. Server-side `{{service_link}}` resolution is unchanged.

## Verification

- `npx vitest run src/stores/__tests__/services.test.ts` — 95 pass (2 new:
  "auto-generates a share link at creation", "still returns the id when share-link
  generation fails (soft-fail)").
- `npm run type-check` (vue-tsc --build) — clean.

## Considered tradeoff

Every service now has a public (opaque-token) share link from creation, before any
explicit Share. That is the owner's intent ("always have a share link"). The opaque
token is unguessable; the memorable `serviceShares/{slug}__service-{date}` URL is
guessable but low-sensitivity (a worship-plan view) and was already public once
shared. Acceptable and intended.
