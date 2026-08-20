# Requirements: WorshipPlanner — v1.8 Cost & Billing Hardening

**Defined:** 2026-08-19
**Core Value:** Smart weekly service planning following the Vertical Worship 1-2-3 methodology while
rotating through the full song stable and respecting team configurations.

**Milestone goal:** Cap and observe every runaway cost surface in the live production app (Blaze plan,
deployed 2026-08-17) so billing stays predictable as usage grows. Grounded in a 2026-08-19 code
investigation; each requirement cites the exposure it closes. Requirement IDs continue the project's
`R###` scheme from v1.7 (which ended at R160).

## v1.8 Requirements

### AI Proxy Cost Controls

The `/api/anthropic` proxy (`functions/src/index.ts:156`, wired via `firebase.json:18`) is the largest
variable bill: authenticated by any signed-in user (`X-App-Auth` ID-token check, index.ts:174) but
otherwise **uncapped**, and it forwards `req.body` byte-unchanged (index.ts:220) so the `model` and
`max_tokens` are chosen entirely client-side (`src/utils/claudeApi.ts:282/362/569`, currently
`claude-haiku-4-5-20251001`, max_tokens 512/512/1024). There is no rate limiting, no usage logging, and
no instance ceiling.

- [x] **R161**: The Claude proxy enforces a server-side per-user (and/or per-org) request rate limit —
      requests beyond a configurable window ceiling are rejected with a clear error, so one signed-in
      user cannot drive unbounded token spend in a loop.

- [x] **R162**: The Claude proxy enforces server-side allow-lists/ceilings for `model` and `max_tokens`
      — a client request naming a more expensive model or a larger `max_tokens` than policy is rejected
      or clamped before it reaches Anthropic, instead of being forwarded unchanged.

- [x] **R163**: Every proxied Claude request records a usage entry (caller uid + org, model, input and
      output token counts, timestamp) to a queryable ledger, so per-user/per-org token spend is
      observable inside the app rather than only on the external Anthropic console.

- [x] **R164**: The `api` proxy function has an explicit `maxInstances` ceiling so a traffic spike or
      abuse cannot fan the function out without bound.

### Storage Retention

Storage grows forever today. Only `orgs/{orgId}/media/` has any retention (14-day, `cleanupExpiredMedia`
index.ts:658) and only `rendered/` orphans are otherwise eligible (`cleanupOrphanRenders` index.ts:812)
— and **both sweeps are dry-run by default** (`MEDIA_CLEANUP_ENABLED`/`PPTX_RENDER_CLEANUP_ENABLED` must
equal `"true"`). Background images (`orgs/{orgId}/backgrounds/…`, `useBackgroundUpload.ts:103`) and PPTX
import sources (`orgs/{orgId}/pptx-imports/{importId}/…`) are **never pruned by any job**.

- [ ] **R165**: Media auto-cleanup is enabled and verified in production — objects under
      `orgs/{orgId}/media/` older than the retention window are actually deleted, not dry-run-logged.
      (First live deletion is an owner-gated deploy per the autonomy grant.)

- [ ] **R166**: Orphan-render cleanup is enabled and verified — stale `pending`/`failed` `rendered/`
      objects are actually deleted. (First live deletion owner-gated.)

- [ ] **R167**: Background images have a defined, implemented retention story so they stop accumulating
      forever — unreferenced/aged backgrounds under `orgs/{orgId}/backgrounds/…` become eligible for
      pruning by a job. (First live deletion owner-gated.)

- [ ] **R168**: PPTX import sources (the source `.pptx` and extracted `images/` under
      `orgs/{orgId}/pptx-imports/{importId}/…`) have a defined, implemented retention story so they stop
      accumulating forever after an import is consumed/rendered. (First live deletion owner-gated.)

### Reminder-Cron Read Cost

`sendScheduledReminders` (index.ts:1025) runs daily and performs **two unbounded cross-org
collection-group scans** — services (index.ts:889) and scheduled messages (index.ts:1109) — with no
`.limit()` and no early gate, so the read cost is paid every day across all orgs even though the
per-org messaging kill-switch is only checked *after* the scan. Owner confirms reminders are **not in
production use**.

- [ ] **R170**: The daily `sendScheduledReminders` cross-org scan no longer runs while reminders are
      unused — the cron is disabled (or gated so it performs no cross-org read) — eliminating the daily
      read cost. Any scheduled-message dispatch that must survive is preserved or independently gated,
      not silently broken.

