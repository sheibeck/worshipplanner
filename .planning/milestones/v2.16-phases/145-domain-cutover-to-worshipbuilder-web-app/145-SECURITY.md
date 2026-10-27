---
phase: 145
slug: domain-cutover-to-worshipbuilder-web-app
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: 2026-10-27
---

# Phase 145 — Security

> Register authored at plan time (145-01/02/03 `<threat_model>` blocks, revised for the owner's 2026-10-27 scope cut:
> plain 302 redirect, R452 descoped). Verified at ASVS L1 against the post-review-fix code (through 71602d73) using
> grep/test evidence gathered 2026-10-27. SUMMARY threat flags: none. Shared IDs (T-145-29, T-145-SC) appear in
> several plans and are listed once.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| Old origin → new origin | `worship-planner-bc515` Hosting site redirects browsers to `https://worshipbuilder.web.app` | Request path + query (hash stays client-side) |
| Old auth domain (`/__/*`) | Firebase Auth handlers on `worship-planner-bc515.firebaseapp.com` used by Google, password-reset and magic-link flows | OAuth / action-code traffic (never redirected) |
| Browser → Storage bucket | CORS allowlist on `worship-planner-bc515.firebasestorage.app` | Song file downloads (GET/HEAD) |
| Functions → email recipients | Share / rehearse / invite / volunteer links built from `SERVICE_SHARE_BASE_URL` | Link URLs |
| Repo → owner's machine | Runbook commands run by the owner | Status-only checks of `functions/.env` / `.env.local` |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation (evidence) | Status |
|-----------|----------|-----------|----------|-------------|------------------------|--------|
| T-145-01 | Denial of Service | legacy redirect vs reserved `/__/auth/*`, `/__/firebase/init.json` | high | mitigate | Catch-all `^/((?:[^_]\|_(?:[^_]\|$)).*)$` never matches `/__…` — `firebaseHostingTargets.test.ts` evaluates the regexes (33/33 green); runbook Step 6 curls both reserved paths after the deploy, rollback on failure | closed |
| T-145-02 | Information Disclosure | `storage-cors.json` | medium | mitigate | Exact five-origin set, no `*`/blank, scheme+host only (`storageCors.test.ts` green) | closed |
| T-145-03 | Spoofing | email / share links pointing at a wrong host | medium | mitigate | `params.ts` default = new origin (`params.test.ts`); one-slash tests for every link family (functions 729/729); `functions/.env` override handled by runbook Step 0 | closed |
| T-145-04 | Tampering (deploy integrity) | target-less hosting / bare deploy | medium | mitigate | Both hosting blocks carry a `target` (2/2); runbook + ADR name `firebase deploy` and `--only hosting` as forbidden before Step 6 (review fix WR-01, test-guarded) | closed |
| T-145-05 | Spoofing (open redirect) | legacy redirect destination | medium | mitigate | Destination is the literal `https://worshipbuilder.web.app/` + captured path; model test asserts the parsed origin for `//evil.com/x`, `/@evil.com` | closed |
| T-145-06 | Denial of Service | removing old origins mid-transition | medium | mitigate | Old origins + localhost kept in CORS (2 old-origin entries; set equality test) | closed |
| T-145-07 | Information Disclosure | `functions/.env` (secret-bearing, gitignored) | medium | mitigate | Never edited or committed (`git ls-files` empty, `git check-ignore` passes, no history hit). Note: the verifier's incidental grep printed one line of the file (the `SERVICE_SHARE_BASE_URL` value, a public URL — no secret); reported to the owner | closed |
| T-145-08 | Tampering | old-origin literal reintroduced | low | mitigate | `legacyOriginLiterals.test.ts` comment-inclusive scan with fail-first proof (green) | closed |
| T-145-09 / T-145-28 | Denial of Service | rollback blocked by a cached redirect | low | mitigate | Both redirect rules are type 302 (2/2); Roll back / `hosting:clone` documented; post-rollback 200 check added (WR-03) | closed |
| T-145-25 | Denial of Service | runbook mis-ordering | high | mitigate | `cutoverRunbook.test.ts` (17/17) pins heading order and per-step commands: `hosting:app` → functions (+ link check) → new-domain smoke → `hosting:legacy` | closed |
| T-145-26 | Information Disclosure | runbook printing `functions/.env` / `.env.local` | medium | mitigate | Quiet `grep -qE` / `Select-String -Quiet` checks print only OK / NOT OK (3 occurrences); test forbids wholesale printing | closed |
| T-145-27 | Denial of Service | deleting the old site / redirecting `/__/auth/*` | high | mitigate | Runbook + ADR say the old site stays until backlog 999.14; Step 6 curls the reserved paths | closed |
| T-145-29 | Information Disclosure / Tampering | phase commits sweeping in `.planning/graphs/*`, `dist-legacy/`, `functions/lib/`, `functions/.env` | medium | mitigate | Explicit-path staging + per-commit gate; cumulative `git log --name-only c59dab23..HEAD` shows 0 forbidden paths | closed |
| T-145-SC | Tampering (supply chain) | package installs | low | accept | AR-145-01 | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

Production-behavior confirmation of T-145-01/05/27 (reserved-path precedence and query preservation on real Hosting)
is the owner's runbook Step 6, batched to the v2.16 milestone-end UAT (PENDING, not owner-accepted).

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-145-01 | T-145-SC | No package installed or upgraded (`package.json` / lockfiles unchanged since `c59dab23`) | Plans 145-01/02/03 threat models | 2026-10-27 |

*Accepted risks do not resurface in future audit runs.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-10-27 | 14 | 14 | 0 | secure-phase orchestrator (ASVS L1; auditor short-circuited: register at plan time, threats_open 0) |

## Security Audit 2026-10-27

| Metric | Count |
|--------|-------|
| Threats found | 14 |
| Closed | 14 |
| Open | 0 |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-10-27
