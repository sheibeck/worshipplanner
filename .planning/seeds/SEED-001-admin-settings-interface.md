---
status: deferred
trigger_when: next milestone is scoped, or any work touches admin/settings UI, or the v1.8 cost-control env knobs need changing
planted_during: v1.8 Cost & Billing Hardening (phases 65–67)
planted_date: 2026-08-20
deferred_date: 2026-08-25
---
# SEED-001: Owner-only admin interface for the v1.8 cost/cleanup settings

> **DEFERRED (2026-08-25).** Not taken in v2.2 (which scoped to configurability + hardening cleanup, not
> the cost/cleanup admin surface). Parked so the v2.2 close audit starts from a clean slate — the idea is
> preserved in full below. **Revisit when any admin/settings-surface work is scoped**, or when a v1.8
> cost-control lever needs to change without a redeploy. To reactivate, flip `status:` back to `dormant`.

## When to Surface
- The owner starts scoping the milestone AFTER v1.8 (this is the owner's stated next-milestone plan, 2026-08-20).
- Any time a v1.8 cost-control setting needs changing and the only lever today is a buried `functions/.env` var + redeploy.
- Any admin/settings-surface work is being planned.

## The Idea
A private, owner-only admin UI to turn the v1.8 cost/cleanup controls on/off and tune them — instead of
editing `functions/.env` and redeploying, which is "too easy to forget" (owner's words). The settings that
today live only as env vars on the Cloud Functions:

- **Cleanup enable switches** (currently global env flags, dry-run by default): `MEDIA_CLEANUP_ENABLED`,
  `PPTX_RENDER_CLEANUP_ENABLED`, `BACKGROUND_CLEANUP_ENABLED`, `PPTX_SOURCE_CLEANUP_ENABLED`.
- **Retention windows** (now env-tunable as of 2026-08-20): `MEDIA_RETENTION_DAYS` (default 30),
  `ORPHAN_RENDER_STALE_HOURS` (24), `BACKGROUND_RETENTION_DAYS` (30), `PPTX_SOURCE_RETENTION_DAYS` (30).
- **Delete blast-radius cap**: `STORAGE_CLEANUP_MAX_DELETES_PER_RUN` (500).
- **AI proxy knobs**: `AI_RATELIMIT_MAX_PER_MIN` (20), `AI_RATELIMIT_MAX_PER_DAY` (500), `AI_ALLOWED_MODELS`,
  `AI_MAX_TOKENS_CEILING` (2048), `AI_PROXY_MAX_INSTANCES` (10).
- **Messaging/fan-out knobs**: `SCHEDULED_MESSAGING_CRON_ENABLED` (off — note: also gates
  schedule-for-later dispatch), `MESSAGE_MAX_RECIPIENTS` (200), `ORG_MAX_EMAILS_PER_DAY` (1000),
  `GLOBAL_MAX_INSTANCES` (20).

## Why This Matters
The v1.8 controls all work, but every lever is a `functions/.env` variable that requires a redeploy and is
invisible in the running app — easy to forget a control exists, easy to set it wrong, and it needs a
developer + a deploy to change. An owner-facing admin panel makes the guardrails observable and adjustable
(and would pair naturally with surfacing the `aiUsage` ledger / dry-run cleanup logs the milestone already
produces — see deferred R169 in-app usage visibility).

## Design considerations to work through at scoping
- **Where the settings live:** moving env vars → Firestore (an admin-only `orgSettings`/`appConfig` doc the
  functions read at runtime) removes the redeploy, but the functions must read config from Firestore instead
  of `process.env`, and the read must be safe/cached. Enable-flags become live toggles.
- **Access control:** this is owner-only (super-admin), distinct from the existing per-org editor/viewer
  RBAC — needs a real admin gate, likely a custom auth claim (builds on the v1.5 custom-claims work).
- **Global vs per-org:** the cleanup flags are currently GLOBAL (all orgs). Decide whether the admin UI keeps
  them global or introduces per-org control (relevant once there's more than one org).
- **Safety for deletion toggles:** a live "enable deletion" toggle is more dangerous than an env var —
  consider a confirm + "show me the dry-run count first" flow so the blast radius is visible before flipping.