### Fan-out & Instance Guardrails

No function has a `maxInstances`/concurrency ceiling (`firebase.json` has no global options; only
`parsePptx` sets memory/timeout, index.ts:373). The Resend send loop (index.ts:1782) sends one email
per reachable recipient with no cap. The Cloud Run render service Dockerfile sets no instance/concurrency
limits.

- [ ] **R171**: The Resend send path enforces a volume cap — a per-message maximum recipient count
      and/or a per-org send quota — so a single send (or the crons that enqueue through it) cannot fan
      out without bound.

- [ ] **R172**: Project-wide function instance ceilings are set (a `setGlobalOptions({ maxInstances })`
      and/or explicit per-function caps), covering at least the `api` proxy and `messageWebhook`, so no
      HTTP function can scale out unbounded under load or abuse.

- [ ] **R173**: The Cloud Run PPTX render service has an explicit `--max-instances` (and appropriate
      `--concurrency`) ceiling so rendering cannot scale out without bound.

## Deferred / Future

- **R169 (deferred)**: In-app per-org storage-usage visibility (total bytes per org surfaced in the UI
  or an admin view). Observability nicety; the retention jobs (R165–R168) are the cost fix. Revisit if
  storage cost stays material after retention lands. **Not mapped to any v1.8 phase.**

## Out of Scope

| Feature | Reason |
|---------|--------|
| Watching / capping the Anthropic console bill itself | Metered and billed by Anthropic, invisible to Firebase billing — the owner watches the Anthropic console separately. In-app scope is limiting *our proxy's* token spend (R161–R164), not reading Anthropic's dashboard. |
| GCP billing budget + alert configuration | Cloud Console / billing config, not app code. Recommended owner operational action, handed over — not a buildable requirement in this repo. |
| `messageWebhook` rate limiting | Already HMAC-verified before any Firestore access (index.ts:2008) — an unsigned request is rejected at 401 before any DB read, and all valid-but-unactionable events return 200 to avoid Resend retry storms. The DB-write surface is protected; adding IP throttling is disproportionate to the residual per-invocation cost. |
| Re-enabling reminders behind a smarter query | Reminders are unused (owner); R170 disables the scan. If reminders return later, an indexed/bounded query is a future milestone, not this one. |
| Migrating models or changing AI feature behavior | This milestone caps and observes cost; it does not change which AI features exist or their UX. |

## Traceability

Each requirement maps to exactly one phase. Phase numbering continues from v1.7 at **Phase 65**.

| Requirement | Phase | Status |
|-------------|-------|--------|
| R161 | Phase 65 | Complete |
| R162 | Phase 65 | Complete |
| R163 | Phase 65 | Complete |
| R164 | Phase 65 | Complete |
| R165 | Phase 66 | Pending |
| R166 | Phase 66 | Pending |
| R167 | Phase 66 | Pending |
| R168 | Phase 66 | Pending |
| R170 | Phase 67 | Pending |
| R171 | Phase 67 | Pending |
| R172 | Phase 67 | Pending |
| R173 | Phase 67 | Pending |

**Coverage:**

- v1.8 requirements: 12 total (R161–R168, R170–R173)
- Mapped to phases: 12 ✓ (Phase 65: R161–R164 · Phase 66: R165–R168 · Phase 67: R170–R173)
- Unmapped: 0 ✓
- Deferred (not mapped): R169 — in-app per-org storage-usage visibility

**Phase boundaries:**

- **Phase 65 — AI Proxy Cost Controls** (R161–R164): the metered `api` proxy + `src/utils/claudeApi.ts` client. Largest variable bill, sequenced first. Fully autonomous-deployable.
- **Phase 66 — Storage Retention** (R165–R168): enable/verify the two dry-run sweeps and build retention for the never-pruned backgrounds & pptx-import paths. Mechanisms build/test autonomously; the first live deletion of real objects is an owner-gated deploy.
- **Phase 67 — Fan-out, Cron & Instance Guardrails** (R170–R173): disable the unused daily cross-org reminder scan, cap the Resend send loop, and set function + Cloud Run instance ceilings. All bounded/reversible config → autonomous-deployable.

---
*Requirements defined: 2026-08-19*
*Last updated: 2026-08-19 — traceability filled by the v1.8 roadmap (Phases 65–67; 12/12 mapped, R169 deferred)*
